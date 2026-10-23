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
import FieldLabel from "@/src/shared/ui/field-label";
import ValidatedTextField from "@/src/shared/ui/validated-text-field";
import { notFound, redirect } from "next/navigation";
import { getAuthSession, getSignInPath, listProjectUsersForViewer } from "@/src/entities/user/index.server";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { listCommentsByProject } from "@/src/entities/comment/index.server";
import { listAttachmentsByProject, listSubmissionsByProject } from "@/src/entities/submission/index.server";
import { listAllProjectsForViewer,getProjectTaskTeams } from "@/src/entities/project/index.server";
import { listTasksByProjectForViewer, listTaskEventsByProjectForViewer, getDependencySnapshotForViewer,getTaskScope } from "@/src/entities/task/index.server";
import { getOrderedTasks, getSelectedTask, parsePersonalWorkReturnTo } from "@/src/entities/task";
import { getSelectedProject } from "@/src/entities/project";
import {parseTaskTeamFilter} from "@/src/shared/lib/task-context";
import { formatDate } from "@/src/shared/lib/date";
import SubmitButton from "@/src/shared/ui/submit-button";
import TaskTemplatePreview from "@/src/widgets/task-templates";
import {applyTaskTemplateAction} from "@/src/features/task-templates/index.server";
import {setTaskPredecessorsAction} from "@/src/features/task-dependencies/index.server";
import {TaskDependencyPanel,ProjectWorkSummary} from "@/src/widgets/task-dependencies";
import ProjectGanttChart from "@/src/widgets/project-gantt";
import { TaskCard, TaskFocusController,TaskAssignmentFields,TaskSummaryCard,TaskDateFields } from "@/src/widgets/task-workspace";
import type { Comment } from "@/src/entities/comment";
import type { Project,TaskTeamDirectory } from "@/src/entities/project";
import type { SubmissionAttachment, Submission } from "@/src/entities/submission";
import type {SubmissionSummary} from "@/src/widgets/task-workspace";
import type { Task, TaskEvent, DependencySnapshot } from "@/src/entities/task";
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
    teamId?:string|string[];
    submissionId?:string|string[];
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
    <Alert severity="success">작성 기능은 프로젝트 역할에 따라 표시됩니다. 봉사활동 업무는 해당 팀장·관리자가 관리하며, 제출물과 댓글은 기존 작성자 권한을 따릅니다.</Alert>
  ) : (
    <Alert severity="info">현재 계정은 게스트 권한이므로 작업, 제출물, 첨부파일, 댓글을 읽기 전용으로만 볼 수 있습니다.</Alert>
  );
}

function TaskCreateForm({
  orderedTasks,
  project,
  users, eligibleUserIds, returnTo,teamId,teamDirectory,allowUnassignedTeam,
}: {
  returnTo?:string;
  teamId?:string;
  teamDirectory:TaskTeamDirectory;
  allowUnassignedTeam:boolean;
  eligibleUserIds:number[];
  orderedTasks: Task[];
  project: Project;
  users: Awaited<ReturnType<typeof listProjectUsersForViewer>>;
}) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
      <Stack component="form" action={createTaskAction} spacing={2}>
        <input type="hidden" name="operationToken" value={randomUUID()} />
        <input type="hidden" name="returnTo" value={returnTo??""}/><input type="hidden" name="teamId" value={teamId??""}/>
        <input type="hidden" name="projectId" value={String(project.id)} />
        <Typography variant="h5">새 작업 추가</Typography>
        <ValidatedTextField name="title" label={<FieldLabel requirement="required">작업 제목</FieldLabel>} required />
        <TextField name="description" label={<FieldLabel>설명</FieldLabel>} multiline minRows={3} />
        <TextField name="deliverable" label={<FieldLabel requirement={project.projectType==='volunteering'?'optional':'before_completion'}>기대 산출물·제출 형식</FieldLabel>} multiline minRows={2} helperText={project.projectType==="volunteering"?"직접 완료에서는 선택 사항입니다. 필요한 활동 기록이나 자료를 적어 주세요.":"예: 조사 자료 링크와 요약 파일. 초안에는 비워 둘 수 있으며 완료 전에 입력합니다."} slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <TextField name="definitionOfDone" label={<FieldLabel requirement="before_completion">완료 기준</FieldLabel>} multiline minRows={2} helperText="확인 가능한 결과를 적어 주세요." slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <TaskAssignmentFields key={project.id} isVolunteer={project.projectType==="volunteering"} teams={teamDirectory.teams} memberIdsByTeam={teamDirectory.memberIdsByTeam} projectMemberIds={teamDirectory.projectMemberIds} users={users.map(({id,name})=>({id,name}))} eligibleUserIds={eligibleUserIds} allowUnassignedTeam={allowUnassignedTeam}/>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField select name="parentId" label={<FieldLabel>상위 작업</FieldLabel>} defaultValue="" fullWidth>
            <MenuItem value="">루트 작업</MenuItem>
            {orderedTasks.map((task) => (
              <MenuItem key={task.id} value={String(task.id)}>
                {`${"\u00A0".repeat(task.depth * 2)}${task.title}`}
              </MenuItem>
            ))}
          </TextField>

        </Stack>
        <TaskDateFields startDate={formatDate(project.startDate)} endDate={formatDate(project.endDate)}/>
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
  users, currentUserId, eventsByTaskId, eligibleUserIds, returnTo, dependencySnapshot,teamDirectory,scope,teamId,selectedSubmissionId,summariesByTaskId,
}: {
  returnTo?:string;
  teamDirectory:TaskTeamDirectory;
  scope:{canManageAll:boolean;canManageUnassigned:boolean;leaderTeamIds:number[]};
  eligibleUserIds:number[];
  dependencySnapshot:DependencySnapshot;
  teamId?:string;
  selectedSubmissionId?:number|null;
  summariesByTaskId:Map<number,SubmissionSummary[]>;
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
  users: Awaited<ReturnType<typeof listProjectUsersForViewer>>;
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
      {(selectedTaskId?orderedTasks.filter(task=>task.id===selectedTaskId):orderedTasks).map((task) => {
        const isSelectedTask = selectedTaskId === task.id;
        const context=new URLSearchParams({projectId:String(project.id),taskId:String(task.id),...(teamId?{teamId}:{}),...(returnTo?{returnTo}:{})});
        if(!selectedTaskId)return <TaskSummaryCard key={task.id} task={task} href={`/tasks?${context.toString()}#task-${task.id}`} submissionCount={summariesByTaskId.get(task.id)?.length??0} childCount={orderedTasks.filter(child=>child.parentId===task.id).length}/>;
        const canManageTask=canWrite&&(scope.canManageAll||(task.activityTeamId!==null&&scope.leaderTeamIds.includes(task.activityTeamId)));
        const canExecuteTask=canWrite&&(canSeeAllSubmissions||task.assigneeId===currentUserId||(task.activityTeamId!==null&&scope.leaderTeamIds.includes(task.activityTeamId)));

        return (
          <TaskCard
            key={`${task.id}:${task.version}`}
            task={task}
            canManageTask={canManageTask}
            canExecuteTask={canExecuteTask}
            isVolunteer={project.projectType==="volunteering"}
            activityTeams={teamDirectory.teams.filter(t=>scope.canManageAll||scope.leaderTeamIds.includes(t.id))}
            memberIdsByTeam={teamDirectory.memberIdsByTeam}
            projectMemberIds={teamDirectory.projectMemberIds}
            allowUnassignedTeam={scope.canManageUnassigned}
            dependencyPanel={<TaskDependencyPanel setTaskPredecessorsAction={setTaskPredecessorsAction} task={task} tasks={orderedTasks} snapshot={dependencySnapshot} canWrite={canManageTask}/>}
            returnTo={returnTo}
            teamId={teamId}
            selectedSubmissionId={selectedSubmissionId}
            submissionSummaries={summariesByTaskId.get(task.id)??[]}
            orderedTasks={orderedTasks}
            projectId={project.id}
            users={users.map(({id,name})=>({id,name}))}
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
  const hasSubmissionAdminRole = canManageAllSubmissions(session.user.role, session.user.isSuperuser);
  const params = await searchParams;
  const feedbackStatus = getSingleSearchParam(params.status);
  const feedbackMessage = getSingleSearchParam(params.message);
  const projectIdParam = getSingleSearchParam(params.projectId);
  const taskIdParam = getSingleSearchParam(params.taskId);
  const returnTo = parsePersonalWorkReturnTo(getSingleSearchParam(params.returnTo)) ?? undefined;

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" sx={{ py: { xs: 3, md: 5 }, minWidth:0,overflowWrap:"anywhere",'& .MuiChip-root':{maxWidth:"100%",height:"auto"},'& .MuiChip-label':{whiteSpace:"normal",overflowWrap:"anywhere",py:0.5} }}>
        <Stack spacing={3}>
          <Typography component="h1" variant="h4">프로젝트 작업 공간</Typography>
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
  const revisionsReady=["submission_revisions","submission_events","submission_attachments","task_dependencies","task_template_runs","project_members","activity_teams","activity_team_members","activity_team_leaders","project_workspace_events"].every(name=>databaseStatus.tables.some(table=>table.name===name&&table.exists&&table.missingColumns.length===0));
  if (!revisionsReady || !taskEventsReady || !projectsTableReady || !tasksTableReady || !submissionsTableReady || !commentsTableReady || !usersTableReady) {
    return (
      <Container component="main" sx={{ py: { xs: 3, md: 5 }, minWidth:0,overflowWrap:"anywhere",'& .MuiChip-root':{maxWidth:"100%",height:"auto"},'& .MuiChip-label':{whiteSpace:"normal",overflowWrap:"anywhere",py:0.5} }}>
        <Stack spacing={3}>
          <Typography component="h1" variant="h4">프로젝트 작업 공간</Typography>
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

  const { getUserByEmail } = await import("@/src/entities/user/index.server");
  const currentDbUser = session.user.email ? await getUserByEmail(session.user.email).catch(() => null) : null;
  const viewer={userId:currentDbUser?.id??null,email:session.user.email,isSuperuser:!!session.user.isSuperuser};
  const projects=await listAllProjectsForViewer(viewer);
  if(projectIdParam&&!projects.some(project=>String(project.id)===projectIdParam))notFound();
  const selectedProject = getSelectedProject(projects, projectIdParam);
  const users=selectedProject?await listProjectUsersForViewer(selectedProject.id,viewer):[];
  const eligibleUserIds=users.filter(user=>user.role!=="guest"||user.email.toLowerCase()===runtimeEnv.auth.superuserEmail).map(user=>user.id);
  const currentDbUserId = currentDbUser?.id ?? null;
  const [scope,teamDirectory] = await Promise.all([
    selectedProject&&currentDbUserId&&canWrite?getTaskScope(selectedProject.id,{userId:currentDbUserId,isAdmin:canManageProjects,isSuperuser:!!session.user.isSuperuser}):Promise.resolve({projectType:selectedProject?.projectType??"collaboration",canManageAll:false,canManageUnassigned:false,leaderTeamIds:[] as number[]}),
    selectedProject?.projectType==="volunteering"&&currentDbUserId?getProjectTaskTeams(selectedProject.id,{userId:currentDbUserId,isSuperuser:!!session.user.isSuperuser}):Promise.resolve({teams:[],memberIdsByTeam:{}} as TaskTeamDirectory),
  ]);
  const canCreateTask=canWrite&&(scope.canManageAll||scope.leaderTeamIds.length>0);
  const canSeeAllSubmissions=hasSubmissionAdminRole&&scope.canManageAll;

  const visibilityFilter = {
    canSeeAll: canSeeAllSubmissions,
    viewerUserId: currentDbUserId,
  };

  const [tasks, submissions] = selectedProject
    ? await Promise.all([listTasksByProjectForViewer(selectedProject.id,viewer), listSubmissionsByProject(selectedProject.id, visibilityFilter)])
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
  const dependencySnapshot=selectedProject?await getDependencySnapshotForViewer(selectedProject.id,viewer):{version:0,edges:[]};
  const taskEvents=selectedProject&&taskIdParam?await listTaskEventsByProjectForViewer(selectedProject.id,viewer):[];
  const eventsByTaskId:Record<number,TaskEvent[]>={};
  for(const event of taskEvents) { const group=eventsByTaskId[event.task_id]??=[]; if(group.length<10)group.push(event); }
  const orderedTasks = getOrderedTasks(tasks);
  const teamFilter=parseTaskTeamFilter(getSingleSearchParam(params.teamId));
  const visibleTasks=teamFilter?orderedTasks.filter(t=>teamFilter==="unassigned"?t.activityTeamId===null:String(t.activityTeamId)===teamFilter):orderedTasks;
  const selectedTask = getSelectedTask(orderedTasks, taskIdParam);
  if(taskIdParam&&!selectedTask)notFound();
  const rawSubmissionId=getSingleSearchParam(params.submissionId);
  const selectedSubmission=rawSubmissionId?submissions.find(submission=>String(submission.id)===rawSubmissionId&&submission.taskId===selectedTask?.id):undefined;
  if(rawSubmissionId&&!selectedSubmission)notFound();
  const allComments=groupCommentsBySubmissionId(comments),allAttachments=groupAttachmentsBySubmissionId(attachments);
  const summariesByTaskId=new Map<number,SubmissionSummary[]>();
  for(const submission of submissions){const items=summariesByTaskId.get(submission.taskId)??[];items.push({id:submission.id,authorName:submission.authorName,createdAt:submission.createdAt,currentRevision:submission.currentRevision,visibility:submission.visibility,attachmentCount:(allAttachments[submission.id]?.length??0)+(submission.filePath?1:0),commentCount:allComments[submission.id]?.length??0});summariesByTaskId.set(submission.taskId,items);}
  const submissionsByTaskId=groupSubmissionsByTaskId(selectedSubmission?[selectedSubmission]:[]);
  const commentsBySubmissionId=selectedSubmission?{[selectedSubmission.id]:allComments[selectedSubmission.id]??[]}:{};
  const attachmentsBySubmissionId=selectedSubmission?{[selectedSubmission.id]:allAttachments[selectedSubmission.id]??[]}:{};
  const listQuery=new URLSearchParams({projectId:String(selectedProject?.id??''),...(teamFilter?{teamId:teamFilter}:{}),...(returnTo?{returnTo}:{})});

  return (
    <Container component="main" sx={{ py: { xs: 3, md: 5 }, minWidth:0,overflowWrap:"anywhere",'& .MuiChip-root':{maxWidth:"100%",height:"auto"},'& .MuiChip-label':{whiteSpace:"normal",overflowWrap:"anywhere",py:0.5} }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h4">{selectedTask?"업무 상세":"프로젝트 작업 공간"}</Typography>
            {returnTo?<Button href={returnTo} sx={{alignSelf:"flex-start"}}>내 업무로 돌아가기</Button>:null}
            <Typography variant="body1" color="text.secondary">
              프로젝트의 일정과 업무 요약을 확인하고, 필요한 업무와 제출물을 열어 진행합니다.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", flexShrink: 0, alignContent: "flex-start" }}>
            <Chip label={`현재 권한 ${getUserRoleLabel(session.user.role, session.user.isSuperuser)}`} color={canWrite ? "success" : "default"} />
            <Chip label={`프로젝트 ${projects.length}`} color="primary" />
            <Chip label={`작업 ${orderedTasks.length}`} />
            <Chip label={`제출 ${submissions.length}`} />
            <Chip label={`댓글 ${comments.length}`} />
          </Stack>
        </Stack>

        {feedbackStatus && feedbackMessage ? (
          <Alert id="workspace-result" tabIndex={-1} severity={feedbackStatus === "success" ? "success" : "error"}>{feedbackMessage}</Alert>
        ) : null}

        {selectedTask?<Button href={`/tasks?${listQuery.toString()}#task-${selectedTask.id}`} sx={{alignSelf:'flex-start'}}>업무 목록으로 돌아가기</Button>:null}
        <TaskFocusController taskId={selectedTask?.id??null} submissionId={selectedSubmission?.id??null}/>

        <TaskWritePolicy canWrite={canWrite} />

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Stack spacing={0.5}>
                  <Typography variant="h5">프로젝트 선택</Typography>
                  <Typography variant="body2" color="text.secondary">
                    프로젝트를 선택하면 해당 프로젝트의 작업을 표시합니다. 프로젝트 관리는 배정된 관리자 메뉴에서 진행합니다.
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
                      <Button key={project.id} href={`/tasks?${new URLSearchParams({projectId:String(project.id),...(returnTo?{returnTo}:{})})}`} variant={active ? "contained" : "outlined"} aria-current={active ? "page" : undefined}>
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
              {scope.leaderTeamIds.length?<Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap"}}>{teamDirectory.teams.filter(team=>scope.leaderTeamIds.includes(team.id)).map(team=><Chip key={team.id} color="secondary" label={`팀장 · ${team.name}`}/>)}</Stack>:null}
              {selectedTask?<details><summary>프로젝트 목표·성공 기준</summary><Typography sx={{whiteSpace:"pre-wrap",pt:1}}>목표: {selectedProject.goal||"아직 작성하지 않았습니다."}</Typography><Typography sx={{whiteSpace:"pre-wrap"}}>성공 기준: {selectedProject.successCriteria||"아직 작성하지 않았습니다."}</Typography></details>:<><Typography sx={{whiteSpace:"pre-wrap"}}>목표: {selectedProject.goal||"아직 작성하지 않았습니다."}</Typography><Typography sx={{whiteSpace:"pre-wrap"}}>성공 기준: {selectedProject.successCriteria||"아직 작성하지 않았습니다."}</Typography></>}
              <Typography variant="body2" color="text.secondary">
                기간 {formatDate(selectedProject.startDate)} ~ {formatDate(selectedProject.endDate)}
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {!selectedTask&&canWrite&&selectedProject&&scope.canManageAll?<details><summary>템플릿으로 업무 추가</summary><TaskTemplatePreview key={selectedProject.id} projectId={selectedProject.id} startDate={formatDate(selectedProject.startDate)} users={users.filter(user=>eligibleUserIds.includes(user.id)).map(({id,name})=>({id,name}))} action={applyTaskTemplateAction}/></details>:null}

        {!selectedTask&&canCreateTask && selectedProject ? <details><summary>새 업무 추가</summary><TaskCreateForm teamDirectory={{...teamDirectory,teams:teamDirectory.teams.filter(t=>scope.canManageAll||scope.leaderTeamIds.includes(t.id))}} allowUnassignedTeam={scope.canManageUnassigned} returnTo={returnTo} teamId={teamFilter} eligibleUserIds={eligibleUserIds} orderedTasks={orderedTasks.filter(t=>scope.canManageAll||(t.activityTeamId!==null&&scope.leaderTeamIds.includes(t.activityTeamId)))} project={selectedProject} users={users} /></details> : null}

        {selectedProject ? selectedTask?<details><summary>프로젝트 일정·간트</summary><ProjectGanttChart project={selectedProject} tasks={orderedTasks} dependencies={dependencySnapshot.edges}/></details>:<ProjectGanttChart project={selectedProject} tasks={orderedTasks} dependencies={dependencySnapshot.edges}/> : null}
        {selectedProject?<ProjectWorkSummary tasks={orderedTasks} edges={dependencySnapshot.edges}/>:null}
        {selectedProject?.projectType==="volunteering"?<Stack direction="row" useFlexGap spacing={1} sx={{flexWrap:"wrap"}} aria-label="활동팀 업무 필터"><Button href={`/tasks?${new URLSearchParams({projectId:String(selectedProject.id),...(returnTo?{returnTo}:{})})}`} variant={!teamFilter?"contained":"outlined"}>전체 팀</Button>{teamDirectory.teams.map(team=><Button key={team.id} href={`/tasks?${new URLSearchParams({projectId:String(selectedProject.id),teamId:String(team.id),...(returnTo?{returnTo}:{})})}`} variant={teamFilter===String(team.id)?"contained":"outlined"}>{team.name}</Button>)}<Button href={`/tasks?${new URLSearchParams({projectId:String(selectedProject.id),teamId:"unassigned",...(returnTo?{returnTo}:{})})}`}>공통 업무</Button></Stack>:null}

        {selectedProject ? (
          <TaskList
            teamDirectory={teamDirectory}
            scope={scope}
            dependencySnapshot={dependencySnapshot}
            returnTo={returnTo}
            eligibleUserIds={eligibleUserIds}
            currentUserId={currentDbUserId}
            eventsByTaskId={eventsByTaskId}
            canWrite={canWrite}
            canSeeAllSubmissions={canSeeAllSubmissions}
            commentsBySubmissionId={commentsBySubmissionId}
            attachmentsBySubmissionId={attachmentsBySubmissionId}
            orderedTasks={selectedTask?orderedTasks:visibleTasks}
            project={selectedProject}
            selectedTaskId={selectedTask?.id ?? null}
            selectedSubmissionId={selectedSubmission?.id??null}
            summariesByTaskId={summariesByTaskId}
            teamId={teamFilter}
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
