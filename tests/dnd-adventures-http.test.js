import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/server/http.js';
import { games } from '../packages/games/registry.js';
import { JsonStore } from '../packages/platform/store.js';

test('Adventure selection is validated and revision-locked; selected pack survives server restart',async t=>{
  let store=new JsonStore(),app,base;
  const start=async()=>{ app=createApp({store,registry:games,random:()=>.8}); await new Promise(r=>app.server.listen(0,'127.0.0.1',r)); base=`http://127.0.0.1:${app.server.address().port}`; };
  const stop=async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));};
  await start();t.after(stop);
  let cookie;
  async function request(path,body) {
    const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    cookie??=r.headers.get('set-cookie')?.split(';')[0]; return {status:r.status,data:await r.json()};
  }
  await request('/session',{name:'Adventure test'});
  assert.equal((await request('/rooms',{gameId:'dnd',title:'Invalid',options:{adventureId:'unlicensed-book'}})).status,400);
  let room=(await request('/rooms',{gameId:'dnd',title:'Test',options:{adventureId:'blackapple',dmMode:'local'}})).data;
  const initialRevision=room.revision;
  room=(await request(`/rooms/${room.id}/actions`,{type:'updateOptions',revision:initialRevision,options:{adventureId:'morgansfort',dmMode:'local'}})).data;
  assert.equal(room.options.adventureId,'morgansfort');
  assert.equal((await request(`/rooms/${room.id}/actions`,{type:'updateOptions',revision:initialRevision,options:{adventureId:'blackapple'}})).status,409);
  async function action(body){const r=await request(`/rooms/${room.id}/actions`,{revision:room.revision,...body});assert.equal(r.status,200,r.data.error);room=r.data;}
  await action({type:'ready',ready:true});await action({type:'start'});
  await action({type:'game',command:{type:'character',archetype:'wizard',name:'Test'}});
  await action({type:'game',command:{type:'choose',choiceId:'talk:bart'}});
  await action({type:'game',command:{type:'choose',choiceId:'travel:river'}});
  assert.equal(room.game.scene.id,'river');
  const persisted=JSON.stringify(store.data);await stop();store=new JsonStore();store.transaction(data=>Object.assign(data,JSON.parse(persisted)));await start();
  room=(await request(`/rooms/${room.id}`)).data;
  assert.equal(room.game.adventure.id,'morgansfort');assert.equal(room.game.scene.id,'river');assert.match(room.game.clues.join(','),/巴特/);
  assert.ok(!JSON.stringify(room).includes('裁信刀'));assert.ok(!JSON.stringify(room).includes('stirges'));
  assert.equal((await request(`/rooms/${room.id}/actions`,{type:'updateOptions',revision:room.revision,options:{adventureId:'blackapple'}})).status,403);
  for(const file of ['catalog.js','adventure-art.js','adventure-picker.js']) assert.equal((await fetch(`${base}/games/dnd/${file}`)).status,200);
  assert.equal((await fetch(`${base}/packages/games/dnd/adventures/blackapple.js`)).status,404);
});
