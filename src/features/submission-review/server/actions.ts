"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getUserByEmail, getSignInPath } from "@/src/entities/user/index.server";
import { parsePersonalWorkReturnTo } from "@/src/entities/task";
import { canWriteTaskContent } from "@/src/entities/user";
import { requestSubmissionReview, decideSubmissionReview, cancelOrReopenSubmissionReview } from "@/src/entities/submission/index.server";

function positive(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (typeof value !== "string" || !Number.isSafeInteger(number) || number < 1) throw new Error("Invalid target.");
  return number;
}

async function changeReview(form: FormData, action: "request" | "decide" | "cancel") {
  const session = await getAuthSession();
  if (!session?.user) redirect(getSignInPath("/my-work"));
  const user = session.user.email ? await getUserByEmail(session.user.email) : null;
  let id = 0, revision = 1, saved = false;
  try {
    if (!user || !canWriteTaskContent(user.role, session.user.isSuperuser)) throw new Error("Write permission required.");
    let size = 0;
    for (const [key, value] of form) {
      if (typeof value !== "string") throw new Error("Unexpected file.");
      size += new TextEncoder().encode(key + value).length;
    }
    if (size > 16 * 1024) throw new Error("Request too large.");
    id = positive(form.get("submissionId"));
    revision = positive(form.get("revisionNumber"));
    const input = {
      taskId: positive(form.get("taskId")), submissionId: id, revisionNumber: revision,
      expectedTaskVersion: positive(form.get("expectedTaskVersion")),
      actor: { userId: user.id, isAdmin: user.role === "admin", isSuperuser: !!session.user.isSuperuser },
      token: String(form.get("operationToken") ?? ""),
    };
    const reason = String(form.get("reason") ?? "");
    if (action === "request") await requestSubmissionReview(input);
    else if (action === "cancel") await cancelOrReopenSubmissionReview({ ...input, reason });
    else {
      const decision = form.get("decision");
      if (decision !== "approved" && decision !== "changes_requested") throw new Error("Invalid decision.");
      await decideSubmissionReview({ ...input, decision, reason });
    }
    for (const path of ["/", "/tasks", "/my-work", `/submissions/${id}`]) revalidatePath(path);
    saved = true;
  } catch {
    // SQL details, private review reasons and request tokens never enter redirects or logs.
  }
  const query = new URLSearchParams({revision:String(revision),review:saved?"saved":"error"});
  const returnTo=parsePersonalWorkReturnTo(form.get("returnTo"));
  if(returnTo)query.set("returnTo",returnTo);
  redirect(id ? `/submissions/${id}?${query}` : "/tasks?status=error&message=검토%20요청을%20확인해%20주세요.");
}

export async function requestSubmissionReviewAction(form: FormData) { await changeReview(form, "request"); }
export async function decideSubmissionReviewAction(form: FormData) { await changeReview(form, "decide"); }
export async function cancelSubmissionReviewAction(form: FormData) { await changeReview(form, "cancel"); }
