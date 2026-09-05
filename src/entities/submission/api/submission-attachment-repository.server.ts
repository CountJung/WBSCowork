import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { buildIdScopeClause, isEmptyIdScope, type IdScope } from "@/src/shared/server/query-scope/index.server";
import { mapSubmissionAttachmentRow, type SubmissionAttachment, type SubmissionAttachmentRow } from "../model/submission-attachment";

export type CreateSubmissionAttachmentInput = {
  submissionId: number;
  filePath: string;
  fileName: string;
  fileMimeType: string;
  fileSizeBytes: number;
};

export async function getSubmissionAttachmentById(id: number): Promise<SubmissionAttachment | null> {
  const rows = (await getDatabasePool().query(
    `SELECT id, submission_id, file_path, file_name, file_mime_type, file_size_bytes, created_at
     FROM submission_attachments WHERE id = ? LIMIT 1`,
    [id],
  )) as SubmissionAttachmentRow[];

  const row = rows[0];

  return row ? mapSubmissionAttachmentRow(row) : null;
}

export async function createSubmissionAttachment(input: CreateSubmissionAttachmentInput): Promise<SubmissionAttachment> {
  const result = (await getDatabasePool().query(
    `INSERT INTO submission_attachments (submission_id, file_path, file_name, file_mime_type, file_size_bytes)
     VALUES (?, ?, ?, ?, ?)`,
    [input.submissionId, input.filePath, input.fileName, input.fileMimeType, input.fileSizeBytes],
  )) as { insertId: number };

  const created = await getSubmissionAttachmentById(result.insertId);

  if (!created) {
    throw new Error("첨부파일 레코드를 생성하지 못했습니다.");
  }

  return created;
}

/**
 * 프로젝트 첨부파일 목록.
 *
 * 첨부 metadata(파일명·저장 경로·크기)는 부모 제출물의 공개 범위를 그대로 따라야 한다.
 * 화면 경로는 뷰어에게 보이는 제출물 id 집합(`{ ids }`)을 넘기고,
 * 프로젝트 파기처럼 저장 파일 전체 정리가 필요한 관리 경로만 `{ unrestricted: true }`를 명시한다.
 */
export async function listAttachmentsByProject(projectId: number, scope: IdScope): Promise<SubmissionAttachment[]> {
  if (isEmptyIdScope(scope)) {
    return [];
  }

  const { clause, params } = buildIdScopeClause("sa.submission_id", scope);
  const rows = (await getDatabasePool().query(
    `SELECT sa.id, sa.submission_id, sa.file_path, sa.file_name, sa.file_mime_type, sa.file_size_bytes, sa.created_at
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     INNER JOIN tasks t ON t.id = s.task_id
     WHERE t.project_id = ? ${clause}
     ORDER BY sa.id ASC`,
    [projectId, ...params],
  )) as SubmissionAttachmentRow[];

  return rows.map(mapSubmissionAttachmentRow);
}

export async function listAttachmentsBySubmission(submissionId: number): Promise<SubmissionAttachment[]> {
  const rows = (await getDatabasePool().query(
    `SELECT id, submission_id, file_path, file_name, file_mime_type, file_size_bytes, created_at
     FROM submission_attachments WHERE submission_id = ? ORDER BY id ASC`,
    [submissionId],
  )) as SubmissionAttachmentRow[];

  return rows.map(mapSubmissionAttachmentRow);
}

export async function listAttachmentsByTask(taskId: number): Promise<SubmissionAttachment[]> {
  const rows = (await getDatabasePool().query(
    `SELECT sa.id, sa.submission_id, sa.file_path, sa.file_name, sa.file_mime_type, sa.file_size_bytes, sa.created_at
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     WHERE s.task_id = ?
     ORDER BY sa.id ASC`,
    [taskId],
  )) as SubmissionAttachmentRow[];

  return rows.map(mapSubmissionAttachmentRow);
}

export async function deleteSubmissionAttachment(id: number): Promise<SubmissionAttachment | null> {
  const attachment = await getSubmissionAttachmentById(id);

  if (!attachment) {
    return null;
  }

  await getDatabasePool().query(`DELETE FROM submission_attachments WHERE id = ?`, [id]);

  return attachment;
}
