/** Product P0 contracts on local synthetic D1/R2. Never invokes permanent deletion. */
export async function verifyTeamWorkflow({ request, db, actorCookies, check }) {
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
}
