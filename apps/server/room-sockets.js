import {WebSocketServer,WebSocket} from 'ws';
/** Authenticated room transport. Its only state is connections and backpressure. */
export class RoomSockets {
 constructor(server,rooms,sessions,{maxBuffered=256*1024,heartbeatMs=20000}={}){
  this.rooms=rooms;this.sessions=sessions;this.maxBuffered=maxBuffered;this.clients=new Set();
  this.wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  this.upgrade=(req,socket,head)=>{
   const reject=status=>{socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);};
   try{
    const url=new URL(req.url,'http://local'),match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{8})\/(socket|watch-socket)$/);
    if(!match)return reject(404);
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reject(403);
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('moon_session='))?.slice(13),user=sessions.authenticate(token);
    const id=match[1],spectator=match[2]==='watch-socket';
    const snapshot=spectator?rooms.watch(id,user):rooms.snapshot(id,user);
    if([...this.clients].filter(c=>c.id===id&&c.user.id===user.id).length>=5)return reject(429);
    this.wss.handleUpgrade(req,socket,head,ws=>{
     const client={ws,id,user,token,spectator,alive:true,blockedAt:0};this.clients.add(client);
     ws.on('close',()=>this.clients.delete(client));ws.on('error',()=>ws.terminate());ws.on('pong',()=>{client.alive=true;});
     // Commands keep the existing authenticated, rate-limited HTTP transaction boundary.
     ws.on('message',()=>ws.close(1008,'This connection only carries room updates'));
     this.send(client,snapshot);
    });
   }catch(error){reject(error.status??400);}
  };
  server.on('upgrade',this.upgrade);this.server=server;
  this.timer=setInterval(()=>{for(const client of this.clients){try{this.authorize(client);if(!client.alive){client.ws.terminate();continue;}client.alive=false;client.ws.ping();this.send(client,{type:'heartbeat',at:Date.now()});}catch{client.ws.close(1008,'Session expired');}}},heartbeatMs);this.timer.unref?.();
 }
 authorize(c){const user=this.sessions.authenticate(c.token);if(user.id!==c.user.id)throw Object.assign(new Error('会话已变化'),{status:401});if(c.spectator)this.rooms.canWatch(c.id);else this.rooms.member(this.rooms.room(c.id),c.user);}
 send(c,event){if(c.ws.readyState!==WebSocket.OPEN)return;if(c.ws.bufferedAmount>this.maxBuffered){c.blockedAt||=Date.now();if(Date.now()-c.blockedAt>5000)c.ws.close(1013,'Reconnect for current state');return;}c.blockedAt=0;c.ws.send(JSON.stringify(event));}
 publish(id,transition,update){
  for(const c of this.clients){if(c.id!==id)continue;try{
   this.authorize(c);if(update?.type==='closed'){this.send(c,{id,left:true,reason:update.reason});c.ws.close();continue;}
   if(c.ws.bufferedAmount>this.maxBuffered){this.send(c,null);continue;}
   const snapshot=c.spectator?this.rooms.watch(id,c.user):this.rooms.snapshot(id,c.user,transition);
   // Full projected snapshots are independently recoverable after dropped slow-client frames.
   if(update?.type==='realtime')snapshot.realtimeFrame=true;
   this.send(c,snapshot);
  }catch(error){if([403,404].includes(error.status))this.send(c,{id,left:true,reason:this.rooms.store.data.rooms[id]?'left':'dissolved'});c.ws.close(1008,'Room access expired');}}
 }
 close(){clearInterval(this.timer);this.server.off('upgrade',this.upgrade);for(const c of this.clients)c.ws.terminate();this.clients.clear();this.wss.close();}
}
