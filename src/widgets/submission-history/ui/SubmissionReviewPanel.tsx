"use client";

import { useState } from "react";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useFormStatus } from "react-dom";
type ReviewActions = { requestAction: (form: FormData) => Promise<void>; decideAction: (form: FormData) => Promise<void>; cancelAction: (form: FormData) => Promise<void> };

type Context = {
  taskId: number; taskVersion: number; status: string; reviewRequired: boolean;
  selected: boolean; reviewerName: string | null; canRequest: boolean;
  canDecide: boolean; canCancelOrReopen: boolean; unavailableReason: string | null;
};
function OperationFields({ context, submissionId, revisionNumber }: { context: Context; submissionId: number; revisionNumber: number }) {
  const [token] = useState(() => crypto.randomUUID());
  return <><input type="hidden" name="taskId" value={context.taskId}/><input type="hidden" name="submissionId" value={submissionId}/><input type="hidden" name="revisionNumber" value={revisionNumber}/><input type="hidden" name="expectedTaskVersion" value={context.taskVersion}/><input type="hidden" name="operationToken" value={token}/></>;
}
function Submit({ children, name, value }: { children: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" name={name} value={value} disabled={pending} variant="contained">{pending ? "저장 중…" : children}</Button>;
}
export default function SubmissionReviewPanel({ context, submissionId, revisionNumber, result, returnTo, requestAction, decideAction, cancelAction }: { context: Context; submissionId: number; revisionNumber: number; result?: string; returnTo?:string } & ReviewActions) {
  const fields = <><OperationFields context={context} submissionId={submissionId} revisionNumber={revisionNumber}/><input type="hidden" name="returnTo" value={returnTo??""}/></>;
  return <Paper sx={{ p: 3 }}><Stack spacing={2}>
    <Typography variant="h6">이 버전의 업무 검토</Typography>
    {result === "saved" ? <Alert severity="success">검토 상태와 이력을 저장했습니다.</Alert> : null}
    {result === "error" ? <Alert severity="error">저장하지 못했습니다. 현재 버전·담당자·검토자와 권한을 확인한 뒤 다시 시도해 주세요.</Alert> : null}
    {!context.reviewRequired ? <Typography>검토 선택사항인 업무입니다. 담당자 또는 관리자가 업무 카드에서 완료 기준과 근거를 확인하고 완료합니다.</Typography> : <>
      <Typography>지정 검토자: {context.reviewerName ?? "미지정"}</Typography>
      <Typography color="text.secondary">검토자 지정으로 비공개 열람 권한이 추가되지 않습니다. 작성자·담당자·이 버전의 편집자는 자체 승인할 수 없습니다.</Typography>
      {context.selected ? <Alert severity={context.status === "done" ? "success" : "info"}>{context.status === "done" ? "이 버전이 승인되어 업무가 완료되었습니다." : context.status === "changes_requested" ? "보완 요청된 버전입니다. 새 버전을 만든 뒤 다시 검토를 요청하세요." : "이 버전의 검토를 기다리고 있습니다."}</Alert> : null}
      {!context.canRequest && !context.canDecide && context.unavailableReason ? <Typography color="text.secondary">{context.unavailableReason}</Typography> : null}
      {context.canRequest ? <form action={requestAction} key={`request:${context.taskVersion}:${revisionNumber}`}><Stack spacing={1}>{fields}<Submit>이 버전 검토 요청</Submit></Stack></form> : null}
      {context.canDecide ? <form action={decideAction} key={`decide:${context.taskVersion}:${revisionNumber}`}><Stack spacing={2}>{fields}<TextField name="reason" label="검토 의견·판정 근거" required multiline minRows={3} slotProps={{ htmlInput: { maxLength: 2000 } }} helperText="이 제출물을 볼 수 있는 사람에게만 보이는 기록입니다."/><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Submit name="decision" value="approved">이 버전 승인</Submit><Submit name="decision" value="changes_requested">보완 요청</Submit></Stack></Stack></form> : null}
      {context.canCancelOrReopen ? <form action={cancelAction} key={`cancel:${context.taskVersion}:${revisionNumber}`}><Stack spacing={2}>{fields}<TextField name="reason" label="검토 취소·다시 열기 사유" required multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }}/><Submit>{context.status === "done" ? "승인 이력을 남기고 다시 열기" : "검토를 취소하고 다시 진행"}</Submit></Stack></form> : null}
    </>}
  </Stack></Paper>;
}
