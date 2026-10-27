import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { getPortalIdentity } from "@/src/features/project-portal/index.server";
import { listProjectPortals } from "@/src/entities/project-presentation/index.server";
export const dynamic = "force-dynamic";
export default async function ProjectDirectory() {
  const viewer = await getPortalIdentity("/projects"), projects = await listProjectPortals(viewer);
  return <Container component="main" sx={{ py: { xs: 3, md: 5 }, minWidth: 0 }}><Stack spacing={3}>
    <Typography component="h1" variant="h3" sx={{ fontSize: { xs: "2rem", md: "2.7rem" } }}>내 프로젝트</Typography><Typography>프로젝트를 선택하면 전용 홈과 팀 메뉴가 열립니다. 현재 소속된 프로젝트만 표시되며 슈퍼관리자는 전체를 관리합니다.</Typography>
    {!projects.length ? <Alert severity="info">현재 소속된 프로젝트가 없습니다. 슈퍼관리자에게 프로젝트 참여를 요청하세요. 기존 WBS에서 허용된 자료는 기존 작업 메뉴로 확인할 수 있습니다.</Alert> : null}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>{projects.map(project => <Paper key={project.id} variant="outlined" sx={{ p: 3, minWidth: 0 }}><Stack spacing={2}><Chip label={project.projectType === "volunteering" ? "봉사활동" : "업무 협업"} sx={{ alignSelf: "flex-start" }} /><Typography component="h2" variant="h5" sx={{ overflowWrap: "anywhere" }}>{project.name}</Typography><Button component="a" href={`/projects/${project.id}`} variant="contained" sx={{ minHeight: 44 }}>프로젝트 홈으로</Button></Stack></Paper>)}</Box>
    <Typography variant="caption">최대 100개 프로젝트를 표시합니다.</Typography><Button component="a" href="/tasks" sx={{ alignSelf: "flex-start" }}>기존 WBS 작업 목록</Button>
  </Stack></Container>;
}
