import { createHash } from 'node:crypto';
import { databaseBatch,getDatabasePool } from '@/src/shared/server/database/index.server';
import { getRuntimeEnv } from '@/src/shared/server/runtime-env/index.server';
import { assertAcyclicDependencies,normalizePredecessors,type DependencySnapshot } from '../model/dependencies';
import { workOperationToken,taskVersion,type TaskActor } from '../model/workflow';
import { assertTaskActor } from './task-workflow.server';
import { getTaskById,listTasksByProject } from './task-repository.server';

export async function getDependencySnapshot(projectId:number):Promise<DependencySnapshot> {
  // A joined statement returns a coherent graph/version even during another writer.
  const rows=await getDatabasePool().query('SELECT p.dependency_version,d.task_id,d.predecessor_id FROM projects p LEFT JOIN task_dependencies d ON d.project_id=p.id WHERE p.id=? ORDER BY d.id',[projectId]) as {dependency_version:number;task_id:number|null;predecessor_id:number|null}[];
  if(!rows.length)throw new Error('프로젝트를 찾을 수 없습니다.');
  return {version:Number(rows[0].dependency_version),edges:rows.filter(row=>row.task_id!==null).map(row=>({taskId:Number(row.task_id),predecessorId:Number(row.predecessor_id)}))};
}
export async function setTaskPredecessors(input:{taskId:number;version:number;graphVersion:number;predecessorIds:number[];actor:TaskActor;token:string}) {
  const actor=await assertTaskActor(input.actor), task=await getTaskById(input.taskId);
  if(!task)throw new Error('업무를 찾을 수 없습니다.');
  const ids=normalizePredecessors(input.predecessorIds,task.id),version=taskVersion(input.version);
  if(!Number.isSafeInteger(input.graphVersion)||input.graphVersion<0)throw new Error('선행 관계 버전이 올바르지 않습니다.');
  const key=`${actor.userId}:dependencies:${task.id}:${workOperationToken(input.token)}`;
  const fingerprint=createHash('sha256').update(JSON.stringify({ids,version,graphVersion:input.graphVersion})).digest('hex');
  const find=async()=> (await getDatabasePool().query('SELECT request_fingerprint FROM task_events WHERE operation_token=? AND actor_id=?',[key,actor.userId]) as {request_fingerprint:string}[])[0];
  const previous=await find();if(previous){if(previous.request_fingerprint!==fingerprint)throw new Error('같은 요청을 다른 내용에 사용할 수 없습니다.');return;}
  if(!['planned','blocked'].includes(task.status))throw new Error('선행 관계는 예정 또는 차단 상태에서만 바꿀 수 있습니다.');
  const [snapshot,tasks]=await Promise.all([getDependencySnapshot(task.projectId),listTasksByProject(task.projectId)]);
  if(snapshot.version!==input.graphVersion||task.version!==version)throw new Error('선행 관계 또는 업무가 변경되었습니다. 새로고침해 주세요.');
  if(ids.some(id=>!tasks.some(t=>t.id===id)))throw new Error('같은 프로젝트의 선행 업무만 선택할 수 있습니다.');
  assertAcyclicDependencies(snapshot.edges,task.id,ids);
  const guard='last_operation_token=? AND NOT EXISTS(SELECT 1 FROM task_events e WHERE e.operation_token=?)';
  await databaseBatch([
    {sql:`UPDATE projects SET dependency_version=dependency_version+1,dependency_token=? WHERE id=? AND dependency_version=?
      AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=? AND t.project_id=projects.id AND t.version=? AND t.status IN ('planned','blocked'))
      AND EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND (actor.role IN ('member','admin') OR (?=1 AND LOWER(actor.email)=?)))
      AND (SELECT COUNT(*) FROM tasks predecessors WHERE predecessors.project_id=projects.id AND predecessors.id IN (${ids.length?ids.map(()=>'?').join(','):'NULL'}))=?
      AND NOT EXISTS(SELECT 1 FROM task_events e WHERE e.operation_token=?)`,params:[key,task.projectId,input.graphVersion,task.id,version,actor.userId,actor.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'',...ids,ids.length,key]},
    {sql:`UPDATE tasks SET version=version+1,last_operation_token=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND p.dependency_token=? AND p.dependency_version=?) AND NOT EXISTS(SELECT 1 FROM task_events e WHERE e.operation_token=?)`,params:[key,task.id,version,key,input.graphVersion+1,key]},
    {sql:`DELETE FROM task_dependencies WHERE task_id=? AND EXISTS(SELECT 1 FROM tasks WHERE id=? AND ${guard})`,params:[task.id,task.id,key,key]},
    ...ids.map(id=>({sql:`INSERT INTO task_dependencies(project_id,task_id,predecessor_id) SELECT project_id,id,? FROM tasks WHERE id=? AND ${guard} AND EXISTS(SELECT 1 FROM tasks predecessor WHERE predecessor.id=? AND predecessor.project_id=tasks.project_id)`,params:[id,task.id,key,key,id]})),
    {sql:`INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version) SELECT id,?,?,?,'dependencies_changed',status,assignee_id,reviewer_id,?,version FROM tasks WHERE id=? AND ${guard}`,params:[actor.userId,key,fingerprint,ids.length?`선행 업무: ${ids.map(id=>'#'+id).join(', ')}`:'선행 업무 없음',task.id,key,key]},
  ]);
  const saved=await find();if(saved?.request_fingerprint!==fingerprint)throw new Error('다른 변경이 먼저 저장되었거나 권한이 변경되었습니다. 새로고침해 주세요.');
}
