import { AsyncLocalStorage } from "node:async_hooks";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type HostedBindings = { DB?: D1Database; ATTACHMENTS?: R2Bucket };
const scope = new AsyncLocalStorage<HostedBindings>();
export function runWithHostedBindings<T>(bindings: HostedBindings, run: () => T): T {
  return scope.run(bindings, run);
}
export function isHostedRuntime() {
  return (typeof __WBSCOWORK_WORKER__ !== "undefined" && __WBSCOWORK_WORKER__) || Boolean(scope.getStore());
}
export function getHostedDatabase() {
  const db = scope.getStore()?.DB;
  if (!db) throw new Error("D1 database is unavailable. Check the hosted DB binding.");
  return db;
}
export function getHostedAttachments() {
  const bucket = scope.getStore()?.ATTACHMENTS;
  if (!bucket) throw new Error("Attachment storage is unavailable. Check the hosted ATTACHMENTS binding.");
  return bucket;
}
