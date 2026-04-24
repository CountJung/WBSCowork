"use client";

import { useState } from "react";
import { Box, Button, Checkbox, Chip, Divider, FormControl, FormControlLabel, FormLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Comment } from "@/models/comment";
import type { SubmissionAttachment } from "@/models/submission-attachment";
import type { Submission } from "@/models/submission";

type ContentAction = (formData: FormData) => Promise<void>;

type TaskSubmissionPanelProps = {
  canWrite: boolean;
  canSeeAllSubmissions: boolean;
  commentsBySubmissionId: Record<number, Comment[]>;
  attachmentsBySubmissionId: Record<number, SubmissionAttachment[]>;
  createCommentAction: ContentAction;
  createSubmissionAction: ContentAction;
  deleteCommentAction: ContentAction;
  deleteSubmissionAction: ContentAction;
  deleteAttachmentAction: ContentAction;
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

function formatFileSize(sizeBytes: number | null) {
  if (!sizeBytes) {
    return null;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;

  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function AttachmentInput({ helperText }: { helperText: string }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="text.secondary">
        {helperText}
      </Typography>
      <Box component="input" name="attachments" type="file" multiple sx={{ font: "inherit", color: "text.secondary" }} />
    </Stack>
  );
}

function AttachmentPreview({
  mimeType,
  previewUrl,
  fileName,
}: {
  mimeType: string;
  previewUrl: string;
  fileName: string;
}) {
  if (mimeType.startsWith("image/")) {
    return (
      <Box
        component="img"
        src={previewUrl}
        alt={fileName}
        sx={{
          maxWidth: "100%",
          maxHeight: 400,
          borderRadius: 1,
          display: "block",
          objectFit: "contain",
          mt: 1,
        }}
      />
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <Box
        component="iframe"
        src={previewUrl}
        title={fileName}
        sx={{
          width: "100%",
          height: { xs: 300, sm: 480 },
          border: "none",
          borderRadius: 1,
          mt: 1,
        }}
      />
    );
  }

  return null;
}

type AttachmentRowProps = {
  fileName: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  downloadUrl: string;
  previewUrl: string;
  previewKey: string;
  openPreviews: Set<string>;
  onTogglePreview: (key: string) => void;
  deleteForm: React.ReactNode | null;
};

function AttachmentRow({
  fileName,
  fileMimeType,
  fileSizeBytes,
  downloadUrl,
  previewUrl,
  previewKey,
  openPreviews,
  onTogglePreview,
  deleteForm,
}: AttachmentRowProps) {
  const formattedSize = formatFileSize(fileSizeBytes);
  const canPreview = isPreviewable(fileMimeType);
  const isOpen = openPreviews.has(previewKey);

  return (
    <Stack spacing={0.75}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" }, flexWrap: "wrap" }}>
        <Button component="a" href={downloadUrl} variant="outlined" size="small" download>
          {fileName}
        </Button>
        {fileMimeType ? <Chip label={fileMimeType} size="small" variant="outlined" /> : null}
        {formattedSize ? <Chip label={formattedSize} size="small" variant="outlined" /> : null}
        {canPreview ? (
          <Button size="small" variant="text" onClick={() => onTogglePreview(previewKey)}>
            {isOpen ? "미리보기 닫기" : "미리보기"}
          </Button>
        ) : null}
        {deleteForm}
      </Stack>
      {isOpen && canPreview && fileMimeType ? (
        <AttachmentPreview mimeType={fileMimeType} previewUrl={previewUrl} fileName={fileName} />
      ) : null}
    </Stack>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <Box
      sx={[
        {
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
        },
        (theme) =>
          theme.applyStyles("dark", {
            "& pre": {
              bgcolor: "rgba(7, 13, 11, 0.72)",
            },
          }),
      ]}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

function VisibilityRadio({ defaultValue = "public" }: { defaultValue?: string }) {
  return (
    <FormControl component="fieldset">
      <FormLabel component="legend" sx={{ typography: "caption", mb: 0.5 }}>
        공개 범위
      </FormLabel>
      <RadioGroup name="visibility" defaultValue={defaultValue} row>
        <FormControlLabel value="public" control={<Radio size="small" />} label="공개" />
        <FormControlLabel value="private" control={<Radio size="small" />} label="비공개 (본인 및 관리자만)" />
      </RadioGroup>
    </FormControl>
  );
}

export default function TaskSubmissionPanel({
  canWrite,
  canSeeAllSubmissions,
  commentsBySubmissionId,
  attachmentsBySubmissionId,
  createCommentAction,
  createSubmissionAction,
  deleteCommentAction,
  deleteSubmissionAction,
  deleteAttachmentAction,
  projectId,
  submissions,
  taskId,
  taskTitle,
  updateCommentAction,
  updateSubmissionAction,
}: TaskSubmissionPanelProps) {
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set());
  const totalCommentCount = submissions.reduce(
    (count, submission) => count + (commentsBySubmissionId[submission.id]?.length ?? 0),
    0,
  );
  const totalAttachmentCount =
    submissions.reduce((count, s) => count + (attachmentsBySubmissionId[s.id]?.length ?? 0), 0) +
    submissions.filter((s) => s.filePath).length;

  function togglePreview(key: string) {
    setOpenPreviews((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  return (
    <Paper
      elevation={0}
      sx={[
        {
          p: 2.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(180deg, rgba(20, 99, 86, 0.05) 0%, rgba(255, 255, 255, 0.68) 100%)",
        },
        (theme) =>
          theme.applyStyles("dark", {
            background: "linear-gradient(180deg, rgba(110, 212, 196, 0.07) 0%, rgba(16, 24, 22, 0.74) 100%)",
            borderColor: "rgba(110, 212, 196, 0.16)",
          }),
      ]}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">제출물</Typography>
            <Typography variant="body2" color="text.secondary">
              {taskTitle} 작업에 연결된 산출물, 첨부파일, 피드백입니다. Markdown 본문과 파일 공유를 함께 사용할 수 있습니다.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip label={`제출 ${submissions.length}`} color="primary" variant="outlined" />
            <Chip label={`첨부 ${totalAttachmentCount}`} color="secondary" variant="outlined" />
            <Chip label={`댓글 ${totalCommentCount}`} variant="outlined" />
            {canSeeAllSubmissions ? (
              <Chip label="비공개 포함" color="warning" size="small" variant="outlined" />
            ) : null}
          </Stack>
        </Stack>
        {submissions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            아직 등록된 제출물이 없습니다.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {submissions.map((submission) => {
              const attachments = attachmentsBySubmissionId[submission.id] ?? [];
              const comments = commentsBySubmissionId[submission.id] ?? [];

              return (
                <Paper
                  key={submission.id}
                  elevation={0}
                  sx={[
                    {
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "background.paper",
                    },
                    (theme) =>
                      theme.applyStyles("dark", {
                        backgroundColor: "rgba(18, 27, 24, 0.92)",
                        borderColor: "rgba(110, 212, 196, 0.16)",
                      }),
                  ]}
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{submission.authorName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {submission.authorEmail} · {formatDateTime(submission.createdAt)}
                        </Typography>
                      </Stack>
                      <Chip
                        label={submission.visibility === "private" ? "비공개" : "공개"}
                        color={submission.visibility === "private" ? "warning" : "success"}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <MarkdownContent content={submission.content} />

                    <Divider />
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle2">첨부파일</Typography>

                      {/* 레거시 단일 파일 (기존 데이터 하위 호환) */}
                      {submission.filePath && submission.fileName ? (
                        <AttachmentRow
                          fileName={submission.fileName}
                          fileMimeType={submission.fileMimeType}
                          fileSizeBytes={submission.fileSizeBytes}
                          downloadUrl={`/api/submissions/${submission.id}/attachment`}
                          previewUrl={`/api/submissions/${submission.id}/attachment?inline=1`}
                          previewKey={`legacy-${submission.id}`}
                          openPreviews={openPreviews}
                          onTogglePreview={togglePreview}
                          deleteForm={null}
                        />
                      ) : null}

                      {/* 다중 첨부파일 */}
                      {attachments.map((attachment) => (
                        <AttachmentRow
                          key={attachment.id}
                          fileName={attachment.fileName}
                          fileMimeType={attachment.fileMimeType}
                          fileSizeBytes={attachment.fileSizeBytes}
                          downloadUrl={`/api/submission-attachments/${attachment.id}`}
                          previewUrl={`/api/submission-attachments/${attachment.id}?inline=1`}
                          previewKey={`att-${attachment.id}`}
                          openPreviews={openPreviews}
                          onTogglePreview={togglePreview}
                          deleteForm={
                            canWrite ? (
                              <Stack component="form" action={deleteAttachmentAction}>
                                <input type="hidden" name="projectId" value={String(projectId)} />
                                <input type="hidden" name="taskId" value={String(taskId)} />
                                <input type="hidden" name="submissionId" value={String(submission.id)} />
                                <input type="hidden" name="attachmentId" value={String(attachment.id)} />
                                <Button type="submit" color="error" size="small" variant="outlined">
                                  삭제
                                </Button>
                              </Stack>
                            ) : null
                          }
                        />
                      ))}

                      {!submission.filePath && attachments.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          첨부된 파일이 없습니다.
                        </Typography>
                      ) : null}
                    </Stack>

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
                            <Paper
                              key={comment.id}
                              elevation={0}
                              sx={[
                                {
                                  p: 1.5,
                                  borderRadius: 3,
                                  border: "1px solid",
                                  borderColor: "rgba(20, 99, 86, 0.08)",
                                  backgroundColor: "rgba(20, 99, 86, 0.05)",
                                },
                                (theme) =>
                                  theme.applyStyles("dark", {
                                    borderColor: "rgba(110, 212, 196, 0.12)",
                                    backgroundColor: "rgba(110, 212, 196, 0.08)",
                                  }),
                              ]}
                            >
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
                            <AttachmentInput helperText="새 파일 추가 첨부 (여러 파일 동시 선택 가능, 기존 첨부파일에 추가됩니다)" />
                            {submission.filePath ? (
                              <FormControlLabel control={<Checkbox name="clearAttachment" />} label="레거시 단일 첨부파일 제거" />
                            ) : null}
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
              <VisibilityRadio defaultValue="public" />
              <AttachmentInput helperText="문서, 이미지, 압축파일 등 여러 파일을 동시에 선택할 수 있습니다." />
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