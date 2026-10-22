import {ensure} from './errors.js';

export const turnLimits=[0,30,60,120,300];
export function validateTurnSeconds(value,game){
 ensure(Number.isInteger(value)&&turnLimits.includes(value),'操作时限请选择不限时、30、60、120 或 300 秒');
 ensure(value===0||typeof game.turn==='function'&&typeof game.timeout==='function','此游戏暂不支持操作时限');
 return value;
}
export function turnWindow(room,game){return room.status==='playing'&&room.game&&game.turn?game.turn(room.game):null;}
/** Clock maintenance inside the room transaction. Intermediate commands never buy extra time. */
export function syncTurnClock(room,game,now){
 const window=turnWindow(room,game);
 if(!room.turnSeconds||!window||!window.players.some(id=>room.players.some(p=>p.id===id&&!p.isBot))){room.turnClock=null;return;}
 if(room.turnClock?.key!==window.key)room.turnClock={key:window.key,deadlineAt:now+room.turnSeconds*1000,pausedAt:null};
 const clock=room.turnClock;
 if(room.dissolution&&clock.pausedAt===null)clock.pausedAt=now;
 else if(!room.dissolution&&clock.pausedAt!==null){clock.deadlineAt+=now-clock.pausedAt;clock.pausedAt=null;}
}
export function turnView(room,game,viewerId,now){
 const window=turnWindow(room,game),clock=room.turnClock;
 return {key:window?.key??null,seconds:room.turnSeconds??0,serverNow:now,required:!!window?.players.includes(viewerId),
  playerIds:window?.players??[],deadlineAt:clock?.deadlineAt??null,paused:!!room.dissolution,
  remainingMs:clock?Math.max(0,clock.deadlineAt-(clock.pausedAt??now)):null,
  lastTimeout:room.lastTimeout?{revision:room.lastTimeout.revision,playerIds:[...room.lastTimeout.playerIds],at:room.lastTimeout.at}:null};
}

/** Owns wall-clock scheduling; room transactions own validation and persistence. */
export class TurnRunner{
 constructor(rooms,{onError=console.error}={}){this.rooms=rooms;this.onError=onError;this.timers=new Map();this.stopped=false;}
 sync(id){
  clearTimeout(this.timers.get(id));this.timers.delete(id);
  const room=this.rooms.store.data.rooms[id],clock=room?.turnClock;
  if(this.stopped||room?.status!=='playing'||room.dissolution||!clock)return;
  const {revision}=room,{key,deadlineAt}=clock;
  const timer=setTimeout(()=>{
   this.timers.delete(id);
   if(this.stopped)return;
   try{this.rooms.expireTurn(id,{revision,key,deadlineAt});this.sync(id);}catch(error){this.onError(error);}
  },Math.min(2147483647,Math.max(0,deadlineAt-this.rooms.now())));
  timer.unref?.();this.timers.set(id,timer);
 }
 resume(){for(const id of Object.keys(this.rooms.store.data.rooms))this.sync(id);}
 stop(){this.stopped=true;for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();}
}
