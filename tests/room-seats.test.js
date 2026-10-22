import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {roomLounge} from '../apps/web/room-lounge.js';

const host={id:'host',name:'房主'},guest={id:'guest',name:'好友'};
function fixture(gameId='seven-wonders'){
 const store=new JsonStore(),rooms=new RoomService(store,games,{random:()=>.31});
 const r=rooms.createRoom(host,{gameId,title:'固定座位',options:gameId==='seven-wonders'?{side:'day'}:{}}),id=r.id;
 const act=(input,user=host)=>rooms.mutate(user,id,{revision:store.data.rooms[id].revision,...input});
 return {store,rooms,act,get room(){return rooms.snapshot(id,host);}};
}

test('AI enters the selected seat; removal and human joins leave other positions unchanged',()=>{
 const f=fixture();assert.equal(f.room.players[0].seat,0);
 let r=f.act({type:'addBot',seat:6}),far=r.players.find(p=>p.isBot);assert.equal(far.seat,6);
 r=f.act({type:'addBot',seat:3});const middle=r.players.find(p=>p.seat===3);
 assert.deepEqual(r.players.map(p=>p.seat),[0,3,6]);
 r=f.rooms.join(guest,r.id);assert.equal(r.players.find(p=>p.id===guest.id).seat,1);
 r=f.act({type:'removeBot',playerId:middle.id});assert.deepEqual(r.players.map(p=>p.seat),[0,1,6]);
 r=f.act({type:'addBot'});assert.deepEqual(r.players.map(p=>p.seat),[0,1,2,6]);
 f.act({type:'leave'},guest);r=f.room;assert.deepEqual(r.players.map(p=>p.seat),[0,2,6]);
 r=f.rooms.join(guest,r.id);assert.equal(r.players.find(p=>p.id===guest.id).seat,1);assert.equal(r.players.find(p=>p.id===far.id).seat,6);
});

test('seat selection is validated transactionally with revision, ownership and capacity',()=>{
 const f=fixture();let r=f.act({type:'addBot',seat:6});const original=structuredClone(f.store.data);
 for(const seat of [-1,7,1.5,'2',null,NaN]){
  assert.throws(()=>f.act({type:'addBot',seat}),/座位编号无效/);assert.deepEqual(f.store.data,original);
 }
 assert.throws(()=>f.act({type:'addBot',seat:0}),{status:409});assert.deepEqual(f.store.data,original);
 assert.throws(()=>f.act({type:'addBot',seat:6}),{status:409});assert.deepEqual(f.store.data,original);
 assert.throws(()=>f.act({type:'addBot',seat:2,revision:r.revision-1}),{status:409});assert.deepEqual(f.store.data,original);
 f.rooms.join(guest,r.id);assert.throws(()=>f.act({type:'addBot',seat:2},guest),{status:403});
 for(const seat of [2,3,4,5])f.act({type:'addBot',seat});
 assert.throws(()=>f.act({type:'addBot',seat:1}),/房间已满/);
});

test('games start in displayed seat order, retain neighbors and preserve seats through rematch',()=>{
 const f=fixture();f.act({type:'addBot',seat:6});f.act({type:'addBot',seat:2});f.act({type:'addBot',seat:4});
 f.act({type:'ready',ready:true});let r=f.act({type:'start'});
 assert.deepEqual(r.game.players.map(p=>p.id),r.players.map(p=>p.id));
 assert.deepEqual(r.game.neighbors,[r.players[1].id,r.players.at(-1).id]);
 assert.throws(()=>f.act({type:'addBot',seat:1}),{status:403});
 const positions=r.players.map(p=>({id:p.id,seat:p.seat}));
 f.store.transaction(data=>{data.rooms[r.id].status='finished';});r=f.act({type:'rematch'});
 assert.deepEqual(r.players.map(p=>({id:p.id,seat:p.seat})),positions);
});

test('lounge renders sparse seat positions and places the target index on each AI control',()=>{
 const f=fixture();f.act({type:'addBot',seat:6});const html=roomLounge(f.room,host,games.get('seven-wonders').manifest);
 assert.equal((html.match(/class="lounge-seat lounge-vacant"/g)??[]).length,5);
 for(const seat of [1,2,3,4,5])assert.ok(html.includes(`data-seat="${seat}" aria-label="在 ${seat+1} 号座位添加 AI"`));
 assert.match(html,/lounge-seat lounge-occupied[^>]*data-seat="6"/);
 assert.ok(!html.includes('data-seat="6" aria-label="在 7 号座位添加 AI"'));
});

test('v3 migration assigns seats in original order without changing games, and keeps an original backup',()=>{
 const dir=mkdtempSync(join(tmpdir(),'moon-seats-'));
 try{
  const original={version:3,sessions:{token:{id:'private'}},profiles:{},rooms:{R:{revision:9,stateVersion:2,status:'playing',players:[{id:'a'},{id:'bot',isBot:true},{id:'b'}],game:{players:[{id:'a',hand:['secret']},{id:'bot'},{id:'b'}],epoch:13,pending:{a:{private:'choice'}}}}}};
  const input=structuredClone(original),migrated=migrateStorage(input);assert.deepEqual(input,original);
  assert.equal(migrated.version,9);assert.deepEqual(migrated.rooms.R.players.map(p=>p.seat),[0,1,2]);assert.equal(migrated.rooms.R.revision,11);
  assert.deepEqual(migrated.rooms.R.game,original.rooms.R.game);assert.equal(migrated.rooms.R.stateVersion,2);assert.deepEqual(migrated.sessions,original.sessions);
  assert.deepEqual(migrateStorage(migrated),migrated);
  const file=join(dir,'platform.json');writeFileSync(file,JSON.stringify(original));let store=new JsonStore(file);assert.deepEqual(store.data,migrated);
  assert.deepEqual(JSON.parse(readFileSync(file+'.v3.bak','utf8')),original);store=new JsonStore(file);assert.deepEqual(store.data,migrated);assert.deepEqual(JSON.parse(readFileSync(file+'.v3.bak','utf8')),original);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
