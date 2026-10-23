import { renderProjectReport } from "@/src/features/project-report-export/index.server";
import { assertReportOrigin, getReportViewer, positiveReportId, reportHttpError, reportJson, retryProjectReport } from "@/src/features/project-digest-generate/index.server";
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try { assertReportOrigin(request); const viewer = await getReportViewer(), { runId } = await params;
    return reportJson(await retryProjectReport(viewer, positiveReportId(runId), renderProjectReport));
  } catch (error) { return reportHttpError(error); }
}
