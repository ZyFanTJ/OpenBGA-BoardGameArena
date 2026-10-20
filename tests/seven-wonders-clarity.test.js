import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as g} from '../packages/games/seven-wonders/index.js';
import {CARDS,CHAIN_SYMBOLS} from '../packages/games/seven-wonders/data.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
import {chainRoutes,chainMark} from '../apps/web/games/seven-wonders/chains.js';
function fixture(n=3){const state=g.create(Array.from({length:n},(_,i)=>String(i)),{side:'day'},()=>.3);state.players[0].cards=['1-baths@0','1-apothecary@0','1-workshop@0'];state.players[0].hand=['2-aqueduct@0','2-dispensary@0','2-stables@0'];return state;}
test('7W every printed chain has one consistent symbol on the requirement and its predecessors',()=>{
 const state=fixture(),catalogue=g.view(state,'0').chainCatalogue;
 assert.equal(catalogue.length,24);assert.equal(new Set(catalogue.map(r=>r.symbol.id)).size,24);
 for(const row of catalogue){assert.ok(CHAIN_SYMBOLS[row.to.kind]);assert.ok(row.from.length);assert.ok(row.from.every(x=>x.age<row.to.age));assert.match(chainMark(row.symbol),/<path|<circle|<ellipse/);
  for(const parent of row.from){const s=fixture();s.players[0].hand=[parent.key+'@0',row.to.key+'@0'];const [a,b]=g.view(s,'0').hand;assert.ok(a.chains.to.some(x=>x.kind===row.to.kind&&x.symbol.id===row.symbol.id));assert.ok(b.chains.from.some(x=>x.kind===parent.kind&&x.symbol.id===row.symbol.id));}
 }
});
test('7W public chain reference is independent of secret hands, future decks and pending selections',()=>{
 const state=fixture(),original=JSON.stringify(state),view=g.view(state,'0');const other=structuredClone(state);other.players[1].hand=['3-palace@0'];other.decks=[[],[],[]];other.pending['1']={action:'build',cardId:'3-palace@0',payment:{left:0,right:0,bank:0}};
 assert.deepEqual(g.view(other,'0').chainCatalogue,view.chainCatalogue);assert.equal(JSON.stringify(state),original);assert.equal(JSON.stringify(state).includes('chainCatalogue'),false);assert.equal(view.players[1].hand,undefined);
});
test('7W hand and table expose actionable chain information and public city navigation without full state',async()=>{
 const state=fixture(),view=g.view(state,'0'),snapshot={game:view,players:state.players.map(p=>({id:p.id,name:p.id==='0'?'你':'玩家 <script>'})),hostId:'0'};const renderer=createSevenWondersRenderer(()=>{},()=>{});let html=renderer.render(snapshot,{id:'0'});
 assert.match(html,/data-chain-symbol="drop"/);assert.match(html,/sw-quote-chain/);assert.match(html,/3 张手牌免费/);assert.match(html,/查看全桌已建建筑/);assert.match(html,/sw-card-unlocks/);assert.match(html,/sw-cost-waived/);
 await renderer.handle('table',{});html=renderer.render(snapshot,{id:'0'});assert.match(html,/sw-table-dossier/);assert.match(html,/玩家 &lt;script&gt;/);assert.equal((html.match(/class="sw-table-color-counts"/g)||[]).length,3);
 await renderer.handle('player-collection',{dataset:{player:'1',color:'green'}});html=renderer.render(snapshot,{id:'0'});assert.match(html,/sw-city-switcher/);assert.match(html,/返回全桌建筑/);assert.doesNotMatch(html,/<script>/);
 await renderer.handle('close',{});html=renderer.render(snapshot,{id:'0'});assert.match(html,/data-surface="table"/);
 const routes=chainRoutes(view,view.players[0],'ready');assert.match(routes,/引水渠/);assert.match(routes,/data-chain-symbol="drop"/);assert.match(routes,/已持有连锁前置|手牌免费/);assert.equal(Object.values(CARDS).filter(c=>c.from.length).length,24);
});
