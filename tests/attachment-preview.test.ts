import {test} from "node:test";
import assert from "node:assert/strict";
import {getAttachmentPreviewKind,decodeAttachmentTextPreview,validateAttachmentImage,AttachmentPreviewError,ATTACHMENT_TEXT_PREVIEW_BYTES,ATTACHMENT_IMAGE_PREVIEW_BYTES} from "../src/shared/lib/attachment-preview";

test("preview candidates require a known extension and compatible MIME; active formats become text",()=>{
  for(const [name,mime] of [["a.txt","text/plain"],["a.csv","text/csv"],["a.json","application/json"],["a.html","text/html"],["a.svg","image/svg+xml"],["a.md","text/markdown"],["a.ts","application/octet-stream"]])assert.equal(getAttachmentPreviewKind(name,mime),"text");
  for(const [name,mime] of [["a.png","image/png"],["a.jpg","image/jpeg"],["a.gif","image/gif"],["a.webp","image/webp"],["a.avif","image/avif"]])assert.equal(getAttachmentPreviewKind(name,mime),"image");
  for(const [name,mime] of [["a.txt","image/png"],["a.jpg","image/png"],["a.pdf","application/pdf"],["a.mp4","video/mp4"],["a.wav","audio/wav"],["a.bin","text/plain"],["a.txt","text/plain\r\nX-Evil:yes"],["a.txt","text/plain; charset=utf-16"]])assert.equal(getAttachmentPreviewKind(name,mime),null);
});
test("UTF-8 and BOM text preserve Korean and hostile markup as uninterpreted strings",()=>{
  const text='<script>globalThis.previewExecuted=true</script> 안녕 & <svg onload="alert(1)">';
  const bytes=new TextEncoder().encode("\ufeff"+text);
  assert.deepEqual(decodeAttachmentTextPreview(bytes,bytes.length),{kind:"text",text,encoding:"utf-8",truncated:false,previewBytes:bytes.length,fileSize:bytes.length});
});
test("bounded UTF-8 prefixes trim only an unfinished final code point and report truncation",()=>{
  const bytes=new Uint8Array(ATTACHMENT_TEXT_PREVIEW_BYTES).fill(0x61);bytes.set([0xed,0x95],bytes.length-2);
  const result=decodeAttachmentTextPreview(bytes,bytes.length+1);
  assert.equal(result.text.length,bytes.length-2);assert.equal(result.truncated,true);assert.equal(result.previewBytes,bytes.length);
  assert.throws(()=>decodeAttachmentTextPreview(bytes,bytes.length),AttachmentPreviewError);
  bytes[0]=0xff;assert.throws(()=>decodeAttachmentTextPreview(bytes,bytes.length+1),AttachmentPreviewError);
});
test("UTF-16, legacy Korean, NUL/control/binary and invalid sizes fail closed",()=>{
  for(const bytes of [new Uint8Array([0xff,0xfe,0x61,0]),new Uint8Array([0xfe,0xff,0,0x61]),new Uint8Array([0xbe,0xc8,0xb3,0xe7]),new Uint8Array([65,0,66]),new Uint8Array([65,1,66]),new Uint8Array([0xc3,0x28])])assert.throws(()=>decodeAttachmentTextPreview(bytes,bytes.length),AttachmentPreviewError);
  assert.throws(()=>decodeAttachmentTextPreview(new Uint8Array(ATTACHMENT_TEXT_PREVIEW_BYTES+1),ATTACHMENT_TEXT_PREVIEW_BYTES+1));
  assert.throws(()=>decodeAttachmentTextPreview(new Uint8Array([1]),0));
});
const png=()=>{const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);new DataView(bytes.buffer).setUint32(16,1);new DataView(bytes.buffer).setUint32(20,1);return bytes;};
function box(type:string,body:Uint8Array){const bytes=new Uint8Array(8+body.length);new DataView(bytes.buffer).setUint32(0,bytes.length);bytes.set(new TextEncoder().encode(type),4);bytes.set(body,8);return bytes;}
const join=(...parts:Uint8Array[])=>{const bytes=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;};
const avif=(width=1,height=1)=>{const ispe=new Uint8Array(12);new DataView(ispe.buffer).setUint32(4,width);new DataView(ispe.buffer).setUint32(8,height);return join(box("ftyp",join(new TextEncoder().encode("avif"),new Uint8Array(4))),box("meta",join(new Uint8Array(4),box("iprp",box("ipco",box("ispe",ispe))))));};
test("raster signatures and available dimensions are checked against their exact MIME",()=>{
  assert.equal(validateAttachmentImage(png(),"image/png"),"image/png");
  const gif=new Uint8Array([71,73,70,56,57,97,1,0,1,0]);assert.equal(validateAttachmentImage(gif,"image/gif"),"image/gif");
  const jpeg=new Uint8Array([255,216,255,192,0,8,8,0,1,0,1,1]);assert.equal(validateAttachmentImage(jpeg,"image/jpeg"),"image/jpeg");
  const webp=new Uint8Array(30);webp.set(new TextEncoder().encode("RIFF"));webp.set(new TextEncoder().encode("WEBPVP8X"),8);assert.equal(validateAttachmentImage(webp,"image/webp"),"image/webp");
  assert.equal(validateAttachmentImage(avif(),"image/avif"),"image/avif");
  assert.throws(()=>validateAttachmentImage(png(),"image/jpeg"));
  assert.throws(()=>validateAttachmentImage(new TextEncoder().encode('<svg onload="alert(1)"/>'),"image/png"));
  const huge=png();new DataView(huge.buffer).setUint32(16,100000);assert.throws(()=>validateAttachmentImage(huge,"image/png"));
  assert.throws(()=>validateAttachmentImage(new Uint8Array(ATTACHMENT_IMAGE_PREVIEW_BYTES+1),"image/png"));
});
test("AVIF requires bounded container properties, not a signature or ispe hidden in media bytes",()=>{
  const ftyp=box("ftyp",join(new TextEncoder().encode("avif"),new Uint8Array(4)));
  assert.throws(()=>validateAttachmentImage(ftyp,"image/avif"));
  assert.throws(()=>validateAttachmentImage(join(box("ftyp",new Uint8Array(2048)),avif()),"image/avif"));
  assert.throws(()=>validateAttachmentImage(join(ftyp,box("mdat",avif())),"image/avif"));
  assert.throws(()=>validateAttachmentImage(avif(9000,1),"image/avif"));
  const tinyBoxes=join(...Array.from({length:1025},()=>box("free",new Uint8Array())));
  assert.throws(()=>validateAttachmentImage(join(avif(),tinyBoxes),"image/avif"));
  let nested=box("ispe",new Uint8Array(12));for(let i=0;i<8;i++)nested=box("ipco",nested);
  assert.throws(()=>validateAttachmentImage(join(ftyp,nested),"image/avif"));
});
