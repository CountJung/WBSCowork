/** Read-only access probes + two synthetic small forms; no deletion/cleanup runner. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { Miniflare, Log, LogLevel } from "miniflare";
import { encode } from "next-auth/jwt";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

assert.equal(typeof global.gc, "function", "Run with node --expose-gc");
const baseline = process.argv.includes("--baseline"), origin = "https://http-concurrency.example.test";
const output = path.resolve(`.test-artifacts/http-concurrency/${baseline ? "baseline" : "fixed"}`);
await mkdir(output, { recursive: true });
const before = await buildSnapshot(["dist/server", "dist/client"]), trace = [], assertions = [];
const check = (value, label) => { assert.ok(value, label); assertions.push(label); console.log(`PASS ${label}`); };
async function modules(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await modules(file));
    else if (file.endsWith(".js")) result.push({ type: "ESModule", path: file });
  }
  return result;
}
const secret = randomBytes(32).toString("hex"), entry = path.resolve("dist/server/index.js");
// A local-only driver makes malformed upstream streams representable even though
// Undici correctly rejects mismatched HTTP Content-Length before reaching Worker.
// Ordinary requests pass untouched to the exact imported production entry.
const driver = path.join(output, "qa-driver.js"), driverImport = path.relative(path.dirname(driver), entry).split(path.sep).join("/");
const driverContents = `import worker from ${JSON.stringify(driverImport)};
export default {async fetch(request,env,ctx){
 const url=new URL(request.url), mode=url.searchParams.get("__qaInput");
 if(mode){url.searchParams.delete("__qaInput");const headers=new Headers(request.headers);headers.delete("content-length");
  let body;if(mode==="spoof"){body=await request.arrayBuffer();headers.set("content-length","2");}
  else if(mode==="cancel"){body=new ReadableStream({start(controller){controller.error(new Error("SYNTHETIC_CANCELLED_INPUT"));}});}
  else return new Response("unknown QA driver mode",{status:400});
  request=new Request(url,{method:request.method,headers,body,duplex:"half"});
 }
 return worker.fetch(request,env,ctx);
}};`;
const mf = new Miniflare({ cf: false, name: "wbs-http-concurrency", modulesRoot: path.resolve("."),
  modules: [{ type: "ESModule", path: driver, contents: driverContents }, ...(await modules(path.resolve("dist/server")))],
  compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "http-concurrency" }, r2Buckets: { ATTACHMENTS: "http-concurrency" },
  assets: { directory: path.resolve("dist/client"), binding: "ASSETS", routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true } },
  bindings: { NEXTAUTH_SECRET: secret, NEXTAUTH_URL: origin, GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic-not-credential", SUPERUSER_EMAIL: "synthetic-su@example.test" },
  log: new Log(LogLevel.ERROR) });
let releaseFirst, timeout;
const request = async (route, cookie, init = {}) => {
  const response = await consumeWorkerResponse(await mf.dispatchFetch(origin + route, { ...init, headers: { ...(cookie ? { Cookie: cookie } : {}), ...init.headers }, redirect: "manual" }), { route, method: init.method ?? "GET" });
  trace.push({ path: new URL(route, origin).pathname, method: init.method ?? "GET", status: response.status, contentType: response.headers.get("content-type"), retryAfter: response.headers.get("retry-after") });
  return response;
};
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) for (const sql of (await readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await db.prepare(sql).run();
  for (const id of [1, 2]) await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,'member')").bind(id, `synthetic-${id}@example.test`, `Synthetic ${id}`).run();
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Synthetic concurrency','2026-01-01','2027-12-31')").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'Synthetic concurrency task','2026-01-01','2027-12-31')").run();
  await db.prepare("INSERT INTO bug_reports(id,reporter_id,title,reproduction,expected,actual,creation_token,last_operation_token) VALUES(1,1,'SYNTHETIC_PRIVATE_REPORT','steps','expected','SYNTHETIC_PRIVATE_RESULT',?,?)").bind(randomUUID(),randomUUID()).run();
  const cookies = {};
  for (const id of [1, 2]) cookies[id] = `__Secure-next-auth.session-token=${await encode({ secret, token: { email: `synthetic-${id}@example.test`, role: "member", isSuperuser: false }, maxAge: 3600 })}`;

  // Keep actual forbidden/missing responses across GC; no content or cookies enter logs.
  const forbidden = await request("/bugs/1", cookies[2]), missing = await request("/bugs/999999", cookies[2]);
  for (let i = 0; i < 12; i++) { global.gc(); await setImmediate(); }
  check(forbidden.status === 404 && missing.status === 404, "actual forbidden and missing report retain identical 404 status");
  check(!(await forbidden.text()).includes("SYNTHETIC_PRIVATE_RESULT") && !(await missing.text()).includes("SYNTHETIC_PRIVATE_RESULT"), "actual delayed report bodies survive GC and preserve private boundary");

  const route = "/tasks?projectId=1&taskId=1", html = await (await request(route, cookies[1])).text();
  const direct = [...html.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(match => match[1]).find(id => id.endsWith("#createSubmissionAction"));
  const reference = html.match(/([a-f0-9]+)#createSubmissionAction[^A-Za-z]/)?.[1];
  const action = direct ?? (reference && `$ACTION_ID_${reference}#createSubmissionAction`); check(Boolean(action), "actual Worker exposes synthetic create-submission action");
  const actionOrigin = new URL(await mf.ready).origin;
  function form(marker) {
    const boundary = "wbs-small-concurrency", fields = [[action, ""], ["operationToken", randomUUID()], ["projectId", "1"], ["taskId", "1"], ["content", marker], ["visibility", "private"]];
    return { boundary, bytes: Buffer.from(fields.map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join("") + `--${boundary}--\r\n`) };
  }
  const one = form("SYNTHETIC_CONCURRENT_ONE"), two = form("SYNTHETIC_CONCURRENT_TWO");
  const gate = new Promise(resolve => { releaseFirst = resolve; }); let started;
  const ready = new Promise(resolve => { started = resolve; }); let part = 0;
  const paused = new ReadableStream({ async pull(controller) {
    if (part === 0) { part++; controller.enqueue(one.bytes.subarray(0, 64)); started(); return; }
    await gate; controller.enqueue(one.bytes.subarray(64)); controller.close();
  } });
  const init = file => ({ method: "POST", headers: { Origin: actionOrigin, "Content-Type": `multipart/form-data; boundary=${file.boundary}`, "Content-Length": String(file.bytes.length) }, body: file.bytes });
  timeout = setTimeout(() => releaseFirst(), 10000);
  const first = request(route, cookies[1], { ...init(one), body: paused, duplex: "half" });
  await ready; await new Promise(resolve => setTimeout(resolve, 80));
  check((await request("/api/auth/session", cookies[1])).status === 200, "GET session remains responsive while a small multipart body is paused");
  const second = await request(route, cookies[1], init(two)); const secondBody = await second.text();
  releaseFirst(); clearTimeout(timeout); const firstResponse = await first; await firstResponse.text();
  const rows = (await db.prepare("SELECT content FROM submissions ORDER BY id").all()).results;
  check(firstResponse.status === 303, "paused small form finishes normally after release");
  if (baseline) {
    check(second.status === 503 && second.headers.get("retry-after") === "2" && secondBody === "업로드가 처리 중입니다. 잠시 후 다시 시도해 주세요.", "baseline small-form 503 is exact admission response, not a render/DB failure");
    check(rows.length === 1 && rows[0].content === "SYNTHETIC_CONCURRENT_ONE", "baseline rejected small form has no submission mutation");
  } else {
    check(second.status === 303 && rows.length === 2, "two bounded small forms both succeed without retry");
    check(rows.some(row => row.content === "SYNTHETIC_CONCURRENT_ONE") && rows.some(row => row.content === "SYNTHETIC_CONCURRENT_TWO"), "both independent small-form contents persist exactly once");

    const count = async () => Number((await db.prepare("SELECT count(*) n FROM submissions").first()).n);
    const beforeSpoof = await count(), spoof = form("SYNTHETIC_SPOOF_MUST_NOT_COMMIT");
    const spoofed = await request(route + "&__qaInput=spoof", cookies[1], init(spoof)); await spoofed.text();
    check(spoofed.status === 413 && await count() === beforeSpoof, "actual forged low Content-Length returns413 before any submission commit");

    const unknown = form("SYNTHETIC_UNKNOWN_LENGTH"), beforeUnknown = await count(); let releaseUnknown, unknownStarted, unknownPart = 0;
    const unknownGate = new Promise(resolve => { releaseUnknown = resolve; }), unknownReady = new Promise(resolve => { unknownStarted = resolve; });
    const unknownBody = new ReadableStream({ async pull(controller) {
      if (unknownPart++ === 0) { controller.enqueue(unknown.bytes.subarray(0, 64)); unknownStarted(); return; }
      await unknownGate; controller.enqueue(unknown.bytes.subarray(64)); controller.close();
    } });
    const unknownPending = request(route, cookies[1], { method: "POST", headers: { Origin: actionOrigin, "Content-Type": `multipart/form-data; boundary=${unknown.boundary}` }, body: unknownBody, duplex: "half" });
    await unknownReady; await new Promise(resolve => setTimeout(resolve, 80));
    let unknownRejected, unknownRejectedBody;
    try { unknownRejected = await request(route, cookies[1], init(form("SYNTHETIC_DURING_UNKNOWN_REJECTED"))); unknownRejectedBody = await unknownRejected.text(); }
    finally { releaseUnknown(); }
    const unknownAccepted = await unknownPending; await unknownAccepted.text();
    check(unknownRejected.status === 503 && unknownRejected.headers.get("retry-after") === "2" && unknownRejectedBody === "업로드가 처리 중입니다. 잠시 후 다시 시도해 주세요." && unknownAccepted.status === 303 && await count() === beforeUnknown + 1, "unknown-length form reserves full22MiB and rejects overlapping form without mutation");
    const afterUnknown = await request(route, cookies[1], init(form("SYNTHETIC_AFTER_UNKNOWN"))); await afterUnknown.text();
    check(afterUnknown.status === 303 && await count() === beforeUnknown + 2, "completed unknown-length form releases full reservation");

    function largeForm(marker, sizeMiB, pause = false, knownLength = true) {
      const fields = form(marker), suffix = Buffer.from(`--${fields.boundary}--\r\n`);
      const head = Buffer.concat([fields.bytes.subarray(0, fields.bytes.length - suffix.length), Buffer.from(`--${fields.boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="synthetic.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`)]);
      const tail = Buffer.from(`\r\n--${fields.boundary}--\r\n`); let part = -1, release, started;
      const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
      const stream = new ReadableStream({ async pull(controller) {
        if (part === -1) { part = 0; controller.enqueue(head); started(); return; }
        if (pause) await gate;
        if (part++ < sizeMiB) controller.enqueue(new Uint8Array(1024 * 1024));
        else { controller.enqueue(tail); controller.close(); }
      } });
      return { ready, release, init: { method: "POST", headers: { Origin: actionOrigin, "Content-Type": `multipart/form-data; boundary=${fields.boundary}`, ...(knownLength ? { "Content-Length": String(head.length + sizeMiB * 1024 * 1024 + tail.length) } : {}) }, body: stream, duplex: "half" } };
    }
    // Pause the rejected sender after its multipart header too. Admission uses
    // the declared 20MiB size, so receiving an early503 need not race a burst of
    // 1MiB writes through Miniflare's Node HTTP bridge after the peer has closed.
    const largeOne = largeForm("SYNTHETIC_LARGE_ONE", 20, true), largeTwo = largeForm("SYNTHETIC_LARGE_TWO", 20, true);
    // Attach rejection handlers as soon as concurrent requests start. A first
    // upload failure must be reported with the second result, not escape as an
    // unhandled rejection while the second request is still being awaited.
    const observe = promise => promise.then(response => ({ response }), error => ({ error }));
    const largePending = observe(request(route, cookies[1], largeOne.init));
    await largeOne.ready; await new Promise(resolve => setTimeout(resolve, 80));
    let rejectedResult;
    try { rejectedResult = await observe(request(route, cookies[1], largeTwo.init)); }
    finally { largeOne.release(); largeTwo.release(); }
    const acceptedResult = await largePending;
    const failures = [["first paused20MiB upload", acceptedResult], ["second overlapping20MiB upload", rejectedResult]]
      .filter(([, result]) => "error" in result).map(([label, result]) => new Error(label, { cause: result.error }));
    if (failures.length) throw new AggregateError(failures, "Concurrent large-upload transport failed; no HTTP status is treated as successful");
    const largeRejected = rejectedResult.response, largeRejectedBody = await largeRejected.text();
    const largeAccepted = acceptedResult.response; await largeAccepted.text();
    check(largeRejected.status === 503 && largeRejected.headers.get("retry-after") === "2" && largeRejectedBody === "업로드가 처리 중입니다. 잠시 후 다시 시도해 주세요." && largeAccepted.status === 303, "two declared20MiB uploads admit one full file and reject one before file streaming with exact retryable admission503");
    const attachments = (await db.prepare("SELECT sa.file_path,sa.file_size_bytes FROM submission_attachments sa JOIN submissions s ON s.id=sa.submission_id WHERE s.content LIKE 'SYNTHETIC_LARGE_%'").all()).results;
    const bucket = await mf.getR2Bucket("ATTACHMENTS");
    check(attachments.length === 1 && attachments[0].file_size_bytes === 20 * 1024 * 1024 && (await bucket.head(attachments[0].file_path))?.size === 20 * 1024 * 1024, "one20MiB metadata/R2 object persists and rejected upload has no mutation");

    const beforeOversize = await count(), oversize = largeForm("SYNTHETIC_OVERSIZE_MUST_NOT_COMMIT", 23, false, false);
    const over = await request(route, cookies[1], oversize.init); await over.text();
    check(over.status === 413 && await count() === beforeOversize, "unknown-length actual body over22MiB returns413 without commit");
    const afterOversize = await request(route, cookies[1], init(form("SYNTHETIC_AFTER_OVERSIZE"))); await afterOversize.text();
    check(afterOversize.status === 303 && await count() === beforeOversize + 1, "413 releases reservation so next small form succeeds without retry");

    const beforeCancel = await count();
    let cancelStatus = null, cancelFailure = null;
    try { const cancelled = await request(route + "&__qaInput=cancel", cookies[1], init(form("SYNTHETIC_CANCEL_MUST_NOT_COMMIT"))); cancelStatus = cancelled.status; await cancelled.text(); }
    catch (error) { cancelFailure = error.message; assert.match(cancelFailure, /SYNTHETIC_CANCELLED_INPUT/); }
    check((cancelFailure !== null || [400, 500].includes(cancelStatus)) && await count() === beforeCancel, "cancelled input fails explicitly before commit");
    const afterCancel = await request(route, cookies[1], init(form("SYNTHETIC_AFTER_CANCEL"))); await afterCancel.text();
    check(afterCancel.status === 303 && await count() === beforeCancel + 1, "cancelled input releases reservation for next small form");
    check((await request("/api/auth/session", cookies[1])).status === 200, "GET session remains healthy after stream failures and large admission");
  }
  check(Number((await db.prepare("SELECT count(*) n FROM bug_reports").first()).n) === 1 && Number((await db.prepare("SELECT count(*) n FROM tasks").first()).n) === 1 && Number((await db.prepare("SELECT count(*) n FROM users").first()).n) === 2, "preexisting synthetic report, task and users preserved");
  const submissions = Number((await db.prepare("SELECT count(*) n FROM submissions").first()).n);
  await writeFile(path.join(output, "result.json"), JSON.stringify({ complete: true, baseline, checks: assertions.length, assertions, formBytes: [one.bytes.length, two.bytes.length], statuses: [firstResponse.status, second.status], submissions, trace }, null, 2));
} finally {
  releaseFirst?.(); clearTimeout(timeout); await mf.dispose(); const after = await buildSnapshot(["dist/server", "dist/client"]);
  await writeFile(path.join(output, "build-provenance.json"), JSON.stringify({ before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) }, null, 2));
  assert.deepEqual(after, before, "Worker artifact changed during focused HTTP QA");
}
