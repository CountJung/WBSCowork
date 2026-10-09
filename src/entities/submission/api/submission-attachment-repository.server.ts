import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { buildIdScopeClause, isEmptyIdScope, isUnrestrictedScope, splitIdScope, type IdScope } from "@/src/shared/server/query-scope/index.server";
import { mapSubmissionAttachmentRow, type SubmissionAttachment, type SubmissionAttachmentRow } from "../model/submission-attachment";
import { buildSubmissionVisibilityWhere, type SubmissionVisibilityFilter } from "./submission-repository.server";

export type SubmissionAttachmentHistoryOptions = {
  /** Reserved for authorized destruction/file-cleanup paths. Normal lists use the current revision. */
  allRevisions?: boolean;
};

export type SubmissionAttachmentListOptions =
  | (SubmissionAttachmentHistoryOptions & { revisionNumber?: never; filter?: never })
  | { revisionNumber: number; filter: SubmissionVisibilityFilter; allRevisions?: never };

const attachmentColumns = `sa.id, sa.submission_id, sa.revision_number, sa.file_path,
  sa.file_name, sa.file_mime_type, sa.file_size_bytes, sa.created_at`;

function validateRevisionNumber(revisionNumber: number) {
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error("올바른 제출물 버전이 아닙니다.");
  }
}

/** Unfiltered metadata for already-authorized mutations and cleanup only. */
export async function getSubmissionAttachmentById(id: number): Promise<SubmissionAttachment | null> {
  const rows = (await getDatabasePool().query(
    `SELECT ${attachmentColumns} FROM submission_attachments sa WHERE sa.id = ? LIMIT 1`,
    [id],
  )) as SubmissionAttachmentRow[];
  return rows[0] ? mapSubmissionAttachmentRow(rows[0]) : null;
}

/** Missing, inaccessible parent and inaccessible snapshot all have the same null result. */
export async function getSubmissionAttachmentForViewer(
  id: number,
  filter: SubmissionVisibilityFilter,
): Promise<SubmissionAttachment | null> {
  const visibility = buildSubmissionVisibilityWhere(filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
  const rows = (await getDatabasePool().query(
    `SELECT ${attachmentColumns}
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     INNER JOIN users u ON u.id = s.author_id
     INNER JOIN submission_revisions r ON r.submission_id = sa.submission_id AND r.revision_number = sa.revision_number
     WHERE sa.id = ? ${visibility.clause} LIMIT 1`,
    [id, ...visibility.params],
  )) as SubmissionAttachmentRow[];
  return rows[0] ? mapSubmissionAttachmentRow(rows[0]) : null;
}

/**
 * Parent IDs bound the project but may be stale; each SQL query independently checks
 * current parent and current snapshot visibility before exposing attachment metadata.
 * Administrative destruction explicitly supplies unrestricted scope and allRevisions: true.
 */
export async function listAttachmentsByProject(
  projectId: number,
  scope: IdScope,
  filter: SubmissionVisibilityFilter,
  options: SubmissionAttachmentHistoryOptions = {},
): Promise<SubmissionAttachment[]> {
  if (options.allRevisions && (!isUnrestrictedScope(scope) || !filter.canSeeAll)) {
    throw new Error("전체 버전 첨부 조회에는 명시적인 관리 범위가 필요합니다.");
  }
  if (isEmptyIdScope(scope)) return [];

  const visibility = options.allRevisions
    ? { clause: "", params: [] }
    : buildSubmissionVisibilityWhere(filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
  const chunks = splitIdScope(scope, 1 + visibility.params.length);
  if (chunks.length > 1) {
    const rows: SubmissionAttachment[] = [];
    for (const chunk of chunks) rows.push(...await listAttachmentsByProject(projectId, chunk, filter, options));
    return rows.sort((left, right) => left.id - right.id);
  }
  const { clause, params } = buildIdScopeClause("sa.submission_id", scope);
  const rows = (await getDatabasePool().query(
    `SELECT ${attachmentColumns}
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     INNER JOIN tasks t ON t.id = s.task_id
     ${options.allRevisions ? "" : `INNER JOIN users u ON u.id = s.author_id
     INNER JOIN submission_revisions r ON r.submission_id = sa.submission_id AND r.revision_number = sa.revision_number`}
     WHERE t.project_id = ? ${clause}
       ${options.allRevisions ? "" : "AND sa.revision_number = s.current_revision"}
       ${visibility.clause}
     ORDER BY sa.id ASC`,
    [projectId, ...params, ...visibility.params],
  )) as SubmissionAttachmentRow[];
  return rows.map(mapSubmissionAttachmentRow);
}

/**
 * Default/current and allRevisions modes are unfiltered: authorized internal mutations
 * and cleanup only. Viewer reads must provide revisionNumber and filter, even for the
 * current revision, so parent and snapshot visibility are checked in the same query.
 */
export async function listAttachmentsBySubmission(
  submissionId: number,
  options: SubmissionAttachmentListOptions = {},
): Promise<SubmissionAttachment[]> {
  if (options.revisionNumber !== undefined) {
    validateRevisionNumber(options.revisionNumber);
    const visibility = buildSubmissionVisibilityWhere(options.filter, { submissionAlias: "s", userAlias: "u", revisionAlias: "r" });
    const rows = (await getDatabasePool().query(
      `SELECT ${attachmentColumns}
       FROM submission_attachments sa
       INNER JOIN submissions s ON s.id = sa.submission_id
       INNER JOIN users u ON u.id = s.author_id
       INNER JOIN submission_revisions r ON r.submission_id = sa.submission_id AND r.revision_number = sa.revision_number
       WHERE sa.submission_id = ? AND sa.revision_number = ? ${visibility.clause}
       ORDER BY sa.id ASC`,
      [submissionId, options.revisionNumber, ...visibility.params],
    )) as SubmissionAttachmentRow[];
    return rows.map(mapSubmissionAttachmentRow);
  }
  const rows = (await getDatabasePool().query(
    `SELECT ${attachmentColumns}
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     WHERE sa.submission_id = ? ${options.allRevisions ? "" : "AND sa.revision_number = s.current_revision"}
     ORDER BY sa.id ASC`,
    [submissionId],
  )) as SubmissionAttachmentRow[];
  return rows.map(mapSubmissionAttachmentRow);
}

/** Unfiltered parent scope for authorized task mutations; cleanup must request all revisions. */
export async function listAttachmentsByTask(
  taskId: number,
  options: SubmissionAttachmentHistoryOptions = {},
): Promise<SubmissionAttachment[]> {
  const rows = (await getDatabasePool().query(
    `SELECT ${attachmentColumns}
     FROM submission_attachments sa
     INNER JOIN submissions s ON s.id = sa.submission_id
     WHERE s.task_id = ? ${options.allRevisions ? "" : "AND sa.revision_number = s.current_revision"}
     ORDER BY sa.id ASC`,
    [taskId],
  )) as SubmissionAttachmentRow[];
  return rows.map(mapSubmissionAttachmentRow);
}
