import {Button,Paper,Stack,Typography} from '@mui/material';
import {projectWorkSummary,type Task,type TaskDependency} from '@/src/entities/task';
export default function ProjectWorkSummary({tasks,edges}:{tasks:Task[];edges:TaskDependency[]}) {
 const summary=projectWorkSummary(tasks,edges,new Date().toISOString().slice(0,10));
 const groups=[['unassigned','미배정',summary.unassigned],['overdue','기한 초과',summary.overdue],['blocked','차단',summary.blocked],['review','검토 대기',summary.review]] as const;
 return <Paper sx={{p:3,borderRadius:4}} elevation={0}><Stack spacing={2}><Typography variant="h5">다음 행동이 필요한 업무</Typography><Stack direction="row" useFlexGap sx={{flexWrap:"wrap"}} spacing={1}>{groups.map(([id,label,items])=><Button key={id} href={`#summary-${id}`} variant="outlined">{label} {items.length}</Button>)}</Stack><Typography variant="body2">묶음 카드를 포함한 현재 업무 수입니다. 완료율은 아래 간트의 말단 업무 기준이며, 날짜 경과는 완료가 아닙니다.</Typography>{groups.map(([id,label,items])=><Stack id={`summary-${id}`} key={id} spacing={0.5} sx={{scrollMarginTop:100}}><Typography variant="subtitle2">{label} {items.length}개</Typography>{items.length?items.map(t=><Button key={t.id} href={`/tasks?projectId=${t.projectId}&taskId=${t.id}`} sx={{alignSelf:'flex-start'}}>#{t.id} {t.title}</Button>):<Typography variant="body2">해당 업무 없음</Typography>}</Stack>)}</Stack></Paper>;
}
