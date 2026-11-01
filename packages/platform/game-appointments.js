import {randomUUID} from 'node:crypto';
import {ensure} from './errors.js';
import {gameEnabled} from './system.js';
import {indexedRecords} from './record-index.js';
import {friendshipKey,requireFriendship} from './social.js';
import {validateRequestId} from './validation.js';

const MINUTE=60000,DAY=24*60*MINUTE;
/** Scheduling owns proposals and replies; room creation/join stays with rooms. */
export class GameAppointmentService {
  constructor(store,social,registry,{now=()=>Date.now()}={}) {this.store=store;this.social=social;this.registry=registry;this.now=now;}
  status(row,data=this.store.data) {
    if(!['pending','accepted'].includes(row.status))return row.status;
    const relationship=data.friendships[friendshipKey(row.from,row.to)];
    if(relationship?.id!==row.relationshipId||relationship.status!=='accepted')return 'cancelled';
    if(this.now()>=(row.startsAt+(row.status==='accepted'?120*MINUTE:0)))return 'expired';
    return row.status;
  }
  rows(user) {return indexedRecords(this.store,'gameAppointments','member',r=>[r.from,r.to],user.id);}
  view(user,row) {
    const status=this.status(row);
    return {id:row.id,from:row.from,to:row.to,peer:this.social.person(row.from===user.id?row.to:row.from),gameId:row.gameId,gameTitle:row.gameTitle,startsAt:row.startsAt,note:row.note,status,revision:row.revision,incoming:row.to===user.id,canPlay:status==='accepted'&&this.now()>=row.startsAt-15*MINUTE,updatedAt:row.updatedAt};
  }
  list(user,{playerId}={}) {
    if(playerId)requireFriendship(this.store.data,user,playerId);
    const rows=this.rows(user).filter(r=>!playerId||r.from===playerId||r.to===playerId);
    const active=rows.filter(r=>['pending','accepted'].includes(this.status(r))).sort((a,b)=>a.startsAt-b.startsAt);
    const history=rows.filter(r=>!['pending','accepted'].includes(this.status(r))).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,20);
    return {appointments:[...active,...history].map(r=>this.view(user,r))};
  }
  summary(user) {
    const rows=this.rows(user);
    return {pending:rows.filter(r=>r.to===user.id&&this.status(r)==='pending').length,due:rows.filter(r=>this.status(r)==='accepted'&&this.now()>=r.startsAt-15*MINUTE).length};
  }
  create(user,input) {
    validateRequestId(input.requestId);
    ensure(typeof input.note==='string'&&input.note.trim().length<=200,'预约留言最多 200 字');
    const game=this.registry.list().find(g=>g.id===input.gameId);ensure(game,'请选择有效的游戏');
    let id;
    this.store.transaction(data=>{
      const relationship=requireFriendship(data,user,input.playerId);
      const rows=this.rows(user).map(r=>data.gameAppointments[r.id]);
      const previous=rows.find(r=>r.from===user.id&&r.requestId===input.requestId);
      if(previous){ensure(previous.to===input.playerId&&previous.startsAt===input.startsAt&&previous.gameId===input.gameId&&previous.note===input.note.trim(),'此预约标识已用于其他内容',409);id=previous.id;return;}
      ensure(gameEnabled(data,game.id),'此游戏暂未上线，无法预约',403);
      ensure(Number.isSafeInteger(input.startsAt)&&input.startsAt>=this.now()+5*MINUTE&&input.startsAt<=this.now()+30*DAY,'请选择 5 分钟后至 30 天内的时间');
      ensure(rows.filter(r=>(r.from===user.id||r.to===user.id)&&['pending','accepted'].includes(this.status(r,data))).length<20,'未结束的预约已达 20 条，请先处理已有预约');
      ensure(rows.filter(r=>r.relationshipId===relationship.id&&['pending','accepted'].includes(this.status(r,data))).length<5,'与这位好友已有 5 条预约，请先处理已有预约');
      id=randomUUID();data.gameAppointments[id]={id,relationshipId:relationship.id,from:user.id,to:input.playerId,gameId:game.id,gameTitle:game.title,startsAt:input.startsAt,note:input.note.trim(),status:'pending',revision:0,at:this.now(),updatedAt:this.now(),requestId:input.requestId};
    });
    return this.view(user,this.store.data.gameAppointments[id]);
  }
  respond(user,id,input) {
    this.store.transaction(data=>{
      const row=data.gameAppointments[id];ensure(row&&(row.from===user.id||row.to===user.id),'预约不存在',404);
      ensure(Number.isSafeInteger(input.revision)&&row.revision===input.revision,'预约已更新，请刷新后重试',409);
      ensure(['accept','decline','cancel'].includes(input.action),'预约操作无效');
      const status=this.status(row,data);
      ensure(['pending','accepted'].includes(status),'预约已结束或失效',409);
      if(input.action==='cancel')ensure(row.from===user.id||status==='accepted','只有发起人可以撤回待确认预约',403);
      else {ensure(row.to===user.id,'只有收到预约的好友可以回复',403);ensure(status==='pending','预约已经处理',409);}
      if(input.action==='accept')ensure(gameEnabled(data,row.gameId),'此游戏已下线，无法接受预约',403);
      row.status={accept:'accepted',decline:'declined',cancel:'cancelled'}[input.action];row.revision++;row.updatedAt=this.now();
    });
    return this.view(user,this.store.data.gameAppointments[id]);
  }
}
