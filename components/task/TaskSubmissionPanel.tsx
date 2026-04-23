import { Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Comment } from "@/models/comment";
import type { Submission } from "@/models/submission";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskSubmissionPanelProps = {
  canWrite: boolean;
  commentsBySubmissionId: Map<number, Comment[]>;
  createCommentAction: ContentAction;
  createSubmissionAction: ContentAction;
  deleteCommentAction: ContentAction;
  deleteSubmissionAction: ContentAction;
  projectId: number;
  submissions: Submission[];
  taskId: number;
  taskTitle: string;
  updateCommentAction: ContentAction;
  updateSubmissionAction: ContentAction;
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

function MarkdownContent({ content }: { content: string }) {
  return (
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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

export default function TaskSubmissionPanel({
  canWrite,
  commentsBySubmissionId,
  createCommentAction,
  createSubmissionAction,
  deleteCommentAction,
  deleteSubmissionAction,
  projectId,
  submissions,
  taskId,
  taskTitle,
  updateCommentAction,
  updateSubmissionAction,
}: TaskSubmissionPanelProps) {
  const totalCommentCount = submissions.reduce(
    (count, submission) => count + (commentsBySubmissionId.get(submission.id)?.length ?? 0),
    0,
  );

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "action.hover" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">제출물</Typography>
            <Typography variant="body2" color="text.secondary">
              {taskTitle} 작업에 연결된 산출물과 피드백입니다. Markdown 본문으로 결과와 검토 사항을 함께 기록할 수 있습니다.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip label={`제출 ${submissions.length}`} color="primary" variant="outlined" />
            <Chip label={`댓글 ${totalCommentCount}`} color="secondary" variant="outlined" />
          </Stack>
        </Stack>

        {submissions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            아직 등록된 제출물이 없습니다.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {submissions.map((submission) => {
              const comments = commentsBySubmissionId.get(submission.id) ?? [];

              return (
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

                  <MarkdownContent content={submission.content} />

                  <Divider />
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">댓글</Typography>
                        <Typography variant="body2" color="text.secondary">
                          제출물에 대한 보완 요청, 검토 메모, 승인 의견을 남길 수 있습니다.
                        </Typography>
                      </Stack>
                      <Chip label={`댓글 ${comments.length}`} size="small" color="secondary" variant="outlined" />
                    </Stack>

                    {comments.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        아직 등록된 댓글이 없습니다.
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {comments.map((comment) => (
                          <Paper key={comment.id} elevation={0} sx={{ p: 1.5, borderRadius: 3, bgcolor: "background.default" }}>
                            <Stack spacing={1.25}>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                                <Stack spacing={0.25}>
                                  <Typography variant="subtitle2">{comment.authorName}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {comment.authorEmail} · {formatDateTime(comment.createdAt)}
                                  </Typography>
                                </Stack>
                              </Stack>

                              <MarkdownContent content={comment.content} />

                              {!canWrite ? null : (
                                <>
                                  <Divider />
                                  <Stack spacing={1.25}>
                                    <Stack component="form" action={updateCommentAction} spacing={1.25}>
                                      <input type="hidden" name="projectId" value={String(projectId)} />
                                      <input type="hidden" name="taskId" value={String(taskId)} />
                                      <input type="hidden" name="submissionId" value={String(submission.id)} />
                                      <input type="hidden" name="commentId" value={String(comment.id)} />
                                      <TextField name="content" label="댓글 수정" defaultValue={comment.content} multiline minRows={3} />
                                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                        <Button type="submit" variant="outlined">
                                          댓글 수정
                                        </Button>
                                      </Stack>
                                    </Stack>
                                    <Stack component="form" action={deleteCommentAction}>
                                      <input type="hidden" name="projectId" value={String(projectId)} />
                                      <input type="hidden" name="taskId" value={String(taskId)} />
                                      <input type="hidden" name="submissionId" value={String(submission.id)} />
                                      <input type="hidden" name="commentId" value={String(comment.id)} />
                                      <Button type="submit" color="error" variant="outlined">
                                        댓글 삭제
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
                      <Stack component="form" action={createCommentAction} spacing={1.5}>
                        <input type="hidden" name="projectId" value={String(projectId)} />
                        <input type="hidden" name="taskId" value={String(taskId)} />
                        <input type="hidden" name="submissionId" value={String(submission.id)} />
                        <TextField
                          name="content"
                          label="새 댓글"
                          multiline
                          minRows={3}
                          placeholder="- 보완이 필요한 항목\n- 확인한 결과\n- 다음 작업 제안"
                          helperText="Markdown과 체크리스트, 링크를 사용할 수 있습니다."
                          required
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                          <Button type="submit" variant="outlined">
                            댓글 등록
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </Stack>

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
              );
            })}
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