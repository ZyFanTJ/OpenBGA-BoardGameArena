import { ensure } from '../../platform/errors.js';
import { ninjaDeck, roles } from './cards.js';
import { ninjaBot, safeCommand } from './bot.js';

const clone = value => structuredClone(value);
function index(random, size) {
  const n = random?.(); ensure(Number.isFinite(n) && n >= 0 && n < 1, '游戏需要有效的随机源');
  return Math.floor(n * size);
}
function shuffle(items, random) {
  const result = clone(items);
  for (let i = result.length - 1; i > 0; i--) { const j = index(random, i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const get = (s, id) => { const p = s.players.find(p => p.id === id); ensure(p, '玩家不存在'); return p; };
const total = p => p.honor.reduce((a, b) => a + b, 0);
function note(s, actor, target, extra = {}) {
  actor.intel.push({ sequence: s.sequence, playerId: target.id, house: clone(target.house), ...extra });
}
function award(s, p) {
  if (!s.honorPool.length) { s.honorPool = s.honorReserve; s.honorReserve = []; }
  ensure(s.honorPool.length, '荣誉池已空'); p.honor.push(s.honorPool.pop());
}
function startRound(s, random) {
  const count = Math.floor(s.players.length / 2), houses = ['crane', 'lotus'].flatMap(house => Array.from({ length: count }, (_, i) => ({ house, rank: i + 1 })));
  if (s.players.length % 2) houses.push({ house: 'ronin', rank: null });
  const identities = shuffle(houses, random), deck = shuffle(ninjaDeck(), random);
  s.round++; s.phase = 'draft'; s.draftStep = 1; s.nightPhase = 0; s.commitments = {}; s.queue = []; s.active = null; s.pending = null; s.discards = [];
  s.roundResult = null; s.log = [];
  s.players.forEach((p, i) => {
    p.house = identities[i]; p.publicHouse = false; p.alive = true; p.hand = []; p.played = []; p.intel = [];
    p.pack = deck.splice(0, 3); note(s, p, p);
  });
  s.unused = deck;
}
function create(ids, options = {}, random) {
  ensure(Array.isArray(ids) && ids.length >= 4 && ids.length <= 11 && ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length, '忍者之夜需要 4–11 位不同玩家');
  ensure(options && !Array.isArray(options) && typeof options === 'object' && !Object.keys(options).length, '忍者之夜使用基础版，无额外选项');
  // The official public booklet omits token frequencies; see docs/night-of-the-ninja-rules.md.
  const pool = () => shuffle(Array.from({ length: 36 }, (_, i) => 2 + i % 3), random);
  const s = { round: 0, sequence: 0, players: ids.map(id => ({ id, honor: [] })), honorPool: pool(), honorReserve: pool(), winners: [] };
  startRound(s, random); return s;
}
function finishRound(s) {
  const survivors = s.players.filter(p => p.alive), mastermind = survivors.find(p => p.hand.some(c => c.role === 'mastermind'));
  for (const p of survivors) {
    p.publicHouse = clone(p.house);
    const card = p.hand.find(c => c.role === 'mastermind');
    if (card) { p.played.push(card); p.hand = p.hand.filter(c => c.id !== card.id); }
  }
  const ranks = house => survivors.filter(p => p.house.house === house).map(p => p.house.rank).sort((a, b) => a - b);
  let winningHouse = null, tied = false;
  if (mastermind) winningHouse = mastermind.house.house === 'ronin' ? null : mastermind.house.house;
  else {
    const a = ranks('crane'), b = ranks('lotus');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] ?? Infinity) !== (b[i] ?? Infinity)) { winningHouse = (a[i] ?? Infinity) < (b[i] ?? Infinity) ? 'crane' : 'lotus'; break; }
    }
    tied = !winningHouse;
  }
  const awarded = [];
  for (const p of s.players) {
    if (p.house.house === winningHouse || (p.alive && (p.house.house === 'ronin' || tied))) { award(s, p); awarded.push(p.id); }
  }
  const high = Math.max(...s.players.map(total));
  s.winners = high >= 10 ? s.players.filter(p => total(p) === high).map(p => p.id) : [];
  s.phase = s.winners.length ? 'finished' : 'roundEnd';
  s.roundResult = { winningHouse, tied, mastermindId: mastermind?.id ?? null, awarded };
  s.active = null; s.pending = null; s.queue = [];
}
function advance(s) {
  s.pending = null; s.active = null;
  while (s.queue.length) {
    const next = s.queue.shift(), p = get(s, next.playerId);
    if (!p.alive) { p.played.push({ ...next.card, cancelled: true }); continue; }
    s.active = next; p.played.push(next.card); s.phase = 'act'; return;
  }
  s.nightPhase++;
  if (s.nightPhase > 5) { finishRound(s); return; }
  s.phase = 'announce'; s.commitments = {};
}
function attack(s, actor, target, judge = false) {
  ensure(target.alive && target.id !== actor.id, '请选择另一位存活玩家');
  s.log.push({ type: 'attack', actorId: actor.id, targetId: target.id, role: s.active.card.role });
  if (judge) { target.alive = false; advance(s); }
  else { s.phase = 'react'; s.pending = { kind: 'react', actorId: target.id, attackerId: actor.id }; }
}
function pending(s, kind, actor, data) { s.phase = 'decision'; s.pending = { kind, actorId: actor.id, ...data }; }
function targetOf(s, actor, id) { const p = get(s, id); ensure(p.id !== actor.id, '请选择其他玩家'); return p; }
function effect(s, p, c, random) {
  const role = s.active.card.role;
  if (['judge', 'blindAssassin', 'shinobi'].includes(role) && !s.players.some(t => t.id !== p.id && t.alive)) {
    if (role === 'judge') p.publicHouse = clone(p.house);
    advance(s); return;
  }
  if (role === 'gravedigger') {
    const cards = shuffle(s.discards, random).slice(0, 2);
    if (!cards.length) { advance(s); return; }
    pending(s, role, p, { cards }); return;
  }
  if (role === 'shapeshifter') {
    ensure(Array.isArray(c.targetIds) && c.targetIds.length === 2 && new Set(c.targetIds).size === 2, '请选择两位不同玩家');
    const targets = c.targetIds.map(id => get(s, id)); targets.forEach(t => note(s, p, t));
    pending(s, role, p, { targetIds: [...c.targetIds], houses: targets.map(t => clone(t.house)) }); return;
  }
  if (role === 'thief') {
    p.publicHouse = clone(p.house);
    if (!c.targetId) { advance(s); return; }
    const t = targetOf(s, p, c.targetId);
    ensure(t.honor.length > p.honor.length, '只能偷取荣誉数量比你多的玩家');
    ensure(Number.isInteger(c.token) && c.token >= 0 && c.token < t.honor.length, '请选择荣誉');
    p.honor.push(t.honor.splice(c.token, 1)[0]); advance(s); return;
  }
  const t = targetOf(s, p, c.targetId);
  s.log.push({ type: 'ability', actorId: p.id, targetId: t.id, role });
  if (role === 'spy' || role === 'mystic') {
    const hidden = t.hand;
    const ninja = role === 'mystic' && hidden.length ? clone(hidden[index(random, hidden.length)]) : null;
    note(s, p, t, ninja ? { ninja } : {});
    pending(s, 'intel', p, { targetId: t.id, house: clone(t.house), ninja });
  } else if (role === 'troublemaker' || role === 'shinobi') {
    if (role === 'shinobi') ensure(t.alive, '请选择存活玩家');
    note(s, p, t); pending(s, role, p, { targetId: t.id, house: clone(t.house) });
  } else if (role === 'spiritMerchant') {
    ensure(c.inspect === 'house' || c.inspect === 'honor', '请选择查看身份或荣誉');
    let token = null;
    if (c.inspect === 'honor') { ensure(Number.isInteger(c.token) && c.token >= 0 && c.token < t.honor.length, '请选择荣誉'); token = { slot: c.token, value: t.honor[c.token] }; }
    else note(s, p, t);
    pending(s, role, p, { targetId: t.id, house: c.inspect === 'house' ? clone(t.house) : null, token });
  } else if (role === 'judge') { p.publicHouse = clone(p.house); attack(s, p, t, true); }
  else if (role === 'blindAssassin') attack(s, p, t);
  else ensure(false, '此牌不能主动使用');
}
function decide(s, p, c) {
  const d = s.pending;
  ensure(d?.actorId === p.id, '请等待当前玩家决定', 403);
  if (d.kind === 'react') {
    ensure(['accept', 'mirrorMonk', 'martyr'].includes(c.choice), '无效反应');
    if (c.choice !== 'accept') {
      const card = p.hand.find(card => card.role === c.choice); ensure(card, '没有这张反应牌');
      p.hand = p.hand.filter(v => v.id !== card.id); p.played.push(card);
    }
    if (c.choice === 'mirrorMonk') get(s, d.attackerId).alive = false;
    else { if (c.choice === 'martyr') award(s, p); p.alive = false; }
    s.log.push({ type: 'reaction', actorId: p.id, targetId: d.attackerId, choice: c.choice });
    advance(s); return;
  }
  if (d.kind === 'shapeshifter') {
    ensure(typeof c.swap === 'boolean', '请选择是否交换');
    if (c.swap) {
      const [a, b] = d.targetIds.map(id => get(s, id)); [a.house, b.house] = [b.house, a.house];
      // Only the Shapeshifter learns whether a swap occurred. Old observations stay historical.
      note(s, p, a); note(s, p, b);
    }
  } else if (d.kind === 'troublemaker') {
    ensure(typeof c.reveal === 'boolean', '请选择是否公开'); if (c.reveal) get(s, d.targetId).publicHouse = clone(get(s, d.targetId).house);
  } else if (d.kind === 'shinobi') {
    ensure(typeof c.kill === 'boolean', '请选择是否击杀');
    if (c.kill) { attack(s, p, get(s, d.targetId)); return; }
  } else if (d.kind === 'gravedigger') {
    const card = d.cards.find(card => card.id === c.cardId); ensure(card, '请选择查看到的弃牌');
    ensure(typeof c.immediate === 'boolean', '请选择立即使用或保留');
    s.discards = s.discards.filter(v => v.id !== card.id);
    if (c.ordered === true) {
      ensure(!c.immediate && roles[card.role].phase === s.nightPhase && card.rank > s.active.card.rank, '只有当前阶段尚未经过的顺位可按序使用');
      s.queue.push({ playerId: p.id, card: clone(card) }); s.queue.sort((a, b) => a.card.rank - b.card.rank); advance(s); return;
    }
    if (c.immediate && roles[card.role].phase >= 1 && roles[card.role].phase <= 5) {
      s.active = { playerId: p.id, card: clone(card) }; p.played.push(clone(card)); s.pending = null; s.phase = 'act'; return;
    }
    ensure(!c.immediate, '这张牌只能在反应或揭晓时使用'); p.hand.push(clone(card));
  } else if (d.kind === 'spiritMerchant' && c.swap === true) {
    const t = get(s, d.targetId);
    ensure(Number.isInteger(c.ownToken) && c.ownToken >= 0 && c.ownToken < p.honor.length && Number.isInteger(c.otherToken) && c.otherToken >= 0 && c.otherToken < t.honor.length, '交换需要双方各一枚荣誉');
    [p.honor[c.ownToken], t.honor[c.otherToken]] = [t.honor[c.otherToken], p.honor[c.ownToken]];
  } else if (d.kind === 'spiritMerchant') ensure(c.swap === false, '请选择是否交换');
  advance(s);
}
function apply(input, playerId, c, { random, isHost = false } = {}) {
  ensure(c && typeof c === 'object' && !Array.isArray(c), '行动格式无效');
  get(input, playerId); ensure(input.phase !== 'finished', '整局已结束');
  const s = clone(input), p = get(s, playerId); s.sequence++;
  if (c.type === 'nextRound') {
    ensure(isHost && s.phase === 'roundEnd', '只有房主能在结算后开始下一轮', 403); startRound(s, random); return s;
  }
  if (s.phase === 'draft') {
    ensure(c.type === 'draft' && !s.commitments[p.id], '请完成轮抽，不能重复选牌');
    const card = p.pack.find(card => card.id === c.cardId); ensure(card, '请选择自己的轮抽牌');
    s.commitments[p.id] = card.id;
    if (s.players.every(p => s.commitments[p.id])) {
      const packs = s.players.map(p => {
        const picked = p.pack.find(card => card.id === s.commitments[p.id]); p.hand.push(picked);
        return p.pack.filter(card => card.id !== picked.id);
      });
      if (s.draftStep === 1) { s.players.forEach((p, i) => { p.pack = packs[(i - 1 + packs.length) % packs.length]; }); s.draftStep = 2; s.commitments = {}; }
      else { s.discards = packs.flat(); s.players.forEach(p => { p.pack = []; }); s.nightPhase = 0; advance(s); }
    }
  } else if (s.phase === 'announce') {
    ensure(p.alive && c.type === 'announce' && !Object.hasOwn(s.commitments, p.id), '现在不能提交行动');
    ensure(Array.isArray(c.cardIds) && new Set(c.cardIds).size === c.cardIds.length && c.cardIds.every(id => p.hand.some(card => card.id === id && roles[card.role].phase === s.nightPhase)), '只能亮出本阶段的手牌');
    s.commitments[p.id] = [...c.cardIds];
    if (s.players.filter(p => p.alive).every(p => Object.hasOwn(s.commitments, p.id))) {
      s.queue = s.players.flatMap(p => p.hand.filter(card => s.commitments[p.id]?.includes(card.id)).map(card => ({ playerId: p.id, card })));
      s.queue.sort((a, b) => a.card.rank - b.card.rank);
      s.players.forEach(p => { p.hand = p.hand.filter(card => !s.commitments[p.id]?.includes(card.id)); });
      // advance also increments the phase when no card was offered.
      advance(s);
    }
  } else if (s.phase === 'act') {
    ensure(s.active?.playerId === p.id && p.alive && c.type === 'act', '还没轮到你使用技能', 403);
    effect(s, p, c, random);
  } else if (s.phase === 'decision' || s.phase === 'react') {
    ensure(c.type === 'decide', '请先完成当前决定'); decide(s, p, c);
  } else ensure(false, '当前不能执行此行动');
  return s;
}
function view(s, viewerId) {
  const me = s.players.find(p => p.id === viewerId), ended = s.phase === 'finished';
  return { phase: s.phase, round: s.round, sequence: s.sequence, draftStep: s.draftStep, nightPhase: s.nightPhase, reference: clone(roles),
    players: s.players.map(p => ({ id: p.id, alive: p.alive, house: p.publicHouse ? clone(p.publicHouse) : null,
      honorCount: p.honor.length, packCount: p.pack.length, score: ended || p.id === viewerId ? total(p) : null,
      honor: p.honor.map(value => p.id === viewerId || ended ? value : null),
      hand: p.hand.map(card => p.id === viewerId ? clone(card) : null), played: clone(p.played),
      ready: Object.hasOwn(s.commitments, p.id) })),
    pack: me && s.phase === 'draft' ? clone(me.pack) : [], intel: me ? clone(me.intel) : [],
    selected: me ? clone(s.commitments[viewerId] ?? null) : null,
    queue: clone(s.queue), active: s.active ? clone(s.active) : null,
    pending: s.pending ? (s.pending.actorId === viewerId ? clone(s.pending) : { kind: s.pending.kind, actorId: s.pending.actorId }) : null,
    log: clone(s.log.slice(-30)), roundResult: s.roundResult ? clone(s.roundResult) : null, winners: [...s.winners] };
}
function turn(s) {
  const players = ['draft', 'announce'].includes(s.phase) ? s.players.filter(p => (s.phase === 'draft' || p.alive) && !Object.hasOwn(s.commitments, p.id)).map(p => p.id)
    : s.pending ? [s.pending.actorId] : s.active ? [s.active.playerId] : [];
  const window = s.active ? `${s.phase === 'react' ? 'react' : 'skill'}:${s.active.playerId}:${s.active.card.id}` : `${s.phase}:${s.phase === 'draft' ? s.draftStep : s.nightPhase}`;
  return players.length ? { key: `ninja:${s.round}:${window}`, players } : null;
}
export const nightOfTheNinja = {
  manifest: { id: 'night-of-the-ninja', title: '忍者之夜', rulesVersion: '2020-core-online-1', stateVersion: 1, minPlayers: 4, maxPlayers: 11 },
  create, apply, view, spectatorView:s=>view(s,null), turn, timeout: safeCommand, bot: ninjaBot, isFinished: s => s.phase === 'finished',
  submissionKey(s, id, command) {
    const type = { draft: 'draft', announce: 'announce' }[s.phase];
    return type && (!command || command.type === type) && turn(s)?.players.includes(id)
      ? `${s.round}:${s.phase}:${s.draftStep}:${s.nightPhase}` : null;
  },
  result(s) {
    if (s.phase !== 'finished') return null;
    return { winners: [...s.winners], rounds: s.round, scoreDirection: 'higher', players: s.players.map(p => ({ id: p.id, score: total(p), rank: 1 + s.players.filter(q => total(q) > total(p)).length, breakdown: [{ label: '荣誉', value: total(p) }] })) };
  },
};
