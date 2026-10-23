import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { projectManagementGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { createDigestSnapshot, createDigestPeriod, validateDigestSnapshot, type DigestSnapshot, type DigestSnapshotInput, type ReportAudience, type ReportPeriod } from "../model/snapshot";

type Row = Record<string, unknown>;
const unavailableMessage = "보고서를 찾을 수 없거나 접근 권한이 없습니다.";
export class ReportCollectorError extends Error {
  readonly status: 404 | 503;
  readonly code: "NOT_FOUND" | "REPORT_UNAVAILABLE";
  constructor(status: 404 | 503 = 404) {
    super(status === 404 ? unavailableMessage : "보고서를 불러올 수 없습니다.");
    this.name = "ReportCollectorError"; this.status = status; this.code = status === 404 ? "NOT_FOUND" : "REPORT_UNAVAILABLE";
  }
}
function unavailable(): never { throw new ReportCollectorError(); }
function databaseUnavailable(): never { throw new ReportCollectorError(503); }
function positive(value: unknown): number { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) unavailable(); return n; }
/** Column identifiers are fixed in this module, never supplied by a request. */
function iso(column: string, hosted: boolean): string {
  if (!/^[a-z_]+\.[a-z_]+$/.test(column)) unavailable();
  return hosted ? `strftime('%Y-%m-%dT%H:%M:%fZ',${column})` : `CONCAT(DATE_FORMAT(${column},'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(${column},'%f'),3),'Z')`;
}
function calendar(column: string, hosted: boolean): string { return hosted ? `substr(${column},1,10)` : `DATE_FORMAT(${column},'%Y-%m-%d')`; }
function rows(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result && typeof result === "object" && "success" in result && result.success === true && "results" in result && Array.isArray(result.results)) return result.results as Row[];
  return databaseUnavailable();
}
/** Five related selects share one snapshot. No credentials, files or source contents are logged. */
async function readSnapshot(statements: QueryStatement[], hosted: boolean): Promise<Row[][]> {
  if (hosted) return (await databaseBatch(statements)).map(rows);
  const connection = await getDatabasePool().getConnection();
  let began = false;
  try {
    // Only this next read transaction changes isolation; no global/account/schema setting changes.
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.beginTransaction(); began = true;
    const results: Row[][] = [];
    for (const statement of statements) results.push(rows(await connection.query(statement.sql, statement.params ? [...statement.params] : undefined)));
    await connection.commit(); began = false;
    return results;
  } catch {
    if (began) try { await connection.rollback(); } catch { connection.destroy(); }
    return databaseUnavailable();
  } finally {
    try { await connection.release(); } catch { connection.destroy(); }
  }
}
function reportBudget(value?: number): number {
  if (value !== undefined && (!Number.isInteger(value) || value < 4 || value > 100)) unavailable();
  const configured = process.env.REPORT_MAX_ROWS?.trim();
  const fromEnv = configured ? Number(configured) : 100;
  if (value === undefined && (!Number.isFinite(fromEnv) || !Number.isInteger(fromEnv))) databaseUnavailable();
  return Math.min(100, Math.max(4, value ?? fromEnv));
}
function allowedAudience(value: ReportAudience): void { if (value !== "public_only" && value !== "requester_scope") unavailable(); }
function viewerId(viewer: ProjectViewer): number { return positive(viewer.userId); }
function normalizedPeriod(period: ReportPeriod): ReportPeriod { return createDigestPeriod(period.start, period.end, period.snapshotAt, period.timeZone); }
function strings(value: unknown): string { if (typeof value !== "string") unavailable(); return value; }
function nullableNumber(value: unknown): number | null { return value === null ? null : positive(value); }
function nullableString(value: unknown): string | null { return value === null ? null : strings(value); }
function projectStatement(viewer: ProjectViewer, projectId: number, hosted: boolean): QueryStatement {
  const guard = projectManagementGuard(viewer, "p.id");
  return { sql: `/* report:project */ SELECT p.id,p.name,p.goal,p.project_type,${calendar("p.start_date", hosted)} AS start_date,${calendar("p.end_date", hosted)} AS end_date FROM projects p WHERE p.id=? AND ${guard.sql} LIMIT 1`, params: [projectId, ...guard.params] };
}
function collectionStatements(viewer: ProjectViewer, projectId: number, period: ReportPeriod, audienceMode: ReportAudience, cap: number, hosted: boolean): QueryStatement[] {
  const manager = projectManagementGuard(viewer, "t.project_id");
  const publicCurrent = audienceMode === "public_only" ? "s.visibility='public' AND r.visibility='public'" : "1=1";
  const publicComment = audienceMode === "public_only" ? "cr.visibility='public'" : "1=1";
  const publicAttachment = audienceMode === "public_only" ? "ar.visibility='public'" : "1=1";
  const taskTime = iso("t.created_at", hosted), revisionTime = iso("r.created_at", hosted), submissionTime = iso("s.created_at", hosted), commentTime = iso("c.created_at", hosted), attachmentTime = iso("a.created_at", hosted);
  const tasks = `WITH task_candidates AS (
    SELECT t.id,t.project_id,t.parent_id,t.title,t.status,t.completion_mode,${calendar("t.start_date", hosted)} AS start_date,${calendar("t.end_date", hosted)} AS end_date,u.name AS assignee_name,parent.project_id AS parent_project_id
    FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN tasks parent ON parent.id=t.parent_id
    WHERE t.project_id=? AND ${manager.sql} AND ${taskTime}<=? ORDER BY t.start_date,t.id LIMIT ?
  ), report_tasks AS (SELECT * FROM task_candidates ORDER BY start_date,id LIMIT ?)`;
  const taskParams = [projectId, ...manager.params, period.snapshotAt, cap + 1, cap];
  const subs = `, submission_candidates AS (
    SELECT s.id,s.task_id,t.project_id,r.revision_number,r.content,r.visibility,u.name AS author_name,${revisionTime} AS created_at_utc
    FROM submissions s JOIN report_tasks t ON t.id=s.task_id JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=s.current_revision JOIN users u ON u.id=s.author_id
    WHERE ${manager.sql} AND ${publicCurrent} AND ${submissionTime}<=? AND ${revisionTime}<=? AND (
      (${revisionTime}>=? AND ${revisionTime}<?) OR
      EXISTS(SELECT 1 FROM comments c JOIN submission_revisions cr ON cr.submission_id=c.submission_id AND cr.revision_number=COALESCE(c.revision_number,1) WHERE c.submission_id=s.id AND ${publicComment} AND ${commentTime}>=? AND ${commentTime}<?) OR
      EXISTS(SELECT 1 FROM submission_attachments a JOIN submission_revisions ar ON ar.submission_id=a.submission_id AND ar.revision_number=a.revision_number WHERE a.submission_id=s.id AND ${publicAttachment} AND ${attachmentTime}>=? AND ${attachmentTime}<?)
    ) ORDER BY created_at_utc,s.id LIMIT ?
  ), report_submissions AS (SELECT * FROM submission_candidates ORDER BY created_at_utc,id LIMIT ?)`;
  const subParams = [...taskParams, ...manager.params, period.snapshotAt, period.snapshotAt, period.start, period.end, period.start, period.end, period.start, period.end, cap + 1, cap];
  const childParams = [...subParams, ...manager.params, period.start, period.end, cap + 1];
  return [
    { sql: `/* report:tasks */ ${tasks} SELECT * FROM task_candidates ORDER BY start_date,id`, params: taskParams },
    { sql: `/* report:submissions */ ${tasks}${subs} SELECT * FROM submission_candidates ORDER BY created_at_utc,id`, params: subParams },
    { sql: `/* report:comments */ ${tasks}${subs} SELECT c.id,c.submission_id,c.revision_number,t.project_id,u.name AS author_name,c.content,${commentTime} AS created_at_utc
      FROM comments c JOIN report_submissions context ON context.id=c.submission_id JOIN submissions s ON s.id=c.submission_id JOIN tasks t ON t.id=s.task_id JOIN users u ON u.id=c.author_id
      JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=s.current_revision JOIN submission_revisions cr ON cr.submission_id=c.submission_id AND cr.revision_number=COALESCE(c.revision_number,1)
      WHERE ${manager.sql} AND ${publicCurrent} AND ${publicComment} AND ${commentTime}>=? AND ${commentTime}<? ORDER BY created_at_utc,c.id LIMIT ?`, params: childParams },
    { sql: `/* report:attachments */ ${tasks}${subs} SELECT a.id,a.submission_id,a.revision_number,t.project_id,a.file_name,a.file_mime_type,a.file_size_bytes,${attachmentTime} AS created_at_utc
      FROM submission_attachments a JOIN report_submissions context ON context.id=a.submission_id JOIN submissions s ON s.id=a.submission_id JOIN tasks t ON t.id=s.task_id
      JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=s.current_revision JOIN submission_revisions ar ON ar.submission_id=a.submission_id AND ar.revision_number=a.revision_number
      WHERE ${manager.sql} AND ${publicCurrent} AND ${publicAttachment} AND ${attachmentTime}>=? AND ${attachmentTime}<? ORDER BY created_at_utc,a.id LIMIT ?`, params: childParams },
  ];
}
export async function collectProjectReport(viewer: ProjectViewer, input: { projectId: number; period: ReportPeriod; audienceMode: ReportAudience; maxRows?: number }): Promise<DigestSnapshot> {
  try {
    const projectId = positive(input.projectId), requestedById = viewerId(viewer), period = normalizedPeriod(input.period), hosted = isHostedRuntime();
    allowedAudience(input.audienceMode);
    const cap = Math.min(20, Math.floor(reportBudget(input.maxRows) / 4));
    const [projectRows, taskRows, submissionRows, commentRows, attachmentRows] = await readSnapshot([projectStatement(viewer, projectId, hosted), ...collectionStatements(viewer, projectId, period, input.audienceMode, cap, hosted)], hosted);
    if (projectRows.length !== 1) unavailable();
    const project = projectRows[0], tasks = taskRows.slice(0, cap), submissions = submissionRows.slice(0, cap), comments = commentRows.slice(0, cap), attachments = attachmentRows.slice(0, cap);
    for (const task of tasks) if (task.parent_id !== null && Number(task.parent_project_id) !== projectId) unavailable();
    const inputData: DigestSnapshotInput = {
      project: { id: positive(project.id), name: strings(project.name), goal: strings(project.goal), startDate: strings(project.start_date), endDate: strings(project.end_date), projectType: strings(project.project_type) as DigestSnapshotInput["project"]["projectType"] },
      period, audienceMode: input.audienceMode, requestedById,
      tasks: tasks.map(row => ({ projectId: positive(row.project_id), id: positive(row.id), parentId: nullableNumber(row.parent_id), title: strings(row.title), status: strings(row.status) as DigestSnapshotInput["tasks"][number]["status"], startDate: strings(row.start_date), endDate: strings(row.end_date), assigneeName: nullableString(row.assignee_name), completionMode: strings(row.completion_mode) as DigestSnapshotInput["tasks"][number]["completionMode"] })),
      submissions: submissions.map(row => ({ projectId: positive(row.project_id), id: positive(row.id), taskId: positive(row.task_id), revisionNumber: positive(row.revision_number), authorName: strings(row.author_name), createdAt: strings(row.created_at_utc), visibility: strings(row.visibility) as "public" | "private", content: strings(row.content) })),
      comments: comments.map(row => ({ projectId: positive(row.project_id), id: positive(row.id), submissionId: positive(row.submission_id), revisionNumber: nullableNumber(row.revision_number), authorName: strings(row.author_name), createdAt: strings(row.created_at_utc), content: strings(row.content) })),
      attachments: attachments.map(row => ({ projectId: positive(row.project_id), id: positive(row.id), submissionId: positive(row.submission_id), revisionNumber: positive(row.revision_number), fileName: strings(row.file_name), mimeType: nullableString(row.file_mime_type), sizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes), createdAt: strings(row.created_at_utc) })),
      truncated: { tasks: taskRows.length > cap, submissions: submissionRows.length > cap, comments: commentRows.length > cap, attachments: attachmentRows.length > cap },
    };
    return createDigestSnapshot(inputData);
  } catch (error) { if (error instanceof ReportCollectorError) throw error; return databaseUnavailable(); }
}
function chunks<T>(values: T[], size: number): T[][] { const result: T[][] = []; for (let offset = 0; offset < values.length; offset += size) result.push(values.slice(offset, offset + size)); return result; }
/** A persisted artifact is an old snapshot, but authorization and visibility are always current. */
export async function reauthorizeReportSnapshot(viewer: ProjectViewer, snapshot: DigestSnapshot): Promise<void> {
  try {
    const s = validateDigestSnapshot(snapshot), hosted = isHostedRuntime(); viewerId(viewer);
    const projectId = s.project.id, guard = projectManagementGuard(viewer, "t.project_id"), statements = [projectStatement(viewer, projectId, hosted)], expected = [1];
    for (const group of chunks(s.tasks, 20)) { statements.push({ sql: `/* report:reauth-tasks */ SELECT t.id FROM tasks t WHERE t.project_id=? AND t.id IN (${group.map(() => "?").join(",")}) AND ${guard.sql}`, params: [projectId, ...group.map(row => row.id), ...guard.params] }); expected.push(group.length); }
    const publicVersions = s.audienceMode === "public_only" ? "s.visibility='public' AND r.visibility='public'" : "1=1";
    for (const group of chunks(s.submissions, 20)) {
      statements.push({ sql: `/* report:reauth-submissions */ SELECT s.id FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN submission_revisions r ON r.submission_id=s.id WHERE t.project_id=? AND (${group.map(() => "(s.id=? AND s.task_id=? AND r.revision_number=?)").join(" OR ")}) AND ${publicVersions} AND ${guard.sql}`, params: [projectId, ...group.flatMap(row => [row.id, row.taskId, row.revisionNumber]), ...guard.params] }); expected.push(group.length);
    }
    for (const group of chunks(s.comments, 20)) {
      const visibility = s.audienceMode === "public_only" ? "s.visibility='public' AND cr.visibility='public'" : "1=1";
      statements.push({ sql: `/* report:reauth-comments */ SELECT c.id FROM comments c JOIN submissions s ON s.id=c.submission_id JOIN tasks t ON t.id=s.task_id JOIN submission_revisions cr ON cr.submission_id=c.submission_id AND cr.revision_number=COALESCE(c.revision_number,1)
        WHERE t.project_id=? AND (${group.map(row => `(c.id=? AND c.submission_id=? AND ${row.revisionNumber === null ? "c.revision_number IS NULL" : "c.revision_number=?"})`).join(" OR ")}) AND ${visibility} AND ${guard.sql}`,
        params: [projectId, ...group.flatMap(row => row.revisionNumber === null ? [row.id, row.submissionId] : [row.id, row.submissionId, row.revisionNumber]), ...guard.params] }); expected.push(group.length);
    }
    for (const group of chunks(s.attachments, 20)) {
      statements.push({ sql: `/* report:reauth-attachments */ SELECT a.id FROM submission_attachments a JOIN submissions s ON s.id=a.submission_id JOIN tasks t ON t.id=s.task_id JOIN submission_revisions r ON r.submission_id=a.submission_id AND r.revision_number=a.revision_number
        WHERE t.project_id=? AND (${group.map(() => "(a.id=? AND a.submission_id=? AND a.revision_number=?)").join(" OR ")}) AND ${publicVersions} AND ${guard.sql}`,
        params: [projectId, ...group.flatMap(row => [row.id, row.submissionId, row.revisionNumber]), ...guard.params] }); expected.push(group.length);
    }
    const results = await readSnapshot(statements, hosted);
    if (results.length !== expected.length || results.some((result, index) => result.length !== expected[index])) unavailable();
  } catch (error) { if (error instanceof ReportCollectorError) throw error; return databaseUnavailable(); }
}
