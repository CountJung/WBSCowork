import { randomUUID } from 'node:crypto';
/** Read contracts over isolated synthetic records; no destructive teardown. */
export async function verifyPersonalWorkWorkflow({ request, db, actorCookies, form, renderedAction, check, projectId, route }) {
  const owner = actorCookies.member1, reviewer = actorCookies.member2;
  const page = async (query, cookie = reviewer) => (await request('/my-work?' + query, cookie)).text();
  const html = async (path, cookie) => (await request(path, cookie)).text();
  check((await request('/my-work')).status === 307, 'queue: anonymous personal work requires login');
  check((await page('scope=review', actorCookies.guest)).includes('읽기 전용'), 'queue: guest gets accurate read-only explanation');
  const create = renderedAction(await html(route, owner), 'createTaskAction');
  const dates = { startDate: '2026-01-01', endDate: '2026-12-31' };
  await form(route, owner, create, { projectId, title: 'QUEUE_REVIEW_CARD', assigneeId: 2, reviewRequired: '1', deliverable: '결과', definitionOfDone: '동료 확인', ...dates });
  const task = await db.prepare("SELECT * FROM tasks WHERE title='QUEUE_REVIEW_CARD'").first(), taskId = task.id;
  const update = renderedAction(await html(route, owner), 'updateTaskAction');
  await form(route, owner, update, { projectId, taskId, title: task.title, assigneeId: 2, reviewerId: 3, ...dates });
  const submit = renderedAction(await html(route, owner), 'createSubmissionAction');
  await form(route, owner, submit, { projectId, taskId, content: 'QUEUE_VISIBLE_OUTPUT', visibility: 'public' });
  const submission = await db.prepare("SELECT * FROM submissions WHERE content='QUEUE_VISIBLE_OUTPUT'").first(), submissionId = submission.id;
  const history = `/submissions/${submissionId}`;
  const requestReview = renderedAction(await html(history, owner), 'requestSubmissionReviewAction');
  await form(history, owner, requestReview, { taskId, submissionId, revisionNumber: 1, expectedTaskVersion: (await db.prepare('SELECT version FROM tasks WHERE id=?').bind(taskId).first()).version, operationToken: randomUUID() });
  const active = await page('scope=review');
  check(active.includes('QUEUE_REVIEW_CARD') && active.includes('1건') && active.includes(`/submissions/${submissionId}?revision=1`), 'queue: exact actionable review row and count agree');
  for (const actor of [owner, actorCookies.admin, actorCookies.superuser]) check(!(await page('scope=review', actor)).includes('QUEUE_REVIEW_CARD'), 'queue: other reviewer queues remain personal even for administrators');
  const queueReturn = `/my-work?scope=mine&status=all&overdue=0&page=1&taskId=${taskId}#work-${taskId}`;
  const detail = await html(`/tasks?projectId=${projectId}&taskId=${taskId}&returnTo=${encodeURIComponent(queueReturn)}`, owner);
  check(detail.includes('내 업무로 돌아가기') && detail.includes('name="returnTo"') && detail.includes('value="' + queueReturn.replaceAll('&', '&amp;') + '"'), 'queue: task forms preserve canonical queue filter and selection');
  const badDetail = await html(`/tasks?projectId=${projectId}&taskId=${taskId}&returnTo=https%3A%2F%2Fexternal.invalid`, owner);
  check(!badDetail.includes('value="https://external.invalid"') && !badDetail.includes('href="https://external.invalid"'), 'queue: external return URL is discarded');
  for (const patch of ["reviewer_id=4", "review_revision_number=999", "assignee_id=3", "assignee_id=NULL"]) {
    await db.prepare('UPDATE tasks SET ' + patch + ' WHERE id=?').bind(taskId).run();
    check(!(await page('scope=review')).includes('QUEUE_REVIEW_CARD'), 'queue: invalidated reviewer/selection/self/assignment is not actionable');
    await db.prepare('UPDATE tasks SET reviewer_id=3,review_revision_number=1,assignee_id=2 WHERE id=?').bind(taskId).run();
  }
  await db.prepare("UPDATE users SET role='guest' WHERE id=3").run();
  check(!(await page('scope=review')).includes('QUEUE_REVIEW_CARD'), 'queue: same-cookie demotion removes review targets and counts');
  await db.prepare("UPDATE users SET role='member' WHERE id=3").run();
  await db.prepare("UPDATE submissions SET visibility='private' WHERE id=?").bind(submissionId).run();
  check(!(await page('scope=review')).includes('QUEUE_REVIEW_CARD'), 'queue: current private parent removes public historical review');
  await db.prepare("UPDATE submissions SET visibility='public' WHERE id=?").bind(submissionId).run();
  await db.prepare("UPDATE submission_revisions SET visibility='private' WHERE submission_id=? AND revision_number=1").bind(submissionId).run();
  check(!(await page('scope=review')).includes('QUEUE_REVIEW_CARD'), 'queue: private snapshot cannot be exposed by public parent');
  await db.prepare("UPDATE submission_revisions SET visibility='public' WHERE submission_id=? AND revision_number=1").bind(submissionId).run();
  await db.prepare("INSERT INTO comments(submission_id,revision_number,author_id,content) VALUES(?,1,3,'QUEUE_OWN_COMMENT'),(?,1,3,'QUEUE_DUPLICATE_COMMENT')").bind(submissionId, submissionId).run();
  const contributed = await page('scope=contributed&status=all');
  check((contributed.match(new RegExp(`id="work-${taskId}"`, 'g')) ?? []).length === 1, 'queue: multiple own comments contribute one task row');
  await db.prepare("UPDATE submissions SET visibility='private' WHERE id=?").bind(submissionId).run();
  check(!(await page('scope=contributed&status=all')).includes('QUEUE_REVIEW_CARD'), 'queue: comment authorship does not grant parent private access');
  await db.prepare("UPDATE submissions SET visibility='public' WHERE id=?").bind(submissionId).run();
  for (let index = 0; index < 23; index++) await db.prepare("INSERT INTO tasks(project_id,title,start_date,end_date,assignee_id) VALUES(?,?, '2026-01-01','2026-01-02',3)").bind(projectId, 'QUEUE_PAGED_' + String(index).padStart(2, '0')).run();
  const first = await page('scope=mine&status=all&page=1'), second = await page('scope=mine&status=all&page=2');
  check((first.match(/id="work-\d+"/g) ?? []).length === 20 && (second.match(/id="work-\d+"/g) ?? []).length >= 3, 'queue: SQL pagination bounds each page and preserves remaining rows');
  check(first.includes('QUEUE_PAGED_00') && !second.includes('QUEUE_PAGED_00'), 'queue: deterministic ordering avoids repeated first row');
  check((await page('scope=mine&status=all&overdue=1')).includes('QUEUE_PAGED_00'), 'queue: overdue filter uses actual incomplete status and due date');
}
