import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {EconomyService,cosmetics} from '../packages/platform/economy.js';
import {RoomService} from '../packages/platform/rooms.js';
import {games} from '../packages/games/registry.js';
import {playerName,playerIdentity} from '../apps/web/player-identity.js';
import {itemArt,titleBadge} from '../apps/web/hub/cosmetics.js';
import {ownProfile,publicProfile} from '../packages/platform/profiles.js';
import {renderCaboTable} from '../apps/web/games/cabo-table.js';
import {createUnoRenderer} from '../apps/web/games/uno/index.js';
import {createSevenWondersRenderer} from '../apps/web/games/seven-wonders/index.js';
import {createMarrakechRenderer} from '../apps/web/games/marrakech/index.js';
import {createNinjaRenderer} from '../apps/web/games/night-of-the-ninja/index.js';

test('session, shop and refreshed profiles resolve the equipped title without a client catalog',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),economy=new EconomyService(store);
 const {user,token}=sessions.create('菜单称号验证');
 assert.match(titleBadge(user),/初来乍到/);
 for(const id of ['title-strategist','title-starlord']){
  const bought=economy.purchase(user,{itemId:id,revision:ownProfile(store.data,user.id).revision,requestId:`menu-title-${id}`});
  const result=economy.equip(user,{itemId:id,revision:bought.profile.revision});
  const item=cosmetics.find(item=>item.id===id);
  for(const profile of [result.profile,ownProfile(store.data,user.id),sessions.authenticate(token),publicProfile(store.data.profiles[user.id])]){
   assert.deepEqual(profile.title,{id,name:item.name,rarity:item.rarity});
   assert.match(titleBadge(profile),new RegExp(item.name));
   assert.match(titleBadge(profile),new RegExp(`title-tier-${item.rarity}`));
  }
 }
 const initial=economy.equip(user,{itemId:'title-wanderer',revision:ownProfile(store.data,user.id).revision});
 assert.match(titleBadge(initial.profile),/初来乍到/);
 assert.equal('title' in store.data.profiles[user.id],false,'display metadata never enters persisted profiles');
 initial.profile.title.name='modified';
 assert.equal(ownProfile(store.data,user.id).title.name,'初来乍到');
});

test('room identities resolve equipped titles from profiles without exposing collections or changing game state',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),economy=new EconomyService(store),rooms=new RoomService(store,games,{random:()=>.3});
 const user=sessions.create('星图旅人').user;
 const initial=rooms.createRoom(user,{gameId:'cabo',title:'称号验证'});
 economy.purchase(user,{itemId:'title-starlord',revision:store.data.profiles[user.id].revision,requestId:'title-identity-purchase'});
 economy.equip(user,{itemId:'title-starlord',revision:store.data.profiles[user.id].revision});
 let room=rooms.mutate(user,initial.id,{type:'addBot',revision:initial.revision});
 room=rooms.mutate(user,room.id,{type:'ready',ready:true,revision:room.revision});
 room=rooms.mutate(user,room.id,{type:'start',revision:room.revision});
 const persisted=structuredClone(store.data.rooms[room.id]);
 const snapshot=rooms.snapshot(room.id,user),player=snapshot.players.find(p=>p.id===user.id);
 assert.deepEqual(player.title,{id:'title-starlord',name:'群星执掌者',rarity:'legendary'});
 for(const field of ['inventory','credits','details','credentials'])assert.equal(field in player,false);
 assert.equal(snapshot.players.find(p=>p.isBot).title,undefined);
 assert.deepEqual(store.data.rooms[room.id],persisted);
 const html=renderCaboTable({s:snapshot.game,room:snapshot,user,name:id=>snapshot.players.find(p=>p.id===id).name,selectable:()=>false,selected:[],help:'',controls:''});
 assert.match(html,/game-title-badge/);assert.match(html,/title-tier-legendary/);
 assert.ok(html.indexOf('群星执掌者')<html.indexOf('game-player-nickname'));
 player.title.name='modified';assert.equal(rooms.snapshot(room.id,user).players.find(p=>p.id===user.id).title.name,'群星执掌者');
});

test('title identity escapes names, handles missing players and never assigns a title to bots',()=>{
 assert.equal(playerName({players:[]},'unknown'),'<span class="game-player-identity"><span class="game-player-nickname">玩家</span></span>');
 assert.doesNotMatch(playerIdentity({name:'AI',isBot:true,title:{id:'x'}}),/game-title-badge/);
 const player={name:'<img onerror=evil()>',appearance:{title:'custom'},title:{id:'custom',name:'<script>evil()</script>',rarity:'legendary'}};
 const html=playerIdentity(player);assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);
 assert.match(titleBadge({appearance:{title:'missing'}},cosmetics),/title-tier-classic/);
});

test('four title qualities have distinct crest silhouettes and share their quality across preview and identity',()=>{
 const markup=['classic','rare','epic','legendary'].map(rarity=>{
  const item={id:'preview',type:'title',name:'品质预览',rarity};
  assert.match(titleBadge({appearance:{title:item.id}},[item]),new RegExp(`title-tier-${rarity}`));
  return itemArt(item);
 });
 assert.equal(new Set(markup.map(html=>html.match(/<svg.*?<\/svg>/)[0])).size,4);
});

test('game seat renderers show the equipped title before the player nickname',()=>{
 for(const [id,create] of [['uno',createUnoRenderer],['seven-wonders',createSevenWondersRenderer],['marrakech',createMarrakechRenderer],['night-of-the-ninja',createNinjaRenderer]]){
  const game=games.get(id),ids=Array.from({length:game.manifest.minPlayers},(_,i)=>String(i));
  const state=game.create(ids,{},()=>.3);
  const players=ids.map(id=>({id,name:'旅人'+id,appearance:{title:'title-starlord'},title:{id:'title-starlord',name:'群星执掌者',rarity:'legendary'}}));
  const room={id:'preview',gameId:id,hostId:ids[0],status:'playing',revision:0,players,game:game.view(state,ids[0])};
  const html=create(()=>{},()=>{}).render(room,players[0]);
  assert.match(html,/game-title-badge/,id);assert.match(html,/title-tier-legendary/,id);
  assert.ok(html.indexOf('群星执掌者')<html.indexOf('game-player-nickname'),id);
 }
});
