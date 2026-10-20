"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  appendBugEvent,
  createBugReport,
  changeBugLifecycle,
  purgeBugReport,
  storeBugScreenshots,
  discardBugScreenshot,
  type StoredBugScreenshot,
} from "@/src/entities/bug-report/index.server";
import {
  bugText,
  bugToken,
  parseBugInput,
  parseBugReview,
} from "@/src/entities/bug-report";
import { requireBugViewer } from "./bug-report.server";

function positive(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (typeof value !== "string" || !Number.isSafeInteger(number) || number < 1)
    throw new Error("식별자 또는 버전이 올바르지 않습니다.");
  return number;
}
function validateEnvelope(data: FormData, screenshots = false) {
  let bytes = 0;
  for (const [key, value] of data.entries()) {
    if (typeof value !== "string") {
      if (screenshots && key === "screenshots") continue;
      throw new Error("허용되지 않은 첨부파일입니다.");
    }
    bytes += new TextEncoder().encode(key + value).length;
  }
  if (bytes > 48 * 1024) throw new Error("제보 요청이 너무 큽니다.");
}
function refresh(id: number) {
  revalidatePath("/bugs");
  revalidatePath("/admin/bugs");
  revalidatePath(`/bugs/${id}`);
  revalidatePath("/admin/bugs/trash");
  revalidatePath(`/admin/bugs/trash/${id}`);
}
async function submitBugReport(data: FormData) {
  const viewer = await requireBugViewer("/bugs");
  let stored: StoredBugScreenshot[] = [];
  try {
    validateEnvelope(data, true);
    const input = parseBugInput(data), token = bugToken(data.get("requestToken"));
    const files = data.getAll("screenshots");
    if (files.some(f=>typeof f === "string")) throw new Error("Invalid screenshot input");
    stored = await storeBugScreenshots((files as File[]).filter(f=>f.size || f.name),viewer);
    const id = await createBugReport(viewer,token,input,stored);
    refresh(id);
    return {id};
  } catch {
    return {error:"제보를 저장하지 못했습니다. PNG·JPEG·WebP, 파일당 2MB 이하·최대 3개인지 확인한 뒤 다시 시도하세요. 입력 내용과 선택한 파일은 유지됩니다."};
  } finally {
    // Referenced winning uploads are protected; replay/failed uploads are removed or queued.
    for (const file of stored) await discardBugScreenshot(file.filePath).catch(()=>undefined);
  }
}
export async function createBugReportAction(data: FormData) {
  const result = await submitBugReport(data);
  redirect(result.id ? `/bugs/${result.id}?saved=1` : "/bugs?error=invalid");
}
export async function createBugReportFormAction(_previous: {error:string} | null, data: FormData): Promise<{error:string} | null> {
  const result = await submitBugReport(data);
  if (result.id) redirect(`/bugs/${result.id}?saved=1`);
  return {error: result.error!};
}
export async function appendBugNoteAction(data: FormData) {
  const viewer = await requireBugViewer("/bugs");
  let id = 0,
    result: string;
  try {
    validateEnvelope(data);
    id = positive(data.get("reportId"));
    await appendBugEvent(
      id,
      viewer,
      bugToken(data.get("requestToken")),
      positive(data.get("version")),
      { kind: "addendum", body: bugText(data.get("body"), "추가 설명", 4000) },
    );
    refresh(id);
    result = `/bugs/${id}?saved=1`;
  } catch {
    result = id ? `/bugs/${id}?error=save` : "/bugs?error=invalid";
  }
  redirect(result);
}
export async function reviewBugReportAction(data: FormData) {
  const viewer = await requireBugViewer("/admin/bugs", true);
  let id = 0,
    result: string;
  try {
    validateEnvelope(data);
    id = positive(data.get("reportId"));
    await appendBugEvent(
      id,
      viewer,
      bugToken(data.get("requestToken")),
      positive(data.get("version")),
      { kind: "review", ...parseBugReview(data) },
    );
    refresh(id);
    result = `/bugs/${id}?saved=1`;
  } catch {
    result = id ? `/bugs/${id}?error=save` : "/admin/bugs?error=invalid";
  }
  redirect(result);
}

export async function changeBugLifecycleAction(data: FormData) {
  const viewer = await requireBugViewer("/admin/bugs", true);
  let id = 0,
    result = "/admin/bugs?error=invalid",
    action = "";
  try {
    validateEnvelope(data);
    id = positive(data.get("reportId"));
    action = String(data.get("lifecycleAction"));
    if (action !== "verify" && action !== "trash" && action !== "restore")
      throw new Error("Invalid transition");
    const note = bugText(
      data.get("body"),
      action === "verify" ? "검증 내용" : "처리 사유",
      4000,
    );
    await changeBugLifecycle(
      id,
      viewer,
      bugToken(data.get("requestToken")),
      positive(data.get("version")),
      action,
      note,
    );
    refresh(id);
    result =
      action === "trash"
        ? `/admin/bugs/trash/${id}?saved=1`
        : `/bugs/${id}?saved=1`;
  } catch {
    result = id
      ? `${action === "restore" ? "/admin/bugs/trash" : "/bugs"}/${id}?error=save`
      : result;
  }
  redirect(result);
}
export async function purgeBugReportAction(data: FormData) {
  const viewer = await requireBugViewer("/admin/bugs/trash", true);
  let id = 0,
    result = "/admin/bugs/trash?error=invalid";
  try {
    if (!viewer.canPurge) throw new Error("Forbidden");
    validateEnvelope(data);
    id = positive(data.get("reportId"));
    const fingerprint = data.get("fingerprint"),
      title = data.get("confirmationTitle");
    if (
      typeof fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(fingerprint) ||
      typeof title !== "string" ||
      title.length > 160
    )
      throw new Error("Invalid confirmation");
    await purgeBugReport(
      id,
      viewer,
      bugToken(data.get("requestToken")),
      positive(data.get("version")),
      fingerprint,
      title,
      positive(data.get("eventCount")),
      positive(data.get("lastEventId")),
    );
    refresh(id);
    result = "/admin/bugs/trash?saved=1";
  } catch {
    if (id) result = `/admin/bugs/trash/${id}?error=save`;
  }
  redirect(result);
}
