/** Versioned, bounded report data. Authentication and current DB visibility belong to the collector. */
export const REPORT_SCHEMA_VERSION = 1 as const;
export const REPORT_MAX_ROWS = 100;
export const REPORT_MAX_TEXT = 512;
export const REPORT_MAX_PERIOD_DAYS = 31;
export type ReportAudience = "public_only" | "requester_scope";
export type ReportFormat = "docx" | "pptx";
export type ReportTaskStatus = "planned" | "in_progress" | "blocked" | "review_pending" | "changes_requested" | "done";
export type ReportPeriod = { start: string; end: string; snapshotAt: string; timeZone: string; localDate: string };
export type ReportProject = { id: number; name: string; goal: string; startDate: string; endDate: string; projectType: "collaboration" | "volunteering" };
export type ReportTask = { id: number; parentId: number | null; title: string; status: ReportTaskStatus; startDate: string; endDate: string; assigneeName: string | null; completionMode: "submission_required" | "direct_completion" };
export type ReportSubmission = { id: number; taskId: number; revisionNumber: number; authorName: string; createdAt: string; visibility: "public" | "private"; content: string };
export type ReportComment = { id: number; submissionId: number; revisionNumber: number | null; authorName: string; createdAt: string; content: string };
export type ReportAttachment = { id: number; submissionId: number; revisionNumber: number; fileName: string; mimeType: string | null; sizeBytes: number | null; createdAt: string };
export type ReportCounts = { tasks: number; submissions: number; comments: number; attachments: number };
export type ReportTruncation = { tasks: boolean; submissions: boolean; comments: boolean; attachments: boolean; text: boolean };
export type DigestSnapshot = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  project: ReportProject;
  period: ReportPeriod;
  audienceMode: ReportAudience;
  requestedById: number;
  tasks: ReportTask[];
  submissions: ReportSubmission[];
  comments: ReportComment[];
  attachments: ReportAttachment[];
  /** Included rows only; never an unbounded total or a progress percentage. */
  sourceCounts: ReportCounts;
  excludedCounts: { privateSubmissions: number; privateComments: number; privateAttachments: number; outsidePeriod: number };
  truncated: ReportTruncation;
  warnings: string[];
};
export type DigestSnapshotInput = {
  project: ReportProject;
  period: { start: string | Date; end: string | Date; snapshotAt: string | Date; timeZone: string };
  audienceMode: ReportAudience;
  requestedById: number;
  tasks: (ReportTask & { projectId: number })[];
  submissions: (ReportSubmission & { projectId: number })[];
  comments: (ReportComment & { projectId: number })[];
  attachments: (ReportAttachment & { projectId: number })[];
  truncated?: Partial<ReportTruncation>;
};
const kinds = ["tasks", "submissions", "comments", "attachments"] as const;
const statuses = new Set<ReportTaskStatus>(["planned", "in_progress", "blocked", "review_pending", "changes_requested", "done"]);
function fail(): never { throw new Error("보고서 데이터 형식이 올바르지 않습니다."); }
function id(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 1) fail(); return value as number; }
function nullableId(value: unknown): number | null { return value === null ? null : id(value); }
function calendar(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail();
  const date = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail();
  return value;
}
function instant(value: string | Date): string {
  if (!(value instanceof Date) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) fail();
  if (typeof value === "string") {
    const components = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!components || Number(components[2]) > 23 || Number(components[3]) > 59 || Number(components[4]) > 59) fail();
    calendar(components[1]);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail();
  return date.toISOString();
}
export function createDigestPeriod(start: string | Date, end: string | Date, snapshotAt: string | Date, timeZone: string): ReportPeriod {
  const s = instant(start), e = instant(end), at = instant(snapshotAt);
  if (s >= e || e > at || Date.parse(e) - Date.parse(s) > REPORT_MAX_PERIOD_DAYS * 86_400_000) fail();
  if (typeof timeZone !== "string" || timeZone.length > 80 || (timeZone !== "UTC" && !timeZone.includes("/"))) fail();
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); } catch { return fail(); }
  const parts = formatter.formatToParts(new Date(at));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? fail();
  return { start: s, end: e, snapshotAt: at, timeZone: formatter.resolvedOptions().timeZone, localDate: `${part("year")}-${part("month")}-${part("day")}` };
}
/** Parent rows may predate the period so a recent comment can retain its authorized context. */
export function createDigestSnapshot(input: DigestSnapshotInput): DigestSnapshot {
  if (!input || typeof input !== "object") fail();
  const period = createDigestPeriod(input.period.start, input.period.end, input.period.snapshotAt, input.period.timeZone);
  if (!["public_only", "requester_scope"].includes(input.audienceMode)) fail();
  const requestedById = id(input.requestedById), projectId = id(input.project.id);
  if (!["collaboration", "volunteering"].includes(input.project.projectType)) fail();
  const truncated: ReportTruncation = { tasks: false, submissions: false, comments: false, attachments: false, text: false };
  for (const kind of [...kinds, "text"] as const) {
    if (input.truncated?.[kind] !== undefined && typeof input.truncated[kind] !== "boolean") fail();
    truncated[kind] = input.truncated?.[kind] ?? false;
  }
  const text = (value: unknown): string => {
    if (typeof value !== "string") fail();
    // XML cannot represent these control characters; display replacement instead of executing/parsing content.
    const safe = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "�").toWellFormed();
    const points = [...safe];
    if (points.length > REPORT_MAX_TEXT) { truncated.text = true; return points.slice(0, REPORT_MAX_TEXT).join("") + "…"; }
    return safe;
  };
  const project: ReportProject = { id: projectId, name: text(input.project.name), goal: text(input.project.goal), startDate: calendar(input.project.startDate), endDate: calendar(input.project.endDate), projectType: input.project.projectType };
  if (project.startDate > project.endDate) fail();
  const checkRows = (rows: unknown): void => {
    if (!Array.isArray(rows) || rows.length > REPORT_MAX_ROWS + 1) fail();
    const seen = new Set<number>();
    for (const row of rows) {
      if (!row || typeof row !== "object" || id(row.projectId) !== projectId || seen.has(id(row.id))) fail();
      seen.add(row.id);
    }
  };
  for (const kind of kinds) checkRows(input[kind]);
  const allTaskIds = new Set(input.tasks.map(row => row.id));
  const tasks = input.tasks.map(row => {
    const parentId = nullableId(row.parentId);
    if (parentId === row.id || (parentId !== null && !allTaskIds.has(parentId) && !truncated.tasks) || !statuses.has(row.status) || !["submission_required", "direct_completion"].includes(row.completionMode)) fail();
    const result: ReportTask = { id: row.id, parentId, title: text(row.title), status: row.status, startDate: calendar(row.startDate), endDate: calendar(row.endDate), assigneeName: row.assigneeName === null ? null : text(row.assigneeName), completionMode: row.completionMode };
    if (result.startDate > result.endDate) fail();
    return result;
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
  const taskParents = new Map(tasks.map(row => [row.id, row.parentId]));
  for (const task of tasks) {
    const seen = new Set<number>(); let next: number | null | undefined = task.id;
    while (next !== null && next !== undefined) { if (seen.has(next)) fail(); seen.add(next); next = taskParents.get(next); }
  }
  const allSubmissions = new Map(input.submissions.map(row => [row.id, row]));
  for (const row of input.submissions) { if (!allTaskIds.has(id(row.taskId)) || !["public", "private"].includes(row.visibility)) fail(); id(row.revisionNumber); }
  for (const row of [...input.comments, ...input.attachments]) { if (!allSubmissions.has(id(row.submissionId))) fail(); }
  const excludedCounts = { privateSubmissions: 0, privateComments: 0, privateAttachments: 0, outsidePeriod: 0 };
  const publicParent = (submissionId: number): boolean => input.audienceMode !== "public_only" || allSubmissions.get(submissionId)?.visibility === "public";
  const beforeSnapshot = (createdAt: string): boolean => createdAt <= period.snapshotAt;
  const inPeriod = (createdAt: string): boolean => createdAt >= period.start && createdAt < period.end;
  const submissions = input.submissions.flatMap(row => {
    const createdAt = instant(row.createdAt);
    if (!publicParent(row.id)) { excludedCounts.privateSubmissions++; return []; }
    if (!beforeSnapshot(createdAt)) { excludedCounts.outsidePeriod++; return []; }
    return [{ id: row.id, taskId: row.taskId, revisionNumber: row.revisionNumber, authorName: text(row.authorName), createdAt, visibility: row.visibility, content: text(row.content) }];
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const retainedParents = new Set(submissions.map(row => row.id));
  const comments = input.comments.flatMap(row => {
    const createdAt = instant(row.createdAt), revisionNumber = nullableId(row.revisionNumber);
    if (!publicParent(row.submissionId)) { excludedCounts.privateComments++; return []; }
    if (!inPeriod(createdAt) || !retainedParents.has(row.submissionId)) { excludedCounts.outsidePeriod++; return []; }
    return [{ id: row.id, submissionId: row.submissionId, revisionNumber, authorName: text(row.authorName), createdAt, content: text(row.content) }];
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const attachments = input.attachments.flatMap(row => {
    const createdAt = instant(row.createdAt), revisionNumber = id(row.revisionNumber);
    if (row.sizeBytes !== null && (!Number.isSafeInteger(row.sizeBytes) || row.sizeBytes < 0)) fail();
    if (!publicParent(row.submissionId)) { excludedCounts.privateAttachments++; return []; }
    if (!inPeriod(createdAt) || !retainedParents.has(row.submissionId)) { excludedCounts.outsidePeriod++; return []; }
    return [{ id: row.id, submissionId: row.submissionId, revisionNumber, fileName: text(row.fileName), mimeType: row.mimeType === null ? null : text(row.mimeType), sizeBytes: row.sizeBytes, createdAt }];
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  // The collector supplies at most 101 rows per kind; this independent total budget bounds rendering too.
  let remaining = REPORT_MAX_ROWS;
  const cap = <T,>(rows: T[], kind: typeof kinds[number]): T[] => { const selected = rows.slice(0, remaining); remaining -= selected.length; truncated[kind] ||= selected.length < rows.length; return selected; };
  const selectedTasks = cap(tasks, "tasks"), selectedTaskIds = new Set(selectedTasks.map(row => row.id));
  const selectedSubmissions = cap(submissions.filter(row => selectedTaskIds.has(row.taskId)), "submissions"), selectedSubmissionIds = new Set(selectedSubmissions.map(row => row.id));
  truncated.submissions ||= submissions.some(row => !selectedTaskIds.has(row.taskId));
  const selectedComments = cap(comments.filter(row => selectedSubmissionIds.has(row.submissionId)), "comments");
  truncated.comments ||= comments.some(row => !selectedSubmissionIds.has(row.submissionId));
  const selectedAttachments = cap(attachments.filter(row => selectedSubmissionIds.has(row.submissionId)), "attachments");
  truncated.attachments ||= attachments.some(row => !selectedSubmissionIds.has(row.submissionId));
  // A truncated task parent remains explicitly absent; it never points outside this project.
  const result: DigestSnapshot = { schemaVersion: REPORT_SCHEMA_VERSION, project, period, audienceMode: input.audienceMode, requestedById, tasks: selectedTasks, submissions: selectedSubmissions, comments: selectedComments, attachments: selectedAttachments,
    sourceCounts: { tasks: selectedTasks.length, submissions: selectedSubmissions.length, comments: selectedComments.length, attachments: selectedAttachments.length }, excludedCounts, truncated,
    warnings: [...(Object.values(truncated).some(Boolean) ? ["REPORT_TRUNCATED"] : []), ...(selectedTasks.some(t => t.parentId !== null && !selectedTaskIds.has(t.parentId)) ? ["PARENT_TASK_OMITTED"] : [])] };
  return result;
}
/** Reject malformed persisted snapshots; never trust a cast after JSON.parse. */
export function validateDigestSnapshot(value: unknown): DigestSnapshot {
  if (!value || typeof value !== "object") return fail();
  const s = value as DigestSnapshot;
  if (s.schemaVersion !== REPORT_SCHEMA_VERSION || !s.project || !s.period || !s.excludedCounts || !s.sourceCounts || !s.truncated || !Array.isArray(s.warnings)) fail();
  const result = createDigestSnapshot({ ...s, tasks: s.tasks.map(row => ({ ...row, projectId: s.project.id })), submissions: s.submissions.map(row => ({ ...row, projectId: s.project.id })), comments: s.comments.map(row => ({ ...row, projectId: s.project.id })), attachments: s.attachments.map(row => ({ ...row, projectId: s.project.id })) });
  for (const kind of kinds) if (s.sourceCounts[kind] !== result.sourceCounts[kind]) fail();
  for (const count of Object.values(s.excludedCounts)) if (!Number.isSafeInteger(count) || count < 0) fail();
  if (Object.keys(s.excludedCounts).sort().join(",") !== "outsidePeriod,privateAttachments,privateComments,privateSubmissions") fail();
  for (const key of ["project", "period", "tasks", "submissions", "comments", "attachments", "warnings", "truncated", "sourceCounts"] as const) {
    if (JSON.stringify(canonical(s[key])) !== JSON.stringify(canonical(result[key]))) fail();
  }
  return { ...result, excludedCounts: s.excludedCounts };
}
function canonical(value: unknown): unknown { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])); return value; }
export function canonicalSnapshotJson(snapshot: DigestSnapshot): string { return JSON.stringify(canonical(validateDigestSnapshot(snapshot))); }
export async function sha256ReportText(value: string): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join(""); }
export function hashDigestSnapshot(snapshot: DigestSnapshot): Promise<string> { return sha256ReportText(canonicalSnapshotJson(snapshot)); }
export type ReportRunKey = { scheduleId: number | null; scheduledFor: string; projectId: number; formats: ReportFormat[]; audienceMode: ReportAudience; dryRun: boolean; requestedById?: number; requestId?: string };
/** Canonical plain text is inspectable in tests; callers hash it before storing it. */
export function canonicalRunKey(input: ReportRunKey): string {
  id(input.projectId); if (input.scheduleId !== null) id(input.scheduleId);
  const formats = [...new Set(input.formats)].sort();
  if (!formats.length || formats.length > 2 || formats.some(format => !["docx", "pptx"].includes(format)) || !["public_only", "requester_scope"].includes(input.audienceMode) || typeof input.dryRun !== "boolean") fail();
  const components = [String(input.scheduleId ?? "manual"), instant(input.scheduledFor), String(input.projectId), String(REPORT_SCHEMA_VERSION), formats.join(","), input.audienceMode, String(input.dryRun)];
  if (input.scheduleId === null) { id(input.requestedById); if (typeof input.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId)) fail(); components.push(String(input.requestedById), input.requestId); }
  return components.join("\n");
}
export function hashReportRunKey(input: ReportRunKey): Promise<string> { return sha256ReportText(canonicalRunKey(input)); }
const statusLabels: Record<ReportTaskStatus, string> = { planned: "예정", in_progress: "진행 중", blocked: "차단됨", review_pending: "검토 대기", changes_requested: "수정 요청", done: "완료" };
/** Shared semantic text keeps the two formats honest and contains no active links or binary files. */
export function reportTextLines(snapshot: DigestSnapshot): string[] {
  const s = validateDigestSnapshot(snapshot), inPeriod = (value: string) => value >= s.period.start && value < s.period.end;
  const lines = ["프로젝트 활동 보고서", `프로젝트: ${s.project.name} (#${s.project.id})`, `목표: ${s.project.goal || "미입력"}`, `유형: ${s.project.projectType === "volunteering" ? "봉사활동" : "업무 협업"}`, `기간: ${s.period.start} 이상 ~ ${s.period.end} 미만`, `기준: ${s.period.snapshotAt} / ${s.period.timeZone} / ${s.period.localDate}`, `열람 범위: ${s.audienceMode === "public_only" ? "공개 제출물" : "요청자 허용 범위"}`, "포함된 자료 수 (전체 총수 아님)", `업무 ${s.sourceCounts.tasks} · 제출 ${s.sourceCounts.submissions} · 댓글 ${s.sourceCounts.comments} · 첨부 ${s.sourceCounts.attachments}`, "업무 현황"];
  for (const t of s.tasks) lines.push(`#${t.id} ${t.title} · ${statusLabels[t.status]} · ${t.startDate} ~ ${t.endDate} · 담당 ${t.assigneeName ?? "미배정"} · ${t.completionMode === "direct_completion" ? "직접 완료 가능" : "제출 필수"}`);
  lines.push("기한 경과 일정 (완료·지연 확정 판정 아님)");
  for (const t of s.tasks.filter(t => t.endDate < s.period.localDate)) lines.push(`#${t.id} ${t.title} · 종료 예정 ${t.endDate}`);
  lines.push("기간 내 제출 및 활동 연결 제출");
  for (const row of s.submissions) lines.push(`${inPeriod(row.createdAt) ? "기간 내 제출" : "활동 연결 제출"} #${row.id} / 업무${row.taskId} / v${row.revisionNumber} / ${row.createdAt} / ${row.authorName}: ${row.content}`);
  lines.push("기간 내 댓글"); for (const row of s.comments) lines.push(`#${row.id} / 제출${row.submissionId} / ${row.revisionNumber === null ? "이전 댓글" : `v${row.revisionNumber}`} / ${row.createdAt} / ${row.authorName}: ${row.content}`);
  lines.push("기간 내 첨부 metadata (파일 내용 없음)"); for (const row of s.attachments) lines.push(`#${row.id} / 제출${row.submissionId} / v${row.revisionNumber} / ${row.createdAt} / ${row.fileName} / ${row.mimeType ?? "종류 미상"} / ${row.sizeBytes === null ? "크기 미상" : `${row.sizeBytes} bytes`}`);
  lines.push("다음 일정"); for (const t of s.tasks.filter(t => t.startDate >= s.period.localDate)) lines.push(`#${t.id} ${t.title} · 시작 예정 ${t.startDate}`);
  lines.push("데이터 품질·부록", `잘림 여부: ${Object.values(s.truncated).some(Boolean) ? "있음 — 포함 자료만 표시" : "없음"}`, `텍스트 상한 ${REPORT_MAX_TEXT}자 · 전체 행 상한 ${REPORT_MAX_ROWS}`, "이 보고서는 한 시점의 허용 자료이며 현재 권한으로 다운로드를 다시 검사합니다.");
  return lines;
}
