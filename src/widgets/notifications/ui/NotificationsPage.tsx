import {Alert,Button,Chip,Container,Paper,Stack,Typography} from '@mui/material';
import {redirect} from 'next/navigation';
import {getAuthSession,getSignInPath,getUserByEmail} from '@/src/entities/user/index.server';
import {listNotifications} from '@/src/entities/notification/index.server';
import {notificationLabels,parseNotificationFilters} from '@/src/entities/notification';
import {markNotificationReadAction} from '@/src/features/notifications/index.server';
import {getDatabaseAdminStatus} from '@/src/shared/server/database-admin/index.server';
import {getRuntimeEnv} from '@/src/shared/server/runtime-env/index.server';
import SubmitButton from '@/src/shared/ui/submit-button';
export default async function NotificationsPage({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){
 const session=await getAuthSession();if(!session?.user)redirect(getSignInPath('/notifications'));
 let filters;try{filters=parseNotificationFilters(searchParams);}catch(error){return <Container sx={{py:5}}><Alert severity="error">{error instanceof Error?error.message:'알림 조건 오류'}</Alert><Button href="/notifications">알림으로 돌아가기</Button></Container>;}
 const unavailable=<Container sx={{py:5}}><Alert severity="info">알림 화면을 준비 중입니다. 잠시 후 다시 확인해 주세요.</Alert></Container>;
 if(!getRuntimeEnv().database.configured)return unavailable;
 const database=await getDatabaseAdminStatus();if(!['users','projects','tasks','submissions','submission_revisions','submission_events','task_events','comments','notification_reads'].every(name=>database.tables.some(t=>t.name===name&&t.exists&&!t.missingColumns.length)))return unavailable;
 const user=await getUserByEmail(session.user.email??'');if(!user)return unavailable;
 const result=await listNotifications({userId:user.id,isSuperuser:session.user.isSuperuser},filters);
 return <Container component="main" maxWidth="md" sx={{py:{xs:4,md:6}}}><Stack spacing={3}>
 <Stack direction="row" spacing={1} sx={{alignItems:'center'}}><Typography variant="h4">내 알림</Typography><Chip label={`읽지 않음 ${result.unread}`}/></Stack>
 <Typography color="text.secondary">배정·검토·보완·승인과 내 제출물 댓글을 확인하세요. 현재 담당/역할/조회 권한에 맞는 알림만 표시됩니다. 외부 메일·메신저는 발송하지 않습니다.</Typography>
 <Stack component="nav" aria-label="알림 범위" direction="row" spacing={1}><Button variant={filters.scope==='unread'?'contained':'outlined'} href="/notifications">읽지 않음</Button><Button variant={filters.scope==='all'?'contained':'outlined'} href="/notifications?scope=all">전체 알림</Button></Stack>
 <Typography>{result.total}건</Typography>
 {result.items.length?result.items.map(item=><Paper key={`${item.source}:${item.sourceId}`} elevation={0} sx={{p:3,borderRadius:3}}><Stack spacing={1}>
 <Typography variant="body2" color="text.secondary">{item.projectName} · {item.createdAt}{item.read?' · 읽음':''}</Typography><Typography variant="h6">{notificationLabels[item.kind]??'업무 알림'}</Typography><Typography sx={{overflowWrap:'anywhere'}}>{item.title}</Typography>
 <Stack direction={{xs:'column',sm:'row'}} spacing={1}><Button href={item.submissionId?`/submissions/${item.submissionId}?revision=${item.revision}`:`/tasks?projectId=${item.projectId}&taskId=${item.taskId}`} variant="outlined">{item.submissionId?`v${item.revision} 열기`:'업무 열기'}</Button>{!item.read?<Stack component="form" action={markNotificationReadAction}><input type="hidden" name="scope" value={filters.scope}/><input type="hidden" name="page" value={result.page}/><input type="hidden" name="source" value={item.source}/><input type="hidden" name="sourceId" value={item.sourceId}/><SubmitButton pendingLabel="읽음 저장 중…">읽음 표시</SubmitButton></Stack>:null}</Stack>
 </Stack></Paper>):<Paper elevation={0} sx={{p:3}}><Typography>현재 표시할 알림이 없습니다.</Typography></Paper>}
 <Alert severity="info">읽음 표시는 원래 업무·검토 이력을 지우지 않습니다. 재배정·검토 취소·권한 변경으로 더 이상 해당하지 않는 알림은 숨깁니다. 일반 변경 모두를 알리거나 자동 작업을 실행하지 않습니다.</Alert>
 {result.total>0?<Stack component="nav" aria-label="알림 페이지" direction="row" spacing={2} sx={{justifyContent:'center',alignItems:'center'}}><Button disabled={result.page<=1} href={result.page>1?`/notifications?scope=${filters.scope}&page=${result.page-1}`:undefined}>이전</Button><Typography>{result.page} / {result.pageCount}</Typography><Button disabled={result.page>=result.pageCount} href={result.page<result.pageCount?`/notifications?scope=${filters.scope}&page=${result.page+1}`:undefined}>다음</Button></Stack>:null}
 </Stack></Container>;
}
