import test from 'node:test';
import assert from 'node:assert/strict';
import {api,parseRoomEvent} from '../apps/web/api.js';
import {createApp} from '../apps/server/http.js';
import {JsonStore} from '../packages/platform/store.js';
import {createRegistry} from '../packages/games/registry.js';
import {quickPhrases,createRoomChat} from '../apps/web/room-chat.js';

test('API preserves server errors and handles HTML, empty, truncated and disconnected responses without leaking parser errors or replaying writes',async t=>{
  let calls=0;
  const respond=value=>t.mock.method(globalThis,'fetch',async()=>{calls++;return value;});
  respond(new Response(JSON.stringify({error:'房间已更新'}),{status:409}));
  await assert.rejects(api('/rooms/ABCD1234/actions',{}),e=>e.status===409 && e.message==='房间已更新' && !e.mayHaveCommitted);
  t.mock.restoreAll();
  for (const [body,status,writing,uncertain] of [['<html>upstream failed</html>',502,true,true],['',200,true,true],['{"id":',200,false,false],['null',200,false,false]]) {
    respond(new Response(body,{status}));const before=calls;
    await assert.rejects(api('/rooms/ABCD1234',writing?{}:undefined),e=>e.status===status && e.mayHaveCommitted===uncertain && !/JSON|Unexpected|html|upstream/i.test(e.message));
    assert.equal(calls,before+1);t.mock.restoreAll();
  }
  respond(new Response(JSON.stringify([{id:'cabo'}])));assert.deepEqual(await api('/games'),[{id:'cabo'}]);t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw new TypeError('Failed to fetch');});
  const before=calls;await assert.rejects(api('/rooms/ABCD1234/actions',{type:'game'}),e=>e.status===0 && e.mayHaveCommitted);assert.equal(calls,before+1);
});

test('SSE rejects malformed and invalid snapshots while preserving valid private views and room exit events',()=>{
  for (const text of ['', '<html>', '{"id":', 'null', '{}', '{"id":"ABCD1234","revision":1,"players":[],"chat":[]}']) assert.equal(parseRoomEvent(text),null);
  const snapshot={id:'ABCD1234',revision:3,status:'playing',gameId:'cabo',game:{phase:'turn'},players:[{id:'a',name:'甲'}],chat:[{id:'m',userId:'a',name:'甲',text:'你好',at:123}]};
  assert.deepEqual(parseRoomEvent(JSON.stringify(snapshot)),snapshot);
  assert.equal(parseRoomEvent(JSON.stringify({...snapshot,chat:[{text:'bad'}]})),null);
  assert.deepEqual(parseRoomEvent('{"id":"ABCD1234","left":true,"reason":"left"}'),{id:'ABCD1234',left:true,reason:'left'});
});

test('a committed action with a truncated HTTP response can be read back without replay; quick chat uses the real room endpoint without advancing game revision',async t=>{
  const demo={manifest:{id:'transport-demo',title:'网络验收',minPlayers:2,maxPlayers:2,stateVersion:1},create:()=>({count:0,secret:'never-leak-secret'}),apply:s=>({...s,count:s.count+1}),view:s=>({count:s.count}),isFinished:()=>false};
  const store=new JsonStore(),app=createApp({store,registry:createRegistry([demo])});
  const handler=app.server.listeners('request')[0];app.server.removeAllListeners('request');
  let broken=false,actionPosts=0;
  app.server.on('request',(req,res)=>{
    if(req.url.endsWith('/actions')){actionPosts++;if(broken){broken=false;const end=res.end;res.end=function(){return end.call(this,'{"revision":');};}}
    void handler(req,res);
  });
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));});
  const base=`http://127.0.0.1:${app.server.address().port}`,realFetch=globalThis.fetch;
  let cookie='';
  t.mock.method(globalThis,'fetch',async(path,options={})=>{
    const response=await realFetch(base+path,{...options,headers:{...options.headers,...(cookie?{cookie}:{})}});
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  });
  const a=await api('/session',{name:'甲'}),aCookie=cookie;
  let room=await api('/rooms',{gameId:demo.manifest.id,title:'网络验收'});
  cookie='';const b=await api('/session',{name:'乙'});
  room=await api(`/rooms/${room.id}/join`,{revision:room.revision});
  room=await api(`/rooms/${room.id}/actions`,{type:'ready',ready:true,revision:room.revision});
  cookie=aCookie;room=await api(`/rooms/${room.id}/actions`,{type:'ready',ready:true,revision:room.revision});
  room=await api(`/rooms/${room.id}/actions`,{type:'start',revision:room.revision});
  const revision=room.revision,posts=actionPosts;broken=true;
  await assert.rejects(api(`/rooms/${room.id}/actions`,{type:'game',command:{type:'play'},revision}),e=>e.mayHaveCommitted && !/Unexpected|JSON/i.test(e.message));
  const recovered=await api(`/rooms/${room.id}`);
  assert.equal(recovered.revision,revision+1);assert.deepEqual(recovered.game,{count:1});assert.equal(actionPosts,posts+1);
  const chat=createRoomChat({root:{querySelector:()=>null},getRoom:()=>recovered,getUser:()=>a});
  await chat.quick(0);
  const after=await api(`/rooms/${room.id}`);
  assert.equal(after.revision,recovered.revision);assert.deepEqual(after.game,recovered.game);
  assert.equal(after.chat.at(-1).text,quickPhrases[0]);assert.equal(after.chat.at(-1).userId,a.id);
  assert.equal(JSON.stringify(after).includes('never-leak-secret'),false);assert.notEqual(a.id,b.id);
});
