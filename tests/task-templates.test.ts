import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskTemplates,templatePreview,normalizeTemplatePayload} from '@/src/entities/task';
const template=taskTemplates[0];
test('template preview is dated, unassigned and independent from catalog',()=>{
 const nodes=templatePreview(template,'2026-02-27');assert.equal(nodes[1].endDate,'2026-03-02');assert.ok(nodes.every(n=>n.assigneeId===null));nodes[0].title='edited';assert.notEqual(template.nodes[0].title,'edited');
 assert.throws(()=>templatePreview(template,'2026-02-30'));assert.throws(()=>templatePreview(template,'9999-12-31'));
});
test('template rejects forged hierarchy, duplicate keys, empty/oversized data and invalid dates',()=>{
 const nodes=templatePreview(template,'2026-01-01');
 for(const bad of [[],Array(21).fill(nodes[0]),[nodes[1]],[nodes[0],nodes[0]],[{...nodes[0],parentKey:'unknown'}],[{...nodes[0],title:''}],[{...nodes[0],assigneeId:-1}],[{...nodes[0],endDate:'2025-12-31'}],[{...nodes[0],description:'x'.repeat(2001)}]])assert.throws(()=>normalizeTemplatePayload(template.key,1,bad));
 assert.deepEqual(normalizeTemplatePayload(template.key,1,[nodes[2],nodes[0]]).map(n=>n.key),[nodes[0].key,nodes[2].key]);
});
