import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as game} from '../packages/games/seven-wonders/index.js';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {createRegistry} from '../packages/games/registry.js';
const rng=initial=>{let seed=initial;return()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const pick=(s,id,cardId)=>game.apply(s,id,{type:'leaderPick',cardId,epoch:s.epoch},{random:rng(8)});

test('all 3–7 player leader drafts pass the final unselected card right and receive the fourth from the left',()=>{
 for(const count of [3,4,5,6,7])for(const expert of [false,true]){
  const ids=Array.from({length:count},(_,i)=>String(i));let state=game.create(ids,{side:'day',leaders:true,leaderExpert:expert},rng(17+count));
  for(let round=0;round<2;round++)for(const id of ids){const p=state.players.find(p=>p.id===id);state=pick(state,id,p.draftLeaders[(Number(id)+round)%p.draftLeaders.length]);}
  assert.equal(state.round,3);assert.ok(state.players.every(p=>p.leaderHand.length===2&&p.draftLeaders.length===2));
  const before=structuredClone(state),selected=ids.map((id,i)=>before.players[i].draftLeaders[i%2]),passed=ids.map((id,i)=>before.players[i].draftLeaders[1-i%2]);
  for(let i=0;i<ids.length-1;i++)state=pick(state,ids[i],selected[i]);
  assert.ok(state.players.every(p=>p.leaderHand.length===2&&p.draftLeaders.length===2),'No selections resolve before everyone confirms');
  const input=state,committed=structuredClone(state);freeze(input);state=pick(input,ids.at(-1),selected.at(-1));assert.deepEqual(input,committed);
  assert.equal(state.phase,'recruit');assert.equal(state.pending&&Object.keys(state.pending).length,0);
  for(let i=0;i<count;i++){
   assert.deepEqual(state.players[i].leaderHand,[...before.players[i].leaderHand,selected[i],passed[(i+1)%count]]);
   assert.ok(!state.players[i].leaderHand.includes(passed[i]));
   assert.deepEqual(state.players[i].draftLeaders,[]);
   const own=game.view(state,ids[i]);assert.equal(own.hand.length,4);assert.ok(!JSON.stringify(game.view(state,ids[(i+1)%count])).includes(passed[(i+1)%count]));
  }
  const all=[...state.leaderDeck,...state.players.flatMap(p=>p.leaderHand)];assert.equal(all.length,expert?49:34);assert.equal(new Set(all).size,all.length);
 }
});

test('two-card round remains resumable through JSON with partial confirmations and immutable input',()=>{
 const ids=['a','b','c'];let state=game.create(ids,{side:'day',leaders:true},rng(57));
 for(let round=0;round<2;round++)for(const id of ids)state=pick(state,id,state.players.find(p=>p.id===id).draftLeaders[0]);
 const saved=structuredClone(state);state=pick(state,'a',saved.players[0].draftLeaders[0]);state=pick(state,'b',saved.players[1].draftLeaders[1]);
 const input=JSON.parse(JSON.stringify(state)),before=structuredClone(input),output=pick(freeze(input),'c',saved.players[2].draftLeaders[0]);assert.deepEqual(input,before);
 assert.equal(output.players[0].leaderHand.at(-1),saved.players[1].draftLeaders[0]);assert.equal(output.players[1].leaderHand.at(-1),saved.players[2].draftLeaders[1]);assert.equal(output.players[2].leaderHand.at(-1),saved.players[0].draftLeaders[1]);
});

test('a single human plus AI receives a fresh game from the injected random source in each new room',()=>{
 const store=new JsonStore(),host=new SessionService(store).create('单人测试').user;let value=0,calls=0;
 const random=()=>{calls++;return value;},service=new RoomService(store,createRegistry([game]),{random});
 function start(){let room=service.createRoom(host,{gameId:'seven-wonders',title:'单人开房',turnSeconds:0,options:{side:'choose',leaders:true}});const act=input=>{room=service.mutate(host,room.id,{...input,revision:room.revision});};act({type:'addBot'});act({type:'addBot'});act({type:'ready',ready:true});act({type:'start'});return {room,act};}
 const first=start(),firstWonder=first.room.game.players.find(p=>p.id===host.id).wonder,firstCalls=calls;
 first.act({type:'leave'});assert.equal(Object.keys(store.data.rooms).length,0);value=.999999;const second=start();
 assert.ok(calls>firstCalls);assert.notEqual(second.room.game.players.find(p=>p.id===host.id).wonder,firstWonder);assert.equal(new Set(second.room.game.players.map(p=>p.wonder)).size,3);
});
