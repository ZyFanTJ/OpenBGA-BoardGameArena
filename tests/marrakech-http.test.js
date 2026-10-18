import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { games } from '../packages/games/registry.js';
import { JsonStore } from '../packages/platform/store.js';

test('Marrakech HTTP/SSE keeps rug stacks private, syncs peers, and restores a place phase after restart', async t => {
  let store = new JsonStore(), app, base;
  async function start() {
    app = createApp({ store, registry: games, random: () => 0, botDelay: 5 });
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
    base = `http://127.0.0.1:${app.server.address().port}/api`;
  }
  async function close() { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); }
  await start(); t.after(close);
  async function request(path, data, cookie) {
    const response = await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
    return { status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0] };
  }
  assert.ok((await request('/games')).data.some(g=>g.id==='marrakech'));
  const a=await request('/session',{name:'Alice'}),b=await request('/session',{name:'Bob'});
  let r=(await request('/rooms',{gameId:'marrakech',title:'Marrakech'},a.cookie)).data;
  r=(await request(`/rooms/${r.id}/join`,{},b.cookie)).data;
  const action=async(client,input)=>{const response=await request(`/rooms/${r.id}/actions`,{...input,revision:r.revision},client.cookie);assert.equal(response.status,200);return r=response.data;};
  await action(a,{type:'ready',ready:true});await action(b,{type:'ready',ready:true});await action(a,{type:'start'});
  const response=await fetch(`${base}/rooms/${r.id}/events`,{headers:{Cookie:b.cookie}}),reader=response.body.getReader();
  const decoder=new TextDecoder();let buffer='';
  async function event() {
    while(!buffer.includes('\n\n')) { const result=await reader.read();assert.equal(result.done,false);buffer+=decoder.decode(result.value); }
    const split=buffer.indexOf('\n\n'),part=buffer.slice(0,split);buffer=buffer.slice(split+2);
    return JSON.parse(part.split('\n').find(line=>line.startsWith('data: ')).slice(6));
  }
  await event();
  await action(a,{type:'game',command:{type:'roll',direction:0}});
  const push=await event();assert.equal(push.revision,r.revision);assert.deepEqual(push.game.pawn,r.game.pawn);
  assert.deepEqual(push.game.legal.placements,[]);assert.ok(r.game.legal.placements.length);
  assert.ok(push.game.players.every(p=>!('rugs' in p)));assert.deepEqual(push.game.lastEvent,r.game.lastEvent);
  await reader.cancel();
  const persisted=JSON.stringify(store.data);await close();
  store=new JsonStore();store.transaction(data=>Object.assign(data,JSON.parse(persisted)));await start();
  const restored=(await request(`/rooms/${r.id}`,undefined,a.cookie)).data;
  assert.deepEqual(restored.game,r.game);assert.equal((await request('/me',undefined,b.cookie)).data.roomId,r.id);
  await action(a,{type:'game',command:{type:'place',cells:r.game.legal.placements[0]}});
  assert.equal(r.game.turnId,b.data.id);
  const peer=(await request(`/rooms/${r.id}`,undefined,b.cookie)).data;
  assert.deepEqual(peer.game.board,r.game.board);assert.equal(peer.game.legal.directions.length,3);
  for(const p of ['/games/marrakech/index.js','/games/marrakech/art.js','/games/marrakech/style.css']) assert.equal((await fetch(base.replace('/api','')+p)).status,200);
});
