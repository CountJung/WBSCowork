import {
  databaseBatch,
  getDatabasePool,
} from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import type {
  BugReport,
  BugEvent,
  BugViewer,
  NewBugInput,
  BugStatus,
  BugPriority,
} from "../model/bug-report";

const reportColumns =
  "b.id,b.reporter_id,b.title,b.reproduction,b.expected,b.actual,b.page_path,b.status,b.priority,b.resolution,b.fix_commit,b.version,b.created_at,b.updated_at";
function scope(viewer: BugViewer) {
  return viewer.canReview
    ? { sql: "1=1", params: [] }
    : { sql: "b.reporter_id=?", params: [viewer.userId] };
}
function ignoreDuplicate(table: "bug_reports" | "bug_report_events") {
  return isHostedRuntime()
    ? " ON CONFLICT DO NOTHING"
    : ` ON DUPLICATE KEY UPDATE id=${table}.id`;
}
function operationKey(viewer: BugViewer, token: string, operation: string) {
  return `${viewer.userId}:${operation}:${token}`;
}
export async function getBugReport(id: number, viewer: BugViewer) {
  const access = scope(viewer);
  const rows = (await getDatabasePool().query(
    `SELECT ${reportColumns} FROM bug_reports b WHERE b.id=? AND ${access.sql} LIMIT 1`,
    [id, ...access.params],
  )) as BugReport[];
  return rows[0] ?? null;
}
export async function listBugReports(
  viewer: BugViewer,
  options: { page?: number; query?: string; status?: BugStatus } = {},
) {
  const access = scope(viewer),
    page = Math.min(1000, Math.max(1, Math.floor(options.page || 1)));
  let where = access.sql;
  const params: unknown[] = [...access.params];
  if (options.status) {
    where += " AND b.status=?";
    params.push(options.status);
  }
  if (options.query) {
    where += " AND b.title LIKE ? ESCAPE '!'";
    params.push(`%${options.query.slice(0, 100).replace(/[!%_]/g, "!$&")}%`);
  }
  const [count, rows] = (await Promise.all([
    getDatabasePool().query(
      `SELECT COUNT(*) AS count FROM bug_reports b WHERE ${where}`,
      params,
    ),
    getDatabasePool().query(
      `SELECT ${reportColumns} FROM bug_reports b WHERE ${where} ORDER BY b.id DESC LIMIT 20 OFFSET ?`,
      [...params, (page - 1) * 20],
    ),
  ])) as [Array<{ count: number }>, BugReport[]];
  return { count: Number(count[0]?.count ?? 0), reports: rows, page };
}
export async function listBugEvents(id: number, viewer: BugViewer, page = 1) {
  const access = scope(viewer);
  // Reapply report authorization at the event query, before pagination or serialization.
  return (await getDatabasePool().query(
    `SELECT e.id,e.report_id,e.actor_id,e.kind,e.body,e.status,e.priority,e.resolution,e.fix_commit,e.report_version,e.created_at FROM bug_report_events e JOIN bug_reports b ON b.id=e.report_id WHERE b.id=? AND ${access.sql} ORDER BY e.id DESC LIMIT 30 OFFSET ?`,
    [
      id,
      ...access.params,
      (Math.min(1000, Math.max(1, Math.floor(page || 1))) - 1) * 30,
    ],
  )) as BugEvent[];
}
export async function createBugReport(
  viewer: BugViewer,
  token: string,
  input: NewBugInput,
) {
  const key = operationKey(viewer, token, "create");
  await databaseBatch([
    {
      sql: `INSERT INTO bug_reports(reporter_id,creation_token,last_operation_token,title,reproduction,expected,actual,page_path) VALUES(?,?,?,?,?,?,?,?)${ignoreDuplicate("bug_reports")}`,
      params: [
        viewer.userId,
        key,
        key,
        input.title,
        input.reproduction,
        input.expected,
        input.actual,
        input.page_path,
      ],
    },
    {
      sql: `INSERT INTO bug_report_events(report_id,actor_id,operation_token,kind,body,status,priority,resolution,fix_commit,report_version) SELECT id,?,?, 'created','',status,priority,resolution,fix_commit,version FROM bug_reports WHERE creation_token=? AND reporter_id=?${ignoreDuplicate("bug_report_events")}`,
      params: [viewer.userId, key, key, viewer.userId],
    },
  ]);
  const rows = (await getDatabasePool().query(
    "SELECT id FROM bug_reports WHERE creation_token=? AND reporter_id=?",
    [key, viewer.userId],
  )) as Array<{ id: number }>;
  if (!rows[0])
    throw new Error(
      "제보 저장 상태를 확인하지 못했습니다. 같은 요청으로 다시 시도하세요.",
    );
  return rows[0].id;
}
export async function appendBugEvent(
  id: number,
  viewer: BugViewer,
  token: string,
  version: number,
  event: {
    kind: "review" | "addendum";
    body: string;
    status?: BugStatus;
    priority?: BugPriority;
    resolution?: string;
    fix_commit?: string;
  },
) {
  const existing = await getBugReport(id, viewer);
  if (!existing || (event.kind === "review" && !viewer.canReview))
    throw new Error("제보를 찾을 수 없습니다.");
  const key = operationKey(viewer, token, `${event.kind}:${id}`);
  const replay = (await getDatabasePool().query(
    "SELECT id FROM bug_report_events WHERE report_id=? AND actor_id=? AND operation_token=?",
    [id, viewer.userId, key],
  )) as Array<{ id: number }>;
  if (replay.length) return;
  const access = scope(viewer);
  const update =
    event.kind === "review"
      ? "status=?,priority=?,resolution=?,fix_commit=?,"
      : "";
  const values =
    event.kind === "review"
      ? [event.status, event.priority, event.resolution, event.fix_commit]
      : [];
  await databaseBatch([
    {
      sql: `UPDATE bug_reports AS b SET ${update}version=version+1,last_operation_token=?,updated_at=CURRENT_TIMESTAMP WHERE b.id=? AND b.version=? AND ${access.sql} AND NOT EXISTS (SELECT 1 FROM bug_report_events applied WHERE applied.operation_token=?)`,
      params: [...values, key, id, version, ...access.params, key],
    },
    {
      sql: `INSERT INTO bug_report_events(report_id,actor_id,operation_token,kind,body,status,priority,resolution,fix_commit,report_version) SELECT id,?,?,?,?,status,priority,resolution,fix_commit,version FROM bug_reports WHERE id=? AND last_operation_token=?${ignoreDuplicate("bug_report_events")}`,
      params: [viewer.userId, key, event.kind, event.body, id, key],
    },
  ]);
  const saved = (await getDatabasePool().query(
    "SELECT id FROM bug_report_events WHERE report_id=? AND actor_id=? AND operation_token=?",
    [id, viewer.userId, key],
  )) as Array<{ id: number }>;
  if (!saved.length)
    throw new Error(
      "다른 변경이 먼저 저장되었습니다. 새로고침 후 최신 내용을 확인하고 다시 저장하세요.",
    );
}
