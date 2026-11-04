/** PRD-068 exact compiled Worker HTTP/SSR regression. Ephemeral synthetic D1 only. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { Log, LogLevel, Miniflare } from "miniflare";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

const out = path.resolve(".test-artifacts/project-vote-http"), entry = path.resolve("dist/server/index.js");
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "result.json"), JSON.stringify({ complete: false, phase: "running" }));
const before = await buildSnapshot(["dist/server", "dist/client"]), secret = randomBytes(32).toString("hex");
const probe = createServer(); await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`, p = 1601, otherProject = 1602, base = `/projects/${p}/votes`, api = `/api/projects/${p}/votes`;
const assertions = [], trace = [], cookies = {};
const people = [[1,"su","guest"],[2,"adminA","admin"],[3,"adminB","admin"],[4,"memberA","member"],[5,"guestA","guest"],[6,"memberB","member"],[7,"nonmember","member"]];
const sha = value => createHash("sha256").update(value).digest("hex");
const check = (condition, label) => { assert.ok(condition, label); assertions.push(label); console.log("PASS " + label); };
const errorMarker = value => /Functions cannot be passed|Only plain objects can be passed|Minified React error|Hydration failed|(?:^|\n)[a-f0-9]+:E\{/m.test(value);
async function modules(dir) { const found=[]; for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())found.push(...await modules(file));else if(file.endsWith(".js"))found.push({type:"ESModule",path:file});}return found; }
const mf = new Miniflare({cf:false,host:"127.0.0.1",port,modules:[{type:"ESModule",path:entry},...(await modules(path.resolve("dist/server"))).filter(m=>m.path!==entry)],modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"vote-http"},r2Buckets:{ATTACHMENTS:"vote-http"},assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},bindings:{NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic-vote",GOOGLE_CLIENT_SECRET:"synthetic-not-credential",SUPERUSER_EMAIL:"vote-su@example.test"},log:new Log(LogLevel.ERROR)});
async function request(route,actor,body,{method=body===undefined?"GET":"POST",headers={},raw=false}={}){
 const response=await consumeWorkerResponse(await mf.dispatchFetch(origin+route,{method,headers:{...(actor?{Cookie:cookies[actor]}:{}),...(body===undefined?{}:{Origin:origin,"Content-Type":"application/json"}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)}),redirect:"manual"}),{route,method});
 trace.push({route,actor:actor??null,method,status:response.status,cacheControl:response.headers.get("cache-control"),location:response.headers.get("location")});return response;
}
async function json(route,actor,body,options){const response=await request(route,actor,body,options);const value=await response.json();return{response,value};}
async function page(route,actor){const response=await request(route,actor),html=await response.text();await writeFile(path.join(out,`${actor??"anonymous"}-${route.replaceAll("/","_")}.html`),html);return{response,html};}
const stamp=offset=>new Date(Date.now()+offset).toISOString();
const input=(title,offset=3600000)=>({title,description:"개인정보 없는 합성 투표",startsAt:stamp(offset),endsAt:stamp(offset+3600000),options:["합성 선택 A","합성 선택 B"],mutationKey:randomUUID()});
// Deliberately check the complete JSON structure, including data sent to client props.
function noInterimResults(poll,label){check(poll.results===null&&poll.totalVotes===null,label);}
function noBallotIdentity(value,label){const serialized=JSON.stringify(value);check(!/(?:vote-(?:admina|adminb|membera|guesta|memberb|nonmember)@example\.test|SYNTHETIC_(?:memberA|guestA)|"(?:userId|voterId|voterEmail|ballots|voters)"\s*:)/i.test(serialized),label);}
let db;
try {
 check(new URL(await mf.ready).origin===origin,"compiled Worker uses an explicit loopback auth/origin boundary");
 db=await mf.getD1Database("DB");
 for(const file of(await readdir("drizzle")).filter(name=>name.endsWith(".sql")).sort())for(const sql of(await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const[id,name,role]of people){const email=name==="su"?"vote-su@example.test":`vote-${name.toLowerCase()}@example.test`;await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(id,email,"SYNTHETIC_"+name,role).run();cookies[name]=`next-auth.session-token=${await encode({secret,token:{email,name:"SYNTHETIC_"+name,role:name==="su"?"guest":"admin",isSuperuser:name!=="su"},maxAge:3600})}`;}
 await db.prepare("INSERT INTO projects(id,name,project_type,access_mode,goal,start_date,end_date) VALUES(1601,'VOTE_SYNTHETIC_A','volunteering','legacy_authenticated','','2026-01-01','2029-12-31'),(1602,'VOTE_SYNTHETIC_B','collaboration','members_only','','2026-01-01','2029-12-31')").run();
 for(const[project,user]of[[p,2],[p,4],[p,5],[otherProject,3],[otherProject,6]])await db.prepare("INSERT INTO project_members(project_id,user_id) VALUES(?,?)").bind(project,user).run();
 const preserved=JSON.stringify((await db.prepare("SELECT id,email,role FROM users ORDER BY id").all()).results);
 const anonPage=await request(base);await anonPage.text();check([302,303,307,308].includes(anonPage.status)&&/signin/.test(anonPage.headers.get("location")??""),"anonymous vote page redirects to sign-in without data");
 check((await request(api)).status===401,"anonymous voting API requires login");
 for(const actor of["nonmember","memberB","adminB"]){const denied=await page(base,actor);check(denied.response.status===404&&!denied.html.includes("VOTE_SYNTHETIC_A")&&(await request(api,actor)).status===404,`${actor} cannot enter another project's vote page/API even on legacy-readable project`);}
 const su=await json(api,"su"),member=await json(api,"memberA"),guest=await json(api,"guestA");
 check(su.response.status===200&&su.value.canManage===true&&su.value.canVote===false,"unassigned env SU manages globally but receives no membership-only ballot eligibility");
 check(member.response.status===200&&member.value.canManage===false&&member.value.canVote===true&&guest.response.status===200&&guest.value.canVote===true,"current project member/guest vote eligibility does not trust forged admin/SU session flags");
 const futureInput=input("VOTE_HTTP_FUTURE_한글");
 const created=await json(api,"adminA",futureInput);check(created.response.status===201,"assigned project administrator creates a scheduled poll");
 const future=created.value.poll;assert.ok(Number.isSafeInteger(future.id));
 check(future.phase==="scheduled"&&future.options.length===2,"scheduled poll returns stable option IDs and scheduled phase");
 noInterimResults(future,"scheduled poll creation does not expose interim results or turnout");
 const replay=await json(api,"adminA",futureInput);check([200,201].includes(replay.response.status)&&replay.value.poll.id===future.id,"same create mutation replays idempotently without duplicate poll");
 check((await request(api,"adminA",{...futureInput,title:"DIFFERENT_REPLAY"})).status===409,"same mutation token cannot create a different poll");
 for(const actor of["memberA","guestA","adminB"]){check((await request(api,actor,input("FORBIDDEN_"+actor))).status===404,`${actor} cannot create an unassigned poll despite stale elevated signed claims`);}
 check((await request(api,"adminA",{...input("INVALID_DUPLICATE"),options:["same","same"]})).status===400,"duplicate option labels are rejected");
 check((await request(api,"adminA",{...input("INVALID_ZONE"),startsAt:"2026-11-03T10:00:00"})).status===400,"timezone-free date-time input is rejected rather than implicitly reinterpreted");
 check((await request(api,"adminA",{...input("INVALID_REVERSE"),endsAt:stamp(-3600000)})).status===400,"inverted voting period is rejected");
 check((await request(api,"adminA",input("BAD_ORIGIN"),{headers:{Origin:"https://evil.example"}})).status===403,"untrusted Origin is rejected without disabling CSRF protection");
 check((await request(api,"adminA",input("NO_ORIGIN"),{headers:{Origin:""}})).status===403,"missing browser Origin is rejected");
 check((await request(api,"adminA","x".repeat(40000),{raw:true})).status===413,"oversized vote request body is bounded before JSON parsing");
 check((await request(`/api/projects/${p}%0A/votes`,"adminA")).status===404,"noncanonical newline project identifier is rejected");
 const ballot = (poll,actor,optionId,options={}) => json(`${api}/${poll.id}/ballot`,actor,{optionId},{method:"PUT",...options});
 check((await ballot(future,"memberA",1)).response.status===409,"scheduled poll cannot accept a vote before its start");
 const upper=await json(api,"su",input("VOTE_SU_CREATED"));
 check(upper.response.status===201&&(await ballot(upper.value.poll,"su",1)).response.status===404,"unassigned env SU creates polls globally but cannot cast without project membership");
 const activeInput=input("VOTE_HTTP_ACTIVE_한글",-3600000);activeInput.endsAt=stamp(3600000);
 const activeCreated=await json(api,"adminA",activeInput);check(activeCreated.response.status===201&&activeCreated.value.poll.phase==="open","already-started future-ending poll can be created for immediate voting");
 const active=activeCreated.value.poll;
 const first=await ballot(active,"memberA",1);check(first.response.status===200&&first.value.poll.ownChoice===1,"active project member stores one option through compiled ballot PUT");
 noInterimResults(first.value.poll,"ballot write response hides aggregate counts while open");
 const changed=await ballot(active,"memberA",2);check(changed.response.status===200&&changed.value.poll.ownChoice===2,"member may change the same ballot during the open period");
 const guestCast=await ballot(active,"guestA",1);check(guestCast.response.status===200&&guestCast.value.poll.ownChoice===1,"active project guest participates without global-role elevation");
 const list=await json(api,"memberA"),own=list.value.polls.find(poll=>poll.id===active.id);
 check(own?.ownChoice===2&&own.phase==="open","fresh GET retains only the caller's changed choice");
 for(const actor of["su","adminA","memberA","guestA"]){const current=await json(api,actor);const poll=current.value.polls.find(poll=>poll.id===active.id);noInterimResults(poll,`${actor} cannot obtain aggregate results or turnout before the deadline`);noBallotIdentity(current.value,`${actor} API response contains no individual voter records`);}
 check((await ballot(active,"memberA",3)).response.status===400,"option number beyond this poll's actual choices is rejected");
 check((await ballot(active,"memberA",1,{headers:{Origin:"https://evil.example"}})).response.status===403,"ballot mutation also enforces trusted browser Origin");
 check(Number((await db.prepare("SELECT option_id FROM project_poll_ballots WHERE poll_id=? AND user_id=4").bind(active.id).first()).option_id)===2,"Origin-rejected ballot request does not modify the stored choice");
 for(const actor of["nonmember","memberB","adminB"]){check((await ballot(active,actor,1)).response.status===404,`${actor} cannot cast by guessing project/poll IDs`);}
 const otherApi=`/api/projects/${otherProject}/votes`,otherInput=input("VOTE_PROJECT_B",-3600000);otherInput.endsAt=stamp(3600000);
 const other=await json(otherApi,"adminB",otherInput);check(other.response.status===201,"project B administrator can create only in their own project");
 check((await request(`${api}/${other.value.poll.id}/ballot`,"memberA",{optionId:1},{method:"PUT"})).status===404,"poll/project parent mismatch cannot select another project's ballot");
 const liveMemberPage=await page(base,"memberA"),liveSuPage=await page(base,"su");
 check(liveMemberPage.response.status===200&&liveMemberPage.html.includes(`name="poll-${active.id}-option"`)&&liveMemberPage.html.includes(`value="1"`)&&liveMemberPage.html.includes(`value="2"`),"open member SSR exposes one named native radio group with the actual options");
 check(liveSuPage.response.status===200&&!liveSuPage.html.includes(`name="poll-${active.id}-option"`),"unassigned SU SSR cannot present a membership-only voting control");
 check(!liveMemberPage.html.includes("익명 집계 결과")&&!liveSuPage.html.includes("익명 집계 결과"),"member and privileged open-poll SSR do not render an interim aggregate result section");
 const concurrent=await Promise.all([ballot(active,"memberA",1),ballot(active,"memberA",2),ballot(active,"memberA",1)]);
 check(concurrent.every(result=>[200,409].includes(result.response.status)),"competing same-member changes resolve as successful writes or explicit conflict, never server error");
 const votes=(await db.prepare("SELECT user_id,option_id FROM project_poll_ballots WHERE poll_id=? ORDER BY user_id").bind(active.id).all()).results;
 check(votes.length===2&&votes.filter(vote=>vote.user_id===4).length===1&&[1,2].includes(votes.find(vote=>vote.user_id===4)?.option_id),"concurrent updates preserve one ballot per member rather than inflating totals");
 await db.prepare("UPDATE project_members SET active=0 WHERE project_id=? AND user_id=4").bind(p).run();
 check((await request(api,"memberA")).status===404&&(await ballot(active,"memberA",2)).response.status===404&&(await page(base,"memberA")).response.status===404,"membership revocation denies next page/list/ballot requests with the existing signed session");
 await db.prepare("UPDATE project_members SET active=1 WHERE project_id=? AND user_id=4").bind(p).run();
 await db.prepare("UPDATE users SET role='member' WHERE id=2").run();
 check((await request(api,"adminA",input("FORBIDDEN_STALE_ADMIN"))).status===404,"DB administrator demotion immediately blocks creation despite stale signed administrator claims");
 await db.prepare("UPDATE users SET role='admin' WHERE id=2").run();
 // Transition only a local fixture's deadline. No production clock/config changes.
 await db.prepare("UPDATE project_polls SET starts_at=?,ends_at=? WHERE id=?").bind(stamp(-7200000),stamp(-1000),active.id).run();
 const expected=active.options.map(option=>({optionId:option.id,count:votes.filter(vote=>vote.option_id===option.id).length}));
 for(const actor of["su","adminA","memberA","guestA"]){const current=await json(api,actor),poll=current.value.polls.find(poll=>poll.id===active.id);check(current.response.status===200&&poll.phase==="closed"&&poll.totalVotes===2,`${actor} can view anonymous aggregate results after the deadline`);assert.deepEqual(poll.results,expected);noBallotIdentity(current.value,`${actor} closed results omit individual voter records and identities`);}
 const savedBallots=JSON.stringify((await db.prepare("SELECT * FROM project_poll_ballots WHERE poll_id=? ORDER BY user_id").bind(active.id).all()).results);
 check((await ballot(active,"memberA",2)).response.status===409,"closed poll refuses ballot changes");
 check(savedBallots===JSON.stringify((await db.prepare("SELECT * FROM project_poll_ballots WHERE poll_id=? ORDER BY user_id").bind(active.id).all()).results),"deadline rejection leaves previously recorded ballots unchanged");
 const expiredInput=input("EXPIRED_CREATE",-7200000);check((await request(api,"adminA",expiredInput)).status===400,"administrator cannot create an already-ended poll");
 check(Number((await db.prepare("SELECT COUNT(*) n FROM project_polls").first()).n)===4,"replays and every denied/invalid create leave exactly the four authorized synthetic polls");
 const adminPage=await page(base,"adminA"),memberPage=await page(base,"memberA"),suPage=await page(base,"su"),guestPage=await page(base,"guestA");
 for(const [actor,row]of[["adminA",adminPage],["memberA",memberPage],["su",suPage],["guestA",guestPage]])check(row.response.status===200&&!errorMarker(row.html)&&row.html.includes(activeInput.title),`${actor} voting page renders actual poll content without serialized React errors`);
 check([adminPage,suPage].every(row=>row.html.includes('data-testid="project-voting"')&&row.html.includes("새 투표 안건 등록 · 지정 관리자/슈퍼관리자"))&&[memberPage,guestPage].every(row=>!row.html.includes("새 투표 안건 등록 · 지정 관리자/슈퍼관리자")),"SSR shows poll creation only to assigned administrator/SU and keeps member/guest read-and-vote scope");
 check((await request(api,"adminA",{},{method:"DELETE"})).status===405&&(await request(`${api}/${active.id}/ballot`,"memberA",{optionId:1},{method:"DELETE"})).status===405,"unsupported destructive operations have no mutation route");
 check(trace.filter(row=>row.route.startsWith("/api/projects/")&&row.status!==405).every(row=>row.cacheControl==="private, no-store"),"all application-handled vote API responses and denials remain private/no-store");
 check(preserved===JSON.stringify((await db.prepare("SELECT id,email,role FROM users ORDER BY id").all()).results)&&Number((await db.prepare("SELECT COUNT(*) n FROM project_members WHERE user_id=1").first()).n)===0,"synthetic role probes restore original users and never assign the SU project membership");
 await writeFile(path.join(out,"result.json"),JSON.stringify({complete:true,checks:assertions.length,assertions,requests:trace.length,entrySha256:sha(await readFile(entry)),browserExecuted:false,limitations:"Exact compiled Worker HTTP/API/SSR and ephemeral D1 only. Local fixture deadline transition is not an observed live wall-clock boundary. No browser hydration/console, keyboard interaction, rendered viewport/mobile, actual Google login/other real roles, Native/MariaDB execution, production data/network, or deployment proof."},null,2));
} catch(error) {
 console.error(error);process.exitCode=1;
 await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,checks:assertions.length,assertions,error:String(error),requests:trace.length,browserExecuted:false},null,2));
} finally {
 await writeFile(path.join(out,"requests.json"),JSON.stringify(trace,null,2));await mf.dispose();
 const after=await buildSnapshot(["dist/server","dist/client"]);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,"compiled voting artifact changed during QA");
}
