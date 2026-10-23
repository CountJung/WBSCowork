import { NextResponse } from "next/server";
import { getAuthSession, getUserByEmail, isSuperuserEmail } from "@/src/entities/user/index.server";
import { getBugScreenshot, readBugScreenshot } from "@/src/entities/bug-report/index.server";
import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
export async function GET(_request: Request, context: {params:Promise<{screenshotId:string}>}) {
  const headers = {"Cache-Control":"private, no-store"};
  const absent = () => NextResponse.json({message:"스크린샷이 없습니다."},{status:404,headers});
  const session = await getAuthSession();
  if (!session?.user?.email) return NextResponse.json({message:"로그인이 필요합니다."},{status:401,headers});
  const user = await getUserByEmail(session.user.email);
  const id = Number((await context.params).screenshotId);
  if (!user || !Number.isSafeInteger(id) || id < 1) return absent();
  const file = await getBugScreenshot(id,{userId:user.id,canReview:Boolean(session.user.isSuperuser&&isSuperuserEmail(user.email))});
  if (!file) return absent();
  try {
    const stored = await readBugScreenshot(file.file_path);
    return new NextResponse(stored.buffer,{headers:attachmentResponseHeaders({fileName:file.file_name,mimeType:file.file_mime_type,size:stored.fileSizeBytes,inlineRequested:true})});
  } catch { return absent(); }
}
