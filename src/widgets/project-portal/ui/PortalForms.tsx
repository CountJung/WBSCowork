"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { PortalAudience, PortalSettings } from "@/src/entities/project-presentation/index.server";

type Payload = Record<string, unknown>;
function usePortalSave(url: string, version: number) {
  const router = useRouter(), [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const running = useRef(false), attempt = useRef<{ body: string; token: string } | null>(null);
  async function save(data: Payload) {
    if (running.current) return;
    running.current = true; setPending(true); setMessage(""); setError("");
    const body = JSON.stringify({ ...data, version });
    if (attempt.current?.body !== body) attempt.current = { body, token: crypto.randomUUID() };
    try {
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, version, mutationKey: attempt.current.token }) });
      if (!response.ok) throw new Error(response.status === 409 ? "다른 변경이 먼저 저장되었습니다. 입력을 보관한 뒤 최신 내용을 다시 확인하세요." : "요청 실패");
      attempt.current = null; setMessage("저장했습니다. 다시 불러온 표시와 공개 범위를 확인하세요."); router.refresh();
    } catch (cause) { setError(cause instanceof Error && cause.message.startsWith("다른 변경") ? cause.message : "저장하지 못했거나 결과를 확인할 수 없습니다. 입력을 보관한 뒤 현재 권한·버전·공개 범위를 확인하고 다시 시도하세요."); }
    finally { running.current = false; setPending(false); }
  }
  return { pending, message, error, save };
}
export function PortalSettingsEditor({ projectId, settings, volunteering }: { projectId: number; settings: PortalSettings; volunteering: boolean }) {
  const [title, setTitle] = useState(settings.title), [intro, setIntro] = useState(settings.intro), [layout, setLayout] = useState(settings.layout);
  const state = usePortalSave(`/api/projects/${projectId}/presentation`, settings.version);
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack component="form" spacing={2} onSubmit={event => { event.preventDefault(); void state.save({ title, intro, layout }); }}>
    <Typography component="h1" variant="h4">프로젝트 화면 설정</Typography><Typography>이 프로젝트의 홈 제목·소개와 화면 유형을 설정합니다. 계정 권한이나 기존 WBS 자료는 바꾸지 않습니다.</Typography>
    <TextField label="홈 제목 · 필수" required value={title} onChange={event => setTitle(event.target.value)} disabled={state.pending} slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
    <TextField label="프로젝트 소개 · 선택" multiline minRows={4} value={intro} onChange={event => setIntro(event.target.value)} disabled={state.pending} slotProps={{ htmlInput: { maxLength: 2000 } }} fullWidth />
    <TextField select label="프로젝트 화면 유형 · 필수" value={layout} onChange={event => setLayout(event.target.value as PortalSettings["layout"])} disabled={state.pending}><MenuItem value="workspace">업무 협업형</MenuItem>{volunteering ? <MenuItem value="volunteer_presentation">봉사활동 프레젠테이션형</MenuItem> : null}</TextField>
    {state.error ? <Alert severity="error">{state.error}</Alert> : null}{state.message ? <Alert severity="success">{state.message}</Alert> : null}
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Button type="submit" variant="contained" disabled={state.pending}>{state.pending ? "저장 중…" : "홈 설정 저장"}</Button><Button component="a" href={`/projects/${projectId}`} disabled={state.pending} onClick={event => { const dirty = title !== settings.title || intro !== settings.intro || layout !== settings.layout; if (dirty && !window.confirm("저장하지 않은 홈 설정을 버리고 돌아갈까요?")) event.preventDefault(); }}>취소하고 프로젝트 홈으로</Button></Stack>
  </Stack></Paper>;
}
export function TeamPublicationEditor({ projectId, teamId, version, currentAudience, preparationVersion }: { projectId: number; teamId: number; version: number; currentAudience: PortalAudience; preparationVersion: number }) {
  const [audience, setAudience] = useState(currentAudience), state = usePortalSave(`/api/projects/${projectId}/presentation/teams/${teamId}`, version);
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack component="form" spacing={2} onSubmit={event => { event.preventDefault(); void state.save({ audience, preparationVersion }); }}>
    <Typography component="h2" variant="h6">프레젠테이션 공개 범위</Typography><Alert severity="info">‘프로젝트 구성원 공개’는 인터넷 공개가 아닙니다. 준비표 v{preparationVersion}의 저장된 내용을 명시적으로 공유합니다. 이후 편집한 내용은 다시 공유하기 전까지 자동 반영되지 않습니다.</Alert>
    <TextField select label="공개 범위 · 필수" value={audience} onChange={event => setAudience(event.target.value as PortalAudience)} disabled={state.pending}><MenuItem value="team_private">팀 비공개 · 현재 팀과 지정 관리자</MenuItem><MenuItem value="project">프로젝트 구성원 공개</MenuItem></TextField>
    {!preparationVersion ? <Alert severity="warning">먼저 준비표 편집에서 내용을 저장해 주세요.</Alert> : null}
    {state.error ? <Alert severity="error">{state.error}</Alert> : null}{state.message ? <Alert severity="success">{state.message}</Alert> : null}
    <Button type="submit" variant="contained" disabled={state.pending || preparationVersion < 1} sx={{ alignSelf: "flex-start" }}>{state.pending ? "저장 중…" : "선택한 버전과 공개 범위 저장"}</Button>
  </Stack></Paper>;
}
