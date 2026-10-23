import {
  Alert,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import FieldLabel from "@/src/shared/ui/field-label";
import ConfirmationCheckbox from "@/src/shared/ui/confirmation-checkbox";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath,getUserByEmail,listAllUsers } from "@/src/entities/user/index.server";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { listManagedProjectsForViewer,getProjectWorkspace,previewProjectAccess } from "@/src/entities/project/index.server";
import {ProjectWorkspaceAdmin} from "@/src/widgets/project-workspace";
import type {ProjectWorkspace,ProjectAccessPreview} from "@/src/entities/project";
import type {User} from "@/src/entities/user";
import { formatDate } from "@/src/shared/lib/date";
import { canAccessAdminPanel } from "@/src/entities/user";
import type { Project } from "@/src/entities/project";
import {
  createProjectAdminAction,
  deleteProjectAdminAction,
  updateProjectAdminAction,
  changeProjectWorkspaceAction,
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
        <TextField name="name" label={<FieldLabel requirement="required">프로젝트 이름</FieldLabel>} required />
        <TextField select name="projectType" label="프로젝트 유형" defaultValue="collaboration"><MenuItem value="collaboration">업무 협업</MenuItem><MenuItem value="volunteering">봉사활동</MenuItem></TextField>
        <TextField name="goal" label={<FieldLabel>주제의 목표</FieldLabel>} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <TextField name="successCriteria" label={<FieldLabel>프로젝트 성공 기준</FieldLabel>} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            name="startDate"
            label={<FieldLabel requirement="required">시작일</FieldLabel>}
            type="date"
            defaultValue={defaultStartDate}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            name="endDate"
            label={<FieldLabel requirement="required">종료일</FieldLabel>}
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

function ProjectEditCard({ project,workspace,users,accessPreview }: { project: Project;workspace:ProjectWorkspace;users:User[];accessPreview:ProjectAccessPreview|null }) {
  return (
    <Paper data-testid={`project-card-${project.id}`} elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{project.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              기간 {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
            </Typography>
          </Stack>

        </Stack>

        <Divider />

        <Stack component="form" action={updateProjectAdminAction} spacing={2}>
          <input type="hidden" name="projectId" value={String(project.id)} />
          <TextField name="name" label={<FieldLabel requirement="required">프로젝트 이름</FieldLabel>} defaultValue={project.name} required />
          <TextField name="goal" label={<FieldLabel>주제의 목표</FieldLabel>} defaultValue={project.goal} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <TextField name="successCriteria" label={<FieldLabel>프로젝트 성공 기준</FieldLabel>} defaultValue={project.successCriteria} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              name="startDate"
              label={<FieldLabel requirement="required">시작일</FieldLabel>}
              type="date"
              defaultValue={formatDate(project.startDate)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              name="endDate"
              label={<FieldLabel requirement="required">종료일</FieldLabel>}
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
        <ProjectWorkspaceAdmin workspace={workspace} users={users} accessPreview={accessPreview} action={changeProjectWorkspaceAction}/>
        <details><summary>프로젝트 종료 및 영구 파기…</summary>
          <Stack component="form" action={deleteProjectAdminAction} spacing={1} sx={{ maxWidth: 360 }}>
            <input type="hidden" name="projectId" value={String(project.id)} />
            <ConfirmationCheckbox
              name="confirmDestruction" value="yes" required size="small"
              label="종료 후 관련 DB 데이터와 첨부파일을 영구 파기합니다."
              sx={{ alignItems: "flex-start", m: 0 }}
            />
            <Button type="submit" color="error" size="small" variant="outlined">
              종료 및 파기
            </Button>
          </Stack>
        </details>
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
      <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
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
    ["projects","project_members","activity_teams","activity_team_members","activity_team_leaders","project_workspace_events"].every(name=>databaseStatus.tables.some((t) => t.name === name && t.exists && t.missingColumns.length === 0));

  if (!projectsTableReady) {
    return (
      <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">프로젝트 관리</Typography>
          <Alert severity="warning">
            프로젝트 테이블이 아직 준비되지 않았습니다. 관리자 DB 페이지에서 테이블과 배포 migration 상태를 확인해 주세요.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const currentUser=await getUserByEmail(session.user.email??"");
  if(!currentUser)redirect(getSignInPath('/admin/projects'));
  const isCurrentSuperuser=!!session.user.isSuperuser&&currentUser.email.toLowerCase()===runtimeEnv.auth.superuserEmail;
  if(!canAccessAdminPanel(currentUser.role,isCurrentSuperuser))redirect('/');
  const actor={userId:currentUser.id,isSuperuser:isCurrentSuperuser};
  const projects=await listManagedProjectsForViewer({...actor,email:currentUser.email});
  const [workspaces,accessPreviews,allUsers]=await Promise.all([
    Promise.all(projects.map(p=>getProjectWorkspace(p.id,actor))),
    Promise.all(projects.map(p=>isCurrentSuperuser?previewProjectAccess(p.id,actor):null)),
    listAllUsers(),
  ]);
  const memberIds=new Set(workspaces.flatMap(workspace=>workspace.members.filter(member=>member.active).map(member=>member.userId)));
  const users=isCurrentSuperuser?allUsers:allUsers.filter(user=>memberIds.has(user.id));

  return (
    <Container component="main" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3">프로젝트 관리</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
            프로젝트를 생성하고 수정하거나 삭제합니다. 일반 관리자는 슈퍼관리자가 지정한 프로젝트만 관리합니다.
            프로젝트를 선택하여 /tasks 작업 공간에서 URL 파라미터를 통해 특정 프로젝트로 이동할 수 있습니다.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Chip label={`전체 프로젝트 ${projects.length}`} color="primary" />
          </Stack>
        </Stack>

        {feedbackStatus && feedbackMessage ? (
          <Alert severity={feedbackStatus === "success" ? "success" : "error"}>{feedbackMessage}</Alert>
        ) : null}

        {isCurrentSuperuser?<ProjectCreateForm
          defaultStartDate={today.toISOString().slice(0, 10)}
          defaultEndDate={nextMonth.toISOString().slice(0, 10)}
        />:null}

        {projects.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {isCurrentSuperuser?"아직 생성된 프로젝트가 없습니다. 위 폼에서 첫 프로젝트를 만들어 보세요.":"관리하도록 지정된 프로젝트가 없습니다. 슈퍼관리자에게 프로젝트 소속 지정을 요청해 주세요."}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5">프로젝트 목록</Typography>
            {projects.map((project,index) => (
              <ProjectEditCard key={project.id} project={project} workspace={workspaces[index]} users={users} accessPreview={accessPreviews[index]}/>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
