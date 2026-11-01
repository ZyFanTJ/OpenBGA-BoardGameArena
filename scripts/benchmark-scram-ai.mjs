import {scram} from '../packages/games/scram/index.js';
import {performance} from 'node:perf_hooks';

// The pre-upgrade policy is frozen here as a reproducible comparison opponent.
function baseline(v,id){
  if(!v.legal.act)return null;
  if(v.phase==='reveal')return {type:'resolve',swap:false};
  if(v.phase==='turn')return v.legal.scram?{type:'scram'}:{type:'draw',source:'deck'};
  if(v.phase!=='drawn')return null;
  const me=v.players.find(p=>p.id===id);if(!me.cards.length)return {type:'discard'};
  const first=[...me.cards].sort((a,b)=>(b.value===null?8:b.value==='='?1:b.value)-(a.value===null?8:a.value==='='?1:a.value))[0];
  const targets=[{playerId:id,slot:first.slot}];
  if(first.value!==null)for(const p of v.players.filter(p=>p.team===me.team))for(const c of p.cards)
    if(!(p.id===id&&c.slot===first.slot)&&c.value!==null&&(c.value===first.value||c.value==='='))targets.push({playerId:p.id,slot:c.slot});
  if(v.drawn.source==='discard'||targets.length>1||v.drawn.value==='='||v.drawn.value<=5)return {type:'replace',targets};
  if(v.drawn.value===10)return {type:'ability',targets:[targets[0]]};
  if(v.drawn.value===13)return {type:'ability',playerId:v.players.find(p=>p.team!==me.team).id};
  return {type:'discard'};
}
const seeds=Number(process.argv[2]??16),opponent=process.argv[3]??'baseline',results=[];
if(!Number.isInteger(seeds)||seeds<1||seeds>500)throw Error('Seeds must be 1–500');
for(const level of ['smart','ruthless']){
  let wins=0,losses=0,ties=0,ownPoints=0,rivalPoints=0,steps=0;const durations=[];
  for(let seed=1;seed<=seeds;seed++)for(const team of [0,1]){
    let x=seed;const random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/2**32);
    let s=scram.create(['a','b','c','d'],{},random),transition,memory={};
    for(let step=0;s.phase!=='finished'&&step<2000;step++){
      steps++;
      for(const p of s.players)memory[p.id]=scram.bot.observe(scram.view(s,p.id,transition),p.id,memory[p.id]);
      const id=s.phase==='roundEnd'?'a':scram.turn(s).players[0],v=scram.view(s,id,transition),own=s.players.find(p=>p.id===id).team===team;
      let command;
      if(s.phase==='roundEnd')command={type:'nextRound'};
      else if(!own&&opponent==='baseline')command=baseline(v,id);
      else{const start=performance.now();command=scram.bot.decide(v,id,memory[id],{difficulty:own?level:opponent});if(own)durations.push(performance.now()-start);}
      if(!command)throw Error('Missing action');
      transition={before:s,actorId:id,command};s=scram.apply(s,id,command,{random,isHost:true});
    }
    if(s.phase!=='finished')throw Error(`Unfinished ${level}/${seed}/${team}`);
    const winner=s.players.find(p=>s.winners.includes(p.id))?.team;
    if(winner===team)wins++;else if(winner===undefined)ties++;else losses++;
    ownPoints+=s.totals[team];rivalPoints+=s.totals[1-team];
  }
  durations.sort((a,b)=>a-b);const games=seeds*2;
  results.push({level,opponent,games,wins,losses,ties,winRate:Math.round(wins/games*1000)/10,meanOwnPoints:ownPoints/games,meanRivalPoints:rivalPoints/games,meanSteps:steps/games,p95DecisionMs:Math.round(durations[Math.floor(durations.length*.95)]*100)/100,maxDecisionMs:Math.round(durations.at(-1)*100)/100});
}
console.log(JSON.stringify(results,null,2));
