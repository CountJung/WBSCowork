"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Chip, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import FieldLabel from "@/src/shared/ui/field-label";
import DeleteConfirmation from "./DeleteConfirmation";
import TaskStatusForm from "./TaskStatusForm";
import TaskDateFields from "./TaskDateFields";
import ValidatedTextField from "@/src/shared/ui/validated-text-field";
import type {SubmissionSummary} from "./TaskSubmissionPanel";
import MarkdownContent from "@/src/shared/ui/markdown-content";
import SubmitButton from "@/src/shared/ui/submit-button";
import TaskSubmissionPanel from "./TaskSubmissionPanel";
import TaskAssignmentFields from "./TaskAssignmentFields";
import { formatDate } from "@/src/shared/lib/date";
import type { Comment } from "@/src/entities/comment";
import type { SubmissionAttachment, Submission } from "@/src/entities/submission";
import { taskStatusLabels } from "@/src/entities/task";
import type { Task, TaskEvent } from "@/src/entities/task";
import type { User } from "@/src/entities/user";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskCardProps = {
  canManageTask?:boolean;
  canExecuteTask?:boolean;
  isVolunteer?:boolean;
  activityTeams?:{id:number;name:string}[];
  memberIdsByTeam?:Record<number,number[]>;
  projectMemberIds?:number[];
  allowUnassignedTeam?:boolean;
  dependencyPanel?:ReactNode;
  returnTo?: string;
  teamId?: string;
  selectedSubmissionId?:number|null;
  submissionSummaries?:SubmissionSummary[];
  task: Task;
  currentUserId:number|null;
  events:TaskEvent[];
  changeTaskStatusAction:ContentAction;
  orderedTasks: Task[];
  projectId: number;
  users: Pick<User,"id"|"name">[];
  eligibleUserIds:number[];
  isSelectedTask: boolean;
  canWrite: boolean;
  canSeeAllSubmissions: boolean;
  submissions: Submission[];
  commentsBySubmissionId: Record<number, Comment[]>;
  attachmentsBySubmissionId: Record<number, SubmissionAttachment[]>;
  updateTaskAction: ContentAction;
  deleteTaskAction: ContentAction;
  createCommentAction: ContentAction;
  createSubmissionAction: ContentAction;
  deleteCommentAction: ContentAction;
  deleteSubmissionAction: ContentAction;
  deleteAttachmentAction: ContentAction;
  updateCommentAction: ContentAction;
  updateSubmissionAction: ContentAction;
};

export default function TaskCard({
  canManageTask,canExecuteTask,isVolunteer=false,activityTeams=[],memberIdsByTeam={},projectMemberIds=[],allowUnassignedTeam=true,
  task, currentUserId, events, changeTaskStatusAction, returnTo, dependencyPanel,teamId,selectedSubmissionId,submissionSummaries=[],
  orderedTasks,
  projectId,
  users, eligibleUserIds,
  isSelectedTask,
  canWrite,
  canSeeAllSubmissions,
  submissions,
  commentsBySubmissionId,
  attachmentsBySubmissionId,
  updateTaskAction,
  deleteTaskAction,
  createCommentAction,
  createSubmissionAction,
  deleteCommentAction,
  deleteSubmissionAction,
  deleteAttachmentAction,
  updateCommentAction,
  updateSubmissionAction,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editForm=useRef<HTMLFormElement>(null);
  const editButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(isEditing)editForm.current?.querySelector<HTMLInputElement>('[name="title"]')?.focus();},[isEditing]);
  const closeEdit=()=>{setIsEditing(false);requestAnimationFrame(()=>editButton.current?.focus());};
  const [operationToken] = useState(()=>crypto.randomUUID());
  const canExecute=canExecuteTask??(canWrite&&(canSeeAllSubmissions||task.assigneeId===currentUserId));
  const canManage=canManageTask??canWrite;

  return (
    <Paper
      id={`task-${task.id}`}
      tabIndex={-1}
      data-testid={`task-detail-${task.id}`}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        borderLeft: "4px solid",
        borderColor: isSelectedTask ? "secondary.main" : "primary.main",
        minWidth: 0, overflowWrap: "anywhere",
        scrollMarginTop: 110,
        background: isSelectedTask ? "var(--task-focus-card-background)" : "var(--mui-palette-background-paper)",
        boxShadow: isSelectedTask ? "var(--task-focus-card-shadow, 0 18px 34px rgba(183, 121, 31, 0.12))" : undefined,
        transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={1.5} sx={{minWidth:0}}>
          <Typography component="h2" variant="h5">{task.title}</Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{flexWrap:"wrap",alignItems:"flex-start",'& .MuiChip-root':{maxWidth:'100%',height:'auto'},'& .MuiChip-label':{whiteSpace:'normal',overflowWrap:'anywhere',py:0.5}}}>
            <Chip size="small" label={taskStatusLabels[task.status]} color={task.status==='done'?'success':'default'}/>
            {task.activityTeamName?<Chip size="small" label={task.activityTeamName} variant="outlined"/>:null}
            <Chip size="small" label={task.completionMode==='direct_completion'?'제출 선택':'제출 필수'} variant="outlined"/>
            {task.reviewRequired?<Chip size="small" label="검토 승인 필요" color="warning" variant="outlined"/>:null}
          </Stack>
          <Typography variant="body2" color="text.secondary">담당 {task.assigneeName??'미지정'} · {formatDate(task.startDate)} ~ {formatDate(task.endDate)}</Typography>
          {task.completedAt?<Typography variant="body2">완료자: {task.completedByName??users.find(u=>u.id===task.completedBy)?.name??"계정 삭제됨"}{task.completedByIsSuperuser?" · 슈퍼관리자":""} · 완료 시각: {new Date(task.completedAt).toISOString()}</Typography>:null}
          {task.assigneeId&&!task.assigneeEligible?<Typography color="warning.main">현재 담당자는 업무 작성 권한이 없어 재배정이 필요합니다.</Typography>:null}
          <Typography id={`task-criteria-${task.id}`} sx={{whiteSpace:'pre-wrap'}}>완료 기준: {task.definitionOfDone||'완료 전에 작성해 주세요.'}</Typography>
          <Typography sx={{whiteSpace:'pre-wrap'}}>기대 산출물: {task.deliverable||(task.completionMode==='direct_completion'?'선택 사항':'완료 전에 작성해 주세요.')}</Typography>
          <Typography variant="body2" color="text.secondary">검토자: {task.reviewerName??'미지정'}</Typography>
          {task.description?<MarkdownContent content={task.description}/>:<Typography variant="body2" color="text.secondary">설명이 아직 없습니다.</Typography>}
          {task.workflowNote?<Typography sx={{whiteSpace:'pre-wrap'}}>상태 근거: {task.workflowNote}</Typography>:null}
        </Stack>
        {canExecute?<TaskStatusForm key={`${task.id}:${task.version}`} task={task} projectId={projectId} returnTo={returnTo} teamId={teamId} action={changeTaskStatusAction}/>:null}
        {dependencyPanel?<details><summary>선후행 업무 확인·관리</summary><div style={{paddingTop:12}}>{dependencyPanel}</div></details>:null}
        {events.length?<details><summary>업무 변경 이력 · {events.length}건</summary><Stack spacing={0.75} sx={{pt:1.5}}>{events.map(event=><Typography key={event.id} variant="body2">v{event.task_version} · {event.actor_name??'계정 삭제됨'} · {taskStatusLabels[event.status]} · {new Date(event.created_at).toISOString()}{event.note?` · ${event.note}`:''}</Typography>)}</Stack></details>:null}

        {/* 수정 폼 — 헤더 아래 전체 너비로 배치 */}
        {canManage && isEditing ? (
          <>
            <Divider />
            <Stack
              component="form"
              ref={editForm}
              action={async (formData: FormData) => {
                await updateTaskAction(formData);
                setIsEditing(false);
              }}
              spacing={2}
            >
              <input type="hidden" name="returnTo" value={returnTo??""}/><input type="hidden" name="teamId" value={teamId??""}/><input type="hidden" name="projectId" value={String(projectId)} />
              <input type="hidden" name="taskId" value={String(task.id)} />
              <input type="hidden" name="version" value={task.version} />
              <input type="hidden" name="operationToken" value={operationToken} />
              <ValidatedTextField name="title" label={<FieldLabel requirement="required">작업 제목</FieldLabel>} defaultValue={task.title} required />
              <TextField name="description" label={<FieldLabel>설명</FieldLabel>} defaultValue={task.description} multiline minRows={3} />
              <TextField name="deliverable" label={<FieldLabel requirement={task.completionMode==='direct_completion'?'optional':'before_completion'}>기대 산출물·제출 형식</FieldLabel>} defaultValue={task.deliverable} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <TextField name="definitionOfDone" label={<FieldLabel requirement="before_completion">완료 기준</FieldLabel>} defaultValue={task.definitionOfDone} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <TaskAssignmentFields isVolunteer={isVolunteer} teams={activityTeams} memberIdsByTeam={memberIdsByTeam} projectMemberIds={projectMemberIds} users={users} eligibleUserIds={eligibleUserIds} defaultTeamId={task.activityTeamId} defaultAssigneeId={task.assigneeId} defaultReviewerId={task.reviewerId} retainedAssigneeName={task.assigneeName} retainedReviewerName={task.reviewerName} defaultMode={task.completionMode} defaultReviewRequired={task.reviewRequired} canChangeMode={task.status==='planned'} includeReviewer allowUnassignedTeam={allowUnassignedTeam}/>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField select name="parentId" label={<FieldLabel>상위 작업</FieldLabel>} defaultValue={String(task.parentId ?? "")} fullWidth>
                  <MenuItem value="">루트 작업</MenuItem>
                  {orderedTasks
                    .filter((candidateTask) => candidateTask.id !== task.id)
                    .map((candidateTask) => (
                      <MenuItem key={candidateTask.id} value={String(candidateTask.id)}>
                        {`${"\u00A0".repeat(candidateTask.depth * 2)}${candidateTask.title}`}
                      </MenuItem>
                    ))}
                </TextField>

              </Stack>
              <TaskDateFields startDate={formatDate(task.startDate)} endDate={formatDate(task.endDate)}/>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <SubmitButton pendingLabel="작업 저장 중…" variant="contained">
                  저장
                </SubmitButton>
                <Button type="button" variant="text" onClick={closeEdit}>
                  취소
                </Button>
              </Stack>
            </Stack>
          </>
        ) : null}

        <TaskSubmissionPanel
          returnTo={returnTo}
          teamId={teamId}
          selectedSubmissionId={selectedSubmissionId}
          summaries={submissionSummaries}
          currentUserId={currentUserId}
          canWrite={canWrite}
          canSeeAllSubmissions={canSeeAllSubmissions}
          commentsBySubmissionId={commentsBySubmissionId}
          attachmentsBySubmissionId={attachmentsBySubmissionId}
          createCommentAction={createCommentAction}
          createSubmissionAction={createSubmissionAction}
          deleteCommentAction={deleteCommentAction}
          deleteSubmissionAction={deleteSubmissionAction}
          deleteAttachmentAction={deleteAttachmentAction}
          projectId={projectId}
          submissions={submissions}
          taskId={task.id}
          taskTitle={task.title}
          updateCommentAction={updateCommentAction}
          updateSubmissionAction={updateSubmissionAction}
        />
        {canManage&&!isEditing?<Stack direction="row" useFlexGap spacing={1} sx={{flexWrap:'wrap',pt:1,borderTop:'1px solid',borderColor:'divider'}}><Button ref={editButton} size="small" variant="outlined" onClick={()=>setIsEditing(true)}>수정</Button><DeleteConfirmation id={`task-delete-confirm-${task.id}`} triggerLabel="작업 삭제…" warning="이 작업과 연결된 모든 제출 버전·댓글·파일을 영구 삭제합니다. 되돌릴 수 없습니다. 필요한 자료를 보관했는지 확인하세요." fields={{projectId:String(projectId),taskId:String(task.id),returnTo:returnTo??'',teamId:teamId??''}} action={deleteTaskAction}/></Stack>:null}
      </Stack>
    </Paper>
  );
}
