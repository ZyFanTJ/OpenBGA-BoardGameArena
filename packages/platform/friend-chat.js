import {randomUUID} from 'node:crypto';
import {ensure} from './errors.js';
import {boundedText,validateRequestId} from './validation.js';
import {requireFriendship} from './social.js';

/** Private conversations belong to one accepted friendship, never to a room. */
export class FriendChatService {
  constructor(store,social,{now=()=>Date.now()}={}) {this.store=store;this.social=social;this.now=now;}
  summary(user,playerId) {
    const relationship=requireFriendship(this.store.data,user,playerId),chat=this.store.data.friendConversations[relationship.id];
    return {unread:chat?.messages.filter(m=>m.from!==user.id&&m.sequence>(chat.read[user.id]??0)).length??0,lastMessage:chat?.messages.at(-1)??null};
  }
  list(user,playerId,{before}={}) {
    const relationship=requireFriendship(this.store.data,user,playerId),chat=this.store.data.friendConversations[relationship.id];
    const cursor=before===undefined?Infinity:Number(before);
    ensure(cursor===Infinity||Number.isSafeInteger(cursor)&&cursor>0,'消息游标无效');
    const available=(chat?.messages??[]).filter(m=>m.sequence<cursor),messages=available.slice(-50);
    return {peer:this.social.person(playerId),messages,nextBefore:available.length>50?messages[0].sequence:null,latestSequence:(chat?.nextSequence??1)-1,...this.summary(user,playerId)};
  }
  send(user,playerId,input) {
    const text=boundedText(input.text,500);validateRequestId(input.requestId);
    let message;
    this.store.transaction(data=>{
      const relationship=requireFriendship(data,user,playerId);
      const chat=data.friendConversations[relationship.id]??={id:relationship.id,members:[relationship.a,relationship.b],messages:[],nextSequence:1,read:{}};
      const previous=chat.messages.find(m=>m.from===user.id&&m.requestId===input.requestId);
      if(previous){ensure(previous.text===text,'此消息标识已用于其他内容',409);message=previous;return;}
      const last=chat.messages.findLast(m=>m.from===user.id);
      ensure(!last||this.now()-last.at>=500,'消息发送太快，请稍后再试',429);
      message={id:randomUUID(),sequence:chat.nextSequence++,from:user.id,text,at:this.now(),requestId:input.requestId};
      chat.messages.push(message);chat.messages=chat.messages.slice(-200);
    });
    return {message};
  }
  read(user,playerId,input) {
    this.store.transaction(data=>{
      const relationship=requireFriendship(data,user,playerId),chat=data.friendConversations[relationship.id];
      ensure(Number.isSafeInteger(input.through)&&input.through>=0&&input.through<(chat?.nextSequence??1),'已读位置无效');
      if(chat)chat.read[user.id]=Math.max(chat.read[user.id]??0,input.through);
    });
    return this.summary(user,playerId);
  }
}
