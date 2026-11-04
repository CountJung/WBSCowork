"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import type { PollList, ProjectPoll } from "@/src/entities/project-vote";
import FieldLabel from "@/src/shared/ui/field-label";
import { formatAppDateTime } from "@/src/shared/lib/date";
import { votingKstToIso } from "../model/datetime";

const phaseLabel = { scheduled: "예정", open: "투표 중", closed: "마감" } as const;
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  let result: T & { message?: string };
  try { result = await response.json(); }
  catch { throw new Error("서버 응답을 읽지 못했습니다. 입력을 보관했으니 목록에서 저장 결과를 먼저 확인해 주세요."); }
  if (!response.ok) throw new Error(result.message ?? "요청을 처리하지 못했습니다. 현재 프로젝트 소속과 투표 기간을 확인해 주세요.");
  return result;
}
function ErrorNotice({ message }: { message: string }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) node.current?.focus(); }, [message]);
  return message ? <Alert severity="error" tabIndex={-1} ref={node}>{message}</Alert> : null;
}
function PollCard({ poll, canVote, projectId, updated }: { poll: ProjectPoll; canVote: boolean; projectId: number; updated: (poll: ProjectPoll) => void }) {
  const [draft, setDraft] = useState({ saved: poll.ownChoice, choice: poll.ownChoice === null ? "" : String(poll.ownChoice) });
  const choice = draft.saved === poll.ownChoice ? draft.choice : poll.ownChoice === null ? "" : String(poll.ownChoice);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const busy = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function vote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !choice) return;
    busy.current = true; setPending(true); setError(""); setSuccess("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = await request<{ poll: ProjectPoll }>(`/api/projects/${projectId}/votes/${poll.id}/ballot`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: Number(choice) }), signal: abort.signal });
      if (!abort.signal.aborted) { updated(result.poll); setSuccess("선택을 저장했습니다. 마감 전에는 다시 선택해 저장할 수 있습니다."); }
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "투표하지 못했습니다. 선택을 보관했으니 현재 결과를 먼저 확인해 주세요."); }
    finally { busy.current = false; if (!abort.signal.aborted) setPending(false); }
  }
  const titleId = `poll-${poll.id}-title`, helpId = `poll-${poll.id}-help`;
  return <Paper component="article" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }} aria-labelledby={titleId} data-testid={`project-poll-${poll.id}`}>
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Chip size="small" label={phaseLabel[poll.phase]} color={poll.phase === "open" ? "primary" : "default"} sx={{ alignSelf: "flex-start" }} />
        <Typography component="h2" variant="h6" id={titleId}>{poll.title}</Typography>
        {poll.description ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{poll.description}</Typography> : null}
        <Typography variant="body2">시작: {formatAppDateTime(new Date(poll.startsAt))}<br />마감: {formatAppDateTime(new Date(poll.endsAt))}</Typography>
      </Stack>
      {poll.phase === "open" && canVote ? <Stack component="form" spacing={2} onSubmit={vote} aria-busy={pending}>
        <Box component="fieldset" disabled={pending} sx={{ m: 0, p: 0, border: 0, minWidth: 0 }} aria-describedby={helpId}>
          <Typography component="legend" sx={{ fontWeight: 700 }}><FieldLabel requirement="required">선택지 하나</FieldLabel></Typography>
          <RadioGroup name={`poll-${poll.id}-option`} value={choice} onChange={event => { setDraft({ saved: poll.ownChoice, choice: event.target.value }); setSuccess(""); }}>
            {poll.options.map(option => <FormControlLabel key={option.id} value={String(option.id)} control={<Radio required />} label={option.label} sx={{ minHeight: 44, my: 0.25, mr: 0, "& .MuiFormControlLabel-label": { minWidth: 0, overflowWrap: "anywhere" } }} />)}
          </RadioGroup>
          <Typography id={helpId} variant="body2">{poll.ownChoice === null ? "아직 저장한 선택이 없습니다." : "이미 저장한 선택이 있습니다. 다른 항목을 골라 저장하면 이전 선택이 바뀝니다."} 결과와 참여 수는 마감 후 표시합니다.</Typography>
        </Box>
        <Button type="submit" variant="contained" disabled={pending || !choice} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>{pending ? "저장 중…" : poll.ownChoice === null ? "투표 저장" : "선택 변경 저장"}</Button>
      </Stack> : <>
        {poll.phase !== "closed" ? <Typography variant="body2">{poll.phase === "scheduled" ? "투표 시작 전입니다. 시작 시각 이후 목록을 새로 확인해 주세요." : "현재 프로젝트 구성원만 투표할 수 있습니다. 슈퍼관리자도 소속 배정 없이 투표하지 않습니다."} 결과는 마감 후 공개합니다.</Typography> : null}
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{poll.options.map(option => <Typography component="li" key={option.id} sx={{ py: 0.5 }}>{option.label}</Typography>)}</Box>
      </>}
      {poll.phase === "closed" && poll.results !== null && poll.totalVotes !== null ? <Stack spacing={1} component="section" aria-label="마감된 투표 결과">
        <Typography component="h3" variant="subtitle1">익명 집계 결과 · 총 {poll.totalVotes}표</Typography>
        {poll.options.map(option => {
          const count = poll.results?.find(result => result.optionId === option.id)?.count ?? 0;
          return <Box key={option.id}><Typography>{option.label}: {count}표 ({poll.totalVotes ? Math.round(count / poll.totalVotes * 100) : 0}%)</Typography><Box aria-hidden="true" sx={{ height: 8, borderRadius: 1, bgcolor: "action.hover", mt: 0.5 }}><Box sx={{ height: "100%", borderRadius: 1, bgcolor: "primary.main", width: `${poll.totalVotes ? count / poll.totalVotes * 100 : 0}%` }} /></Box></Box>;
        })}
      </Stack> : poll.phase === "closed" ? <Typography>결과를 불러오려면 목록을 다시 확인해 주세요.</Typography> : null}
      <ErrorNotice message={error} />
      {success ? <Alert severity="success">{success}</Alert> : null}
    </Stack>
  </Paper>;
}
function CreatePoll({ projectId, created }: { projectId: number; created: (poll: ProjectPoll) => void }) {
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [options, setOptions] = useState("");
  const [startsAt, setStartsAt] = useState(""), [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const busy = useRef(false), controller = useRef<AbortController | null>(null), attempt = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    setError(""); setSuccess("");
    let payload: { title: string; description: string; startsAt: string; endsAt: string; options: string[] };
    try {
      const normalizedOptions = options.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      if (normalizedOptions.length < 2 || normalizedOptions.length > 10) throw new Error("선택지는 한 줄에 하나씩, 2개에서 10개까지 입력해 주세요.");
      if (new Set(normalizedOptions).size !== normalizedOptions.length) throw new Error("같은 선택지가 두 번 들어 있습니다. 서로 다른 선택지를 입력해 주세요.");
      payload = { title, description, startsAt: votingKstToIso(startsAt), endsAt: votingKstToIso(endsAt), options: normalizedOptions };
      if (payload.endsAt <= payload.startsAt) throw new Error("마감 시각은 시작 시각보다 늦어야 합니다.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "입력한 기간과 선택지를 확인해 주세요."); return; }
    const signature = JSON.stringify(payload);
    if (attempt.current?.payload !== signature) attempt.current = { payload: signature, key: crypto.randomUUID() };
    busy.current = true; setPending(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = await request<{ poll: ProjectPoll }>(`/api/projects/${projectId}/votes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, mutationKey: attempt.current.key }), signal: abort.signal });
      if (!abort.signal.aborted) { created(result.poll); setTitle(""); setDescription(""); setOptions(""); setStartsAt(""); setEndsAt(""); attempt.current = null; setSuccess("안건을 등록했습니다. 목록에서 기간과 선택지를 확인하세요."); }
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "등록하지 못했습니다. 입력을 보관했으니 목록에서 등록 결과를 먼저 확인해 주세요."); }
    finally { busy.current = false; if (!abort.signal.aborted) setPending(false); }
  }
  return <Paper component="details" variant="outlined" sx={{ minWidth: 0 }}>
    <Box component="summary" sx={{ p: 2, minHeight: 44, cursor: "pointer", fontWeight: 700 }}>새 투표 안건 등록 · 지정 관리자/슈퍼관리자</Box>
    <Stack component="form" onSubmit={create} spacing={2} aria-busy={pending} sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
      <Typography>등록 후에는 안건·선택지·기간을 수정하거나 삭제할 수 없습니다. 입력 내용을 확인해 주세요.</Typography>
      <TextField label={<FieldLabel requirement="required">안건 제목</FieldLabel>} required fullWidth value={title} onChange={event => setTitle(event.target.value)} disabled={pending} slotProps={{ htmlInput: { maxLength: 160 } }} />
      <TextField label={<FieldLabel>안건 설명</FieldLabel>} multiline minRows={3} fullWidth value={description} onChange={event => setDescription(event.target.value)} disabled={pending} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      <TextField label={<FieldLabel requirement="required">선택지 · 한 줄에 하나</FieldLabel>} required multiline minRows={3} fullWidth value={options} onChange={event => setOptions(event.target.value)} disabled={pending} helperText="서로 다른 선택지 2~10개, 한 선택지는 120자 이내로 입력하세요." slotProps={{ htmlInput: { maxLength: 1210 } }} />
      <Typography variant="body2">아래 날짜와 시각은 모두 한국 표준시(KST, UTC+9)입니다. 마감 시각부터 투표를 받지 않고 결과를 공개합니다.</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
        <TextField type="datetime-local" label={<FieldLabel requirement="required">시작 시각 · KST</FieldLabel>} required fullWidth value={startsAt} onChange={event => setStartsAt(event.target.value)} disabled={pending} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="datetime-local" label={<FieldLabel requirement="required">마감 시각 · KST</FieldLabel>} required fullWidth value={endsAt} onChange={event => setEndsAt(event.target.value)} disabled={pending} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <ErrorNotice message={error} />{success ? <Alert severity="success">{success}</Alert> : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button type="submit" variant="contained" disabled={pending}>{pending ? "등록 중…" : "안건 등록"}</Button>
        <Button type="button" disabled={pending} onClick={() => { if ((!title && !description && !options && !startsAt && !endsAt) || window.confirm("저장하지 않은 안건 입력을 비울까요?")) { setTitle(""); setDescription(""); setOptions(""); setStartsAt(""); setEndsAt(""); setError(""); setSuccess(""); attempt.current = null; } }}>입력 취소</Button>
      </Stack>
    </Stack>
  </Paper>;
}
export default function ProjectVoting({ projectId, initial }: { projectId: number; initial: PollList }) {
  const [list, setList] = useState(initial), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load(after = 0) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); const abort = new AbortController(); controller.current = abort;
    try {
      const result = await request<PollList>(`/api/projects/${projectId}/votes?after=${after}`, { signal: abort.signal });
      if (!abort.signal.aborted) setList(previous => ({ ...result, polls: after ? [...previous.polls, ...result.polls.filter(poll => !previous.polls.some(existing => existing.id === poll.id))] : result.polls }));
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "목록을 불러오지 못했습니다. 현재 프로젝트 소속을 확인해 주세요."); }
    finally { busy.current = false; if (!abort.signal.aborted) setPending(false); }
  }
  function updated(poll: ProjectPoll) { setList(previous => ({ ...previous, polls: previous.polls.map(existing => existing.id === poll.id ? poll : existing) })); }
  return <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", "& .MuiFormControl-root, & .MuiInputBase-root": { minWidth: 0, maxWidth: "100%" }, "& input, & textarea": { minWidth: 0 }, "& .MuiButton-root": { minHeight: 44, maxWidth: "100%", whiteSpace: "normal" }, "& h1": { fontSize: { xs: "1.65rem", sm: "2.125rem" } } }} data-testid="project-voting">
    <Stack spacing={1}><Typography component="h1" variant="h4">프로젝트 투표</Typography><Typography>한 안건에 선택지 하나를 고릅니다. 투표 기간에는 선택을 바꿀 수 있고, 마감 후 프로젝트 구성원이 결과를 확인합니다.</Typography></Stack>
    <Alert severity="info">결과 화면은 이름과 개별 선택을 공개하지 않는 익명 집계입니다. 중복 투표 방지와 선택 변경을 위해 서버에는 계정별 선택을 저장합니다. 결과와 참여 수는 관리자에게도 마감 전 공개하지 않습니다.</Alert>
    {list.canManage ? <CreatePoll projectId={projectId} created={poll => setList(previous => ({ ...previous, polls: [poll, ...previous.polls.filter(existing => existing.id !== poll.id)] }))} /> : null}
    {!list.canVote ? <Typography>현재 계정은 투표권이 있는 프로젝트 구성원이 아닙니다. 관리 권한만으로 투표권이 추가되지는 않습니다.</Typography> : null}
    <Stack spacing={1}><Button onClick={() => void load()} disabled={pending} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>투표 목록·현재 상태 다시 확인</Button><Typography variant="caption">시작·마감 시각이 지났다면 목록을 다시 확인하세요. 실제 접수 여부는 서버 시각과 현재 프로젝트 소속으로 판정합니다.</Typography></Stack>
    <ErrorNotice message={error} />
    {pending ? <Typography role="status">투표 목록을 불러오는 중입니다.</Typography> : null}
    {!list.polls.length ? <Typography>등록된 투표 안건이 없습니다.</Typography> : null}
    {list.polls.map(poll => <PollCard key={poll.id} poll={poll} projectId={projectId} canVote={list.canVote} updated={updated} />)}
    {list.nextCursor !== null ? <Button onClick={() => void load(list.nextCursor ?? 0)} disabled={pending}>투표 더 보기</Button> : null}
  </Stack>;
}
