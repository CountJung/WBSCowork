/** Project scope regression: isolated D1 and retained new loopback MariaDB only. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {Miniflare} from "miniflare";
import {createConnection,createPool,type Pool} from "mariadb";
import type {D1Database} from "@cloudflare/workers-types";
import {runWithHostedBindings} from "../src/shared/server/hosted-runtime/index.server";
import {getDatabasePool} from "../src/shared/server/database/index.server";
import {runNativeMigrations} from "../src/shared/server/database-admin/native-migrations.server";
import {testDatabaseEnv,assertTestDatabaseName,TEST_SUPERUSER_EMAIL} from "../tests/helpers/test-env";
import {listAllProjectsForViewer,getProjectCountForViewer,getProjectByIdForViewer,previewProjectAccess,changeProjectWorkspace,listManagedProjectsForViewer,assertProjectManagement,createProject,updateProject,deleteProject} from "../src/entities/project/index.server";
import {getTaskByIdForViewer,listTasksByProjectForViewer,listTaskEventsByProjectForViewer,getDependencySnapshotForViewer,createTask,changeTaskStatus,listPersonalWorkPage,searchWork,applyTaskTemplate} from "../src/entities/task/index.server";
import {parseWorkSearchFilters} from "../src/entities/task";
import {getSubmissionByIdForViewer,listSubmissionsByProject,getSubmissionRevisionForViewer,listSubmissionEventsForViewer,getSubmissionAttachmentForViewer,listAttachmentsByProject,createSubmission,updateSubmission,deleteSubmission,requestSubmissionReview,decideSubmissionReview} from "../src/entities/submission/index.server";
import {listCommentsByProject,countCommentsBySubmissionRevision,getCommentForViewer,createComment,updateComment,deleteComment} from "../src/entities/comment/index.server";
import {listNotifications,markNotificationRead} from "../src/entities/notification/index.server";
let checks=0;
function check(ok:unknown,label:string){assert.ok(ok,label);checks++;console.log(`PASS ${label}`);}
const viewer=(userId:number,isSuperuser=false)=>({userId,isSuperuser});
const filter=(userId:number,canSeeAll=false)=>({viewerUserId:userId,canSeeAll});
const actor=(userId:number,isSuperuser=false)=>({userId,isSuperuser,isAdmin:userId===3});
type UpgradeQuery=(sql:string,params?:unknown[])=>Promise<Record<string,unknown>[]>;
async function seedUpgrade(query:UpgradeQuery){
  await query("INSERT INTO users(id,email,name,role) VALUES(1,'upgrade-admin@example.test','Synthetic admin','admin'),(2,'upgrade-member@example.test','Synthetic member','member')");
  await query("INSERT INTO projects(id,name,start_date,end_date,workspace_version) VALUES(5,'Synthetic populated v11','2026-01-01','2026-12-31',9)");
  await query("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id) VALUES(7,5,'Synthetic preserved task','2026-01-01','2026-12-31',2)");
  await query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(5,7,2,'Synthetic private preserved bytes','private')");
  await query("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(5,1,2,'Synthetic private preserved bytes','private')");
  await query("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(7,5,1,'synthetic-upgrade/bytes-preserved.txt','synthetic.txt','text/plain',25180)");
  await query('INSERT INTO project_members(project_id,user_id,active) VALUES(5,1,1),(5,2,0)');
  await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1,5,'other','Synthetic preserved team')");
  await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(5,1,1,'leader',1)");
  await query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1,5,1)');
}
async function upgradeSnapshot(query:UpgradeQuery){
  const values=[];
  for(const sql of ['SELECT id,email,name,role FROM users ORDER BY id','SELECT id,name,project_type,workspace_version,workspace_token FROM projects ORDER BY id','SELECT * FROM tasks ORDER BY id','SELECT * FROM submissions ORDER BY id','SELECT * FROM submission_revisions ORDER BY id','SELECT * FROM submission_attachments ORDER BY id','SELECT * FROM project_members ORDER BY project_id,user_id','SELECT * FROM activity_teams ORDER BY id','SELECT * FROM activity_team_members ORDER BY team_id,user_id','SELECT * FROM activity_team_leaders ORDER BY team_id'])values.push(await query(sql));
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
async function verifyUpgrade(query:UpgradeQuery,before:string,mode:string){
  check(await upgradeSnapshot(query)===before,`${mode} additive v12 preserves account roles, member/team bindings, task and private file metadata bytes`);
  const row=(await query('SELECT access_mode FROM projects WHERE id=5'))[0];
  check(row.access_mode==='legacy_authenticated',`${mode} populated existing project explicitly defaults to legacy access`);
  await assert.rejects(query("UPDATE projects SET access_mode='invalid_policy' WHERE id=5"));checks++;
}
async function verify(mode:"D1"|"MariaDB"){
  const db=getDatabasePool();
  for(const [id,role] of [[1,'member'],[2,'member'],[3,'admin'],[4,'guest'],[5,'guest'],[6,'member'],[7,'member']] as const)await db.query('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)',[id,id===5?TEST_SUPERUSER_EMAIL:`binding${id}@example.test`,`Synthetic binding ${id}`,role]);
  for(const id of [1,2,3,4])await db.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(?,?,'2026-01-01','2026-12-31')",[id,`Binding project ${id}`]);
  const initial=await previewProjectAccess(2,viewer(5,true));
  check(initial.accessMode==='legacy_authenticated'&&initial.activeMemberCount===0&&initial.canRestrict,`${mode} preview never guesses members or activates a restriction`);
  check((await listAllProjectsForViewer(viewer(2))).length===4,`${mode} every legacy project retains its previous authenticated visibility`);
  await assert.rejects(previewProjectAccess(2,viewer(3)));checks++;
  await assert.rejects(changeProjectWorkspace({projectId:2,version:initial.version,actor:viewer(3),token:randomUUID(),command:{kind:'project_member',userId:3,active:true}}));checks++;
  await assert.rejects(changeProjectWorkspace({projectId:2,version:initial.version,actor:viewer(5,true),token:randomUUID(),command:{kind:'access_mode',accessMode:'members_only',confirmImpact:false,impactHash:initial.impactHash}}));checks++;
  await assert.rejects(changeProjectWorkspace({projectId:2,version:initial.version,actor:viewer(5,true),token:randomUUID(),command:{kind:'access_mode',accessMode:'members_only',confirmImpact:true,impactHash:'0'.repeat(64)}}));checks++;
  // Explicit local fixtures never infer any operating membership.
  await db.query('INSERT INTO project_members(project_id,user_id) VALUES(2,1),(2,3),(2,4),(2,6),(2,7),(3,7)');
  for(const projectId of [2,3]){
    const preview=await previewProjectAccess(projectId,viewer(5,true));
    const input={projectId,version:preview.version,actor:viewer(5,true),token:randomUUID(),command:{kind:'access_mode' as const,accessMode:'members_only' as const,confirmImpact:true,impactHash:preview.impactHash}};
    check(!(await changeProjectWorkspace(input)).replayed&&(await changeProjectWorkspace(input)).replayed,`${mode} SU explicit restriction uses an idempotent confirmed preview`);
  }
  check((await db.query('SELECT COUNT(*) AS n FROM project_members') as {n:number}[])[0].n===6,`${mode} restriction never adds inferred project assignments`);
  await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id,deliverable,definition_of_done) VALUES(1,1,'Legacy readable','2026-01-01','2026-12-31',2,'output','check'),(2,2,'Restricted secret title','2026-01-01','2026-12-31',1,'output','check'),(3,2,'Restricted predecessor','2026-01-01','2026-12-31',7,'output','check')");
  await db.query("INSERT INTO task_events(id,task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,task_version) VALUES(20,2,7,'binding-assignment','synthetic','created','planned',1,1)");
  await db.query('INSERT INTO task_dependencies(project_id,task_id,predecessor_id) VALUES(2,2,3)');
  for(const [id,taskId,authorId,visibility] of [[1,1,2,'public'],[2,2,7,'public'],[3,2,7,'private'],[4,2,1,'private'],[5,1,7,'private']] as const){
    await db.query('INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(?,?,?,?,?)',[id,taskId,authorId,`Synthetic restricted body ${id}`,visibility]);
    await db.query('INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(?,1,?,?,?)',[id,authorId,`Synthetic restricted body ${id}`,visibility]);
    await db.query("INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind) VALUES(?,1,?,?,'synthetic','created')",[id,authorId,`binding-submission-${id}`]);
  }
  await db.query("INSERT INTO comments(id,submission_id,revision_number,author_id,content) VALUES(1,2,1,7,'Restricted feedback'),(2,4,1,7,'Private feedback')");
  await db.query("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(1,2,1,'binding/synthetic.txt','synthetic.txt','text/plain',9)");
  check((await listAllProjectsForViewer(viewer(2))).map(p=>p.id).join(',')==='4,1',`${mode} outsider project list is filtered before selection`);
  check(await getProjectCountForViewer(viewer(2))===2&&await getProjectByIdForViewer(2,viewer(2))===null,`${mode} outsider count and direct project read agree`);
  check((await listAllProjectsForViewer(viewer(7))).length===4,`${mode} explicit membership supports multiple projects`);
  check((await listAllProjectsForViewer(viewer(3))).length===3,`${mode} admin reads only assigned restricted projects and legacy projects`);
  check((await listAllProjectsForViewer(viewer(5,true))).length===4,`${mode} verified SU retains global project access`);
  check((await listManagedProjectsForViewer(viewer(3))).map(p=>p.id).join(',')==='2',`${mode} admin manages only its explicit assignment`);
  await assert.rejects(assertProjectManagement(1,viewer(3)));checks++;
  await assert.rejects(createProject({name:'Denied admin project',startDate:'2026-01-01',endDate:'2026-12-31',actor:viewer(3)}));checks++;
  const metadata={id:2,name:'Updated restricted project',startDate:'2026-01-01',endDate:'2026-12-31',actor:viewer(3)};
  await updateProject(metadata);await updateProject(metadata);checks++;
  await assert.rejects(updateProject({...metadata,id:1}));checks++;
  await assert.rejects(deleteProject(4,viewer(3)));checks++;
  check(await getSubmissionByIdForViewer(5,filter(3,true))===null&&Boolean(await getSubmissionByIdForViewer(1,filter(3,true))),`${mode} unassigned admin keeps legacy public reads but loses others' private override`);
  check((await listAllProjectsForViewer(viewer(2,true))).length===2,`${mode} a false SU flag grants no protected project access`);
  check(await getTaskByIdForViewer(2,viewer(2))===null&&(await listTasksByProjectForViewer(2,viewer(2))).length===0,`${mode} protected task IDs and list metadata are hidden`);
  check((await listTaskEventsByProjectForViewer(2,viewer(2))).length===0,`${mode} task event metadata is scoped`);
  await assert.rejects(getDependencySnapshotForViewer(2,viewer(2)));checks++;
  check((await getDependencySnapshotForViewer(2,viewer(1))).edges.length===1,`${mode} a member retains its project dependency graph`);
  for(const id of [2,3,4])check(await getSubmissionByIdForViewer(id,filter(2))===null,`${mode} outsider cannot read protected public/private submission ${id}`);
  check((await listSubmissionsByProject(2,filter(2))).length===0,`${mode} public submission lists intersect project access`);
  check(Boolean(await getSubmissionByIdForViewer(2,filter(4)))&&await getSubmissionByIdForViewer(3,filter(4))===null,`${mode} bound guest can read public but not another author's private data`);
  check(await getSubmissionByIdForViewer(3,filter(6,true))===null,`${mode} a stale administrator flag does not expose protected private content`);
  check(Boolean(await getSubmissionByIdForViewer(3,filter(3,true)))&&Boolean(await getSubmissionByIdForViewer(3,filter(5,true))),`${mode} current admin and SU private visibility remain intact`);
  check(await getSubmissionRevisionForViewer(2,1,filter(2))===null&&(await listSubmissionEventsForViewer(2,filter(2))).length===0,`${mode} version body and event history are scoped`);
  check(await getSubmissionAttachmentForViewer(1,filter(2))===null&&(await listAttachmentsByProject(2,{ids:[2]},filter(2))).length===0,`${mode} guessed attachment ID and stale parent ID reveal no metadata`);
  check((await listCommentsByProject(2,{ids:[2,4]},filter(2))).length===0&&await getCommentForViewer(1,filter(2))===null&&await countCommentsBySubmissionRevision(2,1,filter(2))===0,`${mode} comment body, direct ID and count share the same project gate`);
  const search=await searchWork({viewerUserId:2,isSuperuser:false},parseWorkSearchFilters({q:'Restricted',projectId:'2'}));
  check(search.total===0&&search.items.length===0,`${mode} search count/snippet includes no protected project`);
  check((await listPersonalWorkPage({viewerUserId:1,isSuperuser:false},{scope:'mine',status:'all',overdue:false,page:1})).items.some(t=>t.projectId===2),`${mode} bound assignee retains its personal queue`);
  check((await listNotifications(viewer(1),{scope:'all',page:1})).items.some(n=>n.projectId===2),`${mode} member receives its authorized project notification`);
  await assert.rejects(createTask({projectId:2,title:'Unauthorized',startDate:'2026-01-01',endDate:'2026-12-31',actor:actor(2),token:randomUUID()}));checks++;
  await assert.rejects(createTask({projectId:2,title:'Missing actor',startDate:'2026-01-01',endDate:'2026-12-31'}));checks++;
  await assert.rejects(createSubmission({taskId:2,authorId:2,actor:actor(2),token:randomUUID(),content:'Unauthorized'}));checks++;
  await assert.rejects(createComment({submissionId:2,authorId:2,actor:viewer(2),revisionNumber:1,content:'Unauthorized'}));checks++;
  await assert.rejects(createComment({submissionId:2,authorId:4,actor:viewer(4),revisionNumber:1,content:'Guest denied'}));checks++;
  await assert.rejects(updateComment({id:1,actor:viewer(6),content:'Stale admin denied'}));checks++;
  await assert.rejects(deleteComment(1,viewer(6)));checks++;
  const templateNode={key:'topic',parentKey:null,title:'Synthetic scope template',description:'',deliverable:'output',definitionOfDone:'check',startDate:'2026-01-01',endDate:'2026-12-31',assigneeId:2};
  await assert.rejects(applyTaskTemplate({projectId:2,templateKey:'research',templateVersion:1,nodes:[templateNode],actor:actor(3),token:randomUUID()}));checks++;
  check(!(await db.query("SELECT id FROM tasks WHERE title='Synthetic scope template'") as unknown[]).length,`${mode} a template cannot assign a nonmember on a restricted collaboration project`);
  const added=await createComment({submissionId:2,authorId:1,actor:viewer(1),revisionNumber:1,content:'Allowed member comment'});
  check(added.authorId===1,`${mode} a bound writable member can comment`);
  const emptyProject=await createProject({name:'Synthetic SU-only creation',startDate:'2026-01-01',endDate:'2026-12-31',actor:viewer(5,true)});
  check((await db.query('SELECT user_id FROM project_members WHERE project_id=?',[emptyProject.id]) as unknown[]).length===0,`${mode} SU project creation does not silently assign any account`);
  const emptyPreview=await previewProjectAccess(emptyProject.id,viewer(5,true));
  check(emptyPreview.canRestrict&&emptyPreview.warnings.length>0,`${mode} an empty roster is an explicit warning, not inferred membership`);
  const failTrigger=mode==='D1'?"CREATE TRIGGER binding_access_fault BEFORE INSERT ON project_workspace_events WHEN NEW.project_id="+emptyProject.id+" AND NEW.kind='access_mode' BEGIN SELECT RAISE(ABORT,'synthetic binding event fault'); END":"CREATE TRIGGER binding_access_fault BEFORE INSERT ON project_workspace_events FOR EACH ROW BEGIN IF NEW.project_id="+emptyProject.id+" AND NEW.kind='access_mode' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic binding event fault'; END IF; END";
  await db.query(failTrigger);
  const activation={projectId:emptyProject.id,version:emptyPreview.version,actor:viewer(5,true),token:randomUUID(),command:{kind:'access_mode' as const,accessMode:'members_only' as const,confirmImpact:true,impactHash:emptyPreview.impactHash}};
  await assert.rejects(changeProjectWorkspace(activation));checks++;
  const afterFault=await previewProjectAccess(emptyProject.id,viewer(5,true));
  check(afterFault.accessMode==='legacy_authenticated'&&afterFault.version===emptyPreview.version,`${mode} a failed access event rolls back both restriction and workspace CAS`);
  await db.query('DROP TRIGGER binding_access_fault');
  await changeProjectWorkspace(activation);
  check(await getProjectByIdForViewer(emptyProject.id,viewer(3))===null,`${mode} unassigned admin cannot read an empty restricted project`);
  const blockedPreview=await previewProjectAccess(1,viewer(5,true));
  check(!blockedPreview.canRestrict&&blockedPreview.unboundOpenTaskCount===1,`${mode} unfinished unbound assignee blocks restricted activation`);
  await assert.rejects(changeProjectWorkspace({projectId:1,version:blockedPreview.version,actor:viewer(5,true),token:randomUUID(),command:{kind:'access_mode',accessMode:'members_only',confirmImpact:true,impactHash:blockedPreview.impactHash}}));checks++;
  const version=(await previewProjectAccess(2,viewer(5,true))).version;
  await assert.rejects(changeProjectWorkspace({projectId:2,version,actor:viewer(5,true),token:randomUUID(),command:{kind:'project_member',userId:1,active:false}}));checks++;
  await db.query("UPDATE tasks SET status='done' WHERE id=3");
  await changeProjectWorkspace({projectId:2,version,actor:viewer(5,true),token:randomUUID(),command:{kind:'project_member',userId:7,active:false}});
  check(Number((await db.query('SELECT active FROM project_members WHERE project_id=2 AND user_id=7') as {active:number}[])[0].active)===0,`${mode} completed task history survives an explicit membership removal`);
  await db.query('UPDATE project_members SET active=1 WHERE project_id=2 AND user_id=7');
  // Simulate a previously authorized session after a local-only membership revocation.
  await db.query('UPDATE project_members SET active=0 WHERE project_id=2 AND user_id=1');
  check(await getSubmissionByIdForViewer(4,filter(1))===null,`${mode} a departed author loses protected reads while its private record remains stored`);
  check(!(await listPersonalWorkPage({viewerUserId:1,isSuperuser:false},{scope:'mine',status:'all',overdue:false,page:1})).items.some(t=>t.projectId===2),`${mode} departed user's personal queue hides the project`);
  check(!(await listNotifications(viewer(1),{scope:'all',page:1})).items.some(n=>n.projectId===2),`${mode} departed user's notifications hide the project`);
  await markNotificationRead(viewer(1),'task',20);
  check(Number((await db.query("SELECT COUNT(*) AS n FROM notification_reads WHERE recipient_id=1 AND source_kind='task' AND source_id=20") as {n:number}[])[0].n)===0,`${mode} guessed obsolete notification cannot add a read receipt`);
  await assert.rejects(changeTaskStatus({id:2,version:1,actor:actor(1),token:randomUUID(),status:'blocked',note:'Old open form'}));checks++;
  await assert.rejects(updateSubmission({id:4,expectedRevision:1,actor:actor(1),token:randomUUID(),content:'Old open edit'}));checks++;
  await assert.rejects(deleteSubmission(4,actor(1)));checks++;
  await assert.rejects(updateComment({id:added.id,actor:viewer(1),content:'Old open comment edit'}));checks++;
  await assert.rejects(deleteComment(added.id,viewer(1)));checks++;
  await db.query('INSERT INTO project_members(project_id,user_id) VALUES(1,3)');
  await db.query('UPDATE tasks SET reviewer_id=3,review_required=1 WHERE id=1');
  await requestSubmissionReview({taskId:1,submissionId:1,revisionNumber:1,expectedTaskVersion:1,actor:actor(2),token:randomUUID()});
  const review={taskId:1,submissionId:1,revisionNumber:1,expectedTaskVersion:2,actor:actor(3),token:randomUUID(),decision:'approved' as const,reason:'Synthetic review'};
  await decideSubmissionReview(review);await decideSubmissionReview(review);checks++;
  await db.query('UPDATE project_members SET active=0 WHERE project_id=1 AND user_id=3');
  await assert.rejects(decideSubmissionReview(review));checks++;
  check(Boolean(await getSubmissionByIdForViewer(1,filter(3,true))),`${mode} revoked admin may read a legacy public result but cannot replay a review mutation`);
  check((await db.query('SELECT content,visibility FROM submissions WHERE id=4') as {content:string;visibility:string}[])[0].content==='Synthetic restricted body 4',`${mode} rejected old forms preserve the original private record`);
}
if(!process.argv.includes('--maria')){
  const mf=new Miniflare({host:'127.0.0.1',cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'project-binding-test',UPGRADE:'project-binding-upgrade-test'}});
  try{
    const upgradeDb=await mf.getD1Database('UPGRADE');
    const query:UpgradeQuery=async(sql,params=[])=>{const result=await upgradeDb.prepare(sql).bind(...params).all<Record<string,unknown>>();return result.results;};
    const files=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
    for(const file of files.filter(f=>!f.startsWith('0016_')))for(const sql of(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await upgradeDb.prepare(sql).run();
    await seedUpgrade(query);const before=await upgradeSnapshot(query);
    const upgradeSql=(await readFile('drizzle/0016_project_access_mode.sql','utf8')).trim();
    await upgradeDb.prepare(upgradeSql).run();await verifyUpgrade(query,before,'D1');
    await assert.rejects(upgradeDb.prepare(upgradeSql).run());checks++;
    check(await upgradeSnapshot(query)===before,'D1 duplicate DDL fails closed without changing any preserved row; managed migration must skip applied 0016');
    const DB=await mf.getD1Database('DB') as unknown as D1Database;for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await DB.prepare(sql).run();await runWithHostedBindings({DB},()=>verify('D1'));}finally{await mf.dispose();}
}
if(!process.argv.includes('--d1')){
  if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires isolated loopback MariaDB:3307.');
  const database=`wbs_binding_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(database);
  const options={host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true,insertIdAsNumber:true};
  const connection=await createConnection(options),globalDb=globalThis as typeof globalThis&{__wbsMariaDbPool?:Pool};
  try{await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${database}\``);await assert.rejects(runNativeMigrations({query:async(sql,params)=>{if(sql.includes('ADD COLUMN access_mode '))throw new Error('synthetic pre-v12 boundary');return connection.query(sql,params);}},database),/synthetic pre-v12/);
    const query:UpgradeQuery=(sql,params=[])=>connection.query(sql,params);
    await seedUpgrade(query);const before=await upgradeSnapshot(query);
    await runNativeMigrations(connection,database);await verifyUpgrade(query,before,'MariaDB');
    const ledger=JSON.stringify(await connection.query('SELECT * FROM schema_migrations ORDER BY version'));
    await runNativeMigrations(connection,database);
    check(JSON.stringify(await connection.query('SELECT * FROM schema_migrations ORDER BY version'))===ledger&&await upgradeSnapshot(query)===before,'MariaDB v12 rerun verifies existing schema and preserves rows and migration ledger');
    // Use a separate retained fresh database for repository fixtures.
    const freshDatabase=database.replace('_test','_fresh_test');assertTestDatabaseName(freshDatabase);
    await connection.query(`CREATE DATABASE \`${freshDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${freshDatabase}\``);await runNativeMigrations(connection,freshDatabase);
    globalDb.__wbsMariaDbPool=createPool({...options,database:freshDatabase,insertIdAsNumber:true,bigIntAsNumber:true,connectionLimit:5});await verify('MariaDB');console.log(`Retained synthetic ${database} and ${freshDatabase}`);}finally{await globalDb.__wbsMariaDbPool?.end();globalDb.__wbsMariaDbPool=undefined;await connection.end();}
}
console.log(`Project binding contracts passed: ${checks}`);
