import test from 'node:test';
import assert from 'node:assert/strict';
import { cabo } from '../packages/games/cabo/index.js';
import { unseenDistribution } from '../packages/games/cabo/bot.js';

const levels = ['easy', 'smart', 'ruthless'];
function position(hands, phase = 'turn') {
  const state = cabo.create(hands.map((_,i)=>String(i)), {}, ()=>.5);
  state.phase = phase; state.turn = 0;
  hands.forEach((hand,i)=>{ state.players[i].cards = hand.map(value=>({value,faceUp:true})); });
  return state;
}
test('every level refuses CABO when a fully visible opponent is lower, including late deck',()=>{
  for (const own of [[1,2,2,3],[3,3,3,4]]) for (const difficulty of levels) {
    const state=position([own,[0,1,1,1]]); state.deck=state.deck.slice(0,8);
    const view=cabo.view(state,'0'), memory=cabo.bot.observe(view,'0');
    assert.notEqual(cabo.bot.decide(view,'0',memory,{difficulty}).type,'cabo');
  }
});
test('advanced bots consolidate known matching cards and value swap over weak replacement',()=>{
  const state=position([[6,6,2,1],[3,4,5,6]],'drawn'); state.drawn={value:8,source:'deck'};
  let view=cabo.view(state,'0'),memory=cabo.bot.observe(view,'0');
  assert.deepEqual(cabo.bot.decide(view,'0',memory,{difficulty:'smart'}),{type:'exchange',slots:[0,1]});
  state.players[0].cards=[13,2,3,4].map(value=>({value,faceUp:true}));
  state.players[1].cards[0].value=0;state.drawn.value=11;
  view=cabo.view(state,'0');memory=cabo.bot.observe(view,'0');
  assert.deepEqual(cabo.bot.decide(view,'0',memory,{difficulty:'ruthless'}),{type:'discard',useAbility:true});
});
test('cold caller accounts for an opponent improving on the final turn',()=>{
  const state=position([[1,1,1,1],[0,0,0,7]]);state.discard=[{value:0,faceUp:true}];
  const view=cabo.view(state,'0'),memory=cabo.bot.observe(view,'0');
  assert.equal(cabo.bot.decide(view,'0',memory,{difficulty:'smart'}).type,'cabo');
  assert.equal(cabo.bot.decide(view,'0',memory,{difficulty:'ruthless'}).type,'draw');
});
test('public swaps preserve all unaffected memories and move known cards without exposing unknowns',()=>{
  let state=position([[2,8,6,1],[4,7,9,3],[5,6,7,8]],'swap');state.turn=1;
  state.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));
  const previous={...cabo.bot.observe(cabo.view(state,'0'),'0'),known:{'0':[2,8,null,null],'1':[4,null,null,null],'2':[null,6,null,null]}};
  const before=structuredClone(previous);
  const command={type:'ability',targetId:'0',slot:0,ownSlot:1};
  const after=cabo.apply(state,'1',command);
  const view=cabo.view(after,'0',{before:state,actorId:'1',command});
  const memory=cabo.bot.observe(view,'0',previous);
  assert.deepEqual(memory.known,{'0':[null,8,null,null],'1':[4,2,null,null],'2':[null,6,null,null]});
  assert.deepEqual(previous,before);
  assert.ok(view.players.every(p=>p.cards.every(c=>c.value===null)));
});
test('expert discard pickup and multi-card compression keep exact positions and discard counts',()=>{
  let state=position([[6,6,2,1],[4,7,9,3]]);state.expert=true;
  state.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));state.discard=[{value:3,faceUp:true}];
  let memory={...cabo.bot.observe(cabo.view(state,'1'),'1'),known:{'0':[6,6,2,null],'1':[4,7,null,null]}};
  for(const command of [{type:'draw',source:'discard'},{type:'exchange',slots:[0,1],replaceAt:1}]) {
    const before=state;state=cabo.apply(state,'0',command);
    memory=cabo.bot.observe(cabo.view(state,'1',{before,actorId:'0',command}),'1',memory);
  }
  assert.deepEqual(memory.known['0'],[3,2,null]);assert.deepEqual(memory.discard,[6,6]);
  assert.ok(cabo.view(state,'1').players[0].cards.every(c=>c.value===null));
});
test('unseen probabilities exclude remembered hands and discarded cards, without input mutation',()=>{
  const view=cabo.view(position([[0,1],[2,3]]),'0');
  const memory={known:{'0':[0,null],'1':[null,null]},discard:[0,13,13]};
  const original=JSON.stringify({view,memory});const distribution=unseenDistribution(view,memory);
  assert.equal(distribution[0],0);assert.equal(distribution[13],0);
  assert.ok(Math.abs(distribution.reduce((a,b)=>a+b,0)-1)<1e-9);
  assert.equal(JSON.stringify({view,memory}),original);
});
test('all difficulties finish seeded standard/expert rounds with truthful global memory',()=>{
  for(const expert of [false,true]) for(const count of [2,4]) for(let seedStart=1;seedStart<=12;seedStart++) {
    let seed=seedStart;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
    const ids=Array.from({length:count},(_,i)=>String(i)),memories={};
    let state=cabo.create(ids,{expert},random),transition;
    for(let step=0;step<600 && !['roundEnd','finished'].includes(state.phase);step++) {
      let next;
      for(const id of ids) {
        const view=cabo.view(state,id,transition);
        memories[id]=cabo.bot.observe(view,id,memories[id]);
        for(const player of state.players) memories[id].known[player.id].forEach((value,slot)=>{
          if(value!==null) assert.equal(value,player.cards[slot].value,`false memory seed ${seedStart} ${state.phase}`);
        });
        const original=JSON.stringify({view,memory:memories[id]});
        const command=cabo.bot.decide(view,id,memories[id],{difficulty:levels[(Number(id)+seedStart)%3]});
        assert.equal(JSON.stringify({view,memory:memories[id]}),original);
        if(command && !next)next={actorId:id,command};
      }
      assert.ok(next);transition={before:state,...next};state=cabo.apply(state,next.actorId,next.command,{random});
    }
    assert.ok(['roundEnd','finished'].includes(state.phase));
  }
});
