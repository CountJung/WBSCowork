import type { ActivityKind } from "@/src/shared/config/activity-kinds";
export type PortalLayout = "workspace" | "volunteer_presentation";
export type PortalAudience = "team_private" | "project";
export type PortalSettings = { layout: PortalLayout; title: string; intro: string; version: number; updatedAt: string | null };
export type ProjectPortal = { project: { id: number; name: string; projectType: "collaboration" | "volunteering"; goal: string; startDate: string; endDate: string }; settings: PortalSettings; canManage: boolean };
export type PortalTeam = { id: number; name: string; kind: ActivityKind; canRead: boolean; canEdit: boolean; audience: PortalAudience; publicationVersion: number; preparationVersion: number; publishedAt: string | null };
export type TeamPresentation = { team: PortalTeam; document: unknown | null; mealQuantities: Record<string, number>; sourceVersion: number | null; published: boolean };
export type SavePortalSettingsInput = { version: number; mutationKey: string; layout: PortalLayout; title: string; intro: string };
export type SaveTeamPublicationInput = { version: number; mutationKey: string; audience: PortalAudience; preparationVersion: number };
export class ProjectPresentationError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE") { super(code); this.name = "ProjectPresentationError"; }
  get status() { return this.code === "INVALID_INPUT" ? 400 : this.code === "NOT_FOUND" ? 404 : this.code === "CONFLICT" ? 409 : 503; }
}
