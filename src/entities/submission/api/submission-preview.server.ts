import {attachmentPreviewMime,getAttachmentPreviewKind,decodeAttachmentTextPreview,validateAttachmentImage,AttachmentPreviewError,ATTACHMENT_TEXT_PREVIEW_BYTES,ATTACHMENT_IMAGE_PREVIEW_BYTES,type AttachmentTextPreview} from "@/src/shared/lib/attachment-preview";
import {readPrivateFilePrefix} from "@/src/shared/server/private-files/index.server";

export type StoredAttachmentPreview = {kind:"text";data:AttachmentTextPreview}|{kind:"image";bytes:Uint8Array;mimeType:string;fileSize:number};
/** Caller must authorize the current parent and immutable revision before invoking this I/O. */
export async function readSubmissionAttachmentPreview(file:{filePath:string;fileName:string;fileMimeType?:string|null}):Promise<StoredAttachmentPreview> {
  const kind=getAttachmentPreviewKind(file.fileName,file.fileMimeType);
  if(!kind)throw new AttachmentPreviewError("unsupported","이 파일 형식은 미리보기를 지원하지 않습니다. 원본을 다운로드해 주세요.");
  const prefix=await readPrivateFilePrefix(file.filePath,kind==="text"?ATTACHMENT_TEXT_PREVIEW_BYTES:ATTACHMENT_IMAGE_PREVIEW_BYTES,kind==="image");
  if(kind==="text")return {kind,data:decodeAttachmentTextPreview(prefix.bytes,prefix.fileSize)};
  if(prefix.fileSize>ATTACHMENT_IMAGE_PREVIEW_BYTES)throw new AttachmentPreviewError("too_large","이미지는 8MB 이하만 미리볼 수 있습니다. 원본을 다운로드해 주세요.");
  const mimeType=validateAttachmentImage(prefix.bytes,attachmentPreviewMime(file.fileMimeType));
  return {kind,bytes:prefix.bytes,mimeType,fileSize:prefix.fileSize};
}
