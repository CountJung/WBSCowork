"use client";
import {useActionState,useState} from 'react';
import {Alert,Button,Checkbox,FormControlLabel,MenuItem,Paper,Stack,TextField,Typography} from '@mui/material';
import {taskTemplates,templatePreview,type TemplatePreviewNode} from '@/src/entities/task';
import SubmitButton from '@/src/shared/ui/submit-button';
type Props={projectId:number;startDate:string;users:{id:number;name:string}[];action:(form:FormData)=>Promise<{error:string}>};
export default function TaskTemplatePreview({projectId,startDate,users,action}:Props){
 const [templateKey,setTemplateKey]=useState(taskTemplates[0].key),[baseDate,setBaseDate]=useState(startDate),[nodes,setNodes]=useState<TemplatePreviewNode[]|null>(null),[excluded,setExcluded]=useState<string[]>([]),[token,setToken]=useState(''),[error,setError]=useState('');
 const [result,submit,pending]=useActionState(async (_previous:{error:string},form:FormData)=>action(form),{error:''});
 const template=taskTemplates.find(t=>t.key===templateKey)!;
 function preview(){try{setNodes(templatePreview(template,baseDate));setExcluded([]);setToken(crypto.randomUUID());setError('');}catch(e){setError(e instanceof Error?e.message:'미리보기를 확인해 주세요.');}}
 const included=(node:TemplatePreviewNode):boolean=>!excluded.includes(node.key)&&(!node.parentKey||Boolean(nodes?.some(parent=>parent.key===node.parentKey&&included(parent))));
 const selected=nodes?.filter(included)??[];
 function update(key:string,field:keyof TemplatePreviewNode,value:string|number|null){setNodes(current=>current?.map(node=>node.key===key?{...node,[field]:value}:node)??null);}
 return <Paper elevation={0} sx={{p:3,borderRadius:4}}><Stack spacing={2}>
 <Typography variant="h5">템플릿으로 업무 준비</Typography><Typography variant="body2">담당자는 자동 배정하지 않습니다. 미리보기에서 선택한 업무만 새로 만들며 기존 자료·파일·권한은 복제하지 않습니다.</Typography>
 {!nodes?<><Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField disabled={pending} select label="주제 템플릿" value={templateKey} onChange={e=>setTemplateKey(e.target.value)} fullWidth>{taskTemplates.map(t=><MenuItem key={t.key} value={t.key}>{t.name} v{t.version}</MenuItem>)}</TextField><TextField disabled={pending} label="기준일" type="date" value={baseDate} onChange={e=>setBaseDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/></Stack><Button onClick={preview}>업무 미리보기</Button></>:null}
 {error?<Alert severity="error">{error}</Alert>:null}
 {nodes?<Stack component="form" action={submit} spacing={2}>
 {result.error?<Alert severity="error">{result.error}</Alert>:null}
 <input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="templateKey" value={template.key}/><input type="hidden" name="templateVersion" value={template.version}/><input type="hidden" name="operationToken" value={token}/><input type="hidden" name="nodes" value={JSON.stringify(selected)}/>
 <Alert severity="info">상위 업무를 제외하면 그 하위도 제외됩니다. 계층은 업무 분해이며 선행 조건은 자동 생성하지 않습니다. 모든 업무는 검토 없는 예정 상태로 만들고 시작 전에 검토 방식을 조정할 수 있습니다.</Alert>
 {nodes.map(node=><Paper variant="outlined" key={node.key} sx={{p:2,ml:{sm:node.parentKey?3:0}}}><Stack spacing={1.5}>
 <FormControlLabel control={<Checkbox disabled={pending} checked={!excluded.includes(node.key)} onChange={e=>setExcluded(old=>e.target.checked?old.filter(k=>k!==node.key):[...old,node.key])}/>} label={`${node.parentKey?'하위 업무: ':''}${node.title} 포함`}/>
 {!included(node)?<Typography>생성에서 제외됨</Typography>:<>
 <TextField disabled={pending} label="제목" value={node.title} onChange={e=>update(node.key,'title',e.target.value)} required slotProps={{htmlInput:{maxLength:255}}}/>
 {(['description','deliverable','definitionOfDone'] as const).map((field,i)=><TextField disabled={pending} key={field} label={['설명','기대 산출물','완료 기준'][i]} value={node[field]} onChange={e=>update(node.key,field,e.target.value)} multiline slotProps={{htmlInput:{maxLength:2000}}}/>)}
 <TextField disabled={pending} select label="담당자" value={node.assigneeId??''} onChange={e=>update(node.key,'assigneeId',e.target.value?Number(e.target.value):null)}><MenuItem value="">미배정</MenuItem>{users.map(u=><MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField>
 <Stack direction={{xs:'column',sm:'row'}} spacing={1.5}>{(['startDate','endDate'] as const).map((field,i)=><TextField disabled={pending} key={field} label={i?'종료일':'시작일'} type="date" value={node[field]} onChange={e=>update(node.key,field,e.target.value)} required fullWidth slotProps={{inputLabel:{shrink:true}}}/>)}</Stack></>}
 </Stack></Paper>)}
 <Stack direction={{xs:'column',sm:'row'}} spacing={1}><SubmitButton disabled={!selected.length} pendingLabel="템플릿 업무 생성 중…" variant="contained">선택한 {selected.length}개 업무 생성</SubmitButton><Button disabled={pending} type="button" onClick={()=>setNodes(null)}>미리보기 취소</Button></Stack>
 </Stack>:null}
 </Stack></Paper>;
}
