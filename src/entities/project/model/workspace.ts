export const projectTypes = ["collaboration", "volunteering"] as const;
export type ProjectType = (typeof projectTypes)[number];
export const activityKinds = ["meal", "facility", "senior_care", "child_care", "recreation", "other"] as const;
export type ActivityKind = (typeof activityKinds)[number];
export type TeamRole = "member" | "leader";
export type CompletionMode = "submission_required" | "direct_completion";

/** Policy-independent storage commands; these do not delegate task permissions. */
export type WorkspaceCommand =
  | { kind: "project_type"; projectType: ProjectType }
  | { kind: "project_member"; userId: number; active: boolean }
  | { kind: "create_team"; activityKind: ActivityKind; name: string }
  | { kind: "team_member"; teamId: number; userId: number; role: TeamRole; active: boolean }
  | { kind: "task_team"; taskId: number; taskVersion: number; teamId: number | null };

export type WorkspaceActor = { userId: number; isSuperuser: boolean };
export type ProjectWorkspace = {
  projectId: number;
  projectType: ProjectType;
  version: number;
  members: { userId: number; active: boolean }[];
  teams: { id: number; name: string; activityKind: ActivityKind }[];
  teamMembers: { teamId: number; userId: number; role: TeamRole; active: boolean }[];
};

export function workspaceId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error("프로젝트·팀·회원 식별자가 올바르지 않습니다.");
  }
  return value;
}

export function normalizeWorkspaceCommand(input: WorkspaceCommand): WorkspaceCommand {
  const active = (value: unknown) => {
    if (typeof value !== "boolean") throw new Error("참여 상태가 올바르지 않습니다.");
    return value;
  };
  switch (input.kind) {
    case "project_type":
      if (!projectTypes.includes(input.projectType)) throw new Error("프로젝트 유형이 올바르지 않습니다.");
      return { kind: input.kind, projectType: input.projectType };
    case "project_member":
      return { kind: input.kind, userId: workspaceId(input.userId), active: active(input.active) };
    case "create_team": {
      if (!activityKinds.includes(input.activityKind)) throw new Error("활동 종류가 올바르지 않습니다.");
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("팀 이름은 제어 문자 없이 1~255자로 입력해 주세요.");
      return { kind: input.kind, activityKind: input.activityKind, name };
    }
    case "team_member":
      if (input.role !== "member" && input.role !== "leader") throw new Error("팀 역할이 올바르지 않습니다.");
      return { kind: input.kind, teamId: workspaceId(input.teamId), userId: workspaceId(input.userId), role: input.role, active: active(input.active) };
    case "task_team":
      return { kind: input.kind, taskId: workspaceId(input.taskId), taskVersion: workspaceId(input.taskVersion), teamId: input.teamId === null ? null : workspaceId(input.teamId) };
    default:
      throw new Error("지원하지 않는 프로젝트 변경입니다.");
  }
}
