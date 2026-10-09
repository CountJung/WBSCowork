import {randomUUID} from 'node:crypto';
/** Ordinary local synthetic P1 requests; no purge, external network, or cleanup race. */
export async function verifyP1Http(ctx){
 const {request,db,actorCookies,check,form,renderedAction,route,projectId}=ctx;
 const member=actorCookies.member1;
 let html=await(await request(route,member)).text();
 const create=renderedAction(html,'createTaskAction');
 for(const title of ['P1_PREDECESSOR','P1_SUCCESSOR'])await form(route,member,create,{projectId,title,assigneeId:2,deliverable:'result',definitionOfDone:'verified',startDate:'2026-01-01',endDate:'2026-01-02'});
 const a=await db.prepare("SELECT * FROM tasks WHERE title='P1_PREDECESSOR'").first(),b=await db.prepare("SELECT * FROM tasks WHERE title='P1_SUCCESSOR'").first();
 html=await(await request(route,member)).text();
 const dependency=renderedAction(html,'setTaskPredecessorsAction');
 const read=()=>db.prepare('SELECT * FROM tasks WHERE id=?').bind(b.id).first();
 const graph=()=>db.prepare('SELECT dependency_version v FROM projects WHERE id=?').bind(projectId).first();
 const fields={taskId:b.id,version:b.version,graphVersion:(await graph()).v,predecessorId:a.id,operationToken:randomUUID()};
 await form(route,actorCookies.guest,dependency,fields);
 check((await read()).version===b.version,'P1 HTTP guest cannot edit dependency');
 await form(route,member,dependency,fields);await form(route,member,dependency,fields);
 check((await db.prepare('SELECT COUNT(*) n FROM task_dependencies WHERE task_id=?').bind(b.id).first()).n===1,'P1 HTTP repeated dependency edit one edge');
 html=await(await request(route,actorCookies.guest)).text();
 check(html.includes('미완료 선행 업무')&&html.includes('P1_PREDECESSOR')&&html.includes('다음 행동이 필요한 업무'),'P1 HTTP dependency reason and summary visible');
 const change=renderedAction(await(await request(route,member)).text(),'changeTaskStatusAction');
 await form(route,member,change,{projectId,taskId:b.id,version:(await read()).version,operationToken:randomUUID(),taskStatus:'in_progress',note:'start'});
 check((await read()).status==='planned','P1 HTTP direct start respects dependency guard');
 await form(route,member,dependency,{...fields,taskId:a.id,version:a.version,graphVersion:(await graph()).v,predecessorId:b.id,operationToken:randomUUID()});
 check((await db.prepare('SELECT COUNT(*) n FROM task_dependencies WHERE task_id=?').bind(a.id).first()).n===0,'P1 HTTP cycle rejected');
 const other=await db.prepare('SELECT id FROM tasks WHERE project_id<>? LIMIT 1').bind(projectId).first();
 await form(route,member,dependency,{...fields,version:(await read()).version,graphVersion:(await graph()).v,predecessorId:other.id,operationToken:randomUUID()});
 check((await db.prepare('SELECT predecessor_id id FROM task_dependencies WHERE task_id=?').bind(b.id).first()).id===a.id,'P1 HTTP cross-project reference leaves graph unchanged');
 const templateAction=renderedAction(await(await request(route,member)).text(),'applyTaskTemplateAction');
 const node={key:'scope',parentKey:null,title:'P1_HTTP_TEMPLATE',description:'plain template description',deliverable:'file',definitionOfDone:'checked',assigneeId:2,startDate:'2026-01-01',endDate:'2026-01-02'};
 const templateFields={projectId,templateKey:'delivery',templateVersion:1,nodes:JSON.stringify([node]),operationToken:randomUUID()};
 await form(route,member,templateAction,templateFields);await form(route,member,templateAction,templateFields);
 check((await db.prepare("SELECT COUNT(*) n FROM tasks WHERE title='P1_HTTP_TEMPLATE'").first()).n===1,'P1 HTTP template replay creates one chosen card');
 const templateCard=await db.prepare("SELECT * FROM tasks WHERE title='P1_HTTP_TEMPLATE'").first();
 check(templateCard.assignee_id===2&&templateCard.status==='planned'&&templateCard.review_required===0,'P1 HTTP preview fields persist without role/review grants');

 const createSubmission=renderedAction(await(await request(route,member)).text(),'createSubmissionAction');
 for(const [cookie,visibility,content]of[[member,'public','P1_SSR_PUBLIC'],[member,'private','P1_SSR_PRIVATE_ONE'],[actorCookies.member2,'private','P1_SSR_PRIVATE_TWO']])await form(route,cookie,createSubmission,{projectId,taskId:b.id,visibility,content});
 for(const role of ['guest','member1','member2','admin','superuser']){
  const response=await request('/search?q=P1_SSR&kind=submission',actorCookies[role]);const content=await response.text();
  check(response.status===200&&content.includes('P1_SSR_PUBLIC'),'P1 search '+role+' public result');
  check(content.includes('P1_SSR_PRIVATE_ONE')===['member1','admin','superuser'].includes(role),'P1 search '+role+' private owner1 SSR boundary');
  check(content.includes('P1_SSR_PRIVATE_TWO')===['member2','admin','superuser'].includes(role),'P1 search '+role+' private owner2 SSR boundary');
 }
 const anonymous=await request('/search?q=P1_SSR');check(anonymous.status>=300&&anonymous.status<400,'P1 anonymous search redirects before data');
 const malformed=await(await request('/search?page=1001',member)).text();check(malformed.includes('검색 페이지 범위')&&!malformed.includes('P1_SSR_PRIVATE_ONE'),'P1 invalid search does not execute data query');

}
