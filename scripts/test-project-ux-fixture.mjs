/** Synthetic-only shared fixture for isolated Worker and Native browser acceptance. */
export async function seedProjectUx(db,{encode,secret,putFile}){
  const actors=[{id:1,name:'합성 슈퍼관리자',role:'admin'},{id:2,name:'긴한국어담당자이름'.repeat(8),role:'member'},{id:3,name:'합성 검토자',role:'member'},{id:4,name:'합성 외부 사용자',role:'member'},{id:5,name:'합성 읽기 사용자',role:'guest'},{id:6,name:'합성 지정 관리자',role:'admin'},{id:7,name:'합성 미지정 관리자',role:'admin'}];
  const tokens={};
  for(const actor of actors){
    const email=`project-ux-${actor.id}@example.test`;
    await db.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').bind(actor.id,email,actor.name,actor.role).run();
    tokens[actor.id]=await encode({secret,token:{email,name:actor.name},maxAge:3600});
  }
  const projectName='긴한국어 프로젝트: 식사 준비·안전 점검·협업 일정과 하위 업무를 확인하는 합성 공간';
  await db.prepare("INSERT INTO projects(id,name,project_type,goal,success_criteria,start_date,end_date) VALUES(1,?,'volunteering',?,?,'2026-01-01','2026-12-31')").bind(projectName,'안전한 합성 업무의 프로젝트 중심 요약과 상세 이동을 확인합니다. '.repeat(5),'긴 제목·요건·칩이 겹치지 않고 모든 화면 폭에서 같은 권한과 자료를 유지합니다.').run();
  await db.prepare("INSERT INTO projects(id,name,project_type,start_date,end_date) VALUES(2,'합성 기존 협업 프로젝트','collaboration','2026-01-01','2026-12-31'),(3,'합성 빈 프로젝트','collaboration','2026-01-01','2026-12-31')").run();
  for(const project of [1,2,3])for(const user of [2,3])await db.prepare('INSERT INTO project_members(project_id,user_id) VALUES(?,?)').bind(project,user).run();
  await db.prepare('INSERT INTO project_members(project_id,user_id) VALUES(1,5),(1,6)').run();
  for(const [team,name,kind] of [[1,'식사준비·안전 점검·긴한국어 팀 이름','meal'],[2,'시설보수·자재 분류·긴한국어 팀 이름','facility']])await db.prepare('INSERT INTO activity_teams(id,project_id,name,activity_kind) VALUES(?,1,?,?)').bind(team,name,kind).run();
  for(const [team,user,role] of [[1,2,'leader'],[1,3,'member'],[2,3,'leader'],[2,2,'member']])await db.prepare('INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1,?,?,?)').bind(team,user,role).run();
  for(const [team,user] of [[1,2],[2,3]])await db.prepare('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(?,1,?)').bind(team,user).run();
  const taskTitle='긴한국어업무제목_식사준비와안전점검에필요한준비물및역할을확인합니다_'.repeat(3);
  for(const [id,project,team,parent,title,mode,review] of [[1,1,1,null,taskTitle,'direct_completion',0],[2,1,1,1,'하위 업무: 식기 분류와 준비 공간 점검','direct_completion',0],[3,1,2,null,'시설보수 제출필수 업무','submission_required',0],[4,1,null,null,'공통 검토필수 업무','submission_required',1],[5,2,null,null,'기존 협업 제출필수 업무','submission_required',0]])await db.prepare("INSERT INTO tasks(id,project_id,activity_team_id,parent_id,title,description,deliverable,definition_of_done,completion_mode,review_required,start_date,end_date,assignee_id,reviewer_id,depth) VALUES(?,?,?,?,?,?,?,?,?,?,'2026-01-01','2026-12-31',2,3,?)").bind(id,project,team,parent,title,'TASK_FULL_TEXT_ONLY_IN_DETAIL: 상세에서만 보이는 긴 설명입니다. '.repeat(10),'합성 결과와 필요한 첨부를 확인합니다.','계획한 합성 확인 항목을 모두 확인합니다.',mode,review,parent?1:0).run();
  await db.prepare("UPDATE tasks SET status='done',completed_by=2,completed_at=CURRENT_TIMESTAMP WHERE id=2").run();
  await db.prepare('INSERT INTO task_dependencies(project_id,task_id,predecessor_id) VALUES(1,3,2)').run();
  for(const [id,author,visibility,content] of [[1,2,'public','PUBLIC_FULL_TEXT_ONLY_IN_DETAIL: 업무 결과를 설명하는 긴한국어본문입니다. '.repeat(20)],[2,3,'private','PRIVATE_OTHER_AUTHOR_NOT_VISIBLE_TO_MEMBER']]){
    await db.prepare('INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(?,1,?,?,?)').bind(id,author,content,visibility).run();
    await db.prepare('INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(?,1,?,?,?)').bind(id,author,content,visibility).run();
  }
  const filename='아주긴한국어파일명_시설점검체크리스트와활동사진설명_'.repeat(5)+'.txt';
  const filekey='synthetic/project-ux-long-filename.txt';
  const bytes=Buffer.from('SYNTHETIC PROJECT UX FILE');
  await putFile(filekey,bytes);
  await db.prepare("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(1,1,1,?,?,'text/plain',?)").bind(filekey,filename,bytes.length).run();
  await db.prepare("INSERT INTO comments(id,submission_id,revision_number,author_id,content) VALUES(1,1,1,3,'COMMENT_FULL_TEXT_ONLY_IN_DETAIL: 합성 댓글의 긴 한국어 의견입니다.')").run();
  for(const [id,name,assignee] of [[101,'합성 소속 범위 A',6],[102,'합성 소속 범위 B',3]]){
    await db.prepare("INSERT INTO projects(id,name,project_type,start_date,end_date) VALUES(?,?,'collaboration','2026-01-01','2026-12-31')").bind(id,name).run();
    await db.prepare("INSERT INTO tasks(id,project_id,title,description,deliverable,definition_of_done,start_date,end_date,assignee_id) VALUES(?,?,?,?,'합성 결과','합성 기준','2026-01-01','2026-12-31',?)").bind(id,id,`BINDING_TASK_${id}`,`BINDING_DESCRIPTION_${id}`,assignee).run();
  }
  for(const [id,task,author,visibility,content] of [[101,101,2,'public','BINDING_PUBLIC_A'],[102,101,2,'private','BINDING_OWN_PRIVATE_A'],[103,102,3,'public','BINDING_PUBLIC_B']]){
    await db.prepare('INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(?,?,?,?,?)').bind(id,task,author,content,visibility).run();
    await db.prepare('INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(?,1,?,?,?)').bind(id,author,content,visibility).run();
    const key=`synthetic/project-ux-binding-${id}.txt`,value=Buffer.from(`SYNTHETIC BINDING ${id}`);
    await putFile(key,value);
    await db.prepare("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,?,1,?,?,'text/plain',?)").bind(id,id,key,`합성소속-${id}.txt`,value.length).run();
  }
  for(const task of [601,602]){
    await db.prepare("INSERT INTO tasks(id,project_id,title,description,deliverable,definition_of_done,review_required,status,start_date,end_date,assignee_id,reviewer_id,completed_by,completed_at,review_submission_id,review_revision_number) VALUES(?,2,?,'승인 완료 후 재개 확인','합성 제출물','검토 승인',1,'done','2026-01-01','2026-12-31',2,3,3,CURRENT_TIMESTAMP,?,1)").bind(task,`합성 검토 승인 완료 ${task}`,task).run();
    await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(?,?,2,'SYNTHETIC APPROVED COMPLETION','public')").bind(task,task).run();
    await db.prepare("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(?,1,2,'SYNTHETIC APPROVED COMPLETION','public')").bind(task).run();
    await db.prepare("INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,task_version,note) VALUES(?,3,?,?,'baseline','done',1,'Synthetic approved baseline')").bind(task,`synthetic-review-${task}-baseline`,'0'.repeat(64)).run();
    await db.prepare("INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body) VALUES(?,1,3,?,?,'approved','Synthetic fixture approval')").bind(task,`synthetic-review-${task}-approved`,'0'.repeat(64)).run();
  }
  return {tokens,projectName,taskTitle,filename,filekey,bytes};
}
