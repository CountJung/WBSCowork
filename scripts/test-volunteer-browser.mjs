/** Hydrated volunteer workflow against an isolated Worker/D1/R2 via loopback only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {encode} from 'next-auth/jwt';

const origin='https://volunteer-browser.example.test';
const secret=randomBytes(32).toString('hex');
const output=path.resolve('.test-artifacts/volunteer-browser');
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
const entry=path.resolve('dist/server/index.js');
const mf=new Miniflare({cf:false,name:'volunteer-browser',modules:[{type:'ESModule',path:entry},...(await modules(path.resolve('dist/server'))).filter(m=>m.path!==entry)],modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'volunteer-browser-db'},r2Buckets:{ATTACHMENTS:'volunteer-browser-files'},assets:{directory:path.resolve('dist/client'),binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:false,has_user_worker:true}},bindings:{NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:'synthetic.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'synthetic-not-credential',SUPERUSER_EMAIL:'superuser@example.test'},log:new Log(LogLevel.ERROR)});
let root;
const observations=[];
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
  const actors=[{id:1,name:'QA Admin',role:'admin'},{id:2,name:'QA Leader',role:'member'},{id:3,name:'QA Member',role:'member'},{id:4,name:'QA Replacement',role:'member'},{id:5,name:'QA Other Lead',role:'member'},{id:6,name:'QA Outsider',role:'member'}];
  const tokens={};
  for(const actor of actors){
    const email=`volunteer-${actor.id}@example.test`;
    await db.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').bind(actor.id,email,actor.name,actor.role).run();
    tokens[actor.id]=await encode({secret,token:{email,name:actor.name},maxAge:3600});
  }
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Legacy browser fixture','2026-01-01','2026-12-31')").run();
  for(const id of [1,2])await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id,deliverable,definition_of_done) VALUES(?,1,?,'2026-01-01','2026-12-31',3,'Legacy output','Legacy done criteria')").bind(id,`Legacy browser ${id}`).run();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  root=`http://127.0.0.1:${server.address().port}`;
  const child=spawn('python3',['scripts/test-volunteer-browser.py'],{stdio:['pipe','inherit','inherit']});
  child.stdin.end(JSON.stringify({url:root,tokens}));
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  if(code!==0)throw new Error(`Volunteer browser exit ${code}`);
  const manifest=JSON.parse(await readFile(path.join(output,'result.json'),'utf8'));
  assert.equal(manifest.complete,true);
  assert.equal(manifest.cases.length,2);
  assert.equal(manifest.adminSpa,process.env.WBS_QA_ADMIN_SPA==='1');
  for(const item of manifest.cases){
    const project=await db.prepare('SELECT project_type FROM projects WHERE id=?').bind(item.projectId).first();
    assert.equal(project.project_type,'volunteering');
    const task=await db.prepare('SELECT status,completion_mode,completed_by,completed_at FROM tasks WHERE id=?').bind(item.taskId).first();
    assert.equal(task.status,'done');assert.equal(task.completion_mode,'direct_completion');assert.equal(task.completed_by,4);assert(task.completed_at);
    const events=(await db.prepare('SELECT actor_id,status,note FROM task_events WHERE task_id=? ORDER BY id').bind(item.taskId).all()).results;
    assert(events.some(e=>e.status==='done'&&e.actor_id===3));
    assert(events.some(e=>e.status==='done'&&e.actor_id===4));
    assert(events.some(e=>e.status!=='done'&&e.note===`QA reopen ${item.width}`));
    const submission=await db.prepare('SELECT id,author_id,visibility FROM submissions WHERE task_id=?').bind(item.taskId).first();
    assert(submission);assert.equal(submission.author_id,3);assert.equal(submission.visibility,'private');
    const attachment=await db.prepare('SELECT file_path,file_size_bytes FROM submission_attachments WHERE submission_id=?').bind(submission.id).first();
    assert(attachment);
    const object=await(await mf.getR2Bucket('ATTACHMENTS')).get(attachment.file_path);
    assert(object);assert.equal(await object.text(),`SYNTHETIC VOLUNTEER ${item.width}`);assert.equal(object.size,attachment.file_size_bytes);
    const legacy=await db.prepare('SELECT status,completion_mode FROM tasks WHERE id=?').bind(item.legacyTaskId).first();
    assert.equal(legacy.status,'planned');assert.equal(legacy.completion_mode,'submission_required');
    assert.equal(await db.prepare('SELECT COUNT(*) count FROM submissions WHERE task_id=?').bind(item.legacyTaskId).first('count'),0);
    const lead=await db.prepare('SELECT user_id FROM activity_team_leaders WHERE team_id=?').bind(item.teamId).first();
    assert(lead);assert.equal(lead.user_id,null);
    assert.equal(await db.prepare("SELECT COUNT(*) count FROM activity_team_members WHERE team_id=? AND role='leader' AND active=1").bind(item.teamId).first('count'),0);
  }
  assert(observations.length>=30);
  assert(observations.every(item=>item.rscAction&&item.requestType?.startsWith('multipart/form-data')&&[200,303].includes(item.status)));
  await writeFile(path.join(output,'requests.json'),JSON.stringify(observations,null,2));
  console.log(`PASS actual hydrated volunteer flow: ${manifest.checks} browser checks at 1280/390px; ${observations.length} real RSC form POSTs`);
  if(manifest.adminSpa)console.log('PASS admin SPA updates reset participant/team selectors and remove departed rows without forced reload; task/submission persistence is separately reloaded');
  console.log('PASS final isolated D1/R2: direct completion actors/times/history, optional private TXT bytes, single leader revocation, legacy submission rule preserved');
}finally{server.close();await mf.dispose();}
