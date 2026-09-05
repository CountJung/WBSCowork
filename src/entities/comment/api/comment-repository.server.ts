import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { buildIdScopeClause, isEmptyIdScope, type IdScope } from "@/src/shared/server/query-scope/index.server";
import { mapCommentRow, type Comment, type CommentRow } from "../model/comment";

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
  const rows = (await getDatabasePool().query("SELECT id FROM submissions WHERE id = ? LIMIT 1", [submissionId])) as Array<{
    id: number;
  }>;
  const submission = rows[0];

  if (!submission) {
    throw new Error("대상 제출물을 찾을 수 없습니다.");
  }

  return submission;
}

async function ensureAuthorExists(authorId: number) {
  const rows = (await getDatabasePool().query("SELECT id FROM users WHERE id = ? LIMIT 1", [authorId])) as Array<{
    id: number;
  }>;
  const author = rows[0];

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

/**
 * 프로젝트 댓글 목록.
 *
 * 댓글은 부모 제출물의 공개 범위를 그대로 따라야 한다. 이 repository는 제출물 정책을 알지 못하므로
 * 호출부가 뷰어에게 보이는 제출물 id 집합(`{ ids }`)을 넘겨 질의를 bounded 하게 만들어야 하고,
 * 프로젝트 파기처럼 전체가 필요한 관리 경로만 `{ unrestricted: true }`를 명시한다.
 */
export async function listCommentsByProject(projectId: number, scope: IdScope): Promise<Comment[]> {
  if (isEmptyIdScope(scope)) {
    return [];
  }

  const { clause, params } = buildIdScopeClause("comments.submission_id", scope);
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
    WHERE tasks.project_id = ? ${clause}
    ORDER BY comments.created_at ASC, comments.id ASC`,
    [projectId, ...params],
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
