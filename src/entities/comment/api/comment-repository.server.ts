import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { buildIdScopeClause, isEmptyIdScope, splitIdScope, type IdScope } from "@/src/shared/server/query-scope/index.server";
import { mapCommentRow, type Comment, type CommentRow } from "../model/comment";

/** Structural viewer contract keeps the comment entity independent of its sibling entity. */
export type CommentVisibilityFilter = {
  canSeeAll: boolean;
  viewerUserId?: number | null;
  viewerEmail?: string | null;
};

export type CreateCommentInput = {
  submissionId: number;
  authorId: number;
  content: string;
  /** The current revision selected by the action; a stale revision is rejected. */
  revisionNumber?: number;
};

export type UpdateCommentInput = {
  id: number;
  content: string;
};

export type CommentRevisionPageOptions = {
  limit?: number;
  offset?: number;
};

function normalizeContent(content: string) {
  const normalizedContent = content.trim();
  if (!normalizedContent) throw new Error("댓글 내용은 비워 둘 수 없습니다.");
  return normalizedContent;
}

function validateRevisionNumber(revisionNumber: number) {
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error("올바른 제출물 버전이 아닙니다.");
  }
}

async function ensureAuthorExists(authorId: number) {
  const rows = (await getDatabasePool().query("SELECT id FROM users WHERE id = ? LIMIT 1", [authorId])) as Array<{ id: number }>;
  if (!rows[0]) throw new Error("댓글 작성자 정보를 찾을 수 없습니다.");
}

const commentColumns = `comments.id, comments.submission_id, comments.revision_number,
  comments.author_id, users.name AS author_name, users.email AS author_email,
  comments.content, comments.created_at`;

// NULL remains unknown in the model. Its access boundary is the preserved baseline,
// so publishing a later version can never disclose a formerly private legacy comment.
const commentVisibilityJoins = `
  INNER JOIN submissions ON submissions.id = comments.submission_id
  INNER JOIN users submission_author ON submission_author.id = submissions.author_id
  INNER JOIN submission_revisions revision
    ON revision.submission_id = comments.submission_id
    AND revision.revision_number = COALESCE(comments.revision_number, 1)`;

function buildCommentVisibilityWhere(filter: CommentVisibilityFilter): { clause: string; params: unknown[] } {
  if (filter.canSeeAll) return { clause: "", params: [] };
  const ownerConditions: string[] = [];
  const params: unknown[] = [];
  if (filter.viewerUserId) {
    ownerConditions.push("submissions.author_id = ?");
    params.push(filter.viewerUserId);
  }
  const viewerEmail = filter.viewerEmail?.trim().toLowerCase();
  if (viewerEmail) {
    ownerConditions.push("LOWER(submission_author.email) = ?");
    params.push(viewerEmail);
  }
  const publicVersions = "(submissions.visibility = 'public' AND revision.visibility = 'public')";
  return {
    clause: `AND (${[publicVersions, ...ownerConditions].join(" OR ")})`,
    params,
  };
}

/** Unfiltered row for mutations after their parent and revision access checks. */
export async function getCommentById(id: number): Promise<Comment | null> {
  const rows = (await getDatabasePool().query(
    `SELECT ${commentColumns}
     FROM comments INNER JOIN users ON users.id = comments.author_id
     WHERE comments.id = ? LIMIT 1`,
    [id],
  )) as CommentRow[];
  return rows[0] ? mapCommentRow(rows[0]) : null;
}

export async function getCommentForViewer(id: number, filter: CommentVisibilityFilter): Promise<Comment | null> {
  const visibility = buildCommentVisibilityWhere(filter);
  const rows = (await getDatabasePool().query(
    `SELECT ${commentColumns}
     FROM comments INNER JOIN users ON users.id = comments.author_id
     ${commentVisibilityJoins}
     WHERE comments.id = ? ${visibility.clause} LIMIT 1`,
    [id, ...visibility.params],
  )) as CommentRow[];
  return rows[0] ? mapCommentRow(rows[0]) : null;
}

/** Parent IDs bound the project; viewer and snapshot visibility are applied in SQL. */
export async function listCommentsByProject(
  projectId: number,
  scope: IdScope,
  filter: CommentVisibilityFilter,
): Promise<Comment[]> {
  if (isEmptyIdScope(scope)) return [];
  const visibility = buildCommentVisibilityWhere(filter);
  const chunks = splitIdScope(scope, 1 + visibility.params.length);
  if (chunks.length > 1) {
    const rows: Comment[] = [];
    for (const chunk of chunks) rows.push(...await listCommentsByProject(projectId, chunk, filter));
    return rows.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id - right.id);
  }
  const { clause, params } = buildIdScopeClause("comments.submission_id", scope);
  const rows = (await getDatabasePool().query(
    `SELECT ${commentColumns}
     FROM comments INNER JOIN users ON users.id = comments.author_id
     ${commentVisibilityJoins}
     INNER JOIN tasks ON tasks.id = submissions.task_id
     WHERE tasks.project_id = ? ${clause} ${visibility.clause}
     ORDER BY comments.created_at ASC, comments.id ASC`,
    [projectId, ...params, ...visibility.params],
  )) as CommentRow[];
  return rows.map(mapCommentRow);
}

export async function countCommentsBySubmissionRevision(
  submissionId: number,
  revisionNumber: number,
  filter: CommentVisibilityFilter,
): Promise<number> {
  validateRevisionNumber(revisionNumber);
  const visibility = buildCommentVisibilityWhere(filter);
  const rows = (await getDatabasePool().query(
    `SELECT COUNT(*) AS total FROM comments
     ${commentVisibilityJoins}
     WHERE comments.submission_id = ? AND COALESCE(comments.revision_number, 1) = ? ${visibility.clause}`,
    [submissionId, revisionNumber, ...visibility.params],
  )) as Array<{ total: number | string }>;
  return Number(rows[0]?.total ?? 0);
}

/** History pages are bounded in SQL before comment content reaches component props. */
export async function listCommentsBySubmissionRevision(
  submissionId: number,
  revisionNumber: number,
  filter: CommentVisibilityFilter,
  options: CommentRevisionPageOptions = {},
): Promise<Comment[]> {
  validateRevisionNumber(revisionNumber);
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("올바른 댓글 페이지 범위가 아닙니다.");
  }
  const visibility = buildCommentVisibilityWhere(filter);
  const rows = (await getDatabasePool().query(
    `SELECT ${commentColumns}
     FROM comments INNER JOIN users ON users.id = comments.author_id
     ${commentVisibilityJoins}
     WHERE comments.submission_id = ? AND COALESCE(comments.revision_number, 1) = ? ${visibility.clause}
     ORDER BY comments.created_at ASC, comments.id ASC LIMIT ? OFFSET ?`,
    [submissionId, revisionNumber, ...visibility.params, limit, offset],
  )) as CommentRow[];
  return rows.map(mapCommentRow);
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  if (input.revisionNumber !== undefined) validateRevisionNumber(input.revisionNumber);
  await ensureAuthorExists(input.authorId);
  const result = (await getDatabasePool().query(
    `INSERT INTO comments (submission_id, revision_number, author_id, content)
     SELECT id, current_revision, ?, ? FROM submissions
     WHERE id = ? ${input.revisionNumber === undefined ? "" : "AND current_revision = ?"}`,
    [input.authorId, normalizeContent(input.content), input.submissionId,
      ...(input.revisionNumber === undefined ? [] : [input.revisionNumber])],
  )) as { insertId: number; affectedRows: number };
  if (Number(result.affectedRows) !== 1) {
    throw new Error("제출물이 없거나 버전이 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
  }
  const comment = await getCommentById(Number(result.insertId));
  if (!comment) throw new Error("댓글을 생성했지만 결과를 다시 불러오지 못했습니다.");
  return comment;
}

export async function updateComment(input: UpdateCommentInput): Promise<Comment> {
  const existingComment = await getCommentById(input.id);
  if (!existingComment) throw new Error("수정할 댓글을 찾을 수 없습니다.");
  await getDatabasePool().query("UPDATE comments SET content = ? WHERE id = ?", [normalizeContent(input.content), input.id]);
  const updatedComment = await getCommentById(input.id);
  if (!updatedComment) throw new Error("댓글을 수정했지만 결과를 다시 불러오지 못했습니다.");
  return updatedComment;
}

export async function deleteComment(commentId: number): Promise<Comment> {
  const existingComment = await getCommentById(commentId);
  if (!existingComment) throw new Error("삭제할 댓글을 찾을 수 없습니다.");
  await getDatabasePool().query("DELETE FROM comments WHERE id = ?", [commentId]);
  return existingComment;
}
