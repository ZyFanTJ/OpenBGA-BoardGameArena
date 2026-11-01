// Practice opponent. Inputs contain only the same player-specific view as a browser.
const estimate = value => value ?? 6.5;
export function observe(view, playerId, previous = {}, command = null) {
  const reset = previous.round !== view.round || (view.phase === 'setup' && previous.phase !== 'setup');
  const known = reset ? {} : structuredClone(previous.known ?? {});
  const motion = reset ? null : view.motion;
  const discard = reset ? (view.discardTop === null ? [] : [view.discardTop]) : [...(previous.discard ?? [])];
  if (motion?.kind === 'swap') {
    const [a, b] = motion.targets;
    [known[a.playerId][a.slot], known[b.playerId][b.slot]] = [known[b.playerId][b.slot], known[a.playerId][a.slot]];
  }
  if (motion?.kind === 'draw' && motion.source === 'discard') discard.pop();
  if (motion?.kind === 'discard') discard.push(view.discardTop);
  if (motion?.kind === 'exchange') {
    const old = known[motion.actorId];
    const incoming = previous.drawn ?? (previous.drawSource === 'discard' ? previous.takenDiscard : null);
    if (motion.success) {
      // A successful matching exchange proves every outgoing value equals the public top.
      discard.push(...motion.slots.map(() => view.discardTop));
      known[motion.actorId] = old.flatMap((value, slot) => !motion.slots.includes(slot) ? [value] : slot === motion.replaceAt ? [incoming] : []);
    } else {
      const added = Array(view.players.find(p => p.id === motion.actorId).cards.length - old.length).fill(null);
      added[0] = incoming;
      known[motion.actorId] = motion.end === 'left' ? [...added, ...old] : [...old, ...added];
    }
  }
  for (const player of view.players) {
    if (!known[player.id] || known[player.id].length !== player.cards.length) known[player.id] = player.cards.map(() => null);
  }
  if (!reset && !motion && previous.phase === 'swap' && view.phase !== 'swap') {
    if (command?.type === 'ability') {
      const own = known[playerId], other = known[command.targetId];
      [own[command.ownSlot], other[command.slot]] = [other[command.slot], own[command.ownSlot]];
    } else {
      // Public snapshots do not identify a rival's swap targets. Forget rather than cheat.
      for (const player of view.players) known[player.id] = player.cards.map(() => null);
    }
  }
  if (!reset && !motion && previous.phase === 'drawn' && view.phase !== 'drawn') {
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
  // Missing transitions (e.g. timeout batches) cannot safely preserve a discard ledger.
  if (!reset && !motion && (previous.phase !== view.phase || previous.turnId !== view.turnId)) {
    discard.splice(0, discard.length, ...(view.discardTop === null ? [] : [view.discardTop]));
  }
  return { known, discard, round: view.round, phase: view.phase, turnId: view.turnId, drawn: view.drawn?.value ?? null,
    drawSource: motion?.kind === 'draw' ? motion.source : previous.drawSource,
    takenDiscard: motion?.kind === 'draw' ? previous.discardTop : previous.takenDiscard, discardTop: view.discardTop };
}

export function decide(view, playerId, memory, { difficulty = 'easy' } = {}) {
  if (difficulty !== 'easy') return strategicDecision(view, playerId, memory, difficulty);
  const me = view.players.find(p => p.id === playerId);
  const own = memory.known[playerId];
  const worst = me.cards.reduce((best, card) => estimate(own[card.slot]) > estimate(own[best]) ? card.slot : best, 0);
  if (view.phase === 'setup') return !view.setup ? { type: 'look', slots: [0, 1] } :
    !view.setup.confirmed ? { type: 'confirm' } : null;
  if (view.turnId !== playerId) return null;
  switch (view.phase) {
    case 'turn': {
      const sum = own.reduce((total, value) => total + estimate(value), 0);
      const behind = view.players.some(p => p.id !== playerId && memory.known[p.id].every(v => v !== null) && memory.known[p.id].reduce((a,b)=>a+b,0) < sum);
      if (!view.caller && !behind && own.every(v => v !== null) && sum <= 9) return { type: 'cabo' };
      if (!view.caller && !behind && view.deckCount < 12 && sum <= 14) return { type: 'cabo' };
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

/** Beliefs use only observed cards. Unknown slots use an approximate marginal distribution,
 * not identities from the authoritative deck; sum convolutions assume independence. */
export function unseenDistribution(view, memory) {
  const counts = Array.from({ length: 14 }, (_, v) => v === 0 || v === 13 ? 2 : 4);
  for (const value of [...Object.values(memory.known).flat(), ...(memory.discard ?? []), view.drawn?.value]) {
    if (Number.isInteger(value)) counts[value] = Math.max(0, counts[value] - 1);
  }
  const total = counts.reduce((a,b)=>a+b,0);
  return total ? counts.map(n=>n/total) : counts.map(()=>1/14);
}
function sumDistribution(cards, distribution) {
  let sums = [1];
  for (const value of cards) {
    const next = Array(sums.length + 13).fill(0);
    for (let sum = 0; sum < sums.length; sum++) {
      if (value !== null) next[sum + value] += sums[sum];
      else distribution.forEach((probability, v) => { next[sum + v] += sums[sum] * probability; });
    }
    sums = next;
  }
  return sums;
}
function strategicDecision(view, playerId, memory, difficulty) {
  const fallback = () => decide(view, playerId, memory);
  if (view.phase === 'setup' || view.turnId !== playerId || ['roundEnd','finished','reveal'].includes(view.phase)) return fallback();
  const hard = difficulty === 'ruthless';
  const distribution = hard ? unseenDistribution(view, memory) : Array.from({length:14},(_,v)=>(v===0||v===13?2:4)/52);
  const mean = distribution.reduce((sum,p,v)=>sum+p*v,0);
  const value = v => v ?? mean;
  const own = memory.known[playerId];
  const rivals = view.players.filter(p=>p.id!==playerId);
  const total = cards => cards.reduce((sum,v)=>sum+value(v),0);
  const worst = own.reduce((best,v,i)=>value(v)>value(own[best])?i:best,0);
  // Only proven equal groups are eligible: no speculative matching penalties.
  const groups = own.map((_,i)=>[i]);
  for (const v of new Set(own.filter(v=>v!==null))) {
    const slots = own.flatMap((n,i)=>n===v?[i]:[]);
    if(slots.length>1) groups.push(slots);
  }
  const bestExchange = incoming => groups.map(slots=>({slots,gain:slots.reduce((s,i)=>s+value(own[i]),0)-incoming}))
    .sort((a,b)=>b.gain-a.gain || b.slots.length-a.slots.length)[0];
  const targets = rivals.flatMap(p=>p.cards.map(c=>({id:p.id,slot:c.slot,value:value(memory.known[p.id][c.slot])})));
  const swap = targets.map(t=>({ ...t, gain:value(own[worst])-t.value,
    utility:(value(own[worst])-t.value)*(hard ? 1 + 8/(8+total(memory.known[t.id])) : 1) }))
    .sort((a,b)=>b.utility-a.utility)[0];
  switch(view.phase) {
    case 'turn': {
      const sum = total(own);
      const behind = rivals.some(p=>memory.known[p.id].every(v=>v!==null)&&total(memory.known[p.id])<sum);
      const ownSums = sumDistribution(own,distribution);
      const opponents = rivals.map(p=>{
        const cards=memory.known[p.id];
        const max=Math.max(...cards.map(value));
        // Opponents get a final turn: model expected single-card improvement, including public discard.
        const improvement=hard ? Math.max(distribution.reduce((s,p,v)=>s+p*Math.max(0,max-v),0),view.discardTop===null?0:Math.max(0,max-view.discardTop)) : 0;
        const sums=sumDistribution(cards,distribution);
        return {sums,improvement};
      });
      const win=ownSums.reduce((chance,p,sum)=>chance+p*opponents.reduce((joint,o)=>joint*o.sums.reduce((tail,q,n)=>tail+(n-o.improvement>=sum?q:0),0),1),0);
      const expectedPenalty=(1-win)*(sum+10);
      if(!view.caller && !behind && win >= (hard?.9:.8) && expectedPenalty < sum && sum <= (hard?18:14)) return {type:'cabo'};
      // A zero hand cannot be beaten under ordinary scoring, including a tie.
      if(!view.caller && own.every(v=>v===0)) return {type:'cabo'};
      const discard=view.discardTop===null?null:bestExchange(view.discardTop);
      const deckGain=distribution.reduce((s,p,v)=>s+p*Math.max(0,bestExchange(v).gain),0);
      return {type:'draw',source:discard && discard.gain> (hard ? deckGain+.5 : 1) ? 'discard':'deck'};
    }
    case 'drawn': {
      const incoming=view.drawn.value, exchange=bestExchange(incoming);
      let ability=0;
      if(hard && incoming>=7 && incoming<=12) {
        if(incoming<=8 && own.includes(null)) ability=1.5;
        else if(incoming<=10 && rivals.some(p=>memory.known[p.id].includes(null))) ability=1;
        else if(incoming>=11) ability=Math.max(0,swap?.utility??0);
      }
      return view.drawn.source==='discard' || exchange.gain>ability ? {type:'exchange',slots:exchange.slots} : {type:'discard',useAbility:true};
    }
    case 'spy': {
      const candidates=rivals.flatMap(p=>p.cards.filter(c=>!c.faceUp && memory.known[p.id][c.slot]===null).map(c=>({id:p.id,slot:c.slot,score:total(memory.known[p.id])})));
      candidates.sort((a,b)=>a.score-b.score);
      return candidates[0]?{type:'ability',targetId:candidates[0].id,slot:candidates[0].slot}:{type:'skip'};
    }
    case 'swap': return swap?.gain>0 ? {type:'ability',targetId:swap.id,slot:swap.slot,ownSlot:worst} : {type:'skip'};
    default:return fallback();
  }
}

export const bot = { observe, decide, difficulties: [
  { id: 'easy', label: '简单 AI' }, { id: 'smart', label: '聪明 AI' }, { id: 'ruthless', label: '冷酷 AI' },
] };
