import { test } from "node:test";
import assert from "node:assert/strict";
import { boundRequestBody, createMultipartAdmission, declaredContentLength, MULTIPART_BYTE_BUDGET } from "../sites/multipart-admission";

test("length parser only trusts nonnegative digit safe integers", () => {
  for (const value of [null, "", "-1", "+1", "1.5", "1e3", "Infinity", "NaN", " 1", "1 ", "9007199254740992"]) assert.equal(declaredContentLength(value), null);
  assert.equal(declaredContentLength("0"), 0); assert.equal(declaredContentLength("1024"), 1024);
});
test("four bounded small forms share the byte budget; request count remains bounded", () => {
  const admission = createMultipartAdmission(), permits = Array.from({ length: 4 }, () => admission.acquire(1024));
  assert.ok(permits.every(Boolean)); assert.equal(admission.acquire(0), null);
  for (const permit of permits) permit!.release();
  assert.deepEqual(admission.usage(), { activeRequests: 0, reservedBytes: 0 });
});
test("20MiB uploads retain one large-request ceiling and the total22MiB cap", () => {
  const admission = createMultipartAdmission(), large = admission.acquire(20 * 1024 * 1024)!;
  assert.ok(large); assert.equal(admission.acquire(20 * 1024 * 1024), null);
  const small = admission.acquire(2 * 1024 * 1024)!; assert.ok(small); assert.equal(admission.acquire(1), null);
  assert.equal(admission.usage().reservedBytes, MULTIPART_BYTE_BUDGET); large.release(); small.release();
});
test("unknown length reserves the entire budget; invalid reservations fail closed", () => {
  const admission = createMultipartAdmission(), unknown = admission.acquire(null)!;
  assert.equal(unknown.reservedBytes, MULTIPART_BYTE_BUDGET); assert.equal(admission.acquire(1), null); unknown.release();
  for (const value of [-1, NaN, Infinity, 0.5, MULTIPART_BYTE_BUDGET + 1]) assert.equal(admission.acquire(value), null);
});
test("permit release is idempotent and failure finally restores all capacity", async () => {
  const admission = createMultipartAdmission(), permit = admission.acquire(null)!;
  await assert.rejects((async () => { try { throw new Error("synthetic parse failure"); } finally { permit.release(); permit.release(); } })(), /synthetic parse failure/);
  assert.deepEqual(admission.usage(), { activeRequests: 0, reservedBytes: 0 }); assert.ok(admission.acquire(null));
});
test("a forged low length errors before oversized bytes reach the decoder", async () => {
  const admission = createMultipartAdmission(), permit = admission.acquire(2)!; let exceeded = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(3)); controller.close(); } });
  try { await assert.rejects(new Response(boundRequestBody(body, 2, () => { exceeded = true; })).arrayBuffer(), /body limit exceeded/); }
  finally { permit.release(); }
  assert.equal(exceeded, true); assert.deepEqual(admission.usage(), { activeRequests: 0, reservedBytes: 0 });
});
test("request-size overflow and source cancellation release reservation through finally", async () => {
  for (const cancellation of [false, true]) {
    const admission = createMultipartAdmission(), permit = admission.acquire(null)!; let exceeded = false;
    const body = new ReadableStream<Uint8Array>({ start(controller) { if (cancellation) controller.error(new Error("synthetic cancelled input")); else { controller.enqueue(new Uint8Array(4)); controller.close(); } } });
    try { await assert.rejects(new Response(boundRequestBody(body, 3, () => { exceeded = true; })).arrayBuffer(), cancellation ? /cancelled input/ : /body limit exceeded/); }
    finally { permit.release(); }
    assert.equal(exceeded, !cancellation); assert.deepEqual(admission.usage(), { activeRequests: 0, reservedBytes: 0 });
  }
});
