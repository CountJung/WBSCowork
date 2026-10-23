/** Source route/service integration with real isolated MariaDB and Miniflare D1/R2. No browser or production calls. */
import { setSession } from "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createConnection } from "mariadb";
import { Miniflare, Log, LogLevel } from "miniflare";
import { assertTestDatabaseName, testDatabaseEnv, TEST_SUPERUSER_EMAIL } from "../tests/helpers/test-env";
import { hashDigestSnapshot, type DigestSnapshot, type ReportFormat } from "../src/entities/project-report";

const output = path.resolve(".test-artifacts/project-report-workflow"); await mkdir(output, { recursive: true });
const temporary = await mkdtemp("/tmp/wbs-project-report-workflow-");
const reportDir = path.join(temporary, "reports"), uploadDir = path.join(temporary, "uploads");
await mkdir(reportDir); await mkdir(uploadDir);
const database = `wbs_report_workflow_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`; assertTestDatabaseName(database);
assert(["127.0.0.1", "localhost", "::1"].includes(testDatabaseEnv.host) && Number(testDatabaseEnv.port) === 3307);
Object.assign(process.env, { DB_NAME: database, REPORT_DIR: reportDir, UPLOAD_DIR: uploadDir, REPORT_RETENTION_DAYS: "30" });
delete process.env.DIGEST_SCHEDULER_ENABLED; delete process.env.DIGEST_SCHEDULER_TOKEN; delete process.env.DIGEST_ALLOW_ARTIFACTS;
const origin = "http://127.0.0.1:3000", publicMarker = "SYNTHETIC_REPORT_PUBLIC_한글", privateMarker = "SYNTHETIC_REPORT_PRIVATE_비공개";
const period = { start: "2026-10-21T00:00:00.000Z", end: "2026-10-23T00:00:00.000Z", timeZone: "Asia/Seoul" };
const actors = { su: { id: 1, role: "guest", email: TEST_SUPERUSER_EMAIL }, admin: { id: 2, role: "admin", email: "report-admin@example.test" }, otherAdmin: { id: 3, role: "admin", email: "report-other-admin@example.test" }, member: { id: 4, role: "member", email: "report-member@example.test" }, guest: { id: 5, role: "guest", email: "report-guest@example.test" }, author: { id: 6, role: "member", email: "report-author@example.test" } } as const;
type Actor = keyof typeof actors | null;
type Query = (sql: string, values?: unknown[]) => Promise<Record<string, unknown>[]>;
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const mf = new Miniflare({ cf: false, modules: true, script: "export default {fetch(){return new Response('synthetic report storage only');}}", d1Databases: { DB: "report-workflow" }, r2Buckets: { ATTACHMENTS: "report-workflow" }, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], log: new Log(LogLevel.ERROR) });
const native = await createConnection({ host: testDatabaseEnv.host, port: Number(testDatabaseEnv.port), user: testDatabaseEnv.user, password: testDatabaseEnv.password, connectTimeout: 5000, bigIntAsNumber: true, insertIdAsNumber: true });
const results: Record<string, unknown>[] = [];
const { runNativeMigrations } = await import("../src/shared/server/database-admin/native-migrations.server");
const { runWithHostedBindings } = await import("../src/shared/server/hosted-runtime/index.server");
const service = await import("../src/features/project-digest-generate/index.server");
const { renderProjectReport } = await import("../src/features/project-report-export/index.server");
const storage = await import("../src/shared/server/report-storage/index.server");
const ledger = await import("../src/entities/project-report/index.server");
const routes = {
  reports: await import("../app/api/project-reports/route"), download: await import("../app/api/project-reports/[artifactId]/route"),
  retry: await import("../app/api/project-reports/runs/[runId]/retry/route"), preview: await import("../app/api/projects/[projectId]/reports/preview/route"),
  schedules: await import("../app/api/projects/[projectId]/reports/schedules/route"), retention: await import("../app/api/projects/[projectId]/reports/retention/route"),
  machine: await import("../app/api/internal/project-digests/run/route"),
};
function actor(name: Actor) {
  if (name === null) { setSession(null); return; }
  const user = actors[name]; setSession({ user: { email: user.email, name, role: user.role, isSuperuser: false }, expires: new Date(Date.now() + 3600000).toISOString() });
}
const req = (url: string, body?: unknown, headers: Record<string, string> = {}) => new Request(origin + url, body === undefined ? { headers } : { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const projectContext = () => ({ params: Promise.resolve({ projectId: "1001" }) });
const requestInput = (requestId = randomUUID()) => ({ projectId: 1001, requestId, ...period, audienceMode: "public_only", formats: ["docx", "pptx"], dryRun: false });
function inspect(bytes: Uint8Array, format: ReportFormat) {
  const script = "import io,json,sys,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert z.testzip() is None\nnames=z.namelist();selected=['word/document.xml'] if sys.argv[1]=='docx' else [n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')]\ntexts=[e.text or '' for n in selected for e in E.fromstring(z.read(n)).iter() if e.tag.endswith('}t')]\nprint(json.dumps({'names':names,'text':''.join(texts)},ensure_ascii=False))";
  const result = spawnSync("python3", ["-c", script, format], { input: bytes, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }); assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as { names: string[]; text: string };
}
async function seed(query: Query, put: (key: string, bytes: Uint8Array) => Promise<unknown>) {
  for (const user of Object.values(actors)) await query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [user.id, user.email, user.email.split("@")[0], user.role]);
  for (const id of [1001, 1002]) await query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(?,?,'volunteering','members_only','2026-10-01','2026-12-01')", [id, `Synthetic report ${id}`]);
  for (const [project, user] of [[1001, 2], [1002, 3], [1001, 4], [1001, 5], [1001, 6]]) await query("INSERT INTO project_members(project_id,user_id) VALUES(?,?)", [project, user]);
  for (const [task, project] of [[2001, 1001], [2002, 1002]]) await query("INSERT INTO tasks(id,project_id,title,start_date,end_date,created_at) VALUES(?,?,?,'2026-10-20','2026-10-25','2026-10-20 01:00:00')", [task, project, `Synthetic report task ${task}`]);
  for (const [id, author, visibility, marker] of [[3001, 4, "public", publicMarker], [3002, 6, "private", privateMarker]] as const) {
    await query("INSERT INTO submissions(id,task_id,author_id,content,visibility,created_at) VALUES(?,2001,?,?,?,'2026-10-22 01:00:00')", [id, author, marker, visibility]);
    await query("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,created_at) VALUES(?,1,?,?,?,'2026-10-22 01:00:00')", [id, author, marker, visibility]);
    await query("INSERT INTO comments(id,submission_id,revision_number,author_id,content,created_at) VALUES(?,?,1,?,?,'2026-10-22 02:00:00')", [id + 1000, id, author, marker + "_COMMENT"]);
    const key = `synthetic/report-workflow/${id}.txt`, bytes = Buffer.from(marker);
    await put(key, bytes);
    await query("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes,created_at) VALUES(?,?,1,?,?,'text/plain',?,'2026-10-22 01:00:00')", [id + 2000, id, key, marker + ".txt", bytes.length]);
  }
}
async function run(runtime: "d1" | "native", query: Query, read: (key: string) => Promise<Uint8Array>) {
  const checks: string[] = [], responses: { path: string; status: number }[] = [];
  const check = (value: unknown, label: string) => { assert.ok(value, `${runtime}: ${label}`); checks.push(label); console.log(`PASS ${runtime}: ${label}`); };
  async function json(response: Response, route: string) { responses.push({ path: route, status: response.status }); const body: unknown = await response.json(); check(response.headers.get("cache-control") === "private, no-store", `${route} JSON is private/no-store`); return { status: response.status, body: body as Record<string, unknown> }; }
  const preview = () => routes.preview.GET(req("/api/projects/1001/reports/preview?" + new URLSearchParams({ ...period, audienceMode: "public_only" })), projectContext());
  const download = (id: number) => routes.download.GET(req(`/api/project-reports/${id}?inline=1`), { params: Promise.resolve({ artifactId: String(id) }) });
  actor(null);
  for (const id of [1, 999999, "invalid"]) check((await routes.download.GET(req("/api/project-reports/" + id), { params: Promise.resolve({ artifactId: String(id) }) })).status === 401, "anonymous valid/missing/invalid ID has the same login boundary");
  check((await preview()).status === 401 && (await routes.reports.GET(req("/api/project-reports?projectId=1001"))).status === 401, "anonymous preview/list require login before checking resource scope");
  check((await routes.reports.POST(req("/api/project-reports", requestInput()))).status === 401, "anonymous export cannot create a run");
  check((await routes.reports.POST(new Request(origin + "/api/project-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestInput()) }))).status === 403, "POST with no same-origin proof is rejected before resource information");
  for (const name of ["guest", "member", "otherAdmin"] as const) {
    actor(name);
    check((await preview()).status === 404, `${name} preview denied404`);
    check((await routes.reports.GET(req("/api/project-reports?projectId=1001"))).status === 404, `${name} list denied404`);
    check((await routes.reports.POST(req("/api/project-reports", requestInput()))).status === 404, `${name} export denied404`);
    check((await routes.schedules.GET(req("/api/projects/1001/reports/schedules"), projectContext())).status === 404, `${name} schedule list denied404`);
    check((await routes.retention.POST(req("/api/projects/1001/reports/retention", { dryRun: true }), projectContext())).status === 404, `${name} retention candidate list denied404`);
  }
  actor("admin");
  const publicPreview = await json(await preview(), "preview");
  check(publicPreview.status === 200 && JSON.stringify(publicPreview.body).includes(publicMarker) && !JSON.stringify(publicPreview.body).includes(privateMarker), "public-only snapshot excludes private content/comment/attachment metadata");
  const scopePreview = await json(await routes.preview.GET(req("/api/projects/1001/reports/preview?" + new URLSearchParams({ ...period, audienceMode: "requester_scope" })), projectContext()), "scope-preview");
  check(scopePreview.status === 200 && JSON.stringify(scopePreview.body).includes(privateMarker), "assigned administrator requester scope uses explicit management exception");
  actor("su"); check((await preview()).status === 200, "environment SU can preview without project membership despite seeded guest role");
  actor("admin");
  const input = requestInput();
  const duplicates = await Promise.all([routes.reports.POST(req("/api/project-reports", input)), routes.reports.POST(req("/api/project-reports", input))]);
  const generated = await Promise.all(duplicates.map(response => json(response, "export")));
  const runId = Number(generated[0].body.runId); check(generated.every(result => [200, 201].includes(result.status) && result.body.runId === runId), "parallel requestId deduplicates to one report run");
  check(Number((await query("SELECT COUNT(*) n FROM project_report_runs"))[0].n) === 1, "parallel requests persist exactly one run");
  const artifacts = await query("SELECT * FROM project_report_artifacts WHERE run_id=? ORDER BY format", [runId]); check(artifacts.length === 2, "one run persists DOCX and PPTX once each");
  check((await routes.reports.POST(req("/api/project-reports", { ...input, audienceMode: "requester_scope" }))).status === 409, "same requestId with different payload conflicts409");
  for (const artifact of artifacts) {
    const response = await download(Number(artifact.id)), bytes = new Uint8Array(await response.arrayBuffer()), zip = inspect(bytes, artifact.format as ReportFormat);
    check(response.status === 200 && sha(bytes) === artifact.sha256 && bytes.length === Number(artifact.size_bytes), `${artifact.format} route returns exact persisted ZIP bytes/hash`);
    check(response.headers.get("cache-control") === "private, no-store" && response.headers.get("content-disposition")?.startsWith("attachment;") && response.headers.get("etag") === `"${artifact.sha256}"` && response.headers.get("x-content-type-options") === "nosniff", `${artifact.format} download never switches inline and preserves private/security headers`);
    check(zip.text.includes(publicMarker) && !zip.text.includes(privateMarker) && !zip.names.some(name => /vbaProject|externalLink/.test(name)), `${artifact.format} OOXML contains authorized text only and no macro/external-link payload`);
    await writeFile(path.join(output, `${runtime}-${runId}.${artifact.format}`), bytes);
  }
  const artifactId = Number(artifacts[0].id);
  const ownList = await json(await routes.reports.GET(req("/api/project-reports?projectId=1001")), "own-list");
  check(ownList.status === 200 && Array.isArray(ownList.body) && ownList.body.some(run => run.runId === runId), "assigned administrator lists own generated run");
  actor(null); check((await download(artifactId)).status === 401 && (await download(999999)).status === 401, "anonymous actual existing artifact and missing artifact are indistinguishable401");
  for (const name of ["guest", "member", "otherAdmin"] as const) { actor(name); check((await download(artifactId)).status === 404 && (await download(999999)).status === 404, `${name} existing and missing download both404`); }
  actor("su"); check((await download(artifactId)).status === 200, "SU can download authorized project manager's artifact");
  const suList = await json(await routes.reports.GET(req("/api/project-reports?projectId=1001")), "su-list");
  check(suList.status === 200 && Array.isArray(suList.body) && suList.body.some(run => run.runId === runId), "SU explicitly lists authorized other-requester run"); actor("admin");
  await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=2");
  check((await download(artifactId)).status === 404, "current membership removal denies old download immediately");
  await query("UPDATE project_members SET active=1 WHERE project_id=1001 AND user_id=2");
  await query("UPDATE submissions SET visibility='private' WHERE id=3001");
  check((await download(artifactId)).status === 404, "public snapshot download denied after source turns private");
  await query("UPDATE submissions SET visibility='public' WHERE id=3001");
  check((await download(artifactId)).status === 200, "restored synthetic scope/visibility restores authorized access");

  const viewer = await service.getReportViewer(), failedInput = service.parseReportRequest(requestInput());
  await assert.rejects(service.generateProjectReport(viewer, failedInput, async (snapshot, format) => { if (format === "pptx") throw new Error("SYNTHETIC_RENDER_FAILURE"); return renderProjectReport(snapshot, format); }), error => error instanceof service.ReportRequestError && error.code === "GENERATION_FAILED");
  const failed = (await query("SELECT * FROM project_report_runs WHERE status='failed'"))[0]; assert(failed);
  const prior = (await query("SELECT * FROM project_report_artifacts WHERE run_id=?", [failed.id]))[0]; assert(prior);
  const calls: ReportFormat[] = []; await query("UPDATE submission_revisions SET content='SYNTHETIC_CHANGED_AFTER_SNAPSHOT' WHERE submission_id=3001 AND revision_number=1");
  const retried = await service.retryProjectReport(viewer, Number(failed.id), async (snapshot: DigestSnapshot, format: ReportFormat) => { calls.push(format); return renderProjectReport(snapshot, format); });
  check(retried.status === "rendered" && calls.join(",") === "pptx", "explicit retry reuses ready DOCX and only renders missing PPTX");
  const retriedRun = (await query("SELECT * FROM project_report_runs WHERE id=?", [failed.id]))[0], retriedFiles = await query("SELECT * FROM project_report_artifacts WHERE run_id=? ORDER BY format", [failed.id]);
  check(retriedRun.snapshot_hash === failed.snapshot_hash && retriedFiles[0].sha256 === prior.sha256, "retry preserves original snapshot and existing format bytes");
  const retryPptx = retriedFiles.find(file => file.format === "pptx")!;
  check(inspect(await read(String(retryPptx.storage_key)), "pptx").text.includes(publicMarker), "retry renders stored snapshot rather than changed source content");
  await query("UPDATE submission_revisions SET content=? WHERE submission_id=3001 AND revision_number=1", [publicMarker]);

  // Model the crash boundary after file IO and before ready finalization using
  // the real claim/reservation/store APIs. Recovery must verify existing bytes,
  // never rerender or create an untracked second key.
  const stagedInput = service.parseReportRequest({ ...requestInput(), formats: ["docx"] });
  const stagedClaim = await ledger.claimReportRun(viewer, { projectId: 1001, idempotencyKey: sha(Buffer.from(randomUUID())), fingerprint: sha(Buffer.from("synthetic-staged-recovery")), formats: ["docx"], audienceMode: "public_only", period: stagedInput.period, expiresAt: new Date(Date.now() + 86400000).toISOString(), dryRun: false });
  const stagedSnapshot = await ledger.collectProjectReport(viewer, stagedInput);
  await ledger.storeRunSnapshot(stagedClaim.run.id, stagedClaim.leaseToken!, stagedSnapshot, await hashDigestSnapshot(stagedSnapshot), viewer);
  const stagedBytes = await renderProjectReport(stagedSnapshot, "docx"), stagedKey = `reports/v1/${stagedClaim.run.id}/${randomUUID()}.docx`;
  const stagedMetadata = { format: "docx" as const, storageKey: stagedKey, sha256: sha(stagedBytes), sizeBytes: stagedBytes.length, expiresAt: stagedClaim.run.expiresAt };
  const reserved = await ledger.reserveReportArtifact(stagedClaim.run.id, stagedClaim.leaseToken!, stagedMetadata, viewer);
  await storage.storeReportArtifact(stagedKey, stagedBytes);
  check(reserved.state === "staged" && (await download(reserved.id)).status === 404, "post-storage staged bytes are tracked but never downloadable");
  await assert.rejects(ledger.completeRun(stagedClaim.run.id, stagedClaim.leaseToken!, viewer));
  await ledger.failRun(stagedClaim.run.id, stagedClaim.leaseToken!, "SYNTHETIC_POST_STORAGE_CRASH", viewer);
  let stagedRenderCalls = 0;
  const stagedRecovered = await service.retryProjectReport(viewer, stagedClaim.run.id, async () => { stagedRenderCalls++; throw new Error("staged bytes must be reused without rendering"); });
  check(stagedRecovered.status === "rendered" && stagedRenderCalls === 0 && sha(await read(stagedKey)) === stagedMetadata.sha256, "explicit staged retry verifies and reuses exact stored bytes with zero rendering");
  const stagedRows = await query("SELECT * FROM project_report_artifacts WHERE run_id=?", [stagedClaim.run.id]);
  check(stagedRows.length === 1 && stagedRows[0].id === reserved.id && stagedRows[0].state === "ready" && stagedRows[0].storage_key === stagedKey, "staged recovery finalizes same ledger row/key without orphan or duplicate artifact");
  check((await download(reserved.id)).status === 200, "verified staged recovery becomes downloadable only after completion");

  const originalExpiry = String(artifacts[0].expires_at); await query("UPDATE project_report_artifacts SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?", [artifactId]);
  check((await download(artifactId)).status === 404, "expired artifact denies download before retention runs");
  const retentionBefore = JSON.stringify(await query("SELECT * FROM project_report_artifacts ORDER BY id"));
  const dry = await json(await routes.retention.POST(req("/api/projects/1001/reports/retention", { dryRun: true }), projectContext()), "retention-preview");
  check(Array.isArray(dry.body.candidates) && dry.body.candidates.includes(artifactId) && retentionBefore === JSON.stringify(await query("SELECT * FROM project_report_artifacts ORDER BY id")), "retention dry-run identifies candidate without changing ledger");
  check((await routes.retention.POST(req("/api/projects/1001/reports/retention", { dryRun: false, artifactIds: [999999] }), projectContext())).status === 409, "retention refuses changed/unexpected candidate IDs");
  const retained = await json(await routes.retention.POST(req("/api/projects/1001/reports/retention", { dryRun: false, artifactIds: [artifactId] }), projectContext()), "retention-execute");
  const key = String(artifacts[0].storage_key), quarantineKey = key.replace("reports/v1/", "reports/quarantine/v1/");
  check(Array.isArray(retained.body.quarantined) && retained.body.quarantined.includes(artifactId) && sha(await read(quarantineKey)) === artifacts[0].sha256, "retention quarantines exact original bytes without permanent deletion");
  await storage.restoreReportArtifact(quarantineKey, { sha256: String(artifacts[0].sha256), sizeBytes: Number(artifacts[0].size_bytes) });
  check(sha(await read(key)) === artifacts[0].sha256, "quarantine is physically restorable to original bytes");
  await query("UPDATE project_report_artifacts SET state='ready',expires_at=? WHERE id=?", [originalExpiry, artifactId]);
  check((await download(artifactId)).status === 200, "synthetic ledger restoration recovers authorized download");

  const scheduleInput = { timeZone: "Asia/Seoul", lookbackHours: 24, formats: ["docx", "pptx"] };
  const schedule = await json(await routes.schedules.POST(req("/api/projects/1001/reports/schedules", scheduleInput), projectContext()), "schedule-create");
  const scheduleId = Number(schedule.body.id); check(schedule.status === 201 && schedule.body.enabled === false && schedule.body.deliveryMode === "none", "UI/API-created schedule remains disabled with no delivery");
  const scheduleList = await json(await routes.schedules.GET(req("/api/projects/1001/reports/schedules"), projectContext()), "schedule-list");
  check(scheduleList.status === 200 && Array.isArray(scheduleList.body) && scheduleList.body.some(row => row.id === scheduleId && row.enabled === false), "authorized schedule listing retains disabled state");
  check((await routes.schedules.POST(req("/api/projects/1001/reports/schedules", { ...scheduleInput, enabled: true }), projectContext())).status === 400, "unknown schedule enable field rejected400");
  const trigger = { scheduleId, scheduledFor: period.end, dryRun: true };
  check((await routes.machine.POST(req("/api/internal/project-digests/run", trigger))).status === 503, "unset machine configuration fails closed503");
  process.env.DIGEST_SCHEDULER_ENABLED = "1"; process.env.DIGEST_SCHEDULER_TOKEN = randomBytes(32).toString("hex");
  check((await routes.machine.POST(req("/api/internal/project-digests/run", trigger, { Authorization: "Bearer synthetic-wrong" }))).status === 401, "bad machine bearer token rejected401");
  actor("su"); check((await routes.machine.POST(req("/api/internal/project-digests/run", trigger, { Cookie: "synthetic-browser-cookie" }))).status === 401, "authenticated browser identity/cookie cannot substitute for machine token");
  const headers = { Authorization: `Bearer ${process.env.DIGEST_SCHEDULER_TOKEN}` };
  check((await routes.machine.POST(req("/api/internal/project-digests/run", { ...trigger, dryRun: false }, headers))).status === 409, "machine artifacts remain disabled unless separately opted in");
  await query("UPDATE project_report_schedules SET enabled=1 WHERE id=?", [scheduleId]);
  const beforeMachineFiles = Number((await query("SELECT COUNT(*) n FROM project_report_artifacts"))[0].n);
  const machineOne = await json(await routes.machine.POST(req("/api/internal/project-digests/run", trigger, headers)), "machine-dry-run");
  const machineTwo = await json(await routes.machine.POST(req("/api/internal/project-digests/run", trigger, headers)), "machine-replay");
  check(machineOne.status === 202 && machineTwo.status === 200 && machineOne.body.runId === machineTwo.body.runId && machineTwo.body.deduplicated === true, "same synthetic schedule occurrence deduplicates dry-run generation");
  check(machineOne.body.status === "rendered" && Number((await query("SELECT COUNT(*) n FROM project_report_artifacts"))[0].n) === beforeMachineFiles, "dry-run persists bounded snapshot but renders/stores no files");
  await query("UPDATE project_report_schedules SET enabled=0 WHERE id=?", [scheduleId]);
  check((await query("SELECT enabled,delivery_mode FROM project_report_schedules")).every(row => Number(row.enabled) === 0 && row.delivery_mode === "none"), "synthetic trigger activation restored disabled; external delivery remains none");
  delete process.env.DIGEST_SCHEDULER_ENABLED; delete process.env.DIGEST_SCHEDULER_TOKEN;
  for (const id of [3001, 3002]) check(sha(await read(`synthetic/report-workflow/${id}.txt`)) === sha(Buffer.from(id === 3001 ? publicMarker : privateMarker)), "original synthetic attachment bytes preserved");
  check(Number((await query("SELECT COUNT(*) n FROM users"))[0].n) === 6 && Number((await query("SELECT COUNT(*) n FROM projects"))[0].n) === 2 && Number((await query("SELECT COUNT(*) n FROM tasks"))[0].n) === 2 && Number((await query("SELECT COUNT(*) n FROM submissions"))[0].n) === 2, "source users/projects/tasks/submissions preserved");
  check(Number((await query("SELECT COUNT(*) n FROM submission_revisions"))[0].n) === 2 && Number((await query("SELECT COUNT(*) n FROM comments"))[0].n) === 2 && Number((await query("SELECT COUNT(*) n FROM submission_attachments"))[0].n) === 2 && (await query("SELECT role FROM users WHERE id=1"))[0].role === "guest" && Number((await query("SELECT COUNT(*) n FROM project_members WHERE user_id=1"))[0].n) === 0, "original revisions/comments/attachments and unbound SU database role preserved");
  const result = { runtime, complete: true, checks: checks.length, assertions: checks, responses, sourceCounts: { users: 6, projects: 2, tasks: 2, submissions: 2 }, noBrowser: true, noProduction: true, retainedNativeDatabase: runtime === "native" ? database : undefined };
  results.push(result); await writeFile(path.join(output, `${runtime}-result.json`), JSON.stringify(result, null, 2));
}
try {
  await native.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); await native.query(`USE \`${database}\``); await runNativeMigrations(native, database);
  const nativeQuery: Query = async (sql, values = []) => native.query(sql, values);
  await seed(nativeQuery, async (key, bytes) => { const file = path.join(uploadDir, key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); });
  await run("native", nativeQuery, key => readFile(path.join(key.startsWith("reports/") ? reportDir : uploadDir, key)));
  const db = await mf.getD1Database("DB"), bucket = await mf.getR2Bucket("ATTACHMENTS");
  for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) for (const sql of (await readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await db.prepare(sql).run();
  const d1Query: Query = async (sql, values = []) => (await db.prepare(sql).bind(...values as (string | number | null)[]).all()).results as Record<string, unknown>[];
  await seed(d1Query, (key, bytes) => bucket.put(key, bytes));
  // Miniflare's host proxy uses Undici Headers while the production binding uses
  // Workers Headers. This explicit test-boundary cast does not widen app types.
  await runWithHostedBindings({ DB: db, ATTACHMENTS: bucket } as unknown as Parameters<typeof runWithHostedBindings>[0], () => run("d1", d1Query, async key => { const object = await bucket.get(key); assert(object); return new Uint8Array(await object.arrayBuffer()); }));
  await writeFile(path.join(output, "result.json"), JSON.stringify({ complete: true, checks: results.reduce((sum, result) => sum + Number(result.checks), 0), runtimes: results, temporary, database, limits: "Source route handlers + real storage/DB; no compiled Worker/browser/production acceptance" }, null, 2));
} finally {
  setSession(null); const { closeDatabasePool } = await import("../src/shared/server/database/index.server"); await closeDatabasePool(); await native.end(); await mf.dispose();
}
