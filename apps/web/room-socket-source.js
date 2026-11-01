/** EventSource-shaped adapter so both transports share watchdog/recovery behavior. */
export class RoomSocketSource {
 constructor(path){
  this.listeners=new Map();
  const url=new URL(path,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/watch-events$/,'watch-socket').replace(/events$/,'socket');
  this.socket=new WebSocket(url);
  this.socket.onopen=()=>this.onopen?.();
  this.socket.onmessage=event=>{try{const value=JSON.parse(event.data);if(value.type==='heartbeat'){for(const fn of this.listeners.get('heartbeat')??[])fn(event);return;}}catch{}this.onmessage?.(event);};
  this.socket.onclose=()=>this.onerror?.();this.socket.onerror=()=>this.onerror?.();
 }
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 close(){this.onopen=this.onmessage=this.onerror=null;this.socket.close();this.listeners.clear();}
}
