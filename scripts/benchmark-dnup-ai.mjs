import {dnup} from '../packages/games/dnup/index.js';
const games=Number(process.argv[2]??8),times=[],rows=[];
for(const count of [2,3,4,5]){let turns=0,wins=0;for(let seed=1;seed<=games;seed++){
 let n=seed;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/2**32),ids=Array.from({length:count},(_,i)=>String(i));let s=dnup.create(ids,{},random),memory={},steps=0;
 while(s.phase!=='finished'&&steps++<1200){
  if(s.phase==='roundEnd'){s=dnup.apply(s,'0',{type:'nextRound'},{isHost:true,random});continue;}
  for(const id of ids)memory[id]=dnup.bot.observe(dnup.view(s,id),id,memory[id]);
  const id=dnup.turn(s).players[0],v=dnup.view(s,id),start=performance.now(),difficulty=id===String((seed-1)%count)?'expert':'easy',cmd=dnup.bot.decide(v,id,memory[id],{difficulty});if(difficulty==='expert')times.push(performance.now()-start);
  s=dnup.apply(s,id,cmd);turns++;
 }
 if(s.phase!=='finished')throw new Error(`Stalled: ${count} players, seed ${seed}`);
 if(s.winners.includes(String((seed-1)%count)))wins++;
 }rows.push({players:count,games,expertWins:wins,meanTurns:Math.round(turns/games)});
}
times.sort((a,b)=>a-b);console.log(JSON.stringify({rows,expertDecisionMs:{median:Math.round(times[Math.floor(times.length*.5)]),p95:Math.round(times[Math.floor(times.length*.95)]),max:Math.round(times.at(-1))}},null,2));
