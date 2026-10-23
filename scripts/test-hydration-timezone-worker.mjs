import {fileURLToPath} from 'node:url';
/** Focused production Worker hydration timezones; loopback and ephemeral D1/R2 only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {encode} from 'next-auth/jwt';
import {buildSnapshot} from './test-project-ux-provenance.mjs';
import {seedAttachmentPreview,verifyAttachmentPreviewFixture} from './test-attachment-preview-fixture.mjs';

process.env.TZ='UTC';
const expectation=process.env.WBS_HYDRATION_EXPECT??'green';assert(['red','green'].includes(expectation));
const origin='https://attachment-preview.example.test',secret=randomBytes(32).toString('hex');
const out=path.resolve(`.test-artifacts/hydration-timezone/worker/${expectation}`);await mkdir(out,{recursive:true});await writeFile(path.join(out,'result.json'),JSON.stringify({complete:false}));
const buildRoots=['dist/server','dist/client'],before=await buildSnapshot(buildRoots);
async function modules(dir){const files=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())files.push(...await modules(file));else if(file.endsWith('.js'))files.push({type:'ESModule',path:file});}return files;}
const entry=path.resolve('dist/server/index.js');
const mf=new Miniflare({cf:false,name:'attachment-preview-browser',modules:[{type:'ESModule',path:entry},...(await modules(path.resolve('dist/server'))).filter(item=>item.path!==entry)],modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'attachment-preview-db'},r2Buckets:{ATTACHMENTS:'attachment-preview-files'},assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:false,has_user_worker:true}},bindings:{NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:'synthetic.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'attachment-preview-1@example.test'},log:new Log(LogLevel.ERROR)});
let root;const requests=[];
const server=createServer(async(req,res)=>{
 try{
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value&&!['host','connection','content-length'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  const token=req.headers.cookie?.match(/(?:^|;\s*)next-auth.session-token=([^;]+)/)?.[1];if(token)headers.set('Cookie',`__Secure-next-auth.session-token=${token}`);
  if(headers.get('Origin')===root)headers.set('Origin',new URL(await mf.ready).origin);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?Buffer.concat(chunks):undefined;
  const response=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,body,redirect:'manual'});
  const url=new URL(req.url,root);if(req.method==='POST'||url.pathname.startsWith('/api/submission'))requests.push({path:url.pathname,queryKeys:[...url.searchParams.keys()],method:req.method,status:response.status,requestType:headers.get('content-type'),responseType:response.headers.get('content-type'),rscAction:headers.has('x-rsc-action'),cacheControl:response.headers.get('cache-control'),disposition:response.headers.get('content-disposition'),nosniff:response.headers.get('x-content-type-options'),csp:response.headers.get('content-security-policy')});
  const outgoing={};for(const [key,value] of response.headers)if(!['content-encoding','content-length','transfer-encoding','set-cookie'].includes(key))outgoing[key]=key==='location'&&value.startsWith(origin)?value.slice(origin.length):value;
  res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Synthetic preview gateway:',error.message);res.writeHead(500);res.end('Synthetic preview gateway error');}
});
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean))await db.prepare(sql).run();
 const bucket=await mf.getR2Bucket('ATTACHMENTS');
 const fixture=await seedAttachmentPreview(db,{encode,secret,putFile:(key,bytes)=>bucket.put(key,bytes)});
 for(const table of ['submissions','submission_revisions','users'])await db.prepare("UPDATE "+table+" SET created_at='2026-10-23 12:12:00'").run();
 await db.prepare("INSERT INTO comments(id,submission_id,revision_number,author_id,content,created_at) VALUES(6001,3001,1,2,'HYDRATION_SYNTHETIC_COMMENT','2026-10-23 12:12:00')").run();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root=`http://127.0.0.1:${server.address().port}`;
 const preflight=await fetch(root+'/api/auth/session',{headers:{Cookie:`next-auth.session-token=${fixture.tokens[1]}`}});const session=await preflight.json();assert.equal(session.user?.email,'attachment-preview-1@example.test');assert.equal(session.user?.role,'admin');assert.equal(session.user?.isSuperuser,true);
 await writeFile(path.join(out,'auth-verification.json'),JSON.stringify({environmentSuEffectiveRole:session.user.role,isSuperuser:session.user.isSuperuser,seededDatabaseRole:'guest',seededTokenRole:'guest',seededTokenIsSuperuser:false,projectMemberships:0},null,2));
 const child=spawn('python3',[fileURLToPath(new URL('./test-hydration-timezone-browser.py',import.meta.url))],{stdio:['pipe','inherit','inherit']});child.stdin.end(JSON.stringify({url:root,tokens:fixture.tokens,files:fixture.clientFiles,text:fixture.text,runtime:'worker',output:out,expectation}));
 const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});assert.equal(code,0,'Attachment preview browser failed');
 const result=JSON.parse(await readFile(path.join(out,'result.json'),'utf8'));assert.equal(result.complete,true);assert.deepEqual(result.timezones,['UTC','Asia/Seoul','America/New_York']);assert.equal(result.expectation,expectation);
 const database=await verifyAttachmentPreviewFixture(fixture,{query:async sql=>(await db.prepare(sql).all()).results,authorActive:true,readFile:async key=>{const file=await bucket.get(key);assert(file);return Buffer.from(await file.arrayBuffer());}});
 await writeFile(path.join(out,'database-verification.json'),JSON.stringify(database,null,2));
 console.log(`PASS Worker hydration timezone ${result.checks} actual browser conditions; synthetic records and ${database.preservedFiles} file bytes preserved`);
}finally{await writeFile(path.join(out,'requests.json'),JSON.stringify(requests,null,2));server.close();await mf.dispose();const after=await buildSnapshot(buildRoots);await writeFile(path.join(out,'build-provenance.json'),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,'Build changed during exact preview QA');}
