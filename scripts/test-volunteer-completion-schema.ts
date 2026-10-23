/** V11/0015: fresh and populated local synthetic schemas, never operating data. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createConnection } from "mariadb";
import { runNativeMigrations } from "../src/shared/server/database-admin/native-migrations.server";
import { assertTestDatabaseName, testDatabaseEnv } from "../tests/helpers/test-env";
const args=process.argv.slice(2);
if(args.some(arg=>!['--d1','--maria'].includes(arg))||args.length>1)throw new Error('Use at most one of --d1 / --maria.');
type Row=Record<string,unknown>;
type Query=(sql:string,params?:unknown[])=>Promise<Row[]>;
let checks=0;
function check(ok:unknown,label:string){assert.ok(ok,label);checks++;console.log(`PASS ${label}`);}
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item);
async function seed(query:Query,duplicate=false){
  await query("INSERT INTO users(id,email,name,role) VALUES(1,'v11-owner@example.test','Synthetic owner','member'),(2,'v11-other@example.test','Synthetic other','member'),(3,'v11-admin@example.test','Synthetic admin','admin')");
  await query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Synthetic volunteer','2026-01-01','2026-12-31'),(2,'Synthetic other project','2026-01-01','2026-12-31')");
  await query('INSERT INTO project_members(project_id,user_id) VALUES(1,1),(1,2),(2,2)');
  await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1,1,'meal','Meal team'),(2,2,'facility','Other project team'),(3,1,'recreation','Unstaffed team')");
  await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1,1,1,'leader'),(1,1,2,?),(2,2,2,'member')",[duplicate?'leader':'member']);
  await query("INSERT INTO tasks(id,project_id,title,start_date,end_date,status,version) VALUES(1,1,'Preserved done legacy task','2026-01-01','2026-12-31','done',9)");
  await query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(1,1,1,'Preserved private body','private')");
}
async function snapshot(query:Query){return json(await Promise.all([
  query('SELECT id,project_id,title,status,version,completion_mode FROM tasks ORDER BY id'),
  query('SELECT id,author_id,content,visibility FROM submissions ORDER BY id'),
  query('SELECT project_id,team_id,user_id,role,active FROM activity_team_members ORDER BY team_id,user_id'),
  query('SELECT id,role FROM users ORDER BY id'),
]));}
async function verify(query:Query,label:string,seededLeader:boolean){
  const task=(await query('SELECT completed_by,completed_at,completion_mode,status,version FROM tasks WHERE id=1'))[0];
  check(task.completed_by===null&&task.completed_at===null&&task.completion_mode==='submission_required'&&task.status==='done'&&Number(task.version)===9,`${label}: legacy done task keeps mode/state without fabricated completion attribution`);
  if(!seededLeader)await query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1,1,1)');
  check(Number((await query('SELECT user_id FROM activity_team_leaders WHERE team_id=1'))[0].user_id)===1,`${label}: canonical leader matches preserved scoped member`);
  await assert.rejects(query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1,1,2)'));checks++;
  await assert.rejects(query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(2,1,2)'));checks++;
  await assert.rejects(query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(3,1,3)'));checks++;
  await query('UPDATE activity_team_leaders SET user_id=2 WHERE team_id=1');
  check(Number((await query('SELECT user_id FROM activity_team_leaders WHERE team_id=1'))[0].user_id)===2,`${label}: leader pointer can be replaced with a member of the same team`);
  await query('UPDATE activity_team_leaders SET user_id=NULL WHERE team_id=1');
  check((await query('SELECT user_id FROM activity_team_leaders WHERE team_id=1')).length===1&&(await query('SELECT user_id FROM activity_team_leaders WHERE team_id=1'))[0].user_id===null,`${label}: dismissal retains a nullable canonical slot`);
  await assert.rejects(query('UPDATE tasks SET completed_by=999 WHERE id=1'));checks++;
  await query("UPDATE tasks SET completed_by=1,completed_at='2026-10-23 01:02:03' WHERE id=1");
  const updated=(await query('SELECT completed_by,completed_at FROM tasks WHERE id=1'))[0];
  check(Number(updated.completed_by)===1&&updated.completed_at!==null,`${label}: explicit completion attribution persists without changing legacy mode`);
  check((await query('SELECT visibility FROM submissions WHERE id=1'))[0].visibility==='private'&&(await query('SELECT role FROM users WHERE id=1'))[0].role==='member',`${label}: attribution/leader storage does not change private visibility or account role`);
}
const files=(await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort();
const statements=await Promise.all(files.map(async file=>(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean)));
const completionIndex=files.findIndex(file=>file.startsWith('0015_'));
const upgrade=statements[completionIndex]!;
check(completionIndex>=0&&!upgrade.some(sql=>/DROP TABLE|DELETE FROM|foreign_keys=OFF/i.test(sql)),'0015 is additive without old-table replacement or FK disabling');
async function d1(){
  const mf=new Miniflare({host:'127.0.0.1',cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:'2026-05-15',d1Databases:{EXISTING:'v11-existing-test',FRESH:'v11-fresh-test',DUPLICATE:'v11-duplicate-test'}});
  try{for(const scenario of ['EXISTING','FRESH','DUPLICATE'] as const){
    const db=await mf.getD1Database(scenario);const query:Query=async(sql,params=[])=>{const result=await db.prepare(sql).bind(...params).all<Row>();return result.results;};
    for(const entries of scenario==='FRESH'?statements:statements.slice(0,completionIndex))for(const sql of entries)await db.prepare(sql).run();
    await seed(query,scenario==='DUPLICATE');const before=await snapshot(query);
    if(scenario==='DUPLICATE'){
      await assert.rejects(db.batch(upgrade.map(sql=>db.prepare(sql))));checks++;
      check(await snapshot(query)===before,'D1: ambiguous legacy leaders are not selected or rewritten');
      check((await query("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_team_leaders'")).length===0,'D1: failed migration batch rolls back new canonical table');
      continue;
    }
    if(scenario==='EXISTING'){
      await db.batch(upgrade.map(sql=>db.prepare(sql)));
      check(await snapshot(query)===before,'D1: populated pre-0015 memberships, completed task and private body preserved');
    }
    await verify(query,`D1 ${scenario.toLowerCase()}`,scenario==='EXISTING');
    check((await query('PRAGMA foreign_key_check')).length===0,`D1 ${scenario.toLowerCase()}: all completion and team FK relationships valid`);
  }}finally{await mf.dispose();}
}
async function maria(){
  if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires isolated loopback MariaDB:3307.');
  const connection=await createConnection({host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000});
  try{for(const scenario of ['existing','fresh','duplicate']){
    const name=`wbs_v11_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(name);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${name}\``);console.log(`Retained synthetic MariaDB ${name}`);
    const query:Query=(sql,params=[])=>connection.query(sql,params);
    if(scenario!=='fresh')await assert.rejects(runNativeMigrations({query:async(sql,params)=>{if(sql.includes('ADD COLUMN completed_by '))throw new Error('synthetic pre-v11 boundary');return connection.query(sql,params);}},name),/synthetic pre-v11/);
    else await runNativeMigrations(connection,name);
    await seed(query,scenario==='duplicate');const before=await snapshot(query);
    if(scenario==='duplicate'){
      await assert.rejects(runNativeMigrations(connection,name),/Multiple active team leaders/);checks++;
      check(await snapshot(query)===before,'MariaDB: ambiguous legacy leaders are not chosen or rewritten');
      check(Number((await query('SELECT MAX(version) AS v FROM schema_migrations'))[0].v)===10,'MariaDB: ambiguous leader upgrade writes no v11 success ledger');
      continue;
    }
    if(scenario==='existing'){
      await assert.rejects(runNativeMigrations({query:async(sql,params)=>{const result=await connection.query(sql,params);if(sql.includes('ADD COLUMN completed_by '))throw new Error('synthetic partial v11');return result;}},name),/synthetic partial v11/);checks++;
      await runNativeMigrations(connection,name);
      check(await snapshot(query)===before,'MariaDB: populated partial-v11 upgrade resumes preserving legacy rows');
    }
    await verify(query,`MariaDB ${scenario}`,scenario==='existing');
    const ledger=json(await query('SELECT * FROM schema_migrations ORDER BY version'));
    await runNativeMigrations(connection,name);
    check(json(await query('SELECT * FROM schema_migrations ORDER BY version'))===ledger,`MariaDB ${scenario}: repeat verifies the schema without rewriting ledger`);
  }}finally{await connection.end();}
}
if(!args.includes('--maria'))await d1();
if(!args.includes('--d1'))await maria();
console.log(`Volunteer completion schema checks passed: ${checks}`);
