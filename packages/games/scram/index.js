import {ensure} from '../../platform/errors.js';
import {scramBot} from './bot.js';
import {publicMotion} from './observation.js';

const clone = value => structuredClone(value);
const ended = s => ['roundEnd', 'finished'].includes(s.phase);
const actor = s => s.order[s.cursor];
function index(random, size) {
  const n = random?.();
  ensure(Number.isFinite(n) && n >= 0 && n < 1, '游戏需要有效的随机源');
  return Math.floor(n * size);
}
export function campScore(cards) {
  const numbers = cards.filter(c => c.value !== '=').map(c => c.value);
  const low = numbers.length ? Math.min(...numbers) : 0;
  return cards.reduce((sum, c) => sum + (c.value === '=' ? low : c.value), 0);
}
function deal(s, random) {
  s.deck = Array.from({length:s.players.length === 6 ? 5 : 4}, () =>
    Array.from({length:14}, (_, i) => ({value:i === 13 ? '=' : i + 1, faceUp:false}))).flat();
  for (let i = s.deck.length - 1; i > 0; i--) {
    const j = index(random, i + 1); [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]];
  }
  for (const p of s.players) p.cards = Array.from({length:s.players.length === 3 && p.team === 0 ? 8 : 5}, (_, i) => ({...s.deck.pop(),faceUp:i < 2}));
  s.discard = [{...s.deck.pop(),faceUp:true}];
  s.cursor = s.order.indexOf(s.starter); s.phase = 'turn'; s.drawn = null; s.effect = null;
  s.caller = null; s.finalTurns = null; s.roundResult = null;
  s.lastAction = '新一轮开始 · 暗牌不可偷看'; s.turnNumber++;
}
function create(ids, options = {}, random) {
  ensure(Array.isArray(ids) && [3,4,6].includes(ids.length) && new Set(ids).size === ids.length, '开溜支持 3、4 或 6 位不同玩家（不支持 5 人）');
  ensure(options && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).length === 0, '开溜使用官方基础规则');
  const s = {players:ids.map((id,i) => ({id,team:ids.length === 3 ? (i === 0 ? 0 : 1) : i % 2,cards:[]})),
    order:ids.length === 3 ? [ids[0],ids[1],ids[0],ids[2]] : [...ids], cursor:0,
    starter:ids.length === 3 ? ids[0] : ids[index(random,ids.length)], round:1, rounds:ids.length === 4 ? 4 : 3,
    totals:[0,0], history:[], winners:[], turnNumber:0, sequence:0};
  deal(s,random); return s;
}
function finishRound(s) {
  const scores = s.players.map(p => ({id:p.id,team:p.team,score:campScore(p.cards)}));
  const raw = [0,1].map(t => scores.filter(p => p.team === t).reduce((n,p) => n + p.score,0));
  const points = [...raw], callerTeam = s.players.find(p => p.id === s.caller)?.team;
  if (callerTeam !== undefined) points[callerTeam] = raw[callerTeam] <= raw[1-callerTeam] ? 0 : raw[callerTeam] + 10;
  s.totals = s.totals.map((n,i) => n + points[i]); s.history.push([...points]);
  s.roundResult = {scores,raw,points,callerTeam:callerTeam ?? null};
  s.phase = s.round === s.rounds ? 'finished' : 'roundEnd'; s.drawn = null; s.effect = null;
  const winningTeams = [0,1].filter(t => points[t] === Math.min(...points));
  const eligible = scores.filter(p => winningTeams.includes(p.team));
  const low = Math.min(...eligible.map(p => p.score));
  const seat = s.players.findIndex(p => p.id === s.starter);
  s.starter = Array.from({length:s.players.length}, (_,i) => s.players[(seat+i+1)%s.players.length])
    .find(p => eligible.some(q => q.id === p.id && q.score === low)).id;
  if (s.phase === 'finished') {
    let winner = s.totals[0] === s.totals[1] ? null : (s.totals[0] < s.totals[1] ? 0 : 1);
    if (winner === null && s.players.length === 3) winner = 0;
    if (winner === null) for (const row of [...s.history].reverse()) if (row[0] !== row[1]) {winner = row[0] < row[1] ? 0 : 1; break;}
    s.winners = s.players.filter(p => p.team === winner).map(p => p.id);
  }
  s.lastAction = '本轮结束 · 所有营地翻牌计分';
}
function advance(s) {
  s.drawn = null; s.effect = null; s.phase = 'turn'; s.turnNumber++;
  if (s.finalTurns) {
    if (!s.finalTurns.length) {finishRound(s); return;}
    const next = s.finalTurns.shift();
    do {s.cursor = (s.cursor+1)%s.order.length;} while (actor(s) !== next);
  } else s.cursor = (s.cursor+1)%s.order.length;
  if (!s.deck.length) finishRound(s);
}
// Targets are positional. No persistent card identifier is sent to a client.
function locate(s, ref) {
  ensure(ref && typeof ref === 'object' && Number.isInteger(ref.slot) && ref.slot >= 0, '请选择有效卡牌');
  if (ref.playerId === null) {
    ensure(ref.slot < 2 && ref.slot < s.deck.length, '牌库没有这张牌');
    return {list:s.deck,index:s.deck.length-1-ref.slot,deck:true,owner:null};
  }
  const owner = s.players.find(p => p.id === ref.playerId);
  ensure(owner && ref.slot < owner.cards.length, '营地卡牌已变化');
  return {list:owner.cards,index:ref.slot,deck:false,owner};
}
const refKey = r => JSON.stringify([r.playerId,r.slot]);
function targets(s, refs, count) {
  ensure(Array.isArray(refs) && refs.length === count && new Set(refs.map(refKey)).size === count, `请选择 ${count} 张不同的牌`);
  return refs.map(r => locate(s,r));
}
function discard(s, cards) {
  // Bottom '='; otherwise lowest number is the new discard top (notably action 9).
  cards.sort((a,b) => (b.value === '=' ? 99 : b.value) - (a.value === '=' ? 99 : a.value));
  s.discard.push(...cards.map(c => ({...c,faceUp:true})));
}
function removeTargets(items) {
  const cards = items.map(t => t.list[t.index]);
  for (const list of new Set(items.map(t => t.list))) for (const t of items.filter(t => t.list === list).sort((a,b) => b.index-a.index)) list.splice(t.index,1);
  return cards;
}
function addEnd(player, card, side) {
  ensure(side === undefined || side === 'left' || side === 'right', '请选择营地左端或右端');
  if (side === 'left') player.cards.unshift(card); else player.cards.push(card);
}
function swap(items) {
  const [a,b] = items; [a.list[a.index],b.list[b.index]] = [b.list[b.index],a.list[a.index]];
  // A public card exchanged into the deck remains public when it is the top card.
}
function apply(input,id,cmd,{random,isHost=false} = {}) {
  ensure(cmd && typeof cmd === 'object' && !Array.isArray(cmd), '行动格式无效');
  const s = clone(input), p = s.players.find(p => p.id === id);
  ensure(p, '只有在座玩家可以行动',403);
  if (cmd.type === 'nextRound') {
    ensure(s.phase === 'roundEnd' && isHost, '等待房主开始下一轮');
    s.round++; s.sequence++; deal(s,random); return s;
  }
  ensure(!ended(s) && actor(s) === id, '还没轮到你',403);
  s.sequence++;
  if (cmd.type === 'draw') {
    ensure(s.phase === 'turn' && ['deck','discard'].includes(cmd.source), '请选择牌库或弃牌堆');
    ensure(cmd.source === 'deck' || p.cards.length, '空营地只能从牌库抽牌');
    const list = cmd.source === 'deck' ? s.deck : s.discard;
    ensure(list.length, '牌堆已空'); s.drawn = {card:list.pop(),source:cmd.source}; s.phase = 'drawn';
    s.lastAction = cmd.source === 'deck' ? '从牌库抽了一张牌' : '拿取了弃牌';
  } else if (cmd.type === 'scram') {
    ensure(s.phase === 'turn' && !s.caller && p.cards.length <= 2, '仅回合开始且营地不超过两张牌时可喊开溜');
    s.caller = id;
    if (s.players.length === 3 && p.team === 0) {
      s.finalTurns = Array.from({length:3},(_,i) => s.order[(s.cursor+i+1)%4]).filter(x => x !== id);
    } else s.finalTurns = Array.from({length:s.order.length-1},(_,i) => s.order[(s.cursor+i+1)%s.order.length]);
    s.lastAction = '开溜！其余营员进入最后行动'; advance(s);
  } else if (cmd.type === 'discard') {
    ensure(s.phase === 'drawn' && s.drawn.source === 'deck', '弃牌堆拿到的牌必须用于替换');
    discard(s,[s.drawn.card]); s.lastAction = '弃掉抽到的牌'; advance(s);
  } else if (cmd.type === 'replace') {
    ensure(s.phase === 'drawn', '请先抽牌');
    ensure(Array.isArray(cmd.targets) && cmd.targets.length > 0, '至少选择自己营地的一张牌');
    const items = targets(s,cmd.targets,cmd.targets.length);
    ensure(items.every(t => !t.deck && t.owner.team === p.team) && items[0].owner.id === id, '先选择自己营地的牌，再选择自己或队友的配对牌');
    const own = items.filter(t => t.owner === p), insert = cmd.insertSlot ?? own[0].index;
    ensure(own.some(t => t.index === insert), '新牌必须放回自己营地选中的空位');
    const numbers = new Set(items.map(t => t.list[t.index].value).filter(n => n !== '='));
    const card = {...s.drawn.card,faceUp:s.drawn.source === 'discard'};
    if (numbers.size <= 1) {
      const position = insert-own.filter(t => t.index < insert).length;
      discard(s,removeTargets(items)); p.cards.splice(position,0,card); s.lastAction = `配对成功 · 移除了 ${items.length} 张牌`;
    } else {
      items.forEach(t => {t.list[t.index].faceUp = true;}); addEnd(p,card,cmd.side);
      const penalty = Math.min(3,Math.max(0,numbers.size-2));
      for (let i=0;i<penalty && s.deck.length;i++) addEnd(p,{...s.deck.pop(),faceUp:false},cmd.side);
      s.lastAction = `配对失败 · 所选牌公开${penalty ? `，补 ${penalty} 张暗牌（以牌库余量为限）` : ''}`;
    }
    advance(s);
  } else if (cmd.type === 'ability') {
    ensure(s.phase === 'drawn' && s.drawn.source === 'deck' && Number.isInteger(s.drawn.card.value) && s.drawn.card.value >= 5, '这张牌不能使用技能');
    const value = s.drawn.card.value;
    if (value === 13) {
      const recipient = s.players.find(p => p.id === cmd.playerId); ensure(recipient,'请选择接收营地');
      addEnd(recipient,{...s.drawn.card,faceUp:true},cmd.side); s.lastAction = '将 13 放入一个营地'; advance(s);
    } else {
      const count = [6,8,9,11,12].includes(value) ? 2 : 1;
      const items = targets(s,cmd.targets,count);
      ensure(items.filter(t => t.deck).every(t => t.index === s.deck.length-1 || (count === 2 && items.some(x => x.deck && x.index === s.deck.length-1))), '请先选择牌库顶牌');
      if (value === 11) ensure(items.every(t => !t.deck || t.index === s.deck.length-1), '11 仅可交换牌库顶牌');
      if (value !== 9) discard(s,[s.drawn.card]);
      s.lastAction = `使用 ${value} 的技能`;
      if ([5,6,12].includes(value) || ([7,8].includes(value) && items.some(t => t.deck))) {
        if ([7,8].includes(value)) items.filter(t => !t.deck).forEach(t => {t.list[t.index].faceUp = true;});
        s.effect = {value,targets:clone(cmd.targets),reveals:items.map((t,i) => ({...cmd.targets[i],value:t.list[t.index].value}))};
        s.drawn = null; s.phase = 'reveal';
      } else {
        if ([7,8].includes(value)) items.forEach(t => {t.list[t.index].faceUp = true;});
        if ([9,10].includes(value)) discard(s,removeTargets(items));
        if (value === 9) addEnd(p,{...s.drawn.card,faceUp:true},cmd.side);
        if (value === 11) swap(items);
        advance(s);
      }
    }
  } else if (cmd.type === 'resolve') {
    ensure(s.phase === 'reveal', '当前没有待确认的查看');
    ensure(cmd.swap === undefined || typeof cmd.swap === 'boolean', '交换选项无效');
    ensure(!cmd.swap || s.effect.value === 12, '只有 12 可以查看后交换');
    if (cmd.swap) swap(targets(s,s.effect.targets,2));
    advance(s);
  } else ensure(false,'未知游戏行动');
  return s;
}
function view(s,id,transition) {
  const active = !ended(s) && actor(s) === id;
  const motion = publicMotion(s,transition);
  return {phase:s.phase,round:s.round,rounds:s.rounds,turnId:actor(s),turnNumber:s.turnNumber,sequence:s.sequence,
    players:s.players.map(p => ({id:p.id,team:p.team,total:s.totals[p.team],cards:p.cards.map((c,slot) => ({slot,faceUp:c.faceUp,value:c.faceUp || ended(s) ? c.value : null}))})),
    totals:[...s.totals],history:clone(s.history),deckCount:s.deck.length,deckTop:s.deck.at(-1)?.faceUp ? s.deck.at(-1).value : null,
    discardTop:s.discard.at(-1)?.value ?? null,drawn:s.drawn && (active || s.drawn.source === 'discard' || s.drawn.card.faceUp) ? {value:s.drawn.card.value,source:s.drawn.source} : null,
    reveal:active && s.effect ? clone(s.effect) : null,caller:s.caller,remaining:s.finalTurns ? [...s.finalTurns] : null,
    roundResult:clone(s.roundResult),winners:[...s.winners],lastAction:s.lastAction,
    ...(motion?{motion}:{}),
    legal:{draw:active && s.phase === 'turn',discardDraw:active && s.phase === 'turn' && s.players.find(p => p.id === id).cards.length > 0 && s.discard.length > 0,
      scram:active && s.phase === 'turn' && !s.caller && s.players.find(p => p.id === id).cards.length <= 2,act:active}};
}
export const scram = {
  manifest:{id:'scram',title:'开溜！',rulesVersion:'Bezier Games 2023 · Rules 2.5',stateVersion:1,minPlayers:3,maxPlayers:6},
  create,apply,view,spectatorView:s => view(s,null),isFinished:s => s.phase === 'finished',
  turn:s => ended(s) ? null : {key:String(s.turnNumber),players:[actor(s)]},timeout:(v,id)=>scramBot.decide(v,id),
  bot:scramBot,
  result:s => ({winners:[...s.winners],rounds:s.round,scoreDirection:'lower',players:s.players.map(p => ({id:p.id,score:s.totals[p.team],rank:s.winners.includes(p.id) ? 1 : s.winners.length ? 2 : 1,breakdown:[{label:'队伍累计罚分',value:s.totals[p.team]}]}))}),
};
