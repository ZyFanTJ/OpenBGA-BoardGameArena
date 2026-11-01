import {api} from '../api.js';
import {escapeHtml as e} from '../ui.js';
import {avatar} from './cosmetics.js';
import {icon} from '../icons.js';

const button=(label,action,attrs='')=>`<button type="button" data-action="hub:${action}" ${attrs}>${label}</button>`;
const requestId=()=>crypto.randomUUID();
const date=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
const localDate=value=>{const d=new Date(value);return new Date(value-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const statuses={pending:'等待确认',accepted:'已约好',declined:'已婉拒',cancelled:'已取消',expired:'已过期'};

export function appointmentCards(rows,{compact=false}={}) {
  if(!rows.length)return '<p class="friend-empty-note">暂无游戏预约，选一位好友约好下一局吧。</p>';
  return rows.map(a=>`<article class="friend-appointment ${e(a.status)}"><div class="friend-appointment-heading"><b>${e(a.gameTitle)}</b><span>${statuses[a.status]??'已结束'}</span></div><time datetime="${new Date(a.startsAt).toISOString()}">${date(a.startsAt)}</time>${!compact?`<p>与 ${e(a.peer?.name??'好友')} · ${a.incoming?'对方发起':'我发起'}</p>`:''}${a.note?`<p class="friend-appointment-note">${e(a.note)}</p>`:''}<div class="friend-appointment-actions">${a.status==='pending'&&a.incoming?button('接受','appointment-respond',`class="hub-primary" data-id="${a.id}" data-revision="${a.revision}" data-response="accept"`)+button('婉拒','appointment-respond',`class="hub-secondary" data-id="${a.id}" data-revision="${a.revision}" data-response="decline"`):''}${a.canPlay?button('开房邀请','appointment-play',`class="hub-primary" data-id="${a.id}"`):''}${a.status==='accepted'||a.status==='pending'&&!a.incoming?button('取消预约','appointment-respond',`class="hub-text-button" data-id="${a.id}" data-revision="${a.revision}" data-response="cancel"`):''}${!compact&&a.peer?button('私聊','chat-friend',`class="hub-secondary" data-id="${a.peer.id}"`):''}</div>${a.status==='accepted'&&!a.canPlay?'<small>开局前 15 分钟可开房邀请</small>':''}</article>`).join('');
}

/** Owns a single dialog, drafts and polling; page navigation invalidates pending work. */
export function createFriendMessaging({root,modal,getUser,getGames,onChange,onClose=()=>{},notify}) {
  let session=null,timer=null,generation=0;
  const live=s=>session===s&&getUser()?.id===s.userId&&!!root.querySelector('.friend-chat-dialog[open]');
  function stop(){generation++;clearTimeout(timer);session=null;}
  function error(message){const el=root.querySelector('.friend-chat-error');if(el)el.textContent=message;}
  function schedule(s){clearTimeout(timer);if(live(s))timer=setTimeout(async()=>{if(!live(s))return;if(!document.hidden)try{await refresh(s);}catch(err){if(live(s)){error(err.message);if([401,403].includes(err.status)){s.blocked=true;root.querySelectorAll('.friend-chat-dialog form button').forEach(b=>b.disabled=true);return;}}}schedule(s);},3000);}
  function merge(s,data,{older=false}={}) {
    for(const m of data.messages)s.messages.set(m.id,m);
    if(older||s.nextBefore===undefined)s.nextBefore=data.nextBefore;
    const list=root.querySelector('#friend-message-list');if(!list)return;
    const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<60,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
    const rows=[...s.messages.values()].sort((a,b)=>a.sequence-b.sequence),signature=rows.map(m=>m.id).join(',');
    if(signature!==s.signature){
      s.signature=signature;
      list.innerHTML=rows.length?rows.map(m=>`<div class="friend-message ${m.from===s.userId?'own':''}"><div>${e(m.text)}</div><time datetime="${new Date(m.at).toISOString()}">${date(m.at)}</time></div>`).join(''):'<p class="friend-empty-note">还没有消息。打个招呼，约一场好局。</p>';
      if(older)list.scrollTop=oldTop+list.scrollHeight-oldHeight;
      else if(nearBottom)list.scrollTop=list.scrollHeight;
    }
    const more=root.querySelector('[data-action="hub:chat-older"]');if(more)more.hidden=!s.nextBefore;
    const newest=root.querySelector('[data-action="hub:chat-bottom"]');if(newest)newest.hidden=nearBottom||older||data.latestSequence<=(s.readThrough??0);
    if(!older&&nearBottom&&!document.hidden)void markRead(s,rows.at(-1)?.sequence??0);
  }
  async function markRead(s,through){
    if(!live(s)||through<=(s.readThrough??0))return;
    s.readThrough=through;
    try{await api(`/friends/${s.peer.id}/messages/read`,{through});if(live(s))await onChange();}catch{if(live(s))s.readThrough=0;}
  }
  async function refresh(s){
    const revision=s.refreshRevision=(s.refreshRevision??0)+1;
    const [data,reservations]=await Promise.all([api(`/friends/${s.peer.id}/messages`),api(`/appointments?playerId=${s.peer.id}`)]);
    if(!live(s)||revision!==s.refreshRevision)return;
    error('');merge(s,data);s.appointments=reservations.appointments;
    const area=root.querySelector('#friend-chat-appointments');
    const html=appointmentCards(s.appointments.filter(a=>['pending','accepted'].includes(a.status)),{compact:true});
    if(area&&s.appointmentHtml!==html){s.appointmentHtml=html;area.innerHTML=html;}
  }
  function appointmentForm(peer){
    const games=getGames().filter(g=>g.enabled!==false);
    return `<form data-hub-form="appointment" class="friend-appointment-form" hidden><label for="friend-appointment-game">一起玩什么</label><select id="friend-appointment-game" name="gameId" required>${games.map(g=>`<option value="${g.id}">${e(g.title)}</option>`).join('')}</select><label for="friend-appointment-time">开局时间（你的当地时间）</label><input id="friend-appointment-time" name="startsAt" type="datetime-local" value="${localDate(Date.now()+60*60000)}" min="${localDate(Date.now()+6*60000)}" max="${localDate(Date.now()+30*86400000)}" required><label for="friend-appointment-note">留言（选填）</label><input id="friend-appointment-note" name="note" maxlength="200" placeholder="例如：晚饭后一起玩两局"><div><small>可预约 5 分钟后至 30 天内，等待 ${e(peer.name)} 确认。</small><button class="hub-primary" type="submit" ${games.length?'':'disabled'}>发送预约</button></div></form>`;
  }
  async function open(playerId,{reserve=false}={}) {
    stop();const token=generation,userId=getUser()?.id;
    const data=await api(`/friends/${playerId}/messages`);
    if(token!==generation||userId!==getUser()?.id)return;
    const s=session={peer:data.peer,userId,messages:new Map(),nextBefore:undefined,readThrough:0};
    modal(`<header class="friend-chat-header">${avatar(s.peer)}<div><h2>${e(s.peer.name)}</h2><span>好友私聊 · 保存最近 200 条消息</span></div></header><div class="friend-chat-tools">${button(`${icon('clock')}预约游戏`,'chat-reserve','class="hub-secondary" aria-expanded="false" aria-controls="friend-appointment-form"')}${button(`${icon('room')}邀请同桌`,'invite-friend',`class="hub-secondary" data-id="${s.peer.id}"`)}</div><div id="friend-appointment-form">${appointmentForm(s.peer)}</div><details class="friend-chat-reservations"><summary>你们的游戏预约</summary><div id="friend-chat-appointments"><p class="friend-empty-note">正在读取预约…</p></div></details>${button('加载更早消息','chat-older','class="hub-text-button friend-chat-older" hidden')}<div id="friend-message-list" role="log" aria-label="私聊消息" aria-live="polite" tabindex="0"></div>${button('查看新消息 ↓','chat-bottom','class="hub-text-button friend-chat-new" hidden')}<p class="friend-chat-error" role="status"></p><form data-hub-form="private-message" class="friend-message-form"><label class="sr-only" for="friend-message-text">发送给 ${e(s.peer.name)} 的消息</label><textarea id="friend-message-text" name="text" rows="2" maxlength="500" placeholder="说点什么…" required></textarea><button type="submit" class="hub-primary">发送</button></form>`,'friend-chat-dialog',`与 ${s.peer.name} 私聊`);
    const dialog=root.querySelector('.friend-chat-dialog');dialog.addEventListener('close',()=>{if(session===s){stop();onClose();}},{once:true});
    root.querySelector('#friend-message-list').addEventListener('scroll',()=>{const list=root.querySelector('#friend-message-list');if(list&&list.scrollHeight-list.scrollTop-list.clientHeight<30){root.querySelector('[data-action="hub:chat-bottom"]').hidden=true;void markRead(s,Math.max(0,...[...s.messages.values()].map(m=>m.sequence)));}},{passive:true});
    merge(s,data);if(reserve)toggleReservation();else root.querySelector('#friend-message-text')?.focus();
    try{await refresh(s);}catch(err){if(live(s))error(err.message);}schedule(s);
  }
  function toggleReservation(){
    const form=root.querySelector('[data-hub-form="appointment"]');if(!form)return;form.hidden=!form.hidden;
    root.querySelector('[data-action="hub:chat-reserve"]').setAttribute('aria-expanded',String(!form.hidden));
    if(!form.hidden)form.querySelector('select')?.focus();
  }
  async function handle(action){
    const s=session;if(!s||!live(s))return false;
    if(action==='chat-reserve'){toggleReservation();return true;}
    if(action==='chat-bottom'){const list=root.querySelector('#friend-message-list');list.scrollTop=list.scrollHeight;return true;}
    if(action==='chat-older'){
      if(s.loadingOlder||!s.nextBefore)return true;s.loadingOlder=true;
      try{const data=await api(`/friends/${s.peer.id}/messages?before=${s.nextBefore}`);if(live(s))merge(s,data,{older:true});}finally{s.loadingOlder=false;}return true;
    }
    return false;
  }
  async function submit(form){
    if(!['private-message','appointment'].includes(form.dataset.hubForm))return false;
    const s=session;if(!s||!live(s)||s.blocked||s.sending)return true;
    const input=Object.fromEntries(new FormData(form)),kind=form.dataset.hubForm;
    if(kind==='private-message'&&!input.text.trim()){error('请先输入消息');return true;}
    const payload=kind==='private-message'?{text:input.text}:{playerId:s.peer.id,gameId:input.gameId,startsAt:new Date(input.startsAt).getTime(),note:input.note??''};
    s.pending??={};const signature=JSON.stringify(payload);if(s.pending[kind]?.signature!==signature)s.pending[kind]={signature,id:requestId()};
    const submit=form.querySelector('[type="submit"]');s.sending=true;submit.disabled=true;error('');
    try{
      const result=await api(kind==='private-message'?`/friends/${s.peer.id}/messages`:'/appointments',{...payload,requestId:s.pending[kind].id});
      if(!live(s))return true;delete s.pending[kind];
      if(kind==='private-message'){form.reset();s.messages.set(result.message.id,result.message);root.querySelector('#friend-message-list').scrollTop=1e9;form.querySelector('textarea').focus();}
      else{form.hidden=true;root.querySelector('[data-action="hub:chat-reserve"]').setAttribute('aria-expanded','false');root.querySelector('.friend-chat-reservations').open=true;notify('游戏预约已发送，等待好友确认');}
      await refresh(s);await onChange();
    }catch(err){if(live(s))error(err.message);}finally{s.sending=false;if(submit.isConnected&&!s.blocked)submit.disabled=false;}
    return true;
  }
  return {open,stop,handle,submit,refresh:async()=>{if(session&&live(session)){await refresh(session);await onChange();}}};
}
