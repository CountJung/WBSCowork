/** Called only in a newly-created, retained migration fixture. No delete/purge. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '../src/shared/server/database/index.server';
import {createTask,getTaskById,getDependencySnapshot,setTaskPredecessors,changeTaskStatus} from '../src/entities/task/index.server';
export async function verifyNativeP1Dependencies(check:(value:unknown,label:string)=>void){
 const db=getDatabasePool(),actor={userId:2,isAdmin:false,isSuperuser:false};
 const make=(title:string)=>createTask({projectId:1,title,actor,token:randomUUID(),assigneeId:2,startDate:'2026-01-01',endDate:'2026-12-31',deliverable:'evidence',definitionOfDone:'verified'});
 const a=await make('P1 native predecessor'),b=await make('P1 native successor');
 const input={taskId:b.id,predecessorIds:[a.id],actor,token:randomUUID(),version:b.version,graphVersion:(await getDependencySnapshot(1)).version};
 await Promise.all([setTaskPredecessors(input),setTaskPredecessors(input)]);
 check((await getDependencySnapshot(1)).edges.filter(e=>e.taskId===b.id).length===1,'native dependency replay creates one edge');
 await assert.rejects(setTaskPredecessors({...input,token:randomUUID(),taskId:a.id,predecessorIds:[b.id],version:a.version,graphVersion:(await getDependencySnapshot(1)).version}),/순환/);check(true,'native dependency cycle rejected');
 await assert.rejects(setTaskPredecessors({...input,actor:{...actor,userId:1}}));check(true,'native dependency guest denied');
 const state=async(id:number,status:'in_progress'|'done')=>changeTaskStatus({id,actor,token:randomUUID(),version:(await getTaskById(id))!.version,status,note:'synthetic check'});
 await assert.rejects(state(b.id,'in_progress'),/선행/);check(true,'native predecessor blocks start');
 await db.query("INSERT INTO submissions(task_id,author_id,content,visibility) VALUES(?,2,'P1 native evidence','private')",[a.id]);
 await state(a.id,'done');await state(b.id,'in_progress');check((await getTaskById(b.id))!.status==='in_progress','native completed predecessor permits start');
 await state(a.id,'in_progress');await assert.rejects(state(b.id,'done'),/선행/);check(true,'native reopened predecessor blocks completion without rewriting successor');
 const c=await make('P1 native cycle C'),d=await make('P1 native cycle D'),graph=(await getDependencySnapshot(1)).version;
 const pair=await Promise.allSettled([setTaskPredecessors({taskId:c.id,predecessorIds:[d.id],actor,token:randomUUID(),version:c.version,graphVersion:graph}),setTaskPredecessors({taskId:d.id,predecessorIds:[c.id],actor,token:randomUUID(),version:d.version,graphVersion:graph})]);
 check(pair.filter(r=>r.status==='fulfilled').length===1,'native graph CAS rejects concurrent reverse-edge loser');
 const invariant=await db.query('SELECT t.id,t.version,COUNT(e.id) n FROM tasks t LEFT JOIN task_events e ON e.task_id=t.id WHERE t.id IN (?,?,?,?) GROUP BY t.id,t.version',[a.id,b.id,c.id,d.id]) as {version:number;n:number}[];
 check(invariant.every(row=>Number(row.version)===Number(row.n)),'native dependency state and history agree');
 const {applyTaskTemplate}=await import('../src/entities/task/index.server');
 const {taskTemplates,templatePreview}=await import('../src/entities/task');
 const template=taskTemplates[1],nodes=templatePreview(template,'2026-01-01');nodes[1].assigneeId=3;
 const templateInput={projectId:1,templateKey:template.key,templateVersion:template.version,nodes,actor,token:randomUUID()};
 const created=await Promise.all([applyTaskTemplate(templateInput),applyTaskTemplate(templateInput)]);
 check(created[0].taskIds.join(',')===created[1].taskIds.join(',')&&created[0].taskIds.length===3,'native template replay creates one hierarchy');
 const child=await getTaskById(created[0].taskIds[2]);check(child?.parentId===created[0].taskIds[1]&&child.depth===1,'native template hierarchy copied parent-first');
 check((await getTaskById(created[0].taskIds[1]))?.assigneeId===3,'native template selected assignee persisted');
 await assert.rejects(applyTaskTemplate({...templateInput,nodes:[{...nodes[0],title:'different'}]}));check(true,'native template changed payload rejects replay');
 await assert.rejects(applyTaskTemplate({...templateInput,token:randomUUID(),nodes:[{...nodes[0],assigneeId:1}]}));check(true,'native template ineligible target creates no batch');

 const {searchWork}=await import('../src/entities/task/index.server');const {parseWorkSearchFilters}=await import('../src/entities/task');
 const {createSubmission}=await import('../src/entities/submission/index.server');
 await createSubmission({actor,token:randomUUID(),taskId:a.id,authorId:2,content:'P1_NATIVE_SEARCH_PRIVATE',visibility:'private'});
 await createSubmission({actor,token:randomUUID(),taskId:a.id,authorId:2,content:'P1_NATIVE_SEARCH_PUBLIC 50%_!',visibility:'public'});
 const search=(id:number,q:string)=>searchWork({viewerUserId:id,isSuperuser:false},parseWorkSearchFilters({q,kind:'submission',versions:'all'}));
 check((await search(3,'P1_NATIVE_SEARCH')).total===1&&(await search(2,'P1_NATIVE_SEARCH')).total===2,'native search count enforces private visibility');
 check((await search(3,'50%_!')).total===1,'native search treats wildcards literally');
 check((await search(1,'P1_NATIVE_SEARCH_PRIVATE')).items.length===0,'native guest search has no private snippet');

 const {listNotifications,markNotificationRead}=await import('../src/entities/notification/index.server');
 const assignment=(await listNotifications({userId:3,isSuperuser:false},{scope:'all',page:1})).items.find(item=>item.taskId===created[0].taskIds[1]);
 check(Boolean(assignment),'native template assignment produces targeted inbox row');
 if(!assignment)throw new Error('native assignment notice absent');
 await Promise.all([markNotificationRead({userId:3,isSuperuser:false},assignment.source,assignment.sourceId),markNotificationRead({userId:3,isSuperuser:false},assignment.source,assignment.sourceId)]);
 check(Number((await db.query('SELECT COUNT(*) n FROM notification_reads WHERE recipient_id=3 AND source_kind=? AND source_id=?',[assignment.source,assignment.sourceId]) as {n:number}[])[0].n)===1,'native repeated notification read creates one receipt');
 await markNotificationRead({userId:2,isSuperuser:false},assignment.source,assignment.sourceId);
 check(Number((await db.query('SELECT COUNT(*) n FROM notification_reads WHERE recipient_id=2 AND source_kind=? AND source_id=?',[assignment.source,assignment.sourceId]) as {n:number}[])[0].n)===0,'native guessed notification cannot write another recipient receipt');

}
