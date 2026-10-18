/** Public gestures only: never include a drawn value, revealed value or card identity. */
export function motionFor(state, transition) {
  if (!transition) return null;
  const { before, actorId, command: c } = transition;
  const base = { actorId };
  const target = (playerId, slot) => ({ playerId, slot });
  if (c.type === 'start' || c.type === 'nextRound') return { ...base, kind: 'deal' };
  if (c.type === 'draw') return { ...base, kind: 'draw', source: c.source };
  if (c.type === 'look') return { ...base, kind: 'look', targets: c.slots.map(slot => target(actorId, slot)) };
  if (c.type === 'confirm') {
    const targets = before.phase === 'setup' ? (before.setup[actorId]?.slots ?? []).map(slot => target(actorId, slot)) :
      before.reveal ? [target(before.reveal.playerId, before.reveal.slot)] : [];
    return { ...base, kind: 'cover', targets };
  }
  if (c.type === 'discard') return { ...base, kind: 'discard', ability: ['peek', 'spy', 'swap'].includes(state.phase) ? state.phase : null };
  if (c.type === 'exchange') {
    const oldCount = before.players.find(p => p.id === actorId).cards.length;
    const newCount = state.players.find(p => p.id === actorId).cards.length;
    return { ...base, kind: 'exchange', slots: [...c.slots], replaceAt: c.replaceAt ?? c.slots[0],
      success: newCount === oldCount - c.slots.length + 1, end: c.end ?? 'right' };
  }
  if (c.type === 'ability') return { ...base, kind: before.phase,
    targets: before.phase === 'swap' ? [target(actorId, c.ownSlot), target(c.targetId, c.slot)] : [target(c.targetId, c.slot)] };
  if (c.type === 'cabo') return { ...base, kind: 'cabo' };
  return null;
}
