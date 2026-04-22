import { getDatabasePool } from "@/lib/db";
import { getTaskById } from "@/lib/repositories/task-repository";
import { getUserById } from "@/lib/repositories/user-repository";
import { mapSubmissionRow, type Submission, type SubmissionRow } from "@/models/submission";

export type CreateSubmissionInput = {
  taskId: number;
  authorId: number;
  content: string;
  filePath?: string | null;
};

export type UpdateSubmissionInput = {
  id: number;
  content: string;
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

export async function getSubmissionById(id: number): Promise<Submission | null> {
  const rows = (await getDatabasePool().query(
    `SELECT
      submissions.id,
      submissions.task_id,
      submissions.author_id,
      users.name AS author_name,
      users.email AS author_email,
      submissions.content,
      submissions.file_path,
      submissions.created_at
    FROM submissions
    INNER JOIN users ON users.id = submissions.author_id
    WHERE submissions.id = ?
    LIMIT 1`,
    [id],
  )) as SubmissionRow[];

  const row = rows[0];

  return row ? mapSubmissionRow(row) : null;
}

export async function listSubmissionsByProject(projectId: number): Promise<Submission[]> {
  const rows = (await getDatabasePool().query(
    `SELECT
      submissions.id,
      submissions.task_id,
      submissions.author_id,
      users.name AS author_name,
      users.email AS author_email,
      submissions.content,
      submissions.file_path,
      submissions.created_at
    FROM submissions
    INNER JOIN tasks ON tasks.id = submissions.task_id
    INNER JOIN users ON users.id = submissions.author_id
    WHERE tasks.project_id = ?
    ORDER BY submissions.created_at DESC, submissions.id DESC`,
    [projectId],
  )) as SubmissionRow[];

  return rows.map(mapSubmissionRow);
}

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  await Promise.all([ensureTaskExists(input.taskId), ensureAuthorExists(input.authorId)]);

  const result = (await getDatabasePool().query(
    "INSERT INTO submissions (task_id, author_id, content, file_path) VALUES (?, ?, ?, ?)",
    [input.taskId, input.authorId, normalizeContent(input.content), input.filePath ?? null],
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

  await getDatabasePool().query("UPDATE submissions SET content = ? WHERE id = ?", [normalizeContent(input.content), input.id]);

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