import { assertReportOrigin, boundedReportJson, getReportViewer, positiveReportId, reportHttpError, reportJson, ReportRequestError, retainProjectReports } from "@/src/features/project-digest-generate/index.server";
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try { assertReportOrigin(request); const { projectId } = await params, viewer = await getReportViewer(), value = await boundedReportJson(request);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportRequestError(400, "INVALID_REQUEST");
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some(key => key !== "dryRun" && key !== "artifactIds") || typeof data.dryRun !== "boolean" || (!data.dryRun && (!Array.isArray(data.artifactIds) || data.artifactIds.some(id => typeof id !== "number")))) throw new ReportRequestError(400, "INVALID_REQUEST");
    return reportJson(await retainProjectReports(viewer, positiveReportId(projectId), data.dryRun, data.artifactIds as number[] | undefined));
  } catch (error) { return reportHttpError(error); }
}
