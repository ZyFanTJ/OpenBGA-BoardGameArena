import { ensure } from '../../platform/errors.js';
import { scoreRound, settleScores } from './scoring.js';
import { bot } from './bot.js';
import { motionFor } from './motion.js';

export const manifest = Object.freeze({ id: 'cabo', title: 'CABO', rulesVersion: '2019-en-2', minPlayers: 2, maxPlayers: 4, stateVersion: 1 });
export function makeDeck() {
  return Array.from({ length: 14 }, (_, value) =>
    Array.from({ length: value === 0 || value === 13 ? 2 : 4 }, () => ({ value, faceUp: false }))).flat();
}
function shuffle(cards, random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function deal(state, random) {
  state.deck = shuffle(makeDeck(), random);
  state.players.forEach(p => { p.cards = state.deck.splice(0, 4); });
  state.discard = [state.deck.pop()];
  state.phase = 'setup'; state.turn = state.starter; state.caller = null;
  state.setup = {}; state.drawn = null; state.reveal = null;
  state.lastAction = '每位玩家选择两张自己的牌，查看并记住。';
  return state;
}
export function create(ids, options = {}, random = Math.random) {
  ensure(ids.length >= 2 && ids.length <= 4 && new Set(ids).size === ids.length, 'CABO 需要 2–4 位玩家');
  ensure(options.expert === undefined || typeof options.expert === 'boolean', '专家模式参数无效');
  return deal({ version: 1, expert: options.expert === true, round: 1,
    starter: Math.floor(random() * ids.length),
    players: ids.map(id => ({ id, cards: [], total: 0, resetUsed: false })), history: [], winners: [] }, random);
}
function finishRound(s) {
  const results = scoreRound(s.players, s.caller);
  s.players = settleScores(s.players, results);
  s.history.push({ round: s.round, caller: s.caller, results: results.map((r, i) => ({ ...r, total: s.players[i].total })) });
  s.phase = s.players.some(p => p.total > 100) ? 'finished' : 'roundEnd';
  s.reveal = null; s.drawn = null;
  if (s.phase === 'finished') {
    const lowest = Math.min(...s.players.map(p => p.total));
    const tied = s.players.filter(p => p.total === lowest);
    const last = Math.min(...tied.map(p => results.find(r => r.id === p.id).points));
    s.winners = tied.filter(p => results.find(r => r.id === p.id).points === last).map(p => p.id);
  }
  s.lastAction = '本轮结束，所有牌已公开。';
}
function endTurn(s) {
  s.drawn = null; s.reveal = null;
  const next = (s.turn + 1) % s.players.length;
  if (!s.deck.length || s.players[next].id === s.caller) return finishRound(s);
  s.turn = next; s.phase = 'turn';
}
function indices(list, length, count) {
  ensure(Array.isArray(list) && list.length > 0 && (!count || list.length === count) &&
    new Set(list).size === list.length && list.every(i => Number.isInteger(i) && i >= 0 && i < length), '请选择有效且不重复的牌位');
  return list;
}
function target(s, id, slot) {
  const p = s.players.find(p => p.id === id);
  ensure(p && Number.isInteger(slot) && slot >= 0 && slot < p.cards.length, '目标牌位无效');
  return p;
}
export function apply(state, playerId, command, { random = Math.random, isHost = false } = {}) {
  ensure(command && typeof command.type === 'string', '行动格式无效');
  const s = structuredClone(state);
  const me = s.players.find(p => p.id === playerId);
  ensure(me, '你不在本局中', 403);
  const c = command;
  if (c.type === 'nextRound') {
    ensure(isHost && s.phase === 'roundEnd', '只有房主可以在结算后开始下一轮');
    const results = s.history.at(-1).results;
    const min = Math.min(...results.map(r => r.points));
    // Resolve ties clockwise, starting at the previous start player.
    for (let step = 0; step < s.players.length; step++) {
      const i = (s.starter + step) % s.players.length;
      if (results[i].points === min) { s.starter = i; break; }
    }
    s.round++; return deal(s, random);
  }
  if (s.phase === 'setup') {
    if (c.type === 'look') {
      ensure(!s.setup[playerId], '本轮已经查看过起始牌');
      s.setup[playerId] = { slots: indices(c.slots, me.cards.length, 2), confirmed: false };
    } else if (c.type === 'confirm') {
      ensure(s.setup[playerId] && !s.setup[playerId].confirmed, '请先查看两张起始牌');
      s.setup[playerId] = { confirmed: true };
      if (s.players.every(p => s.setup[p.id]?.confirmed)) s.phase = 'turn';
    } else ensure(false, '请先完成起始牌查看');
    return s;
  }
  ensure(!['finished', 'roundEnd'].includes(s.phase), '本轮已经结束');
  ensure(s.players[s.turn].id === playerId, '还没有轮到你', 403);
  if (c.type === 'draw') {
    ensure(s.phase === 'turn' && ['deck', 'discard'].includes(c.source), '现在不能抽牌');
    const pile = c.source === 'deck' ? s.deck : s.discard;
    ensure(pile.length, '牌堆为空');
    s.drawn = { ...pile.pop(), source: c.source };
    s.phase = 'drawn'; s.lastAction = c.source === 'deck' ? '当前玩家从牌库抽了一张牌。' : '当前玩家拿取了弃牌。';
  } else if (c.type === 'cabo') {
    ensure(s.phase === 'turn' && !s.caller, '现在不能呼叫 CABO');
    s.caller = playerId; s.lastAction = 'CABO！其他玩家各有最后一个回合。'; endTurn(s);
  } else if (c.type === 'exchange') {
    ensure(s.phase === 'drawn', '请先抽牌');
    const slots = indices(c.slots, me.cards.length);
    const replaceAt = c.replaceAt ?? slots[0];
    ensure(slots.includes(replaceAt), '新牌必须放入所选牌位');
    const cards = slots.map(i => me.cards[i]);
    const incoming = { value: s.drawn.value, faceUp: s.drawn.source === 'discard' && !s.expert };
    if (cards.every(card => card.value === cards[0].value)) {
      s.discard.push(...cards.map(card => ({ ...card, faceUp: true })));
      // Null holes are temporary; survivor order is preserved.
      for (const slot of slots) me.cards[slot] = slot === replaceAt ? incoming : null;
      me.cards = me.cards.filter(Boolean);
      s.lastAction = `当前玩家用一张牌换出了 ${slots.length} 张牌。`;
    } else {
      cards.forEach(card => { card.faceUp = !s.expert; });
      const added = [incoming];
      if (slots.length >= 3 && s.deck.length) added.push({ ...s.deck.pop(), faceUp: false });
      ensure(c.end === undefined || ['left', 'right'].includes(c.end), '添加位置无效');
      me.cards = c.end === 'left' ? [...added, ...me.cards] : [...me.cards, ...added];
      s.lastAction = `换牌失败，原牌保留${s.expert ? '' : '并公开'}，抽到的牌加入牌列${slots.length >= 3 ? '，另补一张暗牌（牌库有牌时）' : ''}。`;
    }
    endTurn(s);
  } else if (c.type === 'discard') {
    ensure(s.phase === 'drawn' && s.drawn.source === 'deck', '只有从牌库抽到的牌可以直接弃置');
    const value = s.drawn.value;
    s.discard.push({ value, faceUp: true }); s.drawn = null;
    if (c.useAbility === true && value >= 7 && value <= 12) {
      s.phase = value <= 8 ? 'peek' : value <= 10 ? 'spy' : 'swap';
      s.lastAction = '当前玩家正在使用特殊能力。';
    } else { s.lastAction = '当前玩家弃置了抽到的牌。'; endTurn(s); }
  } else if (c.type === 'ability') {
    ensure(['peek', 'spy', 'swap'].includes(s.phase), '现在不能使用能力');
    const other = target(s, c.targetId, c.slot);
    if (s.phase === 'swap') {
      ensure(other.id !== playerId, '交换需要选择另一位玩家');
      indices([c.ownSlot], me.cards.length, 1);
      [me.cards[c.ownSlot], other.cards[c.slot]] = [other.cards[c.slot], me.cards[c.ownSlot]];
      s.lastAction = '当前玩家与另一位玩家交换了一张牌。'; endTurn(s);
    } else {
      ensure((s.phase === 'peek') === (other.id === playerId), '目标玩家不符合能力要求');
      ensure(!other.cards[c.slot].faceUp, '请选择一张暗牌');
      s.reveal = { playerId: other.id, slot: c.slot, value: other.cards[c.slot].value };
      s.phase = 'reveal';
    }
  } else if (c.type === 'skip') {
    ensure(['peek', 'spy', 'swap'].includes(s.phase), '当前行动不能跳过'); endTurn(s);
  } else if (c.type === 'confirm') {
    ensure(s.phase === 'reveal', '没有需要确认的牌'); endTurn(s);
  } else ensure(false, '未知游戏行动');
  return s;
}
export function view(s, playerId, transition) {
  const publicAll = ['roundEnd', 'finished'].includes(s.phase);
  const active = s.players[s.turn].id === playerId;
  const setup = s.setup[playerId];
  return {
    motion: motionFor(s, transition),
    gameId: manifest.id, rulesVersion: manifest.rulesVersion, phase: s.phase, round: s.round, expert: s.expert,
    turnId: s.players[s.turn].id, caller: s.caller, deckCount: s.deck.length,
    discardTop: s.discard.at(-1)?.value ?? null, lastAction: s.lastAction,
    drawn: active && s.drawn ? { value: s.drawn.value, source: s.drawn.source } : null,
    reveal: active ? s.reveal : null,
    setup: setup ? { confirmed: setup.confirmed, slots: setup.slots ?? [] } : null,
    players: s.players.map(p => ({ id: p.id, total: p.total, resetUsed: p.resetUsed,
      setupDone: !!s.setup[p.id]?.confirmed,
      cards: p.cards.map((card, slot) => ({ slot, faceUp: card.faceUp,
        value: publicAll || card.faceUp || (s.phase === 'setup' && p.id === playerId && setup?.slots?.includes(slot))
          ? card.value : null })) })),
    history: s.history, winners: s.winners,
  };
}
function result(s){const last=id=>s.history.at(-1)?.results.find(p=>p.id===id)?.points??0;return {winners:[...s.winners],rounds:s.round,scoreDirection:'lower',players:s.players.map(p=>({id:p.id,score:p.total,rank:1+s.players.filter(q=>q.total<p.total||q.total===p.total&&last(q.id)<last(p.id)).length,breakdown:[{label:'累计罚分',value:p.total},{label:'末轮罚分',value:last(p.id)}]}))};}
export const cabo = { manifest, create, apply, view, result, bot,
 turn(s){if(['finished','roundEnd'].includes(s.phase))return null;return {key:`${s.round}:${s.phase==='setup'?'setup':'turn:'+s.players[s.turn].id}`,players:s.phase==='setup'?s.players.filter(p=>!s.setup[p.id]?.confirmed).map(p=>p.id):[s.players[s.turn].id]};},
 timeout(view,id){
  if(view.phase==='setup')return !view.setup?{type:'look',slots:[0,1]}:{type:'confirm'};
  if(view.turnId!==id)return null;
  if(view.phase==='turn')return {type:'draw',source:'deck'};
  if(view.phase==='drawn')return view.drawn.source==='discard'?{type:'exchange',slots:[0]}:{type:'discard',useAbility:false};
  if(['peek','spy','swap'].includes(view.phase))return {type:'skip'};
  return view.phase==='reveal'?{type:'confirm'}:null;
 },isFinished: s => s.phase === 'finished' };
