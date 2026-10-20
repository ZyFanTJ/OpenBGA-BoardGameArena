import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {RoomService} from '../packages/platform/rooms.js';
import {SocialService} from '../packages/platform/social.js';
import {ProfilePageService} from '../packages/platform/profile-pages.js';
import {EconomyService} from '../packages/platform/economy.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
import {renderProfilePage,renderProfileEditor} from '../apps/web/hub/profile-page.js';
import {cosmetics} from '../packages/platform/economy.js';

function fixture(){const store=new JsonStore(),sessions=new SessionService(store),rooms=new RoomService(store,games),social=new SocialService(store,rooms,games),pages=new ProfilePageService(store,games,social),a=sessions.create('月见').user,b=sessions.create('观星人').user,c=sessions.create('陌生人').user;social.request(a,{playerId:b.id});social.respond(b,{requestId:social.list(b).requests[0].id,action:'accept'});return {store,sessions,social,pages,a,b,c};}
const draft=p=>({revision:p.revision,name:p.name,bio:'月下同桌，下一局见。',favoriteGame:'seven-wonders',visibility:'friends',showcase:[...p.details.showcase],appearance:{...p.appearance}});

test('v2 profiles migrate through v3 to v6 with original backups and unchanged games, balances, sessions and collections',()=>{
 const dir=mkdtempSync(join(tmpdir(),'moon-profile-'));
 try{const current=fixture().store.data;current.version=2;for(const p of Object.values(current.profiles))delete p.details;current.rooms.PRESERVE={stateVersion:9,revision:6,game:{hands:['secret']}};
 const original=structuredClone(current),file=join(dir,'platform.json');writeFileSync(file,JSON.stringify(current));const migrated=new JsonStore(file);
 assert.equal(migrated.data.version,6);assert.deepEqual(migrated.data.rooms,original.rooms);assert.deepEqual(migrated.data.sessions,original.sessions);
 for(const id of Object.keys(original.profiles)){const {details,...p}=migrated.data.profiles[id];assert.deepEqual(p,original.profiles[id]);assert.equal(details.visibility,'friends');assert.deepEqual(details.showcase,Object.values(p.equipped));}
 assert.deepEqual(JSON.parse(readFileSync(file+'.v2.bak','utf8')),original);new JsonStore(file);assert.deepEqual(JSON.parse(readFileSync(file+'.v2.bak','utf8')),original);assert.deepEqual(current,original);assert.equal(migrateStorage(migrated.data).version,6);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('profile update atomically saves identity, owned appearance and showcase without changing money or matches',()=>{
 const f=fixture(),economy=new EconomyService(f.store);economy.purchase(f.a,{itemId:'avatar-owl',revision:f.a.revision,requestId:'owned-appearance-id'});const p=f.pages.get(f.a).profile,input=draft(p);input.name=' 新昵称 ';input.appearance.avatar='avatar-owl';input.showcase=['avatar-owl'];const saved=f.pages.update(f.a,input);
 assert.equal(saved.profile.name,'新昵称');assert.equal(saved.profile.details.bio,input.bio);assert.equal(saved.profile.appearance.avatar,'avatar-owl');assert.equal(saved.profile.credits,180);assert.deepEqual(saved.profile.details.showcase,['avatar-owl']);assert.deepEqual(input.showcase,['avatar-owl']);assert.equal(saved.profile.revision,p.revision+1);assert.equal(f.sessions.authenticate(f.sessions.issue(f.a).token).name,'新昵称');
});
test('stale revisions, unowned cosmetics, invalid games, control characters and oversized showcases roll back',()=>{
 const f=fixture();let p=f.pages.get(f.a).profile;f.pages.update(f.a,draft(p));const before=structuredClone(f.store.data);
 assert.throws(()=>f.pages.update(f.a,draft(p)),{status:409});p=f.pages.get(f.a).profile;
 for(const extra of [{appearance:{...p.appearance,avatar:'avatar-dragon'}},{showcase:['avatar-dragon']},{showcase:['avatar-traveler','avatar-traveler']},{showcase:Array(5).fill('avatar-traveler')},{favoriteGame:'unknown'},{bio:'a'.repeat(161)},{bio:'bad\x00text'},{visibility:'public'}])assert.throws(()=>f.pages.update(f.a,{...draft(p),...extra}));
 assert.deepEqual(f.store.data,before);
});
test('saved profile settings survive storage reload and profile responses cannot mutate persistence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'moon-profile-save-'));
 try{const f=fixture(),file=join(dir,'platform.json');writeFileSync(file,JSON.stringify(f.store.data));const store=new JsonStore(file),social=new SocialService(store,new RoomService(store,games),games),pages=new ProfilePageService(store,games,social);
 const input={...draft(pages.get(f.a).profile),bio:'跨设备继续',visibility:'private',showcase:[]};pages.update(f.a,input);
 const reopened=new JsonStore(file),saved=reopened.data.profiles[f.a.id];assert.deepEqual(saved.details,{bio:'跨设备继续',favoriteGame:'seven-wonders',visibility:'private',showcase:[]});assert.equal(saved.credits,300);assert.equal(saved.revision,1);
 const response=pages.get(f.a);response.profile.details.bio='client mutation';response.profile.appearance.avatar='forged';assert.equal(store.data.profiles[f.a.id].details.bio,'跨设备继续');assert.equal(store.data.profiles[f.a.id].equipped.avatar,'avatar-traveler');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('friend profile responses expose chosen showcases and own recent results without wallets, accounts, inventory or opponent data',()=>{
 const f=fixture();const row={id:f.a.id,name:'月见',rank:1,score:40,won:true,isBot:false,left:false};f.store.data.matches.one={id:'one',gameId:'seven-wonders',gameTitle:'七大奇迹',endedAt:50,recordedAt:50,practice:false,scoreDirection:'higher',participants:[row,{id:f.b.id,name:'Private opponent',score:10,rank:2,isBot:false}]};
 const page=f.pages.get(f.b,f.a.id);assert.equal(page.owner,false);assert.equal(page.summary.played,1);assert.equal(page.recent[0].score,40);assert.equal(page.friends.length,0);
 for(const field of ['credits','handle','registered','inventory','revision'])assert.equal(page.profile[field],undefined);
 const text=JSON.stringify(page);assert.ok(!text.includes('Private opponent')&&!text.includes('participants')&&!text.includes('transactions'));
 assert.throws(()=>f.pages.get(f.c,f.a.id),{status:404});f.pages.update(f.a,{...draft(f.pages.get(f.a).profile),visibility:'private'});assert.throws(()=>f.pages.get(f.b,f.a.id),{status:403});assert.equal(f.pages.get(f.a).owner,true);
});
test('milestones and best scores derive from actual completed results, with AI modes labeled and departed games excluded',()=>{
 const f=fixture();function add(id,gameId,score,won,left=false,practice=false){f.store.data.matches[id]={id,gameId,gameTitle:gameId,scoreDirection:gameId==='cabo'?'lower':'higher',endedAt:Number(id),recordedAt:Number(id),practice,participants:[{id:f.a.id,isBot:false,score,rank:won?1:2,won,left}]};}
 add('1','cabo',12,false);add('2','cabo',3,true,false,true);add('3','cabo',1,false,true);add('4','seven-wonders',60,true);
 const page=f.pages.get(f.a);assert.equal(page.summary.played,3);assert.equal(page.summary.wins,2);assert.equal(page.summary.practice,1);assert.equal(page.summary.perGame.find(g=>g.id==='cabo').bestScore,3);assert.equal(page.summary.perGame.find(g=>g.id==='seven-wonders').bestScore,60);assert.equal(page.badges.find(b=>b.id==='first-win').earned,true);assert.equal(page.badges.find(b=>b.id==='regular').current,3);assert.equal(page.recent[0].id,'4');assert.equal(page.recent[1].left,true);
});
test('profile and editor escape names and bios; empty profiles show no fabricated games, victories or win rate',()=>{
 const f=fixture();const data=f.pages.get(f.a);data.profile.name='<img src=x onerror=evil()>';data.profile.details.bio='<script>evil()</script>';
 const html=renderProfilePage(data,cosmetics,games.list()),editor=renderProfileEditor(data.profile,cosmetics,games.list());
 for(const value of [html,editor]){assert.ok(!value.includes('<script>')&&!value.includes('<img src=x'));assert.match(value,/&lt;/);}
 assert.match(html,/还没有对局记录/);assert.match(html,/尚未对局/);assert.match(html,/>—<\/b>/);
});
test('HTTP profile authentication, persistence and friendship visibility are enforced server side',async()=>{
 const store=new JsonStore(),app=createApp({store,registry:games});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}/api`;
 async function request(path,data,cookie){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try{assert.equal((await request('/profile')).status,401);const a=await request('/session',{name:'A'}),b=await request('/session',{name:'B'});const input=draft(a.data);input.bio='saved';assert.equal((await request('/profile',input,a.cookie)).status,200);assert.equal((await request('/profile',input,a.cookie)).status,409);assert.equal((await request('/profile',undefined,a.cookie)).data.profile.details.bio,'saved');assert.equal((await request(`/profiles/${a.data.id}`,undefined,b.cookie)).status,404);assert.equal((await request('/profile',undefined,b.cookie)).data.profile.details.bio,'');}
 finally{app.closeStreams();await new Promise(resolve=>app.server.close(resolve));}
});
