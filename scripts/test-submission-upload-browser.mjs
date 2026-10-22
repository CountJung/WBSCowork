/** QLT-022: hydrated Chromium -> loopback gateway -> actual Worker, ephemeral D1/R2 only. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { encode } from 'next-auth/jwt';
const origin='https://submission-upload.example.test', secret=randomBytes(32).toString('hex');
async function modules(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())result.push(...await modules(file));else if(file.endsWith('.js'))result.push({type:'ESModule',path:file});}return result;}
const entry=path.resolve('dist/server/index.js');
const mf=new Miniflare({cf:false,name:'submission-upload-browser',modules:[{type:'ESModule',path:entry},...(await modules(path.resolve('dist/server'))).filter(m=>m.path!==entry)],modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'submission-upload-browser-db'},r2Buckets:{ATTACHMENTS:'submission-upload-browser-files'},assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:false,has_user_worker:true}},bindings:{NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:'synthetic.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'admin@example.test'},log:new Log(LogLevel.ERROR)});
let root;
const observations=[];
const server=createServer(async(req,res)=>{
 try{
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&&!['host','connection','content-length'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
  const token=req.headers.cookie?.match(/(?:^|;\s*)next-auth.session-token=([^;]+)/)?.[1];if(token)headers.set('Cookie',`__Secure-next-auth.session-token=${token}`);
  if(headers.get('Origin')===root)headers.set('Origin',new URL(await mf.ready).origin);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?Buffer.concat(chunks):undefined;
  const response=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,body,redirect:'manual'});
  if(req.method==='POST'){const observation={path:new URL(req.url,root).pathname,status:response.status,requestType:headers.get('content-type'),responseType:response.headers.get('content-type'),rscAction:headers.has('x-rsc-action'),bytes:body?.length??0};observations.push(observation);console.log('BROWSER_POST '+JSON.stringify(observation));}
  const outgoing={};for(const[k,v]of response.headers)if(!['content-encoding','content-length','transfer-encoding','set-cookie'].includes(k))outgoing[k]=k==='location'&&v.startsWith(origin)?v.slice(origin.length):v;
  res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Synthetic gateway:',error.message);res.writeHead(500);res.end('Synthetic gateway error');}
});
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO users(id,email,name,role) VALUES(1,'member@example.test','Synthetic Member','member')").run();
 await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'QLT022 synthetic','2026-01-01','2026-12-31')").run();
 for(const id of [1,2])await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(?,1,?,'2026-01-01','2026-12-31')").bind(id,'Synthetic upload '+id).run();
 const token=await encode({secret,token:{email:'member@example.test',name:'Synthetic Member'},maxAge:3600});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root=`http://127.0.0.1:${server.address().port}`;
 const child=spawn('python3',['scripts/test-submission-upload-browser.py'],{stdio:['pipe','inherit','inherit']});child.stdin.end(JSON.stringify({url:root,token}));
 const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 if(code!==0)throw new Error(`Submission upload browser exit ${code}`);
 const submissions=(await db.prepare('SELECT id,current_revision FROM submissions ORDER BY id').all()).results;
 assert.deepEqual(submissions.map(row=>row.current_revision),[3,1,3,1]);
 const attachments=(await db.prepare('SELECT file_path,file_name,file_size_bytes FROM submission_attachments').all()).results;
 assert.equal(attachments.length,14);
 const expected={'qa.txt':'SYNTHETIC QLT022 FILE','second.txt':'SYNTHETIC QLT022 SECOND FILE','third.txt':'SYNTHETIC QLT022 THIRD FILE','retry.txt':'SYNTHETIC QLT022 RETRY'};
 const bucket=await mf.getR2Bucket('ATTACHMENTS');
 for(const file of attachments){const object=await bucket.get(file.file_path);assert(object);assert.equal(object.size,file.file_size_bytes);assert.equal(await object.text(),expected[file.file_name]);}
 console.log('PASS isolated D1/R2: four submissions, revisions 3/1/3/1, fourteen preserved attachment snapshots with exact bytes');
 assert.equal(observations.length,8);
 assert(observations.every(row=>row.status===303&&row.rscAction&&row.requestType.startsWith('multipart/form-data')));
 console.log('PASS eight real hydrated multipart Server Action requests; injected transport failures never mutated the fixture');
}finally{server.close();await mf.dispose();}
