import { Alert, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { getAuthSession, getUserByEmail } from "@/src/entities/user/index.server";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { listAllProjectsForViewer } from "@/src/entities/project/index.server";
import { listTasksByProjectForViewer } from "@/src/entities/task/index.server";
import { getOrderedTasks } from "@/src/entities/task";
import { getSelectedProject } from "@/src/entities/project";
import { formatDate } from "@/src/shared/lib/date";
import ProjectGanttChart from "@/src/widgets/project-gantt";
import {TaskSummaryCard} from "@/src/widgets/task-workspace";
import {notFound} from "next/navigation";
import { getUserRoleLabel } from "@/src/entities/user";

type HomePageProps = {
  searchParams: Promise<{
    projectId?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomePageProps) {
  const runtimeEnv = getRuntimeEnv();
  const session = await getAuthSession();

  if (!session?.user) {
    return (
      <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <Chip label={runtimeEnv.auth.googleProviderConfigured ? "Google OAuth 준비됨" : "Google OAuth 환경 변수 필요"} color={runtimeEnv.auth.googleProviderConfigured ? "success" : "warning"} variant="outlined" />
              <Chip label={runtimeEnv.database.configured ? "데이터베이스 연결 준비됨" : "데이터베이스 설정 필요"} color={runtimeEnv.database.configured ? "success" : "warning"} variant="outlined" />
            </Stack>
            <Typography variant="h3">{runtimeEnv.appName}</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              프로젝트별 업무 간트와 작업 목록을 한 화면에서 확인하는 WBS 작업 공간입니다. 로그인하면 현재 프로젝트의 일정과 작업 흐름, 제출 현황을 바로 확인할 수 있습니다.
            </Typography>
          </Stack>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">시작하기</Typography>
              <Typography variant="body2" color="text.secondary">
                상단 앱바의 Google 로그인으로 세션을 시작한 뒤, 앱바의 작업 메뉴에서 프로젝트 작업 공간으로 이동하세요.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    );
  }

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">홈</Typography>
          <Alert severity="warning">
            DB 환경 변수가 준비되지 않아 프로젝트 개요를 불러올 수 없습니다. 관리자 설정에서 데이터베이스 연결과 배포 migration 상태를 먼저 점검해야 합니다.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const databaseStatus = await getDatabaseAdminStatus();
  const projectsTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "projects" && table.exists && table.missingColumns.length === 0);
  const tasksTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "tasks" && table.exists && table.missingColumns.length === 0);

  if (!projectsTableReady || !tasksTableReady) {
    return (
      <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">홈</Typography>
          <Alert severity="warning">
            홈 화면에 필요한 프로젝트 또는 작업 테이블이 아직 준비되지 않았습니다. 관리자 DB 페이지에서 테이블과 배포 migration 상태를 확인해 주세요.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            관리자와 작업 화면 이동은 상단 앱바를 사용합니다.
          </Typography>
        </Stack>
      </Container>
    );
  }

  const params = await searchParams;
  const projectIdParam = getSingleSearchParam(params.projectId);
  const currentUser=session.user.email?await getUserByEmail(session.user.email):null;
  const viewer={userId:currentUser?.id??null,email:session.user.email,isSuperuser:!!session.user.isSuperuser};
  const projects = await listAllProjectsForViewer(viewer);
  if(projectIdParam&&!projects.some(project=>String(project.id)===projectIdParam))notFound();
  const selectedProject = getSelectedProject(projects, projectIdParam);
  const tasks = selectedProject ? await listTasksByProjectForViewer(selectedProject.id,viewer) : [];
  const orderedTasks = getOrderedTasks(tasks);

  return <Container component="main" sx={{py:{xs:3,md:5},minWidth:0,overflowWrap:'anywhere','& .MuiChip-root':{maxWidth:'100%',height:'auto'},'& .MuiChip-label':{whiteSpace:'normal',overflowWrap:'anywhere',py:0.5}}}>
    <Stack spacing={3}>
      <Stack spacing={1}><Typography component="h1" variant="h4">프로젝트</Typography><Typography color="text.secondary">프로젝트의 목표와 일정을 확인하고, 업무와 제출 상세로 이어집니다.</Typography><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Chip size="small" label={`현재 권한 ${getUserRoleLabel(session.user.role,session.user.isSuperuser)}`} variant="outlined"/><Chip size="small" label={`프로젝트 ${projects.length}`} variant="outlined"/></Stack></Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}} aria-label="프로젝트 선택">{projects.map(project=><Button key={project.id} href={`/?projectId=${project.id}`} variant={project.id===selectedProject?.id?'contained':'outlined'} aria-current={project.id===selectedProject?.id?'page':undefined} sx={{textAlign:'left',overflowWrap:'anywhere',maxWidth:'100%'}}>{project.name}</Button>)}</Stack>
      {selectedProject?<>
        <Paper component="section" elevation={0} data-testid="project-overview" sx={{p:{xs:2,sm:3},borderRadius:3,minWidth:0}}><Stack spacing={1.5}>
          <Typography component="h2" variant="h5">{selectedProject.name}</Typography><Stack direction="row" spacing={0.75} useFlexGap sx={{flexWrap:'wrap'}}><Chip size="small" variant="outlined" label={selectedProject.projectType==='volunteering'?'봉사활동':'업무 협업'}/><Chip size="small" variant="outlined" label={`업무 ${orderedTasks.length} · 하위 포함`}/></Stack>
          <Typography sx={{whiteSpace:'pre-wrap'}}>목표: {selectedProject.goal||'목표를 정리하고 첫 업무를 추가해 보세요.'}</Typography><Typography variant="body2" color="text.secondary">{formatDate(selectedProject.startDate)} ~ {formatDate(selectedProject.endDate)}</Typography>
          <Button href={`/tasks?projectId=${selectedProject.id}`} variant="contained" sx={{alignSelf:'flex-start'}}>프로젝트 작업 공간</Button>
        </Stack></Paper>
        <ProjectGanttChart project={selectedProject} tasks={orderedTasks}/>
        <Stack component="section" spacing={1.5} aria-label="프로젝트 업무 요약"><Typography component="h2" variant="h6">업무 요약</Typography>{orderedTasks.length?orderedTasks.map(task=><TaskSummaryCard key={task.id} task={task} href={`/tasks?projectId=${selectedProject.id}&taskId=${task.id}#task-${task.id}`} childCount={orderedTasks.filter(child=>child.parentId===task.id).length}/>):<Paper elevation={0} sx={{p:3,borderRadius:3}}><Typography color="text.secondary">아직 업무가 없습니다. 프로젝트 작업 공간에서 첫 업무를 추가하세요.</Typography></Paper>}</Stack>
      </>:<Paper elevation={0} sx={{p:3,borderRadius:3}}><Typography color="text.secondary">표시할 프로젝트가 없습니다. 관리자에게 프로젝트 참여나 생성을 요청하세요.</Typography></Paper>}
    </Stack>
  </Container>;
}
