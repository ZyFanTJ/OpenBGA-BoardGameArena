import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {RoomSockets} from '../apps/server/room-sockets.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SessionService} from '../packages/platform/sessions.js';
import {JsonStore} from '../packages/platform/store.js';
import {createRegistry} from '../packages/games/registry.js';

async function setup(t){
 const game={manifest:{id:'socket-test',title:'Socket test',minPlayers:1,maxPlayers:2,stateVersion:1},create:()=>({secret:'NEVER-PUBLISH',count:0}),apply:s=>({...s,count:s.count+1}),isFinished:()=>false,view:(s,id)=>({count:s.count,viewer:id}),spectatorView:s=>({count:s.count,public:true})};
 const store=new JsonStore(),sessions=new SessionService(store);let sockets;
 const rooms=new RoomService(store,createRegistry([game]),{notify:(...args)=>sockets?.publish(...args)}),a=sessions.create('A'),b=sessions.create('B'),outsider=sessions.create('Observer');
 let r=rooms.createRoom(a.user,{gameId:game.manifest.id,title:'Socket test',visibility:'public'});r=rooms.join(b.user,r.id);for(const p of [a,b])r=rooms.mutate(p.user,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(a.user,r.id,{type:'start',revision:r.revision});
 const server=createServer();sockets=new RoomSockets(server,rooms,sessions);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{sockets.close();server.close();});
 const url=`ws://127.0.0.1:${server.address().port}/api/rooms/${r.id}`;
 async function connect(session,path='socket'){
  const ws=new WebSocket(`${url}/${path}`,{headers:{Cookie:`moon_session=${session.token}`}}),queue=[],waiting=[];
  ws.on('message',text=>{const value=JSON.parse(text);if(waiting.length)waiting.shift()(value);else queue.push(value);});
  const next=()=>queue.length?Promise.resolve(queue.shift()):new Promise(resolve=>waiting.push(resolve));
  await once(ws,'open');return {ws,next};
 }
 async function rejected(session,extra={}){const ws=new WebSocket(`${url}/socket`,{headers:{...(session?{Cookie:`moon_session=${session.token}`}:{}) ,...extra}});ws.on('error',()=>{});const [,response]=await once(ws,'unexpected-response');ws.terminate();return response.statusCode;}
 return {rooms,sessions,sockets,store,r,a,b,outsider,connect,rejected};
}
test('WebSocket authenticates session and membership, rejects foreign origins and limits duplicate tabs', {timeout:10000},async t=>{
 const f=await setup(t);assert.equal(await f.rejected(null),401);assert.equal(await f.rejected(f.outsider),403);assert.equal(await f.rejected(f.a,{Origin:'https://foreign.example'}),403);
 const peers=[];for(let i=0;i<5;i++){const c=await f.connect(f.a);await c.next();peers.push(c);}assert.equal(await f.rejected(f.a),429);for(const c of peers)c.ws.close();
});
test('every socket push is player projected, observers stay public, reconnect returns current state', {timeout:10000},async t=>{
 const f=await setup(t),a=await f.connect(f.a),b=await f.connect(f.b),watch=await f.connect(f.outsider,'watch-socket');
 assert.equal((await a.next()).game.viewer,f.a.user.id);assert.equal((await b.next()).game.viewer,f.b.user.id);assert.equal((await watch.next()).game.public,true);
 f.rooms.mutate(f.a.user,f.r.id,{type:'game',command:{},revision:f.r.revision});const pushes=await Promise.all([a.next(),b.next(),watch.next()]);assert.equal(pushes[0].game.count,1);assert.equal(pushes[1].game.viewer,f.b.user.id);assert.equal(pushes[2].game.viewer,undefined);assert.ok(!JSON.stringify(pushes).includes('NEVER-PUBLISH'));
 a.ws.terminate();const again=await f.connect(f.a);assert.equal((await again.next()).game.count,1);
 const closed=once(b.ws,'close');f.sessions.revoke(f.b.token);f.sockets.publish(f.r.id);assert.equal((await closed)[0],1008);
 const forbidden=once(again.ws,'close');again.ws.send('{"type":"build"}');assert.equal((await forbidden)[0],1008);
 const watchClosed=once(watch.ws,'close'),r=f.rooms.snapshot(f.r.id,f.a.user);f.rooms.mutate(f.a.user,r.id,{type:'setSpectators',allowSpectators:false,revision:r.revision});assert.equal((await watchClosed)[0],1008);
});
test('slow socket drops projected frames before expensive view work and recovers with a complete snapshot',async t=>{
 const f=await setup(t),events=[];const ws={readyState:WebSocket.OPEN,bufferedAmount:300000,send:text=>events.push(JSON.parse(text)),close(){this.closed=true;},terminate(){}};
 const client={ws,id:f.r.id,user:f.a.user,token:f.a.token,spectator:false,blockedAt:0};f.sockets.clients.add(client);f.sockets.publish(f.r.id,undefined,{type:'realtime'});assert.equal(events.length,0);ws.bufferedAmount=0;f.sockets.publish(f.r.id,undefined,{type:'realtime'});assert.equal(events[0].game.viewer,f.a.user.id);assert.equal(events[0].realtimeFrame,true);ws.bufferedAmount=300000;client.blockedAt=Date.now()-6000;f.sockets.publish(f.r.id);assert.equal(ws.closed,true);
});
