import {resultCard} from './result-card.js';
import {api} from './api.js';
import {copyText} from './clipboard.js';
import {escapeHtml as e,button as b} from './ui.js';

export const inviteLink=(id,origin=location.origin)=>`${origin}/#invite/${encodeURIComponent(id)}`;
export function roomSharePayload(room,origin=location.origin){
  return {title:`${room.title} · Moon Table`,text:`我在 Moon Table 开了「${room.title}」，来一起玩！\n房间码 ${room.id}`,url:inviteLink(room.id,origin)};
}
/** Each attempt checks the latest room revision; a single membership join is atomic. */
export async function joinInvitation(id,request=api){
  for(let attempt=0;attempt<2;attempt++){
    const latest=await request(`/room-invites/${id}`);
    try{return await request(`/rooms/${id}/join`,{revision:latest.revision});}
    catch(error){if(error.status!==409||attempt===1)throw error;}
  }
}

/** Room-level social actions consume archived summaries, never private game state. */
export function createTableSocial({root,getRoom,getUser,identify,mountRoom,mutate,notify,onClose=()=>{}}){
  let dialog,record=null,social=null,key=null,generation=0,card=null;
  function close(restore=true){const previous=dialog;dialog?.remove();dialog=null;card=null;if(previous&&restore)onClose();}
  function modal(title,html){close(false);dialog=document.createElement('dialog');dialog.className='platform-dialog table-social-dialog';dialog.innerHTML=`<button class="dialog-close" data-action="table:close" aria-label="关闭">×</button><h2>${e(title)}</h2>${html}`;root.append(dialog);dialog.addEventListener('close',close,{once:true});dialog.showModal();return dialog;}
  function footer(){
    const room=getRoom(),user=getUser();if(room?.status!=='finished')return;
    const peers=room.players.filter(p=>!p.isBot&&p.id!==user.id);
    for(const el of root.querySelectorAll('[data-result-peers]'))el.innerHTML=`<div class="table-peers">${peers.map(p=>{const friend=social?.friends.some(f=>f.id===p.id),request=social?.requests.find(r=>r.from.id===p.id||r.to.id===p.id);return `<div><span>${e(p.name)}</span>${b(friend?'已是好友':request?request.incoming?'接受好友':'已申请':'加好友',request?.incoming?'table:accept':'table:friend',!social||friend||!!request&&!request.incoming,`class="secondary" data-player-id="${e(p.id)}" data-request-id="${e(request?.id??'')}"`)}</div>`;}).join('')}</div>`;
  }
  return {
    dispose(){generation++;key=null;record=null;social=null;close(false);},
    async sync(){
      const room=getRoom();
      if(room?.status!=='finished'){
        if(key!==null){generation++;key=null;record=null;social=null;close(false);}
        return;
      }
      footer();if(key===room.matchId)return;
      key=room.matchId;record=null;social=null;const run=++generation;
      try{const [result,friends]=await Promise.all([api(`/history/${room.matchId}`),api('/friends')]);if(run!==generation)return;record=result;social=friends;footer();}
      catch(error){if(run===generation){key=null;notify(error.message);}}
    },
    async invite(id){
      const run=++generation,preview=await api(`/room-invites/${id}`),user=getUser();if(run!==generation)return;
      let entryError='';
      if(user){
        try{
          const me=await api('/me');if(run!==generation)return;
          if(me.roomId===id){const snapshot=await api(`/rooms/${id}`);if(run===generation)mountRoom(snapshot);return;}
          if(me.roomId)entryError='你还有一张牌桌，请先回到原房间退出，再来加入这桌。';
          else if(preview.status==='lobby'&&preview.count<preview.maxPlayers){const snapshot=await joinInvitation(id);if(run===generation)mountRoom(snapshot);return;}
        }catch(error){if(run!==generation)return;entryError=error.message;}
      }
      const available=preview.status==='lobby'&&preview.count<preview.maxPlayers;
      history.replaceState(null,'',`#invite/${id}`);
      const box=modal(`${preview.host} 邀你同桌`,`<p class="table-invite-game">${e(preview.gameTitle)} · ${preview.count} / ${preview.maxPlayers} 人</p><p>${e(preview.title)}</p>${available?`<form id="invite-entry">${user?'':`<label for="invite-name">你的昵称</label><input id="invite-name" name="name" maxlength="24" placeholder="怎么称呼你" required autocomplete="nickname">`}<button type="submit" class="gold-button">${user?'重试进入房间':'填写昵称，进入房间'}</button><p class="table-invite-note">${user?e(user.name):'无需注册，不用输入房间码'}</p><p class="table-entry-error" role="alert">${e(entryError)}</p></form>`:`<p class="table-invite-note">${preview.status==='lobby'?'这张牌桌已坐满':'这局已经开始了'}</p>${b('逛逛其他牌桌','browse-rooms',false,'class="gold-button"')}`}${user?b('回到我的房间','my-room',false,'class="quiet"'):''}`);
      box.querySelector('form')?.addEventListener('submit',async event=>{
        event.preventDefault();event.stopPropagation();const button=event.target.querySelector('button');button.disabled=true;
        try{await identify(new FormData(event.target).get('name'));if(!box.isConnected)return;const snapshot=await joinInvitation(id);if(!box.isConnected)return;close();mountRoom(snapshot);}
        catch(error){if(box.isConnected){box.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}}
      });
    },
    async shared(id){const result=await api(`/shares/${id}`);const box=modal('今夜的牌桌',`<div class="table-card-preview"></div>${b('我也来一局','open-create',false,`class="gold-button" data-game-id="${e(result.gameId)}"`)}`);box.classList.add('table-card-dialog');box.querySelector('.table-card-preview').append(await resultCard(result));history.replaceState(null,'',`#result/${id}`);},
    async handle(action,target){
      if(action==='close'){close();return;}
      if(action==='invite-copy'){if(await copyText(inviteLink(getRoom().id),'复制邀请链接'))notify('邀请链接已复制');return;}
      if(action==='again'){await mutate({type:getRoom().hostId===getUser().id?'rematch':'rematchReady'});return;}
      if(action==='friend'||action==='accept'){
        social=await api(action==='friend'?'/friends/request':'/friends/respond',action==='friend'?{playerId:target.dataset.playerId}:{requestId:target.dataset.requestId,action:'accept'});footer();notify(action==='friend'?'好友申请已发送':'已成为好友');return;
      }
      if(action==='share'){
        if(!record){const room=getRoom(),run=generation;if(room?.status!=='finished')return;const result=await api(`/history/${room.matchId}`);if(run!==generation)return;record=result;}
        const box=modal('分享这局好时光','<div class="table-card-preview"></div><div class="actions"><button data-action="table:download" class="gold-button">保存图片</button><button data-action="table:send" class="secondary">分享图片</button><button data-action="table:link" class="secondary">复制战绩链接</button></div>');
        box.classList.add('table-card-dialog');box.querySelector('.table-card-preview').textContent='正在装裱这局好时光…';const rendered=await resultCard(record);if(!box.isConnected)return;card=rendered;box.querySelector('.table-card-preview').replaceChildren(card);return;
      }
      if(action==='download'||action==='send'){
        if(!card)return;const image=card,blob=await new Promise(resolve=>image.toBlob(resolve,'image/png'));const file=new File([blob],'Moon-Table.png',{type:'image/png'});
        if(action==='send'&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Moon Table · 本局战绩'});}catch(error){if(error.name!=='AbortError')throw error;}return;}
        const link=document.createElement('a');link.href=image.toDataURL('image/png');link.download='Moon-Table.png';link.click();return;
      }
      if(action==='link'){await api(`/history/${record.id}/share`,{});if(await copyText(`${location.origin}/#result/${record.id}`,'复制战绩链接'))notify('战绩链接已复制');}
    },
  };
}
