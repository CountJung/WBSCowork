import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalRunKey, canonicalSnapshotJson, createDigestPeriod, createDigestSnapshot, getDigestPeriodIssue, hashDigestSnapshot, hashReportRunKey, reportTextLines, validateDigestSnapshot, REPORT_MAX_ROWS, REPORT_MAX_TEXT } from "../src/entities/project-report";
import { reportFixture } from "./helpers/project-report-fixture";

const feedbackNow = "2026-10-28T10:00:00Z";
test("period feedback identifies missing/impossible start and end beside the matching field", () => {
  for (const start of ["", "2026-02-30T00:00:00Z", "2026-10-27T24:00:00Z", "2026-10-27T00:00:00"]) {
    assert.equal(getDigestPeriodIssue(start, feedbackNow, feedbackNow)?.code, "INVALID_START");
    assert.equal(getDigestPeriodIssue(start, feedbackNow, feedbackNow)?.field, "start");
  }
  assert.equal(getDigestPeriodIssue("2026-10-27T00:00:00Z", "", feedbackNow)?.code, "INVALID_END");
  assert.equal(getDigestPeriodIssue("2026-10-27T00:00:00Z", "2026-02-30T00:00:00Z", feedbackNow)?.field, "end");
});
test("period feedback explains reversed and equal instants without relaxing server rejection", () => {
  for (const end of ["2026-10-27T00:00:00Z", "2026-10-28T00:00:00Z"]) {
    const issue = getDigestPeriodIssue("2026-10-28T00:00:00Z", end, feedbackNow);
    assert.equal(issue?.code, "END_NOT_AFTER_START"); assert.equal(issue?.field, "end");
    assert.match(issue!.message, /시작보다 늦/);
    assert.throws(() => createDigestPeriod("2026-10-28T00:00:00Z", end, feedbackNow, "Asia/Seoul"));
  }
});
test("period feedback accepts exactly 31 UTC days and rejects even one millisecond more", () => {
  const start = "2026-09-27T10:00:00Z";
  assert.equal(getDigestPeriodIssue(start, feedbackNow, feedbackNow), null);
  const issue = getDigestPeriodIssue("2026-09-27T09:59:59.999Z", feedbackNow, feedbackNow);
  assert.equal(issue?.code, "PERIOD_TOO_LONG"); assert.match(issue!.message, /31일/);
});
test("future-end feedback uses instants, not the selected display timezone or local day", () => {
  const issue = getDigestPeriodIssue("2026-10-28T09:00:00Z", "2026-10-28T19:00:00.001+09:00", feedbackNow);
  assert.equal(issue?.code, "END_IN_FUTURE"); assert.equal(issue?.field, "end"); assert.match(issue!.message, /UTC/);
  assert.equal(getDigestPeriodIssue("2026-10-28T09:00:00Z", "2026-10-28T19:00:00+09:00", feedbackNow), null);
});
test("correcting an invalid period immediately produces valid feedback and unchanged server period", () => {
  const start = "2026-10-28T08:00:00Z";
  assert.notEqual(getDigestPeriodIssue(start, "2026-10-28T07:00:00Z", feedbackNow), null);
  const end = "2026-10-28T09:00:00Z";
  assert.equal(getDigestPeriodIssue(start, end, feedbackNow), null);
  const period = createDigestPeriod(start, end, feedbackNow, "Asia/Seoul");
  assert.equal(period.start, "2026-10-28T08:00:00.000Z"); assert.equal(period.end, "2026-10-28T09:00:00.000Z");
});
test("public period feedback never echoes untrusted input or internal exception text", () => {
  const sensitive = "<script>private_sql_storage_path</script>";
  const issue = getDigestPeriodIssue(sensitive, feedbackNow, feedbackNow);
  assert(issue); assert.doesNotMatch(JSON.stringify(issue), /private_sql|storage_path|<script>|Error:/);
  assert.deepEqual(Object.keys(issue).sort(), ["code", "field", "message"]);
});

test("public-only reports exclude private parent body, comments and attachment metadata", () => {
  const snapshot = createDigestSnapshot(reportFixture()), serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /PRIVATE_REPORT|비공개 작성자|비공개 댓글/);
  assert.deepEqual(snapshot.sourceCounts, { tasks: 2, submissions: 2, comments: 1, attachments: 1 });
  assert.deepEqual(snapshot.excludedCounts, { privateSubmissions: 1, privateComments: 1, privateAttachments: 1, outsidePeriod: 0 });
});
test("requester-scope keeps authorized private inputs supplied by the collector", () => {
  const input = reportFixture(); input.audienceMode = "requester_scope";
  assert.match(JSON.stringify(createDigestSnapshot(input)), /PRIVATE_REPORT_BODY/);
});
test("old authorized parent context remains available for a recent comment", () => {
  const snapshot = createDigestSnapshot(reportFixture()), lines = reportTextLines(snapshot).join("\n");
  assert.equal(snapshot.comments[0].submissionId, 301);
  assert.match(lines, /활동 연결 제출 #301/); assert.match(lines, /기간 내 제출 #302/);
});
test("activity range is inclusive start and exclusive end; future context is excluded", () => {
  const input = reportFixture();
  input.comments = [input.comments[0], { ...input.comments[0], id: 403, createdAt: input.period.start as string }, { ...input.comments[0], id: 404, createdAt: input.period.end as string }];
  input.submissions.push({ ...input.submissions[0], id: 304, createdAt: "2026-10-24T00:00:00Z" });
  const snapshot = createDigestSnapshot(input);
  assert.deepEqual(snapshot.comments.map(c => c.id), [403, 401]); assert.equal(snapshot.submissions.length, 2); assert.equal(snapshot.excludedCounts.outsidePeriod, 2);
});
test("snapshot canonical order and hash do not depend on database input row order", async () => {
  const first = reportFixture(), second = structuredClone(first);
  for (const kind of ["tasks", "submissions", "comments", "attachments"] as const) second[kind].reverse();
  const a = createDigestSnapshot(first), b = createDigestSnapshot(second);
  assert.equal(canonicalSnapshotJson(a), canonicalSnapshotJson(b)); assert.equal(await hashDigestSnapshot(a), await hashDigestSnapshot(b));
  assert.match(await hashDigestSnapshot(a), /^[a-f0-9]{64}$/);
});
test("row input ownership, orphan parents and duplicate IDs fail closed", () => {
  const wrongProject = reportFixture(); wrongProject.comments[0].projectId = 102;
  assert.throws(() => createDigestSnapshot(wrongProject));
  const orphan = reportFixture(); orphan.attachments[0].submissionId = 999;
  assert.throws(() => createDigestSnapshot(orphan));
  const duplicate = reportFixture(); duplicate.tasks.push({ ...duplicate.tasks[0] });
  assert.throws(() => createDigestSnapshot(duplicate));
  const taskOrphan = reportFixture(); taskOrphan.submissions[0].taskId = 999;
  assert.throws(() => createDigestSnapshot(taskOrphan));
});
test("task hierarchy cycles fail closed", () => {
  const input = reportFixture(); input.tasks[0].parentId = 202;
  assert.throws(() => createDigestSnapshot(input));
});
test("DATE calendar values reject impossible days without UTC rollover", () => {
  const input = reportFixture(); input.tasks[0].startDate = "2026-02-30";
  assert.throws(() => createDigestSnapshot(input));
  assert.equal(createDigestSnapshot(reportFixture()).tasks[0].startDate, "2026-10-20");
});
test("instant calendar validation rejects overflow dates and clock rollover", () => {
  const key = { scheduleId: 7, projectId: 101, formats: ["docx"] as "docx"[], audienceMode: "public_only" as const, dryRun: true };
  for (const scheduledFor of ["2026-02-30T00:00:00Z", "2026-02-29T00:00:00Z", "2026-04-31T12:00:00+09:00", "2026-10-22T24:00:00Z"]) {
    assert.throws(() => canonicalRunKey({ ...key, scheduledFor }), scheduledFor);
  }
  assert.match(canonicalRunKey({ ...key, scheduledFor: "2028-02-29T00:00:00Z" }), /2028-02-29T00:00:00\.000Z/);
  assert.throws(() => createDigestPeriod("2026-02-30T00:00:00Z", "2026-03-03T00:00:00Z", "2026-03-03T00:00:00Z", "UTC"));
});
test("IANA timezone handles spring gap and fall overlap as instants", () => {
  const spring = createDigestPeriod("2026-03-08T06:30:00Z", "2026-03-08T07:30:00Z", "2026-03-08T07:30:00Z", "America/New_York");
  const fall = createDigestPeriod("2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2026-11-01T06:30:00Z", "America/New_York");
  assert.equal(Date.parse(spring.end) - Date.parse(spring.start), 3_600_000); assert.equal(spring.localDate, "2026-03-08");
  assert.equal(Date.parse(fall.end) - Date.parse(fall.start), 3_600_000); assert.equal(fall.localDate, "2026-11-01");
  assert.equal(createDigestPeriod("2026-10-22T00:00:00Z", "2026-10-22T18:00:00Z", "2026-10-22T18:00:00Z", "Asia/Seoul").localDate, "2026-10-23");
});
test("invalid timezone, oversized range, reversed range and future end are rejected", () => {
  for (const zone of ["KST", "Not/AZone", ""]) assert.throws(() => createDigestPeriod("2026-10-22T00:00:00Z", "2026-10-23T00:00:00Z", "2026-10-23T00:00:00Z", zone));
  assert.throws(() => createDigestPeriod("2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-01T00:00:00Z", "UTC"));
  assert.throws(() => createDigestPeriod("2026-10-23T00:00:00Z", "2026-10-22T00:00:00Z", "2026-10-23T00:00:00Z", "UTC"));
  assert.throws(() => createDigestPeriod("2026-10-22T00:00:00Z", "2026-10-24T00:00:00Z", "2026-10-23T00:00:00Z", "UTC"));
});
test("total row and Unicode text budgets are explicit and never break surrogate pairs", () => {
  const input = reportFixture(); input.tasks = Array.from({ length: 101 }, (_, i) => ({ ...input.tasks[0], id: i + 1, title: "한😀".repeat(400) })); input.submissions = []; input.comments = []; input.attachments = [];
  const snapshot = createDigestSnapshot(input);
  assert.equal(snapshot.tasks.length, REPORT_MAX_ROWS); assert.equal([...snapshot.tasks[0].title].length, REPORT_MAX_TEXT + 1);
  assert.equal(snapshot.truncated.tasks, true); assert.equal(snapshot.truncated.text, true); assert.doesNotMatch(snapshot.tasks[0].title, /�/);
  assert.equal(validateDigestSnapshot(snapshot).tasks.length, REPORT_MAX_ROWS);
});
test("XML-incompatible control characters are shown as replacements and active content stays literal", () => {
  const input = reportFixture(); input.submissions[1].content = "텍스트\u0000<script>literal()</script>";
  const text = reportTextLines(createDigestSnapshot(input)).join("\n");
  assert.match(text, /텍스트�<script>literal\(\)<\/script>/); assert.doesNotMatch(text, /\u0000/);
});
test("persisted snapshot validation rejects unsupported version and altered counts", () => {
  const snapshot = createDigestSnapshot(reportFixture());
  assert.throws(() => validateDigestSnapshot({ ...snapshot, schemaVersion: 2 }));
  assert.throws(() => validateDigestSnapshot({ ...snapshot, sourceCounts: { ...snapshot.sourceCounts, tasks: 999 } }));
});
test("canonical scheduled run key dedupes format ordering and equivalent UTC offsets", async () => {
  const base = { scheduleId: 7, scheduledFor: "2026-10-23T00:00:00Z", projectId: 101, formats: ["pptx", "docx"] as ("docx" | "pptx")[], audienceMode: "public_only" as const, dryRun: true };
  const key = canonicalRunKey(base);
  assert.equal(key, "7\n2026-10-23T00:00:00.000Z\n101\n1\ndocx,pptx\npublic_only\ntrue");
  assert.equal(await hashReportRunKey(base), await hashReportRunKey({ ...base, scheduledFor: "2026-10-23T09:00:00+09:00", formats: ["docx", "pptx", "docx"] }));
});
test("manual request keys bind requester and request identity", async () => {
  const base = { scheduleId: null, scheduledFor: "2026-10-23T00:00:00Z", projectId: 101, formats: ["docx"] as "docx"[], audienceMode: "requester_scope" as const, dryRun: false, requestedById: 901, requestId: "synthetic-request-1" };
  assert.notEqual(await hashReportRunKey(base), await hashReportRunKey({ ...base, requestedById: 902 }));
  assert.throws(() => canonicalRunKey({ ...base, requestId: "../../secret" }));
});

test("a collector-verified parent may be omitted only with an explicit task truncation flag", () => {
 const input=reportFixture(); input.tasks[0].parentId=299;assert.throws(()=>createDigestSnapshot(input));
 input.truncated={tasks:true};const snapshot=createDigestSnapshot(input);assert.equal(snapshot.tasks[0].parentId,299);assert(snapshot.warnings.includes("PARENT_TASK_OMITTED"));assert.equal(validateDigestSnapshot(snapshot).tasks[0].parentId,299);
});

test("canonical snapshot JSON survives persisted round trip and property order changes",async()=>{ const snapshot=createDigestSnapshot(reportFixture());const stored=JSON.parse(canonicalSnapshotJson(snapshot));assert.deepEqual(validateDigestSnapshot(stored),snapshot);assert.equal(await hashDigestSnapshot(stored),await hashDigestSnapshot(snapshot)); });
