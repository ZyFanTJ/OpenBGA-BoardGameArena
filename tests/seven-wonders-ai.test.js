import test from 'node:test';
import assert from 'node:assert/strict';
import {sevenWonders as g} from '../packages/games/seven-wonders/index.js';
const ids=['a','b','c'];
const resources=['1-lumber','1-stone','1-clay','1-ore','1-glass','1-press','1-loom','2-sawmill','2-quarry','2-brickyard','2-foundry'];
function fixture(options={}){const s=g.create(ids,{side:'day',...options},()=>.42);Object.assign(s,{phase:'draft',age:3,round:6,pending:{}});
 for(const p of s.players)Object.assign(p,{wonder:'giza',side:'day',coins:6,cards:[...resources],stages:3,builtStages:[0,1,2],leaders:[],islands:[],military:[],navalMilitary:[],hand:[]});return s;
}
function decision(s,hand){s.players[0].hand=hand;const v=g.view(s,'a'),before=JSON.stringify(v),cmd=g.bot.decide(v,'a');assert.equal(JSON.stringify(v),before);assert.deepEqual(g.bot.decide(JSON.parse(before),'a'),cmd);assert.doesNotThrow(()=>g.apply(s,'a',cmd,{random:()=>.3}));return cmd;}
test('7W AI values marginal land-conflict results instead of endlessly accumulating shields',()=>{
 let s=fixture();s.players[0].cards.push('1-stockade','1-barracks','1-tower','2-walls');
 assert.equal(decision(s,['3-fortifications','3-palace']).cardId,'3-palace');
 s=fixture();s.players[1].cards.push('2-walls');s.players[2].cards.push('2-walls');
 assert.equal(decision(s,['3-fortifications','3-palace']).cardId,'3-fortifications');
});
test('7W AI completes a science set and optimizes wild symbols at the end of the game',()=>{
 const s=fixture();s.players[0].cards.push('1-apothecary','1-workshop');
 assert.equal(decision(s,['3-university','3-pantheon']).cardId,'3-university');
 assert.equal(decision(s,['3-scientists','3-pantheon']).cardId,'3-scientists');
});
test('7W AI evaluates guilds against both real neighboring cities',()=>{
 const s=fixture();
 assert.equal(decision(s,['3-workers','3-palace']).cardId,'3-workers');
 for(const p of s.players.slice(1))p.cards=[];
 assert.equal(decision(s,['3-workers','3-palace']).cardId,'3-palace');
});
test('7W AI stops buying development at the end and restores early liquidity',()=>{
 let s=fixture();assert.equal(decision(s,['1-lumber','3-palace']).cardId,'3-palace');
 s=fixture();s.age=1;s.round=1;s.players[0].cards=[];s.players[0].coins=0;
 assert.equal(decision(s,['1-tavern','1-altar']).cardId,'1-tavern');
});
test('7W AI picks the smallest victory token to discard and values fleet milestones',()=>{
 const s=fixture({leaders:true,armada:true});s.phase='ability';s.players[0].military=[5,1,3];s.tasks=[{kind:'discardVictory',playerId:'a'}];
 let v=g.view(s,'a'),cmd=g.bot.decide(v,'a');assert.equal(cmd.value,1);assert.doesNotThrow(()=>g.apply(s,'a',cmd,{random:()=>.3}));
 s.tasks=[{kind:'advance',playerId:'a',remaining:1,used:[]}];s.players[0].fleets={red:0,yellow:0,blue:0,green:5};s.players[1].fleets.red=2;s.players[2].fleets.red=3;
 v=g.view(s,'a');cmd=g.bot.decide(v,'a');assert.equal(cmd.value,'green');assert.doesNotThrow(()=>g.apply(s,'a',cmd,{random:()=>.3}));
});
test('7W AI chooses a valuable exploration reward and withdraws from a losing sea battle',()=>{
 const s=fixture({armada:true});s.phase='explore';s.exploration={offers:{offer:{playerId:'a',level:3,cards:['island-scarlet','island-royal']}},picks:{}};s.players[0].cards.push('1-stockade','1-barracks','1-tower','2-walls');
 let cmd=g.bot.decide(g.view(s,'a'),'a');assert.equal(cmd.cardId,'island-royal');assert.doesNotThrow(()=>g.apply(s,'a',cmd,{random:()=>.3}));
 s.phase='navalChoice';s.navalChoices={};s.players[0].islands=['island-forgotten'];s.players[1].fleets.red=2;s.players[2].fleets.red=3;
 cmd=g.bot.decide(g.view(s,'a'),'a');assert.equal(cmd.participate,false);
});
test('7W AI decisions cannot depend on secret rival hands, pending cards or undealt decks',()=>{
 const s=fixture({leaders:true,armada:true});s.players[0].hand=['3-palace','3-fortifications'];
 const before=g.view(s,'a'),choice=g.bot.decide(before,'a');
 s.players[1].hand=['3-scientists'];s.players[1].leaderHand=['leader-caesar'];s.decks[0]=['1-lumber'];s.pending.b={cardId:'3-scientists',action:'build',payment:{left:0,right:0,bank:0}};
 assert.deepEqual(g.bot.decide(g.view(s,'a'),'a'),choice);
});

test('7W AI chooses civilization abilities and mummifies an obsolete leader instead of an active engine',()=>{
 const s=fixture({leaders:true});s.phase='setup';s.players[0].wonder='babylon';s.players[0].side=null;s.players[0].stages=0;s.players[0].builtStages=[];s.age=1;s.round=1;
 let cmd=g.bot.decide(g.view(s,'a'),'a');assert.equal(cmd.side,'night');
 s.phase='ability';s.age=3;s.round=6;s.players[0].side='day';s.players[0].leaders=['leader-caesar','leader-euclid'];s.players[0].cards.push('1-stockade','1-barracks','1-tower','2-walls','1-apothecary','2-dispensary');
 s.tasks=[{kind:'mummify',playerId:'a',eligible:[...s.players[0].leaders]}];cmd=g.bot.decide(g.view(s,'a'),'a');assert.equal(cmd.value,'leader-caesar');assert.doesNotThrow(()=>g.apply(s,'a',cmd,{random:()=>.3}));
});
test('7W AI recruits a science leader for the developed engine and returns no command after confirmation',()=>{
 const s=fixture({leaders:true});s.phase='recruit';s.age=3;s.round=0;s.players[0].cards.push('1-apothecary','1-workshop');s.players[0].leaderHand=['leader-ptolemy','leader-cleopatra'];for(const p of s.players.slice(1))p.leaderHand=['leader-zenobia'];
 const v=g.view(s,'a'),cmd=g.bot.decide(v,'a');assert.equal(cmd.cardId,'leader-ptolemy');assert.equal(cmd.action,'build');
 const next=g.apply(s,'a',cmd);assert.equal(g.bot.decide(g.view(next,'a'),'a'),null);
});

test('7W AI chooses among legal payment plans without unnecessarily funding a cash-starved neighbor',()=>{
 const s=fixture();s.age=1;s.round=1;s.players[0].wonder='halicarnassus';s.players[0].cards=[];s.players[0].coins=6;s.players[0].hand=['1-stockade'];
 s.players[1].cards=['1-lumber'];s.players[2].cards=['1-lumber'];s.players[1].coins=0;s.players[2].coins=8;
 const v=g.view(s,'a');assert.ok(v.hand[0].build.plans.length>=2);v.hand[0].build.plans.reverse();
 const cmd=g.bot.decide(v,'a');assert.equal(cmd.action,'build');assert.equal(cmd.payment.left,0);assert.equal(cmd.payment.right,2);assert.doesNotThrow(()=>g.apply(s,'a',cmd));
});
