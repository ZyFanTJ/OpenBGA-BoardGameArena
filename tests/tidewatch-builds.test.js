import test from 'node:test';
import assert from 'node:assert/strict';
import {tidewatch as g} from '../packages/games/tidewatch/index.js';
import {tidewatchV2} from '../packages/games/tidewatch/v2-adapter.js';
import {CARDS,RELICS,PADS,ROUTES,routeLength,towerStats,growthCost} from '../packages/games/tidewatch/catalog.js';
import {giveCard} from '../packages/games/tidewatch/draft-state.js';
import {spawn,hurt} from '../packages/games/tidewatch/draft-combat.js';
const create=(ids=['a','b'])=>g.create(ids,{},()=>.32);
function idle(){const s=create();s.phase='combat';s.wave=8;s.phaseUntil=1e9;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];return s;}
function deploy(s,id,kind,pad,extra={}){const p=s.players.find(x=>x.id===id),c=giveCard(s,p,kind,extra);return g.apply(s,id,{type:'deploy',card:c.id,pad});}
function advance(s,ms){for(let n=0;n<ms/50&&!g.isFinished(s);n++)s=g.realtime.advance(s,1);return s;}
function freeze(s){if(s&&typeof s==='object'){Object.freeze(s);Object.values(s).forEach(freeze);}return s;}

test('build edition has distinct routes, 32 typed sites, 24 branching bases and a serializable immutable state',()=>{
 const s=freeze(create());assert.equal(s.version,4);assert.equal(s.players[0].unlocked.length,24);assert.equal(PADS.length,32);assert.equal(Object.keys(CARDS).length,24);assert.ok(Object.values(CARDS).every(c=>c.role&&c.branches.length===2));assert.equal(new Set(Object.keys(ROUTES).map(routeLength)).size,3);const a=g.apply(s,'a',{type:'recruit'});assert.deepEqual(JSON.parse(JSON.stringify(a)),a);assert.equal(s.players[0].freeRecruit,1);assert.deepEqual(g.realtime.advance(freeze(a),4),g.realtime.advance(a,4));
});
test('shorter trading route produces extra wave income and cannot change under resident enemies or during combat',()=>{
 const base=create(),coast=g.apply(base,'a',{type:'route',route:'coast'});for(const s of [base,coast]){s.phase='combat';s.phaseUntil=50;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];}
 const a=g.realtime.advance(base,1),b=g.realtime.advance(coast,1);assert.equal(b.players[0].gold-a.players[0].gold,12);assert.throws(()=>g.apply(coast,'a',{type:'route',route:'reef'}));const occupied=create();spawn(occupied,'slime',0);assert.throws(()=>g.apply(occupied,'a',{type:'route',route:'reef'}));assert.throws(()=>g.apply(create(),'a',{type:'route',route:'__proto__'}));
});
test('crossing uses each island route length without cloning, healing or dropping statuses',()=>{
 let s=idle();s.players[1].route='coast';const e=spawn(s,'slime',0,{d:routeLength('bay')-1,hp:17,wetUntil:10000,burnUntil:0});s=g.realtime.advance(s,1);assert.equal(s.enemies[0].id,e.id);assert.equal(s.enemies[0].sector,1);assert.equal(s.enemies[0].hp,17);assert.equal(s.enemies[0].wetUntil,10000);assert.ok(s.enemies[0].d<10);
});
test('opening land charges exactly once and locked sites cannot be deployed on',()=>{
 let s=create();const p=s.players[0],card=p.inventory[0];assert.throws(()=>g.apply(s,'a',{type:'deploy',card:card.id,pad:15}));const gold=p.gold;s=g.apply(s,'a',{type:'unlockSite',pad:15});assert.equal(s.players[0].gold,gold-35);assert.throws(()=>g.apply(s,'a',{type:'unlockSite',pad:15}));s=g.apply(s,'a',{type:'deploy',card:card.id,pad:15});assert.equal(s.towers[0].pad,15);assert.throws(()=>g.apply(s,'b',{type:'move',tower:card.id,pad:1}));
});
test('migration is paid, preserves attack waiting and changes the actual terrain stats',()=>{
 let s=create();s=deploy(s,'a','gear0',0);s.towers[0].nextShot=5000;const before=towerStats(s.towers[0],s.players[0],s),gold=s.players[0].gold;s=g.apply(s,'a',{type:'move',tower:s.towers[0].id,pad:2});assert.equal(s.players[0].gold,gold-10);assert.equal(s.towers[0].nextShot,5000);assert.ok(towerStats(s.towers[0],s.players[0],s).range>before.range);s.phase='combat';assert.throws(()=>g.apply(s,'a',{type:'move',tower:s.towers[0].id,pad:3}));
});
test('all bases have usable irreversible growth paths independent of rarity and star rank',()=>{
 for(const [kind,d] of Object.entries(CARDS))for(const branch of d.branches){let s=create();s.players[0].gold=2000;const c=giveCard(s,s.players[0],kind);const first=growthCost(c);s=g.apply(s,'a',{type:'grow',card:c.id,branch:branch.id});const item=s.players[0].inventory.find(x=>x.id===c.id);assert.equal(item.baseLevel,2);assert.equal(item.star,1);assert.equal(item.baseSpent,first);assert.throws(()=>g.apply(s,'a',{type:'grow',card:c.id,branch:d.branches.find(x=>x.id!==branch.id).id}));s=g.apply(s,'a',{type:'grow',card:c.id});assert.equal(s.players[0].inventory.find(x=>x.id===c.id).baseLevel,3);assert.throws(()=>g.apply(s,'a',{type:'grow',card:c.id}));}
});
test('rapid and focused growth create different attack cadence instead of just changing names',()=>{
 const s=create(),p=s.players[0],a=towerStats({kind:'gear0',star:1,baseLevel:3,branch:'rapid'},p,s),b=towerStats({kind:'gear0',star:1,baseLevel:3,branch:'focus'},p,s);assert.ok(a.cooldown<b.cooldown);assert.ok(a.damage<b.damage);
});
test('star merging preserves the higher growth investment and rejects conflicting learned paths',()=>{
 let s=create();s.players[0].gold=1000;const a=giveCard(s,s.players[0],'gear0'),b=giveCard(s,s.players[0],'gear0');s=g.apply(s,'a',{type:'grow',card:a.id,branch:'rapid'});s=g.apply(s,'a',{type:'grow',card:a.id});s=g.apply(s,'a',{type:'grow',card:b.id,branch:'focus'});assert.throws(()=>g.apply(s,'a',{type:'merge',cards:[a.id,b.id]}));const other=giveCard(s,s.players[0],'gear0');s=g.apply(s,'a',{type:'merge',cards:[a.id,other.id]});const merged=s.players[0].inventory.find(x=>x.id===a.id);assert.equal(merged.star,2);assert.equal(merged.branch,'rapid');assert.equal(merged.baseLevel,3);
});
test('relay placement strengthens nearby towers and support does not affect another owner',()=>{
 let s=create();s=deploy(s,'a','gear0',0);const base=towerStats(s.towers[0],s.players[0],s).damage;s=deploy(s,'b','gear3',1);assert.equal(towerStats(s.towers[0],s.players[0],s).damage,base);s=deploy(s,'a','gear3',1);assert.ok(towerStats(s.towers[0],s.players[0],s).damage>base);s=g.apply(s,'a',{type:'move',tower:s.towers.at(-1).id,pad:4});assert.equal(towerStats(s.towers[0],s.players[0],s).damage,base);
});
test('four relic slots enforce ownership, compatibility, uniqueness and preparation-only swapping',()=>{
 let s=create();s.players[0].relics=['flywheel','steamheart'];s=g.apply(s,'a',{type:'equipRelic',relic:'flywheel',slot:'engine'});s=g.apply(s,'a',{type:'equipRelic',relic:'flywheel',slot:'finisher'});assert.equal(s.players[0].relicSlots.engine,null);assert.equal(s.players[0].relicSlots.finisher,'flywheel');assert.throws(()=>g.apply(s,'a',{type:'equipRelic',relic:'steamheart',slot:'engine'}));assert.throws(()=>g.apply(s,'a',{type:'equipRelic',relic:'solitary',slot:'core'}));s.phase='combat';assert.throws(()=>g.apply(s,'a',{type:'equipRelic',relic:null,slot:'finisher'}));
});
test('owned but unequipped relics do not affect combat, and overclock has a real range tradeoff',()=>{
 const s=create(),p=s.players[0],c={kind:'gear0',star:1};const base=towerStats(c,p,s);p.relics=['overclock','rails'];assert.equal(towerStats(c,p,s).cooldown,base.cooldown);p.relicSlots.core='overclock';const equipped=towerStats(c,p,s);assert.ok(equipped.cooldown<base.cooldown);assert.ok(equipped.range<base.range);
});
test('steam core turns a wet target into sustained burning while the same relic in link feeds heat',()=>{
 let s=idle();s.players[0].relics=['steamheart'];s.players[0].relicSlots.core='steamheart';s=deploy(s,'a','gear0',0);spawn(s,'slime',0,{d:430,hp:10000,maxHp:10000,speed:0,wetUntil:10000});s=advance(s,600);assert.equal(s.enemies[0].burnOwner,'a');assert.ok(s.enemies[0].burnUntil>s.time);assert.ok(s.players[0].bd.counters.steamheart>0);s.players[0].relicSlots={core:null,engine:null,link:'steamheart',finisher:null};s=advance(s,1000);assert.ok(s.players[0].procs.ember>0);
});
test('flywheel counts six attacks then releases a bounded additional hit',()=>{
 let s=idle();s.players[0].relicSlots.engine='flywheel';s=deploy(s,'a','gear0',0);spawn(s,'slime',0,{d:430,hp:1e7,maxHp:1e7,speed:0});s=advance(s,4100);assert.equal(s.players[0].bd.counters.flywheel,1);assert.ok(s.players[0].bd.hits<6);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
});
test('rescue pact rewards crossing targets but sacrifices damage against fresh spawns',()=>{
 const s=idle();s.players[0].relicSlots.core='tidalbond';const a=spawn(s,'slime',0,{hp:1000,armor:0}),b=spawn(s,'slime',0,{hp:1000,armor:0,crossings:1});hurt(s,a,100,'physical','a',true);hurt(s,b,100,'physical','a',true);assert.equal(a.hp,910);assert.equal(b.hp,840);
});
test('old draft saves finish with v2 rules after a non-destructive version 4 migration',()=>{
 const old=tidewatchV2.create(['a'],{},()=>.3),before=structuredClone(old),next=g.migrate(old,2);assert.equal(next.version,4);assert.equal(next.mode,'draft-v2');assert.equal(g.view(next,'a').version,2);assert.deepEqual(old,before);const result=g.apply(next,'a',{type:'recruit'});assert.equal(g.view(result,'a').self.inventory.length,3);assert.equal(g.create(['a']).version,4);
});
test('new private views expose growth choices but never random state, other hands or shot timers',()=>{
 let s=create();s=deploy(s,'a','tide0',0,{baseLevel:2,branch:'focus',baseSpent:30});const v=g.view(s,'a'),watch=g.spectatorView(s);assert.equal(v.version,4);assert.equal(v.towers[0].baseLevel,2);assert.equal(watch.self,null);assert.equal(watch.towers[0].baseSpent,undefined);for(const bad of ['randomState','nextShot','spawnPlan','bd'])assert.ok(!Object.hasOwn(v,bad));assert.equal(v.players[1].inventory,undefined);assert.ok(Object.values(RELICS).every(r=>r.slots.length));
});

test('mine support and developed-land tax add real wave income without creating kill drops',()=>{
 let s=create();s=deploy(s,'a','ember1',9);s=g.apply(s,'a',{type:'unlockSite',pad:15});s.players[0].relicSlots.engine='treasurymark';const gold=s.players[0].gold;s.phase='combat';s.phaseUntil=50;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];s=g.realtime.advance(s,1);assert.equal(s.players[0].gold-gold,62+6+4);assert.equal(s.players[0].stats.kills,0);
});
test('overclock supply pays extra income while increasing skill cooldown',()=>{
 let s=idle();s.players[0].relicSlots.engine='overclock';spawn(s,'slime',0,{speed:0,hp:10000});s=g.apply(s,'a',{type:'skill',skill:'freeze',sector:0});assert.equal(s.players[0].skillReady.freeze,57000);
});
test('isolated cannon loses its lens damage bonus when another main attacker is placed nearby',()=>{
 let s=create();s.players[0].relicSlots.core='solitary';s=deploy(s,'a','gear0',0);const solo=towerStats(s.towers[0],s.players[0],s).damage;s=deploy(s,'a','tide0',1);assert.ok(towerStats(s.towers[0],s.players[0],s).damage<solo);
});

test('multi-faction combat with growth, four relic slots and derived effects stays bounded and finite',()=>{
 let s=g.create(['a','b','c','d'],{},()=>.2);s.phase='combat';s.wave=14;s.cap=1000;s.phaseUntil=1e9;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];
 for(const id of s.players.map(p=>p.id)){let p=s.players.find(p=>p.id===id);p.inventory=[];p.relicSlots={core:'steamheart',engine:'flywheel',link:'prismhub',finisher:'funeralspark'};for(let i=0;i<6;i++)s=deploy(s,id,p.faction+i,[0,1,2,3,4,5][i],{star:2,baseLevel:2,branch:CARDS[p.faction+i].branches[0].id});}
 for(const p of s.players)for(let i=0;i<25;i++)spawn(s,'slime',p.sector,{d:70+i*110,hp:1e6,maxHp:1e6,speed:0});s=advance(s,12000);assert.ok(s.players.every(p=>Number.isFinite(p.stats.damage)));assert.ok(s.players.some(p=>p.bd.counters.flywheel>0));assert.ok(s.events.length<=160&&s.zones.length<=32&&s.echoes.length<=32);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
});


test('a fully cleared wave immediately enters preparation and all players can ready the next wave',()=>{
 let s=idle();s.spawnPlan=[];s.spawnCursor=0;s.time=5000;const before=structuredClone(s),gold=s.players[0].gold;
 s=g.realtime.advance(freeze(s),1);assert.equal(before.wave,8);assert.equal(s.wave,9);assert.equal(s.phase,'prepare');assert.equal(s.time,5050);assert.ok(s.players[0].gold>gold);const earned=s.players[0].gold;
 s=g.realtime.advance(s,1);assert.equal(s.players[0].gold,earned);s=g.apply(s,'a',{type:'ready'});assert.equal(s.phase,'prepare');s=g.apply(s,'b',{type:'ready'});assert.equal(s.phase,'combat');assert.equal(s.wave,9);assert.equal(s.waveStartedAt,5100);assert.equal(s.players[0].gold,earned);
});
test('early clearing waits for scheduled spawns, all islands, and pending bounty arrivals',()=>{
 const future=idle();assert.equal(g.realtime.advance(future,1).wave,8);
 const occupied=idle();occupied.spawnPlan=[];spawn(occupied,'slime',1,{speed:0});assert.equal(g.realtime.advance(occupied,1).wave,8);
 let warning=idle();warning.spawnPlan=[];warning=g.apply(warning,'a',{type:'signBounty',kind:'gold',reward:'gold'});const next=g.realtime.advance(warning,1);assert.equal(next.wave,8);assert.equal(next.phase,'combat');assert.equal(next.bounties[0].status,'warning');
});
test('clearing the final wave wins without an extra wave or repeated income',()=>{
 let s=idle();s.wave=18;s.spawnPlan=[];const gold=s.players[0].gold;s=g.realtime.advance(s,1);assert.equal(s.phase,'finished');assert.equal(s.wave,18);assert.equal(s.won,true);assert.equal(s.players[0].gold,gold);assert.deepEqual(g.realtime.advance(freeze(s),1),s);
});
test('version 3 migration adds free infill sites while preserving towers, purchased land, and private progress',()=>{
 let old=create();old=deploy(old,'a','gear0',0);old.version=3;for(const p of old.players)p.unlocked=p.unlocked.filter(id=>id<16);old.players[0].unlocked.push(12);old.players[0].pity.miss[2]=7;const before=structuredClone(old),next=g.migrate(freeze(old),3);
 assert.equal(next.version,4);assert.deepEqual(old,before);assert.deepEqual(next.towers,before.towers);assert.equal(next.players[0].unlocked.length,25);assert.ok(next.players[0].unlocked.includes(12));assert.ok(next.players[0].unlocked.includes(16));assert.ok(!next.players[0].unlocked.includes(17));assert.equal(next.players[0].pity.miss[2],7);assert.deepEqual(g.migrate(next,4),next);assert.equal(g.view(next,'a').version,4);
 const classic={version:3,mode:'classic',players:[{id:'a'}]};assert.deepEqual(g.migrate(classic,3),{...classic,version:4});
});
test('new free and paid sites accept buildings without renumbering the original sites',()=>{
 let s=create();const a=giveCard(s,s.players[0],'gear0'),b=giveCard(s,s.players[0],'gear1');assert.equal(PADS[4].x,830);assert.equal(PADS[12].cost,55);s=g.apply(s,'a',{type:'deploy',card:a.id,pad:16});assert.throws(()=>g.apply(s,'a',{type:'deploy',card:b.id,pad:17}));s=g.apply(s,'a',{type:'unlockSite',pad:17});s=g.apply(s,'a',{type:'deploy',card:b.id,pad:17});assert.equal(s.towers.at(-1).pad,17);
});
