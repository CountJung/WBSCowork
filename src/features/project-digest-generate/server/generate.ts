import { createHash, randomUUID } from "node:crypto";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { hashDigestSnapshot, hashReportRunKey, sha256ReportText, createDigestPeriod, type DigestSnapshot, type ReportFormat } from "@/src/entities/project-report";
import {
  claimReportRun, completeRun, failRun, getRunForViewer, heartbeatRun, storeRunSnapshot,
  listArtifactsForRun, reserveReportArtifact, recordReportArtifact, recoverRunForViewer, getArtifactForViewer,
  getReportScheduleForTrigger, listExpiringArtifactsForViewer, markArtifactQuarantining, markArtifactQuarantined,
  type ReportRun, type ReportArtifact,
} from "@/src/entities/project-report/index.server";
import { collectProjectReport, reauthorizeReportSnapshot, ReportCollectorError } from "@/src/entities/project-report/index.server";
import { projectManagementGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getReportStoreStatus, storeReportArtifact, readReportArtifact, quarantineReportArtifact } from "@/src/shared/server/report-storage/index.server";
import { reportMimeType } from "@/src/shared/lib/report-format";
import { ReportRequestError, positiveReportId, reportRetentionDays, type ReportRequest } from "./request";

export async function getReportViewer(): Promise<ProjectViewer> {
  const session = await getAuthSession();
  if (!session?.user?.email) throw new ReportRequestError(401, "LOGIN_REQUIRED");
  const user = await getUserByEmail(session.user.email);
  if (!user) throw new ReportRequestError(404, "NOT_FOUND");
  return { userId: user.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
export type ReportRenderer = (snapshot: DigestSnapshot, format: ReportFormat) => Promise<Uint8Array>;
export async function assertReportProjectScope(viewer: ProjectViewer, projectId: number) {
  const guard = projectManagementGuard(viewer, "p.id");
  const rows = await getDatabasePool().query(`SELECT p.id FROM projects p WHERE p.id=? AND ${guard.sql} LIMIT 1`, [positiveReportId(projectId), ...guard.params]) as { id: number }[];
  if (!rows.length) throw new ReportRequestError(404, "NOT_FOUND");
}
export function reportRunSummary(run: ReportRun, artifacts: ReportArtifact[]) {
  return { runId: run.id, projectId: run.projectId, status: run.status, dryRun: run.dryRun, formats: run.formats, errorCode: run.errorCode,
    expiresAt: run.expiresAt, snapshotHash: run.snapshotHash,
    artifacts: artifacts.map(file => ({ id: file.id, format: file.format, sizeBytes: file.sizeBytes, sha256: file.sha256, state: file.state, expiresAt: file.expiresAt, downloadUrl: `/api/project-reports/${file.id}` })) };
}
async function runSummary(viewer: ProjectViewer, runId: number) {
  const run = await getRunForViewer(viewer, runId);
  if (!run) throw new ReportRequestError(404, "NOT_FOUND");
  return reportRunSummary(run, await listArtifactsForRun(viewer, runId));
}
/** The claim and each commit are short CAS operations; rendering holds no DB transaction. */
async function executeReport(viewer: ProjectViewer, claim: Awaited<ReturnType<typeof claimReportRun>>, render: ReportRenderer) {
  const { run, leaseToken } = claim;
  if (claim.deduplicated || !leaseToken) return { ...await runSummary(viewer, run.id), deduplicated: true };
  try {
    let snapshot = run.snapshot;
    if (!snapshot) {
      snapshot = await collectProjectReport(viewer, { projectId: run.projectId, period: run.period, audienceMode: run.audienceMode });
      await storeRunSnapshot(run.id, leaseToken, snapshot, await hashDigestSnapshot(snapshot), viewer);
    } else if (await hashDigestSnapshot(snapshot) !== run.snapshotHash) throw new ReportRequestError(409, "REPORT_INTEGRITY");
    await reauthorizeReportSnapshot(viewer, snapshot);
    if (!run.dryRun) {
      if (!(await getReportStoreStatus()).configured) throw new ReportRequestError(503, "REPORT_STORAGE_UNAVAILABLE");
      const existing = await listArtifactsForRun(viewer, run.id);
      for (const format of run.formats) {
        await heartbeatRun(run.id, leaseToken, viewer);
        const prior = existing.find(file => file.format === format && file.state === "ready");
        if (prior) { await readReportArtifact(prior.storageKey, prior); continue; }
        const staged = existing.find(file => file.format === format && file.state === "staged");
        if (staged) {
          let reusable = false;
          try { await readReportArtifact(staged.storageKey, staged); reusable = true; }
          catch { /* A missing/incomplete file stays staged until an identical render can be verified. */ }
          if (reusable) {
            await reauthorizeReportSnapshot(viewer, snapshot);
            await recordReportArtifact(run.id, leaseToken, { ...staged, format }, viewer);
            continue;
          }
        }
        const bytes = await render(snapshot, format);
        await heartbeatRun(run.id, leaseToken, viewer);
        const integrity = { sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.byteLength };
        if (staged && (staged.sha256 !== integrity.sha256 || staged.sizeBytes !== integrity.sizeBytes)) throw new ReportRequestError(409, "REPORT_INTEGRITY");
        const storageKey = staged?.storageKey ?? `reports/v1/${run.id}/${randomUUID()}.${format}`;
        // Persist the intent before any I/O: ambiguous writes retain a recoverable key and fingerprint.
        await reserveReportArtifact(run.id, leaseToken, { ...integrity, storageKey, format, expiresAt: run.expiresAt }, viewer);
        const stored = await storeReportArtifact(storageKey, bytes);
        // A revoked scope must not commit or disclose bytes produced before that change.
        await reauthorizeReportSnapshot(viewer, snapshot);
        await recordReportArtifact(run.id, leaseToken, { ...stored, format, expiresAt: run.expiresAt }, viewer);
      }
    }
    await reauthorizeReportSnapshot(viewer, snapshot);
    await completeRun(run.id, leaseToken, viewer);
    return { ...await runSummary(viewer, run.id), deduplicated: false };
  } catch (error) {
    try { await failRun(run.id, leaseToken, "GENERATION_FAILED", viewer); }
    catch { throw new ReportRequestError(503, "RUN_STATE_UNCERTAIN"); }
    if (error instanceof ReportRequestError || error instanceof ReportCollectorError) throw error;
    throw new ReportRequestError(500, "GENERATION_FAILED");
  }
}
export async function generateProjectReport(viewer: ProjectViewer, input: ReportRequest, render: ReportRenderer, scheduleId: number | null = null) {
  const idempotencyKey = scheduleId === null
    ? await sha256ReportText(`manual\n${viewer.userId}\n${input.projectId}\n${input.requestId}`)
    : await hashReportRunKey({ scheduleId, scheduledFor: input.period.end, projectId: input.projectId, formats: input.formats, audienceMode: input.audienceMode, dryRun: input.dryRun });
  const fingerprint = await sha256ReportText(JSON.stringify({ projectId: input.projectId, requester: viewer.userId, scheduleId, start: input.period.start, end: input.period.end, timeZone: input.period.timeZone, formats: input.formats, audienceMode: input.audienceMode, dryRun: input.dryRun }));
  const expiresAt = new Date(Date.now() + reportRetentionDays() * 86_400_000).toISOString();
  return executeReport(viewer, await claimReportRun(viewer, { projectId: input.projectId, idempotencyKey, fingerprint, formats: input.formats, audienceMode: input.audienceMode, period: input.period, expiresAt, scheduleId, dryRun: input.dryRun }), render);
}
export async function retryProjectReport(viewer: ProjectViewer, runId: number, render: ReportRenderer) {
  return executeReport(viewer, await recoverRunForViewer(viewer, positiveReportId(runId)), render);
}
export async function downloadProjectReport(viewer: ProjectViewer, artifactId: number) {
  const file = await getArtifactForViewer(viewer, artifactId);
  if (!file) throw new ReportRequestError(404, "NOT_FOUND");
  const run = await getRunForViewer(viewer, file.runId);
  if (!run?.snapshot || await hashDigestSnapshot(run.snapshot) !== run.snapshotHash) throw new ReportRequestError(404, "NOT_FOUND");
  await reauthorizeReportSnapshot(viewer, run.snapshot);
  const bytes = await readReportArtifact(file.storageKey, file);
  // Recheck after I/O as well: an open page does not retain a revoked capability.
  if (!await getArtifactForViewer(viewer, artifactId)) throw new ReportRequestError(404, "NOT_FOUND");
  await reauthorizeReportSnapshot(viewer, run.snapshot);
  return { bytes, fileName: `프로젝트-${run.projectId}-보고서-${run.id}.${file.format}`, mimeType: reportMimeType(file.format), sizeBytes: bytes.byteLength, sha256: file.sha256 };
}
/** Expiry immediately denies download. Retention only quarantines restorable artifacts. */
export async function retainProjectReports(viewer: ProjectViewer, projectId: number, dryRun: boolean, expectedIds?: number[]) {
  await assertReportProjectScope(viewer, projectId);
  const files = await listExpiringArtifactsForViewer(viewer, positiveReportId(projectId));
  if (dryRun) return { dryRun: true, candidates: files.map(file => file.id), quarantined: [] as number[], failed: [] as number[] };
  if (!Array.isArray(expectedIds) || expectedIds.length > 20 || new Set(expectedIds).size !== expectedIds.length || expectedIds.some(id => !Number.isSafeInteger(id) || id < 1 || !files.some(file => file.id === id))) throw new ReportRequestError(409, "RETENTION_CHANGED");
  const quarantined: number[] = [], failed: number[] = [];
  for (const file of files.filter(file => expectedIds.includes(file.id))) {
    try {
      if (file.state === "ready" || file.state === "staged") await markArtifactQuarantining(viewer, file.id, file.state);
      await quarantineReportArtifact(file.storageKey, file);
      await markArtifactQuarantined(viewer, file.id);
      quarantined.push(file.id);
    } catch { failed.push(file.id); }
  }
  return { dryRun: false, candidates: files.map(file => file.id), quarantined, failed };
}
/** Scheduling remains opt-in at the adapter. Schedules are created disabled by the UI. */
export async function triggerProjectDigest(value: unknown, render: ReportRenderer) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportRequestError(400, "INVALID_REQUEST");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["scheduleId", "scheduledFor", "dryRun"].includes(key)) || typeof data.scheduledFor !== "string" || typeof data.dryRun !== "boolean") throw new ReportRequestError(400, "INVALID_REQUEST");
  if (!data.dryRun && process.env.DIGEST_ALLOW_ARTIFACTS !== "1") throw new ReportRequestError(409, "DRY_RUN_REQUIRED");
  const resolved = await getReportScheduleForTrigger(positiveReportId(data.scheduleId));
  if (!resolved) throw new ReportRequestError(404, "NOT_FOUND");
  const { schedule, viewer } = resolved;
  const end = new Date(data.scheduledFor);
  if (!Number.isFinite(end.getTime())) throw new ReportRequestError(400, "INVALID_PERIOD");
  let period;
  try { period = createDigestPeriod(new Date(end.getTime() - schedule.lookbackHours * 3_600_000), data.scheduledFor, new Date(), schedule.timeZone); }
  catch { throw new ReportRequestError(400, "INVALID_PERIOD"); }
  return generateProjectReport(viewer, { projectId: schedule.projectId, requestId: `schedule_${schedule.id}_${end.getTime()}`, period, formats: schedule.formats, audienceMode: "public_only", dryRun: data.dryRun }, render, schedule.id);
}
