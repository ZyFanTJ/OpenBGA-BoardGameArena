import test from 'node:test';
import assert from 'node:assert/strict';
import {scram,campScore} from '../packages/games/scram/index.js';
const random=()=>.37, context={random,isHost:true};
const c=(value,faceUp=false)=>({value,faceUp});
const ref=(playerId,slot)=>({playerId,slot});
function state(n=4){return scram.create(Array.from({length:n},(_,i)=>String(i)),{},random);}
function turn(s,id='0'){s.cursor=s.order.indexOf(id);s.phase='turn';return s;}
function drawn(value,source='deck'){const s=turn(state());s.phase='drawn';s.drawn={card:c(value),source};return s;}
const apply=(s,cmd,id='0')=>scram.apply(s,id,cmd,context);
test('SCRAM official setup, immutable transitions, 3/4/6 only and no initial peek',()=>{
  for(const n of [3,4,6]){
    const s=state(n),v=scram.view(s,'0');
    assert.equal(s.deck.length+s.discard.length+s.players.reduce((n,p)=>n+p.cards.length,0),n===6?70:56);
    assert.equal(s.rounds,n===4?4:3);assert.equal(s.players[0].cards.length,n===3?8:5);
    assert.ok(v.players.every(p=>p.cards.filter(c=>c.value!==null).length===2));
    const before=JSON.stringify(s),next=apply(s,{type:'draw',source:'deck'},scram.turn(s).players[0]);
    assert.equal(JSON.stringify(s),before);assert.equal(next.phase,'drawn');
    const owner=scram.turn(next).players[0];assert.ok(scram.view(next,owner).drawn);
    assert.equal(scram.view(next,'outsider').drawn,null);assert.equal(scram.view(next,'outsider').deck,undefined);
    assert.deepEqual(scram.spectatorView(next),scram.view(next,null));
  }
  assert.throws(()=>scram.create(['a','b','c','d','e'],{},random),/不支持 5 人/);
  assert.throws(()=>scram.create(['a','b','c'],{expert:true},random));
});
test('SCRAM matches teammates with equals, preserves own insertion position and orders discard',()=>{
  const s=drawn(2);s.players[0].cards=[c(7),c(4),c('=')];s.players[2].cards=[c(7),c(9)];
  const result=apply(s,{type:'replace',targets:[ref('0',0),ref('2',0),ref('0',2)],insertSlot:2});
  assert.deepEqual(result.players[0].cards,[c(4),c(2)]);assert.deepEqual(result.players[2].cards,[c(9)]);
  assert.deepEqual(result.discard.slice(-3).map(c=>c.value),['=',7,7]);
  assert.throws(()=>apply(s,{type:'replace',targets:[ref('2',0)]}));
  assert.throws(()=>apply(s,{type:'replace',targets:[ref('0',0),ref('1',0)]}));
  assert.throws(()=>apply(s,{type:'replace',targets:[ref('0',0),ref('0',0)]}));
});
test('SCRAM failed matches reveal all selected cards and impose distinct-number penalties without peeking',()=>{
  for(const distinct of [2,3,4,5]){
    const s=drawn(2);s.players[0].cards=Array.from({length:distinct},(_,i)=>c(i+1));
    const result=apply(s,{type:'replace',targets:s.players[0].cards.map((_,i)=>ref('0',i))});
    assert.equal(result.players[0].cards.length,distinct+1+Math.min(3,distinct-2));
    assert.ok(result.players[0].cards.slice(0,distinct).every(c=>c.faceUp));
    assert.ok(scram.view(result,'0').players[0].cards.slice(distinct).every(c=>c.value===null));
  }
  const s=drawn(4,'discard');assert.throws(()=>apply(s,{type:'discard'}));assert.throws(()=>apply(s,{type:'ability',targets:[ref('0',0)]}));
  assert.equal(apply(s,{type:'replace',targets:[ref('0',0)]}).players[0].cards[0].faceUp,true);
});
test('SCRAM 5/6 private views and 7/8 public camp flips, deck views remain private',()=>{
  for(const value of [5,6,7,8]){
    const s=drawn(value);s.players[1].cards=[c(2),c(3)];
    const refs=[ref('1',0),...(value%2===0?[ref('1',1)]:[])];
    const result=apply(s,{type:'ability',targets:refs});
    if(value<=6){assert.equal(result.phase,'reveal');assert.equal(scram.view(result,'0').reveal.reveals[0].value,2);assert.equal(scram.view(result,'1').reveal,null);assert.equal(scram.view(result,'1').players[1].cards[0].value,null);assert.equal(apply(result,{type:'resolve'}).effect,null);}
    else assert.ok(result.players[1].cards.slice(0,refs.length).every(c=>c.faceUp));
    const deck=apply(s,{type:'ability',targets:[ref(null,0),...(value%2===0?[ref(null,1)]:[])]});
    assert.equal(deck.phase,'reveal');assert.equal(scram.view(deck,'1').reveal,null);
    assert.equal(deck.deck.at(-1).faceUp,false);
  }
});
test('SCRAM 9/10 discard, 11 swap, 12 view/optional swap and 13 placement',()=>{
  let s=drawn(9);s.players[1].cards=[c(2),c('=')];
  let r=apply(s,{type:'ability',targets:[ref('1',0),ref('1',1)],side:'left'});
  assert.equal(r.players[0].cards[0].value,9);assert.equal(r.players[0].cards[0].faceUp,true);assert.equal(r.discard.at(-1).value,2);assert.equal(r.discard.at(-2).value,'=');assert.equal(r.players[1].cards.length,0);
  s=drawn(10);const top=s.deck.at(-1).value;r=apply(s,{type:'ability',targets:[ref(null,0)]});assert.equal(r.discard.at(-1).value,top);
  s=drawn(11);s.players[0].cards=[c(1,true)];s.players[1].cards=[c(13)];r=apply(s,{type:'ability',targets:[ref('0',0),ref('1',0)]});assert.deepEqual(r.players[0].cards,[c(13)]);assert.deepEqual(r.players[1].cards,[c(1,true)]);
  s=drawn(12);s.deck.splice(-2,2,c(1),c(2));r=apply(s,{type:'ability',targets:[ref(null,0),ref(null,1)]});assert.deepEqual(r.effect.reveals.map(c=>c.value),[2,1]);assert.equal(apply(r,{type:'resolve',swap:true}).deck.at(-1).value,1);assert.equal(apply(r,{type:'resolve',swap:false}).deck.at(-1).value,2);
  s=drawn(13);r=apply(s,{type:'ability',playerId:'1',side:'left'});assert.deepEqual(r.players[1].cards[0],c(13,true));
  assert.throws(()=>apply(drawn(11),{type:'ability',targets:[ref(null,0),ref(null,1)]}));
  assert.throws(()=>apply(drawn(10),{type:'ability',targets:[ref(null,1)]}));
});
test('SCRAM rejects out of turn, phase skips, malformed and duplicate targets',()=>{
  const s=drawn(12),before=JSON.stringify(s);
  for(const cmd of [{type:'ability',targets:[ref('0',0),ref('0',0)]},{type:'ability',targets:[ref('0',99),ref('1',0)]},{type:'ability',targets:[null,null]},{type:'resolve',swap:true},{type:'scram'},{type:'draw',source:'deck'}])assert.throws(()=>apply(s,cmd));
  assert.throws(()=>apply(s,{type:'discard'},'1'));assert.equal(JSON.stringify(s),before);
});
test('SCRAM final-turn queues, including solo two-turn exception and caller never returns',()=>{
  for(const n of [3,4,6])for(const caller of ['0','1']){
    const s=turn(state(n),caller);s.players.find(p=>p.id===caller).cards=[];
    let r=apply(s,{type:'scram'},caller),order=[];
    while(r.phase!=='roundEnd') {const id=scram.turn(r).players[0];order.push(id);r=apply(r,{type:'draw',source:'deck'},id);r=apply(r,{type:'discard'},id);}
    assert.ok(!order.includes(caller));assert.equal(order.length,n===3?(caller==='0'?2:3):n-1);
    if(n===3&&caller==='1')assert.deepEqual(order,['0','2','0']);
  }
});
test('SCRAM scoring, equal caller succeeds, deck depletion does not recycle, host next round',()=>{
  assert.equal(campScore([c('='),c('='),c(3),c(8)]),17);assert.equal(campScore([c('='),c('=')]),0);
  const s=turn(state());s.players.forEach(p=>{p.cards=[c(1)];});s.deck=[c(2)];
  const r=apply(s,{type:'scram'}); // queue exists; exhaust on next turn
  const id=scram.turn(r).players[0],end=apply(apply(r,{type:'draw',source:'deck'},id),{type:'discard'},id);
  assert.equal(end.phase,'roundEnd');assert.deepEqual(end.roundResult.points,[0,2]);assert.equal(end.deck.length,0);
  assert.throws(()=>scram.apply(end,'0',{type:'nextRound'},{random,isHost:false}));
  assert.equal(apply(end,{type:'nextRound'}).round,2);
  const fail=turn(state());fail.players[0].cards=[c(13)];fail.players.slice(1).forEach(p=>{p.cards=[];});fail.deck=[c(1)];
  const call=apply(fail,{type:'scram'}),next=scram.turn(call).players[0];const finish=apply(apply(call,{type:'draw',source:'deck'},next),{type:'discard'},next);assert.deepEqual(finish.roundResult.points,[23,0]);
});
test('SCRAM redacted-view bots complete and serialize all official player counts',()=>{
  for(const n of [3,4,6])for(let seed=1;seed<=12;seed++){
    let x=seed;const rng=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/2**32);
    let s=scram.create(Array.from({length:n},(_,i)=>String(i)),{},rng),steps=0;
    while(!scram.isFinished(s)&&steps++<2000){
      if(s.phase==='roundEnd'){s=scram.apply(s,'0',{type:'nextRound'},{random:rng,isHost:true});continue;}
      const id=scram.turn(s).players[0],v=scram.view(s,id),cmd=scram.bot.decide(v,id,{});assert.ok(cmd);s=scram.apply(s,id,cmd,{random:rng});
      s=JSON.parse(JSON.stringify(s));
    }
    assert.equal(s.phase,'finished',`${n} players seed ${seed}`);assert.equal(s.history.length,s.rounds);assert.equal(scram.result(s).players.length,n);
  }
});
test('SCRAM match tie breaks use reverse round history; three-player ties favor solo',()=>{
  function finish(n,history,totals){const s=turn(state(n));s.round=s.rounds;s.history=history;s.totals=totals;s.players.forEach(p=>{p.cards=[];});s.deck=[c(1)];return apply(apply(s,{type:'draw',source:'deck'}),{type:'discard'});}
  assert.deepEqual(finish(4,[[1,3],[3,1],[0,0]],[4,4]).winners,['1','3']);
  assert.deepEqual(finish(4,[[1,1],[2,2],[0,0]],[3,3]).winners,[]);
  assert.deepEqual(finish(3,[[1,2],[2,1]],[3,3]).winners,['0']);
});
test('SCRAM 9 removes the top two deck cards; short penalties conserve cards and finish only after resolution',()=>{
  const nine=drawn(9);nine.deck=[c(12),c(3)];const r=apply(nine,{type:'ability',targets:[ref(null,0),ref(null,1)]});
  assert.equal(r.phase,'roundEnd');assert.equal(r.discard.at(-1).value,3);assert.deepEqual(r.players[0].cards.at(-1),c(9,true));
  const s=drawn(2);s.players[0].cards=[c(1),c(2),c(3),c(4),c(5)];s.deck=[c(13)];
  const end=apply(s,{type:'replace',targets:s.players[0].cards.map((_,i)=>ref('0',i))});assert.equal(end.players[0].cards.length,7);assert.equal(end.phase,'roundEnd');
  const peek=drawn(5);peek.deck=[];const looking=apply(peek,{type:'ability',targets:[ref('0',2)]});assert.equal(looking.phase,'reveal');assert.equal(apply(looking,{type:'resolve'}).phase,'roundEnd');
});
