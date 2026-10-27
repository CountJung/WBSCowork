"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { mediaMimeTypes, type MediaFields, type MediaTeam, type ProjectMediaItem } from "@/src/entities/project-media";
import FieldLabel from "@/src/shared/ui/field-label";
import { formatAppDateTime } from "@/src/shared/lib/date";

export type ProjectMediaGalleryProps = { projectId: number; teams: MediaTeam[]; initialItems?: ProjectMediaItem[]; initialTeamId?: number; initialNextAfter?: number | null };
async function readResult(response: Response) {
  let value: { message?: string; item?: ProjectMediaItem; items?: ProjectMediaItem[]; nextAfter?: number | null };
  try { value = await response.json(); } catch { throw new Error("서버 응답을 읽지 못했습니다. 입력을 보관하고 목록을 다시 확인해 주세요."); }
  if (!response.ok) throw new Error(value.message ?? "현재 권한과 저장 결과를 다시 확인해 주세요.");
  return value;
}
const visibilityLabel = { team_private: "비공개 · 작성자·현재 팀·지정 관리자", project: "프로젝트 구성원 공개" };
function Visibility({ value, disabled, change }: { value: MediaFields["visibility"]; disabled: boolean; change: (value: MediaFields["visibility"]) => void }) {
  return <TextField select fullWidth required label={<FieldLabel requirement="required">공개 범위</FieldLabel>} value={value} disabled={disabled} onChange={event => change(event.target.value as MediaFields["visibility"])} helperText="프로젝트 구성원 공개도 인터넷 전체 공개가 아닙니다. 개인 얼굴·이름·민감정보의 공유 허용 여부를 먼저 확인하세요."><MenuItem sx={{ whiteSpace: "normal", overflowWrap: "anywhere", minHeight: 44 }} value="team_private">{visibilityLabel.team_private}</MenuItem><MenuItem sx={{ whiteSpace: "normal", overflowWrap: "anywhere", minHeight: 44 }} value="project">{visibilityLabel.project}</MenuItem></TextField>;
}
function MediaCard({ item, saved }: { item: ProjectMediaItem; saved: () => void }) {
  const [editing, setEditing] = useState(false), [fields, setFields] = useState<MediaFields>({ title: item.title, caption: item.caption, visibility: item.visibility });
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [mediaFailed, setMediaFailed] = useState(false);
  const busy = useRef(false), controller = useRef<AbortController | null>(null), attempt = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const payload = JSON.stringify({ ...fields, version: item.version });
    if (attempt.current?.body !== payload) attempt.current = { body: payload, key: crypto.randomUUID() };
    busy.current = true; setPending(true); setError(""); const abort = new AbortController(); controller.current = abort;
    try {
      await readResult(await fetch(item.fileUrl.replace(/\/file$/, ""), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, version: item.version, mutationKey: attempt.current.key }), signal: abort.signal, cache: "no-store" }));
      if (!abort.signal.aborted) { setEditing(false); saved(); }
    } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "저장하지 못했습니다. 초안을 보관하고 다시 확인해 주세요."); }
    finally { busy.current = false; if (!abort.signal.aborted) setPending(false); }
  }
  const dirty = fields.title !== item.title || fields.caption !== item.caption || fields.visibility !== item.visibility;
  return <Paper component="article" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, overflowWrap: "anywhere" }} data-testid={`project-media-${item.id}`}><Stack spacing={2}>
    <Stack spacing={1}><Typography component="h3" variant="h6">{item.title}</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip size="small" label={visibilityLabel[item.visibility]} sx={{ height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }} /><Typography variant="caption">{item.teamName} · v{item.version} · {formatAppDateTime(new Date(item.updatedAt))}</Typography></Stack></Stack>
    {item.mimeType.startsWith("image/") ? <Box component="img" src={item.fileUrl} alt={item.title} loading="lazy" onError={() => setMediaFailed(true)} sx={{ display: mediaFailed ? "none" : "block", width: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 1 }} /> : <Box component="video" src={item.fileUrl} controls preload="metadata" playsInline onError={() => setMediaFailed(true)} sx={{ display: "block", minWidth: 0, width: "100%", height: "auto", maxHeight: 480, bgcolor: "black", borderRadius: 1 }} />}
    {mediaFailed ? <Alert severity="warning">파일을 표시하지 못했습니다. 현재 접근 권한이나 브라우저 지원 형식을 확인하고 원본 다운로드를 이용하세요.</Alert> : null}
    {item.caption ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{item.caption}</Typography> : null}
    <Typography variant="caption" color="text.secondary">{item.fileName} · {(item.sizeBytes / 1024 / 1024).toFixed(2)} MiB</Typography>
    <Button component="a" href={`${item.fileUrl}?download=1`} sx={{ alignSelf: "flex-start", minHeight: 44 }}>원본 다운로드</Button>
    {editing ? <Stack component="form" onSubmit={save} spacing={2}>
      <TextField label={<FieldLabel requirement="required">제목</FieldLabel>} value={fields.title} required fullWidth disabled={pending} onChange={event => setFields(value => ({ ...value, title: event.target.value }))} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField label={<FieldLabel>설명</FieldLabel>} value={fields.caption} multiline minRows={3} fullWidth disabled={pending} onChange={event => setFields(value => ({ ...value, caption: event.target.value }))} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      <Visibility value={fields.visibility} disabled={pending} change={visibility => setFields(value => ({ ...value, visibility }))} />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction={{ xs: "column", sm: "row" }} useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}><Button type="submit" variant="contained" disabled={pending}>{pending ? "저장 중…" : "설명·공개 범위 저장"}</Button><Button type="button" disabled={pending} onClick={() => { if (!dirty || window.confirm("저장하지 않은 설명 변경을 취소할까요?")) { setFields({ title: item.title, caption: item.caption, visibility: item.visibility }); setEditing(false); setError(""); } }}>편집 취소</Button></Stack>
    </Stack> : item.canEdit ? <Button onClick={() => setEditing(true)} variant="outlined" sx={{ alignSelf: "flex-start", minHeight: 44 }}>설명·공개 범위 편집</Button> : null}
  </Stack></Paper>;
}

export default function ProjectMediaGallery({ projectId, teams, initialItems = [], initialTeamId, initialNextAfter = null }: ProjectMediaGalleryProps) {
  const [teamId, setTeamId] = useState(initialTeamId ?? teams[0]?.id ?? 0), [items, setItems] = useState(initialItems), [after, setAfter] = useState(initialNextAfter);
  const [title, setTitle] = useState(""), [caption, setCaption] = useState(""), [visibility, setVisibility] = useState<MediaFields["visibility"]>("team_private"), [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(teams.length > 0), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const uploadBusy = useRef(false), listController = useRef<AbortController | null>(null), uploadController = useRef<AbortController | null>(null), fileInput = useRef<HTMLInputElement | null>(null), attempt = useRef<{ body: string; key: string } | null>(null), mounted = useRef(true);
  const team = teams.find(value => value.id === teamId), endpoint = `/api/projects/${projectId}/teams/${teamId}/media`;
  const dirty = title !== "" || caption !== "" || file !== null || visibility !== "team_private";
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; listController.current?.abort(); uploadController.current?.abort(); }; }, []);
  useEffect(() => { if (!dirty) return; const handler = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]);
  async function load(cursor = 0) {
    if (!teamId) return;
    listController.current?.abort(); const abort = new AbortController(); listController.current = abort; setLoading(true); setError("");
    try { const value = await readResult(await fetch(`${endpoint}?after=${cursor}`, { cache: "no-store", signal: abort.signal })); if (!abort.signal.aborted) { setItems(previous => cursor ? [...previous, ...(value.items ?? [])] : value.items ?? []); setAfter(value.nextAfter ?? null); } }
    catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다."); }
    finally { if (!abort.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    if (!teamId) return;
    const abort = new AbortController(); listController.current?.abort(); listController.current = abort;
    void fetch(`/api/projects/${projectId}/teams/${teamId}/media`, { cache: "no-store", signal: abort.signal }).then(readResult).then(value => { if (!abort.signal.aborted) { setItems(value.items ?? []); setAfter(value.nextAfter ?? null); setError(""); } }).catch(error => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다."); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [projectId, teamId]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (uploadBusy.current || !file || !team?.canUpload) return;
    const signature = JSON.stringify({ teamId, title, caption, visibility, name: file.name, bytes: file.size, modified: file.lastModified });
    if (attempt.current?.body !== signature) attempt.current = { body: signature, key: crypto.randomUUID() };
    const form = new FormData(); form.set("file", file); form.set("title", title); form.set("caption", caption); form.set("visibility", visibility); form.set("mutationKey", attempt.current.key);
    uploadBusy.current = true; setPending(true); setError(""); setSuccess(""); const abort = new AbortController(); uploadController.current = abort;
    try { await readResult(await fetch(endpoint, { method: "POST", body: form, signal: abort.signal, cache: "no-store" })); if (!abort.signal.aborted) { setTitle(""); setCaption(""); setVisibility("team_private"); setFile(null); attempt.current = null; if (fileInput.current) fileInput.current.value = ""; setSuccess("미디어를 저장했습니다. 새로고침 후에도 목록과 공개 범위를 확인하세요."); await load(); } }
    catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "전송하지 못했습니다. 입력과 선택 파일을 보관했습니다. 저장 결과를 먼저 확인해 주세요."); }
    finally { uploadBusy.current = false; if (mounted.current && !abort.signal.aborted) setPending(false); }
  }
  return <Stack spacing={3} sx={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", "& .MuiFormControl-root, & .MuiInputBase-root": { minWidth: 0, maxWidth: "100%" }, "& input, & textarea": { minWidth: 0 }, "& .MuiSelect-select": { whiteSpace: "normal", overflowWrap: "anywhere" }, "& .MuiButton-root": { minHeight: 44, maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" }, "& .MuiChip-root": { maxWidth: "100%" }, "& h1": { fontSize: { xs: "1.65rem", sm: "2.125rem" } } }} data-testid="project-media-gallery">
    <Stack spacing={1}><Typography component="h1" variant="h4">사진첩·영상</Typography><Typography>미디어팀이 사진과 영상을 정리합니다. 프로젝트 내부 공개와 비공개를 구분하며 인터넷 전체에 공개하지 않습니다.</Typography></Stack>
    <Alert severity="info">비공개는 작성자·현재 해당 팀원·지정 프로젝트 관리자·슈퍼관리자가 읽습니다. 모든 요청에서 현재 프로젝트 소속을 다시 검사하며 소속 해제 후 과거 링크도 차단됩니다. 실제 인물의 사진·영상은 게시 동의를 확인하고 건강정보·아동 개별정보를 적지 마세요.</Alert>
    {!teams.length ? <Typography>등록된 미디어팀이 없습니다. 해당 프로젝트 관리자에게 미디어팀 구성을 요청하세요.</Typography> : <TextField select label={<FieldLabel requirement="required">미디어팀</FieldLabel>} value={teamId} disabled={pending} onChange={event => { if (!dirty || window.confirm("현재 업로드 초안을 보관한 뒤 다른 팀으로 이동할까요? 선택하면 초안을 비웁니다.")) { setLoading(true); setError(""); setTeamId(Number(event.target.value)); setTitle(""); setCaption(""); setVisibility("team_private"); setFile(null); setItems([]); setAfter(null); setSuccess(""); attempt.current = null; if (fileInput.current) fileInput.current.value = ""; } }} fullWidth>{teams.map(value => <MenuItem sx={{ whiteSpace: "normal", overflowWrap: "anywhere", minHeight: 44 }} key={value.id} value={value.id}>{value.name}{value.canUpload ? " · 편집 가능" : " · 읽기"}</MenuItem>)}</TextField>}
    {team?.canUpload ? <Paper component="form" variant="outlined" onSubmit={upload} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}><Stack spacing={2}>
      <Typography component="h2" variant="h6">사진·영상 올리기</Typography><TextField label={<FieldLabel requirement="required">제목</FieldLabel>} value={title} onChange={event => setTitle(event.target.value)} required fullWidth disabled={pending} slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField label={<FieldLabel>설명</FieldLabel>} value={caption} onChange={event => setCaption(event.target.value)} multiline minRows={3} disabled={pending} fullWidth slotProps={{ htmlInput: { maxLength: 2000 } }} />
      <Visibility value={visibility} disabled={pending} change={setVisibility} />
      <Stack spacing={1}><Typography component="label" htmlFor="project-media-file">파일 · 필수</Typography><Box component="input" id="project-media-file" ref={fileInput} type="file" accept={mediaMimeTypes.join(",")} required disabled={pending} onChange={event => { setFile(event.currentTarget.files?.[0] ?? null); attempt.current = null; }} sx={{ display: "block", width: "100%", minWidth: 0, maxWidth: "100%", minHeight: 44, font: "inherit", "&::file-selector-button": { minHeight: 44, mr: 1, font: "inherit" } }} /><Typography variant="body2">PNG·JPEG·WebP 사진 8MiB / MP4·WebM 영상 20MiB 이하, 한 번에 파일 1개입니다. 사이트 한도가 더 작으면 그 한도를 따릅니다.</Typography>{file ? <Typography>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MiB</Typography> : null}</Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Button type="submit" variant="contained" disabled={pending || !file}>{pending ? "업로드 중…" : "미디어 저장"}</Button><Button type="button" disabled={pending} onClick={() => { if (!dirty || window.confirm("저장하지 않은 업로드 초안을 비울까요?")) { setTitle(""); setCaption(""); setVisibility("team_private"); setFile(null); if (fileInput.current) fileInput.current.value = ""; attempt.current = null; setError(""); } }}>입력 취소</Button></Stack>
    </Stack></Paper> : null}
    {error ? <Alert severity="error">{error}</Alert> : null}{success ? <Alert severity="success">{success}</Alert> : null}
    {teamId ? <Button onClick={() => void load()} disabled={loading || pending} sx={{ alignSelf: "flex-start", minHeight: 44 }}>현재 팀 목록 다시 확인</Button> : null}
    {loading ? <Typography role="status">미디어 목록을 불러오는 중입니다.</Typography> : !items.length && teamId ? <Typography>현재 읽을 수 있는 미디어가 없습니다.</Typography> : null}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>{items.map(value => <MediaCard key={`${value.id}:${value.version}`} item={value} saved={() => void load()} />)}</Box>
    {after ? <Button onClick={() => void load(after)} disabled={loading || pending}>이전 미디어 더 보기</Button> : null}
  </Stack>;
}
