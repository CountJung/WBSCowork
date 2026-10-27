/** Actual isolated MariaDB/private-files regression. No production credentials, schema or files. */
import { setSession } from "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createConnection } from "mariadb";
import { assertTestDatabaseName, testDatabaseEnv, TEST_SUPERUSER_EMAIL } from "../tests/helpers/test-env";

const run = Date.now().toString(36) + "_" + randomBytes(3).toString("hex");
const database = `wbs_media_native_${run}_test`, upgradeDatabase = `wbs_media_upgrade_${run}_test`;
assertTestDatabaseName(database); assertTestDatabaseName(upgradeDatabase);
assert(["127.0.0.1", "localhost", "::1"].includes(testDatabaseEnv.host) && Number(testDatabaseEnv.port) === 3307);
const out = path.resolve(".test-artifacts/project-media-native", run), uploadRoot = path.join(out, "uploads"); await mkdir(uploadRoot, { recursive: true });
process.env.DB_NAME = database; process.env.UPLOAD_DIR = uploadRoot;
const { runNativeMigrations } = await import("../src/shared/server/database-admin/native-migrations.server");
const { nativeMigrationV16 } = await import("../src/shared/server/database-admin/native-migration-v16");
const repo = await import("../src/entities/project-media/index.server"), routes = await import("../src/features/project-media/index.server");
const { closeDatabasePool } = await import("../src/shared/server/database/index.server");
const connection = await createConnection({ host: testDatabaseEnv.host, port: Number(testDatabaseEnv.port), user: testDatabaseEnv.user, password: testDatabaseEnv.password, connectTimeout: 5000, bigIntAsNumber: true, insertIdAsNumber: true });
const assertions: string[] = [], check = (value: unknown, label: string) => { assert.ok(value, label); assertions.push(label); console.log("PASS " + label); };
const rejectCode = async (work: Promise<unknown>, code: string, label: string) => { await assert.rejects(work, value => (value as { code?: string }).code === code); check(true, label); };
const query = async (sql: string, params: unknown[] = []) => await connection.query(sql, params) as Record<string, unknown>[];
const people = [
  { id: 1, email: TEST_SUPERUSER_EMAIL, role: "guest" }, { id: 2, email: "native-media-admin@example.test", role: "admin" }, { id: 3, email: "native-other-admin@example.test", role: "admin" },
  { id: 4, email: "native-media-leader@example.test", role: "member" }, { id: 5, email: "native-media-member@example.test", role: "member" }, { id: 6, email: "native-other-team@example.test", role: "member" },
  { id: 7, email: "native-media-guest@example.test", role: "guest" }, { id: 8, email: "native-media-outsider@example.test", role: "member" }, { id: 9, email: "native-media-next-leader@example.test", role: "member" },
] as const;
const view = (id: number, forged = false) => ({ userId: id, email: people.find(value => value.id === id)!.email, isSuperuser: id === 1 || forged });
function session(id: number | null, forged = false) { const user = people.find(value => value.id === id); setSession(user ? { user: { ...user, isSuperuser: id === 1 || forged }, expires: "2099-01-01T00:00:00.000Z" } : null); }
const context = (id?: number, projectId = 1001, teamId = 1101) => ({ params: Promise.resolve({ projectId: String(projectId), teamId: String(teamId), ...(id ? { mediaId: String(id) } : {}) }) });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const fields = { title: "합성 사진", caption: "합성 자료만 사용", visibility: "team_private" as const };
const input = () => ({ ...fields, file: new File([png], "합성 사진.png", { type: "image/png" }), mutationKey: randomUUID() });
const origin = "http://127.0.0.1:3000";
try {
  await runNativeMigrations(connection, database);
  check(Number((await query("SELECT MAX(version) version FROM schema_migrations"))[0].version) === 17, "fresh actual MariaDB migrates through nativeV17");
  check(Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 0, "fresh media schema does not infer or expose existing data");
  for (const user of people) await query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [user.id, user.email, "Synthetic " + user.id, user.role]);
  for (const id of [1001, 1002, 1003]) await query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(?,?,'volunteering',?,'2026-10-01','2026-12-01')", [id, "Synthetic media " + id, id === 1003 ? "legacy_authenticated" : "members_only"]);
  for (const id of [2, 4, 5, 6, 7, 9]) await query("INSERT INTO project_members(project_id,user_id) VALUES(1001,?)", [id]);
  await query("INSERT INTO project_members(project_id,user_id) VALUES(1002,3)");
  for (const [id, project] of [[1101, 1001], [1102, 1001], [1103, 1001], [2101, 1002]]) await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(?,?,'media',?)", [id, project, "Synthetic media team " + id]);
  for (const [team, id, role] of [[1101, 4, "leader"], [1101, 5, "member"], [1101, 9, "member"], [1102, 6, "leader"], [1103, 9, "leader"]] as const) await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1001,?,?,?)", [team, id, role]);
  await query("INSERT INTO activity_team_leaders(project_id,team_id,user_id) VALUES(1001,1101,4),(1001,1102,6),(1001,1103,9)");
  check((await repo.listMediaTeams(view(4), 1001)).length === 3, "Native team list is not multiplied by unrelated user rows");
  await rejectCode(repo.listMediaTeams(view(8), 1003), "NOT_FOUND", "legacy-readable WBS does not admit nonmembers to Native portal");
  await rejectCode(repo.listMediaTeams(view(3), 1001), "NOT_FOUND", "other-project Native administrator remains outside scope");
  await rejectCode(repo.listMediaTeams(view(8, true), 1001), "NOT_FOUND", "forged superuser flag cannot grant Native access");
  check((await repo.listMediaTeams(view(1), 1001)).every(team => team.canUpload), "configured superuser retains Native authority with guest DB role and no assignment");
  await rejectCode(repo.createProjectMedia(view(5), 1001, 1101, input()), "NOT_FOUND", "Native ordinary team member cannot upload");
  await rejectCode(repo.createProjectMedia(view(6), 1001, 1101, input()), "NOT_FOUND", "Native leader cannot upload to another team");
  const upload = input(), created = await repo.createProjectMedia(view(4), 1001, 1101, upload);
  check(created.version === 1 && created.visibility === "team_private", "Native photo upload persists private version1");
  const stored = await repo.getProjectMediaFileForViewer(view(4), 1001, 1101, created.id), nativePath = path.join(uploadRoot, stored.filePath);
  check((await readFile(nativePath)).equals(png), "Native filesystem bytes equal the uploaded PNG");
  check((await query("SELECT state FROM project_media_upload_staging WHERE object_key=?", [stored.filePath]))[0].state === "attached", "Native durable staging transitions to attached only after metadata commit");
  check((await repo.createProjectMedia(view(4), 1001, 1101, upload)).id === created.id, "Native upload retry keeps one item and file");
  await rejectCode(repo.createProjectMedia(view(4), 1001, 1101, { ...upload, title: "changed" }), "CONFLICT", "Native upload token rejects changed payload");
  check((await repo.getProjectMediaForViewer(view(5), 1001, 1101, created.id)).id === created.id, "Native current team member can read team-private media");
  await rejectCode(repo.getProjectMediaForViewer(view(6), 1001, 1101, created.id), "NOT_FOUND", "Native other team cannot read team-private media");
  await rejectCode(repo.getProjectMediaForViewer(view(7), 1001, 1101, created.id), "NOT_FOUND", "Native guest membership alone does not grant team-private access");
  await rejectCode(repo.getProjectMediaForViewer(view(3), 1002, 2101, created.id), "NOT_FOUND", "Native nested project/team/media IDs cannot cross projects");
  const edit = { title: "공유 합성 사진", caption: "", visibility: "project" as const, version: 1, mutationKey: randomUUID() };
  const shared = await repo.updateProjectMedia(view(4), 1001, 1101, created.id, edit);
  check(shared.version === 2 && (await repo.getProjectMediaForViewer(view(7), 1001, 1101, created.id)).id === created.id, "Native explicit project sharing includes current guest members");
  check((await repo.updateProjectMedia(view(4), 1001, 1101, created.id, edit)).version === 2, "Native metadata retry is idempotent");
  check((await repo.createProjectMedia(view(4), 1001, 1101, upload)).id === created.id, "Native immutable upload receipt survives metadata edits");
  const race = await Promise.allSettled(["first", "second"].map(title => repo.updateProjectMedia(view(4), 1001, 1101, created.id, { ...fields, title, version: 2, mutationKey: randomUUID() })));
  check(race.filter(value => value.status === "fulfilled").length === 1 && race.filter(value => value.status === "rejected").length === 1, "real MariaDB CAS allows exactly one concurrent metadata writer");
  const latest = await repo.getProjectMediaForViewer(view(4), 1001, 1101, created.id);
  check(latest.version === 3 && (await query("SELECT version FROM project_media_revisions WHERE media_id=? ORDER BY version", [created.id])).length === 3, "Native CAS current head retains every successful immutable revision");
  session(null); check((await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id))).status === 401, "Native anonymous file access requires login");
  session(5); const full = await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id));
  check(full.status === 200 && Buffer.from(await full.arrayBuffer()).equals(png) && full.headers.get("Cache-Control") === "private, no-store", "Native protected file response preserves bytes and private no-store policy");
  const range = await routes.serveMedia(new Request(origin + created.fileUrl, { headers: { Range: "bytes=1-3" } }), context(created.id));
  check(range.status === 206 && Buffer.from(await range.arrayBuffer()).equals(png.subarray(1, 4)), "Native protected file range returns the exact byte window");
  await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=5"); check((await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id))).status === 404, "Native membership removal blocks the next existing file URL request");
  await query("UPDATE activity_team_leaders SET user_id=9 WHERE project_id=1001 AND team_id=1101"); await query("UPDATE activity_team_members SET role='member' WHERE team_id=1101 AND user_id=4"); await query("UPDATE activity_team_members SET role='leader' WHERE team_id=1101 AND user_id=9");
  await rejectCode(repo.createProjectMedia(view(4), 1001, 1101, input()), "NOT_FOUND", "Native replaced leader immediately loses upload authority");
  check((await repo.updateProjectMedia(view(9), 1001, 1101, created.id, { ...fields, version: latest.version, mutationKey: randomUUID() })).version === 4, "Native replacement leader edits the current own team");
  await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=4"); await rejectCode(repo.getProjectMediaForViewer(view(4), 1001, 1101, created.id), "NOT_FOUND", "Native author also loses private access after project membership removal");
  session(9); const form = new FormData(); form.set("file", new File([png], "합성 multipart.png", { type: "image/png" })); form.set("title", "합성 multipart"); form.set("caption", ""); form.set("visibility", "team_private"); form.set("mutationKey", randomUUID());
  const routed = await routes.uploadMedia(new Request(origin + "/api/media", { method: "POST", headers: { Origin: origin }, body: form }), context());
  check(routed.status === 201, "Native route accepts an actual multipart File and current session");
  const beforeFailureCount = Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n);
  await mkdir(path.join(uploadRoot, "project-media", "1001"), { recursive: true }); await writeFile(path.join(uploadRoot, "project-media", "1001", "1103"), "synthetic blocking file");
  await assert.rejects(repo.createProjectMedia(view(9), 1001, 1103, input()));
  check((await query("SELECT state FROM project_media_upload_staging WHERE team_id=1103"))[0].state === "failed" && Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === beforeFailureCount, "real Native filesystem write failure retains a failed ledger and no partial item");
  await query("CREATE TRIGGER synthetic_media_insert_failure BEFORE INSERT ON project_media_items FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic metadata failure'");
  try { await assert.rejects(repo.createProjectMedia(view(9), 1001, 1101, input())); } finally { await query("DROP TRIGGER synthetic_media_insert_failure"); }
  const failedRows = await query("SELECT object_key FROM project_media_upload_staging WHERE state='failed' AND team_id=1101");
  check(failedRows.length === 1 && (await readFile(path.join(uploadRoot, String(failedRows[0].object_key)))).equals(png), "Native DB failure retains exact staged bytes and durable recovery evidence without deletion");
  const videoFile = path.join(out, "synthetic.mp4"), result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=green:s=16x16:d=0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoFile], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const video = await readFile(videoFile);
  const nativeVideo = await repo.createProjectMedia(view(9), 1001, 1101, { ...fields, title: "합성 영상", file: new File([video], "합성 영상.mp4", { type: "video/mp4" }), mutationKey: randomUUID() });
  const videoStored = await repo.getProjectMediaFileForViewer(view(9), 1001, 1101, nativeVideo.id); check((await readFile(path.join(uploadRoot, videoStored.filePath))).equals(video), "Native encoded MP4 persists with exact immutable file bytes");
  const stable = JSON.stringify(await query("SELECT * FROM project_media_items ORDER BY id"), (_key, value) => typeof value === "bigint" ? value.toString() : value);
  await runNativeMigrations(connection, database); check(JSON.stringify(await query("SELECT * FROM project_media_items ORDER BY id"), (_key, value) => typeof value === "bigint" ? value.toString() : value) === stable, "Native migration re-entry preserves existing uploaded media records");

  // Stop just before V16 DDL to construct the exact prior production-version boundary.
  await assert.rejects(runNativeMigrations({ query: async (sql, params) => { if (sql === nativeMigrationV16.newTables[0]) throw new Error("Synthetic v15 upgrade boundary"); return connection.query(sql, params); } }, upgradeDatabase), /Synthetic v15 upgrade boundary/);
  check(Number((await query("SELECT MAX(version) version FROM schema_migrations"))[0].version) === 15, "actual upgrade fixture stops at immutable nativeV15 before any portal DDL");
  await query("INSERT INTO users(id,email,name,role) VALUES(91,'retained-media@example.test','Synthetic retained','member')");
  await query("INSERT INTO projects(id,name,start_date,end_date) VALUES(91,'Retained synthetic WBS','2026-01-01','2026-12-31')");
  await query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(91,91,'Retained synthetic task','2026-01-01','2026-12-31')");
  await query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(91,91,91,'Retained private synthetic body','private')");
  await query("INSERT INTO submission_attachments(id,submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(91,91,'submissions/synthetic-retained.png','retained.png','image/png',?)", [png.length]);
  const originalRows = async () => JSON.stringify(await Promise.all(["users", "projects", "tasks", "submissions", "submission_attachments"].map(table => query(`SELECT * FROM ${table} ORDER BY id`))), (_key, value) => typeof value === "bigint" ? value.toString() : value);
  const beforeUpgrade = await originalRows(); await runNativeMigrations(connection, upgradeDatabase);
  check(await originalRows() === beforeUpgrade && Number((await query("SELECT MAX(version) version FROM schema_migrations"))[0].version) === 17, "Native v15→17 upgrade preserves private WBS rows, roles and attachment metadata byte for byte");
  check(Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 0 && Number((await query("SELECT COUNT(*) n FROM team_presentation_publications"))[0].n) === 0, "Native upgrade creates empty media/publications without republishing existing private records");
  check((await stat(nativePath)).isFile() && (await readFile(nativePath)).equals(png), "primary Native media files remain preserved after independent upgrade checks");
  await writeFile(path.join(out, "result.json"), JSON.stringify({ complete: true, runtime: "native-mariadb-private-files", checks: assertions.length, assertions, database, upgradeDatabase, uploadRoot, nativeExecuted: true, r2Used: false, browserExecuted: false, productionChanged: false, sourceSha256: createHash("sha256").update(await readFile(import.meta.filename)).digest("hex") }, null, 2));
  await writeFile(path.resolve(".test-artifacts/project-media-native/latest.json"), JSON.stringify({ directory: out, database, upgradeDatabase, checks: assertions.length, complete: true }, null, 2));
  console.log(JSON.stringify({ complete: true, runtime: "native-mariadb-private-files", checks: assertions.length, database, upgradeDatabase }));
} finally { session(null); await closeDatabasePool(); await connection.end(); }
