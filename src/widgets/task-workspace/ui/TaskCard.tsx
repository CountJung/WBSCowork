"use client";

import { useState } from "react";
import { Button, Checkbox, FormControlLabel, Chip, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import MarkdownContent from "@/src/shared/ui/markdown-content";
import TaskSubmissionPanel from "./TaskSubmissionPanel";
import { formatDate } from "@/src/shared/lib/date";
import { getUserRoleLabel } from "@/src/entities/user";
import type { Comment } from "@/src/entities/comment";
import type { SubmissionAttachment, Submission } from "@/src/entities/submission";
import { taskStatusLabels } from "@/src/entities/task";
import type { Task, TaskEvent } from "@/src/entities/task";
import type { User } from "@/src/entities/user";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskCardProps = {
  task: Task;
  currentUserId:number|null;
  events:TaskEvent[];
  changeTaskStatusAction:ContentAction;
  orderedTasks: Task[];
  projectId: number;
  users: User[];
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
  task, currentUserId, events, changeTaskStatusAction,
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
  const [operationToken] = useState(()=>crypto.randomUUID());
  const [statusToken] = useState(()=>crypto.randomUUID());
  const canExecute=canWrite&&(canSeeAllSubmissions||task.assigneeId===currentUserId);

  return (
    <Paper
      id={`task-${task.id}`}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        borderLeft: "4px solid",
        borderColor: isSelectedTask ? "secondary.main" : "primary.main",
        ml: { xs: 0, md: task.depth * 3 },
        scrollMarginTop: 110,
        background: isSelectedTask ? "var(--task-focus-card-background)" : "var(--mui-palette-background-paper)",
        boxShadow: isSelectedTask ? "var(--task-focus-card-shadow, 0 18px 34px rgba(183, 121, 31, 0.12))" : undefined,
        transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <Stack spacing={2}>
        {/* 헤더 행: 작업 정보(좌) + 액션 버튼(우) */}
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { lg: "flex-start" } }}
        >
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">{task.title}</Typography>
            <Chip label={taskStatusLabels[task.status]} color={task.status==="done"?"success":"default"} />
            {task.assigneeId&&!task.assigneeEligible?<Typography color="warning.main">현재 담당자는 업무 작성 권한이 없어 재배정이 필요합니다.</Typography>:null}
            <Typography variant="body2">검토자: {task.reviewerName??"미지정"}</Typography>
            {task.workflowNote?<Typography sx={{whiteSpace:"pre-wrap"}}>상태 근거: {task.workflowNote}</Typography>:null}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ flexWrap: "wrap" }}>
              {isSelectedTask ? <Chip label="선택된 업무" color="secondary" /> : null}
              <Chip label={`기간 ${formatDate(task.startDate)} ~ ${formatDate(task.endDate)}`} variant="outlined" />
              <Chip label={`깊이 ${task.depth}`} />
              <Chip
                label={task.assigneeName ? `담당자 ${task.assigneeName}` : "담당자 미지정"}
                color={task.assigneeName ? "primary" : "default"}
                variant={task.assigneeName ? "filled" : "outlined"}
              />
            </Stack>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>기대 산출물: {task.deliverable || "완료 전에 작성해 주세요."}</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>완료 기준: {task.definitionOfDone || "완료 전에 작성해 주세요."}</Typography>
            <Chip label={task.reviewRequired ? "검토자 승인 필요" : "담당자 완료"} size="small" variant="outlined" />
            {task.description ? (
              <MarkdownContent content={task.description} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                설명이 아직 입력되지 않았습니다.
              </Typography>
            )}
          </Stack>

          {/* 수정/삭제 버튼 — 수정 폼이 열려 있을 때는 숨김 */}
          {canWrite && !isEditing ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button size="small" variant="outlined" onClick={() => setIsEditing(true)}>
                수정
              </Button>
              <Stack component="form" action={deleteTaskAction}>
                <input type="hidden" name="projectId" value={String(projectId)} />
                <input type="hidden" name="taskId" value={String(task.id)} />
                <FormControlLabel control={<Checkbox name="confirmRevisionDeletion" value="yes" required/>} label="작업·모든 제출 버전 삭제 확인"/>
                <Button type="submit" color="error" size="small" variant="outlined">
                  작업 삭제
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>

        {canExecute ? <Stack component="form" action={changeTaskStatusAction} spacing={1.5}>
          <input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="version" value={task.version}/><input type="hidden" name="operationToken" value={statusToken}/>
          <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}><TextField select name="taskStatus" label="진행 상태" defaultValue={['planned','in_progress','blocked','done'].includes(task.status)?task.status:'in_progress'} fullWidth><MenuItem value="planned">예정</MenuItem><MenuItem value="in_progress">진행 중</MenuItem><MenuItem value="blocked">차단됨</MenuItem>{!task.reviewRequired?<MenuItem value="done">완료</MenuItem>:null}</TextField><Button type="submit" variant="outlined">상태 저장</Button></Stack>
          <TextField name="note" label="상태 변경 근거 · 차단/완료/재개 시 필요" helperText="모든 인증 사용자에게 보이는 업무 기록입니다. 비공개 제출물 내용은 적지 마세요." multiline slotProps={{htmlInput:{maxLength:2000}}}/>
        </Stack>:null}
        {events.length?<Stack spacing={0.5}><Typography variant="subtitle2">업무 변경 이력 (최근 {events.length}건)</Typography>{events.map(event=><Typography key={event.id} variant="body2">v{event.task_version} · {event.kind==="baseline"?"이력 도입 시점":event.actor_name??"계정 삭제됨"} · {taskStatusLabels[event.status]} · 담당 {event.assignee_name??"미지정"} · 검토 {event.reviewer_name??"미지정"}{event.note?` · ${event.note}`:''}</Typography>)}</Stack>:null}

        {/* 수정 폼 — 헤더 아래 전체 너비로 배치 */}
        {canWrite && isEditing ? (
          <>
            <Divider />
            <Stack
              component="form"
              action={async (formData: FormData) => {
                await updateTaskAction(formData);
                setIsEditing(false);
              }}
              spacing={2}
            >
              <input type="hidden" name="projectId" value={String(projectId)} />
              <input type="hidden" name="taskId" value={String(task.id)} />
              <input type="hidden" name="version" value={task.version} />
              <input type="hidden" name="operationToken" value={operationToken} />
              <TextField name="title" label="작업 제목" defaultValue={task.title} required />
              <TextField name="description" label="설명" defaultValue={task.description} multiline minRows={3} />
              <TextField name="deliverable" label="기대 산출물·제출 형식" defaultValue={task.deliverable} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <TextField name="definitionOfDone" label="완료 기준" defaultValue={task.definitionOfDone} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <TextField select name="reviewerId" label="검토자 (선택)" defaultValue={String(task.reviewerId??"")}><MenuItem value="">미지정</MenuItem>{users.filter(user=>eligibleUserIds.includes(user.id)||user.id===task.reviewerId).map(user=><MenuItem key={user.id} value={String(user.id)} disabled={!eligibleUserIds.includes(user.id)||user.id===task.assigneeId}>{user.name}</MenuItem>)}</TextField>
              <TextField select name="reviewRequired" label="검토 방식" defaultValue={task.reviewRequired ? "1" : "0"}><MenuItem value="0">담당자가 근거를 남기고 완료</MenuItem><MenuItem value="1">검토자 승인 후 완료</MenuItem></TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField select name="parentId" label="상위 작업" defaultValue={String(task.parentId ?? "")} fullWidth>
                  <MenuItem value="">루트 작업</MenuItem>
                  {orderedTasks
                    .filter((candidateTask) => candidateTask.id !== task.id)
                    .map((candidateTask) => (
                      <MenuItem key={candidateTask.id} value={String(candidateTask.id)}>
                        {`${"\u00A0".repeat(candidateTask.depth * 2)}${candidateTask.title}`}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField select name="assigneeId" label="담당자" defaultValue={String(task.assigneeId ?? "")} fullWidth>
                  <MenuItem value="">미지정</MenuItem>
                  {users.filter(user=>eligibleUserIds.includes(user.id)||user.id===task.assigneeId).map((user) => (
                    <MenuItem key={user.id} value={String(user.id)} disabled={!eligibleUserIds.includes(user.id)}>
                      {user.name} · {getUserRoleLabel(user.role)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  name="startDate"
                  label="시작일"
                  type="date"
                  defaultValue={formatDate(task.startDate)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  name="endDate"
                  label="종료일"
                  type="date"
                  defaultValue={formatDate(task.endDate)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button type="submit" variant="contained">
                  저장
                </Button>
                <Button type="button" variant="text" onClick={() => setIsEditing(false)}>
                  취소
                </Button>
              </Stack>
            </Stack>
          </>
        ) : null}

        <TaskSubmissionPanel
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
      </Stack>
    </Paper>
  );
}
