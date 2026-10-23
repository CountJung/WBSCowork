"use client";

import { useCallback, useEffect, useRef, useState, useTransition, useId, type FormEvent } from "react";
import { Alert, Box, Button, Checkbox, Chip, Divider, FormControl, FormControlLabel, FormLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import FieldLabel from "@/src/shared/ui/field-label";
import ValidatedTextField from "@/src/shared/ui/validated-text-field";
import DeleteConfirmation from "./DeleteConfirmation";
import MarkdownContent from "@/src/shared/ui/markdown-content";
import SubmitButton from "@/src/shared/ui/submit-button";
import type { Comment } from "@/src/entities/comment";
import { AttachmentFile, type SubmissionAttachment, type Submission } from "@/src/entities/submission";

type ContentAction = (formData: FormData) => Promise<void>;

export type SubmissionSummary = Pick<Submission,"id"|"authorName"|"createdAt"|"currentRevision"|"visibility"> & {attachmentCount:number;commentCount:number};

type TaskSubmissionPanelProps = {
  teamId?:string;
  selectedSubmissionId?:number|null;
  summaries?:SubmissionSummary[];
  returnTo?: string;
  canWrite: boolean;
  currentUserId:number|null;
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

// Handle transport rejection before it reaches the page error boundary. Native
// form actions remain available before hydration; manual submission retains drafts.
function useSubmissionUpload(action: ContentAction) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    inFlight.current = true;
    setError("");
    startTransition(async () => {
      try {
        await action(data);
      } catch (failure) {
        // Redirects include validation/authentication results and belong to the router.
        if (failure && typeof failure === "object" && "digest" in failure && String(failure.digest).startsWith("NEXT_REDIRECT")) throw failure;
        setError("업로드 연결이 끊겼습니다. 입력과 첨부를 유지했습니다. 저장 여부를 목록에서 확인한 뒤 다시 시도해 주세요.");
      } finally {
        inFlight.current = false;
      }
    });
  }
  return { submit, pending, error, clearError: () => setError("") };
}

function SubmissionOperationFields({revision}:{revision?:number}) {
  const [token]=useState(()=>crypto.randomUUID());
  return <><input type="hidden" name="operationToken" value={token}/>{revision?<input type="hidden" name="expectedRevision" value={revision}/>:null}</>;
}

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

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function FilePreviewThumbnail({ file }: { file: File }) {
  const [objectUrl] = useState<string | null>(() =>
    isImageFile(file) ? URL.createObjectURL(file) : null,
  );

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!objectUrl) {
    return (
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "action.hover",
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", px: 0.5, fontSize: 10 }}>
          {file.name.split(".").pop()?.toUpperCase() ?? "파일"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={objectUrl}
      alt={file.name}
      sx={{
        width: 72,
        height: 72,
        borderRadius: 1.5,
        objectFit: "cover",
        border: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}

function AttachmentInput({ helperText }: { helperText: string }) {
  const labelId=useId();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0 || !inputRef.current) return;

    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    inputRef.current.files = dt.files;
    setSelectedFiles(files);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(e.target.files ?? []));
  }, []);

  const imageFiles = selectedFiles.filter(isImageFile);
  const otherFiles = selectedFiles.filter((f) => !isImageFile(f));

  return (
    <Stack spacing={0.75}>
      <Typography id={labelId} variant="caption" color="text.secondary">
        첨부파일 · 선택. {helperText}
      </Typography>

      {/* 항상 숨겨진 파일 인풋 — 폼 제출에 사용 */}
      <Box
        component="input"
        ref={inputRef}
        name="attachments"
        aria-label="첨부파일 선택"
        aria-describedby={labelId}
        type="file"
        multiple
        onChange={handleChange}
        sx={{ display: "none" }}
      />

      {/* 데스크탑: 드래그 드롭 영역 */}
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0} aria-label="첨부파일 선택"
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inputRef.current?.click();}}}
        sx={[
          {
            border: "2px dashed",
            borderColor: isDragging ? "primary.main" : "divider",
            borderRadius: 2,
            px: 2,
            py: 1.5,
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
            userSelect: "none",
            display: { xs: "none", sm: "flex" },
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
          },
          isDragging && {
            backgroundColor: "action.hover",
          },
        ]}
      >
        <Typography variant="body2" color={isDragging ? "primary.main" : "text.secondary"} sx={{ textAlign: "center" }}>
          {isDragging
            ? "파일을 놓으세요"
            : selectedFiles.length > 0
              ? `${selectedFiles.length}개 파일 선택됨`
              : "파일을 여기에 드래그하거나 클릭하여 선택"}
        </Typography>
        {selectedFiles.length === 0 && !isDragging && (
          <Typography variant="caption" color="text.disabled">
            여러 파일 동시 선택 가능
          </Typography>
        )}
      </Box>

      {/* 모바일: 간단한 선택 버튼 */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", display: { xs: "flex", sm: "none" } }}>
        <Button size="small" variant="outlined" onClick={() => inputRef.current?.click()}>
          파일 선택
        </Button>
        {selectedFiles.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {selectedFiles.length}개 선택됨
          </Typography>
        )}
      </Stack>

      {/* 선택된 이미지 썸네일 그리드 */}
      {imageFiles.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 1,
            mt: 0.5,
          }}
        >
          {imageFiles.map((file, idx) => (
            <Stack key={idx} spacing={0.25} sx={{ alignItems: "center" }}>
              <FilePreviewThumbnail file={file} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 9, textAlign: "center", wordBreak: "break-all", lineClamp: 2, overflow: "hidden", maxWidth: 72 }}
              >
                {file.name}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}

      {/* 비이미지 파일 목록 */}
      {otherFiles.length > 0 && (
        <Stack spacing={0.25} sx={{ mt: 0.25 }}>
          {otherFiles.map((file, idx) => (
            <Typography key={idx} variant="caption" color="text.secondary" sx={{overflowWrap:"anywhere"}}>
              📄 {file.name} ({formatFileSize(file.size)})
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function VisibilityRadio({ defaultValue = "public" }: { defaultValue?: string }) {
  const id=useId();
  return (
    <FormControl component="fieldset">
      <FormLabel id={id} component="legend" sx={{ typography: "caption", mb: 0.5 }}>
        공개 범위 · 필수
      </FormLabel>
      <RadioGroup aria-labelledby={id} name="visibility" defaultValue={defaultValue} row>
        <FormControlLabel value="public" control={<Radio size="small" />} label="공개" />
        <FormControlLabel value="private" control={<Radio size="small" />} label="비공개 (본인 및 관리자만)" />
      </RadioGroup>
    </FormControl>
  );
}

export default function TaskSubmissionPanel({canWrite,currentUserId,canSeeAllSubmissions,commentsBySubmissionId,attachmentsBySubmissionId,createCommentAction,createSubmissionAction,deleteCommentAction,deleteSubmissionAction,deleteAttachmentAction,projectId,submissions,taskId,taskTitle,returnTo,teamId,selectedSubmissionId,summaries=[],updateCommentAction,updateSubmissionAction}:TaskSubmissionPanelProps){
 const [editingSubmissionId,setEditingSubmissionId]=useState<number|null>(null),[editingCommentId,setEditingCommentId]=useState<number|null>(null),[showCreate,setShowCreate]=useState(false),[showComment,setShowComment]=useState(false);
 const createUpload=useSubmissionUpload(createSubmissionAction);
 const editUpload=useSubmissionUpload(async data=>{await updateSubmissionAction(data);setEditingSubmissionId(null);});
 const query=new URLSearchParams({projectId:String(projectId),taskId:String(taskId),...(teamId?{teamId}:{}),...(returnTo?{returnTo}:{})});
 const taskHref=`/tasks?${query.toString()}#task-${taskId}`;
 const selected=submissions.find(submission=>submission.id===selectedSubmissionId);
 const fields=(submissionId?:number)=>({projectId:String(projectId),taskId:String(taskId),returnTo:returnTo??'',teamId:teamId??'',...(submissionId?{submissionId:String(submissionId)}:{})});
 const hidden=(submissionId?:number)=>Object.entries(fields(submissionId)).map(([name,value])=><input type="hidden" name={name} value={value} key={name}/>);
 const comments=selected?commentsBySubmissionId[selected.id]??[]:[],attachments=selected?attachmentsBySubmissionId[selected.id]??[]:[];
 const canEdit=!!selected&&canWrite&&(canSeeAllSubmissions||currentUserId===selected.authorId);
 const chips={flexWrap:'wrap',alignItems:'flex-start','& .MuiChip-root':{maxWidth:'100%',height:'auto'},'& .MuiChip-label':{whiteSpace:'normal',overflowWrap:'anywhere',py:0.5}} as const;
 return <Stack spacing={2} sx={{minWidth:0,overflowWrap:'anywhere'}}>
 <Stack direction="row" spacing={1} useFlexGap sx={chips}><Typography component="h3" variant="h6">{selected?'제출 상세':'제출물'}</Typography><Chip size="small" label={`${summaries.length}건`} variant="outlined"/></Stack>
 {selected?<Paper elevation={0} id={`submission-${selected.id}`} tabIndex={-1} data-testid={`submission-detail-${selected.id}`} sx={{p:{xs:2,sm:2.5},border:'1px solid',borderColor:'divider',borderRadius:3,minWidth:0}}><Stack spacing={2}>
 <Button href={taskHref} sx={{alignSelf:'flex-start',px:0}}>업무 상세로 돌아가기</Button>
 <Typography component="h4" variant="subtitle1">{selected.authorName}의 제출물</Typography><Typography variant="caption" color="text.secondary">{formatDateTime(selected.createdAt)}</Typography>
 <Stack direction="row" spacing={0.75} useFlexGap sx={chips}><Chip size="small" label={selected.visibility==='private'?'비공개':'공개'} color={selected.visibility==='private'?'warning':'success'} variant="outlined"/><Chip size="small" label={`현재 v${selected.currentRevision}`} variant="outlined"/></Stack>
 {selected.materialUrl?<Button component="a" href={selected.materialUrl} target="_blank" rel="noopener noreferrer" sx={{alignSelf:'flex-start',textAlign:'left',overflowWrap:'anywhere'}}>자료 링크: {selected.materialUrl}</Button>:null}
 <MarkdownContent content={selected.content}/><Divider/><Typography component="h4" variant="subtitle1">첨부파일</Typography>
 {selected.filePath&&selected.fileName?<AttachmentFile key={`legacy-${selected.id}-${selected.currentRevision}`} fileName={selected.fileName} fileMimeType={selected.fileMimeType} fileSizeBytes={selected.fileSizeBytes} downloadUrl={`/api/submissions/${selected.id}/attachment`} deleteForm={null}/>:null}
 {attachments.map(attachment=><AttachmentFile key={attachment.id} fileName={attachment.fileName} fileMimeType={attachment.fileMimeType} fileSizeBytes={attachment.fileSizeBytes} downloadUrl={`/api/submission-attachments/${attachment.id}`} deleteForm={canEdit?<DeleteConfirmation id={`attachment-exclude-${attachment.id}`} triggerLabel="첨부 제외…" warning="새 버전에서 이 첨부를 제외합니다. 이전 버전의 파일은 보존됩니다." confirmLabel="현재 버전에서 제외" checkboxLabel="현재 버전에서만 제외함을 확인했습니다" fields={{...fields(selected.id),attachmentId:String(attachment.id)}} action={deleteAttachmentAction}><SubmissionOperationFields revision={selected.currentRevision}/></DeleteConfirmation>:null}/>)}
 {!selected.filePath&&!attachments.length?<Typography variant="body2" color="text.secondary">첨부파일이 없습니다.</Typography>:null}
 <Button href={`/submissions/${selected.id}?${new URLSearchParams({...(returnTo?{returnTo}:{}),...(teamId?{teamId}:{})})}`} sx={{alignSelf:'flex-start'}}>버전·검토 이력</Button>
 <Divider/><Typography component="h4" variant="subtitle1">댓글 · {comments.length}건</Typography>
 {!comments.length?<Typography variant="body2" color="text.secondary">첫 의견을 남겨 보세요.</Typography>:null}
 {comments.map(comment=><Paper key={comment.id} variant="outlined" sx={{p:2,borderRadius:2,minWidth:0}}><Stack spacing={1.25}><Typography variant="subtitle2">{comment.authorName}</Typography><Typography variant="caption" color="text.secondary">{formatDateTime(comment.createdAt)} · {comment.revisionNumber?`v${comment.revisionNumber}`:'이력 도입 이전'}</Typography><MarkdownContent content={comment.content}/>
 {canWrite&&(canSeeAllSubmissions||currentUserId===comment.authorId)?editingCommentId===comment.id?<Stack component="form" action={async data=>{await updateCommentAction(data);setEditingCommentId(null);}} spacing={1.5}>{hidden(selected.id)}<input type="hidden" name="commentId" value={comment.id}/><ValidatedTextField name="content" label={<FieldLabel requirement="required">댓글 수정</FieldLabel>} required defaultValue={comment.content} multiline minRows={3}/><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><SubmitButton pendingLabel="댓글 저장 중…">저장</SubmitButton><Button type="button" onClick={()=>setEditingCommentId(null)}>취소</Button></Stack></Stack>:<Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Button size="small" onClick={()=>setEditingCommentId(comment.id)}>댓글 수정</Button><DeleteConfirmation id={`comment-delete-${comment.id}`} triggerLabel="댓글 삭제…" warning="이 댓글을 영구 삭제합니다. 복원할 수 없습니다." checkboxLabel="댓글 영구 삭제를 확인했습니다" fields={{...fields(selected.id),commentId:String(comment.id)}} action={deleteCommentAction}/></Stack>:null}
 </Stack></Paper>)}
 {canWrite?!showComment?<Button sx={{alignSelf:'flex-start'}} onClick={()=>setShowComment(true)}>댓글 작성</Button>:<Stack component="form" action={createCommentAction} spacing={1.5}>{hidden(selected.id)}<input type="hidden" name="revisionNumber" value={selected.currentRevision}/><ValidatedTextField name="content" label={<FieldLabel requirement="required">새 댓글</FieldLabel>} required multiline minRows={3} helperText="이 제출물의 현재 버전에 의견을 남깁니다. 댓글은 승인으로 처리되지 않습니다."/><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><SubmitButton pendingLabel="댓글 등록 중…" variant="outlined">댓글 등록</SubmitButton><Button type="button" onClick={()=>setShowComment(false)}>댓글 취소</Button></Stack></Stack>:null}
 {canEdit?<><Divider/>{editingSubmissionId===selected.id?<Stack component="form" action={updateSubmissionAction} onSubmit={editUpload.submit} key={`${selected.id}:${selected.currentRevision}:edit`} spacing={1.5}>{hidden(selected.id)}<SubmissionOperationFields revision={selected.currentRevision}/><TextField name="materialUrl" label={<FieldLabel>자료 링크</FieldLabel>} defaultValue={selected.materialUrl} slotProps={{htmlInput:{maxLength:2048}}}/><ValidatedTextField name="changeSummary" label={<FieldLabel requirement="required">이번 버전의 변경 내용</FieldLabel>} required multiline slotProps={{htmlInput:{maxLength:2000}}}/><ValidatedTextField name="content" label={<FieldLabel requirement="required">새 버전의 제출 내용</FieldLabel>} required defaultValue={selected.content} multiline minRows={4}/><VisibilityRadio defaultValue={selected.visibility}/><AttachmentInput helperText="추가 파일을 선택합니다. 이전 버전과 파일은 보존됩니다."/>{selected.filePath?<FormControlLabel control={<Checkbox name="clearAttachment"/>} label="새 버전에서 기존 단일 첨부 제외 · 선택 (이전 버전 보존)"/>:null}{editUpload.error?<Alert severity="error">{editUpload.error}</Alert>:null}<Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><SubmitButton pending={editUpload.pending} pendingLabel="제출물 저장 중…" variant="outlined">저장</SubmitButton><Button type="button" disabled={editUpload.pending} onClick={()=>setEditingSubmissionId(null)}>취소</Button></Stack></Stack>:<Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><Button size="small" variant="outlined" onClick={()=>{editUpload.clearError();setEditingSubmissionId(selected.id);}}>제출물 수정</Button><DeleteConfirmation id={`submission-delete-confirm-${selected.id}`} triggerLabel="제출물 삭제…" warning="이 제출물의 모든 버전·댓글·첨부파일을 영구 삭제합니다. 이전 버전도 복원할 수 없습니다." fields={fields(selected.id)} action={deleteSubmissionAction}/></Stack>}</>:null}
 </Stack></Paper>:<Stack spacing={1.5}>{!summaries.length?<Typography variant="body2" color="text.secondary">아직 제출물이 없습니다. 필요할 때 활동 기록이나 결과물을 남기세요.</Typography>:summaries.map(summary=>{const link=new URLSearchParams(query);link.set('submissionId',String(summary.id));return <Paper key={summary.id} variant="outlined" data-testid={`submission-summary-${summary.id}`} sx={{p:2,borderRadius:2,minWidth:0}}><Stack spacing={1}><Typography variant="subtitle2">{summary.authorName}의 제출물</Typography><Typography variant="caption" color="text.secondary">{formatDateTime(summary.createdAt)}</Typography><Stack direction="row" spacing={0.75} useFlexGap sx={chips}><Chip size="small" label={summary.visibility==='private'?'비공개':'공개'} variant="outlined"/><Chip size="small" label={`첨부 ${summary.attachmentCount}`} variant="outlined"/><Chip size="small" label={`댓글 ${summary.commentCount}`} variant="outlined"/></Stack><Button href={`/tasks?${link.toString()}#submission-${summary.id}`} sx={{alignSelf:'flex-start',px:0}}>제출 상세·댓글</Button></Stack></Paper>;})}</Stack>}
 {canWrite?<><Divider/>{!showCreate?<Button variant="outlined" sx={{alignSelf:'flex-start'}} onClick={()=>setShowCreate(true)}>제출물 등록…</Button>:<Stack key={`create:${summaries.map(s=>s.id).join(',')}`} component="form" action={createSubmissionAction} onSubmit={createUpload.submit} spacing={1.5}>{hidden()}<SubmissionOperationFields/><Typography component="h4" variant="subtitle1">{taskTitle}에 제출</Typography><TextField name="materialUrl" label={<FieldLabel>자료 링크</FieldLabel>} slotProps={{htmlInput:{maxLength:2048}}}/><ValidatedTextField name="content" label={<FieldLabel requirement="required">새 제출 내용</FieldLabel>} multiline minRows={5} helperText="제출물을 등록할 때 본문은 필수입니다. 업무의 직접 완료에는 제출물을 요구하지 않습니다." required/><VisibilityRadio/><AttachmentInput helperText="문서·이미지·압축파일 등을 선택할 수 있습니다."/>{createUpload.error?<Alert severity="error">{createUpload.error}</Alert>:null}<Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap'}}><SubmitButton pending={createUpload.pending} pendingLabel="제출 등록 중…" variant="contained">제출 등록</SubmitButton><Button type="button" disabled={createUpload.pending} onClick={()=>setShowCreate(false)}>등록 취소</Button></Stack></Stack>}</>:null}
 </Stack>;
}
