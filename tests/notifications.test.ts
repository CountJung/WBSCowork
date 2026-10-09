import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationSource,parseNotificationFilters} from '@/src/entities/notification';
test('notification filters and source keys are bounded',()=>{
 assert.deepEqual(parseNotificationFilters({}),{scope:'unread',page:1});assert.equal(notificationSource('review'),'review');
 for(const value of ['sql','private','',null])assert.throws(()=>notificationSource(value));
 for(const input of [{scope:['all']},{scope:'hidden'},{page:'0'},{page:'1001'},{page:'1 OR 1'},{page:['1','2']}])assert.throws(()=>parseNotificationFilters(input));
});
