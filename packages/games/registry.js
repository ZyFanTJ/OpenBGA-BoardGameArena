import { theGang } from './the-gang/index.js';
import { sevenWonders } from './seven-wonders/index.js';
import { marrakech } from './marrakech/index.js';
import { cabo } from './cabo/index.js';
import { nightOfTheNinja } from './night-of-the-ninja/index.js';
import { dnd } from './dnd/index.js';
import { uno } from './uno/index.js';
import { catan } from './catan/index.js';
import { texasHoldem } from './texas-holdem/index.js';
import { tidewatch } from './tidewatch/index.js';
import { scram } from './scram/index.js';
import { dnup } from './dnup/index.js';
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
export const games = createRegistry([theGang, cabo, marrakech, sevenWonders, nightOfTheNinja, dnd, uno, catan, texasHoldem, tidewatch, scram, dnup]);

