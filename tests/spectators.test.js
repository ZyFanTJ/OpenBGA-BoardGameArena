import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {games} from '../packages/games/registry.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SessionService} from '../packages/platform/sessions.js';
import {JsonStore} from '../packages/platform/store.js';
import {RoomEvents} from '../apps/server/room-events.js';
import {RecordService,archiveMatch} from '../packages/platform/records.js';
import {filterRooms} from '../apps/web/room-browser.js';

for(const manifest of games.list())test(`${manifest.id}: observer projection is separate from seats and survives initial game state`,async()=>{
  const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,games,{random:()=>0.3});
  const host=sessions.create('房主').user,watcher=sessions.create('观众').user;
  let room=rooms.createRoom(host,{gameId:manifest.id,title:'观战测试',visibility:'public'});
  assert.equal(room.allowSpectators,true);assert.equal(rooms.watch(room.id,watcher).spectator,true);
  for(let i=1;i<manifest.minPlayers;i++){if(games.get(manifest.id).bot)room=rooms.mutate(host,room.id,{type:'addBot',revision:room.revision});else{const guest=sessions.create('同伴'+i).user;room=rooms.join(guest,room.id);room=rooms.mutate(guest,room.id,{type:'ready',ready:true,revision:room.revision});}}
  room=rooms.mutate(host,room.id,{type:'ready',ready:true,revision:room.revision});
  room=rooms.mutate(host,room.id,{type:'start',revision:room.revision});
  const before=JSON.stringify(store.data.rooms[room.id].game),view=rooms.watch(room.id,watcher);
  const {render}=await import(`../apps/web/games/${manifest.id}/spectator.js`);assert.match(render(view),/spectator/);assert.doesNotMatch(render(view),/undefined|NaN/);
  assert.ok(view.game);assert.equal(view.players.length,manifest.minPlayers);assert.equal(rooms.currentRoom(watcher),undefined);
  assert.equal(JSON.stringify(store.data.rooms[room.id].game),before);
  assert.throws(()=>rooms.snapshot(room.id,watcher),/你不在此房间/);
  assert.throws(()=>rooms.mutate(watcher,room.id,{type:'ready',ready:true,revision:room.revision}),/你不在此房间/);
  if(manifest.id==='cabo'){assert.ok(view.game.players.every(p=>p.cards.every(c=>c.value===null)));assert.equal(view.game.drawn,null);assert.equal(view.game.reveal,null);}
  if(manifest.id==='uno')assert.deepEqual(view.game.hand,[]);
  if(manifest.id==='seven-wonders')for(const key of ['hand','reserveLeaders','leaderDraftChoices','draftedLeaders','exploration','pending'])assert.equal(view.game[key],undefined);
  if(manifest.id==='night-of-the-ninja'){assert.deepEqual(view.game.intel,[]);assert.deepEqual(view.game.pack,[]);assert.ok(view.game.players.every(p=>p.hand.every(c=>c===null)));}
  if(manifest.id==='dnd'){assert.equal(view.game.ownNote,undefined);assert.equal(view.game.choices,undefined);}
  if(manifest.id==='catan'){assert.deepEqual(view.game.dev,[]);assert.ok(Object.values(view.game.hand).every(v=>v===0));}
  assert.throws(()=>rooms.mutate(host,room.id,{type:'setSpectators',allowSpectators:false,revision:room.revision-1}),/房间已更新/);
  rooms.mutate(host,room.id,{type:'setSpectators',allowSpectators:false,revision:room.revision});
  assert.throws(()=>rooms.watch(room.id,watcher),/关闭观战/);
});

test('observer SSE never borrows a player projection and closes immediately when permission is revoked',t=>{
  class Response extends EventEmitter{frames=[];writableEnded=false;destroyed=false;writeHead(){}write(s){this.frames.push(s);return true;}end(){this.writableEnded=true;this.emit('close');}}
  const store=new JsonStore(),sessions=new SessionService(store);let streams;
  const rooms=new RoomService(store,games,{notify:(...args)=>streams?.publish(...args)});
  streams=new RoomEvents(rooms,sessions);t.after(()=>streams.close());
  const host=sessions.create('房主'),viewer=sessions.create('观众');
  let r=rooms.createRoom(host.user,{gameId:'cabo',title:'观战'});const res=new Response();
  streams.add(r.id,res,viewer.user,viewer.token,2,true);
  assert.match(res.frames[0],/"spectator":true/);
  r=rooms.mutate(host.user,r.id,{type:'ready',ready:true,revision:r.revision});assert.equal(res.frames.length,2);
  rooms.mutate(host.user,r.id,{type:'setSpectators',allowSpectators:false,revision:r.revision});
  assert.equal(res.writableEnded,true);assert.match(res.frames.at(-1),/"left":true/);
});

test('mixed matches with two humans are multiplayer, including departed humans; old classifications backfill once',()=>{
  const store=new JsonStore(),sessions=new SessionService(store),host=sessions.create('甲').user,peer=sessions.create('乙').user;
  const records=new RecordService(store,games);
  const game={manifest:{title:'测试'},isFinished:()=>true,result:()=>({winners:[host.id],players:[host,peer,{id:'bot'}].map((p,i)=>({id:p.id,rank:i+1,score:3-i}))})};
  store.transaction(data=>archiveMatch(data,{id:'ROOMTEST',matchId:'mixed',gameId:'cabo',game:{},players:[host,{...peer,isBot:true,departed:true},{id:'bot',isBot:true}]},game,{imported:true}));
  assert.equal(store.data.matches.mixed.practice,false);
  store.transaction(d=>{d.matches.mixed.practice=true;});records.backfill();assert.equal(store.data.matches.mixed.practice,false);
  assert.equal(records.list(host,{mode:'multiplayer'}).items.length,1);assert.equal(records.list(host,{mode:'practice'}).items.length,0);
});

test('one room with several humans is listed once, duplicated input rows cannot create duplicate cards',()=>{
  const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,games),a=sessions.create('甲').user,b=sessions.create('乙').user;
  const r=rooms.createRoom(a,{gameId:'cabo',title:'同一张牌桌',visibility:'public'});rooms.join(b,r.id);
  const rows=rooms.directory();assert.equal(rows.length,1);assert.equal(rows[0].count,2);
  assert.equal(filterRooms([...rows,...rows],games.list()).length,1);
  assert.throws(()=>rooms.createRoom(a,{gameId:'cabo',title:'重复提交'}),/先离开/);
});
