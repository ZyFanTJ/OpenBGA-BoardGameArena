import test from 'node:test';
import assert from 'node:assert/strict';
import {RealtimeRunner} from '../packages/platform/realtime.js';

function fixture(){
 let now=0,serial=0;const tasks=new Map(),calls=[],errors=[];
 const clock={setTimeout(fn,delay){const id=++serial;tasks.set(id,{fn,at:now+delay});return id;},clearTimeout(id){tasks.delete(id);}};
 const room={matchId:'match',revision:4,status:'playing'},game={realtime:{stepMs:50,commitMs:200}};
 const rooms={store:{data:{rooms:{test:room}}},registry:{get:()=>game},advanceRealtime(id,input){calls.push(input);room.revision++;now+=30;}};
 const runner=new RealtimeRunner(rooms,{clock,now:()=>now,onError:e=>errors.push(e)});
 return {room,rooms,runner,tasks,calls,errors,setNow:value=>{now=value;},fire(){const [id,t]=tasks.entries().next().value;tasks.delete(id);now=Math.max(now,t.at);t.fn();},now:()=>now};
}
test('real-time clock compensates commit cost and does not duplicate room timers',()=>{
 const f=fixture();f.runner.sync('test');f.runner.sync('test');assert.equal(f.tasks.size,1);f.fire();assert.deepEqual(f.calls,[{revision:4,matchId:'match',steps:4}]);assert.equal([...f.tasks.values()][0].at,400);f.fire();assert.equal(f.calls[1].revision,5);assert.equal([...f.tasks.values()][0].at,600);f.runner.stop();assert.equal(f.tasks.size,0);
});
test('paused and replaced games cancel timers, resume skips suspended wall time',()=>{
 const f=fixture();f.runner.sync('test');f.room.dissolution={id:'vote'};f.runner.sync('test');assert.equal(f.tasks.size,0);delete f.room.dissolution;f.runner.sync('test');f.setNow(30000);f.fire();assert.equal(f.calls.length,1);assert.equal([...f.tasks.values()][0].at,30230);f.room.matchId='new';f.runner.sync('test');assert.equal(f.tasks.size,1);f.fire();assert.equal(f.calls[1].matchId,'new');f.room.status='finished';f.runner.sync('test');assert.equal(f.tasks.size,0);
});
test('persistence failure backs off without acknowledging a frame, then resumes',()=>{
 const f=fixture(),advance=f.rooms.advanceRealtime;f.rooms.advanceRealtime=()=>{throw new Error('storage offline');};f.runner.sync('test');f.fire();assert.equal(f.calls.length,0);assert.equal(f.errors.length,1);assert.equal([...f.tasks.values()][0].at,600);f.fire();assert.equal([...f.tasks.values()][0].at,1400);f.rooms.advanceRealtime=advance;f.fire();assert.equal(f.calls.length,1);f.runner.stop();f.runner.resume();assert.equal(f.tasks.size,1);f.runner.stop();
});
