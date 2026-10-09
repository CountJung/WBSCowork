import { toCalendarDate } from '@/src/shared/lib/date';
import type { Task } from './task';
export type TaskDependency = {taskId:number;predecessorId:number};
export type DependencySnapshot = {version:number;edges:TaskDependency[]};
export function normalizePredecessors(value: number[], taskId: number) {
  if (!Array.isArray(value) || value.length>20 || value.some(id=>!Number.isSafeInteger(id)||id<1||id===taskId)) throw new Error('선행 업무는 자신을 제외한 최대 20개를 선택해 주세요.');
  return [...new Set(value)].sort((a,b)=>a-b);
}
export function assertAcyclicDependencies(edges:TaskDependency[],taskId:number,predecessorIds:number[]) {
  const graph=new Map<number,number[]>();
  for(const edge of edges.filter(edge=>edge.taskId!==taskId))graph.set(edge.taskId,[...(graph.get(edge.taskId)??[]),edge.predecessorId]);
  graph.set(taskId,predecessorIds);
  const visiting=new Set<number>(), visited=new Set<number>();
  function visit(id:number) {if(visiting.has(id))throw new Error('선행 업무에 순환 관계를 만들 수 없습니다.');if(visited.has(id))return;visiting.add(id);for(const next of graph.get(id)??[])visit(next);visiting.delete(id);visited.add(id);}
  for(const id of graph.keys())visit(id);
}
export function projectWorkSummary(tasks:Task[],edges:TaskDependency[],today:string) {
  const byId=new Map(tasks.map(task=>[task.id,task]));
  const pending=(id:number)=>edges.filter(edge=>edge.taskId===id&&byId.get(edge.predecessorId)?.status!=='done').map(edge=>edge.predecessorId);
  return {unassigned:tasks.filter(t=>t.status!=='done'&&!t.assigneeId),overdue:tasks.filter(t=>t.status!=='done'&&toCalendarDate(t.endDate)<today),blocked:tasks.filter(t=>t.status!=='done'&&(t.status==='blocked'||pending(t.id).length>0)),review:tasks.filter(t=>t.status==='review_pending'),pending};
}
