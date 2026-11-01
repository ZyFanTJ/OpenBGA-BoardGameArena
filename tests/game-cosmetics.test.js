import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {EconomyService,cosmetics} from '../packages/platform/economy.js';
import {ProfilePageService} from '../packages/platform/profile-pages.js';
import {SocialService} from '../packages/platform/social.js';
import {games} from '../packages/games/registry.js';
import {cardArt as caboArt} from '../apps/web/games/cabo-cards.js';
import {cardArt as unoArt} from '../apps/web/games/uno/art.js';
import {avatar} from '../apps/web/hub/cosmetics.js';
import {renderItem} from '../apps/web/hub/views.js';
import {createUnoRenderer} from '../apps/web/games/uno/index.js';
import {createApp} from '../apps/server/http.js';

test('frames and game accessories enforce ownership, independent slots and safe clearing; profile edits preserve them',()=>{
 const store=new JsonStore(),sessions=new SessionService(store),user=sessions.create('星环玩家').user,economy=new EconomyService(store),rooms=new RoomService(store,games),social=new SocialService(store,rooms,games),pages=new ProfilePageService(store,games,social);
 assert.throws(()=>economy.equip(user,{itemId:'frame-prism',revision:0}),{status:403});
 store.transaction(d=>{d.profiles[user.id].credits=5000;});
 const revision=()=>store.data.profiles[user.id].revision;
 for(const id of ['frame-prism','cabo-back-constellation','uno-back-aurora']){
  const bought=economy.purchase(user,{itemId:id,revision:revision(),requestId:`cosmetic-purchase-${id}`});
  const balance=bought.profile.credits;assert.equal(economy.purchase(user,{itemId:id,revision:0,requestId:`cosmetic-purchase-${id}`}).profile.credits,balance);
  economy.equip(user,{itemId:id,revision:revision()});
 }
 let own=economy.catalog(user).profile;
 assert.equal(own.appearance.caboCardBack,'cabo-back-constellation');assert.equal(own.appearance.unoCardBack,'uno-back-aurora');assert.equal(own.appearance.frame,'frame-prism');
 pages.update(user,{revision:own.revision,name:user.name,bio:'新简介',favoriteGame:'',visibility:'friends',showcase:[],appearance:{avatar:own.appearance.avatar,banner:own.appearance.banner,title:own.appearance.title,frame:'forged'}});
 own=economy.catalog(user).profile;assert.equal(own.appearance.frame,'frame-prism');assert.equal(own.appearance.caboCardBack,'cabo-back-constellation');
 assert.match(renderItem(cosmetics.find(x=>x.id==='cabo-back-constellation'),own,cosmetics,'test'),/卸下/);
 economy.equip(user,{itemId:'cabo-back-constellation',revision:revision(),clear:true});own=economy.catalog(user).profile;
 assert.equal(own.appearance.caboCardBack,undefined);assert.equal(own.appearance.unoCardBack,'uno-back-aurora');assert.equal(own.appearance.frame,'frame-prism');assert.match(avatar(own),/frame-prism/);
 assert.doesNotMatch(avatar({appearance:{frame:'<img>'}}),/<img>/);
});

test('card skins are player-owned, apply only to hidden faces, and cannot replace public card values or another game',()=>{
 const owner={appearance:{caboCardBack:'cabo-back-gilded',unoCardBack:'uno-back-aurora'}};
 assert.match(caboArt(null,owner),/card-skin-gold/);assert.match(unoArt(null,owner),/card-skin-aurora/);
 assert.equal(caboArt(9,owner),caboArt(9));assert.equal(unoArt({color:'red',value:7},owner),unoArt({color:'red',value:7}));
 assert.equal(caboArt(null,{appearance:{caboCardBack:'uno-back-aurora'}}),caboArt(null));
 const store=new JsonStore(),sessions=new SessionService(store),user=sessions.create('暗牌测试').user,rooms=new RoomService(store,games,{random:()=>.4});
 let room=rooms.createRoom(user,{gameId:'cabo',title:'外观隔离'});room=rooms.mutate(user,room.id,{type:'addBot',revision:room.revision});room=rooms.mutate(user,room.id,{type:'ready',ready:true,revision:room.revision});room=rooms.mutate(user,room.id,{type:'start',revision:room.revision});
 const before=structuredClone(store.data.rooms[room.id]);store.transaction(d=>{d.profiles[user.id].equipped={...d.profiles[user.id].equipped,...owner.appearance};});
 const projected=rooms.snapshot(room.id,user);assert.deepEqual(store.data.rooms[room.id],before);assert.equal(projected.players[0].appearance.caboCardBack,'cabo-back-gilded');assert.ok(projected.game.players.every(p=>p.cards.every(c=>c.value===null)));assert.equal('inventory' in projected.players[0],false);
});

test('non-host UNO round results explain waiting, can be closed locally and reopen for a new round',async()=>{
 const game=games.get('uno'),s=game.create(['a','b'],{},()=>.4);s.phase='roundEnd';s.roundResult={winnerId:'a',points:30,players:[{id:'a',remaining:0},{id:'b',remaining:30}]};
 const room={id:'ABCD1234',gameId:'uno',hostId:'a',matchId:'match',players:[{id:'a',name:'房主甲'},{id:'b',name:'乙'}],status:'playing',game:game.view(s,'b')};let posts=0;
 const renderer=createUnoRenderer(()=>posts++,()=>{});let html=renderer.render(room,room.players[1]);assert.match(html,/等待房主开启下一轮/);assert.match(html,/房主甲 开启下一轮后/);assert.doesNotMatch(html,/data-action="game:nextRound"/);
 await renderer.handle('result-close',{});html=renderer.render(room,room.players[1]);assert.doesNotMatch(html,/class="uno-result"/);assert.match(html,/game:result-open/);assert.equal(posts,0);
 await renderer.handle('result-open',{});assert.match(renderer.render(room,room.players[1]),/class="uno-result"/);
});

test('equipping pushes public appearance to seated peers without changing game revision or leaking private state; conflicts have a specific code',async t=>{
 const store=new JsonStore(),app=createApp({store,registry:games});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));});const base=`http://127.0.0.1:${app.server.address().port}`;
 async function request(path,body,cookie){const response=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const a=await request('/session',{name:'甲'}),b=await request('/session',{name:'乙'});let room=(await request('/rooms',{gameId:'cabo',title:'装扮实时同步'},a.cookie)).value;
 room=(await request(`/rooms/${room.id}/join`,{},b.cookie)).value;
 const conflict=await request(`/rooms/${room.id}/actions`,{type:'ready',ready:true,revision:0},a.cookie);assert.equal(conflict.status,409);assert.equal(conflict.value.code,'ROOM_REVISION_CONFLICT');
 const controller=new AbortController(),stream=await fetch(base+`/api/rooms/${room.id}/events?protocol=2`,{headers:{cookie:b.cookie},signal:controller.signal}),reader=stream.body.getReader();await reader.read();
 t.after(()=>controller.abort());const revision=room.revision,stored=structuredClone(store.data.rooms[room.id]);
 const bought=await request('/shop/purchase',{itemId:'frame-lunar',requestId:'live-frame-purchase',revision:a.value.revision},a.cookie);assert.equal(bought.status,200);
 const equipped=await request('/shop/equip',{itemId:'frame-lunar',revision:bought.value.profile.revision},a.cookie);assert.equal(equipped.status,200);
 const frame=new TextDecoder().decode((await reader.read()).value);const pushed=JSON.parse(frame.split('\n').find(s=>s.startsWith('data: ')).slice(6));
 assert.equal(pushed.revision,revision);assert.equal(pushed.players.find(p=>p.id===a.value.id).appearance.frame,'frame-lunar');assert.deepEqual(store.data.rooms[room.id],stored);assert.equal(frame.includes('inventory'),false);assert.equal(frame.includes('credits'),false);controller.abort();
});
