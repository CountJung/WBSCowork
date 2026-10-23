import { timingSafeEqual } from "node:crypto";
import { createDigestPeriod, type ReportAudience, type ReportFormat, type ReportPeriod } from "@/src/entities/project-report";

export class ReportRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
export type ReportRequest = { projectId: number; requestId: string; period: ReportPeriod; audienceMode: ReportAudience; formats: ReportFormat[]; dryRun: boolean };
export function positiveReportId(value: unknown): number {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) throw new ReportRequestError(400, "INVALID_REQUEST");
  return id;
}
export function reportRetentionDays() {
  const value = process.env.REPORT_RETENTION_DAYS ?? "30";
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 365) throw new ReportRequestError(503, "REPORT_CONFIGURATION");
  return Number(value);
}
export function parseReportRequest(value: unknown, now = new Date()): ReportRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportRequestError(400, "INVALID_REQUEST");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["projectId", "requestId", "start", "end", "timeZone", "audienceMode", "formats", "dryRun"].includes(key))) throw new ReportRequestError(400, "INVALID_REQUEST");
  if (typeof data.requestId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(data.requestId)) throw new ReportRequestError(400, "INVALID_REQUEST");
  if (data.audienceMode !== "public_only" && data.audienceMode !== "requester_scope") throw new ReportRequestError(400, "INVALID_REQUEST");
  if (!Array.isArray(data.formats) || data.formats.length < 1 || data.formats.length > 2 || data.formats.some(format => format !== "docx" && format !== "pptx") || new Set(data.formats).size !== data.formats.length || typeof data.dryRun !== "boolean") throw new ReportRequestError(400, "INVALID_REQUEST");
  if (typeof data.start !== "string" || typeof data.end !== "string" || typeof data.timeZone !== "string") throw new ReportRequestError(400, "INVALID_REQUEST");
  let period: ReportPeriod;
  try { period = createDigestPeriod(data.start, data.end, now, data.timeZone); } catch { throw new ReportRequestError(400, "INVALID_PERIOD"); }
  return { projectId: positiveReportId(data.projectId), requestId: data.requestId, period, audienceMode: data.audienceMode, formats: [...data.formats].sort() as ReportFormat[], dryRun: data.dryRun };
}
export function assertReportOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ReportRequestError(403, "INVALID_ORIGIN");
}
/** A machine credential never confers a browser identity or accepts a cookie fallback. */
export function assertDigestMachineRequest(request: Request) {
  const token = process.env.DIGEST_SCHEDULER_TOKEN;
  if (process.env.DIGEST_SCHEDULER_ENABLED !== "1" || !token || token.length < 32 || token.length > 1024) throw new ReportRequestError(503, "SCHEDULER_DISABLED");
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([^\s]{1,1024})$/.exec(authorization);
  const supplied = Buffer.from(match?.[1] ?? "");
  const expected = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new ReportRequestError(401, "INVALID_TOKEN");
}
export async function boundedReportJson(request: Request): Promise<unknown> {
  if ((request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new ReportRequestError(415, "JSON_REQUIRED");
  const maximum = 8192;
  if (Number(request.headers.get("Content-Length")) > maximum) throw new ReportRequestError(413, "REQUEST_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new ReportRequestError(400, "INVALID_REQUEST");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > maximum) throw new ReportRequestError(413, "REQUEST_TOO_LARGE"); parts.push(part.value); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts))); } catch { throw new ReportRequestError(400, "INVALID_JSON"); }
}
