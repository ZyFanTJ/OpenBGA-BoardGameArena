import test from 'node:test';
import assert from 'node:assert/strict';
import {resultActions} from '../apps/web/result-actions.js';
import {postgameRoom} from '../apps/web/room-lounge.js';
import {uno} from '../packages/games/uno/index.js';
import {createUnoRenderer} from '../apps/web/games/uno/index.js';
const room={status:'finished',hostId:'a',matchId:'match-one',gameId:'uno',players:[{id:'a',name:'房主'},{id:'b',name:'同桌'}],rematchVotes:[]};
test('postgame actions are inside a single toolbar, available immediately, and respect host and guest rematch roles',()=>{
 const html=resultActions(room,{id:'a'});
 for(const action of ['share','room','again'])assert.match(html,new RegExp(`data-action="table:${action}"`));
 assert.doesNotMatch(html,/disabled/);assert.match(html,/再来一局/);
 assert.equal(resultActions({...room,status:'playing'},{id:'a'}),'');
 const guest=resultActions({...room,rematchVotes:['b']},{id:'b'});
 assert.match(guest,/data-action="table:again" disabled/);assert.match(guest,/已准备，等待房主/);
 assert.match(guest,/1 位牌友想继续/);assert.doesNotMatch(guest,/data-action="table:share" disabled/);
});
test('returning to the postgame room preserves the snapshot and offers results without lobby-only commands',()=>{
 const before=structuredClone(room),html=postgameRoom(room,{id:'b'},{title:'UNO'});
 assert.deepEqual(room,before);assert.match(html,/data-action="table:results"/);assert.match(html,/查看战绩/);
 assert.match(html,/座位已保留/);assert.doesNotMatch(html,/data-action="(?:ready|start|addBot|removeBot)"/);
 assert.doesNotMatch(html,/data-action="table:room"/);
});
test('UNO final result embeds share and return controls inside the score dialog while round results keep next-round controls',()=>{
 const state=uno.create(['a','b'],{},()=>.42);
 state.phase='finished';state.roundResult={winnerId:'a',points:100,players:[{id:'a',remaining:0},{id:'b',remaining:100}]};
 state.players[0].total=500;
 const snapshot={...room,game:uno.view(state,'a')},ui=createUnoRenderer(()=>{},()=>{});
 const html=ui.render(snapshot,{id:'a'}),dialog=html.match(/<section class="uno-result"[\s\S]*?<\/section>/)?.[0];
 assert.ok(dialog);assert.match(dialog,/data-action="table:share"/);assert.match(dialog,/data-action="table:room"/);
 assert.doesNotMatch(html,/可在房间菜单再来一局/);
 state.phase='roundEnd';const roundHtml=ui.render({...snapshot,status:'playing',game:uno.view(state,'a')},{id:'a'});
 assert.match(roundHtml,/data-action="game:nextRound"/);assert.doesNotMatch(roundHtml,/data-action="table:share"/);
});
