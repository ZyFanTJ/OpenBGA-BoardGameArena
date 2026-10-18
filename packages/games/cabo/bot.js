// Practice opponent. Inputs contain only the same player-specific view as a browser.
const estimate = value => value ?? 6.5;
export function observe(view, playerId, previous = {}, command = null) {
  const reset = previous.round !== view.round || (view.phase === 'setup' && previous.phase !== 'setup');
  const known = reset ? {} : structuredClone(previous.known ?? {});
  for (const player of view.players) {
    if (!known[player.id] || known[player.id].length !== player.cards.length) known[player.id] = player.cards.map(() => null);
  }
  if (!reset && previous.phase === 'swap' && view.phase !== 'swap') {
    if (command?.type === 'ability') {
      const own = known[playerId], other = known[command.targetId];
      [own[command.ownSlot], other[command.slot]] = [other[command.slot], own[command.ownSlot]];
    } else {
      // Public snapshots do not identify a rival's swap targets. Forget rather than cheat.
      for (const player of view.players) known[player.id] = player.cards.map(() => null);
    }
  }
  if (!reset && previous.phase === 'drawn' && view.phase !== 'drawn') {
    if (command?.type === 'exchange' && command.slots.length === 1) known[playerId][command.slots[0]] = previous.drawn;
    else if (previous.turnId !== playerId) {
      // A rival may have replaced a hidden card without changing their hand size.
      known[previous.turnId] = view.players.find(p => p.id === previous.turnId).cards.map(() => null);
    }
  }
  for (const player of view.players) for (const card of player.cards) {
    if (card.value !== null) known[player.id][card.slot] = card.value;
  }
  if (view.reveal) known[view.reveal.playerId][view.reveal.slot] = view.reveal.value;
  return { known, round: view.round, phase: view.phase, turnId: view.turnId, drawn: view.drawn?.value ?? null };
}

export function decide(view, playerId, memory) {
  const me = view.players.find(p => p.id === playerId);
  const own = memory.known[playerId];
  const worst = me.cards.reduce((best, card) => estimate(own[card.slot]) > estimate(own[best]) ? card.slot : best, 0);
  if (view.phase === 'setup') return !view.setup ? { type: 'look', slots: [0, 1] } :
    !view.setup.confirmed ? { type: 'confirm' } : null;
  if (view.turnId !== playerId) return null;
  switch (view.phase) {
    case 'turn': {
      const sum = own.reduce((total, value) => total + estimate(value), 0);
      if (!view.caller && own.every(v => v !== null) && sum <= 9) return { type: 'cabo' };
      if (!view.caller && view.deckCount < 12 && sum <= 14) return { type: 'cabo' };
      const takeDiscard = view.discardTop !== null && view.discardTop < estimate(own[worst]) - 1;
      return { type: 'draw', source: takeDiscard ? 'discard' : 'deck' };
    }
    case 'drawn':
      return view.drawn.source === 'discard' || view.drawn.value < estimate(own[worst]) ?
        { type: 'exchange', slots: [worst] } : { type: 'discard', useAbility: true };
    case 'peek': {
      const card = me.cards.find(c => !c.faceUp && own[c.slot] === null) ?? me.cards.find(c => !c.faceUp);
      return card ? { type: 'ability', targetId: playerId, slot: card.slot } : { type: 'skip' };
    }
    case 'spy': {
      const targets = view.players.filter(p => p.id !== playerId).flatMap(p => p.cards.filter(c => !c.faceUp).map(c => ({ id: p.id, slot: c.slot })));
      const target = targets.find(t => memory.known[t.id][t.slot] === null) ?? targets[0];
      return target ? { type: 'ability', targetId: target.id, slot: target.slot } : { type: 'skip' };
    }
    case 'swap': {
      const targets = view.players.filter(p => p.id !== playerId).flatMap(p => p.cards.map(c => ({ id: p.id, slot: c.slot, value: estimate(memory.known[p.id][c.slot]) })));
      targets.sort((a, b) => a.value - b.value);
      const target = targets[0];
      return target && target.value < estimate(own[worst]) ? { type: 'ability', targetId: target.id, slot: target.slot, ownSlot: worst } : { type: 'skip' };
    }
    case 'reveal': return { type: 'confirm' };
    default: return null;
  }
}

export const bot = { observe, decide };
