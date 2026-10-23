import { createHash } from "node:crypto";
import { activityKinds, type ActivityKind } from "@/src/shared/config/activity-kinds";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { projectAccessGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { emptyPreparationDocument, mealQuantity, normalizePreparationDocument, type PreparationDocument } from "../model/preparation";

export type PreparationErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE";
export class PreparationError extends Error {
  constructor(public readonly code: PreparationErrorCode) { super(code); this.name = "PreparationError"; }
  get status() { return this.code === "INVALID_INPUT" ? 400 : this.code === "NOT_FOUND" ? 404 : this.code === "CONFLICT" ? 409 : 503; }
}
export type PreparationView = {
  teamId: number; projectId: number; teamName: string; kind: ActivityKind; canEdit: boolean;
  version: number; document: PreparationDocument; mealQuantities: Record<string, number>; updatedAt: string | null; updatedBy: number | null;
};
export type PreparationSummary = Omit<PreparationView, "document" | "mealQuantities"> & { entryCount: number; completedCount: number };
export type PreparationHistory = { version: number; changedAt: string; changedBy: number };
export type SavePreparationInput = { version: number; mutationKey: string; document: unknown };
type Row = Record<string, unknown>;
const notFound = (): never => { throw new PreparationError("NOT_FOUND"); };
function positive(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) throw new PreparationError("INVALID_INPUT");
  return value;
}
function actor(viewer: ProjectViewer) {
  const id = viewer.userId, email = typeof viewer.email === "string" ? viewer.email.trim().toLowerCase() : "";
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || !email || email.length > 255) return notFound();
  return { id, email, isSuperuser: !!viewer.isSuperuser };
}
/** Fixed aliases t/p/u only. Every query intersects exact current identity and project access. */
function teamScope(viewer: ProjectViewer, edit: boolean) {
  const current = actor(viewer), access = projectAccessGuard(viewer, "p.id");
  const su = getRuntimeEnv().auth.superuserEmail?.trim().toLowerCase() ?? "";
  const member = "EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=u.id AND pm.active=1)";
  const teamMember = `EXISTS(SELECT 1 FROM activity_team_members tm WHERE tm.project_id=p.id AND tm.team_id=t.id AND tm.user_id=u.id AND tm.active=1${edit ? " AND tm.role='leader' AND EXISTS(SELECT 1 FROM activity_team_leaders leader WHERE leader.project_id=tm.project_id AND leader.team_id=tm.team_id AND leader.user_id=tm.user_id)" : ""})`;
  return {
    sql: `u.id=? AND LOWER(TRIM(u.email))=? AND p.project_type='volunteering' AND t.activity_kind IN ('meal','facility','senior_care','child_care','recreation','other') AND ${access.sql} AND ((?=1 AND LOWER(TRIM(u.email))=?) OR (u.role='admin' AND ${member}) OR (u.role IN ('member','admin') AND ${member} AND ${teamMember}))`,
    params: [current.id, current.email, ...access.params, current.isSuperuser ? 1 : 0, su],
  };
}
const source = "FROM activity_teams t JOIN projects p ON p.id=t.project_id JOIN users u ON 1=1";
const metadata = "t.id AS team_id,t.project_id,t.name AS team_name,t.activity_kind,COALESCE(s.version,0) AS version,s.updated_at,s.updated_by";
async function query(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
  try { return await getDatabasePool().query(sql, params) as Row[]; }
  catch { throw new PreparationError("UNAVAILABLE"); }
}
function meta(row: Row): Omit<PreparationView, "document" | "mealQuantities"> {
  if (typeof row.activity_kind !== "string" || !activityKinds.includes(row.activity_kind as ActivityKind)) throw new PreparationError("UNAVAILABLE");
  return {
    teamId: Number(row.team_id), projectId: Number(row.project_id), teamName: String(row.team_name), kind: row.activity_kind as ActivityKind,
    canEdit: Number(row.can_edit) === 1, version: Number(row.version),
    updatedAt: row.updated_at === null ? null : String(row.updated_at), updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  };
}
export async function getTeamPreparation(viewer: ProjectViewer, projectId: number, teamId: number): Promise<PreparationView> {
  positive(projectId); positive(teamId);
  const read = teamScope(viewer, false), edit = teamScope(viewer, true);
  const rows = await query(`SELECT ${metadata},s.document_json,CASE WHEN ${edit.sql} THEN 1 ELSE 0 END AS can_edit ${source} LEFT JOIN team_preparation_sheets s ON s.team_id=t.id AND s.project_id=p.id WHERE t.id=? AND p.id=? AND ${read.sql} LIMIT 1`, [...edit.params, teamId, projectId, ...read.params]);
  if (!rows[0]) return notFound();
  const result = meta(rows[0]);
  try {
    const document = result.version === 0 ? emptyPreparationDocument(result.kind) : normalizePreparationDocument(JSON.parse(String(rows[0].document_json)), result.kind);
    const mealQuantities = document.kind === "meal" ? Object.fromEntries(document.entries.map(entry => [entry.id, mealQuantity(entry)])) : {};
    return { ...result, document, mealQuantities };
  } catch { throw new PreparationError("UNAVAILABLE"); }
}
/** No document JSON/body is selected into a team overview or sent to a client. */
export async function listTeamPreparations(viewer: ProjectViewer, projectId: number, afterTeamId = 0): Promise<PreparationSummary[]> {
  positive(projectId);
  if (!Number.isSafeInteger(afterTeamId) || afterTeamId < 0) throw new PreparationError("INVALID_INPUT");
  const read = teamScope(viewer, false), edit = teamScope(viewer, true);
  const counts = isHostedRuntime()
    ? "COALESCE(json_array_length(s.document_json,'$.entries'),0) AS entry_count,(SELECT COUNT(*) FROM json_each(s.document_json,'$.entries') entry WHERE json_extract(entry.value,'$.status')='done') AS completed_count"
    : "COALESCE(JSON_LENGTH(s.document_json,'$.entries'),0) AS entry_count,COALESCE(JSON_LENGTH(JSON_SEARCH(s.document_json,'all','done',NULL,'$.entries[*].status')),0) AS completed_count";
  const rows = await query(`SELECT ${metadata},CASE WHEN ${edit.sql} THEN 1 ELSE 0 END AS can_edit,${counts} ${source} LEFT JOIN team_preparation_sheets s ON s.team_id=t.id AND s.project_id=p.id WHERE p.id=? AND t.id>? AND ${read.sql} ORDER BY t.id LIMIT 100`, [...edit.params, projectId, afterTeamId, ...read.params]);
  return rows.map(row => ({ ...meta(row), entryCount: Number(row.entry_count), completedCount: Number(row.completed_count) }));
}
export async function getTeamPreparationHistory(viewer: ProjectViewer, projectId: number, teamId: number): Promise<PreparationHistory[]> {
  // Distinguish a permitted empty history from an inaccessible team without disclosing old snapshots.
  await getTeamPreparation(viewer, projectId, teamId);
  const scope = teamScope(viewer, false);
  const rows = await query(`SELECT r.version,r.changed_at,r.changed_by ${source} JOIN team_preparation_revisions r ON r.team_id=t.id AND r.project_id=p.id WHERE p.id=? AND t.id=? AND ${scope.sql} ORDER BY r.version DESC LIMIT 10`, [projectId, teamId, ...scope.params]);
  return rows.map(row => ({ version: Number(row.version), changedAt: String(row.changed_at), changedBy: Number(row.changed_by) }));
}
async function receipt(viewer: ProjectViewer, projectId: number, teamId: number, mutationKey: string) {
  const scope = teamScope(viewer, true);
  return (await query(`SELECT r.version,r.request_hash,r.changed_by ${source} JOIN team_preparation_revisions r ON r.team_id=t.id AND r.project_id=p.id WHERE p.id=? AND t.id=? AND r.mutation_key=? AND ${scope.sql} LIMIT 1`, [projectId, teamId, mutationKey, ...scope.params]))[0];
}
function validReceipt(row: Row, hash: string, userId: number) {
  if (row.request_hash !== hash || Number(row.changed_by) !== userId) throw new PreparationError("CONFLICT");
}
function conflictError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "ER_DUP_ENTRY" || (error instanceof Error && /UNIQUE constraint failed/.test(error.message));
}
export async function saveTeamPreparation(viewer: ProjectViewer, projectId: number, teamId: number, input: SavePreparationInput): Promise<PreparationView> {
  const current = await getTeamPreparation(viewer, projectId, teamId);
  if (!current.canEdit) return notFound();
  if (!input || !Number.isSafeInteger(input.version) || input.version < 0 || input.version >= 2_147_483_647 || typeof input.mutationKey !== "string" || input.mutationKey.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i.test(input.mutationKey)) throw new PreparationError("INVALID_INPUT");
  let document: PreparationDocument;
  try { document = normalizePreparationDocument(input.document, current.kind); }
  catch { throw new PreparationError("INVALID_INPUT"); }
  const userId = actor(viewer).id, token = input.mutationKey.toLowerCase(), json = JSON.stringify(document), version = input.version + 1;
  const hash = createHash("sha256").update(JSON.stringify({ projectId, teamId, actorId: userId, expectedVersion: input.version, document })).digest("hex");
  const previous = await receipt(viewer, projectId, teamId, token);
  if (previous) { validReceipt(previous, hash, userId); return getTeamPreparation(viewer, projectId, teamId); }
  const authority = teamScope(viewer, true), at = new Date().toISOString();
  const scope = { sql: `${authority.sql} AND t.activity_kind=?`, params: [...authority.params, current.kind] };
  const noReceipt = "NOT EXISTS(SELECT 1 FROM team_preparation_revisions prior WHERE prior.team_id=t.id AND prior.mutation_key=?)";
  const statements: QueryStatement[] = [];
  if (input.version === 0) {
    statements.push({
      sql: `INSERT INTO team_preparation_sheets(team_id,project_id,version,document_json,updated_by,updated_at,mutation_key,request_hash) SELECT t.id,p.id,1,?,?,?,?,? ${source} WHERE t.id=? AND p.id=? AND ${scope.sql} AND ${noReceipt} AND NOT EXISTS(SELECT 1 FROM team_preparation_sheets old WHERE old.team_id=t.id)`,
      params: [json, userId, at, token, hash, teamId, projectId, ...scope.params, token],
    });
  } else {
    statements.push({
      sql: `UPDATE team_preparation_sheets SET version=version+1,document_json=?,updated_by=?,updated_at=?,mutation_key=?,request_hash=? WHERE team_id=? AND project_id=? AND version=? AND EXISTS(SELECT 1 ${source} WHERE t.id=team_preparation_sheets.team_id AND p.id=team_preparation_sheets.project_id AND ${scope.sql} AND ${noReceipt})`,
      params: [json, userId, at, token, hash, teamId, projectId, input.version, ...scope.params, token],
    });
  }
  statements.push({
    sql: `INSERT INTO team_preparation_revisions(team_id,project_id,version,document_json,changed_by,changed_at,mutation_key,request_hash) SELECT s.team_id,s.project_id,s.version,s.document_json,s.updated_by,s.updated_at,s.mutation_key,s.request_hash ${source} JOIN team_preparation_sheets s ON s.team_id=t.id AND s.project_id=p.id WHERE t.id=? AND p.id=? AND s.version=? AND s.mutation_key=? AND s.request_hash=? AND ${scope.sql} AND ${noReceipt}`,
    params: [teamId, projectId, version, token, hash, ...scope.params, token],
  });
  // A guarded revision INSERT may affect zero rows. This invariant intentionally does not
  // reauthorize: even identity changes must roll back a changed head without its receipt.
  // It can only reject the transaction, never insert a valid revision or grant access.
  statements.push({
    sql: "INSERT INTO team_preparation_revisions(team_id,project_id,version,document_json,changed_by,changed_at,mutation_key,request_hash) SELECT s.team_id,s.project_id,NULL,s.document_json,s.updated_by,s.updated_at,s.mutation_key,s.request_hash FROM team_preparation_sheets s WHERE s.team_id=? AND s.project_id=? AND s.version=? AND s.mutation_key=? AND s.request_hash=? AND NOT EXISTS(SELECT 1 FROM team_preparation_revisions r WHERE r.team_id=s.team_id AND r.mutation_key=s.mutation_key)",
    params: [teamId, projectId, version, token, hash],
  });
  try { await databaseBatch(statements); }
  catch (error) {
    const saved = await receipt(viewer, projectId, teamId, token);
    if (saved) { validReceipt(saved, hash, userId); return getTeamPreparation(viewer, projectId, teamId); }
    // Reauthorize before reporting conflicts; revoked and absent resources remain the same 404.
    if (!(await getTeamPreparation(viewer, projectId, teamId)).canEdit) return notFound();
    throw new PreparationError(conflictError(error) ? "CONFLICT" : "UNAVAILABLE");
  }
  const saved = await receipt(viewer, projectId, teamId, token);
  const latest = await getTeamPreparation(viewer, projectId, teamId);
  if (!latest.canEdit) return notFound();
  if (!saved) throw new PreparationError("CONFLICT");
  validReceipt(saved, hash, userId);
  return latest;
}
