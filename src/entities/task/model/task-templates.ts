import {toCalendarDate,validateDateRange} from '@/src/shared/lib/date';
import {normalizeWorkGoal} from '@/src/shared/lib/work-goals';
export type TemplateNode={key:string;parentKey:string|null;title:string;description:string;deliverable:string;definitionOfDone:string;startOffset:number;endOffset:number};
export type TaskTemplate={key:string;version:number;name:string;nodes:TemplateNode[]};
export const taskTemplates:TaskTemplate[]=[
 {key:'research',version:1,name:'조사와 제안서',nodes:[
  {key:'topic',parentKey:null,title:'조사 주제 정리',description:'질문과 범위를 함께 정합니다.',deliverable:'조사 범위 문서',definitionOfDone:'대상과 제외 범위 합의',startOffset:0,endOffset:1},
  {key:'sources',parentKey:'topic',title:'근거 자료 수집',description:'신뢰할 수 있는 출처를 정리합니다.',deliverable:'출처 링크와 요약',definitionOfDone:'각 주장에 출처 연결',startOffset:1,endOffset:3},
  {key:'draft',parentKey:null,title:'제안서 초안',description:'자료를 바탕으로 실행 가능한 제안을 작성합니다.',deliverable:'제안서 파일 또는 링크',definitionOfDone:'근거와 선택지를 설명',startOffset:3,endOffset:5},
  {key:'share',parentKey:null,title:'결과 공유',description:'의견을 반영한 결과를 팀에 공유합니다.',deliverable:'최종 결과와 변경 요약',definitionOfDone:'주요 의견의 처리 결과 기록',startOffset:5,endOffset:6},
 ]},
 {key:'delivery',version:1,name:'업무 결과물 제작',nodes:[
  {key:'scope',parentKey:null,title:'요구사항 확인',description:'대상과 기대 결과를 정리합니다.',deliverable:'요구사항 목록',definitionOfDone:'완료 판단 기준 확인',startOffset:0,endOffset:1},
  {key:'produce',parentKey:null,title:'결과물 제작',description:'담당 파트를 수행하고 산출물을 작성합니다.',deliverable:'작업 파일 또는 자료 링크',definitionOfDone:'요구사항별 결과 확인',startOffset:1,endOffset:4},
  {key:'check',parentKey:'produce',title:'내용 점검',description:'기준과 실제 결과를 대조합니다.',deliverable:'점검 기록',definitionOfDone:'누락 항목과 조치 기록',startOffset:3,endOffset:4},
 ]},
];
export type TemplatePreviewNode={key:string;parentKey:string|null;title:string;description:string;deliverable:string;definitionOfDone:string;startDate:string;endDate:string;assigneeId:number|null};
export function templatePreview(template:TaskTemplate,baseDate:string):TemplatePreviewNode[]{
 const base=toCalendarDate(baseDate);
 const date=(offset:number)=>{const d=new Date(base+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+offset);return toCalendarDate(d);};
 return template.nodes.map(node=>({key:node.key,parentKey:node.parentKey,title:node.title,description:node.description,deliverable:node.deliverable,definitionOfDone:node.definitionOfDone,startDate:date(node.startOffset),endDate:date(node.endOffset),assigneeId:null}));
}
export function normalizeTemplatePayload(templateKey:string,templateVersion:number,value:unknown):TemplatePreviewNode[]{
 const template=taskTemplates.find(t=>t.key===templateKey&&t.version===templateVersion);
 if(!template||!Array.isArray(value)||value.length<1||value.length>20)throw new Error('템플릿과 선택한 업무를 다시 확인해 주세요.');
 const keys=new Set<string>();
 const nodes=value.map(raw=>{
  if(!raw||typeof raw!=='object')throw new Error('업무 형식이 올바르지 않습니다.');
  const item=raw as Record<string,unknown>,original=template.nodes.find(n=>n.key===item.key);
  if(!original||keys.has(original.key)||item.parentKey!==original.parentKey)throw new Error('템플릿 업무 계층이 올바르지 않습니다.');keys.add(original.key);
  const field=(name:string,label:string,limit=2000)=>{if(typeof item[name]!=='string')throw new Error(label+' 형식이 올바르지 않습니다.');const text=normalizeWorkGoal(item[name],label);if(text.length>limit)throw new Error(label+' 길이가 너무 깁니다.');return text;};
  const title=field('title','제목',255);if(!title)throw new Error('제목은 필수입니다.');
  const assigneeId=item.assigneeId;if(assigneeId!==null&&(!Number.isSafeInteger(assigneeId)||Number(assigneeId)<1))throw new Error('담당자가 올바르지 않습니다.');
  if(typeof item.startDate!=='string'||typeof item.endDate!=='string')throw new Error('날짜가 올바르지 않습니다.');
  return {key:original.key,parentKey:original.parentKey,title,description:field('description','설명'),deliverable:field('deliverable','기대 산출물'),definitionOfDone:field('definitionOfDone','완료 기준'),...validateDateRange(item.startDate,item.endDate),assigneeId:assigneeId as number|null};
 });
 if(nodes.some(n=>n.parentKey&&!keys.has(n.parentKey)))throw new Error('상위 업무를 제외하면 하위 업무도 제외해 주세요.');
 // Catalog order is parent-first and canonical for identical replay fingerprints.
 return template.nodes.flatMap(original=>nodes.filter(node=>node.key===original.key));
}
