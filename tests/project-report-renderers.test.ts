import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createDigestSnapshot, reportTextLines } from "../src/entities/project-report";
import { renderProjectReport, reportMimeType, wrapReportLine } from "../src/features/project-report-export/index.server";
import { reportFixture } from "./helpers/project-report-fixture";

function inspectZip(bytes: Buffer, format: "docx" | "pptx") {
  const script = `import io,json,sys,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nassert z.testzip() is None\nnames=z.namelist()\nassert '[Content_Types].xml' in names\nselected=['word/document.xml'] if sys.argv[1]=='docx' else sorted([n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')],key=lambda n:int(n.split('slide')[-1].split('.')[0]))\ntexts=[]\nfor n in selected:\n root=E.fromstring(z.read(n));texts.extend([e.text or '' for e in root.iter() if e.tag.endswith('}t')])\nprint(json.dumps({'files':names,'texts':texts,'slides':len(selected)},ensure_ascii=False))`;
  const result = spawnSync("python3", ["-c", script, format], { input: bytes, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as { files: string[]; texts: string[]; slides: number };
}
const norm = (s: string) => s.replace(/\s/g, "");
const semantic = (texts: string[]) => texts.filter(text => text !== "WBSCowork · 프로젝트 활동" && !/^\d+ · .+ · 포함 자료만 표시$/.test(text)).join("");
test("both runtime renderers emit valid OOXML ZIPs containing the same authorized semantic text", async () => {
  const snapshot = createDigestSnapshot(reportFixture()), expected = reportTextLines(snapshot);
  for (const format of ["docx", "pptx"] as const) {
    const bytes = await renderProjectReport(snapshot, format);
    assert.equal(bytes.subarray(0, 2).toString(), "PK"); assert(bytes.length > 1000 && bytes.length < 5 * 1024 * 1024);
    const result = inspectZip(bytes, format), contents = norm(semantic(result.texts));
    assert(result.files.includes(format === "docx" ? "word/document.xml" : "ppt/presentation.xml"));
    for (const line of expected) assert(contents.includes(norm(line)), `${format}: same semantic line ${line.slice(0, 30)}`);
    assert.doesNotMatch(contents, /PRIVATE_REPORT/); assert.match(contents, /한글/); assert.match(contents, /<script>실행없음<\/script>/);
    assert(!result.files.some(path => /vbaProject|externalLink|embeddings\/[^/]+/.test(path)));
    if (format === "pptx") assert(result.slides >= 2, "bounded pagination rather than text overflow");
  }
});
test("long Korean and emoji wrap at code points and survive both documents with truncation stated", async () => {
  const input = reportFixture(); input.tasks[0].title = "한글😀긴제목".repeat(100);
  const snapshot = createDigestSnapshot(input), expected = norm(reportTextLines(snapshot).join(""));
  assert(snapshot.truncated.text); assert(wrapReportLine(snapshot.tasks[0].title).every(line => [...line].length <= 44));
  for (const format of ["docx", "pptx"] as const) {
    const result = inspectZip(await renderProjectReport(snapshot, format), format), text = norm(semantic(result.texts));
    for (const line of reportTextLines(snapshot)) assert(text.includes(norm(line)));
    assert.match(text, /잘림여부:있음/); assert.doesNotMatch(text, /�/); assert(expected.length > 100);
  }
});
test("report MIME and unsupported format rejection are explicit", async () => {
  assert.equal(reportMimeType("docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(reportMimeType("pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  await assert.rejects(renderProjectReport(createDigestSnapshot(reportFixture()), "html" as "docx"));
});
