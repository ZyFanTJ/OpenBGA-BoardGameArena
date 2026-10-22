// Frozen 0.8.2 policy is a benchmark opponent, not a production difficulty setting.
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {sevenWonders as game} from '../packages/games/seven-wonders/index.js';
import {sevenWondersBot as baseline} from '../tests/fixtures/seven-wonders-ai-v1.js';
const seeds=Number(process.argv[2]??2),out=process.argv[3];
if(!Number.isInteger(seeds)||seeds<1||seeds>100)throw Error('seed count must be 1–100');
const rng=n=>()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/2**32);
const configurations=[{name:'base',options:{}},{name:'leaders',options:{leaders:true}},{name:'armada',options:{armada:true}},{name:'combined-expert',options:{leaders:true,armada:true,leaderExpert:true}}];
const games=[];
for(const configuration of configurations)for(const count of [3,5,7])for(let seed=0;seed<seeds;seed++)for(let seat=0;seat<count;seat++){
 const ids=Array.from({length:count},(_,i)=>String(i)),hero=ids[seat],random=rng(4321+seed*777+count*19),latency=[];
 let state=game.create(ids,{side:'choose',...configuration.options},random),steps=0;
 while(!game.isFinished(state)&&steps++<1000){const id=game.turn(state).players[0];if(!id)throw Error('stalled '+state.phase);
  const view=game.view(state,id),start=performance.now(),command=(id===hero?game.bot:baseline).decide(view,id);
  if(id===hero)latency.push(performance.now()-start);
  if(!command)throw Error('no command '+state.phase);state=game.apply(state,id,command,{random});
 }
 if(!game.isFinished(state))throw Error('game failed to finish');
 const rows=game.result(state).players,me=rows.find(p=>p.id===hero),rivals=rows.filter(p=>p.id!==hero),mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
 const row={configuration:configuration.name,count,seed,seat,score:me.score,rank:me.rank,winShare:me.rank===1?1/rows.filter(p=>p.rank===1).length:0,marginOverBest:me.score-Math.max(...rivals.map(p=>p.score)),marginOverMean:me.score-mean(rivals.map(p=>p.score)),meanDecisionMs:mean(latency),maxDecisionMs:Math.max(...latency)};
 games.push(row);console.log(JSON.stringify(row));
}
const groups=[];
for(const configuration of configurations)for(const count of [3,5,7]){const rows=games.filter(g=>g.configuration===configuration.name&&g.count===count),mean=key=>rows.reduce((n,r)=>n+r[key],0)/rows.length;groups.push({configuration:configuration.name,count,games:rows.length,winShare:mean('winShare'),meanScore:mean('score'),marginOverBest:mean('marginOverBest'),marginOverMean:mean('marginOverMean'),meanDecisionMs:mean('meanDecisionMs'),maxDecisionMs:Math.max(...rows.map(r=>r.maxDecisionMs))});}
const report={policy:'public-position-v2',baseline:'frozen 0.8.2',seedsPerConfiguration:seeds,method:'One upgraded seat versus frozen baseline seats; identical deal seed rotated through every seat; split tied wins.',games,groups};
if(out)await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({summary:groups}));
