"use client";
import { useState } from 'react';
import { Alert,Button,Checkbox,FormControlLabel,Stack,Typography } from '@mui/material';
import SubmitButton from '@/src/shared/ui/submit-button';
import {taskStatusLabels,type Task,type DependencySnapshot} from '@/src/entities/task';
export default function TaskDependencyPanel({task,tasks,snapshot,canWrite,setTaskPredecessorsAction}:{setTaskPredecessorsAction:(form:FormData)=>Promise<void>;task:Task;tasks:Task[];snapshot:DependencySnapshot;canWrite:boolean}) {
 const [token]=useState(()=>crypto.randomUUID()),[editing,setEditing]=useState(false);
 const predecessors=snapshot.edges.filter(e=>e.taskId===task.id).map(e=>tasks.find(t=>t.id===e.predecessorId)).filter((t):t is Task=>Boolean(t));
 const pending=predecessors.filter(t=>t.status!=='done');
 return <Stack spacing={1}>
  <Typography variant="subtitle2">선행 업무 · WBS 상하위와 별도</Typography>
  {predecessors.length?predecessors.map(t=><Button key={t.id} href={`/tasks?projectId=${task.projectId}&taskId=${t.id}`} sx={{alignSelf:'flex-start'}}>#{t.id} {t.title} · {taskStatusLabels[t.status]} {t.status==='done'?'(조건 충족)':'(완료 대기)'}</Button>):<Typography variant="body2">선행 조건 없음</Typography>}
  {pending.length?<Alert severity="warning">미완료 선행 업무 {pending.length}개. 시작·검토 요청·완료 전 선행 조건을 충족해야 합니다.{task.status==='done'?' 기존 완료 이력은 유지됩니다.':''}</Alert>:null}
  {canWrite&&['planned','blocked'].includes(task.status)?<Button onClick={()=>setEditing(!editing)} sx={{alignSelf:'flex-start'}}>{editing?'선행 관계 편집 취소':'선행 관계 편집'}</Button>:null}
  {editing?<Stack component="form" action={setTaskPredecessorsAction} spacing={1}>
   <input type="hidden" name="taskId" value={task.id}/><input type="hidden" name="version" value={task.version}/><input type="hidden" name="graphVersion" value={snapshot.version}/><input type="hidden" name="operationToken" value={token}/>
   <Typography variant="body2">같은 프로젝트에서 최대 20개. 예정/차단 상태에서만 변경하며 일정은 자동 이동하지 않습니다.</Typography>
   {tasks.filter(t=>t.id!==task.id).map(t=><FormControlLabel key={t.id} control={<Checkbox name="predecessorId" value={t.id} defaultChecked={predecessors.some(p=>p.id===t.id)}/>} label={t.title}/>)}
   <SubmitButton pendingLabel="선행 관계 저장 중…">선행 관계 저장</SubmitButton>
  </Stack>:null}
 </Stack>;
}
