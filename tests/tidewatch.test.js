import test from 'node:test';
import assert from 'node:assert/strict';
import {tidewatch as g} from '../packages/games/tidewatch/legacy.js';
import {ENEMIES,LENGTH,WAVES} from '../packages/games/tidewatch/legacy-catalog.js';
import {RoomService} from '../packages/platform/rooms.js';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {createRegistry} from '../packages/games/registry.js';
function create(ids=['a','b'],options={}){let seed=73;return g.create(ids,options,()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});}
function mob(id=1,sector=0,overrides={}){const b=ENEMIES.slime;return {id,kind:'slime',sector,origin:sector,d:0,hp:b.hp,maxHp:b.hp,speed:b.speed,armor:0,resist:0,bounty:10,slow:1,slowUntil:0,vulnerableUntil:0,burnUntil:0,burnDamage:0,burnOwner:null,crossings:0,...overrides};}
function running(){const s=create();s.phase='combat';s.phaseUntil=40000;s.spawnPlan=[{at:30000,kind:'slime',sector:0}];return s;}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;}

test('Tidewatch validates options and preserves immutable JSON state in commands and ticks',()=>{
 assert.throws(()=>create([],{}));assert.throws(()=>create(['a'],{difficulty:'invalid'}));
 const s=freeze(create()),before=JSON.stringify(s),built=g.apply(s,'a',{type:'build',kind:'arrow',pad:0}),advanced=g.realtime.advance(freeze(built),4);
 assert.equal(JSON.stringify(s),before);assert.equal(advanced.time,200);assert.equal(built.time,0);assert.equal(built.players[0].gold,155);assert.deepEqual(JSON.parse(JSON.stringify(advanced)),advanced);
 assert.throws(()=>g.apply(s,'a',{type:'build',kind:'__proto__',pad:0}));assert.throws(()=>g.apply(s,'a',{type:'build',kind:'arrow',pad:100}));assert.throws(()=>g.apply(s,'x',{type:'ready'}));
});
test('crossing changes the sector without duplicating, healing or deleting a monster',()=>{
 const s=running();s.enemies=[mob(7,0,{d:LENGTH-1,hp:13,slow:.7,slowUntil:3000})];const after=g.realtime.advance(s,1);
 assert.equal(after.enemies.length,1);assert.equal(after.enemies[0].id,7);assert.equal(after.enemies[0].sector,1);assert.equal(after.enemies[0].origin,0);assert.equal(after.enemies[0].hp,13);assert.equal(after.enemies[0].slow,.7);assert.equal(after.players[0].stats.leaks,1);
});
test('shared loss uses strictly greater than the global cap after deaths are resolved',()=>{
 const s=running();s.enemies=Array.from({length:s.cap},(_,i)=>mob(i+1,i%2));assert.equal(g.realtime.advance(s,1).phase,'combat');
 s.enemies.push(mob(999));const lost=g.realtime.advance(s,1);assert.equal(lost.phase,'finished');assert.equal(lost.won,false);
 let defense=running();defense=g.apply(defense,'a',{type:'build',kind:'arrow',pad:0});defense.cap=1;defense.enemies=[mob(1,0,{d:120,hp:1}),mob(2,1)];assert.equal(g.realtime.advance(defense,1).phase,'combat');assert.equal(g.realtime.advance(defense,1).enemies.length,1);
});
test('ownership, sufficient funds, occupied pads, upgrade branch and ultimate wave gates are enforced',()=>{
 let s=g.apply(create(),'a',{type:'build',kind:'arrow',pad:0}),id=s.towers[0].id;
 for(const cmd of [{type:'sell',tower:id},{type:'upgrade',tower:id},{type:'target',tower:id,target:'strong'}])assert.throws(()=>g.apply(s,'b',cmd),{status:403});
 assert.throws(()=>g.apply(s,'a',{type:'build',kind:'mortar',pad:0}));s.players[0].gold=0;assert.throws(()=>g.apply(s,'a',{type:'harbor'}));s.players[0].gold=2000;
 s=g.apply(s,'a',{type:'upgrade',tower:id});assert.throws(()=>g.apply(s,'a',{type:'upgrade',tower:id}));s=g.apply(s,'a',{type:'upgrade',tower:id,branch:'rapid'});assert.throws(()=>g.apply(s,'a',{type:'upgrade',tower:id}));s.wave=10;s=g.apply(s,'a',{type:'upgrade',tower:id});assert.equal(s.towers[0].level,4);assert.throws(()=>g.apply(s,'a',{type:'upgrade',tower:id}));
 const invested=s.towers[0].spent,gold=s.players[0].gold;s=g.apply(s,'a',{type:'sell',tower:id});assert.equal(s.players[0].gold,gold+Math.floor(invested*.7));
});
test('rescue bounty supports both players and does not double count deaths',()=>{
 let s=running();s=g.apply(s,'b',{type:'build',kind:'arrow',pad:0});s.enemies=[mob(1,1,{origin:0,d:120,hp:1})];const gold=s.players.map(p=>p.gold);const next=g.realtime.advance(s,4);
 assert.equal(next.players[0].gold,gold[0]+3);assert.equal(next.players[1].gold,gold[1]+7);assert.equal(next.players[1].stats.rescues,1);assert.equal(next.totalKills,1);
});
test('skills work across sectors, validate coordinates and prevent cooldown reuse',()=>{
 const s=running();s.enemies=[mob(1,1,{d:200,hp:200,maxHp:200})];const n=g.apply(s,'a',{type:'skill',skill:'meteor',sector:1,d:200});assert.ok(n.enemies[0].hp<200);assert.throws(()=>g.apply(n,'a',{type:'skill',skill:'meteor',sector:1,d:200}));assert.throws(()=>g.apply(s,'a',{type:'skill',skill:'meteor',sector:0,d:Infinity}));assert.throws(()=>g.apply(s,'a',{type:'skill',skill:'freeze',sector:9}));
 const f=g.apply(s,'a',{type:'skill',skill:'freeze',sector:1});assert.equal(f.enemies[0].slow,.25);assert.equal(g.realtime.advance(f,20).enemies[0].slow,.25);
});
test('views omit future plans, internal combat state and other players private choices',()=>{
 const s=create();s.players[0].offers=[{wave:5,choices:['haste','power','reach']}];s.players[1].offers=[{wave:5,choices:['spell','fortune','rescue']}];s.enemies=[mob()];const a=g.view(s,'a'),watch=g.spectatorView(s);
 assert.deepEqual(a.self.offers[0].choices,['haste','power','reach']);assert.equal(watch.self,null);
 for(const v of [a,watch]){const text=JSON.stringify(v);for(const key of ['relicPlan','spawnPlan','nextEnemyId','burnOwner','nextShot'])assert.ok(!text.includes(key));assert.ok(!text.includes('"choices":["spell"'));}
 a.players[0].stats.kills=999;assert.equal(s.players[0].stats.kills,0);
});
test('wave economy pays once, delivers choices, and the eighteenth clear ends cooperatively',()=>{
 const s=running();s.wave=5;s.spawnPlan=[];s.phaseUntil=50;const next=g.realtime.advance(s,1);assert.equal(next.wave,6);assert.equal(next.players[0].offers.length,1);const income=next.players[0].gold;assert.equal(g.realtime.advance(next,10).players[0].gold,income);
 const choice=next.players[0].offers[0].choices[0],chosen=g.apply(next,'a',{type:'relic',relic:choice});assert.ok(chosen.players[0].relics.includes(choice));assert.throws(()=>g.apply(chosen,'a',{type:'relic',relic:choice}));
 const final=running();final.wave=WAVES;final.spawnPlan=[];const win=g.realtime.advance(final,1);assert.equal(win.won,true);assert.deepEqual(g.result(win).winners,['a','b']);assert.equal(g.result(win).players[0].rank,1);
});
test('current revision and personal sequence are validated in the same transaction, ticks do not stale independent commands',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,createRegistry([g]));const a=sessions.create('A').user,b=sessions.create('B').user;let r=rooms.createRoom(a,{gameId:'tidewatch',title:'远航'});r=rooms.join(b,r.id);for(const p of [a,b])r=rooms.mutate(p,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(a,r.id,{type:'start',revision:r.revision});const initial=r,other=rooms.snapshot(r.id,b);
 assert.equal(rooms.advanceRealtime(r.id,{revision:r.revision-1,matchId:r.matchId,steps:4}),false);assert.equal(rooms.advanceRealtime(r.id,{revision:r.revision,matchId:'old',steps:4}),false);
 assert.equal(rooms.advanceRealtime(r.id,{revision:r.revision,matchId:r.matchId,steps:4}),true);
 const command={type:'game',command:{type:'build',kind:'arrow',pad:0},revision:initial.revision,matchId:r.matchId,submissionKey:initial.submissionKey};r=rooms.mutate(a,r.id,command);assert.equal(r.game.towers.length,1);assert.throws(()=>rooms.mutate(a,r.id,command),{status:409});
 r=rooms.mutate(b,r.id,{...command,submissionKey:other.submissionKey});assert.equal(r.game.towers.length,2);assert.equal(r.game.self.seq,1);
});
test('no-build play loses and deterministic diversified play can finish a whole normal voyage',()=>{
 for(const mode of ['none','bot']){let s=create(['a']);for(let n=0;n<9000&&!g.isFinished(s);n++){if(mode==='bot'&&n%3===0){const c=g.bot.decide(g.view(s,'a'),'a');if(c)s=g.apply(s,'a',c);}s=g.realtime.advance(s,4);}assert.equal(g.isFinished(s),true);assert.equal(s.won,mode==='bot');if(mode==='bot')assert.equal(s.wave,18);}
});
test('room controls survive simulation ticks but reject a competing control or different match',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,createRegistry([g]));const a=sessions.create('A').user,b=sessions.create('B').user;let r=rooms.createRoom(a,{gameId:'tidewatch',title:'菜单测试'});r=rooms.join(b,r.id);for(const p of [a,b])r=rooms.mutate(p,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(a,r.id,{type:'start',revision:r.revision});
 const before=r;rooms.advanceRealtime(r.id,{revision:r.revision,matchId:r.matchId,steps:4});
 assert.throws(()=>rooms.mutate(a,r.id,{type:'setSpectators',allowSpectators:false,revision:before.revision,controlRevision:before.controlRevision,matchId:'wrong'}),{status:409});
 r=rooms.mutate(a,r.id,{type:'setSpectators',allowSpectators:false,revision:before.revision,controlRevision:before.controlRevision,matchId:r.matchId});assert.equal(r.allowSpectators,false);
 assert.throws(()=>rooms.mutate(a,r.id,{type:'requestDissolve',revision:before.revision,controlRevision:before.controlRevision,matchId:r.matchId}),{status:409});
 const menu=r;rooms.advanceRealtime(r.id,{revision:r.revision,matchId:r.matchId,steps:4});r=rooms.mutate(a,r.id,{type:'requestDissolve',revision:menu.revision,controlRevision:menu.controlRevision,matchId:menu.matchId});assert.ok(r.dissolution);assert.equal(rooms.advanceRealtime(r.id,{revision:r.revision,matchId:r.matchId,steps:4}),false);
});
test('queued relic offers keep three valid unique choices after earlier choices are claimed',()=>{
 let s=create();s.players[0].offers=[{wave:5,choices:['haste','power','reach']},{wave:10,choices:['haste','power','reach']},{wave:15,choices:['haste','power','reach']}];
 for(let i=0;i<3;i++){const choices=g.view(s,'a').self.offers[0].choices;assert.equal(new Set(choices).size,3);assert.ok(choices.every(id=>!s.players[0].relics.includes(id)));s=g.apply(s,'a',{type:'relic',relic:choices[0]});}assert.equal(s.players[0].relics.length,3);
});
test('demolition floors exact seventy-percent value without binary rounding loss',()=>{
 const built=g.apply(create(),'a',{type:'build',kind:'market',pad:0}),sold=g.apply(built,'a',{type:'sell',tower:built.towers[0].id});assert.equal(sold.players[0].gold-built.players[0].gold,63);
});
test('final overtime escalates visibly and cannot stall forever with an unkillable survivor',()=>{
 let s=running();s.wave=18;s.phaseUntil=0;s.spawnPlan=[];s.enemies=[mob(1,0,{hp:1e9,maxHp:1e9})];s.nextEnemyId=2;
 for(let n=0;n<1100&&!g.isFinished(s);n++){s=g.realtime.advance(s,4);if(s.phase!=='finished')s.enemies=s.enemies.filter(e=>e.id===1);}
 assert.equal(s.phase,'finished');assert.equal(s.won,false);assert.ok(s.enemies.length>s.cap);assert.ok(s.time<200000);assert.equal(g.view(s,'a').finalReinforcements,5);
});
