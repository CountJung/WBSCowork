import { NextResponse } from "next/server";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { getProjectPortal, listPortalTeams, saveProjectPortalSettings, saveTeamPublication, ProjectPresentationError, type SavePortalSettingsInput, type SaveTeamPublicationInput } from "@/src/entities/project-presentation/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import type { ProjectViewer } from "@/src/shared/server/project-portal-scope/index.server";
import { getTeamPresentation } from "./presentation";
export class ProjectPortalRequestError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
export const portalHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: portalHeaders }); }
export async function getPortalViewer(): Promise<ProjectViewer> {
  const session = await getAuthSession(); if (!session?.user?.email) throw new ProjectPortalRequestError(401, "LOGIN_REQUIRED");
  const current = await getUserByEmail(session.user.email); if (!current) throw new ProjectPortalRequestError(404, "NOT_FOUND");
  return { userId: current.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
export function portalId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || String(Number(value)) !== value) throw new ProjectPortalRequestError(404, "NOT_FOUND"); return Number(value);
}
export function portalHttpError(error: unknown) {
  const status = error instanceof ProjectPresentationError || error instanceof ProjectPortalRequestError ? error.status : 503;
  const code = error instanceof ProjectPresentationError || error instanceof ProjectPortalRequestError ? error.code : "UNAVAILABLE";
  return json({ code, message: status === 401 ? "로그인 후 다시 시도해 주세요." : status === 404 ? "프로젝트 자료를 찾을 수 없습니다." : status === 409 ? "저장된 내용이 달라졌습니다. 입력을 보관하고 최신 내용을 확인해 주세요." : status === 400 ? "입력 형식과 필수 항목을 확인해 주세요." : status === 413 ? "입력 용량이 너무 큽니다." : status === 403 ? "요청한 화면에서 다시 시도해 주세요." : "프로젝트 자료를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, status);
}
async function body(request: Request, allowed: string[]) {
  let canonical: URL;
  try { canonical = new URL(getRuntimeEnv().auth.nextAuthUrl ?? request.url); } catch { throw new ProjectPortalRequestError(503, "INVALID_CONFIGURATION"); }
  if (!["http:", "https:"].includes(canonical.protocol) || canonical.username || canonical.password) throw new ProjectPortalRequestError(503, "INVALID_CONFIGURATION");
  if (request.headers.get("Origin") !== canonical.origin) throw new ProjectPortalRequestError(403, "INVALID_ORIGIN");
  if ((request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new ProjectPortalRequestError(415, "JSON_REQUIRED");
  const limit = 12 * 1024; if (Number(request.headers.get("Content-Length")) > limit) throw new ProjectPortalRequestError(413, "REQUEST_TOO_LARGE");
  const reader = request.body?.getReader(); if (!reader) throw new ProjectPortalRequestError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > limit) throw new ProjectPortalRequestError(413, "REQUEST_TOO_LARGE"); chunks.push(part.value); } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some(key => !allowed.includes(key))) throw new Error("Invalid input.");
    return parsed as Record<string, unknown>;
  } catch { throw new ProjectPortalRequestError(400, "INVALID_INPUT"); }
}
export type PortalRouteContext = { params: Promise<{ projectId: string }> };
export type PortalTeamRouteContext = { params: Promise<{ projectId: string; teamId: string }> };
export async function readProjectPortal(_request: Request, context: PortalRouteContext) {
  try { const viewer = await getPortalViewer(), projectId = portalId((await context.params).projectId); return json({ portal: await getProjectPortal(viewer, projectId), teams: await listPortalTeams(viewer, projectId) }); } catch (error) { return portalHttpError(error); }
}
export async function writeProjectPortal(request: Request, context: PortalRouteContext) {
  try {
    const viewer = await getPortalViewer(), projectId = portalId((await context.params).projectId), input = await body(request, ["version", "mutationKey", "layout", "title", "intro"]);
    if (typeof input.version !== "number" || typeof input.mutationKey !== "string" || typeof input.layout !== "string" || typeof input.title !== "string" || typeof input.intro !== "string") throw new ProjectPortalRequestError(400, "INVALID_INPUT");
    return json({ portal: await saveProjectPortalSettings(viewer, projectId, input as SavePortalSettingsInput) });
  } catch (error) { return portalHttpError(error); }
}
export async function readTeamPresentation(_request: Request, context: PortalTeamRouteContext) {
  try { const viewer = await getPortalViewer(), params = await context.params; return json({ presentation: await getTeamPresentation(viewer, portalId(params.projectId), portalId(params.teamId)) }); } catch (error) { return portalHttpError(error); }
}
export async function writeTeamPublication(request: Request, context: PortalTeamRouteContext) {
  try {
    const viewer = await getPortalViewer(), params = await context.params, projectId = portalId(params.projectId), teamId = portalId(params.teamId), input = await body(request, ["version", "mutationKey", "audience", "preparationVersion"]);
    if (typeof input.version !== "number" || typeof input.mutationKey !== "string" || typeof input.audience !== "string" || typeof input.preparationVersion !== "number") throw new ProjectPortalRequestError(400, "INVALID_INPUT");
    await saveTeamPublication(viewer, projectId, teamId, input as SaveTeamPublicationInput);
    return json({ presentation: await getTeamPresentation(viewer, projectId, teamId) });
  } catch (error) { return portalHttpError(error); }
}
