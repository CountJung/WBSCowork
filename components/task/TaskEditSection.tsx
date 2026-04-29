"use client";

import { useState } from "react";
import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { formatDate } from "@/lib/task-view";
import { getUserRoleLabel } from "@/models/user";
import type { Task } from "@/models/task";
import type { User } from "@/models/user";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskEditSectionProps = {
  task: Task;
  orderedTasks: Task[];
  projectId: number;
  users: User[];
  updateTaskAction: ContentAction;
  deleteTaskAction: ContentAction;
};

export default function TaskEditSection({
  task,
  orderedTasks,
  projectId,
  users,
  updateTaskAction,
  deleteTaskAction,
}: TaskEditSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
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

      {isEditing && (
        <Stack component="form" action={async (formData: FormData) => { await updateTaskAction(formData); setIsEditing(false); }} spacing={2}>
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
            <TextField name="startDate" label="시작일" type="date" defaultValue={formatDate(task.startDate)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField name="endDate" label="종료일" type="date" defaultValue={formatDate(task.endDate)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button type="submit" variant="contained">저장</Button>
            <Button type="button" variant="text" onClick={() => setIsEditing(false)}>취소</Button>
          </Stack>
        </Stack>
      )}
    </>
  );
}
