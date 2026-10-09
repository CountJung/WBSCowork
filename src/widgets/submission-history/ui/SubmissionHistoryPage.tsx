import { Alert, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { notFound, redirect } from 'next/navigation';
import { getAuthSession, getSignInPath, getUserByEmail } from '@/src/entities/user/index.server';
import { canManageAllSubmissions } from '@/src/entities/user';
import { getTaskById } from '@/src/entities/task/index.server';
import { getSubmissionByIdForViewer, getSubmissionRevisionForViewer, listSubmissionRevisionsForViewer, listSubmissionEventsForViewer, listAttachmentsBySubmission } from '@/src/entities/submission/index.server';
import { listCommentsBySubmissionRevision, countCommentsBySubmissionRevision } from '@/src/entities/comment/index.server';
import MarkdownContent from '@/src/shared/ui/markdown-content';

function positive(value:string|undefined,fallback:number) {const n=Number(value);return Number.isSafeInteger(n)&&n>0?Math.min(n,1000000000):fallback;}
function date(value:Date|string) {return new Date(value).toISOString().replace('T',' ').slice(0,19)+' UTC';}
export default async function SubmissionHistoryPage({id,revision,page,commentPage,eventPage}:{id:number;revision?:string;page?:string;commentPage?:string;eventPage?:string}) {
 const session=await getAuthSession();
 if(!session?.user)redirect(getSignInPath(`/submissions/${id}`));
 const user=session.user.email?await getUserByEmail(session.user.email):null;
 if(!user)notFound();
 const filter={canSeeAll:canManageAllSubmissions(session.user.role,session.user.isSuperuser),viewerUserId:user.id};
 const submission=await getSubmissionByIdForViewer(id,filter);
 if(!submission)notFound();
 const selectedNumber=positive(revision,submission.currentRevision),historyPage=Math.min(1000,positive(page,1)),commentsPage=Math.min(1000,positive(commentPage,1)),eventsPage=Math.min(1000,positive(eventPage,1));
 const selected=await getSubmissionRevisionForViewer(id,selectedNumber,filter);
 if(!selected)notFound();
 const [task,revisions,events,attachments,comments,commentCount]=await Promise.all([
  getTaskById(submission.taskId),listSubmissionRevisionsForViewer(id,filter,historyPage),listSubmissionEventsForViewer(id,filter,eventsPage),
  listAttachmentsBySubmission(id,{revisionNumber:selectedNumber,filter}),
  listCommentsBySubmissionRevision(id,selectedNumber,filter,{limit:30,offset:(commentsPage-1)*30}),countCommentsBySubmissionRevision(id,selectedNumber,filter),
 ]);
 if(!task)notFound();
 const link=(values:{revision?:number;page?:number;commentPage?:number;eventPage?:number})=>`/submissions/${id}?${new URLSearchParams({revision:String(values.revision??selectedNumber),page:String(values.page??historyPage),commentPage:String(values.commentPage??commentsPage),eventPage:String(values.eventPage??eventsPage)})}`;
 return <Container component="main" maxWidth="lg" sx={{py:5}}><Stack spacing={3}>
  <Stack spacing={1}><Typography variant="h4">제출물 버전·검토 이력</Typography><Typography>{task.title} · 작성자 {submission.authorName}</Typography><Button href={`/tasks?projectId=${task.projectId}&taskId=${task.id}`} sx={{alignSelf:'flex-start'}}>업무 카드로 돌아가기</Button></Stack>
  <Alert severity="info">수정할 때 새 버전을 만듭니다. 이전 본문·링크·파일은 이력에 보존되며 현재 공개 범위와 각 버전 공개 범위를 함께 적용합니다.</Alert>
  <Paper sx={{p:3}}><Stack spacing={2}><Typography variant="h6">열람 가능한 버전</Typography><Stack direction="row" spacing={1} sx={{flexWrap:'wrap',gap:1}}>{revisions.map(item=><Button key={item.id} href={link({revision:item.revisionNumber,commentPage:1})} variant={item.revisionNumber===selectedNumber?'contained':'outlined'}>v{item.revisionNumber}{item.revisionNumber===submission.currentRevision?' · 현재':''}</Button>)}</Stack><Stack direction="row" spacing={1}>{historyPage>1?<Button href={link({page:historyPage-1})}>이전 버전 목록</Button>:null}{revisions.length===20&&historyPage<1000?<Button href={link({page:historyPage+1})}>다음 버전 목록</Button>:null}</Stack></Stack></Paper>
  <Paper sx={{p:3}}><Stack spacing={2}><Stack direction="row" spacing={1}><Chip label={`버전 ${selected.revisionNumber}`}/><Chip label={selected.visibility==='private'?'비공개':'공개'}/></Stack><Typography variant="caption">{date(selected.createdAt)} · {selected.source==='legacy'?'이력 도입 시점의 기존 자료':`수정자 ${selected.editorName??'계정 삭제됨'}`}</Typography><Typography sx={{whiteSpace:'pre-wrap'}}>변경 내용: {selected.changeSummary||'최초 제출'}</Typography><MarkdownContent content={selected.content}/>{selected.materialUrl?<Button href={selected.materialUrl} target="_blank" rel="noopener noreferrer" sx={{alignSelf:'flex-start',overflowWrap:'anywhere'}}>자료 링크: {selected.materialUrl}</Button>:null}<Divider/><Typography variant="subtitle1">이 버전의 첨부파일</Typography>{selected.filePath&&selected.fileName?<Button href={`/api/submissions/${id}/attachment?revision=${selectedNumber}`}>{selected.fileName}</Button>:null}{attachments.map(file=><Button key={file.id} href={`/api/submission-attachments/${file.id}`}>{file.fileName} · {file.fileSizeBytes} bytes</Button>)}{!selected.filePath&&!attachments.length?<Typography color="text.secondary">첨부파일 없음</Typography>:null}</Stack></Paper>
  <Paper sx={{p:3}}><Stack spacing={2}><Typography variant="h6">버전 {selectedNumber}의 댓글 · {commentCount}건</Typography>{comments.map(comment=><Stack key={comment.id} spacing={0.5}><Typography variant="caption">{comment.authorName} · {date(comment.createdAt)}{comment.revisionNumber===null?' · 이력 도입 이전 댓글':''}</Typography><MarkdownContent content={comment.content}/><Divider/></Stack>)}{!comments.length?<Typography color="text.secondary">표시할 댓글이 없습니다.</Typography>:null}<Stack direction="row">{commentsPage>1?<Button href={link({commentPage:commentsPage-1})}>이전 댓글</Button>:null}{commentsPage*30<commentCount&&commentsPage<1000?<Button href={link({commentPage:commentsPage+1})}>다음 댓글</Button>:null}</Stack></Stack></Paper>
  <Paper sx={{p:3}}><Stack spacing={1}><Typography variant="h6">제출·검토 기록</Typography>{events.map(event=><Stack key={event.id}><Typography variant="body2">v{event.revisionNumber} · {event.kind==='baseline'?'이력 도입':event.kind==='created'?'제출':event.kind==='revised'?'새 버전':event.kind} · {event.actorName??'기존 기록'} · {date(event.createdAt)}</Typography>{event.body?<Typography sx={{whiteSpace:'pre-wrap'}}>{event.body}</Typography>:null}</Stack>)}<Stack direction="row">{eventsPage>1?<Button href={link({eventPage:eventsPage-1})}>이전 기록</Button>:null}{events.length===30&&eventsPage<1000?<Button href={link({eventPage:eventsPage+1})}>다음 기록</Button>:null}</Stack></Stack></Paper>
 </Stack></Container>;
}
