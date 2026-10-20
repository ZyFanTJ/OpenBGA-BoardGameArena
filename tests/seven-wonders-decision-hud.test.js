import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as game} from '../packages/games/seven-wonders/index.js';
import {SHIPYARDS,ISLANDS,COMMERCIAL} from '../packages/games/seven-wonders/armada.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
import {fleetPanel} from '../apps/web/games/seven-wonders/expansions.js';
import {costSymbols} from '../apps/web/games/seven-wonders/symbols.js';
import {tableOverview} from '../apps/web/games/seven-wonders/overview.js';
import {createDiscoveryTracker} from '../apps/web/games/seven-wonders/discoveries.js';

const ids=['a','b','c'];
const state=()=>game.create(ids,{side:'day',armada:true},()=>.31);
const snapshot=s=>({id:'ROOMHUD',matchId:'match-hud',players:ids.map(id=>({id,name:id==='b'?'<script>':id})),game:game.view(s,'a')});
const card=key=>({...ISLANDS[key],id:key});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};

test('main wonder stages expose each printed cost without opening details, including unordered stages',()=>{
 const s=state();s.players[0].wonder='siracusa';s.players[0].side='night';s.players[0].builtStages=[1];s.players[0].stages=1;
 const view=snapshot(s),p=view.game.players[0],renderer=createSevenWondersRenderer(()=>{},()=>{}),html=renderer.render(view,{id:'a'});
 const track=html.slice(html.indexOf('class="sw-stage-track"'),html.indexOf('class="sw-supply"'));
 assert.equal((track.match(/class="sw-stage-price"/g)??[]).length,p.stageList.length);
 for(const stage of p.stageList)assert.ok(track.includes(costSymbols(stage.cost)));
 assert.equal((track.match(/class="sw-stage sw-next"/g)??[]).length,p.stageList.length-1);
 assert.equal((track.match(/class="sw-stage sw-built"/g)??[]).length,1);
});

test('all shipyard routes show every node cost; commercial levels and tax events are distinct from income',()=>{
 const p=snapshot(state()).game.players[0];
 for(const shipyard of SHIPYARDS){
  const html=fleetPanel({...p,shipyard,commercial:4});
  assert.equal((html.match(/class="sw-fleet-cost"/g)??[]).length,28);
  for(const costs of Object.values(shipyard.costs))for(const cost of costs)assert.ok(html.includes(costSymbols(cost)));
  for(const [i,level] of COMMERCIAL.entries())assert.ok(html.includes(`商船第 ${i} 格${i===0?'，当前位置':''}${i?'，印刷成本 ':''}`));
  assert.equal((html.match(/，商业等级 /g)??[]).length,7);
  assert.equal((html.match(/，征税 [124]/g)??[]).length,3);
  assert.match(html,/商业 4/);assert.match(html,/同回合多次征税只取最高税额/);
 }
});

test('overview uses public production, cards and status, escapes names, and never includes private choices',()=>{
 let s=state();s.players[1].hand=['1-altar@0'];s.pending.b={cardId:'1-altar@0',action:'sell'};
 const snap=snapshot(s),before=JSON.stringify(snap),html=tableOverview(snap,'a');
 assert.equal((html.match(/data-player=/g)??[]).length,3);assert.match(html,/已确认/);assert.match(html,/&lt;script&gt;/);
 assert.ok(!html.includes('1-altar@0'));assert.ok(!html.includes('祭坛'));assert.equal(JSON.stringify(snap),before);
});

test('discoveries track actual own acquisitions, queue multiple islands, survive refresh, and isolate viewer/match',()=>{
 const store=storage(),tracker=createDiscoveryTracker(store),snap=snapshot(state());
 assert.equal(tracker.pending(snap,'a'),null);
 snap.game.exploration={cards:[card('island-foggy')]};snap.game.players[1].islands=[card('island-inhabited')];
 assert.equal(tracker.pending(snap,'a'),null);
 snap.game.players[0].islands=[card('island-foggy')];let pending=tracker.pending(snap,'a');assert.deepEqual(pending.cards.map(c=>c.id),['island-foggy']);
 snap.game.players[0].islands.push(card('island-lost'));pending=tracker.pending(snap,'a');assert.equal(pending.cards.length,2);
 const reloaded=createDiscoveryTracker(store);assert.equal(reloaded.pending(snap,'a').cards.length,2);
 reloaded.dismiss(pending.cards);assert.equal(reloaded.pending(snap,'a'),null);assert.equal(createDiscoveryTracker(store).pending(snap,'a'),null);
 assert.equal(tracker.pending({...snap,matchId:'other-match'},'a'),null);assert.equal(tracker.pending(snap,'b'),null);
});

test('an acquired island opens before the era report, then leaves a compact effect summary',async()=>{
 const renderer=createSevenWondersRenderer(()=>{},()=>{}),snap=snapshot(state());renderer.render(snap,{id:'a'});
 snap.game.players[0].islands=[card('island-inhabited')];
 snap.game.ageResults=[{age:1,military:ids.map(id=>({id,shields:0,tokens:[]})),naval:ids.map(id=>({id,strength:0,tokens:[],participates:true}))}];
 let html=renderer.render(snap,{id:'a'});assert.match(html,/data-surface="discovery"/);assert.match(html,/sw-island-summary/);assert.match(html,/居民岛/);assert.ok(!html.includes('data-surface="report"'));
 await renderer.handle('close');html=renderer.render(snap,{id:'a'});assert.ok(!html.includes('data-surface="discovery"'));assert.match(html,/data-surface="report"/);
});
