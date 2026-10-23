/** Additive isolated native Next/MariaDB browser acceptance; existing databases are never edited. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,symlink,stat} from 'node:fs/promises';
import path from 'node:path';
import next from 'next';
import {encode} from 'next-auth/jwt';
import {createConnection} from 'mariadb';
import {testDatabaseEnv,assertTestDatabaseName} from '../tests/helpers/test-env.ts';
import {runNativeMigrations} from '../src/shared/server/database-admin/native-migrations.server.ts';
import {seedProjectUx} from './test-project-ux-fixture.mjs';
import {buildSnapshot} from './test-project-ux-provenance.mjs';

const buildRoots=['.next/BUILD_ID','.next/server','.next/static','.next/required-server-files.json'],buildBefore=await buildSnapshot(buildRoots);
const out=path.resolve('.test-artifacts/project-ux/native'),serverDir=path.join(out,'server'),uploads=path.join(out,'uploads');
await mkdir(serverDir,{recursive:true});
await writeFile(path.join(out,'result.json'),JSON.stringify({complete:false,runtime:'native'}));
for(const name of ['.next','node_modules','public']){
  try{await stat(path.resolve(name));await symlink(path.resolve(name),path.join(serverDir,name),'dir');}
  catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
}
await writeFile(path.join(serverDir,'package.json'),JSON.stringify({private:true,type:'module',name:'synthetic-project-ux-native'}));
const options={host:testDatabaseEnv.host,port:Number(testDatabaseEnv.port),user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true};
assert(['127.0.0.1','localhost','::1'].includes(options.host)&&options.port===3307,'Synthetic native DB requires loopback:3307');
const database=`wbs_project_ux_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;
assertTestDatabaseName(database);
const db=await createConnection(options);
let app,handler,exitCode=0;
const posts=[];
const server=createServer((req,res)=>{
  res.on('finish',()=>{if(req.method==='POST')posts.push({path:req.url?.split('?')[0],status:res.statusCode,responseType:res.getHeader('content-type'),nextAction:!!req.headers['next-action'],requestType:req.headers['content-type']});});
  handler(req,res);
});
try{
  await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`USE \`${database}\``);
  await runNativeMigrations(db,database);
  const version=(await db.query('SELECT VERSION() version'))[0].version;
  await writeFile(path.join(out,'fixture.json'),JSON.stringify({database,serverVersion:version}));
  const adapter={prepare(sql){return {bind(...values){return {run:()=>db.query(sql,values)};},run:()=>db.query(sql)};}};
  const secret=randomBytes(32).toString('hex');
  const fixture=await seedProjectUx(adapter,{encode,secret,putFile:async(key,value)=>{const file=path.join(uploads,key);assert(file.startsWith(uploads+path.sep));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,value);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  Object.assign(process.env,{NODE_ENV:'production',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:url,GOOGLE_CLIENT_ID:'synthetic-project-ux-native',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'project-ux-1@example.test',DB_HOST:options.host,DB_PORT:String(options.port),DB_USER:options.user,DB_PASSWORD:options.password,DB_NAME:database,DB_SCHEMA_USER:'',DB_SCHEMA_PASSWORD:'',DB_CONNECTION_LIMIT:'5',DB_CONNECT_TIMEOUT_MS:'5000',UPLOAD_DIR:uploads,LOG_DIR:path.join(out,'logs'),LOG_RETENTION_DAYS:'5',LOG_MAX_FILE_SIZE_MB:'10',UPLOAD_MAX_FILE_SIZE_MB:'20',APP_PORT:String(server.address().port),NEXT_TELEMETRY_DISABLED:'1'});
  const manifest=JSON.parse(await readFile('.next/required-server-files.json','utf8'));
  app=next({dev:false,dir:serverDir,conf:manifest.config,hostname:'127.0.0.1',port:server.address().port});
  await app.prepare();handler=app.getRequestHandler();
  const response=await fetch(url+'/api/auth/session',{headers:{Cookie:`next-auth.session-token=${fixture.tokens[1]}`}});
  const session=await response.json();assert.equal(session.user?.email,'project-ux-1@example.test');
  console.log(`Synthetic Native Next/MariaDB ${version} prepared; retained isolated database ${database}`);
  const child=spawn('python3',['scripts/test-project-ux.py'],{stdio:['pipe','inherit','inherit']});
  child.stdin.end(JSON.stringify({url,tokens:fixture.tokens,projectName:fixture.projectName,taskTitle:fixture.taskTitle,filename:fixture.filename,runtime:'native',output:out}));
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  if(code!==0)throw new Error('Project UX Native browser exit '+code);
  const result=JSON.parse(await readFile(path.join(out,'result.json'),'utf8'));assert.equal(result.complete,true);assert.equal(result.cases.length,process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?0:10);
  assert.equal(result.binding.complete,true);
  const scopes=await db.query('SELECT id,access_mode FROM projects WHERE id IN (101,102) ORDER BY id');
  assert.deepEqual(scopes.map(row=>[row.id,row.access_mode]),[[101,'legacy_authenticated'],[102,'members_only']]);
  assert.equal((await db.query('SELECT active FROM project_members WHERE project_id=101 AND user_id=2'))[0].active,0);
  assert.equal((await db.query('SELECT active FROM project_members WHERE project_id=102 AND user_id=2'))[0].active,1);
  assert.equal((await db.query('SELECT COUNT(*) count FROM project_members WHERE project_id=101 AND user_id=4'))[0].count,0);
  const roles=await db.query('SELECT id,role FROM users WHERE id IN (5,6,7) ORDER BY id');
  assert.deepEqual(roles.map(row=>[row.id,row.role]),[[5,'guest'],[6,'admin'],[7,'admin']]);
  assert.equal((await db.query("SELECT COUNT(*) count FROM comments WHERE content='SYNTHETIC STALE MUST NOT SAVE'"))[0].count,0);
  assert.equal((await db.query('SELECT COUNT(*) count FROM project_workspace_events WHERE project_id IN (101,102)'))[0].count,9);
  assert.equal((await db.query('SELECT COUNT(*) count FROM submissions WHERE id IN (101,102,103)'))[0].count,3);
  assert.equal((await db.query('SELECT COUNT(*) count FROM submission_revisions WHERE submission_id IN (101,102,103)'))[0].count,3);
  for(const id of [101,102,103])assert.equal((await readFile(path.join(uploads,`synthetic/project-ux-binding-${id}.txt`))).toString(),`SYNTHETIC BINDING ${id}`);
  await writeFile(path.join(out,'binding-database.json'),JSON.stringify({complete:true,scopes,roles,activeA:false,activeB:true,workspaceEvents:9,staleCommentCount:0,preservedSubmissionsAndRevisions:3,preservedFiles:3},null,2));
  if(process.env.WBS_PROJECT_UX_BINDING_ONLY!=='1')for(const [task,label] of [[601,'360-light'],[602,'1440-dark']]){
    const row=(await db.query('SELECT status,version,completed_by,completed_at,review_submission_id,review_revision_number FROM tasks WHERE id=?',[task]))[0];
    assert.equal(row.status,'in_progress');assert.equal(row.version,2);assert.equal(row.completed_by,null);assert.equal(row.completed_at,null);assert.equal(row.review_submission_id,null);assert.equal(row.review_revision_number,null);
    assert.equal((await db.query("SELECT COUNT(*) count FROM submission_events WHERE submission_id=? AND kind='approved'",[task]))[0].count,1);
    assert.equal((await db.query("SELECT COUNT(*) count FROM submission_events WHERE submission_id=? AND actor_id=1 AND kind='review_invalidated' AND body=?",[task,`QA reviewed reopen ${label}`]))[0].count,1);
  }
  assert.equal((await db.query('SELECT COUNT(*) count FROM tasks WHERE id IN (1,2,3,4,5)'))[0].count,5);
  assert.equal((await db.query('SELECT COUNT(*) count FROM submissions WHERE id IN (1,2)'))[0].count,2);
  assert.equal((await db.query('SELECT COUNT(*) count FROM comments WHERE id=1'))[0].count,1);
  for(const title of (process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?[]:['QA UX 빈초안 360-light','QA UX 빈초안 1440-dark']))assert.equal((await db.query('SELECT COUNT(*) count FROM tasks WHERE title=?',[title]))[0].count,1);
  assert(posts.length>=(process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?11:15)&&posts.every(item=>item.nextAction&&item.requestType?.startsWith('multipart/form-data')&&[200,303,404].includes(item.status)));
  assert.equal((await readFile(path.join(uploads,fixture.filekey))).toString(),fixture.bytes.toString());
  console.log(`PASS Native project UX ${result.checks} checks in 10 width/theme cases; DB hierarchy/submission/comment and local synthetic file preserved`);
}catch(error){exitCode=1;console.error(error);}
finally{
  await writeFile(path.join(out,'requests.json'),JSON.stringify(posts,null,2));
  await db.end();
  server.closeAllConnections();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  if(app)await app.close();
  const buildAfter=await buildSnapshot(buildRoots);
  await writeFile(path.join(out,'build-provenance.json'),JSON.stringify({before:buildBefore,after:buildAfter,unchanged:JSON.stringify(buildBefore)===JSON.stringify(buildAfter)},null,2));
  if(JSON.stringify(buildAfter)!==JSON.stringify(buildBefore)){console.error('Build inputs changed during Native browser acceptance');exitCode=1;}
}
// The harness owns the disposable Next process, including its internal DB pool.
// Browser and verification queries are complete before terminating that process.
process.exit(exitCode);
