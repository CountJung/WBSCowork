import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { getSubmissionById } from "@/lib/repositories/submission-repository";
import { readStoredSubmissionAttachment } from "@/lib/submission-files";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const params = await context.params;
  const submissionId = Number(params.submissionId);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ message: "올바른 제출물 식별자가 아닙니다." }, { status: 400 });
  }

  const submission = await getSubmissionById(submissionId);

  if (!submission?.filePath || !submission.fileName) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404 });
  }

  try {
    const attachment = await readStoredSubmissionAttachment(submission.filePath);

    await logUserAction("submissions.attachment", {
      actorEmail: session.user.email ?? null,
      action: "submission.attachment.download",
      entityType: "submission",
      entityId: submission.id,
      submissionId: submission.id,
      taskId: submission.taskId,
      metadata: {
        fileName: submission.fileName,
      },
    });

    return new NextResponse(attachment.buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(submission.fileName)}`,
        "Content-Length": String(submission.fileSizeBytes ?? attachment.fileSizeBytes),
        "Content-Type": submission.fileMimeType ?? "application/octet-stream",
      },
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

    return NextResponse.json({ message: "첨부파일을 불러오지 못했습니다." }, { status: 404 });
  }
}