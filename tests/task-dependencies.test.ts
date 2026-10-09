import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertAcyclicDependencies,normalizePredecessors,projectWorkSummary} from '@/src/entities/task';
import {mapTaskRow,type TaskRow} from '@/src/entities/task/model/task';
test('dependency graph rejects self and cycles independent of hierarchy',()=>{
 assert.throws(()=>normalizePredecessors([1],1));assert.throws(()=>normalizePredecessors(Array(21).fill(2),1));
 assert.deepEqual(normalizePredecessors([3,2,2],1),[2,3]);
 assert.throws(()=>assertAcyclicDependencies([{taskId:2,predecessorId:1}],1,[2]),/순환/);
 assert.throws(()=>assertAcyclicDependencies([{taskId:2,predecessorId:1},{taskId:3,predecessorId:2}],1,[3]),/순환/);
 assert.doesNotThrow(()=>assertAcyclicDependencies([{taskId:2,predecessorId:1}],2,[]));
});
test('live summary distinguishes elapsed dates, done and dependency reopening',()=>{
 const task=(id:number,status:string)=>mapTaskRow({id,project_id:1,title:String(id),start_date:'2026-01-01',end_date:'2026-01-02',created_at:'2026-01-01',status,assignee_id:null} as TaskRow);
 const items=[task(1,'done'),task(2,'in_progress')],edges=[{taskId:2,predecessorId:1}];
 assert.equal(projectWorkSummary(items,edges,'2026-02-01').blocked.length,0);
 items[0].status='in_progress';const summary=projectWorkSummary(items,edges,'2026-02-01');
 assert.deepEqual(summary.blocked.map(t=>t.id),[2]);assert.equal(summary.overdue.length,2);assert.equal(items[1].status,'in_progress');
});
