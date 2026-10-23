import "./helpers/bootstrap";
import {test} from "node:test";
import assert from "node:assert/strict";
import {mockModuleExports} from "./helpers/mock-module";
import type {R2Bucket} from "@cloudflare/workers-types";
import {runWithHostedBindings} from "../src/shared/server/hosted-runtime/index.server";
import {readSubmissionAttachmentPreview} from "../src/entities/submission/api/submission-preview.server";

let signedIn=true,hasCurrentUser=true,visible=true,snapshotVisible=true,currentRole="member",previewReads=0,downloadReads=0;
let bytes=new TextEncoder().encode("<script>previewExecuted=true</script> 한글"),size=bytes.length,fileName="synthetic.txt",mime="text/plain";
const filters:Record<string,unknown>[]=[],revisions:number[]=[],logs:unknown[]=[];
mockModuleExports("@/src/entities/user/index.server",{getAuthSession:async()=>signedIn?{user:{email:"preview@example.test",role:"admin",isSuperuser:false}}:null,getUserByEmail:async()=>hasCurrentUser?{id:8,email:"preview@example.test",role:currentRole}:null});
mockModuleExports("@/src/shared/server/logging/index.server",{logUserAction:async(...args:unknown[])=>logs.push(args),logUserActionFailure:async(...args:unknown[])=>logs.push(args)});
const file=()=>({id:1,submissionId:1,taskId:1,currentRevision:2,revisionNumber:2,filePath:"synthetic-preview/file",fileName,fileMimeType:mime,fileSizeBytes:99999999});
mockModuleExports("@/src/entities/submission/index.server",{
  getSubmissionByIdForViewer:async(_id:number,filter:Record<string,unknown>)=>{filters.push(filter);return visible?file():null;},
  getSubmissionAttachmentForViewer:async(_id:number,filter:Record<string,unknown>)=>{filters.push(filter);return visible&&snapshotVisible?file():null;},
  getSubmissionRevisionForViewer:async(_id:number,revision:number,filter:Record<string,unknown>)=>{filters.push(filter);revisions.push(revision);return snapshotVisible?file():null;},
  readSubmissionAttachmentPreview:async(input:Parameters<typeof readSubmissionAttachmentPreview>[0])=>{previewReads++;return readSubmissionAttachmentPreview(input);},
  readStoredSubmissionAttachment:async()=>{downloadReads++;return {buffer:Buffer.from(bytes),fileSizeBytes:bytes.length};},
});
const legacy=await import("../app/api/submissions/[submissionId]/attachment/route");
const multi=await import("../app/api/submission-attachments/[attachmentId]/route");
function reset(){signedIn=true;hasCurrentUser=true;visible=true;snapshotVisible=true;currentRole="member";previewReads=0;downloadReads=0;filters.length=0;revisions.length=0;logs.length=0;bytes=new TextEncoder().encode("<script>previewExecuted=true</script> 한글");size=bytes.length;fileName="synthetic.txt";mime="text/plain";}
async function request(kind:"legacy"|"multi",query="?preview=1"){
  const bucket={get:async()=>({size,body:new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);c.close();}})})} as unknown as R2Bucket;
  return runWithHostedBindings({ATTACHMENTS:bucket},()=>kind==="legacy"?legacy.GET(new Request("http://127.0.0.1/api/submissions/1/attachment"+query),{params:Promise.resolve({submissionId:"1"})}):multi.GET(new Request("http://127.0.0.1/api/submission-attachments/1"+query),{params:Promise.resolve({attachmentId:"1"})}));
}
for(const kind of ["legacy","multi"] as const){
  test(`${kind} preview uses fresh identity/filter, JSON UTF-8, storage size and private headers`,async()=>{
    reset();const response=await request(kind);assert.equal(response.status,200);const body=await response.json();
    assert.equal(body.kind,"text");assert.equal(body.encoding,"utf-8");assert.equal(body.text,new TextDecoder().decode(bytes));assert.equal(body.fileSize,bytes.length);assert.equal(body.previewBytes,bytes.length);assert.equal(body.truncated,false);
    assert.match(response.headers.get("Content-Type")??"",/^application\/json/);assert.equal(response.headers.get("Cache-Control"),"private, no-store");assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");assert.match(response.headers.get("Content-Security-Policy")??"",/^sandbox;/);assert.equal(response.headers.get("Cross-Origin-Resource-Policy"),"same-origin");
    assert.ok(filters.every(f=>f.viewerUserId===8&&f.canSeeAll===false));assert.equal(previewReads,1);assert.equal(downloadReads,0);assert.equal(logs.length,0);
  });
  test(`${kind} next request rechecks identity, parent and snapshot before storage`,async()=>{
    reset();await request(kind);previewReads=0;visible=false;assert.equal((await request(kind)).status,404);assert.equal(previewReads,0);
    visible=true;snapshotVisible=false;assert.equal((await request(kind)).status,404);assert.equal(previewReads,0);
    snapshotVisible=true;hasCurrentUser=false;assert.equal((await request(kind)).status,404);assert.equal(previewReads,0);
    hasCurrentUser=true;signedIn=false;const denied=await request(kind);assert.equal(denied.status,401);assert.equal(denied.headers.get("Cache-Control"),"private, no-store");assert.equal(previewReads,0);
  });
  test(`${kind} safe errors distinguish unsupported/binary/oversize without logging contents`,async()=>{
    reset();fileName="a.pdf";mime="application/pdf";assert.equal((await request(kind)).status,415);
    fileName="a.txt";mime="text/plain";bytes=new Uint8Array([65,0,66]);size=bytes.length;assert.equal((await request(kind)).status,422);
    fileName="a.png";mime="image/png";size=8*1024*1024+1;assert.equal((await request(kind)).status,413);
    size=bytes.length;const invalidImage=await request(kind);assert.equal(invalidImage.status,422);assert.ok(!(await invalidImage.text()).includes("previewExecuted"));assert.equal(logs.length,0);
  });
  test(`${kind} verified raster uses inline bytes and actual length; normal download remains separate`,async()=>{
    reset();fileName="a.gif";mime="image/gif";bytes=new Uint8Array([71,73,70,56,57,97,1,0,1,0]);size=bytes.length;
    const response=await request(kind);assert.equal(response.headers.get("Content-Type"),"image/gif");assert.equal(response.headers.get("Content-Length"),String(bytes.length));assert.match(response.headers.get("Content-Disposition")??"",/^inline;/);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
    const download=await request(kind,"");assert.equal(download.status,200);assert.match(download.headers.get("Content-Disposition")??"",/^attachment;/);assert.equal(downloadReads,1);
  });
}
test("legacy preview keeps an explicitly selected historical revision and rejects malformed revisions",async()=>{
  reset();assert.equal((await request("legacy","?preview=1&revision=1")).status,200);assert.deepEqual(revisions,[1]);previewReads=0;
  assert.equal((await request("legacy","?preview=1&revision=1.5")).status,400);assert.equal(previewReads,0);
});
