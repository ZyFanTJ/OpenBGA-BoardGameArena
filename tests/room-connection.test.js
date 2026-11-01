import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomConnection} from '../apps/web/room-connection.js';

function fixture(request=async()=>snapshot()){
 let time=0,online=true,seq=0;const jobs=new Map(),sources=[],states=[],received=[];
 const clock={setTimeout(fn,ms){const id=++seq;jobs.set(id,{fn,at:time+ms});return id;},clearTimeout(id){jobs.delete(id);},setInterval(fn,ms){const id=++seq;jobs.set(id,{fn,at:time+ms,ms});return id;},clearInterval(id){jobs.delete(id);}};
 class Source extends EventTarget{constructor(url){super();this.url=url;sources.push(this);}close(){this.closed=true;}message(value){this.onmessage({data:JSON.stringify(value)});}beat(){this.dispatchEvent(new Event('heartbeat'));}}
 const events=new EventTarget(),page=new EventTarget();page.visibilityState='visible';
 const connection=createRoomConnection({id:'ABCD1234',receive:(s)=>{received.push(s);return s.invalid?false:undefined;},status:s=>states.push(s),request,Source,events,page,online:()=>online,now:()=>time,clock});
 return {sources,states,received,connection,jobs,events,page,network(value){online=value;events.dispatchEvent(new Event(value?'online':'offline'));},async advance(ms){const until=time+ms;for(;;){const next=[...jobs].filter(([,j])=>j.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const [id,j]=next;time=j.at;if(j.ms)j.at+=j.ms;else jobs.delete(id);j.fn();await Promise.resolve();await Promise.resolve();}time=until;await Promise.resolve();}};
}
function snapshot(){return {id:'ABCD1234',revision:1,status:'playing',gameId:'cabo',game:{phase:'turn'},players:[],chat:[]};}

test('heartbeats keep quiet tables alive; a stalled stream reconnects and resyncs without sending any action',async()=>{
 const paths=[],f=fixture(async path=>{paths.push(path);return snapshot();});const first=f.sources[0];first.onopen();first.message(snapshot());assert.equal(f.states.at(-1),'connected');
 for(let i=0;i<5;i++){await f.advance(20000);first.beat();}assert.equal(f.sources.length,1);
 await f.advance(50000);assert.equal(first.closed,true);assert.equal(f.states.at(-1),'reconnecting');await f.advance(1500);
 assert.equal(f.sources.length,2);assert.deepEqual(paths,['/rooms/ABCD1234']);f.sources[1].onopen();f.sources[1].message(snapshot());assert.equal(f.states.at(-1),'connected');f.connection.close();assert.equal(f.jobs.size,0);
});
test('offline is immediate, online recovers once, and a closed room owns no listeners or reconnect timers',async()=>{
 const f=fixture();f.network(false);assert.equal(f.states.at(-1),'offline');assert.equal(f.sources[0].closed,true);await f.advance(120000);assert.equal(f.sources.length,1);
 f.network(true);await Promise.resolve();assert.equal(f.sources.length,2);f.connection.close();f.network(true);await f.advance(120000);assert.equal(f.sources.length,2);assert.equal(f.jobs.size,0);
});
test('bad frames and missing revisions recover; expired login stops reconnecting, and late recovery cannot reopen a departed room',async()=>{
 const f=fixture();f.sources[0].onmessage({data:'{"id":'});assert.equal(f.states.at(-1),'reconnecting');f.connection.close();
 const expired=fixture(async()=>{throw Object.assign(new Error(),{status:401});});expired.sources[0].onerror();await expired.advance(1500);assert.equal(expired.states.at(-1),'expired');assert.equal(expired.jobs.size,0);
 let finish;const late=fixture(()=>new Promise(resolve=>finish=resolve));late.sources[0].onerror();await late.advance(1500);late.connection.close();finish(snapshot());await Promise.resolve();assert.equal(late.sources.length,1);assert.equal(late.received.length,0);
 const gone=fixture(async()=>{throw Object.assign(new Error(),{status:404});});gone.sources[0].onerror();await gone.advance(1500);assert.deepEqual(gone.received,[{id:'ABCD1234',left:true,reason:'dissolved'}]);assert.equal(gone.jobs.size,0);
});
