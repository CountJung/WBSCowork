export type SubmissionRow = {
  id: number;
  task_id: number;
  author_id: number;
  author_name: string;
  author_email: string;
  content: string;
  file_path: string | null;
  created_at: Date | string;
};

export type Submission = {
  id: number;
  taskId: number;
  authorId: number;
  authorName: string;
  authorEmail: string;
  content: string;
  filePath: string | null;
  createdAt: Date;
};

export function mapSubmissionRow(row: SubmissionRow): Submission {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    content: row.content,
    filePath: row.file_path,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}