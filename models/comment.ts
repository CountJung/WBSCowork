export type CommentRow = {
  id: number;
  submission_id: number;
  author_id: number;
  author_name: string;
  author_email: string;
  content: string;
  created_at: Date | string;
};

export type Comment = {
  id: number;
  submissionId: number;
  authorId: number;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: Date;
};

export function mapCommentRow(row: CommentRow): Comment {
  return {
    id: row.id,
    submissionId: row.submission_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    content: row.content,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}