/** Exact compiled Worker team preparation HTTP/SSR/RSC checks. No browser or production access. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { Miniflare, Log, LogLevel } from "miniflare";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

const out=path.resolve(".test-artifacts/team-preparation-http");await mkdir(out,{recursive:true});
const origin="https://team-preparation.example.test",secret=randomBytes(32).toString("hex"),entry=path.resolve("dist/server/index.js");
const before=await buildSnapshot(["dist/server","dist/client"]),assertions=[],trace=[];
const kinds=["meal","facility","senior_care","child_care","recreation","other"];
const labels=["식사준비","시설보수","어르신 돌봄","아동 돌봄","레크레이션","기타"];
const people=[[1,"team-su@example.test","guest"],[2,"team-admin@example.test","admin"],[3,"team-other-admin@example.test","admin"],[4,"team-leader@example.test","member"],[5,"team-member@example.test","member"],[7,"team-other-member@example.test","member"],[8,"team-guest@example.test","guest"]];
const check=(value,label)=>{assert.ok(value,label);assertions.push(label);console.log("PASS "+label);};
const hash=value=>createHash("sha256").update(value).digest("hex");
const errorMarker=value=>/Functions cannot be passed|Only plain objects can be passed|Minified React error|Hydration failed|(?:^|\n)[a-f0-9]+:E\{/m.test(value);
const visible=value=>value.replace(/<!--[\s\S]*?-->/g,"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
async function modules(directory){const result=[];for(const item of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())result.push(...await modules(file));else if(file.endsWith(".js"))result.push({type:"ESModule",path:file});}return result;}
const mf=new Miniflare({cf:false,modules:[{type:"ESModule",path:entry},...(await modules(path.resolve("dist/server"))).filter(item=>item.path!==entry)],modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"team-preparation-http"},r2Buckets:{ATTACHMENTS:"team-preparation-http"},assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},bindings:{NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic",GOOGLE_CLIENT_SECRET:"synthetic-not-credential",SUPERUSER_EMAIL:people[0][1]},log:new Log(LogLevel.ERROR)});
const cookies={};
async function request(route,actor,body,headers={}){
 const response=await consumeWorkerResponse(await mf.dispatchFetch(origin+route,{...(body===undefined?{}:{method:"PUT",body:JSON.stringify(body)}),headers:{...(actor?{Cookie:cookies[actor]}:{}),...(body===undefined?{}:{Origin:origin,"Content-Type":"application/json"}),...headers},redirect:"manual"}),{route,method:body===undefined?"GET":"PUT"});
 trace.push({path:route,method:body===undefined?"GET":"PUT",status:response.status,contentType:response.headers.get("content-type"),cacheControl:response.headers.get("cache-control"),location:response.headers.get("location")});return response;
}
function document(kind,title="합성 "+kind){
 const base={id:randomUUID(),date:"2026-11-01",title,notes:"합성 팀 메모",status:"planned",checks:[{label:"합성 체크",done:false}]};
 const extra=kind==="meal"?{meal:"lunch",expectedPeople:3,amountPerPerson:0.125,unit:"kg"}:kind==="facility"?{materials:"합성 자재",tools:"합성 도구"}:kind==="recreation"?{order:2,time:"10:00",durationMinutes:30,materials:"합성 준비물"}:["senior_care","child_care"].includes(kind)?{time:"09:00",role:"합성 역할",materials:"합성 준비물"}:{materials:"합성 준비물"};
 return {schemaVersion:1,kind,entries:[{...base,...extra},{...base,...extra,id:randomUUID(),date:"2026-11-02",title:title+" 둘째 날",status:"done"}]};
}
const api=team=>`/api/projects/1001/teams/${team}/preparation`,detail=team=>`/projects/1001/teams/${team}/preparation`,list="/projects/1001/teams";
try{
 const db=await mf.getD1Database("DB");for(const file of (await readdir("drizzle")).filter(file=>file.endsWith(".sql")).sort())for(const sql of (await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(sql=>sql.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const [id,email,role]of people){await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(id,email,"Synthetic user "+id,role).run();cookies[id]=`__Secure-next-auth.session-token=${await encode({secret,token:{email,role:"admin",isSuperuser:true},maxAge:3600})}`;}
 for(const id of [1001,1002])await db.prepare("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(?,?,'volunteering','members_only','2026-10-01','2026-12-01')").bind(id,"Synthetic preparation project "+id).run();
 for(const [project,user]of [[1001,2],[1002,3],[1001,4],[1001,5],[1001,7],[1001,8]])await db.prepare("INSERT INTO project_members(project_id,user_id) VALUES(?,?)").bind(project,user).run();
 for(const [index,kind]of kinds.entries()){
  const team=1101+index;await db.prepare("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(?,1001,?,?)").bind(team,kind,"Synthetic "+kind).run();
  for(const user of [4,5])await db.prepare("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,?,?,?,1)").bind(team,user,user===4?"leader":"member").run();
  await db.prepare("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(?,1001,4)").bind(team).run();
 }
 await db.prepare("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1201,1001,'other','OTHER_TEAM_HIDDEN'),(1202,1002,'other','OTHER_PROJECT_HIDDEN')").run();
 await db.prepare("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,1201,7,'leader',1),(1002,1202,3,'leader',1)").run();
 await db.prepare("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(1201,1001,7),(1202,1002,3)").run();
 await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(2001,1001,'Synthetic linked task','2026-10-01','2026-12-01')").run();
 const anonymous=await request(detail(1101));await anonymous.text();const signin=new URL(anonymous.headers.get("location")??"/",origin);check(anonymous.status===307&&signin.pathname==="/api/auth/signin"&&signin.searchParams.get("callbackUrl")===detail(1101),"anonymous detail SSR redirects only to scoped sign-in without following OAuth");
 cookies[99]=`__Secure-next-auth.session-token=${await encode({secret,token:{email:"synthetic-never-registered@example.test",role:"admin",isSuperuser:true},maxAge:3600})}`;
 const missingIdentity=[];for(const route of [list,detail(1101),api(1101)]){const response=await request(route,99),body=await response.text();missingIdentity.push({status:response.status,leaks:body.includes('data-testid="team-preparation"')||body.includes("Synthetic meal")});}
 check(missingIdentity.every(row=>row.status===404&&!row.leaks),"signed identity absent from current DB receives404 on list/detail/API without leaking preparation data");
 const encodedInvalid=await request(detail("1101%0A"),4),encodedInvalidBody=await encodedInvalid.text();check(encodedInvalid.status===404&&!encodedInvalidBody.includes('data-testid="team-preparation"'),"encoded trailing-newline team ID is rejected404 at the compiled page boundary");
 const seeds=[];for(const[index,kind]of kinds.entries()){const doc=document(kind),response=await request(api(1101+index),4,{version:0,mutationKey:randomUUID(),document:doc});const body=await response.json();seeds.push({kind,doc,status:response.status,sheet:body.sheet});}
 check(seeds.every(row=>row.status===200&&row.sheet.version===1&&row.sheet.document.entries.length===2),"all six kinds save two-date preparations through compiled PUT and actual D1");
 check(seeds[0].sheet.mealQuantities[seeds[0].doc.entries[0].id]===0.375&&seeds.slice(1).every(row=>Object.keys(row.sheet.mealQuantities).length===0),"compiled server computes meal quantities and no quantities for other kinds");
 const listing=await request(list,5),listingHtml=await listing.text();await writeFile(path.join(out,"team-list.html"),listingHtml);
 check(listing.status===200&&labels.every(label=>visible(listingHtml).includes(label))&&!listingHtml.includes("OTHER_TEAM_HIDDEN")&&!listingHtml.includes("OTHER_PROJECT_HIDDEN"),"member SSR team list shows all six own kinds and omits other teams/projects");
 check(kinds.every((_,i)=>listingHtml.includes(`href="${detail(1101+i)}"`)),"SSR team list serializes all six protected detail links");
 const teamPages=[];for(const[index,kind]of kinds.entries()){const response=await request(detail(1101+index),4),html=await response.text();teamPages.push({kind,status:response.status,html});await writeFile(path.join(out,`${kind}-detail.html`),html);}
 check(teamPages.every(row=>row.status===200&&row.html.includes('data-testid="team-preparation"')&&visible(row.html).includes("합성 "+row.kind)&&visible(row.html).includes("2026-11-01")&&visible(row.html).includes("2026-11-02")),"six compiled detail pages SSR200 preserve structured saved entries and dates");
 check(teamPages.every(row=>visible(row.html).includes("준비표 편집")&&visible(row.html).includes("최신 준비표 불러오기")&&visible(row.html).includes("최근 저장 이력")&&visible(row.html).includes("KST")),"leader SSR serializes edit/reload/history controls and explicit KST timestamps");
 check(visible(teamPages[0].html).includes("준비 수량 0.375 kg")&&visible(teamPages[1].html).includes("합성 도구")&&visible(teamPages[2].html).includes("합성 역할")&&visible(teamPages[4].html).includes("소요 30분"),"kind-specific meal/facility/care/recreation summaries serialize derived and typed values");
 const readonly=await request(detail(1101),5),readonlyHtml=await readonly.text();await writeFile(path.join(out,"member-readonly.html"),readonlyHtml);
 check(readonly.status===200&&visible(readonlyHtml).includes("읽기 전용입니다")&&!visible(readonlyHtml).includes("준비표 편집"),"active ordinary member detail SSR is read-only despite stale admin/SU JWT flags");
 for(const[actor,name]of [[7,"other team"],[3,"out-of-project admin"],[8,"guest"]]){const response=await request(detail(1101),actor),html=await response.text();check(response.status===404&&!html.includes('data-testid="team-preparation"'),`${name} detail SSR denied404 without preparation payload`);}
 const su=await request(api(1101),1),suBody=await su.json();check(su.status===200&&suBody.sheet.canEdit===true,"compiled fresh authentication authorizes verified unbound env SU with guest DB role");
 const rscHeaders={RSC:"1",Accept:"text/x-component"};const canonical=await request(detail(1101),4,undefined,rscHeaders);await canonical.text();check(canonical.status===307&&canonical.headers.get("location")===detail(1101)+"?_rsc","manual RSC header canonicalizes to exact same protected _rsc URL");
 const rsc=await request(detail(1101)+"?_rsc",4,undefined,rscHeaders),rscText=await rsc.text();await writeFile(path.join(out,"detail.rsc"),rscText);
 check(rsc.status===200&&rsc.headers.get("content-type")?.includes("text/x-component")&&rscText.includes('"initialSheet":')&&rscText.includes('"initialHistory":')&&rscText.includes('"defaultDate":')&&!errorMarker(rscText),"compiled RSC serializes initial document/history/date without server function or error chunks");
 check([...teamPages.map(row=>row.html),listingHtml,readonlyHtml].every(html=>!errorMarker(html)),"compiled SSR pages emit no known React or RSC serialization error markers");
 const nextDoc=document("meal","COMPILED_UPDATED_합성"),update={version:1,mutationKey:randomUUID(),document:nextDoc};const updated=await request(api(1101),4,update),updatedBody=await updated.json();check(updated.status===200&&updatedBody.sheet.version===2&&updatedBody.sheet.mealQuantities[nextDoc.entries[0].id]===0.375,"compiled CAS update persists version2 and server-derived meal quantity");
 const replay=await request(api(1101),4,update);check(replay.status===200&&(await replay.json()).sheet.version===2,"compiled identical PUT retry is idempotent");
 const stale=await request(api(1101),4,{...update,mutationKey:randomUUID()});await stale.text();check(stale.status===409,"compiled stale expected version returns409 without overwriting saved data");
 const refreshed=await request(detail(1101),5),refreshedHtml=await refreshed.text();await writeFile(path.join(out,"refreshed-detail.html"),refreshedHtml);check(refreshed.status===200&&visible(refreshedHtml).includes("COMPILED_UPDATED_합성")&&visible(refreshedHtml).includes("저장 v2"),"SSR refresh after PUT renders saved content and version2");
 const apiRead=await request(api(1101),5),apiBody=await apiRead.json();check(apiRead.status===200&&apiBody.sheet.version===2&&apiBody.history.length===2&&apiBody.sheet.canEdit===false,"compiled GET returns persisted current sheet and two immutable revision metadata rows");
 const blocked=await request(api(1101),5,{...update,version:2,mutationKey:randomUUID()});await blocked.text();check(blocked.status===404,"compiled member mutation remains forbidden despite forged session privileges");
 await db.prepare("UPDATE activity_team_members SET active=0 WHERE team_id=1101 AND user_id=5").run();const revoked=await request(api(1101),5);await revoked.text();check(revoked.status===404,"compiled next request denies revoked team member with existing signed session");await db.prepare("UPDATE activity_team_members SET active=1 WHERE team_id=1101 AND user_id=5").run();
 const tasks=await request("/tasks?projectId=1001",4),tasksHtml=await tasks.text();check(tasks.status===200&&tasksHtml.includes(`href="${list}"`),"compiled task project page exposes team preparation entry link");
 const admin=await request("/admin/projects",2),adminHtml=await admin.text();check(admin.status===200&&adminHtml.includes(`href="${list}"`),"compiled assigned administrator project card exposes preparation entry link");
 const count=await db.prepare("SELECT (SELECT COUNT(*) FROM team_preparation_sheets) sheets,(SELECT COUNT(*) FROM team_preparation_revisions) revisions,(SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM tasks) tasks,(SELECT COUNT(*) FROM submissions) submissions").first();check(Number(count.sheets)===6&&Number(count.revisions)===7&&Number(count.users)===7&&Number(count.tasks)===1&&Number(count.submissions)===0,"actual D1 has six heads/seven revisions with synthetic source counts preserved");
 check(Number((await db.prepare("SELECT COUNT(*) n FROM project_members WHERE user_id=1").first()).n)===0&&(await db.prepare("SELECT role FROM users WHERE id=1").first()).role==="guest","unbound env SU remains guest with no actual account privilege mutation");
 check(trace.filter(row=>row.path.startsWith("/api/")).every(row=>row.cacheControl==="private, no-store"),"all compiled preparation API responses including denials are private/no-store");
 await writeFile(path.join(out,"result.json"),JSON.stringify({complete:true,checks:assertions.length,assertions,requests:trace.length,entrySha256:hash(await readFile(entry)),limitations:"Compiled Worker HTTP+SSR+RSC only. No Chromium launch, actual browser hydration/console, keyboard/focus, touch, responsive viewport rendering or failed-draft interaction proof. No production, real users/data, delete, publication, or operational migrations."},null,2));
}finally{await writeFile(path.join(out,"requests.json"),JSON.stringify(trace,null,2));await mf.dispose();const after=await buildSnapshot(["dist/server","dist/client"]);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,"Compiled Worker artifact mutated during preparation QA");}
