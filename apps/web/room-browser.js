import { api } from './api.js';
import { escapeHtml as e } from './ui.js';
import { icon } from './icons.js';
import { lobbyDialogs, lobbyFooter } from './lobby.js';

const PAGE_SIZE = 12;
export const canJoinRoom = room => room.status === 'lobby' && room.count < room.maxPlayers;

export function filterRooms(rooms, games, { query = '', gameId = '', status = 'joinable' } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const titles = new Map(games.map(game => [game.id, game.title]));
  return rooms.filter(room => {
    const text = `${room.title} ${room.id} #${room.id} ${room.host} ${room.gameId} ${titles.get(room.gameId) ?? ''}`.toLocaleLowerCase();
    return (!gameId || room.gameId === gameId)
      && (status === 'all' || status === 'joinable' && canJoinRoom(room) || status === 'playing' && room.status === 'playing')
      && terms.every(term => text.includes(term));
  });
}

export function roomBrowserHtml(user, games, metadata) {
  return `<main class="room-browser" aria-labelledby="room-browser-title">
    <div class="rb-heading"><div><span class="rb-eyebrow">MOON TABLE / ROOMS</span><h1 id="room-browser-title">房间大厅</h1></div><div class="rb-actions"><button class="outline-button" data-action="focus-join">房间码加入</button><button class="gold-button" data-action="open-create">＋ 创建房间</button></div></div>
    <div class="rb-toolbar"><label class="rb-search">${icon('search')}<span class="sr-only">搜索房间、房间码、房主或桌游</span><input id="room-search" type="search" placeholder="搜索房间、房间码、房主" autocomplete="off"></label><label class="rb-game"><span class="sr-only">筛选桌游</span><select id="room-game"><option value="">全部桌游</option>${games.map(game => `<option value="${e(game.id)}">${e(game.title)}</option>`).join('')}</select></label><div class="rb-filters" role="group" aria-label="房间状态">${[['joinable','可加入'],['all','全部'],['playing','进行中']].map(([value,label]) => `<button data-action="room-filter" data-room-filter="${value}" aria-pressed="${value === 'joinable'}">${label}</button>`).join('')}</div><button class="rb-refresh" data-action="refresh-rooms" aria-label="刷新房间" title="刷新房间">${icon('refresh')}</button></div>
    <div class="rb-summary"><span id="room-result-count" role="status">正在寻找牌桌…</span><span id="room-refresh-error" role="status" hidden>刷新失败，请重试</span><nav class="rb-pagination" aria-label="房间翻页" hidden><button data-action="room-page" data-step="-1" aria-label="上一页房间">‹</button><output></output><button data-action="room-page" data-step="1" aria-label="下一页房间">›</button></nav></div>
    <section class="rb-grid" id="room-directory" aria-label="公开房间" aria-busy="true"><div class="rb-empty"><span class="rb-empty-symbol">◐</span><h2>正在寻找牌桌…</h2></div></section>
  </main>${lobbyFooter()}${lobbyDialogs(user, games, metadata, {joinInDialog:true})}`;
}

export function roomCard(room, games, metadata) {
  const game = games.find(game => game.id === room.gameId), meta = metadata[room.gameId] ?? {};
  const joinable = canJoinRoom(room);
  const status = room.status === 'playing' ? '进行中' : room.status === 'finished' ? '已结束' : joinable ? '等待中' : '已满';
  return `<article class="rb-card ${joinable ? 'is-open' : ''}" data-room-id="${e(room.id)}">
    <div class="rb-art game-cover ${e(meta.coverClass ?? '')}" aria-hidden="true">${meta.artHtml ?? ''}</div>
    <div class="rb-card-top"><span class="rb-game-title">${e(game?.title ?? room.gameId)}</span><span class="rb-state"><i></i>${status}</span></div>
    <div class="rb-card-copy"><h2 title="${e(room.title)}">${e(room.title)}</h2><span class="rb-code">#${e(room.id)}</span></div>
    <div class="rb-occupancy"><span class="rb-host" title="${e(room.host)}">${icon('people')}${e(room.host)}</span><span class="rb-player-count" aria-label="${room.count} 人，最多 ${room.maxPlayers} 人"><b>${room.count}</b> / ${room.maxPlayers}<span>人</span></span></div>
    <footer><div class="rb-seat-track" aria-hidden="true">${Array.from({length:room.maxPlayers},(_,index) => `<i class="${index < room.count ? 'occupied' : ''}"></i>`).join('')}</div><button class="${joinable ? 'gold-button' : 'outline-button'}" data-action="join-public" data-room-id="${e(room.id)}" ${joinable ? '' : 'disabled'} aria-label="${joinable ? '加入' : status} ${e(room.title)}">${joinable ? '加入房间 →' : status}</button></footer>
  </article>`;
}

/** Owns directory loading and local filters; never reads private room snapshots. */
export function createRoomBrowser(root, games, metadata) {
  const surface = root.querySelector('.room-browser'), grid = surface.querySelector('#room-directory');
  let rooms = [], page = 0, status = 'joinable', loaded = false, disposed = false, pending;
  const search = surface.querySelector('#room-search'), game = surface.querySelector('#room-game');
  function render() {
    const matches = filterRooms(rooms, games, {query:search.value, gameId:game.value, status});
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    surface.querySelector('#room-result-count').textContent = `${matches.length} 间${status === 'joinable' ? '可加入的' : ''}房间`;
    grid.innerHTML = matches.length ? matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(room => roomCard(room, games, metadata)).join('')
      : `<div class="rb-empty"><span class="rb-empty-symbol">${icon('room')}</span><h2>${!rooms.length ? '还没有公开房间' : '没有匹配的房间'}</h2><div>${!rooms.length ? '<button data-action="open-create" class="gold-button">创建房间</button>' : '<button data-action="room-reset" class="outline-button">查看全部房间</button>'}</div></div>`;
    const pager = surface.querySelector('.rb-pagination');
    pager.hidden = pages <= 1;
    pager.querySelector('output').textContent = `${page + 1} / ${pages}`;
    pager.querySelector('[data-step="-1"]').disabled = page === 0;
    pager.querySelector('[data-step="1"]').disabled = page === pages - 1;
  }
  async function refresh() {
    if (pending) return pending;
    const button = surface.querySelector('.rb-refresh');
    button.disabled = true; grid.setAttribute('aria-busy','true');
    pending = (async () => {
      try {
        const result = await api('/lobby');
        if (disposed) return;
        rooms = result.rooms; loaded = true;
        surface.querySelector('#room-refresh-error').hidden = true;
        render();
      } catch {
        if (disposed) return;
        surface.querySelector('#room-refresh-error').hidden = false;
        if (!loaded) {
          surface.querySelector('#room-result-count').textContent = '暂时无法读取房间';
          grid.innerHTML = '<div class="rb-empty"><span class="rb-empty-symbol">◐</span><h2>房间列表暂不可用</h2><button class="outline-button" data-action="refresh-rooms">重新加载</button></div>';
        }
      } finally {
        pending = null;
        if (!disposed) { button.disabled = false; grid.setAttribute('aria-busy','false'); }
      }
    })();
    return pending;
  }
  function filter() { page = 0; if (loaded) render(); }
  search.addEventListener('input', filter); game.addEventListener('change', filter);
  const timer = setInterval(() => {
    if (!document.hidden && !root.querySelector('dialog[open]') && !grid.contains(document.activeElement)) refresh();
  }, 30000);
  refresh();
  return {
    refresh,
    search(query) { search.value = query; filter(); },
    handle(action, target) {
      if (action === 'room-filter') {
        status = target.dataset.roomFilter;
        surface.querySelectorAll('[data-room-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
        filter();
      } else if (action === 'room-page') {
        page = Math.max(0, page + Number(target.dataset.step)); if (loaded) render();
        surface.querySelector('.rb-summary').scrollIntoView({block:'nearest'});
      } else if (action === 'room-reset') {
        search.value = ''; game.value = '';
        status = 'all';
        surface.querySelectorAll('[data-room-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.roomFilter === 'all')));
        filter();
      }
    },
    dispose() { disposed = true; clearInterval(timer); },
  };
}
