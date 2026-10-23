import { createReportSchedule, listReportSchedules } from "@/src/entities/project-report/index.server";
import { assertReportOrigin, assertReportProjectScope, boundedReportJson, getReportViewer, positiveReportId, reportHttpError, reportJson, ReportRequestError } from "@/src/features/project-digest-generate/index.server";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { const { projectId } = await params, viewer = await getReportViewer(), id = positiveReportId(projectId); await assertReportProjectScope(viewer, id); return reportJson(await listReportSchedules(viewer, id)); } catch (error) { return reportHttpError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { assertReportOrigin(request); const viewer = await getReportViewer(), { projectId } = await params, value = await boundedReportJson(request);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportRequestError(400, "INVALID_REQUEST");
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some(key => !["timeZone", "lookbackHours", "formats"].includes(key)) || typeof data.timeZone !== "string" || typeof data.lookbackHours !== "number" || !Array.isArray(data.formats) || data.formats.some(format => format !== "docx" && format !== "pptx")) throw new ReportRequestError(400, "INVALID_REQUEST");
    const schedule = await createReportSchedule(viewer, { projectId: positiveReportId(projectId), timeZone: data.timeZone, lookbackHours: data.lookbackHours, formats: data.formats });
    return reportJson(schedule, 201);
  } catch (error) { return reportHttpError(error); }
}
