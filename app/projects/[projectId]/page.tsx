import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { listPortalTeams } from "@/src/entities/project-presentation/index.server";
import { getTeamPresentation } from "@/src/features/project-presentation/index.server";
import { PortalTeamCards, TeamPresentationContent } from "@/src/widgets/project-portal";
import { formatDate } from "@/src/shared/lib/date";
export const dynamic = "force-dynamic";
export default async function ProjectHome({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params, { portal, viewer } = await getPortalPageContext(projectId);
  const teams = portal.project.projectType === "volunteering" ? await listPortalTeams(viewer, portal.project.id) : [];
  const shared = portal.settings.layout === "volunteer_presentation" ? teams.filter(team => team.canRead && team.audience === "project" && team.kind !== "media").slice(0, 6) : [];
  const presentations = await Promise.all(shared.map(team => getTeamPresentation(viewer, portal.project.id, team.id)));
  return <Stack spacing={3}>
    <Paper component="header" variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, background: "linear-gradient(125deg, rgba(20,120,120,.12), rgba(75,105,190,.08))", minWidth: 0 }}><Stack spacing={2}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip label={portal.settings.layout === "volunteer_presentation" ? "봉사활동 프레젠테이션" : "프로젝트 작업 공간"} /><Chip variant="outlined" label="프로젝트 내부 공간 · 로그인과 소속 필요" /></Stack>
      <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "1.9rem", md: "2.8rem" } }}>{portal.settings.title}</Typography>
      <Typography sx={{ whiteSpace: "pre-wrap", maxWidth: "75ch", lineHeight: 1.8 }}>{portal.settings.intro || portal.project.goal || "함께할 활동과 준비 내용을 팀별로 확인하세요."}</Typography>
      <Typography color="text.secondary">{formatDate(new Date(portal.project.startDate))} ~ {formatDate(new Date(portal.project.endDate))}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button component="a" href={`/tasks?projectId=${projectId}`} variant="contained">기존 WBS 업무 열기</Button>{portal.project.projectType === "volunteering" ? <Button component="a" href={`/projects/${projectId}/activities`} variant="outlined">팀별 식단·활동 일정</Button> : null}</Stack>
    </Stack></Paper>
    {portal.project.projectType === "volunteering" ? <>
      <Stack spacing={2}><Typography component="h2" variant="h5">함께 준비하는 팀</Typography>{teams.length ? <PortalTeamCards projectId={portal.project.id} teams={teams.slice(0, 8)} /> : <Alert severity="info">아직 활동팀이 없습니다. 지정 관리자가 프로젝트 관리에서 팀과 팀장 한 명을 구성할 수 있습니다.</Alert>}<Button component="a" href={`/projects/${projectId}/activities`} sx={{ alignSelf: "flex-start" }}>전체 팀과 준비 내용</Button></Stack>
      <Stack spacing={2}><Typography component="h2" variant="h5">프로젝트 구성원에게 공유한 활동</Typography><Typography color="text.secondary">팀장이 명시적으로 공유한 저장 버전만 표시됩니다. 기존 비공개 준비표가 자동 공개되지 않습니다.</Typography>{!presentations.length ? <Alert severity="info">공유한 식단·활동 일정이 아직 없습니다. 내 팀의 비공개 준비표는 팀 메뉴에서 확인하세요.</Alert> : null}{presentations.map(presentation => <Box component="section" key={presentation.team.id}><Typography component="h3" variant="h6" sx={{ mb: 1 }}>{presentation.team.name}</Typography><TeamPresentationContent presentation={presentation} preview /><Button component="a" href={`/projects/${projectId}/activities/${presentation.team.id}`}>전체 내용 보기</Button></Box>)}</Stack>
    </> : <Alert severity="info">업무 협업 프로젝트입니다. 기존 WBS에서 업무·담당자·제출물·댓글을 관리합니다.</Alert>}
  </Stack>;
}
