import { NextResponse } from "next/server";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { createProjectMedia, getProjectMediaFileForViewer, listProjectMedia, updateProjectMedia } from "@/src/entities/project-media/index.server";
import { MEDIA_REQUEST_MAX_BYTES, mediaId, mediaMutationKey, mediaMimeTypes, normalizeMediaFields, ProjectMediaError } from "@/src/entities/project-media";
import type { ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { readPrivateFile } from "@/src/shared/server/private-files/index.server";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", Vary: "Cookie" };
export class MediaRequestError extends Error { constructor(readonly status: number) { super(String(status)); } }
export const mediaJson = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
export function mediaHttpError(error: unknown) {
  const status = error instanceof ProjectMediaError || error instanceof MediaRequestError ? error.status : 503;
  return mediaJson({ message: status === 401 ? "로그인 후 다시 시도해 주세요." : status === 404 ? "미디어를 찾을 수 없습니다." : status === 409 ? "변경된 내용이 있습니다. 초안을 보관하고 최신 목록을 확인해 주세요." : status === 413 ? "이미지는 8MiB, 영상은 20MiB 이하이며 사이트의 파일 한도가 더 작으면 그 한도를 따릅니다." : status === 400 || status === 415 ? "제목·공개 범위와 실제 파일 형식을 확인해 주세요." : status === 403 ? "요청한 화면에서 다시 시도해 주세요." : "미디어를 처리하지 못했습니다. 입력을 보관하고 현재 저장 결과를 확인해 주세요." }, status);
}
export async function getMediaViewer(): Promise<ProjectViewer> {
  const session = await getAuthSession(); if (!session?.user?.email) throw new MediaRequestError(401);
  const user = await getUserByEmail(session.user.email); if (!user) throw new MediaRequestError(404);
  return { userId: user.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
function origin(request: Request) {
  const url = new URL(getRuntimeEnv().auth.nextAuthUrl ?? request.url);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new MediaRequestError(503);
  if (request.headers.get("Origin") !== url.origin) throw new MediaRequestError(403);
}
/** Streaming bound before formData/JSON parsing, including missing or misleading Content-Length. */
function bounded(request: Request, limit: number) {
  if (Number(request.headers.get("Content-Length")) > limit) throw new MediaRequestError(413);
  if (!request.body) throw new MediaRequestError(400);
  let size = 0, exceeded = false;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { size += chunk.byteLength; if (size > limit) { exceeded = true; throw new MediaRequestError(413); } controller.enqueue(chunk); } }));
  const boundedRequest = new Request(request.url, { method: request.method, headers: request.headers, body, duplex: "half" } as RequestInit & { duplex: string });
  return { request: boundedRequest, exceeded: () => exceeded };
}
type Context = { params: Promise<{ projectId: string; teamId: string; mediaId?: string }> };
export async function readMedia(request: Request, context: Context) {
  try {
    const viewer = await getMediaViewer(), p = await context.params, value = new URL(request.url).searchParams.get("after");
    if (value !== null && !/^(?:0|[1-9]\d*)$/.test(value)) throw new MediaRequestError(400);
    const result = await listProjectMedia(viewer, mediaId(p.projectId), mediaId(p.teamId), value === null ? 0 : Number(value));
    return mediaJson(result);
  } catch (error) { return mediaHttpError(error); }
}
export async function uploadMedia(request: Request, context: Context) {
  try {
    const viewer = await getMediaViewer(), p = await context.params; origin(request);
    if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("multipart/form-data;")) throw new MediaRequestError(415);
    const input = bounded(request, MEDIA_REQUEST_MAX_BYTES); let form: FormData;
    try { form = await input.request.formData(); } catch { throw new MediaRequestError(input.exceeded() ? 413 : 400); }
    const allowed = ["file", "title", "caption", "visibility", "mutationKey"];
    if ([...form.keys()].some(key => !allowed.includes(key)) || allowed.some(key => form.getAll(key).length !== 1)) throw new MediaRequestError(400);
    const file = form.get("file"); if (!(file instanceof File)) throw new MediaRequestError(400);
    const fields = normalizeMediaFields({ title: form.get("title"), caption: form.get("caption"), visibility: form.get("visibility") });
    const item = await createProjectMedia(viewer, mediaId(p.projectId), mediaId(p.teamId), { ...fields, file, mutationKey: mediaMutationKey(form.get("mutationKey")) });
    return mediaJson({ item }, 201);
  } catch (error) { return mediaHttpError(error); }
}
export async function editMedia(request: Request, context: Context) {
  try {
    const viewer = await getMediaViewer(), p = await context.params; origin(request);
    if ((request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new MediaRequestError(415);
    const input = bounded(request, 12 * 1024); let value: Record<string, unknown>;
    try { value = await input.request.json(); } catch { throw new MediaRequestError(input.exceeded() ? 413 : 400); }
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["title", "caption", "visibility", "version", "mutationKey"].includes(key))) throw new MediaRequestError(400);
    const fields = normalizeMediaFields({ title: value.title, caption: value.caption, visibility: value.visibility });
    if (typeof value.version !== "number") throw new MediaRequestError(400);
    const item = await updateProjectMedia(viewer, mediaId(p.projectId), mediaId(p.teamId), mediaId(p.mediaId), { ...fields, version: value.version, mutationKey: mediaMutationKey(value.mutationKey) });
    return mediaJson({ item });
  } catch (error) { return mediaHttpError(error); }
}
/** Slice an authorized private stream without publishing storage URLs or buffering a video twice. */
export function mediaRangeStream(source: ReadableStream<Uint8Array>, start: number, end: number) {
  const reader = source.getReader(); let offset = 0, cleaned = false;
  async function cleanup(cancel: boolean) {
    if (cleaned) return; cleaned = true;
    try { if (cancel) await reader.cancel(); } catch { /* Preserve the original stream failure. */ }
    finally { reader.releaseLock(); }
  }
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) { await cleanup(false); controller.close(); return; }
          const begin = Math.max(0, start - offset), finish = Math.min(part.value.length, end + 1 - offset); offset += part.value.length;
          if (finish > begin) controller.enqueue(part.value.subarray(begin, finish));
          if (offset > end) { await cleanup(true); controller.close(); return; }
          if (finish > begin) return;
        }
      } catch (error) { await cleanup(true); controller.error(error); }
    },
    async cancel() { await cleanup(true); },
  });
}
export async function serveMedia(request: Request, context: Context) {
  try {
    const viewer = await getMediaViewer(), p = await context.params;
    const original = await getProjectMediaFileForViewer(viewer, mediaId(p.projectId), mediaId(p.teamId), mediaId(p.mediaId)), filePath = original.filePath;
    let item = original.item;
    const stored = await readPrivateFile(filePath);
    try {
      // Storage is asynchronous: membership, role and visibility may change while it is read.
      const current = await getProjectMediaFileForViewer(viewer, mediaId(p.projectId), mediaId(p.teamId), mediaId(p.mediaId));
      if (current.filePath !== filePath || current.contentHash !== original.contentHash || current.item.sizeBytes !== original.item.sizeBytes || current.item.mimeType !== original.item.mimeType || !mediaMimeTypes.includes(current.item.mimeType)) throw new MediaRequestError(503);
      item = current.item;
    } catch (error) { if (!(stored.buffer instanceof Uint8Array)) await stored.buffer.cancel().catch(() => undefined); throw error; }
    if (stored.fileSizeBytes !== item.sizeBytes || item.sizeBytes < 1 || item.sizeBytes > 20 * 1024 * 1024) { if (!(stored.buffer instanceof Uint8Array)) await stored.buffer.cancel(); throw new MediaRequestError(503); }
    const responseHeaders: Record<string, string> = { ...headers, "Accept-Ranges": "bytes", "Content-Type": item.mimeType, "Content-Length": String(item.sizeBytes), "Content-Security-Policy": "sandbox; default-src 'none'", "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(item.fileName).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}` };
    let start = 0, end = item.sizeBytes - 1, status = 200;
    const range = request.headers.get("Range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { if (!(stored.buffer instanceof Uint8Array)) await stored.buffer.cancel(); return new Response(null, { status: 416, headers: { ...responseHeaders, "Content-Range": `bytes */${item.sizeBytes}`, "Content-Length": "0" } }); }
      start = match[1] ? Number(match[1]) : Math.max(0, item.sizeBytes - Number(match[2]));
      end = match[1] && match[2] ? Math.min(item.sizeBytes - 1, Number(match[2])) : item.sizeBytes - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= item.sizeBytes || (!match[1] && Number(match[2]) < 1)) { if (!(stored.buffer instanceof Uint8Array)) await stored.buffer.cancel(); return new Response(null, { status: 416, headers: { ...responseHeaders, "Content-Range": `bytes */${item.sizeBytes}`, "Content-Length": "0" } }); }
      status = 206; responseHeaders["Content-Range"] = `bytes ${start}-${end}/${item.sizeBytes}`; responseHeaders["Content-Length"] = String(end - start + 1);
    }
    const body = stored.buffer instanceof Uint8Array ? new Uint8Array(stored.buffer.subarray(start, end + 1)) : mediaRangeStream(stored.buffer, start, end);
    return new Response(body as BodyInit, { status, headers: responseHeaders });
  } catch (error) { return mediaHttpError(error); }
}
