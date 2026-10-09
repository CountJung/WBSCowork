import {getDatabasePool} from '@/src/shared/server/database/index.server';
import {getRuntimeEnv} from '@/src/shared/server/runtime-env/index.server';
import {toCalendarDate} from '@/src/shared/lib/date';
import {literalSearchPattern,parseWorkSearchFilters,workSearchMaxPage,workSearchPageSize,type WorkSearchFilters,type WorkSearchItem,type WorkSearchPage} from '../model/work-search';
export type WorkSearchViewer={viewerUserId:number;isSuperuser:boolean};
type SearchRow={kind:'task'|'submission';id:number;task_id:number;project_id:number;project_name:string;title:string;snippet:string;author_name:string|null;matched_filename:string|null;revision:number|null;is_current:number;is_approved:number;is_legacy:number;status:WorkSearchItem['status'];end_date:Date|string};
export async function searchWork(viewer:WorkSearchViewer,input:WorkSearchFilters,today=new Date().toISOString().slice(0,10)):Promise<WorkSearchPage>{
 if(!Number.isSafeInteger(viewer.viewerUserId)||viewer.viewerUserId<1||typeof viewer.isSuperuser!=='boolean')throw new Error('로그인 사용자를 확인할 수 없습니다.');
 const filters=parseWorkSearchFilters(Object.fromEntries(Object.entries(input).filter(([,v])=>v!==null).map(([k,v])=>[k,typeof v==='boolean'?(v?'1':'0'):String(v)])));
 const branches:string[]=[],params:unknown[]=[];
 for(const kind of ['task','submission'] as const){
  if(filters.kind!=='all'&&filters.kind!==kind)continue;
  const where:string[]=[],values:unknown[]=[viewer.viewerUserId];
  if(filters.projectId!==null){where.push('t.project_id=?');values.push(filters.projectId);}
  if(filters.assigneeId!==null){where.push('t.assignee_id=?');values.push(filters.assigneeId);}
  if(filters.status!=='all'){where.push('t.status=?');values.push(filters.status);}
  if(filters.from){where.push('t.end_date>=?');values.push(filters.from);}
  if(filters.to){where.push('t.end_date<=?');values.push(filters.to);}
  if(filters.overdue){where.push("t.status<>'done' AND t.end_date<?");values.push(toCalendarDate(today));}
  const approved="t.status='done' AND t.review_required=1 AND t.review_submission_id=s.id AND t.review_revision_number=r.revision_number AND r.revision_number=s.current_revision";
  if(kind==='submission'){
   where.push("(viewer.role='admin' OR (?=1 AND LOWER(viewer.email)=?) OR s.author_id=viewer.id OR (s.visibility='public' AND r.visibility='public'))");values.push(viewer.isSuperuser?1:0,(getRuntimeEnv().auth.superuserEmail??'').toLowerCase());
   if(filters.versions==='latest')where.push('r.revision_number=s.current_revision');
   if(filters.versions==='approved')where.push(approved);
  }
  if(filters.q){
   const pattern=literalSearchPattern(filters.q);
   if(kind==='task'){where.push("(t.title LIKE ? ESCAPE '!' OR COALESCE(t.description,'') LIKE ? ESCAPE '!')");values.push(pattern,pattern);}
   else{where.push("(r.content LIKE ? ESCAPE '!' OR author.name LIKE ? ESCAPE '!' OR COALESCE(r.file_name,'') LIKE ? ESCAPE '!' OR EXISTS(SELECT 1 FROM submission_attachments attachment WHERE attachment.submission_id=s.id AND attachment.revision_number=r.revision_number AND attachment.file_name LIKE ? ESCAPE '!'))");values.push(pattern,pattern,pattern,pattern);}
  }
  let matchedFilename='NULL';
  if(kind==='submission'&&filters.q){
   matchedFilename="CASE WHEN r.file_name LIKE ? ESCAPE '!' THEN r.file_name ELSE (SELECT MIN(matched.file_name) FROM submission_attachments matched WHERE matched.submission_id=s.id AND matched.revision_number=r.revision_number AND matched.file_name LIKE ? ESCAPE '!') END";
   values.unshift(literalSearchPattern(filters.q),literalSearchPattern(filters.q));
  }
  branches.push(`SELECT '${kind}' AS kind,${kind==='task'?'t.id':'s.id'} AS id,t.id AS task_id,t.project_id,p.name AS project_name,t.title,
   SUBSTR(${kind==='task'?"COALESCE(t.description,'')":'r.content'},1,240) AS snippet,${kind==='task'?'NULL':'author.name'} AS author_name,${matchedFilename} AS matched_filename,
   ${kind==='task'?'NULL':'r.revision_number'} AS revision,${kind==='task'?'1':'CASE WHEN r.revision_number=s.current_revision THEN 1 ELSE 0 END'} AS is_current,
   ${kind==='task'?'0':`CASE WHEN ${approved} THEN 1 ELSE 0 END`} AS is_approved,${kind==='task'?'0':"CASE WHEN r.source='legacy' THEN 1 ELSE 0 END"} AS is_legacy,t.status,t.end_date
   FROM tasks t JOIN projects p ON p.id=t.project_id JOIN users viewer ON viewer.id=?
   ${kind==='submission'?'JOIN submissions s ON s.task_id=t.id JOIN submission_revisions r ON r.submission_id=s.id JOIN users author ON author.id=s.author_id':''}
   ${where.length?'WHERE '+where.map(w=>'('+w+')').join(' AND '):''}`);
  params.push(...values);
 }
 const relation=branches.join(' UNION ALL '),db=getDatabasePool();
 const total=Number((await db.query(`SELECT COUNT(*) total FROM (${relation}) matches`,params) as {total:number}[])[0]?.total??0);
 const pageCount=Math.min(workSearchMaxPage,Math.max(1,Math.ceil(total/workSearchPageSize))),page=Math.min(filters.page,pageCount);
 const rows=await db.query(`SELECT * FROM (${relation}) matches ORDER BY project_id,task_id,kind,id,revision DESC LIMIT ? OFFSET ?`,[...params,workSearchPageSize,(page-1)*workSearchPageSize]) as SearchRow[];
 return {total,page,pageCount,items:rows.map(row=>({kind:row.kind,id:Number(row.id),taskId:Number(row.task_id),projectId:Number(row.project_id),projectName:row.project_name,title:row.title,snippet:row.snippet,authorName:row.author_name,matchedFilename:row.matched_filename,revision:row.revision===null?null:Number(row.revision),current:Boolean(Number(row.is_current)),approved:Boolean(Number(row.is_approved)),legacy:Boolean(Number(row.is_legacy)),status:row.status,endDate:toCalendarDate(row.end_date)}))};
}
