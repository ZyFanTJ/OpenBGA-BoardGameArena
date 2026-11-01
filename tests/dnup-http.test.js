import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/http.js';
import {JsonStore} from '../packages/platform/store.js';
import {games} from '../packages/games/registry.js';
test('DNUP HTTP/SSE privacy, stale revision, persistence, full game and assets',async t=>{
 let store=new JsonStore(),app,base,seed=19;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 async function start(){app=createApp({store,registry:games,random});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
 async function close(){app.closeStreams();await new Promise(r=>app.server.close(r));}
 await start();t.after(close);
 async function request(path,data,cookie){const r=await fetch(base+'/api'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const clients=[];for(const name of ['翻转甲','翻转乙','翻转丙'])clients.push(await request('/session',{name}));
 const host=clients[0];let room=(await request('/rooms',{gameId:'dnup',options:{},turnSeconds:0,title:'DNUP 完整测试'},host.cookie)).data;
 for(const c of clients.slice(1))room=(await request(`/rooms/${room.id}/join`,{},c.cookie)).data;
 const mutate=async(c,action)=>{const r=await request(`/rooms/${room.id}/actions`,{...action,revision:room.revision},c.cookie);assert.equal(r.status,200,r.data.error);room=r.data;};
 for(const c of clients)await mutate(c,{type:'ready',ready:true});await mutate(host,{type:'start'});
 const game=games.get('dnup'),id=game.turn(store.data.rooms[room.id].game).players[0],actor=clients.find(c=>c.data.id===id),other=clients.find(c=>c!==actor);
 const stream=await fetch(`${base}/api/rooms/${room.id}/events`,{headers:{Cookie:other.cookie}}),reader=stream.body.getReader();let buffer='';const decoder=new TextDecoder();
 async function event(){while(!buffer.includes('\n\n')){const {value,done}=await reader.read();assert.equal(done,false);buffer+=decoder.decode(value);}const end=buffer.indexOf('\n\n'),part=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(part.split('\n').find(l=>l.startsWith('data: ')).slice(6));}
 await event();const revision=room.revision;await mutate(actor,{type:'game',command:{type:'rotate'}});const push=await event();
 assert.ok(push.game.players.every(p=>p.id===other.data.id?Array.isArray(p.hand):p.hand===null));assert.equal(push.game.discard,undefined);assert.deepEqual(push.game.events.find(e=>e.type==='rotate'),{type:'rotate',playerId:id});assert.deepEqual(push.game,game.view(store.data.rooms[room.id].game,other.data.id));await reader.cancel();
 const before=JSON.stringify(store.data.rooms[room.id]);const stale=await request(`/rooms/${room.id}/actions`,{revision,type:'game',command:{type:'rotate'}},actor.cookie);assert.equal(stale.status,409);assert.equal(JSON.stringify(store.data.rooms[room.id]),before);
 const saved=JSON.stringify(store.data);await close();store=new JsonStore();store.transaction(data=>Object.assign(data,JSON.parse(saved)));await start();assert.equal((await request(`/rooms/${room.id}`,undefined,host.cookie)).data.revision,room.revision);
 for(let i=0;i<1200&&room.status!=='finished';i++){const s=store.data.rooms[room.id].game;if(s.phase==='roundEnd'){await mutate(host,{type:'game',command:{type:'nextRound'}});continue;}const id=game.turn(s).players[0],c=clients.find(c=>c.data.id===id),v=(await request(`/rooms/${room.id}`,undefined,c.cookie)).data.game;await mutate(c,{type:'game',command:game.timeout(v,id)});}
 assert.equal(room.status,'finished');assert.equal((await request('/history',undefined,host.cookie)).data.items[0].gameId,'dnup');
 for(const path of ['/games/dnup/index.js','/games/dnup/style.css','/games/dnup/guide.js','/games/dnup/spectator.js','/assets/dnup/cover.svg'])assert.equal((await fetch(base+path)).status,200);
});
