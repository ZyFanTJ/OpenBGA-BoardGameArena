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
    dialog.querySelector('.room-invite-results').innerHTML=loading?'<p class="room-invite-empty" role="status">正在载入好友…</p>':error?'<p class="room-invite-empty" role="alert">好友暂时无法载入</p><button type="button" data-invite-refresh>重试</button>':matches.length?matches.map(p=>{
      const here=room.players.some(x=>x.id===p.id),invited=sent.has(p.id),locked=!available||here||invited||!!pending;
      const label=here?'已入座':pending===p.id?'发送中…':invited?'已邀请':!available?full?'房间已满':'已开局':'邀请';
      return `<article class="room-invite-friend">${avatar(p)}<div><b>${e(p.name)}</b><span class="room-friend-${e(p.status)}"><i></i>${status[p.status]??'离线'}${p.gameTitle?' · '+e(p.gameTitle):''}</span></div><button type="button" data-invite-player="${e(p.id)}" ${locked?'disabled':''} class="${invited?'room-invite-sent':''}" aria-label="${e(label+' '+p.name)}">${label}</button></article>`;
    }).join(''):`<p class="room-invite-empty">${friends.length?'没有匹配的好友':'好友列表为空'}</p>`;
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
      dialog.innerHTML=`<header><div><small>${e(room.title)} · ${e(room.id)}</small><h2 id="room-invite-title">分享房间 · 邀请朋友</h2></div><span class="room-invite-count"></span><button type="button" data-invite-close aria-label="关闭邀请好友">×</button></header><section class="room-share-panel" aria-label="分享房间链接"><p>把链接发到群聊，朋友点开就能来</p><label for="room-share-url">房间链接</label><div class="room-share-url-row"><input id="room-share-url" type="url" value="${e(payload.url)}" readonly><button type="button" data-room-share="link">复制链接</button></div><div class="room-share-actions"><button type="button" data-room-share="message">复制微信 / QQ 群聊邀请</button><button type="button" data-room-share="system">更多平台 · 系统分享</button></div><p class="room-share-note">微信、QQ、飞书、钉钉等群聊都可粘贴邀请。首次来只填昵称，无需注册；已有昵称直接入房。</p><p class="room-share-feedback" role="status" aria-live="polite"></p></section><details class="room-invite-address-book"><summary>也可以邀请站内好友</summary><label class="room-invite-search"><span class="sr-only">搜索好友昵称、账号或好友码</span><input type="search" placeholder="搜索好友" autocomplete="off"></label><div class="room-invite-results" aria-live="polite"></div></details>`;
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
              await navigator.share(payload);if(surface.isConnected)feedback.textContent='已交给系统分享面板';
            }else{
              const text=share.dataset.roomShare==='link'?payload.url:`${payload.text}\n${payload.url}`;
              if(await copyText(text,'复制房间邀请')){if(surface.isConnected)feedback.textContent=share.dataset.roomShare==='link'?'链接已复制，发给朋友即可':'邀请已复制，粘贴到微信、QQ 或其他群聊即可';}
            }
          }catch(error){if(error.name!=='AbortError'&&surface.isConnected)feedback.textContent='暂时无法唤起系统分享，请使用复制链接或群聊邀请。';}
          return;
        }
        if(event.target.closest('[data-invite-refresh]')){await load();return;}
        const button=event.target.closest('[data-invite-player]');if(!button||button.disabled||pending)return;
        const active=getRoom(),roomId=active?.id,id=button.dataset.invitePlayer,run=generation;
        if(!active||active.status!=='lobby')return;
        pending=id;rows();
        try{
          await api('/friends/invite',{playerId:id,roomId,revision:active.revision});
          if(run===generation&&dialog){sent.add(id);notify('同桌邀请已发送');}
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
