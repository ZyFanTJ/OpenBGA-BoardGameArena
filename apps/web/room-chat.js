import {api} from './api.js';
import {escapeHtml as e, button as b} from './ui.js';

export const quickPhrases = ['快点吧，我等到花儿都谢了～', '让我想一想～', '打得不错！', '这局有点东西！', '谢谢，合作愉快！', '再来一局？'];
export function roomChatHtml() {
  return `<div id="table-speech" class="table-speech" role="log" aria-live="polite" aria-label="牌桌新消息"></div><aside class="chat-panel" id="room-chat" hidden><div class="chat-heading"><h2>桌边聊天</h2>${b('×','chat-toggle',false,'class="quiet" aria-label="关闭聊天"')}</div><div id="messages" role="log" aria-live="polite"></div><details class="chat-quick"><summary>快捷发言</summary><div>${quickPhrases.map((text,i)=>b(text,'chat-quick',false,`data-phrase="${i}"`)).join('')}</div></details><form id="chat"><label class="sr-only" for="message">消息</label><input id="message" name="text" maxlength="500" placeholder="说点什么…" required autocomplete="off"><button aria-label="发送消息">发送</button></form></aside>`;
}

/** Presentation only: persistent history and delivery remain owned by the room chat service. */
export function createRoomChat({root,getRoom,getUser}) {
  let roomId, seen = new Set(), unread = 0, lastId, timers = new Set();
  function panel() { return root.querySelector('#room-chat'); }
  function badge() {
    const button=root.querySelector('[aria-controls="room-chat"]');
    if (!button) return;
    button.textContent=unread ? `聊天 ${Math.min(unread,99)}${unread>99?'+':''}` : '聊天';
    button.setAttribute('aria-expanded',String(!panel()?.hidden));
    button.setAttribute('aria-label',unread ? `聊天，${unread} 条新消息` : '聊天');
  }
  function clearSpeech() { for (const timer of timers) clearTimeout(timer); timers.clear(); root.querySelector('#table-speech')?.replaceChildren(); }
  function speech(message) {
    const feed=root.querySelector('#table-speech'); if (!feed) return;
    const item=document.createElement('article'); item.className='table-speech-message';
    item.innerHTML=`<span class="table-speech-avatar" aria-hidden="true">${e(message.name.slice(0,1))}</span><div><b>${e(message.name)}</b><p>${e(message.text)}</p></div>`;
    feed.append(item);
    while (feed.children.length>3) feed.firstElementChild.remove();
    const timer=setTimeout(()=>{item.remove();timers.delete(timer);},10000);timers.add(timer);
  }
  return {
    dispose() { clearSpeech();roomId=null;seen.clear();lastId=undefined;unread=0; },
    sync() {
      const room=getRoom(), user=getUser(), messages=root.querySelector('#messages'); if (!room || !messages) return;
      const first=roomId!==room.id;
      if (first) { this.dispose();roomId=room.id; }
      const fresh=room.chat.filter(message=>!seen.has(message.id));
      for (const message of room.chat) seen.add(message.id);
      // Do not replay history on entry, reload, or reconnect to an already seen message.
      if (!first && panel().hidden) {
        unread+=fresh.filter(message=>message.userId!==user.id).length;
        fresh.slice(-3).forEach(speech);
      } else if (!panel().hidden) unread=0;
      if (seen.size>500) seen=new Set([...seen].slice(-300));
      const id=room.chat.at(-1)?.id??'empty';
      if (id!==lastId) {
        lastId=id;
        const bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80;
        messages.innerHTML=room.chat.length ? room.chat.map(message=>`<article class="message ${message.userId===user.id?'mine':''}"><div><b>${e(message.name)}</b><time>${new Date(message.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${e(message.text)}</p></article>`).join('') : '<div class="chat-empty">暂无消息</div>';
        if (bottom) messages.scrollTop=messages.scrollHeight;
      }
      badge();
    },
    toggle() {
      const box=panel();if (!box) return;
      box.hidden=!box.hidden;
      if (!box.hidden) {unread=0;clearSpeech();const messages=root.querySelector('#messages');messages.scrollTop=messages.scrollHeight;root.querySelector('#message').focus();}
      badge();
    },
    async send(text) {
      const room=getRoom();if (!room || typeof text!=='string' || !text.trim()) return;
      await api(`/rooms/${room.id}/chat`,{text:text.trim()});
    },
    async quick(index) { const text=quickPhrases[index];if (text) await this.send(text); },
  };
}
