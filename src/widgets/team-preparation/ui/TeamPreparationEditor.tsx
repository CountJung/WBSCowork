"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { activityKindLabels, type ActivityKind } from "@/src/shared/config/activity-kinds";
import { createPreparationEntry, normalizePreparationDocument, PREPARATION_MAX_ENTRIES, type PreparationDocument, type PreparationEntry, type PreparationStatus } from "@/src/entities/team-preparation";
import { formatAppDateTime } from "@/src/shared/lib/date";
import FieldLabel from "@/src/shared/ui/field-label";

type Sheet = { projectId: number; teamId: number; teamName: string; kind: ActivityKind; canEdit: boolean; version: number; document: PreparationDocument; updatedAt: string | null; updatedBy: number | null; mealQuantities: Record<string, number> };
type History = { version: number; changedAt: string; changedBy: number };
type Props = { initialSheet: Sheet; initialHistory: History[]; defaultDate: string; projectName: string };
const statuses: Record<PreparationStatus, string> = { planned: "예정", in_progress: "진행", done: "완료" };
const meals = { breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" };
const titleLabels: Record<ActivityKind, string> = { meal: "메뉴", facility: "점검·작업 내용", senior_care: "돌봄 활동", child_care: "돌봄 활동", recreation: "프로그램", other: "준비 내용" };
const numberValue = (value: number) => Number.isFinite(value) ? value : "";

function EntrySummary({ entry, kind, quantity }: { entry: PreparationEntry; kind: ActivityKind; quantity?: number }) {
  return <Stack spacing={1}>
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography component="h3" variant="h6" sx={{ overflowWrap: "anywhere" }}>{entry.title}</Typography><Chip size="small" label={statuses[entry.status]} color={entry.status === "done" ? "success" : "default"} /></Stack>
    <Typography>{entry.date}{"meal" in entry ? ` · ${meals[entry.meal]}` : "time" in entry && entry.time ? ` · ${entry.time}` : ""}</Typography>
    {"meal" in entry ? <Typography>예상 {entry.expectedPeople}명 · 1인 기준 {entry.amountPerPerson} {entry.unit} · 준비 수량 {quantity} {entry.unit}</Typography> : null}
    {"order" in entry ? <Typography>순서 {entry.order} · 소요 {entry.durationMinutes}분</Typography> : null}
    {"role" in entry && entry.role ? <Typography sx={{ whiteSpace: "pre-wrap" }}>담당 역할: {entry.role}</Typography> : null}
    {"materials" in entry && entry.materials ? <Typography sx={{ whiteSpace: "pre-wrap" }}>준비물·자재: {entry.materials}</Typography> : null}
    {"tools" in entry && entry.tools ? <Typography sx={{ whiteSpace: "pre-wrap" }}>도구: {entry.tools}</Typography> : null}
    {entry.notes ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{entry.notes}</Typography> : null}
    {entry.checks.length ? <Box component="ul" sx={{ pl: 2.5, m: 0 }}>{entry.checks.map((check, index) => <li key={index}>{check.done ? "완료" : "준비 필요"} · {check.label}</li>)}</Box> : <Typography color="text.secondary">{kind === "meal" ? "장보기" : "준비"} 체크 항목이 없습니다.</Typography>}
  </Stack>;
}

function EntryFields({ entry, kind, disabled, update }: { entry: PreparationEntry; kind: ActivityKind; disabled: boolean; update: (patch: Partial<PreparationEntry>) => void }) {
  const text = (field: "materials" | "tools" | "role", label: string, maxLength: number) => field in entry ? <TextField fullWidth label={<FieldLabel>{label}</FieldLabel>} value={String((entry as unknown as Record<string, unknown>)[field] ?? "")} onChange={event => update({ [field]: event.target.value })} disabled={disabled} multiline={field !== "role"} minRows={field !== "role" ? 2 : undefined} slotProps={{ htmlInput: { maxLength } }} /> : null;
  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField label={<FieldLabel requirement="required">날짜</FieldLabel>} type="date" required fullWidth value={entry.date} onChange={event => update({ date: event.target.value })} disabled={disabled} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select label={<FieldLabel requirement="required">진행 상태</FieldLabel>} required fullWidth value={entry.status} onChange={event => update({ status: event.target.value as PreparationStatus })} disabled={disabled}>{Object.entries(statuses).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
    </Stack>
    <TextField label={<FieldLabel requirement="required">{titleLabels[kind]}</FieldLabel>} required fullWidth value={entry.title} onChange={event => update({ title: event.target.value })} disabled={disabled} slotProps={{ htmlInput: { maxLength: 120 } }} />
    {"meal" in entry ? <>
      <TextField select fullWidth required label={<FieldLabel requirement="required">끼니</FieldLabel>} value={entry.meal} onChange={event => update({ meal: event.target.value as keyof typeof meals })} disabled={disabled}>{Object.entries(meals).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth required type="number" label={<FieldLabel requirement="required">예상 인원</FieldLabel>} value={numberValue(entry.expectedPeople)} onChange={event => update({ expectedPeople: event.target.value === "" ? NaN : Number(event.target.value) })} disabled={disabled} slotProps={{ htmlInput: { min: 0, max: 10000, step: 1 } }} />
        <TextField fullWidth required type="number" label={<FieldLabel requirement="required">1인 기준량</FieldLabel>} value={numberValue(entry.amountPerPerson)} onChange={event => update({ amountPerPerson: event.target.value === "" ? NaN : Number(event.target.value) })} disabled={disabled} slotProps={{ htmlInput: { min: 0, max: 10000, step: 0.001 } }} helperText="직접 지정한 기준량 × 예상 인원으로 계산합니다." />
        <TextField fullWidth required label={<FieldLabel requirement="required">단위</FieldLabel>} value={entry.unit} onChange={event => update({ unit: event.target.value })} disabled={disabled} slotProps={{ htmlInput: { maxLength: 20 } }} helperText="예: g, 개, 인분" />
      </Stack>
      <Typography role="status">예상 준비 수량: {Number.isFinite(entry.amountPerPerson) && Number.isFinite(entry.expectedPeople) && entry.amountPerPerson >= 0 && entry.expectedPeople >= 0 ? Math.round(entry.amountPerPerson * 1000) * entry.expectedPeople / 1000 : "—"} {entry.unit} · 저장 시 서버에서 검증·계산합니다.</Typography>
    </> : null}
    {"order" in entry ? <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth required label={<FieldLabel requirement="required">프로그램 순서</FieldLabel>} type="number" value={numberValue(entry.order)} disabled={disabled} onChange={event => update({ order: event.target.value === "" ? NaN : Number(event.target.value) })} slotProps={{ htmlInput: { min: 1, max: 1000, step: 1 } }} /><TextField fullWidth required label={<FieldLabel requirement="required">소요 시간 · 분</FieldLabel>} type="number" value={numberValue(entry.durationMinutes)} disabled={disabled} onChange={event => update({ durationMinutes: event.target.value === "" ? NaN : Number(event.target.value) })} slotProps={{ htmlInput: { min: 0, max: 1440, step: 1 } }} /></Stack> : null}
    {"time" in entry ? <TextField type="time" fullWidth label={<FieldLabel>시작 시각</FieldLabel>} value={entry.time} disabled={disabled} onChange={event => update({ time: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /> : null}
    {text("role", "담당 역할", 120)}{text("materials", kind === "facility" ? "자재" : "준비물", 1000)}{text("tools", "도구", 1000)}
    <TextField fullWidth multiline minRows={2} label={<FieldLabel>팀 메모</FieldLabel>} value={entry.notes} disabled={disabled} onChange={event => update({ notes: event.target.value })} slotProps={{ htmlInput: { maxLength: 1000 } }} helperText="개인의 건강정보나 아동·돌봄 대상자의 개별정보를 입력하지 마세요." />
    <Typography component="h4" variant="subtitle1">{kind === "meal" ? "장보기" : "준비"} 체크 · 선택</Typography>
    {entry.checks.map((check, index) => <Stack key={index} spacing={1} direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" } }}>
      <FormControlLabel sx={{ flexShrink: 0 }} label="완료" control={<Checkbox disabled={disabled} checked={check.done} onChange={event => update({ checks: entry.checks.map((value, i) => i === index ? { ...value, done: event.target.checked } : value) })} />} />
      <TextField fullWidth required label={<FieldLabel requirement="required">체크 {index + 1} 내용</FieldLabel>} value={check.label} disabled={disabled} onChange={event => update({ checks: entry.checks.map((value, i) => i === index ? { ...value, label: event.target.value } : value) })} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <Button type="button" disabled={disabled} onClick={() => update({ checks: entry.checks.filter((_, i) => i !== index) })} aria-label={`체크 ${index + 1} 제거`}>제거</Button>
    </Stack>)}
    <Button type="button" variant="outlined" sx={{ alignSelf: "flex-start" }} disabled={disabled || entry.checks.length >= 20} onClick={() => update({ checks: [...entry.checks, { label: "", done: false }] })}>체크 항목 추가</Button>
  </Stack>;
}

export default function TeamPreparationEditor({ initialSheet, initialHistory, defaultDate, projectName }: Props) {
  const [sheet, setSheet] = useState(initialSheet), [draft, setDraft] = useState(initialSheet.document), [history, setHistory] = useState(initialHistory);
  const [editing, setEditing] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [invalidRow, setInvalidRow] = useState<string | null>(null);
  const busy = useRef(false), controller = useRef<AbortController | null>(null), attempt = useRef<{ body: string; key: string } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(sheet.document);
  const endpoint = `/api/projects/${sheet.projectId}/teams/${sheet.teamId}/preparation`;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function updateEntry(id: string, patch: Partial<PreparationEntry>) { setDraft(value => ({ ...value, entries: value.entries.map(entry => entry.id === id ? { ...entry, ...patch } as PreparationEntry : entry) })); setInvalidRow(null); setSuccess(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    setError(""); setSuccess(""); setInvalidRow(null);
    let document: PreparationDocument;
    try { document = normalizePreparationDocument(draft, sheet.kind); }
    catch {
      const row = draft.entries.find(entry => { try { normalizePreparationDocument({ ...draft, entries: [entry] }, sheet.kind); return false; } catch { return true; } });
      setInvalidRow(row?.id ?? null); setError(row ? "표시된 항목의 필수값·날짜·수량·체크 내용을 확인해 주세요." : "준비표는 50개 항목, 64KiB 이내로 작성해 주세요."); return;
    }
    const body = JSON.stringify({ version: sheet.version, document });
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    const active = new AbortController(); controller.current = active; busy.current = true; setPending(true);
    const timeout = setTimeout(() => active.abort(), 30_000);
    try {
      const response = await fetch(endpoint, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: sheet.version, mutationKey: attempt.current.key, document }), signal: active.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "준비표를 저장하지 못했습니다.");
      setSheet(result.sheet); setDraft(result.sheet.document); setEditing(false); attempt.current = null; setSuccess("팀 준비표를 저장했습니다.");
      setHistory(value => [{ version: result.sheet.version, changedAt: result.sheet.updatedAt, changedBy: result.sheet.updatedBy }, ...value.filter(item => item.version !== result.sheet.version)].slice(0, 10));
    } catch (failure) { setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "연결을 확인하지 못했습니다. 입력은 유지되었습니다. 같은 내용으로 다시 저장하거나 최신 준비표를 확인해 주세요."); }
    finally { clearTimeout(timeout); busy.current = false; setPending(false); controller.current = null; }
  }
  async function reload() {
    if (busy.current || (dirty && !window.confirm("저장하지 않은 입력을 버리고 최신 준비표를 불러올까요?"))) return;
    busy.current = true; setPending(true); setError(""); setSuccess("");
    const active = new AbortController(); controller.current = active; const timeout = setTimeout(() => active.abort(), 30_000);
    try { const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: active.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "준비표를 불러오지 못했습니다."); setSheet(result.sheet); setDraft(result.sheet.document); setHistory(result.history); setEditing(false); setInvalidRow(null); attempt.current = null; }
    catch (failure) { setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "최신 준비표를 불러오지 못했습니다. 입력은 유지되었습니다."); }
    finally { clearTimeout(timeout); controller.current = null; busy.current = false; setPending(false); }
  }
  return <Stack data-testid="team-preparation" spacing={3} sx={{ minWidth: 0, overflowWrap: "anywhere", "& .MuiInputBase-root": { minWidth: 0 }, "& .MuiChip-root": { maxWidth: "100%", height: "auto" }, "& .MuiChip-label": { whiteSpace: "normal" } }}>
    <Stack spacing={1}><Typography component="h1" variant="h4">{sheet.teamName} 준비표</Typography><Typography>{projectName} · {activityKindLabels[sheet.kind]}</Typography><Typography color="text.secondary">{sheet.version ? `저장 v${sheet.version} · ${sheet.updatedAt ? formatAppDateTime(new Date(sheet.updatedAt)) : ""}` : "아직 저장된 준비표가 없습니다."}</Typography><Button href={`/projects/${sheet.projectId}/teams`} sx={{ alignSelf: "flex-start" }}>팀 준비표 목록으로</Button></Stack>
    <Alert severity="info">팀 활동에 필요한 일정과 준비만 기록하세요. 건강정보·아동 등 대상자의 개별 개인정보는 입력하지 않습니다. 준비표 저장은 WBS 업무의 완료 상태를 변경하지 않습니다.</Alert>
    {!sheet.canEdit ? <Alert severity="info">읽기 전용입니다. 편집은 현재 팀장 또는 이 프로젝트 관리자에게 요청하세요.</Alert> : null}
    {error ? <Alert severity="error" role="alert">{error}</Alert> : null}{success ? <Alert severity="success" role="status">{success}</Alert> : null}
    <Box component="form" onSubmit={save} aria-busy={pending}><Stack spacing={2}>
      {!draft.entries.length ? <Paper sx={{ p: 3 }}><Typography>준비 항목이 없습니다.{sheet.canEdit ? " 편집을 눌러 첫 항목을 추가하세요." : " 팀장에게 준비표 작성을 요청하세요."}</Typography></Paper> : null}
      {draft.entries.map((entry, index) => <Paper component="section" key={entry.id} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0, border: invalidRow === entry.id ? "2px solid" : "1px solid", borderColor: invalidRow === entry.id ? "error.main" : "divider" }} aria-describedby={invalidRow === entry.id ? `entry-error-${entry.id}` : undefined}>
        <Stack spacing={2}>{editing ? <><Typography component="h2" variant="h6">준비 항목 {index + 1}</Typography><EntryFields entry={entry} kind={sheet.kind} disabled={pending} update={patch => updateEntry(entry.id, patch)} />{invalidRow === entry.id ? <Typography id={`entry-error-${entry.id}`} color="error">날짜·제목·필수값과 입력 범위를 확인해 주세요.</Typography> : null}<Button type="button" color="error" disabled={pending} sx={{ alignSelf: "flex-end" }} onClick={() => { if (window.confirm("이 항목을 현재 준비표에서 제거할까요? 이전 저장 버전의 이력은 보존됩니다.")) setDraft(value => ({ ...value, entries: value.entries.filter(item => item.id !== entry.id) })); }}>항목 제거</Button></> : <EntrySummary entry={entry} kind={sheet.kind} quantity={sheet.mealQuantities[entry.id]} />}</Stack>
      </Paper>)}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {editing ? <><Button type="button" variant="outlined" disabled={pending || draft.entries.length >= PREPARATION_MAX_ENTRIES} onClick={() => setDraft(value => ({ ...value, entries: [...value.entries, createPreparationEntry(sheet.kind, defaultDate)] }))}>준비 항목 추가 · {draft.entries.length}/{PREPARATION_MAX_ENTRIES}</Button><Button type="submit" variant="contained" disabled={pending}>{pending ? "저장 중…" : "준비표 저장"}</Button><Button type="button" disabled={pending} onClick={() => { if (!dirty || window.confirm("저장하지 않은 입력을 취소할까요?")) { setDraft(sheet.document); setEditing(false); setError(""); setInvalidRow(null); attempt.current = null; } }}>편집 취소</Button></> : sheet.canEdit ? <Button type="button" variant="contained" onClick={() => { setEditing(true); setSuccess(""); }}>준비표 편집</Button> : null}
        <Button type="button" disabled={pending} onClick={reload}>최신 준비표 불러오기</Button>
      </Stack>
    </Stack></Box>
    <details><summary>최근 저장 이력 · 최대 10개</summary><Box component="ul" sx={{ pl: 3 }}>{history.map(item => <li key={item.version}>v{item.version} · {formatAppDateTime(new Date(item.changedAt))} · 저장자 #{item.changedBy}</li>)}</Box>{!history.length ? <Typography>저장 이력이 없습니다.</Typography> : null}<Typography variant="body2" color="text.secondary">이전 저장 내용은 보존됩니다. 자동 복원·영구 삭제 기능은 제공하지 않습니다.</Typography></details>
  </Stack>;
}
