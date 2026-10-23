import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDigestMachineRequest, assertReportOrigin, boundedReportJson, parseReportRequest } from "../src/features/project-digest-generate/server/request";
const payload = { projectId: 1, requestId: "synthetic_request_0001", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", timeZone: "Asia/Seoul", audienceMode: "public_only", formats: ["pptx", "docx"], dryRun: true };
test("report input is bounded, explicit and canonical without trusting identity parameters", () => {
  const parsed = parseReportRequest(payload, new Date("2026-10-08T00:00:00Z"));
  assert.deepEqual(parsed.formats, ["docx", "pptx"]); assert.equal(parsed.period.localDate, "2026-10-08");
  for (const change of [{ projectId: 0 }, { actorId: 1 }, { requestId: "short" }, { dryRun: "false" }, { formats: ["docx", "docx"] }, { end: "2027-01-01T00:00:00Z" }, { timeZone: "KST" }, { start: "2026-02-30" }]) assert.throws(() => parseReportRequest({ ...payload, ...change }));
});
test("manual exports require exact same origin", () => {
  assertReportOrigin(new Request("https://app.example.test/api/project-reports", { headers: { Origin: "https://app.example.test" } }));
  for (const origin of [null, "null", "https://attacker.example.test"]) assert.throws(() => assertReportOrigin(new Request("https://app.example.test/api/project-reports", { headers: origin ? { Origin: origin } : {} })));
});
test("scheduler is disabled by default and cannot authenticate with a browser cookie", () => {
  const enabled = process.env.DIGEST_SCHEDULER_ENABLED, token = process.env.DIGEST_SCHEDULER_TOKEN;
  try {
    delete process.env.DIGEST_SCHEDULER_ENABLED; delete process.env.DIGEST_SCHEDULER_TOKEN;
    assert.throws(() => assertDigestMachineRequest(new Request("https://app.example.test/api/internal/project-digests/run")), /SCHEDULER_DISABLED/);
    process.env.DIGEST_SCHEDULER_ENABLED = "1"; process.env.DIGEST_SCHEDULER_TOKEN = "synthetic_local_scheduler_token_000000001";
    const invalidHeaders: HeadersInit[] = [{ Cookie: "next-auth.session-token=synthetic" }, { Authorization: "Bearer wrong" }, { Authorization: "Basic synthetic" }];
    for (const headers of invalidHeaders) assert.throws(() => assertDigestMachineRequest(new Request("https://app.example.test/api/internal/project-digests/run", { headers })), /INVALID_TOKEN/);
    assertDigestMachineRequest(new Request("https://app.example.test/api/internal/project-digests/run", { headers: { Authorization: `Bearer ${process.env.DIGEST_SCHEDULER_TOKEN}` } }));
  } finally { if (enabled === undefined) delete process.env.DIGEST_SCHEDULER_ENABLED; else process.env.DIGEST_SCHEDULER_ENABLED = enabled; if (token === undefined) delete process.env.DIGEST_SCHEDULER_TOKEN; else process.env.DIGEST_SCHEDULER_TOKEN = token; }
});
test("JSON trigger streams have an independent size bound and reject malformed content", async () => {
  const request = (body: string, type = "application/json") => new Request("https://app.example.test/api/internal/project-digests/run", { method: "POST", headers: { "Content-Type": type }, body });
  assert.deepEqual(await boundedReportJson(request('{"dryRun":true}')), { dryRun: true });
  await assert.rejects(boundedReportJson(request("x".repeat(8193))), /REQUEST_TOO_LARGE/);
  await assert.rejects(boundedReportJson(request("{")), /INVALID_JSON/);
  await assert.rejects(boundedReportJson(request("{}", "text/plain")), /JSON_REQUIRED/);
});
