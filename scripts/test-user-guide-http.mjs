/** Public guide HTTP/SSR/RSC QA. Exact compiled Worker; no accounts, DB/R2 bindings, browser, or production. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Log, LogLevel, Miniflare } from "miniflare";
import { consumeWorkerResponse } from "./consume-worker-response.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

const roles=["superuser","project_admin","team_leader","member","guest"];
const features=["media","projects","tasks","completion","submissions","review","attachments","preparation","reports","personal","bugs","administration"];
const errorMarker=text=>/Functions cannot be passed|Only plain objects can be passed|Minified React error|Hydration failed|(?:^|\n)[a-f0-9]+:E\{/m.test(text);
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
function parseHtml(html){
 const program=`import json,sys\nfrom html.parser import HTMLParser\nclass P(HTMLParser):\n def __init__(self):super().__init__();self.stack=[];self.text=[];self.links=[];self.images=[];self.ids=[];self.headings=[];self.captions=[];self.forms=0\n def handle_starttag(self,tag,attrs):\n  attrs=dict(attrs)\n  if 'id' in attrs:self.ids.append(attrs['id'])\n  if tag=='form':self.forms+=1\n  if tag=='img':self.images.append(attrs)\n  if tag in ['a','h1','h2','h3','figcaption']:\n   row={'attrs':dict(attrs),'text':[]};(self.links if tag=='a' else self.captions if tag=='figcaption' else self.headings).append(row);attrs['_row']=row\n  if tag not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append((tag,attrs))\n def handle_endtag(self,tag):\n  for i in range(len(self.stack)-1,-1,-1):\n   if self.stack[i][0]==tag:self.stack=self.stack[:i];break\n def handle_data(self,data):\n  if any(tag in ['script','style'] for tag,_ in self.stack):return\n  self.text.append(data)\n  for _,attrs in self.stack:\n   if '_row' in attrs:attrs['_row']['text'].append(data)\np=P();p.feed(sys.stdin.read())\nfor row in p.links+p.headings+p.captions:row['text']=' '.join(''.join(row['text']).split())\nprint(json.dumps({'text':' '.join(''.join(p.text).split()),'links':p.links,'images':p.images,'ids':p.ids,'headings':p.headings,'captions':p.captions,'forms':p.forms},ensure_ascii=False))`;
 const parsed=spawnSync("python3",["-c",program],{input:html,encoding:"utf8",maxBuffer:8*1024*1024});assert.equal(parsed.status,0,parsed.stderr);return JSON.parse(parsed.stdout);
}
/** Shared only by the two focused HTTP drivers; no browser assertions are inferred. */
async function verifyGuideContent(request,out,{runtime,secretSentinel="SYNTHETIC_GUIDE_SECRET_MUST_NOT_RENDER"}={}){
 await mkdir(out,{recursive:true});const assertions=[],pages=[],assets=[];
 const check=(condition,label)=>{if(!condition){const error=new Error(`${runtime}: ${label}`);error.partial={checks:assertions.length,assertions:[...assertions],pages:pages.length,assets:[...assets]};error.blockedBy=label.startsWith("at least one reviewed actual screenshot")?"missing_reviewed_screenshot_assets":undefined;throw error;}assertions.push(label);console.log(`PASS ${runtime}: ${label}`);};
 async function page(route){const response=await request(route),html=await response.text(),dom=parseHtml(html);const row={route,status:response.status,contentType:response.headers.get("content-type"),html,dom};pages.push(row);await writeFile(path.join(out,route.replaceAll("/","_")+'.html'),html);return row;}
 const index=await page("/guide");
 check(index.status===200&&index.html.includes('data-testid="user-guide"'),"anonymous guide landing renders public SSR200 without a database");
 check(roles.every(role=>index.dom.links.some(link=>link.attrs.href===`/guide/${role}`)),"landing exposes all five educational role links");
 const header=index.html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0]??"";
 check(parseHtml(header).links.some(link=>link.attrs.href==="/guide"&&(link.attrs["aria-label"]??link.text).includes("사용설명서")),"global header exposes a named guide link without requiring an authenticated menu");
 const rolePages=[];for(const role of roles)rolePages.push(await page(`/guide/${role}`));
 check(rolePages.every(row=>row.status===200&&row.html.includes('data-testid="user-guide"')),"all five role explanations remain publicly readable without changing account identity");
 check(rolePages.every(row=>row.dom.links.some(link=>link.attrs.href==="/guide")),"role pages provide a real role-selection return link");
 const common=["media","projects","tasks","submissions","attachments","personal","bugs"];
 check(rolePages.every((row,index)=>{const role=roles[index],expected=[...common,...(role==="guest"?[]:["completion","review","preparation"]),...(["superuser","project_admin"].includes(role)?["reports"]:[]),...(role==="superuser"?["administration"]:[])].sort(),actual=[...new Set(row.dom.links.map(link=>link.attrs.href).filter(href=>href?.startsWith(`/guide/${role}/`)).map(href=>href.split("/")[3]))].sort();return JSON.stringify(actual)===JSON.stringify(expected);}),"role feature navigation matches the exact public permission-context matrix");
 const permittedFeatures=role=>features.filter(feature=>common.includes(feature)||(role!=="guest"&&["completion","review","preparation"].includes(feature))||(["superuser","project_admin"].includes(role)&&feature==="reports")||(role==="superuser"&&feature==="administration"));
 const featurePages=[];for(const role of roles)for(const feature of permittedFeatures(role))featurePages.push(await page(`/guide/${role}/${feature}`));
 check(featurePages.length===50&&featurePages.every(row=>row.status===200&&row.html.includes('data-testid="user-guide"')),"all50 permitted role-feature intersections render public SSR200 exactly once");
 check(pages.length===56&&new Set(pages.map(row=>row.route)).size===56,"landing/five roles/all50 features comprise56 distinct valid pages without duplicate GETs");
 check(featurePages.every(row=>["where","steps","example","confirm","errors","limits","related"].every(id=>row.dom.ids.includes(id))),"every feature has menu, ordered instructions, example, save confirmation, error help and scope sections");
 const contextual=featurePages.filter(row=>["/guide/project_admin/projects","/guide/team_leader/preparation","/guide/member/submissions","/guide/guest/bugs"].includes(row.route));
 check(contextual.length===4&&contextual.every(row=>row.status===200),"project-admin/team-leader/member/guest examples resolve their permitted feature intersections");
 check(featurePages.every(row=>row.dom.links.some(link=>link.attrs.href===row.route.split("/").slice(0,3).join("/"))),"all50 feature pages preserve their role-context return links");
 const readingRoutes=[...['projects','tasks','submissions','attachments','personal'].map(feature=>`/guide/guest/${feature}`),"/guide/member/preparation","/guide/member/projects","/guide/team_leader/projects","/guide/member/media","/guide/guest/media"];
 const readingPages=featurePages.filter(row=>readingRoutes.includes(row.route));
 check(readingPages.length===10&&readingPages.every(row=>["화면에서 확인하는 예시","확인한 내용을 점검하세요","확인 체크리스트"].every(text=>row.dom.text.includes(text))),"all ten read-only variants present viewing examples and confirmation wording instead of writing prompts");
 check(readingPages.every(row=>!["실제 활동에 맞게 바꿔 입력하세요","수정은 변경 요약과 함께 저장하세요"].some(text=>row.dom.text.includes(text))),"read-only variants omit generic input/save instructions");
 const title=route=>featurePages.find(row=>row.route===route)?.dom.headings.find(heading=>heading.attrs.id==="guide-title")?.text;
 check(title("/guide/guest/submissions")==="제출물·댓글·이력 읽기"&&title("/guide/member/preparation")==="우리 팀 준비표 확인하기","guest submissions and ordinary-member preparation use their precise read-only titles");
 const guestBugs=featurePages.find(row=>row.route==="/guide/guest/bugs");
 check(guestBugs.dom.text.includes("실제 활동에 맞게 바꿔 입력하세요")&&guestBugs.dom.text.includes("저장한 뒤 확인하세요"),"guest bug reporting keeps authorized writing and save-confirmation instructions");
 check(featurePages.filter(row=>row.route.endsWith("/tasks")).every(row=>row.dom.text.includes("작업")&&row.dom.text.includes("업무 상세")),"all roles task navigation names the actual 작업 menu and 업무 상세 button");
 check(featurePages.filter(row=>row.route.endsWith("/review")).every(row=>["버전·검토 이력","이 버전 검토 요청","검토 의견·판정 근거","이 버전 승인","보완 요청"].every(text=>row.dom.text.includes(text))),"all review guides identify version-history navigation and exact request/decision controls");
 check(featurePages.filter(row=>row.route.endsWith("/completion")).every(row=>["진행 상태 · 필수","상태 저장"].every(text=>row.dom.text.includes(text))),"completion guides identify the actual status selector and save button");
 const reportPages=featurePages.filter(row=>row.route.endsWith("/reports"));
 check(reportPages.length===2&&reportPages.every(row=>["관리자","프로젝트 관리","활동 보고서","미리보기","보고서 생성","내 보고서 기록","DOCX 다운로드","PPTX 다운로드"].every(text=>row.dom.text.includes(text))),"both authorized report guides identify the real menu, generation and download controls");
 check(reportPages.every(row=>["UTC","한국 10월 25일 00:00","UTC 10월 24일 15:00","입력 시각을 바꾸지 않습니다","UTC로 표시된 보고서 기간 입력에만 적용","준비표의 달력 날짜·24시간제 시각은 그대로"].every(text=>row.dom.text.includes(text))),"report guides explain UTC date rollover and distinguish input instants from report timezone and preparation calendar dates");
 const invalid=[];for(const route of ["/guide/not-a-role","/guide/superuser/not-a-feature","/guide/guest/administration","/guide/team_leader/reports"]){const response=await request(route),html=await response.text();invalid.push({route,status:response.status,errorMarker:errorMarker(html)});}
 check(invalid.every(row=>row.status===404&&!row.errorMarker),"unknown roles/features and disallowed role-feature intersections return404");
 check(pages.every(row=>row.dom.headings.filter(heading=>heading.attrs.id==="guide-title").length===1&&row.dom.ids.includes("guide-content")),"every valid page has one titled guide main article");
 check(pages.every(row=>row.dom.links.some(link=>link.attrs.href==="#guide-content"&&link.text.includes("본문"))),"every guide page serializes a keyboard skip-to-content anchor");
 check(pages.every(row=>row.dom.links.filter(link=>(link.attrs.href??"").startsWith("#")).every(link=>row.dom.ids.includes(decodeURIComponent(link.attrs.href.slice(1))))),"all local table-of-contents anchors target actual rendered IDs");
 check(pages.every(row=>row.dom.ids.length===new Set(row.dom.ids).size),"SSR guide pages contain no duplicate IDs");
 check(pages.every(row=>!errorMarker(row.html)),"SSR emits no known React/RSC serialization or hydration error markers");
 check(pages.every(row=>row.dom.forms===0),"educational pages expose no account-permission mutation forms");
 check(pages.every(row=>!row.html.includes(secretSentinel)&&!row.html.includes("QLT022-QA-20261022-1204")&&!row.html.includes("PRIVATE_SOURCE_MUST_NOT_LEAK")),"public educational SSR contains no runtime secret or existing-user fixture content");
 for(const route of ["/tasks","/admin/projects"]){const response=await request(route);await response.text();const location=response.headers.get("location")??"";check([302,303,307,308].includes(response.status)&&/signin|signIn|login/.test(location),`public manual selection leaves ${route} behind its anonymous authentication boundary`);}
 const rscPath="/guide/team_leader/preparation",headers={RSC:"1",Accept:"text/x-component"};let rsc=await request(rscPath,headers);let rscText=await rsc.text();
 if(rsc.status===307){check(rsc.headers.get("location")===rscPath+"?_rsc","RSC canonicalization stays on the same public feature route");rsc=await request(rscPath+"?_rsc",headers);rscText=await rsc.text();}
 check(rsc.status===200&&rsc.headers.get("content-type")?.includes("text/x-component")&&!errorMarker(rscText),"guide RSC payload serializes without client-function/error chunks");await writeFile(path.join(out,"feature.rsc"),rscText);
 await writeFile(path.join(out,"dom.json"),JSON.stringify(pages.map(({route,status,contentType,dom})=>({route,status,contentType,dom})),null,2));
 const noScreenshots=pages.every(row=>row.dom.images.length===0);
 check(!noScreenshots||pages.every(row=>row.html.includes('data-testid="guide-screenshots-pending"')&&row.dom.text.includes("스크린샷 준비 중입니다")&&row.dom.text.includes("현재는 글로 설명하는 사용설명서를 먼저 제공합니다")),"image-free guide visibly discloses pending screenshots and the current text-first release");
 check(pages.every(row=>row.dom.images.every(image=>typeof image.src==="string"&&image.src.trim().length>0)),"guide pages contain no empty or broken placeholder image references");
 return {check,pages,assets,assertions,invalid,runtime};
}

/** Full acceptance keeps the mandatory real-image gate; this cannot accept text-only content. */
export async function verifyUserGuide(request,out,options={}){
 const {check,pages,assets,assertions,invalid,runtime}=await verifyGuideContent(request,out,options);
 const images=pages.flatMap(row=>row.dom.images.map(image=>({...image,page:row.route,captions:row.dom.captions})));
 check(new Set(images.map(image=>image.src)).size===20,"all twenty reviewed actual screenshots render across the guide; empty placeholders do not count as image proof");
 check(images.every(image=>image.alt?.trim().length>=8&&Number(image.width)>0&&Number(image.height)>0&&image.src?.startsWith("/")&&!image.src.startsWith("//")),"every screenshot has descriptive alt, intrinsic dimensions and a same-site source");
 check(images.every(image=>image.captions.length>0&&image.captions.every(caption=>caption.text.includes("슈퍼관리자")&&caption.text.includes("합성"))),"screenshots carry visible synthetic-superuser provenance captions");
 check(!pages.some(row=>row.html.includes('data-testid="guide-screenshots-pending"')),"reviewed image release no longer claims all screenshots are pending");
 check(images.every(image=>image.captions.some(c=>c.text.includes("촬영")&&/v(?:23|28)/.test(c.text))),"image captions identify the capture version and date");
 check(pages.filter(row=>row.dom.images.some(image=>image.src.includes("v23-"))).every(row=>row.dom.text.includes("구버전 화면")&&row.dom.text.includes("메뉴 열기")&&row.dom.text.includes("상세 정보 · 선택")&&row.dom.text.includes("일간·주간 시간표")),"historical captures explain current mobile navigation, optional meal fields and timetable differences");
 check(images.every(image=>pages.find(row=>row.route===image.page).dom.links.some(link=>link.attrs.href===image.src&&link.attrs.target==="_blank"&&link.attrs.rel.includes("noopener")&&link.text.includes("원본 화면 확대"))),"every screenshot has a named same-site original-size new-tab link");
 check(pages.filter(row=>row.dom.images.length).every(row=>(row.html.match(/<details\b/g)??[]).length===row.dom.images.length && (row.html.match(/<summary\b/g)??[]).length===row.dom.images.length),"each screenshot has a native keyboard-operable disclosure without a script dependency");
 const screenshotPages=pages.filter(row=>row.dom.images.length);
 check(screenshotPages.every(row=>row.dom.text.includes("다른 역할")&&row.dom.text.includes("권한")),"screenshot pages distinguish common SU examples from other-role permission acceptance");
 for(const src of [...new Set(images.map(image=>image.src))]){
  const decoded=decodeURIComponent(src),file=path.resolve("public",'.'+decoded);assert(file.startsWith(path.resolve("public")+path.sep),"Screenshot path must stay in public");const local=await readFile(file),response=await request(src),actual=new Uint8Array(await response.arrayBuffer());
  check(response.status===200&&response.headers.get("content-type")?.startsWith("image/")&&sha(local)===sha(actual)&&actual.length===local.length,`actual screenshot asset bytes match reviewed public file: ${src}`);
  const imageInfo=spawnSync("python3",["-c","import io,json,sys;from PIL import Image;b=sys.stdin.buffer.read();i=Image.open(io.BytesIO(b));i.verify();i=Image.open(io.BytesIO(b));print(json.dumps({'format':i.format,'width':i.width,'height':i.height}))"],{input:actual,encoding:"utf8"});assert.equal(imageInfo.status,0,imageInfo.stderr);const info=JSON.parse(imageInfo.stdout);assert(images.filter(image=>image.src===src).every(image=>Number(image.width)===info.width&&Number(image.height)===info.height),"HTML intrinsic dimensions match actual screenshot pixels");assets.push({src,sha256:sha(actual),bytes:actual.length,...info});
 }

 return {complete:true,runtime,checks:assertions.length,assertions,pages:pages.length,assets,invalid,limitations:"HTTP/SSR/RSC and decoded static-image bytes only. Actual Chromium unavailable: chrome-sandbox owner nobody:nogroup mode4755 unchanged. No browser launch, hydration console, responsive viewport, keyboard/focus/back navigation, or visual screenshot inspection is claimed. No DB/R2/account/production/publication operations."};
}
/** Separate intermediate-release contract. Passing this explicitly does not accept screenshot readiness. */
export async function verifyGuideText(request,out,options={}){
 const {check,pages,assets,assertions,invalid,runtime}=await verifyGuideContent(request,out,options);
 check(pages.every(row=>row.dom.images.length===0),"intermediate text release has no image tags, so it cannot expose missing screenshot URLs");
 return {complete:true,acceptance:"intermediate_text_guide",screenshotsAccepted:false,screenshotReadiness:"pending",runtime,checks:assertions.length,assertions,pages:pages.length,assets,invalid,limitations:"Text-guide HTTP/SSR/RSC acceptance only. Strict full-guide image acceptance remains blocked and must be run separately. No actual browser, viewport, keyboard/focus, hydration/client console, DB/R2/accounts, production or publication verification."};
}

async function workerModules(dir){const entries=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())entries.push(...await workerModules(file));else if(file.endsWith('.js'))entries.push({type:"ESModule",path:file});}return entries;}
export async function runWorkerGuideQa({verify=verifyUserGuide,outputDirectory="user-guide-http"}={}){
 const out=path.resolve(".test-artifacts",outputDirectory),entry=path.resolve("dist/server/index.js"),before=await buildSnapshot(["dist/server","dist/client"]),trace=[];await mkdir(out,{recursive:true});await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:"running"}));
 const origin="https://guide-loopback.example.test",secret=randomBytes(32).toString("hex");
 const mf=new Miniflare({cf:false,modules:[{type:"ESModule",path:entry},...(await workerModules(path.resolve("dist/server"))).filter(item=>item.path!==entry)],modulesRoot:path.resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},bindings:{NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:"synthetic-guide",GOOGLE_CLIENT_SECRET:"synthetic-guide-no-credential"},log:new Log(LogLevel.ERROR)});
 try{
  const request=async(route,headers={})=>{const response=await consumeWorkerResponse(await mf.dispatchFetch(origin+route,{headers,redirect:"manual"}),{route,method:"GET"});trace.push({route,status:response.status,contentType:response.headers.get("content-type"),location:response.headers.get("location"),cacheControl:response.headers.get("cache-control")});return response;};
  const result=await verify(request,out,{runtime:"worker",secretSentinel:secret});await writeFile(path.join(out,"result.json"),JSON.stringify({...result,requests:trace.length,entrySha256:sha(await readFile(entry))},null,2));
 }catch(error){await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:error.blockedBy?"blocked":"failed",blockedBy:error.blockedBy,...error.partial,requests:trace.length,entrySha256:sha(await readFile(entry)),error:String(error),browserExecuted:false,limitations:"Partial HTTP/SSR/RSC only. Required real screenshot gate remains strict. Missing assets prevent completion; no browser or production access."},null,2));console.error(error);process.exitCode=1;
 }finally{await writeFile(path.join(out,"requests.json"),JSON.stringify(trace,null,2));await mf.dispose();const after=await buildSnapshot(["dist/server","dist/client"]);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));assert.deepEqual(after,before,"Guide compiled Worker changed during QA");}
}
if(path.resolve(process.argv[1]??"")===fileURLToPath(import.meta.url))await runWorkerGuideQa();
