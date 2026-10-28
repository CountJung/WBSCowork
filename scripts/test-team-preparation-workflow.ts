/** Team preparation repository + route integration; fresh MariaDB and ephemeral D1, synthetic loopback only. */
import { setSession } from "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createConnection } from "mariadb";
import { Miniflare, Log, LogLevel } from "miniflare";
import { assertTestDatabaseName, testDatabaseEnv, TEST_SUPERUSER_EMAIL } from "../tests/helpers/test-env";
import { activityKinds, type ActivityKind } from "../src/shared/config/activity-kinds";
import { createPreparationEntry, emptyPreparationDocument, mealQuantity, type PreparationDocument } from "../src/entities/team-preparation";

const output = path.resolve(".test-artifacts/team-preparation-workflow"); await mkdir(output, { recursive: true });
const args = process.argv.slice(2), d1Only = args.length === 1 && args[0] === "--d1";
assert(args.length === 0 || d1Only, "Use --d1 for D1-only validation or no arguments for both runtimes.");
const database = `wbs_team_preparation_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`; assertTestDatabaseName(database);
assert(["127.0.0.1", "localhost", "::1"].includes(testDatabaseEnv.host) && Number(testDatabaseEnv.port) === 3307);
process.env.DB_NAME = database;
const origin = "http://127.0.0.1:3000";
const people = {
  su: { id: 1, email: TEST_SUPERUSER_EMAIL, role: "guest" }, admin: { id: 2, email: "preparation-admin@example.test", role: "admin" },
  otherAdmin: { id: 3, email: "preparation-other-admin@example.test", role: "admin" }, leader: { id: 4, email: "preparation-leader@example.test", role: "member" },
  member: { id: 5, email: "preparation-member@example.test", role: "member" }, replacement: { id: 6, email: "preparation-replacement@example.test", role: "member" },
  otherTeam: { id: 7, email: "preparation-other-team@example.test", role: "member" }, guest: { id: 8, email: "preparation-guest@example.test", role: "guest" },
  staleAdmin: { id: 9, email: "preparation-stale-admin@example.test", role: "member" }, outsider: { id: 10, email: "preparation-outsider@example.test", role: "member" },
} as const;
type Actor = keyof typeof people;
const preparationKinds = activityKinds.filter(kind => kind !== "media");
type Query = (sql: string, values?: unknown[]) => Promise<Record<string, unknown>[]>;
const viewer = (who: Actor) => ({ userId: people[who].id, email: people[who].email, isSuperuser: who === "su" });
function session(who: Actor | null, stale = false) { setSession(who === null ? null : { user: { email: people[who].email, name: who, role: stale ? "admin" : people[who].role, isSuperuser: stale }, expires: new Date(Date.now() + 3600000).toISOString() }); }
const repo = await import("../src/entities/team-preparation/index.server");
const routes = await import("../app/api/projects/[projectId]/teams/[teamId]/preparation/route");
const { runNativeMigrations } = await import("../src/shared/server/database-admin/native-migrations.server");
const { runWithHostedBindings } = await import("../src/shared/server/hosted-runtime/index.server");
const native = d1Only ? null : await createConnection({ host: testDatabaseEnv.host, port: Number(testDatabaseEnv.port), user: testDatabaseEnv.user, password: testDatabaseEnv.password, connectTimeout: 5000, bigIntAsNumber: true, insertIdAsNumber: true });
const mf = new Miniflare({ cf: false, modules: true, script: "export default {fetch(){return new Response('synthetic team preparation DB only');}}", d1Databases: { DB: "team-preparation-workflow" }, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], log: new Log(LogLevel.ERROR) });
const results: { runtime: string; checks: number; assertions: string[]; requests: { method: string; status: number }[] }[] = [];
function document(kind: ActivityKind, title = "합성 준비 항목"): PreparationDocument {
  const entry = { ...createPreparationEntry(kind, "2026-11-01"), title, notes: "합성 내용만 사용합니다.\n개인정보 없음", checks: [{ label: "합성 준비 확인", done: false }] };
  if ("expectedPeople" in entry) Object.assign(entry, { expectedPeople: 3, amountPerPerson: 0.125, unit: "kg" });
  return { schemaVersion: 1, kind, entries: [entry, { ...entry, id: randomUUID(), date: "2026-11-02", title: title + " 둘째 날", status: "done" }] };
}
async function seed(query: Query) {
  for (const user of Object.values(people)) await query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [user.id, user.email, user.email.split("@")[0], user.role]);
  for (const id of [1001, 1002]) await query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(?,?,'volunteering','members_only','2026-10-01','2026-12-01')", [id, `Synthetic preparation ${id}`]);
  for (const [project, user] of [[1001,2],[1002,3],[1001,4],[1001,5],[1001,6],[1001,7],[1001,8],[1001,9]]) await query("INSERT INTO project_members(project_id,user_id) VALUES(?,?)", [project,user]);
  for (const [index, kind] of preparationKinds.entries()) {
    const teamId = 1101 + index;
    await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(?,1001,?,?)", [teamId,kind,`Synthetic ${kind}`]);
    for (const user of [4,5]) await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,?,?,?,1)",[teamId,user,user===4?"leader":"member"]);
    await query("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(?,1001,4)",[teamId]);
  }
  await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1201,1001,'other','Synthetic other team'),(1202,1002,'meal','Synthetic other project')");
  for (const user of [6,8,9]) await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,1101,?,'member',1)",[user]);
  await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,1201,7,'leader',1),(1002,1202,3,'leader',1)");
  await query("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1201,1001,7),(1202,1002,3)");
}
async function run(runtime: "native" | "d1", query: Query) {
  const checks: string[] = [], requests: {method:string;status:number}[] = [];
  const check = (value: unknown, label: string) => { assert.ok(value, `${runtime}: ${label}`); checks.push(label); console.log(`PASS ${runtime}: ${label}`); };
  const deny = async (operation: () => Promise<unknown>, status: number, label: string) => {
    let thrown: unknown; try { await operation(); } catch (error) { thrown = error; }
    check(thrown instanceof repo.PreparationError && thrown.status === status, label);
  };
  const input = (doc: unknown, version: number, mutationKey: string = randomUUID()) => ({ document: doc, version, mutationKey });
  const read = (who: Actor = "leader", teamId = 1101, projectId = 1001) => repo.getTeamPreparation(viewer(who),projectId,teamId);
  const save = (who: Actor, value: ReturnType<typeof input>, teamId = 1101, projectId = 1001) => repo.saveTeamPreparation(viewer(who),projectId,teamId,value);
  const counts = async () => {
    const rows = await query("SELECT (SELECT COUNT(*) FROM team_preparation_sheets) sheets,(SELECT COUNT(*) FROM team_preparation_revisions) revisions");
    return { sheets:Number(rows[0].sheets), revisions:Number(rows[0].revisions) };
  };
  const beforeRead = await counts();
  const blank = await read(); check(blank.version === 0 && blank.canEdit && blank.document.entries.length === 0 && blank.updatedAt === null && blank.updatedBy === null, "canonical leader reads unsaved empty preparation without mutation");
  check(JSON.stringify(await counts()) === JSON.stringify(beforeRead), "read-only empty preparation leaves current/revision counts unchanged");
  check((await read("member")).canEdit === false, "active team member can read without editing");
  for (const who of ["guest","otherTeam","otherAdmin","outsider"] as const) {
    await deny(() => read(who),404,`${who} cannot read another/unauthorized team`);
    await deny(() => save(who,input(document("meal"),0)),404,`${who} cannot save unauthorized preparation`);
  }
  await deny(() => read("leader",1101,1002),404,"team/project identifier mismatch denied");
  await deny(() => read("leader",999999),404,"missing preparation team uses same404 boundary");
  await deny(() => save("member",input(document("meal"),0)),404,"ordinary active member cannot edit");
  await deny(() => repo.saveTeamPreparation({...viewer("staleAdmin"),isSuperuser:true},1001,1101,input(document("meal"),0)),404,"forged SU flag/current non-admin account cannot edit");
  await deny(() => repo.saveTeamPreparation({...viewer("member"),email:TEST_SUPERUSER_EMAIL,isSuperuser:true},1001,1101,input(document("meal"),0)),404,"forged env SU email cannot resolve a different current user ID");
  const listBefore = await repo.listTeamPreparations(viewer("member"),1001);
  check(listBefore.length === 6 && listBefore.every(row => !Object.hasOwn(row,"document")),"member directory lists only six own teams with bounded summaries and no document payload");
  check((await repo.listTeamPreparations(viewer("otherTeam"),1001)).length === 1,"other-team member directory is restricted to their own team");
  for (const [index, kind] of preparationKinds.entries()) {
    const teamId = 1101+index, doc = document(kind), saved = await save("leader",input(doc,0),teamId), refreshed = await read("member",teamId);
    check(saved.version === 1 && JSON.stringify(refreshed.document) === JSON.stringify(doc) && refreshed.document.kind === kind,`${kind} two-date structured entries persist across fresh repository read`);
    check(saved.updatedBy !== null && saved.updatedAt !== null,`${kind} save records actor and timestamp`);
  }
  const summaries = await repo.listTeamPreparations(viewer("member"),1001);
  check(summaries.length===6 && summaries.every(row=>row.entryCount===2 && row.completedCount===1 && !Object.hasOwn(row,"document")),"six persisted team summaries expose exact row/completion counts without document bodies");
  const paged=await repo.listTeamPreparations(viewer("member"),1001,1103);
  check(paged.length===3 && paged.every(row=>row.teamId>1103),"team summary cursor returns only subsequent authorized team IDs");
  const meal = await read(); check(mealQuantity(meal.document.entries[0]) === 0.375 && meal.mealQuantities[meal.document.entries[0].id] === 0.375,"saved meal quantity derives exact fixed-thousandths 3×0.125 on the server model");
  const initialHistory = await repo.getTeamPreparationHistory(viewer("member"),1001,1101); check(initialHistory.length === 1,"team member can read immutable revision metadata");
  const originalRevisions = await query("SELECT * FROM team_preparation_revisions WHERE team_id=1101 ORDER BY version");
  const doc2 = document("meal","합성 변경"), retry = input(doc2,1), first = await save("leader",retry);
  check(first.version === 2,"valid CAS advances preparation version");
  const countBeforeRetry = await counts(), repeated = await save("leader",retry);
  check(repeated.version === 2 && JSON.stringify(await counts()) === JSON.stringify(countBeforeRetry),"same mutation key and canonical body replay without duplicate revision");
  await deny(() => save("leader",{...retry,document:document("meal","동일 키 다른 내용")}),409,"same mutation key with different payload conflicts");
  await deny(() => save("admin",retry),409,"same mutation key replay by different actor conflicts");
  await deny(() => save("leader",input(document("meal"),1)),409,"stale version cannot overwrite newer preparation");
  const parallel = await Promise.allSettled([save("leader",input(document("meal","경쟁 A"),2)),save("leader",input(document("meal","경쟁 B"),2))]);
  check(parallel.filter(row=>row.status==="fulfilled").length===1 && parallel.filter(row=>row.status==="rejected" && row.reason instanceof repo.PreparationError && row.reason.status===409).length===1,"two fresh keys with the same expected version commit exactly once and conflict once");
  const afterParallel = await read(); check(afterParallel.version === 3 && (await counts()).revisions === 8,"parallel CAS leaves one current advancement and one atomic revision");
  const atomicBefore = JSON.stringify(await query("SELECT * FROM team_preparation_sheets WHERE team_id=1101")), atomicRevisions = await counts();
  await query(runtime === "native"
    ? "CREATE TRIGGER synthetic_preparation_revision_failure BEFORE INSERT ON team_preparation_revisions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic revision failure'"
    : "CREATE TRIGGER synthetic_preparation_revision_failure BEFORE INSERT ON team_preparation_revisions BEGIN SELECT RAISE(ABORT,'synthetic revision failure'); END");
  try {
    await deny(()=>save("leader",input(document("meal","원자성 실패 주입"),3)),503,"revision INSERT failure does not commit a partial preparation head");
    await deny(()=>save("otherTeam",input(document("other","첫 저장 실패 주입"),0),1201),503,"initial revision INSERT failure does not leave a newly created head");
  }
  finally { await query("DROP TRIGGER synthetic_preparation_revision_failure"); }
  check(JSON.stringify(await query("SELECT * FROM team_preparation_sheets WHERE team_id=1101"))===atomicBefore && JSON.stringify(await counts())===JSON.stringify(atomicRevisions),"failed revision transaction rolls back head and leaves all revision counts unchanged");
  if(runtime==="d1"){
    await query("CREATE TRIGGER synthetic_preparation_revision_ignore BEFORE INSERT ON team_preparation_revisions WHEN NEW.version IS NOT NULL BEGIN SELECT RAISE(IGNORE); END");
    try { await deny(()=>save("leader",input(document("meal","원자성 0행 주입"),3)),503,"zero-row revision INSERT forces rollback rather than head-only commit"); }
    finally { await query("DROP TRIGGER synthetic_preparation_revision_ignore"); }
    check(JSON.stringify(await query("SELECT * FROM team_preparation_sheets WHERE team_id=1101"))===atomicBefore && JSON.stringify(await counts())===JSON.stringify(atomicRevisions),"zero-row guarded revision transaction preserves original head and history");
  }
  const leaderEmail=people.leader.email, changedEmail="synthetic-revoked-identity@example.test";
  await query(runtime === "native"
    ? "CREATE TRIGGER synthetic_preparation_identity_change AFTER UPDATE ON team_preparation_sheets FOR EACH ROW UPDATE users SET email='synthetic-revoked-identity@example.test' WHERE id=4"
    : "CREATE TRIGGER synthetic_preparation_identity_change AFTER UPDATE ON team_preparation_sheets BEGIN UPDATE users SET email='synthetic-revoked-identity@example.test' WHERE id=4; END");
  try {
    await deny(()=>save("leader",input(document("meal","동일 transaction 신원 변경 주입"),3)),503,"in-transaction identity change cannot commit a head without its guarded revision");
  } finally { await query("DROP TRIGGER synthetic_preparation_identity_change"); }
  check(JSON.stringify(await query("SELECT * FROM team_preparation_sheets WHERE team_id=1101"))===atomicBefore && JSON.stringify(await counts())===JSON.stringify(atomicRevisions) && (await query("SELECT email FROM users WHERE id=4"))[0].email===leaderEmail,"identity-change failure restores sheet/revisions and original user email atomically");
  check(Number((await query("SELECT COUNT(*) n FROM users WHERE email=?",[changedEmail]))[0].n)===0,"no synthetic in-transaction identity change survives failed save");
  const duplicateInput=input(document("facility","병렬 동일 요청"),1), beforeDuplicate=await counts();
  const duplicateResults=await Promise.all([save("leader",duplicateInput,1102),save("leader",duplicateInput,1102)]);
  check(duplicateResults.every(row=>row.version===2) && (await counts()).revisions===beforeDuplicate.revisions+1,"parallel same-key retry commits one revision and both return current preparation");
  check((await save("leader",retry)).version===3,"older matching mutation retry returns the latest current version without overwriting it");
  const persistedRevisions = await query("SELECT * FROM team_preparation_revisions WHERE team_id=1101 AND version=1");
  check(JSON.stringify(persistedRevisions)===JSON.stringify(originalRevisions),"prior revision row remains byte/value identical after later writes");
  const badDocuments: [string,unknown][] = [];
  for (const [label, patch] of [["invalid calendar date",{date:"2026-02-30"}],["negative people",{expectedPeople:-1}],["fractional people",{expectedPeople:1.5}],["non-finite amount",{amountPerPerson:Infinity}],["excess amount precision",{amountPerPerson:0.0001}],["forged computed total",{totalQuantity:999}],["blank required title",{title:" "}]] as const) { const d=document("meal"); Object.assign(d.entries[0],patch); badDocuments.push([label,d]); }
  badDocuments.push(["unknown kind",{schemaVersion:1,kind:"unrecognized",entries:[]}],["different team kind",document("facility")],["malformed entry",{schemaVersion:1,kind:"meal",entries:[{}]}]);
  const tooMany=document("meal");tooMany.entries=Array.from({length:51},()=>({...tooMany.entries[0],id:randomUUID()}));badDocuments.push(["over 50 rows",tooMany]);
  const tooBig=document("meal");tooBig.entries=Array.from({length:50},()=>({...tooBig.entries[0],id:randomUUID(),notes:"가".repeat(1000)}));badDocuments.push(["over 64KiB UTF-8",tooBig]);
  const unchanged = await counts();
  for (const [label,doc] of badDocuments) await deny(()=>save("leader",input(doc,3)),400,`${label} rejected before write`);
  for (const value of [input(document("meal"),-1),input(document("meal"),3,"not-uuid"),input(document("meal"),3,randomUUID()+"\n")]) await deny(()=>save("leader",value),400,"invalid CAS/key rejected before write");
  check(JSON.stringify(await counts())===JSON.stringify(unchanged) && (await read()).version===3,"all rejected writes preserve sheet/version/revision counts");
  await query("UPDATE activity_team_members SET role='member' WHERE team_id=1101 AND user_id=4");
  await query("UPDATE activity_team_members SET role='leader' WHERE team_id=1101 AND user_id=6");
  await query("UPDATE activity_team_leaders SET user_id=6 WHERE team_id=1101");
  check(!(await read("leader")).canEdit && (await read("replacement")).canEdit,"canonical team leader replacement updates permissions on the next request");
  await deny(()=>save("leader",input(document("meal"),3)),404,"old leader's existing identity cannot save after replacement");
  check((await save("replacement",input(document("meal","새 팀장 저장"),3))).version===4,"replacement canonical leader can save");
  await query("UPDATE activity_team_members SET active=0 WHERE team_id=1101 AND user_id=5");
  await deny(()=>read("member"),404,"team membership revocation blocks next read");
  await deny(()=>repo.getTeamPreparationHistory(viewer("member"),1001,1101),404,"revoked team member cannot read revision history");
  await query("UPDATE activity_team_members SET active=1 WHERE team_id=1101 AND user_id=5");
  await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=6");
  await deny(()=>read("replacement"),404,"project membership revocation blocks next leader read");
  await deny(()=>save("replacement",input(document("meal"),4)),404,"project membership revocation blocks next leader write");
  await query("UPDATE project_members SET active=1 WHERE project_id=1001 AND user_id=6");
  check((await read("admin")).canEdit && (await read("su")).canEdit,"assigned administrator and unbound environment SU retain explicit preparation management");
  check((await save("su",input(document("meal","검증 SU 저장"),4))).version===5,"verified environment SU with guest DB role and no membership can save");

  const routeContext=(projectId:string="1001",teamId:string="1101")=>({params:Promise.resolve({projectId,teamId})});
  const url=origin+"/api/projects/1001/teams/1101/preparation";
  const routeRequest=(body?:unknown,headers:Record<string,string>={})=>new Request(url,body===undefined?{}:{method:"PUT",headers:{Origin:origin,"Content-Type":"application/json",...headers},body:typeof body==="string"?body:JSON.stringify(body)});
  const call=async(method:"GET"|"PUT",request:Request,context=routeContext())=>{const response=await routes[method](request,context);requests.push({method,status:response.status});check(response.headers.get("cache-control")==="private, no-store" && response.headers.get("x-content-type-options")==="nosniff",`${method} route response preserves private/no-store/nosniff`);return response;};
  session(null);
  for(const team of ["1101","999999","invalid"])check((await call("GET",routeRequest(),routeContext("1001",team))).status===401,"anonymous valid/missing/malformed resource uses same login boundary");
  session("member");const memberRoute=await call("GET",routeRequest()), memberBody=await memberRoute.json();check(memberRoute.status===200 && memberBody.sheet.version===5 && memberBody.sheet.canEdit===false && memberBody.history.length===5,"GET route returns current saved document and authorized immutable history");
  check((await call("PUT",routeRequest(input(document("meal"),5)))).status===404,"member PUT route cannot elevate read access to edit");
  for(const who of ["otherTeam","otherAdmin","guest","outsider"] as const){session(who);check((await call("GET",routeRequest())).status===404 && (await call("PUT",routeRequest(input(document("meal"),5)))).status===404,`${who} route read/write denied on current database scope`);}
  session("staleAdmin",true);check((await call("PUT",routeRequest(input(document("meal"),5)))).status===404,"stale session admin/SU flags do not override current DB member role");
  session("su",false);const suRoute=await call("GET",routeRequest()), suBody=await suRoute.json();check(suRoute.status===200 && suBody.sheet.canEdit===true,"actual auth refresh recognizes unbound env SU despite guest session/DB role");
  session("admin");
  const routeInput=input(document("meal","경로 저장"),5), routeSaved=await call("PUT",routeRequest(routeInput)), savedBody=await routeSaved.json();check(routeSaved.status===200 && savedBody.sheet.version===6,"same-origin JSON PUT route persists and returns new version");
  check((await call("PUT",routeRequest(routeInput))).status===200,"same JSON PUT replay remains idempotent");
  check((await call("PUT",routeRequest(input(document("meal"),5)))).status===409,"stale JSON PUT returns conflict409");
  check((await call("PUT",routeRequest(routeInput,{Origin:"https://outside.example.test"}))).status===403,"cross-origin mutation blocked");
  check((await call("PUT",new Request(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(routeInput)}))).status===403,"missing Origin mutation blocked");
  check((await call("PUT",routeRequest(routeInput,{"Content-Type":"text/plain"}))).status===415,"non-JSON content type denied");
  check((await call("PUT",routeRequest("{"))).status===400,"malformed JSON denied");
  check((await call("PUT",routeRequest({...routeInput,unknown:true}))).status===400,"unknown top-level JSON key denied");
  check((await call("PUT",routeRequest("x".repeat(67*1024)))).status===413,"actual streamed request above 66KiB denied");
  check((await call("PUT",routeRequest(routeInput,{"Content-Length":String(67*1024)}))).status===413,"declared request above 66KiB denied before decode");
  for(const [p,t] of [["1002","1101"],["1001","invalid"],["1001","999999"]])check((await call("GET",routeRequest(),routeContext(p,t))).status===404,"authenticated invalid/missing/cross-project route uses same404 boundary");
  const readCounts=await counts();await read("member");await repo.getTeamPreparationHistory(viewer("member"),1001,1101);await repo.listTeamPreparations(viewer("member"),1001);check(JSON.stringify(await counts())===JSON.stringify(readCounts),"saved preparation refresh/list/history are read-only");
  const history=await repo.getTeamPreparationHistory(viewer("admin"),1001,1101);check(history.length===6,"all six successful meal mutations retain immutable revision metadata");
  const preservedRevision=JSON.stringify(await query("SELECT * FROM team_preparation_revisions WHERE team_id=1101 AND version=6"));
  const removed=await save("admin",input(emptyPreparationDocument("meal"),6));
  check(removed.version===7 && removed.document.entries.length===0 && (await read("member")).document.entries.length===0,"removing rows creates a persisted replacement version without deleting the sheet");
  check(JSON.stringify(await query("SELECT * FROM team_preparation_revisions WHERE team_id=1101 AND version=6"))===preservedRevision && (await repo.getTeamPreparationHistory(viewer("member"),1001,1101)).length===7,"row removal preserves the complete previous immutable revision");
  check(Number((await query("SELECT COUNT(*) n FROM users"))[0].n)===10 && Number((await query("SELECT COUNT(*) n FROM projects"))[0].n)===2 && Number((await query("SELECT COUNT(*) n FROM activity_teams"))[0].n)===8,"synthetic users/projects/teams preserved without deletes");
  check((await query("SELECT role FROM users WHERE id=1"))[0].role==="guest" && Number((await query("SELECT COUNT(*) n FROM project_members WHERE user_id=1"))[0].n)===0,"environment SU fixture remains guest and unbound; no account privilege mutations");
  const result={runtime,checks:checks.length,assertions:checks,requests};results.push(result);await writeFile(path.join(output,`${runtime}-result.json`),JSON.stringify(result,null,2));
}
try{
  if (native) {
    await native.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await native.query(`USE \`${database}\``);await runNativeMigrations(native,database);
    const connection = native;
    const nativeQuery:Query=async(sql,values=[])=>connection.query(sql,values);await seed(nativeQuery);await run("native",nativeQuery);
  }
  const db=await mf.getD1Database("DB");
  for(const file of (await readdir("drizzle")).filter(name=>name.endsWith(".sql")).sort())for(const sql of (await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  const d1Query:Query=async(sql,values=[])=>(await db.prepare(sql).bind(...values as (string|number|null)[]).all()).results as Record<string,unknown>[];await seed(d1Query);
  // Miniflare's host proxy and Workers binding use distinct Headers types; explicit synthetic binding boundary only.
  await runWithHostedBindings({DB:db} as unknown as Parameters<typeof runWithHostedBindings>[0],()=>run("d1",d1Query),{requestUrl:origin+"/",publicOrigin:origin,projectId:'appgprj_syntheticOrigin',expectedProjectId:'appgprj_syntheticOrigin'});
  await writeFile(path.join(output,"result.json"),JSON.stringify({complete:true,checks:results.reduce((n,r)=>n+r.checks,0),runtimes:results,database:d1Only?null:database,nativeExecuted:!d1Only,scriptSha256:createHash("sha256").update(await readFile(import.meta.filename)).digest("hex"),limits:d1Only?"Source repository and route handlers with real isolated D1 only; Native/MariaDB not executed. No compiled artifact, browser, production, real account changes or publication.":"Source repository and route handlers with real isolated MariaDB/D1 only. No compiled artifact, browser hydration/interaction, production access, real account changes, deletion, or publication."},null,2));
}finally{session(null);const {closeDatabasePool}=await import("../src/shared/server/database/index.server");await closeDatabasePool();if(native)await native.end();await mf.dispose();}
