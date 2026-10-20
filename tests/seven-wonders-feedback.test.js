import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as g} from '../packages/games/seven-wonders/index.js';
import {CARDS} from '../packages/games/seven-wonders/data.js';
import {ISLANDS} from '../packages/games/seven-wonders/armada.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
import {createReportTracker,battleReport} from '../apps/web/games/seven-wonders/reports.js';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';

const ids=['a','b','c'], random=()=>.31;
const fresh=options=>g.create(ids,{side:'day',...options},random);
const apply=(s,id,c)=>g.apply(s,id,{epoch:s.epoch,...c},{random});
const sellAll=s=>{for(const p of [...s.players])if(p.hand.length)s=apply(s,p.id,{type:'choose',cardId:p.hand[0],action:'sell'});return s;};
const snapshot=s=>({id:'ROOM1234',matchId:'match-one',hostId:'a',players:ids.map(id=>({id,name:id==='b'?'<script>':id})),game:g.view(s,'a')});
function boundary(s){s=structuredClone(s);s.phase='draft';s.round=s.expansions.armada?7:6;s.pending={};for(const p of s.players){p.wonder='giza';p.side='day';p.hand=['1-altar@0','1-theater@0'];}return s;}

test('four selected Leaders are candidates, with one consumed per Age and no effect before recruitment',()=>{
 let s=fresh({leaders:true});
 while(s.phase==='leaderDraft')for(const id of ids)s=apply(s,id,{type:'leaderPick',cardId:s.players.find(p=>p.id===id).draftLeaders[0]});
 assert.equal(s.phase,'recruit');
 for(const p of s.players){assert.equal(p.leaderHand.length,4);assert.equal(p.leaders.length,0);assert.equal(p.coins,6);}
 const renderer=createSevenWondersRenderer(()=>{},()=>{});let html=renderer.render(snapshot(s),{id:'a'});
 assert.match(html,/4 位候选 · 本次 1 位/);assert.match(html,/未招募的候选不会生效/);
 for(let age=1;age<=3;age++){
  assert.equal(s.age,age);assert.equal(s.players[0].leaderHand.length,5-age);
  for(const p of [...s.players])s=apply(s,p.id,{type:'choose',cardId:p.leaderHand[0],action:'sell'});
  assert.equal(s.players[0].leaderHand.length,age===3?0:4-age);
  assert.equal(s.players[0].leaders.length,0);
  if(age<3)s=sellAll(boundary(s));
 }
});

test('public acknowledgements distinguish completed, waiting and inactive without revealing secret choices',()=>{
 let s=fresh({leaders:true,armada:true});const secret=s.players[0].draftLeaders[0];s=apply(s,'a',{type:'leaderPick',cardId:secret});
 let view=g.view(s,'b');assert.deepEqual(view.players.map(p=>p.actionStatus),['confirmed','waiting','waiting']);assert.equal(view.pending,null);
 assert.equal(view.players[0].draftLeaders,undefined);assert.equal(view.players[0].leaderHand,undefined);assert.ok(!JSON.stringify(view).includes(secret));
 const islands=Object.keys(ISLANDS).slice(0,2);s.phase='explore';s.pending={};s.exploration={offers:{first:{playerId:'a',level:1,cards:[islands[0]]},second:{playerId:'b',level:1,cards:[islands[1]]}},picks:{}};
 assert.deepEqual(g.view(s,'b').players.map(p=>p.actionStatus),['waiting','waiting','inactive']);
 s=apply(s,'a',{type:'islandPick',offerId:'first',cardId:islands[0]});view=g.view(s,'b');assert.deepEqual(view.players.map(p=>p.actionStatus),['confirmed','waiting','inactive']);assert.ok(!JSON.stringify(view).includes(islands[0]));
 s.phase='navalChoice';s.players[0].islands=['island-forgotten'];s.navalChoices={};assert.deepEqual(g.view(s,'b').players.map(p=>p.actionStatus),['waiting','inactive','inactive']);
 s.navalChoices.a=false;assert.equal(g.view(s,'b').players[0].actionStatus,'confirmed');
 s.phase='ability';s.tasks=[{playerId:'b',kind:'advance',remaining:1,used:[]}];assert.deepEqual(g.view(s,'a').players.map(p=>p.actionStatus),['inactive','waiting','inactive']);
});

test('three Age boundaries award and publish actual military and naval tokens exactly once',()=>{
 for(const armada of [false,true]){
  let s=fresh({armada});
  s.players[0].cards=[Object.values(CARDS).find(c=>c.effect.shields===3).key+'@0'];
  s.players[1].cards=[Object.values(CARDS).find(c=>c.effect.shields===1).key+'@0'];s.players[2].cards=[];
  if(armada)[4,3,0].forEach((red,i)=>s.players[i].fleets.red=red);
  for(let age=1;age<=3;age++){
   const before=boundary(s),original=JSON.stringify(before);s=sellAll(before);assert.equal(JSON.stringify(before),original);
   const result=s.ageResults.at(-1);assert.equal(result.age,age);assert.equal(s.ageResults.length,age);
   assert.deepEqual(result.military.map(r=>r.tokens.reduce((a,b)=>a+b,0)),[2*(2*age-1),2*age-2,-2]);
   if(armada)assert.deepEqual(result.naval.map(r=>r.token),[2*age+1,2*age-1,-age]);
   for(const p of s.players){
    assert.deepEqual(p.military,s.ageResults.flatMap(r=>r.military.find(row=>row.id===p.id).tokens));
    if(armada)assert.deepEqual(p.navalMilitary,s.ageResults.map(r=>r.naval.find(row=>row.id===p.id).token));
   }
   const view=g.view(s,'a');assert.deepEqual(view.ageResults,s.ageResults);
   for(const score of view.scores){const p=s.players.find(p=>p.id===score.id);assert.equal(score.military,p.military.reduce((a,b)=>a+b,0));if(armada)assert.equal(score.naval,p.navalMilitary.reduce((a,b)=>a+b,0));}
   view.ageResults[0].military[0].tokens.push(999);assert.ok(!s.ageResults[0].military[0].tokens.includes(999));
  }
  assert.equal(s.phase,'finished');
 }
});

test('reports are acknowledged per match and viewer, with a second reveal after naval decisions',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const snap=snapshot(fresh({armada:true}));snap.game.phase='navalChoice';snap.game.ageResults=[{age:1,military:ids.map(id=>({id,shields:0,tokens:[]}))}];
 const tracker=createReportTracker(storage);assert.equal(tracker.pending(snap,'a').step,'land');tracker.dismiss(snap.game,1);assert.equal(tracker.pending(snap,'a'),null);
 snap.game.phase='draft';snap.game.age=2;snap.game.ageResults[0].naval=ids.map(id=>({id,strength:0,token:0}));assert.equal(tracker.pending(snap,'a').step,'naval');tracker.dismiss(snap.game,1);
 assert.equal(createReportTracker(storage).pending(snap,'a'),null);assert.equal(createReportTracker(storage).pending(snap,'b').step,'land');
 assert.equal(createReportTracker(storage).pending({...snap,matchId:'next-match'},'a').step,'land');
 const html=battleReport(snap,'a',{age:1,step:'naval'});assert.match(html,/海军实力全部相同/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});

test('renderer automatically reveals settlement, offers each stage, stays dismissed, and exposes final scores',async()=>{
 let s=sellAll(boundary(fresh({armada:true}))),renderer=createSevenWondersRenderer(()=>{},()=>{}),html=renderer.render(snapshot(s),{id:'a'});
 assert.match(html,/data-surface="report"/);assert.match(html,/data-report-step="land"/);assert.match(html,/时代 I 已结算/);
 await renderer.handle('report-step',{dataset:{step:'naval'}});html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/data-report-step="naval"/);
 await renderer.handle('report-step',{dataset:{step:'summary'}});html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/本时代|冲突得分/);
 await renderer.handle('report-dismiss',{});html=renderer.render(snapshot(s),{id:'a'});assert.doesNotMatch(html,/data-surface="report"/);
 await renderer.handle('reports',{dataset:{}});html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/data-surface="report"/);
 await renderer.handle('history',{});await renderer.handle('close',{});html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/data-surface="report"/);
 await renderer.handle('report-dismiss',{});
 s=sellAll(boundary(s));html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/时代 II/);assert.match(html,/data-surface="report"/);await renderer.handle('report-dismiss',{});
 s=sellAll(boundary(s));html=renderer.render(snapshot(s),{id:'a'});assert.match(html,/sw-score-detail" open/);assert.match(html,/时代 III/);
});

test('snapshot publishes a stable opaque match id for per-match reading preferences',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),user=sessions.create('host').user,rooms=new RoomService(store,games,{random});
 let room=rooms.createRoom(user,{gameId:'seven-wonders',title:'report',options:{side:'day'}});assert.equal(room.matchId,null);
 for(let i=0;i<2;i++)room=rooms.mutate(user,room.id,{type:'addBot',revision:room.revision});room=rooms.mutate(user,room.id,{type:'ready',ready:true,revision:room.revision});room=rooms.mutate(user,room.id,{type:'start',revision:room.revision});
 assert.ok(room.matchId);assert.equal(rooms.snapshot(room.id,user).matchId,room.matchId);
});
