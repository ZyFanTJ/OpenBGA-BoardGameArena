import test from 'node:test';
import assert from 'node:assert/strict';
import {texasHoldem as game,potsFor} from '../packages/games/texas-holdem/index.js';
import {evaluate,compare,makeDeck} from '../packages/games/texas-holdem/cards.js';
import {JsonStore} from '../packages/platform/store.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
const cards=text=>text.split(' ').map(c=>({rank:({T:10,J:11,Q:12,K:13,A:14})[c[0]]??Number(c[0]),suit:c[1]}));
const random=()=>0.17;
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const act=(s,c,id=s.players[s.turn]?.id,extra={})=>game.apply(s,id,c,{random,isHost:false,...extra});
const create=(count=3)=>game.create(Array.from({length:count},(_,i)=>String(i)),{},random);
function stateFor(stacks,bets,{currentBet=100,lastFullRaise=100,street='preflop',turn=0}={}){
 const s=create(stacks.length);s.street=street;s.turn=turn;s.currentBet=currentBet;s.lastFullRaise=lastFullRaise;
 s.players.forEach((p,i)=>Object.assign(p,{stack:stacks[i],bet:bets[i],total:bets[i],folded:false,out:false,actedAt:null,lastAction:null,startStack:stacks[i]+bets[i]}));s.pending=s.players.filter(p=>p.stack>0).map(p=>p.id);return s;
}
test('all hand categories, wheel, seven-card selection, kickers and suit-independent ties',()=>{
 const examples=['As Kd 9c 7h 3s','As Ad 9c 7h 3s','As Ad 9c 9h 3s','As Ad Ac 7h 3s','As 2d 3c 4h 5s','As Js 9s 7s 3s','As Ad Ac 7h 7s','As Ad Ac Ah 3s','9s Ts Js Qs Ks'];
 examples.forEach((text,i)=>assert.equal(evaluate(cards(text)).score[0],i));
 assert.equal(evaluate(cards('As Ks Qs Js Ts 2d 3h')).name,'皇家同花顺');
 assert.deepEqual(evaluate(cards('As 2d 3c 4h 5s 8h 9c')).score,[4,5]);
 assert.deepEqual(evaluate(cards('As Ad Ac Kh Ks Kc 2h')).score,[6,14,13]);
 assert.equal(compare(evaluate(cards('As Ad Kc 7h 3s')).score,evaluate(cards('Ah Ac Qs 7s 3h')).score),1);
 assert.equal(compare(evaluate(cards('As Kd Qc Jh 9s')).score,evaluate(cards('Ah Kc Qs Jd 9h')).score),0);
});
test('creation validates options, deals distinct cards and posts blinds without leaking the deck',()=>{
 const s=create(8);assert.equal(new Set([...s.deck,...s.players.flatMap(p=>p.hole)].map(c=>c.rank+c.suit)).size,52);
 assert.equal(s.players[s.smallSeat].bet,10);assert.equal(s.players[s.bigSeat].bet,20);
 assert.equal(s.turn,(s.bigSeat+1)%8);assert.equal(s.players.reduce((n,p)=>n+p.stack+p.total,0),16000);
 assert.throws(()=>game.create(['a','a'],{},random));assert.throws(()=>game.create(['a','b'],{bigBlind:1},random));assert.throws(()=>game.create(['a','b'],{cash:true},random));
 for(const id of ['0','1',null]){const v=game.view(s,id);assert.equal(v.deck,undefined);assert.equal(v.burn,undefined);assert.equal(v.hand.length,id?2:0);assert.ok(v.players.every(p=>p.cards.every(c=>c===null)));}
});
test('heads-up button is small blind and acts first preflop, big blind acts first postflop',()=>{
 let s=create(2);assert.equal(s.dealer,s.smallSeat);assert.equal(s.turn,s.dealer);s=act(s,{type:'call'});assert.equal(s.turn,s.bigSeat);s=act(s,{type:'check'});assert.equal(s.street,'flop');assert.equal(s.turn,s.bigSeat);
});
test('big blind retains its option, all four streets run and input is immutable',()=>{
 let s=create(),original=structuredClone(s);s=act(s,{type:'call'});assert.deepEqual(original,create());assert.equal(original.players[original.turn].stack,2000);
 s=act(s,{type:'call'});assert.equal(s.turn,s.bigSeat);assert.equal(s.street,'preflop');s=act(s,{type:'check'});
 for(const street of ['flop','turn','river']){assert.equal(s.street,street);for(let i=0;i<3;i++)s=act(s,{type:'check'});}
 assert.equal(s.phase,'roundEnd');assert.equal(s.board.length,5);assert.equal(s.burn.length,3);assert.equal(s.players.reduce((n,p)=>n+p.stack,0),6000);
 assert.equal(new Set([...s.deck,...s.burn,...s.board,...s.players.flatMap(p=>p.hole)].map(c=>c.rank+c.suit)).size,52);
 assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
});
test('rejects out-of-turn, under-raise, fractional, negative, unaffordable and forged commands',()=>{
 const s=create(),id=s.players[s.turn].id,other=s.players.find(p=>p.id!==id).id,before=structuredClone(s);
 assert.throws(()=>act(s,{type:'call'},other));assert.throws(()=>act(s,{type:'check'}));
 for(const amount of [21,39,-1,40.5,NaN,Infinity,100000,'40',null])assert.throws(()=>act(s,{type:'raise',amount}));
 assert.throws(()=>act(s,{type:'shuffle'}));assert.throws(()=>act(s,{type:'fold'},'intruder'));assert.deepEqual(s,before);
 assert.equal(act(s,{type:'raise',amount:40}).currentBet,40);
});
test('a short all-in does not reopen action, cumulative short all-ins do',()=>{
 let s=stateFor([900,50,100,900],[100,100,100,100]);s.players[0].actedAt=100;s.players[0].lastAction='call';s.turn=1;s.pending=['1','2','3'];
 s=act(s,{type:'allIn'});assert.equal(s.currentBet,150);s=act(s,{type:'call'});s=act(s,{type:'call'});assert.equal(s.turn,0);assert.equal(game.view(s,'0').legal.raise,false);assert.throws(()=>act(s,{type:'allIn'}));
 s=stateFor([900,50,100,900],[100,100,100,100]);s.players[0].actedAt=100;s.players[0].lastAction='call';s.turn=1;s.pending=['1','2','3'];
 s=act(s,{type:'allIn'});s=act(s,{type:'allIn'});s=act(s,{type:'call'});assert.equal(s.turn,0);assert.equal(game.view(s,'0').legal.raise,true);assert.equal(game.view(s,'0').legal.fullRaiseTo,300);
});
test('checking preserves the right to raise a short opening all-in',()=>{
 let s=stateFor([1000,50,1000],[0,0,0],{street:'flop',currentBet:0,lastFullRaise:100});
 s=act(s,{type:'check'});s=act(s,{type:'allIn'});s=act(s,{type:'call'});assert.equal(s.turn,0);assert.equal(game.view(s,'0').legal.raise,true);assert.equal(game.view(s,'0').legal.fullRaiseTo,150);
});
test('an all-in caller can call short, uncalled excess is returned and no dry side pot is bet',()=>{
 let s=stateFor([900,40],[100,0],{turn:1});s.pending=['1'];s=act(s,{type:'call'});assert.notEqual(s.phase,'betting');assert.deepEqual(s.roundResult.returned,{id:'0',amount:60});assert.equal(s.roundResult.pots[0].amount,80);assert.equal(s.players.reduce((n,p)=>n+p.stack,0),1040);assert.equal(s.board.length,5);
 s=stateFor([0,90,100],[10,10,0],{currentBet:20,lastFullRaise:20,turn:2});s=act(s,{type:'fold'});assert.equal(s.phase,'roundEnd');assert.equal(s.roundResult.pots[0].amount,20);
});
test('side pots include folded contributions and award different winners at different levels',()=>{
 let s=stateFor([0,0,300],[100,200,200],{street:'river',currentBet:200,lastFullRaise:100,turn:2});
 s.board=cards('2s 3h 7d 9c Js');s.players[0].hole=cards('As Ad');s.players[1].hole=cards('Ks Kd');s.players[2].hole=cards('Qs Qd');s.pending=['2'];
 s=act(s,{type:'check'});assert.deepEqual(s.roundResult.pots.map(p=>[p.amount,p.winners]),[[300,['0']],[200,['1']]]);assert.deepEqual(s.players.map(p=>p.stack),[300,200,300]);
 assert.deepEqual(potsFor([{id:'a',total:100,folded:true},{id:'b',total:100},{id:'c',total:50}]),[{amount:150,eligible:['b','c']},{amount:100,eligible:['b']}]);
 assert.deepEqual(potsFor([{id:'a',total:20,folded:true},{id:'b',total:86,folded:true},{id:'c',total:2000},{id:'d',total:2000}]),[{amount:4106,eligible:['c','d']}]);
});
test('board-only ties split pots and odd chips go to the first winner left of button',()=>{
 let s=stateFor([100,100,100],[5,5,5],{street:'river',currentBet:5,turn:1});s.dealer=0;s.players[2].folded=true;s.pending=['1'];s.players[0].actedAt=5;
 s.board=cards('As Ks Qs Js Ts');s.players[0].hole=cards('2h 3h');s.players[1].hole=cards('4h 5h');s=act(s,{type:'check'});
 assert.deepEqual(s.roundResult.pots[0].payouts,[{id:'1',amount:8},{id:'0',amount:7}]);assert.deepEqual(s.players.map(p=>p.stack),[107,108,100]);assert.equal(s.roundResult.players[2].cards,undefined);
});
test('uncontested wins never reveal cards and the next hand rotates blinds',()=>{
 let s=create(2),oldBig=s.bigSeat;s=act(s,{type:'fold'});assert.equal(s.board.length,0);assert.equal(s.roundResult.showdown,false);assert.ok(game.spectatorView(s).players.every(p=>p.cards.every(c=>c===null)));assert.ok(s.roundResult.players.every(p=>!p.cards));
 assert.throws(()=>act(s,{type:'nextRound'},'0'));s=act(s,{type:'nextRound'},'0',{isHost:true});assert.equal(s.handNumber,2);assert.notEqual(s.bigSeat,oldBig);
});
test('multiple-hand matches terminate, blinds increase, AI is legal and all chips are conserved',()=>{
 for(let seed=1;seed<=24;seed++){
  const random=rng(seed),ids=Array.from({length:2+seed%7},(_,i)=>String(i));let s=game.create(ids,{handLimit:10},random),steps=0;
  while(!game.isFinished(s)&&steps++<2500){
   const before=structuredClone(s);
   if(s.phase==='roundEnd')s=game.apply(s,'0',{type:'nextRound'},{random,isHost:true});
   else {const id=s.players[s.turn].id,v=game.view(s,id),c=game.bot.decide(v,id,{});assert.ok(c);s=game.apply(s,id,c,{random});}
   assert.deepEqual(before,JSON.parse(JSON.stringify(before)));assert.equal(s.players.reduce((n,p)=>n+p.stack+(s.phase==='betting'?p.total:0),0),ids.length*2000);
   assert.ok(s.players.every(p=>Number.isSafeInteger(p.stack)&&p.stack>=0));
  }
  assert.ok(game.isFinished(s),`seed ${seed} must finish`);assert.ok(s.handNumber<=10);if(s.handNumber>5)assert.equal(s.bigBlind,40);
  assert.ok(game.result(s).winners.length);assert.throws(()=>act(s,{type:'fold'},'0'));
 }
});
test('view copies cannot mutate state, timeout checks/folds and spectators see no private cards',()=>{
 const s=create(),id=s.players[s.turn].id,v=game.view(s,id),before=structuredClone(s);v.hand[0].rank=1;v.players[0].stack=999;assert.deepEqual(s,before);
 assert.deepEqual(game.timeout(game.view(s,id),id),{type:'fold'});assert.equal(game.timeout(game.view(s,id),'someone'),null);
 const q=stateFor([100,100],[0,0],{currentBet:0});assert.deepEqual(game.timeout(game.view(q,'0'),'0'),{type:'check'});
 assert.equal(game.spectatorView(s).hand.length,0);assert.ok(!JSON.stringify(game.spectatorView(s)).includes('"suit"'));
});
test('platform revision conflicts, reconnect and result persistence',()=>{
 const store=new JsonStore(),rooms=new RoomService(store,games,{random}),a={id:'a',name:'A'},b={id:'b',name:'B'},id=rooms.createRoom(a,{gameId:'texas-holdem',title:'德州测试',options:{handLimit:10}}).id;
 rooms.join(b,id);const run=(u,c)=>rooms.mutate(u,id,{revision:store.data.rooms[id].revision,...c});run(a,{type:'ready',ready:true});run(b,{type:'ready',ready:true});run(a,{type:'start'});
 const initial=rooms.snapshot(id,a);assert.deepEqual(initial.game.hand,store.data.rooms[id].game.players[0].hole);assert.equal(initial.game.deck,undefined);
 let turns=0;while(store.data.rooms[id].status==='playing'&&turns++<2000){const s=store.data.rooms[id].game;if(s.phase==='roundEnd'){run(a,{type:'game',command:{type:'nextRound'}});continue;}const u=s.players[s.turn].id==='a'?a:b,revision=store.data.rooms[id].revision;run(u,{type:'game',command:game.bot.decide(game.view(s,u.id),u.id,{})});assert.throws(()=>rooms.mutate(u,id,{revision,type:'game',command:{type:'fold'}}),{status:409});}
 assert.equal(store.data.rooms[id].status,'finished');assert.equal(Object.values(store.data.matches).length,1);assert.ok(!JSON.stringify(store.data.matches).includes('"hole"'));
});
