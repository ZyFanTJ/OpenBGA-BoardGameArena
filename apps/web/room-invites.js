import {api} from './api.js';
import {escapeHtml as e} from './ui.js';
import {avatar} from './hub/cosmetics.js';
import {roomSharePayload} from './table-social.js';
import {copyText} from './clipboard.js';

/** A room-owned friend picker. Invitations use the existing transactional social API. */
export function createRoomInvites({getRoom,receive,notify}){
  let dialog=null,friends=[],sent=new Set(),query='',loading=false,pending=null,generation=0,error='';
  const status={online:'在线',offline:'离线',playing:'对局中',lobby:'房间中'};
  function rows(){
    const room=getRoom();if(!dialog||!room)return;
    const focusedPlayer=document.activeElement?.dataset?.invitePlayer;
    const full=room.players.length>=room.maxPlayers,available=room.status==='lobby'&&!full;
    dialog.querySelector('.room-invite-count').textContent=`${room.players.length} / ${room.maxPlayers}`;
    const matches=friends.filter(p=>[p.name,p.handle,p.friendCode].some(x=>x?.toLowerCase().includes(query.toLowerCase())));
    dialog.querySelector('.room-invite-results').innerHTML=loading?'<p class="room-invite-empty" role="status">加载中…</p>':error?'<p class="room-invite-empty" role="alert">好友加载失败</p><button type="button" data-invite-refresh>重试</button>':matches.length?matches.map(p=>{
      const here=room.players.some(x=>x.id===p.id),invited=sent.has(p.id),locked=!available||here||invited||!!pending;
      const label=here?'已入座':pending===p.id?'发送中…':invited?'已邀请':!available?full?'房间已满':'已开局':'邀请';
      return `<article class="room-invite-friend">${avatar(p)}<div><b>${e(p.name)}</b><span class="room-friend-${e(p.status)}"><i></i>${status[p.status]??'离线'}${p.gameTitle?' · '+e(p.gameTitle):''}</span></div><button type="button" data-invite-player="${e(p.id)}" ${locked?'disabled':''} class="${invited?'room-invite-sent':''}" aria-label="${e(label+' '+p.name)}">${label}</button></article>`;
    }).join(''):`<p class="room-invite-empty">${friends.length?'没找到好友':'还没有好友'}</p>`;
    if(focusedPlayer){
      const button=[...dialog.querySelectorAll('[data-invite-player]')].find(el=>el.dataset.invitePlayer===focusedPlayer&&!el.disabled);
      (button??dialog.querySelector('input'))?.focus({preventScroll:true});
    }
  }
  async function load(){
    const run=++generation;loading=true;error='';rows();
    try{const data=await api('/friends');if(run!==generation||!dialog)return;friends=data.friends;}
    catch(err){if(run!==generation||!dialog)return;error=err.message;notify(err.message);}
    finally{if(run===generation&&dialog){loading=false;rows();}}
  }
  function dispose(){generation++;dialog?.remove();dialog=null;friends=[];sent.clear();query='';loading=false;pending=null;error='';}
  return {
    async open(){
      const room=getRoom();if(!room||room.status!=='lobby')return;
      if(dialog?.open)return;
      dispose();dialog=document.createElement('dialog');dialog.className='platform-dialog room-invite-dialog';dialog.setAttribute('aria-labelledby','room-invite-title');
      const payload=roomSharePayload(room);
      dialog.innerHTML=`<header><div><small>${e(room.title)}</small><h2 id="room-invite-title">邀请好友</h2></div><span class="room-invite-count"></span><button type="button" data-invite-close aria-label="关闭邀请好友">×</button></header><section class="room-invite-address-book" aria-label="站内好友"><label class="room-invite-search"><span class="sr-only">搜索好友昵称、账号或好友码</span><input type="search" placeholder="搜索好友" autocomplete="off"></label><div class="room-invite-results" aria-live="polite"></div></section><details class="room-share-panel"><summary>链接分享</summary><div class="room-share-content"><label class="sr-only" for="room-share-url">房间链接</label><div class="room-share-url-row"><input id="room-share-url" type="url" value="${e(payload.url)}" readonly><button type="button" data-room-share="link">复制链接</button></div><div class="room-share-actions"><button type="button" data-room-share="message">复制邀请</button><button type="button" data-room-share="system">系统分享</button></div><p class="room-share-feedback" role="status" aria-live="polite"></p></div></details>`;
      document.querySelector('.room-layout').append(dialog);dialog.showModal();
      dialog.querySelector('input[type=search]').addEventListener('input',event=>{query=event.target.value.trim();rows();});
      dialog.querySelector('#room-share-url').addEventListener('click',event=>event.target.select());
      const surface=dialog;
      dialog.addEventListener('close',()=>{if(dialog===surface)dispose();});
      dialog.addEventListener('click',async event=>{
        if(event.target.closest('[data-invite-close]')){dialog.close();return;}
        const share=event.target.closest('[data-room-share]');
        if(share){
          const current=getRoom();if(!current)return;const payload=roomSharePayload(current),feedback=surface.querySelector('.room-share-feedback');
          try{
            if(share.dataset.roomShare==='system'&&typeof navigator.share==='function'){
              await navigator.share(payload);if(surface.isConnected)feedback.textContent='已打开分享';
            }else{
              const text=share.dataset.roomShare==='link'?payload.url:`${payload.text}\n${payload.url}`;
              if(await copyText(text,'复制房间邀请')){if(surface.isConnected)feedback.textContent=share.dataset.roomShare==='link'?'链接已复制':'邀请已复制';}
            }
          }catch(error){if(error.name!=='AbortError'&&surface.isConnected)feedback.textContent='分享未打开，请复制链接';}
          return;
        }
        if(event.target.closest('[data-invite-refresh]')){await load();return;}
        const button=event.target.closest('[data-invite-player]');if(!button||button.disabled||pending)return;
        const active=getRoom(),roomId=active?.id,id=button.dataset.invitePlayer,run=generation;
        if(!active||active.status!=='lobby')return;
        pending=id;rows();
        try{
          await api('/friends/invite',{playerId:id,roomId,revision:active.revision});
          if(run===generation&&dialog){sent.add(id);notify('邀请已发送');}
        }catch(err){
          if(run!==generation||!dialog)return;
          notify(err.message);
          if(err.status===409&&getRoom()?.id===roomId){try{receive(await api(`/rooms/${roomId}`));}catch{}}
        }finally{if(run===generation&&dialog){pending=null;rows();}}
      });
      await load();
    },
    sync(){if(!dialog)return;if(getRoom()?.status!=='lobby'){dispose();return;}rows();},
    dispose,
  };
}
