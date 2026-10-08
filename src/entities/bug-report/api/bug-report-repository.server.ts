import { createHash } from "node:crypto";
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
  BugLifecycleAction,
} from "../model/bug-report";

const reportColumns =
  "b.id,b.reporter_id,b.title,b.reproduction,b.expected,b.actual,b.page_path,b.status,b.priority,b.resolution,b.fix_commit,b.version,b.created_at,b.updated_at,b.verified_at,b.verified_by,b.verification_note,b.trashed_at,b.trashed_by";
function scope(viewer: BugViewer, trash = false) {
  if (trash && !viewer.canReview) return { sql: "1=0", params: [] };
  const state = trash ? "b.trashed_at IS NOT NULL" : "b.trashed_at IS NULL";
  return viewer.canReview
    ? { sql: state, params: [] }
    : { sql: `${state} AND b.reporter_id=?`, params: [viewer.userId] };
}
function ignoreDuplicate(table: "bug_reports" | "bug_report_events") {
  return isHostedRuntime()
    ? " ON CONFLICT DO NOTHING"
    : ` ON DUPLICATE KEY UPDATE id=${table}.id`;
}
function operationKey(viewer: BugViewer, token: string, operation: string) {
  return `${viewer.userId}:${operation}:${token}`;
}
export async function getBugReport(
  id: number,
  viewer: BugViewer,
  trash = false,
) {
  const access = scope(viewer, trash);
  const rows = (await getDatabasePool().query(
    `SELECT ${reportColumns} FROM bug_reports b WHERE b.id=? AND ${access.sql} LIMIT 1`,
    [id, ...access.params],
  )) as BugReport[];
  return rows[0] ?? null;
}
export async function listBugReports(
  viewer: BugViewer,
  options: {
    page?: number;
    query?: string;
    status?: BugStatus;
    trash?: boolean;
  } = {},
) {
  const access = scope(viewer, options.trash),
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
export async function listBugEvents(
  id: number,
  viewer: BugViewer,
  page = 1,
  trash = false,
) {
  const access = scope(viewer, trash);
  // Reapply report authorization at the event query, before pagination or serialization.
  return (await getDatabasePool().query(
    `SELECT e.id,e.report_id,e.actor_id,e.kind,e.body,e.status,e.priority,e.resolution,e.fix_commit,e.report_version,e.created_at,e.lifecycle_action FROM bug_report_events e JOIN bug_reports b ON b.id=e.report_id WHERE b.id=? AND ${access.sql} ORDER BY e.id DESC LIMIT 30 OFFSET ?`,
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
      sql: `UPDATE bug_reports AS b SET ${update}verified_at=NULL,verified_by=NULL,verification_note='',version=version+1,last_operation_token=?,updated_at=CURRENT_TIMESTAMP WHERE b.id=? AND b.version=? AND ${access.sql} AND NOT EXISTS (SELECT 1 FROM bug_report_events applied WHERE applied.operation_token=?)`,
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

export async function changeBugLifecycle(
  id: number,
  viewer: BugViewer,
  token: string,
  version: number,
  action: BugLifecycleAction,
  note: string,
) {
  if (!viewer.canReview || !["verify", "trash", "restore"].includes(action))
    throw new Error("제보를 찾을 수 없습니다.");
  const key = operationKey(viewer, token, `${action}:${id}`);
  // A same-actor retry of a completed transition does not append another event.
  const replay = (await getDatabasePool().query(
    "SELECT id FROM bug_report_events WHERE report_id=? AND actor_id=? AND operation_token=?",
    [id, viewer.userId, key],
  )) as Array<{ id: number }>;
  if (replay.length) return;
  const trash = action === "restore";
  const existing = await getBugReport(id, viewer, trash);
  if (!existing) throw new Error("제보를 찾을 수 없습니다.");
  const terminal = "b.status IN ('resolved','closed')";
  const prerequisite =
    action === "restore"
      ? "b.trashed_at IS NOT NULL"
      : action === "verify"
        ? `${terminal} AND b.trashed_at IS NULL`
        : `${terminal} AND b.verified_at IS NOT NULL AND b.trashed_at IS NULL`;
  const update =
    action === "verify"
      ? "verified_at=CURRENT_TIMESTAMP,verified_by=?,verification_note=?,"
      : action === "trash"
        ? "trashed_at=CURRENT_TIMESTAMP,trashed_by=?,"
        : "trashed_at=NULL,trashed_by=NULL,";
  const values =
    action === "verify"
      ? [viewer.userId, note]
      : action === "trash"
        ? [viewer.userId]
        : [];
  await databaseBatch([
    {
      sql: `UPDATE bug_reports AS b SET ${update}version=version+1,last_operation_token=?,updated_at=CURRENT_TIMESTAMP WHERE b.id=? AND b.version=? AND ${prerequisite} AND NOT EXISTS (SELECT 1 FROM bug_report_events applied WHERE applied.operation_token=?)`,
      params: [...values, key, id, version, key],
    },
    {
      sql: `INSERT INTO bug_report_events(report_id,actor_id,operation_token,kind,body,status,priority,resolution,fix_commit,report_version,lifecycle_action) SELECT id,?,?,'review',?,status,priority,resolution,fix_commit,version,? FROM bug_reports WHERE id=? AND last_operation_token=?${ignoreDuplicate("bug_report_events")}`,
      params: [viewer.userId, key, note, action, id, key],
    },
  ]);
  const saved = (await getDatabasePool().query(
    "SELECT id FROM bug_report_events WHERE report_id=? AND actor_id=? AND operation_token=?",
    [id, viewer.userId, key],
  )) as Array<{ id: number }>;
  if (!saved.length)
    throw new Error(
      "검증·휴지통 상태 또는 버전이 변경되었습니다. 새로고침 후 확인하세요.",
    );
}

export type BugPurgeSnapshot = {
  report: BugReport;
  fingerprint: string;
  eventCount: number;
  lastEventId: number;
};
function canonicalDate(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}
export async function getBugPurgeSnapshot(
  id: number,
  viewer: BugViewer,
): Promise<BugPurgeSnapshot | null> {
  if (!viewer.canReview || !viewer.canPurge) return null;
  const report = await getBugReport(id, viewer, true);
  if (
    !report ||
    !report.verified_at ||
    !["resolved", "closed"].includes(report.status)
  )
    return null;
  const rows = (await getDatabasePool().query(
    "SELECT COUNT(*) AS count, MAX(id) AS last_id FROM bug_report_events WHERE report_id=?",
    [id],
  )) as Array<{ count: number; last_id: number | null }>;
  const eventCount = Number(rows[0]?.count ?? 0),
    lastEventId = Number(rows[0]?.last_id ?? 0);
  if (!eventCount || eventCount > 1000)
    throw new Error("자동 영구 삭제는 이력 1~1000건인 기록에 한정됩니다.");
  const hash = createHash("sha256");
  // Account unlinking is independent of report version; the fingerprint binds content/state, not nullable identities.
  hash.update(
    JSON.stringify({
      ...report,
      reporter_id: null,
      verified_by: null,
      trashed_by: null,
      created_at: canonicalDate(report.created_at),
      updated_at: canonicalDate(report.updated_at),
      verified_at: canonicalDate(report.verified_at),
      trashed_at: canonicalDate(report.trashed_at),
    }),
  );
  let cursor = 0,
    total = 0;
  // Hash complete history in bounded chunks, not the UI's 30-event page.
  while (total < eventCount) {
    const events = (await getDatabasePool().query(
      "SELECT id,report_id,actor_id,kind,body,status,priority,resolution,fix_commit,report_version,created_at,lifecycle_action FROM bug_report_events WHERE report_id=? AND id>? AND id<=? ORDER BY id LIMIT 50",
      [id, cursor, lastEventId],
    )) as BugEvent[];
    if (!events.length) throw new Error("이력이 변경되었습니다.");
    for (const event of events)
      hash.update(
        JSON.stringify({
          ...event,
          actor_id: null,
          created_at: canonicalDate(event.created_at),
        }) + "\n",
      );
    total += events.length;
    cursor = Number(events.at(-1)!.id);
  }
  const current = await getBugReport(id, viewer, true);
  if (
    total !== eventCount ||
    cursor !== lastEventId ||
    !current ||
    current.version !== report.version
  )
    throw new Error("기록이 변경되었습니다.");
  return { report, eventCount, lastEventId, fingerprint: hash.digest("hex") };
}
export async function purgeBugReport(
  id: number,
  viewer: BugViewer,
  token: string,
  version: number,
  fingerprint: string,
  confirmationTitle: string,
  eventCount: number,
  lastEventId: number,
) {
  if (!viewer.canReview || !viewer.canPurge)
    throw new Error("제보를 찾을 수 없습니다.");
  const key = operationKey(viewer, token, `purge:${id}`);
  const wasPurged = async () =>
    (
      (await getDatabasePool().query(
        "SELECT report_id FROM bug_report_purge_receipts WHERE report_id=? AND actor_id=? AND operation_token=? AND fingerprint=? AND report_version=? AND event_count=? AND last_event_id=?",
        [id, viewer.userId, key, fingerprint, version, eventCount, lastEventId],
      )) as Array<{ report_id: number }>
    ).length > 0;
  if (await wasPurged()) return;
  let snapshot: BugPurgeSnapshot | null;
  try {
    snapshot = await getBugPurgeSnapshot(id, viewer);
  } catch (error) {
    if (await wasPurged()) return;
    throw error;
  }
  if (!snapshot && (await wasPurged())) return;
  if (
    !snapshot ||
    snapshot.report.version !== version ||
    snapshot.fingerprint !== fingerprint ||
    snapshot.report.title !== confirmationTitle ||
    snapshot.eventCount !== eventCount ||
    snapshot.lastEventId !== lastEventId
  )
    throw new Error("확인 대상이 변경되었거나 제목이 일치하지 않습니다.");
  const receipt =
    "EXISTS (SELECT 1 FROM bug_report_purge_receipts p WHERE p.report_id=? AND p.actor_id=? AND p.operation_token=? AND p.fingerprint=? AND p.report_version=?)";
  const receiptParams = [id, viewer.userId, key, fingerprint, version];
  await databaseBatch([
    // Lock the parent before receipt/history changes even under native READ COMMITTED.
    // D1's atomic batch already serializes these writes.
    ...(isHostedRuntime()
      ? []
      : [
          {
            sql: "SELECT id FROM bug_reports WHERE id=? FOR UPDATE",
            params: [id],
          },
        ]),
    {
      sql: `INSERT INTO bug_report_purge_receipts(report_id,actor_id,operation_token,fingerprint,report_version,event_count,last_event_id) SELECT b.id,?,?,?,?,?,? FROM bug_reports b WHERE b.id=? AND b.version=? AND b.title=? AND b.verified_at IS NOT NULL AND b.trashed_at IS NOT NULL AND b.status IN ('resolved','closed') AND (SELECT COUNT(*) FROM bug_report_events e WHERE e.report_id=b.id)=? AND (SELECT MAX(e.id) FROM bug_report_events e WHERE e.report_id=b.id)=?`,
      params: [
        viewer.userId,
        key,
        fingerprint,
        version,
        eventCount,
        lastEventId,
        id,
        version,
        confirmationTitle,
        eventCount,
        lastEventId,
      ],
    },
    {
      sql: `DELETE FROM bug_report_events WHERE report_id=? AND id<=? AND ${receipt} AND EXISTS (SELECT 1 FROM bug_reports b WHERE b.id=? AND b.version=? AND b.trashed_at IS NOT NULL AND b.verified_at IS NOT NULL)`,
      params: [id, lastEventId, ...receiptParams, id, version],
    },
    // Non-cascade FK makes unexpected remaining history abort/rollback the whole purge.
    {
      sql: `DELETE FROM bug_reports WHERE id=? AND version=? AND trashed_at IS NOT NULL AND verified_at IS NOT NULL AND ${receipt}`,
      params: [id, version, ...receiptParams],
    },
  ]);
  const saved = (await getDatabasePool().query(
    "SELECT report_id FROM bug_report_purge_receipts WHERE report_id=? AND actor_id=? AND operation_token=?",
    [id, viewer.userId, key],
  )) as Array<{ report_id: number }>;
  if (!saved.length) throw new Error("삭제 전에 대상이 변경되었습니다.");
}
