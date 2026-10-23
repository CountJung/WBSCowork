/** Isolated workspace repository contracts; no operating DB, login, or permanent purge. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createConnection, createPool, type Pool } from "mariadb";
import type { D1Database } from "@cloudflare/workers-types";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import { getDatabasePool } from "../src/shared/server/database/index.server";
import { runNativeMigrations } from "../src/shared/server/database-admin/native-migrations.server";
import { changeProjectWorkspace, getProjectWorkspace } from "../src/entities/project/index.server";
import type { WorkspaceActor, WorkspaceCommand } from "../src/entities/project";
import { testDatabaseEnv, assertTestDatabaseName, TEST_SUPERUSER_EMAIL } from "../tests/helpers/test-env";

let checks = 0;
function check(value: unknown, label: string) { assert.ok(value, label); checks++; console.log(`PASS ${label}`); }
const admin: WorkspaceActor = {userId:4,isSuperuser:true};
async function verify(mode: "D1" | "MariaDB") {
  const db = getDatabasePool();
  for (const [id,role] of [[1,"guest"],[2,"member"],[3,"member"],[4,"admin"],[5,"member"],[6,"member"]] as const) {
    await db.query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [id,id === 4 ? TEST_SUPERUSER_EMAIL : `workspace-${id}@example.test`,`Synthetic ${id}`,role]);
  }
  for (const id of [1,2,3]) await db.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(?,?,'2026-01-01','2026-12-31')", [id,`Workspace ${id}`]);
  await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id,deliverable,definition_of_done) VALUES(1,3,'Legacy task','2026-01-01','2026-12-31',2,'output','check')");
  await db.query("INSERT INTO submissions(task_id,author_id,content,visibility) VALUES(1,2,'PRESERVE PRIVATE','private')");
  const initial = await getProjectWorkspace(1,admin);
  check(initial.projectType === "collaboration" && initial.version === 0 && initial.members.length === 0, `${mode} default project is unchanged collaboration`);
  check((await db.query("SELECT completion_mode,activity_team_id FROM tasks WHERE id=1") as {completion_mode:string;activity_team_id:number|null}[])[0].completion_mode === "submission_required", `${mode} legacy task still requires a submission`);
  for (const userId of [1,2]) {
    await assert.rejects(getProjectWorkspace(1,{userId,isSuperuser:false}), /관리자/); checks++;
    await assert.rejects(getProjectWorkspace(1,{userId,isSuperuser:true}), /관리자/); checks++;
  }
  const change = async (projectId: number, command: WorkspaceCommand) => changeProjectWorkspace({projectId,command,actor:admin,token:randomUUID(),version:(await getProjectWorkspace(projectId,admin)).version});
  await change(1,{kind:"project_type",projectType:"volunteering"});
  await change(2,{kind:"project_type",projectType:"volunteering"});
  await assert.rejects(change(3,{kind:"project_type",projectType:"volunteering"})); checks++;
  for (const userId of [1,2,3]) await change(1,{kind:"project_member",userId,active:true});
  await change(2,{kind:"project_member",userId:6,active:true});
  await change(1,{kind:"create_team",activityKind:"meal",name:"오전 식사팀"});
  await change(1,{kind:"create_team",activityKind:"meal",name:"오후 식사팀"});
  await change(2,{kind:"create_team",activityKind:"facility",name:"다른 프로젝트 보수팀"});
  const teams = (await getProjectWorkspace(1,admin)).teams, foreign = (await getProjectWorkspace(2,admin)).teams[0];
  check(teams.length === 2 && teams[0].activityKind === teams[1].activityKind, `${mode} multiple real teams share an activity kind`);
  await assert.rejects(change(1,{kind:"create_team",activityKind:"meal",name:"오전 식사팀"})); checks++;
  await assert.rejects(change(1,{kind:"project_type",projectType:"collaboration"})); checks++;
  await assert.rejects(change(1,{kind:"team_member",teamId:foreign.id,userId:2,role:"member",active:true})); checks++;
  await assert.rejects(change(1,{kind:"team_member",teamId:teams[0].id,userId:6,role:"member",active:true})); checks++;
  await assert.rejects(change(1,{kind:"team_member",teamId:teams[0].id,userId:1,role:"leader",active:true})); checks++;
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"leader",active:true});
  await change(1,{kind:"team_member",teamId:teams[1].id,userId:2,role:"member",active:true});
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:3,role:"member",active:true});
  check((await getProjectWorkspace(1,admin)).teamMembers.filter(m => m.userId === 2 && m.active).length === 2, `${mode} one participant belongs to multiple teams`);
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"member",active:true});
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:3,role:"leader",active:true});
  check((await getProjectWorkspace(1,admin)).teamMembers.find(m => m.teamId === teams[0].id && m.userId === 3)?.role === "leader", `${mode} replacing a scoped leader preserves the previous member`);
  await assert.rejects(getProjectWorkspace(1,{userId:3,isSuperuser:false}), /관리자/); checks++;
  await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id) VALUES(2,1,'Team task','2026-01-01','2026-12-31',2)");
  await assert.rejects(change(1,{kind:"task_team",taskId:2,taskVersion:1,teamId:foreign.id})); checks++;
  await assert.rejects(change(1,{kind:"task_team",taskId:1,taskVersion:1,teamId:teams[0].id})); checks++;
  await change(1,{kind:"task_team",taskId:2,taskVersion:1,teamId:teams[0].id});
  const {updateTask,getTaskById} = await import("../src/entities/task/index.server");
  await assert.rejects(updateTask({id:2,title:"Invalid reassignment",startDate:"2026-01-01",endDate:"2026-12-31",assigneeId:6,actor:{...admin,isAdmin:true},token:randomUUID(),version:2})); checks++;
  await assert.rejects(updateTask({id:2,title:"Invalid internal reassignment",startDate:"2026-01-01",endDate:"2026-12-31",assigneeId:6})); checks++;
  check((await getTaskById(2))?.version === 2 && (await getTaskById(2))?.assigneeId === 2, `${mode} legacy edit route cannot assign a team task to an outside participant`);
  await assert.rejects(change(1,{kind:"task_team",taskId:2,taskVersion:1,teamId:teams[1].id})); checks++;
  await assert.rejects(change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"member",active:false})); checks++;
  await assert.rejects(change(1,{kind:"project_member",userId:2,active:false})); checks++;
  await db.query("UPDATE tasks SET status='done' WHERE id=2");
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"member",active:false});
  await change(1,{kind:"project_member",userId:2,active:false});
  check(!(await getProjectWorkspace(1,admin)).members.find(m=>m.userId===2)?.active && (await getTaskById(2))?.assigneeId === 2 && (await getTaskById(2))?.status === "done", `${mode} completed assignment history survives project and team departure`);
  await change(1,{kind:"project_member",userId:2,active:true});
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"member",active:true});
  await db.query("UPDATE tasks SET status='planned' WHERE id=2");
  await change(1,{kind:"task_team",taskId:2,taskVersion:2,teamId:null});
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:2,role:"member",active:false});
  check(!(await getProjectWorkspace(1,admin)).teamMembers.find(m => m.teamId === teams[0].id && m.userId === 2)?.active, `${mode} leaving a team deactivates rather than deletes its history`);
  await assert.rejects(change(1,{kind:"project_member",userId:3,active:false})); checks++;
  await change(1,{kind:"team_member",teamId:teams[0].id,userId:3,role:"member",active:true});
  await change(1,{kind:"project_member",userId:3,active:false});
  check((await getProjectWorkspace(1,admin)).teamMembers.filter(m => m.userId === 3).every(m => !m.active), `${mode} project departure deactivates all team roles`);
  await assert.rejects(change(1,{kind:"team_member",teamId:teams[0].id,userId:3,role:"leader",active:true})); checks++;
  const before = (await getProjectWorkspace(1,admin)).version;
  const replay = {projectId:1,version:before,actor:admin,token:randomUUID(),command:{kind:"project_member",userId:5,active:true} as WorkspaceCommand};
  await Promise.all([changeProjectWorkspace(replay),changeProjectWorkspace(replay)]);
  check((await getProjectWorkspace(1,admin)).version === before + 1, `${mode} duplicate concurrent request commits one version`);
  check((await changeProjectWorkspace(replay)).replayed, `${mode} stable retry returns its original receipt`);
  await assert.rejects(changeProjectWorkspace({...replay,command:{kind:"project_member",userId:1,active:false}}), /같은 요청/); checks++;
  const stale = {...replay,token:randomUUID(),command:{kind:"create_team",activityKind:"other",name:"STALE"} as WorkspaceCommand};
  await assert.rejects(changeProjectWorkspace(stale)); checks++;
  check(!(await getProjectWorkspace(1,admin)).teams.some(t => t.name === "STALE"), `${mode} stale version writes no team`);
  const conflictVersion = (await getProjectWorkspace(1,admin)).version;
  const conflict = await Promise.allSettled(["A","B"].map(name => changeProjectWorkspace({projectId:1,actor:admin,token:randomUUID(),version:conflictVersion,command:{kind:"create_team",activityKind:"other",name:`RACE ${name}`}})));
  check(conflict.filter(r => r.status === "fulfilled").length === 1, `${mode} two distinct writers cannot overwrite one workspace version`);
  const stateBeforeFault = await getProjectWorkspace(1,admin);
  const trigger = mode === "D1" ? "CREATE TRIGGER workspace_fault BEFORE INSERT ON project_workspace_events BEGIN SELECT RAISE(ABORT,'synthetic workspace fault'); END" : "CREATE TRIGGER workspace_fault BEFORE INSERT ON project_workspace_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic workspace fault'";
  await db.query(trigger);
  try { await assert.rejects(change(1,{kind:"create_team",activityKind:"other",name:"ROLLBACK"})); checks++; }
  finally { await db.query("DROP TRIGGER workspace_fault"); }
  check(JSON.stringify(await getProjectWorkspace(1,admin)) === JSON.stringify(stateBeforeFault), `${mode} late event failure rolls back version and team together`);
  await db.query("UPDATE users SET email='revoked-superuser@example.test' WHERE id=4");
  await assert.rejects(changeProjectWorkspace({...replay,token:randomUUID(),version:conflictVersion+1})); checks++;
  await db.query("UPDATE users SET email=? WHERE id=4", [TEST_SUPERUSER_EMAIL]);
  check((await db.query("SELECT content,visibility FROM submissions WHERE task_id=1") as {content:string;visibility:string}[])[0].content === "PRESERVE PRIVATE", `${mode} private legacy content is preserved`);
  check((await db.query("SELECT role FROM users WHERE id=3") as {role:string}[])[0].role === "member", `${mode} scoped leader never becomes a global admin`);
  const {getSubmissionByIdForViewer} = await import("../src/entities/submission/index.server");
  check(await getSubmissionByIdForViewer(1,{viewerUserId:3,canSeeAll:false}) === null, `${mode} team membership does not reveal another author's private submission`);
  const {changeTaskStatus} = await import("../src/entities/task/index.server");
  await assert.rejects(changeTaskStatus({id:2,version:3,actor:{userId:2,isAdmin:false,isSuperuser:false},token:randomUUID(),status:"done",note:"no submission"})); checks++;
}

if (!process.argv.includes("--maria")) {
  const mf = new Miniflare({cf:false,modules:true,script:"export default {fetch(){return new Response('fixture')}}",compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"workspace-contracts"}});
  try {
    const DB = await mf.getD1Database("DB") as unknown as D1Database;
    for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) {
      for (const sql of (await readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await DB.prepare(sql).run();
    }
    await runWithHostedBindings({DB},() => verify("D1"));
  } finally { await mf.dispose(); }
}
if (!process.argv.includes("--d1")) {
  if (!["127.0.0.1","localhost","::1"].includes(testDatabaseEnv.host) || Number(testDatabaseEnv.port) !== 3307) throw new Error("Workspace contracts require isolated loopback:3307.");
  const database = `wbs_workspace_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`;
  assertTestDatabaseName(database);
  const options = {host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000};
  const connection = await createConnection(options);
  const globalForDatabase = globalThis as typeof globalThis & {__wbsMariaDbPool?:Pool};
  try {
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);
    await runNativeMigrations(connection,database);
    globalForDatabase.__wbsMariaDbPool = createPool({...options,database,insertIdAsNumber:true,bigIntAsNumber:true,connectionLimit:5});
    await verify("MariaDB");
    console.log(`Retained isolated database: ${database}`);
  } finally {
    await globalForDatabase.__wbsMariaDbPool?.end();
    globalForDatabase.__wbsMariaDbPool = undefined;
    await connection.end();
  }
}
console.log(`PASS workspace storage contracts: ${checks} checks; execution permissions are covered by test:volunteer:tasks`);
