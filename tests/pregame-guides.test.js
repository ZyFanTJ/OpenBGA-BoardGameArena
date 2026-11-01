import test from 'node:test';
import assert from 'node:assert/strict';
import {roles} from '../packages/games/night-of-the-ninja/cards.js';
import {roles as publicRoles} from '../apps/web/games/night-of-the-ninja/reference.js';
import {fullGuide as ninjaGuide} from '../apps/web/games/night-of-the-ninja/guide.js';
import {fullGuide as wondersGuide} from '../apps/web/games/seven-wonders/guide.js';
import {content as caboGuide} from '../apps/web/games/cabo-guide.js';
import {gameCards} from '../apps/web/games/registry.js';
import {setupOptions,rulesSetup} from '../apps/web/room-setup.js';

test('pregame ninja reference stays identical to game-owned public card definitions',()=>{
 assert.deepEqual(publicRoles,roles);
 const html=ninjaGuide(publicRoles);
 for(const role of Object.values(roles))assert.ok(html.includes(role.name));
});
test('pregame guides reflect the selected CABO variant and Wonders expansions without private state',()=>{
 assert.match(caboGuide(true),/本房间专家模式/);
 assert.match(caboGuide(false),/标准模式/);
 assert.doesNotMatch(wondersGuide({}),/已启用：领袖|已启用：舰队/);
 const expanded=wondersGuide({turnsPerAge:7,expansions:{leaders:true,armada:true}});
 assert.match(expanded,/已启用：领袖/);assert.match(expanded,/全桌海战/);assert.match(expanded,/行动 7 次/);
});
test('shared setup preserves adventure defaults and current room options and revision',()=>{
 assert.match(setupOptions(gameCards.dnd),/value="blackapple" checked/);
 const html=rulesSetup({revision:12,options:{target:100},turnSeconds:30},{title:'UNO',minPlayers:2,maxPlayers:10},gameCards.uno);
 assert.match(html,/data-revision="12"/);assert.match(html,/value="100" selected/);assert.match(html,/value="30"[^>]*selected/);
 const adventure=rulesSetup({revision:1,options:{adventureId:'morgansfort',dmMode:'local'},turnSeconds:0},{title:'冒险'},gameCards.dnd);
 assert.match(adventure,/value="morgansfort" checked/);assert.match(adventure,/value="30" disabled/);
});
