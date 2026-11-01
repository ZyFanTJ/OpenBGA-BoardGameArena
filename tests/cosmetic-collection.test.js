import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync,readFileSync} from 'node:fs';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {EconomyService,cosmetics} from '../packages/platform/economy.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {avatar,titleBadge,itemArt} from '../apps/web/hub/cosmetics.js';

test('atelier portraits are independently loaded compressed assets with distinct styles',()=>{
 const portraits=cosmetics.filter(item=>item.collection==='atelier');
 assert.ok(portraits.length>=10);
 assert.equal(new Set(portraits.map(item=>item.style)).size,portraits.length);
 assert.equal(new Set(cosmetics.map(item=>item.id)).size,cosmetics.length);
 let bytes=0;
 for(const item of portraits){
  const html=avatar({appearance:{avatar:item.id}}),source=html.match(/src="([^"]+)"/)[1];
  const file=new URL(`../apps/web${source}`,import.meta.url),size=statSync(file).size;
  assert.ok(size<32*1024,`${item.id} should stay below 32 KiB`);
  assert.equal(readFileSync(file).toString('ascii',8,12),'WEBP');
  assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/hub-avatar-initial/);
  bytes+=size;
 }
 assert.ok(bytes<256*1024,'the whole avatar collection stays below 256 KiB');
});

test('new collectibles buy, equip and resolve in public room identities without private collection data',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),economy=new EconomyService(store),rooms=new RoomService(store,games);
 const user=sessions.create('藏品验收').user,room=rooms.createRoom(user,{gameId:'cabo',title:'装扮展示'});
 store.transaction(data=>{data.profiles[user.id].credits=20000;});
 const revision=()=>store.data.profiles[user.id].revision;
 const items=cosmetics.filter(item=>item.collection==='atelier'||item.type==='frame'||item.type==='title'&&item.animated);
 for(const item of items){
  assert.throws(()=>economy.equip(user,{itemId:item.id,revision:revision()}),{status:403});
  const bought=economy.purchase(user,{itemId:item.id,revision:revision(),requestId:`collection-purchase-${item.id}`});
  assert.throws(()=>economy.equip(user,{itemId:item.id,revision:bought.profile.revision-1}),{status:409});
  economy.equip(user,{itemId:item.id,revision:revision()});
  const player=rooms.snapshot(room.id,user).players.find(player=>player.id===user.id);
  assert.equal(player.appearance[item.type],item.id);
  assert.equal('inventory' in player,false);assert.equal('credits' in player,false);
  if(item.type==='title'){
   const badge=titleBadge(player);
   assert.ok(badge.includes(item.name));assert.match(badge,/title-themed-crest/);
   assert.equal(badge.match(/title-style-\w+/)[0],itemArt(item).match(/title-style-\w+/)[0]);
  }else if(item.type==='frame')assert.match(avatar(player),/frame-ornament/);
  else assert.match(avatar(player),/hub-avatar-image/);
 }
 const frame=store.data.profiles[user.id].equipped.frame;
 economy.equip(user,{itemId:frame,revision:revision(),clear:true});
 assert.doesNotMatch(avatar(rooms.snapshot(room.id,user).players[0]),/frame-ornament/);
});

test('unrecognized decorative IDs cannot become paths, CSS classes or SVG markup',()=>{
 const invalid='\"><script>alert(1)</script>';
 assert.doesNotMatch(avatar({name:'旅人',appearance:{avatar:invalid,frame:invalid}}),/<script|frame-ornament|src=/);
 const html=titleBadge({appearance:{title:invalid},title:{id:invalid,name:'<img>',rarity:'rare'}});
 assert.doesNotMatch(html,/<img|title-style-|title-themed-crest/);
 assert.match(html,/&lt;img&gt;/);
});
