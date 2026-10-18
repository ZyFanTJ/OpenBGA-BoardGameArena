import { sevenWonders } from './seven-wonders/index.js';
import { marrakech } from './marrakech/index.js';
import { cabo } from './cabo/index.js';
import { ensure } from '../platform/errors.js';

/** The platform knows only this contract; game rules never enter room/HTTP code. */
export function createRegistry(modules) {
  const entries = new Map();
  for (const game of modules) {
    ensure(game.manifest?.id && !entries.has(game.manifest.id), '游戏标识必须唯一');
    for (const method of ['create', 'apply', 'view', 'isFinished']) ensure(typeof game[method] === 'function', `游戏缺少 ${method}`);
    entries.set(game.manifest.id, game);
  }
  return { list: () => [...entries.values()].map(g => g.manifest), get(id) {
    ensure(entries.has(id), '游戏不存在', 404); return entries.get(id);
  } };
}
export const games = createRegistry([cabo, marrakech, sevenWonders]);

