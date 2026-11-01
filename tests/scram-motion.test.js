import test from 'node:test';
import assert from 'node:assert/strict';
import {motionPlan} from '../apps/web/games/scram/motion.js';
test('SCRAM motions target original slots for removals and both swap abilities',()=>{
 const targets=[{playerId:'other',slot:3,value:5},{playerId:'ally',slot:1,value:5}];
 for(const motion of [{type:'replace',success:true,targets},{type:'ability',ability:9,targets},{type:'ability',ability:10,targets}]){assert.equal(motionPlan(motion).kind,'remove');assert.deepEqual(motionPlan(motion).targets,targets);}
 for(const motion of [{type:'ability',ability:11,targets},{type:'resolve',swap:true,targets}])assert.equal(motionPlan(motion).kind,'swap');
 for(const motion of [null,{type:'replace',success:false},{type:'ability',ability:6},{type:'resolve',swap:false}])assert.equal(motionPlan(motion),null);
});
