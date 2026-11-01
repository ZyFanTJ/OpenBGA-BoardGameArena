import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { JsonStore } from '../packages/platform/store.js';
import { games } from '../packages/games/registry.js';

test('UNO HTTP/SSE redacts hands, rejects stale commands atomically, restores and archives a complete match',async t=>{
  let store=new JsonStore(),app,base,seed=51;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  async function start(){app=createApp({store,registry:games,random});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
  async function close(){app.closeStreams();await new Promise(r=>app.server.close(r));}
  await start();t.after(close);
  async function request(path,data,cookie){const response=await fetch(base+'/api'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  const catalog=(await request('/games')).data.find(g=>g.id==='uno');assert.equal(catalog.maxPlayers,10);assert.equal(catalog.stateVersion,1);
  assert.equal((await request('/me/room')).status,401);
  const a=await request('/session',{name:'A'}),b=await request('/session',{name:'B'}),clients=[a,b];
  assert.deepEqual((await request('/me/room',undefined,a.cookie)).data,{room:null});
  let room=(await request('/rooms',{gameId:'uno',options:{target:100},turnSeconds:0,title:'UNO integration'},a.cookie)).data;
  room=(await request(`/rooms/${room.id}/join`,{},b.cookie)).data;
  const mutate=async(c,action)=>{const r=await request(`/rooms/${room.id}/actions`,{...action,revision:room.revision},c.cookie);assert.equal(r.status,200,r.data.error);room=r.data;return room;};
  for(const c of clients)await mutate(c,{type:'ready',ready:true});await mutate(a,{type:'start'});
  assert.equal(room.game.hand.length,7);assert.equal(room.game.deck,undefined);assert.ok(room.game.players.every(p=>p.hand===undefined));
  for(const c of clients){
    const current=await request('/me/room',undefined,c.cookie);
    assert.equal(current.status,200);assert.equal(current.data.room.id,room.id);
    assert.deepEqual(current.data.room.game,games.get('uno').view(store.data.rooms[room.id].game,c.data.id));
    assert.equal(current.data.room.game.deck,undefined);
    assert.ok(current.data.room.game.players.every(p=>p.hand===undefined));
  }
  const stream=await fetch(`${base}/api/rooms/${room.id}/events`,{headers:{Cookie:b.cookie}}),reader=stream.body.getReader(),decoder=new TextDecoder();let buffer='';
  async function event(){while(!buffer.includes('\n\n')){const {value,done}=await reader.read();assert.equal(done,false);buffer+=decoder.decode(value);}const end=buffer.indexOf('\n\n'),part=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(part.split('\n').find(l=>l.startsWith('data: ')).slice(6));}
  await event();const rev=room.revision,state=store.data.rooms[room.id].game,id=games.get('uno').turn(state).players[0],actor=clients.find(c=>c.data.id===id);
  const own=(await request(`/rooms/${room.id}`,undefined,actor.cookie)).data.game;
  await mutate(actor,{type:'game',command:games.get('uno').timeout(own,id)});
  const push=await event();assert.equal(push.revision,room.revision);assert.deepEqual(push.game.hand,store.data.rooms[room.id].game.players.find(p=>p.id===b.data.id).hand);assert.equal(push.game.deck,undefined);assert.ok(push.game.players.every(p=>p.hand===undefined));
  const saved=JSON.stringify(store.data.rooms[room.id]);const stale=await request(`/rooms/${room.id}/actions`,{revision:rev,type:'game',command:{type:'draw'}},actor.cookie);assert.equal(stale.status,409);assert.equal(JSON.stringify(store.data.rooms[room.id]),saved);await reader.cancel();
  const persisted=JSON.stringify(store.data);await close();store=new JsonStore();store.transaction(data=>Object.assign(data,JSON.parse(persisted)));await start();
  const restored=(await request(`/rooms/${room.id}`,undefined,a.cookie)).data;assert.equal(restored.revision,room.revision);assert.deepEqual(restored.game,games.get('uno').view(store.data.rooms[room.id].game,a.data.id));
  for(let step=0;step<3000&&room.status!=='finished';step++){
    const s=store.data.rooms[room.id].game;
    if(s.phase==='roundEnd'){await mutate(a,{type:'game',command:{type:'nextRound'}});continue;}
    const id=games.get('uno').turn(s).players[0],c=clients.find(c=>c.data.id===id),v=(await request(`/rooms/${room.id}`,undefined,c.cookie)).data.game;
    await mutate(c,{type:'game',command:games.get('uno').timeout(v,id)});
  }
  assert.equal(room.status,'finished');assert.equal(Object.values(store.data.matches).filter(m=>m.gameId==='uno').length,1);
  const result=(await request('/history',undefined,a.cookie));assert.equal(result.status,200);assert.equal(result.data.items[0].gameId,'uno');
  for(const path of ['/games/uno/index.js','/games/uno/art.js','/games/uno/style.css'])assert.equal((await fetch(base+path)).status,200);
});
