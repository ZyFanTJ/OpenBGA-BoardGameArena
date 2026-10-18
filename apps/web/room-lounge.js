import { escapeHtml as e, button as b } from './ui.js';
import { icon } from './icons.js';

/** Pregame presentation consumes room snapshots and game metadata only. */
export function roomLounge(room, user, game, meta = {}) {
  const host = room.hostId === user.id;
  const me = room.players.find(p => p.id === user.id);
  const ready = room.players.filter(p => p.ready).length;
  const enough = room.players.length >= game.minPlayers;
  const canStart = enough && ready === room.players.length;
  const status = !enough ? `还差 ${game.minPlayers - room.players.length} 位玩家` : canStart ? '都到齐了，开一局' : `等待 ${room.players.length - ready} 位玩家准备`;
  const seats = Array.from({ length: room.maxPlayers }, (_, index) => {
    const player = room.players[index];
    if (!player) return `<article class="lounge-seat lounge-vacant"><span class="lounge-seat-number">${String(index + 1).padStart(2, '0')}</span><div class="lounge-avatar lounge-open">＋</div><h3>空位以待</h3><div class="lounge-seat-actions">${b('邀请朋友', 'copy', false, 'class="lounge-invite-seat"')}${host && room.supportsBots ? b('＋ AI', 'addBot', false, 'class="lounge-add-ai" aria-label="添加 AI"') : ''}</div></article>`;
    return `<article class="lounge-seat lounge-occupied lounge-player-${index % 4} ${player.ready ? 'lounge-ready' : ''} ${player.id === user.id ? 'lounge-self' : ''}">
      <span class="lounge-seat-number">${String(index + 1).padStart(2, '0')}</span>
      ${host && player.isBot ? b('×', 'removeBot', false, `class="lounge-remove" data-player-id="${e(player.id)}" aria-label="移除 ${e(player.name)}"`) : ''}
      <div class="lounge-avatar">${player.isBot ? icon('dice') : e(player.name.slice(0, 1))}${player.id === room.hostId ? '<span class="lounge-crown" title="房主">♛</span>' : ''}</div>
      <h3>${e(player.name)}${player.id === user.id ? '<small>你</small>' : ''}</h3>
      <span class="lounge-player-status">${player.ready ? '✓ 已准备' : '○ 未准备'}${player.isBot ? ' · AI' : ''}</span>
    </article>`;
  }).join('');
  return `<section class="room-lounge" aria-label="房间准备区">
    <div class="lounge-game-strip"><span class="lounge-game-mark">${icon('dice')}</span><div><h2>${e(game.title)}</h2><p>${e(meta.roomSummary?.(room.options) ?? meta.category ?? '')}</p></div><div class="lounge-game-facts"><span>${icon('people')}${game.minPlayers}–${game.maxPlayers} 人</span>${meta.duration ? `<span>${icon('clock')}${e(meta.duration)} 分钟</span>` : ''}</div><span class="lounge-room-status"><i></i>等待开局</span></div>
    <div class="lounge-table-scene ${room.maxPlayers > 4 ? 'lounge-many' : ''}">
      <div class="lounge-felt"><div class="lounge-felt-inner"></div><span class="lounge-table-brand">MOON TABLE</span><span class="lounge-table-orbit">✦</span></div>
      <div class="lounge-table-game" aria-hidden="true"><div class="game-cover ${e(meta.coverClass ?? '')}">${meta.artHtml ?? ''}</div><span>${e(game.title)}</span></div>
      <div class="lounge-seats">${seats}</div>
      <div class="lounge-table-caption"><span>${room.players.length} / ${room.maxPlayers} 已入座</span><span>${ready} / ${room.players.length} 已准备</span></div>
    </div>
    <footer class="lounge-launch"><div><span class="lounge-launch-light ${canStart ? 'is-ready' : ''}"></span><p>${status}</p></div><div class="lounge-launch-actions">${b(me.ready ? '取消准备' : '我准备好了', 'ready', false, `class="${me.ready ? 'outline-button' : 'gold-button'}"`)}${host ? b('开始游戏 →', 'start', !canStart, 'class="gold-button lounge-start"') : ''}</div></footer>
  </section>`;
}

export function roomInvitation(room) {
  return `<div class="lounge-invitation"><div><span>邀请同桌</span><small>${room.visibility === 'public' ? '公开房间' : '私人房间'}</small></div><button data-action="copy" aria-label="复制邀请房间码 ${e(room.id)}"><strong>${e(room.id)}</strong><span>复制 ${icon('arrow')}</span></button></div>`;
}

export function emptyRoom(games, metadata) {
  return `<main class="room-empty"><div class="room-empty-copy"><span class="room-empty-kicker">YOUR TABLE</span><h1>还没有入座</h1><p>选个游戏，开一桌。</p>${b('去大厅找房间 →', 'lobby-home', false, 'class="outline-button"')}</div><div class="room-empty-games">${games.map(game => {
    const meta = metadata[game.id] ?? {};
    return `<article><div class="game-cover ${e(meta.coverClass ?? '')}" role="img" aria-label="${e(game.title)}">${meta.artHtml ?? ''}</div><div><h2>${e(game.title)}</h2><p>${game.minPlayers}–${game.maxPlayers} 人${meta.duration ? ` · ${e(meta.duration)} 分钟` : ''}</p>${b('创建房间 →', 'open-create', false, `class="gold-button" data-game-id="${e(game.id)}" aria-label="创建 ${e(game.title)} 房间"`)}</div></article>`;
  }).join('')}</div></main>`;
}
