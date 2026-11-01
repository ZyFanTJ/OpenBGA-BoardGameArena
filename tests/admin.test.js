import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {AccountService} from '../packages/platform/accounts.js';
import {AdminService} from '../packages/platform/admin.js';
import {EconomyService,rewardMatch} from '../packages/platform/economy.js';
import {RoomService} from '../packages/platform/rooms.js';
import {ForumService} from '../packages/platform/forum.js';
import {defaultSettings,publicSystem} from '../packages/platform/system.js';
import {publicProfile,ownProfile} from '../packages/platform/profiles.js';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';

const password='test-password-admin-only';
let counter=0;
const request=(extra={})=>({requestId:`test-admin-request-${++counter}`,reason:'测试管理修改',...extra});
async function fixture(){
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),admin=new AdminService(store);
 const a=await accounts.register({handle:'Keeper',name:'管理员',password}),b=await accounts.register({handle:'Player_B',name:'<script>玩家',password}),c=sessions.create('游客');
 admin.bootstrap('keeper');return {store,sessions,accounts,admin,a,b,c,economy:new EconomyService(store),rooms:new RoomService(store,games),forum:new ForumService(store)};
}

test('v5 administration migration is pure, gives nobody privileges, preserves all games and backs up once',()=>{
 const store=new JsonStore(),sessions=new SessionService(store);sessions.create('迁移用户');
 const input=structuredClone(store.data);input.version=5;delete input.system;delete input.administration;
 input.rooms.X={revision:7,stateVersion:2,players:[{id:'a',seat:6}],game:{hand:['private'],pending:{a:'secret'}}};input.forum.topics.keep={body:'原有讨论'};
 const before=structuredClone(input),next=migrateStorage(input);assert.deepEqual(input,before);assert.equal(next.version,10);
 assert.deepEqual(next.system,{revision:0,settings:defaultSettings});assert.deepEqual(next.administration,{users:{},audit:[]});
 for(const key of Object.keys(before).filter(k=>!['version','rooms'].includes(k)))assert.deepEqual(next[key],before[key]);
 assert.deepEqual(next.rooms.X,{...before.rooms.X,revision:8,turnSeconds:0,turnClock:null,lastTimeout:null});
 const dir=mkdtempSync(join(tmpdir(),'moon-admin-'));try{const file=join(dir,'platform.json'),raw=JSON.stringify(input);writeFileSync(file,raw);assert.deepEqual(new JsonStore(file).data,next);assert.equal(readFileSync(file+'.v5.bak','utf8'),raw);new JsonStore(file);assert.equal(readFileSync(file+'.v5.bak','utf8'),raw);}finally{rmSync(dir,{recursive:true,force:true});}
});

test('only a registered administrator can query or mutate administration; client profile flags grant nothing',async()=>{
 const f=await fixture(),id=f.b.user.id,before=structuredClone(f.store.data),forged={...f.b.user,admin:true};
 for(const user of [forged,f.c.user]){
  for(const run of [()=>f.admin.users(user),()=>f.admin.overview(user),()=>f.admin.settings(user),()=>f.admin.detail(user,id),()=>f.admin.audit(user),()=>f.admin.credits(user,id,request({mode:'set',amount:1,revision:1})),()=>f.admin.updateSettings(user,request({settings:defaultSettings,revision:0}))])assert.throws(run,{status:403});
 }
 assert.deepEqual(f.store.data,before);assert.equal(ownProfile(f.store.data,f.a.user.id).admin,true);assert.equal(publicProfile(f.store.data.profiles[f.a.user.id]).admin,undefined);
 assert.throws(()=>f.admin.bootstrap('missing_account'),/已注册/);f.admin.bootstrap('Player_B');assert.equal(ownProfile(f.store.data,id).admin,false);
});

test('admin user search includes guests, pages and filters; detail never exposes authentication material or private game state',async()=>{
 const f=await fixture();for(let i=0;i<22;i++)f.sessions.create('访客'+i);
 const listing=f.admin.users(f.a.user);assert.equal(listing.total,25);assert.equal(listing.items.length,20);assert.equal(f.admin.users(f.a.user,{page:2}).items.length,5);
 assert.equal(f.admin.users(f.a.user,{q:'player_b'}).items[0].id,f.b.user.id);assert.equal(f.admin.users(f.a.user,{q:f.c.user.friendCode}).items[0].id,f.c.user.id);
 assert.equal(f.admin.users(f.a.user,{filter:'admin'}).total,1);assert.equal(f.admin.users(f.a.user,{filter:'guest'}).total,23);
 const room=f.rooms.createRoom(f.b.user,{gameId:'seven-wonders',title:'管理员可见的房间'});f.store.data.rooms[room.id].game={secretHand:['secret-admin-test']};
 const result=f.admin.detail(f.a.user,f.b.user.id),text=JSON.stringify(result);assert.equal(result.room.id,room.id);assert.equal(result.sessionCount,1);assert.equal(result.collection[0].name,'月下旅人');
 for(const secret of ['digest','salt',f.b.token,'secret-admin-test'])assert.ok(!text.includes(secret));
 assert.throws(()=>f.admin.users(f.a.user,{page:-1}));assert.throws(()=>f.admin.users(f.a.user,{sort:'bad'}));
});

test('credit adjustment is revision checked, idempotent, audited and recorded in the user ledger',async()=>{
 const f=await fixture(),id=f.b.user.id,original=f.store.data.profiles[id].credits;
 const input=request({mode:'set',amount:1250,revision:f.b.user.revision});let detail=f.admin.credits(f.a.user,id,input);assert.equal(detail.credits,1250);
 f.admin.credits(f.a.user,id,input);assert.equal(f.store.data.profiles[id].credits,1250);assert.equal(f.economy.ledger(f.b.user).filter(t=>t.kind==='admin').length,1);
 const record=f.admin.audit(f.a.user).items.find(x=>x.action==='credits');assert.deepEqual(record.before,{credits:original});assert.deepEqual(record.after,{credits:1250});assert.equal(record.actorId,f.a.user.id);
 const snapshot=structuredClone(f.store.data);
 assert.throws(()=>f.admin.credits(f.a.user,id,{...input,amount:2000}),{status:409});assert.deepEqual(f.store.data,snapshot);
 assert.throws(()=>f.admin.credits(f.a.user,id,request({mode:'set',amount:1,revision:f.b.user.revision})),{status:409});assert.deepEqual(f.store.data,snapshot);
 assert.throws(()=>f.admin.credits(f.a.user,id,request({mode:'add',amount:-2000,revision:detail.revision})));assert.deepEqual(f.store.data,snapshot);
 detail=f.admin.credits(f.a.user,id,request({mode:'add',amount:-250,revision:detail.revision}));assert.equal(detail.credits,1000);
 f.economy.purchase(f.b.user,{itemId:'avatar-wolf',revision:detail.revision,requestId:'after-admin-purchase-123'});assert.equal(f.store.data.profiles[id].credits,880);
 assert.throws(()=>f.admin.credits(f.a.user,id,request({mode:'add',amount:1,revision:detail.revision})),{status:409});
});

test('registered users may be promoted; self lockout and granting privileges to guests are rejected',async()=>{
 const f=await fixture(),id=f.b.user.id;let detail=f.admin.access(f.a.user,id,request({action:'role',value:'admin',accessRevision:0}));
 assert.equal(detail.role,'admin');assert.equal(f.admin.users(f.b.user).total,3);
 assert.throws(()=>f.admin.access(f.a.user,f.a.user.id,request({action:'role',value:'player',accessRevision:1})),/自己/);
 assert.throws(()=>f.admin.access(f.a.user,f.a.user.id,request({action:'disabled',value:true,accessRevision:1})),/自己/);
 assert.throws(()=>f.admin.access(f.a.user,f.c.user.id,request({action:'role',value:'admin',accessRevision:0})),/绑定注册账号/);
 detail=f.admin.access(f.a.user,id,request({action:'role',value:'player',accessRevision:detail.accessRevision}));assert.equal(detail.role,'player');assert.throws(()=>f.admin.users(f.b.user),{status:403});
});

test('administrator profile edits are audited and revision checked without altering inventory, identity or privacy',async()=>{
 const f=await fixture(),id=f.b.user.id,old=structuredClone(f.store.data.profiles[id]);
 const input=request({name:'新昵称',bio:'经过管理修正的简介',revision:old.revision});
 const detail=f.admin.profile(f.a.user,id,input);assert.equal(detail.name,'新昵称');assert.equal(detail.profile.details.bio,'经过管理修正的简介');
 for(const key of ['id','friendCode','credits','inventory','equipped'])assert.deepEqual(f.store.data.profiles[id][key],old[key]);
 assert.equal(detail.profile.details.visibility,old.details.visibility);assert.equal(detail.profile.handle,'Player_B');
 f.admin.profile(f.a.user,id,input);assert.equal(f.admin.audit(f.a.user).items.filter(a=>a.action==='profile').length,1);
 assert.throws(()=>f.admin.profile(f.a.user,id,request({name:'覆盖修改',bio:'其他内容',revision:old.revision})),{status:409});
});

test('suspension and session revocation invalidate issued cookies and prevent suspended accounts from logging in',async()=>{
 const f=await fixture(),id=f.b.user.id,another=f.sessions.issue(f.b.user);
 let detail=f.admin.access(f.a.user,id,request({action:'disabled',value:true,accessRevision:0}));assert.equal(detail.disabled,true);assert.equal(detail.sessionCount,0);
 assert.throws(()=>f.sessions.authenticate(f.b.token),{status:401});assert.throws(()=>f.sessions.authenticate(another.token),{status:401});await assert.rejects(()=>f.accounts.login({handle:'Player_B',password}),{status:403});
 detail=f.admin.access(f.a.user,id,request({action:'disabled',value:false,accessRevision:detail.accessRevision}));const login=await f.accounts.login({handle:'Player_B',password});assert.equal(f.sessions.authenticate(login.token).id,id);
 detail=f.admin.access(f.a.user,id,request({action:'sessions',accessRevision:detail.accessRevision}));assert.equal(detail.sessionCount,0);assert.throws(()=>f.sessions.authenticate(login.token),{status:401});
});

test('system settings validate every field, reject stale writes, audit changes and use request replay protection',async()=>{
 const f=await fixture(),settings={...defaultSettings,siteName:'群星牌桌',welcomeCredits:450,announcement:'<b>维护公告</b>'},input=request({settings,revision:0});
 f.admin.updateSettings(f.a.user,input);f.admin.updateSettings(f.a.user,input);assert.equal(f.admin.settings(f.a.user).revision,1);assert.equal(f.admin.audit(f.a.user).items.filter(a=>a.action==='settings').length,1);
 const before=structuredClone(f.store.data);
 for(const bad of [{...settings,welcomeCredits:-1},{...settings,shopEnabled:'false'},{...settings,unexpected:true},{...settings,siteName:''},{...settings,practiceWinCredits:1.2}])assert.throws(()=>f.admin.updateSettings(f.a.user,request({settings:bad,revision:1})));
 assert.throws(()=>f.admin.updateSettings(f.a.user,request({settings:{...settings,siteName:'新名称'},revision:0})),{status:409});assert.deepEqual(f.store.data,before);
 const p=publicSystem(f.store.data);assert.equal(p.siteName,'群星牌桌');assert.equal(p.admin,undefined);assert.equal(p.revision,undefined);assert.ok(!JSON.stringify(p).includes('audit'));
});

test('registration, guest access, creation, exchange and posting switches actually enforce policy while existing games remain usable',async()=>{
 const f=await fixture(),room=f.rooms.createRoom(f.b.user,{gameId:'seven-wonders',title:'已有房间'}),topic=f.forum.create(f.b.user,{title:'已有话题',body:'原始内容',category:'chat'});
 const settings={...defaultSettings,registrationEnabled:false,guestAccessEnabled:false,roomCreationEnabled:false,shopEnabled:false,forumPostingEnabled:false};f.admin.updateSettings(f.a.user,request({settings,revision:0}));
 assert.throws(()=>f.sessions.create('新游客'),{status:403});await assert.rejects(()=>f.accounts.register({handle:'New_Player',password,name:'新用户'}),{status:403});assert.ok(await f.accounts.login({handle:'Player_B',password}));
 assert.throws(()=>f.rooms.createRoom(f.c.user,{gameId:'cabo',title:'新房间'}),{status:403});assert.equal(f.rooms.snapshot(room.id,f.b.user).id,room.id);f.rooms.mutate(f.b.user,room.id,{type:'ready',ready:true,revision:room.revision});
 assert.throws(()=>f.economy.purchase(f.b.user,{itemId:'avatar-wolf',revision:f.b.user.revision,requestId:'disabled-shop-request'}),{status:403});f.economy.equip(f.b.user,{itemId:'avatar-traveler',revision:f.store.data.profiles[f.b.user.id].revision});
 assert.throws(()=>f.forum.create(f.b.user,{title:'新内容',body:'新内容',category:'chat'}),{status:403});assert.throws(()=>f.forum.reply(f.b.user,topic.id,{body:'新回复'}),{status:403});assert.equal(f.forum.detail(f.b.user,topic.id).title,'已有话题');
});

test('welcome and match rewards use current system policy without changing old balances or paying twice',async()=>{
 const f=await fixture(),settings={...defaultSettings,welcomeCredits:550,practiceWinCredits:100,practiceLossCredits:45,multiplayerWinCredits:200,multiplayerLossCredits:75};
 f.admin.updateSettings(f.a.user,request({settings,revision:0}));assert.equal(f.store.data.profiles[f.b.user.id].credits,300);const newcomer=f.sessions.create('新旅人');assert.equal(newcomer.user.credits,550);
 f.store.transaction(data=>{assert.equal(rewardMatch(data,f.b.user.id,'one',true,true),100);assert.equal(rewardMatch(data,f.b.user.id,'two',false,true),45);assert.equal(rewardMatch(data,f.b.user.id,'three',true,false),200);assert.equal(rewardMatch(data,f.b.user.id,'four',false,false),75);rewardMatch(data,f.b.user.id,'one',true,true);});assert.equal(f.store.data.profiles[f.b.user.id].credits,720);
});

test('HTTP administration rejects normal users and cross-origin mutations, accepts only administrator sessions',async t=>{
 const f=await fixture(),app=createApp({store:f.store,registry:games});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const call=async(path,token,data,headers={})=>{const r=await fetch(base+'/api'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Cookie:'moon_session='+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
 for(const path of ['/admin/overview','/admin/users','/admin/settings','/admin/audit','/admin/users/'+f.b.user.id]){assert.equal((await call(path)).status,401);assert.equal((await call(path,f.b.token)).status,403);assert.equal((await call(path,f.a.token)).status,200);}
 const payload=request({mode:'set',amount:900,revision:f.b.user.revision});assert.equal((await call('/admin/users/'+f.b.user.id+'/credits',f.b.token,payload)).status,403);assert.equal((await call('/admin/users/'+f.b.user.id+'/credits',f.a.token,payload,{Origin:'http://foreign.invalid'})).status,403);assert.equal((await call('/admin/users/'+f.b.user.id+'/credits',f.a.token,payload)).body.credits,900);
 assert.equal((await call('/me',f.a.token)).body.user.admin,true);assert.equal((await call('/me',f.b.token)).body.user.admin,false);const normal=await call('/wallet',f.b.token);assert.equal(normal.body.transactions[0].kind,'admin');assert.equal((await call('/system')).status,200);
});
