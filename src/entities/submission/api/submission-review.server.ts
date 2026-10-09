import { createHash } from "node:crypto";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { submissionOperationToken, submissionRevisionNumber, type SubmissionActor } from "../model/submission-revision";
import type { SubmissionReviewContext, SubmissionReviewInput } from "../model/submission-review";

export type { SubmissionReviewContext, SubmissionReviewInput } from "../model/submission-review";

const staleMessage = "다른 변경이 먼저 저장되었거나 검토 권한이 변경되었습니다. 새로고침 후 다시 확인해 주세요.";
const replayMessage = "같은 요청 식별자를 다른 내용에 사용할 수 없습니다.";
const publicReviewNote = "제출물 검토 상태가 변경되었습니다.";

type FreshActor = SubmissionActor & { role: string };
type ReviewRow = {
  task_id: number; project_id: number; task_version: number; status: string;
  review_required: number; review_submission_id: number | null; review_revision_number: number | null;
  assignee_id: number | null; assignee_eligible: number; deliverable: string; definition_of_done: string;
  reviewer_id: number | null; reviewer_name: string | null; reviewer_eligible: number; reviewer_can_view: number;
  author_id: number; editor_id: number | null; current_revision: number; revision_number: number;
  rejected: number;
};

function positiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} 식별자가 올바르지 않습니다.`);
  return value;
}

function superuserEmail() {
  return (getRuntimeEnv().auth.superuserEmail ?? "").trim().toLowerCase();
}

async function freshActor(actor: SubmissionActor): Promise<FreshActor | null> {
  positiveId(actor.userId, "사용자");
  const rows = await getDatabasePool().query("SELECT role,email FROM users WHERE id=? LIMIT 1", [actor.userId]) as { role: string; email: string }[];
  const user = rows[0];
  if (!user) return null;
  return {
    userId: actor.userId, role: user.role, isAdmin: user.role === "admin",
    isSuperuser: Boolean(actor.isSuperuser) && user.email.toLowerCase() === superuserEmail(),
  };
}

function canWrite(actor: FreshActor) {
  return actor.isSuperuser || actor.role === "member" || actor.role === "admin";
}

function actorVisibility(actor: FreshActor) {
  return {
    sql: "(?=1 OR viewer.role='admin' OR s.author_id=viewer.id OR (s.visibility='public' AND r.visibility='public'))",
    params: [actor.isSuperuser ? 1 : 0],
  };
}

async function readReviewRow(submissionId: number, revisionNumber: number, actor: FreshActor): Promise<ReviewRow | null> {
  const access = actorVisibility(actor);
  const rows = await getDatabasePool().query(
    `SELECT t.id AS task_id,t.project_id,t.version AS task_version,t.status,t.review_required,
      t.review_submission_id,t.review_revision_number,t.assignee_id,t.deliverable,t.definition_of_done,
      t.reviewer_id,reviewer.name AS reviewer_name,s.author_id,r.editor_id,s.current_revision,r.revision_number,
      CASE WHEN assignee.role IN ('member','admin') OR LOWER(assignee.email)=? THEN 1 ELSE 0 END AS assignee_eligible,
      CASE WHEN reviewer.role IN ('member','admin') OR LOWER(reviewer.email)=? THEN 1 ELSE 0 END AS reviewer_eligible,
      CASE WHEN reviewer.role='admin' OR LOWER(reviewer.email)=? OR s.author_id=reviewer.id OR (s.visibility='public' AND r.visibility='public') THEN 1 ELSE 0 END AS reviewer_can_view,
      CASE WHEN EXISTS(SELECT 1 FROM submission_events rejected WHERE rejected.submission_id=s.id AND rejected.revision_number=r.revision_number AND rejected.kind='changes_requested') THEN 1 ELSE 0 END AS rejected
     FROM submissions s
     JOIN tasks t ON t.id=s.task_id
     JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=?
     JOIN users viewer ON viewer.id=?
     LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
     LEFT JOIN users assignee ON assignee.id=t.assignee_id
     WHERE s.id=? AND ${access.sql} LIMIT 1`,
    [superuserEmail(), superuserEmail(), superuserEmail(), revisionNumber, actor.userId, submissionId, ...access.params],
  ) as ReviewRow[];
  return rows[0] ?? null;
}

function contextFor(row: ReviewRow, submissionId: number, actor: FreshActor): SubmissionReviewContext {
  const selected = Number(row.review_submission_id) === submissionId && Number(row.review_revision_number) === Number(row.revision_number);
  const current = Number(row.current_revision) === Number(row.revision_number);
  const executor = actor.isAdmin || actor.isSuperuser || Number(row.assignee_id) === actor.userId;
  const selfReview = Number(row.reviewer_id) === Number(row.author_id)
    || Number(row.reviewer_id) === Number(row.assignee_id)
    || (row.editor_id !== null && Number(row.reviewer_id) === Number(row.editor_id));
  let unavailableReason: string | null = null;
  if (!canWrite(actor)) unavailableReason = "현재 역할에는 검토 처리 권한이 없습니다.";
  else if (!Number(row.review_required)) unavailableReason = "검토가 필요하지 않은 작업입니다.";
  else if (!current) unavailableReason = "현재 제출 버전에서 검토를 진행해 주세요.";
  else if (!row.assignee_id || !Number(row.assignee_eligible)) unavailableReason = "업무를 수행할 수 있는 담당자를 지정해 주세요.";
  else if (Number(row.author_id) !== Number(row.assignee_id)) unavailableReason = "현재 담당자의 제출물만 완료 검토를 요청할 수 있습니다.";
  else if (!row.deliverable.trim() || !row.definition_of_done.trim()) unavailableReason = "기대 산출물과 완료 기준을 먼저 작성해 주세요.";
  else if (!row.reviewer_id || !Number(row.reviewer_eligible)) unavailableReason = "업무를 수행할 수 있는 검토자를 지정해 주세요.";
  else if (!Number(row.reviewer_can_view)) unavailableReason = "지정 검토자가 이 제출 버전을 조회할 수 없습니다.";
  else if (selfReview) unavailableReason = "작성자·담당자·해당 버전 편집자는 직접 검토할 수 없습니다.";
  const ready = unavailableReason === null;
  const canRequest = ready && executor && !Number(row.rejected)
    && ['planned', 'in_progress', 'blocked', 'changes_requested'].includes(row.status);
  const canDecide = ready && selected && row.status === 'review_pending' && Number(row.reviewer_id) === actor.userId;
  const canCancelOrReopen = canWrite(actor) && selected && Number(row.review_required) === 1
    && ['review_pending', 'changes_requested', 'done'].includes(row.status)
    && (executor || Number(row.reviewer_id) === actor.userId);
  if (!unavailableReason && !canRequest && !canDecide && !canCancelOrReopen) {
    unavailableReason = Number(row.rejected) ? "보완 요청을 반영한 새 버전을 제출해 주세요." : "현재 담당자 또는 지정 검토자가 다음 단계를 진행할 수 있습니다.";
  }
  return {
    taskId: Number(row.task_id), projectId: Number(row.project_id), taskVersion: Number(row.task_version),
    status: row.status, reviewRequired: Number(row.review_required) === 1, selected,
    reviewerId: row.reviewer_id === null ? null : Number(row.reviewer_id), reviewerName: row.reviewer_name,
    canRequest, canDecide, canCancelOrReopen, unavailableReason,
  };
}

export async function getSubmissionReviewContext(input: {
  submissionId: number; revisionNumber: number; actor: SubmissionActor;
}): Promise<SubmissionReviewContext | null> {
  positiveId(input.submissionId, "제출물");
  const revision = submissionRevisionNumber(input.revisionNumber);
  const actor = await freshActor(input.actor);
  if (!actor) return null;
  const row = await readReviewRow(input.submissionId, revision, actor);
  return row ? contextFor(row, input.submissionId, actor) : null;
}

function normalizeReason(reason: string, required: boolean) {
  if (typeof reason !== 'string') throw new Error("검토 사유가 올바르지 않습니다.");
  const normalized = reason.trim();
  if (required && !normalized) throw new Error("검토 사유를 입력해 주세요.");
  if (normalized.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(normalized)) throw new Error("검토 사유는 제어 문자 없이 2,000자 이하로 작성해 주세요.");
  return normalized;
}

type ReviewAction = 'review_requested' | 'approved' | 'changes_requested' | 'review_cancelled';

async function commitReview(input: SubmissionReviewInput, kind: ReviewAction, reason: string) {
  positiveId(input.taskId, "작업");
  positiveId(input.submissionId, "제출물");
  const revision = submissionRevisionNumber(input.revisionNumber);
  const version = positiveId(input.expectedTaskVersion, "작업 버전");
  const token = submissionOperationToken(input.token);
  const actor = await freshActor(input.actor);
  if (!actor || !canWrite(actor)) throw new Error("검토 처리 권한이 없습니다.");
  const key = `${actor.userId}:submission.${kind}:${input.taskId}:${token}`;
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    taskId: input.taskId, submissionId: input.submissionId, revisionNumber: revision,
    expectedTaskVersion: version, kind, reason,
  })).digest('hex');
  const access = actorVisibility(actor);
  const findOperation = async () => {
    const rows = await getDatabasePool().query(
      `SELECT e.request_fingerprint FROM submission_events e
       JOIN submissions s ON s.id=e.submission_id
       JOIN submission_revisions r ON r.submission_id=e.submission_id AND r.revision_number=e.revision_number
       JOIN users viewer ON viewer.id=?
       WHERE e.operation_token=? AND e.actor_id=? AND s.task_id=? AND ${access.sql} LIMIT 1`,
      [actor.userId, key, actor.userId, input.taskId, ...access.params],
    ) as { request_fingerprint: string }[];
    return rows[0];
  };
  const prior = await findOperation();
  if (prior) {
    if (prior.request_fingerprint !== requestFingerprint) throw new Error(replayMessage);
    return;
  }
  const row = await readReviewRow(input.submissionId, revision, actor);
  if (!row || Number(row.task_id) !== input.taskId) throw new Error("검토할 제출 버전을 찾을 수 없습니다.");
  const context = contextFor(row, input.submissionId, actor);
  const allowed = kind === 'review_requested' ? context.canRequest
    : kind === 'review_cancelled' ? context.canCancelOrReopen : context.canDecide;
  if (!allowed || context.taskVersion !== version) {
    const concurrent = await findOperation();
    if (concurrent?.request_fingerprint === requestFingerprint) return;
    if (concurrent) throw new Error(replayMessage);
    throw new Error(context.unavailableReason ?? staleMessage);
  }

  const cancel = kind === 'review_cancelled';
  const eventKind = cancel && row.status === 'done' ? 'approval_revoked' : kind;
  const status = kind === 'review_requested' ? 'review_pending'
    : kind === 'approved' ? 'done' : kind === 'changes_requested' ? 'changes_requested' : 'in_progress';
  const commonGuard = `tasks.review_required=1 AND EXISTS(
    SELECT 1 FROM submissions s
    JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=?
    JOIN users viewer ON viewer.id=?
    WHERE s.id=? AND s.task_id=tasks.id AND s.current_revision=r.revision_number
      AND (?=1 OR viewer.role IN ('member','admin')) AND ${access.sql}
      ${cancel ? '' : `AND s.author_id=tasks.assignee_id
      AND TRIM(tasks.deliverable)<>'' AND TRIM(tasks.definition_of_done)<>''
      AND EXISTS(SELECT 1 FROM users assignee WHERE assignee.id=tasks.assignee_id AND (assignee.role IN ('member','admin') OR LOWER(assignee.email)=?))
      AND EXISTS(SELECT 1 FROM users reviewer WHERE reviewer.id=tasks.reviewer_id
        AND (reviewer.role IN ('member','admin') OR LOWER(reviewer.email)=?)
        AND (reviewer.role='admin' OR LOWER(reviewer.email)=? OR s.author_id=reviewer.id OR (s.visibility='public' AND r.visibility='public'))
        AND reviewer.id<>s.author_id AND reviewer.id<>tasks.assignee_id AND (r.editor_id IS NULL OR reviewer.id<>r.editor_id))`}
  )`;
  const commonParams = [revision, actor.userId, input.submissionId, actor.isSuperuser ? 1 : 0, ...access.params,
    ...(cancel ? [] : [superuserEmail(), superuserEmail(), superuserEmail()])];
  const executorGuard = "(?=1 OR tasks.assignee_id=? OR EXISTS(SELECT 1 FROM users administrator WHERE administrator.id=? AND administrator.role='admin'))";
  let transitionGuard: string;
  let transitionParams: unknown[];
  if (kind === 'review_requested') {
    transitionGuard = `tasks.status IN ('planned','in_progress','blocked','changes_requested') AND ${executorGuard}
      AND NOT EXISTS(SELECT 1 FROM submission_events rejected WHERE rejected.submission_id=? AND rejected.revision_number=? AND rejected.kind='changes_requested')`;
    transitionParams = [actor.isSuperuser ? 1 : 0, actor.userId, actor.userId, input.submissionId, revision];
  } else {
    transitionGuard = `tasks.review_submission_id=? AND tasks.review_revision_number=? AND ${cancel
      ? `tasks.status IN ('review_pending','changes_requested','done') AND (${executorGuard} OR tasks.reviewer_id=?)`
      : "tasks.status='review_pending' AND tasks.reviewer_id=?"}`;
    transitionParams = [input.submissionId, revision, ...(cancel ? [actor.isSuperuser ? 1 : 0, actor.userId, actor.userId, actor.userId] : [actor.userId])];
  }

  await databaseBatch([
    { sql: 'UPDATE tasks SET id=id WHERE id=?', params: [input.taskId] },
    { sql: 'UPDATE submissions SET id=id WHERE id=? AND task_id=?', params: [input.submissionId, input.taskId] },
    {
      sql: `UPDATE tasks SET status=?,review_submission_id=?,review_revision_number=?,workflow_note=?,version=version+1,last_operation_token=?
        WHERE id=? AND version=? AND ${commonGuard} AND ${transitionGuard}
        AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`,
      params: [status, cancel ? null : input.submissionId, cancel ? null : revision, publicReviewNote, key,
        input.taskId, version, ...commonParams, ...transitionParams, key],
    },
    {
      sql: `INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body)
        SELECT ?,?,?,?,?,?,? FROM tasks WHERE id=? AND last_operation_token=?
        AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`,
      params: [input.submissionId, revision, actor.userId, key, requestFingerprint, eventKind, reason, input.taskId, key, key],
    },
    {
      sql: `INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version)
        SELECT id,?,?,?,?,status,assignee_id,reviewer_id,?,version FROM tasks WHERE id=? AND last_operation_token=?
        AND NOT EXISTS(SELECT 1 FROM task_events applied WHERE applied.operation_token=?)`,
      params: [actor.userId, key, requestFingerprint, eventKind, publicReviewNote, input.taskId, key, key],
    },
  ]);
  const saved = await findOperation();
  if (!saved) throw new Error(staleMessage);
  if (saved.request_fingerprint !== requestFingerprint) throw new Error(replayMessage);
}

export function requestSubmissionReview(input: SubmissionReviewInput): Promise<void> {
  return commitReview(input, 'review_requested', '');
}

export function decideSubmissionReview(input: SubmissionReviewInput & {
  decision: 'approved' | 'changes_requested'; reason: string;
}): Promise<void> {
  if (!['approved', 'changes_requested'].includes(input.decision)) throw new Error("검토 판정이 올바르지 않습니다.");
  return commitReview(input, input.decision, normalizeReason(input.reason, input.decision === 'changes_requested'));
}

export function cancelOrReopenSubmissionReview(input: SubmissionReviewInput & { reason: string }): Promise<void> {
  return commitReview(input, 'review_cancelled', normalizeReason(input.reason, true));
}

/** Call only inside the source mutation batch, after its guarded submission write and before its final event. */
export function submissionReviewInvalidationStatements(input: {
  taskId: number; submissionId: number; previousRevision?: number; actorId: number | null;
  sourceOperationKey: string; requestFingerprint: string;
}): QueryStatement[] {
  const key = `${input.sourceOperationKey}:review-invalidate`;
  const sourceGuard = `s.last_operation_token=? AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`;
  const sourceParams = [input.sourceOperationKey, input.sourceOperationKey];
  const targetGuard = `t.id=? AND t.review_submission_id=?${input.previousRevision === undefined ? '' : ' AND t.review_revision_number=?'}`;
  const targetParams = [input.taskId, input.submissionId, ...(input.previousRevision === undefined ? [] : [input.previousRevision])];
  return [
    {
      sql: `INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body)
        SELECT s.id,t.review_revision_number,?,?,?,'review_invalidated','검토 대상 변경으로 다시 확인이 필요합니다.'
        FROM tasks t JOIN submissions s ON s.id=t.review_submission_id AND s.task_id=t.id
        WHERE ${targetGuard} AND ${sourceGuard}
        AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`,
      params: [input.actorId, key, input.requestFingerprint, ...targetParams, ...sourceParams, key],
    },
    {
      sql: `UPDATE tasks SET review_submission_id=NULL,review_revision_number=NULL,
        status=CASE WHEN status IN ('review_pending','changes_requested','done') THEN 'in_progress' ELSE status END,
        workflow_note='검토 대상 변경으로 다시 확인이 필요합니다.',version=version+1,last_operation_token=?
        WHERE id=? AND review_submission_id=?${input.previousRevision === undefined ? '' : ' AND review_revision_number=?'}
        AND EXISTS(SELECT 1 FROM submissions s WHERE s.id=? AND ${sourceGuard})
        AND EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`,
      params: [key, ...targetParams, input.submissionId, ...sourceParams, key],
    },
    {
      sql: `INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version)
        SELECT id,?,?,?,'review_invalidated',status,assignee_id,reviewer_id,'검토 대상 변경으로 다시 확인이 필요합니다.',version
        FROM tasks WHERE id=? AND last_operation_token=?
        AND NOT EXISTS(SELECT 1 FROM task_events applied WHERE applied.operation_token=?)`,
      params: [input.actorId, key, input.requestFingerprint, input.taskId, key, key],
    },
  ];
}
