import { activityKinds, type ActivityKind } from "@/src/shared/config/activity-kinds";
export { activityKinds, activityKindLabels, type ActivityKind } from "@/src/shared/config/activity-kinds";

export const projectTypes = ["collaboration", "volunteering"] as const;
export type ProjectType = (typeof projectTypes)[number];
export type TeamRole = "member" | "leader";
export type CompletionMode = "submission_required" | "direct_completion";

/** Admin roster commands; canonical team leadership is checked by task guards. */
export type WorkspaceCommand =
  | {kind:"access_mode";accessMode:"legacy_authenticated"|"members_only";confirmImpact:boolean;impactHash:string}
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
  teams: { id: number; name: string; activityKind: ActivityKind; leaderUserId: number | null }[];
  teamMembers: { teamId: number; userId: number; role: TeamRole; active: boolean }[];
};
export type TaskTeamDirectory = {teams:ProjectWorkspace["teams"];memberIdsByTeam:Record<number,number[]>;projectMemberIds?:number[]};

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
    case "access_mode":
      if(!["legacy_authenticated","members_only"].includes(input.accessMode)||input.confirmImpact!==true||!/^([a-f0-9]{64})$/.test(input.impactHash))throw new Error("영향 미리보기를 다시 확인하고 접근 정책 변경에 동의해 주세요.");
      return {kind:input.kind,accessMode:input.accessMode,confirmImpact:true,impactHash:input.impactHash};
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

export type ProjectAccessPreview={projectId:number;accessMode:"legacy_authenticated"|"members_only";version:number;impactHash:string;activeMemberCount:number;visibleUserCount:number;blockedUserCount:number;unboundOpenTaskCount:number;unboundReviewerCount:number;leaderCount:number;canRestrict:boolean;warnings:string[]};
