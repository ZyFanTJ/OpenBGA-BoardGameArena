import {createAdmin} from './admin/index.js';
import {createRoomInvites} from './room-invites.js';
import { api } from './api.js';
import { copyText } from './clipboard.js';
import { escapeHtml as e, button as b } from './ui.js';
import { renderers, gameCards } from './games/registry.js';
import { lobbyHtml, infoDialog } from './lobby.js';
import { createShell } from './shell.js';
import { createCatalog } from './catalog.js';
import { roomLounge, roomInvitation } from './room-lounge.js';
import { createHub } from './hub/index.js';
import { roomBrowserHtml, createRoomBrowser } from './room-browser.js';
import { createForum } from './forum/index.js';

const root = document.querySelector('#app');
const shell = createShell(root);
let user, room, stream, renderer, catalog, roomBrowser, gameList = [], publicRooms = [], busy = false, lastChat = '', noticeTimer, connectionText = '连接中', dockedChat = false;
let pendingFriendInvite;
const roomInvites=createRoomInvites({getRoom:()=>room,receive,notify:notice});
const hub = createHub({root,shell,getUser:()=>user,setUser:value=>{user=value;shell.update(user);},getGames:()=>gameList,
  exitSurface(){admin.dispose();forum.dispose();roomInvites.dispose();root.classList.remove('in-room');roomBrowser?.dispose();roomBrowser=null;catalog?.dispose();catalog=null;renderer?.dispose?.();renderer=null;stream?.close();stream=null;room=null;},
  openRoom:mountRoom,createRoom(friendId,gameId){pendingFriendInvite=friendId;lobby();openCreate(false,gameId);},practice(){lobby();openCreate(true);},
  returnRoom:myRoom,notify:notice});
const admin=createAdmin({root,shell,getUser:()=>user,setUser:value=>{user=value;shell.update(user);},notify:notice,onSettingsChanged:refreshSystem});
async function refreshSystem(){shell.updateSettings(await api('/system'));}
function openAdmin(section){
  forum.dispose();hub.dispose();roomInvites.dispose();root.classList.remove('in-room');
  roomBrowser?.dispose();roomBrowser=null;catalog?.dispose();catalog=null;renderer?.dispose?.();renderer=null;stream?.close();stream=null;room=null;
  return admin.open(section);
}
const forum = createForum({root, shell, getUser:()=>user, identify, notify:notice});
function openForum(id, options) {
  admin.dispose();
  roomInvites.dispose(); hub.dispose(); root.classList.remove('in-room');
  roomBrowser?.dispose(); roomBrowser=null; catalog?.dispose(); catalog=null;
  renderer?.dispose?.(); renderer=null; stream?.close(); stream=null; room=null;
  return forum.open(id, options);
}
const roomDesktop = matchMedia('(min-width:1001px)');
function notice(message) { const box = document.querySelector('#notice'); box.textContent = message; box.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => box.classList.remove('visible'), 6000); }
function lobby() {
  if (!document.querySelector('link[data-lobby-art]')) {
    const image = document.createElement('link');
    image.rel = 'preload'; image.as = 'image'; image.href = '/assets/lobby/hero-v2.webp'; image.fetchPriority = 'high'; image.dataset.lobbyArt = '';
    document.head.append(image);
  }
  admin.dispose();
  forum.dispose();
  roomInvites.dispose();
  hub.dispose(); history.replaceState(null,'',location.pathname);
  root.classList.remove('in-room');
  roomBrowser?.dispose(); roomBrowser = null;
  catalog?.dispose();
  renderer?.dispose?.();
  stream?.close(); stream = null; room = null;
  shell.show(lobbyHtml(user, gameList.filter(g => renderers[g.id]), gameCards, publicRooms), user);
  catalog = createCatalog(root);
  refreshRooms().catch(error => notice(error.message));
  hub.pulse();
}
async function refreshRooms() {
  if (roomBrowser) return roomBrowser.refresh();
  const directory = await api('/lobby'); publicRooms = directory.rooms;
  const roomCount = root.querySelector('#lobby-room-count');
  const playerCount = root.querySelector('#lobby-player-count');
  if (roomCount) roomCount.textContent = publicRooms.length;
  if (playerCount) playerCount.textContent = publicRooms.reduce((n, r) => n + r.count, 0);
}
function filterCatalog() { catalog?.filter(); }
async function myRoom() {
  const me = user ? await api('/me') : {};
  if (me.roomId) mountRoom(await api(`/rooms/${me.roomId}`));
  else showRoomBrowser();
}
function showRoomBrowser() {
  admin.dispose();
  forum.dispose();
  roomInvites.dispose();
  hub.dispose(); history.replaceState(null, '', location.pathname + '#rooms');
  root.classList.remove('in-room');
  catalog?.dispose(); catalog = null;
  roomBrowser?.dispose();
  renderer?.dispose?.(); renderer = null;
  stream?.close(); stream = null; room = null;
  const games = gameList.filter(game => renderers[game.id]);
  shell.show(roomBrowserHtml(user, games, gameCards), user, 'my-room');
  roomBrowser = createRoomBrowser(root, games, gameCards);
  hub.pulse();
}
function info(title, text) {
  shell.closeMenu();
  document.querySelector('#lobby-info-title').textContent = title;
  document.querySelector('#lobby-info-text').textContent = text;
  document.querySelector('#lobby-info-dialog').showModal();
}
function openCreate(practice = false, gameId, botCount = 1) {
  document.querySelector('#lobby-join-dialog')?.close();
  const select = document.querySelector('#create-game'); if (gameId) select.value = gameId;
  document.querySelector('#game-options').innerHTML = gameCards[select.value]?.optionsHtml ?? '';
  document.querySelector('#practice-mode').value = practice ? String(botCount) : '';
  document.querySelector('#create-room-title').textContent = practice ? '和 AI 玩一局' : '开个新房间';
  document.querySelector('#create-room-dialog [name=public]').checked = !practice;
  document.querySelector('#create-room-dialog').showModal();
}
function openJoin() {
  if (roomBrowser || matchMedia('(max-width:760px)').matches) {
    const dialog = document.querySelector('#lobby-join-dialog');
    dialog.append(document.querySelector('#join-panel'));
    dialog.showModal();
  }
  document.querySelector(user ? '#code' : '#join-name').focus({ preventScroll: true });
}
root.addEventListener('close', event => {
  if (event.target.id === 'lobby-join-dialog') {
    const row = document.querySelector('.lobby-feature-row'), panel = document.querySelector('#join-panel');
    if (row && panel) row.append(panel);
  }
}, true);
async function joinPublic(id) {
  if (user) return mountRoom(await api(`/rooms/${id}/join`, {}));
  document.querySelector('#code').value = id;
  openJoin();
  notice('填写昵称，即可加入这张牌桌');
}
function mountRoom(snapshot) {
  admin.dispose();
  forum.dispose();
  roomInvites.dispose();
  hub.dispose(); history.replaceState(null,'',location.pathname);
  root.classList.add('in-room');
  roomBrowser?.dispose(); roomBrowser = null;
  catalog?.dispose(); catalog = null;
  renderer?.dispose?.();
  room = snapshot; lastChat = ''; dockedChat = false;
  renderer = renderers[room.gameId]?.(command => mutate({ type: 'game', command }), drawGame);
  shell.show(`<main class="room-layout"><section class="play-column"><div id="room-bar"></div><div id="play"></div></section><aside class="chat-panel" id="room-chat" hidden><div class="chat-heading"><h2>桌边聊天</h2>${b('×', 'chat-toggle', false, 'class="quiet" aria-label="关闭聊天"')}</div><div id="messages" role="log" aria-live="polite"></div><form id="chat"><label class="sr-only" for="message">消息</label><input id="message" name="text" maxlength="500" placeholder="说点什么…" required autocomplete="off"><button aria-label="发送消息">发送</button></form></aside></main>` + infoDialog(), user, 'my-room');
  drawRoom(); connect();
  document.querySelector('.room-layout').insertAdjacentHTML('beforeend', `<dialog id="room-menu" class="platform-dialog room-menu-dialog"><button class="dialog-close" data-action="close-room-menu" aria-label="关闭房间菜单">×</button><h2>房间菜单</h2><div class="actions">${b('返回大厅 · 保留座位', 'lobby-home', false, 'class="secondary"')}${b('查看战绩', 'history', false, 'class="secondary"')}${b('同桌好友', 'friends', false, 'class="secondary"')}${b('退出房间', 'confirm-leave', false, 'class="secondary"')}<button type="button" data-action="request-dissolve" id="dissolve-trigger" class="accent">发起解散投票</button></div></dialog><dialog id="leave-dialog" class="platform-dialog"><h2>退出这张牌桌？</h2><p>${room.status === 'playing' ? room.supportsBots ? '你的座位将由 AI 接管，无法重新回到本局。房主离开会移交给其他真人；最后一位真人退出后，房间关闭。' : '此游戏尚无 AI 接管，退出会中止对局，其他玩家返回准备房间。' : '退出后可随时加入其他房间。'}</p><div class="actions">${b('继续游戏','cancel-leave',false,'class="secondary"')}${b('确认退出','leave',false,'class="accent"')}</div></dialog><dialog id="dissolve-dialog" class="platform-dialog" aria-label="解散投票"></dialog>`);
  document.querySelector('#dissolve-dialog').addEventListener('cancel', event => event.preventDefault());
  document.querySelector('.room-layout').insertAdjacentHTML('beforeend','<dialog id="room-rules-dialog" class="platform-dialog room-rules-dialog" aria-labelledby="room-rules-title"></dialog>');
  drawVote();
}
function drawRoom() {
  document.querySelector('#room-bar').innerHTML = `<div class="room-bar"><a href="/" class="room-logo" data-action="lobby-home" aria-label="Moon Table">◐</a><div class="room-identity"><h1>${e(room.title)}</h1><div class="room-presence"><span class="room-person">${e(user.name)}</span><span id="connection">${connectionText}</span></div></div><div class="room-tools">${room.status==='lobby'?b('邀请好友','room-invite-friends',false,'class="room-invite-friends"'):''}${room.status === 'finished' ? b('战绩', 'history', false, 'class="room-history-link"') : ''}${b(room.id + ' ↗', 'copy', false, `class="room-invite" aria-label="复制房间码 ${room.id}" title="复制房间码邀请朋友"`)}${b('聊天', 'chat-toggle', false, 'aria-controls="room-chat" aria-expanded="false"')}${b('⋯','room-menu',false,'class="quiet room-menu-button" aria-label="房间菜单"')}</div></div>`;
  roomInvites.sync();
  drawGame(); drawChat();
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
  panel.querySelector('.lounge-invitation')?.remove();
  if (dock) panel.insertAdjacentHTML('afterbegin', roomInvitation(room));
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
function drawGame() {
  const play = document.querySelector('#play'); if (!play) return;
  document.querySelector('.room-layout').classList.toggle('is-waiting', !room.game);
  if (room.game) {
    if (renderer?.update) renderer.update(play, room, user);
    else play.innerHTML = renderer ? renderer.render(room, user) : '<p>此游戏尚未安装界面模块。</p>';
    return;
  }
  renderer?.dispose?.();
  const game = gameList.find(g => g.id === room.gameId);
  play.innerHTML = roomLounge(room, user, game, gameCards[room.gameId]);
}
function drawChat() {
  const messages = document.querySelector('#messages');
  const key = room.chat.at(-1)?.id ?? 'empty'; if (key === lastChat) return; lastChat = key;
  const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
  messages.innerHTML = room.chat.length ? room.chat.map(m => `<article class="message ${m.userId === user.id ? 'mine' : ''}"><div><b>${e(m.name)}</b><time>${new Date(m.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div><p>${e(m.text)}</p></article>`).join('') : '<div class="chat-empty">暂无消息</div>';
  if (nearBottom) messages.scrollTop = messages.scrollHeight;
}
function receive(snapshot) {
  if (!room || snapshot.id !== room.id) return;
  if (snapshot.left) { showRoomBrowser(); notice(snapshot.reason === 'dissolved' ? '房间已关闭' : '已退出房间'); return; }
  if (snapshot.revision < room.revision) return;
  const changed = room.revision !== snapshot.revision;
  room = snapshot;
  if (changed) drawRoom(); else drawChat();
}
function connect() {
  stream?.close(); stream = new EventSource(`/api/rooms/${room.id}/events`);
  stream.onmessage = event => receive(JSON.parse(event.data));
  stream.onopen = () => { connectionText = '已连接'; const el = document.querySelector('#connection'); if (el) el.textContent = connectionText; };
  stream.onerror = () => { connectionText = '重连中'; const el = document.querySelector('#connection'); if (el) el.textContent = connectionText; };
}
async function mutate(input) {
  const snapshot = await api(`/rooms/${room.id}/actions`, { ...input, revision: room.revision });
  if (snapshot.left) { showRoomBrowser(); notice(snapshot.reason === 'dissolved' ? '所有玩家同意，本局已解散' : '已退出房间'); } else receive(snapshot);
}
async function identify(name) {
  if (user) return;
  user = await api('/session', { name });
  shell.update(user);
  // If joining fails, the created identity still exists and retries must show that name.
  root.querySelectorAll('input[name="name"]').forEach(input => { input.value = user.name; input.readOnly = true; });
}
root.addEventListener('change', event => {
  admin.change(event.target);
  forum.change(event.target);
  if (event.target.id === 'create-game') document.querySelector('#game-options').innerHTML = gameCards[event.target.value]?.optionsHtml ?? '';
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
  event.preventDefault(); if (busy) return; busy = true;
  const form = event.target; const data = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.form === 'create') {
      await identify(data.name);
      const snapshot = await api('/rooms', { title: data.title, gameId: data.gameId, visibility: data.public === 'on' ? 'public' : 'private', options: gameCards[data.gameId]?.readOptions?.(data) ?? {} });
      document.querySelector('#create-room-dialog').close(); mountRoom(snapshot);
      if(pendingFriendInvite&&!data.practice){const playerId=pendingFriendInvite;pendingFriendInvite=null;await api('/friends/invite',{playerId,roomId:room.id,revision:room.revision});notice('房间已创建，同桌邀请已发送');}
      if (data.practice) {
        for (let i = 0; i < Math.max(gameList.find(g => g.id === data.gameId).minPlayers - 1, Math.min(gameList.find(g => g.id === data.gameId).maxPlayers - 1, Number(data.practice) || 1)); i++) await mutate({ type: 'addBot' });
        await mutate({ type: 'ready', ready: true }); await mutate({ type: 'start' });
      }
    }
    else if (form.id === 'join') { await identify(data.name); mountRoom(await api(`/rooms/${data.code.trim().toUpperCase()}/join`, {})); }
    else if (form.id === 'chat') { await api(`/rooms/${room.id}/chat`, data); form.reset(); }
    else if(form.id==='room-rules-form'){
      const snapshot=await api(`/rooms/${room.id}/actions`,{type:'updateOptions',revision:Number(form.dataset.revision),options:gameCards[room.gameId].readOptions(data)});
      document.querySelector('#room-rules-dialog').close();receive(snapshot);notice('规则已更新，请重新准备');
    }
  } catch (error) { notice(error.message); } finally { busy = false; }
});
root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled || busy) return;
  if (target.tagName === 'A') event.preventDefault();
  const action = target.dataset.action;
  // Directory loading owns its pending state, so a slow refresh cannot lock navigation.
  if (action === 'refresh-rooms') { refreshRooms().catch(error => notice(error.message)); return; }
  busy = true;
  try {
    if(action==='admin')await openAdmin();
    else if(action==='admin:home')lobby();
    else if(action.startsWith('admin:'))await admin.handle(action.slice(6),target);
    else if (action === 'forum') await openForum();
    else if (action.startsWith('forum:')) await forum.handle(action.slice(6),target);
    else if (action.startsWith('hub:')) await hub.handle(action.slice(4),target);
    else if (['friends','history','shop','profile'].includes(action)) await hub.open(action);
    else if (action.startsWith('game:')) await renderer.handle(action.slice(5), target);
    else if (action === 'open-create') openCreate(false, target.dataset.gameId);
    else if (action === 'open-practice') openCreate(true, undefined, Number(target.dataset.botCount) || 1);
    else if (action === 'shell-menu') shell.openMenu();
    else if (action === 'close-shell-menu') shell.closeMenu();
    else if (action === 'lobby-home') lobby();
    else if (action === 'my-room' || action === 'browse-rooms') await myRoom();
    else if (action === 'join-public') await joinPublic(target.dataset.roomId);
    else if (action === 'focus-join') openJoin();
    else if (action === 'close-join') document.querySelector('#lobby-join-dialog').close();
    else if (action === 'filter-games') { document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===target))); filterCatalog(); }
    else if (action === 'catalog-page') catalog?.page(Number(target.dataset.step));
    else if (['room-page','room-filter','room-reset'].includes(action)) roomBrowser?.handle(action,target);
    else if (action === 'close-info') document.querySelector('#lobby-info-dialog').close();
    else if(action==='room-rules'){
      const meta=gameCards[room.gameId];if(room.hostId!==user.id||room.status!=='lobby'||!meta.optionsForm)return;
      const dialog=document.querySelector('#room-rules-dialog');dialog.innerHTML=`<form id="room-rules-form" data-revision="${room.revision}"><h2 id="room-rules-title">房间规则</h2>${meta.optionsForm(room.options)}<p class="room-rules-note">保存后，所有真人需要重新准备。</p><div class="actions">${b('取消','close-room-rules',false,'class="secondary"')}<button class="gold-button" type="submit">保存规则</button></div></form>`;dialog.showModal();
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
    else if (action === 'help') info('从一张桌子开始','选择桌游并创建房间，邀请朋友或添加 AI，准备后即可开局。\n牌桌里的「玩法手卡」可随时查看规则。');
    else if (action === 'close-create') {pendingFriendInvite=null;document.querySelector('#create-room-dialog').close();}
    else if (action === 'retry') await boot();
    else if (action === 'chat-toggle') { const panel = document.querySelector('#room-chat'); panel.hidden = !panel.hidden; document.querySelector('[aria-controls=room-chat]').setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) document.querySelector('#message').focus(); }
    else if(action==='room-invite-friends')await roomInvites.open();
    else if (action === 'copy') { if (await copyText(room.id, '复制房间码')) notice('房间码已复制'); }
    else if (action === 'ready') await mutate({ type: 'ready', ready: !room.players.find(p => p.id === user.id).ready });
    else if (action === 'addBot') await mutate({ type: 'addBot', seat: Number(target.dataset.seat) });
    else if (action === 'removeBot') await mutate({ type: 'removeBot', playerId: target.dataset.playerId });
    else if (['start', 'leave', 'rematch'].includes(action)) await mutate({ type: action });
  } catch (error) {
    notice(error.message);
    if (error.status === 409 && room) receive(await api(`/rooms/${room.id}`));
  } finally { busy = false; }
});
async function boot() {
  shell.show(`<main class="entry"><p>正在打开牌桌…</p></main>`, user);
  try {
    [gameList]=await Promise.all([api('/games'),refreshSystem()]);
    let me;
    try { me = await api('/me'); } catch (error) { if (error.status !== 401) throw error; }
    user = me?.user;
    const section=location.hash.slice(1);
    if(section==='admin'||section.startsWith('admin/'))await openAdmin(section.split('/')[1]);
    else if(section==='forum'||section.startsWith('forum/'))await openForum(section.slice(6)||undefined,{replace:true});
    else if(section.startsWith('profile/'))await hub.open('profile',section.slice(8));
    else if(['friends','history','shop','profile'].includes(section))await hub.open(section);
    else if (me?.roomId) mountRoom(await api(`/rooms/${me.roomId}`));
    else if (section === 'rooms') showRoomBrowser();
    else lobby();
  } catch (error) { shell.show(`<main class="entry"><h1>暂时无法连接牌桌</h1><div class="actions">${b('重新连接', 'retry')}</div></main>`, user); notice(error.message); }
}
boot();
window.addEventListener('popstate', () => {
  const section=location.hash.slice(1);
  if(section==='admin'||section.startsWith('admin/'))openAdmin(section.split('/')[1]);
  else if(section==='forum'||section.startsWith('forum/'))openForum(section.slice(6)||undefined,{replace:true});
  else if(forum.active||admin.active){if(['friends','history','shop','profile'].includes(section))hub.open(section);else if(section==='rooms')showRoomBrowser();else lobby();}
});
setInterval(()=>hub.pulse(),20000);

setInterval(()=>{if(!document.hidden)refreshSystem().catch(()=>{});},30000);
