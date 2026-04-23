import { Alert, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { getAuthSession } from "@/lib/auth";
import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getRuntimeEnv } from "@/lib/env";
import { listAllProjects } from "@/lib/repositories/project-repository";
import { listTasksByProject } from "@/lib/repositories/task-repository";
import { formatDate, getOrderedTasks, getSelectedProject } from "@/lib/task-view";
import ProjectGanttChart from "@/components/gantt/ProjectGanttChart";
import { getUserRoleLabel } from "@/models/user";

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
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <Chip label={runtimeEnv.auth.googleProviderConfigured ? "Google OAuth 준비됨" : "Google OAuth 환경 변수 필요"} color={runtimeEnv.auth.googleProviderConfigured ? "success" : "warning"} variant="outlined" />
              <Chip label={runtimeEnv.database.configured ? "MariaDB 환경 준비됨" : "MariaDB 환경 변수 필요"} color={runtimeEnv.database.configured ? "success" : "warning"} variant="outlined" />
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
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">홈</Typography>
          <Alert severity="warning">
            DB 환경 변수가 준비되지 않아 프로젝트 개요를 불러올 수 없습니다. 관리자 설정에서 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 먼저 점검해야 합니다.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const databaseStatus = await getDatabaseAdminStatus();
  const projectsTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "projects" && table.exists);
  const tasksTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "tasks" && table.exists);

  if (!projectsTableReady || !tasksTableReady) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">홈</Typography>
          <Alert severity="warning">
            홈 화면에 필요한 프로젝트 또는 작업 테이블이 아직 준비되지 않았습니다. 먼저 관리자 DB 페이지에서 기본 테이블을 초기화해야 합니다.
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
  const projects = await listAllProjects();
  const selectedProject = getSelectedProject(projects, projectIdParam);
  const tasks = selectedProject ? await listTasksByProject(selectedProject.id) : [];
  const orderedTasks = getOrderedTasks(tasks);

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1}>
            <Typography variant="h3">홈</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              선택한 프로젝트의 일정과 핵심 작업을 빠르게 확인하는 요약 화면입니다. 세부 수정과 제출 관리는 작업 공간에서 계속할 수 있습니다.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Chip label={`현재 권한 ${getUserRoleLabel(session.user.role, session.user.isSuperuser)}`} color="primary" variant="outlined" />
            <Chip label={`프로젝트 ${projects.length}`} color="primary" />
            <Chip label={`작업 ${orderedTasks.length}`} />
          </Stack>
        </Stack>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <Stack spacing={0.5}>
                <Typography variant="h5">프로젝트 선택</Typography>
                <Typography variant="body2" color="text.secondary">
                  홈에서는 선택한 프로젝트의 간트와 간략한 작업 목록만 보여줍니다. 세부 수정은 상단 앱바의 작업 메뉴에서 진행합니다.
                </Typography>
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
              {projects.length > 0 ? (
                projects.map((project) => {
                  const active = selectedProject?.id === project.id;

                  return (
                    <Button key={project.id} href={`/?projectId=${project.id}`} variant={active ? "contained" : "outlined"}>
                      {project.name}
                    </Button>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  아직 생성된 프로젝트가 없습니다. 작업 공간에서 첫 프로젝트를 만들 수 있습니다.
                </Typography>
              )}
            </Stack>
          </Stack>
        </Paper>

        {selectedProject ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1}>
              <Typography variant="h5">선택된 프로젝트</Typography>
              <Typography variant="h6">{selectedProject.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                기간 {formatDate(selectedProject.startDate)} ~ {formatDate(selectedProject.endDate)}
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {selectedProject ? <ProjectGanttChart project={selectedProject} tasks={orderedTasks} /> : null}

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5">업무 목록</Typography>
            {orderedTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                선택한 프로젝트에 아직 작업이 없습니다.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {orderedTasks.map((task) => (
                  <Paper
                    key={task.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      ml: { xs: 0, md: task.depth * 2 },
                      borderLeft: "3px solid",
                      borderColor: "primary.main",
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle1">{task.title}</Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(task.startDate)} ~ {formatDate(task.endDate)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          담당자 {task.assigneeName ?? "미지정"}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {task.description || "설명이 아직 입력되지 않았습니다."}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}