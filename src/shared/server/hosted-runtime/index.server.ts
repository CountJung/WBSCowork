import { AsyncLocalStorage } from "node:async_hooks";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type HostedBindings = { DB?: D1Database; ATTACHMENTS?: R2Bucket };
export type HostedRequestContextInput = { requestUrl: string; publicOrigin: string; projectId: string; expectedProjectId: string };
export type HostedRequestContext = Readonly<{ ingressOrigin: string; publicOrigin: string; projectId: string }>;
type HostedScope = { bindings: HostedBindings; requestContext?: HostedRequestContext };
const scope = new AsyncLocalStorage<HostedScope>();

function requestContext(input?: HostedRequestContextInput): HostedRequestContext | undefined {
  if (!input) return undefined;
  try {
    if (typeof input.projectId !== "string" || input.projectId.trim() !== input.projectId || !/^appgprj_[a-zA-Z0-9]+$/.test(input.projectId) || input.projectId !== input.expectedProjectId) return undefined;
    const published = new URL(input.publicOrigin), incoming = new URL(input.requestUrl);
    // Public metadata contains an exact origin, not a URL prefix or host suffix.
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(published.hostname);
    if (input.publicOrigin !== published.origin || published.username || published.password || (published.protocol !== "https:" && !(published.protocol === "http:" && loopback))) return undefined;
    if (!["http:", "https:"].includes(incoming.protocol) || incoming.username || incoming.password) return undefined;
    return Object.freeze({ ingressOrigin: incoming.origin, publicOrigin: published.origin, projectId: input.projectId });
  } catch { return undefined; }
}

export function runWithHostedBindings<T>(bindings: HostedBindings, run: () => T, context?: HostedRequestContextInput): T {
  return scope.run({ bindings, requestContext: requestContext(context) }, run);
}
/** Only the Worker entry supplies this context; headers and route input cannot override it. */
export function getHostedRequestContext(): HostedRequestContext | undefined { return scope.getStore()?.requestContext; }
export function isHostedRuntime() {
  return (typeof __WBSCOWORK_WORKER__ !== "undefined" && __WBSCOWORK_WORKER__) || Boolean(scope.getStore());
}
export function getHostedDatabase() {
  const db = scope.getStore()?.bindings.DB;
  if (!db) throw new Error("D1 database is unavailable. Check the hosted DB binding.");
  return db;
}
export function getHostedAttachments() {
  const bucket = scope.getStore()?.bindings.ATTACHMENTS;
  if (!bucket) throw new Error("Attachment storage is unavailable. Check the hosted ATTACHMENTS binding.");
  return bucket;
}
