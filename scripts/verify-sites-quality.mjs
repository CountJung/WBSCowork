import { randomUUID } from "node:crypto";
/** QLT-011: isolated synthetic writes/reads; never invokes delete, purge, DROP or TRUNCATE. */
export async function verifySitesQuality({ request, db, bucket, actorCookies, actionOrigin, check }) {
  const admin = actorCookies.admin, member = actorCookies.member1;
  const page = async (route, cookie=member) => (await request(route, cookie)).text();
  const action = (markup, name) => {
    const rendered = [...markup.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(m => m[1]).find(id => id.endsWith(`#${name}`));
    const reference = markup.match(new RegExp(`([a-f0-9]+)#${name}[^A-Za-z]`))?.[1];
    const id = rendered ?? (reference && `$ACTION_ID_${reference}#${name}`);
    check(Boolean(id), `quality: rendered ${name}`); return id;
  };
  async function submit(route, cookie, actionId, fields, files=[]) {
    if(actionId.endsWith('#updateTaskAction')) { fields={...fields,version:fields.version??(await db.prepare('SELECT version FROM tasks WHERE id=?').bind(Number(fields.taskId)).first())?.version,operationToken:fields.operationToken??randomUUID()}; }
    if(actionId.endsWith('#createTaskAction')) fields={...fields,operationToken:fields.operationToken??randomUUID()};
    const boundary = 'wbs-quality-fixture'; const parts=[];
    for (const [name,value] of [[actionId,''], ...Object.entries(fields)]) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    for (const file of files) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="${file.name}"\r\nContent-Type: ${file.mime ?? 'text/plain'}\r\n\r\n`), Buffer.from(file.bytes ?? 'fixture'), Buffer.from('\r\n'));
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const response = await request(route,cookie,{method:'POST',headers:{Origin:actionOrigin,'Content-Type':`multipart/form-data; boundary=${boundary}`},body:Buffer.concat(parts)});
    await response.text();
    check(response.status >= 200 && response.status < 400, `quality: action responds normally (${response.status})`);
    return response;
  }
  const dates={startDate:'2026-01-01',endDate:'2026-12-31'};
  let markup=await page('/admin/projects',admin);
  const createProject=action(markup,'createProjectAdminAction'), updateProject=action(markup,'updateProjectAdminAction');
  for (const [startDate,endDate] of [['2026-03-02','2026-03-01'],['2026-02-29','2026-12-31'],['0000-invalid','2026-12-31'],['2026-04-31','2026-12-31']]) {
    const rejected = await submit('/admin/projects',admin,createProject,{name:'QUALITY_INVALID_PROJECT',startDate,endDate});
    check((rejected.headers.get('location') ?? rejected.headers.get('x-action-redirect') ?? '').includes('status=error'),'quality: invalid project reports validation error');
    check(!(await db.prepare("SELECT id FROM projects WHERE name='QUALITY_INVALID_PROJECT'").first()),`quality: bad project dates ${startDate} rejected`);
  }
  await submit('/admin/projects',admin,createProject,{name:'QUALITY_PROJECT',startDate:'2024-02-29',endDate:'2024-02-29'});
  const project=await db.prepare("SELECT * FROM projects WHERE name='QUALITY_PROJECT'").first();
  check(project?.start_date==='2024-02-29'&&project.end_date==='2024-02-29','quality: same-day leap project accepted');
  const invalidEdit = await submit('/admin/projects',admin,updateProject,{projectId:project.id,name:'INVALID_EDIT',startDate:'2026-02-30',endDate:'2026-12-31'});
  check((invalidEdit.headers.get('location') ?? invalidEdit.headers.get('x-action-redirect') ?? '').includes('status=error'),'quality: invalid project edit reports validation error');
  check((await db.prepare('SELECT name FROM projects WHERE id=?').bind(project.id).first()).name==='QUALITY_PROJECT','quality: invalid project update leaves original intact');
  await submit('/admin/projects',admin,updateProject,{projectId:project.id,name:'QUALITY_PROJECT_EDITED',...dates});
  check((await db.prepare('SELECT name FROM projects WHERE id=?').bind(project.id).first()).name==='QUALITY_PROJECT_EDITED','quality: valid project update persists through canonical action');
  const projectId=project.id, route=`/tasks?projectId=${projectId}`;
  markup=await page(route); const createTask=action(markup,'createTaskAction');
  for(const [title,parentId]of[['ROOT',''],['CHILD','ROOT'],['GRANDCHILD','CHILD'],['OTHER','']]) {
    const parent=parentId?await db.prepare('SELECT id FROM tasks WHERE project_id=? AND title=?').bind(projectId,parentId).first():null;
    await submit(route,member,createTask,{projectId,title,...dates,...(parent?{parentId:parent.id}:{})});
  }
  const task = async title => db.prepare('SELECT * FROM tasks WHERE project_id=? AND title=?').bind(projectId,title).first();
  const root=await task('ROOT'),child=await task('CHILD'),grand=await task('GRANDCHILD'),other=await task('OTHER');
  check(root.depth===0&&child.depth===1&&grand.depth===2,'quality: three-level hierarchy depths');
  check(root.order_index<child.order_index&&child.order_index<grand.order_index&&grand.order_index<other.order_index,'quality: sequential order allocation');
  markup=await page(route);const updateTask=action(markup,'updateTaskAction');
  for(const parentId of [root.id,grand.id,1]) {
    await submit(route,member,updateTask,{projectId,taskId:root.id,title:'ROOT',parentId,...dates});
    check((await task('ROOT')).parent_id===null,`quality: self/descendant/cross-project parent ${parentId} rejected`);
  }
  await submit(route,member,updateTask,{projectId:1,taskId:root.id,title:'FORGED_SCOPE',...dates});
  check(Boolean(await task('ROOT'))&&!(await task('FORGED_SCOPE')),'quality: task/project mismatch rejects update without changing task');
  for(const [startDate,endDate]of[['2026-03-02','2026-03-01'],['2026-02-29','2026-12-31'],['bad-date','2026-12-31']]) {
    await submit(route,member,createTask,{projectId,title:'INVALID_TASK',startDate,endDate});
    await submit(route,member,updateTask,{projectId,taskId:child.id,title:'INVALID_TASK',startDate,endDate});
    check(!(await task('INVALID_TASK'))&&(await task('CHILD')).start_date===dates.startDate,`quality: invalid task create/update ${startDate} leaves rows intact`);
  }
  await submit(route,member,updateTask,{projectId,taskId:child.id,title:'CHILD',parentId:other.id,...dates});
  check((await task('CHILD')).parent_id===other.id&&(await task('GRANDCHILD')).depth===2,'quality: move subtree preserves descendant depth');
  await submit(route,member,updateTask,{projectId,taskId:child.id,title:'CHILD',...dates});
  check((await task('CHILD')).depth===0&&(await task('GRANDCHILD')).depth===1&&(await task('CHILD')).order_index===child.order_index,'quality: detach subtree recalculates depth without changing order');
  const createSubmission=action(await page(route),'createSubmissionAction');
  const scope={projectId,taskId:root.id,visibility:'private'};
  const snapshot=async()=>JSON.stringify({submissions:(await db.prepare('SELECT COUNT(*) AS n FROM submissions').first()).n,attachments:(await db.prepare('SELECT COUNT(*) AS n FROM submission_attachments').first()).n,objects:(await bucket.list()).objects.length});
  for(const [label,files]of[
    ['21 files',Array.from({length:21},(_,i)=>({name:`f${i}.txt`,bytes:'x'}))],
    ['file limit+1',[{name:'oversize.bin',bytes:Buffer.alloc(20*1024*1024+1)}]],
    ['aggregate limit+2',[{name:'one.bin',bytes:Buffer.alloc(10*1024*1024+1)},{name:'two.bin',bytes:Buffer.alloc(10*1024*1024+1)}]],
  ]) {
    const before=await snapshot();await submit(route,member,createSubmission,{...scope,content:`INVALID_UPLOAD_${label}`},files);
    check(await snapshot()===before,`quality: ${label} rejects without partial metadata or objects`);
  }
  await submit(route,member,createSubmission,{...scope,content:'QUALITY_20_FILES'},Array.from({length:20},(_,i)=>({name:`f${i}.txt`,bytes:'x'})));
  const accepted=await db.prepare("SELECT id FROM submissions WHERE content='QUALITY_20_FILES'").first();
  check(Boolean(accepted)&&(await db.prepare('SELECT COUNT(*) AS n FROM submission_attachments WHERE submission_id=?').bind(accepted.id).first()).n===20,'quality: 20 small attachments accepted');
  await submit(route,member,createSubmission,{...scope,content:'QUALITY_MAX_FILE'},[{name:'max.bin',bytes:Buffer.alloc(20*1024*1024)}]);
  check((await db.prepare("SELECT sa.file_size_bytes AS n FROM submission_attachments sa JOIN submissions s ON sa.submission_id=s.id WHERE s.content='QUALITY_MAX_FILE'").first())?.n===20*1024*1024,'quality: exact 20MiB accepted');
  const updateSubmission=action(await page(route),'updateSubmissionAction');
  await submit(route,member,updateSubmission,{...scope,submissionId:accepted.id,content:'QUALITY_20_FILES_EDITED'},[{name:'edit.txt',bytes:'edited'}]);
  check((await db.prepare('SELECT content FROM submissions WHERE id=?').bind(accepted.id).first()).content==='QUALITY_20_FILES_EDITED'&&(await db.prepare('SELECT COUNT(*) AS n FROM submission_attachments WHERE submission_id=?').bind(accepted.id).first()).n===21,'quality: valid submission edit adds a file and preserves earlier attachments');
  const beforeUpdate=await snapshot();
  const rejectedEdit = await submit(route,member,updateSubmission,{...scope,submissionId:accepted.id,content:'REJECTED_UPDATE'},Array.from({length:21},(_,i)=>({name:`f${i}.txt`,bytes:'x'})));
  check((rejectedEdit.headers.get('location') ?? rejectedEdit.headers.get('x-action-redirect') ?? '').includes('status=error'),'quality: oversized submission edit reports validation error');
  check(await snapshot()===beforeUpdate&&(await db.prepare('SELECT content FROM submissions WHERE id=?').bind(accepted.id).first()).content==='QUALITY_20_FILES_EDITED','quality: oversized edit preserves original submission and attachments');
  const filename="한글'파일(1)!.txt", bytes='exact-fixture-bytes';
  const mimes=['image/png','image/jpeg','image/gif','image/webp','image/avif','application/pdf','text/plain','text/html','image/svg+xml','application/javascript','application/octet-stream'];
  for(const [i,mime]of mimes.entries()) {
    const key=`submissions/${root.id}/2/mime-${i}.txt`;await bucket.put(key,bytes);
    const inserted=await db.prepare("INSERT INTO submissions(task_id,author_id,content,visibility,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,2,'QUALITY_MIME','private',?,?,?,999)").bind(root.id,key,filename,mime).run();
    const sid=inserted.meta.last_row_id;
    const attachment=await db.prepare('INSERT INTO submission_attachments(submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,?,?,?,999)').bind(sid,key,filename,mime).run();
    for(const endpoint of [`/api/submissions/${sid}/attachment`,`/api/submission-attachments/${attachment.meta.last_row_id}`]) {
      for(const inline of [false,true]) {
        const response=await request(endpoint+(inline?'?inline=1':''),member);
        check(response.status===200&&await response.text()===bytes,`quality: ${endpoint} ${mime} exact bytes`);
        check((response.headers.get('Content-Length')===null||response.headers.get('Content-Length')===String(bytes.length))&&response.headers.get('Content-Type')===mime,`quality: valid streamed size and MIME headers (${response.headers.get('Content-Length')}, ${response.headers.get('Content-Type')})`);
        check(response.headers.get('Content-Disposition')===`${inline&&i<7?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`,'quality: inline allowlist and RFC5987 filename');
        check(response.headers.get('Cache-Control')==='private, no-store'&&response.headers.get('X-Content-Type-Options')==='nosniff'&&response.headers.get('Content-Security-Policy')?.startsWith('sandbox;'),'quality: private/no-sniff/sandbox response');
      }
    }
  }
  const roleAction=action(await page('/admin/users',admin),'updateUserRoleAction');
  await db.prepare("INSERT INTO users(id,email,name,role) VALUES(100,'quality-role@example.test','Synthetic target','guest')").run();
  const role=async (id=100)=>(await db.prepare('SELECT role FROM users WHERE id=?').bind(id).first())?.role;
  for(const actor of [undefined,actorCookies.guest,member]) {
    await submit('/admin/users',actor,roleAction,{userId:100,role:'member'});
    check(await role()==='guest','quality: anonymous/guest/member role mutation denied');
  }
  for(const next of ['member','guest']) {await submit('/admin/users',admin,roleAction,{userId:100,role:next});check(await role()===next,`quality: admin assigns ${next}`);}
  for(const next of ['admin','owner','']) {await submit('/admin/users',admin,roleAction,{userId:100,role:next});check(await role()==='guest',`quality: admin rejects forged role ${next}`);}
  for(const next of ['admin','member','guest']) {await submit('/admin/users',actorCookies.superuser,roleAction,{userId:100,role:next});check(await role()===next,`quality: superuser assigns ${next} to synthetic target`);}
  for(const id of ['-1','invalid','999999','5']) {
    await submit('/admin/users',admin,roleAction,{userId:id,role:'guest'});
    check(await role()==='guest'&&await role(5)==='admin',`quality: invalid/missing/protected user ${id} unchanged`);
  }
}
