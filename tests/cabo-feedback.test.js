import test from 'node:test';
import assert from 'node:assert/strict';
import {turnCountdownText} from '../apps/web/turn-feedback.js';
import {createCaboRenderer} from '../apps/web/games/cabo.js';
import {cabo} from '../packages/games/cabo/index.js';
import {avatar} from '../apps/web/hub/cosmetics.js';

test('turn countdown uses elapsed server time, pauses without losing time and handles automatic actions and no limit',()=>{
 const turn={remainingMs:48000,seconds:60,paused:false};
 assert.equal(turnCountdownText(turn,1500),'0:47');
 assert.equal(turnCountdownText({...turn,paused:true},1500),'0:48');
 assert.equal(turnCountdownText(turn,50000),'自动行动中');
 assert.equal(turnCountdownText({remainingMs:null,seconds:0}),'不限时');
});

test('CABO puts the own countdown beside the action prompt, keeps opponents clock out and uses the robot portrait for bots',()=>{
 let state=cabo.create(['a','b'],{},()=>.4);
 for(const id of ['a','b'])for(const command of [{type:'look',slots:[0,1]},{type:'confirm'}])state=cabo.apply(state,id,command,{random:()=>.4,isHost:id==='a'});
 const me={id:'a',name:'玩家'},room={id:'ABCD1234',matchId:'match',hostId:'a',players:[me,{id:'b',name:'AI 1',isBot:true}],game:cabo.view(state,'a'),turn:{key:'turn:a',required:true,paused:false,remainingMs:48000,seconds:60}};
 const renderer=createCaboRenderer(()=>{},()=>{}),html=renderer.render(room,me);
 assert.match(html,/<div class="cabo-action-heading"><p class="turn-prompt" role="status">你的回合<\/p><span class="cabo-turn-clock"/);
 assert.match(html,/data-turn-countdown[^>]*>0:48<\/span>/);
 assert.doesNotMatch(html,/选择牌堆/);
 assert.doesNotMatch(renderer.render({...room,turn:{...room.turn,required:false}},me),/data-turn-countdown/);
 assert.doesNotMatch(renderer.render({...room,turn:{...room.turn,paused:true}},me),/data-turn-countdown/);
 assert.match(avatar(room.players[1]),/robot-companion-v1\.png/);
 assert.doesNotMatch(avatar(me),/robot-companion/);
});
