import { createHash } from "node:crypto";
import { getDatabasePool, databaseBatch, type QueryStatement } from "@/src/shared/server/database/index.server";
import { projectPortalAccessGuard, projectPortalManagementGuard, projectPortalTeamGuard, type ProjectViewer } from "@/src/shared/server/project-portal-scope/index.server";
import { activityKinds, type ActivityKind } from "@/src/shared/config/activity-kinds";
import { ProjectPresentationError, type PortalSettings, type ProjectPortal, type PortalTeam, type TeamPresentation, type SavePortalSettingsInput, type SaveTeamPublicationInput } from "../model/presentation";

type Row = Record<string, unknown>;
const missing = (): never => { throw new ProjectPresentationError("NOT_FOUND"); };
const invalid = (): never => { throw new ProjectPresentationError("INVALID_INPUT"); };
function id(value: number) { if (!Number.isSafeInteger(value) || value < 1) invalid(); return value; }
function actor(viewer: ProjectViewer) { return id(Number(viewer.userId)); }
async function query(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
  try { return await getDatabasePool().query(sql, params) as Row[]; } catch { throw new ProjectPresentationError("UNAVAILABLE"); }
}
function date(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function text(value: unknown, limit: number, required = false) { if (typeof value !== "string" || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || (required && !value.trim())) return invalid(); return value.trim(); }
function mutation(input: { version: number; mutationKey: string }) {
  if (!Number.isSafeInteger(input.version) || input.version < 0 || input.version >= 2_147_483_647 || typeof input.mutationKey !== "string" || input.mutationKey.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.mutationKey)) invalid();
  return input.mutationKey.toLowerCase();
}
function settings(row: Row): PortalSettings {
  const layout = row.layout ?? (row.project_type === "volunteering" ? "volunteer_presentation" : "workspace");
  if (layout !== "workspace" && layout !== "volunteer_presentation") throw new ProjectPresentationError("UNAVAILABLE");
  return { layout, title: row.title == null ? String(row.name) : String(row.title), intro: row.intro == null ? String(row.goal ?? "") : String(row.intro), version: Number(row.version ?? 0), updatedAt: row.updated_at == null ? null : String(row.updated_at) };
}
/** Directory navigation follows the strict new portal membership boundary, never legacy WBS visibility. */
export async function listProjectPortals(viewer: ProjectViewer): Promise<{ id: number; name: string; projectType: "collaboration" | "volunteering" }[]> {
  const access = projectPortalAccessGuard(viewer);
  return (await query(`SELECT p.id,p.name,p.project_type FROM projects p WHERE ${access.sql} ORDER BY p.id LIMIT 100`, access.params)).map(row => ({ id: Number(row.id), name: String(row.name), projectType: row.project_type === "volunteering" ? "volunteering" : "collaboration" }));
}
export async function getProjectPortal(viewer: ProjectViewer, projectId: number): Promise<ProjectPortal> {
  id(projectId); const access = projectPortalAccessGuard(viewer, "p.id"), manage = projectPortalManagementGuard(viewer, "p.id");
  const rows = await query(`SELECT p.id,p.name,p.project_type,p.goal,p.start_date,p.end_date,s.layout,s.title,s.intro,s.version,s.updated_at,CASE WHEN ${manage.sql} THEN 1 ELSE 0 END can_manage FROM projects p LEFT JOIN project_presentation_settings s ON s.project_id=p.id WHERE p.id=? AND ${access.sql} LIMIT 1`, [...manage.params, projectId, ...access.params]);
  const row = rows[0]; if (!row) return missing();
  return { project: { id: Number(row.id), name: String(row.name), projectType: row.project_type === "volunteering" ? "volunteering" : "collaboration", goal: String(row.goal ?? ""), startDate: date(row.start_date), endDate: date(row.end_date) }, settings: settings(row), canManage: Number(row.can_manage) === 1 };
}
const teamSource = "FROM activity_teams t JOIN projects p ON p.id=t.project_id LEFT JOIN team_presentation_publications pub ON pub.project_id=p.id AND pub.team_id=t.id LEFT JOIN team_preparation_sheets prep ON prep.project_id=p.id AND prep.team_id=t.id";
function team(row: Row): PortalTeam {
  if (!activityKinds.includes(row.activity_kind as ActivityKind)) throw new ProjectPresentationError("UNAVAILABLE");
  const canRead = Number(row.can_read) === 1;
  return { id: Number(row.id), name: String(row.name), kind: row.activity_kind as ActivityKind, canRead, canEdit: Number(row.can_edit) === 1, audience: row.audience === "project" ? "project" : "team_private", publicationVersion: canRead ? Number(row.publication_version ?? 0) : 0, preparationVersion: canRead ? Number(row.preparation_version ?? 0) : 0, publishedAt: canRead && row.published_at != null ? String(row.published_at) : null };
}
function teamSelection(viewer: ProjectViewer) {
  const read = projectPortalTeamGuard(viewer, { edit: false }), edit = projectPortalTeamGuard(viewer, { edit: true });
  return { sql: `t.id,t.name,t.activity_kind,COALESCE(pub.audience,'team_private') audience,pub.version publication_version,pub.updated_at published_at,CASE WHEN ${read.sql} OR pub.audience='project' THEN 1 ELSE 0 END can_read,CASE WHEN ${edit.sql} THEN 1 ELSE 0 END can_edit,CASE WHEN pub.audience='project' AND NOT (${read.sql}) THEN pub.preparation_version ELSE COALESCE(prep.version,0) END preparation_version`, params: [...read.params, ...edit.params, ...read.params] };
}
/** Only team metadata is listed. Private preparation documents never enter the directory response. */
export async function listPortalTeams(viewer: ProjectViewer, projectId: number): Promise<PortalTeam[]> {
  await getProjectPortal(viewer, id(projectId));
  const access = projectPortalAccessGuard(viewer), select = teamSelection(viewer);
  return (await query(`SELECT ${select.sql} ${teamSource} WHERE p.id=? AND p.project_type='volunteering' AND ${access.sql} ORDER BY t.id LIMIT 100`, [...select.params, projectId, ...access.params])).map(team);
}
/** Returned JSON is normalized in the feature layer using the existing preparation domain. */
export async function getTeamPresentationRecord(viewer: ProjectViewer, projectId: number, teamId: number): Promise<TeamPresentation> {
  id(projectId); id(teamId); const access = projectPortalAccessGuard(viewer), read = projectPortalTeamGuard(viewer, { edit: false }), select = teamSelection(viewer);
  const rows = await query(`SELECT ${select.sql},CASE WHEN pub.audience='project' THEN revision.document_json ELSE prep.document_json END document_json,CASE WHEN pub.audience='project' THEN pub.preparation_version ELSE prep.version END source_version ${teamSource} LEFT JOIN team_preparation_revisions revision ON revision.project_id=p.id AND revision.team_id=t.id AND revision.version=pub.preparation_version WHERE p.id=? AND t.id=? AND p.project_type='volunteering' AND ${access.sql} AND (${read.sql} OR pub.audience='project') LIMIT 1`, [...select.params, projectId, teamId, ...access.params, ...read.params]);
  const row = rows[0]; if (!row) return missing();
  let document: unknown | null = null;
  if (row.document_json != null) { try { document = JSON.parse(String(row.document_json)); } catch { throw new ProjectPresentationError("UNAVAILABLE"); } }
  if (row.audience === "project" && !document) throw new ProjectPresentationError("UNAVAILABLE");
  return { team: team(row), document, mealQuantities: {}, sourceVersion: row.source_version == null ? null : Number(row.source_version), published: row.audience === "project" };
}

type MutationSpec = { table: "project_presentation_settings" | "team_presentation_publications"; revisions: "project_presentation_revisions" | "team_presentation_revisions"; key: "project_id" | "team_id"; keyValue: number; projectId: number; viewer: ProjectViewer; version: number; token: string; values: Record<string, string | number | null>; source: string; where: string; params: unknown[]; authorityWhere?: string; authorityParams?: unknown[] };
/** Guarded CAS + append-only actor-bound receipt, atomic on D1 and MariaDB. */
async function save(spec: MutationSpec): Promise<void> {
  const { table, revisions, key, keyValue, projectId, viewer, version: oldVersion, token, values, source, where, params } = spec;
  const actorId = actor(viewer), version = oldVersion + 1, at = new Date().toISOString();
  const authorityWhere = spec.authorityWhere ?? where, authorityParams = spec.authorityParams ?? params;
  const fingerprint = createHash("sha256").update(JSON.stringify({ projectId, keyValue, actorId, expectedVersion: oldVersion, values })).digest("hex");
  const readReceipt = async () => (await query(`SELECT r.request_hash,r.updated_by FROM ${revisions} r WHERE r.${key}=? AND r.project_id=? AND r.mutation_key=? AND EXISTS(SELECT 1 ${source} WHERE ${authorityWhere}) LIMIT 1`, [keyValue, projectId, token, ...authorityParams]))[0];
  const verify = (row: Row) => { if (row.request_hash !== fingerprint || Number(row.updated_by) !== actorId) throw new ProjectPresentationError("CONFLICT"); };
  const oldReceipt = await readReceipt(); if (oldReceipt) { verify(oldReceipt); return; }
  const fields = Object.keys(values), bindings = Object.values(values), headScope = `${where} AND NOT EXISTS(SELECT 1 FROM ${revisions} old_receipt WHERE old_receipt.${key}=? AND old_receipt.mutation_key=?)`;
  const extraIdentity = key === "team_id" ? ["project_id"] : [];
  const metadata = ["version", "updated_by", "updated_at", "mutation_key", "request_hash"], receiptFields = [key, ...extraIdentity, ...fields, ...metadata];
  const statements: QueryStatement[] = [];
  if (oldVersion === 0) statements.push({ sql: `INSERT INTO ${table}(${receiptFields.join(",")}) SELECT ?,${extraIdentity.length ? "?," : ""}${fields.map(() => "?").join(",")},?,?,?,?,? ${source} WHERE ${headScope} AND NOT EXISTS(SELECT 1 FROM ${table} old_head WHERE old_head.${key}=?)`, params: [keyValue, ...(extraIdentity.length ? [projectId] : []), ...bindings, version, actorId, at, token, fingerprint, ...params, keyValue, token, keyValue] });
  else statements.push({ sql: `UPDATE ${table} SET ${fields.map(field => `${field}=?`).join(",")},version=version+1,updated_by=?,updated_at=?,mutation_key=?,request_hash=? WHERE ${key}=? AND project_id=? AND version=? AND EXISTS(SELECT 1 ${source} WHERE ${headScope})`, params: [...bindings, actorId, at, token, fingerprint, keyValue, projectId, oldVersion, ...params, keyValue, token] });
  statements.push({ sql: `INSERT INTO ${revisions}(${receiptFields.join(",")}) SELECT ${receiptFields.map(field => `head.${field}`).join(",")} FROM ${table} head WHERE head.${key}=? AND head.project_id=? AND head.version=? AND head.mutation_key=? AND head.request_hash=? AND EXISTS(SELECT 1 ${source} WHERE ${headScope})`, params: [keyValue, projectId, version, token, fingerprint, ...params, keyValue, token] });
  statements.push({ sql: `INSERT INTO ${revisions}(${receiptFields.join(",")}) SELECT ${receiptFields.map(field => field === "version" ? "NULL" : `head.${field}`).join(",")} FROM ${table} head WHERE head.${key}=? AND head.project_id=? AND head.version=? AND head.mutation_key=? AND head.request_hash=? AND NOT EXISTS(SELECT 1 FROM ${revisions} receipt WHERE receipt.${key}=head.${key} AND receipt.mutation_key=head.mutation_key)`, params: [keyValue, projectId, version, token, fingerprint] });
  try { await databaseBatch(statements); }
  catch (error) {
    const receipt = await readReceipt(); if (receipt) { verify(receipt); return; }
    const allowed = await query(`SELECT 1 ${source} WHERE ${authorityWhere} LIMIT 1`, authorityParams); if (!allowed.length) return missing();
    const duplicate = (error as { code?: string })?.code === "ER_DUP_ENTRY" || (error instanceof Error && /UNIQUE constraint failed/.test(error.message));
    throw new ProjectPresentationError(duplicate ? "CONFLICT" : "UNAVAILABLE");
  }
  const receipt = await readReceipt(); if (!receipt) throw new ProjectPresentationError("CONFLICT"); verify(receipt);
}
export async function saveProjectPortalSettings(viewer: ProjectViewer, projectId: number, input: SavePortalSettingsInput): Promise<ProjectPortal> {
  const current = await getProjectPortal(viewer, projectId); if (!current.canManage) return missing();
  const token = mutation(input); if (!["workspace", "volunteer_presentation"].includes(input.layout) || (current.project.projectType !== "volunteering" && input.layout !== "workspace")) return invalid();
  const values = { layout: input.layout, title: text(input.title, 255, true), intro: text(input.intro, 2000) };
  const scope = projectPortalManagementGuard(viewer);
  await save({ table: "project_presentation_settings", revisions: "project_presentation_revisions", key: "project_id", keyValue: projectId, projectId, viewer, version: input.version, token, values, source: "FROM projects p", where: `p.id=? AND ${scope.sql} AND (p.project_type='volunteering' OR ?='workspace')`, params: [projectId, ...scope.params, input.layout] });
  const result = await getProjectPortal(viewer, projectId); if (!result.canManage) return missing(); return result;
}
export async function saveTeamPublication(viewer: ProjectViewer, projectId: number, teamId: number, input: SaveTeamPublicationInput): Promise<TeamPresentation> {
  id(projectId); id(teamId); const token = mutation(input);
  if (!["team_private", "project"].includes(input.audience) || !Number.isSafeInteger(input.preparationVersion) || input.preparationVersion < 0) return invalid();
  const edit = projectPortalTeamGuard(viewer, { edit: true }), permitted = await query(`SELECT t.id,t.activity_kind FROM activity_teams t JOIN projects p ON p.id=t.project_id WHERE t.id=? AND p.id=? AND p.project_type='volunteering' AND ${edit.sql}`, [teamId, projectId, ...edit.params]);
  if (!permitted.length) return missing();
  if (input.audience === "project" && input.preparationVersion === 0) return invalid();
  const values = { audience: input.audience, preparation_version: input.audience === "project" ? input.preparationVersion : null };
  const sourceVersion = input.audience === "project" ? " AND EXISTS(SELECT 1 FROM team_preparation_sheets current_prep JOIN team_preparation_revisions immutable_prep ON immutable_prep.team_id=current_prep.team_id AND immutable_prep.project_id=current_prep.project_id AND immutable_prep.version=current_prep.version WHERE current_prep.team_id=t.id AND current_prep.project_id=p.id AND current_prep.version=?)" : "";
  await save({ table: "team_presentation_publications", revisions: "team_presentation_revisions", key: "team_id", keyValue: teamId, projectId, viewer, version: input.version, token, values, source: "FROM activity_teams t JOIN projects p ON p.id=t.project_id", where: `t.id=? AND p.id=? AND p.project_type='volunteering' AND ${edit.sql}${sourceVersion}`, params: [teamId, projectId, ...edit.params, ...(sourceVersion ? [input.preparationVersion] : [])], authorityWhere: `t.id=? AND p.id=? AND p.project_type='volunteering' AND ${edit.sql}`, authorityParams: [teamId, projectId, ...edit.params] });
  return getTeamPresentationRecord(viewer, projectId, teamId);
}
