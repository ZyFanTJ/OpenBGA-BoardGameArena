import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore} from '../packages/platform/store.js';
import {SqliteStore} from '../packages/platform/sqlite-store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {AccountService} from '../packages/platform/accounts.js';
import {AdminService} from '../packages/platform/admin.js';
import {defaultSettings,validateSettings,publicSystem} from '../packages/platform/system.js';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';
import {siteFooter} from '../apps/web/site-footer.js';
const password='fixture-password-123';
for(const kind of ['json','sqlite'])test(`${kind}: guest binding preserves identity and all owned records in one commit`,async t=>{
 const store=kind==='json'?new JsonStore():new SqliteStore(':memory:');t.after(()=>store.close?.());
 const sessions=new SessionService(store),accounts=new AccountService(store,sessions),guest=sessions.create('游客');
 const id=guest.user.id;
 store.transaction(data=>{data.profiles[id].credits=1234;data.profiles[id].details.bio='保留的简介';data.friendships.kept={a:id,b:'friend',status:'accepted'};data.matches.kept={id:'kept',participants:[{id}],recordedAt:1};});
 const before=structuredClone(store.data),tx=store.transaction.bind(store);let commits=0;store.transaction=fn=>{commits++;return tx(fn);};
 const result=await accounts.register({handle:'BoundGuest',password,guestId:id},guest.user);
 assert.equal(commits,1);assert.equal(result.user.id,id);assert.equal(result.user.credits,1234);assert.equal(result.user.friendCode,guest.user.friendCode);
 assert.deepEqual(store.data.friendships,before.friendships);assert.deepEqual(store.data.matches,before.matches);assert.deepEqual(store.data.transactions,before.transactions);assert.deepEqual(store.data.profiles[id].details,before.profiles[id].details);
 assert.equal((await accounts.login({handle:'BoundGuest',password})).user.id,id);
 await assert.rejects(accounts.register({handle:'LostGuest',password,guestId:id}),{status:401});
 assert.equal(Object.keys(store.data.accounts).length,1);
});
test('failed session creation never leaves a registered account behind',async()=>{
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),guest=sessions.create('游客');
 const before=structuredClone(store.data);store.transaction=()=>{throw new Error('disk unavailable');};
 await assert.rejects(accounts.register({handle:'AtomicGuest',password},guest.user),/disk unavailable/);assert.deepEqual(store.data,before);
});
test('HTTP binding rejects expired guests; password resets require admin, revoke sessions, retain records and are retry safe',async t=>{
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),admin=new AdminService(store);
 const keeper=await accounts.register({handle:'Keeper',password}),guest=sessions.create('游客');admin.bootstrap('keeper');
 const app=createApp({store,registry:games});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const call=async(path,token,data)=>{const r=await fetch(base+'/api'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Cookie:`moon_session=${token}`}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};};
 const registration={handle:'BoundPlayer',password,guestId:guest.user.id};
 assert.equal((await call('/auth/register',undefined,registration)).status,401);
 const bound=await call('/auth/register',guest.token,registration);assert.equal(bound.status,200);assert.equal(bound.body.id,guest.user.id);
 const target=guest.user.id,profile=structuredClone(store.data.profiles[target]),payload={password:'new-fixture-password-456',accessRevision:0,requestId:'password-reset-request-1'};
 assert.equal((await call(`/admin/users/${target}/password`,guest.token,payload)).status,403);
 assert.equal((await call(`/admin/users/${target}/password`,keeper.token,payload)).status,200);
 assert.equal((await call('/me',guest.token)).status,401);
 await assert.rejects(accounts.login({handle:'BoundPlayer',password}),{status:401});
 const login=await accounts.login({handle:'BoundPlayer',password:payload.password});assert.equal(login.user.id,target);
 assert.equal((await call(`/admin/users/${target}/password`,keeper.token,payload)).status,200);
 assert.equal(sessions.authenticate(login.token).id,target);assert.deepEqual(store.data.profiles[target],profile);
 assert.equal((await call(`/admin/users/${target}/password`,keeper.token,{...payload,requestId:'password-reset-request-2'})).status,409);
 const audit=JSON.stringify(store.data.administration.audit);assert.ok(!audit.includes(payload.password));assert.ok(!audit.includes(store.data.accounts[target].digest));
 const settings={...defaultSettings,githubUrl:'https://github.com/example',copyright:'© 示例'};
 assert.equal((await call('/admin/settings',keeper.token,{settings,revision:0,requestId:'footer-settings-request-1'})).status,200);
 assert.equal(publicSystem(store.data).copyright,'© 示例');
});
test('footer rejects executable URLs and safely displays empty links and text',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hi','https://name:pass@example.com'])assert.throws(()=>validateSettings({...defaultSettings,githubUrl:url}));
 assert.ok(!siteFooter(defaultSettings).includes('href=""'));assert.ok(siteFooter(defaultSettings).includes('https://zyfan.zone/'));
 assert.ok(siteFooter({...defaultSettings,copyright:'<script>alert(1)</script>'}).includes('&lt;script&gt;'));
});

test('binding rechecks a revoked guest session after password hashing',async()=>{
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),guest=sessions.create('撤销游客');
 const pending=accounts.register({handle:'RevokedGuest',password,guestId:guest.user.id},guest.user,{verifyGuest:()=>sessions.authenticate(guest.token)});
 sessions.revoke(guest.token);await assert.rejects(pending,{status:401});assert.equal(store.data.accounts[guest.user.id],undefined);
});
test('credit operations accept omitted notes while preserving the audit and ledger',async()=>{
 const store=new JsonStore(),sessions=new SessionService(store),accounts=new AccountService(store,sessions),admin=new AdminService(store);
 const keeper=await accounts.register({handle:'OptionalNoteAdmin',password}),guest=sessions.create('游客');admin.bootstrap('OptionalNoteAdmin');
 admin.credits(keeper.user,guest.user.id,{mode:'add',amount:5,revision:guest.user.revision,requestId:'optional-note-credit-1'});
 assert.equal(admin.audit(keeper.user).items[0].reason,'');assert.equal(store.data.profiles[guest.user.id].credits,305);
});
