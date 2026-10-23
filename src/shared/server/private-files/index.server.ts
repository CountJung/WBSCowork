import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, stat, rm, open } from "node:fs/promises";
import path from "node:path";
import { getHostedAttachments, isHostedRuntime } from "../hosted-runtime/index.server";
import { queueObjectCleanup, deleteUnreferencedObject, validateObjectKey } from "../object-cleanup/index.server";
import { getRuntimeEnv } from "../runtime-env/index.server";

export type StoredPrivateFile = { contentHash: string; absolutePath: string; filePath: string; fileMimeType: string; fileName: string; fileSizeBytes: number };
export type NativePrivateFileStaging = {beforeWrite:(key:string,size:number,hash:string)=>Promise<void>;onWriteFailure:(key:string)=>Promise<void>};
export function privateUploadRoot() {
  return path.resolve(getRuntimeEnv().uploadDir);
}
export function privateFilePath(key: string) {
  validateObjectKey(key);
  const root = privateUploadRoot(), target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) throw new Error("Invalid private file path.");
  return target;
}
export async function storePrivateFile(file: File, directory: string, nativeStaging?:NativePrivateFileStaging): Promise<StoredPrivateFile> {
  validateObjectKey(directory);
  const safe = path.basename(file.name).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0,120) || "attachment";
  const filePath = `${directory}/${randomUUID()}-${safe}`;
  const fileName = path.basename(file.name).replace(/[\x00-\x1f\x7f/\\:*?"<>|]+/g,"_").slice(0,255) || "attachment";
  const hash = createHash("sha256"), reader = file.stream().getReader();
  for (;;) { const chunk = await reader.read(); if (chunk.done) break; hash.update(chunk.value); }
  const contentHash = hash.digest("hex");
  if (isHostedRuntime()) {
    await queueObjectCleanup(filePath, 60*60*1000);
    try {
      await getHostedAttachments().put(filePath, file as unknown as import("@cloudflare/workers-types").Blob, { httpMetadata: {contentType:"application/octet-stream"} });
    } catch (error) { await deleteUnreferencedObject(filePath).catch(() => undefined); throw error; }
  } else {
    const target = privateFilePath(filePath);
    await nativeStaging?.beforeWrite(filePath,file.size,contentHash);
    try { await mkdir(path.dirname(target), {recursive:true});await writeFile(target, Buffer.from(await file.arrayBuffer())); }
    catch (error) {
      if(nativeStaging){
        // The precommitted ledger survives a second failure here; preserve partial
        // bytes for review rather than removing a file whose outcome is uncertain.
        await nativeStaging.onWriteFailure(filePath).catch(()=>undefined);
      }else await rm(target, {force:true}).catch(()=>undefined);
      throw error;
    }
  }
  return {contentHash, filePath, absolutePath:isHostedRuntime()?filePath:privateFilePath(filePath), fileName, fileMimeType:file.type || "application/octet-stream", fileSizeBytes:file.size};
}
export async function readPrivateFile(filePath: string) {
  if (isHostedRuntime()) {
    const object = await getHostedAttachments().get(validateObjectKey(filePath));
    if (!object) throw new Error("Attachment object not found.");
    return {absolutePath:filePath, buffer:object.body as unknown as ReadableStream<Uint8Array>, fileSizeBytes:object.size};
  }
  const target = privateFilePath(filePath);
  const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
  return {absolutePath:target, buffer, fileSizeBytes:info.size};
}

/** Preview-only bounded I/O. Uses storage size, never the DB's advisory file-size metadata. */
export async function readPrivateFilePrefix(filePath:string,limit:number,rejectOversized=false):Promise<{bytes:Uint8Array;fileSize:number}> {
  if(!Number.isSafeInteger(limit)||limit<1||limit>8*1024*1024)throw new Error("Invalid private preview read limit.");
  if(isHostedRuntime()){
    const object=await getHostedAttachments().get(validateObjectKey(filePath));
    if(!object)throw new Error("Attachment object not found.");
    const fileSize=object.size;
    if(!Number.isSafeInteger(fileSize)||fileSize<0){await object.body.cancel();throw new Error("Invalid attachment size.");}
    if(rejectOversized&&fileSize>limit){await object.body.cancel();return {bytes:new Uint8Array(),fileSize};}
    const bytes=new Uint8Array(Math.min(limit,fileSize)),reader=object.body.getReader();
    let offset=0;
    try{
      while(offset<bytes.length){const chunk=await reader.read();if(chunk.done)break;const length=Math.min(chunk.value.byteLength,bytes.length-offset);bytes.set(chunk.value.subarray(0,length),offset);offset+=length;}
      if(offset!==bytes.length)throw new Error("Attachment stream ended before its stored size.");
      return {bytes,fileSize};
    }finally{try{await reader.cancel();}finally{reader.releaseLock();}}
  }
  const handle=await open(privateFilePath(filePath),"r");
  try{
    const info=await handle.stat(),fileSize=info.size;
    if(!info.isFile()||!Number.isSafeInteger(fileSize)||fileSize<0)throw new Error("Invalid attachment size.");
    if(rejectOversized&&fileSize>limit)return {bytes:new Uint8Array(),fileSize};
    const bytes=new Uint8Array(Math.min(limit,fileSize));let offset=0;
    while(offset<bytes.length){const read=await handle.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)break;offset+=read.bytesRead;}
    if(offset!==bytes.length)throw new Error("Attachment file changed during its preview read.");
    return {bytes,fileSize};
  }finally{await handle.close();}
}
