import {randomUUID} from 'node:crypto';
/** Synthetic creates/revisions/comments only; old versions and bytes are retained. */
export async function verifySubmissionRevisionWorkflow({request,db,bucket,actorCookies,form,renderedAction,route,projectId,taskId,check}) {
 const owner=actorCookies.member1,other=actorCookies.member2;
 const html=async cookie=>(await request(route,cookie)).text();
 const create=renderedAction(await html(owner),'createSubmissionAction');
 const initial={projectId,taskId,content:'REVISION_PRIVATE_V1',visibility:'private',materialUrl:'https://example.com/first',operationToken:randomUUID()};
 await form(route,owner,create,initial,[{name:'history.txt',bytes:'first-version-bytes'}]);
 const submission=await db.prepare("SELECT * FROM submissions WHERE content='REVISION_PRIVATE_V1'").first();
 check(submission?.current_revision===1&&submission.material_url==='https://example.com/first','revisions: first projection has version and material URL');
 const id=submission.id,read=()=>db.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first();
 const revisions=()=>db.prepare('SELECT * FROM submission_revisions WHERE submission_id=? ORDER BY revision_number').bind(id).all();
 const attachment=await db.prepare('SELECT * FROM submission_attachments WHERE submission_id=?').bind(id).first();
 check((await revisions()).results[0].editor_id===2,'revisions: actual initial editor recorded');
 const comment=renderedAction(await html(owner),'createCommentAction');
 await form(route,owner,comment,{projectId,taskId,submissionId:id,revisionNumber:1,content:'PRIVATE_V1_COMMENT'});
 const update=renderedAction(await html(owner),'updateSubmissionAction');
 await form(route,owner,update,{projectId,taskId,submissionId:id,content:'REVISION_PUBLIC_V2',visibility:'public',materialUrl:'https://example.com/second',changeSummary:'공개할 결과 정리'});
 check((await read()).current_revision===2&&(await revisions()).results[0].content==='REVISION_PRIVATE_V1','revisions: edits append and original body remains immutable');
 const publicAttachment=await db.prepare('SELECT * FROM submission_attachments WHERE submission_id=? AND revision_number=2').bind(id).first();
 check(publicAttachment.id!==attachment.id&&publicAttachment.file_path===attachment.file_path,'revisions: carried files receive version metadata without overwriting bytes');
 for(const role of ['guest','member2']) {
  const cookie=actorCookies[role],current=await html(cookie),history=await(await request(`/submissions/${id}`,cookie)).text();
  check(current.includes('REVISION_PUBLIC_V2')&&!current.includes('PRIVATE_V1_COMMENT'),'revisions: public current view hides private old comments');
  check(history.includes('REVISION_PUBLIC_V2')&&!history.includes('REVISION_PRIVATE_V1')&&!history.includes('PRIVATE_V1_COMMENT'),'revisions: history SSR filters private snapshots before serialization');
  check((await request(`/submissions/${id}?revision=1`,cookie)).status===404,'revisions: direct private historical version indistinguishable from missing');
  check((await request(`/api/submission-attachments/${attachment.id}`,cookie)).status===404,'revisions: old private attachment ID stays protected');
  check(await(await request(`/api/submission-attachments/${publicAttachment.id}`,cookie)).text()==='first-version-bytes','revisions: current explicitly public file returns exact bytes');
 }
 check((await request(`/submissions/${id}?revision=1`,owner)).status===200,'revisions: original author can read historical private version');
 const token=randomUUID(),edit={projectId,taskId,submissionId:id,expectedRevision:2,operationToken:token,content:'REVISION_PRIVATE_V3',visibility:'private',materialUrl:'https://example.com/third',changeSummary:'새 자료 반영'};
 await form(route,owner,update,edit,[{name:'added.txt',bytes:'version-three'}]);
 const objectCount=(await bucket.list()).objects.length;
 await form(route,owner,update,edit,[{name:'added.txt',bytes:'version-three'}]);
 check((await read()).current_revision===3&&(await revisions()).results.length===3&&(await bucket.list()).objects.length===objectCount,'revisions: same request re-upload is one revision and cleans unused staging');
 await form(route,owner,update,edit,[{name:'added.txt',bytes:'other-content'}]);
 check((await read()).current_revision===3&&(await bucket.list()).objects.length===objectCount,'revisions: changed bytes with same name/size/token cannot replay');
 for(const endpoint of [`/submissions/${id}?revision=2`,`/api/submission-attachments/${publicAttachment.id}`])check((await request(endpoint,other)).status===404,'revisions: current private gate also hides formerly public history');
 const before=JSON.stringify(await read());
 await form(route,other,update,{...edit,operationToken:randomUUID(),expectedRevision:3,content:'FORGED_OTHER_EDITOR'});
 check(JSON.stringify(await read())===before,'revisions: another member cannot edit private submission');
 await form(route,owner,update,{...edit,operationToken:randomUUID(),expectedRevision:1,content:'STALE_REWRITE'});
 check(JSON.stringify(await read())===before,'revisions: stale expected revision cannot overwrite current body');
 const remove=renderedAction(await html(owner),'deleteSubmissionAttachmentAction');
 const toRemove=await db.prepare("SELECT * FROM submission_attachments WHERE submission_id=? AND revision_number=3 AND file_name='added.txt'").bind(id).first();
 await form(route,owner,remove,{projectId,taskId,submissionId:id,attachmentId:toRemove.id,expectedRevision:3});
 check((await read()).current_revision===4&&(await bucket.list()).objects.length===objectCount&&await bucket.head(toRemove.file_path),'revisions: attachment removal creates a recoverable version and keeps old bytes');
 check((await request(`/api/submission-attachments/${toRemove.id}`,owner)).status===200,'revisions: excluded historical attachment remains downloadable to owner');
 const currentFiles=await db.prepare('SELECT COUNT(*) AS n FROM submission_attachments WHERE submission_id=? AND revision_number=4').bind(id).first();
 check(currentFiles.n===1,'revisions: current list excludes only selected file');
 const adminUpdate=renderedAction(await html(actorCookies.admin),'updateSubmissionAction');
 await form(route,actorCookies.admin,adminUpdate,{...edit,operationToken:randomUUID(),expectedRevision:4,content:'ADMIN_REVISION_V5',changeSummary:'관리자 보완'});
 check((await read()).author_id===2&&(await revisions()).results.at(-1).editor_id===4,'revisions: admin editor is distinct from original author');
 const beforeFault=JSON.stringify(await read()),revisionCount=(await revisions()).results.length,beforeFaultObjects=(await bucket.list()).objects.length;
 await db.prepare("CREATE TRIGGER synthetic_revision_event_fault BEFORE INSERT ON submission_events WHEN NEW.body='ROLLBACK_REVISION' BEGIN SELECT RAISE(ABORT,'synthetic revision event failure'); END").run();
 await form(route,owner,update,{...edit,operationToken:randomUUID(),expectedRevision:5,content:'MUST_ROLLBACK',changeSummary:'ROLLBACK_REVISION'},[{name:'failure.txt',bytes:'not committed'}]);
 check(JSON.stringify(await read())===beforeFault&&(await revisions()).results.length===revisionCount&&(await bucket.list()).objects.length===beforeFaultObjects,'revisions: event failure rolls back projection/snapshot/files and preserves original bytes');
 for(const materialUrl of ['javascript:alert(1)','data:text/html,x','https://name:password@example.test/path','https://example.test/\nsecret']) {
  await form(route,owner,create,{...initial,operationToken:randomUUID(),content:'INVALID_URL',materialUrl});
  check(!(await db.prepare("SELECT id FROM submissions WHERE content='INVALID_URL'").first()),'revisions: unsafe material URL rejected before record creation');
 }
 await form(route,owner,create,{...initial,operationToken:randomUUID(),content:'x'.repeat(20001)});
 check(!(await db.prepare('SELECT id FROM submissions WHERE LENGTH(content)>20000').first()),'revisions: overlong body rejected');
 const events=await db.prepare('SELECT revision_number FROM submission_events WHERE submission_id=? ORDER BY id').bind(id).all();
 check(events.results.length===5&&(await read()).current_revision===5,'revisions: one immutable event per completed revision');
}
