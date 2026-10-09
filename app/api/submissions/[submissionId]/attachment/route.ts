import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import { getSubmissionByIdForViewer, getSubmissionRevisionForViewer, readStoredSubmissionAttachment } from "@/src/entities/submission/index.server";
import { canManageAllSubmissions } from "@/src/entities/user";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const params = await context.params;
  const submissionId = Number(params.submissionId);

  if (!Number.isSafeInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ message: "올바른 제출물 식별자가 아닙니다." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }

  const url = new URL(request.url);
  const requestedRevision = url.searchParams.get("revision");
  if (requestedRevision !== null && (!/^[1-9]\d*$/.test(requestedRevision) || !Number.isSafeInteger(Number(requestedRevision)))) {
    return NextResponse.json({ message: "올바른 제출물 버전이 아닙니다." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  const filter = {
    canSeeAll: canManageAllSubmissions(session.user.role, session.user.isSuperuser),
    viewerEmail: session.user.email,
  };
  const submission = await getSubmissionByIdForViewer(submissionId, filter);
  const revision = submission
    ? await getSubmissionRevisionForViewer(submissionId, requestedRevision === null ? submission.currentRevision : Number(requestedRevision), filter)
    : null;

  if (!submission || !revision?.filePath || !revision.fileName) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const attachment = await readStoredSubmissionAttachment(revision.filePath);
    const headers = attachmentResponseHeaders({ fileName: revision.fileName, mimeType: revision.fileMimeType, size: attachment.fileSizeBytes, inlineRequested: url.searchParams.get("inline") === "1" });

    await logUserAction("submissions.attachment", {
      actorEmail: session.user.email ?? null,
      action: "submission.attachment.download",
      entityType: "submission",
      entityId: submission.id,
      submissionId: submission.id,
      taskId: submission.taskId,
      metadata: {
        fileName: revision.fileName,
        revisionNumber: revision.revisionNumber,
      },
    });

    return new NextResponse(attachment.buffer, {
      headers,
    });
  } catch (error) {
    await logUserActionFailure(
      "submissions.attachment",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.attachment.download",
        entityType: "submission",
        entityId: submission.id,
        submissionId: submission.id,
        taskId: submission.taskId,
      },
      error,
    );

    return NextResponse.json({ message: "첨부파일을 불러오지 못했습니다." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
