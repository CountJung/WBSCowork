/** Effective SU and new-assignment exclusion; isolated synthetic D1/MariaDB only. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {Miniflare} from "miniflare";
import {createConnection,createPool,type Pool} from "mariadb";
import type {D1Database} from "@cloudflare/workers-types";
import {runWithHostedBindings} from "../src/shared/server/hosted-runtime/index.server";
import {getDatabasePool} from "../src/shared/server/database/index.server";
import {runNativeMigrations} from "../src/shared/server/database-admin/native-migrations.server";
import {TEST_SUPERUSER_EMAIL,testDatabaseEnv,assertTestDatabaseName} from "../tests/helpers/test-env";
import {getUserById,listAllUsers,listProjectUsersForViewer,listUserNames,updateUserRole} from "../src/entities/user/index.server";
import {getProjectWorkspace,changeProjectWorkspace,getProjectTaskTeams} from "../src/entities/project/index.server";
import {getTaskScope,createTask,updateTask,getTaskById,changeTaskStatus,listTaskEvents,applyTaskTemplate} from "../src/entities/task/index.server";
import {templatePreview,taskTemplates} from "../src/entities/task";
import {getSubmissionByIdForViewer,getSubmissionRevisionForViewer} from "../src/entities/submission/index.server";
import {createComment,updateComment,getCommentForViewer} from "../src/entities/comment/index.server";
import type {WorkspaceCommand} from "../src/entities/project";
const su={userId:1,isSuperuser:true,isAdmin:true};
const dates={startDate:"2026-01-01",endDate:"2026-12-31"};let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;console.log("PASS "+label);}
async function reject(action:()=>Promise<unknown>,label:string){await assert.rejects(action);checks++;console.log("PASS denied "+label);}
async function verify(mode:string){
 const db=getDatabasePool();
 for(const [id,email,role]of [[1,TEST_SUPERUSER_EMAIL,"guest"],[2,"member@example.test","member"],[3,"admin@example.test","admin"]])await db.query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)",[id,email,`Synthetic ${id}`,role]);
 await db.query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(1,'Protected volunteer','volunteering','members_only','2026-01-01','2026-12-31'),(2,'Legacy collaboration','collaboration','legacy_authenticated','2026-01-01','2026-12-31')");
 check((await getUserById(1))?.role==='admin'&&(await getUserById(1))?.isSuperuser,`${mode} stored guest SU has stable effective admin identity`);
 check((await getTaskScope(1,su)).canManageAll,`${mode} unbound stored guest SU has project management authority`);
 check((await listAllUsers()).some(u=>Number(u.id)===1&&u.isSuperuser)&&(await listUserNames()).some(u=>Number(u.id)===1),`${mode} SU remains visible in management and historical author lookup`);
 await reject(()=>updateUserRole(1,'guest',{...su,email:TEST_SUPERUSER_EMAIL}),`${mode} global role API cannot downgrade configured SU`);
 const command=async(value:WorkspaceCommand)=>changeProjectWorkspace({projectId:1,actor:su,version:(await getProjectWorkspace(1,su)).version,token:randomUUID(),command:value});
 await reject(()=>command({kind:'project_member',userId:1,active:true}),`${mode} new project member assignment cannot target SU`);
 await command({kind:'project_member',userId:2,active:true});
 await command({kind:'create_team',activityKind:'meal',name:'Synthetic team'});
 const team=(await getProjectWorkspace(1,su)).teams[0];
 await command({kind:'team_member',teamId:team.id,userId:2,role:'leader',active:true});
 // A legacy SU membership/leader row is retained for compatibility checks, not granted by the app.
 await db.query("INSERT INTO project_members(project_id,user_id,active) VALUES(1,1,1)");
 await reject(()=>command({kind:'team_member',teamId:team.id,userId:1,role:'leader',active:true}),`${mode} new team leader assignment cannot target SU`);
 await reject(()=>command({kind:'team_member',teamId:team.id,userId:1,role:'member',active:true}),`${mode} new ordinary team assignment cannot target SU`);
 const directory=await getProjectTaskTeams(1,su);
 check(!directory.projectMemberIds?.includes(1)&&!Object.values(directory.memberIdsByTeam).flat().includes(1)&&!(await listProjectUsersForViewer(1,su)).some(u=>Number(u.id)===1),`${mode} every new-assignment directory excludes SU`);
 for(const projectId of [1,2])await reject(()=>createTask({projectId,title:'Forged new SU assignment',...dates,assigneeId:1,activityTeamId:projectId===1?team.id:null,actor:su,token:randomUUID()}),`${mode} project${projectId} new task cannot assign SU`);
 const template=taskTemplates[0],nodes=templatePreview(template,dates.startDate);
 await reject(()=>applyTaskTemplate({projectId:2,templateKey:template.key,templateVersion:template.version,nodes:nodes.map((node,index)=>({...node,assigneeId:index===0?1:null})),actor:su,token:randomUUID()}),`${mode} a forged template assignee cannot target SU`);
 const templateResult=await applyTaskTemplate({projectId:2,templateKey:template.key,templateVersion:template.version,nodes,actor:su,token:randomUUID()});
 check(templateResult.taskIds.length===nodes.length,`${mode} stored guest SU can still apply an unassigned template`);
 const task=await createTask({projectId:1,title:'Synthetic normal task',...dates,assigneeId:2,activityTeamId:team.id,definitionOfDone:'Criteria',actor:su,token:randomUUID()});
 await reject(()=>updateTask({id:task.id,title:task.title,...dates,assigneeId:1,actor:su,version:task.version,token:randomUUID()}),`${mode} task reassignment cannot target SU`);
 await reject(()=>updateTask({id:task.id,title:task.title,...dates,reviewerId:1,actor:su,version:task.version,token:randomUUID()}),`${mode} reviewer assignment cannot target SU`);
 await db.query("UPDATE tasks SET assignee_id=1 WHERE id=?",[task.id]);
 let retained=(await getTaskById(task.id))!;
 await updateTask({id:retained.id,title:'Legacy SU assignment retained',...dates,activityTeamId:team.id,assigneeId:1,actor:su,version:retained.version,token:randomUUID()});
 retained=(await getTaskById(task.id))!;
 check(retained.assigneeId===1,`${mode} unchanged legacy SU assignment survives metadata edit`);
 await changeTaskStatus({id:retained.id,status:'done',note:'',actor:su,version:retained.version,token:randomUUID()});
 retained=(await getTaskById(task.id))!;
 check(retained.status==='done'&&retained.completedBy===1&&retained.completedByName==='Synthetic 1'&&retained.completedByIsSuperuser,`${mode} global SU can complete a retained direct-mode assignment`);
 await changeTaskStatus({id:retained.id,status:'in_progress',note:'Synthetic reopen',actor:su,version:retained.version,token:randomUUID()});
 check((await listTaskEvents(retained.id)).some(e=>e.status==='done'),`${mode} reopen retains prior completion history`);
 await db.query("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1,?,1,'leader',1)",[team.id]);
 await db.query("UPDATE activity_team_leaders SET user_id=1 WHERE team_id=?",[team.id]);
 await command({kind:'team_member',teamId:team.id,userId:1,role:'leader',active:true});
 check((await getProjectWorkspace(1,su)).teams[0].leaderUserId===1,`${mode} unchanged legacy SU leadership is preserved without automatic removal`);
 // Revocation changes only a synthetic membership row; assignments and events remain intact.
 const eventsBefore=(await listTaskEvents(retained.id)).length;
 await db.query("UPDATE project_members SET active=0 WHERE project_id=1 AND user_id=1");
 check((await getTaskScope(1,su)).canManageAll&&(await getProjectWorkspace(1,su)).projectId===1,`${mode} revoking SU membership cannot remove global management authority`);
 check((await getTaskById(retained.id))?.assigneeId===1&&(await listTaskEvents(retained.id)).length===eventsBefore,`${mode} membership revocation preserves existing assignment and complete task event history`);
 await db.query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(900,?,2,'Synthetic private body','private')",[retained.id]);
 await db.query("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(900,1,2,'Synthetic private version','private')");
 const suFilter={viewerUserId:1,canSeeAll:true};
 check((await getSubmissionByIdForViewer(900,suFilter))?.content==='Synthetic private body'&&(await getSubmissionRevisionForViewer(900,1,suFilter))?.content==='Synthetic private version',`${mode} stored guest SU without membership reads private current and revision content`);
 const comment=await createComment({submissionId:900,revisionNumber:1,authorId:1,actor:su,content:'Synthetic SU comment'});
 check(comment.authorId===1&&(await getCommentForViewer(comment.id,suFilter))?.content==='Synthetic SU comment',`${mode} stored guest SU without membership creates and reads a private revision comment`);
 await db.query("INSERT INTO comments(id,submission_id,revision_number,author_id,content) VALUES(901,900,1,2,'Synthetic author comment')");
 check((await updateComment({id:901,actor:su,content:'Synthetic SU moderation'})).content==='Synthetic SU moderation',`${mode} global SU can update another author private comment without membership`);
 const unassignedAdmin={userId:3,isSuperuser:false};
 check(await getSubmissionByIdForViewer(900,{viewerUserId:3,canSeeAll:true})===null&&await getCommentForViewer(901,{viewerUserId:3,canSeeAll:true})===null,`${mode} unassigned ordinary admin cannot read the same private submission or comment`);
 await reject(()=>createComment({submissionId:900,revisionNumber:1,authorId:3,actor:unassignedAdmin,content:'Forbidden admin comment'}),`${mode} unassigned ordinary admin cannot create a private comment`);
 await reject(()=>updateComment({id:901,actor:unassignedAdmin,content:'Forbidden admin edit'}),`${mode} unassigned ordinary admin cannot update a private comment`);
 check((await getCommentForViewer(901,suFilter))?.content==='Synthetic SU moderation',`${mode} rejected ordinary admin edits preserve private comment content`);
 check((await db.query("SELECT role FROM users WHERE id=1") as {role:string}[])[0].role==='guest',`${mode} authority normalization never rewrites stored SU role`);
}
if(!process.argv.includes('--maria')){
 const mf=new Miniflare({host:'127.0.0.1',cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'superuser-invariants-test'}});
 try{const DB=await mf.getD1Database('DB') as unknown as D1Database;for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await DB.prepare(sql).run();await runWithHostedBindings({DB},()=>verify('D1'));}finally{await mf.dispose();}
}
if(!process.argv.includes('--d1')){
 if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires isolated loopback MariaDB3307.');
 const database=`wbs_su_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(database);
 const options={host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true,insertIdAsNumber:true};
 const connection=await createConnection(options),globalDb=globalThis as typeof globalThis&{__wbsMariaDbPool?:Pool};
 try{await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${database}\``);await runNativeMigrations(connection,database);globalDb.__wbsMariaDbPool=createPool({...options,database,connectionLimit:5});await verify('MariaDB');console.log(`Retained synthetic ${database}`);}finally{await globalDb.__wbsMariaDbPool?.end();globalDb.__wbsMariaDbPool=undefined;await connection.end();}
}
console.log(`Superuser invariant contracts passed: ${checks}`);
