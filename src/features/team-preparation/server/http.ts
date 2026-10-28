import { NextResponse } from "next/server";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { PreparationError, getTeamPreparation, getTeamPreparationHistory, saveTeamPreparation } from "@/src/entities/team-preparation/index.server";
import type { ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { assertBrowserOrigin, BrowserOriginError } from "@/src/shared/server/request-origin/index.server";

export class PreparationRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export const preparationHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
export function preparationJson(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: preparationHeaders }); }
export function preparationHttpError(error: unknown) {
  if (error instanceof PreparationError || error instanceof PreparationRequestError) {
    const message = error.status === 401 ? "로그인 후 다시 시도해 주세요." : error.status === 404 ? "준비표를 찾을 수 없습니다." : error.status === 409 ? "다른 변경이 저장되었습니다. 입력을 복사한 뒤 최신 준비표를 불러와 주세요." : error.status === 400 ? "입력 형식과 필수 항목을 확인해 주세요." : error.status === 413 ? "준비표는 50개 항목, 64KiB 이내로 작성해 주세요." : error.status === 403 ? "현재 사이트 주소에서 요청했는지 확인해 주세요. 입력을 보관한 뒤 새로고침해 주세요." : "준비표를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return preparationJson({ code: error.code, message }, error.status);
  }
  return preparationJson({ code: "UNAVAILABLE", message: "준비표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
}
export function preparationId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || String(Number(value)) !== value) throw new PreparationRequestError(404, "NOT_FOUND");
  return Number(value);
}
export async function getPreparationViewer(): Promise<ProjectViewer> {
  const session = await getAuthSession();
  if (!session?.user?.email) throw new PreparationRequestError(401, "LOGIN_REQUIRED");
  const user = await getUserByEmail(session.user.email);
  if (!user) throw new PreparationRequestError(404, "NOT_FOUND");
  return { userId: user.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  try { assertBrowserOrigin(request); }
  catch (error) { if (error instanceof BrowserOriginError) throw new PreparationRequestError(error.status, error.code); throw error; }
  if ((request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new PreparationRequestError(415, "JSON_REQUIRED");
  const limit = 66 * 1024;
  if (Number(request.headers.get("Content-Length")) > limit) throw new PreparationRequestError(413, "REQUEST_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new PreparationRequestError(400, "INVALID_INPUT");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > limit) throw new PreparationRequestError(413, "REQUEST_TOO_LARGE"); parts.push(part.value); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some(key => !["version", "mutationKey", "document"].includes(key))) throw new Error("Invalid shape");
    return parsed as Record<string, unknown>;
  } catch { throw new PreparationRequestError(400, "INVALID_INPUT"); }
}
export type PreparationRouteContext = { params: Promise<{ projectId: string; teamId: string }> };
export async function readPreparation(request: Request, context: PreparationRouteContext) {
  try {
    const viewer = await getPreparationViewer(), params = await context.params;
    const projectId = preparationId(params.projectId), teamId = preparationId(params.teamId);
    const [sheet, history] = await Promise.all([getTeamPreparation(viewer, projectId, teamId), getTeamPreparationHistory(viewer, projectId, teamId)]);
    return preparationJson({ sheet, history });
  } catch (error) { return preparationHttpError(error); }
}
export async function writePreparation(request: Request, context: PreparationRouteContext) {
  try {
    const viewer = await getPreparationViewer(), params = await context.params, input = await bodyJson(request);
    if (typeof input.version !== "number" || typeof input.mutationKey !== "string") throw new PreparationRequestError(400, "INVALID_INPUT");
    const sheet = await saveTeamPreparation(viewer, preparationId(params.projectId), preparationId(params.teamId), { version: input.version, mutationKey: input.mutationKey, document: input.document });
    return preparationJson({ sheet });
  } catch (error) { return preparationHttpError(error); }
}
