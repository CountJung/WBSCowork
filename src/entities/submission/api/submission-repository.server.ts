import type { StoredSubmissionAttachment } from "./submission-files.server";
import type { SubmissionActor } from "../model/submission-revision";
import { buildSubmissionVisibilityWhere, commitSubmissionCreation, commitSubmissionRevision } from "./submission-revision.server";
export { buildSubmissionVisibilityWhere } from "./submission-revision.server";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { mapSubmissionRow, type Submission, type SubmissionRow, type SubmissionVisibility } from "../model/submission";

/**
 * 제출물 조회 시 역할별 공개 범위 필터 옵션
 * - canSeeAll=true (슈퍼관리자/관리자): 모든 제출물
 * - canSeeAll=false, viewerUserId 또는 viewerEmail 있음: 공개 제출물 + 본인 비공개 제출물
 * - canSeeAll=false, 뷰어 식별자 없음: 공개 제출물만
 *
 * `viewerUserId`는 DB 사용자 id를 이미 조회한 화면 경로용이고, `viewerEmail`은 세션 이메일만
 * 가진 route handler 경로용이다. 둘 다 주면 어느 한쪽만 맞아도 본인 제출물로 본다.
 */
export type SubmissionVisibilityFilter = {
  canSeeAll: boolean;
  viewerUserId?: number | null;
  viewerEmail?: string | null;
};

export type CreateSubmissionInput = {
  actor: SubmissionActor;
  token: string;
  materialUrl?: string;
  changeSummary?: string;
  taskId: number;
  authorId: number;
  content: string;
  visibility?: SubmissionVisibility;
  filePath?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
};

export type UpdateSubmissionInput = {
  actor: SubmissionActor;
  token: string;
  expectedRevision: number;
  materialUrl?: string;
  changeSummary?: string;
  removeAttachmentIds?: number[];
  id: number;
  content: string;
  visibility?: SubmissionVisibility;
  filePath?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  replaceAttachment?: boolean;
};

const submissionSelectColumns = `
      submissions.id,
      submissions.task_id,
      submissions.author_id,
      users.name AS author_name,
      users.email AS author_email,
      submissions.content,
      submissions.current_revision,
      submissions.version,
      submissions.material_url,
      COALESCE(submissions.visibility, 'public') AS visibility,
      submissions.file_path,
      submissions.file_name,
      submissions.file_mime_type,
      submissions.file_size_bytes,
      submissions.created_at`;

/**
 * 정책이 적용되지 않은 단건 조회.
 *
 * 공개 범위를 확인하지 않으므로 이미 actor 권한을 검증한 mutation 경로에서만 쓴다.
 * 뷰어에게 자원을 노출하는 경로(다운로드, 상세 조회)는 `getSubmissionByIdForViewer`를 사용한다.
 */
export async function getSubmissionById(id: number): Promise<Submission | null> {
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN users ON users.id = submissions.author_id
    WHERE submissions.id = ?
    LIMIT 1`,
    [id],
  )) as SubmissionRow[];

  const row = rows[0];

  return row ? mapSubmissionRow(row) : null;
}

/**
 * 뷰어 공개 범위를 질의에 적용한 단건 조회.
 *
 * 볼 수 없는 제출물은 "없음"과 같은 null로 돌아오므로 호출부가 자원 존재 여부를 구분해 노출하지 않는다.
 */
export async function getSubmissionByIdForViewer(
  id: number,
  filter: SubmissionVisibilityFilter,
): Promise<Submission | null> {
  const { clause, params } = buildSubmissionVisibilityWhere(filter, { revisionAlias: "visible_revision" });
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN users ON users.id = submissions.author_id
    INNER JOIN submission_revisions visible_revision ON visible_revision.submission_id = submissions.id AND visible_revision.revision_number = submissions.current_revision
    WHERE submissions.id = ? ${clause}
    LIMIT 1`,
    [id, ...params],
  )) as SubmissionRow[];

  const row = rows[0];

  return row ? mapSubmissionRow(row) : null;
}

export async function listSubmissionsByProject(
  projectId: number,
  filter: SubmissionVisibilityFilter,
): Promise<Submission[]> {
  const { clause, params } = buildSubmissionVisibilityWhere(filter, { revisionAlias: "visible_revision" });
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN tasks ON tasks.id = submissions.task_id
    INNER JOIN users ON users.id = submissions.author_id
    INNER JOIN submission_revisions visible_revision ON visible_revision.submission_id = submissions.id AND visible_revision.revision_number = submissions.current_revision
    WHERE tasks.project_id = ? ${clause}
    ORDER BY submissions.created_at DESC, submissions.id DESC`,
    [projectId, ...params],
  )) as SubmissionRow[];

  return rows.map(mapSubmissionRow);
}

export async function listSubmissionsByTask(
  taskId: number,
  filter: SubmissionVisibilityFilter,
): Promise<Submission[]> {
  const { clause, params } = buildSubmissionVisibilityWhere(filter, { revisionAlias: "visible_revision" });
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN users ON users.id = submissions.author_id
    INNER JOIN submission_revisions visible_revision ON visible_revision.submission_id = submissions.id AND visible_revision.revision_number = submissions.current_revision
    WHERE submissions.task_id = ? ${clause}
    ORDER BY submissions.created_at DESC, submissions.id DESC`,
    [taskId, ...params],
  )) as SubmissionRow[];

  return rows.map(mapSubmissionRow);
}

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  const result = await commitSubmissionCreation(input, []);
  const submission = await getSubmissionById(result.submissionId);
  if (!submission) throw new Error("제출물을 생성했지만 결과를 다시 불러오지 못했습니다.");
  return submission;
}

export async function updateSubmission(input: UpdateSubmissionInput): Promise<Submission> {
  const result = await commitSubmissionRevision(input, []);
  const submission = await getSubmissionById(result.submissionId);
  if (!submission) throw new Error("제출물을 수정했지만 결과를 다시 불러오지 못했습니다.");
  return submission;
}

export async function deleteSubmission(submissionId: number): Promise<Submission> {
  const existingSubmission = await getSubmissionById(submissionId);

  if (!existingSubmission) {
    throw new Error("삭제할 제출물을 찾을 수 없습니다.");
  }

  await getDatabasePool().query("DELETE FROM submissions WHERE id = ?", [submissionId]);

  return existingSubmission;
}


/** Bytes are staged first; parent, revision, attachments, and event commit atomically in both runtimes. */
export async function createSubmissionWithAttachments(input: CreateSubmissionInput, attachments: StoredSubmissionAttachment[]): Promise<number> {
  return (await commitSubmissionCreation(input, attachments)).submissionId;
}

export async function updateSubmissionWithAttachments(input: UpdateSubmissionInput, attachments: StoredSubmissionAttachment[]): Promise<void> {
  await commitSubmissionRevision(input, attachments);
}
