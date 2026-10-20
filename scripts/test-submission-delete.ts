/** QLT-021: real local D1 + fresh loopback MariaDB, never operating data or .env. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createConnection, type Pool } from "mariadb";
import type { D1Database } from "@cloudflare/workers-types";
import type { SubmissionActor } from "../src/entities/submission/model/submission-revision";
import { applyTestEnv, testDatabaseEnv, assertTestDatabaseName } from "../tests/helpers/test-env";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import { closeDatabasePool, databaseBatch, getDatabasePool } from "../src/shared/server/database/index.server";
import { resetRuntimeEnvCache } from "../src/shared/server/runtime-env/index.server";
import { deleteSubmission } from "../src/entities/submission/api/submission-repository.server";
import { runNativeMigrations } from "../src/shared/server/database-admin/native-migrations.server";

applyTestEnv();
const flags = process.argv.slice(2);
if (flags.some(flag => !["--d1", "--maria"].includes(flag)) || (flags.includes("--d1") && flags.includes("--maria"))) {
  throw new Error("Use no flags for both databases, or exactly one of --d1 / --maria.");
}
let checks = 0;
function check(value: unknown, label: string) {
  assert.ok(value, label); checks++; console.log(`PASS ${label}`);
}
type Row = Record<string, unknown>;
type BatchResult = { affectedRows?: number; meta?: { changes?: number }; results?: Row[] } | Row[];
function rows(result: BatchResult): Row[] { return Array.isArray(result) ? result : result.results ?? []; }
async function query(sql: string, params: unknown[] = []) { return await getDatabasePool().query(sql, params) as Row[]; }
async function count(table: string, id: number) {
  return Number((await query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === "submissions" ? "id" : "submission_id"}=?`, [id]))[0].n);
}

async function verify(runtime: "D1" | "MariaDB", beforeBatch: (sql: string) => void) {
  const db = getDatabasePool();
  const suffix = runtime === "MariaDB" ? " ENGINE=InnoDB" : "";
  // Compare the actual API result with independent direct-row and persisted-state checks.
  await db.query(`CREATE TABLE qlt_delete_parent(id INTEGER PRIMARY KEY)${suffix}`);
  await db.query(`CREATE TABLE qlt_delete_child(id INTEGER PRIMARY KEY,parent_id INTEGER,FOREIGN KEY(parent_id) REFERENCES qlt_delete_parent(id) ON DELETE CASCADE)${suffix}`);
  await db.query(`CREATE TABLE qlt_delete_trigger_log(id INTEGER PRIMARY KEY)${suffix}`);
  await db.query(runtime === "D1"
    ? "CREATE TRIGGER qlt_delete_trigger AFTER DELETE ON qlt_delete_parent WHEN OLD.id IN (3,4) BEGIN INSERT INTO qlt_delete_trigger_log VALUES(OLD.id); END"
    : "CREATE TRIGGER qlt_delete_trigger AFTER DELETE ON qlt_delete_parent FOR EACH ROW BEGIN IF OLD.id IN (3,4) THEN INSERT INTO qlt_delete_trigger_log VALUES(OLD.id); END IF; END");
  const measurements = [];
  for (const id of [1, 2, 3, 4]) {
    await db.query("INSERT INTO qlt_delete_parent VALUES(?)", [id]);
    if ([2, 4].includes(id)) await db.query("INSERT INTO qlt_delete_child VALUES(?,?),(?,?)", [id * 10, id, id * 10 + 1, id]);
    const result = await databaseBatch([
      { sql: "DELETE FROM qlt_delete_parent WHERE id=?", params: [id] },
      { sql: `SELECT ${runtime === "D1" ? "changes()" : "ROW_COUNT()"} AS direct_changes` },
    ]) as BatchResult[];
    const affected = result[0] as Exclude<BatchResult, Row[]>;
    const direct = Number(rows(result[1])[0].direct_changes);
    const reported = Number(affected.affectedRows ?? affected.meta?.changes);
    check(direct === 1 && reported === (runtime === "D1" ? [1, 3, 2, 4][id - 1] : 1), `${runtime}: direct delete vs cascade/trigger count case${id}`);
    check(Number((await query("SELECT COUNT(*) AS n FROM qlt_delete_parent WHERE id=?", [id]))[0].n) === 0
      && Number((await query("SELECT COUNT(*) AS n FROM qlt_delete_child WHERE parent_id=?", [id]))[0].n) === 0, `${runtime}: count case${id} really committed`);
    measurements.push({ cascade: [2, 4].includes(id), trigger: [3, 4].includes(id), reported, direct });
  }
  console.log(`MEASURE ${runtime} ${JSON.stringify(measurements)}`);

  for (const [id, role] of [[1, "member"], [2, "member"], [3, "admin"], [4, "guest"], [5, "guest"]] as const) {
    await db.query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [id, id === 5 ? "superuser@example.test" : `delete${id}@example.test`, `Synthetic ${id}`, role]);
  }
  await db.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'QLT021 synthetic','2026-01-01','2026-12-31')");
  let nextId = 100;
  async function fixture(children = true, selected = true) {
    const id = ++nextId;
    await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date,status,version) VALUES(?,1,'Synthetic delete','2026-01-01','2026-12-31','done',1)", [id]);
    await db.query("INSERT INTO submissions(id,task_id,author_id,content,visibility,current_revision) VALUES(?,?,1,'Synthetic private','private',?)", [id, id, children ? 2 : 1]);
    if (children) {
      for (const revision of [1, 2]) {
        await db.query("INSERT INTO submission_revisions(submission_id,revision_number,content,visibility) VALUES(?,?,'Synthetic revision','private')", [id, revision]);
        await db.query("INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind) VALUES(?,?,1,?,?,'created')", [id, revision, `fixture:${id}:${revision}`, "0".repeat(64)]);
        await db.query("INSERT INTO submission_attachments(submission_id,revision_number,file_path,file_name,file_size_bytes) VALUES(?,?,?,'synthetic.txt',1)", [id, revision, `qlt021/${id}/${revision}.txt`]);
      }
      await db.query("INSERT INTO comments(submission_id,author_id,content) VALUES(?,1,'Synthetic comment')", [id]);
    }
    if (selected) await db.query("UPDATE tasks SET review_submission_id=?,review_revision_number=? WHERE id=?", [id, children ? 2 : 1, id]);
    return id;
  }
  async function snapshot(id: number) {
    return JSON.stringify(await Promise.all([
      query("SELECT * FROM submissions WHERE id=?", [id]), query("SELECT * FROM tasks WHERE id=?", [id]),
      ...["submission_revisions", "submission_events", "submission_attachments", "comments"].map(table => query(`SELECT * FROM ${table} WHERE submission_id=? ORDER BY id`, [id])),
      query("SELECT * FROM task_events WHERE task_id=? ORDER BY id", [id]),
    ]));
  }
  const owner: SubmissionActor = { userId: 1, isAdmin: false, isSuperuser: false };
  // Deliberately stale role claims: repository SQL must use users.role.
  for (const [label, actor] of [["owner", owner], ["admin", { ...owner, userId: 3 }], ["superuser", { ...owner, userId: 5, isSuperuser: true }], ["trusted internal", undefined]] as const) {
    const id = await fixture();
    const deleted = await deleteSubmission(id, actor).catch(async error => {
      console.error(`MEASURE ${runtime}: repository rejected; remaining target rows=${await count("submissions", id)}`);
      throw error;
    });
    check(deleted.id === id && await count("submissions", id) === 0, `${runtime}: ${label} gets success after real cascade`);
    for (const table of ["submission_revisions", "submission_events", "submission_attachments", "comments"]) check(await count(table, id) === 0, `${runtime}: ${label} cascades ${table}`);
    const task = (await query("SELECT version,status,review_submission_id,review_revision_number FROM tasks WHERE id=?", [id]))[0];
    check(Number(task.version) === 2 && task.status === "in_progress" && task.review_submission_id === null && task.review_revision_number === null, `${runtime}: ${label} invalidates selected review exactly once`);
    check(Number((await query("SELECT COUNT(*) AS n FROM task_events WHERE task_id=? AND kind='review_invalidated'", [id]))[0].n) === 1, `${runtime}: ${label} retains one task invalidation event`);
    if (runtime === "D1") check(Number((await query("SELECT COUNT(*) AS n FROM file_cleanup_jobs WHERE object_key IN (?,?)", [`qlt021/${id}/1.txt`, `qlt021/${id}/2.txt`]))[0].n) === 2, "D1: cascade preserves durable file cleanup intents");
    await assert.rejects(deleteSubmission(id, actor), /찾을 수 없습니다/);
    check(true, `${runtime}: repeated deletion is missing, not another success`);
  }
  for (const [children, selected] of [[false, false], [true, false]] as const) {
    const id = await fixture(children, selected);
    check((await deleteSubmission(id, owner)).id === id && await count("submissions", id) === 0, `${runtime}: unselected children=${children} succeeds`);
    check(Number((await query("SELECT version FROM tasks WHERE id=?", [id]))[0].version) === 1, `${runtime}: unselected task unchanged`);
  }
  for (const [label, actor, demote] of [
    ["other member with stale admin claim", { ...owner, userId: 2, isAdmin: true }, false],
    ["guest owner", owner, true],
    ["downgraded administrator", { ...owner, userId: 4, isAdmin: true }, false],
  ] as const) {
    const id = await fixture();
    if (demote) await db.query("UPDATE users SET role='guest' WHERE id=1");
    const before = await snapshot(id);
    await assert.rejects(deleteSubmission(id, actor), /권한/);
    check(await snapshot(id) === before, `${runtime}: ${label} denied with all rows/review/history unchanged`);
    if (demote) await db.query("UPDATE users SET role='member' WHERE id=1");
  }
  const demotedDuringDelete = await fixture();
  const beforeDemotion = await snapshot(demotedDuringDelete);
  beforeBatch("UPDATE users SET role='guest' WHERE id=1");
  await assert.rejects(deleteSubmission(demotedDuringDelete, owner), /권한/);
  check(await snapshot(demotedDuringDelete) === beforeDemotion, `${runtime}: role downgrade after initial read denies the guarded batch`);
  await db.query("UPDATE users SET role='member' WHERE id=1");
  const vanished = await fixture();
  beforeBatch(`DELETE FROM submissions WHERE id=${vanished}`);
  await assert.rejects(deleteSubmission(vanished, owner), /권한/);
  check(Number((await query("SELECT version FROM tasks WHERE id=?", [vanished]))[0].version) === 1
    && Number((await query("SELECT COUNT(*) AS n FROM task_events WHERE task_id=?", [vanished]))[0].n) === 0,
  `${runtime}: target removed after read cannot yield a false success or review event`);
  // A constraint on a synthetic child aborts the final DELETE after token/event/task writes.
  const blocked = await fixture();
  await db.query(`CREATE TABLE qlt_delete_restrict(submission_id ${runtime === "D1" ? "INTEGER" : "BIGINT"} PRIMARY KEY,FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE RESTRICT)${suffix}`);
  await db.query("INSERT INTO qlt_delete_restrict VALUES(?)", [blocked]);
  const before = await snapshot(blocked);
  await assert.rejects(deleteSubmission(blocked, owner), /FOREIGN KEY|foreign key/);
  check(await snapshot(blocked) === before, `${runtime}: final delete failure rolls back token, review projection and history`);
  if (runtime === "D1") check(Number((await query("SELECT COUNT(*) AS n FROM file_cleanup_jobs WHERE object_key IN (?,?)", [`qlt021/${blocked}/1.txt`, `qlt021/${blocked}/2.txt`]))[0].n) === 0, "D1: rollback leaves no file cleanup jobs for referenced bytes");
  // Even a successful DELETE/RETURNING must not be exposed if a later statement fails.
  const rollback = await fixture();
  const rollbackBefore = await snapshot(rollback);
  await assert.rejects(databaseBatch([
    { sql: "DELETE FROM submissions WHERE id=? RETURNING id", params: [rollback] },
    { sql: "INSERT INTO qlt_delete_restrict VALUES(?)", params: [-1] },
  ]), /FOREIGN KEY|foreign key/);
  check(await snapshot(rollback) === rollbackBefore, `${runtime}: later batch error rolls back successful RETURNING delete`);
  await assert.rejects(deleteSubmission(999999, owner), /찾을 수 없습니다/);
  check(true, `${runtime}: missing target fails before mutation`);
}

async function d1() {
  const mf = new Miniflare({ host: "127.0.0.1", cf: false, modules: true, script: "export default {fetch(){return new Response('synthetic')}}", compatibilityDate: "2026-05-15", d1Databases: { DB: "qlt021-delete-test" } });
  try {
    const DB = await mf.getD1Database("DB") as unknown as D1Database;
    for (const file of (await readdir("drizzle")).filter(file => file.endsWith(".sql")).sort()) {
      for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await DB.prepare(sql).run();
    }
    let pending: string | undefined;
    const intercepted = new Proxy(DB, { get(target, key) {
      if (key === "batch") return async (statements: Parameters<D1Database["batch"]>[0]) => {
        const sql = pending; pending = undefined;
        if (sql) await DB.prepare(sql).run();
        return DB.batch(statements);
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    await runWithHostedBindings({ DB: intercepted }, () => verify("D1", sql => { pending = sql; }));
  } finally { await mf.dispose(); }
}
async function maria() {
  if (!["127.0.0.1", "localhost", "::1"].includes(testDatabaseEnv.host) || Number(testDatabaseEnv.port) !== 3307) throw new Error("Submission delete test requires isolated loopback:3307.");
  const name = `wbs_delete_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`;
  assertTestDatabaseName(name);
  const connection = await createConnection({ host: testDatabaseEnv.host, port: 3307, user: testDatabaseEnv.user, password: testDatabaseEnv.password, connectTimeout: 3000 });
  try {
    console.log(`MariaDB ${(await connection.query("SELECT VERSION() AS version"))[0].version}; fresh ${name} (retained)`);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${name}\``);
    await runNativeMigrations(connection, name);
    process.env.DB_NAME = name; resetRuntimeEnvCache();
    // Intercept only acquisition, before the real transaction begins. The race
    // writes use a separate connection, never a mock mutation/result.
    getDatabasePool();
    const pool = (globalThis as typeof globalThis & { __wbsMariaDbPool: Pool }).__wbsMariaDbPool;
    const acquire = pool.getConnection.bind(pool);
    let pending: string | undefined;
    pool.getConnection = async () => {
      const sql = pending; pending = undefined;
      if (sql) await connection.query(sql);
      return acquire();
    };
    try { await verify("MariaDB", sql => { pending = sql; }); }
    finally { pool.getConnection = acquire; }
  } finally { await closeDatabasePool(); await connection.end(); }
}
if (!process.argv.includes("--maria")) await d1();
if (!process.argv.includes("--d1")) await maria();
console.log(`QLT-021 database checks passed: ${checks}`);
