export const taskStatusLabels = {
  planned: "예정", in_progress: "진행 중", blocked: "차단됨",
  review_pending: "검토 대기", changes_requested: "수정 요청", done: "완료",
} as const;
export type TaskStatus = keyof typeof taskStatusLabels;
export type TaskActor = { userId: number; isAdmin: boolean; isSuperuser: boolean };
export type TaskEvent = { id: number; task_id: number; actor_id: number | null; actor_name: string | null; kind: string; status: TaskStatus; assignee_id: number | null; assignee_name: string | null; reviewer_id: number | null; reviewer_name: string | null; note: string; task_version: number; created_at: string | Date };
export function workOperationToken(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new Error("요청 식별자가 올바르지 않습니다. 화면을 새로고침해 주세요.");
  return value.toLowerCase();
}
export function taskVersion(value: unknown) {
  const version=Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("작업 버전이 올바르지 않습니다. 화면을 새로고침해 주세요.");
  return version;
}
export function canExecuteTask(task: {assigneeId: number | null}, actor: TaskActor) {
  return actor.isAdmin || actor.isSuperuser || task.assigneeId === actor.userId;
}
