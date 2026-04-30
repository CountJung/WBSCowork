"use client";

import { useState } from "react";
import { Button, Chip, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import MarkdownContent from "@/components/MarkdownContent";
import TaskSubmissionPanel from "@/components/task/TaskSubmissionPanel";
import { formatDate } from "@/lib/task-view";
import { getUserRoleLabel } from "@/models/user";
import type { Comment } from "@/models/comment";
import type { SubmissionAttachment } from "@/models/submission-attachment";
import type { Submission } from "@/models/submission";
import type { Task } from "@/models/task";
import type { User } from "@/models/user";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskCardProps = {
  task: Task;
  orderedTasks: Task[];
  projectId: number;
  users: User[];
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
  task,
  orderedTasks,
  projectId,
  users,
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
                <Button type="submit" color="error" size="small" variant="outlined">
                  작업 삭제
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>

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
              <TextField name="title" label="작업 제목" defaultValue={task.title} required />
              <TextField name="description" label="설명" defaultValue={task.description} multiline minRows={3} />
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
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
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
