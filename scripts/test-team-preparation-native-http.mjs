/** Compiled Native HTTP + SSR smoke. No browser, operating host, or existing DB access. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,symlink,stat} from 'node:fs/promises';
import path from 'node:path';
import next from 'next';
import {encode} from 'next-auth/jwt';
import {createConnection} from 'mariadb';
import {testDatabaseEnv,assertTestDatabaseName} from '../tests/helpers/test-env.ts';
import {runNativeMigrations} from '../src/shared/server/database-admin/native-migrations.server.ts';
import {buildSnapshot} from './test-project-ux-provenance.mjs';

assert.equal(process.argv.length,2,'No options supported; run only against a final compiled Native build.');
const out=path.resolve('.test-artifacts/team-preparation-native-http',Date.now().toString(36));
const roots=['.next/BUILD_ID','.next/server','.next/static','.next/required-server-files.json'];
const before=await buildSnapshot(roots),serverDir=path.join(out,'server');
await mkdir(serverDir,{recursive:true});
for(const name of ['.next','node_modules','public'])try{await stat(path.resolve(name));await symlink(path.resolve(name),path.join(serverDir,name),'dir');}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
await writeFile(path.join(serverDir,'package.json'),JSON.stringify({private:true,type:'module',name:'synthetic-native-preparation-http'}));
const options={host:testDatabaseEnv.host,port:Number(testDatabaseEnv.port),user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true};
assert(['127.0.0.1','localhost','::1'].includes(options.host)&&options.port===3307,'Loopback MariaDB3307 test service required.');
const database=`wbs_prep_http_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(database);
const db=await createConnection(options),secret=randomBytes(32).toString('hex'),tokens={};
const people=[
 [1,'PREPARATION_HTTP_SU','guest'],[2,'PREPARATION_HTTP_LEADER','member'],[3,'PREPARATION_HTTP_MEMBER','member'],
 [4,'PREPARATION_HTTP_OTHER_TEAM','member'],[5,'PREPARATION_HTTP_UNASSIGNED_ADMIN','admin'],[6,'PREPARATION_HTTP_STALE_ADMIN','member'],
];
const requests=[],errors=[],assertions=[];
let app,handler,exitCode=0;
const check=(value,label)=>{assert.ok(value,label);assertions.push(label);console.log(`PASS ${label}`);};
const baseError=console.error;
console.error=(...args)=>{errors.push(args.map(String).join(' ').replaceAll(secret,'[synthetic-secret]'));baseError(...args);};
const server=createServer((req,res)=>{res.on('finish',()=>requests.push({path:req.url,method:req.method,status:res.statusCode,contentType:res.getHeader('content-type'),cacheControl:res.getHeader('cache-control')}));handler(req,res);});
try{
 await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`USE \`${database}\``);await runNativeMigrations(db,database);
 for(const [id,name,role] of people){
  const email=`preparation-http-${id}@example.test`;
  await db.query('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)',[id,email,name,role]);
  // Both a stale admin session and stale SU flag must be intersected with current DB identity.
  tokens[id]=await encode({secret,token:{email,name,role:id===6?'admin':role,isSuperuser:id===6},maxAge:3600});
 }
 tokens.missing=await encode({secret,token:{email:'preparation-http-never-persisted@example.test',name:'PREPARATION_HTTP_MISSING',role:'admin',isSuperuser:true},maxAge:3600});
 await db.query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(1001,'PREPARATION_HTTP_PROJECT','volunteering','members_only','2026-10-01','2027-12-31'),(1002,'PREPARATION_HTTP_OTHER_PROJECT','volunteering','members_only','2026-10-01','2027-12-31')");
 await db.query('INSERT INTO project_members(project_id,user_id) VALUES(1001,2),(1001,3),(1001,4),(1001,6),(1002,5)');
 await db.query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1101,1001,'meal','PREPARATION_HTTP_MEAL_TEAM'),(1102,1001,'facility','PREPARATION_HTTP_OTHER_TEAM_NAME')");
 await db.query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1001,1101,2,'leader'),(1001,1101,3,'member'),(1001,1101,6,'member'),(1001,1102,4,'leader')");
 await db.query('INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1101,1001,2),(1102,1001,4)');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 Object.assign(process.env,{NODE_ENV:'production',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:url,GOOGLE_CLIENT_ID:'synthetic-preparation-http',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'preparation-http-1@example.test',DB_HOST:options.host,DB_PORT:String(options.port),DB_USER:options.user,DB_PASSWORD:options.password,DB_NAME:database,DB_SCHEMA_USER:'',DB_SCHEMA_PASSWORD:'',DB_CONNECTION_LIMIT:'5',DB_CONNECT_TIMEOUT_MS:'5000',UPLOAD_DIR:path.join(out,'uploads'),LOG_DIR:path.join(out,'logs'),LOG_RETENTION_DAYS:'5',LOG_MAX_FILE_SIZE_MB:'10',UPLOAD_MAX_FILE_SIZE_MB:'20',APP_PORT:String(server.address().port),NEXT_TELEMETRY_DISABLED:'1'});
 const manifest=JSON.parse(await readFile('.next/required-server-files.json','utf8'));
 app=next({dev:false,dir:serverDir,conf:manifest.config,hostname:'127.0.0.1',port:server.address().port});await app.prepare();handler=app.getRequestHandler();
 const route='/api/projects/1001/teams/1101/preparation',detail='/projects/1001/teams/1101/preparation',list='/projects/1001/teams';
 const request=(resource,id,body,headers={})=>fetch(url+resource,{method:body===undefined?'GET':'PUT',headers:{...(id?{Cookie:`next-auth.session-token=${tokens[id]}`} :{}),...(body===undefined?{}:{Origin:url,'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
 const counts=async()=>{const rows=await db.query('SELECT (SELECT COUNT(*) FROM team_preparation_sheets) sheets,(SELECT COUNT(*) FROM team_preparation_revisions) revisions');return {sheets:Number(rows[0].sheets),revisions:Number(rows[0].revisions)};};
 const anonymous=await request(route);
 check(anonymous.status===401,'anonymous Native API uses login boundary401');
 const anonymousPage=await request(detail);
 check([302,303,307,308].includes(anonymousPage.status)&&/signin|signIn|login/i.test(anonymousPage.headers.get('location')||''),'anonymous Native detail redirects to authentication');
 const missingApi=await request(route,'missing'),missingList=await request(list,'missing'),missingDetail=await request(detail,'missing');
 check(missingApi.status===404&&missingList.status===404&&missingDetail.status===404,'signed but never-persisted identity uses404 API/list/detail, never SSR500');
 const leader=await request(route,2),blank=await leader.json();
 check(leader.status===200&&blank.sheet.version===0&&blank.sheet.canEdit&&blank.history.length===0,'Native canonical leader API reads unsaved empty sheet');
 check(leader.headers.get('cache-control')==='private, no-store'&&leader.headers.get('x-content-type-options')==='nosniff'&&leader.headers.get('cross-origin-resource-policy')==='same-origin','Native JSON response is private/no-store/nosniff/same-origin');
 const directory=await request(list,3),directoryHtml=await directory.text();
 await writeFile(path.join(out,'member-list.html'),directoryHtml);
 check(directory.status===200&&directoryHtml.includes('PREPARATION_HTTP_MEAL_TEAM')&&directoryHtml.includes('읽기 전용')&&!directoryHtml.includes('PREPARATION_HTTP_OTHER_TEAM_NAME'),'Native directory SSR shows member own team and readonly label, omits another team');
 const memberPage=await request(detail,3),memberHtml=await memberPage.text();
 await writeFile(path.join(out,'member-detail.html'),memberHtml);
 check(memberPage.status===200&&memberHtml.includes('읽기 전용입니다.')&&!memberHtml.includes('>준비표 편집<'),'Native member detail SSR is read-only without editor action');
 const currentKst=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 check(memberHtml.includes(currentKst)&&/defaultDate/.test(memberHtml),'Native SSR serializes request-time Asia/Seoul default date');
 check(JSON.stringify(await counts())===JSON.stringify({sheets:0,revisions:0}),'API and SSR reads leave current/revision rows unchanged');
 for(const [id,label]of [[4,'other-team member'],[5,'unassigned administrator']]){
  const response=await request(route,id),page=await request(detail,id);
  check(response.status===404&&page.status===404,`Native ${label} API/detail deny scope with404`);
 }
 const document={schemaVersion:1,kind:'meal',entries:[{id:randomUUID(),date:'2026-11-01',title:'NATIVE_HTTP_SYNTHETIC_MEAL',notes:'합성 준비 항목만 사용합니다.',status:'planned',checks:[{label:'재료 확인',done:false}],meal:'lunch',expectedPeople:3,amountPerPerson:0.125,unit:'kg'}]};
 const input={document,version:0,mutationKey:randomUUID()};
 check((await request(route,2,input,{Origin:'https://outside.example.test','X-Forwarded-Host':'outside.example.test'})).status===403,'Native mutation rejects foreign Origin even with a matching forged forwarded host');
 check((await request(route,3,input)).status===404&&(await request(route,6,input)).status===404,'member and stale admin/SU cookie cannot elevate read permission into edit');
 const put=await request(route,2,input),saved=await put.json();
 check(put.status===200&&saved.sheet.version===1&&saved.sheet.mealQuantities[document.entries[0].id]===0.375,'compiled Native PUT stores v1 and calculates exact server meal quantity0.375');
 const refreshed=await request(route,3),refreshedBody=await refreshed.json();
 check(refreshed.status===200&&!refreshedBody.sheet.canEdit&&JSON.stringify(refreshedBody.sheet.document)===JSON.stringify(document)&&refreshedBody.history.length===1,'fresh Native GET retains saved document and one revision for a read-only member');
 const refreshedPage=await request(detail,3),refreshedHtml=await refreshedPage.text();
 check(refreshedPage.status===200&&refreshedHtml.includes('NATIVE_HTTP_SYNTHETIC_MEAL')&&refreshedHtml.includes('0.375')&&refreshedHtml.includes('KST'),'saved Native detail SSR renders stored content, quantity and KST timestamp');
 const retry=await request(route,2,input);
 check(retry.status===200&&(await retry.json()).sheet.version===1&&JSON.stringify(await counts())===JSON.stringify({sheets:1,revisions:1}),'identical Native HTTP retry is idempotent without another revision');
 check((await request(route,2,{...input,mutationKey:randomUUID()})).status===409,'fresh mutation key with stale expected version returns409');
 const su=await request(route,1),suRead=await su.json();
 const suWrite=await request(route,1,{...input,version:1,mutationKey:randomUUID()});
 check(su.status===200&&suRead.sheet.canEdit&&suWrite.status===200&&(await suWrite.json()).sheet.version===2,'environment-bound SU retains Native edit with guest DB role, false token flag and no membership');
 const suRows=await db.query('SELECT role,(SELECT COUNT(*) FROM project_members WHERE user_id=1) memberships FROM users WHERE id=1');
 check(suRows[0].role==='guest'&&Number(suRows[0].memberships)===0,'SU verification does not mutate role or infer project membership');
 await db.query('UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=2');
 check((await request(route,2)).status===404&&(await request(detail,2)).status===404&&(await request(route,2,{...input,version:2,mutationKey:randomUUID()})).status===404,'next Native API read/write and SSR request deny revoked synthetic leader');
 const rows=await db.query('SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM projects) projects,(SELECT COUNT(*) FROM activity_teams) teams,(SELECT COUNT(*) FROM team_preparation_revisions) revisions');
 check(Number(rows[0].users)===6&&Number(rows[0].projects)===2&&Number(rows[0].teams)===2&&Number(rows[0].revisions)===2,'synthetic accounts/projects/teams and both revision records are retained without deletes');
 check(!errors.some(value=>/TypeError|ReferenceError|Functions cannot be passed directly|Unhandled|Error:/.test(value)),'compiled Native SSR/API smoke has no captured runtime exception');
 await writeFile(path.join(out,'result.json'),JSON.stringify({complete:true,browserExecuted:false,checks:assertions.length,database,assertions,limits:'Compiled Native HTTP and SSR only; no viewport, hydration, keyboard, browser, operating access or publication.'},null,2));
 console.log(`Native team preparation HTTP checks passed: ${assertions.length}; retained ${database}; proof ${out}`);
}catch(error){exitCode=1;console.error(error);await writeFile(path.join(out,'result.json'),JSON.stringify({complete:false,browserExecuted:false,database,checks:assertions.length,error:String(error)},null,2));}
finally{
 console.error=baseError;await writeFile(path.join(out,'requests.json'),JSON.stringify(requests,null,2));await writeFile(path.join(out,'server-errors.json'),JSON.stringify(errors,null,2));
 await db.end();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));if(app)await app.close();
 const after=await buildSnapshot(roots),unchanged=JSON.stringify(before)===JSON.stringify(after);
 await writeFile(path.join(out,'build-provenance.json'),JSON.stringify({before,after,unchanged},null,2));
 if(!unchanged){baseError('Native build changed during preparation HTTP smoke');exitCode=1;}
}
process.exit(exitCode);
