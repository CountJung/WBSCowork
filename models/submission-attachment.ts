export type SubmissionAttachmentRow = {
  id: number;
  submission_id: number;
  file_path: string;
  file_name: string;
  file_mime_type: string;
  file_size_bytes: number | string;
  created_at: Date | string;
};

export type SubmissionAttachment = {
  id: number;
  submissionId: number;
  filePath: string;
  fileName: string;
  fileMimeType: string;
  fileSizeBytes: number;
  createdAt: Date;
};

export function mapSubmissionAttachmentRow(row: SubmissionAttachmentRow): SubmissionAttachment {
  return {
    id: row.id,
    submissionId: row.submission_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileMimeType: row.file_mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
