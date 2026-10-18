import test from 'node:test';
import assert from 'node:assert/strict';
import { sevenWonders as g, paymentPlans, production, scienceScore, scores, buildQuote } from '../packages/games/seven-wonders/index.js';
import { CARDS, card, WONDERS } from '../packages/games/seven-wonders/data.js';
import { createSevenWondersRenderer } from '../apps/web/games/seven-wonders/index.js';
const ids=['a','b','c'];
const fresh=(side='day')=>g.create(ids,{side},()=>.3);
const cid=key=>`${key}@0`;
function clean(){const s=fresh();s.players.forEach(p=>Object.assign(p,{wonder:'giza',side:'day',coins:20,cards:[],stages:0,hand:[],buried:[]}));return s;}
function choose(s,id,cardId,action='sell',payment){return g.apply(s,id,{type:'choose',epoch:s.epoch,cardId,action,...(payment?{payment}:{})});}
const sellAll=s=>{for(const p of [...s.players])if(p.hand.length)s=choose(s,p.id,p.hand[0]);return s;};
function seeded(seed){return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;}

test('7W printed decks have exact counts at 3–7 players, unique cards and edition-specific chains',()=>{
  for(let n=3;n<=7;n++){
    const s=g.create(Array.from({length:n},(_,i)=>String(i)),{side:'day'},seeded(n));
    assert.equal(s.players.reduce((n,p)=>n+p.hand.length,0),7*n);assert.equal(s.decks[1].length,7*n);assert.equal(s.decks[2].length,7*n);
    assert.equal(s.decks[2].filter(id=>card(id).color==='purple').length,n+2);
    assert.equal(new Set(s.players.flatMap(p=>p.hand).concat(...s.decks)).size,21*n);
    assert.equal(new Set(s.players.map(p=>p.wonder)).size,n);
  }
  assert.equal(Object.keys(CARDS).length,80); // 70 age templates plus 10 guilds
  assert.equal(CARDS['2-bazar'].effect.income.coins,2);
  assert.deepEqual(CARDS['2-temple'].from,[]);assert.deepEqual(CARDS['3-pantheon'].from,['altar']);
  assert.throws(()=>g.create(['a','b'],{},()=>.5));assert.throws(()=>g.create(ids,{edition:1},()=>.5));
});

test('7W side selection persists, rejects invalid/duplicate choices, and only deals after everyone chooses',()=>{
  let s=g.create(ids,{},seeded(2));assert.equal(s.phase,'setup');
  assert.equal(g.view(s,'a').setupChoices.length,2);
  const before=structuredClone(s);freeze(s);s=g.apply(s,'a',{type:'side',side:'night',epoch:0});assert.deepEqual(before.players[0].hand,[]);
  assert.throws(()=>g.apply(s,'a',{type:'side',side:'day',epoch:0}),/已选择/);
  for(const id of ['b','c'])s=g.apply(JSON.parse(JSON.stringify(s)),id,{type:'side',side:'day',epoch:0});
  assert.equal(s.phase,'draft');assert.equal(s.players[0].side,'night');assert.equal(s.players[0].hand.length,7);
  assert.throws(()=>g.apply(s,'a',{type:'choose',epoch:0,cardId:s.players[0].hand[0],action:'sell'}),{status:409});
});

test('7W pending choices stay secret and immutable until simultaneous reveal; buried/discarded/deck identities never leak',()=>{
  const initial=fresh(),before=structuredClone(initial),picked=initial.players[0].hand[0];freeze(initial);
  const s=choose(initial,'a',picked);assert.deepEqual(initial,before);assert.equal(s.players[0].coins,3);
  const a=g.view(s,'a'),b=g.view(s,'b');assert.equal(a.pending.cardId,picked);assert.equal(b.pending,null);assert.equal(b.players[0].submitted,true);
  assert.ok(!JSON.stringify(b).includes(picked));
  for(const p of b.players){assert.ok(!('hand' in p));assert.ok(!('buried' in p));}
  assert.ok(!('decks' in b));assert.ok(!('discard' in b));assert.ok(!('turnEffects' in b));
  assert.throws(()=>choose(s,'a',picked),{status:409});assert.throws(()=>choose(s,'b',picked),/不在你的手/);
  assert.throws(()=>g.view(s,'intruder'),{status:403});
  assert.throws(()=>g.apply(s,'intruder',{type:'choose',epoch:s.epoch}),{status:403});
  assert.throws(()=>choose(initial,'a',picked,'build',{left:99,right:0,bank:0}));
});

test('7W remaining hands pass left in I/III and right in II, and duplicate names cannot be built across ages',()=>{
  for(const age of [1,2,3]){
    let s=fresh();s.age=age;
    const remainder=s.players.map(p=>p.hand.slice(1));s=sellAll(s);
    assert.deepEqual(s.players[age===2?2:1].hand,remainder[0]);assert.equal(s.round,2);
  }
  const s=clean(),p=s.players[0];p.cards=[cid('1-loom')];assert.equal(buildQuote(s,p,cid('2-loom')).plans.length,0);
});

test('7W trading allocates flexible resources once, respects discounts and never exports yellow or wonder production',()=>{
  const s=clean(),[p,left,right]=s.players;p.coins=3;p.wonder='olympia';left.wonder='rhodes';right.wonder='babylon';
  left.cards=[cid('1-timber')];left.wonder='rhodes';right.wonder='rhodes';
  assert.equal(paymentPlans(s,p,{resources:'ws',coins:0}).length,0);
  p.coins=4;assert.equal(paymentPlans(s,p,{resources:'ws',coins:0}).length,0,'a flexible slot is not two resources');
  right.wonder='giza';assert.ok(paymentPlans(s,p,{resources:'ws',coins:0}).some(x=>x.left===2&&x.right===2));
  p.cards=[cid('1-west')];p.coins=3;assert.ok(paymentPlans(s,p,{resources:'ws',coins:0}).some(x=>x.left===1&&x.right===2));
  left.cards=[cid('2-forum')];right.wonder='rhodes';assert.equal(paymentPlans(s,p,{resources:'g',coins:0}).length,0);
  left.wonder='alexandria';left.side='night';left.stages=2;left.cards=[];
  assert.equal(paymentPlans(s,p,{resources:'t',coins:0}).length,0);
  assert.ok(production(left).some(x=>x.includes('t')));assert.ok(!production(left,true).some(x=>x.includes('t')));
});

test('7W newly earned coins and new neighbor resources cannot pay for same-turn construction',()=>{
  let s=clean();s.players.forEach(p=>{p.coins=0;p.wonder='giza';});
  s.players[0].hand=[cid('1-tavern'),cid('1-barracks')];s.players[1].hand=[cid('1-ore'),cid('1-tower')];s.players[2].hand=[cid('1-theater'),cid('1-altar')];
  s=choose(s,'a',cid('1-tavern'),'build');s=choose(s,'b',cid('1-ore'),'build');
  assert.equal(s.players[0].coins,0);assert.equal(buildQuote(s,s.players[2],cid('1-barracks')).plans.length,0);
  s=choose(s,'c',cid('1-theater'),'build');assert.equal(s.players[0].coins,5);assert.equal(s.players[1].cards.length,1);
});

test('7W Olympia FAQ first-color and first/sixth-card abilities do not apply to wonder stages or seventh cards',()=>{
  const s=clean(),p=s.players[0];p.wonder='olympia';p.stages=2;p.coins=0;p.cards=[cid('1-theater')];
  assert.equal(buildQuote(s,p,cid('3-palace')).plans.length,0);assert.equal(buildQuote(s,p,cid('3-university')).plans[0].reason,'wonder');
  assert.equal(g.view(s,'a').wonderBuild.plans.length,0);
  p.side='night';s.round=1;assert.equal(buildQuote(s,p,cid('3-palace')).plans[0].reason,'wonder');
  s.round=6;assert.equal(buildQuote(s,p,cid('3-palace')).plans[0].reason,'wonder');
  s.round=7;assert.equal(buildQuote(s,p,cid('3-palace')).plans.length,0);
  p.wonder='giza';p.stages=0;p.cards=[cid('1-altar')];assert.equal(buildQuote(s,p,cid('3-pantheon')).plans[0].reason,'chain');
});

test('7W sixth-turn Halicarnassus sees discarded leftovers privately and can only recover nonduplicate buildings',()=>{
  let s=clean();s.round=6;const p=s.players[0];p.wonder='halicarnassus';p.side='night';p.coins=0;p.cards=[cid('1-clay'),cid('2-brickyard')];
  p.hand=[cid('1-tower'),cid('3-palace')];s.players[1].hand=[cid('1-theater'),cid('1-altar')];s.players[2].hand=[cid('1-workshop'),cid('1-baths')];
  s=choose(s,'a',cid('1-tower'),'wonder');s=choose(s,'b',cid('1-theater'));s=choose(s,'c',cid('1-workshop'));
  assert.equal(s.phase,'revive');assert.equal(s.age,1);assert.ok(g.view(s,'a').discardChoices.some(c=>c.id===cid('3-palace')));
  assert.deepEqual(g.view(s,'b').discardChoices,[]);assert.equal(g.view(s,'b').reviveId,'a');
  assert.ok(!JSON.stringify(g.view(s,'b')).includes(cid('3-palace')));assert.ok(!JSON.stringify(g.view(s,'b')).includes(cid('1-tower')));
  assert.throws(()=>g.apply(s,'b',{type:'revive',cardId:cid('3-palace'),epoch:s.epoch}),{status:403});
  s=g.apply(JSON.parse(JSON.stringify(s)),'a',{type:'revive',cardId:cid('3-palace'),epoch:s.epoch});assert.equal(s.age,2);assert.ok(s.players[0].cards.includes(cid('3-palace')));assert.equal(s.players[0].coins,0);
});

test('7W Babylon built on sixth turn keeps seventh card, pays normally, then settles military',()=>{
  let s=clean();s.round=6;const p=s.players[0];p.wonder='babylon';p.side='night';p.cards=[cid('2-quarry')];
  s.players.forEach((p,i)=>p.hand=[`${i+1===3?'3':'1'}-${['theater','altar','palace'][i]}@0`,cid(['1-well','1-tower','1-baths'][i])]);
  s=choose(s,'a',p.hand[0],'wonder');s=choose(s,'b',s.players[1].hand[0]);s=choose(s,'c',s.players[2].hand[0]);
  assert.equal(s.phase,'extra');assert.equal(s.round,7);assert.equal(s.ageResults.length,0);assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,0);
  assert.equal(g.view(s,'b').canChoose,false);assert.equal(g.view(s,'a').canChoose,true);
  s=choose(s,'a',s.players[0].hand[0]);assert.equal(s.age,2);assert.equal(s.ageResults.length,1);
});

test('7W commerce counts same-turn builds and revival before income, and military compares both neighbors',()=>{
  let s=clean();s.players.forEach(p=>p.hand=[cid('1-theater'),cid('1-altar')]);
  s.players[0].hand=[cid('2-bazar'),cid('1-well')];s.players[1].hand=[cid('1-glass'),cid('1-tower')];s.players[2].hand=[cid('1-loom'),cid('1-baths')];
  s=choose(s,'a',cid('2-bazar'),'build');s=choose(s,'b',cid('1-glass'),'build');s=choose(s,'c',cid('1-loom'),'build');assert.equal(s.players[0].coins,24);
  s=clean();s.round=6;s.players.forEach(p=>p.hand=[cid('1-theater'),cid('1-altar')]);
  s.players[0].cards=[cid('3-arsenal')];s.players[1].cards=[cid('1-tower')];s=sellAll(s);
  assert.deepEqual(s.ageResults[0].military[0].tokens,[1,1]);assert.deepEqual(s.players[0].military,[1,1]);assert.deepEqual(s.players[1].military,[1,-1]);
});

test('7W science optimizes wildcards and scores guilds/treasury/wonders with official tie breaks',()=>{
  assert.equal(scienceScore([2,1,1]),13);assert.equal(scienceScore([2,1,0],1),13);assert.equal(scienceScore([0,0,0],2),4);
  const s=clean(),p=s.players[0];p.coins=8;p.stages=3;p.cards=[cid('1-lumber'),cid('1-glass'),cid('3-shipowners'),cid('3-decorators'),cid('3-scientists'),cid('1-workshop')];
  const r=scores(s)[0];assert.equal(r.wonder,15);assert.equal(r.treasury,2);assert.equal(r.purple,12);assert.equal(r.green,4);assert.equal(r.total,33);
  let end=clean();end.age=3;end.round=6;end.players.forEach(p=>{p.coins=0;p.hand=[cid('1-theater'),cid('1-altar')];});
  end.players[1].coins=1;end=sellAll(end);assert.deepEqual(end.winners,['b']);
  end=clean();end.age=3;end.round=6;end.players.forEach(p=>{p.coins=0;p.hand=[cid('1-theater'),cid('1-altar')];});end=sellAll(end);assert.deepEqual(end.winners,ids);
});

test('7W seeded AI completes every size/day/night setup with conservation, JSON recovery and no negative money',()=>{
  for(const side of ['day','night','choose'])for(let n=3;n<=7;n++) {
    let s=g.create(Array.from({length:n},(_,i)=>String(i)),{side},seeded(n*37));let turns=0;
    while(!g.isFinished(s)&&turns++<190){
      const actor=s.players.find(p=>g.bot.decide(g.view(s,p.id),p.id));assert.ok(actor,'AI must be able to progress');
      const before=JSON.stringify(s),cmd=g.bot.decide(g.view(s,actor.id),actor.id);s=g.apply(s,actor.id,cmd);assert.notEqual(JSON.stringify(s),before);
      s=JSON.parse(JSON.stringify(s));assert.ok(s.players.every(p=>p.coins>=0));
      const all=[...s.decks.flat(),...s.discard,...s.players.flatMap(p=>[...p.hand,...p.cards,...p.buried])];assert.equal(all.length,21*n);assert.equal(new Set(all).size,all.length);
    }
    assert.equal(s.phase,'finished');assert.equal(s.ageResults.length,3);assert.ok(s.winners.length>0);assert.ok(g.view(s,'0').players.every(p=>p.handCount===0));
  }
});

test('7W renderer escapes names and drives selected card, purpose, payment and confirmation through the engine',async()=>{
  let state=fresh();const user={id:'a'},snapshot=()=>({game:g.view(state,'a'),hostId:'a',players:ids.map(id=>({id,name:id==='a'?'<Alice>':id}))});
  const renderer=createSevenWondersRenderer(async command=>{state=g.apply(state,'a',command);},()=>{});
  let html=renderer.render(snapshot(),user);assert.match(html,/&lt;Alice&gt;/);assert.doesNotMatch(html,/<Alice>/);
  assert.doesNotMatch(html,/sw-action-dialog|sw-decision|sw-card-type|sw-card-price/);
  const id=state.players[0].hand[0];await renderer.handle('card',{dataset:{card:id}});
  html=renderer.render(snapshot(),user);assert.match(html,/sw-action-dialog/);
  await renderer.handle('mode',{dataset:{mode:'wonder'}});
  await renderer.handle('inspect',{dataset:{player:'b'}});html=renderer.render(snapshot(),user);
  assert.match(html,/sw-city-drawer/);assert.match(html,/可购买/);assert.doesNotMatch(html,/sw-action-dialog/);
  await renderer.handle('close');html=renderer.render(snapshot(),user);
  assert.match(html,/sw-action-dialog/);assert.match(html,/data-mode="wonder"[^>]*aria-pressed="true"/);
  await renderer.handle('mode',{dataset:{mode:'sell'}});html=renderer.render(snapshot(),user);assert.match(html,/确认卖牌/);
  await renderer.handle('confirm');assert.equal(state.pending.a.action,'sell');assert.equal(state.pending.a.cardId,id);
  assert.match(renderer.render(snapshot(),user),/选择已确认/);
});

