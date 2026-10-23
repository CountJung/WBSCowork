import { NextResponse } from "next/server";
import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
import { downloadProjectReport, getReportViewer, positiveReportId, reportHttpError } from "@/src/features/project-digest-generate/index.server";
type Context = { params: Promise<{ artifactId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { const { artifactId } = await params, viewer = await getReportViewer(), file = await downloadProjectReport(viewer, positiveReportId(artifactId));
    return new NextResponse(file.bytes as BodyInit, { headers: { ...attachmentResponseHeaders({ fileName: file.fileName, mimeType: file.mimeType, size: file.sizeBytes, inlineRequested: false }), ETag: `"${file.sha256}"`, "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch (error) { return reportHttpError(error); }
}
