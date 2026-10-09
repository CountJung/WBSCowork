import {createHash} from 'node:crypto';
import {databaseBatch,getDatabasePool,type QueryStatement} from '@/src/shared/server/database/index.server';
import {getRuntimeEnv} from '@/src/shared/server/runtime-env/index.server';
import {isHostedRuntime} from '@/src/shared/server/hosted-runtime/index.server';
import {assertTaskActor} from './task-workflow.server';
import {normalizeTemplatePayload} from '../model/task-templates';
import {workOperationToken,type TaskActor} from '../model/workflow';
export async function applyTaskTemplate(input:{projectId:number;templateKey:string;templateVersion:number;nodes:unknown;actor:TaskActor;token:string}) {
 const actor=await assertTaskActor(input.actor);
 if(!Number.isSafeInteger(input.projectId)||input.projectId<1)throw new Error('프로젝트가 올바르지 않습니다.');
 const nodes=normalizeTemplatePayload(input.templateKey,input.templateVersion,input.nodes);
 const key=`${actor.userId}:template:${workOperationToken(input.token)}`, fingerprint=createHash('sha256').update(JSON.stringify({projectId:input.projectId,templateKey:input.templateKey,templateVersion:input.templateVersion,nodes})).digest('hex');
 const db=getDatabasePool();
 const find=async()=> (await db.query('SELECT id,request_fingerprint,completed_at FROM task_template_runs WHERE operation_token=? AND actor_id=?',[key,actor.userId]) as {id:number;request_fingerprint:string;completed_at:string|null}[])[0];
 const result=async(replayed:boolean)=>({replayed,taskIds:(await db.query('SELECT id FROM tasks WHERE project_id=? AND creation_token IN ('+nodes.map(()=>'?').join(',')+') ORDER BY order_index,id',[input.projectId,...nodes.map(n=>key+':'+n.key)]) as {id:number}[]).map(r=>Number(r.id))});
 const previous=await find();if(previous){if(previous.request_fingerprint!==fingerprint||!previous.completed_at)throw new Error('같은 요청을 다른 템플릿 내용에 사용할 수 없습니다.');return result(true);}
 const assignees=[...new Set(nodes.flatMap(n=>n.assigneeId===null?[]:[n.assigneeId]))];
 const duplicate=isHostedRuntime()?' ON CONFLICT DO NOTHING':' ON DUPLICATE KEY UPDATE id=task_template_runs.id';
 const guard='EXISTS(SELECT 1 FROM task_template_runs applied WHERE applied.operation_token=? AND applied.request_fingerprint=? AND applied.completed_at IS NULL)';
 const statements:QueryStatement[]=[
  {sql:'UPDATE projects SET id=id WHERE id=?',params:[input.projectId]},
  {sql:`INSERT INTO task_template_runs(project_id,actor_id,template_key,template_version,operation_token,request_fingerprint,task_count)
   SELECT ?,?,?,?,?,?,? FROM projects WHERE id=?
   AND EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND (actor.role IN ('member','admin') OR (?=1 AND LOWER(actor.email)=?)))
   AND (SELECT COUNT(*) FROM users target WHERE target.id IN (${assignees.length?assignees.map(()=>'?').join(','):'NULL'}) AND (target.role IN ('member','admin') OR LOWER(target.email)=?))=?${duplicate}`,
   params:[input.projectId,actor.userId,input.templateKey,input.templateVersion,key,fingerprint,nodes.length,input.projectId,actor.userId,actor.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'',...assignees,getRuntimeEnv().auth.superuserEmail??'',assignees.length]},
 ];
 for(const node of nodes){
  const nodeKey=key+':'+node.key;
  const depth=(k:string|null):number=>k?1+depth(nodes.find(n=>n.key===k)?.parentKey??null):0;
  statements.push({sql:`INSERT INTO tasks(project_id,parent_id,title,description,deliverable,definition_of_done,start_date,end_date,assignee_id,depth,order_index,creation_token,last_operation_token)
   SELECT ?,${node.parentKey?'(SELECT id FROM tasks parent WHERE parent.creation_token=?)':'NULL'},?,?,?,?,?,?,?,?,COALESCE((SELECT MAX(order_index)+1 FROM tasks previous WHERE previous.project_id=?),0),?,? WHERE ${guard}`,
   params:[input.projectId,...(node.parentKey?[key+':'+node.parentKey]:[]),node.title,node.description,node.deliverable,node.definitionOfDone,node.startDate,node.endDate,node.assigneeId,depth(node.parentKey),input.projectId,nodeKey,nodeKey,key,fingerprint]});
  statements.push({sql:`INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version)
   SELECT id,?,?,?,'created',status,assignee_id,reviewer_id,?,version FROM tasks WHERE creation_token=? AND ${guard}`,
   params:[actor.userId,nodeKey,fingerprint,`템플릿 ${input.templateKey} v${input.templateVersion}에서 생성`,nodeKey,key,fingerprint]});
 }
 statements.push({sql:'UPDATE task_template_runs SET completed_at=CURRENT_TIMESTAMP WHERE operation_token=? AND request_fingerprint=? AND completed_at IS NULL',params:[key,fingerprint]});
 await databaseBatch(statements);
 const saved=await find();if(!saved?.completed_at||saved.request_fingerprint!==fingerprint)throw new Error('프로젝트 또는 담당자/작성 권한이 변경되었습니다. 미리보기를 다시 확인해 주세요.');
 return result(false);
}
