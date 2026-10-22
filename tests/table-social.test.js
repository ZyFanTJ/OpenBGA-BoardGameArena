import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {createRegistry} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';

const demo={manifest:{id:'social-demo',title:'同桌测试',minPlayers:2,maxPlayers:2,stateVersion:1},
 create:ids=>({ids,secret:'never-public',done:false}),apply:s=>({...s,done:true}),view:s=>({done:s.done}),isFinished:s=>s.done,
 result:s=>({winners:[s.ids[0]],players:s.ids.map((id,i)=>({id,rank:i+1,score:10-i,breakdown:[]}))})};

test('guest invite, revision conflict, postgame friends, rematch and opt-in safe sharing work through HTTP',async t=>{
 const store=new JsonStore(),app=createApp({store,registry:createRegistry([demo])});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));});
 const base=`http://127.0.0.1:${app.server.address().port}/api`;
 async function request(path,data,cookie){const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 const a=await request('/session',{name:'月见'}),b=await request('/session',{name:'星河'}),outsider=await request('/session',{name:'路过'});
 let room=(await request('/rooms',{gameId:demo.manifest.id,title:'月下牌桌'},a.cookie)).data;
 const preview=(await request(`/room-invites/${room.id}`)).data;
 assert.equal(preview.host,'月见');assert.equal(preview.count,1);
 for(const field of ['players','game','chat','hostId'])assert.equal(preview[field],undefined);
 assert.equal((await request(`/rooms/${room.id}`)).status,401);
 async function action(client,type,extra={}){const response=await request(`/rooms/${room.id}/actions`,{type,revision:room.revision,...extra},client.cookie);if(response.status===200)room=response.data;return response;}
 await action(a,'ready',{ready:true});
 assert.equal((await request(`/rooms/${room.id}/join`,{revision:preview.revision},b.cookie)).status,409);
 assert.equal(store.data.rooms[room.id].players.length,1);
 room=(await request(`/rooms/${room.id}/join`,{revision:room.revision},b.cookie)).data;
 assert.equal(b.data.registered,false);await action(b,'ready',{ready:true});await action(a,'start');
 assert.equal((await action(b,'rematchReady')).status,409);
 await action(a,'game',{command:{type:'finish'}});assert.equal(room.status,'finished');
 const matchId=room.matchId;
 assert.equal((await request(`/shares/${matchId}`)).status,404);
 assert.equal((await request(`/history/${matchId}/share`,{},outsider.cookie)).status,404);
 await request(`/history/${matchId}/share`,{},a.cookie);
 const shared=(await request(`/shares/${matchId}`)).data;
 assert.equal(shared.participants[0].name,'月见');
 for(const p of shared.participants)for(const field of ['id','reward','breakdown','friendCode'])assert.equal(p[field],undefined);
 assert.equal(JSON.stringify(shared).includes('never-public'),false);
 assert.equal((await request(`/rooms/${room.id}/join`,{revision:room.revision},outsider.cookie)).status,400);
 const requested=(await request('/friends/request',{playerId:b.data.id},a.cookie)).data;
 const accepted=await request('/friends/respond',{requestId:requested.requests[0].id,action:'accept'},b.cookie);assert.equal(accepted.data.friends[0].id,a.data.id);
 const oldRevision=room.revision;
 await action(b,'rematchReady');assert.deepEqual(room.rematchVotes,[b.data.id]);
 assert.equal((await request(`/rooms/${room.id}/actions`,{type:'rematch',revision:oldRevision},a.cookie)).status,409);
 assert.equal((await action(b,'rematch')).status,400);
 await action(a,'rematch');assert.equal(room.status,'lobby');assert.equal(room.game,null);assert.equal(room.players.find(p=>p.id===b.data.id).ready,true);assert.deepEqual(room.rematchVotes,[]);
 assert.equal((await request(`/shares/${matchId}`)).status,200);
});
