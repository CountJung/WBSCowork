import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import { reportMimeType as sharedReportMimeType } from "@/src/shared/lib/report-format";
import { reportTextLines, type DigestSnapshot, type ReportFormat } from "@/src/entities/project-report";

export function reportMimeType(format: ReportFormat): string {
  if (format !== "docx" && format !== "pptx") throw new Error("지원하지 않는 보고서 형식입니다.");
  return sharedReportMimeType(format);
}
const headings = new Set(["포함된 자료 수 (전체 총수 아님)", "업무 현황", "기한 경과 일정 (완료·지연 확정 판정 아님)", "기간 내 제출 및 활동 연결 제출", "기간 내 댓글", "기간 내 첨부 metadata (파일 내용 없음)", "다음 일정", "데이터 품질·부록"]);
/** Wrap at code points rather than UTF-16 units. Both formats retain identical semantic text. */
export function wrapReportLine(value: string, columns = 44): string[] {
  if (!Number.isInteger(columns) || columns < 8 || columns > 100) throw new Error("보고서 줄 너비가 올바르지 않습니다.");
  const lines: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const points = [...line];
    if (!points.length) lines.push("");
    for (let offset = 0; offset < points.length; offset += columns) lines.push(points.slice(offset, offset + columns).join(""));
  }
  return lines;
}
async function renderDocx(lines: string[]): Promise<Buffer> {
  const document = new Document({
    creator: "WBSCowork", title: "프로젝트 활동 보고서", description: "권한 범위 내 한 시점의 프로젝트 활동 자료",
    styles: { default: { document: { run: { font: "Arial", size: 22 }, paragraph: { spacing: { after: 100, line: 300 } } } } },
    sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: lines.map((line, index) => new Paragraph({
      heading: index === 0 ? HeadingLevel.TITLE : headings.has(line) ? HeadingLevel.HEADING_1 : undefined,
      keepNext: index === 0 || headings.has(line),
      children: line.split(/\r?\n/).flatMap((part, offset) => [new TextRun({ text: part, break: offset ? 1 : 0 })]),
    })) }],
  });
  // Packer is the documented runtime API. Neither renderer opens a DB or local source file.
  return Packer.toBuffer(document);
}
async function renderPptx(snapshot: DigestSnapshot, lines: string[]): Promise<Buffer> {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "WBSCowork";
  presentation.subject = "권한 범위 내 한 시점의 프로젝트 활동 자료";
  presentation.title = "프로젝트 활동 보고서";
  presentation.company = "WBSCowork";
  presentation.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const contentLines = lines.flatMap(line => wrapReportLine(line));
  const perSlide = 11;
  for (let offset = 0; offset < contentLines.length; offset += perSlide) {
    const slide = presentation.addSlide();
    slide.background = { color: "FAF7F2" };
    slide.addText("WBSCowork · 프로젝트 활동", { x: 0.65, y: 0.3, w: 12.0, h: 0.55, fontFace: "Arial", lang: "ko-KR", fontSize: 24, bold: true, color: "3D2B2B", margin: 0, breakLine: false });
    const selected = contentLines.slice(offset, offset + perSlide);
    selected.forEach((line, index) => slide.addText(line || " ", { x: 0.7, y: 1.12 + index * 0.44, w: 11.9, h: 0.4, fontFace: "Arial", lang: "ko-KR", fontSize: 18, color: "3D2B2B", bold: headings.has(line), margin: 0, valign: "middle", breakLine: false, fit: "shrink" }));
    slide.addText(`${Math.floor(offset / perSlide) + 1} · ${snapshot.period.timeZone} · 포함 자료만 표시`, { x: 0.7, y: 6.9, w: 11.9, h: 0.25, fontFace: "Arial", lang: "ko-KR", fontSize: 11, color: "7A5C5C", margin: 0 });
  }
  const output = await presentation.write({ outputType: "nodebuffer", compression: true });
  if (typeof output === "string" || output instanceof Blob) throw new Error("보고서 생성 결과 형식이 올바르지 않습니다.");
  return output instanceof ArrayBuffer ? Buffer.from(output) : Buffer.from(output);
}
export async function renderProjectReport(snapshot: DigestSnapshot, format: ReportFormat): Promise<Buffer> {
  reportMimeType(format);
  const lines = reportTextLines(snapshot);
  return format === "docx" ? renderDocx(lines) : renderPptx(snapshot, lines);
}
