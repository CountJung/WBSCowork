import {getDatabasePool} from '@/src/shared/server/database/index.server';
import {getRuntimeEnv} from '@/src/shared/server/runtime-env/index.server';
import {isHostedRuntime} from '@/src/shared/server/hosted-runtime/index.server';
import {notificationSource,parseNotificationFilters,type NotificationItem,type NotificationFilters} from '../model/notification';
export type NotificationViewer={userId:number;isSuperuser:boolean};
function relation(viewer:NotificationViewer){
 if(!Number.isSafeInteger(viewer.userId)||viewer.userId<1||typeof viewer.isSuperuser!=='boolean')throw new Error('현재 사용자를 확인할 수 없습니다.');
 const su="(flags.is_superuser=1 AND LOWER(viewer.email)=flags.superuser_email)",writable=`(viewer.role IN ('member','admin') OR ${su})`;
 const visibility=`(viewer.role='admin' OR ${su} OR s.author_id=viewer.id OR (s.visibility='public' AND r.visibility='public'))`;
 const viewerJoin='JOIN users viewer ON viewer.id=? CROSS JOIN (SELECT ? AS is_superuser,? AS superuser_email) flags';
 const task=`SELECT 'task' source,e.id source_id,'assigned' kind,t.id task_id,t.project_id,p.name project_name,t.title,NULL submission_id,NULL revision,e.created_at
 FROM task_events e JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=t.project_id ${viewerJoin}
 WHERE e.assignee_id=viewer.id AND t.assignee_id=viewer.id AND ${writable} AND t.status<>'done' AND COALESCE(e.actor_id,0)<>viewer.id
 AND (e.kind='created' OR (e.kind='updated' AND COALESCE((SELECT prior.assignee_id FROM task_events prior WHERE prior.task_id=t.id AND prior.task_version<e.task_version ORDER BY prior.task_version DESC LIMIT 1),0)<>e.assignee_id))
 AND NOT EXISTS(SELECT 1 FROM task_events later WHERE later.task_id=t.id AND later.task_version>e.task_version AND (later.assignee_id IS NULL OR later.assignee_id<>viewer.id))`;
 const review=`SELECT 'review' source,e.id source_id,e.kind,t.id task_id,t.project_id,p.name project_name,t.title,s.id submission_id,r.revision_number revision,e.created_at
 FROM submission_events e JOIN submissions s ON s.id=e.submission_id JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=e.revision_number
 JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=t.project_id JOIN task_events paired ON paired.operation_token=e.operation_token AND paired.task_id=t.id ${viewerJoin}
 WHERE e.kind IN ('review_requested','changes_requested','approved') AND COALESCE(e.actor_id,0)<>viewer.id AND ${visibility} AND ${writable}
 AND t.last_operation_token=e.operation_token AND t.review_submission_id=s.id AND t.review_revision_number=r.revision_number AND s.current_revision=r.revision_number
 AND t.review_required=1 AND TRIM(t.deliverable)<>'' AND TRIM(t.definition_of_done)<>'' AND s.author_id=t.assignee_id
 AND ((e.kind='review_requested' AND paired.reviewer_id=viewer.id AND t.reviewer_id=viewer.id AND t.status='review_pending'
  AND s.author_id<>viewer.id AND t.assignee_id<>viewer.id AND (r.editor_id IS NULL OR r.editor_id<>viewer.id)
  AND EXISTS(SELECT 1 FROM users assignee WHERE assignee.id=t.assignee_id AND (assignee.role IN ('member','admin') OR LOWER(assignee.email)=flags.superuser_email)))
 OR (e.kind='changes_requested' AND paired.assignee_id=viewer.id AND t.assignee_id=viewer.id AND t.status='changes_requested')
 OR (e.kind='approved' AND paired.assignee_id=viewer.id AND t.assignee_id=viewer.id AND t.status='done'))`;
 const comment=`SELECT 'comment' source,c.id source_id,'feedback' kind,t.id task_id,t.project_id,p.name project_name,t.title,s.id submission_id,r.revision_number revision,c.created_at
 FROM comments c JOIN submissions s ON s.id=c.submission_id JOIN submission_revisions r ON r.submission_id=s.id AND r.revision_number=COALESCE(c.revision_number,1)
 JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=t.project_id ${viewerJoin}
 WHERE s.author_id=viewer.id AND c.author_id<>viewer.id AND ${visibility}`;
 const values=[viewer.userId,viewer.isSuperuser?1:0,(getRuntimeEnv().auth.superuserEmail??'').toLowerCase()];
 return {sql:[task,review,comment].join(' UNION ALL '),params:[...values,...values,...values]};
}
type NotificationRow={source:NotificationItem['source'];source_id:number;kind:string;task_id:number;project_id:number;project_name:string;title:string;submission_id:number|null;revision:number|null;created_at:Date|string;read_at:Date|string|null};
export async function listNotifications(viewer:NotificationViewer,input:NotificationFilters){
 const filters=parseNotificationFilters({scope:input.scope,page:String(input.page)}),feed=relation(viewer),db=getDatabasePool();
 const from=`FROM (${feed.sql}) feed LEFT JOIN notification_reads receipt ON receipt.recipient_id=? AND receipt.source_kind=feed.source AND receipt.source_id=feed.source_id`;
 const params=[...feed.params,viewer.userId];
 const count=(await db.query(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN receipt.id IS NULL THEN 1 ELSE 0 END),0) unread ${from}`,params) as {total:number;unread:number}[])[0];
 const unread=Number(count?.unread??0),total=filters.scope==='unread'?unread:Number(count?.total??0),pageCount=Math.min(1000,Math.max(1,Math.ceil(total/20))),page=Math.min(filters.page,pageCount);
 const rows=await db.query(`SELECT feed.*,receipt.read_at ${from} ${filters.scope==='unread'?'WHERE receipt.id IS NULL':''} ORDER BY feed.created_at DESC,feed.source,feed.source_id DESC LIMIT ? OFFSET ?`,[...params,20,(page-1)*20]) as NotificationRow[];
 return {total,unread,page,pageCount,items:rows.map(row=>({source:row.source,sourceId:Number(row.source_id),kind:row.kind,taskId:Number(row.task_id),projectId:Number(row.project_id),projectName:row.project_name,title:row.title,submissionId:row.submission_id===null?null:Number(row.submission_id),revision:row.revision===null?null:Number(row.revision),createdAt:row.created_at instanceof Date?row.created_at.toISOString():row.created_at,read:row.read_at!==null}))};
}
export async function markNotificationRead(viewer:NotificationViewer,sourceValue:unknown,sourceId:number){
 const source=notificationSource(sourceValue);if(!Number.isSafeInteger(sourceId)||sourceId<1)throw new Error('알림 식별자가 올바르지 않습니다.');
 const feed=relation(viewer),duplicate=isHostedRuntime()?' ON CONFLICT DO NOTHING':' ON DUPLICATE KEY UPDATE id=notification_reads.id';
 // Re-authorize using the exact same relation; guessed/obsolete sources insert nothing.
 await getDatabasePool().query(`INSERT INTO notification_reads(recipient_id,project_id,source_kind,source_id) SELECT ?,feed.project_id,feed.source,feed.source_id FROM (${feed.sql}) feed WHERE feed.source=? AND feed.source_id=?${duplicate}`,[viewer.userId,...feed.params,source,sourceId]);
}
