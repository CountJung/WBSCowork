/** Exact compiled Worker report renderer smoke; ephemeral D1/R2, synthetic JWTs. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { Miniflare, Log, LogLevel } from "miniflare";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

const origin = "https://project-report-smoke.example.test", secret = randomBytes(32).toString("hex");
const out = path.resolve(".test-artifacts/project-report-http"); await mkdir(out, { recursive: true });
const before = await buildSnapshot(["dist/server", "dist/client"]), trace = [], assertions = [], downloadHeaders = [];
async function modules(directory) { const result = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) result.push(...await modules(file)); else if (file.endsWith(".js")) result.push({ type: "ESModule", path: file }); } return result; }
const entry = path.resolve("dist/server/index.js"), mf = new Miniflare({ cf: false, modules: [{ type: "ESModule", path: entry }, ...(await modules(path.resolve("dist/server"))).filter(item => item.path !== entry)], modulesRoot: path.resolve("dist/server"), compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "project-report-http" }, r2Buckets: { ATTACHMENTS: "project-report-http" }, assets: { directory: path.resolve("dist/client"), binding: "ASSETS", routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true } }, bindings: { NEXTAUTH_URL: origin, NEXTAUTH_SECRET: secret, GOOGLE_CLIENT_ID: "synthetic", GOOGLE_CLIENT_SECRET: "synthetic-not-credential", SUPERUSER_EMAIL: "synthetic-report-su@example.test" }, log: new Log(LogLevel.ERROR) });
const check = (value, label) => { assert.ok(value, label); assertions.push(label); console.log(`PASS ${label}`); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
async function request(route, cookie, body, headers = {}) {
  const response = await consumeWorkerResponse(await mf.dispatchFetch(origin + route, { ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }), headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { Origin: origin, "Content-Type": "application/json" }), ...headers }, redirect: "manual" }), { route, method: body === undefined ? "GET" : "POST" });
  trace.push({ path: new URL(route, origin).pathname, status: response.status, contentType: response.headers.get("content-type"), cacheControl: response.headers.get("cache-control") }); return response;
}
function inspect(bytes, format) { const program = "import io,json,sys,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert z.testzip() is None\nnames=z.namelist();selected=['word/document.xml'] if sys.argv[1]=='docx' else [n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')]\nprint(json.dumps({'text':''.join(e.text or '' for n in selected for e in E.fromstring(z.read(n)).iter() if e.tag.endswith('}t')),'names':names},ensure_ascii=False))"; const result = spawnSync("python3", ["-c", program, format], { input: bytes, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
try {
  const db = await mf.getD1Database("DB"), bucket = await mf.getR2Bucket("ATTACHMENTS");
  for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) for (const sql of (await readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await db.prepare(sql).run();
  await db.prepare("INSERT INTO users(id,email,name,role) VALUES(1,'report-admin@example.test','Synthetic report administrator','admin'),(2,'report-member@example.test','Synthetic report member','member')").run();
  await db.prepare("INSERT INTO projects(id,name,access_mode,start_date,end_date) VALUES(1001,'Synthetic compiled report','members_only','2026-10-01','2026-12-01')").run();
  await db.prepare("INSERT INTO project_members(project_id,user_id) VALUES(1001,1),(1001,2)").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date,created_at) VALUES(2001,1001,'Synthetic compiled task','2026-10-01','2026-12-01','2026-10-20 01:00:00')").run();
  for (const [id, visibility, content] of [[3001, "public", "COMPILED_PUBLIC_한글"], [3002, "private", "COMPILED_PRIVATE_MUST_NOT_LEAK"]]) {
    await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility,created_at) VALUES(?,2001,2,?,?,'2026-10-22 01:00:00')").bind(id, content, visibility).run();
    await db.prepare("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,created_at) VALUES(?,1,2,?,?,'2026-10-22 01:00:00')").bind(id, content, visibility).run();
  }
  const cookies = {};
  for (const [id, email] of [[1, "report-admin@example.test"], [2, "report-member@example.test"]]) cookies[id] = `__Secure-next-auth.session-token=${await encode({ secret, token: { email, role: "guest", isSuperuser: false }, maxAge: 3600 })}`;
  const period = { start: "2026-10-21T00:00:00.000Z", end: "2026-10-23T00:00:00.000Z", timeZone: "Asia/Seoul", audienceMode: "public_only" };
  const previewPath = "/api/projects/1001/reports/preview?" + new URLSearchParams(period);
  check((await request(previewPath)).status === 401, "compiled anonymous preview requires login401");
  check((await request(previewPath, cookies[2])).status === 404, "compiled member preview denied404");
  const preview = await request(previewPath, cookies[1]), snapshot = await preview.json();
  check(preview.status === 200 && JSON.stringify(snapshot).includes("COMPILED_PUBLIC_한글") && !JSON.stringify(snapshot).includes("COMPILED_PRIVATE_MUST_NOT_LEAK"), "compiled assigned admin preview excludes private data");
  const input = { projectId: 1001, requestId: randomUUID(), ...period, formats: ["docx", "pptx"], dryRun: false };
  const created = await request("/api/project-reports", cookies[1], input), body = await created.json();
  check(created.status === 201 && body.status === "rendered" && body.artifacts?.length === 2, `compiled isolate renders DOCX and PPTX (${created.status}/${body.code ?? body.status})`);
  const replay = await request("/api/project-reports", cookies[1], input), replayBody = await replay.json();
  check(replay.status === 200 && replayBody.runId === body.runId && replayBody.deduplicated === true, "compiled replay reuses run/artifacts without generation");
  check((await request("/api/project-reports?projectId=1001", cookies[2])).status === 404, "compiled member report listing denied404");
  const files = [];
  for (const file of body.artifacts) {
    check((await request(file.downloadUrl, cookies[2])).status === 404 && (await request(file.downloadUrl)).status === 401, `${file.format} compiled private artifact download boundary`);
    const downloaded = await request(file.downloadUrl + "?inline=1", cookies[1]), bytes = new Uint8Array(await downloaded.arrayBuffer()), zip = inspect(bytes, file.format);
    const mime = file.format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const headers = Object.fromEntries(["content-type", "content-length", "content-disposition", "cache-control", "content-security-policy", "x-content-type-options", "mf-content-encoding", "transfer-encoding"].map(name => [name, downloaded.headers.get(name)]));
    downloadHeaders.push({ format: file.format, actualBytes: bytes.length, expectedMime: mime, headers });
    await writeFile(path.join(out, "download-headers.json"), JSON.stringify(downloadHeaders, null, 2));
    check(downloaded.status === 200 && bytes.length === file.sizeBytes && hash(bytes) === file.sha256 && downloaded.headers.get("etag") === `"${file.sha256}"`, `${file.format} compiled download preserves exact bytes/size/hash/etag`);
    check(downloaded.headers.get("content-type") === mime && (downloaded.headers.get("content-length") === String(bytes.length) || (downloaded.headers.get("content-length") === null && downloaded.headers.get("transfer-encoding") === "chunked")) && downloaded.headers.get("content-disposition")?.startsWith("attachment;") && downloaded.headers.get("cache-control") === "private, no-store" && downloaded.headers.get("content-security-policy")?.startsWith("sandbox;"), `${file.format} compiled MIME/security headers refuse inline mode; fixed or chunked framing retains verified size/hash`);
    check(zip.text.includes("COMPILED_PUBLIC_한글") && !zip.text.includes("COMPILED_PRIVATE_MUST_NOT_LEAK") && !zip.names.some(name => /vbaProject|externalLink/.test(name)), `${file.format} compiled OOXML is readable and contains only authorized text`);
    const row = await db.prepare("SELECT storage_key,state,sha256,size_bytes FROM project_report_artifacts WHERE id=?").bind(file.id).first();
    const object = await bucket.get(row.storage_key); check(row.state === "ready" && object && hash(new Uint8Array(await object.arrayBuffer())) === file.sha256, `${file.format} compiled artifact metadata and R2 original agree`);
    await writeFile(path.join(out, `compiled.${file.format}`), bytes); files.push({ format: file.format, sha256: file.sha256, sizeBytes: file.sizeBytes });
  }
  check(Number((await db.prepare("SELECT COUNT(*) n FROM project_report_runs").first()).n) === 1 && Number((await db.prepare("SELECT COUNT(*) n FROM project_report_artifacts").first()).n) === 2, "compiled replay leaves one run/two artifacts");
  check(Number((await db.prepare("SELECT COUNT(*) n FROM users").first()).n) === 2 && Number((await db.prepare("SELECT COUNT(*) n FROM tasks").first()).n) === 1 && Number((await db.prepare("SELECT COUNT(*) n FROM submissions").first()).n) === 2, "compiled report generation preserves source users/tasks/submissions");
  await writeFile(path.join(out, "result.json"), JSON.stringify({ complete: true, checks: assertions.length, assertions, files, trace, entrySha256: hash(await readFile(entry)), scope: "Exact compiled Worker rendering + real ephemeral D1/R2; no browser/production/cleanup/real users" }, null, 2));
} finally { await writeFile(path.join(out, "requests.json"), JSON.stringify(trace, null, 2)); await mf.dispose(); const after = await buildSnapshot(["dist/server", "dist/client"]); await writeFile(path.join(out, "build-provenance.json"), JSON.stringify({ before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) }, null, 2)); assert.deepEqual(after, before, "Compiled report artifact changed during smoke"); }
