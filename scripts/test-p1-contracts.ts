/** Synthetic additive P1 contracts. No permanent record/file purge or external service. */
import '../tests/helpers/bootstrap';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import type {D1Database} from '@cloudflare/workers-types';
import {runWithHostedBindings} from '../src/shared/server/hosted-runtime/index.server';
const mf=new Miniflare({cf:false,modules:true,script:"export default {fetch(){return new Response('fixture')}}",compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'p1-contracts'}});
let checks=0;const check=(value:unknown,label:string)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
try {
 const DB=await mf.getD1Database('DB') as unknown as D1Database;
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await DB.prepare(sql).run();
 await runWithHostedBindings({DB},async()=>{
  const {getDatabasePool}=await import('../src/shared/server/database/index.server');const db=getDatabasePool();
  const {createTask,getTaskById,setTaskPredecessors,getDependencySnapshot,changeTaskStatus}=await import('../src/entities/task/index.server');
  const {createSubmission}=await import('../src/entities/submission/index.server');
  for(const [id,role]of [[1,'guest'],[2,'member'],[3,'member'],[4,'admin']] as const)await db.query('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)',[id,`p1-${id}@example.test`,`P1 ${id}`,role]);
  for(const id of [1,2])await db.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(?,?,'2026-01-01','2026-12-31')",[id,`P1 ${id}`]);
  const actor={userId:2,isAdmin:false,isSuperuser:false};
  const make=(title:string,projectId=1)=>createTask({projectId,title,actor,token:randomUUID(),assigneeId:2,startDate:'2026-01-01',endDate:'2026-12-31',deliverable:'output',definitionOfDone:'check'});
  const a=await make('A'),b=await make('B'),c=await make('C'),foreign=await make('Other',2);
  async function edge(taskId:number,predecessorIds:number[],token=randomUUID()) {return setTaskPredecessors({taskId,predecessorIds,actor,token,version:(await getTaskById(taskId))!.version,graphVersion:(await getDependencySnapshot(1)).version});}
  const snap=await getDependencySnapshot(1),initial={taskId:b.id,predecessorIds:[a.id],actor,token:randomUUID(),version:b.version,graphVersion:snap.version};
  await Promise.all([setTaskPredecessors(initial),setTaskPredecessors(initial)]);
  check((await getDependencySnapshot(1)).edges.length===1,'same request adds one edge');
  check(Number((await db.query('SELECT COUNT(*) n FROM task_events WHERE kind=?',['dependencies_changed']) as {n:number}[])[0].n)===1,'same request adds one history');
  await assert.rejects(setTaskPredecessors({...initial,predecessorIds:[c.id]}));checks++;
  await assert.rejects(edge(a.id,[b.id]),/순환/);checks++;
  await assert.rejects(edge(c.id,[foreign.id]),/같은 프로젝트/);checks++;
  await assert.rejects(edge(c.id,[c.id]));checks++;
  await assert.rejects(setTaskPredecessors({...initial,taskId:c.id,actor:{...actor,userId:1},token:randomUUID()}));checks++;
  async function status(taskId:number,status:'planned'|'in_progress'|'done',note='synthetic transition'){await changeTaskStatus({id:taskId,status,note,actor,token:randomUUID(),version:(await getTaskById(taskId))!.version});}
  await assert.rejects(status(b.id,'in_progress'),/선행/);checks++;
  await createSubmission({actor,token:randomUUID(),taskId:a.id,authorId:2,content:'evidence'});
  await status(a.id,'done');await status(b.id,'in_progress');check((await getTaskById(b.id))!.status==='in_progress','completion enables successor start');
  await assert.rejects(edge(b.id,[]),/예정/);checks++;
  await status(a.id,'in_progress');await assert.rejects(status(b.id,'done'),/선행/);checks++;
  check((await getTaskById(b.id))!.status==='in_progress','predecessor reopen preserves successor status');
  const d=await make('D'),e=await make('E'),graph=(await getDependencySnapshot(1)).version;
  const reverse=await Promise.allSettled([setTaskPredecessors({taskId:d.id,predecessorIds:[e.id],version:d.version,graphVersion:graph,actor,token:randomUUID()}),setTaskPredecessors({taskId:e.id,predecessorIds:[d.id],version:e.version,graphVersion:graph,actor,token:randomUUID()})]);
  check(reverse.filter(result=>result.status==='fulfilled').length===1,'concurrent reverse edges allow one graph version');
  const review=await createTask({projectId:1,title:'Review dependency',actor,token:randomUUID(),assigneeId:2,reviewRequired:true,deliverable:'output',definitionOfDone:'verify',startDate:'2026-01-01',endDate:'2026-12-31'});
  const {updateTask}=await import('../src/entities/task/index.server');
  await updateTask({...review,id:review.id,actor,token:randomUUID(),version:review.version,reviewerId:3});
  await edge(review.id,[a.id]);
  const output=await createSubmission({actor,token:randomUUID(),taskId:review.id,authorId:2,content:'review output'});
  const {requestSubmissionReview,decideSubmissionReview,cancelOrReopenSubmissionReview}=await import('../src/entities/submission/index.server');
  const reviewInput=async()=>({taskId:review.id,submissionId:output.id,revisionNumber:1,expectedTaskVersion:(await getTaskById(review.id))!.version,actor,token:randomUUID()});
  await assert.rejects(requestSubmissionReview(await reviewInput()),/선행/);checks++;
  await status(a.id,'done');await requestSubmissionReview(await reviewInput());
  check((await getTaskById(review.id))!.status==='review_pending','complete predecessor enables review');
  await status(a.id,'in_progress');
  await assert.rejects(decideSubmissionReview({...await reviewInput(),actor:{...actor,userId:3},decision:'approved',reason:'checked'}),/선행/);checks++;
  await cancelOrReopenSubmissionReview({...await reviewInput(),reason:'cancel blocked review'});
  check((await getTaskById(review.id))!.status==='in_progress','blocked review can be cancelled without losing history');
  const fault=await make('Dependency fault'),faultGraph=await getDependencySnapshot(1);
  await DB.prepare("CREATE TRIGGER dependency_history_fault BEFORE INSERT ON task_events WHEN NEW.task_id="+fault.id+" AND NEW.kind='dependencies_changed' BEGIN SELECT RAISE(ABORT,'synthetic dependency history fault'); END").run();
  await assert.rejects(edge(fault.id,[a.id]));checks++;
  check((await getTaskById(fault.id))!.version===fault.version&&(await getDependencySnapshot(1)).version===faultGraph.version,'history failure rolls back graph CAS and task version');
  check(!(await getDependencySnapshot(1)).edges.some(e=>e.taskId===fault.id),'history failure leaves no partial edges');
  const history=await db.query('SELECT t.id,t.version,COUNT(e.id) n FROM tasks t LEFT JOIN task_events e ON e.task_id=t.id GROUP BY t.id,t.version') as {version:number;n:number}[];
  check(history.every(row=>Number(row.version)===Number(row.n)),'task state/history atomicity preserved');
 });
 console.log(`P1 contracts: ${checks} PASS`);
}finally{await mf.dispose();}
