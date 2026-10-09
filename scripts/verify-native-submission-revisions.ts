/** Additive-only behavior checks in the freshly created task fixture DB; retain all rows and bytes. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyNativeSubmissionRevisions(taskId:number,check:(value:unknown,label:string)=>void) {
 const {createSubmissionWithAttachments,updateSubmissionWithAttachments,getSubmissionById,listSubmissionRevisionsForViewer,getSubmissionRevisionForViewer,listAttachmentsBySubmission,saveUploadedSubmissionAttachment}=await import('../src/entities/submission/index.server');
 const {getDatabasePool}=await import('../src/shared/server/database/index.server');
 const owner={userId:2,isAdmin:false,isSuperuser:false},admin={userId:4,isAdmin:true,isSuperuser:false},viewer={canSeeAll:false,viewerUserId:2},other={canSeeAll:false,viewerUserId:3};
 const upload=await saveUploadedSubmissionAttachment(new File(['native-v1-bytes'],'native.txt',{type:'text/plain'}),{authorId:2,taskId});
 const input={taskId,authorId:2,actor:owner,token:randomUUID(),content:'Native private v1',visibility:'private' as const,materialUrl:'https://example.com/native'};
 const [id,replay]=await Promise.all([createSubmissionWithAttachments(input,[upload]),createSubmissionWithAttachments(input,[upload])]);
 check(id===replay&&(await listSubmissionRevisionsForViewer(id,viewer)).length===1,'native revision creation and replay are atomic');
 await assert.rejects(createSubmissionWithAttachments({...input,content:'Changed token reuse'},[upload]));check(true,'native revision changed payload replay rejected');
 await updateSubmissionWithAttachments({id,actor:owner,token:randomUUID(),expectedRevision:1,content:'Native public v2',visibility:'public',changeSummary:'공개 결과'},[]);
 check(!(await getSubmissionRevisionForViewer(id,1,other))&&!!(await getSubmissionRevisionForViewer(id,2,other)),'native historical private snapshot remains private after public revision');
 const oldFiles=await listAttachmentsBySubmission(id,{revisionNumber:1,filter:viewer}),newFiles=await listAttachmentsBySubmission(id);
 check(oldFiles[0].filePath===newFiles[0].filePath&&oldFiles[0].id!==newFiles[0].id,'native carried file metadata preserves immutable revisions');
 for(let i=0;i<5;i++) {
  const before=(await getSubmissionById(id))!,request={id,actor:owner,token:randomUUID(),expectedRevision:before.currentRevision,content:`Native replay ${i}`,changeSummary:`요청 ${i}`};
  await Promise.all([updateSubmissionWithAttachments(request,[]),updateSubmissionWithAttachments(request,[])]);
  assert.equal((await getSubmissionById(id))!.currentRevision,before.currentRevision+1);
 }
 check(true,'native five same-token concurrent revision pairs each create one revision');
 for(let i=0;i<5;i++) {
  const before=(await getSubmissionById(id))!;
  const results=await Promise.allSettled([updateSubmissionWithAttachments({id,actor:owner,token:randomUUID(),expectedRevision:before.currentRevision,content:`owner-${i}`,changeSummary:'owner'},[]),updateSubmissionWithAttachments({id,actor:admin,token:randomUUID(),expectedRevision:before.currentRevision,content:`admin-${i}`,changeSummary:'admin'},[])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await getSubmissionById(id))!.currentRevision,before.currentRevision+1);
 }
 check(true,'native five different-token revision races have one winner and stale loser');
 const before=(await getSubmissionById(id))!;
 await updateSubmissionWithAttachments({id,actor:admin,token:randomUUID(),expectedRevision:before.currentRevision,content:'Native final private',visibility:'private',changeSummary:'관리자 검토'},[]);
 const latest=(await getSubmissionById(id))!,revisions=await listSubmissionRevisionsForViewer(id,viewer);
 check(latest.authorId===2&&revisions[0].editorId===4,'native original author remains distinct from administrator editor');
 check(!(await getSubmissionRevisionForViewer(id,2,other)),'native current private gate hides old public snapshot');
 const file=(await listAttachmentsBySubmission(id))[0];
 await updateSubmissionWithAttachments({id,actor:owner,token:randomUUID(),expectedRevision:latest.currentRevision,content:latest.content,visibility:latest.visibility,changeSummary:'파일 제외',removeAttachmentIds:[file.id]},[]);
 check((await listAttachmentsBySubmission(id)).length===0&&(await listAttachmentsBySubmission(id,{revisionNumber:1,filter:viewer})).length===1,'native file removal creates new version while retaining old metadata');
 const db=getDatabasePool(),final=(await getSubmissionById(id))!;
 const counts=await db.query('SELECT (SELECT COUNT(*) FROM submission_revisions WHERE submission_id=?) AS revisions,(SELECT COUNT(*) FROM submission_events WHERE submission_id=?) AS events',[id,id]) as {revisions:number;events:number}[];
 check(Number(counts[0].revisions)===final.currentRevision&&Number(counts[0].events)===final.currentRevision,'native revision/event/projection counts remain consistent');
}
