import { Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Submission } from "@/models/submission";

type SubmissionAction = (formData: FormData) => Promise<void>;

type TaskSubmissionPanelProps = {
  canWrite: boolean;
  createSubmissionAction: SubmissionAction;
  deleteSubmissionAction: SubmissionAction;
  projectId: number;
  submissions: Submission[];
  taskId: number;
  taskTitle: string;
  updateSubmissionAction: SubmissionAction;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default function TaskSubmissionPanel({
  canWrite,
  createSubmissionAction,
  deleteSubmissionAction,
  projectId,
  submissions,
  taskId,
  taskTitle,
  updateSubmissionAction,
}: TaskSubmissionPanelProps) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "action.hover" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">제출물</Typography>
            <Typography variant="body2" color="text.secondary">
              {taskTitle} 작업에 연결된 산출물입니다. Markdown 본문으로 결과를 기록할 수 있습니다.
            </Typography>
          </Stack>
          <Chip label={`제출 ${submissions.length}`} color="primary" variant="outlined" />
        </Stack>

        {submissions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            아직 등록된 제출물이 없습니다.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {submissions.map((submission) => (
              <Paper key={submission.id} elevation={0} sx={{ p: 2, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{submission.authorName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {submission.authorEmail} · {formatDateTime(submission.createdAt)}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      color: "text.primary",
                      "& p": { my: 0.75 },
                      "& ul, & ol": { pl: 3, my: 0.75 },
                      "& pre": {
                        overflowX: "auto",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "rgba(17, 24, 39, 0.08)",
                      },
                      "& code": {
                        fontFamily: "ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, monospace",
                      },
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{submission.content}</ReactMarkdown>
                  </Box>

                  {!canWrite ? null : (
                    <>
                      <Divider />
                      <Stack spacing={1.5}>
                        <Stack component="form" action={updateSubmissionAction} spacing={1.5}>
                          <input type="hidden" name="projectId" value={String(projectId)} />
                          <input type="hidden" name="taskId" value={String(taskId)} />
                          <input type="hidden" name="submissionId" value={String(submission.id)} />
                          <TextField
                            name="content"
                            label="제출 내용 수정"
                            defaultValue={submission.content}
                            multiline
                            minRows={4}
                          />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button type="submit" variant="outlined">
                              제출 수정
                            </Button>
                          </Stack>
                        </Stack>
                        <Stack component="form" action={deleteSubmissionAction}>
                          <input type="hidden" name="projectId" value={String(projectId)} />
                          <input type="hidden" name="taskId" value={String(taskId)} />
                          <input type="hidden" name="submissionId" value={String(submission.id)} />
                          <Button type="submit" color="error" variant="outlined">
                            제출 삭제
                          </Button>
                        </Stack>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {!canWrite ? null : (
          <>
            <Divider />
            <Stack component="form" action={createSubmissionAction} spacing={1.5}>
              <input type="hidden" name="projectId" value={String(projectId)} />
              <input type="hidden" name="taskId" value={String(taskId)} />
              <TextField
                name="content"
                label="새 제출 내용"
                multiline
                minRows={5}
                placeholder="# 작업 결과\n\n- 진행 내용\n- 산출물 요약\n- 확인이 필요한 사항"
                helperText="Markdown과 체크리스트, 코드 블록, 링크를 사용할 수 있습니다."
                required
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <Button type="submit" variant="contained">
                  제출 등록
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}