import { getDatabasePool } from "@/lib/db";
import { getTaskById } from "@/lib/repositories/task-repository";
import { getUserById } from "@/lib/repositories/user-repository";
import { mapSubmissionRow, type Submission, type SubmissionRow, type SubmissionVisibility } from "@/models/submission";

/**
 * 제출물 목록 조회 시 역할별 공개 범위 필터 옵션
 * - canSeeAll=true (슈퍼관리자/관리자): 모든 제출물
 * - canSeeAll=false, viewerUserId 있음: 공개 제출물 + 본인 비공개 제출물
 * - canSeeAll=false, viewerUserId 없음: 공개 제출물만
 */
export type SubmissionVisibilityFilter = {
  canSeeAll: boolean;
  viewerUserId?: number | null;
};

export type CreateSubmissionInput = {
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
  id: number;
  content: string;
  visibility?: SubmissionVisibility;
  filePath?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  replaceAttachment?: boolean;
};

function normalizeContent(content: string) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("제출 내용은 비워 둘 수 없습니다.");
  }

  return normalizedContent;
}

async function ensureTaskExists(taskId: number) {
  const task = await getTaskById(taskId);

  if (!task) {
    throw new Error("대상 작업을 찾을 수 없습니다.");
  }

  return task;
}

async function ensureAuthorExists(authorId: number) {
  const author = await getUserById(authorId);

  if (!author) {
    throw new Error("제출 작성자 정보를 찾을 수 없습니다.");
  }

  return author;
}

const submissionSelectColumns = `
      submissions.id,
      submissions.task_id,
      submissions.author_id,
      users.name AS author_name,
      users.email AS author_email,
      submissions.content,
      COALESCE(submissions.visibility, 'public') AS visibility,
      submissions.file_path,
      submissions.file_name,
      submissions.file_mime_type,
      submissions.file_size_bytes,
      submissions.created_at`;

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

function buildVisibilityWhere(filter: SubmissionVisibilityFilter): { clause: string; params: unknown[] } {
  if (filter.canSeeAll) {
    return { clause: "", params: [] };
  }

  if (filter.viewerUserId) {
    return {
      clause: "AND (submissions.visibility = 'public' OR submissions.author_id = ?)",
      params: [filter.viewerUserId],
    };
  }

  return { clause: "AND submissions.visibility = 'public'", params: [] };
}

export async function listSubmissionsByProject(
  projectId: number,
  filter: SubmissionVisibilityFilter = { canSeeAll: true },
): Promise<Submission[]> {
  const { clause, params } = buildVisibilityWhere(filter);
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN tasks ON tasks.id = submissions.task_id
    INNER JOIN users ON users.id = submissions.author_id
    WHERE tasks.project_id = ? ${clause}
    ORDER BY submissions.created_at DESC, submissions.id DESC`,
    [projectId, ...params],
  )) as SubmissionRow[];

  return rows.map(mapSubmissionRow);
}

export async function listSubmissionsByTask(
  taskId: number,
  filter: SubmissionVisibilityFilter = { canSeeAll: true },
): Promise<Submission[]> {
  const { clause, params } = buildVisibilityWhere(filter);
  const rows = (await getDatabasePool().query(
    `SELECT
      ${submissionSelectColumns}
    FROM submissions
    INNER JOIN users ON users.id = submissions.author_id
    WHERE submissions.task_id = ? ${clause}
    ORDER BY submissions.created_at DESC, submissions.id DESC`,
    [taskId, ...params],
  )) as SubmissionRow[];

  return rows.map(mapSubmissionRow);
}

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  await Promise.all([ensureTaskExists(input.taskId), ensureAuthorExists(input.authorId)]);

  const result = (await getDatabasePool().query(
    `INSERT INTO submissions (
      task_id,
      author_id,
      content,
      visibility,
      file_path,
      file_name,
      file_mime_type,
      file_size_bytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.taskId,
      input.authorId,
      normalizeContent(input.content),
      input.visibility ?? "public",
      input.filePath ?? null,
      input.fileName ?? null,
      input.fileMimeType ?? null,
      input.fileSizeBytes ?? null,
    ],
  )) as {
    insertId: number;
  };

  const submission = await getSubmissionById(Number(result.insertId));

  if (!submission) {
    throw new Error("제출물을 생성했지만 결과를 다시 불러오지 못했습니다.");
  }

  return submission;
}

export async function updateSubmission(input: UpdateSubmissionInput): Promise<Submission> {
  const existingSubmission = await getSubmissionById(input.id);

  if (!existingSubmission) {
    throw new Error("수정할 제출물을 찾을 수 없습니다.");
  }

  const nextFilePath = input.replaceAttachment ? input.filePath ?? null : existingSubmission.filePath;
  const nextFileName = input.replaceAttachment ? input.fileName ?? null : existingSubmission.fileName;
  const nextFileMimeType = input.replaceAttachment ? input.fileMimeType ?? null : existingSubmission.fileMimeType;
  const nextFileSizeBytes = input.replaceAttachment ? input.fileSizeBytes ?? null : existingSubmission.fileSizeBytes;

  const nextVisibility: SubmissionVisibility = input.visibility ?? existingSubmission.visibility ?? "public";

  await getDatabasePool().query(
    `UPDATE submissions
     SET content = ?, visibility = ?, file_path = ?, file_name = ?, file_mime_type = ?, file_size_bytes = ?
     WHERE id = ?`,
    [normalizeContent(input.content), nextVisibility, nextFilePath, nextFileName, nextFileMimeType, nextFileSizeBytes, input.id],
  );

  const updatedSubmission = await getSubmissionById(input.id);

  if (!updatedSubmission) {
    throw new Error("제출물을 수정했지만 결과를 다시 불러오지 못했습니다.");
  }

  return updatedSubmission;
}

export async function deleteSubmission(submissionId: number): Promise<Submission> {
  const existingSubmission = await getSubmissionById(submissionId);

  if (!existingSubmission) {
    throw new Error("삭제할 제출물을 찾을 수 없습니다.");
  }

  await getDatabasePool().query("DELETE FROM submissions WHERE id = ?", [submissionId]);

  return existingSubmission;
}