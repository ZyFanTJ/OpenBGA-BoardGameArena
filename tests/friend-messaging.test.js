import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SocialService} from '../packages/platform/social.js';
import {FriendChatService} from '../packages/platform/friend-chat.js';
import {GameAppointmentService} from '../packages/platform/game-appointments.js';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';
import {appointmentCards} from '../apps/web/hub/friend-messaging.js';

function fixture(store=new JsonStore()) {
 let now=Date.now();const sessions=new SessionService(store),rooms=new RoomService(store,games),social=new SocialService(store,rooms,games,{now:()=>now}),chat=new FriendChatService(store,social,{now:()=>now}),appointments=new GameAppointmentService(store,social,games,{now:()=>now});
 const a=sessions.create('甲'),b=sessions.create('乙'),c=sessions.create('旁观者');
 const connect=()=>{social.request(a.user,{playerId:b.user.id});social.respond(b.user,{requestId:social.list(b.user).requests[0].id,action:'accept'});};connect();
 return {store,sessions,social,chat,appointments,a:a.user,b:b.user,c:c.user,clients:[a,b,c],connect,advance:ms=>now+=ms,input:()=>({playerId:b.user.id,gameId:'cabo',startsAt:now+3600000,note:'今晚见',requestId:'appointment-request-0001'})};
}
for(const Adapter of [JsonStore,SqliteStore])test(`${Adapter.name}: private chat authorization, replay, read cursors and relationship replacement`,t=>{
 const f=fixture(new Adapter());t.after(()=>f.store.close?.());
 assert.throws(()=>f.chat.list(f.c,f.a.id),{status:403});assert.throws(()=>f.chat.send(f.a,f.c.id,{text:'x',requestId:'request-id-000000'}),{status:403});
 const input={text:'<img src=x onerror=alert(1)>',requestId:'request-id-000001'},sent=f.chat.send(f.a,f.b.id,input).message;
 assert.equal(f.chat.send(f.a,f.b.id,input).message.id,sent.id);assert.throws(()=>f.chat.send(f.a,f.b.id,{...input,text:'changed'}),{status:409});
 assert.equal(f.chat.summary(f.b,f.a.id).unread,1);assert.equal(f.chat.summary(f.a,f.b.id).unread,0);
 assert.throws(()=>f.chat.read(f.b,f.a.id,{through:2}));f.chat.read(f.b,f.a.id,{through:1});
 f.advance(501);f.chat.send(f.a,f.b.id,{text:'new',requestId:'request-id-000002'});f.chat.read(f.b,f.a.id,{through:1});assert.equal(f.chat.summary(f.b,f.a.id).unread,1);
 assert.throws(()=>f.chat.send(f.a,f.b.id,{text:' ',requestId:'request-id-000003'}));assert.throws(()=>f.chat.send(f.a,f.b.id,{text:'x'.repeat(501),requestId:'request-id-000003'}));
 const before=structuredClone(f.store.data);assert.throws(()=>f.chat.send(f.a,f.b.id,{text:'too fast',requestId:'request-id-000003'}),{status:429});assert.deepEqual(f.store.data,before);
 f.social.remove(f.a,{playerId:f.b.id});assert.throws(()=>f.chat.list(f.b,f.a.id),{status:403});f.connect();assert.equal(f.chat.list(f.a,f.b.id).messages.length,0);
});
test('chat pagination is bounded and never marks unseen messages read',()=>{
 const f=fixture();for(let i=0;i<205;i++){f.advance(501);f.chat.send(f.a,f.b.id,{text:String(i),requestId:`message-request-${i}`});}
 const page=f.chat.list(f.b,f.a.id);assert.equal(page.messages.length,50);assert.equal(page.messages.at(-1).sequence,205);assert.equal(f.chat.summary(f.b,f.a.id).unread,200);
 const older=f.chat.list(f.b,f.a.id,{before:page.nextBefore});assert.equal(older.messages.at(-1).sequence,155);assert.equal(older.messages.length,50);
 assert.throws(()=>f.chat.list(f.b,f.a.id,{before:'NaN'}));f.chat.read(f.b,f.a.id,{through:155});assert.equal(f.chat.summary(f.b,f.a.id).unread,50);
});
test('appointments enforce friendship, dates, participant roles, revisions, idempotency and expiry',()=>{
 const f=fixture(),input=f.input();
 assert.throws(()=>f.appointments.create(f.c,input),{status:403});
 for(const startsAt of [NaN,Date.now(),Date.now()+31*86400000,'tomorrow'])assert.throws(()=>f.appointments.create(f.a,{...input,startsAt}));
 assert.throws(()=>f.appointments.create(f.a,{...input,gameId:'unknown'}));
 const a=f.appointments.create(f.a,input);assert.equal(f.appointments.create(f.a,input).id,a.id);assert.equal(f.appointments.list(f.c).appointments.length,0);
 assert.throws(()=>f.appointments.respond(f.c,a.id,{revision:0,action:'accept'}),{status:404});assert.throws(()=>f.appointments.respond(f.a,a.id,{revision:0,action:'accept'}),{status:403});
 assert.throws(()=>f.appointments.respond(f.b,a.id,{revision:1,action:'accept'}),{status:409});
 const accepted=f.appointments.respond(f.b,a.id,{revision:0,action:'accept'});assert.equal(accepted.status,'accepted');assert.equal(accepted.canPlay,false);
 assert.throws(()=>f.appointments.respond(f.a,a.id,{revision:0,action:'cancel'}),{status:409});f.advance(46*60000);assert.equal(f.appointments.list(f.a).appointments[0].canPlay,true);assert.equal(f.appointments.summary(f.b).due,1);
 assert.equal(f.appointments.respond(f.b,a.id,{revision:1,action:'cancel'}).status,'cancelled');
 const pending=f.appointments.create(f.a,{...f.input(),requestId:'appointment-expiring'});f.advance(3600001);assert.equal(f.appointments.list(f.a).appointments.find(x=>x.id===pending.id).status,'expired');assert.throws(()=>f.appointments.respond(f.b,pending.id,{revision:0,action:'accept'}),{status:409});
});
test('disabled games, removed friendships, limits and failed storage cannot leave accepted proposals',t=>{
 const f=fixture(new SqliteStore());t.after(()=>f.store.close());const input=f.input();f.store.transaction(d=>{d.system.settings.gameAvailability.cabo=false;});assert.throws(()=>f.appointments.create(f.a,input),{status:403});f.store.transaction(d=>{d.system.settings.gameAvailability.cabo=true;});
 const a=f.appointments.create(f.a,input);f.store.transaction(d=>{d.system.settings.gameAvailability.cabo=false;});assert.throws(()=>f.appointments.respond(f.b,a.id,{revision:0,action:'accept'}),{status:403});f.store.transaction(d=>{d.system.settings.gameAvailability.cabo=true;});
 const persist=f.store.persist.bind(f.store);f.store.persist=()=>{throw Error('disk failed');};assert.throws(()=>f.appointments.respond(f.b,a.id,{revision:0,action:'accept'}),/disk failed/);f.store.persist=persist;assert.equal(f.appointments.list(f.b).appointments[0].revision,0);
 for(let i=0;i<4;i++)f.appointments.create(f.a,{...input,requestId:`appointment-extra-${i}`});assert.throws(()=>f.appointments.create(f.a,{...input,requestId:'appointment-over-limit'}),/5 条预约/);
 f.social.remove(f.b,{playerId:f.a.id});assert.equal(f.appointments.summary(f.a).pending,0);assert.equal(f.appointments.list(f.a).appointments[0].status,'cancelled');f.connect();assert.equal(f.appointments.list(f.a).appointments[0].status,'cancelled');
});
test('v9 JSON migration and SQLite reopen preserve messages, cursors, appointments and game state',t=>{
 mkdirSync('work',{recursive:true});const dir=mkdtempSync(resolve('work/friend-storage-'));let store;t.after(()=>{store?.close();rmSync(dir,{recursive:true,force:true});});
 const old=structuredClone(new JsonStore().data);old.version=9;delete old.friendConversations;delete old.gameAppointments;const original=JSON.stringify(old),file=join(dir,'legacy.json');writeFileSync(file,original);
 const migrated=new JsonStore(file);assert.equal(migrated.data.version,10);assert.equal(readFileSync(file+'.v9.bak','utf8'),original);assert.deepEqual(migrateStorage(old).rooms,old.rooms);
 store=new SqliteStore(join(dir,'platform.sqlite'),{legacyFile:file});const f=fixture(store);f.chat.send(f.a,f.b.id,{text:'saved',requestId:'persistent-message-01'});f.chat.read(f.b,f.a.id,{through:1});const a=f.appointments.create(f.a,f.input());store.close();store=null;
 store=new SqliteStore(join(dir,'platform.sqlite'));const social=new SocialService(store,new RoomService(store,games),games),chat=new FriendChatService(store,social),appointments=new GameAppointmentService(store,social,games);
 assert.equal(chat.list(f.b,f.a.id).messages[0].text,'saved');assert.equal(chat.summary(f.b,f.a.id).unread,0);assert.equal(appointments.list(f.b).appointments[0].id,a.id);
});
test('HTTP authentication, participant-only responses and hub unread/appointment badges',async t=>{
 const f=fixture(),app=createApp({store:f.store,registry:games});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));});const base=`http://127.0.0.1:${app.server.address().port}/api`;
 async function req(path,client,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(client?{Cookie:`moon_session=${client.token}`}:{ }),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};}
 const [a,b,c]=f.clients;assert.equal((await req(`/friends/${f.b.id}/messages`)).status,401);
 assert.equal((await req(`/friends/${f.b.id}/messages`,a,{text:'hello',requestId:'http-message-request'})).status,200);assert.equal((await req(`/friends/${f.a.id}/messages`,c)).status,403);
 const hub=(await req('/hub',b)).data;assert.equal(hub.unreadMessages,1);assert.equal(JSON.stringify((await req('/hub',c)).data).includes('hello'),false);
 const created=await req('/appointments',a,f.input());assert.equal(created.status,201);assert.equal((await req('/hub',b)).data.appointments.pending,1);assert.equal((await req(`/appointments/${created.data.id}/respond`,c,{revision:0,action:'accept'})).status,404);
 assert.equal((await req(`/friends/${f.a.id}/messages/read`,b,{through:1})).status,200);assert.equal((await req('/hub',b)).data.unreadMessages,0);
 assert.equal((await req(`/appointments/${created.data.id}/respond`,b,{revision:0,action:'accept'})).data.status,'accepted');
});
test('appointment rendering escapes user-controlled text and only renders available actions',()=>{
 const html=appointmentCards([{id:'id',peer:{id:'p',name:'<script>bad</script>'},gameTitle:'CABO',startsAt:Date.now(),note:'<img onerror=bad>',status:'pending',revision:0,incoming:true,canPlay:false}]);
 assert.doesNotMatch(html,/<script>|<img /);assert.match(html,/&lt;img/);assert.match(html,/data-response="accept"/);assert.doesNotMatch(html,/data-action="hub:appointment-play"/);
});
