import {Alert,Button,Chip,Container,MenuItem,Paper,Stack,TextField,Typography} from '@mui/material';
import {redirect} from 'next/navigation';
import {getAuthSession,getSignInPath,getUserByEmail,listUserNames} from '@/src/entities/user/index.server';
import {listAllProjects} from '@/src/entities/project/index.server';
import {searchWork} from '@/src/entities/task/index.server';
import {parseWorkSearchFilters,workSearchPath,taskStatusLabels,type WorkSearchParams,type WorkSearchFilters} from '@/src/entities/task';
import {getDatabaseAdminStatus} from '@/src/shared/server/database-admin/index.server';
import {getRuntimeEnv} from '@/src/shared/server/runtime-env/index.server';
export default async function WorkSearchPage({searchParams}:{searchParams:WorkSearchParams}){
 const session=await getAuthSession();if(!session?.user)redirect(getSignInPath('/search'));
 let filters:WorkSearchFilters;try{filters=parseWorkSearchFilters(searchParams);}catch(error){return <Container sx={{py:5}}><Alert severity="error">{error instanceof Error?error.message:'검색 조건 오류'}</Alert><Button href="/search">검색 초기화</Button></Container>;}
 const unavailable=<Container sx={{py:5}}><Alert severity="info">검색 화면을 준비 중입니다. 잠시 후 다시 확인해 주세요.</Alert></Container>;
 if(!getRuntimeEnv().database.configured)return unavailable;
 const database=await getDatabaseAdminStatus();if(!['users','projects','tasks','submissions','submission_revisions','submission_attachments'].every(name=>database.tables.some(t=>t.name===name&&t.exists&&!t.missingColumns.length)))return unavailable;
 const user=await getUserByEmail(session.user.email??'');if(!user)return unavailable;
 const [result,projects,users]=await Promise.all([searchWork({viewerUserId:user.id,isSuperuser:session.user.isSuperuser},filters),listAllProjects(),listUserNames()]);
 const current={...filters,page:result.page};
 return <Container component="main" maxWidth="lg" sx={{py:{xs:4,md:6}}}><Stack spacing={3}>
 <Typography variant="h4">업무·산출물 검색</Typography><Typography color="text.secondary">업무 제목·설명과 제출 본문·파일명·작성자 이름에서 찾습니다. 파일 내용이나 외부 링크는 가져오지 않습니다.</Typography>
 <Paper elevation={0} sx={{p:3,borderRadius:3}}><Stack component="form" method="get" action="/search" spacing={2}>
 <TextField name="q" label="검색어" defaultValue={filters.q} slotProps={{htmlInput:{maxLength:160}}}/>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField select name="kind" label="대상" defaultValue={filters.kind} fullWidth><MenuItem value="all">업무와 제출물</MenuItem><MenuItem value="task">업무</MenuItem><MenuItem value="submission">제출물</MenuItem></TextField><TextField select name="versions" label="제출물 버전 범위" defaultValue={filters.versions} fullWidth><MenuItem value="latest">최신 버전</MenuItem><MenuItem value="approved">현재 승인된 버전</MenuItem><MenuItem value="all">이전 버전 포함</MenuItem></TextField></Stack>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField select name="projectId" label="프로젝트" defaultValue={filters.projectId??''} fullWidth><MenuItem value="">전체</MenuItem>{projects.map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField><TextField select name="assigneeId" label="담당자" defaultValue={filters.assigneeId??''} fullWidth><MenuItem value="">전체</MenuItem>{users.map(u=><MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField><TextField select name="status" label="업무 상태" defaultValue={filters.status} fullWidth><MenuItem value="all">전체</MenuItem>{Object.entries(taskStatusLabels).map(([v,label])=><MenuItem key={v} value={v}>{label}</MenuItem>)}</TextField></Stack>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField name="from" label="종료일 시작" type="date" defaultValue={filters.from} fullWidth slotProps={{inputLabel:{shrink:true}}}/><TextField name="to" label="종료일 끝" type="date" defaultValue={filters.to} fullWidth slotProps={{inputLabel:{shrink:true}}}/><TextField select name="overdue" label="기한" defaultValue={filters.overdue?'1':'0'} fullWidth><MenuItem value="0">전체</MenuItem><MenuItem value="1">UTC 오늘보다 지난 미완료</MenuItem></TextField></Stack>
 <Stack direction="row" spacing={1}><Button type="submit" variant="contained">검색</Button><Button href="/search">초기화</Button></Stack>
 </Stack></Paper>
 <Alert severity="info">최신 버전이 기본입니다. 현재 승인은 아직 취소·변경되지 않은 선택 승인본만 뜻하며 과거 승인 이력은 포함하지 않습니다. 이전 버전도 현재와 당시 공개 범위를 모두 만족해야 표시됩니다. 업무 카드에는 버전 필터를 적용하지 않습니다.</Alert>
 <Typography variant="h6">검색 결과 {result.total}건</Typography>
 {result.items.length?result.items.map(item=><Paper key={`${item.kind}:${item.id}:${item.revision??0}`} elevation={0} sx={{p:3,borderRadius:3}}><Stack spacing={1}>
 <Typography variant="body2" color="text.secondary">{item.projectName} · {item.kind==='task'?'업무':'제출물'} · 종료일 {item.endDate}</Typography><Typography variant="h6" sx={{overflowWrap:'anywhere'}}>{item.title}</Typography>
 <Stack direction="row" spacing={1} sx={{flexWrap:'wrap',gap:1}}><Chip size="small" label={taskStatusLabels[item.status]}/>{item.revision!==null?<Chip size="small" label={`v${item.revision} · ${item.approved?'현재 승인본':item.current?'최신본':'이전 버전'}`}/>:null}</Stack>
 {item.matchedFilename?<Typography variant="body2" sx={{overflowWrap:"anywhere"}}>일치한 파일명: {item.matchedFilename}</Typography>:null}
 {item.legacy?<Typography variant="caption">이력 도입 시점의 보존본</Typography>:null}
 {item.authorName?<Typography variant="body2">작성자 {item.authorName}</Typography>:null}<Typography sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.snippet}</Typography>
 <Button href={item.kind==='task'?`/tasks?projectId=${item.projectId}&taskId=${item.taskId}`:`/submissions/${item.id}?revision=${item.revision}`} sx={{alignSelf:'flex-start'}}>{item.kind==='task'?'업무 카드 열기':`v${item.revision} 열기`}</Button>
 </Stack></Paper>):<Typography>현재 조건에서 조회할 수 있는 결과가 없습니다.</Typography>}
 {result.total>0?<Stack component="nav" aria-label="검색 페이지" direction="row" spacing={2} sx={{justifyContent:'center',alignItems:'center'}}><Button disabled={result.page<=1} href={result.page>1?workSearchPath({...current,page:result.page-1}):undefined}>이전</Button><Typography>{result.page} / {result.pageCount}</Typography><Button disabled={result.page>=result.pageCount} href={result.page<result.pageCount?workSearchPath({...current,page:result.page+1}):undefined}>다음</Button></Stack>:null}
 {result.total>20000?<Alert severity="info">프로젝트·담당자·기한으로 검색 범위를 좁혀 주세요.</Alert>:null}
 </Stack></Container>;
}
