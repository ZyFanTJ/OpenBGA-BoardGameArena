import {api,parseRoomEvent} from './api.js';
import {RoomSocketSource} from './room-socket-source.js';

/** Owns one room stream, heartbeat watchdog and bounded reconnection lifecycle. */
export function createRoomConnection({id,receive,status,spectator=false,socket=false,request=api,Source=socket?RoomSocketSource:EventSource,events=window,page=document,online=()=>navigator.onLine,now=()=>Date.now(),clock=globalThis}) {
  let channel,stopped=false,retry,watchdog,attempt=0,lastSeen=now(),generation=0;
  function closeChannel(){generation++;channel?.close();channel=null;}
  function stop(){stopped=true;closeChannel();clock.clearTimeout(retry);clock.clearInterval(watchdog);events.removeEventListener('online',resume);events.removeEventListener('offline',offline);page.removeEventListener('visibilitychange',visible);}
  function failed(){
    if(stopped)return;
    closeChannel();clock.clearTimeout(retry);
    status(online()?'reconnecting':'offline');
    if(online())retry=clock.setTimeout(()=>void open(true),Math.min(1500*2**Math.min(attempt++,4),15000));
  }
  async function open(recover=false){
    if(stopped)return;
    clock.clearTimeout(retry);closeChannel();const token=generation;
    if(!online()){status('offline');return;}
    status(recover?'reconnecting':'connecting');lastSeen=now();
    if(recover){
      try {const snapshot=await request(`/rooms/${id}${spectator?"/watch":""}`);if(stopped||token!==generation)return;receive(snapshot,{resetPresentation:true,resetAnimations:true});}
      catch(error){
        if(stopped||token!==generation)return;
        if(error.status===401){status('expired');stop();return;}
        if(error.status===403||error.status===404){receive({id,left:true,reason:error.status===404?'dissolved':'left'});stop();return;}
        failed();return;
      }
    }
    if(stopped||token!==generation)return;
    const source=new Source(`/api/rooms/${id}/${spectator?"watch-events":"events"}?protocol=2`);channel=source;let initial=true;
    const current=()=>!stopped&&source===channel;
    source.onopen=()=>{if(current()){lastSeen=now();status('syncing');}};
    source.addEventListener('heartbeat',()=>{if(current()){lastSeen=now();}});
    source.onmessage=event=>{
      if(!current())return;
      const snapshot=parseRoomEvent(event.data);
      if(!snapshot||receive(snapshot,{resetPresentation:initial})===false){failed();return;}
      if(!current())return;
      lastSeen=now();initial=false;attempt=0;status('connected');
    };
    source.onerror=()=>{if(current())failed();};
  }
  function offline(){if(stopped)return;closeChannel();clock.clearTimeout(retry);status('offline');}
  function resume(){if(!stopped)void open(true);}
  function visible(){if(page.visibilityState==='visible'&&(now()-lastSeen>45000||!channel))resume();}
  events.addEventListener('online',resume);events.addEventListener('offline',offline);page.addEventListener('visibilitychange',visible);
  watchdog=clock.setInterval(()=>{if(!stopped&&channel&&now()-lastSeen>45000)failed();},5000);
  void open();
  return {close:stop,reconnect:resume};
}
