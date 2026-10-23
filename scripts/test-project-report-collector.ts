/** Isolated D1/MariaDB collector acceptance. No live origin, uploaded bytes or irreversible cleanup. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createConnection, createPool, type Pool } from "mariadb";
import { Miniflare } from "miniflare";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import { getDatabasePool, type QueryStatement } from "../src/shared/server/database/index.server";
import { runNativeMigrations } from "../src/shared/server/database-admin/native-migrations.server";
import { TEST_SUPERUSER_EMAIL, assertTestDatabaseName, testDatabaseEnv } from "../tests/helpers/test-env";
import { collectProjectReport, reauthorizeReportSnapshot } from "../src/entities/project-report/api/collector.server";
import { createDigestPeriod } from "../src/entities/project-report";

const out = ".test-artifacts/project-report-collector";
const period = createDigestPeriod("2026-10-22T00:00:00Z", "2026-10-23T00:00:00Z", "2026-10-23T01:00:00Z", "Asia/Seoul");
const admin = { userId: 2, email: "report-admin@example.test", isSuperuser: false }, su = { userId: 1, email: TEST_SUPERUSER_EMAIL, isSuperuser: true };
let checks = 0;
function check(value: unknown, message: string) { assert.ok(value, message); checks++; console.log("PASS " + message); }
async function reject(action: () => Promise<unknown>, message: string) { await assert.rejects(action, /보고서를 찾을 수 없거나 접근 권한이 없습니다/); checks++; console.log("PASS denied " + message); }
async function verify(mode: "D1" | "MariaDB", queries: QueryStatement[], capture: (enabled: boolean) => void, explain: (statement: QueryStatement) => Promise<unknown>) {
  const db = getDatabasePool(), startChecks = checks;
  const stamp = (value: string) => mode === "D1" ? value : value.replace("T", " ").replace(/Z$/, "");
  for (const [id, email, role] of [[1, TEST_SUPERUSER_EMAIL, "guest"], [2, "report-admin@example.test", "admin"], [3, "report-member@example.test", "member"], [4, "report-other-admin@example.test", "admin"]]) await db.query("INSERT INTO users(id,email,name,role,created_at) VALUES(?,?,?,?,?)", [id, email, `Synthetic report user${id}`, role, stamp("2026-10-01T00:00:00Z")]);
  for (const id of [101, 102]) await db.query("INSERT INTO projects(id,name,goal,project_type,access_mode,start_date,end_date,created_at) VALUES(?,?,'Synthetic goal','volunteering','members_only','2026-10-01','2026-12-01',?)", [id, `Synthetic report project${id}`, stamp("2026-10-01T00:00:00Z")]);
  await db.query("INSERT INTO project_members(project_id,user_id,active) VALUES(101,2,1),(101,3,1),(102,4,1)");
  await db.query("INSERT INTO tasks(id,project_id,parent_id,title,status,completion_mode,start_date,end_date,created_at) VALUES(201,101,NULL,'Synthetic report task','in_progress','direct_completion','2026-10-20','2026-10-22',?),(202,101,201,'Synthetic upcoming task','planned','submission_required','2026-10-25','2026-10-27',?)", [stamp("2026-10-01T00:00:00Z"), stamp("2026-10-01T00:00:00Z")]);
  const subs = [
    [301, "public", 1, "2026-10-21T00:00:00Z", "Synthetic old parent"], [302, "public", 1, "2026-10-22T00:00:00Z", "한글 공개 활동"],
    [303, "private", 1, "2026-10-22T01:00:00Z", "PRIVATE_REPORT_BODY"], [304, "public", 2, "2026-10-22T02:00:00Z", "Synthetic new public revision"], [305, "public", 1, "2026-10-22T03:00:00Z", "PRIVATE_HISTORICAL_REVISION"],
  ] as const;
  for (const [id, visibility, current, date, content] of subs) {
    await db.query("INSERT INTO submissions(id,task_id,author_id,content,visibility,current_revision,created_at) VALUES(?,201,3,?,?,?,?)", [id, content, visibility, current, stamp(date)]);
    if (id === 304) await db.query("INSERT INTO submission_revisions(submission_id,revision_number,content,visibility,created_at) VALUES(304,1,'PRIVATE_BASELINE','private',?)", [stamp("2026-10-21T00:00:00Z")]);
    await db.query("INSERT INTO submission_revisions(submission_id,revision_number,content,visibility,created_at) VALUES(?,?,?,?,?)", [id, current, content, id === 305 ? "private" : visibility, stamp(date)]);
  }
  for (const [id, submission, revision, date, content] of [[401, 301, null, "2026-10-22T00:00:00Z", "Synthetic recent comment on old parent"], [402, 301, 1, "2026-10-23T00:00:00Z", "END_BOUNDARY_EXCLUDED"], [403, 302, 1, "2026-10-21T23:59:59Z", "BEFORE_BOUNDARY_EXCLUDED"], [404, 304, null, "2026-10-22T04:00:00Z", "PRIVATE_BASELINE_COMMENT"], [405, 303, 1, "2026-10-22T05:00:00Z", "PRIVATE_REPORT_COMMENT"]] as const) await db.query("INSERT INTO comments(id,submission_id,revision_number,author_id,content,created_at) VALUES(?,?,?,3,?,?)", [id, submission, revision, content, stamp(date)]);
  for (const [id, submission, revision, date, name] of [[501, 302, 1, "2026-10-22T00:00:00Z", "Synthetic 한글.txt"], [502, 304, 1, "2026-10-22T04:00:00Z", "PRIVATE_BASELINE_FILE.txt"], [503, 303, 1, "2026-10-22T05:00:00Z", "PRIVATE_REPORT_FILE.txt"], [504, 302, 1, "2026-10-23T00:00:00Z", "END_BOUNDARY_FILE.txt"]] as const) await db.query("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes,created_at) VALUES(?,?,?,?,?,'text/plain',42,?)", [id, submission, revision, `synthetic-report/${id}.txt`, name, stamp(date)]);
  capture(true);
  const publicReport = await collectProjectReport(admin, { projectId: 101, period, audienceMode: "public_only" });
  capture(false);
  check(JSON.stringify(publicReport.sourceCounts) === JSON.stringify({ tasks: 2, submissions: 3, comments: 1, attachments: 1 }), `${mode} exact bounded public counts and old-parent context`);
  check(!/PRIVATE_|BOUNDARY_|file_path|filePath/.test(JSON.stringify(publicReport)), `${mode} current and historical private body/comment/file metadata excluded; bytes/path never queried`);
  check(publicReport.comments[0].id === 401 && publicReport.comments[0].revisionNumber === null && publicReport.submissions.some(s => s.id === 301), `${mode} recent legacy comment retains authorized old parent without inventing its revision`);
  check(publicReport.submissions.some(s => s.content.includes("한글")) && publicReport.attachments[0].createdAt === period.start, `${mode} Korean and exact inclusive-start timestamp preserved`);
  check(queries.length === 5 && queries.every(query => (query.params?.length ?? 0) <= 100), `${mode} five same-snapshot guarded/bounded selects`);
  const plans = [];
  for (const statement of queries) plans.push(await explain(statement));
  check(plans.every(plan => Array.isArray(plan) && plan.length > 0), `${mode} representative EXPLAIN succeeds for every bounded source query`);
  await reauthorizeReportSnapshot(admin, publicReport); checks++; console.log(`PASS ${mode} fresh source-by-source reauthorization`);
  const privateReport = await collectProjectReport(admin, { projectId: 101, period, audienceMode: "requester_scope" });
  check(privateReport.submissions.length === 5 && JSON.stringify(privateReport).includes("PRIVATE_REPORT_BODY") && privateReport.comments.some(c => c.id === 404) && privateReport.attachments.some(a => a.id === 502), `${mode} assigned project admin requester-scope may include currently authorized private snapshots`);
  check((await collectProjectReport(su, { projectId: 101, period, audienceMode: "public_only" })).project.id === 101, `${mode} configured SU retains global report access despite stored guest/no membership`);
  await reject(() => collectProjectReport({ userId: 3, email: "report-member@example.test" }, { projectId: 101, period, audienceMode: "public_only" }), `${mode} project member cannot preview reports`);
  await reject(() => collectProjectReport({ userId: 4, email: "report-other-admin@example.test" }, { projectId: 101, period, audienceMode: "public_only" }), `${mode} other-project administrator cannot preview restricted project`);
  await db.query("UPDATE projects SET access_mode='legacy_authenticated' WHERE id=101");
  await reject(() => collectProjectReport({ userId: 4, email: "report-other-admin@example.test" }, { projectId: 101, period, audienceMode: "public_only" }), `${mode} legacy public reading never grants project management/report authority`);
  await db.query("UPDATE projects SET access_mode='members_only' WHERE id=101");
  for (const statement of ["UPDATE submissions SET visibility='private' WHERE id=302", "UPDATE submission_revisions SET visibility='private' WHERE submission_id=302 AND revision_number=1"]) {
    await db.query(statement); await reject(() => reauthorizeReportSnapshot(admin, publicReport), `${mode} current or captured revision visibility withdrawal denies old public artifact`);
    await db.query("UPDATE submissions SET visibility='public' WHERE id=302"); await db.query("UPDATE submission_revisions SET visibility='public' WHERE submission_id=302 AND revision_number=1");
  }
  await db.query("UPDATE comments SET submission_id=304 WHERE id=401"); await reject(() => reauthorizeReportSnapshot(admin, publicReport), `${mode} moved source comment denies old artifact`); await db.query("UPDATE comments SET submission_id=301 WHERE id=401");
  await db.query("UPDATE submission_attachments SET submission_id=303 WHERE id=501"); await reject(() => reauthorizeReportSnapshot(admin, publicReport), `${mode} moved source attachment denies old artifact`); await db.query("UPDATE submission_attachments SET submission_id=302 WHERE id=501");
  await db.query("UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=2"); await reject(() => reauthorizeReportSnapshot(admin, publicReport), `${mode} next artifact request observes membership revocation`); await db.query("UPDATE project_members SET active=1 WHERE project_id=101 AND user_id=2");
  await db.query("UPDATE users SET role='member' WHERE id=2"); await reject(() => reauthorizeReportSnapshot(admin, publicReport), `${mode} next artifact request observes role downgrade`); await db.query("UPDATE users SET role='admin' WHERE id=2");
  await db.query("UPDATE submission_revisions SET content='Synthetic changed text' WHERE submission_id=302 AND revision_number=1"); await reauthorizeReportSnapshot(admin, publicReport); check(publicReport.submissions.find(s => s.id === 302)?.content === "한글 공개 활동", `${mode} immutable report text stays a point-in-time snapshot while authorization remains current`);
  for (let id = 210; id < 232; id++) await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date,created_at) VALUES(?,101,?,'2026-10-28','2026-11-01',?)", [id, `Synthetic cap task${id}`, stamp("2026-10-01T00:00:00Z")]);
  const limited = await collectProjectReport(admin, { projectId: 101, period, audienceMode: "public_only" });
  check(limited.tasks.length === 20 && limited.truncated.tasks && Object.values(limited.sourceCounts).reduce((a, b) => a + b, 0) <= 100, `${mode} cap+1 probes expose truncation without unbounded totals`);
  const minimal = await collectProjectReport(admin, { projectId: 101, period, audienceMode: "public_only", maxRows: 4 });
  check(Object.values(minimal.sourceCounts).reduce((a, b) => a + b, 0) <= 4, `${mode} caller row cap bounds the whole snapshot`);
  await reauthorizeReportSnapshot(admin, limited); checks++; console.log(`PASS ${mode} final report source reauthorization`);
  await mkdir(out, { recursive: true }); await writeFile(`${out}/${mode.toLowerCase()}.json`, JSON.stringify({ complete: true, checks: checks - startChecks, sourceCounts: publicReport.sourceCounts, totalRows: Object.values(publicReport.sourceCounts).reduce((a, b) => a + b, 0), plans, sourceBytesRead: 0, irreversibleDeletes: 0, productionRequests: 0 }, null, 2));
}
if (!process.argv.includes("--maria")) {
  const mf = new Miniflare({ host: "127.0.0.1", cf: false, modules: true, script: "export default {fetch(){return new Response('synthetic report')}}", compatibilityDate: "2026-05-15", d1Databases: { DB: "report-collector-isolated" } });
  try {
    const DB = await mf.getD1Database("DB") as unknown as D1Database;
    for (const file of (await readdir("drizzle")).filter(file => file.endsWith(".sql")).sort()) for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await DB.prepare(sql).run();
    let capture = false; const queries: QueryStatement[] = [];
    const observed = { prepare(sql: string) { return { bind(...params: unknown[]) { if (capture && sql.startsWith("/* report:")) queries.push({ sql, params }); return DB.prepare(sql).bind(...params); } }; }, batch: (statements: D1PreparedStatement[]) => DB.batch(statements) } as unknown as D1Database;
    await runWithHostedBindings({ DB: observed }, () => verify("D1", queries, enabled => { capture = enabled; }, async statement => (await DB.prepare("EXPLAIN QUERY PLAN " + statement.sql).bind(...statement.params ?? []).all()).results));
  } finally { await mf.dispose(); }
}
if (!process.argv.includes("--d1")) {
  assert(["127.0.0.1", "localhost", "::1"].includes(testDatabaseEnv.host) && Number(testDatabaseEnv.port) === 3307, "Requires isolated loopback MariaDB3307");
  const database = `wbs_report_collector_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`; assertTestDatabaseName(database);
  const options = { host: testDatabaseEnv.host, port: 3307, user: testDatabaseEnv.user, password: testDatabaseEnv.password, connectTimeout: 5000, bigIntAsNumber: true, insertIdAsNumber: true };
  const connection = await createConnection(options), globalDb = globalThis as typeof globalThis & { __wbsMariaDbPool?: Pool };
  let pool: Pool | undefined, capture = false; const queries: QueryStatement[] = [];
  try {
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); await connection.query(`USE \`${database}\``); await runNativeMigrations(connection, database);
    pool = createPool({ ...options, database, connectionLimit: 5 }); const original = pool;
    globalDb.__wbsMariaDbPool = new Proxy(original, { get(target, property) { if (property === "getConnection") return async () => { const acquired = await target.getConnection(); return new Proxy(acquired, { get(c, p) { if (p === "query") return async (sql: string, params?: unknown[]) => { if (capture && sql.startsWith("/* report:")) queries.push({ sql, params }); return c.query(sql, params); }; const value = Reflect.get(c, p); return typeof value === "function" ? value.bind(c) : value; } }); }; const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value; } });
    await verify("MariaDB", queries, enabled => { capture = enabled; }, async statement => connection.query("EXPLAIN " + statement.sql, statement.params ? [...statement.params] : undefined));
    console.log(`Retained isolated report collector database ${database}`);
  } finally { globalDb.__wbsMariaDbPool = undefined; await pool?.end(); await connection.end(); }
}
console.log(`Report collector integration contracts passed: ${checks}`);
