import { listRunsForViewer, listArtifactsForRun } from "@/src/entities/project-report/index.server";
import { renderProjectReport } from "@/src/features/project-report-export/index.server";
import { assertReportOrigin, assertReportProjectScope, boundedReportJson, generateProjectReport, getReportViewer, parseReportRequest, positiveReportId, reportRunSummary, reportJson, reportHttpError } from "@/src/features/project-digest-generate/index.server";
export async function GET(request: Request) {
  try { const viewer = await getReportViewer(), id = positiveReportId(new URL(request.url).searchParams.get("projectId"));
    await assertReportProjectScope(viewer, id);
    const runs = await listRunsForViewer(viewer, id);
    return reportJson(await Promise.all(runs.map(async run => reportRunSummary(run, await listArtifactsForRun(viewer, run.id)))));
  } catch (error) { return reportHttpError(error); }
}
export async function POST(request: Request) {
  try { assertReportOrigin(request); const viewer = await getReportViewer(), input = parseReportRequest(await boundedReportJson(request));
    const result = await generateProjectReport(viewer, input, renderProjectReport);
    return reportJson(result, result.deduplicated ? 200 : 201);
  } catch (error) { return reportHttpError(error); }
}
