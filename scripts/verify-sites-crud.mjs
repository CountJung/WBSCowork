/** Isolated workerd HTTP lifecycle using only synthetic D1/R2 and signed test actors. */
export async function verifySitesCrud({ request, db, bucket, actorCookies, actionOrigin, check }) {
  const admin = actorCookies.admin, member = actorCookies.member1, other = actorCookies.member2;
  const html = async (route, cookie=member) => (await request(route,cookie)).text();
  const action = (markup, name) => {
    let id = [...markup.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(m=>m[1]).find(id=>id.endsWith(`#${name}`));
    // Client-only edit dialogs serialize their action reference in the rendered RSC payload.
    if (!id) {
      const reference = markup.match(new RegExp(`([a-f0-9]+)#${name}[^A-Za-z]`))?.[1];
      if (reference) id = `$ACTION_ID_${reference}#${name}`;
    }
    check(Boolean(id), `CRUD rendered action reference exposes ${name}`);
    return id;
  };
  async function submit(route, cookie, actionId, fields, files=[]) {
    const boundary='wbs-crud-fixture';
    let body='';
    for(const [name,value] of [[actionId,''],...Object.entries(fields)]) body+=`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    for(const file of files) body+=`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="${file.name}"\r\nContent-Type: text/plain\r\n\r\n${file.content}\r\n`;
    body+=`--${boundary}--\r\n`;
    const response=await request(route,cookie,{method:'POST',headers:{Origin:actionOrigin,'Content-Type':`multipart/form-data; boundary=${boundary}`},body});
    await response.text();
    return response;
  }
  const dates={startDate:'2026-01-01',endDate:'2026-12-31'};
  let page=await html('/admin/projects',admin);
  const createProject=action(page,'createProjectAdminAction');
  await submit('/admin/projects',member,createProject,{name:'FORBIDDEN_PROJECT',...dates});
  check(!(await db.prepare("SELECT id FROM projects WHERE name='FORBIDDEN_PROJECT'").first()),'member cannot invoke admin project create action');
  await submit('/admin/projects',admin,createProject,{name:'CRUD_SYNTHETIC_PROJECT',...dates});
  let project=await db.prepare("SELECT id FROM projects WHERE name='CRUD_SYNTHETIC_PROJECT'").first();
  check(Boolean(project),'admin project creation persists through actual Worker action');
  const projectId=project.id, route=`/tasks?projectId=${projectId}`;
  page=await html('/admin/projects',admin);
  const updateProject=action(page,'updateProjectAdminAction'),deleteProject=action(page,'deleteProjectAdminAction');
  await submit('/admin/projects',admin,updateProject,{projectId,name:'CRUD_PROJECT_EDITED',...dates});
  check((await html('/admin/projects',admin)).includes('CRUD_PROJECT_EDITED'),'project edit is visible after fresh server render');
  await submit('/admin/projects',admin,deleteProject,{projectId});
  check(Boolean(await db.prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first()),'project destruction without explicit checkbox is rejected');
  page=await html(route);
  const createTask=action(page,'createTaskAction');
  await submit(route,member,createTask,{projectId,title:'CRUD_PARENT',description:'Synthetic parent',...dates});
  const parent=await db.prepare("SELECT id FROM tasks WHERE project_id=? AND title='CRUD_PARENT'").bind(projectId).first();
  check(Boolean(parent),'member task creation persists through Worker action');
  await submit(route,member,createTask,{projectId,parentId:parent.id,title:'CRUD_CHILD',...dates});
  const child=await db.prepare("SELECT id,depth,parent_id FROM tasks WHERE project_id=? AND title='CRUD_CHILD'").bind(projectId).first();
  check(child?.parent_id===parent.id&&child.depth===1,'nested task parent and depth persist');
  page=await html(route);
  const updateTask=action(page,'updateTaskAction'),deleteTask=action(page,'deleteTaskAction');
  await submit(route,member,updateTask,{projectId,taskId:child.id,title:'CRUD_CHILD_EDITED',parentId:parent.id,...dates});
  check((await html(route)).includes('CRUD_CHILD_EDITED'),'task edit survives refreshed server rendering');
  await submit(route,actorCookies.guest,deleteTask,{projectId,taskId:child.id});
  check(Boolean(await db.prepare('SELECT id FROM tasks WHERE id=?').bind(child.id).first()),'guest cannot invoke task deletion');
  page=await html(route);
  const createSubmission=action(page,'createSubmissionAction');
  const scope={projectId,taskId:parent.id};
  await submit(route,member,createSubmission,{...scope,content:'CRUD_PRIVATE_SUBMISSION',visibility:'private'},[{name:'same-name.txt',content:'PRIVATE_ATTACHMENT_ONE'}]);
  const submission=await db.prepare("SELECT id FROM submissions WHERE content='CRUD_PRIVATE_SUBMISSION'").first();
  check(Boolean(submission),'private submission and upload commit via Worker multipart action');
  const subScope={...scope,submissionId:submission.id};
  let attachments=(await db.prepare('SELECT * FROM submission_attachments WHERE submission_id=?').bind(submission.id).all()).results;
  check(attachments.length===1&&(await bucket.get(attachments[0].file_path))!==null,'committed attachment has R2 bytes');
  check((await request(`/api/submission-attachments/${attachments[0].id}`,other)).status===404,'other member cannot download freshly uploaded private file');
  check((await(await request(`/api/submission-attachments/${attachments[0].id}`,member)).text())==='PRIVATE_ATTACHMENT_ONE','owner downloads exact fresh attachment bytes');
  page=await html(route);
  const updateSubmission=action(page,'updateSubmissionAction'),deleteSubmission=action(page,'deleteSubmissionAction'),createComment=action(page,'createCommentAction');
  await submit(route,other,updateSubmission,{...subScope,content:'FORBIDDEN_SUBMISSION_EDIT',visibility:'public'});
  check((await db.prepare('SELECT content,visibility FROM submissions WHERE id=?').bind(submission.id).first()).content==='CRUD_PRIVATE_SUBMISSION','cross-user private submission edit is rejected');
  await submit(route,member,updateSubmission,{...subScope,content:'CRUD_PRIVATE_EDITED',visibility:'private'},[{name:'same-name.txt',content:'PRIVATE_ATTACHMENT_TWO'}]);
  attachments=(await db.prepare('SELECT * FROM submission_attachments WHERE submission_id=? ORDER BY id').bind(submission.id).all()).results;
  check(attachments.length===2&&attachments[0].file_path!==attachments[1].file_path,'repeated filename on edit creates independent attachment');
  check((await html(route)).includes('CRUD_PRIVATE_EDITED')&&!(await html(route,other)).includes('CRUD_PRIVATE_EDITED'),'fresh render keeps edited submission private');
  await submit(route,other,createComment,{...subScope,content:'FORBIDDEN_COMMENT'});
  check(!(await db.prepare("SELECT id FROM comments WHERE content='FORBIDDEN_COMMENT'").first()),'other member cannot comment on private submission');
  await submit(route,member,createComment,{...subScope,content:'CRUD_COMMENT'});
  const comment=await db.prepare("SELECT id FROM comments WHERE content='CRUD_COMMENT'").first();
  check(Boolean(comment),'owner comment creation persists');
  page=await html(route);
  const updateComment=action(page,'updateCommentAction'),deleteComment=action(page,'deleteCommentAction');
  await submit(route,other,updateComment,{...subScope,commentId:comment.id,content:'FORBIDDEN_COMMENT_EDIT'});
  check((await db.prepare('SELECT content FROM comments WHERE id=?').bind(comment.id).first()).content==='CRUD_COMMENT','cross-user comment edit is rejected');
  await submit(route,member,updateComment,{...subScope,commentId:comment.id,content:'CRUD_COMMENT_EDITED'});
  check((await html(route)).includes('CRUD_COMMENT_EDITED'),'comment update appears in fresh render');
  await submit(route,member,deleteComment,{...subScope,commentId:comment.id});
  check(!(await db.prepare('SELECT id FROM comments WHERE id=?').bind(comment.id).first()),'owner comment deletion removes synthetic record');
  await submit(route,member,deleteSubmission,subScope);
  check(!(await db.prepare('SELECT id FROM submissions WHERE id=?').bind(submission.id).first()),'owner submission deletion removes synthetic metadata');
  check((await Promise.all(attachments.map(a=>bucket.head(a.file_path)))).every(value=>value===null),'submission deletion cleans every synthetic private object');
  await submit(route,member,deleteTask,{projectId,taskId:parent.id});
  const detached=await db.prepare('SELECT parent_id,depth FROM tasks WHERE id=?').bind(child.id).first();
  check(detached?.parent_id===null&&detached.depth===0,'deleting parent re-roots child with correct depth');
  await submit('/admin/projects',admin,deleteProject,{projectId,confirmDestruction:'yes'});
  check(!(await db.prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first())&&!(await db.prepare('SELECT id FROM tasks WHERE project_id=?').bind(projectId).first()),'confirmed synthetic project destruction cascades remaining tasks');
  check(Boolean(await db.prepare('SELECT id FROM projects WHERE id=1').first()),'isolated lifecycle leaves original test project intact');
}
