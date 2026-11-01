import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {JsonStore} from '../packages/platform/store.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SocialService} from '../packages/platform/social.js';
import {RoomReaper} from '../packages/platform/room-reaper.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
function fixture(store=new JsonStore()){
 let now=0,reaper;
 const rooms=new RoomService(store,games,{now:()=>now,random:()=>.42,notify:id=>reaper?.sync(id)}),sessions=new SessionService(store),social=new SocialService(store,rooms,games,{now:()=>now});
 const a=sessions.create('甲'),b=sessions.create('乙');
 reaper=new RoomReaper(rooms,{isOnline:id=>social.isOnline(id)});
 let room=rooms.createRoom(a.user,{gameId:'uno',title:'空房清理测试',options:{target:100},turnSeconds:0});
 room=rooms.join(b.user,room.id);
 const act=(c,action)=>{room=rooms.mutate(c.user,room.id,{...action,revision:store.data.rooms[room.id].revision});return room;};
 return {store,rooms,social,sessions,reaper,a,b,get room(){return store.data.rooms[room.id];},id:room.id,advance:ms=>{now+=ms;},act,touch(c){social.touch(c.user);reaper.touch(c.user.id);},start(){for(const c of [a,b])act(c,{type:'ready',ready:true});act(a,{type:'start'});}};
}
test('unseen users are offline even at time zero; an online human protects the room beyond five minutes',()=>{
 const f=fixture();assert.equal(f.social.isOnline(f.a.user.id),false);
 for(let i=0;i<30;i++){f.touch(f.a);f.advance(20000);f.reaper.sweep();}
 assert.ok(f.room);assert.equal(f.reaper.absentSince.has(f.id),false);
 f.advance(75000);f.reaper.sweep();f.advance(299999);f.reaper.sweep();assert.ok(f.room);
 f.advance(1);f.reaper.sweep();assert.equal(f.room,undefined);
});
test('reconnecting near the deadline resets the entire offline period, including when a tab returns between sweeps',()=>{
 const f=fixture();f.reaper.sweep();f.advance(299999);f.touch(f.b);f.advance(75000);f.reaper.sweep();
 assert.ok(f.room);f.advance(299999);f.reaper.sweep();assert.ok(f.room);f.advance(1);f.reaper.sweep();assert.equal(f.room,undefined);
});
test('bot activity and room revisions never reset the human absence clock, and pending invitations are cancelled',()=>{
 const f=fixture();f.act(f.a,{type:'addBot'});f.start();
 f.store.transaction(data=>{data.invitations.gc={id:'gc',roomId:f.id,status:'pending'};data.invitations.old={id:'old',roomId:f.id,status:'accepted'};});
 const users=structuredClone(f.store.data.profiles),ledger=structuredClone(f.store.data.transactions);
 for(let i=0;i<10;i++){f.advance(30000);f.store.transaction(data=>data.rooms[f.id].revision++);f.rooms.notify(f.id);f.reaper.sweep();}
 assert.equal(f.room,undefined);assert.equal(f.store.data.invitations.gc.status,'cancelled');assert.equal(f.store.data.invitations.old.status,'accepted');
 assert.deepEqual(f.store.data.profiles,users);assert.deepEqual(f.store.data.transactions,ledger);assert.deepEqual(f.store.data.matches,{});
});
test('revision and presence are checked inside the same transaction, so stale cleanup cannot delete a returned player',()=>{
 const f=fixture(),revision=f.room.revision;f.act(f.a,{type:'ready',ready:true});
 assert.equal(f.rooms.reclaim(f.id,{revision,isVacant:()=>true}),false);assert.ok(f.room);
 f.reaper.sweep();f.advance(300000);
 const transaction=f.store.transaction.bind(f.store);let entered=false;
 f.store.transaction=update=>transaction(data=>{entered=true;f.social.touch(f.a.user);update(data);});
 f.reaper.sweep();assert.equal(entered,true);assert.ok(f.room);
 f.store.transaction=transaction;f.reaper.sweep();assert.equal(f.reaper.absentSince.has(f.id),false);
});
test('failed persistence leaves the room recoverable and cleanup retries on the next sweep',()=>{
 const f=fixture(),errors=[];f.reaper.onError=error=>errors.push(error);f.reaper.sweep();f.advance(300000);
 const transaction=f.store.transaction.bind(f.store);f.store.transaction=()=>{throw new Error('disk unavailable');};
 f.reaper.sweep();assert.ok(f.room);assert.equal(errors.length,1);f.store.transaction=transaction;f.reaper.sweep();assert.equal(f.room,undefined);
});
test('restart gives persisted rooms a full reconnect grace period without changing game or storage schemas',()=>{
 const f=fixture();f.start();const saved=structuredClone(f.store.data);f.advance(900000);f.reaper.stop();
 const restarted=new RoomReaper(f.rooms,{isOnline:()=>false});restarted.sweep();assert.deepEqual(f.store.data,saved);
 f.advance(299999);restarted.sweep();assert.ok(f.room);f.advance(1);restarted.sweep();assert.equal(f.room,undefined);restarted.stop();
 assert.equal(f.store.data.version,10);assert.equal(games.get('uno').manifest.stateVersion,1);
});
test('finished match history and rewards survive cleanup and a real SQLite reopen',()=>{
 const work=resolve('work');mkdirSync(work,{recursive:true});const dir=mkdtempSync(join(work,'room-reaper-')),file=join(dir,'store.sqlite');let store;
 try{
  store=new SqliteStore(file);const f=fixture(store);f.start();
  store.transaction(data=>{const s=data.rooms[f.id].game;s.phase='turn';s.turn=0;s.color='red';s.discard=[{id:'top',color:'red',value:1}];s.players[0].hand=[{id:'last',color:'red',value:1}];s.players[1].hand=[{id:'w1',color:null,value:'wild'},{id:'w2',color:null,value:'wild4'}];});
  f.act(f.a,{type:'game',command:{type:'play',cardId:'last',uno:true}});assert.equal(f.room.status,'finished');
  const history=structuredClone(store.data.matches),ledger=structuredClone(store.data.transactions),profiles=structuredClone(store.data.profiles);
  assert.equal(Object.keys(history).length,1);f.advance(300000);f.reaper.sweep();assert.equal(f.room,undefined);store.close();store=null;store=new SqliteStore(file);
  assert.equal(store.data.rooms[f.id],undefined);assert.deepEqual(store.data.matches,history);assert.deepEqual(store.data.transactions,ledger);assert.deepEqual(store.data.profiles,profiles);
 }finally{store?.close();assert.ok(resolve(dir).startsWith(work+sep));rmSync(dir,{recursive:true,force:true});}
});
test('HTTP presence is authenticated and read-only, and inactive rooms close SSE and all scheduled work',async t=>{
 let now=0;const store=new JsonStore(),app=createApp({store,registry:games,now:()=>now,botDelay:60000});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
 const base=`http://127.0.0.1:${app.server.address().port}/api`;
 async function request(path,data,cookie){const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 assert.equal((await request('/presence')).status,401);const a=await request('/session',{name:'HTTP 空房检查'});
 let room=(await request('/rooms',{gameId:'uno',title:'HTTP 空房',turnSeconds:60},a.cookie)).data;
 const act=async action=>{const result=await request(`/rooms/${room.id}/actions`,{...action,revision:room.revision},a.cookie);assert.equal(result.status,200);room=result.data;};
 await act({type:'addBot'});await act({type:'ready',ready:true});await act({type:'start'});
 const before=JSON.stringify(store.data),heartbeat=await request('/presence',undefined,a.cookie);assert.equal(heartbeat.status,200);assert.deepEqual(heartbeat.data,{ok:true});assert.equal(JSON.stringify(store.data),before);
 const stream=await fetch(base+`/rooms/${room.id}/events?protocol=2`,{headers:{Cookie:a.cookie}}),reader=stream.body.getReader(),decoder=new TextDecoder();await reader.read();
 now=75000;app.reaper.sweep();now+=299999;app.reaper.sweep();assert.ok(store.data.rooms[room.id]);now++;app.reaper.sweep();
 let text='';for(;;){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value);}
 assert.match(text,/"left":true/);assert.match(text,/"reason":"inactive"/);assert.equal(store.data.rooms[room.id],undefined);
 assert.equal(app.bots.timers.size,0);assert.equal(app.bots.memories.size,0);assert.equal(app.turns.timers.size,0);assert.equal(app.effects.queue.size,0);assert.equal(app.service.effectProgress.size,0);
 assert.equal((await request(`/rooms/${room.id}`,undefined,a.cookie)).status,404);assert.equal((await request('/me',undefined,a.cookie)).data.roomId,null);
 app.closeStreams();assert.equal(app.reaper.timer,null);assert.equal(app.reaper.absentSince.size,0);
});
