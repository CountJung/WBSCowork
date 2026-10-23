import "./helpers/bootstrap";
import {test} from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import {mockModuleExports} from "./helpers/mock-module";
import type {R2Bucket} from "@cloudflare/workers-types";
import {runWithHostedBindings} from "../src/shared/server/hosted-runtime/index.server";

let fakeMode:"normal"|"eof"|"stat"|"read"|"oversized"="normal",closed=0,readCalls=0;
mockModuleExports("node:fs/promises",{...fs,open:async(file:Parameters<typeof fs.open>[0],flags:Parameters<typeof fs.open>[1],mode?:Parameters<typeof fs.open>[2])=>{
  if(typeof file!=="string"||!file.endsWith("/synthetic-preview/fault.txt"))return fs.open(file,flags,mode);
  return {
    stat:async()=>{if(fakeMode==="stat")throw new Error("synthetic stat failure");return {size:fakeMode==="oversized"?100:5,isFile:()=>true};},
    read:async(bytes:Uint8Array,offset:number,length:number)=>{readCalls++;if(fakeMode==="read")throw new Error("synthetic read failure");if(fakeMode==="eof")return {bytesRead:0};const n=Math.min(2,length);bytes.fill(65,offset,offset+n);return {bytesRead:n};},
    close:async()=>{closed++;},
  };
}});
const {readPrivateFilePrefix,storePrivateFile}=await import("../src/shared/server/private-files/index.server");

test("Native bounded reader uses actual file size and returns only the requested prefix",async()=>{
  const file=await storePrivateFile(new File(["1234567890"],"prefix.txt",{type:"text/plain"}),"synthetic-preview");
  const result=await readPrivateFilePrefix(file.filePath,4);
  assert.equal(result.fileSize,10);assert.equal(new TextDecoder().decode(result.bytes),"1234");
});
test("Native FileHandle closes on stat/read/short-EOF failure and loops on partial reads",async()=>{
  for(const mode of ["stat","read","eof"] as const){fakeMode=mode;closed=0;await assert.rejects(readPrivateFilePrefix("synthetic-preview/fault.txt",5));assert.equal(closed,1);}
  fakeMode="normal";closed=0;readCalls=0;
  const result=await readPrivateFilePrefix("synthetic-preview/fault.txt",5);
  assert.deepEqual([...result.bytes],[65,65,65,65,65]);assert.equal(readCalls,3);assert.equal(closed,1);
  fakeMode="oversized";closed=0;readCalls=0;
  const oversize=await readPrivateFilePrefix("synthetic-preview/fault.txt",8,true);
  assert.equal(oversize.fileSize,100);assert.equal(oversize.bytes.length,0);assert.equal(readCalls,0);assert.equal(closed,1);
});
test("R2 reader bounds prefix allocation by actual object size and cancels remaining body",async()=>{
  let canceled=false,pulls=0;
  const body=new ReadableStream<Uint8Array>({pull(controller){pulls++;controller.enqueue(new Uint8Array(1024).fill(65));},cancel(){canceled=true;}});
  const bucket={get:async()=>({size:100000000,body})} as unknown as R2Bucket;
  const result=await runWithHostedBindings({ATTACHMENTS:bucket},()=>readPrivateFilePrefix("synthetic-preview/prefix.txt",16));
  assert.equal(result.fileSize,100000000);assert.equal(result.bytes.length,16);assert.ok(canceled);assert.ok(pulls<=3);assert.equal(body.locked,false);
});
test("R2 image oversize skips stream reading; short EOF and missing storage fail closed",async()=>{
  let canceled=false;
  const body=new ReadableStream<Uint8Array>({cancel(){canceled=true;}});
  const bucket={get:async()=>({size:100,body})} as unknown as R2Bucket;
  const oversized=await runWithHostedBindings({ATTACHMENTS:bucket},()=>readPrivateFilePrefix("synthetic-preview/large.png",8,true));
  assert.equal(oversized.bytes.length,0);assert.equal(oversized.fileSize,100);assert.ok(canceled);
  const short=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([1]));c.close();}});
  await assert.rejects(runWithHostedBindings({ATTACHMENTS:{get:async()=>({size:5,body:short})} as unknown as R2Bucket},()=>readPrivateFilePrefix("synthetic-preview/short.txt",5)));
  assert.equal(short.locked,false);
  await assert.rejects(runWithHostedBindings({ATTACHMENTS:{get:async()=>null} as unknown as R2Bucket},()=>readPrivateFilePrefix("synthetic-preview/missing.txt",5)));
  await assert.rejects(readPrivateFilePrefix("../outside",5));
  await assert.rejects(readPrivateFilePrefix("synthetic-preview/a",9*1024*1024));
});
