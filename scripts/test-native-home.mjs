/** QLT-028: actual Native RSC boundary and hydrated home navigation, synthetic loopback only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,symlink,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import next from 'next';
import {encode} from 'next-auth/jwt';
import {createConnection} from 'mariadb';
import {testDatabaseEnv,assertTestDatabaseName} from '../tests/helpers/test-env.ts';
import {runNativeMigrations} from '../src/shared/server/database-admin/native-migrations.server.ts';
import {buildSnapshot} from './test-project-ux-provenance.mjs';

const expectRed=process.argv.includes('--expect-red');
assert(process.argv.slice(2).every(value=>value==='--expect-red'),'Only --expect-red is supported.');
const phase=expectRed?'red':'green',out=path.resolve(`.test-artifacts/native-home/${phase}`);
const buildRoots=['.next/BUILD_ID','.next/server','.next/static','.next/required-server-files.json'];
const before=await buildSnapshot(buildRoots),serverDir=path.join(out,'server');
await mkdir(serverDir,{recursive:true});
for(const name of ['.next','node_modules','public'])try{await stat(path.resolve(name));await symlink(path.resolve(name),path.join(serverDir,name),'dir');}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
await writeFile(path.join(serverDir,'package.json'),JSON.stringify({private:true,type:'module',name:'synthetic-native-home'}));
const options={host:testDatabaseEnv.host,port:Number(testDatabaseEnv.port),user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true};
assert(['127.0.0.1','localhost','::1'].includes(options.host)&&options.port===3307,'Loopback test MariaDB3307 required.');
const database=`wbs_native_home_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(database);
const db=await createConnection(options),secret=randomBytes(32).toString('hex'),tokens={};
let app,handler,exitCode=0;const requests=[],serverErrors=[],checks=[];
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
const baseError=console.error;
console.error=(...args)=>{serverErrors.push(args.map(value=>String(value)).join(' ').replaceAll(secret,'[synthetic-secret]'));baseError(...args);};
const server=createServer((req,res)=>{res.on('finish',()=>{requests.push({path:req.url,method:req.method,status:res.statusCode,contentType:res.getHeader('content-type'),cacheControl:res.getHeader('cache-control')});});handler(req,res);});
try{
 await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`USE \`${database}\``);await runNativeMigrations(db,database);
 for(const [id,name,role]of [[1,'HOME_SYNTHETIC_SU','guest'],[2,'HOME_SYNTHETIC_MEMBER','member'],[3,'HOME_SYNTHETIC_OTHER','member']]){
  const email=`native-home-${id}@example.test`;
  await db.query('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)',[id,email,name,role]);
  tokens[id]=await encode({secret,token:{email,name,role,isSuperuser:false},maxAge:3600});
 }
 for(const [id,name,mode]of [[1,'HOME_VISIBLE_PROJECT','members_only'],[2,'HOME_FORBIDDEN_PROJECT','members_only'],[3,'HOME_EMPTY_PROJECT','legacy_authenticated']])await db.query("INSERT INTO projects(id,name,access_mode,start_date,end_date) VALUES(?,?,?,'2026-01-01','2027-12-31')",[id,name,mode]);
 await db.query('INSERT INTO project_members(project_id,user_id) VALUES(1,2),(2,3)');
 await db.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'HOME_VISIBLE_TASK','2026-01-01','2027-12-31'),(2,2,'HOME_FORBIDDEN_TASK','2026-01-01','2027-12-31')");
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 Object.assign(process.env,{NODE_ENV:'production',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:url,GOOGLE_CLIENT_ID:'synthetic-native-home',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'native-home-1@example.test',DB_HOST:options.host,DB_PORT:String(options.port),DB_USER:options.user,DB_PASSWORD:options.password,DB_NAME:database,DB_SCHEMA_USER:'',DB_SCHEMA_PASSWORD:'',DB_CONNECTION_LIMIT:'5',DB_CONNECT_TIMEOUT_MS:'5000',UPLOAD_DIR:path.join(out,'uploads'),LOG_DIR:path.join(out,'logs'),LOG_RETENTION_DAYS:'5',LOG_MAX_FILE_SIZE_MB:'10',UPLOAD_MAX_FILE_SIZE_MB:'20',APP_PORT:String(server.address().port),NEXT_TELEMETRY_DISABLED:'1'});
 const manifest=JSON.parse(await readFile('.next/required-server-files.json','utf8'));
 app=next({dev:false,dir:serverDir,conf:manifest.config,hostname:'127.0.0.1',port:server.address().port});await app.prepare();handler=app.getRequestHandler();
 const request=(route,id)=>fetch(url+route,{headers:id?{Cookie:`next-auth.session-token=${tokens[id]}`}:{},redirect:'manual'});
 const response=await request('/?projectId=1',2),html=await response.text();await writeFile(path.join(out,'signed-home.html'),html);
 if(expectRed){
  check(response.status===500,'RED: actual authenticated Native home reproduces SSR500');
  check(serverErrors.some(message=>message.includes('Functions cannot be passed directly to Client Components')),'RED: renderer identifies a function crossing the RSC client boundary');
 }else{
  check(response.status===200&&html.includes('HOME_VISIBLE_PROJECT')&&html.includes('HOME_VISIBLE_TASK'),'Native authenticated home SSR renders authorized project/task');
  check(!html.includes('HOME_FORBIDDEN_PROJECT')&&!html.includes('HOME_FORBIDDEN_TASK'),'Native home SSR omits unauthorized project and task metadata');
  check(html.includes('href="/?projectId=1"')&&html.includes('href="/tasks?projectId=1"')&&html.includes('taskId=1#task-1'),'home project-selection/workspace/focused-task hrefs survive RSC serialization');
  check((await request('/?projectId=2',2)).status===404&&(await request('/?projectId=999999',2)).status===404,'forbidden and absent home project IDs both return404');
  const empty=await request('/?projectId=3',2);check(empty.status===200&&(await empty.text()).includes('아직 업무가 없습니다'),'Native empty project home renders without a client boundary failure');
  const su=await request('/',1);check(su.status===200&&(await su.text()).includes('HOME_FORBIDDEN_PROJECT'),'configured SU home retains global project visibility');
  const anonymous=await request('/');check(anonymous.status===200&&!(await anonymous.text()).includes('HOME_VISIBLE_PROJECT'),'anonymous home stays public without another viewer project data');
  const child=spawn('python3',[fileURLToPath(new URL('./test-native-home-browser.py',import.meta.url))],{stdio:['pipe','inherit','inherit']});
  child.stdin.end(JSON.stringify({url,token:tokens[2],output:out}));
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});assert.equal(code,0,'Native home browser regression failed');
  check(!serverErrors.some(message=>message.includes('Functions cannot be passed directly to Client Components')),'no RSC function serialization failure in green home requests');
 }
 const counts=await db.query('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM projects) AS projects,(SELECT COUNT(*) FROM tasks) AS tasks');
 check(Number(counts[0].users)===3&&Number(counts[0].projects)===3&&Number(counts[0].tasks)===2,'home GET/navigation leaves synthetic rows unchanged');
 await writeFile(path.join(out,'result.json'),JSON.stringify({complete:true,phase,checks:checks.length,database,assertions:checks},null,2));
 console.log(`Native home ${phase} checks passed: ${checks.length}. Retained isolated database ${database}`);
}catch(error){exitCode=1;console.error(error);await writeFile(path.join(out,'result.json'),JSON.stringify({complete:false,phase,error:String(error)},null,2));}
finally{
 console.error=baseError;await writeFile(path.join(out,'requests.json'),JSON.stringify(requests,null,2));await writeFile(path.join(out,'server-errors.json'),JSON.stringify(serverErrors,null,2));
 await db.end();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));if(app)await app.close();
 const after=await buildSnapshot(buildRoots);await writeFile(path.join(out,'build-provenance.json'),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));
 if(JSON.stringify(before)!==JSON.stringify(after)){baseError('Native build changed during home QA');exitCode=1;}
}
process.exit(exitCode);
