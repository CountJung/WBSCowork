import {fileURLToPath} from 'node:url';
/** Production Native preview acceptance; a new loopback *_test database only. */
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
import {buildSnapshot} from './test-project-ux-provenance.mjs';
import {seedAttachmentPreview,verifyAttachmentPreviewFixture} from './test-attachment-preview-fixture.mjs';

process.env.TZ='UTC';
const expectation=process.env.WBS_HYDRATION_EXPECT??'green';assert(['red','green'].includes(expectation));
const roots=['.next/BUILD_ID','.next/server','.next/static','.next/required-server-files.json'],before=await buildSnapshot(roots);
const out=path.resolve(`.test-artifacts/hydration-timezone/native/${expectation}`),serverDir=path.join(out,'server'),uploads=path.join(out,'uploads');
await mkdir(serverDir,{recursive:true});await writeFile(path.join(out,'result.json'),JSON.stringify({complete:false}));
for(const name of ['.next','node_modules','public'])try{await stat(path.resolve(name));await symlink(path.resolve(name),path.join(serverDir,name),'dir');}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
await writeFile(path.join(serverDir,'package.json'),JSON.stringify({private:true,type:'module',name:'synthetic-attachment-preview-native'}));
const options={host:testDatabaseEnv.host,port:Number(testDatabaseEnv.port),user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true};
assert(['127.0.0.1','localhost','::1'].includes(options.host)&&options.port===3307,'Native preview QA requires loopback test DB');
const database=`wbs_attachment_preview_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(database);
const db=await createConnection(options);let app,handler,exitCode=0;const requests=[];
const server=createServer((req,res)=>{res.on('finish',()=>{const url=new URL(req.url,'http://127.0.0.1');if(req.method==='POST'||url.pathname.startsWith('/api/submission'))requests.push({path:url.pathname,queryKeys:[...url.searchParams.keys()],method:req.method,status:res.statusCode,requestType:req.headers['content-type'],responseType:res.getHeader('content-type'),nextAction:!!req.headers['next-action'],cacheControl:res.getHeader('cache-control'),disposition:res.getHeader('content-disposition'),nosniff:res.getHeader('x-content-type-options'),csp:res.getHeader('content-security-policy')});});handler(req,res);});
try{
 await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`USE \`${database}\``);await runNativeMigrations(db,database);
 const version=(await db.query('SELECT VERSION() version'))[0].version;await writeFile(path.join(out,'fixture.json'),JSON.stringify({database,serverVersion:version}));
 const adapter={prepare(sql){return {bind(...values){return {run:()=>db.query(sql,values)};},run:()=>db.query(sql)};}};
 const secret=randomBytes(32).toString('hex');
 const fixture=await seedAttachmentPreview(adapter,{encode,secret,putFile:async(key,bytes)=>{const file=path.join(uploads,key);assert(file.startsWith(uploads+path.sep));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}});
 for(const table of ['submissions','submission_revisions','users'])await db.query("UPDATE "+table+" SET created_at='2026-10-23 12:12:00'");
 await db.query("INSERT INTO comments(id,submission_id,revision_number,author_id,content,created_at) VALUES(6001,3001,1,2,'HYDRATION_SYNTHETIC_COMMENT','2026-10-23 12:12:00')");
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 Object.assign(process.env,{NODE_ENV:'production',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:url,GOOGLE_CLIENT_ID:'synthetic-preview-native',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'attachment-preview-1@example.test',DB_HOST:options.host,DB_PORT:String(options.port),DB_USER:options.user,DB_PASSWORD:options.password,DB_NAME:database,DB_SCHEMA_USER:'',DB_SCHEMA_PASSWORD:'',DB_CONNECTION_LIMIT:'5',DB_CONNECT_TIMEOUT_MS:'5000',UPLOAD_DIR:uploads,LOG_DIR:path.join(out,'logs'),LOG_RETENTION_DAYS:'5',LOG_MAX_FILE_SIZE_MB:'10',UPLOAD_MAX_FILE_SIZE_MB:'20',APP_PORT:String(server.address().port),NEXT_TELEMETRY_DISABLED:'1'});
 const manifest=JSON.parse(await readFile('.next/required-server-files.json','utf8'));app=next({dev:false,dir:serverDir,conf:manifest.config,hostname:'127.0.0.1',port:server.address().port});await app.prepare();handler=app.getRequestHandler();
 const preflight=await fetch(url+'/api/auth/session',{headers:{Cookie:`next-auth.session-token=${fixture.tokens[1]}`}});const session=await preflight.json();assert.equal(session.user?.email,'attachment-preview-1@example.test');assert.equal(session.user?.role,'admin');assert.equal(session.user?.isSuperuser,true);await writeFile(path.join(out,'auth-verification.json'),JSON.stringify({environmentSuEffectiveRole:session.user.role,isSuperuser:session.user.isSuperuser,seededDatabaseRole:'guest',seededTokenRole:'guest',seededTokenIsSuperuser:false,projectMemberships:0},null,2));
 console.log(`Synthetic preview Native ready; retained isolated database ${database}`);
 const child=spawn('python3',[fileURLToPath(new URL('./test-hydration-timezone-browser.py',import.meta.url))],{stdio:['pipe','inherit','inherit']});child.stdin.end(JSON.stringify({url,tokens:fixture.tokens,files:fixture.clientFiles,text:fixture.text,runtime:'native',output:out,expectation}));
 const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});assert.equal(code,0,'Native hydration timezone browser failed');
 const result=JSON.parse(await readFile(path.join(out,'result.json'),'utf8'));assert.equal(result.complete,true);assert.deepEqual(result.timezones,['UTC','Asia/Seoul','America/New_York']);assert.equal(result.expectation,expectation);
 const verification=await verifyAttachmentPreviewFixture(fixture,{query:sql=>db.query(sql),authorActive:true,readFile:key=>readFile(path.join(uploads,key))});await writeFile(path.join(out,'database-verification.json'),JSON.stringify(verification,null,2));
 console.log(`PASS Native hydration timezone ${result.checks} actual browser conditions; records and ${verification.preservedFiles} files preserved`);
}catch(error){exitCode=1;console.error(error);}
finally{await writeFile(path.join(out,'requests.json'),JSON.stringify(requests,null,2));await db.end();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));if(app)await app.close();const after=await buildSnapshot(roots);await writeFile(path.join(out,'build-provenance.json'),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));if(JSON.stringify(before)!==JSON.stringify(after)){console.error('Native build changed during preview QA');exitCode=1;}}
process.exit(exitCode);
