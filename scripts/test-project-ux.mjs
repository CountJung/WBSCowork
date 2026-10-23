/** Hydrated volunteer workflow against an isolated Worker/D1/R2 via loopback only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {encode} from 'next-auth/jwt';
import {buildSnapshot} from './test-project-ux-provenance.mjs';
import {seedProjectUx} from './test-project-ux-fixture.mjs';

const origin='https://project-ux.example.test';
const secret=randomBytes(32).toString('hex');
const output=path.resolve(process.env.WBS_PROJECT_UX_OUTPUT??'.test-artifacts/project-ux/worker');
assert(output.startsWith(path.resolve('.test-artifacts/project-ux')+path.sep),'Output must stay in ignored synthetic UX artifacts');
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'result.json'),JSON.stringify({complete:false}));
async function modules(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await modules(file));
    else if(file.endsWith('.js'))files.push({type:'ESModule',path:file});
  }
  return files;
}
const buildRoots=['dist/server','dist/client'],buildBefore=await buildSnapshot(buildRoots);
const entry=path.resolve('dist/server/index.js');
const mf=new Miniflare({cf:false,name:'project-ux-browser',modules:[{type:'ESModule',path:entry},...(await modules(path.resolve('dist/server'))).filter(m=>m.path!==entry)],modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'project-ux-db'},r2Buckets:{ATTACHMENTS:'project-ux-files'},assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:false,has_user_worker:true}},bindings:{NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:'synthetic.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'project-ux-1@example.test'},log:new Log(LogLevel.ERROR)});
let root;
const observations=[],httpErrors=[];
const server=createServer(async(req,res)=>{
  try{
    const headers=new Headers();
    for(const[k,v]of Object.entries(req.headers))if(v&&!['host','connection','content-length'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
    const token=req.headers.cookie?.match(/(?:^|;\s*)next-auth.session-token=([^;]+)/)?.[1];
    if(token)headers.set('Cookie',`__Secure-next-auth.session-token=${token}`);
    if(headers.get('Origin')===root)headers.set('Origin',new URL(await mf.ready).origin);
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const response=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,body,redirect:'manual'});
    if(response.status>=400){const url=new URL(req.url,root);httpErrors.push({path:url.pathname,queryKeys:[...url.searchParams.keys()],method:req.method,status:response.status,responseType:response.headers.get('content-type'),accept:headers.get('accept'),rscHeader:headers.has('rsc'),rscAction:headers.has('x-rsc-action'),destination:headers.get('sec-fetch-dest')});}
    if(req.method==='POST'){
      const observation={path:new URL(req.url,root).pathname,status:response.status,requestType:headers.get('content-type'),responseType:response.headers.get('content-type'),rscAction:headers.has('x-rsc-action'),bytes:body?.length??0};
      observations.push(observation);console.log('BROWSER_POST '+JSON.stringify(observation));
    }
    const outgoing={};
    for(const[k,v]of response.headers)if(!['content-encoding','content-length','transfer-encoding','set-cookie'].includes(k))outgoing[k]=k==='location'&&v.startsWith(origin)?v.slice(origin.length):v;
    res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Synthetic gateway:',error.message);res.writeHead(500);res.end('Synthetic gateway error');}
});
try{
  const db=await mf.getD1Database('DB');
  for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
    for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  }
  const {tokens,projectName,taskTitle,filename,filekey,bytes}=await seedProjectUx(db,{encode,secret,putFile:async(key,value)=>(await mf.getR2Bucket('ATTACHMENTS')).put(key,value)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  root=`http://127.0.0.1:${server.address().port}`;
  const child=spawn('python3',['scripts/test-project-ux.py'],{stdio:['pipe','inherit','inherit']});
  child.stdin.end(JSON.stringify({url:root,tokens,projectName,taskTitle,filename,runtime:"worker",output}));
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  if(code!==0)throw new Error(`Project UX browser exit ${code}`);
  const manifest=JSON.parse(await readFile(path.join(output,'result.json'),'utf8'));
  assert.equal(manifest.complete,true);
  assert.equal(manifest.cases.length,process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?0:10);
  assert.equal(manifest.binding.complete,true);
  const scopes=(await db.prepare('SELECT id,access_mode FROM projects WHERE id IN (101,102) ORDER BY id').all()).results;
  assert.deepEqual(scopes.map(row=>[row.id,row.access_mode]),[[101,'legacy_authenticated'],[102,'members_only']]);
  assert.equal(await db.prepare('SELECT active FROM project_members WHERE project_id=101 AND user_id=2').first('active'),0);
  assert.equal(await db.prepare('SELECT active FROM project_members WHERE project_id=102 AND user_id=2').first('active'),1);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM project_members WHERE project_id=101 AND user_id=4').first('count'),0);
  const roles=(await db.prepare('SELECT id,role FROM users WHERE id IN (5,6,7) ORDER BY id').all()).results;
  assert.deepEqual(roles.map(row=>[row.id,row.role]),[[5,'guest'],[6,'admin'],[7,'admin']]);
  assert.equal(await db.prepare("SELECT COUNT(*) count FROM comments WHERE content='SYNTHETIC STALE MUST NOT SAVE'").first('count'),0);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM project_workspace_events WHERE project_id IN (101,102)').first('count'),9);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM submissions WHERE id IN (101,102,103)').first('count'),3);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM submission_revisions WHERE submission_id IN (101,102,103)').first('count'),3);
  for(const id of [101,102,103]){const file=await(await mf.getR2Bucket('ATTACHMENTS')).get(`synthetic/project-ux-binding-${id}.txt`);assert(file);assert.equal(await file.text(),`SYNTHETIC BINDING ${id}`);}
  await writeFile(path.join(output,'binding-database.json'),JSON.stringify({complete:true,scopes,roles,activeA:false,activeB:true,workspaceEvents:9,staleCommentCount:0,preservedSubmissionsAndRevisions:3,preservedFiles:3},null,2));
  if(process.env.WBS_PROJECT_UX_BINDING_ONLY!=='1')for(const [task,label] of [[601,'360-light'],[602,'1440-dark']]){
    const row=await db.prepare('SELECT status,version,completed_by,completed_at,review_submission_id,review_revision_number FROM tasks WHERE id=?').bind(task).first();
    assert.equal(row.status,'in_progress');assert.equal(row.version,2);assert.equal(row.completed_by,null);assert.equal(row.completed_at,null);assert.equal(row.review_submission_id,null);assert.equal(row.review_revision_number,null);
    assert.equal(await db.prepare("SELECT COUNT(*) count FROM submission_events WHERE submission_id=? AND kind='approved'").bind(task).first('count'),1);
    assert.equal(await db.prepare("SELECT COUNT(*) count FROM submission_events WHERE submission_id=? AND actor_id=1 AND kind='review_invalidated' AND body=?").bind(task,`QA reviewed reopen ${label}`).first('count'),1);
  }
  const preserve=await db.prepare('SELECT COUNT(*) count FROM tasks WHERE id IN (1,2,3,4,5)').first('count');
  assert.equal(preserve,5);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM submissions WHERE id IN (1,2)').first('count'),2);
  assert.equal(await db.prepare('SELECT COUNT(*) count FROM comments WHERE id=1').first('count'),1);
  for(const title of (process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?[]:['QA UX 빈초안 360-light','QA UX 빈초안 1440-dark']))assert.equal(await db.prepare('SELECT COUNT(*) count FROM tasks WHERE title=?').bind(title).first('count'),1);
  assert(observations.length>=(process.env.WBS_PROJECT_UX_BINDING_ONLY==='1'?11:15)&&observations.every(item=>item.rscAction&&item.requestType?.startsWith('multipart/form-data')&&[200,303,404].includes(item.status)));
  const original=await(await mf.getR2Bucket('ATTACHMENTS')).get(filekey);assert(original);assert.equal(await original.text(),bytes.toString());
  await writeFile(path.join(output,'requests.json'),JSON.stringify(observations,null,2));
  console.log(`PASS project UX: ${manifest.checks} browser checks in ${manifest.cases.length} width/theme cases; ${observations.length} RSC form POSTs; original synthetic hierarchy/submissions/comment/file preserved`);
}finally{await writeFile(path.join(output,'http-errors.json'),JSON.stringify(httpErrors,null,2));await writeFile(path.join(output,'requests.json'),JSON.stringify(observations,null,2));server.close();await mf.dispose();const buildAfter=await buildSnapshot(buildRoots);await writeFile(path.join(output,'build-provenance.json'),JSON.stringify({before:buildBefore,after:buildAfter,unchanged:JSON.stringify(buildBefore)===JSON.stringify(buildAfter)},null,2));assert.deepEqual(buildAfter,buildBefore,'Build inputs changed during browser acceptance');}
