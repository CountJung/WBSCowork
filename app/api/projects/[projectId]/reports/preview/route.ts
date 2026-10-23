import { collectProjectReport } from "@/src/entities/project-report/index.server";
import { randomUUID } from "node:crypto";
import { getReportViewer, parseReportRequest, positiveReportId, reportHttpError, reportJson } from "@/src/features/project-digest-generate/index.server";
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try { const { projectId } = await params, url = new URL(request.url), viewer = await getReportViewer();
    const input = parseReportRequest({ projectId: positiveReportId(projectId), requestId: randomUUID(), start: url.searchParams.get("start"), end: url.searchParams.get("end"), timeZone: url.searchParams.get("timeZone"), audienceMode: url.searchParams.get("audienceMode"), formats: ["docx"], dryRun: true });
    return reportJson(await collectProjectReport(viewer, input));
  } catch (error) { return reportHttpError(error); }
}
