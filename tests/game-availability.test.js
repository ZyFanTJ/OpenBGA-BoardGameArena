import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {AccountService} from '../packages/platform/accounts.js';
import {SessionService} from '../packages/platform/sessions.js';
import {AdminService} from '../packages/platform/admin.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {systemSettings,gameEnabled,defaultSettings,validateSettings} from '../packages/platform/system.js';
import {createApp} from '../apps/server/http.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
let sequence=0;
async function setup(store=new JsonStore()){
 const sessions=new SessionService(store),accounts=new AccountService(store,sessions),admin=new AdminService(store,{registry:games}),a=await accounts.register({handle:'game_keeper',name:'管理员',password:'test-only-password'}),b=sessions.create('牌友');admin.bootstrap('game_keeper');
 const rooms=new RoomService(store,games,{random:()=>.2});
 const toggle=(id,on,extra={})=>admin.updateSettings(a.user,{revision:store.data.system.revision,settings:{...systemSettings(store.data),gameAvailability:{...systemSettings(store.data).gameAvailability,[id]:on}},requestId:`game-availability-${++sequence}`,reason:'测试上下线',...extra});
 return {store,sessions,accounts,admin,a,b,rooms,toggle};
}
test('only administrators can update individual registered games, with revision and audit protection',async()=>{
 const f=await setup(),settings=f.admin.settings(f.a.user);assert.equal(settings.games.length,games.list().length);
 const disabled=f.toggle('texas-holdem',false);assert.equal(disabled.settings.gameAvailability['texas-holdem'],false);assert.equal(gameEnabled(f.store.data,'cabo'),true);
 const before=structuredClone(f.store.data);
 assert.throws(()=>f.toggle('cabo',false,{revision:0}),{status:409});
 assert.throws(()=>f.admin.updateSettings(f.b.user,{settings:disabled.settings}),{status:403});
 assert.throws(()=>f.toggle('unregistered-game',false));assert.throws(()=>f.toggle('uno','no'));assert.deepEqual(f.store.data,before);
 const audit=f.admin.audit(f.a.user).items[0];assert.equal(audit.action,'settings');assert.equal(audit.after.gameAvailability['texas-holdem'],false);
 f.toggle('texas-holdem',true);assert.equal(gameEnabled(f.store.data,'texas-holdem'),true);
});
test('offline games reject new rooms, joins and starts inside transactions; existing matches continue',async()=>{
 const f=await setup(),id=f.rooms.createRoom(f.a.user,{gameId:'texas-holdem',title:'测试',visibility:'public'}).id;
 const run=(u,c)=>f.rooms.mutate(u,id,{revision:f.store.data.rooms[id].revision,...c});
 f.toggle('texas-holdem',false);assert.equal(f.rooms.directory().length,0);assert.throws(()=>f.rooms.join(f.b.user,id),{status:403});assert.throws(()=>f.rooms.createRoom(f.b.user,{gameId:'texas-holdem',title:'禁止新建'}),{status:403});
 assert.equal(f.rooms.snapshot(id,f.a.user).id,id);assert.throws(()=>run(f.a.user,{type:'start'}),{status:403});
 f.toggle('texas-holdem',true);f.rooms.join(f.b.user,id);run(f.a.user,{type:'ready',ready:true});run(f.b.user,{type:'ready',ready:true});run(f.a.user,{type:'start'});
 f.toggle('texas-holdem',false);assert.equal(f.rooms.directory().length,1);const s=f.store.data.rooms[id].game,actor=s.players[s.turn].id===f.a.user.id?f.a.user:f.b.user;
 run(actor,{type:'game',command:{type:'fold'}});assert.equal(f.store.data.rooms[id].game.phase,'roundEnd');run(f.a.user,{type:'game',command:{type:'nextRound'}});assert.equal(f.store.data.rooms[id].game.handNumber,2);
});
test('old settings keep all games online, omitted availability preserves it, SQLite restart retains explicit configuration',async()=>{
 const legacy=new JsonStore().data;delete legacy.system.settings.gameAvailability;const before=structuredClone(legacy);const restored=migrateStorage(legacy);assert.deepEqual(legacy,before);assert.equal(gameEnabled(restored,'texas-holdem'),true);
 const current={...defaultSettings,gameAvailability:{uno:false}},input={...defaultSettings};delete input.gameAvailability;assert.deepEqual(validateSettings(input,games,current).gameAvailability,{uno:false});
 const dir=mkdtempSync(join(tmpdir(),'moon-game-availability-')),file=join(dir,'store.sqlite');let store=new SqliteStore(file);
 try{const f=await setup(store);f.toggle('uno',false);const revision=store.data.system.revision;store.close();store=new SqliteStore(file);assert.equal(gameEnabled(store.data,'uno'),false);assert.equal(gameEnabled(store.data,'cabo'),true);assert.equal(store.data.system.revision,revision);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP exposes availability, rejects normal and cross-origin writes, and serves the new renderer and assets',async t=>{
 const f=await setup(),app=createApp({store:f.store,registry:games});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.closeStreams();app.server.close();});const base=`http://127.0.0.1:${app.server.address().port}`;
 const get=async path=>{const r=await fetch(base+path);assert.equal(r.status,200);return r.json();};
 let listing=await get('/api/games');assert.ok(listing.find(g=>g.id==='texas-holdem').enabled);
 const input={revision:0,settings:{...systemSettings(f.store.data),gameAvailability:{'texas-holdem':false}},requestId:'http-game-config-12345',reason:'下线测试'};
 const post=(token,origin=base)=>fetch(base+'/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:`moon_session=${token}`,Origin:origin},body:JSON.stringify(input)});
 assert.equal((await post(f.b.token)).status,403);assert.equal((await post(f.a.token,'https://elsewhere.invalid')).status,403);assert.equal((await post(f.a.token)).status,200);assert.equal((await post(f.a.token)).status,200);
 listing=await get('/api/games');assert.equal(listing.find(g=>g.id==='texas-holdem').enabled,false);assert.ok(listing.find(g=>g.id==='cabo').enabled);
 assert.equal((await get('/api/system')).gameAvailability['texas-holdem'],false);
 for(const path of ['/games/texas-holdem/index.js','/games/texas-holdem/style.css','/assets/texas-holdem/cover.svg','/assets/texas-holdem/card-back.svg','/assets/texas-holdem/chips.svg'])assert.equal((await fetch(base+path)).status,200);
});
