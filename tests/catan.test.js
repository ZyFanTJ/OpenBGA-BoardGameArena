import test from 'node:test';
import assert from 'node:assert/strict';
import {catan} from '../packages/games/catan/index.js';
import {longestRoad,empty,resources} from '../packages/games/catan/board.js';
import {games} from '../packages/games/registry.js';
import {JsonStore} from '../packages/platform/store.js';
import {RoomService} from '../packages/platform/rooms.js';
import {createCatanRenderer} from '../apps/web/games/catan/index.js';
const ids=['a','b','c'],create=()=>catan.create(ids,{},()=>.3),act=(s,c,id=s.players[s.turn].id,random=()=>.2)=>catan.apply(s,id,c,{random});
function setup(){let s=create();while(s.phase.startsWith('setup')){const id=s.players[s.turn].id;s=act(s,catan.bot.decide(catan.view(s,id),id));}return s;}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
test('Catan topology, resources, ports, deck, private views and JSON roundtrip',()=>{
 const s=create();assert.equal(s.board.tiles.length,19);assert.equal(s.board.vertices.length,54);assert.equal(s.board.edges.length,72);assert.equal(s.board.ports.length,9);assert.equal(new Set(s.board.ports.flatMap(p=>p.vertices)).size,18);assert.equal(s.deck.length,25);
 assert.deepEqual(JSON.parse(JSON.stringify(s)),s);for(const id of [...ids,'spectator']){const v=catan.view(s,id);assert.ok(!('deck'in v));assert.ok(v.players.every(p=>!('hand'in p)&&!('dev'in p)));}
 assert.throws(()=>catan.create(['a','b'],{},()=>0));assert.throws(()=>catan.create(ids,{friendlyRobber:true},()=>0));
 for(let seed=1;seed<=50;seed++){let n=seed;const x=catan.create(ids,{},()=>((n=n*16807%2147483647)-1)/2147483646);assert.ok(x.board.edges.every(e=>e.tiles.length!==2||!e.tiles.every(i=>[6,8].includes(x.board.tiles[i].number))));}
});
test('snake setup, initial resources, legality, immutability and city cost',()=>{
 let s=create(),order=[];for(let i=0;i<12;i++){const id=s.players[s.turn].id;if(s.phase==='setupSettlement')order.push(id);const v=catan.view(s,id),c=catan.bot.decide(v,id);const before=JSON.stringify(s);s=act(freeze(s),c);assert.equal(before,JSON.stringify(JSON.parse(before)));}
 assert.deepEqual(order,['a','b','c','c','b','a']);assert.equal(s.phase,'roll');assert.ok(s.players.every(p=>Object.values(p.hand).reduce((a,b)=>a+b,0)>0));assert.throws(()=>act(s,{type:'roll'},'b'));
 s=act(s,{type:'roll'});s.players[0].hand={...empty(),grain:2,ore:3};const at=s.board.vertices.find(v=>v.owner==='a').id;s=act(s,{type:'build',kind:'city',at});assert.ok(s.board.vertices[at].city);assert.equal(s.players[0].hand.ore,0);assert.throws(()=>act(s,{type:'build',kind:'settlement',at}));
});
test('seven discards are private and block robber until everyone has discarded',()=>{
 let s=setup();s.players[0].hand={...empty(),wood:9};s.players[1].hand={...empty(),ore:8};let dice=[0,.99];s=act(s,{type:'roll'},'a',()=>dice.shift());assert.equal(s.phase,'discard');assert.equal(s.discard.a,4);assert.equal(s.discard.b,4);assert.throws(()=>act(s,{type:'robber',tile:0}));assert.throws(()=>act(s,{type:'discard',cards:{wood:3}}));
 s=act(s,{type:'discard',cards:{wood:4}});s=act(s,{type:'discard',cards:{ore:4}},'b');assert.equal(s.phase,'robber');assert.throws(()=>act(s,{type:'robber',tile:s.robber}));s=act(s,{type:'robber',tile:(s.robber+1)%19});if(s.phase==='steal'){const v=catan.view(s,'a');s=act(s,{type:'steal',target:v.legal.victims[0]});}assert.equal(s.phase,'action');
});
test('production doubles cities, blocks robber and handles single/multiple claimant shortages',()=>{
 let s=setup();s.board.vertices.forEach(v=>{v.owner=null;v.city=false;});const t=s.board.tiles.find(t=>t.type!=='desert');s.board.tiles.forEach(t=>{if(t.type!=='desert')t.number=12;});t.number=2;s.robber=s.board.tiles.find(x=>x.type==='desert').id;s.board.vertices[t.vertices[0]].owner='a';s.board.vertices[t.vertices[0]].city=true;s.players.forEach(p=>p.hand=empty());s.bank[t.type]=1;
 let x=act(s,{type:'roll'},'a',()=>0);assert.equal(x.players[0].hand[t.type],1);
 s.board.vertices[t.vertices[2]].owner='b';x=act(s,{type:'roll'},'a',()=>0);assert.equal(x.players[0].hand[t.type],0);assert.equal(x.players[1].hand[t.type],0);
 s.bank[t.type]=19;s.robber=t.id;x=act(s,{type:'roll'},'a',()=>0);assert.equal(x.players[0].hand[t.type],0);
});
test('domestic trade checks both holdings, current player and does not expose cards',()=>{
 let s=setup();s.phase='action';s.players[0].hand={...empty(),wood:3};s.players[1].hand={...empty(),ore:2};s=act(s,{type:'offer',give:{ore:2},want:{wood:3}},'b');assert.throws(()=>act(s,{type:'accept'},'c'));s=act(s,{type:'accept'});assert.equal(s.players[0].hand.ore,2);assert.equal(s.players[1].hand.wood,3);assert.equal(s.offer,null);assert.throws(()=>act(s,{type:'offer',give:{ore:1},want:{ore:1}}));assert.throws(()=>act(s,{type:'offer',give:{ore:-1},want:{wood:1}}));
 const v=catan.view(s,'c');assert.ok(v.players.every(p=>!p.hand));
});
test('development ages, one per turn, pre-roll knight and victory points',()=>{
 let s=setup();s.phase='action';s.players[0].hand=empty(5);s.deck=['point'];s=act(s,{type:'buy'});assert.equal(catan.view(s,'a').players[0].score,3);assert.equal(catan.view(s,'b').players[0].score,2);
 s.players[0].dev.push({type:'knight',bought:s.turnNumber});assert.throws(()=>act(s,{type:'play',card:'knight'}));s.players[0].dev.at(-1).bought=0;s.phase='roll';s=act(s,{type:'play',card:'knight'});assert.equal(s.phase,'robber');s=act(s,{type:'robber',tile:(s.robber+1)%19});if(s.phase==='steal')s=act(s,{type:'steal',target:catan.view(s,'a').legal.victims[0]});assert.equal(s.phase,'roll');assert.throws(()=>act(s,{type:'play',card:'knight'}));
 s.phase='action';s.players[0].dev=Array.from({length:8},()=>({type:'point',bought:s.turnNumber}));s.players[0].hand=empty(5);s.deck=['point'];s=act(s,{type:'buy'});assert.equal(s.phase,'finished');assert.equal(s.winner,'a');
});
test('longest road traverses edges once and stops at opponent buildings',()=>{
 const board={vertices:Array.from({length:7},(_,id)=>({id,edges:[],owner:null})),edges:[]};for(let i=0;i<6;i++){board.edges.push({ends:[i,i+1],owner:'a'});board.vertices[i].edges.push(i);board.vertices[i+1].edges.push(i);}assert.equal(longestRoad(board,'a'),6);board.vertices[3].owner='b';assert.equal(longestRoad(board,'a'),3);
});
test('ports apply only to their owners and bank trades remain atomic on shortage',()=>{
 let s=setup();s.phase='action';s.board.vertices.forEach(v=>v.owner=null);const port=s.board.ports.find(p=>p.type==='wood');s.board.vertices[port.vertices[0]].owner='a';s.players[0].hand={...empty(),wood:2};assert.equal(catan.view(s,'a').rates.wood,2);assert.equal(catan.view(s,'b').rates.wood,4);s.bank.ore=0;const before=JSON.stringify(s);assert.throws(()=>act(s,{type:'bank',give:'wood',want:'ore'}));assert.equal(JSON.stringify(s),before);s.bank.ore=1;s=act(s,{type:'bank',give:'wood',want:'ore'});assert.equal(s.players[0].hand.wood,0);assert.equal(s.players[0].hand.ore,1);
});
test('plenty, monopoly, free roads and largest army honor card limits and timing',()=>{
 const withCard=card=>{const s=setup();s.phase='action';s.players[0].dev=[{type:card,bought:0}];return s;};
 let s=withCard('plenty');s.bank.ore=0;assert.throws(()=>act(s,{type:'play',card:'plenty',cards:{ore:2}}));const n=s.players[0].hand.wood;s=act(s,{type:'play',card:'plenty',cards:{wood:2}});assert.equal(s.players[0].hand.wood,n+2);assert.equal(s.players[0].dev.length,0);
 s=withCard('monopoly');s.players[0].hand.ore=0;s.players[1].hand.ore=4;s.players[2].hand.ore=2;s=act(s,{type:'play',card:'monopoly',resource:'ore'});assert.equal(s.players[0].hand.ore,6);assert.equal(s.players[1].hand.ore,0);
 s=withCard('roads');const hand=structuredClone(s.players[0].hand);s=act(s,{type:'play',card:'roads'});for(let i=0;i<2;i++)s=act(s,{type:'build',kind:'road',at:catan.view(s,'a').legal.road[0]});assert.equal(s.phase,'action');assert.deepEqual(s.players[0].hand,hand);
 s=withCard('knight');s.players[0].knights=2;s=act(s,{type:'play',card:'knight'});assert.equal(s.army,'a');assert.equal(catan.view(s,'a').players[0].score,4);
});
test('AI can accept affordable offers from the current player without private opponent hands',()=>{
 let s=setup();s.phase='action';s.players[0].hand={...empty(),wood:1};s.players[1].hand={...empty(),ore:1};s=act(s,{type:'offer',give:{wood:1},want:{ore:1}});const c=catan.bot.decide(catan.view(s,'b'),'b');assert.deepEqual(c,{type:'accept'});s=act(s,c,'b');assert.equal(s.players[1].hand.wood,1);
});
test('platform registration, transaction revisions and renderer escaping',()=>{
 const store=new JsonStore(),rooms=new RoomService(store,games,{random:()=>.3}),users=ids.map(id=>({id,name:id==='a'?'<img onerror=alert(1)>':id}));let r=rooms.createRoom(users[0],{gameId:'catan',title:'Test'});for(const u of users.slice(1))r=rooms.join(u,r.id);for(const u of users)r=rooms.mutate(u,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(users[0],r.id,{type:'start',revision:r.revision});const revision=r.revision;const c={type:'build',kind:'settlement',at:r.game.legal.settlement[0]};r=rooms.mutate(users[0],r.id,{type:'game',command:c,revision});assert.throws(()=>rooms.mutate(users[0],r.id,{type:'game',command:c,revision}),{status:409});const html=createCatanRenderer(()=>{},()=>{}).render(r,users[0]);assert.ok(!html.includes('<img onerror'));assert.ok(html.includes('我的资源'));assert.ok(html.includes('ct-board'));
});
test('AI completes seeded games using only player-specific views and conserves resources',()=>{
 for(let seed=1;seed<=4;seed++){let n=seed;const random=()=>((n=n*16807%2147483647)-1)/2147483646;let s=catan.create(seed%2?ids:[...ids,'d'],{},random);for(let i=0;i<9000&&!catan.isFinished(s);i++){const id=Object.keys(s.discard)[0]??s.players[s.turn].id,c=catan.bot.decide(catan.view(s,id),id);assert.ok(c,`${s.phase} needs command`);s=catan.apply(s,id,c,{random});for(const r of resources)assert.equal(s.bank[r]+s.players.reduce((a,p)=>a+p.hand[r],0),19);}assert.equal(s.phase,'finished');assert.ok(catan.result(s).players.find(p=>p.id===s.winner).score>=10);}
});
