import {setupIcon} from './room-setup.js';
import {playerIdentity,playerAvatar} from './player-identity.js';
import { escapeHtml as e, button as b } from './ui.js';
import { icon } from './icons.js';
import {resultActions} from './result-actions.js';

/** Returning from results is local navigation; only explicit rematch commands change the room. */
export function postgameRoom(room, user, game) {
  return `<section class="postgame-room" aria-label="对局后的房间"><div class="postgame-room-heading"><span>今夜同桌</span><h2 tabindex="-1">${e(game?.title ?? room.gameId)} · 本局已结束</h2><p>座位已保留，可以查看战绩或继续下一局。</p></div>${resultActions(room,user,{roomView:true})}<div class="postgame-room-players">${room.players.map(player => `<article>${playerIdentity(player)}<span>${player.id === room.hostId ? '房主 · ' : ''}${player.isBot ? 'AI 同桌' : room.rematchVotes?.includes(player.id) ? '想继续下一局' : '仍在房间'}</span></article>`).join('')}</div></section>`;
}

/** Pregame presentation consumes room snapshots and game metadata only. */
export function roomLounge(room, user, game, meta = {}) {
  const host = room.hostId === user.id;
  const me = room.players.find(p => p.id === user.id);
  const ready = room.players.filter(p => p.ready).length;
  const enough = room.players.length >= game.minPlayers;
  const canStart = game.enabled!==false && enough && ready === room.players.length;
  const status = game.enabled===false?'此游戏已下线，等待管理员重新上线':!enough ? `还差 ${game.minPlayers - room.players.length} 位玩家` : canStart ? '都到齐了，开一局' : `等待 ${room.players.length - ready} 位玩家准备`;
  const seats = Array.from({ length: room.maxPlayers }, (_, index) => {
    const player = room.players.find((p,i)=>(p.seat??i)===index);
    if (!player) return `<article class="lounge-seat lounge-vacant" data-seat="${index}"><span class="lounge-seat-number">${String(index + 1).padStart(2, '0')}</span><button type="button" class="lounge-seat-invite" data-action="room-invite-friends" aria-label="邀请好友入座 ${index+1} 号位"><span class="lounge-avatar lounge-open" aria-hidden="true">＋</span><span>邀请好友</span></button><div class="lounge-seat-actions">${host && room.supportsBots ? `<div class="lounge-ai-controls" role="group" aria-label="${index+1} 号座位 AI">${room.botDifficulties?.length ? `<select data-bot-seat="${index}" aria-label="${index+1} 号座位 AI 难度">${room.botDifficulties.map(d=>`<option value="${e(d.id)}">${e(d.label.replace(/\s*AI$/i,''))}</option>`).join('')}</select>` : ''}${b('添加 AI', 'addBot', false, `class="lounge-add-ai" data-seat="${index}" aria-label="在 ${index+1} 号座位添加 AI"`)}</div>` : ''}</div></article>`;
    return `<article class="lounge-seat lounge-occupied lounge-player-${index % 4} ${player.ready ? 'lounge-ready' : ''} ${player.id === user.id ? 'lounge-self' : ''}" data-seat="${index}">
      <span class="lounge-seat-number">${String(index + 1).padStart(2, '0')}</span>
      ${host && player.isBot ? b('×', 'removeBot', false, `class="lounge-remove" data-player-id="${e(player.id)}" aria-label="移除 ${e(player.name)}"`) : ''}
      <div class="lounge-avatar">${playerAvatar(room,player.id,'lounge-portrait')}${player.id === room.hostId ? '<span class="lounge-crown" title="房主">♛</span>' : ''}</div>
      <h3>${playerIdentity(player)}</h3>
      <span class="lounge-player-status">${player.ready ? '✓ 已准备' : '○ 未准备'}${player.isBot ? ' · ' + e(room.botDifficulties?.find(d=>d.id===(player.botDifficulty??room.botDifficulties?.[0]?.id??'easy'))?.label ?? 'AI') : ''}</span>
    </article>`;
  }).join('');
  return `<section class="room-lounge ${room.maxPlayers > 4 ? 'lounge-large-room' : ''}" aria-label="房间准备区">
    <div class="lounge-game-strip"><span class="lounge-game-mark">${icon('dice')}</span><div class="lounge-game-title"><h2 title="${e(game.title)}">${e(game.title)}</h2></div><div class="lounge-game-facts"><span title="单轮操作时限">${icon('clock')}${room.turnSeconds?`${room.turnSeconds} 秒 / 轮`:'不限时'}</span><span>${icon('people')}${game.minPlayers}–${game.maxPlayers} 人</span>${meta.duration ? `<span>${icon('clock')}${e(meta.duration)} 分钟</span>` : ''}</div><button type="button" class="outline-button lounge-guide-button" data-action="pregame-guide" aria-haspopup="dialog">${setupIcon('book-open')}玩法手卡</button>${host?b('规则设置','room-rules',false,'class="outline-button lounge-rules-button"'):''}<span class="lounge-room-status"><i></i>等待开局</span></div>
    <div class="lounge-table-scene ${room.maxPlayers > 4 ? 'lounge-many' : ''}">
      <div class="lounge-felt"><div class="lounge-felt-inner"></div><span class="lounge-table-brand">MOON TABLE</span><span class="lounge-table-orbit">✦</span></div>
      <div class="lounge-table-game" aria-hidden="true"><div class="game-cover ${e(meta.coverClass ?? '')}">${meta.artHtml ?? ''}</div><span>${e(game.title)}</span></div>
      <div class="lounge-seats">${seats}</div>
      <div class="lounge-table-caption"><span>${room.players.length} / ${room.maxPlayers} 已入座</span><span>${ready} / ${room.players.length} 已准备</span></div>
    </div>
    <footer class="lounge-launch"><div><span class="lounge-launch-light ${canStart ? 'is-ready' : ''}"></span><p>${status}</p></div><div class="lounge-launch-actions">${b(me.ready ? '取消准备' : '我准备好了', 'ready', false, `class="${me.ready ? 'outline-button' : 'gold-button'}"`)}${host ? b('开始游戏 →', 'start', !canStart, 'class="gold-button lounge-start"') : ''}</div></footer>
  </section>`;
}
