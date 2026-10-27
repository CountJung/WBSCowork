import { getTeamPresentationRecord, ProjectPresentationError, type TeamPresentation } from "@/src/entities/project-presentation/index.server";
import { normalizePreparationDocument, mealQuantity, type PreparationDocument } from "@/src/entities/team-preparation";
import type { ProjectViewer } from "@/src/shared/server/project-portal-scope/index.server";
export type TeamPresentationView = Omit<TeamPresentation, "document"> & { document: PreparationDocument | null };
export async function getTeamPresentation(viewer: ProjectViewer, projectId: number, teamId: number): Promise<TeamPresentationView> {
  const result = await getTeamPresentationRecord(viewer, projectId, teamId);
  if (result.document === null) return { ...result, document: null };
  try {
    const document = normalizePreparationDocument(result.document, result.team.kind);
    return { ...result, document, mealQuantities: document.kind === "meal" ? Object.fromEntries(document.entries.map(entry => [entry.id, mealQuantity(entry)])) : {} };
  } catch { throw new ProjectPresentationError("UNAVAILABLE"); }
}
