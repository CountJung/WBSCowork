"use client";
import {useId,useState} from 'react';
import {MenuItem,Stack,TextField,Typography} from '@mui/material';
import type {Task,TaskStatus} from '@/src/entities/task';
import SubmitButton from '@/src/shared/ui/submit-button';
export default function TaskStatusForm({task,projectId,returnTo,teamId,action}:{task:Task;projectId:number;returnTo?:string;teamId?:string;action:(data:FormData)=>Promise<void>}){
 const [token]=useState(()=>crypto.randomUUID()),[status,setStatus]=useState<TaskStatus>(['planned','in_progress','blocked','done'].includes(task.status)?task.status:'in_progress'),[noteError,setNoteError]=useState('');
 const id=useId(),required=status==='blocked'||(task.status==='done'&&status!=='done')||(task.completionMode==='submission_required'&&status==='done');
 const reason=status==='blocked'?'차단 사유를 입력해 주세요.':task.status==='done'&&status!=='done'?'완료 업무를 다시 여는 사유를 입력해 주세요.':required?'완료 근거를 입력해 주세요.':'진행 메모를 선택해서 남길 수 있습니다.';
 return <Stack component="form" action={action} spacing={1.5} data-testid={`task-status-${task.id}`}>
 {Object.entries({projectId:String(projectId),taskId:String(task.id),version:String(task.version),operationToken:token,returnTo:returnTo??'',teamId:teamId??''}).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
 <Typography variant="h6">진행 상태</Typography><TextField select name="taskStatus" label="진행 상태 · 필수" value={status} required onChange={e=>{setStatus(e.target.value as TaskStatus);setNoteError('');}}><MenuItem value="planned">예정</MenuItem><MenuItem value="in_progress">진행 중</MenuItem><MenuItem value="blocked">차단됨</MenuItem>{!task.reviewRequired||task.status==='done'?<MenuItem value="done" disabled={task.reviewRequired}>{task.reviewRequired?'완료 · 검토 승인됨':'완료'}</MenuItem>:null}</TextField>
 <TextField id={`${id}-note`} name="note" label={`상태 메모 · ${required?'필수':'선택'}`} required={required} error={!!noteError} onInvalid={()=>setNoteError(reason)} onChange={()=>setNoteError('')} helperText={noteError||`${reason} 이 업무를 조회할 수 있는 사용자에게 보이는 기록입니다. 비공개 제출 내용은 적지 마세요.`} multiline slotProps={{htmlInput:{maxLength:2000}}}/>
 <SubmitButton pendingLabel="상태 저장 중…" variant="contained" sx={{alignSelf:'flex-start'}}>상태 저장</SubmitButton></Stack>;
}
