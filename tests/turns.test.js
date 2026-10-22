import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {TurnRunner} from '../packages/platform/turns.js';
import {ChatService} from '../packages/platform/chat.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';

function fixture(gameId='cabo',options={},turnSeconds=30,count=games.get(gameId).manifest.minPlayers){
 const store=new JsonStore(),sessions=new SessionService(store);let now=100000;
 const users=Array.from({length:count},(_,i)=>sessions.create('玩家'+i).user);
 const rooms=new RoomService(store,games,{random:()=>.37,now:()=>now});
 let r=rooms.createRoom(users[0],{gameId,title:'限时牌桌',options,turnSeconds});
 const snapshot=id=>rooms.snapshot(r.id,users.find(p=>p.id===id)??users[0]);
 const act=(user,input)=>{r=rooms.mutate(user,r.id,{...input,revision:r.revision});return r;};
 for(const user of users.slice(1))r=rooms.join(user,r.id);
 const start=()=>{for(const user of users)act(user,{type:'ready',ready:true});return act(users[0],{type:'start'});};
 const expire=()=>{const room=store.data.rooms[r.id],clock=room.turnClock;assert.ok(clock);now=clock.deadlineAt;const changed=rooms.expireTurn(r.id,{revision:room.revision,...clock});r=snapshot();return changed;};
 return {store,rooms,users,act,start,expire,snapshot,get room(){return r;},get raw(){return store.data.rooms[r.id];},advance:ms=>{now+=ms;}};
}

test('room time limits validate, are host-editable before start, reset readiness and obey revisions',()=>{
 const f=fixture();assert.equal(f.room.turnSeconds,30);
 for(const turnSeconds of [1,29,31,301,-1,'60',null,1.5])assert.throws(()=>f.act(f.users[0],{type:'updateOptions',options:{},turnSeconds}));
 f.act(f.users[0],{type:'ready',ready:true});const old=f.room.revision;
 assert.throws(()=>f.act(f.users[1],{type:'updateOptions',options:{},turnSeconds:60}),{status:403});
 f.act(f.users[0],{type:'updateOptions',options:{},turnSeconds:300});assert.equal(f.room.turnSeconds,300);assert.ok(f.room.players.every(p=>!p.ready));
 assert.throws(()=>f.rooms.mutate(f.users[0],f.room.id,{type:'updateOptions',options:{},turnSeconds:60,revision:old}),{status:409});
 f.start();assert.throws(()=>f.act(f.users[0],{type:'updateOptions',options:{},turnSeconds:60}),{status:403});
 const user=new SessionService(f.store).create('新房主').user;assert.equal(f.rooms.createRoom(user,{gameId:'marrakech',title:'默认时限'}).turnSeconds,60);
});

test('CABO look/confirm and draw/exchange share a full decision deadline; other confirmations and chat do not reset it',()=>{
 const f=fixture();f.start();const setupDeadline=f.raw.turnClock.deadlineAt;
 f.advance(5000);f.act(f.users[0],{type:'game',command:{type:'look',slots:[0,1]}});assert.equal(f.raw.turnClock.deadlineAt,setupDeadline);
 f.act(f.users[0],{type:'game',command:{type:'confirm'}});assert.equal(f.raw.turnClock.deadlineAt,setupDeadline);assert.equal(f.snapshot(f.users[0].id).turn.required,false);
 f.expire();assert.equal(f.room.game.phase,'turn');const actor=f.users.find(p=>p.id===f.room.game.turnId),deadline=f.raw.turnClock.deadlineAt;
 f.advance(5000);f.act(actor,{type:'game',command:{type:'draw',source:'deck'}});assert.equal(f.raw.turnClock.deadlineAt,deadline);
 new ChatService(f.store,f.rooms).send(actor,f.room.id,'不要延长计时');assert.equal(f.raw.turnClock.deadlineAt,deadline);
 f.expire();assert.notEqual(f.room.game.turnId,actor.id);assert.ok(f.room.players.every(p=>!p.isBot));assert.ok(f.raw.turnClock.deadlineAt>deadline);
});

test('deadline expiry is atomic, rejects late manual actions and ignores stale callbacks',()=>{
 const f=fixture();f.start();const clock=structuredClone(f.raw.turnClock),revision=f.room.revision;
 assert.equal(f.rooms.expireTurn(f.room.id,{revision,...clock}),false);
 const before=structuredClone(f.store.data);f.advance(30000);
 assert.equal(f.rooms.expireTurn(f.room.id,{revision:revision-1,...clock}),false);assert.deepEqual(f.store.data,before);
 assert.throws(()=>f.act(f.users[0],{type:'game',command:{type:'look',slots:[0,1]}}),{status:409});
 assert.ok(f.rooms.expireTurn(f.room.id,{revision,...clock}));assert.equal(f.raw.revision,revision+1);
 const after=structuredClone(f.store.data);assert.equal(f.rooms.expireTurn(f.room.id,{revision,...clock}),false);assert.deepEqual(f.store.data,after);
 assert.equal(f.raw.lastTimeout.playerIds.length,2);assert.equal(f.raw.game.phase,'turn');
});

test('Marrakech roll and rug placement use one clock, and expiry completes a legal turn',()=>{
 const f=fixture('marrakech');f.start();const actor=f.users.find(p=>p.id===f.room.game.turnId),clock=structuredClone(f.raw.turnClock);
 const command=games.get('marrakech').timeout(f.snapshot(actor.id).game,actor.id);f.advance(9000);f.act(actor,{type:'game',command});
 assert.equal(f.raw.turnClock.deadlineAt,clock.deadlineAt);assert.equal(f.snapshot(actor.id).game.phase,'place');
 f.expire();assert.equal(f.room.game.turnNumber,2);assert.equal(f.room.game.phase,'orient');assert.equal(f.room.game.board.filter(Boolean).length,2);assert.notEqual(f.room.game.turnId,actor.id);
});

test('Seven Wonders confirmations preserve peers clocks and only unfinished players time out; views stay private',()=>{
 const f=fixture('seven-wonders',{side:'day'});f.start();const first=f.users[0],view=f.snapshot(first.id).game;
 const chosen=games.get('seven-wonders').timeout(view,first.id);f.act(first,{type:'game',command:chosen});const clock=structuredClone(f.raw.turnClock);
 assert.equal(f.snapshot(first.id).turn.required,false);assert.equal(f.snapshot(f.users[1].id).turn.required,true);
 assert.ok(!JSON.stringify(f.snapshot(f.users[1].id).game).includes(chosen.cardId));
 f.expire();assert.ok(!f.raw.lastTimeout.playerIds.includes(first.id));assert.equal(f.raw.lastTimeout.playerIds.length,2);
 assert.ok(f.raw.turnClock.deadlineAt>clock.deadlineAt);assert.ok(f.raw.game.players.find(p=>p.id===first.id).cards.includes(chosen.cardId)||f.raw.game.players.find(p=>p.id===first.id).leaders.includes(chosen.cardId)||chosen.action!=='build');
});

test('Leaders and Armada timeout adapters finish complete matches, including special decision phases and archiving',()=>{
 const f=fixture('seven-wonders',{side:'choose',leaders:true,armada:true,leaderExpert:true});f.start();const phases=new Set();
 for(let i=0;i<180&&f.room.status==='playing';i++){phases.add(f.room.game.phase);assert.ok(f.expire());}
 assert.equal(f.room.status,'finished');assert.equal(f.raw.turnClock,null);assert.ok(phases.has('setup'));assert.ok(phases.has('leaderDraft'));assert.ok(phases.has('recruit'));assert.ok(phases.has('draft'));assert.ok(Object.keys(f.store.data.matches).length===1);
});

test('CABO timeout finishes deck-exhaustion rounds and stops at the manual results screen',()=>{
 const f=fixture();f.start();for(let i=0;i<100&&f.room.game.phase!=='roundEnd';i++)f.expire();
 assert.equal(f.room.game.phase,'roundEnd');assert.equal(f.raw.turnClock,null);assert.equal(f.room.turn.required,false);
 f.act(f.users[0],{type:'game',command:{type:'nextRound'}});assert.equal(f.room.game.phase,'setup');assert.ok(f.raw.turnClock);
});

test('dissolution pauses the remaining budget, rejection resumes it without a full reset',()=>{
 const f=fixture();f.start();f.advance(8000);const deadline=f.raw.turnClock.deadlineAt;
 f.act(f.users[0],{type:'requestDissolve'});assert.equal(f.room.turn.paused,true);assert.equal(f.room.turn.remainingMs,22000);f.advance(80000);
 assert.equal(f.rooms.expireTurn(f.room.id,{revision:f.room.revision,...f.raw.turnClock}),false);
 const voteId=f.room.dissolution.id;f.act(f.users[1],{type:'voteDissolve',voteId,agree:false});assert.equal(f.raw.turnClock.deadlineAt,deadline+80000);assert.equal(f.room.turn.remainingMs,22000);f.expire();assert.equal(f.room.game.phase,'turn');
});

test('unlimited rooms still advertise required actions but never schedule automatic decisions',()=>{
 const f=fixture('cabo',{},0);f.start();assert.equal(f.raw.turnClock,null);assert.equal(f.room.turn.required,true);f.advance(9000000);f.act(f.users[0],{type:'game',command:{type:'look',slots:[0,1]}});assert.equal(f.raw.lastTimeout,null);
});

test('v6 migration preserves complete game states and records, defaults existing rooms to unlimited and backs up exact bytes',()=>{
 const f=fixture();f.start();const input=structuredClone(f.store.data);input.version=6;for(const r of Object.values(input.rooms)){delete r.turnSeconds;delete r.turnClock;delete r.lastTimeout;}
 const before=structuredClone(input),next=migrateStorage(input);assert.deepEqual(input,before);assert.equal(next.version,9);
 const expected=structuredClone(input);expected.version=9;for(const r of Object.values(expected.rooms)){r.turnSeconds=0;r.turnClock=null;r.lastTimeout=null;r.revision++;}assert.deepEqual(next,expected);assert.deepEqual(migrateStorage(next),next);
 fs.mkdirSync('work',{recursive:true});const dir=fs.mkdtempSync(resolve('work/turn-migrate-'));try{const file=join(dir,'platform.json'),raw=JSON.stringify(input);fs.writeFileSync(file,raw);assert.deepEqual(new JsonStore(file).data,next);assert.equal(fs.readFileSync(file+'.v6.bak','utf8'),raw);new JsonStore(file);assert.equal(fs.readFileSync(file+'.v6.bak','utf8'),raw);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('scheduler recovers an expired persisted clock at startup and stops cleanly',async t=>{
 const f=fixture();f.start();f.store.transaction(data=>{data.rooms[f.room.id].turnClock.deadlineAt=Date.now()-1;});
 const app=createApp({store:f.store,registry:games});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
 await new Promise((resolve,reject)=>{const end=Date.now()+1500;const timer=setInterval(()=>{if(f.raw.game.phase==='turn'){clearInterval(timer);resolve();}else if(Date.now()>end){clearInterval(timer);reject(new Error('Recovery did not expire clock'));}},10);});
 assert.equal(f.raw.lastTimeout.playerIds.length,2);assert.ok(f.raw.turnClock.deadlineAt>Date.now());app.closeStreams();assert.equal(app.turns.timers.size,0);
});

test('scheduler rearms against the absolute deadline after revision changes and ignores chat notifications',async t=>{
 const f=fixture();f.start();const runner=new TurnRunner(f.rooms);t.after(()=>runner.stop());runner.sync(f.room.id);
 const deadline=f.raw.turnClock.deadlineAt;f.act(f.users[0],{type:'game',command:{type:'look',slots:[0,1]}});runner.sync(f.room.id);new ChatService(f.store,f.rooms).send(f.users[0],f.room.id,'计时不变');runner.sync(f.room.id);assert.equal(f.raw.turnClock.deadlineAt,deadline);assert.equal(runner.timers.size,1);
});
