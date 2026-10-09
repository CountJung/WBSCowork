import { createHash } from "node:crypto";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { getHostedAttachments, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { validateObjectKey } from "@/src/shared/server/object-cleanup/index.server";
import {
  normalizeSubmissionMaterialUrl,
  submissionOperationToken,
  submissionRevisionNumber,
  type SubmissionActor,
  type SubmissionEvent,
  type SubmissionRevision,
} from "../model/submission-revision";
import type { SubmissionVisibility } from "../model/submission";
import type { StoredSubmissionAttachment } from "./submission-files.server";
import type { CreateSubmissionInput, SubmissionVisibilityFilter, UpdateSubmissionInput } from "./submission-repository.server";
import { submissionReviewInvalidationStatements } from "./submission-review.server";

type MutationResult = { submissionId: number; revisionNumber: number };
type Operation = MutationResult & { request_fingerprint: string };
type LegacyFile = {
  filePath: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
};
type CurrentSubmission = {
  id: number;
  task_id: number;
  author_id: number;
  current_revision: number;
  content: string;
  visibility: SubmissionVisibility;
  material_url: string;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
};

const staleMessage = "다른 변경이 먼저 저장되었거나 권한이 변경되었습니다. 새로고침 후 다시 확인해 주세요.";
const replayMessage = "같은 요청 식별자를 다른 내용에 사용할 수 없습니다.";

function positiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} 식별자가 올바르지 않습니다.`);
  return value;
}

function normalizeContent(value: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error("제출 내용은 비워 둘 수 없습니다.");
  const content = value.trim();
  if (content.length > 20_000) throw new Error("제출 내용은 20,000자 이하로 입력해 주세요.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) throw new Error("제출 내용에 사용할 수 없는 제어 문자가 있습니다.");
  return content;
}

function normalizeSummary(value?: string) {
  if (value !== undefined && typeof value !== "string") throw new Error("변경 요약이 올바르지 않습니다.");
  const summary = value?.trim() ?? "";
  if (summary.length > 2000) throw new Error("변경 요약은 2000자 이하로 입력해 주세요.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value ?? "")) throw new Error("변경 요약에 사용할 수 없는 제어 문자가 있습니다.");
  return summary;
}

function normalizeVisibility(value: SubmissionVisibility | undefined) {
  if (value !== undefined && value !== "public" && value !== "private") throw new Error("제출물 공개 범위가 올바르지 않습니다.");
  return value;
}

function normalizeLegacyFile(input: Partial<LegacyFile>): LegacyFile {
  if (!input.filePath) return { filePath: null, fileName: null, fileMimeType: null, fileSizeBytes: null };
  validateObjectKey(input.filePath);
  if (!input.fileName || !input.fileMimeType || !Number.isSafeInteger(input.fileSizeBytes) || Number(input.fileSizeBytes) < 0) {
    throw new Error("기존 첨부파일 정보가 올바르지 않습니다.");
  }
  return {
    filePath: input.filePath,
    fileName: input.fileName,
    fileMimeType: input.fileMimeType,
    fileSizeBytes: Number(input.fileSizeBytes),
  };
}

/** Stable bytes/metadata identify an upload; generated storage keys never identify the request. */
export function submissionAttachmentFingerprint(attachments: StoredSubmissionAttachment[]) {
  if (attachments.length > 20) throw new Error("한 번에 첨부파일은 20개까지 등록할 수 있습니다.");
  return attachments.map((file) => {
    validateObjectKey(file.filePath);
    if (!file.fileName || !file.fileMimeType || !Number.isSafeInteger(file.fileSizeBytes) || file.fileSizeBytes <= 0 || !/^[a-f0-9]{64}$/i.test(file.contentHash)) {
      throw new Error("업로드 첨부파일의 내용 확인 정보가 올바르지 않습니다.");
    }
    return { fileName: file.fileName, fileMimeType: file.fileMimeType, fileSizeBytes: file.fileSizeBytes, contentHash: file.contentHash.toLowerCase() };
  });
}

function fingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function assertActor(actor: SubmissionActor): Promise<SubmissionActor> {
  if (!actor) throw new Error("제출물을 변경할 사용자 정보가 필요합니다.");
  positiveId(actor.userId, "사용자");
  const rows = await getDatabasePool().query("SELECT role FROM users WHERE id=? LIMIT 1", [actor.userId]) as { role: string }[];
  const role = rows[0]?.role;
  if (!role || (!actor.isSuperuser && role !== "member" && role !== "admin")) throw new Error("제출물 작성 권한이 없습니다.");
  return { userId: actor.userId, isAdmin: role === "admin", isSuperuser: Boolean(actor.isSuperuser) };
}

/** Current database role, not a cached isAdmin claim, decides authorization inside the mutation. */
function actorGuard(actor: SubmissionActor, authorExpression: string, authorParams: unknown[] = []) {
  return {
    sql: `(?=1 OR EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND actor.role IN ('member','admin'))) AND (${authorExpression}=? OR ?=1 OR EXISTS(SELECT 1 FROM users administrator WHERE administrator.id=? AND administrator.role='admin'))`,
    params: [actor.isSuperuser ? 1 : 0, actor.userId, ...authorParams, actor.userId, actor.isSuperuser ? 1 : 0, actor.userId],
  };
}

async function findOperation(key: string, actor: SubmissionActor): Promise<Operation | undefined> {
  const access = actorGuard(actor, "s.author_id");
  const rows = await getDatabasePool().query(
    `SELECT e.submission_id,e.revision_number,e.request_fingerprint FROM submission_events e JOIN submissions s ON s.id=e.submission_id WHERE e.operation_token=? AND e.actor_id=? AND ${access.sql} LIMIT 1`,
    [key, actor.userId, ...access.params],
  ) as { submission_id: number; revision_number: number; request_fingerprint: string }[];
  const row = rows[0];
  return row ? { submissionId: Number(row.submission_id), revisionNumber: Number(row.revision_number), request_fingerprint: row.request_fingerprint } : undefined;
}

function assertMatchingOperation(operation: Operation, requestFingerprint: string): MutationResult {
  if (operation.request_fingerprint !== requestFingerprint) throw new Error(replayMessage);
  return { submissionId: operation.submissionId, revisionNumber: operation.revisionNumber };
}

async function confirmOperation(key: string, actor: SubmissionActor, requestFingerprint: string) {
  const saved = await findOperation(key, actor);
  if (!saved) throw new Error(staleMessage);
  return assertMatchingOperation(saved, requestFingerprint);
}

function pendingOperationWhere(key: string) {
  return {
    sql: "s.last_operation_token=? AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)",
    params: [key, key],
  };
}

/** The cleanup worker only removes expired staging objects. Check the lease at SQL execution time. */
function stagingLeaseGuard(attachments: StoredSubmissionAttachment[]) {
  if (!isHostedRuntime() || !attachments.length) return { sql: "", params: [] as unknown[] };
  return {
    sql: attachments.map(() => " AND EXISTS(SELECT 1 FROM file_cleanup_jobs staged WHERE staged.object_key=? AND staged.staging_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))").join(""),
    params: attachments.map((file) => file.filePath),
  };
}

function legacyReferenceGuard(filePath:string|null) {
  if(!isHostedRuntime()||!filePath)return {sql:"",params:[] as unknown[]};
  // A legacy pointer may reuse a live file or a currently staged upload, never
  // introduce a reference after cleanup permanently revoked its eligibility.
  return {sql:" AND (EXISTS(SELECT 1 FROM file_cleanup_jobs staged WHERE staged.object_key=? AND staged.staging_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')) OR EXISTS(SELECT 1 FROM submissions live_parent WHERE live_parent.file_path=? UNION ALL SELECT 1 FROM submission_attachments live_file WHERE live_file.file_path=? UNION ALL SELECT 1 FROM submission_revisions live_revision WHERE live_revision.file_path=?))",params:[filePath,filePath,filePath,filePath]};
}

async function assertUploadedObjects(attachments: StoredSubmissionAttachment[]) {
  if (!isHostedRuntime()) return;
  const objects = await Promise.all(attachments.map((file) => getHostedAttachments().head(file.filePath)));
  if (objects.some((object, index) => !object || object.size !== attachments[index].fileSizeBytes)) {
    throw new Error("업로드 파일을 확인할 수 없습니다. 파일을 다시 선택해 주세요.");
  }
}

function revisionInsert(key: string, actor: SubmissionActor, changeSummary: string): QueryStatement {
  const pending = pendingOperationWhere(key);
  return {
    sql: `INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,material_url,change_summary,file_path,file_name,file_mime_type,file_size_bytes,source) SELECT s.id,s.current_revision,?,s.content,s.visibility,s.material_url,?,s.file_path,s.file_name,s.file_mime_type,s.file_size_bytes,'live' FROM submissions s WHERE ${pending.sql}`,
    params: [actor.userId, changeSummary, ...pending.params],
  };
}

function attachmentInserts(key: string, attachments: StoredSubmissionAttachment[]): QueryStatement[] {
  const pending = pendingOperationWhere(key);
  return attachments.map((file) => ({
    sql: `INSERT INTO submission_attachments(submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) SELECT s.id,s.current_revision,?,?,?,? FROM submissions s WHERE ${pending.sql}`,
    params: [file.filePath, file.fileName, file.fileMimeType, file.fileSizeBytes, ...pending.params],
  }));
}

function eventInsert(key: string, actor: SubmissionActor, requestFingerprint: string, kind: "created" | "revised", body: string): QueryStatement {
  const pending = pendingOperationWhere(key);
  return {
    sql: `INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body) SELECT s.id,s.current_revision,?,?,?,?,? FROM submissions s WHERE ${pending.sql}`,
    params: [actor.userId, key, requestFingerprint, kind, body, ...pending.params],
  };
}

export async function commitSubmissionCreation(input: CreateSubmissionInput, attachments: StoredSubmissionAttachment[]): Promise<MutationResult> {
  const actor = await assertActor(input.actor);
  const taskId = positiveId(input.taskId, "작업"), authorId = positiveId(input.authorId, "작성자");
  const key = `${actor.userId}:submission.create:${taskId}:${submissionOperationToken(input.token)}`;
  const content = normalizeContent(input.content), visibility = normalizeVisibility(input.visibility) ?? "public";
  const materialUrl = normalizeSubmissionMaterialUrl(input.materialUrl), changeSummary = normalizeSummary(input.changeSummary);
  const legacy = normalizeLegacyFile(input);
  const requestFingerprint = fingerprint({ taskId, authorId, content, visibility, materialUrl, changeSummary, legacy, attachments: submissionAttachmentFingerprint(attachments) });
  const prior = await findOperation(key, actor);
  if (prior) return assertMatchingOperation(prior, requestFingerprint);
  if (authorId !== actor.userId && !actor.isAdmin && !actor.isSuperuser) throw new Error("다른 사용자의 제출물을 작성할 권한이 없습니다.");
  const [tasks, authors] = await Promise.all([
    getDatabasePool().query("SELECT id FROM tasks WHERE id=? LIMIT 1", [taskId]) as Promise<{ id: number }[]>,
    getDatabasePool().query("SELECT id FROM users WHERE id=? LIMIT 1", [authorId]) as Promise<{ id: number }[]>,
  ]);
  if (!tasks.length) throw new Error("대상 작업을 찾을 수 없습니다.");
  if (!authors.length) throw new Error("제출 작성자 정보를 찾을 수 없습니다.");
  await assertUploadedObjects(attachments);
  const access = actorGuard(actor, "?", [authorId]);
  const lease = stagingLeaseGuard(attachments);
  const legacyGuard=legacyReferenceGuard(legacy.filePath);
  const duplicate = isHostedRuntime() ? " ON CONFLICT(creation_token) DO NOTHING" : " ON DUPLICATE KEY UPDATE id=submissions.id";
  await databaseBatch([
    {
      sql: `INSERT INTO submissions(task_id,author_id,content,visibility,material_url,file_path,file_name,file_mime_type,file_size_bytes,current_revision,version,creation_token,last_operation_token) SELECT ?,?,?,?,?,?,?,?,?,1,1,?,? WHERE ${access.sql} AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)${lease.sql}${legacyGuard.sql}${duplicate}`,
      params: [taskId, authorId, content, visibility, materialUrl, legacy.filePath, legacy.fileName, legacy.fileMimeType, legacy.fileSizeBytes, key, key, ...access.params, key, ...lease.params,...legacyGuard.params],
    },
    revisionInsert(key, actor, changeSummary),
    ...attachmentInserts(key, attachments),
    eventInsert(key, actor, requestFingerprint, "created", changeSummary),
  ]);
  return confirmOperation(key, actor, requestFingerprint);
}

export async function commitSubmissionRevision(input: UpdateSubmissionInput, attachments: StoredSubmissionAttachment[]): Promise<MutationResult> {
  const actor = await assertActor(input.actor);
  const id = positiveId(input.id, "제출물"), expectedRevision = submissionRevisionNumber(input.expectedRevision);
  const key = `${actor.userId}:submission.revise:${id}:${submissionOperationToken(input.token)}`;
  const content = normalizeContent(input.content), visibility = normalizeVisibility(input.visibility);
  const materialUrl = input.materialUrl === undefined ? null : normalizeSubmissionMaterialUrl(input.materialUrl);
  const changeSummary = normalizeSummary(input.changeSummary);
  if (!changeSummary) throw new Error("새 버전의 변경 요약을 입력해 주세요.");
  if (input.removeAttachmentIds !== undefined && !Array.isArray(input.removeAttachmentIds)) throw new Error("제외할 첨부파일 목록이 올바르지 않습니다.");
  if((input.removeAttachmentIds?.length??0)>100)throw new Error("한 번에 제외할 첨부파일은 100개까지입니다.");
  const removeIds = [...new Set((input.removeAttachmentIds ?? []).map((id) => positiveId(id, "첨부파일")))].sort((a, b) => a - b);
  const replacement = input.replaceAttachment ? normalizeLegacyFile(input) : null;
  // Omitted edits stay omitted in the fingerprint even if a later revision changes the projection.
  const requestFingerprint = fingerprint({ id, expectedRevision, content, visibility: visibility ?? null, materialUrl, changeSummary, replacement, removeAttachmentIds: removeIds, attachments: submissionAttachmentFingerprint(attachments) });
  const prior = await findOperation(key, actor);
  if (prior) return assertMatchingOperation(prior, requestFingerprint);

  const rows = await getDatabasePool().query("SELECT id,task_id,author_id,current_revision,content,visibility,material_url,file_path,file_name,file_mime_type,file_size_bytes FROM submissions WHERE id=? LIMIT 1", [id]) as CurrentSubmission[];
  const existing = rows[0];
  if (!existing || (Number(existing.author_id) !== actor.userId && !actor.isAdmin && !actor.isSuperuser)) throw new Error("수정할 제출물을 찾을 수 없거나 권한이 없습니다.");
  if (Number(existing.current_revision) !== expectedRevision) {
    // A concurrent retry may have committed after the first ledger read.
    const concurrent = await findOperation(key, actor);
    if (concurrent) return assertMatchingOperation(concurrent, requestFingerprint);
    throw new Error(staleMessage);
  }
  if (removeIds.length) {
    const files = await getDatabasePool().query("SELECT id FROM submission_attachments WHERE submission_id=? AND revision_number=?", [id, expectedRevision]) as { id: number }[];
    const currentIds = new Set(files.map((file) => Number(file.id)));
    if (removeIds.some((id) => !currentIds.has(id))) throw new Error("현재 버전에 속한 첨부파일만 제외할 수 있습니다.");
  }
  await assertUploadedObjects(attachments);
  const legacy = replacement ?? {
    filePath: existing.file_path, fileName: existing.file_name,
    fileMimeType: existing.file_mime_type, fileSizeBytes: existing.file_size_bytes,
  };
  const access = actorGuard(actor, "submissions.author_id");
  const pending = pendingOperationWhere(key);
  const lease = stagingLeaseGuard(attachments);
  const legacyGuard=legacyReferenceGuard(legacy.filePath);
  // The literal exclusion list is formed only from validated safe positive integers, avoiding D1's 100-bind limit.
  const exclude = removeIds.length ? ` AND previous.id NOT IN (${removeIds.join(",")})` : "";
  await databaseBatch([
    // Every review/revision batch takes the task row before the submission row.
    { sql: "UPDATE tasks SET id=id WHERE id=?", params: [existing.task_id] },
    {
      sql: `UPDATE submissions SET content=?,visibility=?,material_url=?,file_path=?,file_name=?,file_mime_type=?,file_size_bytes=?,current_revision=current_revision+1,version=version+1,last_operation_token=? WHERE id=? AND current_revision=? AND ${access.sql} AND EXISTS(SELECT 1 FROM submission_revisions previous_revision WHERE previous_revision.submission_id=submissions.id AND previous_revision.revision_number=submissions.current_revision) AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)${lease.sql}${legacyGuard.sql}`,
      params: [content, visibility ?? existing.visibility, materialUrl ?? existing.material_url, legacy.filePath, legacy.fileName, legacy.fileMimeType, legacy.fileSizeBytes, key, id, expectedRevision, ...access.params, key, ...lease.params,...legacyGuard.params],
    },
    revisionInsert(key, actor, changeSummary),
    {
      sql: `INSERT INTO submission_attachments(submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) SELECT s.id,s.current_revision,previous.file_path,previous.file_name,previous.file_mime_type,previous.file_size_bytes FROM submissions s JOIN submission_attachments previous ON previous.submission_id=s.id AND previous.revision_number=? WHERE s.id=? AND ${pending.sql}${exclude}`,
      params: [expectedRevision, id, ...pending.params],
    },
    ...attachmentInserts(key, attachments),
    ...submissionReviewInvalidationStatements({
      taskId: Number(existing.task_id), submissionId: id, previousRevision: expectedRevision,
      actorId: actor.userId, sourceOperationKey: key, requestFingerprint,
    }),
    eventInsert(key, actor, requestFingerprint, "revised", changeSummary),
  ]);
  return confirmOperation(key, actor, requestFingerprint);
}

function sqlAlias(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Invalid submission query alias.");
  return value;
}

/** A historical public revision never overrides a currently private parent, or vice versa. */
export function buildSubmissionVisibilityWhere(
  filter: SubmissionVisibilityFilter,
  aliases: { submissionAlias?: string; userAlias?: string; revisionAlias?: string } = {},
): { clause: string; params: unknown[] } {
  const submission = sqlAlias(aliases.submissionAlias ?? "submissions");
  const user = sqlAlias(aliases.userAlias ?? "users");
  const revision = aliases.revisionAlias ? sqlAlias(aliases.revisionAlias) : null;
  if (filter.canSeeAll) return { clause: "", params: [] };
  const conditions = [`(${submission}.visibility='public'${revision ? ` AND ${revision}.visibility='public'` : ""})`];
  const params: unknown[] = [];
  if (filter.viewerUserId) {
    positiveId(filter.viewerUserId, "사용자");
    conditions.push(`${submission}.author_id=?`);
    params.push(filter.viewerUserId);
  }
  const email = filter.viewerEmail?.trim().toLowerCase();
  if (email) {
    conditions.push(`LOWER(${user}.email)=?`);
    params.push(email);
  }
  return { clause: `AND (${conditions.join(" OR ")})`, params };
}

type RevisionRow = {
  id: number; submission_id: number; task_id: number; revision_number: number; editor_id: number | null; editor_name: string | null;
  content: string; visibility: SubmissionVisibility; material_url: string; change_summary: string;
  file_path: string | null; file_name: string | null; file_mime_type: string | null; file_size_bytes: number | null;
  source: "legacy" | "live"; created_at: Date | string;
};

function mapRevision(row: RevisionRow): SubmissionRevision {
  return {
    id: Number(row.id), submissionId: Number(row.submission_id), taskId: Number(row.task_id), revisionNumber: Number(row.revision_number),
    editorId: row.editor_id === null ? null : Number(row.editor_id), editorName: row.editor_name,
    content: row.content, visibility: row.visibility, materialUrl: row.material_url, changeSummary: row.change_summary,
    filePath: row.file_path, fileName: row.file_name, fileMimeType: row.file_mime_type,
    fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes), source: row.source,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

const revisionSelect = `SELECT r.id,r.submission_id,s.task_id,r.revision_number,r.editor_id,editor.name AS editor_name,r.content,r.visibility,r.material_url,r.change_summary,r.file_path,r.file_name,r.file_mime_type,r.file_size_bytes,r.source,r.created_at FROM submission_revisions r JOIN submissions s ON s.id=r.submission_id JOIN users u ON u.id=s.author_id LEFT JOIN users editor ON editor.id=r.editor_id`;

function pageOffset(page: number, pageSize: number) {
  return (Math.max(1, Math.min(1000, Number.isFinite(page) ? Math.trunc(page) : 1)) - 1) * pageSize;
}

export async function getSubmissionRevisionForViewer(submissionId: number, revisionNumber: number, filter: SubmissionVisibilityFilter): Promise<SubmissionRevision | null> {
  positiveId(submissionId, "제출물");
  const scope = buildSubmissionVisibilityWhere(filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
  const rows = await getDatabasePool().query(`${revisionSelect} WHERE s.id=? AND r.revision_number=? ${scope.clause} LIMIT 1`, [submissionId, submissionRevisionNumber(revisionNumber), ...scope.params]) as RevisionRow[];
  return rows[0] ? mapRevision(rows[0]) : null;
}

export async function listSubmissionRevisionsForViewer(submissionId: number, filter: SubmissionVisibilityFilter, page = 1): Promise<SubmissionRevision[]> {
  positiveId(submissionId, "제출물");
  const scope = buildSubmissionVisibilityWhere(filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
  const rows = await getDatabasePool().query(`${revisionSelect} WHERE s.id=? ${scope.clause} ORDER BY r.revision_number DESC LIMIT 20 OFFSET ?`, [submissionId, ...scope.params, pageOffset(page, 20)]) as RevisionRow[];
  return rows.map(mapRevision);
}

export async function listSubmissionEventsForViewer(submissionId: number, filter: SubmissionVisibilityFilter, page = 1): Promise<SubmissionEvent[]> {
  positiveId(submissionId, "제출물");
  const scope = buildSubmissionVisibilityWhere(filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
  const rows = await getDatabasePool().query(
    `SELECT e.id,e.submission_id,e.revision_number,e.actor_id,actor.name AS actor_name,e.kind,e.body,e.created_at FROM submission_events e JOIN submissions s ON s.id=e.submission_id JOIN users u ON u.id=s.author_id JOIN submission_revisions r ON r.submission_id=e.submission_id AND r.revision_number=e.revision_number LEFT JOIN users actor ON actor.id=e.actor_id WHERE s.id=? ${scope.clause} ORDER BY e.id DESC LIMIT 30 OFFSET ?`,
    [submissionId, ...scope.params, pageOffset(page, 30)],
  ) as { id: number; submission_id: number; revision_number: number; actor_id: number | null; actor_name: string | null; kind: string; body: string; created_at: Date | string }[];
  return rows.map((row) => ({
    id: Number(row.id), submissionId: Number(row.submission_id), revisionNumber: Number(row.revision_number),
    actorId: row.actor_id === null ? null : Number(row.actor_id), actorName: row.actor_name, kind: row.kind, body: row.body,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  }));
}

/** Unfiltered file keys are only for already-authorized deletion cleanup before the database cascade. */
export async function listRevisionFilePathsBySubmission(submissionId: number): Promise<string[]> {
  const rows = await getDatabasePool().query("SELECT DISTINCT file_path FROM submission_revisions WHERE submission_id=? AND file_path IS NOT NULL", [positiveId(submissionId, "제출물")]) as { file_path: string }[];
  return rows.map((row) => row.file_path);
}

export async function listRevisionFilePathsByTask(taskId: number): Promise<string[]> {
  const rows = await getDatabasePool().query("SELECT DISTINCT r.file_path FROM submission_revisions r JOIN submissions s ON s.id=r.submission_id WHERE s.task_id=? AND r.file_path IS NOT NULL", [positiveId(taskId, "작업")]) as { file_path: string }[];
  return rows.map((row) => row.file_path);
}

export async function listRevisionFilePathsByProject(projectId: number): Promise<string[]> {
  const rows = await getDatabasePool().query("SELECT DISTINCT r.file_path FROM submission_revisions r JOIN submissions s ON s.id=r.submission_id JOIN tasks t ON t.id=s.task_id WHERE t.project_id=? AND r.file_path IS NOT NULL", [positiveId(projectId, "프로젝트")]) as { file_path: string }[];
  return rows.map((row) => row.file_path);
}
