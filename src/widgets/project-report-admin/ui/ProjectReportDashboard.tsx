"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import FieldLabel from "@/src/shared/ui/field-label";
import { formatAppDateTime } from "@/src/shared/lib/date";
import { getDigestPeriodIssue, reportTextLines, validateDigestSnapshot, type DigestPeriodIssue, type DigestSnapshot } from "@/src/entities/project-report";

type Run = { runId: number; projectId: number; status: string; dryRun: boolean; errorCode: string; expiresAt: string; artifacts: { id: number; format: string; state: string; sizeBytes: number; downloadUrl: string }[] };
type Schedule = { id: number; enabled: boolean; lookbackHours: number; timeZone: string; formats: string[] };
type Props = { projectId: number; projectName: string; defaultStart: string; defaultEnd: string; requestId: string; initialRuns: Run[]; initialSchedules: Schedule[]; storageConfigured: boolean; schemaReady: boolean };
const runStatusLabels: Record<string, string> = { queued: "생성 대기", running: "생성 중", rendered: "생성 완료", failed: "생성 실패", skipped: "실행 생략" };
const artifactStateLabels: Record<string, string> = { staged: "저장 확인 필요", quarantining: "격리 확인 중", quarantined: "보관 격리" };
class DashboardError extends Error {}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const dateString = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
function responseObject(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new DashboardError("응답을 확인할 수 없습니다. 상태를 새로고침해 주세요.");
  return value;
}
function runList(value: unknown): Run[] {
  if (!Array.isArray(value)) throw new DashboardError("보고서 목록을 읽을 수 없습니다. 새로고침해 주세요.");
  return value.map((item: unknown) => {
    const row = responseObject(item);
    if (!positiveId(row.runId) || !positiveId(row.projectId) || typeof row.status !== "string" || typeof row.dryRun !== "boolean" || typeof row.errorCode !== "string" || !dateString(row.expiresAt) || !Array.isArray(row.artifacts)) throw new DashboardError("보고서 목록을 읽을 수 없습니다. 새로고침해 주세요.");
    const artifacts = row.artifacts.map((item: unknown) => {
      const file = responseObject(item);
      if (!positiveId(file.id) || (file.format !== "docx" && file.format !== "pptx") || typeof file.state !== "string" || typeof file.sizeBytes !== "number" || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0 || file.downloadUrl !== `/api/project-reports/${file.id}`) throw new DashboardError("보고서 파일 정보를 읽을 수 없습니다.");
      return { id: file.id, format: file.format, state: file.state, sizeBytes: file.sizeBytes, downloadUrl: String(file.downloadUrl) };
    });
    return { runId: row.runId, projectId: row.projectId, status: row.status, dryRun: row.dryRun, errorCode: row.errorCode, expiresAt: row.expiresAt, artifacts };
  });
}
function scheduleList(value: unknown): Schedule[] {
  if (!Array.isArray(value)) throw new DashboardError("예약 목록을 읽을 수 없습니다.");
  return value.map((item: unknown) => {
    const row = responseObject(item);
    if (!positiveId(row.id) || typeof row.enabled !== "boolean" || typeof row.lookbackHours !== "number" || !Number.isSafeInteger(row.lookbackHours) || row.lookbackHours < 1 || row.lookbackHours > 744 || typeof row.timeZone !== "string" || !Array.isArray(row.formats) || !row.formats.every((format: unknown) => format === "docx" || format === "pptx")) throw new DashboardError("예약 목록을 읽을 수 없습니다.");
    return { id: row.id, enabled: row.enabled, lookbackHours: row.lookbackHours, timeZone: row.timeZone, formats: row.formats as string[] };
  });
}
function retentionResult(value: unknown) {
  const row = responseObject(value);
  const ids = (value: unknown): number[] => { if (!Array.isArray(value) || !value.every(positiveId)) throw new DashboardError("보관 대상 목록을 읽을 수 없습니다."); return value; };
  if (typeof row.dryRun !== "boolean") throw new DashboardError("보관 대상 목록을 읽을 수 없습니다.");
  return { candidates: ids(row.candidates), quarantined: ids(row.quarantined), failed: ids(row.failed) };
}
/** Only a known public error code is consumed; internal messages are never displayed. */
async function isInvalidPeriodResponse(response: Response): Promise<boolean> {
  const limit = 4096;
  if (response.status !== 400 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel().catch(() => undefined); return false;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0, completed = false;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) { completed = true; break; }
      size += result.value.byteLength;
      if (size > limit) return false;
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return record(value) && value.code === "INVALID_PERIOD";
  } catch { return false; }
  finally { if (!completed) await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export default function ProjectReportDashboard(props: Props) {
  const [start, setStart] = useState(props.defaultStart), [end, setEnd] = useState(props.defaultEnd), [timeZone, setTimeZone] = useState("Asia/Seoul");
  const [audienceMode, setAudience] = useState("public_only"), [formats, setFormats] = useState(["docx", "pptx"]), [requestId, setRequestId] = useState(props.requestId);
  const [runs, setRuns] = useState(props.initialRuns), [schedules, setSchedules] = useState(props.initialSchedules), [preview, setPreview] = useState<DigestSnapshot | null>(null);
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [periodIssue, setPeriodIssue] = useState<DigestPeriodIssue | null>(null);
  const inputId = useId(), startInput = useRef<HTMLInputElement>(null), endInput = useRef<HTMLInputElement>(null);
  const [lookbackHours, setLookbackHours] = useState(168), [retentionIds, setRetentionIds] = useState<number[] | null>(null);
  const active = useRef<AbortController | null>(null), inFlight = useRef(false), form = useRef<HTMLFormElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (periodIssue && !pending) (periodIssue.field === "start" ? startInput : endInput).current?.focus(); }, [periodIssue, pending]);
  const instant = (value: string) => `${value.length === 16 ? `${value}:00` : value}Z`;
  function inputChanged() {
    setPreview(null); setPeriodIssue(null); setRequestId(crypto.randomUUID()); setMessage(""); setError("");
  }
  async function operation(run: (signal: AbortSignal) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setPending(true); setError(""); setMessage("");
    try { await run(controller.signal); } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof DashboardError ? caught.message : "요청을 처리하지 못했습니다. 상태를 확인한 뒤 다시 시도해 주세요."); }
    finally { if (active.current === controller) { inFlight.current = false; active.current = null; if (!controller.signal.aborted) setPending(false); } }
  }
  async function api<T>(path: string, signal: AbortSignal, parse: (value: unknown) => T, body?: unknown): Promise<T> {
    const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store", credentials: "same-origin", signal, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    if (!response.ok) {
      if (await isInvalidPeriodResponse(response)) {
        const issue = getDigestPeriodIssue(instant(start), instant(end), new Date()) ?? { code: "INVALID_END" as const, field: "end" as const, message: "기간을 확인해 주세요. UTC 기준으로 끝은 시작보다 늦고 현재 시각 이하여야 하며, 기간은 최대 31일입니다." };
        setPeriodIssue(issue); setPreview(null); throw new DashboardError(issue.message);
      }
      throw new DashboardError(response.status === 401 ? "로그인 상태를 확인하고 다시 시도해 주세요." : response.status === 404 ? "보고서 또는 프로젝트에 접근할 수 없습니다. 권한을 확인해 주세요." : response.status === 409 ? "기존 요청과 충돌했습니다. 실행 기록을 확인한 뒤 입력을 변경하거나 다시 시도해 주세요." : "요청을 처리하지 못했습니다. 입력과 현재 권한을 확인해 주세요.");
    }
    try { const value: unknown = await response.json(); return parse(value); }
    catch (error) { if (error instanceof DashboardError) throw error; throw new DashboardError("응답을 확인할 수 없습니다. 실행 기록을 새로고침해 주세요."); }
  }
  function valid() {
    const nativeValid = form.current?.reportValidity() ?? false;
    const issue = getDigestPeriodIssue(instant(start), instant(end), new Date());
    if (issue) { setPeriodIssue(issue); setPreview(null); setError(issue.message); return false; }
    if (!nativeValid) return false;
    setPeriodIssue(null);
    if (!formats.length) { setError("DOCX 또는 PPTX 형식을 선택해 주세요."); return false; }
    return true;
  }
  function showPreview() {
    if (!valid()) return;
    void operation(async signal => {
      const query = new URLSearchParams({ start: instant(start), end: instant(end), timeZone, audienceMode });
      const value = await api(`/api/projects/${props.projectId}/reports/preview?${query}`, signal, validateDigestSnapshot);
      if (value.project.id !== props.projectId) throw new DashboardError("프로젝트를 확인할 수 없습니다. 새로고침해 주세요.");
      if (!signal.aborted) setPreview(value);
    });
  }
  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!valid()) return;
    void operation(async signal => {
      const result = await api("/api/project-reports", signal, value => { const row = responseObject(value); if (typeof row.deduplicated !== "boolean") throw new DashboardError("생성 결과를 확인할 수 없습니다. 실행 기록을 확인해 주세요."); return { deduplicated: row.deduplicated }; }, { projectId: props.projectId, requestId, start: instant(start), end: instant(end), timeZone, audienceMode, formats, dryRun: false });
      const list = await api(`/api/project-reports?projectId=${props.projectId}`, signal, runList);
      if (!signal.aborted) { setRuns(list); setRequestId(crypto.randomUUID()); setMessage(result.deduplicated ? "기존 요청의 결과를 불러왔습니다." : "보고서를 생성했습니다."); }
    });
  }
  return <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: "anywhere", "& .MuiButton-root": { maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" } }} data-testid="project-reports">
    <Stack spacing={1}><Typography component="h1" variant="h4">{props.projectName} · 활동 보고서</Typography><Typography color="text.secondary">허용된 자료를 한 시점의 보고서로 저장하고 DOCX·PPTX로 내려받습니다. 첨부 파일 내용과 외부 발송은 포함하지 않습니다.</Typography></Stack>
    {!props.schemaReady ? <Alert severity="warning">보고서 생성 준비가 완료되지 않았습니다. 시스템 관리자에게 보고서 기능의 준비 상태를 확인해 달라고 요청해 주세요.</Alert> : null}
    {!props.storageConfigured ? <Alert severity="warning">보고서 파일 저장소가 준비되지 않았습니다. 미리보기만 사용할 수 있습니다.</Alert> : null}
    {error ? <Alert severity="error" role="alert">{error}</Alert> : null}{message ? <Alert severity="success" role="status">{message}</Alert> : null}
    <Paper component="section" elevation={0} sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack component="form" ref={form} onSubmit={generate} onInvalidCapture={() => { const issue = getDigestPeriodIssue(instant(start), instant(end), new Date()); if (issue) { setPeriodIssue(issue); setPreview(null); setError(issue.message); } }} spacing={2} aria-busy={pending}>
        <Typography component="h2" variant="h6">기간과 열람 범위</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField id={`${inputId}-start`} inputRef={startInput} type="datetime-local" required label={<FieldLabel requirement="required">기간 시작 · UTC</FieldLabel>} error={periodIssue?.field === "start"} helperText={periodIssue?.field === "start" ? periodIssue.message : "UTC 기준 시작 시각"} value={start} onChange={event => { setStart(event.target.value); inputChanged(); }} disabled={pending} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          <TextField id={`${inputId}-end`} inputRef={endInput} type="datetime-local" required label={<FieldLabel requirement="required">기간 끝 · UTC</FieldLabel>} error={periodIssue?.field === "end"} helperText={periodIssue?.field === "end" ? periodIssue.message : "UTC 기준 끝 시각 · 현재 시각까지"} value={end} onChange={event => { setEnd(event.target.value); inputChanged(); }} disabled={pending} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        </Stack>
        <Typography variant="caption">기간은 UTC로 입력합니다. 한국 시각에서 9시간을 빼 주세요(한국 09:00 = UTC 00:00). 시작 이상·끝 미만, 최대 31일이며 끝은 현재 UTC 시각을 넘을 수 없습니다. 아래 시간대는 보고서의 일정 날짜 기준이며 입력 시각을 변환하지 않습니다.</Typography>
        <TextField select label={<FieldLabel requirement="required">보고서·예약 일정의 날짜 기준 시간대</FieldLabel>} value={timeZone} onChange={event => { setTimeZone(event.target.value); inputChanged(); }} disabled={pending}><MenuItem value="Asia/Seoul">한국 · Asia/Seoul</MenuItem><MenuItem value="UTC">UTC</MenuItem><MenuItem value="America/New_York">뉴욕 · America/New_York</MenuItem></TextField>
        <TextField select label={<FieldLabel requirement="required">제출물 범위</FieldLabel>} value={audienceMode} onChange={event => { setAudience(event.target.value); inputChanged(); }} disabled={pending}><MenuItem value="public_only">공개 제출물만</MenuItem><MenuItem value="requester_scope">현재 요청자가 열람할 수 있는 제출물</MenuItem></TextField>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>{["docx", "pptx"].map(format => <FormControlLabel key={format} label={format.toUpperCase()} control={<Checkbox checked={formats.includes(format)} disabled={pending} onChange={event => { setFormats(current => event.target.checked ? [...current, format] : current.filter(value => value !== format)); inputChanged(); }} />} />)}</Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Button type="button" onClick={showPreview} disabled={pending} variant="outlined">미리보기</Button><Button type="submit" variant="contained" disabled={pending || !props.schemaReady || !props.storageConfigured}>{pending ? "처리 중…" : "보고서 생성"}</Button><Button component="a" href={`/admin/projects`} disabled={pending}>프로젝트 관리로 돌아가기</Button></Stack>
      </Stack>
    </Paper>
    {preview ? <Paper component="section" elevation={0} sx={{ p: 2, minWidth: 0 }} data-testid="report-preview"><Stack spacing={1}><Typography component="h2" variant="h6">미리보기</Typography><Typography>업무 {preview.sourceCounts.tasks} · 제출 {preview.sourceCounts.submissions} · 댓글 {preview.sourceCounts.comments} · 첨부 {preview.sourceCounts.attachments}</Typography>{Object.values(preview.truncated).some(Boolean) ? <Alert severity="info">행 또는 텍스트 상한으로 일부 자료가 생략됐습니다.</Alert> : null}<Typography variant="caption">미리보기 이후 변경된 자료는 보고서를 생성할 때 반영됩니다.</Typography><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 480, overflow: "auto", margin: 0 }}>{reportTextLines(preview).join("\n\n")}</pre><Button onClick={() => setPreview(null)}>미리보기 닫기</Button></Stack></Paper> : null}
    <Paper component="section" elevation={0} sx={{ p: 2 }}><Stack spacing={2}><Typography component="h2" variant="h6">내 보고서 기록</Typography>{runs.length ? runs.map(run => <Stack key={run.runId} spacing={1} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1 }}><Typography>보고서 #{run.runId} · {runStatusLabels[run.status] ?? "상태 확인 필요"} {run.dryRun ? "· 파일 없는 실행 확인" : ""}</Typography><Typography variant="caption">보관 기한 {formatAppDateTime(new Date(run.expiresAt))}</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{run.artifacts.map(file => file.state === "ready" && run.status === "rendered" ? <Button component="a" href={file.downloadUrl} key={file.id} size="small" variant="outlined">{file.format.toUpperCase()} 다운로드</Button> : <Chip key={file.id} size="small" label={`${file.format.toUpperCase()} · ${file.state === "ready" ? "생성 완료 대기" : artifactStateLabels[file.state] ?? "파일 상태 확인 필요"}`} />)}{["failed", "running"].includes(run.status) ? <Button disabled={pending} onClick={() => void operation(async signal => { await api(`/api/project-reports/runs/${run.runId}/retry`, signal, responseObject, {}); const list = await api(`/api/project-reports?projectId=${props.projectId}`, signal, runList); if (!signal.aborted) setRuns(list); })}>실행 상태 확인·재시도</Button> : null}</Stack></Stack>) : <Typography color="text.secondary">아직 생성한 보고서가 없습니다.</Typography>}</Stack></Paper>
    <Paper component="section" elevation={0} sx={{ p: 2 }}><Stack spacing={2}><Typography component="h2" variant="h6">예약 설정 준비</Typography><Alert severity="info">새 설정은 비활성 상태로 저장됩니다. 이 화면에서 운영 예약이나 외부 발송을 활성화하지 않습니다.</Alert><TextField type="number" label={<FieldLabel requirement="required">집계할 이전 시간</FieldLabel>} value={lookbackHours} onChange={event => setLookbackHours(Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: 744 } }} disabled={pending} /><Button disabled={pending || !props.schemaReady || !formats.length} onClick={() => void operation(async signal => { if (!Number.isSafeInteger(lookbackHours) || lookbackHours < 1 || lookbackHours > 744) throw new DashboardError("집계할 이전 시간은 1~744 사이의 정수로 입력해 주세요."); await api(`/api/projects/${props.projectId}/reports/schedules`, signal, responseObject, { lookbackHours, timeZone, formats }); const list = await api(`/api/projects/${props.projectId}/reports/schedules`, signal, scheduleList); if (!signal.aborted) { setSchedules(list); setMessage("비활성 예약 설정을 저장했습니다."); } })}>비활성 예약 설정 저장</Button>{schedules.map(schedule => <Typography key={schedule.id}>#{schedule.id} · {schedule.enabled ? "활성" : "비활성"} · {schedule.lookbackHours}시간 · {schedule.timeZone}</Typography>)}</Stack></Paper>
    <Paper component="section" elevation={0} sx={{ p: 2 }}><Stack spacing={2}><Typography component="h2" variant="h6">보관 기한 관리</Typography><Typography variant="body2">기한이 지난 보고서는 다운로드가 차단됩니다. 격리는 복원 가능한 이동이며 영구 삭제하지 않습니다.</Typography><Button disabled={pending || !props.schemaReady} onClick={() => void operation(async signal => { const result = await api(`/api/projects/${props.projectId}/reports/retention`, signal, retentionResult, { dryRun: true }); if (!signal.aborted) setRetentionIds(result.candidates); })}>만료된 보고서 확인</Button>{retentionIds !== null ? <><Typography>격리 대상 {retentionIds.length}개</Typography><Button color="warning" disabled={pending || !retentionIds.length} onClick={() => void operation(async signal => { const result = await api(`/api/projects/${props.projectId}/reports/retention`, signal, retentionResult, { dryRun: false, artifactIds: retentionIds }); if (!signal.aborted) { setRetentionIds(null); setMessage(`격리 ${result.quarantined.length}개 · 재확인 필요 ${result.failed.length}개`); } })}>확인한 만료 보고서 격리</Button></> : null}</Stack></Paper>
  </Stack>;
}
