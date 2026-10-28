import type { ExecutionContext } from "@cloudflare/workers-types";
import handler from "vinext/server/fetch-handler";
import { runWithHostedBindings, type HostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import { retryObjectCleanup } from "../src/shared/server/object-cleanup/index.server";
import { boundRequestBody, createMultipartAdmission, declaredContentLength } from "./multipart-admission";
import publicOrigin from "./public-origin.json";

declare const __WBSCOWORK_SITE_PROJECT_ID__: string;

const MAX_REQUEST_BYTES = 22 * 1024 * 1024;
const multipartAdmission = createMultipartAdmission();
const worker = {
  async fetch(request: Request, env: HostedBindings, ctx: ExecutionContext) {
    return runWithHostedBindings(env, async () => {
      const pathname = new URL(request.url).pathname;
      const bugRequest = pathname === "/bugs" || pathname.startsWith("/bugs/") || pathname === "/admin/bugs" || pathname.startsWith("/admin/bugs/");
      const requestLimit = pathname === "/bugs" && request.headers.get("Content-Type")?.startsWith("multipart/form-data") ? 7 * 1024 * 1024 : bugRequest ? 64 * 1024 : MAX_REQUEST_BYTES;
      const limitMessage = `요청 크기는 ${requestLimit}바이트 이하로 제한됩니다.`;
      const multipart = request.headers.get("Content-Type")?.startsWith("multipart/form-data") ?? false;
      const declaredBytes = declaredContentLength(request.headers.get("Content-Length"));
      if (declaredBytes !== null && declaredBytes > requestLimit) return new Response(limitMessage, { status: 413 });
      const permit = multipart ? multipartAdmission.acquire(declaredBytes) : null;
      if (multipart && !permit) return new Response("업로드가 처리 중입니다. 잠시 후 다시 시도해 주세요.", { status: 503, headers: { "Retry-After": "2" } });
      // A forged small length cannot acquire a small reservation then decode a large body.
      const streamLimit = multipart && declaredBytes !== null ? Math.min(requestLimit, declaredBytes) : requestLimit;
      let exceeded = false;
      try {
        let bounded = request;
        if (request.body) {
          const stream = boundRequestBody(request.body, streamLimit, () => { exceeded = true; });
          bounded = new Request(request, { body: stream, duplex: "half" } as RequestInit);
        }
        const response = await handler.fetch(bounded, env, ctx);
        if (exceeded) return new Response(limitMessage, { status: 413 });
        if (request.method === "POST" && env.DB && env.ATTACHMENTS) ctx.waitUntil(retryObjectCleanup().catch(() => undefined));
        return response;
      } catch (error) {
        if (exceeded) return new Response(limitMessage, { status: 413 });
        throw error;
      } finally {
        permit?.release();
      }
    }, { requestUrl: request.url, publicOrigin: publicOrigin.origin, projectId: publicOrigin.project_id, expectedProjectId: __WBSCOWORK_SITE_PROJECT_ID__ });
  },
};
export default worker;
