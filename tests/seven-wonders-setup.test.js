import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as game} from '../packages/games/seven-wonders/index.js';
import {WONDERS} from '../packages/games/seven-wonders/data.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
import {escapeHtml} from '../apps/web/ui.js';

const fixture=()=>game.create(['a','b','c'],{side:'choose',leaders:true,armada:true},()=>.3);
const snapshot=(state,view)=>({id:'SETUP001',revision:0,gameId:'seven-wonders',status:'playing',game:view,players:state.players.map(p=>({id:p.id,name:p.id})),hostId:'a'});

test('all civilization faces preview their actual starting production, coins and stages without altering persisted state or exposing private decks',()=>{
  for(const [id,wonder] of Object.entries(WONDERS)){
    const state=fixture();state.players[0].wonder=id;const before=structuredClone(state),view=game.view(state,'a');
    assert.deepEqual(state,before);assert.equal(view.setupChoices.length,2);
    for(const option of view.setupChoices){
      assert.equal(option.startingResource,wonder.resource);assert.equal(option.startingCoins,state.players[0].coins);
      assert.equal(option.stages.length,wonder[option.side].length);
      for(const [i,stage] of option.stages.entries())assert.deepEqual(stage.cost,wonder[option.side][i].cost);
      assert.equal(option.hand,undefined);assert.equal(option.decks,undefined);
    }
    const html=createSevenWondersRenderer(()=>{},()=>{}).render(snapshot(state,view),{id:'a'});
    assert.match(html,/起始产能/);assert.match(html,/起始钱币/);assert.match(html,/建造费用/);
    for(const option of view.setupChoices)for(const stage of option.stages)assert.ok(html.includes(escapeHtml(stage.text)));
    assert.match(html,/选择日面/);assert.match(html,/选择夜面/);
    if(id==='roma'){assert.match(html,/无起始资源/);assert.match(html,/招募领袖免费/);assert.match(html,/招募领袖少付 2 钱币/);}
    if(id==='siracusa')assert.match(html,/阶段可按任意顺序建造/);
  }
});

test('confirmed face remains readable while waiting and cannot be selected a second time; Armada timing matches current rules',()=>{
  let state=fixture();state.players[0].wonder='olympia';const first=game.view(state,'a');
  assert.match(first.setupChoices.find(c=>c.side==='night').stages[1].text,/7/);
  state=game.apply(state,'a',{type:'side',side:'night',epoch:state.epoch});
  const view=game.view(state,'a'),html=createSevenWondersRenderer(()=>{},()=>{}).render(snapshot(state,view),{id:'a'});
  assert.equal(view.phase,'setup');assert.match(html,/已确认选择，等待其他玩家/);assert.match(html,/已选择夜面/);assert.doesNotMatch(html,/aria-label="选择日面"/);
  assert.match(html,/起始产能/);assert.match(html,/第 7 张建筑免费/);
  assert.throws(()=>game.apply(state,'a',{type:'side',side:'day',epoch:state.epoch}),/已选择/);
});
