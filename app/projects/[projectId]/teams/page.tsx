import { Alert, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { notFound, redirect } from "next/navigation";
import { getSignInPath } from "@/src/entities/user/index.server";
import { getProjectByIdForViewer } from "@/src/entities/project/index.server";
import { listTeamPreparations, PreparationError } from "@/src/entities/team-preparation/index.server";
import { getPreparationViewer, preparationId, PreparationRequestError } from "@/src/features/team-preparation/index.server";
import { activityKindLabels } from "@/src/shared/config/activity-kinds";
import { formatAppDateTime } from "@/src/shared/lib/date";

export const dynamic = "force-dynamic";
export default async function TeamPreparationsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ after?: string | string[] }> }) {
  const { projectId } = await params;
  let viewer: Awaited<ReturnType<typeof getPreparationViewer>>;
  try { viewer = await getPreparationViewer(); } catch (error) {
    if (error instanceof PreparationRequestError && error.status === 401) redirect(getSignInPath(`/projects/${projectId}/teams`));
    if (error instanceof PreparationRequestError && error.status === 404) notFound();
    throw error;
  }
  let id: number;
  try { id = preparationId(projectId); } catch { notFound(); }
  const project = await getProjectByIdForViewer(id, viewer);
  if (!project || project.projectType !== "volunteering") notFound();
  const after = (await searchParams).after;
  let afterTeamId = 0;
  if (after !== undefined) { if (typeof after !== "string") notFound(); try { afterTeamId = preparationId(after); } catch { notFound(); } }
  let teams: Awaited<ReturnType<typeof listTeamPreparations>> = [], unavailable = false;
  try { teams = await listTeamPreparations(viewer, id, afterTeamId); }
  catch (error) { if (!(error instanceof PreparationError) || error.status !== 503) throw error; unavailable = true; }
  return <Container component="main" sx={{ py: 3, minWidth: 0, overflowWrap: "anywhere" }}><Stack spacing={3}>
    <Stack spacing={1}><Typography component="h1" variant="h4">{project.name} · 팀 준비표</Typography><Typography>팀별 일정과 준비 상태를 요약합니다. 상세를 열어 메뉴·자재·활동 순서와 준비 체크를 확인하세요.</Typography><Button href={`/tasks?projectId=${id}`} sx={{ alignSelf: "flex-start" }}>프로젝트로 돌아가기</Button></Stack>
    <Alert severity="info">현재 참여 중인 팀의 준비표를 볼 수 있습니다. 편집은 해당 팀장과 지정 프로젝트 관리자·슈퍼관리자에게 허용됩니다.</Alert>
    {unavailable ? <Alert severity="warning">준비표 저장소를 사용할 수 없습니다. 필요한 추가 마이그레이션 적용 여부를 관리자에게 확인해 주세요.</Alert> : !teams.length ? <Typography>조회할 수 있는 활동팀이 없습니다. 프로젝트 관리자에게 팀 참여를 확인해 주세요.</Typography> : null}
    {teams.map(team => <Paper key={team.teamId} component="section" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}><Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography component="h2" variant="h6">{team.teamName}</Typography><Chip size="small" label={activityKindLabels[team.kind]} /><Chip size="small" label={team.canEdit ? "편집 가능" : "읽기 전용"} /></Stack>
      <Typography>준비 항목 {team.entryCount} · 완료 {team.completedCount}</Typography><Typography color="text.secondary">{team.updatedAt ? `v${team.version} · ${formatAppDateTime(new Date(team.updatedAt))}` : "아직 저장하지 않았습니다."}</Typography>
      <Button href={`/projects/${id}/teams/${team.teamId}/preparation`} variant="outlined" sx={{ alignSelf: "flex-start" }}>준비표 상세</Button>
    </Stack></Paper>)}
    {!unavailable ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Typography color="text.secondary">한 페이지에 최대 100개 팀을 표시합니다.</Typography>{afterTeamId ? <Button href={`/projects/${id}/teams`}>처음 팀 목록</Button> : null}{teams.length === 100 ? <Button href={`/projects/${id}/teams?after=${teams[teams.length - 1].teamId}`}>다음 팀 목록</Button> : null}</Stack> : null}
  </Stack></Container>;
}
