import "./helpers/bootstrap";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mockModuleExports } from "./helpers/mock-module";
import { createDigestPeriod, createDigestSnapshot } from "../src/entities/project-report";
import { reportFixture } from "./helpers/project-report-fixture";
import type { QueryStatement } from "../src/shared/server/database/index.server";

let hosted = true, authorized = true, failQuery = false, truncateBatch = false, reauthDenyKind = "", batches: QueryStatement[][] = [], transactionEvents: string[] = [];
const source = reportFixture();
const tables = {
  project: [{ id: 101, name: source.project.name, goal: source.project.goal, project_type: source.project.projectType, start_date: source.project.startDate, end_date: source.project.endDate }],
  tasks: source.tasks.map(row => ({ id: row.id, project_id: row.projectId, parent_id: row.parentId, title: row.title, status: row.status, completion_mode: row.completionMode, start_date: row.startDate, end_date: row.endDate, assignee_name: row.assigneeName, parent_project_id: row.parentId === null ? null : 101 })),
  submissions: source.submissions.map(row => ({ id: row.id, task_id: row.taskId, project_id: row.projectId, revision_number: row.revisionNumber, content: row.content, visibility: row.visibility, author_name: row.authorName, created_at_utc: new Date(row.createdAt).toISOString() })),
  comments: source.comments.map(row => ({ id: row.id, submission_id: row.submissionId, project_id: row.projectId, revision_number: row.revisionNumber, content: row.content, author_name: row.authorName, created_at_utc: new Date(row.createdAt).toISOString() })),
  attachments: source.attachments.map(row => ({ id: row.id, submission_id: row.submissionId, project_id: row.projectId, revision_number: row.revisionNumber, file_name: row.fileName, file_mime_type: row.mimeType, file_size_bytes: row.sizeBytes, created_at_utc: new Date(row.createdAt).toISOString() })),
};
function result(sql: string, params: readonly unknown[] = []) {
  if (failQuery) throw new Error("SYNTHETIC_PRIVATE_DB_ERROR");
  const kind = sql.match(/\/\* report:([a-z-]+) \*\//)?.[1] ?? "";
  if (!authorized || kind === reauthDenyKind) return [];
  if (kind.startsWith("reauth-")) { const name = kind.slice(7) as "tasks" | "submissions" | "comments" | "attachments"; return createDigestSnapshot(reportFixture())[name].map(row => ({ id: row.id })); }
  const cap=Number(params[8]??20),publicOnly=sql.includes("s.visibility='public' AND r.visibility='public'");
  const selectedTasks=new Set(tables.tasks.slice(0,cap).map(row=>row.id));
  const candidates=tables.submissions.filter(row=>selectedTasks.has(row.task_id)&&(!publicOnly||row.visibility==='public')).slice(0,cap+1),selectedParents=new Set(candidates.slice(0,cap).map(row=>row.id));
  if(kind==='tasks')return tables.tasks.slice(0,cap+1);
  if(kind==='submissions')return candidates;
  if(kind==='comments')return tables.comments.filter(row=>selectedParents.has(row.submission_id)).slice(0,cap+1);
  if(kind==='attachments')return tables.attachments.filter(row=>selectedParents.has(row.submission_id)).slice(0,cap+1);
  return tables[kind as keyof typeof tables] ?? [];
}
mockModuleExports("@/src/shared/server/hosted-runtime/index.server", { isHostedRuntime: () => hosted });
mockModuleExports("@/src/shared/server/database/index.server", {
  databaseBatch: async (statements: QueryStatement[]) => { batches.push(statements); return (truncateBatch ? statements.slice(0,1) : statements).map(statement => ({ success: true, results: result(statement.sql,statement.params) })); },
  getDatabasePool: () => ({ getConnection: async () => ({
    query: async (sql: string, params?: unknown[]) => { if (sql.startsWith("SET TRANSACTION")) { transactionEvents.push("repeatable-read"); return []; } const statement = { sql, params }; batches[0] ??= []; batches[0].push(statement); return result(sql,params); },
    beginTransaction: async () => { transactionEvents.push("begin"); }, commit: async () => { transactionEvents.push("commit"); }, rollback: async () => { transactionEvents.push("rollback"); }, release: async () => { transactionEvents.push("release"); }, destroy: () => { transactionEvents.push("destroy"); },
  }) }),
});
const { collectProjectReport, reauthorizeReportSnapshot } = await import("../src/entities/project-report/api/collector.server");
const viewer = { userId: 901, email: "synthetic-manager@example.test", isSuperuser: false }, period = createDigestPeriod(source.period.start, source.period.end, source.period.snapshotAt, source.period.timeZone);
const originalMax = process.env.REPORT_MAX_ROWS;
afterEach(() => { hosted = true; authorized = true; failQuery = false; truncateBatch = false; reauthDenyKind = ""; batches = []; transactionEvents = []; if (originalMax === undefined) delete process.env.REPORT_MAX_ROWS; else process.env.REPORT_MAX_ROWS = originalMax; });

test("collector executes five bounded related D1 selects in one batch with guards on every query", async () => {
  const snapshot = await collectProjectReport(viewer, { projectId: 101, period, audienceMode: "public_only" });
  assert.equal(batches.length, 1); assert.equal(batches[0].length, 5);
  for (const query of batches[0]) { assert.match(query.sql, /manage_viewer\.role='admin'/); assert.match(query.sql, /manage_member\.active=1/); assert((query.params?.length ?? 0) <= 100); assert.doesNotMatch(query.sql, /SELECT[^;]*file_path/i); }
  assert.equal(snapshot.sourceCounts.tasks, 2); assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE_REPORT|filePath|file_path/);
  assert.match(batches[0][2].sql, /s\.visibility='public' AND r\.visibility='public'/);
  assert.match(batches[0][3].sql, /cr\.visibility='public'/); assert.match(batches[0][4].sql, /ar\.visibility='public'/);
});
test("D1 normalizes legacy-space and ISO timestamps in SQL and uses half-open instant ranges", async () => {
  await collectProjectReport(viewer, { projectId: 101, period, audienceMode: "public_only" });
  const sql = batches[0][3].sql;
  assert.match(sql, /strftime\('%Y-%m-%dT%H:%M:%fZ',c\.created_at\)>=\?/); assert.match(sql, /strftime\('%Y-%m-%dT%H:%M:%fZ',c\.created_at\)<\?/);
  assert(batches[0][3].params?.includes(period.start)); assert(batches[0][3].params?.includes(period.end));
});
test("Native select snapshot explicitly uses only its own REPEATABLE READ transaction", async () => {
  hosted = false;
  const snapshot = await collectProjectReport(viewer, { projectId: 101, period, audienceMode: "requester_scope" });
  assert.equal(snapshot.submissions.length, 3); assert.deepEqual(transactionEvents, ["repeatable-read", "begin", "commit", "release"]);
  assert.match(batches[0][3].sql, /LEFT\(DATE_FORMAT\(c\.created_at,'%f'\),3\)/); assert.doesNotMatch(batches[0][3].sql, /strftime/);
});
test("Native read failure rolls back and never returns a partial/private DB error", async () => {
  hosted = false; failQuery = true;
  await assert.rejects(collectProjectReport(viewer, { projectId: 101, period, audienceMode: "public_only" }), error => error instanceof Error && error.message === "보고서를 불러올 수 없습니다.");
  assert.deepEqual(transactionEvents, ["repeatable-read", "begin", "rollback", "release"]);
});
test("missing project, member or revoked management yields the same fixed rejection", async () => {
  authorized = false;
  for (const actor of [viewer, { userId: 902 }, { userId: 903, isSuperuser: false }]) await assert.rejects(collectProjectReport(actor, { projectId: 101, period, audienceMode: "public_only" }), /보고서를 찾을 수 없거나 접근 권한이 없습니다/);
});
test("row budget is bounded, environment clamp is conservative, and low budgets signal omitted context", async () => {
  process.env.REPORT_MAX_ROWS = "2";
  const snapshot = await collectProjectReport(viewer, { projectId: 101, period, audienceMode: "public_only" });
  assert.equal(snapshot.tasks.length, 1); assert(snapshot.truncated.tasks); assert(snapshot.truncated.submissions); assert.equal(snapshot.attachments.length,0);
  assert(Object.values(snapshot.sourceCounts).reduce((sum, n) => sum + n, 0) <= 4);
  await assert.rejects(collectProjectReport(viewer, { projectId: 101, period, audienceMode: "public_only", maxRows: 101 }));
});
test("reauthorization rechecks current project, every snapshot source revision and parent relationship", async () => {
  const snapshot = createDigestSnapshot(reportFixture());
  await reauthorizeReportSnapshot(viewer, snapshot);
  assert.equal(batches.length, 1); assert.equal(batches[0].length, 5);
  for (const query of batches[0]) assert.match(query.sql, /manage_viewer\.role='admin'/);
  assert.match(batches[0][2].sql, /s\.task_id=\? AND r\.revision_number=\?/); assert.match(batches[0][2].sql, /s\.visibility='public' AND r\.visibility='public'/);
  assert.match(batches[0][3].sql, /COALESCE\(c\.revision_number,1\)/); assert.match(batches[0][3].sql, /c\.revision_number IS NULL/);
  assert.match(batches[0][4].sql, /a\.submission_id=\? AND a\.revision_number=\?/);
});
test("visibility change, removed comment/attachment or project membership withdrawal blocks the next artifact read", async () => {
  const snapshot = createDigestSnapshot(reportFixture());
  for (const kind of ["reauth-tasks", "reauth-submissions", "reauth-comments", "reauth-attachments"]) { reauthDenyKind = kind; await assert.rejects(reauthorizeReportSnapshot(viewer, snapshot)); }
  reauthDenyKind = ""; authorized = false; await assert.rejects(reauthorizeReportSnapshot(viewer, snapshot));
});
test("reauthorization remains bounded even for a maximum-size task-only report", async () => {
  const input = reportFixture(); input.tasks = Array.from({ length: 100 }, (_, index) => ({ ...input.tasks[0], id: index + 1 })); input.submissions = []; input.comments = []; input.attachments = [];
  const snapshot = createDigestSnapshot(input);
  // Empty mocked results intentionally deny, while exposing all bounded SQL groups.
  reauthDenyKind = "reauth-tasks"; await assert.rejects(reauthorizeReportSnapshot(viewer, snapshot));
  assert.equal(batches[0].length, 6); for (const query of batches[0]) assert((query.params?.length ?? 0) <= 100);
});

test("incomplete reauthorization batches fail closed rather than authorizing an unchecked artifact", async()=>{truncateBatch=true;await assert.rejects(reauthorizeReportSnapshot(viewer,createDigestSnapshot(reportFixture())),error=>error instanceof Error&&'status' in error&&error.status===404);});

test("negative configured row caps clamp down while malformed configuration fails closed",async()=>{ process.env.REPORT_MAX_ROWS='-10';assert.equal((await collectProjectReport(viewer,{projectId:101,period,audienceMode:'public_only'})).tasks.length,1);process.env.REPORT_MAX_ROWS='not-a-number';await assert.rejects(collectProjectReport(viewer,{projectId:101,period,audienceMode:'public_only'}),error=>error instanceof Error&&'status' in error&&error.status===503);});
