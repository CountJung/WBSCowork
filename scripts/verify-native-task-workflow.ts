/** Receives one freshly created synthetic DB only. No delete or purge paths. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabaseEnv, assertTestDatabaseName } from '../tests/helpers/test-env';
export async function verifyNativeTaskWorkflow(database:string,check:(value:unknown,label:string)=>void) {
  assertTestDatabaseName(database);
  if(!database.startsWith('wbs_mig_')||Number(testDatabaseEnv.port)!==3307)throw new Error('Isolated migration fixture required');
  process.env.DB_NAME=database;
  const {getDatabasePool,closeDatabasePool}=await import('../src/shared/server/database/index.server');
  const {createTask,updateTask,getTaskById,changeTaskStatus,listTaskEvents}=await import('../src/entities/task/index.server');
  const owner={userId:2,isAdmin:false,isSuperuser:false},other={...owner,userId:3},admin={userId:4,isAdmin:true,isSuperuser:false};
  const db=getDatabasePool();
  try {
    await db.query("INSERT INTO users(id,email,name,role) VALUES(1,'guest@workflow.test','guest','guest'),(2,'owner@workflow.test','owner','member'),(3,'other@workflow.test','other','member'),(4,'admin@workflow.test','admin','admin')");
    await db.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Synthetic execution','2026-01-01','2026-12-31')");
    const input={projectId:1,title:'Synthetic card',startDate:'2026-01-01',endDate:'2026-12-31',assigneeId:2,deliverable:'문서',definitionOfDone:'내용 확인',actor:owner,token:randomUUID()};
    const [first,replay]=await Promise.all([createTask(input),createTask(input)]);
    check(first.id===replay.id&&(await listTaskEvents(first.id)).length===1,'native task creation replay has one parent and history');
    const taskId=first.id;
    await assert.rejects(createTask({...input,token:randomUUID(),assigneeId:1}));check(true,'native guest assignment rejected');
    await assert.rejects(changeTaskStatus({id:taskId,actor:other,token:randomUUID(),version:first.version,status:'in_progress',note:''}));check(true,'native other owner execution rejected');
    await changeTaskStatus({id:taskId,actor:owner,token:randomUUID(),version:first.version,status:'in_progress',note:''});
    for(let i=0;i<8;i++) {
      const before=(await getTaskById(taskId))!;
      const results=await Promise.allSettled([changeTaskStatus({id:taskId,actor:owner,token:randomUUID(),version:before.version,status:'in_progress',note:`owner-${i}`}),changeTaskStatus({id:taskId,actor:admin,token:randomUUID(),version:before.version,status:'blocked',note:`admin-${i}`})]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await getTaskById(taskId))!.version,before.version+1);
    }
    check(true,'native eight concurrent different-token pairs have one winner and normal stale loser');
    for(let i=0;i<8;i++) {
      const before=(await getTaskById(taskId))!,request={id:taskId,actor:owner,token:randomUUID(),version:before.version,status:'in_progress' as const,note:`same-${i}`};
      await Promise.all([changeTaskStatus(request),changeTaskStatus(request)]);
      assert.equal((await getTaskById(taskId))!.version,before.version+1);
    }
    check(true,'native eight concurrent identical-token pairs each preserve exactly one event');
    const task=(await getTaskById(taskId))!;
    await updateTask({...input,id:taskId,actor:owner,token:randomUUID(),version:task.version,assigneeId:3,reviewerId:2});
    await assert.rejects(changeTaskStatus({id:taskId,actor:owner,token:randomUUID(),version:(await getTaskById(taskId))!.version,status:'blocked',note:'old owner'}));check(true,'native reassignment removes former owner execution');
    await db.query("INSERT INTO submissions(task_id,author_id,content,visibility) VALUES(?,3,'Synthetic private evidence','private')",[taskId]);
    await changeTaskStatus({id:taskId,actor:other,token:randomUUID(),version:(await getTaskById(taskId))!.version,status:'done',note:'기준 확인'});
    check((await getTaskById(taskId))!.status==='done','native no-review completion requires evidence and criteria');
    const state=(await getTaskById(taskId))!,events=await listTaskEvents(taskId);
    check(events.length===state.version&&new Set(events.map(e=>e.task_version)).size===events.length&&Math.max(...events.map(e=>e.task_version))===state.version,'native task state/history invariants hold');
  }finally{await closeDatabasePool();}
}
