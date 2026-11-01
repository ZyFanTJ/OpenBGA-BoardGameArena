/** Wall-clock owner for opt-in real-time games. Rules remain synchronous and pure.
 * Every checkpoint is committed before it is acknowledged or broadcast. */
export class RealtimeRunner {
 constructor(rooms,{onError=console.error,clock=globalThis,now=()=>performance.now()}={}){this.rooms=rooms;this.onError=onError;this.clock=clock;this.now=now;this.entries=new Map();this.stopped=false;}
 sync(id){
  const room=this.rooms.store.data.rooms[id],game=room&&this.rooms.registry.get(room.gameId);
  const active=!this.stopped&&room?.status==='playing'&&!room.dissolution&&game?.realtime;
  const old=this.entries.get(id);
  if(!active){if(old)this.clock.clearTimeout(old.timer);this.entries.delete(id);return;}
  if(old?.matchId===room.matchId)return;
  if(old)this.clock.clearTimeout(old.timer);
  const entry={matchId:room.matchId,timer:null,nextAt:this.now()+game.realtime.commitMs,failures:0};this.entries.set(id,entry);
  const run=()=>{
   if(this.stopped||this.entries.get(id)!==entry)return;
   const current=this.rooms.store.data.rooms[id];
   if(!current||current.matchId!==entry.matchId||current.status!=='playing'||current.dissolution){this.sync(id);return;}
   try{this.rooms.advanceRealtime(id,{revision:current.revision,matchId:entry.matchId,steps:Math.round(game.realtime.commitMs/game.realtime.stepMs)});entry.failures=0;}
   catch(error){entry.failures++;this.onError(error);}
   // Compensate ordinary work time without replaying a suspended server's wall clock.
   const now=this.now();entry.nextAt+=game.realtime.commitMs;
   if(entry.nextAt<=now||entry.failures)entry.nextAt=now+Math.min(5000,game.realtime.commitMs*2**Math.min(entry.failures,5));
   if(this.entries.get(id)===entry)entry.timer=this.clock.setTimeout(run,Math.max(1,entry.nextAt-now));
   entry.timer?.unref?.();
  };
  entry.timer=this.clock.setTimeout(run,game.realtime.commitMs);entry.timer?.unref?.();
 }
 resume(){this.stopped=false;for(const id of Object.keys(this.rooms.store.data.rooms))this.sync(id);}
 stop(){this.stopped=true;for(const e of this.entries.values())this.clock.clearTimeout(e.timer);this.entries.clear();}
}
