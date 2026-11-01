import test from 'node:test';
import assert from 'node:assert/strict';
import {games} from '../packages/games/registry.js';
import {spectatorRoster,publicActivity} from '../apps/web/spectator.js';

const ids=['a','b','c','d'];
const rng=()=>{let seed=827;return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);};
function snapshot(game,state){return {id:'ABCDEFGH',title:'观战测试',gameId:game.manifest.id,gameTitle:game.manifest.title,spectator:true,status:game.isFinished(state)?'finished':'playing',hostId:'a',revision:1,players:ids.map((id,i)=>({id,name:i?'玩家 '+i:'<img onerror="alert(1)">'})),game:game.spectatorView(state)};}
for(const gameId of ['cabo','uno','texas-holdem','marrakech','seven-wonders','night-of-the-ninja','catan'])test(`${gameId}: public presentation survives play and settlement, stays read-only and escapes names`,async()=>{
  const game=games.get(gameId),random=rng(),{render}=await import(`../apps/web/games/${gameId}/spectator.js`);
  let state=game.create(ids,{},random),memory={},previous,phases=new Set(),settled=false;
  for(let step=0;step<12000;step++){
    const ended=['roundEnd','finished'].includes(state.phase);
    if(!phases.has(state.phase)||ended){
      const room=snapshot(game,state),before=JSON.stringify(room),html=render(room,{focusId:'b'});
      assert.equal(JSON.stringify(room),before,'changing observer position must not mutate its projection');
      assert.doesNotMatch(html,/undefined|NaN|<img onerror=/);
      assert.match(html,/&lt;img/);
      const actions=[...html.matchAll(/<button\b[^>]*data-action="game:[^"]+"[^>]*>/g)].map(match=>match[0]);
      assert.ok(actions.every(tag=>/\bdisabled\b|game:guide-(open|close)/.test(tag)),`observer received a game control in ${state.phase}`);
      assert.doesNotMatch(html,/data-action="(?:table:|game:(?:nextRound|confirm|roll|draw|fold))"(?![^>]*disabled)/);
      assert.doesNotMatch(spectatorRoster(room,'b'),/<img onerror=/);
      phases.add(state.phase);
    }
    if(ended){assert.doesNotMatch(spectatorRoster(snapshot(game,state)),/行动中/);settled=true;break;}
    let next;
    for(const id of ids){
      const view=game.view(state,id);
      memory[id]=game.bot?.observe?.(view,id,memory[id],previous?.id===id?previous.command:null)??memory[id]??{};
      const command=game.bot?.decide(view,id,memory[id]);
      if(command&&!next)next={id,command};
    }
    assert.ok(next,`No action in ${state.phase}`);
    state=game.apply(state,next.id,next.command,{random,isHost:next.id==='a'});previous=next;
  }
  assert.ok(settled,'simulation must reach a real settlement');
  assert.ok(phases.size>=2);
});

test('activity uses only the supplied public action and handles pending rooms',()=>{
  assert.deepEqual(publicActivity({game:null}),[]);
  assert.deepEqual(publicActivity({game:{lastAction:'当前玩家从牌库抽了一张牌。'}}),['当前玩家从牌库抽了一张牌。']);
  const room={players:[{id:'a',name:'青石'}],game:{log:[{type:'raise',id:'a',amount:60}]}};
  assert.deepEqual(publicActivity(room),['青石 · 加注 · 60']);
});
