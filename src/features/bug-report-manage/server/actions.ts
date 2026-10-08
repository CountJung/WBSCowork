"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  appendBugEvent,
  createBugReport,
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
function validateEnvelope(data: FormData) {
  let bytes = 0;
  for (const [key, value] of data.entries()) {
    if (typeof value !== "string")
      throw new Error("버그 제보에는 첨부파일을 받지 않습니다.");
    bytes += new TextEncoder().encode(key + value).length;
  }
  if (bytes > 48 * 1024) throw new Error("제보 요청이 너무 큽니다.");
}
function refresh(id: number) {
  revalidatePath("/bugs");
  revalidatePath("/admin/bugs");
  revalidatePath(`/bugs/${id}`);
}
export async function createBugReportAction(data: FormData) {
  const viewer = await requireBugViewer("/bugs");
  let result: string;
  try {
    validateEnvelope(data);
    const input = parseBugInput(data),
      token = bugToken(data.get("requestToken"));
    const id = await createBugReport(viewer, token, input);
    refresh(id);
    result = `/bugs/${id}?saved=1`;
  } catch {
    // Never serialize SQL errors, private input or submitted tokens to logs/redirects.
    result = "/bugs?error=invalid";
  }
  redirect(result);
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
