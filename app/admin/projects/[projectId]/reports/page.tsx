import { randomUUID } from "node:crypto";
import { Container } from "@mui/material";
import { notFound, redirect } from "next/navigation";
import { getSignInPath } from "@/src/entities/user/index.server";
import { getProjectByIdForViewer, assertProjectManagement } from "@/src/entities/project/index.server";
import { listRunsForViewer, listArtifactsForRun, listReportSchedules, ReportLedgerError } from "@/src/entities/project-report/index.server";
import { getReportViewer, positiveReportId, reportRunSummary, ReportRequestError } from "@/src/features/project-digest-generate/index.server";
import { getReportStoreStatus } from "@/src/shared/server/report-storage/index.server";
import ProjectReportDashboard from "@/src/widgets/project-report-admin";
export const dynamic = "force-dynamic";
/** Capture request defaults once on the server and serialize them for hydration. */
async function loadReportDefaults() {
  const end = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  return { end, start: new Date(end.getTime() - 7 * 86_400_000), requestId: randomUUID() };
}
export default async function ProjectReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let viewer;
  try { viewer = await getReportViewer(); } catch (error) { if (error instanceof ReportRequestError && error.status === 401) redirect(getSignInPath(`/admin/projects/${projectId}/reports`)); notFound(); }
  let id: number;
  try { id = positiveReportId(projectId); await assertProjectManagement(id, viewer); } catch { notFound(); }
  const project = await getProjectByIdForViewer(id, viewer); if (!project) notFound();
  let schemaReady = true;
  let initialRuns: ReturnType<typeof reportRunSummary>[] = [], initialSchedules: Awaited<ReturnType<typeof listReportSchedules>> = [];
  try { const [runs, schedules] = await Promise.all([listRunsForViewer(viewer, id), listReportSchedules(viewer, id)]); initialSchedules = schedules; initialRuns = await Promise.all(runs.map(async run => reportRunSummary(run, await listArtifactsForRun(viewer, run.id)))); }
  catch (error) { if (!(error instanceof ReportLedgerError) || error.code !== "UNAVAILABLE") throw error; schemaReady = false; }
  const { end, start, requestId } = await loadReportDefaults();
  const storage = await getReportStoreStatus();
  return <Container component="main" sx={{ py: 3, minWidth: 0 }}><ProjectReportDashboard projectId={id} projectName={project.name} requestId={requestId} defaultStart={start.toISOString().slice(0, 16)} defaultEnd={end.toISOString().slice(0, 16)} initialRuns={initialRuns} initialSchedules={initialSchedules} storageConfigured={storage.configured} schemaReady={schemaReady} /></Container>;
}
