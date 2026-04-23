import type { Project } from "@/models/project";
import type { Task } from "@/models/task";

export function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getOrderedTasks(tasks: Task[]) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const tasksByParentId = new Map<number | null, Task[]>();

  for (const task of tasks) {
    const parentId = task.parentId && tasksById.has(task.parentId) ? task.parentId : null;
    const group = tasksByParentId.get(parentId) ?? [];

    group.push(task);
    tasksByParentId.set(parentId, group);
  }

  for (const group of tasksByParentId.values()) {
    group.sort((leftTask, rightTask) => {
      if (leftTask.orderIndex !== rightTask.orderIndex) {
        return leftTask.orderIndex - rightTask.orderIndex;
      }

      return leftTask.id - rightTask.id;
    });
  }

  const orderedTasks: Task[] = [];

  function visit(parentId: number | null) {
    for (const task of tasksByParentId.get(parentId) ?? []) {
      orderedTasks.push(task);
      visit(task.id);
    }
  }

  visit(null);

  return orderedTasks;
}

export function getSelectedProject(projects: Project[], projectIdParam?: string) {
  const projectId = Number(projectIdParam);

  if (Number.isInteger(projectId) && projectId > 0) {
    const selectedProject = projects.find((project) => project.id === projectId);

    if (selectedProject) {
      return selectedProject;
    }
  }

  return projects[0] ?? null;
}

export function getSelectedTask(tasks: Task[], taskIdParam?: string) {
  const taskId = Number(taskIdParam);

  if (Number.isInteger(taskId) && taskId > 0) {
    const selectedTask = tasks.find((task) => task.id === taskId);

    if (selectedTask) {
      return selectedTask;
    }
  }

  return null;
}