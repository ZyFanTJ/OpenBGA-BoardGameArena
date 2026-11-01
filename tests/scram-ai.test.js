import test from 'node:test';
import assert from 'node:assert/strict';
import {scram,campScore} from '../packages/games/scram/index.js';
import {unseenDistribution} from '../packages/games/scram/bot.js';
const random=()=>.4,ref=(playerId,slot)=>({playerId,slot});
function position(hands,drawn){const s=scram.create(hands.map((_,i)=>String(i)),{},random);s.cursor=0;s.players.forEach((p,i)=>{p.cards=hands[i].map(value=>({value,faceUp:true}));});if(drawn!==undefined){s.phase='drawn';s.drawn={card:{value:drawn,faceUp:false},source:'deck'};}return s;}
function decision(s,difficulty='smart',memory){const v=scram.view(s,'0');return scram.bot.decide(v,'0',memory??scram.bot.observe(v,'0'),{difficulty});}
test('SCRAM advanced AI finds teammate matching groups including own equals anchors',()=>{
  const s=position([['=',1],[2],[12,12],[3]],4),cmd=decision(s);
  assert.equal(cmd.type,'replace');assert.deepEqual(new Set(cmd.targets.map(r=>JSON.stringify(r))),new Set([ref('0',0),ref('2',0),ref('2',1)].map(r=>JSON.stringify(r))));
  const r=scram.apply(s,'0',cmd,{random});assert.equal(r.players[2].cards.length,0);
});
test('SCRAM advanced AI uses high value teammate removal and exchanges, not just its own camp',()=>{
  let s=position([[1],[1],[13],[2]],10),cmd=decision(s);assert.deepEqual(cmd,{type:'ability',targets:[ref('2',0)]});
  s=position([[12],[1],[5],[3]],11);cmd=decision(s);assert.equal(cmd.type,'ability');assert.deepEqual(new Set(cmd.targets.map(r=>JSON.stringify(r))),new Set([ref('0',0),ref('1',0)].map(r=>JSON.stringify(r))));
});
test('SCRAM exchanges within the team when a lower anchor reduces equals scoring',()=>{
  for(const value of [11,12]){
    const s=position([[1],[13],['=',12],[13]],value);s.deck.at(-1).value=13;s.deck.at(-1).faceUp=true;const cmd=decision(s);
    assert.equal(cmd.type,'ability');assert.deepEqual(new Set(cmd.targets.map(r=>r.playerId)),new Set(['0','2']));
    let after=scram.apply(s,'0',cmd,{random});if(after.phase==='reveal')after=scram.apply(after,'0',decision(after),{random});
    assert.ok(campScore(after.players[0].cards)+campScore(after.players[2].cards)<=14);
  }
});
test('SCRAM advanced AI avoids bad 9 actions, values equals correctly, and prefers profitable discard pickup',()=>{
  const s=position([[1],[2],[1],[3]],9);assert.equal(decision(s).type,'discard');
  const anchored=position([['=',1],[2],[1],[3]],5);assert.notEqual(decision(anchored).type,'replace');
  const pickup=position([[12,12,12],[2],[13],[3]]);pickup.discard=[{value:1,faceUp:true}];assert.deepEqual(decision(pickup),{type:'draw',source:'discard'});
});
test('SCRAM advanced AI uses viewing/revealing and decides 12 swap only after seeing targets',()=>{
  for(const value of [5,6,7,8]){
    const s=position([[1],[5],[6,7],[8]],value);s.players[2].cards.forEach(c=>{c.faceUp=false;});
    assert.equal(decision(s).type,'ability');
  }
  for(const [a,b,expected] of [[12,1,true],[1,12,false]]){
    const s=position([[a],[b],[4],[5]],12);s.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));
    const peek=scram.apply(s,'0',{type:'ability',targets:[ref('0',0),ref('1',0)]},{random});
    assert.deepEqual(decision(peek),{type:'resolve',swap:expected});
  }
});
test('SCRAM 13 exploits an enemy equals anchor and still works when rival camps are empty',()=>{
  const s=position([[1],[13],[2],['=']],13);assert.deepEqual(decision(s),{type:'ability',playerId:'3'});
  const empty=decision(position([[1],[],[2],[]],13));assert.equal(empty.type,'ability');assert.ok(['1','3'].includes(empty.playerId));
});
test('SCRAM calling considers entire team and refuses a clearly losing call',()=>{
  for(const difficulty of ['easy','smart','ruthless']){
    assert.notEqual(decision(position([[1],[1],[13,13],[1]]),difficulty).type,'scram');
    assert.equal(decision(position([[1],[10,11],[1],[10,11]]),difficulty).type,'scram');
  }
  const s=position([[2],[9],[2],[1]]);s.discard=[{value:1,faceUp:true}];
  assert.equal(decision(s,'smart').type,'scram');assert.notEqual(decision(s,'ruthless').type,'scram');
});
test('SCRAM public motion excludes private drawn and peek values, moves only previously known cards',()=>{
  let s=position([[2,8],[4,7],[5,6],[9,10]]);s.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));
  let memory={...scram.bot.observe(scram.view(s,'0'),'0'),known:{'0':[2,8],'1':[null,7],'2':[null,6],'3':[null,null]}};
  s.phase='drawn';s.drawn={card:{value:11,faceUp:false},source:'deck'};s.cursor=1;
  const cmd={type:'ability',targets:[ref('0',0),ref('1',0)]},r=scram.apply(s,'1',cmd,{random});
  const v=scram.view(r,'0',{before:s,actorId:'1',command:cmd});const before=structuredClone(memory);
  memory=scram.bot.observe(v,'0',memory);assert.deepEqual(memory.known['0'],[null,8]);assert.deepEqual(memory.known['1'],[2,7]);assert.deepEqual(before.known['0'],[2,8]);
  assert.deepEqual(v.motion.targets,[ref('0',0),ref('1',0)]);assert.equal(v.reveal,null);
});
test('SCRAM memory handles private replacements, compaction, repeated snapshots and missing transitions',()=>{
  let s=position([[4,4,1],[2],[4],[3]],2);s.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));
  let m={...scram.bot.observe(scram.view(s,'0'),'0'),known:{'0':[4,4,1],'1':[null],'2':[4],'3':[null]}};
  const cmd={type:'replace',targets:[ref('0',0),ref('0',1),ref('2',0)]},r=scram.apply(s,'0',cmd,{random});
  const v=scram.view(r,'0',{before:s,actorId:'0',command:cmd});m=scram.bot.observe(v,'0',m);assert.deepEqual(m.known['0'],[2,1]);assert.deepEqual(m.known['2'],[]);
  assert.deepEqual(scram.bot.observe(v,'0',m),m);
  const skipped={...v,sequence:v.sequence+3};delete skipped.motion;const cleared=scram.bot.observe(skipped,'0',m);assert.deepEqual(cleared.known['0'],[null,null]);
});
test('SCRAM unseen distribution subtracts observations and behavior is identical for identical views',()=>{
  const s=position([[2,3],[4,5],[6,7],[8,9]],11);s.players.forEach(p=>p.cards.forEach(c=>{c.faceUp=false;}));
  const alternate=structuredClone(s);alternate.deck.reverse();alternate.players[1].cards[0].value=13;
  assert.deepEqual(scram.view(s,'0'),scram.view(alternate,'0'));assert.deepEqual(decision(s,'ruthless'),decision(alternate,'ruthless'));
  const v=scram.view(s,'0'),memory=scram.bot.observe(v,'0');memory.discard=[1,1,1,1];const dist=unseenDistribution(v,memory);
  assert.equal(dist.find(d=>d.value===1).probability,0);assert.ok(Math.abs(dist.reduce((n,d)=>n+d.probability,0)-1)<1e-9);
});
test('SCRAM every difficulty completes matches with truthful private memory, legal commands and no mutations',()=>{
  for(const n of [3,4,6])for(const difficulty of ['easy','smart','ruthless']){
    let seed=n*7;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    let s=scram.create(Array.from({length:n},(_,i)=>String(i)),{},rng),transition,memories={},steps=0;
    while(!scram.isFinished(s)&&steps++<1500){
      for(const p of s.players){const v=scram.view(s,p.id,transition);memories[p.id]=scram.bot.observe(v,p.id,memories[p.id]);
        for(const q of s.players)memories[p.id].known[q.id].forEach((value,i)=>{if(value!==null)assert.equal(value,q.cards[i].value,`false memory ${n}/${difficulty}/${steps}`);});
        memories[p.id].deck.slice(0,s.deck.length).forEach((value,i)=>{if(value!==null)assert.equal(value,s.deck.at(-1-i).value,`false deck memory ${n}/${difficulty}/${steps}`);});
      }
      const id=s.phase==='roundEnd'?'0':scram.turn(s).players[0],v=scram.view(s,id,transition),before=JSON.stringify({v,m:memories[id]});
      const command=s.phase==='roundEnd'?{type:'nextRound'}:scram.bot.decide(v,id,memories[id],{difficulty});assert.ok(command);
      assert.equal(JSON.stringify({v,m:memories[id]}),before);
      transition={before:s,actorId:id,command};s=scram.apply(s,id,command,{random:rng,isHost:true});
    }
    assert.equal(s.phase,'finished',`${n}/${difficulty} stalled`);
  }
});
