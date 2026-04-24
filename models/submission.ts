export type SubmissionVisibility = "public" | "private";

export type SubmissionRow = {
  id: number;
  task_id: number;
  author_id: number;
  author_name: string;
  author_email: string;
  content: string;
  visibility: SubmissionVisibility;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  created_at: Date | string;
};

export type Submission = {
  id: number;
  taskId: number;
  authorId: number;
  authorName: string;
  authorEmail: string;
  content: string;
  visibility: SubmissionVisibility;
  filePath: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
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
    visibility: row.visibility ?? "public",
    filePath: row.file_path,
    fileName: row.file_name,
    fileMimeType: row.file_mime_type,
    fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}