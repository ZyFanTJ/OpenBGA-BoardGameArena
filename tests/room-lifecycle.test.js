import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonStore } from '../packages/platform/store.js';
import { RoomService } from '../packages/platform/rooms.js';
import { BotRunner } from '../packages/platform/bots.js';
import { games, createRegistry } from '../packages/games/registry.js';
import { cabo } from '../packages/games/cabo/index.js';
import { createApp } from '../apps/server/http.js';
const a = {id:'a',name:'Alice'}, b = {id:'b',name:'Bob'}, c = {id:'c',name:'Carol'};
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
function fixture(players=[a,b], registry=games) {
  const store = new JsonStore(), service = new RoomService(store,registry,{random:()=>.4});
  const id = service.createRoom(a,{gameId:'cabo',title:'Table'}).id;
  players.slice(1).forEach(p=>service.join(p,id));
  const act=(user,input)=>service.mutate(user,id,{revision:store.data.rooms[id].revision,...input});
  players.forEach(p=>act(p,{type:'ready',ready:true})); act(a,{type:'start'});
  return {store,service,id,act};
}
test('mid-game leave preserves cards, revokes every player privilege and transfers host to a human',()=>{
  const {store,service,id,act}=fixture(); const before=structuredClone(store.data.rooms[id].game);
  assert.deepEqual(act(a,{type:'leave'}),{left:true,reason:'left'});
  assert.deepEqual(store.data.rooms[id].game,before);
  assert.equal(store.data.rooms[id].hostId,b.id);
  assert.equal(store.data.rooms[id].players[0].isBot,true);
  assert.equal(service.currentRoom(a),undefined);
  assert.throws(()=>service.snapshot(id,a),/不在此房间/);
  assert.throws(()=>act(a,{type:'game',command:{type:'look',slots:[0,1]}}),/不在此房间/);
  assert.throws(()=>service.join(a,id),/已经开始/);
  assert.ok(service.createRoom(a,{gameId:'cabo',title:'Another'}));
  act(b,{type:'leave'}); assert.equal(store.data.rooms[id],undefined);
});
test('dissolution needs unanimous current humans; stale, duplicate and non-host votes are rejected',()=>{
  const {store,service,id,act}=fixture([a,b,c]);
  assert.throws(()=>act(b,{type:'requestDissolve'}),/只有房主/);
  let r=act(a,{type:'requestDissolve'}), voteId=r.dissolution.id;
  assert.throws(()=>act(a,{type:'requestDissolve'}),/已有解散/);
  assert.throws(()=>act(b,{type:'game',command:{type:'look',slots:[0,1]}}),/投票中/);
  assert.throws(()=>act(b,{type:'voteDissolve',voteId:'stale',agree:true}),/已结束/);
  assert.throws(()=>act(b,{type:'voteDissolve',voteId,agree:'yes'}),/无效/);
  r=act(b,{type:'voteDissolve',voteId,agree:true}); assert.equal(r.dissolution.votes.length,2);
  assert.throws(()=>service.mutate(c,id,{type:'voteDissolve',voteId,agree:true,revision:r.revision-1}),/已更新/);
  assert.throws(()=>act(b,{type:'voteDissolve',voteId,agree:true}),/已经投过/);
  assert.deepEqual(act(c,{type:'voteDissolve',voteId,agree:true}),{left:true,reason:'dissolved'});
  assert.equal(store.data.rooms[id],undefined);
  assert.equal(service.currentRoom(b),undefined);
});
test('a rejection resumes play; old vote IDs never affect a later request; host departure keeps pending vote valid',()=>{
  const {store,service,id,act}=fixture([a,b,c]);
  const first=act(a,{type:'requestDissolve'}).dissolution.id;
  assert.equal(act(b,{type:'voteDissolve',voteId:first,agree:false}).dissolution,null);
  act(b,{type:'game',command:{type:'look',slots:[0,1]}});
  const second=act(a,{type:'requestDissolve'}).dissolution.id;
  assert.throws(()=>act(c,{type:'voteDissolve',voteId:first,agree:true}),/已结束/);
  act(a,{type:'leave'}); assert.equal(store.data.rooms[id].hostId,b.id);
  // Optional room metadata survives reconstruction without changing persisted game schema.
  const restored=new RoomService(store,games);
  assert.equal(restored.snapshot(id,b).dissolution.id,second);
  act(b,{type:'voteDissolve',voteId:second,agree:true});
  act(c,{type:'voteDissolve',voteId:second,agree:true}); assert.equal(store.data.rooms[id],undefined);
});
test('AI takeover actually progresses, pauses during a vote and resumes after refusal',async t=>{
  const {store,service,id,act}=fixture([a,b,c]); const errors=[];
  const runner=new BotRunner(service,{delay:5,onError:e=>errors.push(e)}); t.after(()=>runner.stop());
  service.notify=id=>runner.sync(id);
  act(a,{type:'leave'});
  const voteId=act(b,{type:'requestDissolve'}).dissolution.id;
  const revision=store.data.rooms[id].revision;
  await sleep(30); assert.equal(store.data.rooms[id].revision,revision);
  act(c,{type:'voteDissolve',voteId,agree:false});
  for(let i=0;i<100&&!service.snapshot(id,b).game.players[0].setupDone;i++) await sleep(5);
  assert.equal(service.snapshot(id,b).game.players[0].setupDone,true);
  assert.deepEqual(errors,[]);
});
test('solo AI tables dissolve on the human vote; games without AI return remaining people to lobby on leave',()=>{
  const store=new JsonStore(), service=new RoomService(store,games);
  let r=service.createRoom(a,{gameId:'cabo',title:'Solo'});
  const act=input=>{const x=service.mutate(a,r.id,{...input,revision:r.revision});r=x;return x;};
  act({type:'addBot'});act({type:'ready',ready:true});act({type:'start'});
  assert.equal(act({type:'requestDissolve'}).reason,'dissolved');
  const f=fixture([a,b],createRegistry([{...cabo,bot:undefined}]));
  f.act(a,{type:'leave'});const view=f.service.snapshot(f.id,b);
  assert.equal(view.status,'lobby');assert.equal(view.game,null);assert.equal(view.players[0].ready,false);
});
test('public directory is opt-in, omits private rooms and never includes state, sessions or chat',()=>{
  const {service}=fixture();
  service.createRoom(c,{gameId:'cabo',title:'Public',visibility:'public'});
  const list=service.directory(); assert.equal(list.length,1);assert.equal(list[0].title,'Public');
  assert.deepEqual(Object.keys(list[0]).sort(),['allowSpectators','count','gameId','host','id','maxPlayers','status','title'].sort());
});
test('HTTP/SSE broadcasts closure to everyone and blocks departed session even with a forged bot flag',async t=>{
  const app=createApp({store:new JsonStore(),registry:games,botDelay:100000});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  async function request(path,data,cookie){const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
  const alice=await request('/session',{name:'Alice'}), bob=await request('/session',{name:'Bob'}), carol=await request('/session',{name:'Carol'});
  let r=(await request('/rooms',{gameId:'cabo',title:'Online',visibility:'public'},alice.cookie)).data; const id=r.id;
  r=(await request(`/rooms/${id}/join`,{},bob.cookie)).data;r=(await request(`/rooms/${id}/join`,{},carol.cookie)).data;
  const act=async(p,input)=>{const result=await request(`/rooms/${id}/actions`,{...input,revision:r.revision},p.cookie);if(result.status===200&&!result.data.left)r=result.data;return result;};
  for(const p of [alice,bob,carol])await act(p,{type:'ready',ready:true});await act(alice,{type:'start'});
  const controller=new AbortController(); t.after(()=>controller.abort());
  const stream=await fetch(`${base}/rooms/${id}/events`,{headers:{Cookie:bob.cookie},signal:controller.signal});const reader=stream.body.getReader();await reader.read();
  await act(alice,{type:'leave'});r=(await request(`/rooms/${id}`,undefined,bob.cookie)).data;
  assert.equal((await request(`/rooms/${id}/actions`,{type:'game',command:{type:'look',slots:[0,1]},bot:true,revision:r.revision},alice.cookie)).status,403);
  assert.equal((await request(`/rooms/${id}`,undefined,alice.cookie)).status,403);
  await act(bob,{type:'requestDissolve'});const result=await act(carol,{type:'voteDissolve',voteId:r.dissolution.id,agree:true});assert.equal(result.data.left,true);
  let transcript='';for(;;){const part=await reader.read();if(part.done)break;transcript+=new TextDecoder().decode(part.value);}
  assert.match(transcript,/"left":true,"reason":"dissolved"/);
  assert.equal((await request('/me',undefined,bob.cookie)).data.roomId,null);
  assert.equal((await request('/lobby')).data.rooms.length,0);
});
