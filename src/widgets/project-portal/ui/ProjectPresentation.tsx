import { Alert, Button, Chip, Paper, Stack, Typography, Box } from "@mui/material";
import type { PortalTeam } from "@/src/entities/project-presentation/index.server";
import type { TeamPresentationView } from "@/src/features/project-presentation/index.server";
import type { PreparationEntry, RecreationPreparationEntry } from "@/src/entities/team-preparation";
import { RecreationTimetable } from "@/src/features/recreation-timetable";
import { activityKindLabels } from "@/src/shared/config/activity-kinds";
import { formatDate } from "@/src/shared/lib/date";

export function PortalTeamCards({ projectId, teams }: { projectId: number; teams: PortalTeam[] }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>{teams.map(team => <Paper key={team.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, overflowWrap: "anywhere", "& .MuiChip-root": { maxWidth: "100%", height: "auto" }, "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }}><Stack spacing={1.5}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip size="small" label={activityKindLabels[team.kind]} /><Chip size="small" variant="outlined" label={team.audience === "project" ? "프로젝트 구성원 공개" : "팀 비공개"} /></Stack>
    <Typography component="h2" variant="h6">{team.name}</Typography>
    {team.kind === "media" ? <Button component="a" href={`/projects/${projectId}/media?teamId=${team.id}`} sx={{ alignSelf: "flex-start", minHeight: 44 }}>사진첩·영상 열기</Button> : team.canRead ? <Button component="a" href={`/projects/${projectId}/activities/${team.id}`} sx={{ alignSelf: "flex-start", minHeight: 44 }}>{team.kind === "meal" ? "식단표" : team.kind === "recreation" ? "프로그램 시간표" : "팀 활동"} 보기</Button> : <Typography variant="body2" color="text.secondary">팀 비공개입니다. 현재 이 팀의 참여자와 지정 관리자만 볼 수 있습니다.</Typography>}
  </Stack></Paper>)}</Box>;
}
function PresentationExtra({ entry, quantity }: { entry: PreparationEntry; quantity?: number }) {
  return <>
    {"meal" in entry ? <>
      {entry.expectedPeople !== null ? <Typography>예상 {entry.expectedPeople}명</Typography> : null}
      {entry.amountPerPerson !== null ? <Typography>1인 기준 {entry.amountPerPerson} {entry.unit}</Typography> : entry.unit ? <Typography>단위: {entry.unit}</Typography> : null}
      <Typography>준비 수량: {typeof quantity === "number" && Number.isFinite(quantity) ? `${quantity} ${entry.unit}` : "미입력"}</Typography>
    </> : null}
    {"durationMinutes" in entry ? <Typography>소요 {entry.durationMinutes}분</Typography> : null}
    {"materials" in entry && entry.materials ? <Typography sx={{ whiteSpace: "pre-wrap" }}>준비물·자재: {entry.materials}</Typography> : null}
    {"tools" in entry && entry.tools ? <Typography>도구: {entry.tools}</Typography> : null}{"role" in entry && entry.role ? <Typography>담당 역할: {entry.role}</Typography> : null}
    {entry.notes ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{entry.notes}</Typography> : null}
    {entry.checks.length ? <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{entry.checks.map((check, index) => <li key={index}>{check.done ? "완료" : "준비 중"} · {check.label}</li>)}</Box> : null}
  </>;
}
export function TeamPresentationContent({ presentation, preview = false }: { presentation: TeamPresentationView; preview?: boolean }) {
  const { document, team, mealQuantities } = presentation;
  const entries = [...(document?.entries ?? [])].sort((a, b) => a.date.localeCompare(b.date) || ("order" in a && "order" in b ? a.order - b.order : 0));
  const shown = preview ? entries.slice(0, 3) : entries;
  return <Stack spacing={2} sx={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", "& .MuiChip-root": { maxWidth: "100%", height: "auto" }, "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 }, "& li": { overflowWrap: "anywhere" }, "& summary": { minHeight: 44, py: 1, cursor: "pointer" } }} data-testid={`team-presentation-${team.id}`}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip size="small" label={activityKindLabels[team.kind]} /><Chip size="small" color={presentation.published ? "primary" : "default"} label={presentation.published ? `구성원 공유 · v${presentation.sourceVersion}` : "팀 비공개 · 현재 준비표"} /></Stack>
    {!shown.length && (team.kind !== "recreation" || preview) ? <Alert severity="info">아직 표시할 준비 항목이 없습니다. 해당 팀장이나 지정 관리자가 준비표에서 내용을 저장할 수 있습니다.</Alert> : null}
    {team.kind === "recreation" && !preview ? <RecreationTimetable entries={entries.filter((entry): entry is RecreationPreparationEntry => "order" in entry && "durationMinutes" in entry)} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} /> : shown.map(entry => <Paper key={entry.id} variant="outlined" component="section" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}><Stack spacing={1}>
      <Typography variant="overline">{formatDate(new Date(entry.date))}{"meal" in entry && entry.meal ? ` · ${({ breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" })[entry.meal]}` : ""}{"time" in entry && entry.time ? ` · ${entry.time}` : ""}{"order" in entry ? ` · 순서 ${entry.order}` : ""}</Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography component={preview ? "h3" : "h2"} variant="h6">{entry.title}</Typography>{team.kind === "meal" ? <Chip size="small" label={{ planned: "준비전", in_progress: "진행", done: "완료" }[entry.status]} color={entry.status === "done" ? "success" : "default"} /> : null}</Stack>
      {team.kind === "meal" ? <details><summary>상세 정보 · 선택</summary><Stack spacing={1} sx={{ pt: 1 }}><PresentationExtra entry={entry} quantity={mealQuantities[entry.id]} /></Stack></details> : <PresentationExtra entry={entry} quantity={mealQuantities[entry.id]} />}
    </Stack></Paper>)}
    {preview && entries.length > shown.length ? <Typography variant="body2">일부 {shown.length}개 항목을 표시합니다. 상세에서 전체를 확인하세요.</Typography> : null}
  </Stack>;
}
