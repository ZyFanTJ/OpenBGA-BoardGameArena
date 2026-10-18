import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as g,paymentPlans} from '../packages/games/seven-wonders/index.js';
import {card} from '../packages/games/seven-wonders/data.js';

function fixture(){const s=g.create(['a','b','c'],{side:'day'},()=>.3);s.players.forEach((p,i)=>Object.assign(p,{wonder:['giza','babylon','ephesus'][i],coins:20,cards:[],stages:0,hand:['1-well@0']}));return s;}
test('7W payment explanations use each flexible production slot once and never change persisted payments',()=>{
 const s=fixture(),p=s.players[0];p.cards=['1-tree@0'];s.players[1].cards=['1-clay@0'];s.players[2].cards=['1-lumber@0'];
 const cost={resources:'wcc',coins:0},before=JSON.stringify(s);
 const plain=paymentPlans(s,p,cost),explained=paymentPlans(s,p,cost,true);
 assert.deepEqual(explained.map(({sources,...plan})=>plan),plain);
 for(const plan of explained){assert.deepEqual(plan.sources.map(x=>x.resource).sort(),['c','c','w']);assert.ok(plan.sources.filter(x=>x.source==='own').length<=1);assert.equal(plan.sources.filter(x=>x.source==='left').length*2,plan.left);assert.equal(plan.sources.filter(x=>x.source==='right').length*2,plan.right);}
 assert.equal(JSON.stringify(s),before);
 p.cards=[];p.hand=['1-tree@0'];const view=g.view(s,'a'),choice=view.hand[0].build.plans[0];
 let next=g.apply(s,'a',{type:'choose',action:'build',cardId:'1-tree@0',epoch:s.epoch,payment:choice});
 assert.equal(next.pending.a.payment.sources,undefined);
 for(const id of ['b','c'])next=g.apply(next,id,{type:'choose',action:'sell',cardId:next.players.find(x=>x.id===id).hand[0],epoch:next.epoch});
 assert.equal(next.lastActions[0].card.chains,undefined);
 assert.doesNotMatch(JSON.stringify(next),/"sources"|"preview"|"chains"/);
});
test('7W forecasts count technology sets, flexible production, own new buildings and never inspect secret choices',()=>{
 const s=fixture(),p=s.players[0];p.cards=['1-apothecary@0','1-workshop@0'];p.hand=['1-scriptorium@0','2-forum@0','3-lighthouse@0','2-vineyard@0'];
 const before=JSON.stringify(s),v=g.view(s,'a');
 const science=v.hand.find(x=>x.kind==='scriptorium').preview;
 assert.equal(science.scienceBefore,2);assert.equal(science.science.points,10);assert.deepEqual(science.science.counts,[1,1,1]);
 const flexible=v.hand.find(x=>x.kind==='forum').preview.production;
 assert.equal(flexible.filter(x=>x==='gpt').length,1);assert.equal(flexible.filter(x=>['g','p','t'].includes(x)).length,0);
 assert.equal(v.hand.find(x=>x.kind==='lighthouse').preview.income,1);
 assert.equal(v.hand.find(x=>x.kind==='vineyard').preview.incomeVariable,true);
 const hidden=structuredClone(s);hidden.players[1].hand=['3-palace@0'];hidden.decks[2]=['3-scientists@0'];hidden.pending.b={cardId:'3-palace@0',action:'build',payment:{left:0,right:0,bank:0}};
 assert.deepEqual(g.view(hidden,'a').hand,v.hand);assert.equal(JSON.stringify(s),before);
});
test('7W quote diagnostics distinguish money from unavailable combinations; chain and wonder grants stay distinct',()=>{
 const s=fixture(),p=s.players[0];p.coins=0;p.hand=['1-tree@0','3-palace@0'];
 let v=g.view(s,'a');assert.equal(v.hand[0].build.reason,'还差 1 钱币');assert.equal(v.hand[1].build.reason,'资源组合不足');
 p.coins=20;p.cards=['1-baths@0'];p.hand=['2-aqueduct@0'];v=g.view(s,'a');assert.equal(v.hand[0].build.plans[0].reason,'chain');assert.ok(v.hand[0].chains.from.some(x=>x.name===card('1-baths@0').name));
 p.wonder='olympia';p.stages=2;p.cards=[];v=g.view(s,'a');assert.equal(v.hand[0].build.plans[0].reason,'wonder');
});
