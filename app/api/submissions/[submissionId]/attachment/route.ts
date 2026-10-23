import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
import {AttachmentPreviewError} from "@/src/shared/lib/attachment-preview";
import { NextResponse } from "next/server";
import { getAuthSession,getUserByEmail } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import { getSubmissionByIdForViewer, getSubmissionRevisionForViewer, readStoredSubmissionAttachment,readSubmissionAttachmentPreview } from "@/src/entities/submission/index.server";
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
  const previewRequested=url.searchParams.get("preview")==="1";
  const currentUser=previewRequested?await getUserByEmail(session.user.email??""):null;
  if(previewRequested&&!currentUser)return NextResponse.json({message:"첨부파일이 없습니다."},{status:404,headers:{"Cache-Control":"private, no-store"}});
  const filter = {
    canSeeAll: canManageAllSubmissions(currentUser?.role??session.user.role, session.user.isSuperuser),
    viewerUserId:currentUser?.id,
    viewerEmail: session.user.email,
  };
  const submission = await getSubmissionByIdForViewer(submissionId, filter);
  const revision = submission
    ? await getSubmissionRevisionForViewer(submissionId, requestedRevision === null ? submission.currentRevision : Number(requestedRevision), filter)
    : null;

  if (!submission || !revision?.filePath || !revision.fileName) {
    return NextResponse.json({ message: "첨부파일이 없습니다." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  if(previewRequested){
    const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","Cross-Origin-Resource-Policy":"same-origin"};
    try{
      const preview=await readSubmissionAttachmentPreview({filePath:revision.filePath,fileName:revision.fileName,fileMimeType:revision.fileMimeType});
      if(preview.kind==="text")return NextResponse.json(preview.data,{headers});
      return new NextResponse(preview.bytes as BodyInit,{headers:{...headers,...attachmentResponseHeaders({fileName:revision.fileName,mimeType:preview.mimeType,size:preview.fileSize,inlineRequested:true})}});
    }catch(error){
      // Never log file bytes, decoder input, or untrusted storage error details.
      const safe=error instanceof AttachmentPreviewError;
      return NextResponse.json({message:safe?error.message:"첨부파일을 불러오지 못했습니다."},{status:safe?(error.code==="unsupported"?415:error.code==="too_large"?413:422):404,headers});
    }
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
