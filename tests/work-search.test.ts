import {test} from 'node:test';
import assert from 'node:assert/strict';
import {literalSearchPattern,parseWorkSearchFilters,workSearchPath} from '@/src/entities/task';
test('search binds literal wildcards and canonical bounded filters',()=>{
 assert.equal(literalSearchPattern('50%_!'),'%50!%!_!!%');
 const f=parseWorkSearchFilters({q:' quote \' ',versions:'all',projectId:'2',assigneeId:'3',status:'blocked',from:'2026-01-01',to:'2026-12-31',page:'2'});
 assert.equal(f.q,"quote '");assert.ok(workSearchPath(f).startsWith('/search?'));assert.equal(new URL(workSearchPath(f),'https://example.test').searchParams.get('q'),f.q);
});
test('invalid search arrays/enums/ids/dates/page/long query reject',()=>{
 for(const input of [{q:['a','b']},{q:'x'.repeat(161)},{q:'\u0001'},{kind:'private'},{versions:'raw'},{projectId:'1 OR 1'},{assigneeId:'9007199254740992'},{from:'2026-02-30'},{from:'2026-12-01',to:'2026-01-01'},{page:'1001'}])assert.throws(()=>parseWorkSearchFilters(input));
});
