import { NextResponse } from "next/server";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { castProjectVote, createProjectPoll, listProjectPolls, ProjectVoteError, voteId, type CreatePollInput } from "@/src/entities/project-vote/index.server";
import type { ProjectViewer } from "@/src/shared/server/project-portal-scope/index.server";
import { assertBrowserOrigin, BrowserOriginError } from "@/src/shared/server/request-origin/index.server";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
class RequestError extends Error { constructor(readonly status: number) { super(String(status)); } }
export async function getVotingViewer(): Promise<ProjectViewer> {
  const session = await getAuthSession(); if (!session?.user?.email) throw new RequestError(401);
  const current = await getUserByEmail(session.user.email); if (!current) throw new RequestError(404);
  return { userId: current.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
function failure(error: unknown) {
  const status = error instanceof ProjectVoteError || error instanceof RequestError || error instanceof BrowserOriginError ? error.status : 503;
  const code = error instanceof ProjectVoteError ? error.code : status === 401 ? "LOGIN_REQUIRED" : status === 404 ? "NOT_FOUND" : "REQUEST_FAILED";
  return json({ code, message: status === 401 ? "로그인 후 다시 시도해 주세요." : status === 404 ? "투표를 찾을 수 없습니다." : status === 409 ? "투표 기간이나 저장된 선택이 달라졌습니다. 최신 내용을 확인해 주세요." : status === 413 ? "입력 용량이 너무 큽니다." : status === 400 || status === 415 ? "제목·선택지·시작 및 마감 시간을 확인해 주세요." : status === 403 ? "투표 화면에서 다시 시도해 주세요." : "투표를 처리하지 못했습니다. 입력을 보관하고 다시 확인해 주세요." }, status);
}
async function body(request: Request, allowed: string[]) {
  assertBrowserOrigin(request);
  if ((request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new RequestError(415);
  const limit = 12 * 1024; if (Number(request.headers.get("Content-Length")) > limit) throw new RequestError(413);
  const reader = request.body?.getReader(); if (!reader) throw new RequestError(400);
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) throw new RequestError(413); chunks.push(part.value); } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Input");
    return value as Record<string, unknown>;
  } catch { throw new RequestError(400); }
}
type Context = { params: Promise<{ projectId: string; pollId?: string }> };
export async function readProjectVotes(request: Request, context: Context) {
  try {
    const viewer = await getVotingViewer(), p = await context.params, after = new URL(request.url).searchParams.get("after");
    if (after !== null && !/^(?:0|[1-9]\d*)$/.test(after)) throw new RequestError(400);
    return json(await listProjectPolls(viewer, voteId(p.projectId), after === null ? 0 : Number(after)));
  } catch (error) { return failure(error); }
}
export async function registerProjectVote(request: Request, context: Context) {
  try {
    const viewer = await getVotingViewer(), p = await context.params, input = await body(request, ["title", "description", "startsAt", "endsAt", "options", "mutationKey"]);
    return json({ poll: await createProjectPoll(viewer, voteId(p.projectId), input as CreatePollInput) }, 201);
  } catch (error) { return failure(error); }
}
export async function submitProjectVote(request: Request, context: Context) {
  try {
    const viewer = await getVotingViewer(), p = await context.params, input = await body(request, ["optionId"]);
    if (typeof input.optionId !== "number") throw new RequestError(400);
    return json({ poll: await castProjectVote(viewer, voteId(p.projectId), voteId(p.pollId), input.optionId) });
  } catch (error) { return failure(error); }
}
