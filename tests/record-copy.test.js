import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RecordService} from '../packages/platform/records.js';
import {ProfilePageService} from '../packages/platform/profile-pages.js';
import {SocialService} from '../packages/platform/social.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {AdminService} from '../packages/platform/admin.js';

test('a private history copy counts only for its owner, preserves peer careers and cannot be shared by a copied peer',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),source=sessions.create('游客').user,target=sessions.create('注册玩家').user,peer=sessions.create('同桌').user;
 const rooms=new RoomService(store,games),social=new SocialService(store,rooms,games),records=new RecordService(store,games),pages=new ProfilePageService(store,games,social);
 const row=(user,rank)=>({id:user.id,name:user.name,rank,score:rank,won:rank===1,isBot:false,left:false});
 store.transaction(d=>{
  d.accounts[peer.id]={id:peer.id,key:'admin',handle:'admin'};d.administration.users[peer.id]={role:'admin',disabled:false,revision:0};
  d.matches.original={id:'original',gameId:'cabo',gameTitle:'CABO',practice:false,rounds:1,endedAt:1,recordedAt:1,participants:[row(source,1),row(peer,2)],scoreDirection:'lower'};
  d.matches.copied={...structuredClone(d.matches.original),id:'copied',historyOwnerId:target.id,copiedFromMatchId:'original',shared:false,participants:[row(target,1),row(peer,2)]};
 });
 const counts=user=>({records:records.list(user).total,career:pages.get(user).summary.played,wins:pages.get(user).summary.wins});
 assert.deepEqual(counts(source),{records:1,career:1,wins:1});assert.deepEqual(counts(target),{records:1,career:1,wins:1});assert.deepEqual(counts(peer),{records:1,career:1,wins:0});
 assert.equal(records.detail(target,'copied').own.id,target.id);
 assert.throws(()=>records.detail(peer,'copied'),{status:404});assert.throws(()=>records.share(peer,'copied'),{status:404});assert.throws(()=>records.shared('copied'),{status:404});
 assert.equal(records.list(peer,{cursor:'',limit:20}).items[0].id,'original');
 assert.equal(records.list(target,{outcome:'win'}).total,1);assert.equal(records.list(target,{outcome:'loss'}).total,0);
 assert.equal(records.share(target,'copied').participants.length,2);
 assert.equal(store.data.matches.original.shared,undefined);assert.equal(records.list(peer).total,1);
 const admin=new AdminService(store,{social,registry:games});assert.equal(admin.overview(peer).counts.matches,1);assert.equal(admin.detail(peer,peer.id).matches.length,1);assert.equal(admin.detail(peer,target.id).matches.length,1);
});

test('overwriting one user history hides old rows only for that user and never exposes internal copy metadata',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),a=sessions.create('甲').user,b=sessions.create('乙').user;
 store.transaction(d=>{d.matches.old={id:'old',gameId:'cabo',gameTitle:'CABO',recordedAt:1,participants:[{id:a.id,isBot:false,won:true},{id:b.id,isBot:false,won:false}],historyExcludedUserIds:[a.id]};});
 const records=new RecordService(store,games);assert.equal(records.list(a).total,0);assert.throws(()=>records.detail(a,'old'),{status:404});assert.equal(records.list(b).total,1);
 assert.equal('historyExcludedUserIds' in records.detail(b,'old'),false);assert.equal('historyExcludedUserIds' in records.list(b).items[0],false);
});
