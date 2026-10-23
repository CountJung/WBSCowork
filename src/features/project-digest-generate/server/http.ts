import { NextResponse } from "next/server";
import { ReportLedgerError, ReportCollectorError } from "@/src/entities/project-report/index.server";
import { ReportRequestError } from "./request";

export const reportResponseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
export function reportJson(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: reportResponseHeaders }); }
export function reportHttpError(error: unknown) {
  if (error instanceof ReportRequestError || error instanceof ReportLedgerError || error instanceof ReportCollectorError) return reportJson({ code: error.code, message: error.status === 401 ? "인증 정보를 확인해 주세요." : error.status === 404 ? "보고서를 찾을 수 없습니다." : error.code === "INVALID_PERIOD" ? "기간은 시작보다 늦은 끝 시각까지 최대 31일이며 미래 시각을 포함할 수 없습니다." : "보고서 요청을 처리하지 못했습니다. 입력과 권한을 확인해 주세요." }, error.status);
  // Never return storage paths, SQL text, request bodies or a raw exception.
  return reportJson({ code: "REPORT_UNAVAILABLE", message: "보고서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
}
