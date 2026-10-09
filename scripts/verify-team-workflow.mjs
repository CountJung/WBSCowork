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
  async function form(route,cookie,id,fields) {
    const boundary='wbs-workflow-form';let body='';
    for(const [key,value]of[[id,''],...Object.entries(fields)])body+=`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    body+=`--${boundary}--\r\n`;
    const response=await request(route,cookie,{method:'POST',headers:{Origin:argumentsContext.actionOrigin,'Content-Type':`multipart/form-data; boundary=${boundary}`},body});
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

}
