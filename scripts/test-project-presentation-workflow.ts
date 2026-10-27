/** Explicit real runtime integration: ephemeral D1 or isolated loopback MariaDB *_test schemas. */
import { setSession } from "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createConnection, type Connection } from "mariadb";
import { Miniflare, Log, LogLevel } from "miniflare";
import { TEST_SUPERUSER_EMAIL, testDatabaseEnv, assertTestDatabaseName } from "../tests/helpers/test-env";
import type { PreparationDocument } from "../src/entities/team-preparation";
const args=process.argv.slice(2);assert(args.length===1&&["--d1","--native"].includes(args[0]),"Select exactly one real test runtime: --d1 or --native.");
const runtime=args[0]==="--native"?"native":"d1";
const database=`wbs_portal_${Date.now().toString(36)}_${randomUUID().slice(0,8)}_test`, upgradeDatabase=database.replace(/_test$/, "_upgrade_test");
assertTestDatabaseName(database);assertTestDatabaseName(upgradeDatabase);
if(runtime==="native"){
  assert(["127.0.0.1","localhost","::1"].includes(testDatabaseEnv.host)&&Number(testDatabaseEnv.port)===3307,"Native portal verification requires the supported synthetic loopback test database.");
  process.env.DB_NAME=database;
}
// The runtime env caches first use, so the isolated DB name must precede auth/repository imports.
const {getProjectPortal,listProjectPortals,listPortalTeams,saveProjectPortalSettings,saveTeamPublication,ProjectPresentationError}=await import("../src/entities/project-presentation/index.server");
const {getTeamPresentation}=await import("../src/features/project-presentation/index.server");
const {saveTeamPreparation,getTeamPreparation}=await import("../src/entities/team-preparation/index.server");
const {createPreparationEntry}=await import("../src/entities/team-preparation");
const {runWithHostedBindings}=await import("../src/shared/server/hosted-runtime/index.server");
const {GET:portalGET,PUT:portalPUT}=await import("../app/api/projects/[projectId]/presentation/route");
const {GET:teamGET,PUT:teamPUT}=await import("../app/api/projects/[projectId]/presentation/teams/[teamId]/route");
const {GET:preparationGET,PUT:preparationPUT}=await import("../app/api/projects/[projectId]/teams/[teamId]/preparation/route");
const people = [
  [1,TEST_SUPERUSER_EMAIL,"guest"],[2,"portal-admin@example.test","admin"],[3,"portal-other-admin@example.test","admin"],
  [4,"portal-leader@example.test","member"],[5,"portal-team-member@example.test","member"],[6,"portal-only-member@example.test","member"],
  [7,"portal-other-leader@example.test","member"],[8,"portal-guest@example.test","guest"],[9,"portal-outsider@example.test","member"],
  [10,"portal-old-admin@example.test","member"],[11,"portal-replacement@example.test","member"],
] as const;
const viewer = (userId: number) => ({ userId, email: people.find(row=>row[0]===userId)![1], isSuperuser: userId === 1 });
const document = (title: string): PreparationDocument => ({schemaVersion:1,kind:"meal",entries:[{...createPreparationEntry("meal","2026-11-01"),title,expectedPeople:12,amountPerPerson:150,unit:"g"}]});
let checks = 0; const labels: string[] = [];
function check(value: unknown,label:string){assert(value,label);checks++;labels.push(label);console.log(`PASS ${runtime}: ${label}`);}
async function denied(work:()=>Promise<unknown>,status:number,label:string){let error:unknown;try{await work();}catch(caught){error=caught;}check(error instanceof ProjectPresentationError&&error.status===status,label);}
let mf: Miniflare | undefined, native: Connection | undefined;
let nativeServerVersion: string | null = null;
let db: Awaited<ReturnType<Miniflare["getD1Database"]>> | undefined;
async function q(sql:string,values:unknown[]=[]):Promise<Record<string,unknown>[]> {
  if(native)return native.query(sql,values);
  assert(db);return (await db.prepare(sql).bind(...values as (string|number|null)[]).all()).results as Record<string,unknown>[];
}
const connectionOptions={host:testDatabaseEnv.host,port:Number(testDatabaseEnv.port),user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true,insertIdAsNumber:true};
async function verifyNativeUpgrade(){
  const upgrade=await createConnection(connectionOptions);
  try{
    await upgrade.query(`CREATE DATABASE \`${upgradeDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await upgrade.query(`USE \`${upgradeDatabase}\``);
    // Use the repository's immutable pre-feature runner, with imports relocated only for this isolated fixture.
    const legacySource=execFileSync("git",["show","445c6ea56982cf8a32eb4c13dc7349f2c128f0b1:src/shared/server/database-admin/native-migrations.server.ts"],{encoding:"utf8"});
    const relocated=legacySource.replace(/from "(\.\/[^\"]+)"/g,(_match,relative:string)=>`from ${JSON.stringify(pathToFileURL(path.resolve("src/shared/server/database-admin",relative+".ts")).href)}`);
    await mkdir('.test-artifacts/project-presentation',{recursive:true});const legacyFile=path.resolve('.test-artifacts/project-presentation/native-v15-fixture-runner.ts');await writeFile(legacyFile,relocated);
    const previous=await import(pathToFileURL(legacyFile).href);assert.equal(previous.nativeMigrationManifest.at(-1).version,15);
    await previous.runNativeMigrations(upgrade,upgradeDatabase);
    check(Number((await upgrade.query('SELECT MAX(version) version FROM schema_migrations'))[0].version)===15,"actual previous V15 runner creates a real MariaDB upgrade baseline");
    await upgrade.query("INSERT INTO users(id,email,name,role) VALUES(99,'retained-portal-fixture@example.test','Retained synthetic','member')");
    await upgrade.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(99,'Retained old project','2026-01-01','2026-12-31')");
    await upgrade.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(99,99,'Retained old task','2026-01-01','2026-12-31')");
    await upgrade.query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(99,99,99,'RETAINED_PRIVATE_OLD_DATA','private')");
    await upgrade.query("INSERT INTO submission_attachments(id,submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(99,99,'synthetic-retained/old-file.txt','old-file.txt','text/plain',24)");
    const tables=['users','projects','tasks','submissions','submission_attachments'];
    const before=JSON.stringify(await Promise.all(tables.map(table=>upgrade.query(`SELECT * FROM ${table} ORDER BY id`))));
    const {runNativeMigrations}=await import('../src/shared/server/database-admin/native-migrations.server');
    await runNativeMigrations(upgrade,upgradeDatabase);
    check(Number((await upgrade.query('SELECT MAX(version) version FROM schema_migrations'))[0].version)===17,"real MariaDB upgrades existing V15 through additive V16/V17");
    check(JSON.stringify(await Promise.all(tables.map(table=>upgrade.query(`SELECT * FROM ${table} ORDER BY id`))))===before,"V15 upgrade retains all seeded private WBS/account/file metadata byte-for-byte");
    check(Number((await upgrade.query('SELECT COUNT(*) n FROM project_presentation_settings'))[0].n)===0&&Number((await upgrade.query('SELECT COUNT(*) n FROM team_presentation_publications'))[0].n)===0,"V15 upgrade adds empty portal tables without inferring members or publications");
    await runNativeMigrations(upgrade,upgradeDatabase);
    check(Number((await upgrade.query('SELECT COUNT(*) n FROM schema_migrations'))[0].n)===17,"real Native migration rerun verifies checksums without adding duplicate history");
  }finally{await upgrade.end();}
}
try {
  if(runtime==="native"){
    native=await createConnection(connectionOptions);await native.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await native.query(`USE \`${database}\``);
    const {runNativeMigrations}=await import('../src/shared/server/database-admin/native-migrations.server');await runNativeMigrations(native,database);
    check(Number((await native.query('SELECT MAX(version) version FROM schema_migrations'))[0].version)===17,"fresh real MariaDB applies Native migrations through V17");
    nativeServerVersion=String((await native.query('SELECT VERSION() version'))[0].version);
    const {getDatabasePool}=await import('../src/shared/server/database/index.server');
    check((await getDatabasePool().query('SELECT DATABASE() name') as {name:string}[])[0].name===database,"repository pool is bound to its unique synthetic schema, never the shared full-suite database");

    await verifyNativeUpgrade();
  }else{
    mf=new Miniflare({cf:false,modules:true,script:"export default {fetch(){return new Response('Synthetic portal database only');}}",d1Databases:{DB:"project-portal-workflow"},compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],log:new Log(LogLevel.ERROR)});db=await mf.getD1Database("DB");
    for(const file of (await readdir("drizzle")).filter(name=>/^\d+.*\.sql$/.test(name)&&Number(name.slice(0,4))<=19).sort())for(const sql of (await readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  }
  for(const [id,email,role]of people)await q("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)",[id,email,`Synthetic ${id}`,role]);
  await q("INSERT INTO projects(id,name,goal,project_type,access_mode,start_date,end_date) VALUES(101,'Synthetic portal A','Synthetic goal','volunteering','legacy_authenticated','2026-01-01','2026-12-31'),(102,'Synthetic portal B','','volunteering','members_only','2026-01-01','2026-12-31'),(103,'Synthetic collaboration','','collaboration','legacy_authenticated','2026-01-01','2026-12-31')");
  for(const user of [2,4,5,6,7,8,10,11])await q("INSERT INTO project_members(project_id,user_id) VALUES(101,?)",[user]);
  await q("INSERT INTO project_members(project_id,user_id) VALUES(102,3),(103,2)");
  await q("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(111,101,'meal','Synthetic meal'),(112,101,'recreation','Synthetic recreation'),(211,102,'meal','Synthetic cross project')");
  for(const [team,user,role]of [[111,4,'leader'],[111,5,'member'],[111,11,'member'],[112,7,'leader'],[211,3,'leader']])await q("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(?,?,?,?)",[team===211?102:101,team,user,role]);
  await q("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(111,101,4),(112,101,7),(211,102,3)");
  await q("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(101,101,'Preserved synthetic task','2026-01-01','2026-12-31')");
  await q("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(101,101,4,'PRIVATE_OLD_SUBMISSION_MUST_STAY_PRIVATE','private')");
  const preserved = JSON.stringify(await q("SELECT * FROM submissions"));
  const execute=async()=>{
    check((await listProjectPortals(viewer(9))).length===0,"strict portal directory excludes unbound users even when WBS projects are legacy-readable");
    check(JSON.stringify((await listProjectPortals(viewer(3))).map(p=>p.id))==='[102]',"project B administrator directory lists only their assigned project");
    check(JSON.stringify((await listProjectPortals(viewer(1))).map(p=>p.id))==='[101,102,103]',"unbound verified env SU directory lists all projects in stable id order");
    check(JSON.stringify((await listProjectPortals(viewer(5))).map(p=>p.id))==='[101]',"ordinary member directory is limited to their current active projects");
    const unsaved=await getProjectPortal(viewer(2),101);
    check(unsaved.canManage&&unsaved.settings.layout==='volunteer_presentation'&&unsaved.settings.version===0,"assigned administrator reads virtual volunteer presentation defaults");
    check(Number((await q("SELECT COUNT(*) n FROM project_presentation_settings"))[0].n)===0,"virtual defaults do not migrate or publish existing data");
    await denied(()=>getProjectPortal(viewer(9),101),404,"unbound user cannot enter new portal even on legacy-readable WBS project");
    await denied(()=>getProjectPortal(viewer(3),101),404,"administrator of project B cannot enter A");
    await denied(()=>getProjectPortal({...viewer(5),email:TEST_SUPERUSER_EMAIL,isSuperuser:true},101),404,"claimed env email cannot select another current user id");
    check(!(await getProjectPortal({...viewer(5),isSuperuser:true},101)).canManage,"forged SU flag does not grant current member management");
    check((await getProjectPortal(viewer(1),102)).canManage,"verified unbound env SU remains manager despite guest DB role");
    check(!(await getProjectPortal(viewer(8),101)).canManage,"active project guest can read portal without write promotion");
    check((await getProjectPortal(viewer(2),103)).settings.layout==='workspace',"collaboration defaults to workspace without changing project type");
    const settings={version:0,mutationKey:randomUUID(),layout:'volunteer_presentation' as const,title:'합성 봉사 홈',intro:'안전한 합성 소개'};
    await denied(()=>saveProjectPortalSettings(viewer(4),101,settings),404,"team leader cannot edit project-wide presentation settings");
    await denied(()=>saveProjectPortalSettings(viewer(2),103,settings),400,"collaboration cannot select volunteer presentation layout");
    await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,mutationKey:randomUUID()+'\n'}),400,"mutation token with final newline cannot exploit JavaScript end-anchor matching");
    const first=await saveProjectPortalSettings(viewer(2),101,settings);check(first.settings.version===1&&first.settings.title===settings.title,"assigned administrator saves title/intro/layout with version1");
    check((await getProjectPortal(viewer(5),101)).settings.intro===settings.intro,"settings persist on a fresh member read");
    check((await saveProjectPortalSettings(viewer(2),101,settings)).settings.version===1,"identical settings request replay is idempotent");
    await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,title:'changed replay'}),409,"same settings mutation key cannot change content");
    await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,mutationKey:randomUUID()}),409,"stale settings version cannot overwrite newer data");
    await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,version:1,mutationKey:randomUUID(),intro:'a'.repeat(2001)}),400,"intro length is bounded server-side");
    const contested=await Promise.allSettled([saveProjectPortalSettings(viewer(2),101,{...settings,version:1,mutationKey:randomUUID(),title:'CAS first'}),saveProjectPortalSettings(viewer(2),101,{...settings,version:1,mutationKey:randomUUID(),title:'CAS second'})]);
    check(contested.filter(value=>value.status==='fulfilled').length===1&&contested.some(value=>value.status==='rejected'&&value.reason instanceof ProjectPresentationError&&value.reason.status===409),"concurrent settings CAS permits exactly one writer and reports one conflict");
    check(Number((await q("SELECT COUNT(*) n FROM project_presentation_revisions WHERE project_id=101"))[0].n)===2,"CAS leaves exactly one immutable receipt per settings version");
    await q(runtime==='native'?"CREATE TRIGGER portal_injected_failure BEFORE UPDATE ON project_presentation_settings FOR EACH ROW BEGIN IF NEW.title='INJECTED_WRITE_FAILURE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic database write failure'; END IF; END":"CREATE TRIGGER portal_injected_failure BEFORE UPDATE ON project_presentation_settings WHEN NEW.title='INJECTED_WRITE_FAILURE' BEGIN SELECT RAISE(ABORT,'synthetic database write failure'); END");
    await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,version:2,mutationKey:randomUUID(),title:'INJECTED_WRITE_FAILURE'}),503,"database write failure is reported as unavailable, not a saved result or stale-version conflict");
    check((await getProjectPortal(viewer(2),101)).settings.version===2,"failed settings transaction preserves the saved head version");
    await q("DROP TRIGGER portal_injected_failure");


    await saveTeamPreparation(viewer(4),101,111,{version:0,mutationKey:randomUUID(),document:document('Private initial menu')});
    let listing=await listPortalTeams(viewer(6),101);check(listing.length===2&&listing.every(t=>!t.canRead&&!t.canEdit&&t.publicationVersion===0),"project-only members see team navigation metadata without private document/revision metadata");
    await denied(()=>getTeamPresentation(viewer(6),101,111),404,"unpublished preparation remains private to its team");
    const own=await getTeamPresentation(viewer(5),101,111);check(own.document?.entries[0].title==='Private initial menu'&&!own.team.canEdit&&!own.published,"same current team member retains existing private preparation read");
    const pub={version:0,mutationKey:randomUUID(),audience:'project' as const,preparationVersion:1};
    for(const who of [5,6,7,8,10])await denied(()=>saveTeamPublication(viewer(who),101,111,pub),404,`user${who} cannot publish without current own-team leader/admin authority`);
    await denied(()=>saveTeamPublication(viewer(3),101,111,pub),404,"cross-project admin cannot publish another project's team");
    await denied(()=>saveTeamPublication(viewer(4),102,111,pub),404,"mismatched project/team cannot publish");
    const published=await saveTeamPublication(viewer(4),101,111,pub);check(published.published&&published.sourceVersion===1,"canonical leader explicitly publishes immutable preparation version1");
    const shared=await getTeamPresentation(viewer(6),101,111);check(shared.document?.entries[0].title==='Private initial menu'&&shared.mealQuantities[shared.document.entries[0].id]===1800,"project members read explicit published meal snapshot with exact server quantity");
    check((await getTeamPresentation(viewer(8),101,111)).published,"project-bound guest can read published snapshot without write permission");
    listing=await listPortalTeams(viewer(6),101);check(listing.find(t=>t.id===111)?.canRead&&!listing.find(t=>t.id===112)?.canRead,"explicit publication changes only the selected team read scope");
    await denied(()=>getTeamPresentation(viewer(9),101,111),404,"project-public never means internet/outsider-readable");
    let oldPrivateDenied=false;try{await getTeamPreparation(viewer(6),101,111);}catch{oldPrivateDenied=true;}check(oldPrivateDenied,"existing private preparation endpoint does not inherit new project-public access");
    await saveTeamPreparation(viewer(4),101,111,{version:1,mutationKey:randomUUID(),document:document('Unpublished second menu')});
    check((await getTeamPresentation(viewer(6),101,111)).document?.entries[0].title==='Private initial menu',"later private draft edits do not auto-publish or leak into old public snapshot");
    check((await saveTeamPublication(viewer(4),101,111,pub)).sourceVersion===1,"same explicit publication replay remains idempotent after private draft changes");
    await denied(()=>saveTeamPublication(viewer(4),101,111,{...pub,version:1,mutationKey:randomUUID()}),409,"stale source-preparation version cannot be newly published");
    await saveTeamPublication(viewer(4),101,111,{version:1,mutationKey:randomUUID(),audience:'project',preparationVersion:2});
    check((await getTeamPresentation(viewer(6),101,111)).document?.entries[0].title==='Unpublished second menu',"newer snapshot becomes project-readable only after explicit republish");
    await saveTeamPublication(viewer(4),101,111,{version:2,mutationKey:randomUUID(),audience:'team_private',preparationVersion:2});
    await denied(()=>getTeamPresentation(viewer(6),101,111),404,"returning publication to team-private blocks next project-only read");
    check((await getTeamPresentation(viewer(5),101,111)).sourceVersion===2,"own-team readers retain current private content after unpublish");
    await q("UPDATE activity_team_members SET role='member' WHERE team_id=111 AND user_id=4");await q("UPDATE activity_team_members SET role='leader' WHERE team_id=111 AND user_id=11");await q("UPDATE activity_team_leaders SET user_id=11 WHERE team_id=111");
    await denied(()=>saveTeamPublication(viewer(4),101,111,{version:3,mutationKey:randomUUID(),audience:'project',preparationVersion:2}),404,"replaced leader loses publication authority immediately");
    check((await saveTeamPublication(viewer(11),101,111,{version:3,mutationKey:randomUUID(),audience:'project',preparationVersion:2})).published,"replacement canonical leader can publish");
    await q("UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=11");
    await denied(()=>saveTeamPublication(viewer(11),101,111,{version:4,mutationKey:randomUUID(),audience:'team_private',preparationVersion:2}),404,"project revocation blocks an existing leader's next publication request");
    await q("UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=6");await denied(()=>getTeamPresentation(viewer(6),101,111),404,"membership revocation blocks previously public snapshot re-request");
    await q("UPDATE users SET role='member' WHERE id=2");await denied(()=>saveProjectPortalSettings(viewer(2),101,{...settings,version:1,mutationKey:randomUUID()}),404,"current DB role downgrade overrides old admin session");await q("UPDATE users SET role='admin' WHERE id=2");
    const request=(route:string,input?:unknown,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000'+route,input===undefined?{}:{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
    const pc=()=>({params:Promise.resolve({projectId:'101'})}),tc=()=>({params:Promise.resolve({projectId:'101',teamId:'111'})});
    setSession(null);check((await portalGET(request('/api/projects/101/presentation'),pc())).status===401,"anonymous portal handler remains login-protected");
    setSession({user:{email:people[1][1],role:'admin',isSuperuser:false},expires:'2099-01-01T00:00:00.000Z'});
    const response=await portalGET(request('/api/projects/101/presentation'),pc());check(response.status===200&&response.headers.get('cache-control')==='private, no-store',"portal GET rechecks current scope and returns private/no-store");
    check((await portalPUT(request('/api/projects/101/presentation',{...settings,version:1,mutationKey:randomUUID()},'https://forged.example.test'),pc())).status===403,"cross-origin settings write is rejected");
    check((await portalPUT(request('/api/projects/101/presentation',{...settings,version:1,mutationKey:randomUUID(),isSuperuser:true}),pc())).status===400,"extra role-like request fields cannot affect authorization");
    check((await teamGET(request('/api/projects/101/presentation/teams/111'),tc())).status===200,"team GET handler can read explicit publication under current admin scope");
    check((await teamPUT(request('/api/projects/101/presentation/teams/111',{version:4,mutationKey:randomUUID(),audience:'team_private',preparationVersion:2}),tc())).status===200,"same-origin publication handler persists the current scoped admin change");
    const badBody=new Request('http://127.0.0.1:3000/api/projects/101/presentation',{method:'PUT',headers:{Origin:'http://127.0.0.1:3000','Content-Type':'application/json'},body:'x'.repeat(13*1024)});
    check((await portalPUT(badBody,pc())).status===413,"streamed settings body size is bounded even without trusted Content-Length");
    check((await portalGET(request('/api/projects/101/presentation'),{params:Promise.resolve({projectId:'101x'})})).status===404,"malformed direct project id cannot be coerced to another resource");
    await assert.rejects(q("INSERT INTO team_presentation_publications(team_id,project_id,audience,preparation_version,version,updated_by,updated_at,mutation_key,request_hash) VALUES(211,101,'team_private',NULL,1,4,?,?,?)",[new Date().toISOString(),randomUUID(),'a'.repeat(64)]));
    check(true,"composite project/team FK rejects cross-project publication metadata independently of HTTP guards");

    check(JSON.stringify(await q("SELECT * FROM submissions"))===preserved,"pre-existing private WBS submission content and visibility remain byte-for-byte unchanged");
    check((await q("SELECT role FROM users WHERE id=1"))[0].role==='guest'&&Number((await q("SELECT COUNT(*) n FROM project_members WHERE user_id=1"))[0].n)===0,"env SU test identity remains guest/unassigned without data privilege migration");

    const originalPreparationRevisions=JSON.stringify(await q("SELECT * FROM team_preparation_revisions WHERE team_id=111 AND version<=2 ORDER BY version"));
    const preparationContext=()=>({params:Promise.resolve({projectId:'101',teamId:'111'})});
    const prepRoute='/api/projects/101/teams/111/preparation', presentationRoute='/api/projects/101/presentation/teams/111';
    const minimalEntry={id:randomUUID(),date:'2026-10-27',title:'날짜와 메뉴만 있는 합성 식단'};
    const sparse={schemaVersion:1,kind:'meal',entries:[minimalEntry]};
    const sparseInput={version:2,mutationKey:randomUUID(),document:sparse};
    const minimalResponse=await preparationPUT(request(prepRoute,sparseInput),preparationContext());
    const minimalBody=await minimalResponse.json();
    check(minimalResponse.status===200&&minimalBody.sheet.version===3,"scoped administrator saves meal date/menu with all optional fields omitted through JSON handler");
    check(JSON.stringify(minimalBody.sheet.document.entries[0])===JSON.stringify({id:minimalEntry.id,date:minimalEntry.date,title:minimalEntry.title,notes:'',status:'planned',checks:[],meal:null,expectedPeople:null,amountPerPerson:null,unit:''}),"minimal saved meal has canonical null quantity fields and planned status without fake defaults");
    check(Object.keys(minimalBody.sheet.mealQuantities).length===0,"incomplete meal omits derived quantity rather than reporting a misleading zero");
    const minimalFresh=await preparationGET(request(prepRoute),preparationContext());
    const minimalFreshBody=await minimalFresh.json();
    check(minimalFresh.status===200&&JSON.stringify(minimalFreshBody.sheet.document)===JSON.stringify(minimalBody.sheet.document),"minimal meal persists across fresh authenticated GET and history read");
    const beforeReplay=Number((await q("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=111"))[0].n);
    check((await preparationPUT(request(prepRoute,sparseInput),preparationContext())).status===200&&Number((await q("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=111"))[0].n)===beforeReplay,"minimal input replay preserves existing CAS receipt without duplicate revisions");
    check((await preparationPUT(request(prepRoute,{...sparseInput,mutationKey:randomUUID()}),preparationContext())).status===409,"minimal meal cannot bypass stale-version CAS");
    const minimalPublish={version:5,mutationKey:randomUUID(),audience:'project',preparationVersion:3};
    check((await teamPUT(request(presentationRoute,minimalPublish),tc())).status===200,"explicit publication accepts a saved meal with missing optional quantities");
    const sharedMinimal=await getTeamPresentation(viewer(8),101,111);
    check(sharedMinimal.sourceVersion===3&&sharedMinimal.document?.entries[0].title===minimalEntry.title&&Object.keys(sharedMinimal.mealQuantities).length===0,"project member reads immutable minimal meal snapshot with unspecified quantity");
    await denied(()=>getTeamPresentation(viewer(9),101,111),404,"minimal publication never expands outsider access");
    const blankInput={version:3,mutationKey:randomUUID(),document:{schemaVersion:1,kind:'meal',entries:[{...minimalEntry,title:'수량 없는 합성 변경',meal:'',expectedPeople:'',amountPerPerson:null,unit:'',notes:'',checks:[{label:' ',done:false},{label:' 쌀 ',done:true}]}]}};
    const blankResponse=await preparationPUT(request(prepRoute,blankInput),preparationContext());const blankBody=await blankResponse.json();
    check(blankResponse.status===200&&blankBody.sheet.version===4&&blankBody.sheet.document.entries[0].checks.length===1&&blankBody.sheet.document.entries[0].checks[0].label==='쌀',"empty optional fields and blank shopping rows save without discarding valid checklist rows");
    check((await getTeamPresentation(viewer(8),101,111)).document?.entries[0].title===minimalEntry.title,"new nullable private edits do not automatically replace the published snapshot");
    check((await teamPUT(request(presentationRoute,{...minimalPublish,version:6,mutationKey:randomUUID()}),tc())).status===409,"stale selected preparation version still cannot be republished after optional-field edits");
    check((await teamPUT(request(presentationRoute,{...minimalPublish,version:6,preparationVersion:4,mutationKey:randomUUID()}),tc())).status===200,"explicit republish selects the new immutable optional-field preparation revision");
    const invalidBefore=JSON.stringify(await q("SELECT * FROM team_preparation_sheets WHERE team_id=111"));
    for(const patch of [{date:''},{title:' '},{status:''},{status:null},{status:'invalid'},{expectedPeople:'12'},{expectedPeople:-1},{amountPerPerson:'1.5'},{amountPerPerson:0.0001},{unit:20},{checks:[{label:'',done:'false'}]},{extra:'unknown'}]){
      const invalidInput={version:4,mutationKey:randomUUID(),document:{schemaVersion:1,kind:'meal',entries:[{...minimalEntry,...patch}]}};
      check((await preparationPUT(request(prepRoute,invalidInput),preparationContext())).status===400,"optional meal expansion preserves provided type/bounds, status, date/title and unknown-key validation");
    }
    check(JSON.stringify(await q("SELECT * FROM team_preparation_sheets WHERE team_id=111"))===invalidBefore,"rejected optional-field requests preserve saved head/version");
    check(JSON.stringify(await q("SELECT * FROM team_preparation_revisions WHERE team_id=111 AND version<=2 ORDER BY version"))===originalPreparationRevisions,"legacy complete preparation revision bytes remain unchanged after sparse meal saves/publication");
  };
  if(runtime==='native')await execute();else await runWithHostedBindings({DB:db} as unknown as Parameters<typeof runWithHostedBindings>[0],execute);
  await mkdir('.test-artifacts/project-presentation',{recursive:true});await writeFile(`.test-artifacts/project-presentation/${runtime}-result.json`,JSON.stringify({complete:true,runtime,checks,assertions:labels,nativeExecuted:runtime==='native',nativeServerVersion,nativeLimitation:runtime==='native'?null:'D1-only execution; separate Native result required.',syntheticSchemasRetained:runtime==='native'?[database,upgradeDatabase]:[],productionAccess:false,browserExecuted:false},null,2));
  console.log(`PASS ${checks} ${runtime} source/handler checks; real browser is a separate gate.`);
} finally {setSession(null);if(native){const {closeDatabasePool}=await import('../src/shared/server/database/index.server');await closeDatabasePool();await native.end();}if(mf)await mf.dispose();}
