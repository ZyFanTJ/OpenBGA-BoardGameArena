import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {AccountService} from '../packages/platform/accounts.js';
import {AdminService} from '../packages/platform/admin.js';
import {games} from '../packages/games/registry.js';
import {systemSettings,validateSettings,publicSystem,gameHot} from '../packages/platform/system.js';
import {catalogPage} from '../apps/web/lobby/state.js';
import {createApp} from '../apps/server/http.js';

test('Hot defaults are independent of availability and legacy settings preserve existing Hot selections',()=>{
 const store=new JsonStore(),settings=systemSettings(store.data);assert.deepEqual(settings.gameHot,{});assert.equal(gameHot(store.data,'cabo'),false);
 const current={...settings,gameHot:{cabo:true},gameAvailability:{uno:false}},legacy={...current};delete legacy.gameHot;
 assert.deepEqual(validateSettings(legacy,games,current).gameHot,{cabo:true});
 assert.throws(()=>validateSettings({...current,gameHot:{unknown:true}},games,current));
 assert.throws(()=>validateSettings({...current,gameHot:{cabo:'yes'}},games,current));
 assert.throws(()=>validateSettings({...current,gameHot:[]},games,current));
});

test('Hot sorting is stable across category filters and pagination and never mutates the source catalog',()=>{
 const catalog=[{id:'a',title:'A',category:'卡牌游戏'},{id:'b',title:'B',category:'策略对战',hot:true},{id:'c',title:'C',category:'卡牌游戏',hot:true},{id:'d',title:'D',category:'卡牌游戏'}],original=structuredClone(catalog);
 assert.deepEqual(catalogPage(catalog,{pageSize:2}).items.map(g=>g.id),['b','c']);
 assert.deepEqual(catalogPage(catalog,{pageSize:2,page:1}).items.map(g=>g.id),['a','d']);
 assert.deepEqual(catalogPage(catalog,{category:'卡牌游戏'}).items.map(g=>g.id),['c','a','d']);
 assert.deepEqual(catalog,original);
});

test('only administrators can set Hot with revision and audit checks; public APIs expose the flags',async t=>{
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),admin=new AdminService(store,{registry:games});
 const keeper=await accounts.register({handle:'hot_keeper',name:'测试管理员',password:'test-only-password'}),player=sessions.create('普通玩家').user;admin.bootstrap('hot_keeper');
 const settings={...systemSettings(store.data),gameHot:{marrakech:true,cabo:true}};
 assert.throws(()=>admin.updateSettings(player,{settings}),{status:403});
 const input={revision:store.data.system.revision,settings,requestId:'hot-selection-test-1',reason:'热门推荐'};
 const result=admin.updateSettings(keeper.user,input);assert.equal(result.settings.gameHot.marrakech,true);assert.equal(gameHot(store.data,'cabo'),true);
 assert.deepEqual(admin.audit(keeper.user).items[0].after.gameHot,settings.gameHot);
 assert.throws(()=>admin.updateSettings(keeper.user,{...input,settings:{...settings,gameHot:{}},requestId:'hot-selection-stale'}),{status:409});
 assert.deepEqual(publicSystem(store.data).gameHot,settings.gameHot);
 const app=createApp({store,registry:games});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>{app.closeStreams();app.server.close();});
 const url=`http://127.0.0.1:${app.server.address().port}`;
 const listing=await(await fetch(url+'/api/games')).json();assert.equal(listing.find(g=>g.id==='marrakech').hot,true);assert.equal(listing.find(g=>g.id==='uno').hot,false);
 const exposed=await(await fetch(url+'/api/system')).json();assert.deepEqual(exposed.gameHot,settings.gameHot);
 for(const name of ['cabo','marrakech']){
  const cover=await fetch(`${url}/assets/lobby/${name}-cover-v1.jpg`);assert.equal(cover.status,200);assert.match(cover.headers.get('content-type'),/^image\/jpeg/);
  const bytes=new Uint8Array(await cover.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[255,216,255]);
 }
});
