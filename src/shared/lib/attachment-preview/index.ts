/** Client-safe candidates only. The server must validate stored bytes before serving a preview. */
export const ATTACHMENT_TEXT_PREVIEW_BYTES = 256 * 1024;
export const ATTACHMENT_IMAGE_PREVIEW_BYTES = 8 * 1024 * 1024;
export const ATTACHMENT_IMAGE_MAX_PIXELS = 32 * 1024 * 1024;
export type AttachmentPreviewKind = "text" | "image";
export type AttachmentTextPreview = {kind:"text";text:string;encoding:"utf-8";truncated:boolean;previewBytes:number;fileSize:number};
export type AttachmentPreviewErrorCode = "unsupported" | "invalid_content" | "too_large";
export class AttachmentPreviewError extends Error {
  constructor(public readonly code:AttachmentPreviewErrorCode, message:string) {super(message);this.name="AttachmentPreviewError";}
}

const textExtensions=new Set("txt text log csv tsv json jsonl ndjson xml html htm svg md markdown js mjs cjs jsx ts tsx css scss sass less yaml yml toml ini cfg conf sql py rb go rs java c cc cpp h hpp sh bash ps1 bat diff patch properties".split(" "));
const textMimes=new Set(["text/plain","text/csv","text/tab-separated-values","text/markdown","text/html","text/css","text/xml","text/javascript","text/x-typescript","text/x-python","text/x-script.python","text/x-shellscript","text/x-sh","text/yaml","text/x-yaml","text/x-c","text/x-c++","text/x-java-source","application/json","application/ld+json","application/x-ndjson","application/xml","application/javascript","application/x-javascript","application/typescript","application/x-typescript","application/yaml","application/x-yaml","application/toml","application/sql","application/x-sh","image/svg+xml","application/octet-stream"]);
const imageExtensions:Record<string,string[]>={"image/png":["png"],"image/jpeg":["jpg","jpeg"],"image/gif":["gif"],"image/webp":["webp"],"image/avif":["avif"]};
export function attachmentPreviewMime(mimeType?:string|null) {
  if(!mimeType)return "application/octet-stream";
  if(/[\r\n\x00]/.test(mimeType))return "";
  const parts=mimeType.toLowerCase().trim().split(";").map(p=>p.trim());
  if(parts.length>2||(parts[1]&&!/^charset=(?:utf-8|utf8|us-ascii|"utf-8")$/.test(parts[1])))return "";
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(parts[0])?parts[0]:"";
}
export function getAttachmentPreviewKind(fileName:string,mimeType?:string|null):AttachmentPreviewKind|null {
  const extension=fileName.toLowerCase().split(".").at(-1)??"", mime=attachmentPreviewMime(mimeType);
  if(imageExtensions[mime]?.includes(extension))return "image";
  if(textExtensions.has(extension)&&textMimes.has(mime))return "text";
  return null;
}

/** Decode a bounded prefix. A partial final UTF-8 character is held back, never replaced. */
export function decodeAttachmentTextPreview(bytes:Uint8Array,fileSize:number):AttachmentTextPreview {
  if(!Number.isSafeInteger(fileSize)||fileSize<0||bytes.length>ATTACHMENT_TEXT_PREVIEW_BYTES||bytes.length>fileSize)throw new AttachmentPreviewError("invalid_content","파일 내용을 확인할 수 없습니다.");
  if((bytes[0]===0xff&&bytes[1]===0xfe)||(bytes[0]===0xfe&&bytes[1]===0xff))throw new AttachmentPreviewError("unsupported","UTF-8 텍스트만 미리볼 수 있습니다. 원본을 다운로드해 주세요.");
  const truncated=fileSize>bytes.length;
  let text:string;
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes,{stream:truncated});}
  catch{throw new AttachmentPreviewError("invalid_content","UTF-8 텍스트가 아니거나 파일 내용이 손상되었습니다. 원본을 다운로드해 주세요.");}
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text))throw new AttachmentPreviewError("invalid_content","바이너리 파일은 텍스트로 미리볼 수 없습니다. 원본을 다운로드해 주세요.");
  return {kind:"text",text,encoding:"utf-8",truncated,previewBytes:bytes.length,fileSize};
}

function invalidImage():never {throw new AttachmentPreviewError("invalid_content","이미지 형식과 실제 내용이 일치하지 않거나 손상되었습니다. 원본을 다운로드해 주세요.");}
function dimensions(width:number,height:number){
  if(width<1||height<1||width>8192||height>8192||width*height>ATTACHMENT_IMAGE_MAX_PIXELS)throw new AttachmentPreviewError("too_large","미리보기 이미지의 해상도가 너무 큽니다. 원본을 다운로드해 주세요.");
}
/** Minimal format signature/dimension checks, not a replacement for the browser's image decoder. */
export function validateAttachmentImage(bytes:Uint8Array,mimeType:string):string {
  if(bytes.length>ATTACHMENT_IMAGE_PREVIEW_BYTES)throw new AttachmentPreviewError("too_large","이미지는 8MB 이하만 미리볼 수 있습니다. 원본을 다운로드해 주세요.");
  const mime=attachmentPreviewMime(mimeType),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const ascii=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  if(mime==="image/png"){
    if(bytes.length<24||ascii(0,8)!=="\x89PNG\r\n\x1a\n"||ascii(12,4)!=="IHDR"||v.getUint32(8)!==13)invalidImage();
    dimensions(v.getUint32(16),v.getUint32(20));
  }else if(mime==="image/gif"){
    if(bytes.length<10||!["GIF87a","GIF89a"].includes(ascii(0,6)))invalidImage();
    dimensions(v.getUint16(6,true),v.getUint16(8,true));
  }else if(mime==="image/jpeg"){
    if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)invalidImage();
    let found=false;
    for(let offset=2;offset+1<bytes.length;){
      if(bytes[offset++]!==0xff)invalidImage();
      while(offset<bytes.length&&bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];
      if(marker===0xda||marker===0xd9)break;
      if(marker===1||(marker>=0xd0&&marker<=0xd8))continue;
      if(offset+2>bytes.length)invalidImage();
      const length=v.getUint16(offset);if(length<2||offset+length>bytes.length)invalidImage();
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        if(length<8)invalidImage();dimensions(v.getUint16(offset+5),v.getUint16(offset+3));found=true;break;
      }
      offset+=length;
    }
    if(!found)invalidImage();
  }else if(mime==="image/webp"){
    if(bytes.length<25||ascii(0,4)!=="RIFF"||ascii(8,4)!=="WEBP")invalidImage();
    const u24=(offset:number)=>bytes[offset]+bytes[offset+1]*256+bytes[offset+2]*65536;
    if(ascii(12,4)==="VP8X"&&bytes.length>=30)dimensions(u24(24)+1,u24(27)+1);
    else if(ascii(12,4)==="VP8L"&&bytes[20]===0x2f)dimensions(1+((bytes[21]|bytes[22]<<8)&0x3fff),1+((bytes[22]>>6|bytes[23]<<2|bytes[24]<<10)&0x3fff));
    else if(ascii(12,4)==="VP8 "&&bytes.length>=30&&ascii(23,3)==="\x9d\x01\x2a")dimensions(v.getUint16(26,true)&0x3fff,v.getUint16(28,true)&0x3fff);
    else invalidImage();
  }else if(mime==="image/avif"){
    if(bytes.length<16||ascii(4,4)!=="ftyp")invalidImage();
    const boxSize=v.getUint32(0);if(boxSize<16||boxSize>1024||boxSize>bytes.length)invalidImage();
    const brands=[ascii(8,4)];for(let offset=16;offset+4<=boxSize;offset+=4)brands.push(ascii(offset,4));
    if(!brands.some(brand=>brand==="avif"||brand==="avis"))invalidImage();
    // Follow bounded ISO-BMFF boxes rather than scanning media payload bytes.
    let boxes=0,foundDimensions=false;
    const walk=(start:number,end:number,depth:number,parent:string)=>{
      if(depth>6)invalidImage();
      for(let offset=start;offset<end;){
        if(++boxes>1024||offset+8>end)invalidImage();
        let size=v.getUint32(offset),header=8;
        const type=ascii(offset+4,4);
        if(size===1){if(offset+16>end)invalidImage();const large=v.getBigUint64(offset+8);if(large>BigInt(end-offset))invalidImage();size=Number(large);header=16;}
        else if(size===0)size=end-offset;
        if(size<header||size>end-offset)invalidImage();
        if(type==="ispe"&&parent==="ipco"){
          if(size<header+12)invalidImage();
          dimensions(v.getUint32(offset+header+4),v.getUint32(offset+header+8));foundDimensions=true;
        }else if(type==="meta"||type==="iprp"||type==="ipco"){
          const fullBox=type==="meta"?4:0;
          if(size<header+fullBox)invalidImage();
          walk(offset+header+fullBox,offset+size,depth+1,type);
        }
        offset+=size;
      }
    };
    walk(0,bytes.length,0,"");
    if(!foundDimensions)invalidImage();
  }else invalidImage();
  return mime;
}
