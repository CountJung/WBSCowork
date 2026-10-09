/** Fixed SQL fragments shared by task/review writers; never interpolate user identifiers. */
export const taskPredecessorsCompleteSql = `NOT EXISTS (
  SELECT 1 FROM task_dependencies dependency JOIN tasks predecessor ON predecessor.id=dependency.predecessor_id
  WHERE dependency.task_id=tasks.id AND predecessor.status<>'done'
)`;
export function lockTaskProject(taskId: number) {
  return {sql:'UPDATE projects SET id=id WHERE id=(SELECT project_id FROM tasks WHERE id=?)',params:[taskId]};
}
