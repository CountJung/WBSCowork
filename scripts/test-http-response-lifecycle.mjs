/** Non-destructive dependency reproducer and QA transport regression. */
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { Miniflare, Log, LogLevel } from "miniflare";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";

assert.equal(typeof global.gc, "function", "Run with node --expose-gc");
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`PASS ${label}`); };
async function collect() { for (let i = 0; i < 12; i++) { global.gc(); await setImmediate(); } }
const mf = new Miniflare({ cf: false, modules: true,
  script: `export default {fetch(){return new Response("SYNTHETIC_NOT_FOUND",{status:404,headers:{"content-type":"text/plain","cache-control":"private, no-store","set-cookie":"fixture=synthetic; HttpOnly"}});}}`,
  log: new Log(LogLevel.ERROR) });
try {
  const original = await mf.dispatchFetch("https://response-lifecycle.example.test/missing");
  check(!original.bodyUsed && !original.body.locked, "raw Miniflare response starts readable");
  await collect();
  check(original.bodyUsed && !original.body.locked, "dependency GC cancels retained wrapper's shared stream");
  await assert.rejects(original.text(), /Body.*already been read/);
  check(true, "raw GC reproduces original Body already read without a prior caller read");

  const raw = await mf.dispatchFetch("https://response-lifecycle.example.test/missing");
  const safe = await consumeWorkerResponse(raw, { route: "/missing" });
  check(raw.bodyUsed && !safe.bodyUsed, "transport drains original exactly once before exposing snapshot");
  await collect();
  check(safe.status === 404 && safe.headers.get("cache-control") === "private, no-store" && safe.headers.getSetCookie()[0] === "fixture=synthetic; HttpOnly", "snapshot preserves status and security/cookie headers");
  check(await safe.text() === "SYNTHETIC_NOT_FOUND", "independent response survives GC before delayed assertion");
  await assert.rejects(safe.text(), TypeError);
  check(true, "snapshot retains single-use body semantics instead of hiding double reads");

  await assert.rejects(consumeWorkerResponse(raw, { route: "/missing" }), /already consumed or locked/);
  const locked = new Response("LOCKED"); const reader = locked.body.getReader();
  await assert.rejects(consumeWorkerResponse(locked, { route: "/locked" }), /already consumed or locked/); await reader.cancel();
  const broken = new Response(new ReadableStream({ start(controller) { controller.error(new Error("SYNTHETIC_READ_FAILURE")); } }));
  await assert.rejects(consumeWorkerResponse(broken, { route: "/broken" }), error => error.message.includes("/broken (200)") && error.cause.message === "SYNTHETIC_READ_FAILURE");
  check(true, "already consumed, locked and failed streams remain explicit failures");
  const empty = await consumeWorkerResponse(new Response(null, { status: 204 }));
  check(empty.status === 204 && empty.body === null, "null-body status remains valid");
  console.log(`Worker response lifecycle ${checks} conditions passed; loopback Miniflare only, no application or data mutation.`);
} finally { await mf.dispose(); }
