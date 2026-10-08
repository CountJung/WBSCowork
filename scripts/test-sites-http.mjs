/** Exercises the production bundle in workerd with synthetic signed JWTs and local D1/R2. */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Miniflare, Log, LogLevel } from "miniflare";
import { encode } from "next-auth/jwt";
import { verifyBugHttp } from "./verify-bug-http.mjs";
import { verifySitesCrud } from "./verify-sites-crud.mjs";

const origin = "https://wbscowork.cometgnome.chatgpt.site";
const secret = randomBytes(32).toString("hex");
const providerSecret = "synthetic-google-secret-not-a-credential";
async function moduleFiles(directory) {
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())result.push(...await moduleFiles(file));
    else if(entry.name.endsWith(".js"))result.push(file);
  }
  return result;
}
const entry=path.resolve("dist/server/index.js");
const modules=[entry,...(await moduleFiles(path.resolve("dist/server"))).filter(file=>file!==entry)].map(file=>({type:"ESModule",path:file}));
const mf = new Miniflare({
  name: "wbscowork-test", modules, modulesRoot: path.resolve("dist/server"),
  compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
  d1Databases: {DB:"wbs-http-test"}, r2Buckets: {ATTACHMENTS:"wbs-http-files"},
  assets: {directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},
  bindings: {NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:"synthetic.apps.googleusercontent.com",GOOGLE_CLIENT_SECRET:providerSecret,SUPERUSER_EMAIL:"superuser@example.test"},
  log: new Log(LogLevel.ERROR),
});
let checks=0;
function check(value,message){assert.ok(value,message);checks++;console.log(`PASS ${message}`);}
async function request(route,cookie,init={}) {return mf.dispatchFetch(origin+route,{...init,headers:{...(cookie?{Cookie:cookie}:{}),...init.headers},redirect:"manual"});}
try {
  const db=await mf.getD1Database("DB"), bucket=await mf.getR2Bucket("ATTACHMENTS");
  for(const file of (await readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort()){
    for(const sql of (await readFile(`drizzle/${file}`,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  }
  const actors=[{id:1,name:"guest",role:"guest"},{id:2,name:"member1",role:"member"},{id:3,name:"member2",role:"member"},{id:4,name:"admin",role:"admin"},{id:5,name:"superuser",role:"admin"}];
  for(const a of actors) await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(a.id,`${a.name}@example.test`,a.name,a.role).run();
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Synthetic project','2026-01-01','2026-12-31')").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'Synthetic task','2026-01-01','2026-12-31')").run();
  for(const [id,author,visibility,marker]of[[1,2,"public","PUBLIC_ONLY_83827"],[2,2,"private","PRIVATE_OWNER1_83827"],[3,3,"private","PRIVATE_OWNER2_83827"]]){
    const key=`submissions/1/${author}/fixture-${id}.txt`;
    await bucket.put(key,marker);
    await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,1,?,?,?,?,?,'text/plain',?)").bind(id,author,marker,visibility,key,`fixture-${id}.txt`,marker.length).run();
    await db.prepare("INSERT INTO submission_attachments(id,submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,?,?,?, 'text/plain',?)").bind(id,id,key,`fixture-${id}.txt`,marker.length).run();
  }
  const anonymous=await request("/api/auth/session");const anonymousBody=await anonymous.text();check(anonymous.status===200&&Object.keys(JSON.parse(anonymousBody)).length===0,`Worker anonymous session empty (${anonymous.status}: ${anonymousBody.slice(0,220)})`);
  let memberHtml="",memberCookie="";
  const actorCookies={};
  for(const a of actors){
    // Deliberately stale/elevated claims must be replaced from database/env on every request.
    const token=await encode({secret,token:{email:`${a.name}@example.test`,name:a.name,role:"admin",isSuperuser:true},maxAge:3600});
    const cookie=`__Secure-next-auth.session-token=${token}`;
    actorCookies[a.name]=cookie;
    const session=await request("/api/auth/session",cookie);const body=await session.json();
    check(session.status===200&&body.user?.role===a.role&&body.user?.isSuperuser===(a.name==="superuser"),`${a.name}: actual Worker JWT role refresh`);
    const workspace=await request("/tasks?projectId=1",cookie);const html=await workspace.text();
    check(workspace.status===200&&html.includes("PUBLIC_ONLY_83827"),`${a.name}: existing workspace renders public submission`);
    check(html.includes("PRIVATE_OWNER1_83827")===["member1","admin","superuser"].includes(a.name),`${a.name}: owner1 private content boundary in SSR`);
    check(html.includes("PRIVATE_OWNER2_83827")===["member2","admin","superuser"].includes(a.name),`${a.name}: owner2 private content boundary in SSR`);
    if(a.name==="member1"){memberHtml=html;memberCookie=cookie;}
    for(const route of ["/admin","/admin/users","/admin/database","/admin/settings","/admin/logs"]){
      const response=await request(route,cookie);const content=await response.text();
      const allowed=a.name==="superuser"||(a.name==="admin"&&["/admin","/admin/users"].includes(route));
      check(allowed?response.status===200:response.status>=300&&response.status<400,`${a.name}: ${route} authorization`);
      check(!content.includes(secret)&&!content.includes(providerSecret),`${a.name}: no runtime secrets in ${route}`);
      if(allowed&&route==="/admin") {
        check(content.includes("DB 대상: Sites D1 (DB)")&&!content.includes("DB 대상: undefined"),`${a.name}: hosted overview identifies D1 binding`);
        check(content.includes("R2 첨부파일")&&!content.includes("MariaDB")&&!content.includes("파일 로그"),`${a.name}: hosted overview uses current storage copy`);
        check(content.includes("슈퍼관리자 계정으로 로그인된 상태입니다.")===(a.name==="superuser"),`${a.name}: overview identity matches effective privilege`);
      }
      if(allowed&&route==="/admin/database") check(content.includes("저장소: Sites D1")&&content.includes("바인딩: DB")&&!content.includes("Port: 0")&&!content.includes("DB 및 기본 테이블 생성"),"hosted database panel uses binding metadata without initialization controls");
      if(allowed&&route==="/admin/users") check(content.includes("로그·세팅·DB 관리는 슈퍼관리자 전용"),`${a.name}: user policy describes narrower superuser access`);
      if(allowed&&route==="/admin/logs") check(content.includes("보존 기간 내 D1 감사 로그")&&!content.includes("영구 감사 로그")&&!content.includes("로그 파일이 없습니다"),"hosted audit view uses retention and date labels");
    }
    for(const route of ["/api/submission-attachments/2","/api/submissions/2/attachment"]){
      const response=await request(route,cookie);const content=await response.text();const allowed=["member1","admin","superuser"].includes(a.name);
      check(response.status===(allowed?200:404)&&(!allowed||content==="PRIVATE_OWNER1_83827"),`${a.name}: ${route} private bytes boundary`);
      check(response.headers.get("Cache-Control")==="private, no-store",`${a.name}: private attachment cache contract`);
    }
  }
  if(process.env.WBSCOWORK_BROWSER_QA === "1" || process.argv.includes("--browser")) {
    const browser=spawn("python",["scripts/test-sites-browser.py"],{stdio:["pipe","inherit","inherit"]});
    browser.stdin.end(JSON.stringify({url:String(await mf.ready),cookie:memberCookie}));
    const result=await new Promise(resolve=>browser.once("exit",resolve));
    check(result===0,"cloud Chromium desktop/mobile QA");
  }
  const actionOrigin=new URL(await mf.ready).origin;
  const createAction=memberHtml.match(/name="(\$ACTION_ID_[^"]*#createSubmissionAction)"/)?.[1];
  check(Boolean(createAction),"real rendered form exposes existing create-submission action");
  function smallForm(content){const boundary="wbs-small-boundary";let body="";for(const [name,value]of[[createAction,""],["projectId","1"],["taskId","1"],["content",content],["visibility","private"]])body+=`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;return body+`--${boundary}--\r\n`;}
  const beforeDenied=await db.prepare("SELECT COUNT(*) AS n FROM submissions").first();
  const denied=await request("/tasks?projectId=1",actorCookies.guest,{method:"POST",headers:{Origin:actionOrigin,"Content-Type":"multipart/form-data; boundary=wbs-small-boundary"},body:smallForm("FORBIDDEN_WRITE")});
  await denied.text();
  check(denied.status>=200&&denied.status<400&&(await db.prepare("SELECT COUNT(*) AS n FROM submissions").first()).n===beforeDenied.n,"guest direct HTTP server-action write denied");
  function largeMultipart(content, delay=0){
    const boundary="wbs-synthetic-upload-boundary";const encoder=new TextEncoder();
    let prefix="";
    for(const [name,value]of[[createAction,""],["projectId","1"],["taskId","1"],["content",content],["visibility","private"]])prefix+=`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    prefix+=`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="limit.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const head=encoder.encode(prefix),tail=encoder.encode(`\r\n--${boundary}--\r\n`);let part=-1;
    const body=new ReadableStream({async pull(controller){if(part===-1){controller.enqueue(head);part=0;return;}if(part<20){if(delay)await new Promise(resolve=>setTimeout(resolve,delay));controller.enqueue(new Uint8Array(1024*1024));part++;return;}controller.enqueue(tail);controller.close();}});
    return {method:"POST",headers:{Origin:actionOrigin,"Content-Type":`multipart/form-data; boundary=${boundary}`,"Content-Length":String(head.length+20*1024*1024+tail.length)},body,duplex:"half"};
  }
  const firstUpload=request("/tasks?projectId=1",memberCookie,largeMultipart("MAX_UPLOAD_ONE",60));
  await new Promise(resolve=>setTimeout(resolve,40));
  const secondUpload=request("/tasks?projectId=1",memberCookie,largeMultipart("MAX_UPLOAD_TWO",60));
  const uploadResponses=await Promise.all([firstUpload,secondUpload]);
  check(uploadResponses.some(response=>response.status===503),"concurrent maximum uploads respect one-request admission limit");
  check(uploadResponses.some(response=>response.status>=200&&response.status<400),"actual Worker accepts one20MiB upload through the unchanged form action");
  const uploaded=await db.prepare("SELECT sa.file_path,sa.file_size_bytes FROM submission_attachments sa JOIN submissions s ON s.id=sa.submission_id WHERE s.content IN ('MAX_UPLOAD_ONE','MAX_UPLOAD_TWO')").all();
  check(uploaded.results.length===1&&uploaded.results[0].file_size_bytes===20*1024*1024,"large-upload metadata commits once");
  check((await bucket.head(uploaded.results[0].file_path))?.size===20*1024*1024,"large-upload R2 bytes match declared size");
  check((await request("/api/auth/session",memberCookie)).status===200,"Worker remains responsive after maximum upload");
  await verifyBugHttp({request,db,actorCookies,actionOrigin,secret,check});
  await verifySitesCrud({request,db,bucket,actorCookies,actionOrigin,check});
  await db.prepare("UPDATE users SET role='guest' WHERE id=2").run();
  const refreshed=await(await request("/api/auth/session",memberCookie)).json();
  check(refreshed.user.role==="guest"&&!refreshed.user.isSuperuser,"same signed cookie immediately observes role downgrade");
  const csrf=await request("/api/auth/csrf",memberCookie);const csrfBody=await csrf.json();
  const cookie=memberCookie+"; "+csrf.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  const signedOut=await request("/api/auth/signout",cookie,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({csrfToken:csrfBody.csrfToken,callbackUrl:origin,json:"true"})});
  check(signedOut.headers.getSetCookie().some(c=>c.startsWith("__Secure-next-auth.session-token=")&&/Max-Age=0/i.test(c)),"Worker logout clears session cookie");
  check(Object.keys(await(await request("/api/auth/session")).json()).length===0,"after browser cookie removal session is anonymous");
  await writeFile(".test-artifacts/worker-member.html",memberHtml);
  check((await request("/submissions/1/2/fixture-2.txt",memberCookie)).status===404,"private R2 key is not a public object route");
  console.log(`Actual Worker HTTP role checks passed: ${checks}. Locally signed synthetic sessions; actual Google sign-in is not tested.`);
} finally {await mf.dispose();}
