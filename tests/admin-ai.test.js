import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {JsonStore,migrateStorage} from '../packages/platform/store.js';
import {SessionService} from '../packages/platform/sessions.js';
import {AccountService} from '../packages/platform/accounts.js';
import {AdminService} from '../packages/platform/admin.js';
import {createProviderSecrets,configuredTextProvider} from '../apps/server/provider-settings.js';
import {createApp} from '../apps/server/http.js';
import {games} from '../packages/games/registry.js';
import {defaultTextProvider} from '../packages/platform/integrations.js';

let sequence=0;
const request=settings=>({revision:0,requestId:`admin-ai-test-request-${++sequence}`,reason:'配置模型服务',settings});
const settings=(extra={})=>({enabled:true,baseUrl:'https://provider.example/v1',model:'model-a',apiKey:'test-private-key-A',clearApiKey:false,...extra});
async function fixture(store=new JsonStore()){
 const sessions=new SessionService(store),accounts=new AccountService(store,sessions),a=await accounts.register({handle:'Admin_AI',name:'管理员',password:'test-password-ai-only'}),b=sessions.create('普通玩家');
 const secrets=createProviderSecrets(store),admin=new AdminService(store,{providerSecrets:secrets});admin.bootstrap('Admin_AI');return {store,admin,secrets,a,b};
}

test('v7 integration migration preserves every prior field and writes an exact backup without changing room revisions',()=>{
 const input={version:7,rooms:{R:{revision:9,stateVersion:2,game:{hands:['private'],pending:{a:'card'}}}},profiles:{a:{credits:230}},accounts:{a:{id:'a'}},sessions:{keep:{id:'a'}},administration:{users:{a:{role:'admin'}},audit:[]}};
 const before=structuredClone(input),expected=migrateStorage(input);assert.deepEqual(input,before);assert.equal(expected.version,9);
 const {integrations,version,...rest}=expected,{version:oldVersion,...oldRest}=before;assert.deepEqual(rest,oldRest);
 assert.deepEqual(integrations,{revision:0,textProvider:defaultTextProvider()});
 fs.mkdirSync('work',{recursive:true});const dir=fs.mkdtempSync(resolve('work/admin-ai-migrate-'));
 try{const file=join(dir,'platform.json'),raw=JSON.stringify(before);fs.writeFileSync(file,raw);assert.deepEqual(new JsonStore(file).data,expected);assert.equal(fs.readFileSync(file+'.v7.bak','utf8'),raw);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('administrator configuration is encrypted, revision checked and replay safe; responses and audits never reveal credentials',async()=>{
 const f=await fixture(),input=request(settings()),before=structuredClone(f.store.data);
 assert.throws(()=>f.admin.ai(f.b.user),{status:403});assert.throws(()=>f.admin.updateAi(f.b.user,input),{status:403});assert.deepEqual(f.store.data,before);
 const saved=f.admin.updateAi(f.a.user,input);assert.equal(saved.hasApiKey,true);assert.equal(saved.configured,true);assert.equal(saved.revision,1);
 const encrypted=structuredClone(f.store.data.integrations);f.admin.updateAi(f.a.user,input);assert.deepEqual(f.store.data.integrations,encrypted);
 assert.equal(f.store.data.administration.audit.filter(a=>a.action==='ai').length,1);
 assert.ok(!JSON.stringify(f.store.data).includes(input.settings.apiKey));assert.ok(!JSON.stringify(f.admin.audit(f.a.user)).includes(input.settings.apiKey));assert.equal(saved.apiKey,undefined);assert.equal(saved.encryptedKey,undefined);
 assert.equal(f.secrets.open(f.store.data.integrations.textProvider.encryptedKey),input.settings.apiKey);
 assert.throws(()=>f.admin.updateAi(f.a.user,{...request(settings({apiKey:'rotated-test-key'})),revision:0}),{status:409});
 assert.throws(()=>f.admin.updateAi(f.a.user,{...input,settings:settings({model:'model-b'})}),{status:409});
 f.admin.updateAi(f.a.user,{...request(settings({model:'model-b',apiKey:''})),revision:1});assert.deepEqual(f.store.data.integrations.textProvider.encryptedKey,encrypted.textProvider.encryptedKey);
 const stable=structuredClone(f.store.data);for(const bad of [settings({baseUrl:'http://remote.example/v1'}),settings({baseUrl:'https://user:pass@provider.example/v1'}),settings({baseUrl:'https://provider.example/v1?key=x'}),settings({model:'bad model'}),settings({apiKey:'bad\nkey'}),settings({apiKey:'',clearApiKey:true})])assert.throws(()=>f.admin.updateAi(f.a.user,{...request(bad),revision:2}));assert.deepEqual(f.store.data,stable);
 f.admin.updateAi(f.a.user,{...request(settings({enabled:false,apiKey:'',clearApiKey:true})),revision:2});assert.equal(f.admin.ai(f.a.user).hasApiKey,false);assert.equal(f.admin.ai(f.a.user).configured,false);
});

test('saved providers take effect on subsequent requests, retain blank keys, survive restart and disable without network I/O',async()=>{
 fs.mkdirSync('work',{recursive:true});const dir=fs.mkdtempSync(resolve('work/admin-ai-runtime-'));
 try{
  const file=join(dir,'platform.json'),f=await fixture(new JsonStore(file)),calls=[];
  const fetchImpl=async(url,input)=>{calls.push({url:String(url),auth:input.headers.Authorization,model:JSON.parse(input.body).model});return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({narration:'模型叙述'})}}]});};
  const run=configuredTextProvider(f.store,f.secrets,{fetchImpl});assert.equal((await run({system:'test',data:{}},{})).source,'local');assert.equal(calls.length,0);
  f.admin.updateAi(f.a.user,request(settings()));assert.equal((await run({system:'test',data:{}},{})).source,'ai');assert.equal(calls.at(-1).auth,'Bearer test-private-key-A');
  f.admin.updateAi(f.a.user,{...request(settings({apiKey:'',model:'model-b'})),revision:1});await run({system:'test',data:{}},{});assert.equal(calls.at(-1).model,'model-b');assert.equal(calls.at(-1).auth,'Bearer test-private-key-A');
  const restored=new JsonStore(file),restarted=configuredTextProvider(restored,createProviderSecrets(restored),{fetchImpl});assert.equal((await restarted({system:'test',data:{}},{})).source,'ai');assert.equal(fs.statSync(file+'.secrets.key').size,32);
  f.admin.updateAi(f.a.user,{...request(settings({enabled:false,apiKey:'',clearApiKey:true})),revision:2});const count=calls.length;assert.equal((await run({system:'test',data:{}},{})).source,'local');assert.equal(calls.length,count);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('HTTP AI configuration denies anonymous, regular and cross-origin writes, and powers subsequent game effects',async t=>{
 const f=await fixture();let calls=0;
 const app=createApp({store:f.store,registry:games,random:()=>.8,providerFetch:async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({narration:'由后台配置的模型叙述'})}}]});}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeStreams();await new Promise(r=>app.server.close(r));});const base=`http://127.0.0.1:${app.server.address().port}`;
 async function api(path,token,data,extra={}){const r=await fetch(base+'/api'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Cookie:'moon_session='+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...extra},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
 assert.equal((await api('/admin/ai')).status,401);assert.equal((await api('/admin/ai',f.b.token)).status,403);assert.equal((await api('/admin/ai',f.b.token,request(settings()))).status,403);assert.equal((await api('/admin/ai',f.a.token,request(settings()),{Origin:'https://foreign.example'})).status,403);
 const saved=await api('/admin/ai',f.a.token,request(settings()));assert.equal(saved.status,200);assert.equal(saved.body.configured,true);
 for(const path of ['/admin/ai','/admin/overview','/admin/audit','/system','/me'])assert.ok(!JSON.stringify((await api(path,f.a.token)).body).includes('test-private-key-A'));
 let room=(await api('/rooms',f.a.token,{gameId:'dnd',title:'配置接入验收',options:{dmMode:'ai'}})).body;
 const act=async input=>{const result=await api('/rooms/'+room.id+'/actions',f.a.token,{revision:room.revision,...input});assert.equal(result.status,200,result.body.error);room=result.body;};
 await act({type:'ready',ready:true});await act({type:'start'});await act({type:'game',command:{type:'character',name:'测试旅人',archetype:'fighter',note:'私密背景'}});
 for(let i=0;i<100&&room.game.pending;i++){await new Promise(r=>setTimeout(r,10));room=(await api('/rooms/'+room.id,f.a.token)).body;}
 assert.equal(calls,1);assert.equal(room.game.dmStatus,'ai');assert.ok(room.game.journal.some(entry=>entry.kind==='dm'&&entry.text.includes('后台配置')));assert.ok(!JSON.stringify(room).includes('test-private-key-A'));
});

test('v8 settings migration adds 100k context and a separate style without altering credentials, rooms or revisions',()=>{
 const input=new JsonStore().data;input.version=8;
 input.integrations={revision:7,textProvider:{enabled:true,baseUrl:'https://provider.example/v1',model:'keep-model',encryptedKey:{data:'encrypted-placeholder'}}};
 const before=structuredClone(input),next=migrateStorage(input);
 assert.deepEqual(input,before);assert.equal(next.version,9);assert.equal(next.integrations.revision,7);
 assert.equal(next.integrations.textProvider.contextTokens,100000);assert.equal(next.integrations.textProvider.temperature,1);
 assert.ok(next.integrations.textProvider.dmStylePrompt.length>0);assert.deepEqual(next.integrations.textProvider.encryptedKey,before.integrations.textProvider.encryptedKey);
 assert.deepEqual(next.rooms,before.rooms);assert.deepEqual(next.sessions,before.sessions);
});

test('Generation settings persist independently, retain the key, reject invalid values and reach later runtime requests',async()=>{
 const f=await fixture(),bodies=[];
 const run=configuredTextProvider(f.store,f.secrets,{fetchImpl:async(_,r)=>{bodies.push(JSON.parse(r.body));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"narration":"已配置"}'}}]});}});
 const first=f.admin.updateAi(f.a.user,request(settings({contextTokens:64000,temperature:.65,dmStylePrompt:'用黑暗童话的语气，人物对白鲜明。'})));
 assert.equal(first.contextTokens,64000);assert.equal(first.temperature,.65);
 await run({system:'RULES',styleProfile:'dm',data:{}});assert.equal(bodies[0].temperature,.65);assert.match(bodies[0].messages[0].content,/黑暗童话/);
 const key=structuredClone(f.store.data.integrations.textProvider.encryptedKey);
 f.admin.updateAi(f.a.user,{...request(settings({apiKey:'',dmStylePrompt:'简洁、幽默、尊重玩家。'})),revision:1});
 assert.equal(f.admin.ai(f.a.user).contextTokens,64000);assert.equal(f.admin.ai(f.a.user).temperature,.65);assert.deepEqual(f.store.data.integrations.textProvider.encryptedKey,key);
 for(const bad of [{contextTokens:4095},{contextTokens:1000001},{contextTokens:100000.5},{temperature:-1},{temperature:2.1},{temperature:'0.8'},{dmStylePrompt:'x'.repeat(1001)}]) {
  assert.throws(()=>f.admin.updateAi(f.a.user,{...request(settings({apiKey:'',...bad})),revision:2}));
 }
 f.admin.updateAi(f.a.user,{...request(settings({apiKey:'',contextTokens:100000,temperature:null,dmStylePrompt:''})),revision:2});
 await run({system:'RULES',styleProfile:'dm',data:{}});assert.equal(Object.hasOwn(bodies.at(-1),'temperature'),false);assert.equal(bodies.at(-1).messages[0].content,'RULES');
});

test('Replaying an older settings request after style changes does not reset generation preferences',async()=>{
 const f=await fixture(),legacy=request(settings());f.admin.updateAi(f.a.user,legacy);
 f.admin.updateAi(f.a.user,{...request(settings({apiKey:'',contextTokens:100000,temperature:.8,dmStylePrompt:'新的叙事风格'})),revision:1});
 const stable=structuredClone(f.store.data.integrations),audits=f.store.data.administration.audit.length;
 const replay=f.admin.updateAi(f.a.user,legacy);
 assert.deepEqual(f.store.data.integrations,stable);assert.equal(replay.dmStylePrompt,'新的叙事风格');assert.equal(replay.temperature,.8);
 assert.equal(f.store.data.administration.audit.length,audits);
});
