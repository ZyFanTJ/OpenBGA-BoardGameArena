import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {SocialService} from '../packages/platform/social.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {lobbyFriends} from '../apps/web/lobby-sidebar.js';

test('last online survives restart, checkpoints are throttled, and heartbeat metadata leaves wallet and editable revision intact',()=>{
 mkdirSync('work',{recursive:true});const dir=mkdtempSync(join('work','last-online-')),file=join(dir,'platform.json');let store;
 try{
  store=new SqliteStore(file+'.sqlite',{legacyFile:file});
  const sessions=new SessionService(store),user=sessions.create('月见').user,unknown=sessions.create('旧用户').user;
  let now=1700000000000;const social=new SocialService(store,new RoomService(store,games),games,{now:()=>now});
  const profile=structuredClone(store.data.profiles[user.id]),ledger=structuredClone(store.data.transactions);
  const persist=store.persist.bind(store);let writes=0;store.persist=changes=>{writes++;return persist(changes);};
  assert.equal(social.person(unknown.id).lastSeenAt,null);
  social.touch(user);assert.equal(writes,1);assert.equal(social.person(user.id).status,'online');
  now+=30000;social.touch(user);assert.equal(writes,1);assert.equal(social.person(user.id).lastSeenAt,now);assert.equal(store.data.profiles[user.id].lastSeenAt,now-30000);
  now+=30000;social.touch(user);assert.equal(writes,2);const checkpoint=now;
  assert.deepEqual(store.data.profiles[user.id],{...profile,lastSeenAt:checkpoint});assert.deepEqual(store.data.transactions,ledger);
  now+=75000;assert.equal(social.person(user.id).status,'offline');assert.equal(social.person(user.id).lastSeenAt,checkpoint);
  store.close();store=new SqliteStore(file+'.sqlite',{legacyFile:file});
  const restored=new SocialService(store,new RoomService(store,games),games,{now:()=>now});
  assert.equal(restored.person(user.id).status,'offline');assert.equal(restored.person(user.id).lastSeenAt,checkpoint);
  assert.equal(restored.person(unknown.id).lastSeenAt,null);restored.touch(user);assert.equal(restored.person(user.id).status,'online');
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('lobby friends show status and elapsed last-online time, without inventing missing history',()=>{
 const now=1700000000000,person={id:'friend',name:'月见',status:'offline'};
 for(const [elapsed,label] of [[10000,'刚刚在线'],[60000,'1 分钟前在线'],[300000,'5 分钟前在线'],[7200000,'2 小时前在线'],[259200000,'3 天前在线'],[5184000000,'2 个月前在线'],[63072000000,'2 年前在线']]){
  const html=lobbyFriends([{...person,lastSeenAt:now-elapsed}],now);assert.match(html,/>离线</);assert.ok(html.includes('· '+label));assert.match(html,/上次在线：/);assert.doesNotMatch(html,/暂未在线/);
 }
 for(const lastSeenAt of [undefined,null,NaN,-1]){const html=lobbyFriends([{...person,lastSeenAt}],now);assert.match(html,/>离线</);assert.doesNotMatch(html,/lobby-friend-detail|暂未在线|NaN|Invalid Date/);}
 assert.match(lobbyFriends([{...person,lastSeenAt:now+10000}],now),/刚刚在线/);
 const playing=lobbyFriends([{...person,status:'playing',gameTitle:'CABO',lastSeenAt:now-300000}],now);assert.match(playing,/>在线</);assert.match(playing,/正在玩 CABO/);assert.doesNotMatch(playing,/分钟前在线/);
});
