import { escapeHtml as e } from '../ui.js';
import { cardArt, seatPositions } from './cabo-cards.js';
import { finalRoundBanner, finalTurnsRemaining } from './cabo/call-effect.js';

export function renderCaboTable({ s, room, user, name, selectable, selected, help, controls }) {
  const ended = ['roundEnd', 'finished'].includes(s.phase);
  const canDraw = s.phase === 'turn' && s.turnId === user.id;
  const seats = seatPositions(s.players, user.id).map(({ player: p, position, color }) => {
    const active = !ended && s.phase !== 'setup' && p.id === s.turnId;
    return `<section class="table-seat seat-${position} color-${color} ${active ? 'is-active' : ''} ${p.id === s.caller ? 'cabo-caller' : ''}" aria-label="${e(name(p.id))} 的座位" data-seat="${position}" data-player="${p.id}">
      <div class="player-badge" data-motion-key="seat:${p.id}"><span class="player-avatar" aria-hidden="true">${e(name(p.id).slice(0, 1))}</span><span class="player-name">${e(name(p.id))}${p.id === user.id ? '<small>你</small>' : ''}</span><span class="score-chip" aria-label="累计 ${p.total} 分">${p.total}<small>分</small></span>${p.setupDone && s.phase === 'setup' ? '<span class="ready-check" aria-label="已准备">✓</span>' : ''}${p.id === s.caller ? '<span class="cabo-chip">CABO</span>' : ''}</div>
      <div class="table-hand">${p.cards.map(card => {
        const picked = selected.some(x => x.id === p.id && x.slot === card.slot);
        const revealed = s.reveal?.playerId === p.id && s.reveal.slot === card.slot;
        const value = revealed ? s.reveal.value : card.value;
        return `<button type="button" class="playing-card ${picked ? 'selected' : ''} ${revealed ? 'revealed' : ''}" data-action="game:card" data-player="${p.id}" data-slot="${card.slot}" data-motion-key="hand:${p.id}:${card.slot}" data-value="${value ?? ''}" ${selectable(p, card) ? '' : 'disabled'} aria-pressed="${picked}" aria-label="${e(name(p.id))} 第 ${card.slot + 1} 张，${value ?? '暗牌'}">${cardArt(value)}<span class="slot-index">${card.slot + 1}</span>${card.faceUp && !ended ? '<span class="public-marker" title="公开牌" aria-label="公开牌">◉</span>' : ''}</button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  return `<section class="cabo-stage phase-${s.phase} ${ended ? 'round-ended' : ''} ${finalTurnsRemaining(s) ? 'cabo-final-round' : ''}" aria-label="CABO 牌桌">
    <div class="felt-surface" aria-hidden="true"><div class="felt-inner"></div><span class="felt-logo">CABO</span><span class="felt-edition">MOON TABLE · SECOND EDITION</span></div>
    <div class="table-hud"><span class="round-counter"><small>ROUND</small><strong>${String(s.round).padStart(2, '0')}</strong></span>${s.expert ? '<span class="mode-chip">专家</span>' : ''}</div>
    ${finalRoundBanner(s, name)}
    ${seats}
    <div class="center-piles has-drawn" aria-label="中央牌堆"><div class="pile-group"><button class="playing-card draw-pile" data-motion-key="deck" data-value="" data-action="game:deck" aria-label="从牌库抽牌，剩余 ${s.deckCount} 张" ${canDraw && s.deckCount ? '' : 'disabled'}>${cardArt(null)}</button><span class="pile-label">牌库 <b>${s.deckCount}</b></span></div><div class="pile-group"><button class="playing-card discard-pile" data-motion-key="discard" data-value="${s.discardTop ?? ''}" data-action="game:discardPile" aria-label="拿取弃牌，${s.discardTop ?? '空'}" ${canDraw && s.discardTop !== null ? '' : 'disabled'}>${s.discardTop === null ? '<span class="empty-pile">—</span>' : cardArt(s.discardTop)}</button><span class="pile-label">弃牌</span></div><div class="pile-group held-card ${s.phase === 'drawn' ? '' : 'held-empty'}" ${s.phase === 'drawn' ? '' : 'aria-hidden="true"'}><div class="playing-card" data-motion-key="held" data-value="${s.drawn?.value ?? ''}" role="img" aria-label="${s.drawn ? `抽到 ${s.drawn.value}` : '对手抽到的暗牌'}">${cardArt(s.drawn?.value ?? null)}</div><span class="pile-label">${s.drawn ? `抽到 ${s.drawn.value}` : '抽牌'}</span></div></div>
    ${ended ? '<div class="cabo-settlement-backdrop" aria-hidden="true"></div>' : ''}
    <section class="table-actions ${ended ? 'settlement' : ''}" ${ended ? 'role="dialog" aria-label="本轮结算"' : 'aria-label="游戏操作"'}><p class="turn-prompt" role="status">${e(help)}</p><div class="actions">${controls}</div></section>
  </section>`;
}


