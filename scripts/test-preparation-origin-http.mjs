/** Exact compiled preparation-origin regression. In-process Miniflare dispatch only; outbound network denied. */
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {encode} from "next-auth/jwt";
import {Log,LogLevel,Miniflare} from "miniflare";
import {consumeWorkerResponse} from "./consume-worker-response.mjs";
import {buildSnapshot} from "./test-project-ux-provenance.mjs";

const red=process.argv.includes("--red"),mode=red?"red":"green",out=path.resolve(`.test-artifacts/preparation-origin-http/${mode}`);
await mkdir(out,{recursive:true});await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:"running",mode}));
const entry=path.resolve("dist/server/index.js"),before=await buildSnapshot(["dist/server","dist/client"]);
const currentOrigin="https://wbscowork.count-sungjin.chatgpt.site",oldOrigin="https://old-origin.example.test",unknownOrigin="https://unverified-origin.example.test",attackerOrigin="https://attacker.example.test";
const secret=randomBytes(32).toString("hex"),checks=[],requests=[],cookies={},outboundAttempts=[];
const hash=value=>createHash("sha256").update(value).digest("hex"),check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log("PASS "+label);};
async function modules(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())result.push(...await modules(file));else if(file.endsWith(".js"))result.push({type:"ESModule",path:file});}return result;}
// These host strings never go through DNS or Node global fetch. All browser-like
// requests below are dispatched to this isolated Worker, with no redirect follow.
const mf=new Miniflare({cf:false,host:"127.0.0.1",modules:[{type:"ESModule",path:entry},...(await modules(path.resolve("dist/server"))).filter(item=>item.path!==entry)],modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"preparation-origin-http"},r2Buckets:{ATTACHMENTS:"preparation-origin-http"},assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},bindings:{NEXTAUTH_URL:oldOrigin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic-origin",GOOGLE_CLIENT_SECRET:"synthetic-not-credential",SUPERUSER_EMAIL:"synthetic-origin-su@example.test"},outboundService:async request=>{outboundAttempts.push({origin:new URL(request.url).origin,method:request.method});throw new Error("External requests are forbidden in preparation-origin QA");},log:new Log(LogLevel.ERROR)});
const route="/api/projects/6/teams/4/preparation";
async function request(actor,{ingress=currentOrigin,origin=currentOrigin,body,headers={},method=body===undefined?"GET":"PUT",target=route}={}){
 const response=await consumeWorkerResponse(await mf.dispatchFetch(ingress+target,{method,headers:{...(actor?{Cookie:cookies[actor]}:{}),...(origin===null?{}:{Origin:origin}),...(body===undefined?{}:{"Content-Type":"application/json"}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"manual"}),{route:target,method});
 const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=null;}
 requests.push({actor:actor??null,ingress,origin:origin??null,target,method,hostHeader:headers.Host??headers.host??null,forwardedHostHeader:headers["X-Forwarded-Host"]??headers["x-forwarded-host"]??null,secFetchSite:headers["Sec-Fetch-Site"]??null,status:response.status,code:value?.code??null,contentType:response.headers.get("content-type"),cacheControl:response.headers.get("cache-control"),location:response.headers.get("location")});return{status:response.status,value,text,headers:response.headers};
}
const people=[[1,"su","guest"],[2,"leader","member"],[3,"member","member"],[4,"unrelatedAdmin","admin"],[5,"outsider","member"],[6,"guest","guest"],[7,"otherTeam","member"]];
const row=(title,order,durationMinutes,time,materials="",notes="")=>({id:randomUUID(),date:"2026-10-24",title,notes,status:"planned",checks:[],order,time,durationMinutes,materials});
const original=row("QA 합성 이름 없는 게임",1,15,"","합성 색종이");
const document={schemaVersion:1,kind:"recreation",entries:[original]};
const fiveRows={schemaVersion:1,kind:"recreation",entries:[original,row("QA-V26 겹침 A — 전체 제목 표시 확인용 긴 합성 프로그램",2,60,"10:00","QA 합성 종이","QA-V26 일회성 합성 검증. 원본 v1 내용 유지 및 검증 후 복원."),row("QA-V26 겹침 B",3,30,"10:15"),row("QA-V26 짧은 일정 5분",4,5,"10:45"),row("QA-V26 자정 넘김",5,30,"23:50")]};
const update={version:1,mutationKey:randomUUID(),document:fiveRows};
let stateEvidence,expectedSuccessFailure;
try{
 await mf.ready;check(true,"Miniflare starts with cf:false and an explicit outbound-denial service; no operating connection is made");
 const db=await mf.getD1Database("DB"),bucket=await mf.getR2Bucket("ATTACHMENTS");
 for(const file of(await readdir("drizzle")).filter(name=>name.endsWith(".sql")).sort())for(const sql of(await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const[id,name,role]of people){const email=name==="su"?"synthetic-origin-su@example.test":`synthetic-origin-${name.toLowerCase()}@example.test`;await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(id,email,"SYNTHETIC_"+name,role).run();cookies[name]=`__Secure-next-auth.session-token=${await encode({secret,token:{email,name:"SYNTHETIC_"+name,role:name==="su"?"guest":"admin",isSuperuser:name!=="su"},maxAge:3600})}`;}
 await db.prepare("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(6,'Synthetic origin project','volunteering','members_only','2026-10-01','2026-12-31'),(7,'Synthetic other project','volunteering','members_only','2026-10-01','2026-12-31')").run();
 for(const[project,user]of[[6,2],[6,3],[7,4],[6,6],[6,7]])await db.prepare("INSERT INTO project_members(project_id,user_id) VALUES(?,?)").bind(project,user).run();
 await db.prepare("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(4,6,'recreation','Synthetic origin recreation'),(5,6,'other','Synthetic other team')").run();
 for(const[team,user,role]of[[4,2,"leader"],[4,3,"member"],[5,7,"leader"]])await db.prepare("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(6,?,?,?,1)").bind(team,user,role).run();
 await db.prepare("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(4,6,2),(5,6,7)").run();
 const seedKey=randomUUID(),seedHash=hash(JSON.stringify({projectId:6,teamId:4,actorId:1,expectedVersion:0,document})),seedText=JSON.stringify(document),at="2026-10-28T11:00:00.000Z";
 await db.prepare("INSERT INTO team_preparation_sheets(team_id,project_id,version,document_json,updated_by,updated_at,mutation_key,request_hash) VALUES(4,6,1,?,1,?,?,?)").bind(seedText,at,seedKey,seedHash).run();
 await db.prepare("INSERT INTO team_preparation_revisions(team_id,project_id,version,document_json,changed_by,changed_at,mutation_key,request_hash) VALUES(4,6,1,?,1,?,?,?)").bind(seedText,at,seedKey,seedHash).run();
 const sentinel=Buffer.from("SYNTHETIC_ORIGIN_ORIGINAL_OBJECT_KEEP"),sentinelKey="synthetic/preparation-origin/original.txt";await bucket.put(sentinelKey,sentinel);
 const head=async()=>await db.prepare("SELECT * FROM team_preparation_sheets WHERE team_id=4").first(),revision=async()=>await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=4 AND version=1").first();
 const originalHead=JSON.stringify(await head()),originalRevision=JSON.stringify(await revision());
 check((await request("su")).status===200,"verified env SU reads the existing private preparation despite guest DB role and no membership");
 const attempted=await request("su",{body:update,headers:{Host:new URL(currentOrigin).host,"Sec-Fetch-Site":"same-origin"}});
 if(red){
  try{assert.equal(attempted.status,200,"exact five-row save should succeed after a public-host move");}catch(error){expectedSuccessFailure=String(error);}
  check(attempted.status===403&&attempted.value?.code==="INVALID_ORIGIN","RED: exact same-current-ingress/Origin five-row PUT fails403 INVALID_ORIGIN with the old server canonical URL");
  check(JSON.stringify(await head())===originalHead&&JSON.stringify(await revision())===originalRevision&&Number((await db.prepare("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=4").first()).n)===1,"RED: failed save preserves the exact original one-row v1 head and immutable receipt");
  check((await request("su",{ingress:oldOrigin,origin:oldOrigin,body:{}})).status===400,"RED control: matching old canonical/ingress passes the origin gate and reaches input validation without a write");
  stateEvidence={version:1,entryCount:1,revisionCount:1,exactOriginalPreserved:true,attemptedRows:fiveRows.entries.length};
 }else{
  check(attempted.status===200&&attempted.value?.sheet?.version===2,"current verified public ingress and exact matching Origin save all five rows despite stale NEXTAUTH_URL");assert.deepEqual(attempted.value.sheet.document,fiveRows);
  const fresh=await request("member");check(fresh.status===200&&fresh.value.sheet.version===2&&fresh.value.history.length===2,"authorized member fresh read persists version2 and exactly two revision metadata rows");assert.deepEqual(fresh.value.sheet.document,fiveRows);
  check((await request("su",{body:update})).status===200,"identical mutation-token retry is idempotent without adding a revision");
  check((await request("su",{body:{...update,document:{...fiveRows,entries:[{...original,title:"FORBIDDEN_ALTERED_REPLAY"}]}}})).status===409,"same-token altered payload is rejected409");
  check((await request("su",{body:{...update,mutationKey:randomUUID()}})).status===409,"fresh-token stale expected version is rejected409");
  check((await request("su",{ingress:oldOrigin,origin:oldOrigin,body:{}})).status===400,"old canonical origin remains accepted only on its own exact ingress and reaches validation");
  for(const[ingress,origin,headers,label]of[
   [currentOrigin,oldOrigin,{},"old Origin on current ingress"],[oldOrigin,currentOrigin,{},"current Origin on old ingress"],
   [currentOrigin,"null",{},"opaque null Origin"],[currentOrigin,"",{},"empty Origin"],
   [currentOrigin,attackerOrigin,{Host:new URL(currentOrigin).host,"X-Forwarded-Host":new URL(currentOrigin).host},"attacker Origin with forged matching Host/XFH"],
   [unknownOrigin,unknownOrigin,{},"unverified same-origin ingress"],
   [unknownOrigin,currentOrigin,{Host:new URL(currentOrigin).host,"X-Forwarded-Host":new URL(currentOrigin).host},"unknown ingress disguised by Host/XFH"],
  ]){const denied=await request("su",{ingress,origin,headers,body:{version:2,mutationKey:randomUUID(),document:fiveRows}});check(denied.status===403&&denied.value?.code==="INVALID_ORIGIN",`${label} is rejected403 without trusting client host headers`);}
  const missing=await request("su",{origin:null,body:{version:2,mutationKey:randomUUID(),document:fiveRows}});check(missing.status===403&&missing.value?.code==="INVALID_ORIGIN","missing Origin is rejected403");
  for(const actor of["member","otherTeam","unrelatedAdmin","outsider","guest"]){const denied=await request(actor,{body:{version:2,mutationKey:randomUUID(),document:fiveRows}});check(denied.status===404,`${actor} cannot mutate the preparation despite signed stale privilege flags`);}
  check((await request(undefined,{body:{version:2,mutationKey:randomUUID(),document:fiveRows}})).status===401,"anonymous save remains behind the login401 boundary");
  for(const actor of["otherTeam","unrelatedAdmin","outsider","guest"])check((await request(actor)).status===404,`${actor} cannot read the private preparation`);
  await db.prepare("UPDATE activity_team_members SET active=0 WHERE team_id=4 AND user_id=3").run();try{check((await request("member")).status===404,"team revocation denies the next read with the existing signed session");}finally{await db.prepare("UPDATE activity_team_members SET active=1 WHERE team_id=4 AND user_id=3").run();}
  check((await request("leader",{body:{version:2,mutationKey:randomUUID(),document:fiveRows}})).status===200,"canonical team leader retains the existing authorized save path");
  check(JSON.stringify(await revision())===originalRevision,"original v1 document and receipt remain byte-for-byte unchanged after permitted updates");
  const finalHead=await head(),revisions=Number((await db.prepare("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=4").first()).n);check(Number(finalHead.version)===3&&revisions===3&&JSON.parse(finalHead.document_json).entries.length===5,"only the SU save and later authorized leader save create revisions; denials/replays create none");
  stateEvidence={version:3,entryCount:5,revisionCount:revisions,exactOriginalV1Preserved:true};
 }
 const object=await bucket.get(sentinelKey);check(object&&hash(new Uint8Array(await object.arrayBuffer()))===hash(sentinel),"original synthetic R2 object remains byte-for-byte unchanged");
 check(Number((await db.prepare("SELECT COUNT(*) n FROM project_members WHERE user_id=1").first()).n)===0&&(await db.prepare("SELECT role FROM users WHERE id=1").first()).role==="guest","env SU remains unbound with guest DB role; no account privilege was changed");
 check(requests.every(item=>item.cacheControl==="private, no-store"),"API success and denial responses remain private/no-store");
 check(outboundAttempts.length===0,"no outbound fetch was attempted; all requests used isolated Miniflare dispatch only");
 await writeFile(path.join(out,"result.json"),JSON.stringify({complete:!red,diagnosticComplete:true,mode,checks:checks.length,assertions:checks,requests:requests.length,entrySha256:hash(await readFile(entry)),stateEvidence,...(red?{reproduced:true,greenAcceptance:false,expectedSuccessFailure,observed:{status:attempted.status,code:attempted.value?.code,message:attempted.value?.message}}:{}),outboundAttempts,nodeGlobalFetchCalledByHarness:false,logicalHostOnly:true,limits:"Synthetic in-process compiled Worker/D1/R2 only. No operating request or data, browser, NAS/MariaDB, deployment, deletion, role/environment change. Public hostname is only a logical dispatch URL, never a network target."},null,2));
}catch(error){console.error(error);process.exitCode=1;await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,diagnosticComplete:false,mode,checks:checks.length,assertions:checks,error:String(error),requests:requests.length,outboundAttempts},null,2));}
finally{await writeFile(path.join(out,"requests.json"),JSON.stringify(requests,null,2));await mf.dispose();const after=await buildSnapshot(["dist/server","dist/client"]);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,"Compiled preparation origin artifact changed during QA");}
