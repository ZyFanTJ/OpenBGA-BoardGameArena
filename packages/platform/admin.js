import {ensure} from './errors.js';
import {ownProfile,profileDetails} from './profiles.js';
import {boundedText} from './validation.js';
import {userAccess,requireAdmin} from './access.js';
import {systemSettings,validateSettings} from './system.js';
import {cosmetics} from './economy.js';
import {matchVisibleTo} from './records.js';
import {createHash,randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {password as validatePassword} from './accounts.js';
const derive=promisify(scrypt);
import {textProviderView,validateTextProvider} from './integrations.js';

const pageQuery=query=>{
 const page=Number(query.page??1);ensure(Number.isSafeInteger(page)&&page>=1&&page<=100000,'页码无效');
 ensure(query.q===undefined||typeof query.q==='string'&&query.q.length<=100,'搜索内容最多 100 字');
 return {page,q:(query.q??'').trim().toLowerCase(),size:20};
};
const paginate=(rows,page,size)=>({items:rows.slice((page-1)*size,page*size),page,total:rows.length,pages:Math.max(1,Math.ceil(rows.length/size))});
const stripTransaction=t=>({id:t.id,kind:t.kind,amount:t.amount,balance:t.balance,at:t.at,itemId:t.itemId??null,matchId:t.matchId??null,reason:t.kind==='admin'?t.reason:null});

/** Owns privileged account operations, system configuration and their audit trail. */
export class AdminService{
 constructor(store,{social,now=()=>Date.now(),providerSecrets,registry}={}){this.store=store;this.social=social;this.now=now;this.providerSecrets=providerSecrets;this.registry=registry;}
 bootstrap(handle){
  if(!handle)return;
  ensure(typeof handle==='string'&&/^[a-zA-Z0-9_]{3,24}$/.test(handle),'初始管理员账号无效');
  this.store.transaction(data=>{
   const account=Object.values(data.accounts).find(a=>a.key===handle.toLowerCase());ensure(account,'初始管理员必须是已注册账号');
   const active=Object.entries(data.administration.users).filter(([id,a])=>a.role==='admin'&&!a.disabled&&data.accounts[id]);
   if(active.some(([id])=>id===account.id))return;
   if(active.length)return;
   const before=userAccess(data,account.id);ensure(!before.disabled,'初始管理员账号已停用');
   data.administration.users[account.id]={...before,role:'admin',revision:before.revision+1};
   data.administration.audit.push({id:`bootstrap:${account.id}`,action:'bootstrap',actorId:null,targetId:account.id,at:this.now(),reason:'服务启动时绑定初始管理员',before:{role:before.role},after:{role:'admin'}});
  });
 }
 row(id){
  const data=this.store.data,p=data.profiles[id],account=data.accounts[id],access=userAccess(data,id);
  const sessions=Object.values(data.sessions).filter(s=>s.id===id&&this.now()-s.createdAt<=2592000000);
  const room=Object.values(data.rooms).find(r=>r.players.some(x=>x.id===id&&!x.isBot));
  return {id,name:p.name,handle:account?.handle??null,registered:!!account,friendCode:p.friendCode,credits:p.credits,createdAt:p.createdAt,
   role:access.role,disabled:access.disabled,accessRevision:access.revision,revision:p.revision,
   status:access.disabled?'disabled':this.social?.person(id)?.status??'offline',
   lastActiveAt:Math.max(this.social?.presence.get(id)??0,...sessions.map(s=>s.createdAt))||null,
   sessionCount:sessions.length,inventoryCount:p.inventory.length,room:room?{id:room.id,title:room.title,status:room.status,gameId:room.gameId}:null};
 }
 overview(user){
  requireAdmin(this.store.data,user);const data=this.store.data,rows=Object.keys(data.profiles).map(id=>this.row(id));
  return {counts:{users:rows.length,registered:rows.filter(p=>p.registered).length,online:rows.filter(p=>!['offline','disabled'].includes(p.status)).length,disabled:rows.filter(p=>p.disabled).length,rooms:Object.keys(data.rooms).length,playing:Object.values(data.rooms).filter(r=>r.status==='playing').length,credits:rows.reduce((n,p)=>n+p.credits,0),matches:Object.values(data.matches).filter(m=>m.historyOwnerId===undefined).length},newUsers:[...rows].sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)).slice(0,5),audit:this.audit(user,{page:1}).items.slice(0,5),settings:{revision:data.system.revision,settings:systemSettings(data)},storageVersion:data.version};
 }
 users(user,query={}){
  requireAdmin(this.store.data,user);const {page,q,size}=pageQuery(query),filter=query.filter??'all';
  ensure(['all','registered','guest','admin','disabled','online'].includes(filter),'用户筛选无效');
  const rows=Object.keys(this.store.data.profiles).map(id=>this.row(id)).filter(p=>(!q||[p.id,p.name,p.handle,p.friendCode].some(v=>v?.toLowerCase().includes(q)))&&(filter==='all'||filter==='registered'&&p.registered||filter==='guest'&&!p.registered||filter==='admin'&&p.role==='admin'||filter==='disabled'&&p.disabled||filter==='online'&&!['offline','disabled'].includes(p.status)));
  const sort=query.sort??'newest';ensure(['newest','credits','active'].includes(sort),'用户排序无效');
  rows.sort((a,b)=>(sort==='credits'?b.credits-a.credits:sort==='active'?(b.lastActiveAt??0)-(a.lastActiveAt??0):b.createdAt-a.createdAt)||a.id.localeCompare(b.id));
  return paginate(rows,page,size);
 }
 detail(user,id){
  requireAdmin(this.store.data,user);const data=this.store.data;ensure(data.profiles[id],'用户不存在',404);
  const p=data.profiles[id];
  return {...this.row(id),profile:ownProfile(data,id),accountCreatedAt:data.accounts[id]?.createdAt??null,collection:p.inventory.map(key=>{const item=cosmetics.find(c=>c.id===key);return {id:key,name:item?.name??key,type:item?.type??'unknown',equipped:Object.values(p.equipped).includes(key)};}),
   friends:Object.values(data.friendships).filter(r=>r.status==='accepted'&&(r.a===id||r.b===id)).length,
   matches:Object.values(data.matches).filter(m=>matchVisibleTo(m,id)&&m.participants.some(p=>p.id===id&&!p.isBot)).sort((a,b)=>b.recordedAt-a.recordedAt).slice(0,10).map(m=>({id:m.id,title:m.gameTitle,at:m.endedAt??m.recordedAt,practice:m.practice,own:m.participants.find(p=>p.id===id)})),
   transactions:Object.values(data.transactions).filter(t=>t.userId===id).sort((a,b)=>b.at-a.at).slice(0,20).map(stripTransaction)};
 }
 audit(user,query={}){
  requireAdmin(this.store.data,user);const {page,q,size}=pageQuery(query);
  const rows=[...this.store.data.administration.audit].reverse().map(a=>({id:a.id,action:a.action,actorId:a.actorId,actorName:this.store.data.profiles[a.actorId]?.name??'系统',targetId:a.targetId,targetName:this.store.data.profiles[a.targetId]?.name??(a.action==='settings'?'系统设置':a.action==='ai'?'AI DM':'未知用户'),reason:a.reason,before:structuredClone(a.before),after:structuredClone(a.after),at:a.at}));
  return paginate(rows.filter(r=>!q||[r.actorName,r.targetName,r.reason,r.action].some(v=>v.toLowerCase().includes(q))),page,size);
 }
 settings(user){requireAdmin(this.store.data,user);return {revision:this.store.data.system.revision,settings:systemSettings(this.store.data),games:this.registry?.list().map(g=>({id:g.id,title:g.title,minPlayers:g.minPlayers,maxPlayers:g.maxPlayers}))??[]};}
 ai(user){requireAdmin(this.store.data,user);return textProviderView(this.store.data);}
 updateAi(user,input){
  requireAdmin(this.store.data,user);const value=validateTextProvider(input.settings,this.store.data.integrations.textProvider);
  const fingerprint={...value,apiKey:value.apiKey?createHash('sha256').update(value.apiKey).digest('hex'):''};
  for(const key of ['contextTokens','temperature','dmStylePrompt'])if(!Object.hasOwn(input.settings,key))delete fingerprint[key];
  this.write(user,input,'ai',null,fingerprint,data=>{
   ensure(data.integrations.revision===input.revision,'AI 服务设置已更新，请重新载入',409);
   const before=textProviderView(data),old=data.integrations.textProvider;
   const encryptedKey=value.clearApiKey?null:value.apiKey?this.providerSecrets?.seal(value.apiKey):old.encryptedKey;
   ensure(!value.apiKey||encryptedKey,'密钥存储尚未就绪');
   ensure(!value.enabled||value.model&&encryptedKey,'启用 AI DM 前请填写模型并保存密钥');
   data.integrations={revision:data.integrations.revision+1,textProvider:{enabled:value.enabled,baseUrl:value.baseUrl,model:value.model,encryptedKey,contextTokens:value.contextTokens,temperature:value.temperature,dmStylePrompt:value.dmStylePrompt}};
   return {before,after:{...textProviderView(data),keyAction:value.clearApiKey?'已清除':value.apiKey?'已替换':'保留'}};
  });return this.ai(user);
 }
 write(user,input,action,targetId,value,update){
  ensure(typeof input.requestId==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId),'管理请求标识无效');
  ensure(input.reason===undefined||typeof input.reason==='string'&&(input.reason??'').trim().length<=200,'操作备注最多 200 字');
  const reason=(input.reason??'').trim(),signature=JSON.stringify({action,targetId,value,reason}),id=`admin:${user.id}:${input.requestId}`;
  this.store.transaction(data=>{
   requireAdmin(data,user);
   const previous=data.administration.audit.find(a=>a.id===id);
   if(previous){ensure(previous.signature===signature,'请勿复用管理请求',409);return;}
   const change=update(data,id);
   data.administration.audit.push({id,action,actorId:user.id,targetId,reason,signature,at:this.now(),...change});
  });
 }
 credits(user,id,input){
  requireAdmin(this.store.data,user);
  ensure(['set','add'].includes(input.mode)&&Number.isSafeInteger(input.amount)&&Math.abs(input.amount)<=1000000000,'星辉数额或调整方式无效');
  this.write(user,input,'credits',id,{mode:input.mode,amount:input.amount},(data,requestId)=>{
   const p=data.profiles[id];ensure(p,'用户不存在',404);ensure(p.revision===input.revision,'用户资产已更新，请重新查看后调整',409);
   const before=p.credits,after=input.mode==='set'?input.amount:before+input.amount;
   ensure(Number.isSafeInteger(after)&&after>=0&&after<=1000000000,'星辉余额需在 0–1000000000 之间');
   ensure(before!==after,'星辉余额没有变化');p.credits=after;p.revision++;
   data.transactions[requestId]={id:requestId,userId:id,kind:'admin',actorId:user.id,reason:(input.reason??'').trim(),amount:after-before,balance:after,at:this.now()};
   return {before:{credits:before},after:{credits:after}};
  });return this.detail(user,id);
 }
 profile(user,id,input){
  requireAdmin(this.store.data,user);const name=boundedText(input.name,24);
  ensure(typeof input.bio==='string'&&input.bio.length<=160,'个人简介最多 160 个字符');
  const bio=input.bio.replace(/\r\n?/g,'\n').trim();ensure(!/[\x00-\x08\x0b-\x1f\x7f]/.test(bio),'个人简介包含无效字符');
  this.write(user,input,'profile',id,{name,bio},data=>{
   const p=data.profiles[id];ensure(p,'用户不存在',404);ensure(p.revision===input.revision,'用户资料已更新，请重新载入',409);
   const details=profileDetails(p),before={name:p.name,bio:details.bio};ensure(before.name!==name||before.bio!==bio,'用户资料没有变化');
   p.name=name;p.details={...details,bio};p.revision++;
   return {before,after:{name,bio}};
  });return this.detail(user,id);
 }
 async password(user,id,input){
  requireAdmin(this.store.data,user);
  ensure(this.store.data.accounts[id],'只能为注册用户重置密码');
  const salt=randomBytes(16).toString('hex');
  const digest=(await derive(validatePassword(input.password),salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024})).toString('hex');
  // Request IDs represent one reset operation. Retries never apply another password.
  this.write(user,input,'password',id,{accessRevision:input.accessRevision},data=>{
   const account=data.accounts[id],access=userAccess(data,id);
   ensure(account,'注册账号不存在',404);
   ensure(access.revision===input.accessRevision,'账号状态已更新，请重新查看',409);
   data.accounts[id]={...account,salt,digest};
   for(const [key,session]of Object.entries(data.sessions))if(session.id===id)delete data.sessions[key];
   data.administration.users[id]={...access,revision:access.revision+1};
   return {before:{passwordChanged:false},after:{passwordChanged:true}};
  });return this.detail(user,id);
 }
 access(user,id,input){
  requireAdmin(this.store.data,user);ensure(['role','disabled','sessions'].includes(input.action),'用户管理操作无效');
  if(input.action==='role')ensure(['player','admin'].includes(input.value),'角色无效');
  if(input.action==='disabled')ensure(typeof input.value==='boolean','账号状态无效');
  this.write(user,input,input.action,id,input.action==='sessions'?null:input.value,data=>{
   ensure(data.profiles[id],'用户不存在',404);const access=userAccess(data,id);
   ensure(access.revision===input.accessRevision,'权限或状态已更新，请重新查看',409);
   if(input.action==='sessions'){
    const keys=Object.entries(data.sessions).filter(([,s])=>s.id===id).map(([key])=>key);ensure(keys.length,'该用户没有可撤销的会话');
    keys.forEach(key=>delete data.sessions[key]);data.administration.users[id]={...access,revision:access.revision+1};return {before:{sessions:keys.length},after:{sessions:0}};
   }
   const field=input.action,value=input.value;ensure(access[field]!==value,'账号状态没有变化');
   ensure(!(id===user.id&&(field==='role'&&value==='player'||field==='disabled'&&value)),'不能移除自己的管理权限或停用自己');
   if(field==='role'&&value==='admin')ensure(data.accounts[id],'请先让该用户绑定注册账号');
   const next={...access,[field]:value,revision:access.revision+1};
   if(access.role==='admin'&&!access.disabled&&(next.role!=='admin'||next.disabled))ensure(Object.entries(data.administration.users).some(([other,a])=>other!==id&&a.role==='admin'&&!a.disabled&&data.accounts[other]),'至少保留一位可用管理员');
   data.administration.users[id]=next;
   if(field==='disabled'&&value)for(const [key,s]of Object.entries(data.sessions))if(s.id===id)delete data.sessions[key];
   return {before:{[field]:access[field]},after:{[field]:value}};
  });return this.detail(user,id);
 }
 updateSettings(user,input){
  requireAdmin(this.store.data,user);const settings=validateSettings(input.settings,this.registry,systemSettings(this.store.data));
  this.write(user,input,'settings',null,settings,data=>{
   ensure(data.system.revision===input.revision,'系统设置已更新，请重新载入',409);
   const before=systemSettings(data);ensure(JSON.stringify(before)!==JSON.stringify(settings),'系统设置没有变化');
   data.system={revision:data.system.revision+1,settings};return {before,after:settings};
  });return this.settings(user);
 }
}
