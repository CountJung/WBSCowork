import { createHash } from "node:crypto";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { projectPortalAccessGuard, projectPortalTeamGuard } from "@/src/shared/server/project-portal-scope/index.server";
import type { ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { storePrivateFile } from "@/src/shared/server/private-files/index.server";
import { deleteUnreferencedObject } from "@/src/shared/server/object-cleanup/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { MEDIA_VIDEO_MAX_BYTES, mediaId, mediaMutationKey, normalizeMediaFields, ProjectMediaError, validateMediaBytes, validateMediaFileName, type MediaFields, type MediaMime, type MediaTeam, type ProjectMediaItem } from "../model/media";

type Row = Record<string, unknown>;
const source = "FROM activity_teams t JOIN projects p ON p.id=t.project_id JOIN users u ON 1=1";
const mediaSource = "FROM project_media_items m JOIN activity_teams t ON t.id=m.team_id AND t.project_id=m.project_id JOIN projects p ON p.id=m.project_id JOIN users u ON 1=1";
const teamFilter = "p.project_type='volunteering' AND t.activity_kind='media'";
const columns = "m.*,t.name AS team_name";
const missing = (): never => { throw new ProjectMediaError("NOT_FOUND"); };
function actor(viewer: ProjectViewer) { return mediaId(viewer.userId); }
async function query(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
  try { return await getDatabasePool().query(sql, params) as Row[]; } catch { throw new ProjectMediaError("UNAVAILABLE"); }
}
function accessScope(viewer: ProjectViewer) {
  const scope = projectPortalAccessGuard(viewer, "p.id");
  return { sql: `u.id=? AND (${scope.sql})`, params: [actor(viewer), ...scope.params] };
}
function readable(viewer: ProjectViewer) {
  const access = accessScope(viewer), team = projectPortalTeamGuard(viewer, { project: "p.id", team: "t.id", edit: false });
  return { sql: `(${access.sql}) AND (m.visibility='project' OR m.created_by=? OR (${team.sql}))`, params: [...access.params, actor(viewer), ...team.params] };
}
function editable(viewer: ProjectViewer) { const scope = projectPortalTeamGuard(viewer, { project: "p.id", team: "t.id", edit: true }); return { sql: `u.id=? AND (${scope.sql})`, params: [actor(viewer), ...scope.params] }; }
function item(row: Row): ProjectMediaItem {
  const projectId = Number(row.project_id), teamId = Number(row.team_id), id = Number(row.id);
  return { id, projectId, teamId, teamName: String(row.team_name), createdBy: Number(row.created_by), title: String(row.title), caption: String(row.caption), visibility: row.visibility as MediaFields["visibility"], version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at), fileName: String(row.file_name), mimeType: row.file_mime_type as MediaMime, sizeBytes: Number(row.file_size_bytes), canEdit: Number(row.can_edit) === 1, fileUrl: `/api/projects/${projectId}/teams/${teamId}/media/${id}/file` };
}
export async function listMediaTeams(viewer: ProjectViewer, projectId: number): Promise<MediaTeam[]> {
  mediaId(projectId); actor(viewer);
  const access = accessScope(viewer), edit = editable(viewer);
  const projects = await query(`SELECT p.id FROM projects p JOIN users u ON 1=1 WHERE p.id=? AND ${access.sql} LIMIT 1`, [projectId, ...access.params]);
  if (!projects.length) return missing();
  const rows = await query(`SELECT t.id,t.name,CASE WHEN ${edit.sql} THEN 1 ELSE 0 END AS can_edit ${source} WHERE p.id=? AND ${teamFilter} AND ${access.sql} ORDER BY t.id LIMIT 100`, [...edit.params, projectId, ...access.params]);
  return rows.map(row => ({ id: Number(row.id), name: String(row.name), canUpload: Number(row.can_edit) === 1 }));
}
async function assertTeam(viewer: ProjectViewer, projectId: number, teamId: number, edit = false) {
  mediaId(projectId); mediaId(teamId); actor(viewer);
  const guard = edit ? editable(viewer) : accessScope(viewer);
  if (!(await query(`SELECT t.id ${source} WHERE p.id=? AND t.id=? AND ${teamFilter} AND ${guard.sql} LIMIT 1`, [projectId, teamId, ...guard.params])).length) missing();
}
export async function listProjectMedia(viewer: ProjectViewer, projectId: number, teamId?: number, after = 0): Promise<{ items: ProjectMediaItem[]; nextAfter: number | null }> {
  mediaId(projectId); if (!Number.isSafeInteger(after) || after < 0) throw new ProjectMediaError("INVALID_INPUT");
  if (teamId !== undefined) await assertTeam(viewer, projectId, teamId); else await listMediaTeams(viewer, projectId);
  const read = readable(viewer), edit = editable(viewer);
  const rows = await query(`SELECT ${columns},CASE WHEN ${edit.sql} THEN 1 ELSE 0 END AS can_edit ${mediaSource} WHERE p.id=? ${teamId === undefined ? "" : "AND t.id=?"} AND ${teamFilter} AND (?=0 OR m.id<?) AND ${read.sql} ORDER BY m.id DESC LIMIT 31`, [...edit.params, projectId, ...(teamId === undefined ? [] : [teamId]), after, after, ...read.params]);
  const items = rows.slice(0, 30).map(item);
  return { items, nextAfter: rows.length > 30 ? items.at(-1)!.id : null };
}
async function rowForViewer(viewer: ProjectViewer, projectId: number, teamId: number, id: number) {
  mediaId(projectId); mediaId(teamId); mediaId(id); const read = readable(viewer), edit = editable(viewer);
  const rows = await query(`SELECT ${columns},CASE WHEN ${edit.sql} THEN 1 ELSE 0 END AS can_edit ${mediaSource} WHERE m.id=? AND p.id=? AND t.id=? AND ${teamFilter} AND ${read.sql} LIMIT 1`, [...edit.params, id, projectId, teamId, ...read.params]);
  if (!rows[0]) return missing(); return rows[0];
}
export async function getProjectMediaForViewer(viewer: ProjectViewer, projectId: number, teamId: number, id: number) { return item(await rowForViewer(viewer, projectId, teamId, id)); }
export async function getProjectMediaFileForViewer(viewer: ProjectViewer, projectId: number, teamId: number, id: number) {
  const row = await rowForViewer(viewer, projectId, teamId, id);
  return { item: item(row), filePath: String(row.file_path), contentHash: String(row.content_hash) };
}
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function uploadReceipt(viewer: ProjectViewer, projectId: number, teamId: number, key: string) {
  const guard = editable(viewer);
  return (await query(`SELECT ${columns},r.request_hash AS upload_request_hash,CASE WHEN ${guard.sql} THEN 1 ELSE 0 END AS can_edit ${mediaSource} JOIN project_media_revisions r ON r.media_id=m.id AND r.version=1 WHERE p.id=? AND t.id=? AND m.upload_key=? AND ${teamFilter} AND ${guard.sql} LIMIT 1`, [...guard.params, projectId, teamId, key, ...guard.params]))[0];
}
function checkReceipt(row: Row, hash: string, userId: number) { if (String(row.upload_request_hash ?? row.request_hash) !== hash || Number(row.created_by) !== userId) throw new ProjectMediaError("CONFLICT"); }
async function stageFile(viewer: ProjectViewer, projectId: number, teamId: number, key: string, size: number, hash: string) {
  const guard = editable(viewer), at = new Date().toISOString(), expiry = new Date(Date.now() + 3600000).toISOString();
  await query(`INSERT INTO project_media_upload_staging(object_key,project_id,team_id,actor_id,content_hash,file_size_bytes,state,staging_expires_at,created_at) SELECT ?,p.id,t.id,u.id,?,?,'staged',?,? ${source} WHERE p.id=? AND t.id=? AND ${teamFilter} AND ${guard.sql}`, [key, hash, size, expiry, at, projectId, teamId, ...guard.params]);
  if (!(await query("SELECT object_key FROM project_media_upload_staging WHERE object_key=? AND state='staged'", [key])).length) missing();
}
async function failedFile(key: string) {
  // Recovery evidence remains durable. Never automatically destroy Native upload bytes.
  await query("UPDATE project_media_upload_staging SET state='failed' WHERE object_key=? AND state='staged' AND NOT EXISTS(SELECT 1 FROM project_media_items m WHERE m.file_path=project_media_upload_staging.object_key)", [key]);
  if (isHostedRuntime()) await deleteUnreferencedObject(key).catch(() => undefined);
}
export async function createProjectMedia(viewer: ProjectViewer, projectId: number, teamId: number, input: MediaFields & { file: File; mutationKey: string }): Promise<ProjectMediaItem> {
  await assertTeam(viewer, projectId, teamId, true);
  const userId = actor(viewer), fields = normalizeMediaFields({ title: input.title, caption: input.caption, visibility: input.visibility }), token = mediaMutationKey(input.mutationKey);
  const maximum = Math.min(MEDIA_VIDEO_MAX_BYTES, getRuntimeEnv().uploadMaxFileSizeMb * 1024 * 1024);
  if (!(input.file instanceof File) || input.file.size < 1) throw new ProjectMediaError("INVALID_INPUT");
  if (input.file.size > maximum) throw new ProjectMediaError("TOO_LARGE");
  const bytes = new Uint8Array(await input.file.arrayBuffer()), mime = validateMediaBytes(bytes, input.file.type, maximum), contentHash = createHash("sha256").update(bytes).digest("hex");
  validateMediaFileName(input.file.name, mime);
  const hash = digest({ fields, contentHash, bytes: input.file.size, mime, name: input.file.name });
  const old = await uploadReceipt(viewer, projectId, teamId, token);
  if (old) { checkReceipt(old, hash, userId); return item(old); }
  const stored = await storePrivateFile(input.file, `project-media/${projectId}/${teamId}/${userId}`, { beforeWrite: (key, size, checksum) => stageFile(viewer, projectId, teamId, key, size, checksum), onWriteFailure: failedFile });
  if (isHostedRuntime()) await stageFile(viewer, projectId, teamId, stored.filePath, stored.fileSizeBytes, stored.contentHash).catch(async error => { await deleteUnreferencedObject(stored.filePath).catch(() => undefined); throw error; });
  const guard = editable(viewer), at = new Date().toISOString();
  const lease = isHostedRuntime() ? "AND EXISTS(SELECT 1 FROM file_cleanup_jobs job WHERE job.object_key=stage.object_key AND job.staging_expires_at>?)" : "";
  const statements: QueryStatement[] = [{
    sql: `INSERT INTO project_media_items(project_id,team_id,created_by,title,caption,visibility,file_path,file_name,file_mime_type,file_size_bytes,content_hash,version,mutation_key,upload_key,request_hash,created_at,updated_at) SELECT p.id,t.id,u.id,?,?,?,?,?,?,?,?,1,?,?,?,?,? ${source} JOIN project_media_upload_staging stage ON stage.project_id=p.id AND stage.team_id=t.id AND stage.actor_id=u.id WHERE p.id=? AND t.id=? AND ${teamFilter} AND ${guard.sql} AND stage.object_key=? AND stage.state='staged' AND stage.content_hash=? AND stage.file_size_bytes=? AND stage.staging_expires_at>? ${lease}`,
    params: [fields.title, fields.caption, fields.visibility, stored.filePath, stored.fileName, mime, stored.fileSizeBytes, contentHash, token, token, hash, at, at, projectId, teamId, ...guard.params, stored.filePath, contentHash, stored.fileSizeBytes, at, ...(isHostedRuntime() ? [at] : [])],
  }, {
    sql: `INSERT INTO project_media_revisions(media_id,project_id,team_id,version,title,caption,visibility,changed_by,changed_at,mutation_key,request_hash) SELECT m.id,m.project_id,m.team_id,1,m.title,m.caption,m.visibility,u.id,m.updated_at,m.mutation_key,m.request_hash ${mediaSource} WHERE p.id=? AND t.id=? AND m.file_path=? AND m.mutation_key=? AND ${guard.sql}`,
    params: [projectId, teamId, stored.filePath, token, ...guard.params],
  }, {
    sql: "INSERT INTO project_media_revisions(media_id,project_id,team_id,version,title,caption,visibility,changed_by,changed_at,mutation_key,request_hash) SELECT m.id,m.project_id,m.team_id,NULL,m.title,m.caption,m.visibility,m.created_by,m.updated_at,m.mutation_key,m.request_hash FROM project_media_items m WHERE m.file_path=? AND NOT EXISTS(SELECT 1 FROM project_media_revisions r WHERE r.media_id=m.id AND r.version=1)", params: [stored.filePath],
  }, { sql: "UPDATE project_media_upload_staging SET state='attached' WHERE object_key=? AND EXISTS(SELECT 1 FROM project_media_items m WHERE m.file_path=project_media_upload_staging.object_key)", params: [stored.filePath] }];
  try { await databaseBatch(statements); }
  catch {
    // Resolve uncertain outcomes before cleanup; the same token may already be committed.
    const receipt = await uploadReceipt(viewer, projectId, teamId, token);
    if (receipt) { checkReceipt(receipt, hash, userId); if (String(receipt.file_path) !== stored.filePath) await failedFile(stored.filePath); return item(receipt); }
    await failedFile(stored.filePath); await assertTeam(viewer, projectId, teamId, true); throw new ProjectMediaError("UNAVAILABLE");
  }
  const receipt = await uploadReceipt(viewer, projectId, teamId, token);
  if (!receipt) { await failedFile(stored.filePath); await assertTeam(viewer, projectId, teamId, true); throw new ProjectMediaError("CONFLICT"); }
  checkReceipt(receipt, hash, userId); return item(receipt);
}
export async function updateProjectMedia(viewer: ProjectViewer, projectId: number, teamId: number, id: number, input: MediaFields & { version: number; mutationKey: string }): Promise<ProjectMediaItem> {
  await assertTeam(viewer, projectId, teamId, true); mediaId(id);
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new ProjectMediaError("INVALID_INPUT");
  const fields = normalizeMediaFields({ title: input.title, caption: input.caption, visibility: input.visibility }), token = mediaMutationKey(input.mutationKey), hash = digest({ fields, version: input.version }), guard = editable(viewer), userId = actor(viewer), at = new Date().toISOString();
  const receipt = async () => (await query(`SELECT r.request_hash,r.changed_by ${mediaSource} JOIN project_media_revisions r ON r.media_id=m.id WHERE m.id=? AND p.id=? AND t.id=? AND r.mutation_key=? AND ${guard.sql} LIMIT 1`, [id, projectId, teamId, token, ...guard.params]))[0];
  const check = (row: Row) => { if (row.request_hash !== hash || Number(row.changed_by) !== userId) throw new ProjectMediaError("CONFLICT"); };
  const previous = await receipt(); if (previous) { check(previous); return getProjectMediaForViewer(viewer, projectId, teamId, id); }
  const noReceipt = "NOT EXISTS(SELECT 1 FROM project_media_revisions r WHERE r.media_id=project_media_items.id AND r.mutation_key=?)";
  await databaseBatch([{ sql: `UPDATE project_media_items SET title=?,caption=?,visibility=?,version=version+1,mutation_key=?,request_hash=?,updated_at=? WHERE id=? AND project_id=? AND team_id=? AND version=? AND ${noReceipt} AND EXISTS(SELECT 1 ${source} WHERE p.id=project_media_items.project_id AND t.id=project_media_items.team_id AND ${teamFilter} AND ${guard.sql})`, params: [fields.title, fields.caption, fields.visibility, token, hash, at, id, projectId, teamId, input.version, token, ...guard.params] }, {
    sql: `INSERT INTO project_media_revisions(media_id,project_id,team_id,version,title,caption,visibility,changed_by,changed_at,mutation_key,request_hash) SELECT m.id,m.project_id,m.team_id,m.version,m.title,m.caption,m.visibility,u.id,m.updated_at,m.mutation_key,m.request_hash ${mediaSource} WHERE m.id=? AND p.id=? AND t.id=? AND m.version=? AND m.mutation_key=? AND ${guard.sql} AND NOT EXISTS(SELECT 1 FROM project_media_revisions r WHERE r.media_id=m.id AND r.mutation_key=?)`, params: [id, projectId, teamId, input.version + 1, token, ...guard.params, token],
  }, { sql: "INSERT INTO project_media_revisions(media_id,project_id,team_id,version,title,caption,visibility,changed_by,changed_at,mutation_key,request_hash) SELECT m.id,m.project_id,m.team_id,NULL,m.title,m.caption,m.visibility,?,m.updated_at,m.mutation_key,m.request_hash FROM project_media_items m WHERE m.id=? AND m.version=? AND m.mutation_key=? AND NOT EXISTS(SELECT 1 FROM project_media_revisions r WHERE r.media_id=m.id AND r.mutation_key=?)", params: [userId, id, input.version + 1, token, token] }]).catch(async () => { const saved = await receipt(); if (saved) return; await assertTeam(viewer, projectId, teamId, true); throw new ProjectMediaError("CONFLICT"); });
  const saved = await receipt(); if (!saved) { await assertTeam(viewer, projectId, teamId, true); throw new ProjectMediaError("CONFLICT"); } check(saved);
  return getProjectMediaForViewer(viewer, projectId, teamId, id);
}
