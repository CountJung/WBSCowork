import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import {
  getSubmissionAttachmentForViewer,
  readStoredSubmissionAttachment,
} from "@/src/entities/submission/index.server";
import { canManageAllSubmissions } from "@/src/entities/user";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const params = await context.params;
  const attachmentId = Number(params.attachmentId);

  if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ message: "올바른 첨부파일 식별자가 아닙니다." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }

  // Parent and immutable snapshot visibility are checked together before opening any bytes.
  const attachment = await getSubmissionAttachmentForViewer(attachmentId, {
    canSeeAll: canManageAllSubmissions(session.user.role, session.user.isSuperuser),
    viewerEmail: session.user.email,
  });

  if (!attachment) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const stored = await readStoredSubmissionAttachment(attachment.filePath);
    const url = new URL(request.url);
    const headers = attachmentResponseHeaders({ fileName: attachment.fileName, mimeType: attachment.fileMimeType, size: stored.fileSizeBytes, inlineRequested: url.searchParams.get("inline") === "1" });

    await logUserAction("submissions.attachment", {
      actorEmail: session.user.email ?? null,
      action: "submission.attachment.download",
      entityType: "submission",
      entityId: attachment.submissionId,
      submissionId: attachment.submissionId,
      metadata: {
        fileName: attachment.fileName,
        revisionNumber: attachment.revisionNumber,
        inline: headers["Content-Disposition"].startsWith("inline;"),
      },
    });

    return new NextResponse(stored.buffer, {
      headers,
    });
  } catch (error) {
    await logUserActionFailure(
      "submissions.attachment",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.attachment.download",
        entityType: "submission",
        entityId: attachment.submissionId,
        submissionId: attachment.submissionId,
        metadata: { storedFileReadFailed: true },
      },
      error,
    );

    return NextResponse.json({ message: "첨부파일을 불러오지 못했습니다." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
