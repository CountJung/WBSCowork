import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getRuntimeEnv } from "@/lib/env";
import { listAllProjects } from "@/lib/repositories/project-repository";
import { formatDate } from "@/lib/task-view";
import { canAccessAdminPanel } from "@/models/user";
import type { Project } from "@/models/project";
import {
  createProjectAdminAction,
  deleteProjectAdminAction,
  updateProjectAdminAction,
} from "./actions";

export const dynamic = "force-dynamic";

type AdminProjectsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ProjectCreateForm({
  defaultStartDate,
  defaultEndDate,
}: {
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
      <Stack component="form" action={createProjectAdminAction} spacing={2}>
        <Typography variant="h5">새 프로젝트 만들기</Typography>
        <Typography variant="body2" color="text.secondary">
          프로젝트를 생성하면 /tasks 작업 공간에서 해당 프로젝트의 WBS 작업을 관리할 수 있습니다.
        </Typography>
        <TextField name="name" label="프로젝트 이름" required />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            name="startDate"
            label="시작일"
            type="date"
            defaultValue={defaultStartDate}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            name="endDate"
            label="종료일"
            type="date"
            defaultValue={defaultEndDate}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button type="submit" variant="contained">
            프로젝트 생성
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ProjectEditCard({ project }: { project: Project }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{project.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              기간 {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
            </Typography>
          </Stack>
          <Stack component="form" action={deleteProjectAdminAction} spacing={1} sx={{ maxWidth: 360 }}>
            <input type="hidden" name="projectId" value={String(project.id)} />
            <FormControlLabel
              control={<Checkbox name="confirmDestruction" value="yes" required size="small" />}
              label="종료 후 관련 DB 데이터와 첨부파일을 영구 파기합니다."
              sx={{ alignItems: "flex-start", m: 0 }}
            />
            <Button type="submit" color="error" size="small" variant="outlined">
              종료 및 파기
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack component="form" action={updateProjectAdminAction} spacing={2}>
          <input type="hidden" name="projectId" value={String(project.id)} />
          <TextField name="name" label="프로젝트 이름" defaultValue={project.name} required />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              name="startDate"
              label="시작일"
              type="date"
              defaultValue={formatDate(project.startDate)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              name="endDate"
              label="종료일"
              type="date"
              defaultValue={formatDate(project.endDate)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button type="submit" variant="contained">
              저장
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default async function AdminProjectsPage({ searchParams }: AdminProjectsPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin/projects"));
  }

  if (!canAccessAdminPanel(session.user.role, session.user.isSuperuser)) {
    redirect("/");
  }

  const runtimeEnv = getRuntimeEnv();
  const params = await searchParams;
  const feedbackStatus = getSingleParam(params.status);
  const feedbackMessage = getSingleParam(params.message);

  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">프로젝트 관리</Typography>
          <Alert severity="warning">
            DB env가 완전하지 않아 프로젝트 데이터를 불러올 수 없습니다.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const databaseStatus = await getDatabaseAdminStatus();
  const projectsTableReady =
    databaseStatus.databaseExists &&
    databaseStatus.tables.some((t) => t.name === "projects" && t.exists);

  if (!projectsTableReady) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">프로젝트 관리</Typography>
          <Alert severity="warning">
            프로젝트 테이블이 아직 준비되지 않았습니다. 먼저 관리자 DB 페이지에서 기본 테이블을 초기화해야 합니다.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const projects = await listAllProjects();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3">프로젝트 관리</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
            프로젝트를 생성하고 수정하거나 삭제합니다. 이 페이지는 관리자 이상만 접근할 수 있습니다.
            프로젝트를 선택하여 /tasks 작업 공간에서 URL 파라미터를 통해 특정 프로젝트로 이동할 수 있습니다.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Chip label={`전체 프로젝트 ${projects.length}`} color="primary" />
          </Stack>
        </Stack>

        {feedbackStatus && feedbackMessage ? (
          <Alert severity={feedbackStatus === "success" ? "success" : "error"}>{feedbackMessage}</Alert>
        ) : null}

        <ProjectCreateForm
          defaultStartDate={today.toISOString().slice(0, 10)}
          defaultEndDate={nextMonth.toISOString().slice(0, 10)}
        />

        {projects.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Typography variant="body2" color="text.secondary">
              아직 생성된 프로젝트가 없습니다. 위 폼에서 첫 프로젝트를 만들어 보세요.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5">프로젝트 목록</Typography>
            {projects.map((project) => (
              <ProjectEditCard key={project.id} project={project} />
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
