import { roles } from './cards.js';

export function safeCommand(v, id) {
  const me = v.players.find(p => p.id === id);
  if (!me) return null;
  if (v.phase === 'draft') return me.ready ? null : { type: 'draft', cardId: v.pack[0]?.id };
  if (v.phase === 'announce') return !me.alive || me.ready ? null : { type: 'announce', cardIds: me.hand.filter(c => c && roles[c.role].phase === v.nightPhase).map(c => c.id) };
  const d = v.pending;
  if (d?.actorId === id) {
    if (d.kind === 'react') return { type: 'decide', choice: me.hand.some(c => c?.role === 'mirrorMonk') ? 'mirrorMonk' : me.hand.some(c => c?.role === 'martyr') ? 'martyr' : 'accept' };
    if (d.kind === 'gravedigger') return { type: 'decide', cardId: d.cards[0].id, immediate: false };
    if (d.kind === 'shinobi') {
      const mine = [...v.intel].reverse().find(n => n.playerId === id)?.house;
      return { type: 'decide', kill: !mine || d.house.house !== mine.house || mine.house === 'ronin' };
    }
    return { type: 'decide', swap: false, reveal: false };
  }
  if (v.phase !== 'act' || v.active?.playerId !== id) return null;
  const role = v.active.card.role, others = v.players.filter(p => p.id !== id), living = others.filter(p => p.alive);
  const mine = [...v.intel].reverse().find(n => n.playerId === id)?.house;
  const hostile = living.find(p => {
    const known = p.house ?? [...v.intel].reverse().find(n => n.playerId === p.id)?.house;
    return known && mine && known.house !== mine.house;
  });
  const target = hostile ?? living[0] ?? others[0];
  if (role === 'shapeshifter') return { type: 'act', targetIds: others.slice(0, 2).map(p => p.id) };
  if (role === 'gravedigger') return { type: 'act' };
  if (role === 'thief') return { type: 'act', targetId: others.find(p => p.honorCount > me.honorCount)?.id, token: 0 };
  return { type: 'act', targetId: target.id, inspect: 'house' };
}
export const ninjaBot = {
  observe: () => ({}),
  decide(v, id) {
    if (v.phase === 'draft' && !v.players.find(p => p.id === id).ready) {
      const value = c => ({ judge: 12, mastermind: 10, shinobi: 9, mirrorMonk: 8, mystic: 7, spy: 6, martyr: 6, blindAssassin: 5, gravedigger: 5 }[c.role] ?? 3) - (c.rank ?? 0) / 10;
      return { type: 'draft', cardId: [...v.pack].sort((a, b) => value(b) - value(a))[0].id };
    }
    return safeCommand(v, id);
  },
};
