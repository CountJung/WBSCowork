import { randomUUID } from "node:crypto";
/** Called only with an in-process Miniflare request function and ephemeral fixtures. */
export async function verifyBugScreenshotsHttp({request,db,bucket,actorCookies,actionOrigin,check}) {
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf9sAAAAASUVORK5CYII=","base64");
 const page=await(await request("/bugs",actorCookies.guest)).text();
 const action=[...page.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(m=>m[1]).find(id=>id.endsWith("#createBugReportAction"));
 check(Boolean(action),"screenshot form retains progressive-enhancement server action");
 const base={requestToken:randomUUID(),title:"SYNTHETIC_BUG_SCREENSHOT_HTTP",reproduction:"Synthetic steps",expected:"expected",actual:"actual"};
 async function submit(files,fields=base,cookie=actorCookies.guest,route="/bugs") {
  const boundary='bug-screenshot-http-fixture',parts=[];
  for(const [key,value]of [[action,''],...Object.entries(fields)])parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  for(const f of files){parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field??'screenshots'}"; filename="${f.name??'screen.png'}"\r\nContent-Type: ${f.type??'image/png'}\r\n\r\n`),Buffer.from(f.bytes??png),Buffer.from('\r\n'));}
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const response=await request(route,cookie,{method:"POST",headers:{Origin:actionOrigin,'Content-Type':`multipart/form-data; boundary=${boundary}`},body:Buffer.concat(parts)});await response.text();return response;
 }
 await submit([{},{}]);
 const report=await db.prepare("SELECT id FROM bug_reports WHERE title=?").bind(base.title).first();
 check(Boolean(report),"actual Worker saves description with screenshots");
 const rows=(await db.prepare("SELECT * FROM bug_report_screenshots WHERE report_id=? ORDER BY ordinal").bind(report.id).all()).results;
 check(rows.length===2&&rows.every(f=>f.file_mime_type==="image/png"&&f.file_size_bytes===png.length),"actual Worker records two validated image attachments");
 const detail=await(await request(`/bugs/${report.id}`,actorCookies.guest)).text();
 check(rows.every(f=>detail.includes(`/api/bug-screenshots/${f.id}`)),"detail refresh renders protected screenshot URLs");
 for(const [name,cookie,allowed] of [["author",actorCookies.guest,true],["project admin",actorCookies.admin,false],["superuser",actorCookies.superuser,true],["other member",actorCookies.member2,false],["anonymous",null,false]]) {
  const response=await request(`/api/bug-screenshots/${rows[0].id}`,cookie);const bytes=Buffer.from(await response.arrayBuffer());
  check(response.status===(allowed?200:cookie?404:401)&&(!allowed||bytes.equals(png)),`${name}: screenshot bytes authorization`);
  check(response.headers.get("Cache-Control")==="private, no-store",`${name}: screenshots prohibit shared cache`);
  if(allowed)check(response.headers.get("X-Content-Type-Options")==="nosniff"&&response.headers.get("Content-Type")==="image/png"&&response.headers.get("Content-Disposition").startsWith("inline;"),`${name}: safe inline image headers`);
 }
 const missing=await request("/api/bug-screenshots/999999",actorCookies.member2),denied=await request(`/api/bug-screenshots/${rows[0].id}`,actorCookies.member2);
 check(missing.status===denied.status&&await missing.text()===await denied.text(),"unknown and unauthorized screenshot are indistinguishable");
 for(const files of [[{bytes:"<script/>"}],[{type:"image/svg+xml",bytes:"<svg/>"}],[{type:"image/jpeg"}],[{bytes:new Uint8Array(2*1024*1024+1)}],[{bytes:new Uint8Array()}],[{},{},{},{}],[{field:"otherFile"}]]) {
  const before=(await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()).n;
  await submit(files,{...base,requestToken:randomUUID()});
  check((await db.prepare("SELECT COUNT(*) AS n FROM bug_reports").first()).n===before,"invalid image/type/size/count/field denied without partial report");
 }
 const before=(await bucket.list()).objects.length;
 await submit([{},{}]);
 check((await db.prepare("SELECT COUNT(*) AS n FROM bug_report_screenshots WHERE report_id=?").bind(report.id).first()).n===2,"HTTP screenshot replay is idempotent");
 check((await bucket.list()).objects.length===before,"HTTP replay removes unused uploaded objects");
 await db.prepare("UPDATE bug_reports SET trashed_at=CURRENT_TIMESTAMP WHERE id=?").bind(report.id).run();
 check((await request(`/api/bug-screenshots/${rows[0].id}`,actorCookies.guest)).status===404,"trash immediately revokes reporter screenshot access");
 check((await request(`/api/bug-screenshots/${rows[0].id}`,actorCookies.superuser)).status===200,"superuser can inspect trashed screenshot");
 await db.prepare("UPDATE bug_reports SET trashed_at=NULL WHERE id=?").bind(report.id).run();
 check((await request(`/api/bug-screenshots/${rows[0].id}`,actorCookies.guest)).status===200,"restored report restores reporter screenshot access");
 check((await request("/"+rows[0].file_path,actorCookies.guest)).status===404,"R2 screenshot keys are never public routes");
}
