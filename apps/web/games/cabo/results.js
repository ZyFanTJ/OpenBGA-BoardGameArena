import { escapeHtml as e } from '../../ui.js';
import { cardArt } from '../cabo-cards.js';

/** Only consume the authoritative end-of-round view, where final hands are public. */
export function caboResults(s, name, viewerId) {
  if (!['roundEnd', 'finished'].includes(s.phase)) return '';
  return `<div class="cabo-results">${s.history.at(-1).results.map(result => {
    const player = s.players.find(p => p.id === result.id);
    return `<article class="cabo-result-player ${result.id === viewerId ? 'is-you' : ''}" aria-label="${e(name(result.id))} 的结算">
      <div class="cabo-result-heading"><b>${e(name(result.id))}${result.id === viewerId ? '<small>你</small>' : ''}</b><span>${result.id === s.caller ? 'CABO' : ''}${result.kamikaze ? ' · Kamikaze' : ''}</span></div>
      <div class="cabo-result-body"><div class="cabo-result-hand" aria-label="最终手牌">${player.cards.map(card => `<span class="playing-card result-card" role="img" aria-label="${card.value === null ? '暗牌' : `${card.value} 点`}">${cardArt(card.value)}</span>`).join('')}</div>
      <dl class="cabo-result-scores" aria-label="牌面合计、本轮得分和累计分"><div><dt>牌面</dt><dd>${result.sum}</dd></div><div><dt>本轮</dt><dd>+${result.points}</dd></div><div><dt>累计</dt><dd>${result.total}</dd></div></dl></div>
    </article>`;
  }).join('')}</div>`;
}
