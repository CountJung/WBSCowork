import { getDatabasePool } from "@/lib/db";
import { getSubmissionById } from "@/lib/repositories/submission-repository";
import { getUserById } from "@/lib/repositories/user-repository";
import { mapCommentRow, type Comment, type CommentRow } from "@/models/comment";

export type CreateCommentInput = {
  submissionId: number;
  authorId: number;
  content: string;
};

export type UpdateCommentInput = {
  id: number;
  content: string;
};

function normalizeContent(content: string) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("댓글 내용은 비워 둘 수 없습니다.");
  }

  return normalizedContent;
}

async function ensureSubmissionExists(submissionId: number) {
  const submission = await getSubmissionById(submissionId);

  if (!submission) {
    throw new Error("대상 제출물을 찾을 수 없습니다.");
  }

  return submission;
}

async function ensureAuthorExists(authorId: number) {
  const author = await getUserById(authorId);

  if (!author) {
    throw new Error("댓글 작성자 정보를 찾을 수 없습니다.");
  }

  return author;
}

export async function getCommentById(id: number): Promise<Comment | null> {
  const rows = (await getDatabasePool().query(
    `SELECT
      comments.id,
      comments.submission_id,
      comments.author_id,
      users.name AS author_name,
      users.email AS author_email,
      comments.content,
      comments.created_at
    FROM comments
    INNER JOIN users ON users.id = comments.author_id
    WHERE comments.id = ?
    LIMIT 1`,
    [id],
  )) as CommentRow[];

  const row = rows[0];

  return row ? mapCommentRow(row) : null;
}

export async function listCommentsByProject(projectId: number): Promise<Comment[]> {
  const rows = (await getDatabasePool().query(
    `SELECT
      comments.id,
      comments.submission_id,
      comments.author_id,
      users.name AS author_name,
      users.email AS author_email,
      comments.content,
      comments.created_at
    FROM comments
    INNER JOIN submissions ON submissions.id = comments.submission_id
    INNER JOIN tasks ON tasks.id = submissions.task_id
    INNER JOIN users ON users.id = comments.author_id
    WHERE tasks.project_id = ?
    ORDER BY comments.created_at ASC, comments.id ASC`,
    [projectId],
  )) as CommentRow[];

  return rows.map(mapCommentRow);
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  await Promise.all([ensureSubmissionExists(input.submissionId), ensureAuthorExists(input.authorId)]);

  const result = (await getDatabasePool().query(
    "INSERT INTO comments (submission_id, author_id, content) VALUES (?, ?, ?)",
    [input.submissionId, input.authorId, normalizeContent(input.content)],
  )) as {
    insertId: number;
  };

  const comment = await getCommentById(Number(result.insertId));

  if (!comment) {
    throw new Error("댓글을 생성했지만 결과를 다시 불러오지 못했습니다.");
  }

  return comment;
}

export async function updateComment(input: UpdateCommentInput): Promise<Comment> {
  const existingComment = await getCommentById(input.id);

  if (!existingComment) {
    throw new Error("수정할 댓글을 찾을 수 없습니다.");
  }

  await getDatabasePool().query("UPDATE comments SET content = ? WHERE id = ?", [normalizeContent(input.content), input.id]);

  const updatedComment = await getCommentById(input.id);

  if (!updatedComment) {
    throw new Error("댓글을 수정했지만 결과를 다시 불러오지 못했습니다.");
  }

  return updatedComment;
}

export async function deleteComment(commentId: number): Promise<Comment> {
  const existingComment = await getCommentById(commentId);

  if (!existingComment) {
    throw new Error("삭제할 댓글을 찾을 수 없습니다.");
  }

  await getDatabasePool().query("DELETE FROM comments WHERE id = ?", [commentId]);

  return existingComment;
}