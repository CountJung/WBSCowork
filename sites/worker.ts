import type { ExecutionContext } from "@cloudflare/workers-types";
import handler from "vinext/server/fetch-handler";
import { runWithHostedBindings, type HostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import { retryObjectCleanup } from "../src/shared/server/object-cleanup/index.server";

const MAX_REQUEST_BYTES = 22 * 1024 * 1024;
let activeMultipartRequests = 0;
const worker = {
  async fetch(request: Request, env: HostedBindings, ctx: ExecutionContext) {
    return runWithHostedBindings(env, async () => {
      const pathname = new URL(request.url).pathname;
      const bugRequest = pathname === "/bugs" || pathname.startsWith("/bugs/") || pathname === "/admin/bugs";
      const requestLimit = bugRequest ? 64 * 1024 : MAX_REQUEST_BYTES;
      const limitMessage = bugRequest ? "버그 제보 요청은 64KB 이하로 제한됩니다." : "요청 크기는 22MB 이하로 제한됩니다.";
      const multipart = request.headers.get("Content-Type")?.startsWith("multipart/form-data") ?? false;
      if (Number(request.headers.get("Content-Length")) > requestLimit) return new Response(limitMessage, { status: 413 });
      if (multipart && activeMultipartRequests >= 1) return new Response("업로드가 처리 중입니다. 잠시 후 다시 시도해 주세요.", { status: 503, headers: { "Retry-After": "2" } });
      if (multipart) activeMultipartRequests++;
      let exceeded = false;
      try {
        let bounded = request;
        if (request.body) {
          let bytes = 0;
          const stream = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              bytes += chunk.byteLength;
              if (bytes > requestLimit) { exceeded = true; throw new Error("Request body limit exceeded."); }
              controller.enqueue(chunk);
            },
          }));
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
        if (multipart) activeMultipartRequests--;
      }
    });
  },
};
export default worker;
