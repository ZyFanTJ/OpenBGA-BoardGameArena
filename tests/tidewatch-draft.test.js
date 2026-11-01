import test from 'node:test';
import assert from 'node:assert/strict';
import {tidewatchV2 as g} from '../packages/games/tidewatch/v2-adapter.js';
import {tidewatch as current} from '../packages/games/tidewatch/index.js';
import {tidewatch as legacy} from '../packages/games/tidewatch/legacy.js';
import {CARDS,ENEMIES,RECIPES,LENGTH,traits} from '../packages/games/tidewatch/v2-catalog.js';
import {giveCard,makeOffer,craftPlan} from '../packages/games/tidewatch/v2-state.js';
import {spawn} from '../packages/games/tidewatch/v2-combat.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SessionService} from '../packages/platform/sessions.js';
import {JsonStore} from '../packages/platform/store.js';
import {createRegistry} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {mkdirSync,mkdtempSync} from 'node:fs';
const create=(ids=['a','b'])=>g.create(ids,{},()=>.321);
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;}
function advance(s,ms){for(let i=0;i<ms/50&&!g.isFinished(s);i++)s=g.realtime.advance(s,1);return s;}
function idle(wave=8,ids=['a','b']){const s=create(ids);s.wave=wave;s.phase='combat';s.phaseUntil=1e9;s.waveStartedAt=s.time;s.spawnPlan=[{at:1e9,kind:'slime',sector:0}];return s;}
function deploy(s,id,kind,pad,star=1){const p=s.players.find(p=>p.id===id),card=giveCard(s,p,kind,{star});return g.apply(s,id,{type:'deploy',card:card.id,pad});}

test('draft transitions are deterministic, immutable and JSON serializable',()=>{
 const s=freeze(create()),before=JSON.stringify(s),a=g.apply(s,'a',{type:'recruit'}),b=g.apply(s,'a',{type:'recruit'});assert.deepEqual(a,b);assert.equal(JSON.stringify(s),before);assert.equal(a.version,2);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);assert.equal(a.players[0].freeRecruit,0);assert.equal(a.players[0].gold,120);assert.throws(()=>g.apply(s,'a',{type:'starter',faction:'__proto__'}));
 const next=g.realtime.advance(freeze(a),20);assert.deepEqual(JSON.parse(JSON.stringify(next)),next);assert.equal(a.time,0);
});
test('recycling a starter cannot reopen faction selection to generate unlimited cards or gold',()=>{
 const s=create(),card=s.players[0].inventory[0],next=g.apply(s,'a',{type:'recycle',card:card.id});assert.equal(next.players[0].started,true);assert.throws(()=>g.apply(next,'a',{type:'starter',faction:'ember'}));assert.equal(next.players[0].inventory.length,1);assert.equal(s.players[0].gold,120);
});
test('recruitment charges once, gates levels and cannot bank full inventory free draws at a higher level',()=>{
 let s=create(),p=s.players[0];s=g.apply(s,'a',{type:'recruitLevel'});assert.equal(s.players[0].gold,40);assert.throws(()=>g.apply(s,'a',{type:'recruitLevel'}));s=g.apply(s,'a',{type:'recruit'});s=g.apply(s,'a',{type:'recruit'});assert.equal(s.players[0].gold,0);assert.throws(()=>g.apply(s,'a',{type:'recruit'}));
 s=idle(1);p=s.players[0];while(p.inventory.length<8)giveCard(s,p,'tide0');s.phaseUntil=50;s=advance(s,50);assert.equal(s.players[0].pending.length,1);assert.equal(s.players[0].freeRecruit,1);assert.throws(()=>g.apply(s,'a',{type:'recruit'}));
});
test('quality guarantees promote eligible draws and do not expose or consume another player random plan',()=>{
 for(const [level,tier,miss,orange] of [[2,1,3,false],[3,2,7,false],[5,3,11,false],[5,3,19,true]]){let s=create(),p=s.players[0];p.recruitLevel=level;p.pity.miss[tier]=miss;p.pity.obtainedOrange=orange;s=g.apply(s,'a',{type:'recruit'});const last=s.players[0].inventory.at(-1);assert.ok(CARDS[last.kind].rarity>=tier);assert.equal(s.players[1].freeRecruit,1);}
});
test('views and spectator snapshots omit random state, private hands, offers and bounty candidates',()=>{
 const s=idle(10);giveCard(s,s.players[1],'ember5');makeOffer(s,s.players[1],'bountyCard',['ember4','star4']);const v=g.view(s,'a'),watch=g.spectatorView(s);assert.equal(watch.self,null);for(const x of [v,watch]){const text=JSON.stringify(x);for(const key of ['randomState','spawnPlan','nextCardId','guardQueue','nextShot'])assert.ok(!text.includes(key));assert.ok(!text.includes('"choices":["ember4"'));assert.equal(x.players[1].inventory,undefined);}v.self.inventory[0].kind='gear5';assert.equal(s.players[0].inventory[0].kind,'tide0');
});
test('merge preserves received lineage, ownership, pad and attack wait; locked cards cannot be consumed',()=>{
 let s=create();s=deploy(s,'a','tide0',0);const p=s.players[0],first=s.towers[0],second=giveCard(s,p,'tide0',{received:true});first.nextShot=5000;
 s=g.apply(s,'a',{type:'merge',cards:[first.id,second.id]});assert.equal(s.towers[0].star,2);assert.equal(s.towers[0].received,true);assert.equal(s.towers[0].nextShot,5000);assert.equal(s.towers[0].pad,0);assert.throws(()=>g.apply(s,'b',{type:'merge',cards:[first.id,second.id]}));
 const x=giveCard(s,s.players[0],'gear0',{locked:true}),y=giveCard(s,s.players[0],'gear0');assert.throws(()=>g.apply(s,'a',{type:'merge',cards:[x.id,y.id]}));
});
test('evolution consumes exact copies, returns surplus with lineage and respects capacity',()=>{
 let s=idle(8),p=s.players[0];p.inventory=[];p.cores=1;s=deploy(s,'a','gear4',0,2);const second=giveCard(s,s.players[0],'gear3',{star:2,received:true}),recipe=RECIPES.find(r=>r.id==='gear5'),plan=craftPlan(s,s.players[0],recipe);
 s=g.apply(s,'a',{type:'craft',recipe:'gear5',materials:plan.map(x=>x.id)});assert.equal(s.towers[0].kind,'gear5');assert.equal(s.towers[0].received,true);assert.equal(s.players[0].cores,0);assert.equal(s.players[0].inventory.length,1);assert.equal(s.players[0].inventory[0].kind,'gear4');assert.equal(s.players[0].inventory[0].star,1);assert.equal(s.players[0].inventory[0].received,true);assert.equal(traits(s.towers,'a').gear,2);assert.ok(!s.players[0].inventory.some(x=>x.id===second.id));
});
test('deployment obeys ownership, command points, occupied pads and two legendary cap',()=>{
 let s=create();s=deploy(s,'a','tide5',0);s=deploy(s,'a','gear5',1);const third=giveCard(s,s.players[0],'star5');assert.throws(()=>g.apply(s,'a',{type:'deploy',card:third.id,pad:2}));assert.throws(()=>g.apply(s,'b',{type:'deploy',card:third.id,pad:2}));assert.throws(()=>g.apply(s,'a',{type:'deploy',card:third.id,pad:0}));
});
test('gift reservations expire, acceptance is atomic and transferred descendants cannot travel again',()=>{
 let s=idle(2),p=s.players[0];p.shipping=2;s.players[1].shipping=2;const c=p.inventory[0];s=g.apply(s,'a',{type:'gift',card:c.id,to:'b'});const gift=s.gifts[0].id;assert.equal(s.players[0].shipping,1);assert.equal(s.players[1].receiving,1);assert.throws(()=>g.apply(s,'a',{type:'recycle',card:c.id}));s=g.apply(s,'b',{type:'acceptGift',gift});assert.equal(s.gifts.length,0);assert.equal(s.players[1].inventory.find(x=>x.id===c.id).received,true);assert.throws(()=>g.apply(s,'b',{type:'gift',card:c.id,to:'a'}));assert.throws(()=>g.apply(s,'b',{type:'acceptGift',gift}));
 const other=s.players[0].inventory[0];s=g.apply(s,'a',{type:'gift',card:other.id,to:'b'});s=advance(s,30000);assert.equal(s.gifts.length,0);assert.equal(s.players[0].shipping,1);assert.equal(s.players[1].receiving,1);assert.equal(s.players[0].inventory[0].gift,undefined);
});
test('shared cap stays strictly greater after death cleanup and crossing retains identity and statuses',()=>{
 let s=idle(3);const e=spawn(s,'slime',0,{d:LENGTH-1,hp:13,wetUntil:5000,burnUntil:0,markUntil:5000,markOwner:'a',markHits:[{id:7,at:0}]});s.players[0].relics=['starline'];s=g.realtime.advance(s,1);assert.equal(s.enemies[0].id,e.id);assert.equal(s.enemies[0].sector,1);assert.equal(s.enemies[0].hp,13);assert.equal(s.enemies[0].wetUntil,5000);assert.equal(s.enemies[0].markHits.length,1);
 s=idle(1);s.cap=1;spawn(s,'slime',0);assert.equal(g.realtime.advance(s,1).phase,'combat');spawn(s,'slime',1);assert.equal(g.realtime.advance(s,1).won,false);
 s=idle(1);s.cap=1;s=deploy(s,'a','tide0',0);spawn(s,'slime',0,{d:120,hp:1});spawn(s,'slime',1);assert.equal(g.realtime.advance(s,20).phase,'finished');s.towers[0].nextShot=0;const saved=g.realtime.advance(s,1);assert.equal(saved.phase,'combat');assert.equal(saved.enemies.length,1);
});
test('bounty warns, can cancel early, freezes terms and does not reward signing',()=>{
 let s=idle(10);const before=s.players[0].gold;s=g.apply(s,'a',{type:'signBounty',kind:'ancient',reward:'core'});assert.equal(s.enemies.length,0);assert.equal(s.players[0].gold,before-60);assert.equal(s.players[0].cores,0);assert.equal(s.players[0].bountiesUsed,0);const id=s.bounties[0].id;s=g.apply(s,'a',{type:'cancelBounty',bounty:id});assert.equal(s.players[0].gold,before);assert.throws(()=>g.apply(s,'a',{type:'signBounty',kind:'gold',reward:'gold'}));
 s=idle(10);s=g.apply(s,'a',{type:'signBounty',kind:'ancient',reward:'core'});const hp=s.bounties[0].hp;s.wave=11;s=advance(s,8000);assert.equal(s.enemies.find(e=>e.bounty).maxHp,hp);assert.equal(s.players[0].bountiesUsed,1);assert.equal(s.players[0].cores,0);
});
test('bounty first crossing loses deposit once and timeout leaves an enraged spawning enemy',()=>{
 let s=idle(10);s=g.apply(s,'a',{type:'signBounty',kind:'ancient',reward:'core'});s=advance(s,8000);let b=s.bounties[0],boss=s.enemies.find(e=>e.bounty);boss.d=LENGTH-1;s=g.realtime.advance(s,1);assert.equal(s.bounties[0].depositLost,true);assert.equal(s.enemies.find(e=>e.bounty).sector,1);const gold=s.players[0].gold;assert.ok(s.bounties[0].guardQueue.length>0);s.bounties[0].deadline=s.time+50;s=g.realtime.advance(s,1);assert.equal(s.bounties[0].status,'failed');assert.ok(s.enemies.find(e=>e.bounty).speed>ENEMIES.ancient.speed);assert.equal(s.players[0].gold,gold);const count=s.enemies.length;s=advance(s,5000);assert.ok(s.enemies.length>count);assert.equal(s.players[0].cores,0);
});
test('bounty reward belongs to summoner, teammates share a fixed pool and a kill cannot pay twice',()=>{
 let s=idle(4,['a','b','c','d']);s=g.apply(s,'a',{type:'signBounty',kind:'gold',reward:'gold'});s=advance(s,8000);const b=s.bounties[0],body=s.enemies.find(e=>e.id===b.enemy);body.hp=1;const old=s.players.map(p=>p.gold);s=g.apply(s,'d',{type:'skill',skill:'meteor',sector:body.sector,d:body.d});assert.equal(s.bounties[0].success,true);assert.equal(s.players[0].gold-old[0],100);assert.equal(s.players.slice(1).reduce((n,p,i)=>n+p.gold-old[i+1],0),20);const after=s.players.map(p=>p.gold);s=g.realtime.advance(s,10);assert.deepEqual(s.players.map(p=>p.gold),after);assert.equal(s.players[0].stats.bounties,1);
});
test('four faction effects run in bounded serializable combat and temporary turrets expire with parents',()=>{
 let s=idle(14,['a','b','c','d']);s.cap=1000;
 for(const p of s.players){p.inventory=[];for(const [i,slot] of [0,1,2,3,5].entries())s=deploy(s,p.id,p.faction+slot,i);}
 for(const p of s.players)for(let i=0;i<14;i++)spawn(s,'slime',p.sector,{d:120+i*5,hp:5000,maxHp:5000});s=advance(s,12000);assert.ok(s.events.some(e=>e.type==='proc'));assert.ok(s.events.some(e=>e.type==='volley'));assert.ok(s.zones.length<=32);assert.ok(s.towers.filter(t=>t.temporary).length<=4);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);assert.ok(s.players.every(p=>Number.isFinite(p.stats.damage)));
});
test('assembled turrets survive volley processing with finite damage and disappear when their parent is recycled',()=>{
 let s=idle(14);s.cap=1000;for(let i=0;i<6;i++)s=deploy(s,'a','gear'+i,i===4?0:i+1);spawn(s,'slime',0,{d:120,hp:1e7,maxHp:1e7,speed:0});s=advance(s,12000);const child=s.towers.find(t=>t.temporary);assert.ok(child);assert.ok(s.players.every(p=>Number.isFinite(p.stats.damage)));const parent=child.parent;s=g.apply(s,'a',{type:'recycle',card:parent});assert.ok(!s.towers.some(t=>t.parent===parent));
});
test('migration preserves active classic matches and server bootstrap persists the new version',async t=>{
 const old=legacy.create(['a'],{},()=>.2),migrated=current.migrate(old,1);assert.equal(migrated.version,4);assert.equal(migrated.mode,'classic');assert.equal(current.view(migrated,'a').version,1);assert.equal(g.create(['a']).mode,'draft');const built=current.apply(migrated,'a',{type:'build',kind:'arrow',pad:0});assert.equal(built.towers[0].kind,'arrow');assert.equal(old.towers.length,0);
 const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,createRegistry([legacy])),u=sessions.create('A').user;let r=rooms.createRoom(u,{gameId:'tidewatch',title:'Legacy'});r=rooms.mutate(u,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(u,r.id,{type:'start',revision:r.revision});const app=createApp({store,registry:createRegistry([current])});t.after(()=>app.closeStreams());assert.equal(store.data.rooms[r.id].stateVersion,4);assert.equal(store.data.rooms[r.id].game.mode,'classic');assert.equal(app.service.snapshot(r.id,u).game.version,1);
});
test('new game commands retain revision and sequence idempotency across simulation ticks',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,createRegistry([g])),u=sessions.create('A').user;let r=rooms.createRoom(u,{gameId:'tidewatch',title:'Draft'});r=rooms.mutate(u,r.id,{type:'ready',ready:true,revision:r.revision});r=rooms.mutate(u,r.id,{type:'start',revision:r.revision});const c={type:'game',command:{type:'recruit'},revision:r.revision,matchId:r.matchId,submissionKey:r.submissionKey};rooms.advanceRealtime(r.id,{revision:r.revision,matchId:r.matchId,steps:4});r=rooms.mutate(u,r.id,c);assert.equal(r.game.self.inventory.length,3);assert.throws(()=>rooms.mutate(u,r.id,c),{status:409});assert.equal(rooms.snapshot(r.id,u).game.self.inventory.length,3);
});

test('SQLite restart preserves private inventory, pity, reserved gifts and bounty warning with the same submission sequence',()=>{
 mkdirSync('work/tidewatch-v2',{recursive:true});const path=mkdtempSync('work/tidewatch-v2/restart-')+'/game.sqlite';let store=new SqliteStore(path);const sessions=new SessionService(store),rooms=new RoomService(store,createRegistry([g])),a=sessions.create('A').user,b=sessions.create('B').user;
 let room=rooms.createRoom(a,{gameId:'tidewatch',title:'Restart'});room=rooms.join(b,room.id);for(const u of [a,b])room=rooms.mutate(u,room.id,{type:'ready',ready:true,revision:room.revision});room=rooms.mutate(a,room.id,{type:'start',revision:room.revision});
 let state=idle(10,[a.id,b.id]);state.players[0].shipping=2;state=g.apply(state,a.id,{type:'recruit'});state=g.apply(state,a.id,{type:'gift',card:state.players[0].inventory[0].id,to:b.id});state=g.apply(state,a.id,{type:'signBounty',kind:'ancient',reward:'relic'});makeOffer(state,state.players[0],'relic',['longtide','ferry','crane']);store.transaction(data=>{data.rooms[room.id].game=state;data.rooms[room.id].revision++;});
 const before=rooms.snapshot(room.id,a),other=rooms.snapshot(room.id,b);store.close();store=new SqliteStore(path);try{const restored=new RoomService(store,createRegistry([g])),after=restored.snapshot(room.id,a);assert.deepEqual(after.game,before.game);assert.equal(after.submissionKey,before.submissionKey);assert.deepEqual(restored.snapshot(room.id,b).game,other.game);assert.equal(after.game.self.gifts.length,1);assert.equal(after.game.bounties[0].status,'warning');assert.ok(!JSON.stringify(after.game).includes('randomState'));const cmd={type:'game',command:{type:'lock',card:after.game.self.inventory[1].id},revision:after.revision,matchId:after.matchId,submissionKey:after.submissionKey};restored.mutate(a,room.id,cmd);assert.throws(()=>restored.mutate(a,room.id,cmd),{status:409});}finally{store.close();}
});

test('AI accepts the extra-relic fallback core after all offered relics are owned',()=>{
 const s=idle(14,['a']);s.players[0].started=true;s.players[0].relics=['longtide'];makeOffer(s,s.players[0],'bountyRelic',['longtide']);const cmd=g.bot.decide(g.view(s,'a'),'a');assert.equal(cmd.choice,'evolutionCore');const next=g.apply(s,'a',cmd);assert.equal(next.players[0].cores,1);assert.equal(next.players[0].offers.length,0);
});

test('AI accepts an incoming building and gift credit is awarded once when it enters a recipe',()=>{
 let s=idle(8),p=s.players[0];p.shipping=2;s.players[1].started=true;p.inventory=[];s.players[1].inventory=[];const material=giveCard(s,p,'tide0',{star:2});s=g.apply(s,'a',{type:'gift',card:material.id,to:'b'});const accept=g.bot.decide(g.view(s,'b'),'b');assert.equal(accept.type,'acceptGift');s=g.apply(s,'b',accept);assert.equal(s.players[0].stats.gifts,0);giveCard(s,s.players[1],'tide1');s=g.apply(s,'b',{type:'craft',recipe:'tide2'});assert.equal(s.players[0].stats.gifts,1);const c=s.players[1].inventory[0];s=g.apply(s,'b',{type:'deploy',card:c.id,pad:0});assert.equal(s.players[0].stats.gifts,1);
});

test('an announced bounty can push an already crowded shared map over the loss cap on arrival',()=>{
 let s=idle(4);s.cap=5;for(let i=0;i<4;i++)spawn(s,'slime',i%2,{speed:0});s=g.apply(s,'a',{type:'signBounty',kind:'gold',reward:'gold'});assert.equal(s.phase,'combat');assert.equal(s.enemies.length,4);s=advance(s,8000);assert.equal(s.phase,'finished');assert.equal(s.won,false);assert.ok(s.enemies.length>s.cap);assert.equal(s.players[0].stats.bounties,0);assert.equal(s.players[0].gold,100);
});

test('longbow rails can pierce the enemy behind a leading target during a calibrated volley',()=>{
 let s=idle(8,['a']);s.players[0].inventory=[];for(const [i,pad] of [0,5,2,1].entries())s=deploy(s,'a','gear'+i,pad);spawn(s,'slime',0,{d:300,hp:1000,speed:0});const back=spawn(s,'slime',0,{d:240,hp:1000,speed:0});const plain=g.realtime.advance(s,1),equipped=structuredClone(s);equipped.players[0].relics=['rails'];const pierced=g.realtime.advance(equipped,1);assert.ok(pierced.enemies.find(e=>e.id===back.id).hp<plain.enemies.find(e=>e.id===back.id).hp);
});
