import test from 'node:test';
import assert from 'node:assert/strict';
import {theGang as game} from '../packages/games/the-gang/index.js';
import {gangBot,strength} from '../packages/games/the-gang/bot.js';
import {createGangRenderer} from '../apps/web/games/the-gang/index.js';
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('AI only uses its visible cards and prefers strong current hands',()=>{
 const s=game.create(['a','b','c'],{},rng(9)),v=game.view(s,'a');
 const original=JSON.stringify(v),m=gangBot.observe(v,'a');gangBot.decide(v,'a',m);assert.equal(JSON.stringify(v),original);
 const other=structuredClone(s);[other.players[1].hand,other.deck]=[other.deck.slice(0,2),other.players[1].hand];assert.deepEqual(game.view(other,'a'),v);
 const weak=structuredClone(v),strong=structuredClone(v);weak.players[0].hand=[{rank:2,suit:'s'},{rank:3,suit:'h'}];strong.players[0].hand=[{rank:14,suit:'s'},{rank:14,suit:'h'}];assert.ok(strength(strong,'a')>strength(weak,'a')+.5);
});
test('3–6 AI players complete matches with bounded claims and safe empty memory',()=>{
 for(let n=3;n<=6;n++){const ids=Array.from({length:n},(_,i)=>String(i)),random=rng(n);let s=game.create(ids,{},random),mem={},steps=0;
 while(!game.isFinished(s)&&steps<180){let acted=false;for(const id of ids){const v=game.view(s,id);mem[id]=gangBot.observe(v,id,mem[id]);const cmd=gangBot.decide(v,id,mem[id]);if(!cmd)continue;const next=game.apply(s,id,cmd,{random});mem[id]=gangBot.observe(game.view(s,id),id,mem[id],cmd);s=next;steps++;acted=true;break;}assert.ok(acted,'AI must not stall');}assert.ok(game.isFinished(s));assert.ok(s.vaults===3||s.alarms===3);assert.equal(gangBot.decide(game.view(s,'0'),'0',{}),null);}
});
test('HUD escapes names, labels AI and hides private dock for spectators',()=>{
 const s=game.create(['a','b','c'],{},rng(4)),players=[{id:'a',name:'<script>'},{id:'b',name:'Bot',isBot:true},{id:'c',name:'C'}],r=createGangRenderer(()=>{});
 const html=r.render({game:game.view(s,'a'),players},{id:'a'});assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('gang-ai'));assert.ok(html.includes('aria-current="step"'));
 const watch=r.render({game:game.spectatorView(s),players,spectator:true},{id:null});assert.ok(!watch.includes('data-action="game:take"'));assert.ok(!watch.includes('gang-private'));
});
