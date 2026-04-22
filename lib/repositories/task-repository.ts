import { getDatabasePool } from "@/lib/db";
import { getProjectById } from "@/lib/repositories/project-repository";
import { getUserById } from "@/lib/repositories/user-repository";
import { mapTaskRow, type Task, type TaskRow } from "@/models/task";

export type CreateTaskInput = {
  projectId: number;
  parentId?: number | null;
  title: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  assigneeId?: number | null;
};

export type UpdateTaskInput = {
  id: number;
  parentId?: number | null;
  title: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  assigneeId?: number | null;
};

function toSqlDate(value: Date | string) {
  if (typeof value === "string") {
    return value;
  }

  return value.toISOString().slice(0, 10);
}

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
  const project = await getProjectById(projectId);

  if (!project) {
    throw new Error("대상 프로젝트를 찾을 수 없습니다.");
  }

  return project;
}

async function ensureAssigneeExists(assigneeId?: number | null) {
  if (!assigneeId) {
    return null;
  }

  const assignee = await getUserById(assigneeId);

  if (!assignee) {
    throw new Error("선택한 담당자 정보를 찾을 수 없습니다.");
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

async function rebuildTaskDepths(projectId: number) {
  const tasks = await listTasksByProject(projectId);
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

    await getDatabasePool().query("UPDATE tasks SET depth = ? WHERE id = ?", [nextDepth, task.id]);
  }
}

export async function getTaskById(id: number): Promise<Task | null> {
  const rows = (await getDatabasePool().query(
    `SELECT
      tasks.id,
      tasks.project_id,
      tasks.parent_id,
      tasks.title,
      tasks.description,
      tasks.start_date,
      tasks.end_date,
      tasks.depth,
      tasks.order_index,
      tasks.assignee_id,
      users.name AS assignee_name,
      tasks.created_at
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assignee_id
    WHERE tasks.id = ?
    LIMIT 1`,
    [id],
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
      tasks.start_date,
      tasks.end_date,
      tasks.depth,
      tasks.order_index,
      tasks.assignee_id,
      users.name AS assignee_name,
      tasks.created_at
    FROM tasks
    LEFT JOIN users ON users.id = tasks.assignee_id
    WHERE tasks.project_id = ?
    ORDER BY tasks.order_index ASC, tasks.created_at ASC, tasks.id ASC`,
    [projectId],
  )) as TaskRow[];

  return rows.map(mapTaskRow);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  await ensureProjectExists(input.projectId);

  const [parentTask, assigneeId, orderIndex] = await Promise.all([
    ensureParentTask(input.projectId, input.parentId ?? null),
    ensureAssigneeExists(input.assigneeId ?? null),
    getNextOrderIndex(input.projectId),
  ]);

  const result = (await getDatabasePool().query(
    `INSERT INTO tasks (
      project_id,
      parent_id,
      title,
      description,
      start_date,
      end_date,
      depth,
      order_index,
      assignee_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.projectId,
      parentTask?.id ?? null,
      normalizeTitle(input.title),
      normalizeDescription(input.description),
      toSqlDate(input.startDate),
      toSqlDate(input.endDate),
      parentTask ? parentTask.depth + 1 : 0,
      orderIndex,
      assigneeId,
    ],
  )) as {
    insertId: number;
  };

  await rebuildTaskDepths(input.projectId);

  const task = await getTaskById(Number(result.insertId));

  if (!task) {
    throw new Error("작업을 생성했지만 결과를 다시 불러오지 못했습니다.");
  }

  return task;
}

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const existingTask = await getTaskById(input.id);

  if (!existingTask) {
    throw new Error("수정할 작업 정보를 찾을 수 없습니다.");
  }

  const tasks = await listTasksByProject(existingTask.projectId);
  const normalizedParentId = input.parentId ?? null;

  if (normalizedParentId === existingTask.id) {
    throw new Error("작업 자신을 상위 작업으로 지정할 수 없습니다.");
  }

  const descendantIds = buildDescendantIdSet(tasks, existingTask.id);

  if (normalizedParentId && descendantIds.has(normalizedParentId)) {
    throw new Error("하위 작업을 상위 작업으로 지정할 수 없습니다.");
  }

  const [parentTask, assigneeId] = await Promise.all([
    ensureParentTask(existingTask.projectId, normalizedParentId),
    ensureAssigneeExists(input.assigneeId ?? null),
  ]);

  await getDatabasePool().query(
    `UPDATE tasks
    SET parent_id = ?, title = ?, description = ?, start_date = ?, end_date = ?, assignee_id = ?
    WHERE id = ?`,
    [
      parentTask?.id ?? null,
      normalizeTitle(input.title),
      normalizeDescription(input.description),
      toSqlDate(input.startDate),
      toSqlDate(input.endDate),
      assigneeId,
      existingTask.id,
    ],
  );

  await rebuildTaskDepths(existingTask.projectId);

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

  await getDatabasePool().query("UPDATE tasks SET parent_id = ? WHERE parent_id = ?", [existingTask.parentId, existingTask.id]);
  await getDatabasePool().query("DELETE FROM tasks WHERE id = ?", [existingTask.id]);
  await rebuildTaskDepths(existingTask.projectId);

  return existingTask;
}