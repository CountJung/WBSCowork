/** Additive native review workflow in the current fresh migration fixture. All history remains. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyNativeSubmissionReview(check: (value: unknown, label: string) => void) {
  const { createTask, updateTask, getTaskById, listPersonalWorkPage } = await import('../src/entities/task/index.server');
  const { createSubmissionWithAttachments, updateSubmissionWithAttachments, getSubmissionById, requestSubmissionReview, decideSubmissionReview, cancelOrReopenSubmissionReview, getSubmissionReviewContext } = await import('../src/entities/submission/index.server');
  const { getDatabasePool } = await import('../src/shared/server/database/index.server');
  const owner = { userId: 2, isAdmin: false, isSuperuser: false }, reviewer = { ...owner, userId: 3 }, admin = { userId: 4, isAdmin: true, isSuperuser: false };
  const db = getDatabasePool();
  const base = { actor: owner, token: randomUUID(), projectId: 1, title: 'Native exact-version review', assigneeId: 2, deliverable: '결과 문서', definitionOfDone: '동료가 자료와 결과 확인', reviewRequired: true, startDate: '2026-01-01', endDate: '2026-12-31' };
  const task = await createTask(base), taskId = task.id;
  await updateTask({ ...base, id: taskId, version: task.version, token: randomUUID(), reviewerId: 3 });
  const submissionId = await createSubmissionWithAttachments({ actor: owner, token: randomUUID(), taskId, authorId: 2, content: 'Native review v1', visibility: 'public' }, []);
  const input = async (actor = owner) => ({ taskId, submissionId, revisionNumber: (await getSubmissionById(submissionId))!.currentRevision, expectedTaskVersion: (await getTaskById(taskId))!.version, actor, token: randomUUID() });
  const first = await input();
  await Promise.all([requestSubmissionReview(first), requestSubmissionReview(first)]);
  check((await getTaskById(taskId))!.status === 'review_pending', 'native exact-version review request replay is atomic');
  await assert.rejects(decideSubmissionReview({ ...await input(), decision: 'approved', reason: 'self' }));
  await assert.rejects(decideSubmissionReview({ ...await input(admin), decision: 'approved', reason: 'not assigned' }));
  check(true, 'native self and unassigned administrator decisions rejected');
  await decideSubmissionReview({ ...await input(reviewer), decision: 'changes_requested', reason: '출처 보완' });
  await assert.rejects(requestSubmissionReview(await input()));
  check(true, 'native rejected version requires a new revision');
  await updateSubmissionWithAttachments({ id: submissionId, actor: owner, token: randomUUID(), expectedRevision: 1, content: 'Native review v2', changeSummary: '보완 완료' }, []);
  check((await getTaskById(taskId))!.status === 'in_progress', 'native revision invalidates prior selected feedback');
  await requestSubmissionReview(await input());
  const approve = { ...await input(reviewer), decision: 'approved' as const, reason: '기준 충족' };
  await Promise.all([decideSubmissionReview(approve), decideSubmissionReview(approve)]);
  check((await getTaskById(taskId))!.status === 'done', 'native repeated approval completes only one selected version');
  await cancelOrReopenSubmissionReview({ ...await input(), reason: '추가 확인' });
  check((await getTaskById(taskId))!.status === 'in_progress', 'native reopen preserves approval archive');
  await updateSubmissionWithAttachments({ id: submissionId, actor: owner, token: randomUUID(), expectedRevision: 2, content: 'Native private v3', visibility: 'private', changeSummary: '비공개 보완' }, []);
  await assert.rejects(requestSubmissionReview(await input()));
  check(await getSubmissionReviewContext({ submissionId, revisionNumber: 3, actor: reviewer }) === null, 'native member reviewer receives no private context');
  await updateTask({ ...base, id: taskId, version: (await getTaskById(taskId))!.version, token: randomUUID(), reviewerId: 4 });
  await requestSubmissionReview(await input());
  const version = (await getTaskById(taskId))!.version;
  const decisions = await Promise.allSettled([
    decideSubmissionReview({ ...await input(admin), expectedTaskVersion: version, decision: 'approved', reason: '승인' }),
    decideSubmissionReview({ ...await input(admin), expectedTaskVersion: version, decision: 'changes_requested', reason: '추가 보완' }),
  ]);
  check(decisions.filter(result => result.status === 'fulfilled').length === 1 && (await getTaskById(taskId))!.version === version + 1, 'native competing review decisions yield one normal winner');
  await updateSubmissionWithAttachments({ id: submissionId, actor: owner, token: randomUUID(), expectedRevision: 3, content: 'Native final v4', visibility: 'private', changeSummary: '새 결과' }, []);
  check((await getTaskById(taskId))!.status === 'in_progress', 'native new version never inherits earlier approval');
  const state = (await db.query('SELECT version,review_submission_id,review_revision_number FROM tasks WHERE id=?', [taskId]) as { version: number; review_submission_id: number | null; review_revision_number: number | null }[])[0];
  const count = (await db.query('SELECT COUNT(*) AS n,COUNT(DISTINCT task_version) AS versions FROM task_events WHERE task_id=?', [taskId]) as { n: number; versions: number }[])[0];
  check(Number(count.n) === state.version && Number(count.versions) === state.version && state.review_submission_id === null && state.review_revision_number === null, 'native exact-version state/history and cleared selection remain consistent');
  const original = (await db.query('SELECT content FROM submission_revisions WHERE submission_id=? AND revision_number=1', [submissionId]) as { content: string }[])[0];
  check(original.content === 'Native review v1', 'native review and resubmission preserve original text');
  for(const viewerUserId of [2,3,4]) for(const scope of ['mine','contributed','review'] as const) {
    const page=await listPersonalWorkPage({viewerUserId,isSuperuser:false},{scope,status:'all',overdue:false,page:1},'2026-10-09');
    assert.equal(new Set(page.items.map(item=>item.taskId)).size,page.items.length);
    assert.ok(page.items.length<=20&&page.total>=page.items.length);
    if(scope==='review')assert.equal(page.total,0);
  }
  check(true,'native personal queues execute all role/scope combinations with consistent bounded results');
}
