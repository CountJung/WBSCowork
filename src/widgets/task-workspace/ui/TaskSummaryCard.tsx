import {Button,Chip,Paper,Stack,Typography} from '@mui/material';
import type {Task} from '@/src/entities/task';
import {taskStatusLabels} from '@/src/entities/task';
import {formatDate} from '@/src/shared/lib/date';
export default function TaskSummaryCard({task,href,submissionCount,childCount=0}:{task:Task;href:string;submissionCount?:number;childCount?:number}){
 return <Paper component="article" tabIndex={-1} id={`task-${task.id}`} data-testid={`task-summary-${task.id}`} elevation={0} sx={{p:{xs:2,sm:2.5},borderRadius:3,border:'1px solid',borderColor:'divider',borderLeft:'4px solid',borderLeftColor:task.parentId?'secondary.main':'primary.main',ml:{xs:0,md:Math.min(task.depth,3)*2},minWidth:0}}>
 <Stack spacing={1.25} sx={{minWidth:0,overflowWrap:'anywhere'}}><Typography component="h3" variant="h6">{task.parentId?<Typography component="span" variant="caption" color="text.secondary">하위 업무 · </Typography>:null}{task.title}</Typography>
 <Stack direction="row" spacing={0.75} useFlexGap sx={{flexWrap:'wrap','& .MuiChip-root':{maxWidth:'100%',height:'auto'},'& .MuiChip-label':{whiteSpace:'normal',py:0.5,overflowWrap:'anywhere'}}}><Chip size="small" label={taskStatusLabels[task.status]} color={task.status==='done'?'success':'default'}/>{task.activityTeamName?<Chip size="small" variant="outlined" label={task.activityTeamName}/>:null}{typeof submissionCount==='number'?<Chip size="small" variant="outlined" label={`제출 ${submissionCount}`}/>:null}{childCount?<Chip size="small" variant="outlined" label={`하위 업무 ${childCount}`}/>:null}</Stack>
 <Typography variant="body2" color="text.secondary">담당 {task.assigneeName??'미지정'} · {formatDate(task.startDate)} ~ {formatDate(task.endDate)}</Typography><Button href={href} variant="text" sx={{alignSelf:'flex-start',px:0}}>업무 상세</Button></Stack></Paper>;
}
