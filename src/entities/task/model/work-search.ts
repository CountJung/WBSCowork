import {toCalendarDate} from '@/src/shared/lib/date';
import {taskStatusLabels,type TaskStatus} from './workflow';
export type WorkSearchParams=Record<string,string|string[]|undefined>;
export type WorkSearchFilters={q:string;kind:'all'|'task'|'submission';versions:'latest'|'approved'|'all';projectId:number|null;assigneeId:number|null;status:'all'|TaskStatus;from:string;to:string;overdue:boolean;page:number};
export const workSearchPageSize=20,workSearchMaxPage=1000;
export function parseWorkSearchFilters(input:WorkSearchParams):WorkSearchFilters{
 const one=(key:string)=>{const v=input[key];if(Array.isArray(v))throw new Error('같은 검색 조건을 중복 지정할 수 없습니다.');return v?.trim()??'';};
 const q=one('q');if(q.length>160||/[\u0000-\u001f\u007f-\u009f]/.test(q))throw new Error('검색어는 제어 문자 없이 160자 이하로 입력해 주세요.');
 const choose=<T extends string>(key:string,allowed:T[],fallback:T)=>{const value=one(key)||fallback;if(!allowed.includes(value as T))throw new Error('검색 조건이 올바르지 않습니다.');return value as T;};
 const id=(key:string)=>{const value=one(key);if(!value)return null;if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('검색 대상 식별자가 올바르지 않습니다.');return Number(value);};
 const from=one('from')?toCalendarDate(one('from')):'',to=one('to')?toCalendarDate(one('to')):'';if(from&&to&&from>to)throw new Error('기한 범위를 확인해 주세요.');
 const page=one('page')||'1';if(!/^[1-9]\d*$/.test(page)||Number(page)>workSearchMaxPage)throw new Error('검색 페이지 범위를 확인해 주세요.');
 return {q,kind:choose('kind',['all','task','submission'],'all'),versions:choose('versions',['latest','approved','all'],'latest'),projectId:id('projectId'),assigneeId:id('assigneeId'),status:choose('status',['all',...Object.keys(taskStatusLabels) as TaskStatus[]],'all'),from,to,overdue:choose('overdue',['0','1'],'0')==='1',page:Number(page)};
}
export function workSearchPath(filters:WorkSearchFilters){const q=new URLSearchParams();for(const [k,v]of Object.entries(filters)){if(v!==null&&v!==''&&!(k==='page'&&v===1))q.set(k,typeof v==='boolean'?(v?'1':'0'):String(v));}return '/search?'+q;}
export function literalSearchPattern(text:string){return '%'+text.replaceAll('!','!!').replaceAll('%','!%').replaceAll('_','!_')+'%';}
export type WorkSearchItem={kind:'task'|'submission';id:number;taskId:number;projectId:number;projectName:string;title:string;snippet:string;authorName:string|null;matchedFilename:string|null;revision:number|null;current:boolean;approved:boolean;legacy:boolean;status:TaskStatus;endDate:string};
export type WorkSearchPage={items:WorkSearchItem[];total:number;page:number;pageCount:number};
