/** Additive Native15/D10018 contracts. All MariaDB schemas are new and retained. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createConnection } from "mariadb";
import { Miniflare } from "miniflare";
import { runNativeMigrations } from "../src/shared/server/database-admin/native-migrations.server";
import { assertTestDatabaseName, testDatabaseEnv } from "../tests/helpers/test-env";

type Row=Record<string,unknown>;
type Query=(sql:string,params?:unknown[])=>Promise<Row[]>;
type Statement={sql:string;params:unknown[]};
type Batch=(statements:Statement[])=>Promise<void>;
let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;console.log(`PASS ${label}`);}
async function rejected(work:Promise<unknown>,label:string){await assert.rejects(work);check(true,label);}
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item);
const timestamp='2026-10-23T14:06:38.000Z';
const hash='a'.repeat(64);
const token=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function sheet(team:number,project:number,version:number,document='{"kind":"meal","rows":[]}',actor:number|null=1,mutation=version):Statement{
  return {sql:'INSERT INTO team_preparation_sheets(team_id,project_id,version,document_json,updated_by,updated_at,mutation_key,request_hash) VALUES(?,?,?,?,?,?,?,?)',params:[team,project,version,document,actor,timestamp,token(mutation),hash]};
}
function revision(team:number,project:number,version:number,document='{"kind":"meal","rows":[]}',actor:number|null=1,mutation=version):Statement{
  return {sql:'INSERT INTO team_preparation_revisions(team_id,project_id,version,document_json,changed_by,changed_at,mutation_key,request_hash) VALUES(?,?,?,?,?,?,?,?)',params:[team,project,version,document,actor,timestamp,token(mutation),hash]};
}
async function seed(query:Query){
  await query("INSERT INTO users(id,email,name,role) VALUES(1,'preparation-owner@example.test','Synthetic owner','member'),(2,'preparation-admin@example.test','Synthetic admin','admin')");
  await query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Preserved project','2026-01-01','2026-12-31'),(2,'Other project','2026-01-01','2026-12-31')");
  await query('INSERT INTO project_members(project_id,user_id) VALUES(1,1),(1,2)');
  await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1,1,'meal','Meal'),(2,1,'facility','Facility'),(3,2,'childcare','Other project'),(4,1,'recreation','Empty team')");
  await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1,1,1,'leader')");
  await query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1,1,1)');
  await query("INSERT INTO tasks(id,project_id,title,start_date,end_date,status,version) VALUES(1,1,'Preserved private task','2026-01-01','2026-12-31','done',9)");
  await query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(1,1,1,'Preserved synthetic private body','private')");
  await query("INSERT INTO submission_attachments(id,submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(1,1,'synthetic-retained/file.txt','file.txt','text/plain',24)");
}
async function snapshot(query:Query){
  return json(await Promise.all(['users','projects','tasks','submissions','submission_attachments','project_members','activity_teams','activity_team_members','activity_team_leaders'].map(table=>query(`SELECT * FROM ${table} ORDER BY 1,2`))));
}
async function verify(query:Query,batch:Batch,label:string){
  check((await query('SELECT * FROM team_preparation_sheets')).length===0&&(await query('SELECT * FROM team_preparation_revisions')).length===0,`${label}: new tables start empty without inferred members or permissions`);
  const initial=sheet(1,1,1),history=revision(1,1,1);
  await batch([initial,history]);
  const current=(await query('SELECT * FROM team_preparation_sheets WHERE team_id=1'))[0];
  const first=(await query('SELECT * FROM team_preparation_revisions WHERE team_id=1 AND version=1'))[0];
  check(Number(current.version)===1&&current.document_json===first.document_json&&current.mutation_key===first.mutation_key&&current.request_hash===first.request_hash&&current.updated_at===timestamp&&first.changed_at===timestamp,`${label}: sheet and immutable-revision payload/UTC/hash roundtrip`);
  await rejected(query(initial.sql,initial.params),`${label}: one current sheet per team`);
  await rejected(query(history.sql,history.params),`${label}: revision primary key is team/version`);
  const duplicateToken=revision(1,1,2,undefined,1,1);
  await rejected(query(duplicateToken.sql,duplicateToken.params),`${label}: mutation key is unique within team history`);
  for(const make of [sheet,revision]){
    for(const [project,version,actor,document,reason] of [
      [2,1,1,'{}','cross-project team rejected'],
      [1,0,1,'{}','version zero rejected'],
      [1,-1,1,'{}','negative version rejected'],
      [1,1,999,'{}','missing actor rejected'],
      [1,1,null,'{}','null actor rejected'],
      [1,1,1,'a'.repeat(65537),'over 64KiB ASCII rejected'],
      [1,1,1,'가'.repeat(21846),'over 64KiB UTF-8 rejected'],
    ] as const){const statement=make(2,project,version,document,actor);await rejected(query(statement.sql,statement.params),`${label}: ${make===sheet?'sheet':'revision'} ${reason}`);}
  }
  const maximum='가'.repeat(21845)+'a';
  check(Buffer.byteLength(maximum,'utf8')===65536,`${label}: boundary fixture measures UTF-8 bytes`);
  const maxSheet=sheet(2,1,1,maximum),maxRevision=revision(2,1,1,maximum);
  await batch([maxSheet,maxRevision]);
  check((await query('SELECT document_json FROM team_preparation_sheets WHERE team_id=2'))[0].document_json===maximum,`${label}: exactly 64KiB UTF-8 roundtrips (JSON shape belongs to application)`);
  const failed=sheet(4,1,1),badRevision=revision(4,2,1);
  await rejected(batch([failed,badRevision]),`${label}: failing second statement rolls back current sheet`);
  check((await query('SELECT * FROM team_preparation_sheets WHERE team_id=4')).length===0,`${label}: atomic batch leaves no orphan current version`);
  check((await query('SELECT * FROM team_preparation_revisions WHERE team_id=1')).length===1,`${label}: failed mutations preserve saved revision history`);
}
const files=(await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort();
const migrations=await Promise.all(files.map(async file=>(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean)));
const index=files.findIndex(file=>file==='0018_team_preparation_sheets.sql');
check(index>=0&&migrations[index].every(sql=>/^CREATE (TABLE|UNIQUE INDEX)\b/.test(sql)), '0018 only creates new tables/index; no old-table replacement or data writes');
async function d1(){
  const mf=new Miniflare({host:'127.0.0.1',cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:'2026-05-15',d1Databases:{EXISTING:'preparation-existing-test',FRESH:'preparation-fresh-test'}});
  try{for(const scenario of ['EXISTING','FRESH'] as const){
    const db=await mf.getD1Database(scenario);
    const query:Query=async(sql,params=[])=>{const result=await db.prepare(sql).bind(...params).all<Row>();return result.results;};
    const batch:Batch=async statements=>{await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.params)));};
    for(const entries of scenario==='EXISTING'?migrations.slice(0,index):migrations)for(const sql of entries)await db.prepare(sql).run();
    await seed(query);const before=await snapshot(query);
    if(scenario==='EXISTING')await db.batch(migrations[index].map(sql=>db.prepare(sql)));
    check(await snapshot(query)===before,`D1 ${scenario}: existing account/project/task/private/file/membership/leader values preserved`);
    await verify(query,batch,`D1 ${scenario}`);
    check((await query('PRAGMA foreign_key_check')).length===0,`D1 ${scenario}: complete foreign key graph valid`);
    for(const table of ['team_preparation_sheets','team_preparation_revisions']){
      const keys=await query(`PRAGMA foreign_key_list(${table})`);
      check(keys.length===3&&keys.every(row=>row.on_delete==='RESTRICT'),`D1 ${scenario}: ${table} actor/team references restrict deletion`);
    }
    const saved=json(await query('SELECT * FROM team_preparation_sheets ORDER BY team_id'));
    await rejected(db.batch(migrations[index].map(sql=>db.prepare(sql))),`D1 ${scenario}: duplicate DDL fails without resetting saved tables`);
    check(json(await query('SELECT * FROM team_preparation_sheets ORDER BY team_id'))===saved&&await snapshot(query)===before,`D1 ${scenario}: repeated DDL preserves saved and legacy values`);
  }}finally{await mf.dispose();}
}
async function maria(){
  if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires isolated loopback MariaDB:3307.');
  const connection=await createConnection({host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000});
  try{for(const scenario of ['existing','fresh']){
    const name=`wbs_prep_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(name);
    await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${name}\``);console.log(`Retained synthetic MariaDB ${name}`);
    const query:Query=(sql,params=[])=>connection.query(sql,params);
    const batch:Batch=async statements=>{await connection.beginTransaction();try{for(const s of statements)await connection.query(s.sql,s.params);await connection.commit();}catch(error){await connection.rollback();throw error;}};
    if(scenario==='existing')await assert.rejects(runNativeMigrations({query:async(sql,params)=>{if(sql.includes('CREATE TABLE IF NOT EXISTS team_preparation_sheets ('))throw new Error('synthetic pre-v15 boundary');return connection.query(sql,params);}},name),/synthetic pre-v15 boundary/);
    else await runNativeMigrations(connection,name);
    await seed(query);const before=await snapshot(query);
    if(scenario==='existing'){
      check(Number((await query('SELECT MAX(version) AS v FROM schema_migrations'))[0].v)===14,'MariaDB existing: populated upgrade starts at verified v14');
      await runNativeMigrations(connection,name);
    }
    check(await snapshot(query)===before,`MariaDB ${scenario}: existing account/project/task/private/file/membership/leader values preserved`);
    await verify(query,batch,`MariaDB ${scenario}`);
    const ledger=json(await query('SELECT * FROM schema_migrations ORDER BY version'));
    const saved=json(await query('SELECT * FROM team_preparation_sheets ORDER BY team_id'));
    await runNativeMigrations(connection,name);
    check(json(await query('SELECT * FROM schema_migrations ORDER BY version'))===ledger&&Number((await query('SELECT MAX(version) AS v FROM schema_migrations'))[0].v)===15,`MariaDB ${scenario}: re-run verifies v15 without ledger rewrite`);
    check(json(await query('SELECT * FROM team_preparation_sheets ORDER BY team_id'))===saved&&await snapshot(query)===before,`MariaDB ${scenario}: re-run preserves saved sheet and legacy rows`);
  }}finally{await connection.end();}
}
const args=process.argv.slice(2);
if(args.length>1||args.some(arg=>!['--d1','--maria'].includes(arg)))throw new Error('Use at most one of --d1 / --maria.');
if(!args.includes('--maria'))await d1();
if(!args.includes('--d1'))await maria();
console.log(`Team preparation schema checks passed: ${checks}`);
