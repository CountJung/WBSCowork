import {projectAccessGuard,projectTaskAccessGuard,type ProjectViewer} from "@/src/shared/server/project-scope/index.server";
import { taskManagementGuard, taskExecutionGuard, taskAssignmentGuard } from "@/src/shared/server/task-scope/index.server";
import { assertTaskScope } from "./task-permissions.server";
import { lockTaskProject,taskPredecessorsCompleteSql } from "@/src/shared/server/task-dependencies/index.server";
import { createHash } from "node:crypto";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { normalizeWorkGoal } from "@/src/shared/lib/work-goals";
import { taskVersion, workOperationToken, type TaskActor, type TaskEvent, type TaskStatus } from "../model/workflow";
import { ensureEligibleTaskUser, getTaskById } from "./task-repository.server";

export async function assertTaskActor(actor: TaskActor) {
  const rows = await getDatabasePool().query("SELECT id,role,email FROM users WHERE id=?", [actor.userId]) as {id:number;role:string;email:string}[];
  const user=rows[0];
  const isSuperuser=!!user && !!actor.isSuperuser && user.email.toLowerCase()===(getRuntimeEnv().auth.superuserEmail??"");
  if(!user || (!isSuperuser && user.role!=="admin" && user.role!=="member")) throw new Error("업무 작성 권한이 없습니다.");
  return {...actor,isSuperuser,isAdmin:user.role === "admin" || isSuperuser};
}
export async function hasTaskMutation(input:{id:number;actor:TaskActor;token:string;kind:string;payload:unknown}) {
  await assertTaskActor(input.actor);
  const key=`${input.actor.userId}:${input.kind}:${input.id}:${workOperationToken(input.token)}`;
  const fingerprint=createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  const binding=projectTaskAccessGuard(input.actor,"task_events.task_id");
  const prior=(await getDatabasePool().query(`SELECT request_fingerprint FROM task_events WHERE task_id=? AND actor_id=? AND operation_token=? AND ${binding.sql}`,[input.id,input.actor.userId,key,...binding.params]) as {request_fingerprint:string}[])[0];
  if(prior&&prior.request_fingerprint!==fingerprint)throw new Error("같은 요청 식별자를 다른 내용에 사용할 수 없습니다.");
  return Boolean(prior);
}
export async function commitTaskMutation(input: {
  id:number; actor:TaskActor; token:string; version:number; kind:string; note:string;
  payload:unknown; setSql:string; setParams:unknown[]; guardSql?:string; guardParams?:unknown[];
  invalidateReview?: { reason: string };
  permission?: "manage" | "execute";
}) {
  const actor=await assertTaskActor(input.actor);
  const token=workOperationToken(input.token), version=taskVersion(input.version);
  const key=`${actor.userId}:${input.kind}:${input.id}:${token}`;
  const fingerprint=createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  const receiptScope=input.permission==='execute'?taskExecutionGuard(actor,"receipt_task.project_id","receipt_task.activity_team_id","receipt_task.assignee_id"):taskManagementGuard(actor,"receipt_task.project_id","receipt_task.activity_team_id");
  const find=async()=> (await getDatabasePool().query(`SELECT task_events.request_fingerprint FROM task_events JOIN tasks receipt_task ON receipt_task.id=task_events.task_id WHERE task_events.task_id=? AND task_events.actor_id=? AND task_events.operation_token=? AND ${receiptScope.sql}`,[input.id,actor.userId,key,...receiptScope.params]) as {request_fingerprint:string}[])[0];
  const prior=await find();
  if(prior) { if(prior.request_fingerprint!==fingerprint)throw new Error("같은 요청 식별자를 다른 내용에 사용할 수 없습니다."); return; }
  const scope=input.permission === "execute" ? taskExecutionGuard(actor) : taskManagementGuard(actor);
  const duplicate=isHostedRuntime()?" ON CONFLICT DO NOTHING":" ON DUPLICATE KEY UPDATE id=task_events.id";
  const reviewInvalidation: QueryStatement[] = input.invalidateReview ? [
    {
      sql: `INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body)
        SELECT review_submission_id,review_revision_number,?,?,?,'review_invalidated',?
        FROM tasks WHERE id=? AND last_operation_token=? AND review_submission_id IS NOT NULL AND review_revision_number IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM task_events applied WHERE applied.operation_token=?)
        AND NOT EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)`,
      params: [actor.userId, `${key}:review-invalidate`, fingerprint, input.invalidateReview.reason, input.id, key, key, `${key}:review-invalidate`],
    },
    {
      sql: `UPDATE tasks SET review_submission_id=NULL,review_revision_number=NULL,
        workflow_note='작업 변경으로 검토를 다시 진행해야 합니다.'
        WHERE id=? AND last_operation_token=?
        AND EXISTS(SELECT 1 FROM submission_events applied WHERE applied.operation_token=?)
        AND NOT EXISTS(SELECT 1 FROM task_events applied WHERE applied.operation_token=?)`,
      params: [input.id, key, `${key}:review-invalidate`, key],
    },
  ] : [];
  await databaseBatch([
    lockTaskProject(input.id),
    {sql:"UPDATE tasks SET id=id WHERE id=?",params:[input.id]},
    ...(input.invalidateReview ? [{sql:"UPDATE submissions SET id=id WHERE id=(SELECT review_submission_id FROM tasks WHERE id=?)",params:[input.id]}] : []),
    {sql:`UPDATE tasks SET ${input.setSql},version=version+1,last_operation_token=? WHERE id=? AND version=? AND ${scope.sql} AND NOT EXISTS(SELECT 1 FROM task_events e WHERE e.operation_token=?) ${input.guardSql?`AND (${input.guardSql})`:''}`, params:[...input.setParams,key,input.id,version,...scope.params,key,...(input.guardParams??[])]},
    ...reviewInvalidation,
    {sql:`INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version) SELECT id,?,?,?,?,status,assignee_id,reviewer_id,?,version FROM tasks WHERE id=? AND last_operation_token=? AND NOT EXISTS(SELECT 1 FROM task_events e WHERE e.operation_token=?)${duplicate}`,params:[actor.userId,key,fingerprint,input.kind,input.invalidateReview?'작업 변경으로 검토를 다시 진행해야 합니다.':input.note,input.id,key,key]},
  ]);
  const saved=await find();
  if(!saved || saved.request_fingerprint!==fingerprint)throw new Error("다른 변경이 먼저 저장되었거나 권한이 변경되었습니다. 새로고침 후 다시 확인해 주세요.");
}

/** All task history is ordinary task metadata; private submission content never enters this table. */
export async function listTaskEvents(taskId:number):Promise<TaskEvent[]> {
  return await getDatabasePool().query(`SELECT e.id,e.task_id,e.actor_id,a.name AS actor_name,e.kind,e.status,e.assignee_id,u.name AS assignee_name,e.reviewer_id,r.name AS reviewer_name,e.note,e.task_version,e.created_at FROM task_events e LEFT JOIN users a ON a.id=e.actor_id LEFT JOIN users u ON u.id=e.assignee_id LEFT JOIN users r ON r.id=e.reviewer_id WHERE e.task_id=? ORDER BY e.id DESC LIMIT 30`,[taskId]) as TaskEvent[];
}
export async function changeTaskStatus(input:{id:number;actor:TaskActor;token:string;version:number;status:TaskStatus;note:string}) {
  const actor=await assertTaskActor(input.actor), task=await getTaskById(input.id);
  if(!task)throw new Error("업무를 찾을 수 없습니다.");
  await assertTaskScope(task.id,actor,true);
  const note=normalizeWorkGoal(input.note,"상태 변경 근거");
  const payload={status:input.status,note,version:input.version};
  if(await hasTaskMutation({...input,kind:"status",payload}))return;
  if(taskVersion(input.version)!==task.version)throw new Error("다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 확인해 주세요.");
  if(!['planned','in_progress','blocked','done'].includes(input.status))throw new Error("검토 상태는 제출물 검토 절차에서 변경해야 합니다.");
  if(task.status==='review_pending')throw new Error("진행 중인 검토를 먼저 처리해야 합니다.");
  if(input.status==='blocked'&&!note)throw new Error("차단 사유를 입력해 주세요.");
  if(task.status==='done' && input.status!=='done' && !note)throw new Error("완료한 작업을 다시 여는 이유를 입력해 주세요.");
  if(task.status==='done' && input.status==='done')throw new Error("이미 완료한 업무입니다.");
  if(['in_progress','done'].includes(input.status)) {
    const pending=await getDatabasePool().query("SELECT d.id FROM task_dependencies d JOIN tasks predecessor ON predecessor.id=d.predecessor_id WHERE d.task_id=? AND predecessor.status<>'done' LIMIT 1",[task.id]) as {id:number}[];
    if(pending.length)throw new Error('미완료 선행 업무를 먼저 완료해 주세요.');
  }
  if(input.status==='done') {
    if(task.reviewRequired)throw new Error("이 작업은 지정 검토자의 제출물 승인이 필요합니다.");
    if(!task.definitionOfDone.trim())throw new Error("완료 기준을 먼저 작성해 주세요.");
    if(!task.assigneeId)throw new Error("담당자를 먼저 지정해 주세요.");
    await ensureEligibleTaskUser(task.assigneeId,{allowExistingSuperuser:true});
    if(task.completionMode==='submission_required') {
      if(!task.deliverable.trim()||!note)throw new Error("기대 산출물·완료 기준과 완료 근거를 먼저 작성해 주세요.");
      const evidence=await getDatabasePool().query('SELECT id FROM submissions WHERE task_id=? AND author_id=? LIMIT 1',[task.id,task.assigneeId]) as {id:number}[];
      if(!evidence.length)throw new Error("담당자의 제출물을 먼저 등록해 주세요.");
    }
  }
  const invalidatesReview=task.reviewRequired && (task.status==='done'||task.status==='changes_requested');
  const assignment=taskAssignmentGuard("tasks.project_id","tasks.activity_team_id","tasks.assignee_id",{allowExistingSuperuser:true});
  const progressGuard=input.status==='in_progress' ? ` AND EXISTS(SELECT 1 FROM projects progress_project WHERE progress_project.id=tasks.project_id AND (progress_project.project_type='collaboration' OR ${assignment.sql}))` : '';
  const doneGuard=input.status==='done' ? ` AND review_required=0 AND TRIM(definition_of_done)<>'' AND assignee_id IS NOT NULL AND ${assignment.sql}
    AND (completion_mode='direct_completion' OR (completion_mode='submission_required' AND TRIM(deliverable)<>'' AND ?<>'' AND EXISTS(SELECT 1 FROM submissions s WHERE s.task_id=tasks.id AND s.author_id=tasks.assignee_id)))` : '';
  await commitTaskMutation({...input,actor,kind:'status',permission:'execute',note,payload,
    setSql:'status=?,workflow_note=?,completed_by=?,completed_at='+ (input.status==='done'?'CURRENT_TIMESTAMP':'NULL'),
    setParams:[input.status,invalidatesReview?'작업 변경으로 검토를 다시 진행해야 합니다.':note,input.status==='done'?actor.userId:null],
    invalidateReview:invalidatesReview?{reason:note||'작업 상태가 변경되었습니다.'}:undefined,
    guardSql:`${['in_progress','done'].includes(input.status)?taskPredecessorsCompleteSql+' AND ':''}status<>'review_pending' AND (?<>'done' OR status<>'done')${progressGuard}${doneGuard}`,
    guardParams:[input.status,...(input.status==='in_progress'?assignment.params:[]),...(input.status==='done'?[...assignment.params,note]:[])]});
}

export async function listTaskEventsByProject(projectId:number):Promise<TaskEvent[]> {
  return await getDatabasePool().query(`SELECT e.id,e.task_id,e.actor_id,a.name AS actor_name,e.kind,e.status,e.assignee_id,u.name AS assignee_name,e.reviewer_id,r.name AS reviewer_name,e.note,e.task_version,e.created_at FROM task_events e JOIN tasks t ON t.id=e.task_id LEFT JOIN users a ON a.id=e.actor_id LEFT JOIN users u ON u.id=e.assignee_id LEFT JOIN users r ON r.id=e.reviewer_id WHERE t.project_id=? ORDER BY e.id DESC LIMIT 1000`,[projectId]) as TaskEvent[];
}

export async function listTaskEventsForViewer(taskId:number,viewer:ProjectViewer):Promise<TaskEvent[]> {
  const binding=projectTaskAccessGuard(viewer,"e.task_id");
  return await getDatabasePool().query(`SELECT e.id,e.task_id,e.actor_id,a.name AS actor_name,e.kind,e.status,e.assignee_id,u.name AS assignee_name,e.reviewer_id,r.name AS reviewer_name,e.note,e.task_version,e.created_at FROM task_events e LEFT JOIN users a ON a.id=e.actor_id LEFT JOIN users u ON u.id=e.assignee_id LEFT JOIN users r ON r.id=e.reviewer_id WHERE e.task_id=? AND ${binding.sql} ORDER BY e.id DESC LIMIT 30`,[taskId,...binding.params]) as TaskEvent[];
}
export async function listTaskEventsByProjectForViewer(projectId:number,viewer:ProjectViewer):Promise<TaskEvent[]> {
  const binding=projectAccessGuard(viewer,"t.project_id");
  return await getDatabasePool().query(`SELECT e.id,e.task_id,e.actor_id,a.name AS actor_name,e.kind,e.status,e.assignee_id,u.name AS assignee_name,e.reviewer_id,r.name AS reviewer_name,e.note,e.task_version,e.created_at FROM task_events e JOIN tasks t ON t.id=e.task_id LEFT JOIN users a ON a.id=e.actor_id LEFT JOIN users u ON u.id=e.assignee_id LEFT JOIN users r ON r.id=e.reviewer_id WHERE t.project_id=? AND ${binding.sql} ORDER BY e.id DESC LIMIT 1000`,[projectId,...binding.params]) as TaskEvent[];
}
