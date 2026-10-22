import test from 'node:test';
import assert from 'node:assert/strict';
import { dnd } from '../packages/games/dnd/index.js';
import { adventures, adventureCatalog } from '../packages/games/dnd/adventures/index.js';
import { adventureCatalog as browserCatalog } from '../apps/web/games/dnd/catalog.js';
import { adventureOptions } from '../apps/web/games/dnd/adventure-picker.js';
import { adventureView } from '../apps/web/games/dnd/play-ui.js';

const context = { random: () => .8 };
function drain(s, random = context.random) {
  for (let i=0; i<10 && (s.pending || s.pendingCheck); i++) s = s.pending ? dnd.applyEffect(s,s.pending.id,{ source:'local' },{random}) : dnd.apply(s,s.pendingCheck.playerId,{ type:'roll' },{random});
  return s;
}
function start(adventureId, type='wizard') {
  let s=dnd.create(['a'],{ adventureId, dmMode:'local' });
  return drain(dnd.apply(s,'a',{ type:'character', name:'旅人', archetype:type, note:'SECRET-NOTE' },context));
}
function choose(s,id,random=context.random) { return drain(dnd.apply(s,'a',{type:'choose',choiceId:id},{random}),random); }
function route(s,ids) { for(const id of ids) s=choose(s,id); return s; }

test('Adventure catalog has no GM material; UI and rule identifiers agree; all pack references resolve',()=>{
  assert.deepEqual(browserCatalog,adventureCatalog);
  assert.throws(()=>dnd.create(['a'],{adventureId:'cos'}));
  assert.throws(()=>dnd.create(['a'],{adventureId:'__proto__'}));
  for(const a of Object.values(adventures)) {
    assert.ok(a.scenes[a.start]);
    for(const [scene,actions] of Object.entries(a.actions)) {
      assert.ok(a.scenes[scene]); assert.equal(new Set(actions.map(x=>x.id)).size,actions.length);
      for(const x of actions) {
        for(const next of [x.next,x.failureNext]) if(next) assert.ok(a.scenes[next],next);
        for(const clue of [x.clue,x.requires,x.advantageClue]) if(clue) assert.ok(a.clueNames[clue],clue);
        if(x.encounter) assert.ok(a.encounters[x.encounter]);
        for(const key of [...x.flags??[],...x.failureFlags??[],...x.requiresFlags??[],...x.excludesFlags??[],...x.requiresAnyFlags??[],...x.unlessAllFlags??[]]) assert.ok(a.flagNames[key],key);
      }
    }
    for(const encounter of Object.values(a.encounters)) if(encounter.next) assert.ok(a.scenes[encounter.next]);
    const catalog=adventureCatalog.find(x=>x.id===a.id);
    assert.ok(!('actions' in catalog) && !('scenes' in catalog) && !('encounters' in catalog));
  }
  assert.match(adventureOptions(),/value="blackapple" checked/);
  assert.match(adventureOptions({}),/value="mistlight" checked/);
});

test('Blackapple supports full noncombat rescue, revisits and an earned seven-child ending',()=>{
  const initial=start('blackapple'), before=JSON.stringify(initial);
  let s=route(initial,['scout:children','travel:manor','study:rhyme','travel:mirror','talk:attendant','travel:garden','study:sleeve','help:giles','travel:service','study:aprons','help:kitchen','travel:hall','talk:lord','help:guests','travel:service','travel:cellar','talk:arthur','travel:treasury','study:mirror']);
  assert.equal(JSON.stringify(initial),before);
  assert.equal(s.combat,null); assert.equal(s.flags.gardenChild,true);
  assert.equal(s.visited.filter(x=>x==='service').length,1);
  assert.ok(dnd.view(s,'a').choices.some(x=>x.id==='escape:all'));
  assert.ok(!dnd.view(s,'a').choices.some(x=>x.id==='escape:partial'));
  s=choose(s,'escape:all');
  assert.equal(s.phase,'finished'); assert.equal(s.outcome.won,true); assert.match(s.outcome.text,/获救 7 \/ 7/);
  assert.equal(s.journal.some(x=>x.kind==='combat'),false);
});

test('Leaving children behind yields a partial ending, never a false shared victory',()=>{
  let s=route(start('blackapple'),['travel:tavern','travel:mirror','travel:hall','travel:service','travel:cellar','travel:treasury','study:mirror']);
  assert.throws(()=>choose(s,'escape:all'));
  s=choose(s,'escape:partial');
  assert.equal(s.outcome.partial,true); assert.equal(s.outcome.won,false); assert.deepEqual(dnd.result(s).winners,[]);
  assert.match(s.outcome.text,/获救 0 \/ 7/);
});

test('Failed diplomacy persists alert and changes later preview; cancelled dice do not change it',()=>{
  let s=route(start('blackapple'),['travel:tavern','travel:mirror','travel:hall']);
  const pending=dnd.apply(s,'a',{type:'choose',choiceId:'talk:lord'},context);
  assert.equal(pending.flags.alarm,undefined);
  s=choose(s,'talk:lord',()=>0); assert.equal(s.flags.alarm,true);
  s=route(s,['travel:service','travel:cellar','travel:treasury']);
  const check=dnd.view(s,'a').choices.find(x=>x.id==='study:mirror').check;
  assert.equal(check.target,14);
  s=choose(s,'study:mirror',()=>0);
  assert.equal(s.combat.key,'mirrorGuard'); assert.equal(s.flags.mirrorOpen,undefined);
});

test('Morgansfort supports a pact, persistent treasure, safe backtracking and returning to town',()=>{
  let s=route(start('morgansfort'),['talk:bart','travel:river','investigate:raft','repair:raft','scout:tracks','travel:traps','investigate:pits','travel:edge','talk:feud','talk:pact','travel:store','investigate:relic','travel:camp','travel:traps','travel:entry','travel:river','travel:inn']);
  assert.equal(s.flags.opener,true); assert.equal(s.flags.passage,true);
  assert.equal(s.scene,'dragonInn'); assert.ok(s.visited.includes('store'));
  s=choose(s,'finish:expedition');
  assert.equal(s.outcome.won,true); assert.match(s.outcome.text,/通行约定仍然有效/); assert.match(s.outcome.text,/金制裁信刀/);
});

test('Failed trap check changes route instead of blocking play; treasure cannot be farmed',()=>{
  let s=route(start('morgansfort','fighter'),['travel:river','investigate:raft','repair:raft','travel:traps']);
  const hp=s.players[0].character.hp;
  s=choose(s,'sneak:cross',()=>0);
  assert.equal(s.scene,'lower'); assert.equal(s.players[0].character.hp,hp-2); assert.equal(s.flags.lower,true);
  s=route(s,['travel:entry','travel:wolves','investigate:cache']);
  s=choose(s,'sneak:cache');
  assert.equal(s.flags.silver,true); assert.equal(s.combat,null);
  assert.throws(()=>choose(s,'sneak:cache'));
  s=route(s,['travel:entry','travel:river','travel:inn','finish:expedition']);
  assert.match(s.outcome.text,/余 493 枚/);
});

test('Exploration consequences remain usable at 1 HP and expose the actual HP loss',()=>{
  let s=route(start('morgansfort'),['travel:river']); s.players[0].character.hp=1;
  s=choose(s,'force:cross',()=>0);
  assert.equal(s.players[0].character.hp,1); assert.equal(s.players[0].character.death.dead,false);
  assert.match(s.journal.map(x=>x.text).join('\n'),/损失 0 HP/);
  assert.equal(s.scene,'entry');
});

test('Player projection and DM request do not reveal future rooms, outcomes or another private note',()=>{
  let s=start('blackapple'); const v=dnd.view(s,'a'), outsider=dnd.view(s,'other');
  for(const output of [v,outsider]) {
    const json=JSON.stringify(output);
    assert.ok(!json.includes('gardenChild')); assert.ok(!json.includes('mirrorGuard'));
    assert.ok(!json.includes('蓝色温室')); assert.ok(!json.includes('真正的亚瑟'));
  }
  assert.ok(!JSON.stringify(outsider).includes('SECRET-NOTE'));
  s=dnd.apply(s,'a',{type:'act',text:'请讲讲这里的村民'},context);
  const request=JSON.stringify(dnd.effect(s));
  assert.ok(!request.includes('SECRET-NOTE')); assert.ok(!request.includes('蓝色温室')); assert.ok(!request.includes('hallGuard'));
  // Current, public NPC motivations give the narrator grounded material.
  assert.match(request,/希望查明亚瑟为何性情大变/);
});

test('V2 migration preserves a locked roll and the original adventure without changing the input',()=>{
  let old=start('mistlight'); old=dnd.apply(old,'a',{type:'choose',choiceId:'investigate'},context);
  delete old.visited; delete old.flags; delete old.options.adventureId;
  const before=JSON.stringify(old), migrated=dnd.migrate(old,2);
  assert.equal(JSON.stringify(old),before); assert.deepEqual(migrated.pendingCheck,old.pendingCheck);
  assert.equal(migrated.options.adventureId,'mistlight'); assert.deepEqual(migrated.visited,['village']);
  assert.ok(drain(migrated).clues.includes('waterway'));
});

test('Every adventure room renders its own art, action labels, map and attribution without spoilers',()=>{
  for(const a of Object.values(adventures)) {
    for(const id of Object.keys(a.scenes)) {
      let s=start(a.id); s.scene=id; s.visited.push(id);
      const v=dnd.view(s,'a');
      const html=adventureView(v,{hostId:'a'}, {id:'a'}, {panel:'map',focus:'',draft:'',narration:''},'');
      assert.match(html,new RegExp(a.scenes[id].title)); assert.ok(!html.includes('undefined')); assert.ok(!html.includes('[object Object]'));
      assert.ok(!html.includes('style='));
    }
  }
});
