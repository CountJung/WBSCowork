import { projectAccessGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { taskManagementGuard, taskAssignmentGuard } from "@/src/shared/server/task-scope/index.server";
import { assertTaskScope } from "./task-permissions.server";
import { lockTaskProject } from "@/src/shared/server/task-dependencies/index.server";
import { createHash, randomUUID } from "node:crypto";
import { assertTaskActor, commitTaskMutation, hasTaskMutation } from "./task-workflow.server";
import { taskVersion, workOperationToken, type TaskActor } from "../model/workflow";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { normalizeWorkGoal } from "@/src/shared/lib/work-goals";
import { validateDateRange } from "@/src/shared/lib/date";
import { getDatabasePool, databaseBatch, type QueryStatement } from "@/src/shared/server/database/index.server";
import { mapTaskRow, type Task, type TaskRow } from "../model/task";

export type CreateTaskInput = {
  actor?: TaskActor;
  token?: string;
  projectId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  deliverable?: string;
  definitionOfDone?: string;
  reviewRequired?: boolean;
  startDate: Date | string;
  endDate: Date | string;
  assigneeId?: number | null;
  activityTeamId?: number | null;
  completionMode?: "submission_required" | "direct_completion";
};

export type UpdateTaskInput = {
  actor?: TaskActor;
  token?: string;
  version?: number;
  reviewerId?: number | null;
  id: number;
  parentId?: number | null;
  title: string;
  description?: string;
  deliverable?: string;
  definitionOfDone?: string;
  reviewRequired?: boolean;
  startDate: Date | string;
  endDate: Date | string;
  assigneeId?: number | null;
  activityTeamId?: number | null;
  completionMode?: "submission_required" | "direct_completion";
};


function normalizeTitle(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("작업 제목은 비워 둘 수 없습니다.");
  }

  return normalizedTitle;
}

function normalizeDescription(description?: string) {
  const normalizedDescription = description?.trim() ?? "";

  return normalizedDescription.length > 0 ? normalizedDescription : null;
}

async function ensureProjectExists(projectId: number) {
  const rows = (await getDatabasePool().query("SELECT id,project_type,access_mode FROM projects WHERE id = ? LIMIT 1", [projectId])) as Array<{
    id: number; project_type: "collaboration" | "volunteering";access_mode:"legacy_authenticated"|"members_only";
  }>;
  const project = rows[0];

  if (!project) {
    throw new Error("대상 프로젝트를 찾을 수 없습니다.");
  }

  return project;
}

export async function ensureEligibleTaskUser(assigneeId?: number | null,options:{allowExistingSuperuser?:boolean}={}) {
  if (!assigneeId) {
    return null;
  }

  const rows = (await getDatabasePool().query("SELECT id FROM users WHERE id = ? AND ((?=1 AND LOWER(TRIM(email))=?) OR (role IN ('member','admin') AND LOWER(TRIM(email))<>?)) LIMIT 1", [assigneeId,options.allowExistingSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??"",getRuntimeEnv().auth.superuserEmail??""])) as Array<{
    id: number;
  }>;
  const assignee = rows[0];

  if (!assignee) {
    throw new Error("담당자·검토자는 슈퍼관리자를 제외한 현재 업무를 작성할 수 있는 회원 또는 관리자여야 합니다.");
  }

  return assignee.id;
}

async function ensureParentTask(projectId: number, parentId?: number | null) {
  if (!parentId) {
    return null;
  }

  const parentTask = await getTaskById(parentId);

  if (!parentTask || parentTask.projectId !== projectId) {
    throw new Error("같은 프로젝트 안의 상위 작업만 선택할 수 있습니다.");
  }

  return parentTask;
}

function buildDescendantIdSet(tasks: Task[], rootTaskId: number) {
  const childrenByParentId = new Map<number, number[]>();

  for (const task of tasks) {
    if (!task.parentId) {
      continue;
    }

    const childIds = childrenByParentId.get(task.parentId) ?? [];
    childIds.push(task.id);
    childrenByParentId.set(task.parentId, childIds);
  }

  const descendantIds = new Set<number>();
  const pendingTaskIds = [...(childrenByParentId.get(rootTaskId) ?? [])];

  while (pendingTaskIds.length > 0) {
    const taskId = pendingTaskIds.shift();

    if (!taskId || descendantIds.has(taskId)) {
      continue;
    }

    descendantIds.add(taskId);
    pendingTaskIds.push(...(childrenByParentId.get(taskId) ?? []));
  }

  return descendantIds;
}

async function getNextOrderIndex(projectId: number) {
  const rows = (await getDatabasePool().query(
    "SELECT COALESCE(MAX(order_index), -1) AS maxOrderIndex FROM tasks WHERE project_id = ?",
    [projectId],
  )) as Array<{
    maxOrderIndex: number;
  }>;

  return Number(rows[0]?.maxOrderIndex ?? -1) + 1;
}

function buildTaskDepthUpdates(tasks: Task[]) {
  const statements: QueryStatement[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const memoizedDepths = new Map<number, number>();
  const visitingTaskIds = new Set<number>();

  function resolveDepth(taskId: number): number {
    const cachedDepth = memoizedDepths.get(taskId);

    if (typeof cachedDepth === "number") {
      return cachedDepth;
    }

    if (visitingTaskIds.has(taskId)) {
      throw new Error("작업 계층 구조에 순환 참조가 감지되었습니다.");
    }

    const task = tasksById.get(taskId);

    if (!task) {
      return 0;
    }

    visitingTaskIds.add(taskId);

    const depth = task.parentId && tasksById.has(task.parentId) ? resolveDepth(task.parentId) + 1 : 0;

    visitingTaskIds.delete(taskId);
    memoizedDepths.set(taskId, depth);

    return depth;
  }

  for (const task of tasks) {
    const nextDepth = resolveDepth(task.id);

    if (task.depth === nextDepth) {
      continue;
    }

    statements.push({ sql: "UPDATE tasks SET depth = ? WHERE id = ?", params: [nextDepth, task.id] });
  }
  return statements;
}

export async function getTaskById(id: number, viewer?:ProjectViewer): Promise<Task | null> {
  const access=viewer?projectAccessGuard(viewer):{sql:"1=1",params:[]};
  const rows = (await getDatabasePool().query(
    `SELECT
      tasks.id,
      tasks.project_id, tasks.activity_team_id, tasks.completion_mode, tasks.completed_by, tasks.completed_at, completer.name AS completed_by_name, CASE WHEN LOWER(TRIM(completer.email))=? THEN 1 ELSE 0 END AS completed_by_is_superuser,
      activity_team.name AS activity_team_name,
      tasks.parent_id,
      tasks.title,
      tasks.description,
      tasks.deliverable,
      tasks.definition_of_done,
      tasks.review_required,
      tasks.status, tasks.version, tasks.workflow_note, tasks.reviewer_id,
      reviewer.name AS reviewer_name, CASE WHEN users.role IN ('member','admin') OR LOWER(users.email)=? THEN 1 ELSE 0 END AS assignee_eligible,
      tasks.start_date,
      tasks.end_date,
      tasks.depth,
      tasks.order_index,
      tasks.assignee_id,
      users.name AS assignee_name,
      tasks.created_at
    FROM tasks
    LEFT JOIN activity_teams activity_team ON activity_team.id=tasks.activity_team_id AND activity_team.project_id=tasks.project_id
    LEFT JOIN users ON users.id = tasks.assignee_id
    LEFT JOIN users reviewer ON reviewer.id = tasks.reviewer_id
    LEFT JOIN users completer ON completer.id=tasks.completed_by
    WHERE tasks.id = ? AND ${access.sql}
    LIMIT 1`,
    [getRuntimeEnv().auth.superuserEmail??"",getRuntimeEnv().auth.superuserEmail??"",id,...access.params],
  )) as TaskRow[];

  const row = rows[0];

  return row ? mapTaskRow(row) : null;
}

export async function listTasksByProject(projectId: number, viewer?:ProjectViewer): Promise<Task[]> {
  const access=viewer?projectAccessGuard(viewer):{sql:"1=1",params:[]};
  const rows = (await getDatabasePool().query(
    `SELECT
      tasks.id,
      tasks.project_id, tasks.activity_team_id, tasks.completion_mode, tasks.completed_by, tasks.completed_at, completer.name AS completed_by_name, CASE WHEN LOWER(TRIM(completer.email))=? THEN 1 ELSE 0 END AS completed_by_is_superuser,
      activity_team.name AS activity_team_name,
      tasks.parent_id,
      tasks.title,
      tasks.description,
      tasks.deliverable,
      tasks.definition_of_done,
      tasks.review_required,
      tasks.status, tasks.version, tasks.workflow_note, tasks.reviewer_id,
      reviewer.name AS reviewer_name, CASE WHEN users.role IN ('member','admin') OR LOWER(users.email)=? THEN 1 ELSE 0 END AS assignee_eligible,
      tasks.start_date,
      tasks.end_date,
      tasks.depth,
      tasks.order_index,
      tasks.assignee_id,
      users.name AS assignee_name,
      tasks.created_at
    FROM tasks
    LEFT JOIN activity_teams activity_team ON activity_team.id=tasks.activity_team_id AND activity_team.project_id=tasks.project_id
    LEFT JOIN users ON users.id = tasks.assignee_id
    LEFT JOIN users reviewer ON reviewer.id = tasks.reviewer_id
    LEFT JOIN users completer ON completer.id=tasks.completed_by
    WHERE tasks.project_id = ? AND ${access.sql}
    ORDER BY tasks.order_index ASC, tasks.created_at ASC, tasks.id ASC`,
    [getRuntimeEnv().auth.superuserEmail??"",getRuntimeEnv().auth.superuserEmail??"",projectId,...access.params],
  )) as TaskRow[];

  return rows.map(mapTaskRow);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  const project = await ensureProjectExists(input.projectId);
  if ((project.project_type === "volunteering" || project.access_mode==='members_only') && !input.actor) throw new Error("봉사활동 업무에는 현재 관리자·팀장 확인이 필요합니다.");
  const [parentTask, assigneeId, orderIndex] = await Promise.all([
    ensureParentTask(input.projectId, input.parentId ?? null), ensureEligibleTaskUser(input.assigneeId ?? null), getNextOrderIndex(input.projectId),
  ]);
  const teamId = input.activityTeamId === undefined ? parentTask?.activityTeamId ?? null : input.activityTeamId;
  if (teamId !== null && (!Number.isSafeInteger(teamId) || teamId < 1)) throw new Error("활동팀이 올바르지 않습니다.");
  const completionMode = input.completionMode ?? (project.project_type === "volunteering" ? "direct_completion" : "submission_required");
  if (!["submission_required","direct_completion"].includes(completionMode)) throw new Error("완료 방식이 올바르지 않습니다.");
  if (project.project_type === "collaboration" && completionMode !== "submission_required") throw new Error("업무 협업 프로젝트는 제출 필수 방식을 유지합니다.");
  if (completionMode === "direct_completion" && input.reviewRequired) throw new Error("직접 완료와 제출물 검토 필수는 함께 사용할 수 없습니다.");
  if(input.actor) {
    await assertTaskActor(input.actor);
    if(parentTask) await assertTaskScope(parentTask.id,input.actor);
  }
  const values=[parentTask?.id??null,normalizeTitle(input.title),normalizeDescription(input.description),startDate,endDate,parentTask?parentTask.depth+1:0,orderIndex,assigneeId,normalizeWorkGoal(input.deliverable,"기대 산출물"),normalizeWorkGoal(input.definitionOfDone,"완료 기준"),input.reviewRequired?1:0];
  const key=input.actor?`${input.actor.userId}:create:${workOperationToken(input.token)}`:randomUUID();
  const fingerprint=createHash('sha256').update(JSON.stringify({...input,actor:undefined,token:undefined})).digest('hex');
  const scope=input.actor?taskManagementGuard(input.actor,"p.id","chosen_team.id"):{sql:"p.project_type='collaboration'",params:[]};
  const assignment=taskAssignmentGuard("p.id","chosen_team.id","selected_user.id");
  const parentScope=input.actor ? taskManagementGuard(input.actor,"parent_scope.project_id","parent_scope.activity_team_id") : {sql:"1=1",params:[]};
  const parentGuard=parentTask ? ` AND EXISTS(SELECT 1 FROM tasks parent_scope WHERE parent_scope.id=? AND parent_scope.project_id=p.id AND ${parentScope.sql})` : "";
  const duplicate=isHostedRuntime()?" ON CONFLICT DO NOTHING":" ON DUPLICATE KEY UPDATE id=tasks.id";
  const eventDuplicate=isHostedRuntime()?" ON CONFLICT DO NOTHING":" ON DUPLICATE KEY UPDATE id=task_events.id";
  await databaseBatch([
    {sql:"UPDATE projects SET id=id WHERE id=?",params:[input.projectId]},
    {sql:`INSERT INTO tasks(project_id,parent_id,title,description,start_date,end_date,depth,order_index,assignee_id,deliverable,definition_of_done,review_required,creation_token,last_operation_token,activity_team_id,completion_mode)
      SELECT p.id,?,?,?,?,?,?,?,?,?,?,?,?,?,chosen_team.id,? FROM projects p
      LEFT JOIN activity_teams chosen_team ON chosen_team.id=? AND chosen_team.project_id=p.id
      LEFT JOIN users selected_user ON selected_user.id=?
      WHERE p.id=? AND p.project_type=? AND (? IS NULL OR chosen_team.id IS NOT NULL) AND (? IS NULL OR selected_user.id IS NOT NULL)
      AND ${scope.sql} AND ${assignment.sql}${parentGuard}${duplicate}`,
      params:[...values,key,key,completionMode,teamId,assigneeId,input.projectId,project.project_type,teamId,assigneeId,...scope.params,...assignment.params,...(parentTask?[parentTask.id,...parentScope.params]:[])]},
    {sql:`INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version) SELECT id,?,?,?,'created',status,assignee_id,reviewer_id,'',version FROM tasks WHERE creation_token=?${eventDuplicate}`,params:[input.actor?.userId??null,key,fingerprint,key]},
  ]);
  const receiptScope=input.actor?taskManagementGuard(input.actor,"t.project_id","t.activity_team_id"):{sql:"1=1",params:[]};
  const created=await getDatabasePool().query(`SELECT t.id,e.request_fingerprint FROM tasks t JOIN task_events e ON e.task_id=t.id AND e.operation_token=? WHERE t.creation_token=? AND ${receiptScope.sql}`,[key,key,...receiptScope.params]) as {id:number;request_fingerprint:string}[];
  if(!created[0]||created[0].request_fingerprint!==fingerprint)throw new Error("저장된 요청과 내용이 다르거나 현재 팀 관리·배정 권한이 없습니다. 화면을 새로고침해 주세요.");
  await databaseBatch(buildTaskDepthUpdates(await listTasksByProject(input.projectId)));
  const task=await getTaskById(Number(created[0].id));
  if(!task)throw new Error("작업을 생성했지만 결과를 다시 불러오지 못했습니다.");
  return task;
}

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  const existingTask = await getTaskById(input.id);

  if (!existingTask) {
    throw new Error("수정할 작업 정보를 찾을 수 없습니다.");
  }

  const project = await ensureProjectExists(existingTask.projectId);
  if((project.project_type === "volunteering" || project.access_mode==='members_only') && !input.actor) throw new Error("봉사활동 업무에는 현재 팀 관리 권한 확인이 필요합니다.");
  if(input.actor) await assertTaskScope(existingTask.id,input.actor);
  const payload={...input,actor:undefined,token:undefined};
  if(input.actor) {
    if(await hasTaskMutation({id:input.id,actor:input.actor,token:input.token??"",kind:'updated',payload}))return existingTask;
    if(taskVersion(input.version)!==existingTask.version)throw new Error("작업 버전이 변경되었습니다. 새로고침 후 다시 확인해 주세요.");
  }
  const tasks = await listTasksByProject(existingTask.projectId);
  const normalizedParentId = input.parentId ?? null;
  const requestedAssignee=input.assigneeId===undefined?existingTask.assigneeId:input.assigneeId;

  if (normalizedParentId === existingTask.id) {
    throw new Error("작업 자신을 상위 작업으로 지정할 수 없습니다.");
  }

  const descendantIds = buildDescendantIdSet(tasks, existingTask.id);

  if (normalizedParentId && descendantIds.has(normalizedParentId)) {
    throw new Error("하위 작업을 상위 작업으로 지정할 수 없습니다.");
  }

  const [parentTask, assigneeId] = await Promise.all([
    ensureParentTask(existingTask.projectId, normalizedParentId),
    requestedAssignee === existingTask.assigneeId ? Promise.resolve(existingTask.assigneeId) : ensureEligibleTaskUser(requestedAssignee),
  ]);

  const reviewerId=input.reviewerId === undefined ? existingTask.reviewerId : input.reviewerId;
  if(reviewerId !== existingTask.reviewerId) await ensureEligibleTaskUser(reviewerId);
  if(reviewerId && reviewerId===assigneeId)throw new Error("담당자와 검토자는 서로 달라야 합니다.");
  const reviewRequired=input.reviewRequired ?? existingTask.reviewRequired;
  const completionMode=input.completionMode ?? existingTask.completionMode;
  if(!["submission_required","direct_completion"].includes(completionMode)) throw new Error("완료 방식이 올바르지 않습니다.");
  if(project.project_type === "collaboration" && completionMode !== "submission_required") throw new Error("업무 협업 프로젝트는 제출 필수 방식을 유지합니다.");
  if(completionMode==='direct_completion' && reviewRequired) throw new Error("직접 완료와 제출물 검토 필수는 함께 사용할 수 없습니다.");
  const teamId=input.activityTeamId === undefined ? existingTask.activityTeamId : input.activityTeamId;
  if(teamId !== null && (!Number.isSafeInteger(teamId) || teamId < 1)) throw new Error("활동팀이 올바르지 않습니다.");
  if(input.actor && parentTask) await assertTaskScope(parentTask.id,input.actor);
  if(reviewRequired!==existingTask.reviewRequired || completionMode!==existingTask.completionMode || teamId!==existingTask.activityTeamId) {
    const started=await getDatabasePool().query("SELECT id FROM task_events WHERE task_id=? AND status<>'planned' LIMIT 1",[existingTask.id]) as {id:number}[];
    if(existingTask.status!=='planned'||started.length)throw new Error("업무 시작 후 완료·검토 방식과 활동팀은 변경할 수 없습니다.");
  }
  if(existingTask.status==='review_pending')throw new Error("검토 중인 작업은 검토 처리 후 수정해 주세요.");
  const values=[parentTask?.id ?? null,normalizeTitle(input.title),normalizeDescription(input.description),startDate,endDate,assigneeId,
    normalizeWorkGoal(input.deliverable ?? existingTask.deliverable,"기대 산출물"),normalizeWorkGoal(input.definitionOfDone ?? existingTask.definitionOfDone,"완료 기준"),reviewRequired?1:0,reviewerId,teamId,completionMode];
  const setSql="parent_id=?,title=?,description=?,start_date=?,end_date=?,assignee_id=?,deliverable=?,definition_of_done=?,review_required=?,reviewer_id=?,activity_team_id=?,completion_mode=?";
  const assignment = taskAssignmentGuard("tasks.project_id","chosen_team.id","selected_user.id");
  const newScope = input.actor ? taskManagementGuard(input.actor,"tasks.project_id","chosen_team.id") : {sql:"EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND p.project_type='collaboration')",params:[]};
  const teamAssignmentGuard = `EXISTS(SELECT 1 FROM projects assignment_project
    LEFT JOIN activity_teams chosen_team ON chosen_team.id=? AND chosen_team.project_id=assignment_project.id
    LEFT JOIN users selected_user ON selected_user.id=?
    WHERE assignment_project.id=tasks.project_id AND (? IS NULL OR chosen_team.id IS NOT NULL)
      AND ${newScope.sql} AND ((assignment_project.project_type='collaboration' AND ?=1) OR (?=1 AND LOWER(TRIM(selected_user.email))=?) OR ${assignment.sql}))`;
  const teamAssignmentParams = [teamId,assigneeId,teamId,...newScope.params,assigneeId===existingTask.assigneeId?1:0,assigneeId===existingTask.assigneeId&&teamId===existingTask.activityTeamId?1:0,getRuntimeEnv().auth.superuserEmail??"",...assignment.params];
  const parentScope=input.actor ? taskManagementGuard(input.actor,"parent_scope.project_id","parent_scope.activity_team_id") : {sql:"1=1",params:[]};
  const parentGuard=parentTask ? ` AND EXISTS(SELECT 1 FROM tasks parent_scope WHERE parent_scope.id=? AND parent_scope.project_id=tasks.project_id AND ${parentScope.sql})` : "";
  const parentGuardParams=parentTask ? [parentTask.id,...parentScope.params] : [];
  const configurationGuard = (reviewRequired!==existingTask.reviewRequired || completionMode!==existingTask.completionMode || teamId!==existingTask.activityTeamId)
    ? " AND status='planned' AND NOT EXISTS(SELECT 1 FROM task_events started WHERE started.task_id=tasks.id AND started.status<>'planned')" : "";
  if(input.actor) {
    await commitTaskMutation({id:input.id,actor:input.actor,token:input.token??randomUUID(),version:input.version??existingTask.version,kind:'updated',note:existingTask.status==='done'?'완료 후 작업 내용 변경으로 다시 열림':'',payload,setSql:`${setSql},status=?,workflow_note=?,completed_by=NULL,completed_at=NULL`,setParams:[...values,['done','changes_requested'].includes(existingTask.status)?'in_progress':existingTask.status,existingTask.status==='done'?'작업 내용이 변경되어 다시 확인이 필요합니다.':existingTask.workflowNote],
      invalidateReview:existingTask.reviewRequired?{reason:'작업 정보가 변경되어 이전 검토 대상이 해제되었습니다.'}:undefined,
      guardSql:`status<>'review_pending' AND (?=1 OR ? IS NULL OR EXISTS(SELECT 1 FROM users target WHERE target.id=? AND (target.role IN ('member','admin') AND LOWER(TRIM(target.email))<>?))) AND (?=1 OR ? IS NULL OR EXISTS(SELECT 1 FROM users target WHERE target.id=? AND (target.role IN ('member','admin') AND LOWER(TRIM(target.email))<>?))) AND ${teamAssignmentGuard}${configurationGuard}${parentGuard}`,guardParams:[assigneeId===existingTask.assigneeId?1:0,assigneeId,assigneeId,getRuntimeEnv().auth.superuserEmail??'',reviewerId===existingTask.reviewerId?1:0,reviewerId,reviewerId,getRuntimeEnv().auth.superuserEmail??'',...teamAssignmentParams,...parentGuardParams]});
  } else {
    // Internal fixtures retain the repository API; production actions always supply a freshly resolved actor.
    const results = await databaseBatch([{sql:`UPDATE tasks SET ${setSql},version=version+1 WHERE id=? AND version=? AND ${teamAssignmentGuard}${configurationGuard}${parentGuard}`,params:[...values,existingTask.id,existingTask.version,...teamAssignmentParams,...parentGuardParams]}]);
    // This guarded UPDATE always increments version; zero changes is rejection.
    const result = results[0] as {affectedRows?:number;meta?:{changes:number}};
    if (Number(result.affectedRows ?? result.meta?.changes ?? 0) < 1) throw new Error("업무 또는 팀 배정이 변경되었습니다. 새로고침해 주세요.");
  }
  await databaseBatch(buildTaskDepthUpdates(await listTasksByProject(existingTask.projectId)));

  const task = await getTaskById(existingTask.id);

  if (!task) {
    throw new Error("작업을 수정했지만 결과를 다시 불러오지 못했습니다.");
  }

  return task;
}

export async function deleteTask(taskId: number, actor?: TaskActor) {
  const existingTask = await getTaskById(taskId);

  if (!existingTask) {
    throw new Error("삭제할 작업 정보를 찾을 수 없습니다.");
  }

  const project = await ensureProjectExists(existingTask.projectId);
  if(actor) { await assertTaskActor(actor); await assertTaskScope(taskId,actor); }
  else if(project.project_type === "volunteering" || project.access_mode==='members_only') throw new Error("봉사활동 업무 삭제에는 현재 팀 관리 권한 확인이 필요합니다.");
  const scope=actor?taskManagementGuard(actor):{sql:"EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND p.project_type='collaboration')",params:[]};
  const manageAll=actor?taskManagementGuard(actor,"tasks.project_id","NULL"):{sql:"1=1",params:[]};
  const childSafety=`(${manageAll.sql} OR NOT EXISTS(SELECT 1 FROM tasks child WHERE child.parent_id=tasks.id))`;
  const tasks = await listTasksByProject(existingTask.projectId);
  if(project.project_type==='volunteering' && tasks.some(t=>t.parentId===taskId) && actor) {
    const all=await getDatabasePool().query(`SELECT tasks.id FROM tasks WHERE tasks.id=? AND ${manageAll.sql}`,[taskId,...manageAll.params]) as {id:number}[];
    if(!all.length)throw new Error("하위 업무가 있는 봉사활동 업무 삭제는 관리자만 처리할 수 있습니다.");
  }
  const references = await getDatabasePool().query("SELECT id FROM task_dependencies WHERE task_id=? OR predecessor_id=? LIMIT 1",[taskId,taskId]) as {id:number}[];
  if(references.length)throw new Error("선행 관계를 먼저 해제한 뒤 작업을 삭제해 주세요.");
  const remaining = tasks.filter((task) => task.id !== existingTask.id).map((task) => task.parentId === existingTask.id ? { ...task, parentId: existingTask.parentId } : task);
  await databaseBatch([
    lockTaskProject(taskId),
    { sql: `UPDATE tasks SET parent_id = ? WHERE parent_id = ? AND EXISTS(SELECT 1 FROM tasks retained WHERE retained.id=? AND ${scope.sql.replaceAll("tasks.","retained.")} AND ${manageAll.sql.replaceAll("tasks.","retained.")}) AND NOT EXISTS(SELECT 1 FROM task_dependencies WHERE task_id=? OR predecessor_id=?)`, params: [existingTask.parentId, existingTask.id,taskId,...scope.params,...manageAll.params,taskId,taskId] },
    { sql: `DELETE FROM tasks WHERE id = ? AND ${scope.sql} AND ${childSafety} AND NOT EXISTS(SELECT 1 FROM task_dependencies WHERE task_id=? OR predecessor_id=?)`, params: [existingTask.id,...scope.params,...manageAll.params,taskId,taskId] },
    ...buildTaskDepthUpdates(remaining).map(statement=>({sql:statement.sql+" AND NOT EXISTS(SELECT 1 FROM tasks retained WHERE retained.id=?)",params:[...(statement.params??[]),taskId]})),
  ]);

  if(await getTaskById(taskId))throw new Error("선행 관계가 변경되었습니다. 관계를 먼저 해제해 주세요.");
  return existingTask;
}

/** Unfiltered variants above remain for already-authorized internal mutations only. */
export function getTaskByIdForViewer(id:number,viewer:ProjectViewer){return getTaskById(id,viewer);}
export function listTasksByProjectForViewer(projectId:number,viewer:ProjectViewer){return listTasksByProject(projectId,viewer);}
