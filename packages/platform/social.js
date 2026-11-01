import {indexedRecords} from './record-index.js';
import {randomUUID} from 'node:crypto';
import {ensure} from './errors.js';
import {publicProfile} from './profiles.js';

const pair=(a,b)=>[a,b].sort().join(':');
export const friendshipKey=pair;
export function requireFriendship(data,user,playerId) {
 ensure(typeof playerId==='string'&&playerId!==user.id,'请选择其他好友');
 const relationship=data.friendships[pair(user.id,playerId)];
 ensure(relationship?.status==='accepted','你们已不是好友，请刷新好友列表',403);
 return relationship;
}
export class SocialService{
 constructor(store,rooms,registry,{now=()=>Date.now()}={}){this.store=store;this.rooms=rooms;this.registry=registry;this.now=now;this.presence=new Map();}
 touch(user){
  const now=this.now();this.presence.set(user.id,now);
  // Keep the exact heartbeat in memory; checkpoint at most once a minute so
  // ordinary polling does not turn into a profile write on every request.
  const profile=this.store.data.profiles[user.id];
  if(profile&&(!Number.isFinite(profile.lastSeenAt)||now-profile.lastSeenAt>=60000))this.store.transaction(data=>{
   const current=data.profiles[user.id];if(current&&(!Number.isFinite(current.lastSeenAt)||now-current.lastSeenAt>=60000))current.lastSeenAt=now;
  });
 }
 isOnline(id){const seen=this.presence.get(id);return seen!==undefined&&this.now()-seen<75000;}
 accepted(data,a,b){return data.friendships[pair(a,b)]?.status==='accepted';}
 person(id){const p=this.store.data.profiles[id];if(!p)return null;const room=this.rooms.currentRoom({id});const online=this.isOnline(id);
  const lastSeenAt=this.presence.get(id)??(Number.isFinite(p.lastSeenAt)?p.lastSeenAt:null);
  return {...publicProfile(p),handle:this.store.data.accounts[id]?.handle??null,status:online?(room?.status==='playing'?'playing':room?.status==='lobby'?'lobby':'online'):'offline',lastSeenAt,gameTitle:online&&room?this.registry.get(room.gameId).manifest.title:null};}
 search(user,query){ensure(typeof query==='string'&&query.trim().length>=2&&query.length<=32,'输入完整好友码，或至少 2 位账号字符');const q=query.trim().toLowerCase();
  return Object.values(this.store.data.profiles).filter(p=>p.id!==user.id&&(p.friendCode.toLowerCase()===q||this.store.data.accounts[p.id]?.key.startsWith(q))).slice(0,12).map(p=>({...publicProfile(p),handle:this.store.data.accounts[p.id]?.handle??null,relationship:this.store.data.friendships[pair(user.id,p.id)]?.status??'none'}));}
 list(user){const current=this.rooms.currentRoom(user);const rows=indexedRecords(this.store,'friendships','member',r=>[r.a,r.b],user.id);return {friends:rows.filter(r=>r.status==='accepted').map(r=>({...this.person(r.a===user.id?r.b:r.a),relationshipId:r.id})).sort((a,b)=>(a.status==='offline')-(b.status==='offline')||a.name.localeCompare(b.name)),requests:rows.filter(r=>r.status==='pending').map(r=>({id:r.id,from:this.person(r.from),to:this.person(r.from===r.a?r.b:r.a),incoming:r.from!==user.id,at:r.at})),invitations:this.invitations(user),currentRoom:current?{id:current.id,status:current.status}:null};}
 request(user,input){
  const target=this.store.data.profiles[input.playerId];ensure(target&&target.id===input.playerId&&target.id!==user.id,'请选择其他玩家',404);
  this.store.transaction(data=>{const key=pair(user.id,target.id);ensure(!data.friendships[key],'已经是好友，或申请仍在等待处理',409);ensure(Object.values(data.friendships).filter(r=>r.a===user.id||r.b===user.id).length<150,'好友与申请数量已达上限');data.friendships[key]={id:randomUUID(),a:user.id,b:target.id,from:user.id,status:'pending',at:this.now()};});return this.list(user);
 }
 respond(user,input){this.store.transaction(data=>{const entry=Object.entries(data.friendships).find(([,r])=>r.id===input.requestId);ensure(entry,'申请已失效',409);const [key,r]=entry;ensure((r.a===user.id||r.b===user.id)&&r.from!==user.id&&r.status==='pending','无权处理此申请',403);ensure(['accept','reject'].includes(input.action),'申请操作无效');if(input.action==='accept'){r.status='accepted';r.acceptedAt=this.now();}else delete data.friendships[key];});return this.list(user);}
 remove(user,input){this.store.transaction(data=>{const key=pair(user.id,input.playerId),r=data.friendships[key];ensure(r&&(r.a===user.id||r.b===user.id),'好友关系已不存在',409);delete data.friendships[key];for(const invite of Object.values(data.invitations))if(pair(invite.from,invite.to)===key&&invite.status==='pending')invite.status='cancelled';});return this.list(user);}
 invite(user,input){
  this.store.transaction(data=>{ensure(this.accepted(data,user.id,input.playerId),'只能邀请好友',403);const room=data.rooms[input.roomId];ensure(room&&room.players.some(p=>p.id===user.id&&!p.isBot),'你不在此房间',403);ensure(room.revision===input.revision,'房间已更新，请刷新重试',409);ensure(room.status==='lobby'&&room.players.length<this.registry.get(room.gameId).manifest.maxPlayers,'房间已开局或已满',409);ensure(!room.players.some(p=>p.id===input.playerId),'好友已经在房间中');
   const existing=Object.values(data.invitations).find(i=>i.from===user.id&&i.to===input.playerId&&i.roomId===room.id&&i.status==='pending'&&i.expiresAt>this.now());if(existing)return;
   const id=randomUUID();data.invitations[id]={id,from:user.id,to:input.playerId,roomId:room.id,status:'pending',at:this.now(),expiresAt:this.now()+600000};
  });return this.list(user);
 }
 invitations(user){return indexedRecords(this.store,'invitations','recipient',i=>[i.to],user.id).filter(i=>i.status==='pending'&&i.expiresAt>this.now()&&this.accepted(this.store.data,i.from,i.to)).map(i=>{const r=this.store.data.rooms[i.roomId];if(!r||!r.players.some(p=>p.id===i.from&&!p.isBot)||r.status!=='lobby'||r.players.length>=this.registry.get(r.gameId).manifest.maxPlayers)return null;return {id:i.id,from:this.person(i.from),expiresAt:i.expiresAt,room:{id:r.id,title:r.title,gameTitle:this.registry.get(r.gameId).manifest.title,revision:r.revision,count:r.players.length,maxPlayers:this.registry.get(r.gameId).manifest.maxPlayers}};}).filter(Boolean);}
 acceptInvite(user,input){
  ensure(Number.isInteger(input.roomRevision),'请刷新邀请后重试',409);
  const invite=this.store.data.invitations[input.invitationId];ensure(invite&&invite.to===user.id,'邀请不存在',404);
  return this.rooms.join(user,invite.roomId,{revision:input.roomRevision,authorize:data=>{const i=data.invitations[input.invitationId];ensure(i?.status==='pending'&&i.to===user.id&&i.expiresAt>this.now()&&this.accepted(data,i.from,i.to)&&data.rooms[i.roomId].players.some(p=>p.id===i.from&&!p.isBot),'邀请已失效',409);i.status='accepted';}});
 }
 dismissInvite(user,input){this.store.transaction(data=>{const i=data.invitations[input.invitationId];ensure(i&&i.to===user.id,'邀请不存在',404);i.status='declined';});return this.list(user);}
}
