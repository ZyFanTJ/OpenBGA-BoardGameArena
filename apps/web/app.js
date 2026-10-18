import { api } from './api.js';
import { escapeHtml as e, button as b } from './ui.js';
import { renderers, gameCards } from './games/registry.js';
import { lobbyHtml, roomCards, infoDialog } from './lobby.js';
import { createShell } from './shell.js';
import { createCatalog } from './catalog.js';
import { roomLounge, roomInvitation, emptyRoom } from './room-lounge.js';

const root = document.querySelector('#app');
const shell = createShell(root);
let user, room, stream, renderer, catalog, gameList = [], publicRooms = [], busy = false, lastChat = '', noticeTimer, connectionText = '连接中', dockedChat = false;
const roomDesktop = matchMedia('(min-width:1001px)');
function notice(message) { const box = document.querySelector('#notice'); box.textContent = message; box.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => box.classList.remove('visible'), 6000); }
function lobby() {
  root.classList.remove('in-room');
  catalog?.dispose();
  renderer?.dispose?.();
  stream?.close(); stream = null; room = null;
  shell.show(lobbyHtml(user, gameList.filter(g => renderers[g.id]), gameCards, publicRooms), user);
  catalog = createCatalog(root);
  refreshRooms().catch(error => notice(error.message));
}
async function refreshRooms() {
  const directory = await api('/lobby'); publicRooms = directory.rooms;
  const list = document.querySelector('#room-directory'); if (!list) return;
  list.innerHTML = roomCards(publicRooms);
  document.querySelector('#lobby-room-count').textContent = publicRooms.length;
  document.querySelector('#lobby-player-count').textContent = publicRooms.reduce((n, r) => n + r.count, 0);
  catalog?.filter(false);
}
function filterCatalog() {
  catalog?.filter();
}
function showEmptyRoom() {
  lobby();
  catalog.dispose(); catalog = null;
  shell.update(user, 'my-room');
  root.querySelector('.moon-lobby').outerHTML = emptyRoom(gameList.filter(g => renderers[g.id]), gameCards);
}
function info(title, text) {
  shell.closeMenu();
  document.querySelector('#lobby-info-title').textContent = title;
  document.querySelector('#lobby-info-text').textContent = text;
  document.querySelector('#lobby-info-dialog').showModal();
}
function openCreate(practice = false, gameId, botCount = 1) {
  const select = document.querySelector('#create-game'); if (gameId) select.value = gameId;
  document.querySelector('#game-options').innerHTML = gameCards[select.value]?.optionsHtml ?? '';
  document.querySelector('#practice-mode').value = practice ? String(botCount) : '';
  document.querySelector('#create-room-title').textContent = practice ? '和 AI 玩一局' : '开个新房间';
  document.querySelector('#create-room-dialog [name=public]').checked = !practice;
  document.querySelector('#create-room-dialog').showModal();
}
function openJoin() {
  if (matchMedia('(max-width:760px)').matches) {
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
  root.classList.add('in-room');
  catalog?.dispose(); catalog = null;
  renderer?.dispose?.();
  room = snapshot; lastChat = ''; dockedChat = false;
  renderer = renderers[room.gameId]?.(command => mutate({ type: 'game', command }), drawGame);
  shell.show(`<main class="room-layout"><section class="play-column"><div id="room-bar"></div><div id="play"></div></section><aside class="chat-panel" id="room-chat" hidden><div class="chat-heading"><h2>桌边聊天</h2>${b('×', 'chat-toggle', false, 'class="quiet" aria-label="关闭聊天"')}</div><div id="messages" role="log" aria-live="polite"></div><form id="chat"><label class="sr-only" for="message">消息</label><input id="message" name="text" maxlength="500" placeholder="说点什么…" required autocomplete="off"><button aria-label="发送消息">发送</button></form></aside></main>` + infoDialog(), user, 'my-room');
  drawRoom(); connect();
  document.querySelector('.room-layout').insertAdjacentHTML('beforeend', `<dialog id="room-menu" class="platform-dialog room-menu-dialog"><button class="dialog-close" data-action="close-room-menu" aria-label="关闭房间菜单">×</button><h2>房间菜单</h2><div class="actions">${b('返回大厅 · 保留座位', 'lobby-home', false, 'class="secondary"')}${b('退出房间', 'confirm-leave', false, 'class="secondary"')}<button type="button" data-action="request-dissolve" id="dissolve-trigger" class="accent">发起解散投票</button></div></dialog><dialog id="leave-dialog" class="platform-dialog"><h2>退出这张牌桌？</h2><p>${room.status === 'playing' ? room.supportsBots ? '你的座位将由 AI 接管，无法重新回到本局。房主离开会移交给其他真人；最后一位真人退出后，房间关闭。' : '此游戏尚无 AI 接管，退出会中止对局，其他玩家返回准备房间。' : '退出后可随时加入其他房间。'}</p><div class="actions">${b('继续游戏','cancel-leave',false,'class="secondary"')}${b('确认退出','leave',false,'class="accent"')}</div></dialog><dialog id="dissolve-dialog" class="platform-dialog" aria-label="解散投票"></dialog>`);
  document.querySelector('#dissolve-dialog').addEventListener('cancel', event => event.preventDefault());
  drawVote();
}
function drawRoom() {
  document.querySelector('#room-bar').innerHTML = `<div class="room-bar"><a href="/" class="room-logo" data-action="lobby-home" aria-label="Moon Table">◐</a><div class="room-identity"><h1>${e(room.title)}</h1><div class="room-presence"><span class="room-person">${e(user.name)}</span><span id="connection">${connectionText}</span></div></div><div class="room-tools">${b(room.id + ' ↗', 'copy', false, `class="room-invite" aria-label="复制房间码 ${room.id}" title="复制房间码邀请朋友"`)}${b('聊天', 'chat-toggle', false, 'aria-controls="room-chat" aria-expanded="false"')}${b('⋯','room-menu',false,'class="quiet room-menu-button" aria-label="房间菜单"')}</div></div>`;
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
  if (snapshot.left) { lobby(); notice(snapshot.reason === 'dissolved' ? '房间已关闭，已返回大厅' : '已退出房间'); return; }
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
  if (snapshot.left) { lobby(); notice(snapshot.reason === 'dissolved' ? '所有玩家同意，本局已解散' : '已退出房间'); } else receive(snapshot);
}
async function identify(name) {
  if (user) return;
  user = await api('/session', { name });
  shell.update(user);
  // If joining fails, the created identity still exists and retries must show that name.
  root.querySelectorAll('input[name="name"]').forEach(input => { input.value = user.name; input.readOnly = true; });
}
root.addEventListener('change', event => {
  if (event.target.id === 'create-game') document.querySelector('#game-options').innerHTML = gameCards[event.target.value]?.optionsHtml ?? '';
});
root.addEventListener('input', event => {
  if (event.target.id !== 'lobby-search') return;
  if (!catalog) {
    const query = event.target.value;
    lobby();
    const search = document.querySelector('#lobby-search'); search.value = query; search.focus();
  }
  filterCatalog();
});
root.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return; busy = true;
  const form = event.target; const data = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.form === 'create') {
      await identify(data.name);
      const snapshot = await api('/rooms', { title: data.title, gameId: data.gameId, visibility: data.public === 'on' ? 'public' : 'private', options: gameCards[data.gameId]?.readOptions?.(data) ?? {} });
      document.querySelector('#create-room-dialog').close(); mountRoom(snapshot);
      if (data.practice) {
        for (let i = 0; i < Math.max(gameList.find(g => g.id === data.gameId).minPlayers - 1, Math.min(gameList.find(g => g.id === data.gameId).maxPlayers - 1, Number(data.practice) || 1)); i++) await mutate({ type: 'addBot' });
        await mutate({ type: 'ready', ready: true }); await mutate({ type: 'start' });
      }
    }
    else if (form.id === 'join') { await identify(data.name); mountRoom(await api(`/rooms/${data.code.trim().toUpperCase()}/join`, {})); }
    else if (form.id === 'chat') { await api(`/rooms/${room.id}/chat`, data); form.reset(); }
  } catch (error) { notice(error.message); } finally { busy = false; }
});
root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled || busy) return;
  if (target.tagName === 'A') event.preventDefault();
  const action = target.dataset.action; busy = true;
  try {
    if (action.startsWith('game:')) await renderer.handle(action.slice(5), target);
    else if (action === 'open-create') openCreate(false, target.dataset.gameId);
    else if (action === 'open-practice') openCreate(true, undefined, Number(target.dataset.botCount) || 1);
    else if (action === 'shell-menu') shell.openMenu();
    else if (action === 'close-shell-menu') shell.closeMenu();
    else if (action === 'lobby-home') lobby();
    else if (action === 'my-room') { const me = user ? await api('/me') : {}; if (me.roomId) mountRoom(await api(`/rooms/${me.roomId}`)); else showEmptyRoom(); }
    else if (action === 'refresh-rooms') await refreshRooms();
    else if (action === 'join-public') await joinPublic(target.dataset.roomId);
    else if (action === 'focus-join') openJoin();
    else if (action === 'close-join') document.querySelector('#lobby-join-dialog').close();
    else if (action === 'browse-rooms') document.querySelector('#public-rooms').scrollIntoView({ block: 'center', behavior: 'smooth' });
    else if (action === 'filter-games') { document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===target))); filterCatalog(); }
    else if (action === 'catalog-page') catalog?.page(Number(target.dataset.step));
    else if (action === 'room-page') catalog?.roomPage(Number(target.dataset.step));
    else if (action === 'close-info') document.querySelector('#lobby-info-dialog').close();
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
    else if (action === 'notifications') info('通知','目前没有新通知。房间动态会在牌桌内实时同步。');
    else if (action === 'profile') info(user ? user.name : '月下旅人', user ? '昵称已保存在当前浏览器。可以从「我的房间」回到保留的座位。' : '创建或加入房间时，填写昵称即可入座。');
    else if (action === 'about') info('Moon Table','CABO · 魔毯商人 · 七大奇迹\n可以邀请朋友，也可以和 AI 玩。');
    else if (action === 'help') info('从一张桌子开始','选择桌游并创建房间，邀请朋友或添加 AI，准备后即可开局。\n牌桌里的「玩法手卡」可随时查看规则。');
    else if (action.startsWith('soon-')) info({ 'soon-friends':'好友', 'soon-history':'战绩', 'soon-shop':'商城' }[action], '此功能尚未开放，当前可以在大厅选择桌游并创建房间，与朋友或 AI 一起玩。');
    else if (action === 'close-create') document.querySelector('#create-room-dialog').close();
    else if (action === 'retry') await boot();
    else if (action === 'chat-toggle') { const panel = document.querySelector('#room-chat'); panel.hidden = !panel.hidden; document.querySelector('[aria-controls=room-chat]').setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) document.querySelector('#message').focus(); }
    else if (action === 'copy') { await navigator.clipboard.writeText(room.id); notice('房间码已复制'); }
    else if (action === 'ready') await mutate({ type: 'ready', ready: !room.players.find(p => p.id === user.id).ready });
    else if (action === 'addBot') await mutate({ type: 'addBot' });
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
    gameList = await api('/games');
    let me;
    try { me = await api('/me'); } catch (error) { if (error.status !== 401) throw error; }
    user = me?.user;
    if (me?.roomId) mountRoom(await api(`/rooms/${me.roomId}`)); else lobby();
  } catch (error) { shell.show(`<main class="entry"><h1>暂时无法连接牌桌</h1><div class="actions">${b('重新连接', 'retry')}</div></main>`, user); notice(error.message); }
}
boot();

