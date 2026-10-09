type CompletionTask = {
  id: number;
  parentId: number | null;
  status: string;
};

export type TaskCompletion = {
  isContainer: boolean;
  completedLeafCount: number;
  leafCount: number;
  percent: number;
};

function completionPercent(completed: number, total: number) {
  if (total === 0) {
    return 0;
  }

  // Reserve 100% for fully completed work, even when rounding a large group.
  return completed === total ? 100 : Math.min(99, Math.round(completed / total * 100));
}

/** Completion counts each leaf once; containers summarize their descendant leaves. */
export function summarizeTaskCompletion(tasks: readonly CompletionTask[]) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const parentIds = new Set(tasks.flatMap((task) => task.parentId === null ? [] : [task.parentId]));
  const byTaskId = new Map<number, TaskCompletion>(tasks.map((task) => [task.id, {
    isContainer: parentIds.has(task.id),
    completedLeafCount: 0,
    leafCount: 0,
    percent: 0,
  }]));
  let completedLeafCount = 0;
  let leafCount = 0;
  const statusCounts = new Map<string, number>();

  for (const task of tasks) {
    if (parentIds.has(task.id)) {
      continue;
    }

    const completed = task.status === "done" ? 1 : 0;
    completedLeafCount += completed;
    leafCount += 1;
    statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1);

    // Walk up from each leaf so nested containers never add extra work to totals.
    // A visited set also keeps malformed historical hierarchies from looping.
    const visited = new Set<number>();
    let current: CompletionTask | undefined = task;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const completion = byTaskId.get(current.id)!;
      completion.completedLeafCount += completed;
      completion.leafCount += 1;
      completion.percent = completionPercent(completion.completedLeafCount, completion.leafCount);
      current = current.parentId === null ? undefined : tasksById.get(current.parentId);
    }
  }

  return {
    byTaskId,
    completedLeafCount,
    leafCount,
    remainingLeafCount: leafCount - completedLeafCount,
    statusCounts,
    percent: completionPercent(completedLeafCount, leafCount),
  };
}
