import test from 'node:test';
import assert from 'node:assert/strict';
import { uno } from '../packages/games/uno/index.js';
import { makeDeck, points } from '../packages/games/uno/cards.js';
const rng=(initial=42)=>{let seed=initial;return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);};
const random=rng();
const card=(color,value,id=`${color}-${value}`)=>({id,color,value});
function fixture(hands, top=card('red',5,'top')) {
  const s=uno.create(hands.map((_,i)=>String(i)),{},rng());
  s.players.forEach((p,i)=>{p.hand=hands[i];p.total=0;p.announced=false;});
  Object.assign(s,{phase:'turn',turn:0,direction:1,color:top.color,discard:[top],deck:makeDeck().map(c=>({...c,id:`deck-${c.id}`})),pending:null,drawnId:null,unoWindow:null,evidence:null,roundResult:null});return s;
}
const apply=(s,id,c,extra={})=>uno.apply(s,id,c,{random,...extra});
test('UNO classic has 108 distinct cards with exact frequencies and scoring',()=>{
  const deck=makeDeck();assert.equal(deck.length,108);assert.equal(new Set(deck.map(c=>c.id)).size,108);
  for(const color of ['red','yellow','green','blue']){assert.equal(deck.filter(c=>c.color===color).length,25);assert.equal(deck.filter(c=>c.color===color&&c.value===0).length,1);}
  assert.equal(deck.filter(c=>c.value==='wild4').length,4);assert.equal(points(card('red',9)),9);assert.equal(points(card('blue','skip')),20);assert.equal(points(card(null,'wild')),50);
  assert.throws(()=>uno.create(['a','a'],{},random));assert.throws(()=>uno.create(['a','b'],{stack:true},random));
});
test('setup deals seven, applies all opener effects and never starts on +4',()=>{
  const seen=new Set();
  for(let seed=1;seed<400;seed++){
    const s=uno.create(['a','b','c'],{},rng(seed)),top=s.discard[0];seen.add(top.value);
    assert.notEqual(top.value,'wild4');assert.equal(s.deck.length+s.discard.length+s.players.reduce((n,p)=>n+p.hand.length,0),108);
    const first=(s.dealer+1)%3;
    if(top.value==='draw2'){assert.equal(s.players[first].hand.length,9);assert.equal(s.turn,(first+1)%3);}
    else {assert.ok(s.players.every(p=>p.hand.length===7));assert.equal(s.turn,top.value==='reverse'?s.dealer:top.value==='skip'?(first+1)%3:first);}
    assert.equal(s.phase,top.value==='wild'?'color':'turn');assert.equal(s.direction,top.value==='reverse'?-1:1);
    assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
  }
  for(const value of ['draw2','skip','reverse','wild'])assert.ok(seen.has(value));
});
test('matching, actor authorization, immutable errors, wild color validation and drawn-card restriction',()=>{
  const s=fixture([[card('red',1),card('blue',7)],[card('green',4)]]),saved=structuredClone(s);
  assert.throws(()=>apply(s,'1',{type:'play',cardId:'green-4'}));assert.throws(()=>apply(s,'0',{type:'play',cardId:'blue-7'}));assert.deepEqual(s,saved);
  s.deck.push(card('red',8,'new'));
  const drawn=apply(s,'0',{type:'draw'});assert.equal(drawn.phase,'drawn');assert.equal(drawn.drawnId,'new');
  assert.throws(()=>apply(drawn,'0',{type:'play',cardId:'red-1'}));
  assert.equal(apply(drawn,'0',{type:'pass'}).turn,1);
  const played=apply(drawn,'0',{type:'play',cardId:'new'});assert.equal(played.discard.at(-1).id,'new');
  assert.equal(s.players[0].hand.length,2);
  const wild=fixture([[card(null,'wild'),card('red',1)],[card('blue',1)]]);
  assert.throws(()=>apply(wild,'0',{type:'play',cardId:'null-wild'}));
  assert.equal(apply(wild,'0',{type:'play',cardId:'null-wild',color:'green'}).color,'green');
});
test('skip, reverse and +2 skip the right player with no stacking, including two-player return',()=>{
  for(const value of ['skip','reverse','draw2']){
    const s=fixture([[card('red',value),card('blue',0)],[card('yellow',1)]]);
    const next=apply(s,'0',{type:'play',cardId:`red-${value}`});assert.equal(next.turn,0);
    assert.equal(next.players[1].hand.length,value==='draw2'?3:1);
  }
  const s=fixture([[card('red','reverse'),card('blue',0)],[card('green',0)],[card('yellow',0)]]);
  const reversed=apply(s,'0',{type:'play',cardId:'red-reverse'});assert.equal(reversed.turn,2);assert.equal(reversed.direction,-1);
});
test('+4 can bluff; successful challenge privately proves original hand and offender draws four',()=>{
  const s=fixture([[card(null,'wild4'),card('red',1),card('blue',4)],[card('green',2)],[card('yellow',3)]]);
  const played=apply(s,'0',{type:'play',cardId:'null-wild4',color:'blue'});
  assert.equal(played.phase,'challenge');assert.equal(uno.view(played,'1').pending.illegal,undefined);assert.equal(uno.view(played,'1').pending.hand,undefined);
  assert.throws(()=>apply(played,'1',{type:'draw'}));
  const next=apply(played,'1',{type:'challenge'});assert.equal(next.turn,1);assert.equal(next.phase,'turn');assert.equal(next.players[0].hand.length,6);
  assert.deepEqual(uno.view(next,'1').evidence.hand,s.players[0].hand.slice(1));assert.equal(uno.view(next,'0').evidence,null);assert.equal(uno.view(next,'2').evidence,null);
  assert.equal(apply(next,'1',{type:'draw'}).evidence,null);
});
test('legal +4 matches current COLOR only, unsuccessful challenge is six and accept four',()=>{
  const s=fixture([[card(null,'wild4'),card('blue',5)],[card('green',1)],[card('yellow',1)]]);
  for(const [action,count] of [['challenge',6],['accept',4]]){
    const played=apply(s,'0',{type:'play',cardId:'null-wild4',color:'green'}),next=apply(played,'1',{type:action});
    assert.equal(next.players[1].hand.length,1+count);assert.equal(next.turn,2);assert.equal(next.phase,'turn');
  }
});
test('UNO simultaneous declaration, self rescue, catching out of turn, and next-action expiration',()=>{
  const s=fixture([[card('red',1),card('blue',3)],[card('red',2),card('green',7)],[card('yellow',7)]]);
  const played=apply(s,'0',{type:'play',cardId:'red-1'});assert.equal(played.unoWindow,'0');
  assert.deepEqual(uno.bot.decide(uno.view(played,'1'),'1',{}),{type:'catch'});
  const caught=apply(played,'2',{type:'catch'});assert.equal(caught.players[0].hand.length,3);assert.equal(caught.turn,1);
  assert.throws(()=>apply(caught,'2',{type:'catch'}));assert.equal(apply(played,'0',{type:'uno'}).unoWindow,null);
  const declared=apply(s,'0',{type:'play',cardId:'red-1',uno:true});assert.equal(declared.unoWindow,null);assert.equal(declared.players[0].announced,true);
  const next=apply(played,'1',{type:'play',cardId:'red-2',uno:true});assert.equal(next.unoWindow,null);assert.throws(()=>apply(next,'2',{type:'catch'}));
});
test('initial wild selection keeps the first player and only accepts a valid color from that player',()=>{
  let s;
  for(let seed=1;seed<400;seed++){s=uno.create(['a','b','c'],{},rng(seed));if(s.phase==='color')break;}
  assert.equal(s.phase,'color');const id=s.players[s.turn].id;
  assert.throws(()=>apply(s,id,{type:'color',color:'purple'}));assert.throws(()=>apply(s,s.players[(s.turn+1)%3].id,{type:'color',color:'red'}));
  const next=apply(s,id,{type:'color',color:'red'});assert.equal(next.turn,s.turn);assert.equal(next.phase,'turn');assert.equal(next.color,'red');
});
test('last +2 and +4 penalties count before scoring and next round requires host',()=>{
  const s=fixture([[card('red','draw2')],[card('green',1)]]);s.deck=[card('blue',2),card('green',3)];
  let next=apply(s,'0',{type:'play',cardId:'red-draw2'});assert.equal(next.phase,'roundEnd');assert.equal(next.roundResult.points,6);assert.equal(next.players[0].total,6);
  assert.throws(()=>apply(next,'1',{type:'nextRound'}));next=apply(next,'0',{type:'nextRound'},{isHost:true});assert.equal(next.round,2);assert.equal(next.players[0].total,6);
  const last=fixture([[card(null,'wild4')],[card('red',1)]]);last.deck=[card('blue',2),card('blue',3),card('blue',4),card('blue',5)];last.players[0].total=490;
  const pending=apply(last,'0',{type:'play',cardId:'null-wild4',color:'blue'});assert.equal(pending.phase,'challenge');assert.equal(pending.roundResult,null);
  const finished=apply(pending,'1',{type:'accept'});assert.equal(finished.phase,'finished');assert.deepEqual(finished.winners,['0']);assert.equal(finished.players[0].total,505);
});
test('deck recycling retains top and every card; unplayable draw advances automatically',()=>{
  const s=fixture([[card('red',1)],[card('green',1)]]);s.deck=[];s.discard=[card('blue',7,'recycled'),card('red',5,'top')];
  const next=apply(s,'0',{type:'draw'});assert.equal(next.players[0].hand.at(-1).id,'recycled');assert.equal(next.discard[0].id,'top');assert.equal(next.turn,1);
});
test('views reveal neither decks, opposing hands nor +4 guilt; mutation cannot affect state',()=>{
  const s=uno.create(['a','b','c'],{},rng()),v=uno.view(s,'a');assert.equal(v.deck,undefined);assert.equal(v.players[1].hand,undefined);assert.equal(v.hand.length,7);
  assert.equal(uno.view(s,'spectator').hand.length,0);v.hand[0].value=999;assert.notEqual(s.players[0].hand[0].value,999);
});
test('AI completes seeded 2/4/10-player matches using only private views and conserves the deck',()=>{
  for(const count of [2,4,10])for(const seed of [10,20,30]){
    const random=rng(seed);let s=uno.create(Array.from({length:count},(_,i)=>String(i)),{target:100},random),steps=0;
    while(!uno.isFinished(s)&&steps++<15000){
      if(s.phase==='roundEnd'){s=uno.apply(s,'0',{type:'nextRound'},{random,isHost:true});continue;}
      const id=uno.turn(s).players[0],v=uno.view(s,id),command=uno.bot.decide(v,id,{});assert.ok(command);
      s=uno.apply(s,id,command,{random});
      const cards=[...s.deck,...s.discard,...s.players.flatMap(p=>p.hand)];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);
    }
    assert.ok(uno.isFinished(s),`${count} players seed ${seed}`);assert.ok(uno.result(s).players.some(p=>p.score>=100));
  }
});
