import { randomUUID } from "node:crypto";
import {
  Alert,
  Button,
  Chip,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath, listAllUsers } from "@/src/entities/user/index.server";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { listCommentsByProject } from "@/src/entities/comment/index.server";
import { listAttachmentsByProject, listSubmissionsByProject } from "@/src/entities/submission/index.server";
import { listAllProjects } from "@/src/entities/project/index.server";
import { listTasksByProject, listTaskEventsByProject } from "@/src/entities/task/index.server";
import { getOrderedTasks, getSelectedTask, parsePersonalWorkReturnTo } from "@/src/entities/task";
import { getSelectedProject } from "@/src/entities/project";
import { formatDate } from "@/src/shared/lib/date";
import SubmitButton from "@/src/shared/ui/submit-button";
import ProjectGanttChart from "@/src/widgets/project-gantt";
import { TaskCard, TaskFocusController } from "@/src/widgets/task-workspace";
import type { Comment } from "@/src/entities/comment";
import type { Project } from "@/src/entities/project";
import type { SubmissionAttachment, Submission } from "@/src/entities/submission";
import type { Task, TaskEvent } from "@/src/entities/task";
import { canWriteTaskContent, getUserRoleLabel, canManageAllSubmissions, canAccessAdminPanel } from "@/src/entities/user";
import {
  changeTaskStatusAction,
  createCommentAction,
  createSubmissionAction,
  createTaskAction,
  deleteCommentAction,
  deleteSubmissionAction,
  deleteSubmissionAttachmentAction,
  deleteTaskAction,
  updateCommentAction,
  updateSubmissionAction,
  updateTaskAction,
} from "./actions";

export const dynamic = "force-dynamic";

type TasksPageProps = {
  searchParams: Promise<{
    message?: string | string[];
    projectId?: string | string[];
    status?: string | string[];
    taskId?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function groupSubmissionsByTaskId(submissions: Submission[]) {
  const submissionsByTaskId = new Map<number, Submission[]>();

  for (const submission of submissions) {
    const group = submissionsByTaskId.get(submission.taskId) ?? [];

    group.push(submission);
    submissionsByTaskId.set(submission.taskId, group);
  }

  return submissionsByTaskId;
}

function groupCommentsBySubmissionId(comments: Comment[]) {
  const commentsBySubmissionId: Record<number, Comment[]> = {};

  for (const comment of comments) {
    const group = commentsBySubmissionId[comment.submissionId] ?? [];

    group.push(comment);
    commentsBySubmissionId[comment.submissionId] = group;
  }

  return commentsBySubmissionId;
}

function groupAttachmentsBySubmissionId(attachments: SubmissionAttachment[]) {
  const attachmentsBySubmissionId: Record<number, SubmissionAttachment[]> = {};

  for (const attachment of attachments) {
    const group = attachmentsBySubmissionId[attachment.submissionId] ?? [];

    group.push(attachment);
    attachmentsBySubmissionId[attachment.submissionId] = group;
  }

  return attachmentsBySubmissionId;
}

function TaskWritePolicy({ canWrite }: { canWrite: boolean }) {
  return canWrite ? (
    <Alert severity="success">현재 계정은 작업, 제출물, 첨부파일, 댓글을 생성, 수정, 삭제할 수 있습니다. 프로젝트 관리는 관리자 메뉴를 이용하세요.</Alert>
  ) : (
    <Alert severity="info">현재 계정은 게스트 권한이므로 작업, 제출물, 첨부파일, 댓글을 읽기 전용으로만 볼 수 있습니다.</Alert>
  );
}

function TaskCreateForm({
  orderedTasks,
  project,
  users, eligibleUserIds, returnTo,
}: {
  returnTo?:string;
  eligibleUserIds:number[];
  orderedTasks: Task[];
  project: Project;
  users: Awaited<ReturnType<typeof listAllUsers>>;
}) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
      <Stack component="form" action={createTaskAction} spacing={2}>
        <input type="hidden" name="operationToken" value={randomUUID()} />
        <input type="hidden" name="returnTo" value={returnTo??""}/>
        <input type="hidden" name="projectId" value={String(project.id)} />
        <Typography variant="h5">새 작업 추가</Typography>
        <TextField name="title" label="작업 제목" required />
        <TextField name="description" label="설명" multiline minRows={3} />
        <TextField name="deliverable" label="기대 산출물·제출 형식" multiline minRows={2} helperText="예: 조사 자료 링크와 요약 파일. 초안에는 비워 둘 수 있으며 완료 전에 입력합니다." slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <TextField name="definitionOfDone" label="완료 기준" multiline minRows={2} helperText="확인 가능한 결과를 적어 주세요." slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <TextField select name="reviewRequired" label="검토 방식" defaultValue="0"><MenuItem value="0">담당자가 근거를 남기고 완료</MenuItem><MenuItem value="1">검토자 승인 후 완료</MenuItem></TextField>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField select name="parentId" label="상위 작업" defaultValue="" fullWidth>
            <MenuItem value="">루트 작업</MenuItem>
            {orderedTasks.map((task) => (
              <MenuItem key={task.id} value={String(task.id)}>
                {`${"\u00A0".repeat(task.depth * 2)}${task.title}`}
              </MenuItem>
            ))}
          </TextField>
          <TextField select name="assigneeId" label="담당자" defaultValue="" fullWidth>
            <MenuItem value="">미지정</MenuItem>
            {users.filter(user=>eligibleUserIds.includes(user.id)).map((user) => (
              <MenuItem key={user.id} value={String(user.id)}>
                {user.name} · {getUserRoleLabel(user.role)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField name="startDate" label="시작일" type="date" defaultValue={formatDate(project.startDate)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField name="endDate" label="종료일" type="date" defaultValue={formatDate(project.endDate)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <SubmitButton pendingLabel="작업 생성 중…" variant="contained">작업 생성</SubmitButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

function TaskList({
  canWrite,
  canSeeAllSubmissions,
  commentsBySubmissionId,
  attachmentsBySubmissionId,
  orderedTasks,
  project,
  selectedTaskId,
  submissionsByTaskId,
  users, currentUserId, eventsByTaskId, eligibleUserIds, returnTo,
}: {
  returnTo?:string;
  eligibleUserIds:number[];
  currentUserId: number | null;
  eventsByTaskId: Record<number,TaskEvent[]>;
  canWrite: boolean;
  canSeeAllSubmissions: boolean;
  commentsBySubmissionId: Record<number, Comment[]>;
  attachmentsBySubmissionId: Record<number, SubmissionAttachment[]>;
  orderedTasks: Task[];
  project: Project;
  selectedTaskId: number | null;
  submissionsByTaskId: Map<number, Submission[]>;
  users: Awaited<ReturnType<typeof listAllUsers>>;
}) {
  if (orderedTasks.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Typography variant="body2" color="text.secondary">
          아직 등록된 작업이 없습니다. 권한이 있는 계정이면 위 폼에서 첫 번째 작업을 생성할 수 있습니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {orderedTasks.map((task) => {
        const isSelectedTask = selectedTaskId === task.id;

        return (
          <TaskCard
            key={`${task.id}:${task.version}`}
            task={task}
            returnTo={returnTo}
            orderedTasks={orderedTasks}
            projectId={project.id}
            users={users}
            eligibleUserIds={eligibleUserIds}
            isSelectedTask={isSelectedTask}
            canWrite={canWrite}
            currentUserId={currentUserId}
            events={eventsByTaskId[task.id]??[]}
            changeTaskStatusAction={changeTaskStatusAction}
            canSeeAllSubmissions={canSeeAllSubmissions}
            submissions={submissionsByTaskId.get(task.id) ?? []}
            commentsBySubmissionId={commentsBySubmissionId}
            attachmentsBySubmissionId={attachmentsBySubmissionId}
            updateTaskAction={updateTaskAction}
            deleteTaskAction={deleteTaskAction}
            createCommentAction={createCommentAction}
            createSubmissionAction={createSubmissionAction}
            deleteCommentAction={deleteCommentAction}
            deleteSubmissionAction={deleteSubmissionAction}
            deleteAttachmentAction={deleteSubmissionAttachmentAction}
            updateCommentAction={updateCommentAction}
            updateSubmissionAction={updateSubmissionAction}
          />
        );
      })}
    </Stack>
  );
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/tasks"));
  }

  const runtimeEnv = getRuntimeEnv();
  const canWrite = canWriteTaskContent(session.user.role, session.user.isSuperuser);
  const canManageProjects = canAccessAdminPanel(session.user.role, session.user.isSuperuser);
  const canSeeAllSubmissions = canManageAllSubmissions(session.user.role, session.user.isSuperuser);
  const params = await searchParams;
  const feedbackStatus = getSingleSearchParam(params.status);
  const feedbackMessage = getSingleSearchParam(params.message);
  const projectIdParam = getSingleSearchParam(params.projectId);
  const taskIdParam = getSingleSearchParam(params.taskId);
  const returnTo = parsePersonalWorkReturnTo(getSingleSearchParam(params.returnTo)) ?? undefined;

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">작업 관리</Typography>
            {returnTo?<Button href={returnTo} sx={{alignSelf:"flex-start"}}>내 업무로 돌아가기</Button>:null}
          <Alert severity="warning">
            DB env가 완전하지 않아 작업 데이터를 불러올 수 없습니다. 데이터베이스 연결과 배포 migration 상태를 먼저 점검해야 합니다.
          </Alert>
        </Stack>
      </Container>
    );
  }

  const databaseStatus = await getDatabaseAdminStatus();
  const projectsTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "projects" && table.exists && table.missingColumns.length === 0);
  const tasksTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "tasks" && table.exists && table.missingColumns.length === 0);
  const submissionsTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "submissions" && table.exists && table.missingColumns.length === 0);
  const commentsTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "comments" && table.exists && table.missingColumns.length===0);
  const usersTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "users" && table.exists && table.missingColumns.length === 0);

  const taskEventsReady=databaseStatus.tables.some(table=>table.name==="task_events"&&table.exists&&table.missingColumns.length===0);
  const revisionsReady=["submission_revisions","submission_events","submission_attachments"].every(name=>databaseStatus.tables.some(table=>table.name===name&&table.exists&&table.missingColumns.length===0));
  if (!revisionsReady || !taskEventsReady || !projectsTableReady || !tasksTableReady || !submissionsTableReady || !commentsTableReady || !usersTableReady) {
    return (
      <Container component="main" maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">작업 관리</Typography>
            {returnTo?<Button href={returnTo} sx={{alignSelf:"flex-start"}}>내 업무로 돌아가기</Button>:null}
          <Alert severity="warning">
            작업, 제출물, 댓글 관리에 필요한 기본 테이블 또는 확장 컬럼이 아직 준비되지 않았습니다. 먼저 관리자 DB 페이지에서 DB와 기본 테이블을 초기화해야 합니다.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            관리자 관련 이동은 상단 앱바를 사용합니다.
          </Typography>
        </Stack>
      </Container>
    );
  }

  const [projects, users] = await Promise.all([listAllProjects(), listAllUsers()]);
  const eligibleUserIds=users.filter(user=>user.role!=="guest"||user.email.toLowerCase()===runtimeEnv.auth.superuserEmail).map(user=>user.id);
  const selectedProject = getSelectedProject(projects, projectIdParam);

  // 사용자 DB ID 조회 (visibility 필터링에 필요)
  const { getUserByEmail } = await import("@/src/entities/user/index.server");
  const currentDbUser = session.user.email ? await getUserByEmail(session.user.email).catch(() => null) : null;
  const currentDbUserId = currentDbUser?.id ?? null;

  const visibilityFilter = {
    canSeeAll: canSeeAllSubmissions,
    viewerUserId: currentDbUserId,
  };

  const [tasks, submissions] = selectedProject
    ? await Promise.all([listTasksByProject(selectedProject.id), listSubmissionsByProject(selectedProject.id, visibilityFilter)])
    : [[] as Task[], [] as Submission[]];

  // 댓글·첨부 metadata는 부모 제출물의 공개 범위를 그대로 따라야 하므로,
  // 가시 제출물 id로 조회 범위를 좁혀 비공개 제출물의 파생 데이터가 client payload에 실리지 않게 한다.
  const visibleSubmissionScope = { ids: submissions.map((submission) => submission.id) };

  const [comments, attachments] = selectedProject
    ? await Promise.all([
        listCommentsByProject(selectedProject.id, visibleSubmissionScope, visibilityFilter),
        listAttachmentsByProject(selectedProject.id, visibleSubmissionScope, visibilityFilter),
      ])
    : [[] as Comment[], [] as SubmissionAttachment[]];
  const taskEvents=selectedProject?await listTaskEventsByProject(selectedProject.id):[];
  const eventsByTaskId:Record<number,TaskEvent[]>={};
  for(const event of taskEvents) { const group=eventsByTaskId[event.task_id]??=[]; if(group.length<10)group.push(event); }
  const orderedTasks = getOrderedTasks(tasks);
  const selectedTask = getSelectedTask(orderedTasks, taskIdParam);
  const submissionsByTaskId = groupSubmissionsByTaskId(submissions);
  const commentsBySubmissionId = groupCommentsBySubmissionId(comments);
  const attachmentsBySubmissionId = groupAttachmentsBySubmissionId(attachments);

  return (
    <Container component="main" maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1}>
            <Typography variant="h3">작업 관리</Typography>
            {returnTo?<Button href={returnTo} sx={{alignSelf:"flex-start"}}>내 업무로 돌아가기</Button>:null}
            <Typography variant="body1" color="text.secondary">
              프로젝트별 WBS 작업, 제출물, 댓글을 관리하는 화면입니다. guest는 읽기 전용이고, member와 슈퍼유저는 생성·수정·삭제가 가능합니다.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Chip label={`현재 권한 ${getUserRoleLabel(session.user.role, session.user.isSuperuser)}`} color={canWrite ? "success" : "default"} />
            <Chip label={`프로젝트 ${projects.length}`} color="primary" />
            <Chip label={`작업 ${orderedTasks.length}`} />
            <Chip label={`제출 ${submissions.length}`} />
            <Chip label={`댓글 ${comments.length}`} />
          </Stack>
        </Stack>

        {feedbackStatus && feedbackMessage ? (
          <Alert severity={feedbackStatus === "success" ? "success" : "error"}>{feedbackMessage}</Alert>
        ) : null}

        {selectedTask ? (
          <Alert severity="info">
            홈에서 선택한 업무 상세를 아래에 강조 표시했습니다. 현재 선택 업무는 {selectedTask.title}이며, 제출물과 댓글도 같은 카드 안에서 바로 이어서 수정할 수 있습니다.
          </Alert>
        ) : null}

        <TaskFocusController taskId={selectedTask?.id ?? null} />

        <TaskWritePolicy canWrite={canWrite} />

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Stack spacing={0.5}>
                  <Typography variant="h5">프로젝트 선택</Typography>
                  <Typography variant="body2" color="text.secondary">
                    프로젝트를 선택하면 해당 프로젝트의 작업을 표시합니다. 프로젝트 생성·수정·삭제는 관리자만 할 수 있습니다.
                  </Typography>
                </Stack>
                {canManageProjects ? (
                  <Button href="/admin/projects" variant="outlined" size="small" sx={{ flexShrink: 0 }}>
                    프로젝트 관리
                  </Button>
                ) : null}
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
                {projects.length > 0 ? (
                  projects.map((project) => {
                    const active = selectedProject?.id === project.id;
                    return (
                      <Button key={project.id} href={`/tasks?projectId=${project.id}`} variant={active ? "contained" : "outlined"} aria-current={active ? "page" : undefined}>
                        {project.name}
                      </Button>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {canManageProjects ? "아직 생성된 프로젝트가 없습니다. 관리자 메뉴에서 먼저 프로젝트를 만들어 주세요." : "아직 조회할 프로젝트가 없습니다. 관리자에게 프로젝트 생성을 요청하세요."}
                  </Typography>
                )}
              </Stack>
            </Stack>
        </Paper>

        {selectedProject ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={1.5}>
              <Typography variant="h5">현재 프로젝트</Typography>
              <Typography variant="h6">{selectedProject.name}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>목표: {selectedProject.goal || "아직 작성하지 않았습니다."}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>성공 기준: {selectedProject.successCriteria || "아직 작성하지 않았습니다."}</Typography>
              <Typography variant="body2" color="text.secondary">
                기간 {formatDate(selectedProject.startDate)} ~ {formatDate(selectedProject.endDate)}
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {canWrite && selectedProject ? <TaskCreateForm returnTo={returnTo} eligibleUserIds={eligibleUserIds} orderedTasks={orderedTasks} project={selectedProject} users={users} /> : null}

        {selectedProject ? <ProjectGanttChart project={selectedProject} tasks={orderedTasks} /> : null}

        {selectedProject ? (
          <TaskList
            returnTo={returnTo}
            eligibleUserIds={eligibleUserIds}
            currentUserId={currentDbUserId}
            eventsByTaskId={eventsByTaskId}
            canWrite={canWrite}
            canSeeAllSubmissions={canSeeAllSubmissions}
            commentsBySubmissionId={commentsBySubmissionId}
            attachmentsBySubmissionId={attachmentsBySubmissionId}
            orderedTasks={orderedTasks}
            project={selectedProject}
            selectedTaskId={selectedTask?.id ?? null}
            submissionsByTaskId={submissionsByTaskId}
            users={users}
          />
        ) : (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {canManageProjects
                ? "선택된 프로젝트가 없습니다. 위에서 프로젝트를 선택하거나 관리자 메뉴에서 먼저 프로젝트를 만들어 주세요."
                : "현재 선택된 프로젝트가 없습니다. 관리자에게 프로젝트 생성을 요청하세요."}
            </Typography>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
