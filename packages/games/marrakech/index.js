import { ensure } from '../../platform/errors.js';
import { DIE, indexOf, placements, region, walk } from './board.js';
import { marrakechBot } from './bot.js';

const copy = value => structuredClone(value);
const randomIndex = (random, size) => {
  ensure(typeof random === 'function', '游戏需要注入随机源');
  const value = random(); ensure(Number.isFinite(value) && value >= 0 && value < 1, '随机数超出范围');
  return Math.floor(value * size);
};
function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomIndex(random, i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function scores(state) {
  return state.players.map(p => {
    const area = state.board.filter(cell => cell?.ownerId === p.id).length;
    return { id: p.id, coins: p.coins, area, total: p.coins + area, eliminated: p.eliminated };
  });
}
function finish(state) {
  const active = state.players.filter(p => !p.eliminated);
  if (active.length > 1 && active.some(p => p.rugs.length)) return false;
  state.phase = 'finished';
  const ranked = scores(state).filter(p => !p.eliminated).sort((a, b) => b.total - a.total || b.coins - a.coins);
  state.winners = active.length === 1 ? [active[0].id] : ranked.filter(p => p.total === ranked[0].total && p.coins === ranked[0].coins).map(p => p.id);
  return true;
}
function next(state) {
  if (finish(state)) return;
  do { state.turn = (state.turn + 1) % state.players.length; } while (state.players[state.turn].eliminated || !state.players[state.turn].rugs.length);
  state.phase = 'orient'; state.turnNumber++;
}
function create(ids, options = {}, random) {
  ensure(Array.isArray(ids) && ids.length >= 2 && ids.length <= 4 && new Set(ids).size === ids.length, '需要 2–4 位不同玩家');
  ensure(options && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).length === 0, '魔毯商人使用标准规则，无额外选项');
  const players = ids.map((id, i) => {
    const colors = ids.length === 2 ? [i * 2, i * 2 + 1] : [i];
    const rugs = colors.flatMap(color => Array(ids.length === 3 ? 15 : 12).fill(color));
    return { id, colors, coins: 30, eliminated: false, rugs: ids.length === 2 ? shuffle(rugs, random) : rugs };
  });
  return { players, board: Array(49).fill(null), pawn: { x: 3, y: 3, direction: 0 }, turn: randomIndex(random, ids.length), turnNumber: 1,
    phase: 'orient', sequence: 0, nextRugId: 1, lastEvent: null, winners: [] };
}
function apply(input, playerId, command, { random } = {}) {
  ensure(input.phase !== 'finished', '本局已结束');
  ensure(input.players[input.turn].id === playerId, '还没轮到你', 403);
  ensure(command && typeof command === 'object' && !Array.isArray(command), '行动格式无效');
  const state = copy(input), player = state.players[state.turn];
  if (command.type === 'roll') {
    ensure(state.phase === 'orient', '请先铺完这块地毯');
    ensure(Number.isInteger(command.direction) && command.direction >= 0 && command.direction < 4 && command.direction !== (state.pawn.direction + 2) % 4, '只能直行、左转或右转');
    const die = DIE[randomIndex(random, DIE.length)];
    const from = { ...state.pawn }, movement = walk({ ...from, direction: command.direction }, die);
    state.pawn = movement.pawn;
    const cell = state.board[indexOf(state.pawn.x, state.pawn.y)], owner = state.players.find(p => p.id === cell?.ownerId);
    let payment = null;
    if (owner && owner.id !== player.id && !owner.eliminated) {
      const cells = region(state.board, indexOf(state.pawn.x, state.pawn.y)), due = cells.length, paid = Math.min(due, player.coins);
      player.coins -= paid; owner.coins += paid;
      player.eliminated = paid < due;
      if (player.eliminated) player.rugs = [];
      payment = { fromId: player.id, toId: owner.id, due, paid, cells, eliminated: player.eliminated };
    }
    state.lastEvent = { id: ++state.sequence, type: 'move', actorId: player.id, from, direction: command.direction, die, path: movement.path, payment };
    if (player.eliminated) next(state);
    else state.phase = 'place';
  } else if (command.type === 'place') {
    ensure(state.phase === 'place', '请先确定方向并掷骰');
    ensure(Array.isArray(command.cells) && command.cells.length === 2 && command.cells.every(Number.isInteger), '请选择两个相邻格');
    const cells = [...command.cells].sort((a, b) => a - b);
    ensure(placements(state.board, state.pawn).some(pair => pair[0] === cells[0] && pair[1] === cells[1]), '这里不能铺毯，不能盖住商人或完整覆盖同一块旧毯');
    const color = player.rugs.shift(), rugId = state.nextRugId++;
    for (let half = 0; half < 2; half++) state.board[cells[half]] = { rugId, ownerId: player.id, color, half, vertical: cells[1] - cells[0] === 7 };
    state.lastEvent = { id: ++state.sequence, type: 'place', actorId: player.id, cells, color, rugId };
    next(state);
  } else ensure(false, '未知游戏行动');
  return state;
}
function view(state, viewerId) {
  const player = state.players[state.turn], ownTurn = player.id === viewerId && state.phase !== 'finished';
  return { phase: state.phase, turnId: player.id, turnNumber: state.turnNumber, sequence: state.sequence,
    board: copy(state.board), pawn: { ...state.pawn }, winners: [...state.winners], scores: scores(state),
    players: state.players.map(p => ({ id: p.id, colors: [...p.colors], coins: p.coins, eliminated: p.eliminated, remaining: p.rugs.length })),
    nextColor: state.phase !== 'finished' ? player.rugs[0] ?? null : null,
    legal: { directions: ownTurn && state.phase === 'orient' ? [0, 1, 2, 3].filter(d => d !== (state.pawn.direction + 2) % 4) : [],
      placements: ownTurn && state.phase === 'place' ? placements(state.board, state.pawn) : [] },
    lastEvent: state.lastEvent ? copy(state.lastEvent) : null };
}
export const marrakech = {
  manifest: { id: 'marrakech', title: '魔毯商人', rulesVersion: 'Gigamic 11-2024 · standard / insufficient-payment elimination', stateVersion: 1, minPlayers: 2, maxPlayers: 4 },
  create, apply, view,
  turn:s=>s.phase==='finished'?null:{key:String(s.turnNumber),players:[s.players[s.turn].id]},
  timeout:(view,id)=>marrakechBot.decide(view,id,{}),
  result(state){const rows=scores(state),compare=(a,b)=>Number(state.winners.includes(b.id))-Number(state.winners.includes(a.id))||Number(a.eliminated)-Number(b.eliminated)||b.total-a.total||b.coins-a.coins;return {winners:[...state.winners],rounds:1,scoreDirection:'higher',players:rows.map(p=>({id:p.id,score:p.total,rank:1+rows.filter(q=>compare(q,p)<0).length,breakdown:[{label:'钱币',value:p.coins},{label:'领地',value:p.area}]}))};}, isFinished: state => state.phase === 'finished', bot: marrakechBot,
};
