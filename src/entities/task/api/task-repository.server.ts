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
  const rows = (await getDatabasePool().query("SELECT id FROM projects WHERE id = ? LIMIT 1", [projectId])) as Array<{
    id: number;
  }>;
  const project = rows[0];

  if (!project) {
    throw new Error("대상 프로젝트를 찾을 수 없습니다.");
  }

  return project;
}

export async function ensureEligibleTaskUser(assigneeId?: number | null) {
  if (!assigneeId) {
    return null;
  }

  const rows = (await getDatabasePool().query("SELECT id FROM users WHERE id = ? AND (role IN ('member','admin') OR LOWER(email)=?) LIMIT 1", [assigneeId,getRuntimeEnv().auth.superuserEmail??""])) as Array<{
    id: number;
  }>;
  const assignee = rows[0];

  if (!assignee) {
    throw new Error("담당자·검토자는 현재 업무를 작성할 수 있는 회원 또는 관리자여야 합니다.");
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

export async function getTaskById(id: number): Promise<Task | null> {
  const rows = (await getDatabasePool().query(
    `SELECT
      tasks.id,
      tasks.project_id,
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
    LEFT JOIN users ON users.id = tasks.assignee_id
    LEFT JOIN users reviewer ON reviewer.id = tasks.reviewer_id
    WHERE tasks.id = ?
    LIMIT 1`,
    [getRuntimeEnv().auth.superuserEmail??"",id],
  )) as TaskRow[];

  const row = rows[0];

  return row ? mapTaskRow(row) : null;
}

export async function listTasksByProject(projectId: number): Promise<Task[]> {
  const rows = (await getDatabasePool().query(
    `SELECT
      tasks.id,
      tasks.project_id,
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
    LEFT JOIN users ON users.id = tasks.assignee_id
    LEFT JOIN users reviewer ON reviewer.id = tasks.reviewer_id
    WHERE tasks.project_id = ?
    ORDER BY tasks.order_index ASC, tasks.created_at ASC, tasks.id ASC`,
    [getRuntimeEnv().auth.superuserEmail??"",projectId],
  )) as TaskRow[];

  return rows.map(mapTaskRow);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  await ensureProjectExists(input.projectId);

  const [parentTask, assigneeId, orderIndex] = await Promise.all([
    ensureParentTask(input.projectId, input.parentId ?? null),
    ensureEligibleTaskUser(input.assigneeId ?? null),
    getNextOrderIndex(input.projectId),
  ]);

  const values=[input.projectId,parentTask?.id??null,normalizeTitle(input.title),normalizeDescription(input.description),startDate,endDate,parentTask?parentTask.depth+1:0,orderIndex,assigneeId,normalizeWorkGoal(input.deliverable,"기대 산출물"),normalizeWorkGoal(input.definitionOfDone,"완료 기준"),input.reviewRequired?1:0];
  const key=input.actor?`${input.actor.userId}:create:${workOperationToken(input.token)}`:randomUUID();
  const fingerprint=createHash('sha256').update(JSON.stringify({...input,actor:undefined,token:undefined})).digest('hex');
  if(input.actor)await assertTaskActor(input.actor);
  const duplicate=isHostedRuntime()?" ON CONFLICT DO NOTHING":" ON DUPLICATE KEY UPDATE id=tasks.id";
  const eventDuplicate=isHostedRuntime()?" ON CONFLICT DO NOTHING":" ON DUPLICATE KEY UPDATE id=task_events.id";
  await databaseBatch([
    {sql:`INSERT INTO tasks(project_id,parent_id,title,description,start_date,end_date,depth,order_index,assignee_id,deliverable,definition_of_done,review_required,creation_token,last_operation_token) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (?=1 OR EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND actor.role IN ('member','admin'))) AND (? IS NULL OR EXISTS(SELECT 1 FROM users target WHERE target.id=? AND (target.role IN ('member','admin') OR LOWER(target.email)=?)))${duplicate}`,params:[...values,key,key,!input.actor||input.actor.isSuperuser?1:0,input.actor?.userId??null,assigneeId,assigneeId,getRuntimeEnv().auth.superuserEmail??'']},
    {sql:`INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version) SELECT id,?,?,?,'created',status,assignee_id,reviewer_id,'',version FROM tasks WHERE creation_token=?${eventDuplicate}`,params:[input.actor?.userId??null,key,fingerprint,key]},
  ]);
  const created=await getDatabasePool().query('SELECT t.id,e.request_fingerprint FROM tasks t JOIN task_events e ON e.task_id=t.id AND e.operation_token=? WHERE t.creation_token=?',[key,key]) as {id:number;request_fingerprint:string}[];
  if(!created[0]||created[0].request_fingerprint!==fingerprint)throw new Error("저장된 요청과 내용이 다릅니다. 화면을 새로고침해 주세요.");
  const result={insertId:created[0].id};

  await databaseBatch(buildTaskDepthUpdates(await listTasksByProject(input.projectId)));

  const task = await getTaskById(Number(result.insertId));

  if (!task) {
    throw new Error("작업을 생성했지만 결과를 다시 불러오지 못했습니다.");
  }

  return task;
}

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  const existingTask = await getTaskById(input.id);

  if (!existingTask) {
    throw new Error("수정할 작업 정보를 찾을 수 없습니다.");
  }

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
  if(reviewRequired!==existingTask.reviewRequired) {
    const started=await getDatabasePool().query("SELECT id FROM task_events WHERE task_id=? AND status<>'planned' LIMIT 1",[existingTask.id]) as {id:number}[];
    if(existingTask.status!=='planned'||started.length)throw new Error("업무 시작 후 검토 방식은 변경할 수 없습니다.");
  }
  if(existingTask.status==='review_pending')throw new Error("검토 중인 작업은 검토 처리 후 수정해 주세요.");
  const values=[parentTask?.id ?? null,normalizeTitle(input.title),normalizeDescription(input.description),startDate,endDate,assigneeId,
    normalizeWorkGoal(input.deliverable ?? existingTask.deliverable,"기대 산출물"),normalizeWorkGoal(input.definitionOfDone ?? existingTask.definitionOfDone,"완료 기준"),reviewRequired?1:0,reviewerId];
  const setSql="parent_id=?,title=?,description=?,start_date=?,end_date=?,assignee_id=?,deliverable=?,definition_of_done=?,review_required=?,reviewer_id=?";
  if(input.actor) {
    await commitTaskMutation({id:input.id,actor:input.actor,token:input.token??randomUUID(),version:input.version??existingTask.version,kind:'updated',note:existingTask.status==='done'?'완료 후 작업 내용 변경으로 다시 열림':'',payload,setSql:`${setSql},status=?,workflow_note=?`,setParams:[...values,['done','changes_requested'].includes(existingTask.status)?'in_progress':existingTask.status,existingTask.status==='done'?'작업 내용이 변경되어 다시 확인이 필요합니다.':existingTask.workflowNote],
      invalidateReview:existingTask.reviewRequired?{reason:'작업 정보가 변경되어 이전 검토 대상이 해제되었습니다.'}:undefined,
      guardSql:"status<>'review_pending' AND (?=1 OR ? IS NULL OR EXISTS(SELECT 1 FROM users target WHERE target.id=? AND (target.role IN ('member','admin') OR LOWER(target.email)=?))) AND (?=1 OR ? IS NULL OR EXISTS(SELECT 1 FROM users target WHERE target.id=? AND (target.role IN ('member','admin') OR LOWER(target.email)=?)))",guardParams:[assigneeId===existingTask.assigneeId?1:0,assigneeId,assigneeId,getRuntimeEnv().auth.superuserEmail??'',reviewerId===existingTask.reviewerId?1:0,reviewerId,reviewerId,getRuntimeEnv().auth.superuserEmail??'']});
  } else {
    // Internal fixtures retain the repository API; production actions always supply a freshly resolved actor.
    await databaseBatch([{sql:`UPDATE tasks SET ${setSql},version=version+1 WHERE id=? AND version=?`,params:[...values,existingTask.id,existingTask.version]}]);
  }
  await databaseBatch(buildTaskDepthUpdates(await listTasksByProject(existingTask.projectId)));

  const task = await getTaskById(existingTask.id);

  if (!task) {
    throw new Error("작업을 수정했지만 결과를 다시 불러오지 못했습니다.");
  }

  return task;
}

export async function deleteTask(taskId: number) {
  const existingTask = await getTaskById(taskId);

  if (!existingTask) {
    throw new Error("삭제할 작업 정보를 찾을 수 없습니다.");
  }

  const tasks = await listTasksByProject(existingTask.projectId);
  const remaining = tasks.filter((task) => task.id !== existingTask.id).map((task) => task.parentId === existingTask.id ? { ...task, parentId: existingTask.parentId } : task);
  await databaseBatch([
    { sql: "UPDATE tasks SET parent_id = ? WHERE parent_id = ?", params: [existingTask.parentId, existingTask.id] },
    { sql: "DELETE FROM tasks WHERE id = ?", params: [existingTask.id] },
    ...buildTaskDepthUpdates(remaining),
  ]);

  return existingTask;
}
