export type NotificationSource='task'|'review'|'comment';
export type NotificationItem={source:NotificationSource;sourceId:number;kind:string;taskId:number;projectId:number;projectName:string;title:string;submissionId:number|null;revision:number|null;createdAt:string;read:boolean};
export type NotificationFilters={scope:'unread'|'all';page:number};
export function parseNotificationFilters(input:Record<string,string|string[]|undefined>):NotificationFilters{
 if(Array.isArray(input.scope)||Array.isArray(input.page))throw new Error('중복 알림 조건은 사용할 수 없습니다.');
 const scope=input.scope||'unread',page=input.page||'1';
 if(!['unread','all'].includes(scope)||! /^[1-9]\d*$/.test(page)||Number(page)>1000)throw new Error('알림 조건을 확인해 주세요.');
 return {scope:scope as NotificationFilters['scope'],page:Number(page)};
}
export function notificationSource(value:unknown):NotificationSource{if(!['task','review','comment'].includes(String(value)))throw new Error('알림 종류가 올바르지 않습니다.');return value as NotificationSource;}
export const notificationLabels:Record<string,string>={assigned:'업무가 배정되었습니다.',review_requested:'검토할 제출물이 있습니다.',changes_requested:'제출물 보완 요청이 있습니다.',approved:'제출물이 승인되었습니다.',feedback:'제출물에 새 댓글이 있습니다.'};
