import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import {
  getSubmissionAttachmentById,
  getSubmissionByIdForViewer,
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
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const params = await context.params;
  const attachmentId = Number(params.attachmentId);

  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ message: "올바른 첨부파일 식별자가 아닙니다." }, { status: 400 });
  }

  const attachment = await getSubmissionAttachmentById(attachmentId);

  if (!attachment) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404 });
  }

  // 공개 범위를 질의에 적용해, 볼 수 없는 제출물은 존재하지 않는 것과 같은 404로 응답한다.
  const submission = await getSubmissionByIdForViewer(attachment.submissionId, {
    canSeeAll: canManageAllSubmissions(session.user.role, session.user.isSuperuser),
    viewerEmail: session.user.email,
  });

  if (!submission) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404 });
  }

  try {
    const stored = await readStoredSubmissionAttachment(attachment.filePath);
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    const disposition = inline
      ? `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`;

    await logUserAction("submissions.attachment", {
      actorEmail: session.user.email ?? null,
      action: "submission.attachment.download",
      entityType: "submission",
      entityId: attachment.submissionId,
      submissionId: attachment.submissionId,
      metadata: {
        fileName: attachment.fileName,
        inline,
      },
    });

    return new NextResponse(stored.buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": disposition,
        "Content-Length": String(stored.fileSizeBytes),
        "Content-Type": attachment.fileMimeType,
      },
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

    return NextResponse.json({ message: "첨부파일을 불러오지 못했습니다." }, { status: 404 });
  }
}
