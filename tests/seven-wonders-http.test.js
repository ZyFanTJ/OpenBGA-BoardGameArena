import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';
import {JsonStore} from '../packages/platform/store.js';

test('7W HTTP/SSE projects simultaneous choices per viewer, rejects stale revisions, restores pending selection, and rematches',async t=>{
  let store=new JsonStore(),app,base;
  async function start(){app=createApp({store,registry:games,random:()=>.5,botDelay:5});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
  async function close(){app.closeStreams();await new Promise(r=>app.server.close(r));}
  await start();t.after(close);
  async function request(path,data,cookie){const r=await fetch(`${base}/api${path}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  const clients=[];for(const name of ['Alice','Bob','Carol'])clients.push(await request('/session',{name}));
  let room=(await request('/rooms',{gameId:'seven-wonders',title:'文明',options:{side:'day'}},clients[0].cookie)).data;
  for(const c of clients.slice(1))room=(await request(`/rooms/${room.id}/join`,{},c.cookie)).data;
  const act=async(c,input)=>{const r=await request(`/rooms/${room.id}/actions`,{...input,revision:room.revision},c.cookie);assert.equal(r.status,200,r.data.error);return room=r.data;};
  for(const c of clients)await act(c,{type:'ready',ready:true});await act(clients[0],{type:'start'});
  const response=await fetch(`${base}/api/rooms/${room.id}/events`,{headers:{Cookie:clients[1].cookie}}),reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  async function event(){while(!buffer.includes('\n\n')){const part=await reader.read();assert.equal(part.done,false);buffer+=decoder.decode(part.value);}const i=buffer.indexOf('\n\n'),part=buffer.slice(0,i);buffer=buffer.slice(i+2);return JSON.parse(part.split('\n').find(l=>l.startsWith('data: ')).slice(6));}
  const bobBefore=await event(),stale=room.revision,picked=room.game.hand[0].id;
  await act(clients[0],{type:'game',command:{type:'choose',epoch:room.game.epoch,cardId:picked,action:'sell'}});
  const pushed=await event();assert.equal(pushed.revision,room.revision);assert.equal(pushed.game.pending,null);assert.ok(!JSON.stringify(pushed.game).includes(picked));assert.deepEqual(pushed.game.hand,bobBefore.game.hand);
  const failed=await request(`/rooms/${room.id}/actions`,{type:'game',revision:stale,command:{type:'choose',epoch:room.game.epoch,cardId:pushed.game.hand[0].id,action:'sell'}},clients[1].cookie);assert.equal(failed.status,409);
  assert.equal(store.data.rooms[room.id].game.pending[clients[1].data.id],undefined);await reader.cancel();
  const stored=JSON.stringify(store.data),myView=room.game;await close();store=new JsonStore();store.transaction(d=>Object.assign(d,JSON.parse(stored)));await start();
  room=(await request(`/rooms/${room.id}`,undefined,clients[0].cookie)).data;assert.deepEqual(room.game,myView);assert.equal((await request('/me',undefined,clients[1].cookie)).data.roomId,room.id);
  for(const c of clients.slice(1)){const own=(await request(`/rooms/${room.id}`,undefined,c.cookie)).data;await act(c,{type:'game',command:{type:'choose',epoch:own.game.epoch,cardId:own.game.hand[0].id,action:'sell'}});}
  assert.equal(room.game.round,2);assert.equal(room.game.lastActions.length,3);assert.ok(room.game.lastActions.every(a=>!a.card));
  for(const p of ['/games/seven-wonders/index.js','/games/seven-wonders/style.css'])assert.equal((await fetch(base+p)).status,200);
  // Finish through real room transactions, using each player's legal projection.
  while(room.status==='playing'){
    const c=clients.find(c=>games.get('seven-wonders').bot.decide(games.get('seven-wonders').view(store.data.rooms[room.id].game,c.data.id),c.data.id));assert.ok(c);
    const command=games.get('seven-wonders').bot.decide(games.get('seven-wonders').view(store.data.rooms[room.id].game,c.data.id),c.data.id);
    await act(c,{type:'game',command});
  }
  assert.equal(room.status,'finished');assert.equal(room.game.ageResults.length,3);await act(clients[0],{type:'rematch'});assert.equal(room.status,'lobby');assert.equal(room.game,null);
});
