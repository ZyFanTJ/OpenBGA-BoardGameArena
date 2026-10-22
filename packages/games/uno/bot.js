import { COLORS, points } from './cards.js';
export function safeCommand(view, id) {
  if (view.turnId !== id || ['roundEnd', 'finished'].includes(view.phase)) return null;
  if (view.legal.catch) return { type: 'catch' };
  const hand = view.hand;
  const color = [...COLORS].sort((a,b) => hand.filter(c=>c.color===b).length-hand.filter(c=>c.color===a).length)[0];
  if (view.phase === 'color') return { type: 'color', color };
  if (view.phase === 'challenge') return { type: 'accept' };
  const cards = hand.filter(c => view.legal.play.includes(c.id) && !(c.value === 'wild4' && view.legal.wild4Risk));
  cards.sort((a,b) => Number(!!b.color)-Number(!!a.color) || points(b)-points(a));
  if (cards.length) return { type: 'play', cardId: cards[0].id, ...(cards[0].color ? {} : { color }), uno: true };
  return { type: view.phase === 'drawn' ? 'pass' : 'draw' };
}
export const unoBot = { observe: () => ({}), decide: safeCommand };
