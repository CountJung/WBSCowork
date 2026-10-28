/** Exact compiled Worker project portal regression. Synthetic ephemeral D1/R2 only; no browser/production/deletion. */
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {createServer} from "node:net";
import {encode} from "next-auth/jwt";
import {Log,LogLevel,Miniflare} from "miniflare";
import {consumeWorkerResponse} from "./consume-worker-response.mjs";
import {buildSnapshot} from "./test-project-ux-provenance.mjs";

const out=path.resolve(".test-artifacts/project-portal-http"),entry=path.resolve("dist/server/index.js");await mkdir(out,{recursive:true});
await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:"running"}));
const before=await buildSnapshot(["dist/server","dist/client"]),secret=randomBytes(32).toString("hex");
// Use the real loopback Host for both Vinext's multipart CSRF boundary and the
// app's server-owned NEXTAUTH_URL check, just as a normal same-origin client does.
const portProbe=createServer();await new Promise(resolve=>portProbe.listen(0,"127.0.0.1",resolve));const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));const origin=`http://127.0.0.1:${port}`;
const checks=[],trace=[],pages=[],mediaProof=[];
const sha=value=>createHash("sha256").update(value).digest("hex");
const errorMarker=value=>/Functions cannot be passed|Only plain objects can be passed|Minified React error|Hydration failed|(?:^|\n)[a-f0-9]+:E\{/m.test(value);
const text=html=>html.replace(/<!--[\s\S]*?-->/g,"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log("PASS "+label);};
async function modules(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())result.push(...await modules(file));else if(file.endsWith(".js"))result.push({type:"ESModule",path:file});}return result;}
const mf=new Miniflare({cf:false,host:"127.0.0.1",port,modules:[{type:"ESModule",path:entry},...(await modules(path.resolve("dist/server"))).filter(item=>item.path!==entry)],modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"portal-http"},r2Buckets:{ATTACHMENTS:"portal-http"},assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},bindings:{NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic-portal",GOOGLE_CLIENT_SECRET:"synthetic-not-credential",SUPERUSER_EMAIL:"portal-su@example.test"},log:new Log(LogLevel.ERROR)});
const people=[[1,"su","guest"],[2,"adminA","admin"],[3,"adminB","admin"],[4,"leaderA","member"],[5,"memberA","member"],[6,"memberB","member"],[7,"guestA","guest"],[8,"nonmember","member"],[9,"otherTeamA","member"]],cookies={};
const p=1001,otherProject=1002,mealTeam=1101,privateTeam=1102,mediaTeam=1103;
const base=`/projects/${p}`,api=`/api/projects/${p}/presentation`,teamApi=team=>`${api}/teams/${team}`,prepApi=team=>`/api/projects/${p}/teams/${team}/preparation`,mediaApi=`/api/projects/${p}/teams/${mediaTeam}/media`;
const initialMarker="PORTAL_SHARED_V1_한글",draftMarker="PORTAL_NEW_PRIVATE_DRAFT_V2",privateMarker="PORTAL_OTHER_TEAM_PRIVATE_KEEP",legacyMarker="LEGACY_PRIVATE_ORIGINAL_KEEP";
function preparation(title,kind="meal"){
 const base={id:randomUUID(),date:"2026-11-01",title,notes:title+" 메모",status:"planned",checks:[{label:"합성 체크",done:false}]};
 return {schemaVersion:1,kind,entries:[kind==="meal"?{...base,meal:"lunch",expectedPeople:3,amountPerPerson:0.125,unit:"kg"}:{...base,order:1,time:"14:00",durationMinutes:20,materials:"합성 준비물"}]};
}
async function request(route,actor,body,{method=body===undefined?"GET":"PUT",headers={}}={}){
 const multipart=body instanceof FormData;
 // Node global FormData and Miniflare's separate Undici FormData are different
 // constructors. Serialize once with its own Request, then forward exact bytes
 // and the generated boundary instead of sending the literal [object FormData].
 let wireBody=body===undefined?undefined:JSON.stringify(body),wireHeaders=body===undefined?{}:{"Content-Type":"application/json"};
 if(multipart){const encoded=new Request(origin+route,{method,body});wireBody=new Uint8Array(await encoded.arrayBuffer());wireHeaders={"Content-Type":encoded.headers.get("content-type"),"Content-Length":String(wireBody.byteLength)};assert(wireHeaders["Content-Type"].startsWith("multipart/form-data; boundary="));}
 const response=await consumeWorkerResponse(await mf.dispatchFetch(origin+route,{method,headers:{...(actor?{Cookie:cookies[actor]}:{}),...(body===undefined?{}:{Origin:origin,...wireHeaders}),...headers},...(body===undefined?{}:{body:wireBody}),redirect:"manual"}),{route,method});
 trace.push({route,actor:actor??null,method,requestContentType:wireHeaders["Content-Type"]??null,status:response.status,contentType:response.headers.get("content-type"),cacheControl:response.headers.get("cache-control"),location:response.headers.get("location")});return response;
}
async function json(route,actor,body,options){const response=await request(route,actor,body,options),value=await response.json();return{response,value};}
async function page(route,actor){const response=await request(route,actor),html=await response.text();const row={route,actor,status:response.status,html};pages.push(row);await writeFile(path.join(out,`${actor??"anonymous"}-${route.replaceAll("/","_").replaceAll("?","_")}.html`),html);return row;}
const input=(document,version,mutationKey=randomUUID())=>({document,version,mutationKey});
try{
 check(new URL(await mf.ready).origin===origin,"test server, canonical auth URL and request Origin share one explicit loopback endpoint");
 const db=await mf.getD1Database("DB"),bucket=await mf.getR2Bucket("ATTACHMENTS");
 for(const file of(await readdir("drizzle")).filter(name=>name.endsWith(".sql")).sort())for(const sql of(await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(sql=>sql.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const[id,name,role]of people){const email=name==="su"?"portal-su@example.test":`portal-${name.toLowerCase()}@example.test`;await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(id,email,"SYNTHETIC_"+name,role).run();cookies[name]=`next-auth.session-token=${await encode({secret,token:{email,name:"SYNTHETIC_"+name,role:name==="su"?"guest":"admin",isSuperuser:name!=="su"},maxAge:3600})}`;}
 await db.prepare("INSERT INTO projects(id,name,project_type,access_mode,goal,start_date,end_date) VALUES(1001,'PORTAL_PROJECT_A','volunteering','legacy_authenticated','합성 봉사 목표','2026-10-01','2027-12-01'),(1002,'PORTAL_PROJECT_B','volunteering','members_only','합성 B 목표','2026-10-01','2027-12-01')").run();
 for(const[project,user]of[[p,2],[otherProject,3],[p,4],[p,5],[otherProject,6],[p,7],[p,9]])await db.prepare("INSERT INTO project_members(project_id,user_id) VALUES(?,?)").bind(project,user).run();
 await db.prepare("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1101,1001,'meal','PORTAL_MEAL_A'),(1102,1001,'recreation','PORTAL_PRIVATE_TEAM_A'),(1103,1001,'media','PORTAL_MEDIA_A'),(1201,1002,'meal','PORTAL_TEAM_B')").run();
 for(const[team,user,role]of[[mealTeam,4,"leader"],[mealTeam,5,"member"],[privateTeam,9,"leader"],[mediaTeam,4,"leader"],[mediaTeam,5,"member"]])await db.prepare("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) VALUES(1001,?,?,?,1)").bind(team,user,role).run();
 for(const[team,user]of[[mealTeam,4],[privateTeam,9],[mediaTeam,4]])await db.prepare("INSERT INTO activity_team_leaders(team_id,project_id,user_id) VALUES(?,1001,?)").bind(team,user).run();
 await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id) VALUES(2001,1001,'LEGACY_WBS_TASK_A','2026-10-01','2027-12-01',4),(2002,1002,'PRIVATE_PROJECT_B_TASK','2026-10-01','2027-12-01',6)").run();
 await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility,created_at) VALUES(3001,2001,5,?,'private','2026-10-22 01:00:00')").bind(legacyMarker).run();
 await db.prepare("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,created_at) VALUES(3001,1,5,?,'private','2026-10-22 01:00:00')").bind(legacyMarker).run();
 const legacyBytes=Buffer.from("SYNTHETIC_ORIGINAL_ATTACHMENT_KEEP"),legacyKey="synthetic/portal-regression/original.txt";await bucket.put(legacyKey,legacyBytes);
 await db.prepare("INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes,created_at) VALUES(5001,3001,1,?,'original.txt','text/plain',?,'2026-10-22 01:00:00')").bind(legacyKey,legacyBytes.length).run();
 const anonymous=await request(base);await anonymous.text();check([302,303,307,308].includes(anonymous.status)&&/signin/.test(anonymous.headers.get("location")??""),"anonymous portal page redirects to login without exposing data");
 check((await request(api)).status===401,"anonymous portal API uses login401 boundary");
 const legacy=await page(`/tasks?projectId=${p}`,"nonmember");check(legacy.status===200&&legacy.html.includes("LEGACY_WBS_TASK_A")&&!legacy.html.includes(legacyMarker),"old legacy WBS remains readable without retroactive portal membership or private submission leakage");
 for(const actor of["nonmember","memberB","adminB"]){const home=await page(base,actor),settings=await page(base+"/settings",actor),response=await request(api,actor);await response.text();check(home.status===404&&settings.status===404&&response.status===404&&!home.html.includes("PORTAL_PROJECT_A"),`${actor} cannot enter A portal/settings/API even when old WBS is legacy-readable`);}
 const su=await json(api,"su"),member=await json(api,"memberA"),guest=await json(api,"guestA");check(su.response.status===200&&su.value.portal.canManage===true&&member.response.status===200&&guest.response.status===200,"verified unbound env SU and active project member/guest have their intended portal scope");
 check(member.value.teams.every(team=>!Object.hasOwn(team,"document")),"team directory response contains metadata without private preparation bodies");
 const adminHome=await page(base,"adminA"),memberHome=await page(base,"memberA"),settingsPage=await page(base+"/settings","adminA");
 check([adminHome,memberHome,settingsPage].every(row=>row.status===200&&row.html.includes('data-testid="project-portal"')),"portal home/layout/settings SSR200 render inside the project shell");
 const links=[base,base+"/activities",base+"/media",`/tasks?projectId=${p}`,base+"/settings",`/admin/projects/${p}/reports`,"/","/guide"];
 // Scoped menu links register in a client effect; SSR cannot prove the opened menu.
 // Verify the initial accessible trigger and project/body structure, then request
 // the authorized destination routes independently without claiming link clicks.
 const menuButtons=adminHome.html.match(/<button\b[^>]*aria-controls="app-navigation"[^>]*>/g)??[];
 check(menuButtons.length===1&&/aria-label="메뉴 열기"/.test(menuButtons[0])&&/aria-expanded="false"/.test(menuButtons[0])&&/aria-haspopup="dialog"/.test(menuButtons[0]),"SSR has exactly one named top-menu dialog trigger with its initial expanded state false");
 check([adminHome,memberHome].every(row=>row.html.includes('aria-label="현재 프로젝트"')&&row.html.includes('href="/projects"')&&text(row.html).includes("프로젝트 전환")&&row.html.includes('id="project-content"')&&row.html.includes('href="#project-content"')),"SSR retains current-project context, project switching and a real main-content skip target");
 check([adminHome,memberHome,settingsPage].every(row=>!/<aside\b/i.test(row.html)&&!row.html.includes('id="project-sidebar"')),"portal SSR removes the persistent project aside and duplicate sidebar navigation");
 const linkedPages=[];for(const route of links)linkedPages.push(pages.find(row=>row.route===route&&row.actor==="adminA"&&row.status===200)??await page(route,"adminA"));
 check(linkedPages.every(row=>row.status===200&&!errorMarker(row.html)),"authorized project, WBS, report and common destination routes resolve through actual HTTP SSR without serialization errors; client menu registration is not exercised");
 check(!memberHome.html.includes(`href="${base}/settings"`)&&(await page(base+"/settings","leaderA")).status===404,"ordinary member SSR does not expose settings links and a team leader direct settings URL is denied");
 const settingsInput={version:0,mutationKey:randomUUID(),layout:"workspace",title:"PORTAL_CUSTOM_TITLE_한글",intro:"PORTAL_CUSTOM_INTRO\n둘째 줄"};
 const saved=await json(api,"adminA",settingsInput);check(saved.response.status===200&&saved.value.portal.settings.version===1&&saved.value.portal.settings.layout==="workspace","assigned administrator saves portal layout/title/intro through compiled CAS API");
 const savedRefresh=await page(base,"memberA");check(savedRefresh.status===200&&savedRefresh.html.includes(settingsInput.title)&&savedRefresh.html.includes("PORTAL_CUSTOM_INTRO")&&text(savedRefresh.html).includes("프로젝트 작업 공간"),"SSR refresh retains saved title/intro and workspace layout");
 check((await request(api,"adminA",settingsInput)).status===200&&(await request(api,"adminA",{...settingsInput,mutationKey:randomUUID()})).status===409,"settings same-token replay deduplicates while a stale fresh mutation conflicts409");
 check((await request(api,"memberA",{...settingsInput,version:1,mutationKey:randomUUID()})).status===404&&(await request(api,"adminB",{...settingsInput,version:1,mutationKey:randomUUID()})).status===404,"settings writes cannot be elevated by member fake-SU cookie or unrelated administrator");
 check((await request(base+"%0A","adminA")).status===404&&(await request(`/api/projects/${p}%0A/presentation`,"adminA")).status===404,"encoded trailing-newline project IDs are rejected consistently by portal pages and APIs");
 check((await request(api,"adminA",{...settingsInput,version:1,mutationKey:randomUUID()+"\n"})).status===400,"settings mutation UUID with trailing newline is rejected before any write");
 await request(api,"adminA",{...settingsInput,version:1,mutationKey:randomUUID(),layout:"volunteer_presentation"});
 const prepV1=preparation(initialMarker),privateV1=preparation(privateMarker,"recreation");
 check((await request(prepApi(mealTeam),"leaderA",input(prepV1,0))).status===200&&(await request(prepApi(privateTeam),"otherTeamA",input(privateV1,0))).status===200,"existing team preparation editor API stores synthetic source snapshots for meal and recreation");
 check((await request(teamApi(mealTeam),"guestA")).status===404&&(await request(teamApi(privateTeam),"memberA")).status===404,"unpublished meal and other-team private preparation remain inaccessible outside the team");
 const own=await page(base+`/activities/${mealTeam}`,"leaderA"),readonly=await page(base+`/activities/${mealTeam}`,"memberA");check(own.status===200&&own.html.includes("식단표 편집")&&readonly.status===200&&!readonly.html.includes("식단표 편집"),"canonical leader gets editing controls while their ordinary member stays read-only");
 const publish={version:0,mutationKey:randomUUID(),audience:"project",preparationVersion:1};
 check((await request(teamApi(mealTeam),"otherTeamA",publish)).status===404,"leader from another team cannot publish this team's preparation");
 const published=await json(teamApi(mealTeam),"leaderA",publish);check(published.response.status===200&&published.value.presentation.published===true&&published.value.presentation.sourceVersion===1,"canonical team leader explicitly publishes immutable preparation revision1 to project members");
 const guestPublished=await json(teamApi(mealTeam),"guestA");check(guestPublished.response.status===200&&JSON.stringify(guestPublished.value).includes(initialMarker)&&guestPublished.value.presentation.mealQuantities[prepV1.entries[0].id]===0.375,"active project guest reads only explicitly shared snapshot with server-derived meal quantity");
 const prepV2=preparation(draftMarker);check((await request(prepApi(mealTeam),"leaderA",input(prepV2,1))).status===200,"later private preparation draft saves as version2");
 const stablePublication=await json(teamApi(mealTeam),"guestA"),sharedHome=await page(base,"guestA");check(JSON.stringify(stablePublication.value).includes(initialMarker)&&!JSON.stringify(stablePublication.value).includes(draftMarker)&&sharedHome.html.includes(initialMarker)&&!sharedHome.html.includes(draftMarker)&&!sharedHome.html.includes(privateMarker),"shared portal snapshot stays at immutable v1 and never exposes new private draft or other-team private content");
 check((await request(prepApi(mealTeam),"guestA")).status===404,"project-shared presentation does not expand guest access to the existing private preparation API");
 const privateDetail=await page(base+`/activities/${privateTeam}`,"memberA");check(privateDetail.status===404&&!privateDetail.html.includes(privateMarker),"other team private activity direct URL denies404 without content");
 // PRD066: new meal rows can start with date/title alone. Keep old snapshots
 // before the new save/publication so compatibility is checked against real bytes.
 const originalMealRows=JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=1101 AND version IN (1,2) ORDER BY version").all()).results);
 const originalPublication=JSON.stringify((await db.prepare("SELECT * FROM team_presentation_revisions WHERE team_id=1101 AND version=1").all()).results);
 const minimalRow={id:randomUUID(),date:"2026-11-02",title:"PORTAL_MINIMAL_MEAL_한글"},blankRow={id:randomUUID(),date:"2026-11-03",title:"PORTAL_BLANK_OPTIONAL_MEAL",status:"planned",meal:"",expectedPeople:"",amountPerPerson:null,unit:"",notes:null,checks:[{label:"",done:false}]};
 const minimalDocument={schemaVersion:1,kind:"meal",entries:[minimalRow,blankRow]};
 const expectedMinimal={schemaVersion:1,kind:"meal",entries:[minimalRow,blankRow].map(row=>({id:row.id,date:row.date,title:row.title,status:"planned",meal:null,expectedPeople:null,amountPerPerson:null,unit:"",notes:"",checks:[]}))};
 const minimalSave=await json(prepApi(mealTeam),"leaderA",input(minimalDocument,2));
 check(minimalSave.response.status===200&&minimalSave.value.sheet.version===3,"meal date/title-only and explicitly blank optional rows save through the compiled preparation PUT as version3");
 assert.deepEqual(minimalSave.value.sheet.document,expectedMinimal);assert.deepEqual(minimalSave.value.sheet.mealQuantities,{});
 const minimalRead=await json(prepApi(mealTeam),"leaderA");
 check(minimalRead.response.status===200&&minimalRead.value.sheet.version===3&&JSON.stringify(minimalRead.value.sheet.document)===JSON.stringify(minimalSave.value.sheet.document)&&Object.keys(minimalRead.value.sheet.mealQuantities).length===0,"fresh GET persists planned defaults, null optional numbers/meal, empty text/checks and no invented zero quantity");
 const beforeMinimalShare=await json(teamApi(mealTeam),"guestA");
 check(beforeMinimalShare.response.status===200&&JSON.stringify(beforeMinimalShare.value).includes(initialMarker)&&!JSON.stringify(beforeMinimalShare.value).includes(minimalRow.title),"saving a minimal private draft does not change the previously selected public version1");
 const minimalShare=await json(teamApi(mealTeam),"leaderA",{version:1,mutationKey:randomUUID(),audience:"project",preparationVersion:3});
 check(minimalShare.response.status===200&&minimalShare.value.presentation.sourceVersion===3&&minimalShare.value.presentation.team.publicationVersion===2,"canonical leader can explicitly share the selected minimal meal version3 despite omitted optional fields");
 const guestMinimal=await json(teamApi(mealTeam),"guestA");
 assert.deepEqual(guestMinimal.value.presentation.document,expectedMinimal);
 check(guestMinimal.response.status===200&&guestMinimal.value.presentation.sourceVersion===3&&Object.keys(guestMinimal.value.presentation.mealQuantities).length===0&&!JSON.stringify(guestMinimal.value).includes(draftMarker),"project guest reads the exact normalized selected minimal snapshot without private version2 or fabricated quantities");
 const minimalHome=await page(base,"guestA"),minimalDetail=await page(base+`/activities/${mealTeam}`,"guestA"),minimalEditorSummary=await page(base+`/teams/${mealTeam}/preparation`,"leaderA");
 check([minimalHome,minimalDetail,minimalEditorSummary].every(row=>row.status===200&&[minimalRow.title,blankRow.title,minimalRow.date,"준비전","미입력"].every(value=>text(row.html).includes(value))&&!/예상 0명|준비 수량:? 0|1인 기준 0|NaN|undefined|\bnull\b|점심|아침|저녁|간식/.test(text(row.html)))&&!minimalHome.html.includes(privateMarker),"shared home/detail and existing preparation editor summary SSR show date/menu/preparation status without invented meal, zero, null or undefined output");
 check([minimalHome,minimalDetail,minimalEditorSummary].every(row=>{const details=[...row.html.matchAll(/<details\b([^>]*)>\s*<summary\b[^>]*>상세 정보 · 선택<\/summary>/g)];return details.length===2&&details.every(match=>!/(?:^|\s)open(?:\s|=|$)/.test(match[1]));}),"meal SSR uses two native optional-details summaries without an initial open attribute; toggling/editor input DOM are not exercised");
 const invalidMealRows=[
  ["missing date",{...minimalRow,date:undefined}],
  ["missing menu",{...minimalRow,title:undefined}],
  ["impossible date",{...minimalRow,date:"2026-02-30"}],
  ["invalid status",{...minimalRow,status:"unknown"}],
  ["null status",{...minimalRow,status:null}],
  ["invalid provided meal",{...minimalRow,meal:"midnight"}],
  ["negative people",{...minimalRow,expectedPeople:-1}],
  ["numeric string people",{...minimalRow,expectedPeople:"3"}],
  ["overprecision amount",{...minimalRow,amountPerPerson:0.0001}],
  ["negative amount",{...minimalRow,amountPerPerson:-1}],
  ["invalid provided unit",{...minimalRow,unit:1}],
  ["invalid checkbox type",{...minimalRow,checks:[{label:"",done:"false"}]}],
 ];
 for(const[label,row]of invalidMealRows)check((await request(prepApi(mealTeam),"leaderA",input({schemaVersion:1,kind:"meal",entries:[row]},3))).status===400,`compiled meal validation rejects ${label} without saving a new revision`);
 check((await request(prepApi(privateTeam),"otherTeamA",input({schemaVersion:1,kind:"recreation",entries:[{id:randomUUID(),date:"2026-11-02",title:"INVALID_MINIMAL_RECREATION"}]},1))).status===400,"meal-only optional defaults do not relax required fields for recreation preparations");
 const afterInvalidMeals=await json(prepApi(mealTeam),"leaderA");
 check(afterInvalidMeals.response.status===200&&afterInvalidMeals.value.sheet.version===3&&Number((await db.prepare("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=1101").first()).n)===3&&Number((await db.prepare("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=1102").first()).n)===1,"all malformed meal/recreation requests leave current sheets and revision counts unchanged");
 check(originalMealRows===JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=1101 AND version IN (1,2) ORDER BY version").all()).results)&&originalPublication===JSON.stringify((await db.prepare("SELECT * FROM team_presentation_revisions WHERE team_id=1101 AND version=1").all()).results)&&JSON.parse((await db.prepare("SELECT document_json FROM team_preparation_revisions WHERE team_id=1101 AND version=1").first()).document_json).entries[0].amountPerPerson===0.125,"existing detailed version1, private version2 and original publication receipt remain byte-for-byte unchanged after minimal meal sharing");
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64"),form=new FormData();
 for(const[key,value]of Object.entries({title:"PORTAL_MEDIA_PRIVATE",caption:"합성 사진만 사용",visibility:"team_private",mutationKey:randomUUID()}))form.set(key,value);form.set("file",new File([png],"synthetic.png",{type:"image/png"}));
 const upload=await json(mediaApi,"leaderA",form,{method:"POST"});check(upload.response.status===201&&upload.value.item?.fileUrl,"compiled media endpoint accepts one actual bounded synthetic PNG upload");
 const item=upload.value.item,privateMedia=await request(item.fileUrl,"memberA"),privateImage=new Uint8Array(await privateMedia.arrayBuffer());check(privateMedia.status===200&&sha(privateImage)===sha(png)&&privateMedia.headers.get("cache-control")==="private, no-store","authorized current media team member receives exact private PNG bytes without shared caching");
 check((await request(item.fileUrl,"otherTeamA")).status===404&&(await request(item.fileUrl,"adminB")).status===404&&(await request(item.fileUrl)).status===401,"media private file denies other-team/unrelated administrator/anonymous direct URLs");
 const mediaListing=await page(base+"/media?teamId="+mediaTeam,"leaderA");check(mediaListing.status===200&&mediaListing.html.includes("PORTAL_MEDIA_PRIVATE")&&mediaListing.html.includes("KST"),"media gallery SSR retains uploaded item and deterministic KST metadata");
 const publicMedia=await json(mediaApi+"/"+item.id,"leaderA",{title:item.title,caption:item.caption,visibility:"project",version:1,mutationKey:randomUUID()},{method:"PATCH"});check(publicMedia.response.status===200&&publicMedia.value.item.version===2,"compiled media PATCH explicitly changes audience while preserving file identity");
 const guestFile=await request(item.fileUrl,"guestA"),guestBytes=new Uint8Array(await guestFile.arrayBuffer());check(guestFile.status===200&&sha(guestBytes)===sha(png)&&(await request(item.fileUrl,"nonmember")).status===404,"project-public media stays inside current portal membership and preserves original bytes");
 const mediaRow=await db.prepare("SELECT file_path,content_hash FROM project_media_items WHERE id=?").bind(item.id).first();const object=await bucket.get(mediaRow.file_path);check(object&&sha(new Uint8Array(await object.arrayBuffer()))===sha(png)&&mediaRow.content_hash===sha(png),"R2 original PNG content hash agrees with compiled download and D1 metadata");mediaProof.push({id:item.id,sha256:sha(png),bytes:png.length});
 await db.prepare("UPDATE activity_team_members SET role='member' WHERE team_id=1101 AND user_id=4").run();await db.prepare("UPDATE activity_team_members SET role='leader' WHERE team_id=1101 AND user_id=5").run();await db.prepare("UPDATE activity_team_leaders SET user_id=5 WHERE team_id=1101").run();
 check((await request(teamApi(mealTeam),"leaderA",{version:2,mutationKey:randomUUID(),audience:"team_private",preparationVersion:3})).status===404&&(await request(prepApi(mealTeam),"leaderA",input(preparation("FORBIDDEN_OLD_LEADER"),3))).status===404,"leader replacement immediately denies old signed session publication and preparation edits");
 const replacedPage=await page(base+`/activities/${mealTeam}`,"leaderA");check(replacedPage.status===200&&!replacedPage.html.includes("식단표 편집"),"former leader can still read allowed snapshot but editing controls disappear");
 await db.prepare("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=5").run();check((await request(api,"memberA")).status===404&&(await request(item.fileUrl,"memberA")).status===404&&(await page(base,"memberA")).status===404,"project membership revocation blocks next portal/API/media request using an existing signed session");await db.prepare("UPDATE project_members SET active=1 WHERE project_id=1001 AND user_id=5").run();
 const rscRoute=base+"/activities",rscHeaders={RSC:"1",Accept:"text/x-component"};let rsc=await request(rscRoute,"adminA",undefined,{headers:rscHeaders});let rscText=await rsc.text();if(rsc.status===307){check(rsc.headers.get("location")===rscRoute+"?_rsc","RSC canonicalization stays on the same scoped portal route");rsc=await request(rscRoute+"?_rsc","adminA",undefined,{headers:rscHeaders});rscText=await rsc.text();}
 check(rsc.status===200&&rsc.headers.get("content-type")?.includes("text/x-component")&&!errorMarker(rscText),"compiled portal RSC payload has no serialized function props or error chunks");await writeFile(path.join(out,"activities.rsc"),rscText);
 check(pages.filter(row=>row.status===200).every(row=>!errorMarker(row.html)),"all successful SSR portal/WBS/media pages contain no React serialization or hydration error markers");
 const legacyObject=await bucket.get(legacyKey);check(legacyObject&&sha(new Uint8Array(await legacyObject.arrayBuffer()))===sha(legacyBytes)&&Number((await db.prepare("SELECT COUNT(*) n FROM submissions").first()).n)===1&&Number((await db.prepare("SELECT COUNT(*) n FROM submission_revisions").first()).n)===1&&Number((await db.prepare("SELECT COUNT(*) n FROM submission_attachments").first()).n)===1,"legacy private submission/revision/attachment metadata and original R2 bytes remain unchanged");
 const oldRevision=await db.prepare("SELECT document_json FROM team_preparation_revisions WHERE team_id=1101 AND version=1").first();check(JSON.parse(oldRevision.document_json).entries[0].title===initialMarker&&Number((await db.prepare("SELECT COUNT(*) n FROM users").first()).n)===people.length&&Number((await db.prepare("SELECT COUNT(*) n FROM projects").first()).n)===2,"immutable original preparation snapshot and synthetic users/projects remain preserved");
 check(trace.filter(row=>row.route.startsWith("/api/projects/")).every(row=>row.cacheControl==="private, no-store"),"all portal/preparation/media API responses and denials remain private/no-store");
 // PRD067: append after all original private-visibility checks. No prior private
 // fixture is published retroactively; a new explicit selected revision is shared.
 const recreationTraceStart=trace.length;
 const recreationV1=JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=1102 AND version=1").all()).results);
 const recEntry=(title,time,durationMinutes,order)=>({id:randomUUID(),date:"2026-10-28",title,time,durationMinutes,order,status:"planned",notes:"로컬 합성 메모",checks:[],materials:"합성 준비물"});
 const longProgram="모두함께하는가을봉사레크레이션긴한국어프로그램".repeat(3);
 const recreationV2={schemaVersion:1,kind:"recreation",entries:[recEntry(longProgram,"10:00",90,1),recEntry("TIMETABLE_OVERLAP","10:30",30,2),recEntry("TIMETABLE_ZERO","11:30",0,3),recEntry("TIMETABLE_UNSCHEDULED","",20,4),recEntry("TIMETABLE_MIDNIGHT","23:30",90,5)]};
 const recSaved=await json(prepApi(privateTeam),"otherTeamA",input(recreationV2,1));
 check(recSaved.response.status===200&&recSaved.value.sheet.version===2,"canonical recreation leader saves overlap/blank-time/zero/midnight/long-title programs as a new private version2");
 const recRead=await json(prepApi(privateTeam),"otherTeamA");assert.deepEqual(recRead.value.sheet.document,recreationV2);
 check(recRead.response.status===200&&recRead.value.sheet.version===2,"fresh compiled GET retains exact recreation event values, order and identities");
 const recDetail=await page(base+`/activities/${privateTeam}`,"otherTeamA"),recEditor=await page(base+`/teams/${privateTeam}/preparation`,"otherTeamA");
 check([recDetail,recEditor].every(row=>row.status===200&&row.html.includes('data-testid="recreation-timetable"')&&[longProgram,"하루 보기","주간 보기","시간표 기준 날짜","전체 일정 목록","0분 입력","시작 시각 미지정","다음날까지"].every(label=>text(row.html).includes(label))&&!errorMarker(row.html)),"actual compiled private detail/preparation SSR include timeline controls and exceptional-time labels without RSC serialization errors; interaction is untested");
 check((await request(teamApi(privateTeam),"memberA")).status===404&&(await request(base+`/activities/${privateTeam}`,"adminB")).status===404,"the new recreation timeline remains private from another team and unrelated project administrator");
 const recShared=await json(teamApi(privateTeam),"otherTeamA",{version:0,mutationKey:randomUUID(),audience:"project",preparationVersion:2});
 check(recShared.response.status===200&&recShared.value.presentation.sourceVersion===2,"canonical leader explicitly publishes selected recreation version2 through the existing guarded API");
 const recGuest=await json(teamApi(privateTeam),"guestA"),recGuestPage=await page(base+`/activities/${privateTeam}`,"guestA");assert.deepEqual(recGuest.value.presentation.document,recreationV2);
 check(recGuest.response.status===200&&recGuestPage.status===200&&recGuestPage.html.includes('data-testid="recreation-timetable"')&&!recGuestPage.html.includes(`href="${base}/teams/${privateTeam}/preparation"`)&&!text(recGuestPage.html).includes("선택한 버전과 공개 범위 저장"),"project guest reads the exact selected timeline and has no preparation-editor or publication-save control");
 const recPrivateMarker="TIMETABLE_NEW_PRIVATE_V3_KEEP",recV3={schemaVersion:1,kind:"recreation",entries:[recEntry(recPrivateMarker,"12:00",45,1)]};
 check((await request(prepApi(privateTeam),"otherTeamA",input(recV3,2))).status===200,"a later recreation draft saves privately as version3 without changing publication selection");
 const recStable=await json(teamApi(privateTeam),"guestA"),recStablePage=await page(base+`/activities/${privateTeam}`,"guestA");assert.deepEqual(recStable.value.presentation.document,recreationV2);
 check(recStable.response.status===200&&recStable.value.presentation.sourceVersion===2&&recStablePage.status===200&&recStablePage.html.includes(longProgram)&&!recStablePage.html.includes(recPrivateMarker)&&!JSON.stringify(recStable.value).includes(recPrivateMarker),"recreation guest API/SSR retain immutable shared version2 and never expose the new private version3");
 await db.prepare("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=9").run();
 try{check((await request(prepApi(privateTeam),"otherTeamA")).status===404&&(await request(teamApi(privateTeam),"otherTeamA")).status===404&&(await request(base+`/activities/${privateTeam}`,"otherTeamA")).status===404,"revoking project membership denies the next timeline/preparation requests even with the existing canonical-leader session");}
 finally{await db.prepare("UPDATE project_members SET active=1 WHERE project_id=1001 AND user_id=9").run();}
 check((await request(teamApi(privateTeam),"adminB")).status===404,"explicit project-internal timeline publication does not admit an unrelated project administrator");
 check(recreationV1===JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=1102 AND version=1").all()).results)&&Number((await db.prepare("SELECT COUNT(*) n FROM team_preparation_revisions WHERE team_id=1102").first()).n)===3,"original private recreation version1 receipt/content is unchanged and SSR reads create no extra revisions");
 check(trace.slice(recreationTraceStart).filter(row=>row.route.startsWith("/api/projects/")).every(row=>row.cacheControl==="private, no-store"),"all new timeline preparation/publication APIs and denials remain private/no-store");
 // Upper-role hierarchy: reuse the existing isolated fixtures only after their
 // original version/count expectations. Admin A has project membership, no team
 // membership; the configured SU remains guest in D1 and has neither membership.
 const hierarchyTraceStart=trace.length,hierarchyProof=[];
 const originalMealV1=JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=? AND version=1").bind(mealTeam).all()).results);
 const originalRoles=JSON.stringify((await db.prepare("SELECT id,role FROM users ORDER BY id").all()).results);
 check(Number((await db.prepare("SELECT COUNT(*) n FROM project_members WHERE user_id=1").first()).n)===0&&Number((await db.prepare("SELECT COUNT(*) n FROM activity_team_members WHERE user_id IN (1,2)").first()).n)===0,"upper-role fixtures require no SU project/team assignment and no administrator team assignment");
 // A lower-ID team outside the leader's scope verifies the existing default
 // read-only selection and the higher roles' team-independent management.
 await db.prepare("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(1099,1001,'media','PORTAL_MEDIA_READONLY_FIRST')").run();
 for(const[actor,role,isSuperuser]of[["su","admin",true],["adminA","admin",false],["memberA","member",false],["guestA","guest",false]]){
  const refreshed=await json("/api/auth/session",actor);
  check(refreshed.response.status===200&&refreshed.value.user?.role===role&&refreshed.value.user?.isSuperuser===isSuperuser,`${actor} session refresh derives effective role/SU from current identity instead of stale signed flags`);
 }
 const defaultLeaderGallery=await page(base+"/media","leaderA");
 const ownLeaderGallery=await page(base+"/media?teamId="+mediaTeam,"leaderA");
 check(defaultLeaderGallery.status===200&&!text(defaultLeaderGallery.html).includes("사진·영상 올리기")&&text(defaultLeaderGallery.html).includes("현재 이 팀은 읽기 전용")&&ownLeaderGallery.status===200&&text(ownLeaderGallery.html).includes("사진·영상 올리기"),"canonical leader sees read-only guidance for another selected team and upload controls for their explicitly selected own team");
 for(const actor of["su","adminA"]){const adminPage=await page("/admin/projects",actor);check(adminPage.status===200&&adminPage.html.includes(`id="project-${p}"`)&&adminPage.html.includes(`href="${base}/media?teamId=${mediaTeam}"`)&&!adminPage.html.includes(`href="${base}/teams/${mediaTeam}/preparation"`),`${actor} project-management media team link targets the real gallery rather than the unsupported preparation route`);}
 const emptyBase=`/projects/${otherProject}`;
 for(const actor of["su","adminB","memberB"]){const empty=await page(emptyBase+"/media",actor),content=text(empty.html),allowed=actor!=="memberB";check(empty.status===200&&content.includes("등록된 미디어팀이 없어")&&empty.html.includes(`href="/admin/projects#project-${otherProject}"`)===allowed&&content.includes("미디어팀 구성하러 가기")===allowed,`${actor} empty-media page shows the project-team setup action only to the scoped administrator or SU`);if(allowed){const adminTarget=await page("/admin/projects",actor);check(adminTarget.status===200&&adminTarget.html.includes(`id="project-${otherProject}"`),`${actor} empty-media setup link has an actual target project anchor`);}}
 const upperMedia=[];
 const pngForm=title=>{const data=new FormData();for(const[key,value]of Object.entries({title,caption:"UPPER_ROLE_SYNTHETIC_ONLY",visibility:"team_private",mutationKey:randomUUID()}))data.set(key,value);data.set("file",new File([png],"upper-role-synthetic.png",{type:"image/png"}));return data;};
 for(const actor of["su","adminA"]){
  const upperPages=await Promise.all([page(base+`/teams/${mealTeam}/preparation`,actor),page(base+`/activities/${mealTeam}`,actor),page(base+"/media?teamId="+mediaTeam,actor),page(base+"/settings",actor)]);
  check(upperPages.every(row=>row.status===200&&!errorMarker(row.html))&&text(upperPages[0].html).includes("준비표 편집")&&text(upperPages[1].html).includes("식단표 편집")&&text(upperPages[1].html).includes("선택한 버전과 공개 범위 저장")&&text(upperPages[2].html).includes("사진·영상 올리기")&&text(upperPages[2].html).includes("미디어 저장")&&text(upperPages[3].html).includes("홈 설정 저장"),`${actor} receives actual preparation/activity/media/settings SSR editing controls without team membership`);
  const prior=await json(prepApi(mealTeam),actor),doc=preparation(`UPPER_ROLE_${actor}_PRIVATE_PREPARATION`);
  const savedSheet=await json(prepApi(mealTeam),actor,input(doc,prior.value.sheet.version));
  check(savedSheet.response.status===200&&savedSheet.value.sheet.canEdit===true&&savedSheet.value.sheet.version===prior.value.sheet.version+1,`${actor} actually saves the team's preparation through compiled PUT`);
  const priorPublication=await json(teamApi(mealTeam),actor),shared=await json(teamApi(mealTeam),actor,{version:priorPublication.value.presentation.team.publicationVersion,mutationKey:randomUUID(),audience:"project",preparationVersion:savedSheet.value.sheet.version});
  const publicRead=await json(teamApi(mealTeam),"guestA");
  check(shared.response.status===200&&publicRead.response.status===200&&publicRead.value.presentation.sourceVersion===savedSheet.value.sheet.version&&publicRead.value.presentation.document.entries[0].title===doc.entries[0].title,`${actor} explicitly shares the selected immutable preparation snapshot`);
  const reprivated=await json(teamApi(mealTeam),actor,{version:shared.value.presentation.team.publicationVersion,mutationKey:randomUUID(),audience:"team_private",preparationVersion:savedSheet.value.sheet.version});
  check(reprivated.response.status===200&&(await request(teamApi(mealTeam),"guestA")).status===404,`${actor} can return publication to team-private without retaining guest access`);
  const created=await json(mediaApi,actor,pngForm(`UPPER_ROLE_${actor}_PNG`),{method:"POST"});
  check(created.response.status===201&&created.value.item?.canEdit===true,`${actor} actually uploads one bounded PNG by multipart POST without team membership`);
  const media=created.value.item,patched=await json(mediaApi+"/"+media.id,actor,{title:media.title,caption:"UPPER_ROLE_PATCHED_"+actor,visibility:"team_private",version:media.version,mutationKey:randomUUID()},{method:"PATCH"});
  check(patched.response.status===200&&patched.value.item.version===2&&patched.value.item.canEdit===true,`${actor} edits private media description/audience through compiled PATCH`);
  for(const reader of["su","adminA"]){const file=await request(media.fileUrl,reader),bytes=new Uint8Array(await file.arrayBuffer());check(file.status===200&&sha(bytes)===sha(png)&&file.headers.get("cache-control")==="private, no-store",`${reader} downloads exact private PNG bytes uploaded by ${actor} without team membership`);}
  upperMedia.push(patched.value.item);mediaProof.push({id:media.id,actor,sha256:sha(png),bytes:png.length});hierarchyProof.push({actor,preparationVersion:savedSheet.value.sheet.version,mediaId:media.id});
 }
 const upperFile=upperMedia[0],currentSheet=(await json(prepApi(mealTeam),"su")).value.sheet,currentPublication=(await json(teamApi(mealTeam),"su")).value.presentation;
 for(const route of[base+`/teams/${mealTeam}/preparation`,base+`/activities/${mealTeam}`,base+"/media?teamId="+mediaTeam,base+"/settings"]){const denied=await page(route,"adminB");check(denied.status===404&&!text(denied.html).includes("UPPER_ROLE_"),`unrelated administrator direct page ${route} remains404 without upper-role content`);}
 const forbiddenMutation=input(preparation("FORBIDDEN_UPPER_ROLE_WRITE"),currentSheet.version);
 check((await request(prepApi(mealTeam),"adminB")).status===404&&(await request(prepApi(mealTeam),"adminB",forbiddenMutation)).status===404&&(await request(teamApi(mealTeam),"adminB",{version:currentPublication.team.publicationVersion,mutationKey:randomUUID(),audience:"project",preparationVersion:currentSheet.version})).status===404,"unrelated administrator cannot read/write preparation or publish by forged project/team IDs");
 check((await request(mediaApi,"adminB",pngForm("FORBIDDEN_ADMIN_B_UPLOAD"),{method:"POST"})).status===404&&(await request(mediaApi+"/"+upperFile.id,"adminB",{title:"FORBIDDEN",caption:"",visibility:"project",version:upperFile.version,mutationKey:randomUUID()},{method:"PATCH"})).status===404&&(await request(upperFile.fileUrl,"adminB")).status===404,"unrelated administrator cannot upload, edit or download private media by direct resource URLs");
 const memberPrep=await page(base+`/teams/${mealTeam}/preparation`,"leaderA"),memberGallery=await page(base+"/media?teamId="+mediaTeam,"memberA"),guestGallery=await page(base+"/media?teamId="+mediaTeam,"guestA");
 check(memberPrep.status===200&&!text(memberPrep.html).includes("준비표 편집")&&[memberGallery,guestGallery].every(row=>row.status===200&&!text(row.html).includes("사진·영상 올리기")&&!text(row.html).includes("미디어 저장")),"ordinary current team member stays preparation read-only and ordinary member/guest media pages do not expose upload controls");
 check((await request(prepApi(mealTeam),"leaderA",forbiddenMutation)).status===404&&(await request(prepApi(mealTeam),"guestA")).status===404&&(await request(prepApi(mealTeam),"guestA",forbiddenMutation)).status===404&&(await request(mediaApi,"memberA",pngForm("FORBIDDEN_MEMBER_UPLOAD"),{method:"POST"})).status===404&&(await request(mediaApi,"guestA",pngForm("FORBIDDEN_GUEST_UPLOAD"),{method:"POST"})).status===404&&(await request(upperFile.fileUrl,"guestA")).status===404,"ordinary member and guest write/private-read denials remain unchanged after upper-role successes");
 await db.prepare("UPDATE project_members SET active=0 WHERE project_id=? AND user_id=2").bind(p).run();
 try{
  check((await page(base+"/media?teamId="+mediaTeam,"adminA")).status===404&&(await request(prepApi(mealTeam),"adminA")).status===404&&(await request(prepApi(mealTeam),"adminA",forbiddenMutation)).status===404&&(await request(mediaApi,"adminA",pngForm("FORBIDDEN_REVOKED_ADMIN"),{method:"POST"})).status===404&&(await request(upperFile.fileUrl,"adminA")).status===404,"revoking assigned administrator project membership immediately blocks page/preparation/upload/private-file access using the existing session");
  const stillSuper=await json(prepApi(mealTeam),"su"),savedSuper=await json(prepApi(mealTeam),"su",input(stillSuper.value.sheet.document,stillSuper.value.sheet.version)),superFile=await request(upperFile.fileUrl,"su");
  check(stillSuper.response.status===200&&stillSuper.value.sheet.canEdit&&savedSuper.response.status===200&&superFile.status===200&&sha(new Uint8Array(await superFile.arrayBuffer()))===sha(png),"unassigned env SU still reads/saves preparation and downloads exact bytes after administrator membership revocation");
 }finally{await db.prepare("UPDATE project_members SET active=1 WHERE project_id=? AND user_id=2").bind(p).run();}
 check(originalRoles===JSON.stringify((await db.prepare("SELECT id,role FROM users ORDER BY id").all()).results)&&Number((await db.prepare("SELECT COUNT(*) n FROM project_members WHERE user_id=1").first()).n)===0&&Number((await db.prepare("SELECT COUNT(*) n FROM activity_team_members WHERE user_id IN (1,2)").first()).n)===0,"upper-role access requires no account-role changes or new SU/administrator team assignments");
 check(originalMealV1===JSON.stringify((await db.prepare("SELECT * FROM team_preparation_revisions WHERE team_id=? AND version=1").bind(mealTeam).all()).results)&&sha(new Uint8Array(await(await bucket.get(legacyKey)).arrayBuffer()))===sha(legacyBytes),"upper-role mutations preserve original preparation v1 and original legacy R2 attachment bytes");
 check(trace.slice(hierarchyTraceStart).filter(row=>row.route.startsWith("/api/projects/")).every(row=>row.cacheControl==="private, no-store")&&pages.filter(row=>row.status===200).every(row=>!errorMarker(row.html)),"all upper-role API successes/denials remain private/no-store and successful SSR pages have no serialized React errors");
 await writeFile(path.join(out,"result.json"),JSON.stringify({complete:true,checks:checks.length,assertions:checks,requests:trace.length,entrySha256:sha(await readFile(entry)),mediaProof,hierarchyProof,limits:"Compiled Worker HTTP/API/SSR/RSC and real ephemeral D1/R2 only. Chromium helper owner nobody4755 unchanged: no browser launch, actual hydration/client-console, viewport/mobile visual, keyboard/focus, opened menu registration/link-close/Escape/outside-click/BackForward/scroll/touch, operating network, real data, deletion, Native DB or deployment proof."},null,2));
}catch(error){console.error(error);process.exitCode=1;await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,checks:checks.length,assertions:checks,error:String(error),requests:trace.length,browserExecuted:false},null,2));}
finally{await writeFile(path.join(out,"requests.json"),JSON.stringify(trace,null,2));await mf.dispose();const after=await buildSnapshot(["dist/server","dist/client"]);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,"Compiled portal artifact changed during QA");}
