/** PRD-047: ephemeral D1 and retained fresh loopback MariaDB fixtures only. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createConnection } from "mariadb";
import { assertTestDatabaseName, testDatabaseEnv } from "../tests/helpers/test-env";
import { runNativeMigrations, verifyNativeSchema } from "../src/shared/server/database-admin/native-migrations.server";

const args=process.argv.slice(2);
if(args.some(arg=>!['--d1','--maria'].includes(arg)) || args.length>1)throw new Error('Use at most one of --d1 / --maria.');
let checks=0;
function check(ok:unknown,label:string){assert.ok(ok,label);checks++;console.log(`PASS ${label}`);}
type Row=Record<string,unknown>;
type Query=(sql:string,params?:unknown[])=>Promise<Row[]>;
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item);
async function seed(query:Query){
  await query("INSERT INTO users(id,email,name,role) VALUES(1,'schema1@example.test','Synthetic member','member'),(2,'schema2@example.test','Synthetic admin','admin')");
  await query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Synthetic legacy','2026-01-01','2026-12-31'),(2,'Synthetic second','2026-01-01','2026-12-31')");
  await query("INSERT INTO tasks(id,project_id,title,start_date,end_date,status,assignee_id,version) VALUES(1,1,'Preserved task','2026-01-01','2026-12-31','in_progress',1,7)");
  await query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(1,1,1,'Preserved private content','private')");
}
async function snapshot(query:Query){return json(await Promise.all([
  query('SELECT id,name,start_date,end_date FROM projects ORDER BY id'),
  query('SELECT id,project_id,title,status,assignee_id,version FROM tasks ORDER BY id'),
  query('SELECT id,task_id,author_id,content,visibility FROM submissions ORDER BY id'),
  query('SELECT id,email,name,role FROM users ORDER BY id'),
]));}
async function verify(query:Query,label:string){
  const project=(await query('SELECT project_type,workspace_version,workspace_token FROM projects WHERE id=1'))[0];
  check(project.project_type==='collaboration'&&Number(project.workspace_version)===0&&project.workspace_token===null,`${label}: legacy project keeps collaboration default and empty workspace`);
  const task=(await query('SELECT activity_team_id,completion_mode FROM tasks WHERE id=1'))[0];
  check(task.activity_team_id===null&&task.completion_mode==='submission_required',`${label}: legacy task keeps submission-required completion`);
  await query('INSERT INTO project_members(project_id,user_id) VALUES(1,1),(1,2),(2,2)');
  await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1,1,'meal','Morning meal'),(2,1,'meal','Evening meal'),(3,2,'facility','Other project')");
  await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1,1,1,'member'),(1,2,1,'leader')");
  check((await query('SELECT team_id FROM activity_team_members WHERE user_id=1')).length===2,`${label}: one participant joins multiple teams of the same activity kind`);
  await assert.rejects(query("INSERT INTO activity_team_members(project_id,team_id,user_id) VALUES(2,3,1)"));checks++;
  await assert.rejects(query("INSERT INTO activity_team_members(project_id,team_id,user_id) VALUES(1,3,2)"));checks++;
  await assert.rejects(query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1,1,2,'admin')"));checks++;
  await assert.rejects(query("UPDATE projects SET project_type='unsupported' WHERE id=1"));checks++;
  await assert.rejects(query("UPDATE tasks SET completion_mode='unsupported' WHERE id=1"));checks++;
  await assert.rejects(query("UPDATE tasks SET activity_team_id=999 WHERE id=1"));checks++;
  check((await query('SELECT role FROM users WHERE id=1'))[0].role==='member',`${label}: scoped leader storage does not promote account role`);
  await query("INSERT INTO project_workspace_events(project_id,actor_id,operation_token,request_fingerprint,kind,workspace_version) VALUES(1,2,'schema-event','synthetic','team_member',1)");
  await assert.rejects(query("INSERT INTO project_workspace_events(project_id,actor_id,operation_token,request_fingerprint,kind,workspace_version) VALUES(1,2,'schema-event','synthetic','team_member',1)"));checks++;
  await query('UPDATE activity_team_members SET active=0 WHERE team_id=2 AND user_id=1');
  check((await query('SELECT active FROM activity_team_members WHERE team_id=2 AND user_id=1'))[0].active===0&&Number((await query('SELECT COUNT(*) AS n FROM project_workspace_events WHERE project_id=1'))[0].n)>0,`${label}: inactive membership retains row and workspace evidence`);
}
const files=(await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort();
const sqlByFile=await Promise.all(files.map(async name=>(await readFile(`drizzle/${name}`,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean)));
const workspaceIndex=files.findIndex(name=>name.startsWith('0014_'));
check(workspaceIndex>=0&&!sqlByFile.slice(workspaceIndex).flat().some(sql=>/DROP TABLE|DELETE FROM|PRAGMA foreign_keys=OFF/i.test(sql)), 'new D1 migrations use no table replacement, data deletion or disabled FK checks');
async function d1(){
  const mf=new Miniflare({host:'127.0.0.1',cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'volunteer-upgrade-test',FRESH:'volunteer-fresh-test'}});
  try{
    const db=await mf.getD1Database('DB');
    const query:Query=async(sql,params=[])=>{const result=await db.prepare(sql).bind(...params).all<Row>();return result.results;};
    for(const statements of sqlByFile.slice(0,workspaceIndex))for(const sql of statements)await db.prepare(sql).run();
    await seed(query);const before=await snapshot(query);
    const triggers=json(await query("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name"));
    for(const statements of sqlByFile.slice(workspaceIndex))for(const sql of statements)await db.prepare(sql).run();
    check(await snapshot(query)===before,'D1: populated pre-0014 IDs, roles, task state and private content unchanged');
    check(json(await query("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name"))===triggers,'D1: existing cleanup and staging triggers preserved');
    await verify(query,'D1 existing');
    check((await query('PRAGMA foreign_key_check')).length===0,'D1: all existing and new FK relationships valid');
    const fresh=await mf.getD1Database('FRESH');
    for(const statements of sqlByFile)for(const sql of statements)await fresh.prepare(sql).run();
    const freshQuery:Query=async(sql,params=[])=>{const result=await fresh.prepare(sql).bind(...params).all<Row>();return result.results;};
    await seed(freshQuery);await verify(freshQuery,'D1 fresh');
  }finally{await mf.dispose();}
}
async function maria(){
  if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires isolated loopback MariaDB:3307.');
  const connection=await createConnection({host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000});
  try{
    console.log(`MariaDB ${(await connection.query('SELECT VERSION() AS version'))[0].version}`);
    for(const scenario of ['existing','fresh']){
      const name=`wbs_volunteer_schema_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(name);
      await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${name}\``);
      console.log(`Retained synthetic database ${name}`);
      const query:Query=(sql,params=[])=>connection.query(sql,params);
      if(scenario==='existing'){
        await assert.rejects(runNativeMigrations({query:async(sql,params)=>{if(sql.includes('ADD COLUMN project_type '))throw new Error('synthetic pre-v10 boundary');return connection.query(sql,params);}},name),/synthetic pre-v10/);checks++;
        await seed(query);const before=await snapshot(query);
        await assert.rejects(runNativeMigrations({query:async(sql,params)=>{const result=await connection.query(sql,params);if(sql.includes('ADD COLUMN project_type '))throw new Error('synthetic partial v10');return result;}},name),/synthetic partial v10/);checks++;
        check(Number((await query('SELECT MAX(version) AS n FROM schema_migrations'))[0].n)===9,'MariaDB: interrupted v10 writes no success ledger');
        await runNativeMigrations(connection,name);
        check(await snapshot(query)===before,'MariaDB: existing rows survive partial-v10 resume');
      }else{await runNativeMigrations(connection,name);await seed(query);}
      await verify(query,`MariaDB ${scenario}`);
      const ledger=json(await query('SELECT * FROM schema_migrations ORDER BY version'));
      await runNativeMigrations(connection,name);
      check(json(await query('SELECT * FROM schema_migrations ORDER BY version'))===ledger,`MariaDB ${scenario}: repeat verifies without rewriting migration ledger`);
      await verifyNativeSchema(connection,name);
    }
  }finally{await connection.end();}
}
if(!args.includes('--maria'))await d1();
if(!args.includes('--d1'))await maria();
console.log(`Volunteer schema checks passed: ${checks}`);
