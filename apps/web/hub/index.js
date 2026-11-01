import {lobbyFriends} from '../lobby-sidebar.js';
import {loadHubPage} from './data.js';
import {api} from '../api.js';
import {copyText} from '../clipboard.js';
import {escapeHtml as e} from '../ui.js';
import {icon} from '../icons.js';
import {avatar,nameplate} from './cosmetics.js';
import {renderHub,renderHubLoading,authDialog,renderRecord,renderItem,button,stars,empty} from './views.js';
import {renderProfileEditor,updateProfilePreview,profileDraft} from './profile-page.js';
import {createFriendMessaging} from './friend-messaging.js';

const sections=['friends','history','shop','profile'];
const requestId=()=>globalThis.crypto.randomUUID?.()??[...crypto.getRandomValues(new Uint8Array(20))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function createHub({root,shell,getUser,setUser,getGames,exitSurface,openRoom,createRoom,practice,returnRoom,notify,onLobbyFriends=()=>{}}){
 let active=null,generation=0,items=[],selected=null,returnFocus=null,working=false,lastHub=null;
 const state={friendFilter:'all',shopFilter:'all',shopGameFilter:'all',authMode:'login',historyFilters:{game:'all',outcome:'all',mode:'all'}};
 const messaging=createFriendMessaging({root,modal,getUser,getGames,notify,onClose:()=>{if(active==='friends')render();},onChange:async()=>{const id=getUser()?.id;const [friends,hub]=await Promise.all([api('/friends'),api('/hub')]);if(id!==getUser()?.id)return;state.friends=friends;badge(hub);}});
 const profile=p=>{if(getUser()?.id===p.id&&p.revision>=getUser().revision)setUser(p);};
 function render(){if(!active)return;const y=scrollY;shell.show(renderHub(active,getUser(),state,items,getGames()),getUser(),active);if(lastHub&&lastHub.profile?.id===getUser()?.id)badge(lastHub);scrollTo(0,y);}
 async function load(token){
  const id=getUser()?.id;
  const data=await loadHubPage(api,active,{target:state.profileTarget,filters:state.historyFilters});
  if(token!==generation||getUser()?.id!==id)return;
  if(data.shop){items=data.shop.items;profile(data.shop.profile);}
  if(data.friends)state.friends=data.friends;
  if(data.history)state.history=data.history;
  if(data.profilePage){state.profilePage=data.profilePage;if(data.profilePage.owner)profile(data.profilePage.profile);}
 }

 async function open(section,targetId=null){if(!sections.includes(section))return;messaging.stop();state.profileTarget=section==='profile'?targetId:null;const token=++generation;active=section;selected=null;exitSurface();shell.closeMenu();history.replaceState(null,'',`#${section}${state.profileTarget?'/'+encodeURIComponent(state.profileTarget):''}`);
  shell.show(renderHubLoading(section,getUser(),state),getUser(),section);
  try{if(getUser())await load(token);if(token!==generation)return;render();scrollTo(0,0);}catch(error){if(token!==generation)return;if(error.status===401){setUser(null);render();}else shell.show(`<main class="hub-page">${empty(error.status===403||error.status===404?'资料暂不可见':'暂时无法打开',e(error.message),state.profileTarget?'返回我的资料':'重新连接',state.profileTarget?'own-profile':'reload')}</main><dialog id="hub-dialog" class="hub-dialog"></dialog>${authDialog(state.authMode,getUser())}`,getUser(),section);}
 }
 function dispose(){messaging.stop();active=null;selected=null;state.profileTarget=null;generation++;}
 function badge(hub){lastHub=hub;const n=hub.requests+hub.invitations.length+(hub.unreadMessages??0)+(hub.appointments?.pending??0)+(hub.appointments?.due??0),button=root.querySelector('.notification-button');if(button){button.innerHTML=icon('bell')+(n?`<span class="hub-notification-count">${n>99?'99+':n}</span>`:'');button.setAttribute('aria-label',n?`通知，${n} 条待处理`:'通知');}
  onLobbyFriends(hub.friends);
  const panel=root.querySelector('.lobby-friend-list');if(panel)panel.innerHTML=lobbyFriends(hub.friends);
 }
 async function pulse(){if(!getUser()||document.hidden)return;const id=getUser().id;try{const data=await api('/hub');if(getUser()?.id!==id)return;profile(data.profile);badge(data);if(active==='friends'&&!root.querySelector('.hub-dialog[open],#hub-auth[open]')&&!root.querySelector('input:focus,select:focus,textarea:focus')){state.friends=await api('/friends');render();}}catch(error){if(error.status===401&&getUser()?.id===id)setUser(null);}}
 function close(){messaging.stop();root.querySelector('#hub-dialog')?.close();root.querySelector('#hub-auth')?.close();selected=null;if(active==='friends'&&state.friends)render();const match=returnFocus&&[...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===returnFocus.action&&el.dataset.id===returnFocus.id);match?.focus();}
 function modal(html,kind='',label='详情'){
  const dialog=root.querySelector('#hub-dialog');if(!dialog)return;
  dialog.className=`hub-dialog ${kind}`;dialog.setAttribute('aria-label',label);dialog.innerHTML=`<button class="hub-close" data-action="hub:close" aria-label="关闭详情">×</button>${html}`;
  if(!dialog.open)dialog.showModal();dialog.addEventListener('cancel',()=>{selected=null;},{once:true});
 }
 async function requireUser(){if(getUser())return true;await open(active??'friends');showAuth();return false;}
 function showAuth(mode='login'){state.authMode=mode;const old=root.querySelector('#hub-auth');if(!old){open(active??'profile').then(()=>showAuth(mode));return;}old.outerHTML=authDialog(mode,getUser());const dialog=root.querySelector('#hub-auth');dialog.showModal();dialog.querySelector('input')?.focus();}
 async function refreshFriends(){state.friends=await api('/friends');render();}
 function itemModal(){const item=items.find(x=>x.id===selected?.id);if(item)modal(renderItem(item,getUser(),items,selected.requestId),'hub-product-dialog',item.name);}
 function searchResults(players){return players.length?players.map(p=>`<article class="hub-search-result">${avatar(p)}<div><b>${e(p.name)}</b><small>${e(p.handle??p.friendCode)}</small></div>${button(p.relationship==='accepted'?'已是好友':p.relationship==='pending'?'已申请':'添加','request-friend',`class="hub-secondary" data-id="${p.id}"`,p.relationship!=='none')}</article>`).join(''):empty('没有找到这位旅人','检查好友码，或输入对方的账号。');}
 async function handle(action,target){
  if(action==='close'){close();return;}
  if(action==='auth'){if(!active)await open('profile');showAuth(target?.dataset.mode??'login');return;}
  if(action==='auth-mode'){showAuth(target.dataset.mode);return;}
  if(action==='reload'){await open(active??'friends',state.profileTarget);return;}
  if(action==='history'){await open('history');return;}
  if(action==='friends'){await open('friends');return;}
  if(action==='own-profile'){await open('profile');return;}
  if(action==='view-profile'){await open('profile',target.dataset.id);return;}
  if(action==='profile-play'){createRoom(undefined,target.dataset.gameId);return;}
  if(action==='return-room'){await returnRoom();return;}
  if(action==='create-room'){createRoom();return;}
  if(action==='practice'){practice();return;}
  if(!await requireUser())return;
  if(await messaging.handle(action,target))return;
  if(target?.dataset)returnFocus={action:target.dataset.action,id:target.dataset.id};
  if(action==='chat-friend'||action==='reserve-friend'){await messaging.open(target.dataset.id,{reserve:action==='reserve-friend'});return;}
  if(action==='appointment-respond'){
   target.disabled=true;
   try{await api(`/appointments/${target.dataset.id}/respond`,{revision:Number(target.dataset.revision),action:target.dataset.response});notify({accept:'已接受预约，开局前可从预约卡片开房邀请',decline:'已婉拒预约',cancel:'预约已取消'}[target.dataset.response]);}
   finally{if(root.querySelector('.friend-chat-dialog[open]'))await messaging.refresh();else await refreshFriends();if(target.isConnected)target.disabled=false;}return;
  }
  if(action==='appointment-play'){
   const data=await api('/appointments'),appointment=data.appointments.find(a=>a.id===target.dataset.id);
   if(!appointment?.canPlay)throw new Error('预约尚未到时间，或已经结束，请刷新后查看');
   const me=await api('/me');
   if(!me.roomId){close();createRoom(appointment.peer.id,appointment.gameId);return;}
   const room=await api(`/rooms/${me.roomId}`);
   if(room.gameId!==appointment.gameId||room.status!=='lobby')throw new Error('请先结束或离开当前房间，再为预约开房');
   await api('/friends/invite',{playerId:appointment.peer.id,roomId:room.id,revision:room.revision});notify('已邀请好友加入当前房间');return;
  }
  if(action==='edit-profile'||action==='profile-reload'){
   const page=await api('/profile');profile(page.profile);state.profilePage=page;
   modal(renderProfileEditor(getUser(),items,getGames(),target?.dataset.tab??'general'),'pp-editor-dialog','编辑个人资料');
   const form=root.querySelector('[data-hub-form=profile]');updateProfilePreview(form,getUser(),items);form.querySelector('#pp-edit-name')?.focus();return;
  }
  if(action==='showcase-move'){const form=root.querySelector('[data-hub-form=profile]'),order=profileDraft(form).showcase,index=Number(target.dataset.index),next=index+Number(target.dataset.step);if(next<0||next>=order.length)return;[order[index],order[next]]=[order[next],order[index]];form.dataset.showcaseOrder=JSON.stringify(order);updateProfilePreview(form,getUser(),items);form.querySelector(`[data-action="hub:showcase-move"][data-index="${next}"][data-step="${target.dataset.step}"]:not(:disabled)`)?.focus();return;}
  if(action==='profile-tab'){profileTab(target.dataset.tab);return;}
  if(action==='badge'){
   const badge=state.profilePage.badges.find(badge=>badge.id===target.dataset.id);if(!badge)return;
   modal(`<div class="hub-dialog-body pp-badge-detail"><span class="pp-badge-emblem ${badge.earned?'is-earned':''}">${icon(badge.icon)}</span><h2>${e(badge.name)}</h2><p>${e(badge.description)}</p><strong>${badge.earned?'已解锁':`${badge.current} / ${badge.target}`}</strong></div>`,'','旅程徽章');return;
  }
  if(action==='copy-code'){if(await copyText(getUser().friendCode,'复制好友码'))notify('好友码已复制');return;}
  if(action==='add-friend'){modal(`<div class="hub-dialog-body"><p class="hub-eyebrow">寻找同桌</p><h2>添加好友</h2><p>输入好友码，或对方的账号。</p><form data-hub-form="search" class="hub-search-form"><label class="sr-only" for="hub-friend-query">好友码或账号</label><input id="hub-friend-query" name="query" minlength="2" maxlength="32" placeholder="好友码 / 账号" required autocomplete="off"><button class="hub-primary">寻找</button></form><div id="hub-search-results" aria-live="polite"></div></div>`,'','添加好友');root.querySelector('#hub-friend-query').focus();return;}
  if(action==='request-friend'){await api('/friends/request',{playerId:target.dataset.id});target.textContent='已申请';target.disabled=true;notify('好友申请已发送');state.friends=await api('/friends');return;}
  if(action==='friend-filter'){state.friendFilter=target.dataset.filter;await refreshFriends();return;}
  if(action==='respond-request'){await api('/friends/respond',{requestId:target.dataset.id,action:target.dataset.response});await refreshFriends();notify(target.dataset.response==='accept'?'已成为同桌好友':'已婉拒申请');return;}
  if(action==='remove-friend'){await api('/friends/remove',{playerId:target.dataset.id});close();await refreshFriends();notify('已更新好友关系');return;}
  if(action==='confirm-remove'){const p=state.friends.friends.find(p=>p.id===target.dataset.id);modal(`<div class="hub-dialog-body"><h2>移除这位好友？</h2><p>你将不再收到 ${e(p.name)} 的同桌邀请。</p><div class="hub-dialog-actions">${button('保留好友','close','class="hub-secondary"')}${button('确认移除','remove-friend',`class="hub-danger" data-id="${p.id}"`)}</div></div>`,'','移除好友');return;}
  if(action==='friend-card'){const p=state.friends.friends.find(p=>p.id===target.dataset.id);if(!p)return;modal(`${nameplate(p,items,'hub-nameplate-large')}<div class="hub-dialog-body hub-friend-card-actions"><span>好友码 <code>${e(p.friendCode)}</code></span><div>${button('查看资料','view-profile',`class="hub-secondary" data-id="${p.id}"`)}${button('私聊','chat-friend',`class="hub-secondary" data-id="${p.id}"`)}${button('预约游戏','reserve-friend',`class="hub-secondary" data-id="${p.id}"`)}${button('邀请同桌','invite-friend',`class="hub-primary" data-id="${p.id}"`)}${button('移除好友','confirm-remove',`class="hub-text-button" data-id="${p.id}"`)}</div></div>`,'hub-friend-dialog',p.name+' 的名片');return;}
  if(action==='invite-friend'){
   const me=await api('/me');
   if(!me.roomId){close();createRoom(target.dataset.id);return;}
   const room=await api(`/rooms/${me.roomId}`);
   if(room.status!=='lobby'){
    modal(`<div class="hub-dialog-body"><h2>先准备下一局</h2><p>${room.status==='finished'?'返回牌桌选择「再来一局」，即可邀请好友。':'当前对局仍在进行，结束后即可邀请好友。'}</p><div class="hub-dialog-actions">${button('返回牌桌','return-room','class="hub-primary"')}</div></div>`,'','准备下一局');return;
   }
   await api('/friends/invite',{playerId:target.dataset.id,roomId:room.id,revision:room.revision});notify('同桌邀请已发送');close();return;
  }
  if(action==='accept-invite'){const snapshot=await api('/invitations/accept',{invitationId:target.dataset.id,roomRevision:Number(target.dataset.revision)});close();dispose();openRoom(snapshot);return;}
  if(action==='dismiss-invite'){await api('/invitations/dismiss',{invitationId:target.dataset.id});await refreshFriends();return;}
  if(action==='notifications'){const data=await api('/hub');badge(data);state.friendFilter=data.unreadMessages?'messages':data.requests?'requests':data.appointments?.pending||data.appointments?.due?'appointments':'all';await open('friends');return;}
  if(action==='history-mode'){state.historyFilters.mode=target.dataset.mode;state.history=await api('/history?'+new URLSearchParams(state.historyFilters));render();return;}
  if(action==='history-more'){const next=await api('/history?'+new URLSearchParams({...state.historyFilters,cursor:state.history.nextCursor}));state.history={...next,items:[...state.history.items,...next.items]};render();return;}
  if(action==='record'){const data=await api(`/history/${target.dataset.id}`);modal(renderRecord(data),'hub-report-dialog','对局战报');return;}
  if(action==='shop-game'){state.shopGameFilter=target.dataset.game;render();return;}
    if(action==='shop-filter'){state.shopFilter=target.dataset.filter;render();return;}
  if(action==='inventory'){state.shopFilter='owned';await open('shop');return;}
  if(action==='item'){selected={id:target.dataset.id,requestId:requestId()};itemModal();return;}
  if(action==='purchase'||action==='equip'){
   target.disabled=true;try{const result=await api(`/shop/${action}`,action==='purchase'?{itemId:target.dataset.id,requestId:target.dataset.requestId,revision:getUser().revision}:{itemId:target.dataset.id,revision:getUser().revision,clear:target.dataset.clear==='true'});items=result.items;profile(result.profile);const keep=selected;render();selected=keep;itemModal();notify(action==='purchase'?'已收入藏品，可立即装备':target.dataset.clear==='true'?'已卸下，恢复默认外观':'已装备，返回牌桌即可看到外观');}
   catch(error){const data=await api('/shop');items=data.items;profile(data.profile);itemModal();throw error;}return;
  }
  if(action==='wallet'){const data=await api('/wallet');modal(`<div class="hub-dialog-body"><p class="hub-eyebrow">星辉账簿</p><h2>收支记录</h2><div class="hub-wallet-total">${stars(data.credits)}<span>当前可用</span></div><div class="hub-ledger">${data.transactions.map(t=>`<div><span><b>${t.kind==='purchase'?'兑换 · '+e(items.find(x=>x.id===t.itemId)?.name??'藏品'):t.kind==='welcome'?'首次入座赠礼':t.kind==='admin'?'管理员调整':'完成对局奖励'}</b><small>${new Date(t.at).toLocaleString('zh-CN',{hour12:false})}</small></span><strong class="${t.amount>0?'positive':''}">${t.amount>0?'+':''}${t.amount}</strong></div>`).join('')||'<p>暂无收支记录</p>'}</div></div>`,'','收支记录');return;}
  if(action==='save-name'){root.querySelector('[data-hub-form=rename]').requestSubmit();return;}
  if(action==='logout-dialog'){modal(`<div class="hub-dialog-body"><h2>暂别牌桌？</h2><p>好友、战绩与藏品会留在账号中，下次登录可继续。</p><div class="hub-dialog-actions">${button('继续停留','close','class="hub-secondary"')}${button('退出登录','logout','class="hub-primary"')}</div></div>`,'','退出登录');return;}
  if(action==='logout'){await api('/auth/logout',{});setUser(null);close();await open('profile');return;}
 }
 async function submit(form){if(await messaging.submit(form))return;if(working)return;working=true;const values=Object.fromEntries(new FormData(form)),submit=form.querySelector('[type=submit],button:not([type=button])');if(submit)submit.disabled=true;
  try{
   if(form.dataset.hubForm==='search'){const data=await api('/friends/search?q='+encodeURIComponent(values.query));root.querySelector('#hub-search-results').innerHTML=searchResults(data.players);}
   if(form.dataset.hubForm==='auth'){
    const mode=form.dataset.mode;
    if(mode==='guest'&&getUser()){notify('当前已入座，可直接绑定账号保留资料');return;}
    if(mode==='login'&&getUser()&&(await api('/me')).roomId){throw new Error('请先退出当前房间再切换账号，或选择绑定账号保留身份');}
    if(mode==='register'&&form.dataset.guestId)values.guestId=form.dataset.guestId;
    const p=await api(mode==='guest'?'/session':`/auth/${mode}`,values);setUser(p);form.reset();root.querySelector('#hub-auth')?.close();await open(active??'profile');notify(mode==='register'?'账号已建立，旅程已保存':'欢迎入座');
   }
   if(form.dataset.hubForm==='profile'){
    if(!form.checkValidity()){profileTab('general');form.reportValidity();return;}
    const page=await api('/profile',profileDraft(form));profile(page.profile);state.profilePage=page;state.profileTarget=null;render();notify('个人资料已保存');
   }
   if(form.dataset.hubForm==='rename'){profile(await api('/account',{name:values.name,revision:getUser().revision}));render();notify('昵称已更新');}
  }catch(error){const inline=form.querySelector('.hub-inline-error');if(inline){inline.textContent=error.message;if(error.status===409&&form.dataset.hubForm==='profile')inline.insertAdjacentHTML('beforeend',button('重新载入资料','profile-reload','class="hub-text-button"'));}else notify(error.message);}finally{working=false;if(submit?.isConnected)submit.disabled=false;}
 }
 function profileTab(tab){
  const form=root.querySelector('[data-hub-form=profile]');if(!form)return;
  form.querySelectorAll('[data-profile-panel]').forEach(panel=>{panel.hidden=panel.dataset.profilePanel!==tab;});
  form.querySelectorAll('[data-action="hub:profile-tab"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===tab)));
 }
 root.addEventListener('input',event=>{const form=event.target.closest('[data-hub-form=profile]');if(form)updateProfilePreview(form,getUser(),items);});
 root.addEventListener('change',event=>{const form=event.target.closest('[data-hub-form=profile]');if(form)updateProfilePreview(form,getUser(),items);});
 root.addEventListener('change',async event=>{if(!['hub-history-game','hub-history-outcome'].includes(event.target.id))return;state.historyFilters[event.target.id==='hub-history-game'?'game':'outcome']=event.target.value;try{state.history=await api('/history?'+new URLSearchParams(state.historyFilters));render();}catch(error){notify(error.message);}});
 return {open,handle,submit,dispose,pulse,isActive:()=>!!active};
}
