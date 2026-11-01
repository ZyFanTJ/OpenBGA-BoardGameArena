import {setupArt,setupOptions,rulesSetup,setupIcon} from './room-setup.js';
import {createSpectator} from './spectator.js';
import {openUpdateLog} from './lobby-sidebar.js';
import {createRoomConnection} from './room-connection.js';
import {createTableSocial,inviteLink} from './table-social.js';
import {createTurnFeedback,turnCue} from './turn-feedback.js';
import {lazySurface} from './lazy-surface.js';
import {loadStyles} from './styles-loader.js';
import {createRoomInvites} from './room-invites.js';
import {createRoomChat,roomChatHtml} from './room-chat.js';
import { api,parseRoomEvent,mergeRoomEvent } from './api.js';
import {createRoomCommands} from './room-commands.js';
import { copyText } from './clipboard.js';
import { escapeHtml as e, button as b } from './ui.js';
import { renderers, gameCards } from './games/registry.js';
import {infoDialog} from './lobby.js';
import {lobbyFrame,createLobbySurface,directoryFrame,createDirectorySurface} from './lobby-surface.js';
import { createShell } from './shell.js';
import { roomLounge, postgameRoom } from './room-lounge.js';
import { createHub } from './hub/index.js';


const root = document.querySelector('#app');
const shell = createShell(root);
let user, room, stream, renderer, catalog, roomBrowser, gameList = [], publicRooms = [], noticeTimer, connectionText = '连接中', dockedChat = false;
const pendingForms = new WeakSet();
let pendingFriendInvite;
let spectator;
const stopWatching=()=>{spectator?.dispose();spectator=null;};
let resultRoomKey = null;
// Membership survives navigation away from the mounted room view.
let currentRoomId = null;
const turnFeedback=createTurnFeedback(()=>room);
const tableSocial=createTableSocial({root,getRoom:()=>room,getUser:()=>user,identify,mountRoom,mutate,notify:notice,onClose:()=>renderer?.afterOverlay?.()});
const roomInvites=createRoomInvites({getRoom:()=>room,receive,notify:notice});
const roomChat=createRoomChat({root,getRoom:()=>room,getUser:()=>user});
const hub = createHub({root,shell,getUser:()=>user,setUser:value=>{user=value;shell.update(user);},getGames:()=>gameList,
  onLobbyFriends:friends=>catalog?.updateFriends(friends),
  exitSurface(){stopWatching();admin.dispose();forum.dispose();roomInvites.dispose();tableSocial.dispose();roomChat.dispose();root.classList.remove('in-room');roomBrowser?.dispose();roomBrowser=null;catalog?.dispose();catalog=null;renderer?.dispose?.();renderer=null;stream?.close();stream=null;room=null;},
  openRoom:mountRoom,createRoom(friendId,gameId){pendingFriendInvite=friendId;lobby();openCreate(false,gameId);},practice(){lobby();openCreate(true);},
  returnRoom:myRoom,notify:notice});
const admin=lazySurface(async()=>{
  const [module]=await Promise.all([import('./admin/index.js'),loadStyles(['/admin/admin.css'])]);
  return module.createAdmin({root,shell,getUser:()=>user,setUser:value=>{user=value;shell.update(user);},notify:notice,onSettingsChanged:refreshSystem});
});
async function refreshSystem(){
  const settings=await api('/system');shell.updateSettings(settings);
  const availabilityChanged=gameList.some(g=>g.enabled!==(settings.gameAvailability?.[g.id]!==false));
  const changed=availabilityChanged||gameList.some(g=>g.hot!==(settings.gameHot?.[g.id]===true));
  gameList=gameList.map(g=>({...g,enabled:settings.gameAvailability?.[g.id]!==false,hot:settings.gameHot?.[g.id]===true}));
  if(changed&&catalog&&root.querySelector('.moon-lobby'))catalog.updateGames(gameList.filter(g=>renderers[g.id]));
  else if(availabilityChanged&&!root.querySelector('dialog[open]')){if(roomBrowser)showRoomBrowser();else if(room&&!room.game)drawGame();}
}
function openAdmin(section){
  stopWatching();
  forum.dispose();hub.dispose();roomInvites.dispose();tableSocial.dispose();roomChat.dispose();root.classList.remove('in-room');
  roomBrowser?.dispose();roomBrowser=null;catalog?.dispose();catalog=null;renderer?.dispose?.();renderer=null;stream?.close();stream=null;room=null;
  shell.show('<main class="entry" aria-busy="true"><p role="status">正在打开管理中心…</p></main>',user);
  return admin.open(section);
}
const forum = lazySurface(async()=>{
  const [module]=await Promise.all([import('./forum/index.js'),loadStyles(['/forum/forum.css'])]);
  return module.createForum({root,shell,getUser:()=>user,identify,notify:notice});
});
function openForum(id, options) {
  stopWatching();admin.dispose();
  roomInvites.dispose();tableSocial.dispose();roomChat.dispose(); hub.dispose(); root.classList.remove('in-room');
  roomBrowser?.dispose(); roomBrowser=null; catalog?.dispose(); catalog=null;
  renderer?.dispose?.(); renderer=null; stream?.close(); stream=null; room=null;
  shell.show('<main class="entry" aria-busy="true"><p role="status">正在打开论坛…</p></main>',user);
  return forum.open(id, options);
}
const roomDesktop = matchMedia('(min-width:1001px)');
function notice(message) { const box = document.querySelector('#notice'); box.textContent = message; box.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => box.classList.remove('visible'), 6000); }
function lobby() {
  if (!document.querySelector('link[data-lobby-art]')) {
    const image = document.createElement('link');
    image.rel = 'preload'; image.as = 'image'; image.href = '/assets/lobby/hero-display-v1.webp'; image.fetchPriority = 'high'; image.dataset.lobbyArt = '';
    document.head.append(image);
  }
  stopWatching();admin.dispose();
  forum.dispose();
  roomInvites.dispose();tableSocial.dispose();roomChat.dispose();
  hub.dispose(); history.replaceState(null,'',location.pathname);
  root.classList.remove('in-room');
  roomBrowser?.dispose(); roomBrowser = null;
  catalog?.dispose();
  renderer?.dispose?.();
  stream?.close(); stream = null; room = null;
  const games=gameList.filter(g=>renderers[g.id]);
  shell.show(lobbyFrame(user,games,gameCards),user);
  catalog=createLobbySurface(root,{user,games,metadata:gameCards,rooms:publicRooms,currentRoomId},{onError:notice});
  const surface=catalog,playerId=user?.id;
  refreshRooms().catch(error=>notice(error.message));
  if(playerId)api('/history?limit=20').then(result=>{
    if(catalog===surface&&user?.id===playerId)surface.updateRecent(result.items);
  }).catch(()=>{});
  hub.pulse();
}
async function refreshRooms() {
  if (roomBrowser) return roomBrowser.refresh();
  const surface=catalog;
  if(!surface||!root.querySelector('#react-lobby'))return;
  const [directory]=await Promise.all([api('/lobby'),refreshLobbyMembership(surface)]);publicRooms=directory.rooms;
  if(catalog===surface)surface.updateRooms(publicRooms);
}
async function refreshLobbyMembership(surface=catalog) {
  const playerId=user?.id;
  if(!surface)return;
  if(!playerId){currentRoomId=null;surface.updateCurrentRoom(null);return;}
  try {
    const me=await api('/me');
    if(catalog!==surface||user?.id!==playerId)return;
    currentRoomId=me.roomId??null;
    surface.updateCurrentRoom(currentRoomId);
  } catch(error) {
    if(error.status===401&&catalog===surface&&user?.id===playerId){currentRoomId=null;surface.updateCurrentRoom(null);}
  }
}
function filterCatalog() { catalog?.filter(); }
async function myRoom() {
  shell.closeMenu();
  if ((room && root.querySelector('.room-layout')) || root.querySelector('.room-loading')) return;
  if (!user) { showRoomBrowser(); return; }
  showRoomBrowser({loading:true});
  const surface = root.querySelector('main');
  try {
    const result = await api('/me/room');
    if (root.querySelector('main') !== surface) return;
    currentRoomId=result.room?.id??null;
    if (result.room) mountRoom(result.room);
    else showRoomBrowser();
  } catch (error) {
    if (root.querySelector('main') !== surface) return;
    showRoomBrowser();
    notice(error.message);
  }
}
function showRoomBrowser({loading=false}={}) {
  stopWatching();admin.dispose();
  forum.dispose();
  roomInvites.dispose();tableSocial.dispose();roomChat.dispose();
  hub.dispose(); history.replaceState(null, '', location.pathname + '#rooms');
  root.classList.remove('in-room');
  catalog?.dispose(); catalog = null;
  roomBrowser?.dispose();
  renderer?.dispose?.(); renderer = null;
  stream?.close(); stream = null; room = null;
  const games = gameList.filter(game => renderers[game.id]);
  if (loading) {
    roomBrowser = null;
    shell.show('<main class="entry room-loading" aria-busy="true"><span class="room-loading-mark" aria-hidden="true">◐</span><p role="status">正在返回牌桌…</p></main>', user, 'my-room');
    return;
  }
  shell.show(directoryFrame(user,games,gameCards),user,'my-room');
  roomBrowser=createDirectorySurface(root,{user,games,metadata:gameCards},{onError:notice});
  hub.pulse();
}
function info(title, text) {
  shell.closeMenu();
  document.querySelector('#lobby-info-title').textContent = title;
  document.querySelector('#lobby-info-text').textContent = text;
  document.querySelector('#lobby-info-dialog').showModal();
}
function syncSetup(id){
 const meta=gameCards[id]??{};
 document.querySelector('#game-options').innerHTML=setupOptions(meta);
 document.querySelectorAll('#create-room-dialog [name=turnSeconds] option').forEach(option=>{option.disabled=meta.supportsTurnLimit===false&&option.value!=='0';});
 document.querySelector('#setup-art').innerHTML=setupArt(gameList.find(g=>g.id===id),meta);
}
function openCreate(practice = false, gameId, botCount = 1) {
  if(!gameList.some(g=>g.enabled!==false&&renderers[g.id])){notice('暂无已上线游戏');return;}
  if(gameId&&gameList.find(g=>g.id===gameId)?.enabled===false){notice('此游戏已下线');return;}
  document.querySelector('#lobby-join-dialog')?.close();
  const select = document.querySelector('#create-game'); if (gameId) select.value = gameId;
  syncSetup(select.value);
  const turnSelect = document.querySelector('#create-room-dialog [name=turnSeconds]');
  turnSelect.value = String(gameList.find(g => g.id === select.value)?.defaultTurnSeconds ?? 60);
  document.querySelector('#create-room-dialog [data-turn-limit-note]').hidden = turnSelect.value === '0';
  document.querySelector('#practice-mode').value = practice ? String(botCount) : '';
  document.querySelector('#create-room-title').textContent = practice ? '和 AI 玩一局' : '创建房间';
  document.querySelector('#create-room-dialog [name=public]').checked = !practice;
  document.querySelector('#create-room-dialog').showModal();
}
function openJoin() {
  if(roomBrowser||matchMedia('(max-width:760px)').matches){
    const dialog=document.querySelector('#lobby-join-dialog');dialog.showModal();
    dialog.querySelector(user?'#code':'#join-name').focus({preventScroll:true});
  }else{
    const panel=root.querySelector('.ml-join');
    if(panel)panel.querySelector(user?'[name=code]':'[name=name]').focus({preventScroll:true});
  }
}
async function joinPublic(id) {
  if (user) {
    const surface = root.querySelector('main'), snapshot = await api(`/rooms/${id}/join`, {});
    if (root.querySelector('main') === surface) mountRoom(snapshot);
    return;
  }
  document.querySelector('#code').value = id;
  const dialog=document.querySelector('#lobby-join-dialog');dialog.showModal();dialog.querySelector('#join-name').focus({preventScroll:true});
  notice('填写昵称，即可加入这张牌桌');
}
async function watchRoom(id) {
  if(!user)await identify(root.querySelector('#join-name')?.value?.trim()||'观战旅人');
  const surface=root.querySelector('main');
  const snapshot=await api(`/rooms/${id}/watch`);
  if(root.querySelector('main')!==surface)return;
  lobby(); catalog?.dispose();catalog=null;
  history.replaceState(null,'',`#watch/${id}`);
  spectator=createSpectator({root,shell,user,snapshot,notify:notice});
}
function mountRoom(snapshot) {
  stopWatching();admin.dispose();
  forum.dispose();
  roomInvites.dispose();tableSocial.dispose();roomChat.dispose();
  hub.dispose(); history.replaceState(null,'',location.pathname);
  root.classList.add('in-room');
  roomBrowser?.dispose(); roomBrowser = null;
  catalog?.dispose(); catalog = null;
  renderer?.dispose?.();
  room = snapshot; currentRoomId=snapshot.id; dockedChat = false; resultRoomKey = null;
  renderer = renderers[room.gameId]?.(command => mutate({ type: 'game', command }), drawGame);
  shell.show(`<main class="room-layout"><section class="play-column"><div id="room-bar"></div><p id="room-command-status" class="room-command-status" role="status" hidden></p><div id="play"></div><div id="room-connection" class="room-connection" role="status" aria-live="polite" hidden><span></span><button type="button" data-action="connection-retry">立即重连</button></div></section>${roomChatHtml()}</main>` + infoDialog(), user, 'my-room');
  drawRoom(); connect();
  document.querySelector('.room-layout').insertAdjacentHTML('beforeend', `<dialog id="room-menu" class="platform-dialog room-menu-dialog"><button class="dialog-close" data-action="close-room-menu" aria-label="关闭房间菜单">×</button><h2>房间菜单</h2><div class="actions">${b('返回大厅 · 保留座位', 'lobby-home', false, 'class="secondary"')}${b('查看战绩', 'history', false, 'class="secondary"')}${b('同桌好友', 'friends', false, 'class="secondary"')}${room.status==='lobby'?b('邀请好友','room-invite-friends',false,'class="secondary"'):''}${b('退出房间', 'confirm-leave', false, 'class="secondary"')}<button type="button" data-action="request-dissolve" id="dissolve-trigger" class="accent">发起解散投票</button></div></dialog><dialog id="leave-dialog" class="platform-dialog"><h2>退出这张牌桌？</h2><p>${room.status === 'playing' ? room.supportsBots ? '你的座位将由 AI 接管，无法重新回到本局。房主离开会移交给其他真人；最后一位真人退出后，房间关闭。' : '此游戏尚无 AI 接管，退出会中止对局，其他玩家返回准备房间。' : '退出后可随时加入其他房间。'}</p><div class="actions">${b('继续游戏','cancel-leave',false,'class="secondary"')}${b('确认退出','leave',false,'class="accent"')}</div></dialog><dialog id="dissolve-dialog" class="platform-dialog" aria-label="解散投票"></dialog>`);
  document.querySelector('#dissolve-dialog').addEventListener('cancel', event => event.preventDefault());
  document.querySelector('.room-layout').insertAdjacentHTML('beforeend','<dialog id="room-rules-dialog" class="platform-dialog room-rules-dialog room-setup" aria-labelledby="room-rules-title"></dialog><dialog id="pregame-guide-dialog" class="pregame-guide" aria-labelledby="pregame-guide-title"></dialog>');
  drawVote();
}
function drawRoom(options) {
  const pregame=document.querySelector('#pregame-guide-dialog');
  if(pregame?.open&&(room?.status!=='lobby'||pregame.dataset.options!==JSON.stringify(room.options)))pregame.close();

  document.querySelector('#room-bar').innerHTML = `<div class="room-bar"><a href="/" class="room-logo" data-action="lobby-home" aria-label="Moon Table">◐</a><div class="room-identity"><h1>${e(room.title)}</h1><div class="room-presence"><span class="room-person">${e(user.name)}</span><span id="connection">${connectionText}</span></div></div>${turnCue()}<div class="room-tools">${room.status === 'finished' ? b('战绩', 'history', false, 'class="room-history-link"') : ''}${b(room.id + ' ↗', 'copy', false, `class="room-invite" aria-label="复制邀请链接 ${room.id}" title="复制邀请链接"`)}${room.hostId===user.id?b(room.allowSpectators?'关闭观战':'允许观战','toggle-spectators',false,`class="quiet" aria-label="${room.allowSpectators?'关闭观战':'允许观战'}" title="${room.allowSpectators?'关闭观战':'允许观战'}" aria-pressed="${room.allowSpectators}"`):''}${b('聊天', 'chat-toggle', false, 'aria-controls="room-chat" aria-expanded="false" aria-label="聊天" title="聊天"')}${b('⋯','room-menu',false,'class="quiet room-menu-button" aria-label="房间菜单"')}</div></div>`;
  roomInvites.sync();
  drawGame(options); drawChat();turnFeedback.sync();tableSocial.sync();
  syncRoomChat();
  document.querySelector('[aria-controls="room-chat"]').setAttribute('aria-expanded', String(!document.querySelector('#room-chat').hidden));
  drawVote();
}
function syncRoomChat() {
  if (!room) return;
  const dock = !room.game && roomDesktop.matches;
  const panel = document.querySelector('#room-chat');
  if (dock !== dockedChat) panel.hidden = !dock;
  dockedChat = dock;
  document.querySelector('.room-layout').classList.toggle('has-docked-chat', dock);
  document.querySelector('[aria-controls="room-chat"]').setAttribute('aria-expanded', String(!panel.hidden));
}
roomDesktop.addEventListener('change', syncRoomChat);
function drawVote() {
  const dialog = document.querySelector('#dissolve-dialog'); if (!dialog) return;
  const trigger = document.querySelector('#dissolve-trigger'); trigger.hidden = room.hostId !== user.id || room.status !== 'playing';
  if (!room.dissolution) { dialog.close(); return; }
  document.querySelector('#room-menu').close(); document.querySelector('#leave-dialog').close();
  const humans = room.players.filter(p => !p.isBot), vote = room.dissolution;
  const agreed = humans.filter(p => vote.votes.includes(p.id)).length;
  dialog.innerHTML = `<h2>是否解散本局？</h2><p>房主发起解散，所有真人同意后中止。<br>投票期间暂停出牌，AI 默认同意。</p><div class="dialog-meta">${agreed} / ${humans.length} 已同意</div><ul class="vote-list">${humans.map(p=>`<li><span>${e(p.name)}</span><span class="${vote.votes.includes(p.id)?'voted':''}">${vote.votes.includes(p.id)?'已同意':'等待投票'}</span></li>`).join('')}</ul>${vote.votes.includes(user.id)?'<p>等待其他玩家决定…</p>':`<div class="actions">${b('继续游戏','vote-no',false,'class="secondary"')}${b('同意解散','vote-yes',false,'class="accent"')}</div>`}<div class="actions">${b('退出房间','confirm-leave',false,'class="quiet"')}</div>`;
  if (!dialog.open) dialog.showModal();
}
function drawGame(options) {
  const play = document.querySelector('#play'); if (!play) return;
  if (room.status === 'finished' && resultRoomKey === room.matchId) {
    document.querySelector('.room-layout').classList.remove('is-uno');
    play.innerHTML = postgameRoom(room, user, gameList.find(game => game.id === room.gameId));
    return;
  }
  document.querySelector('.room-layout').classList.toggle('is-waiting', !room.game);
  document.querySelector('.room-layout').classList.toggle('is-uno', !!room.game && room.gameId === 'uno');
  if (room.game) {
    if (renderer?.update) renderer.update(play, room, user, options);
    else play.innerHTML = renderer ? renderer.render(room, user) : '<p>此游戏尚未安装界面模块。</p>';
    tableSocial.sync();
    return;
  }
  renderer?.dispose?.();
  const game = gameList.find(g => g.id === room.gameId);
  play.innerHTML = roomLounge(room, user, game, gameCards[room.gameId]);
}
function drawChat() {
  roomChat.sync();
}
function receive(snapshot, options) {
  if (!room || snapshot.id !== room.id) return;
  if (snapshot.left) { currentRoomId=null; showRoomBrowser(); notice(snapshot.reason === 'inactive' ? '房间已连续 5 分钟无人在线，已自动回收' : snapshot.reason === 'dissolved' ? '房间已关闭' : '已退出房间'); return; }
  const realtimeFrame=snapshot.realtimeFrame&&snapshot.matchId===room.matchId&&snapshot.status===room.status&&snapshot.status==='playing';
  snapshot = mergeRoomEvent(room, snapshot, options);
  if (!snapshot) return false;
  if (snapshot === room) { if(options?.resetAnimations)drawGame(options); return; }
  if(realtimeFrame){room=snapshot;drawGame(options);return;}
  const changed = room.revision !== snapshot.revision || JSON.stringify(room.players)!==JSON.stringify(snapshot.players);
  const presentationChanged = room.presentationRevision !== snapshot.presentationRevision;
  const timeoutChanged=snapshot.turn?.lastTimeout&&snapshot.turn.lastTimeout.revision!==(room.turn?.lastTimeout?.revision??0);
  room = snapshot;
  if(timeoutChanged)notice(snapshot.turn.lastTimeout.playerIds.map(id=>room.players.find(p=>p.id===id)?.name??'玩家').join('、')+' 超时，系统已完成本轮操作');
  if (changed || options?.resetAnimations) drawRoom(options); else { if (presentationChanged) drawGame(); drawChat(); }
}
function connectionStatus(state) {
  const labels={connecting:'连接中',syncing:'正在同步',connected:'已连接',offline:'网络已断开',reconnecting:'正在重连',expired:'登录已失效'};
  connectionText=labels[state];
  const el=document.querySelector('#connection');if(el)el.textContent=connectionText;
  const banner=document.querySelector('#room-connection');if(!banner)return;
  banner.hidden=state==='connected';banner.dataset.state=state;
  banner.querySelector('span').textContent=state==='offline'?'网络已断开，恢复网络后会自动重连':state==='expired'?'登录已失效，请重新登录':state==='syncing'?'正在同步最新牌局…':state==='connecting'?'正在连接牌桌…':'连接中断，正在自动重连…';
  banner.querySelector('button').hidden=state==='expired';
}
function connect() {
  stream?.close();
  stream=createRoomConnection({id:room.id,receive,status:connectionStatus,socket:gameList.find(g=>g.id===room.gameId)?.realtime===true});
}
async function recoverRoom(error) {
  if (error.resynced || !room || (error.roomId && error.roomId !== room.id) || !(error.status===409 || error.mayHaveCommitted)) return;
  const id=room.id;
  try { const snapshot=await api(`/rooms/${id}`);if(room?.id===id)receive(snapshot,{resetPresentation:true,resetAnimations:true}); } catch { /* Keep the last good view; SSE reconnects without repeating the command. */ }
}
const sendRoomCommand = createRoomCommands({ getRoom:()=>room, receive, resynced() {
  const el=document.querySelector('#room-command-status');if(!el)return;
  el.textContent='已同步最新牌局，请按当前局面重新选择';el.hidden=false;
  setTimeout(()=>{if(el.isConnected)el.hidden=true;},5000);
}, left(snapshot) {
  currentRoomId=null;
  showRoomBrowser(); notice(snapshot.reason === 'dissolved' ? '所有玩家同意，本局已解散' : '已退出房间');
} });
function mutate(input) { return sendRoomCommand(input); }
async function identify(name) {
  if (user) return;
  user = await api('/session', { name });
  shell.update(user);
  // If joining fails, the created identity still exists and retries must show that name.
  root.querySelectorAll('input[name="name"]').forEach(input => { input.value = user.name; input.readOnly = true; });
}
root.addEventListener('change', event => {
  if(event.target.name==='turnSeconds'){const note=event.target.form?.querySelector('[data-turn-limit-note]');if(note)note.hidden=Number(event.target.value)===0;}
  admin.change(event.target);
  forum.change(event.target);
  if (event.target.id === 'create-game') {
    syncSetup(event.target.value);
    const turnSelect = document.querySelector('#create-room-dialog [name=turnSeconds]');
    turnSelect.value = String(gameList.find(g => g.id === event.target.value)?.defaultTurnSeconds ?? 60);
    document.querySelector('#create-room-dialog [data-turn-limit-note]').hidden = turnSelect.value === '0';
  }
  if(event.target.name==='leaders'){const expert=event.target.form?.querySelector('[name=leaderExpert]');if(expert){expert.disabled=!event.target.checked;if(expert.disabled)expert.checked=false;}}
});
root.addEventListener('input', event => {
  admin.input(event.target);
  if (event.target.id !== 'lobby-search') return;
  if (roomBrowser) { roomBrowser.search(event.target.value); return; }
  if (!catalog) {
    const query = event.target.value;
    lobby();
    const search = document.querySelector('#lobby-search'); search.value = query; search.focus();
  }
  filterCatalog();
});
root.addEventListener('submit', async event => {
  if(event.target.dataset.adminForm){event.preventDefault();await admin.submit(event.target);return;}
  if(event.target.dataset.forumForm){event.preventDefault();await forum.submit(event.target);return;}
  if(event.target.dataset.hubForm){event.preventDefault();await hub.submit(event.target);return;}
  event.preventDefault(); if (pendingForms.has(event.target)) return; pendingForms.add(event.target);
  const form = event.target; const data = Object.fromEntries(new FormData(form));
  form.setAttribute('aria-busy', 'true');
  try {
    if (form.dataset.form === 'create') {
      await identify(data.name);
      const snapshot = await api('/rooms', { title: data.title, gameId: data.gameId, visibility: data.public === 'on' ? 'public' : 'private', turnSeconds:Number(data.turnSeconds), allowSpectators:data.allowSpectators==='on', options: gameCards[data.gameId]?.readOptions?.(data) ?? {} });
      if (!form.isConnected || !document.querySelector('#create-room-dialog')?.open) { notice('房间已创建，可从「我的房间」返回'); return; }
      document.querySelector('#create-room-dialog').close(); mountRoom(snapshot);
      if(pendingFriendInvite&&!data.practice){const playerId=pendingFriendInvite;pendingFriendInvite=null;await api('/friends/invite',{playerId,roomId:room.id,revision:room.revision});notice('房间已创建，同桌邀请已发送');}
      if (data.practice) {
        for (let i = 0; i < Math.max(gameList.find(g => g.id === data.gameId).minPlayers - 1, Math.min(gameList.find(g => g.id === data.gameId).maxPlayers - 1, Number(data.practice) || 1)); i++) {
          if (room?.id !== snapshot.id) return;
          await mutate({ type: 'addBot' });
        }
        if (room?.id !== snapshot.id) return;
        await mutate({ type: 'ready', ready: true });
        if (room?.id !== snapshot.id) return;
        await mutate({ type: 'start' });
      }
    }
    else if (form.id === 'join'||form.dataset.form==='join') {
      await identify(data.name); const snapshot = await api(`/rooms/${data.code.trim().toUpperCase()}/join`, {});
      if (form.isConnected) mountRoom(snapshot);
    }
    else if (form.id === 'chat') { await roomChat.send(data.text); form.reset(); }
    else if(form.id==='room-rules-form'){
      await mutate({type:'updateOptions',revision:Number(form.dataset.revision),turnSeconds:Number(data.turnSeconds),options:gameCards[room.gameId].readOptions(data)});
      document.querySelector('#room-rules-dialog')?.close();notice('规则已更新，请重新准备');
    }
  } catch (error) { notice(error.message);await recoverRoom(error); }
  finally { pendingForms.delete(form); form.removeAttribute('aria-busy'); }
});
root.addEventListener('toggle', event => {
  if(event.target.matches?.('.match-result-social') && event.target.open) tableSocial.sync();
}, true);
root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled || target.dataset.pending) return;
  if(target.tagName==='A'&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0))return;
  if (target.tagName === 'A') event.preventDefault();
  const action = target.dataset.action;
  // Directory loading owns its pending state, so a slow refresh cannot lock navigation.
  if (action === 'refresh-rooms') { refreshRooms().catch(error => notice(error.message)); return; }
  target.dataset.pending = 'true'; target.setAttribute('aria-busy', 'true');
  try {
    if(action==='connection-retry'){stream?.reconnect();}
    else if(action==='table:room'||action==='table:results'){
      if(room?.status!=='finished')return;
      if(action==='table:room'){renderer?.dispose?.();resultRoomKey=room.matchId;}
      else resultRoomKey=null;
      drawRoom();
      root.querySelector(action==='table:room'?'.postgame-room h2':'.match-result-actions button')?.focus({preventScroll:true});
    }
    else if(action.startsWith('table:')){
      if(action==='table:share')renderer?.beforeOverlay?.();
      try{await tableSocial.handle(action.slice(6),target);}
      catch(error){if(action==='table:share')renderer?.afterOverlay?.();throw error;}
    }
    else if(action==='admin')await openAdmin();
    else if(action==='admin:home')lobby();
    else if(action.startsWith('admin:'))await admin.handle(action.slice(6),target);
    else if (action === 'forum') await openForum();
    else if (action.startsWith('forum:')) await forum.handle(action.slice(6),target);
    else if (action.startsWith('hub:')) await hub.handle(action.slice(4),target);
    else if (['friends','history','shop','profile'].includes(action)) await hub.open(action);
    else if (action.startsWith('game:')) await renderer.handle(action.slice(5), target);
    else if (action === 'open-create') {await tableSocial.handle('close');openCreate(false, target.dataset.gameId);}
    else if (action === 'open-practice') openCreate(true, undefined, Number(target.dataset.botCount) || 1);
    else if (action === 'shell-menu') shell.openMenu();
    else if (action === 'close-shell-menu') shell.closeMenu();
    else if (action === 'lobby-home') lobby();
    else if (action === 'my-room') await myRoom();
    else if (action === 'browse-rooms') showRoomBrowser();
    else if(action==='watch-room')await watchRoom(target.dataset.roomId);
    else if(action==='stop-watching'){showRoomBrowser();}
    else if(action==='toggle-spectators')await mutate({type:'setSpectators',allowSpectators:!room.allowSpectators});
    else if (action === 'join-public') await joinPublic(target.dataset.roomId);
    else if (action === 'focus-join') openJoin();
    else if (action === 'mobile-search') { const search=document.querySelector('#mobile-game-search'); search?.scrollIntoView({block:'center'}); search?.focus({preventScroll:true}); }
    else if (action === 'close-join') document.querySelector('#lobby-join-dialog').close();
    else if (action === 'filter-games') { document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===target))); filterCatalog(); }
    else if (action === 'catalog-page') catalog?.page(Number(target.dataset.step));
    else if (['room-page','room-filter','room-reset'].includes(action)) roomBrowser?.handle(action,target);
    else if (action === 'close-info') document.querySelector('#lobby-info-dialog').close();
    else if(action==='pregame-guide'){
      if(room?.status!=='lobby')return;
      const snapshot=room,dialog=document.querySelector('#pregame-guide-dialog');
      dialog.dataset.options=JSON.stringify(snapshot.options);
      dialog.innerHTML=`<header class="setup-heading"><div>${setupIcon('book-open')}<h2 id="pregame-guide-title">${e(snapshot.gameId==='tidewatch'?'潮汐守望':gameList.find(g=>g.id===snapshot.gameId)?.title??'')} · 玩法手卡</h2></div><button type="button" class="setup-close" data-action="close-pregame-guide" aria-label="关闭玩法手卡">${setupIcon('x')}</button></header><div class="pregame-guide-body" aria-live="polite">正在打开手卡…</div>`;
      dialog.showModal();
      try{
        const {pregameGuide}=await import('./games/pregame-guide.js');
        const html=await pregameGuide(snapshot.gameId,snapshot.options);
        if(dialog.isConnected&&dialog.open&&room?.id===snapshot.id&&room.status==='lobby')dialog.querySelector('.pregame-guide-body').innerHTML=html;
      }catch(error){if(dialog.isConnected&&dialog.open)dialog.querySelector('.pregame-guide-body').textContent='手卡加载失败，请关闭后重试';throw error;}
    }
    else if(action==='close-pregame-guide')document.querySelector('#pregame-guide-dialog')?.close();
    else if(action==='room-rules'){
      const meta=gameCards[room.gameId];if(room.hostId!==user.id||room.status!=='lobby')return;
      const dialog=document.querySelector('#room-rules-dialog');dialog.innerHTML=rulesSetup(room,gameList.find(g=>g.id===room.gameId),meta);dialog.showModal();
    }
    else if(action==='close-room-rules')document.querySelector('#room-rules-dialog').close();
    else if (action === 'room-menu') document.querySelector('#room-menu').showModal();
    else if (action === 'close-room-menu') document.querySelector('#room-menu').close();
    else if (action === 'confirm-leave') {
      document.querySelector('#room-menu').close();
      document.querySelector('#leave-dialog p').textContent = room.status === 'playing'
        ? room.supportsBots ? '退出后由 AI 接管，无法重返本局。房主将移交；最后一位真人退出后关闭房间。' : '退出将中止本局，其他玩家返回准备房间。'
        : '退出后可加入其他房间。';
      document.querySelector('#leave-dialog').showModal();
    }
    else if (action === 'cancel-leave') document.querySelector('#leave-dialog').close();
    else if (action === 'request-dissolve') { document.querySelector('#room-menu').close(); await mutate({type:'requestDissolve'}); }
    else if (action === 'vote-yes' || action === 'vote-no') await mutate({type:'voteDissolve',voteId:room.dissolution.id,agree:action==='vote-yes'});
    else if (action === 'notifications') await hub.handle('notifications',target);
    else if (action === 'about') info('Moon Table','CABO · 魔毯商人 · 七大奇迹\n可以邀请朋友，也可以和 AI 玩。');
    else if (action === 'lobby-updates') {shell.closeMenu();await openUpdateLog(root,target.dataset.updateIndex===undefined?undefined:Number(target.dataset.updateIndex));}
    else if (action === 'help') {
      shell.closeMenu();
      const {openRulesLibrary}=await import('./rules-library.js');
      await openRulesLibrary(root,gameList.filter(g=>renderers[g.id]),gameCards);
    }
    else if (action === 'close-create') {pendingFriendInvite=null;document.querySelector('#create-room-dialog').close();}
    else if (action === 'retry') await boot();
    else if (action === 'chat-toggle') roomChat.toggle();
    else if (action === 'chat-quick') await roomChat.quick(Number(target.dataset.phrase));
    else if(action==='room-invite-friends'){document.querySelector('#room-menu')?.close();await roomInvites.open();}
    else if (action === 'copy') { if (await copyText(inviteLink(room.id), '复制邀请链接')) notice('邀请链接已复制'); }
    else if (action === 'ready') await mutate({ type: 'ready', ready: !room.players.find(p => p.id === user.id).ready });
    else if (action === 'addBot') await mutate({ type: 'addBot', seat: Number(target.dataset.seat), difficulty: document.querySelector(`[data-bot-seat="${Number(target.dataset.seat)}"]`)?.value });
    else if (action === 'removeBot') await mutate({ type: 'removeBot', playerId: target.dataset.playerId });
    else if (['start', 'leave', 'rematch'].includes(action)) await mutate({ type: action });
  } catch (error) {
    notice(error.message);
    await recoverRoom(error);
  } finally { delete target.dataset.pending; target.removeAttribute('aria-busy'); }
});
async function boot() {
  shell.show(`<main class="entry"><p>正在打开牌桌…</p></main>`, user);
  try {
    // Site branding/announcements must not delay the requested page.
    refreshSystem().catch(() => {});
    const [games, me] = await Promise.all([api('/games'),
      api('/me').catch(error => { if (error.status !== 401) throw error; })]);
    gameList = games;
    user = me?.user;
    currentRoomId=me?.roomId??null;
    const section=location.hash.slice(1);
    if(/^invite\/[A-Z0-9]{8}$/i.test(section)){lobby();try{await tableSocial.invite(section.slice(7).toUpperCase());}catch(error){notice(error.message);}}
    else if(/^result\/[a-zA-Z0-9-]{1,100}$/.test(section)){lobby();try{await tableSocial.shared(section.slice(7));}catch(error){notice(error.message);}}
    else if(section==='admin'||section.startsWith('admin/'))await openAdmin(section.split('/')[1]);
    else if(section==='forum'||section.startsWith('forum/'))await openForum(section.slice(6)||undefined,{replace:true});
    else if(section.startsWith('profile/'))await hub.open('profile',section.slice(8));
    else if(['friends','history','shop','profile'].includes(section))await hub.open(section);
    else if(/^watch\/[A-Z0-9]{8}$/i.test(section))await watchRoom(section.slice(6));
    else if (me?.roomId) mountRoom(await api(`/rooms/${me.roomId}`));
    else if (section === 'rooms') showRoomBrowser();
    else lobby();
  } catch (error) { shell.show(`<main class="entry"><h1>暂时无法连接牌桌</h1><div class="actions">${b('重新连接', 'retry')}</div></main>`, user); notice(error.message); }
}
boot();
window.addEventListener('popstate', () => {
  const section=location.hash.slice(1);
  if(/^invite\/[A-Z0-9]{8}$/i.test(section)){lobby();tableSocial.invite(section.slice(7).toUpperCase()).catch(error=>notice(error.message));}
  else if(/^result\/[a-zA-Z0-9-]{1,100}$/.test(section)){lobby();tableSocial.shared(section.slice(7)).catch(error=>notice(error.message));}
  else if(section==='admin'||section.startsWith('admin/'))openAdmin(section.split('/')[1]);
  else if(section==='forum'||section.startsWith('forum/'))openForum(section.slice(6)||undefined,{replace:true});
  else if(/^watch\/[A-Z0-9]{8}$/i.test(section))watchRoom(section.slice(6)).catch(error=>notice(error.message));
  else if(spectator)lobby();
  else if(forum.active||admin.active){if(['friends','history','shop','profile'].includes(section))hub.open(section);else if(section==='rooms')showRoomBrowser();else lobby();}
});
function presencePulse(){
  if(!user)return;
  // Hidden tabs still acknowledge presence; server-sent heartbeats alone cannot prove a client is alive.
  if(document.hidden)api('/presence').catch(()=>{});
  else {hub.pulse();refreshLobbyMembership().catch(()=>{});}
}
setInterval(presencePulse,20000);
setInterval(() => {
  const tables = root.querySelector('.ml-tables');
  if (tables && !document.hidden && !root.querySelector('dialog[open]') && !tables.contains(document.activeElement)) refreshRooms().catch(() => {});
}, 30000);
document.addEventListener('visibilitychange',presencePulse);
window.addEventListener('online',presencePulse);

setInterval(()=>{if(!document.hidden)refreshSystem().catch(()=>{});},30000);
