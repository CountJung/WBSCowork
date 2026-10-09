import {verifyP1Http} from "./verify-p1-http.mjs";
import {verifyPersonalWorkWorkflow} from "./verify-personal-work-http.mjs";
import {verifySubmissionReviewWorkflow} from "./verify-submission-review-http.mjs";
import {verifySubmissionRevisionWorkflow} from "./verify-submission-revisions-http.mjs";
import { seedSubmissionRevisionFixtures } from "./seed-submission-revision-fixture.mjs";
import { randomUUID } from "node:crypto";
/** Product P0 contracts on local synthetic D1/R2. Never invokes permanent deletion. */
export async function verifyTeamWorkflow(argumentsContext) {
  const {request,db,actorCookies,check}=argumentsContext;
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(2,'WORKFLOW_SECOND_PROJECT','2026-01-01','2026-12-31')").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id) VALUES(2,2,'WORKFLOW_SECOND_TASK','2026-01-01','2026-12-31',3)").run();
  for(const role of ['guest','member1','member2','admin','superuser']) {
    for(const projectId of [1,2,1]) {
      const response=await request(`/tasks?projectId=${projectId}`,actorCookies[role]);
      const html=await response.text();
      check(response.status===200,`workflow: ${role} can select project${projectId}`);
      check(html.includes('href="/tasks?projectId=1"')&&html.includes('href="/tasks?projectId=2"'),`workflow: ${role} has both project navigation links`);
      check(html.includes('href="/admin/projects"')===['admin','superuser'].includes(role),`workflow: ${role} project-management navigation boundary`);
      if(projectId===1)check(html.includes('Synthetic task')&&html.includes('PUBLIC_ONLY_83827'),`workflow: ${role} project1 task/content present on return`);
      check(html.includes('WORKFLOW_SECOND_TASK')===(projectId===2),`workflow: ${role} selected project matches task content`);
      if(projectId===2)check(!html.includes('PUBLIC_ONLY_83827')&&!html.includes('PRIVATE_OWNER1_83827')&&!html.includes('PRIVATE_OWNER2_83827'),`workflow: ${role} other project submissions absent`);
    }
    const direct=await(await request('/tasks?projectId=1&taskId=1',actorCookies[role])).text();
    check(direct.includes('홈에서 선택한 업무 상세')&&direct.includes('선택된 업무'),`workflow: ${role} matching direct link visibly selects a task`);
    const wrongScope=await(await request('/tasks?projectId=2&taskId=1',actorCookies[role])).text();
    check(!wrongScope.includes('홈에서 선택한 업무 상세')&&!wrongScope.includes('선택된 업무'),`workflow: ${role} cross-project task link does not focus another task`);
  }
  const anonymous=await request('/tasks?projectId=2');
  check(anonymous.status>=300&&anonymous.status<400, 'workflow: anonymous project selection still requires login');
  const admin=actorCookies.admin, member=actorCookies.member1;
  const renderedAction=(html,name)=> {
    const direct=[...html.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(m=>m[1]).find(id=>id.endsWith(`#${name}`));
    const ref=html.match(new RegExp(`([a-f0-9]+)#${name}[^A-Za-z]`))?.[1];
    const id=direct||(ref&&`$ACTION_ID_${ref}#${name}`);
    check(Boolean(id),`workflow: rendered ${name}`);return id;
  };
  async function form(route,cookie,id,fields,files=[]) {
    if(id.endsWith('#updateTaskAction')) { fields={...fields,version:fields.version??(await db.prepare('SELECT version FROM tasks WHERE id=?').bind(Number(fields.taskId)).first())?.version,operationToken:fields.operationToken??randomUUID()}; }
    if(id.endsWith('#createTaskAction')) fields={...fields,operationToken:fields.operationToken??randomUUID()};
    if(id.endsWith('#createSubmissionAction')) fields={...fields,operationToken:fields.operationToken??randomUUID()};
    if(id.endsWith('#updateSubmissionAction')||id.endsWith('#deleteSubmissionAttachmentAction')) fields={...fields,operationToken:fields.operationToken??randomUUID(),expectedRevision:fields.expectedRevision??(await db.prepare('SELECT current_revision FROM submissions WHERE id=?').bind(Number(fields.submissionId)).first())?.current_revision,changeSummary:fields.changeSummary??'Synthetic revised output'};
    const boundary='wbs-workflow-form',parts=[];
    for(const [key,value]of[[id,''],...Object.entries(fields)])parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    for(const file of files)parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="${file.name}"\r\nContent-Type: ${file.mime??'text/plain'}\r\n\r\n`),Buffer.from(file.bytes),Buffer.from('\r\n'));
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const response=await request(route,cookie,{method:'POST',headers:{Origin:argumentsContext.actionOrigin,'Content-Type':`multipart/form-data; boundary=${boundary}`},body:Buffer.concat(parts)});
    await response.text();check(response.status===303,`workflow: form response ${response.status}`);return response;
  }
  const adminHtml=await(await request('/admin/projects',admin)).text();
  const createProject=renderedAction(adminHtml,'createProjectAdminAction');
  const dates={startDate:'2026-01-01',endDate:'2026-12-31'};
  await form('/admin/projects',admin,createProject,{name:'WORKFLOW_GOALS',goal:'주제 목표',successCriteria:'성공 기준',...dates});
  const goals=await db.prepare("SELECT * FROM projects WHERE name='WORKFLOW_GOALS'").first();
  check(goals.goal==='주제 목표'&&goals.success_criteria==='성공 기준','workflow: project goals persist');
  const updateProject=renderedAction(await(await request('/admin/projects',admin)).text(),'updateProjectAdminAction');
  await form('/admin/projects',admin,updateProject,{projectId:goals.id,name:'WORKFLOW_GOALS',...dates});
  check((await db.prepare('SELECT goal,success_criteria FROM projects WHERE id=?').bind(goals.id).first()).goal==='주제 목표','workflow: omitted project goal fields preserve populated values');
  const route=`/tasks?projectId=${goals.id}`;
  const createTask=renderedAction(await(await request(route,member)).text(),'createTaskAction');
  await form(route,member,createTask,{projectId:goals.id,title:'GOAL_CARD',deliverable:'파일과 링크',definitionOfDone:'두 자료를 확인',reviewRequired:'1',...dates});
  const card=await db.prepare("SELECT * FROM tasks WHERE title='GOAL_CARD'").first();
  check(card.deliverable==='파일과 링크'&&card.definition_of_done==='두 자료를 확인'&&card.review_required===1,'workflow: card expected result, done criteria and review choice persist');
  const view=await(await request(route,actorCookies.guest)).text();
  check(view.includes('주제 목표')&&view.includes('성공 기준')&&view.includes('파일과 링크')&&view.includes('두 자료를 확인'),'workflow: guest can read permitted goal fields');
  const update=renderedAction(await(await request(route,member)).text(),'updateTaskAction');
  await form(route,member,update,{projectId:goals.id,taskId:card.id,title:'GOAL_CARD',deliverable:'<script>workflow_xss</script>',definitionOfDone:'수정 완료 기준',reviewRequired:'0',...dates});
  const updated=await db.prepare('SELECT * FROM tasks WHERE id=?').bind(card.id).first();
  check(updated.definition_of_done==='수정 완료 기준'&&updated.review_required===0,'workflow: card goals update');
  await form(route,member,update,{projectId:goals.id,taskId:card.id,title:'GOAL_CARD',...dates});
  const omitted=await db.prepare('SELECT deliverable,definition_of_done,review_required FROM tasks WHERE id=?').bind(card.id).first();
  check(omitted.deliverable===updated.deliverable&&omitted.definition_of_done===updated.definition_of_done&&omitted.review_required===updated.review_required,'workflow: omitted task goal fields preserve populated values');
  const escaped=await(await request(route,member)).text();
  check(!escaped.includes('<script>workflow_xss</script>')&&escaped.includes('&lt;script&gt;workflow_xss&lt;/script&gt;'),'workflow: goal text is escaped');
  await form(route,member,update,{projectId:goals.id,taskId:card.id,title:'TOO_LONG',deliverable:'x'.repeat(2001),...dates});
  check((await db.prepare('SELECT title,deliverable FROM tasks WHERE id=?').bind(card.id).first()).title==='GOAL_CARD','workflow: oversized goal leaves previous card intact');
  check((await db.prepare('SELECT goal,success_criteria FROM projects WHERE id=1').first()).goal===''&&(await db.prepare('SELECT deliverable,definition_of_done FROM tasks WHERE id=1').first()).definition_of_done==='','workflow: preexisting blank drafts remain unchanged');

  // Current membership, stable form tokens, optimistic versions and state/history atomicity.
  const readCard=()=>db.prepare('SELECT * FROM tasks WHERE id=?').bind(card.id).first();
  const history=()=>db.prepare('SELECT * FROM task_events WHERE task_id=? ORDER BY id').bind(card.id).all();
  const updateFields={projectId:goals.id,taskId:card.id,title:'GOAL_CARD',deliverable:'파일',definitionOfDone:'내용 확인',reviewRequired:'0',...dates};
  for(const assigneeId of [1,999999]) {
    const before=JSON.stringify(await readCard());await form(route,member,update,{...updateFields,assigneeId});
    check(JSON.stringify(await readCard())===before,'workflow: forged guest/missing assignment cannot change card');
  }
  await form(route,member,update,{...updateFields,assigneeId:2,reviewerId:3});
  check((await readCard()).assignee_id===2&&(await readCard()).reviewer_id===3,'workflow: eligible assignment and separate reviewer persist');
  check((await history()).results.some(e=>e.kind==='created')&&(await history()).results.at(-1).assignee_id===2,'workflow: initial and reassignment history retained');
  const selfBefore=JSON.stringify(await readCard());await form(route,member,update,{...updateFields,assigneeId:2,reviewerId:2});
  check(JSON.stringify(await readCard())===selfBefore,'workflow: self reviewer assignment rejected');
  const statusAction=renderedAction(await(await request(route,member)).text(),'changeTaskStatusAction');
  async function state(cookie,taskStatus,note='',overrides={}) {
    const row=await readCard();return form(route,cookie,statusAction,{projectId:goals.id,taskId:card.id,version:row.version,operationToken:randomUUID(),taskStatus,note,...overrides});
  }
  for(const cookie of [undefined,actorCookies.guest,actorCookies.member2]) {
    const before=JSON.stringify(await readCard());await state(cookie,'in_progress');check(JSON.stringify(await readCard())===before,'workflow: anonymous/guest/other owner cannot execute assigned task');
  }
  await state(member,'in_progress');check((await readCard()).status==='in_progress','workflow: assignee starts actual work');
  const beforeBlock=JSON.stringify(await readCard());await state(member,'blocked');check(JSON.stringify(await readCard())===beforeBlock,'workflow: blocking requires a reason');
  await state(admin,'blocked','외부 자료 대기');check((await readCard()).workflow_note==='외부 자료 대기','workflow: administrator can record a blocker');
  const concurrentVersion=(await readCard()).version;
  await Promise.all([state(member,'in_progress','재개',{version:concurrentVersion}),state(admin,'planned','재계획',{version:concurrentVersion})]);
  check((await readCard()).version===concurrentVersion+1,'workflow: concurrent different requests have one winner');
  const replayToken=randomUUID(),replayVersion=(await readCard()).version;
  await Promise.all([state(member,'in_progress','동일 요청',{version:replayVersion,operationToken:replayToken}),state(member,'in_progress','동일 요청',{version:replayVersion,operationToken:replayToken})]);
  check((await readCard()).version===replayVersion+1&&(await history()).results.filter(e=>e.operation_token.endsWith(replayToken)).length===1,'workflow: double submit preserves one state/history mutation');
  await state(member,'blocked','변경된 요청',{version:replayVersion,operationToken:replayToken});
  check((await readCard()).status==='in_progress','workflow: same token with changed payload is rejected');
  await form(route,member,update,{...updateFields,assigneeId:3,reviewerId:2});
  const reassigned=JSON.stringify(await readCard());await state(member,'blocked','old owner');check(JSON.stringify(await readCard())===reassigned,'workflow: former owner cannot execute after reassignment');
  await db.prepare("UPDATE users SET role='guest' WHERE id=3").run();
  await state(actorCookies.member2,'in_progress');check(JSON.stringify(await readCard())===reassigned,'workflow: role downgrade takes effect on same cookie');
  await db.prepare("UPDATE users SET role='member' WHERE id=3").run();
  const completionBefore=JSON.stringify(await readCard());await state(actorCookies.member2,'done','완료');check(JSON.stringify(await readCard())===completionBefore,'workflow: completion needs assignee submission evidence');
  await db.prepare("INSERT INTO submissions(task_id,author_id,content,visibility) VALUES(?,3,'WORKFLOW_EVIDENCE','private')").bind(card.id).run();
  await seedSubmissionRevisionFixtures(db);
  await state(actorCookies.member2,'done','완료 기준 확인');check((await readCard()).status==='done','workflow: no-review assignee completes with deliverable, criteria and evidence');
  const done=JSON.stringify(await readCard());await state(actorCookies.member2,'in_progress');check(JSON.stringify(await readCard())===done,'workflow: reopening completed work requires reason');
  await state(actorCookies.member2,'in_progress','추가 확인');check((await readCard()).status==='in_progress','workflow: reasoned reopen retains completion history');
  await state(actorCookies.member2,'review_pending');check((await readCard()).status==='in_progress','workflow: review states cannot be forged through execution action');
  const futureSnapshot=JSON.stringify(await readCard());await state(actorCookies.member2,'blocked','future forged',{version:(await readCard()).version+1});check(JSON.stringify(await readCard())===futureSnapshot,'workflow: future task version is rejected before transition');
  await state(actorCookies.member2,'planned','계획 조정');
  await form(route,member,update,{...updateFields,assigneeId:3,reviewerId:2,reviewRequired:'1'});
  check((await readCard()).review_required===0,'workflow: returning to planned cannot rewrite started review policy');
  const rows=(await history()).results;check(rows.every((e,i)=>i===0||e.task_version>rows[i-1].task_version)&&rows.at(-1).task_version===(await readCard()).version,'workflow: state/version/history remain consistent');
  const privateView=await(await request(route,member)).text();check(!privateView.includes('WORKFLOW_EVIDENCE'),'workflow: assignment does not grant other-member private access');
  const creationToken=randomUUID(),creation={projectId:goals.id,title:'WORKFLOW_ONCE',assigneeId:2,operationToken:creationToken,...dates};
  await Promise.all([form(route,member,createTask,creation),form(route,member,createTask,creation)]);
  check((await db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE title='WORKFLOW_ONCE'").first()).n===1,'workflow: repeated task creation is idempotent');
  await db.prepare("CREATE TRIGGER reject_synthetic_history BEFORE INSERT ON task_events WHEN NEW.task_id IN (SELECT id FROM tasks WHERE title='WORKFLOW_ROLLBACK') BEGIN SELECT RAISE(ABORT,'synthetic history fault'); END").run();
  await form(route,member,createTask,{projectId:goals.id,title:'WORKFLOW_ROLLBACK',...dates});
  check(!(await db.prepare("SELECT id FROM tasks WHERE title='WORKFLOW_ROLLBACK'").first()),'workflow: history failure rolls back task creation atomically');
  await verifySubmissionRevisionWorkflow({...argumentsContext,form,renderedAction,route,projectId:goals.id,taskId:card.id});
  await verifySubmissionReviewWorkflow({...argumentsContext,form,renderedAction,route,projectId:goals.id});
  await verifyPersonalWorkWorkflow({...argumentsContext,form,renderedAction,route,projectId:goals.id});
  await verifyP1Http({...argumentsContext,form,renderedAction,route,projectId:goals.id});

}
