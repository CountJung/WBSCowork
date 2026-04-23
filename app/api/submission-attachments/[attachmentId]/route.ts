import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { getSubmissionAttachmentById } from "@/lib/repositories/submission-attachment-repository";
import { readStoredSubmissionAttachment } from "@/lib/submission-files";

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
        metadata: { filePath: attachment.filePath },
      },
      error,
    );

    return NextResponse.json({ message: "첨부파일을 불러오지 못했습니다." }, { status: 404 });
  }
}
