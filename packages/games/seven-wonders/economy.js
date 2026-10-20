import {RESOURCES,WONDERS,card,stages,builtStages,effects} from './data.js';
import {SHIPYARDS,FLEET_COLORS,COMMERCIAL,BLUE_POINTS,RED_STRENGTH} from './armada.js';
export const neighbors=(s,p)=>{const i=s.players.findIndex(x=>x.id===p.id),n=s.players.length;return [s.players[(i+1)%n],s.players[(i+n-1)%n]];};
export const farNeighbors=(s,p)=>{const i=s.players.findIndex(x=>x.id===p.id),n=s.players.length;return [s.players[(i+2)%n],s.players[(i+n-2)%n]];};
export const owns=(p,id)=>p.cards.some(c=>card(c).kind===card(id).kind);
export const strength=p=>effects(p).reduce((n,e)=>n+(e.shields??0),0);
export const commercial=p=>COMMERCIAL[p.fleets?.yellow??0];
export const navalStrength=p=>RED_STRENGTH[p.fleets?.red??0]+Number(p.fleets?.blue===6)+2*Number(p.fleets?.yellow===6)+effects(p).reduce((n,e)=>n+(e.naval??0),0);
export const production=(p,tradeable=false)=>[...(WONDERS[p.wonder].resource?[[WONDERS[p.wonder].resource]]:[]),...(tradeable?p.cards.filter(id=>['brown','grey'].includes(card(id).color)).flatMap(id=>card(id).effect.production??[]):effects(p).flatMap(e=>e.production??[])).map(r=>[...r])];
export const totalPayment=x=>(x.left??0)+(x.right??0)+(x.farLeft??0)+(x.farRight??0)+(x.bank??0);
export function reducedCosts(cost,count=0){let values=[cost.resources];for(let k=0;k<count;k++)values=[...new Set(values.flatMap(r=>r.length?[...r].map((_,i)=>r.slice(0,i)+r.slice(i+1)):['']))];return values.map(resources=>({...cost,resources}));}
export function paymentPlans(state,p,cost,explain=false){
 const bank=cost.coins??0;if(p.coins<bank)return [];
 const types=Object.keys(RESOURCES),target=types.map(r=>[...cost.resources].filter(x=>x===r).length),[left,right]=neighbors(state,p),es=effects(p),discounts=es.map(e=>e.discount);
 const price=(r,side)=>discounts.includes('wsoc'.includes(r)?side:'goods')?1:2;
 const slots=[...production(p).map(resources=>({resources,side:'own'})),...production(left,true).map(resources=>({resources,side:'left'})),...production(right,true).map(resources=>({resources,side:'right'}))];
 const limits={farLeft:0,farRight:0};
 if(state.expansions?.armada)for(const e of es)if(e.farTrade){const key=e.farTrade.side==='left'?'farLeft':'farRight';limits[key]+=e.farTrade.limit;}
 const far=farNeighbors(state,p);
 for(const [i,key] of ['farLeft','farRight'].entries())if(limits[key])slots.push(...production(far[i],true).map(resources=>({resources,side:key})));
 if(es.some(e=>e.bankResource)&&!p.bankResourceUsed)slots.push({resources:types,side:'reserve'});
 let possible=new Map([['start',{counts:types.map(()=>0),left:0,right:0,farLeft:0,farRight:0,reserve:0,...(explain?{sources:[]}: {})}]]);
 for(const slot of slots){const next=new Map(possible);for(const x of possible.values())for(const r of slot.resources){const i=types.indexOf(r);if(x.counts[i]>=target[i])continue;
  const q={...x,counts:[...x.counts]};q.counts[i]++;if(slot.side!=='own')q[slot.side]+=slot.side==='left'||slot.side==='right'?price(r,slot.side):1;
  if(q.farLeft>limits.farLeft||q.farRight>limits.farRight||q.left+q.right+q.farLeft+q.farRight+q.reserve+bank>p.coins)continue;
  if(explain)q.sources=[...x.sources,{resource:r,source:slot.side}];next.set(`${q.counts}:${q.left}:${q.right}:${q.farLeft}:${q.farRight}:${q.reserve}`,q);
 }possible=next;}
 return [...possible.values()].filter(x=>x.counts.every((v,i)=>v===target[i])).map(x=>({left:x.left,right:x.right,bank:bank+x.reserve,...(x.farLeft?{farLeft:x.farLeft}:{}),...(x.farRight?{farRight:x.farRight}:{}),...(x.reserve?{reserve:x.reserve}:{}),reason:cost.resources||bank?'payment':'free',...(explain?{sources:x.sources}:{})})).sort((a,b)=>totalPayment(a)-totalPayment(b)||a.left-b.left);
}
export const availableStages=p=>stages(p).map((_,i)=>i).filter(i=>!builtStages(p).includes(i)&&(WONDERS[p.wonder].unordered||i===p.stages));
export function navalCosts(p,color){if(!p.fleets||!FLEET_COLORS.includes(color)||p.fleets[color]>=6)return [];return reducedCosts(SHIPYARDS[p.shipyard].costs[color][p.fleets[color]],effects(p).reduce((n,e)=>n+(e.reduceNaval??0),0));}
function plansForCosts(state,p,costs,explain,naval){
 if(naval){const shipCosts=navalCosts(p,naval);costs=costs.flatMap(c=>shipCosts.map(s=>({resources:c.resources+s.resources,coins:(c.coins??0)+s.coins})));}
 const result=costs.flatMap(c=>paymentPlans(state,p,c,explain)),unique=new Map();
 for(const q of result){const key=[q.left,q.right,q.bank,q.farLeft??0,q.farRight??0,q.reserve??0].join(':');if(!unique.has(key))unique.set(key,q);}
 return [...unique.values()].sort((a,b)=>totalPayment(a)-totalPayment(b)||a.left-b.left);
}
export function buildQuote(state,p,id,explain=false,naval=null){const c=card(id),es=effects(p),leader=c.color==='white';
 if(!leader&&owns(p,id))return {plans:[],reason:'已经建有同名建筑'};
 if(naval&&(leader||c.color!==naval))return {plans:[],reason:'舰队颜色须与建筑相同'};
 let costs,reason='payment';
 if(leader){const discount=es.reduce((n,e)=>n+(e.leaderDiscount??0),0)+neighbors(state,p).filter(n=>n.wonder==='roma'&&n.side==='night').length;costs=[{resources:'',coins:es.some(e=>e.freeLeaders)?0:Math.max(0,(c.cost.age?state.age:c.cost.coins)-discount)}];}
 else if(p.cards.some(id=>c.from.includes(card(id).kind))){costs=[{resources:'',coins:0}];reason='chain';}
 else if(es.some(e=>e.freePurple)&&c.color==='purple'||es.some(e=>e.freeColor)&&!p.cards.some(id=>card(id).color===c.color)||es.some(e=>e.freeFirst)&&state.round===1||es.some(e=>e.freeLast)&&state.round===(state.expansions?.armada?7:6)){costs=[{resources:'',coins:0}];reason='wonder';}
 else costs=reducedCosts(c.cost,es.filter(e=>e.reduceColor===c.color).length);
 const plans=plansForCosts(state,p,costs,explain,naval).map(q=>({...q,reason:naval?'naval':reason==='payment'?q.reason:reason,...(reason==='chain'?{chain:true}:{})}));
 return {plans,reason:plans.length?'':'资源不足或钱币不够',...(naval?{naval}:{})};
}
export function wonderQuote(state,p,explain=false,stage=availableStages(p)[0],naval=null){
 if(!availableStages(p).includes(stage))return {plans:[],reason:'奇迹已全部完成'};
 const linked=effects(p).some(e=>e.wonderAdvance)?null:SHIPYARDS[p.shipyard]?.linked;
 if(naval&&naval!==linked)return {plans:[],reason:'此舰队未与奇迹关联'};
 const costs=reducedCosts(stages(p)[stage].cost,effects(p).reduce((n,e)=>n+(e.reduceWonder??0),0)),plans=plansForCosts(state,p,costs,explain,naval);
 return {plans,reason:plans.length?'':'资源不足或钱币不够',stage:stage+1,...(naval?{naval}:{})};
}
export function quantity(s,p,r){const ns=neighbors(s,p),group=r.scope==='all'?[p,...ns]:r.scope==='neighbors'?ns:[p];if(r.color==='stages')return group.reduce((n,x)=>n+x.stages,0);const colors=Array.isArray(r.color)?r.color:[r.color];return group.reduce((n,x)=>n+x.cards.filter(id=>colors.includes(card(id).color)).length,0);}
export function scienceScore(counts,wild=0,setValue=7){if(!wild)return counts.reduce((n,c)=>n+c*c,0)+setValue*Math.min(...counts);return Math.max(...counts.map((_,i)=>scienceScore(counts.map((c,j)=>c+Number(i===j)),wild-1,setValue)));}
function science(p){const counts=[0,0,0],es=effects(p);let wild=0;for(const e of es){if(Number.isInteger(e.science))counts[e.science]++;wild+=e.wild??0;}
 const bonus=es.reduce((n,e)=>n+(e.majorityScience??0),0),change=es.some(e=>e.scienceChange),setValue=7+es.reduce((n,e)=>n+(e.scienceSet??0),0);
 // Majority symbols are extra copies of a natural symbol. Wilds are assigned afterwards.
 const evaluate=c=>{const max=Math.max(...c),tied=c.map((v,i)=>v===max?i:-1).filter(i=>i>=0);return Math.max(...tied.map(i=>scienceScore(c.map((v,j)=>v+(i===j?bonus:0)),wild,setValue)));};
 let points=evaluate(counts);if(change)for(let i=0;i<3;i++)if(counts[i])for(let j=0;j<3;j++){const c=[...counts];c[i]--;c[j]++;points=Math.max(points,evaluate(c));}
 return {counts,wild,bonus,points};
}
export function scores(state){return state.players.map(p=>{const r={id:p.id,treasury:Math.floor(p.coins/3),military:p.military.reduce((a,b)=>a+b,0),wonder:0,blue:0,yellow:0,green:0,purple:0,...(state.expansions?.leaders?{leaders:0}:{}),...(state.expansions?.armada?{naval:(p.navalMilitary??[]).reduce((a,b)=>a+b,0),fleet:BLUE_POINTS[p.fleets.blue],islands:0}:{})};
 const colors=Object.fromEntries(['brown','grey','blue','yellow','red','green','purple'].map(c=>[c,p.cards.filter(id=>card(id).color===c).length]));
 const extra=e=>(e.points??0)+(e.scoring?quantity(state,p,e.scoring)*e.scoring.points:0)+(e.complete&&p.stages===stages(p).length?e.complete:0)+(e.commercialPoints??0)*commercial(p);
 for(const id of p.cards){const c=card(id),key=c.color==='blue'?'blue':c.color==='purple'?'purple':'yellow';r[key]+=extra(c.effect);}
 for(const i of builtStages(p))r.wonder+=extra(stages(p)[i].effect);
 for(const id of p.leaders??[]){const e=card(id).effect;r.leaders+=extra(e)+(e.stagePoints??0)*p.stages+(e.victoryPoints??0)*p.military.filter(v=>v>0).length+(e.treasuryBonus??0)*Math.floor(p.coins/3)+(e.leaderColorPoints?colors[e.leaderColorPoints.color]*e.leaderColorPoints.points:0)+(e.colorSet?Math.min(...e.colorSet.colors.map(c=>colors[c]))*e.colorSet.points:0)+(e.onlyLeader&&(p.leaders.length===1)?e.onlyLeader:0)+(e.noDefeat&&!p.military.some(v=>v<0)?e.noDefeat:0);
  if(e.victoryPairs)for(const v of [1,3,5])r.leaders+=Math.floor(p.military.filter(x=>x===v).length/2)*v;
  if(e.majority)r.leaders+=5*neighbors(state,p).filter(n=>e.majority==='coins'?p.coins>n.coins:colors[e.majority]>n.cards.filter(id=>card(id).color===e.majority).length).length;
 }
 for(const id of p.mummies??[])r.wonder+=2*(card(id).cost.age?3:card(id).cost.coins);
 for(const id of p.islands??[]){const e=card(id).effect;r.islands+=extra(e)+(e.islandPoints??0)*p.islands.length+(e.maxColorPoints??0)*Math.max(...Object.values(colors));}
 const sc=science(p);r.green=sc.points;r.science={counts:sc.counts,wild:sc.wild,...(sc.bonus?{bonus:sc.bonus}:{})};r.total=Object.entries(r).filter(([k,v])=>k!=='id'&&typeof v==='number').reduce((n,[,v])=>n+v,0);return r;
 });}
export function navalResults(players,age){const rows=players.map(p=>({id:p.id,strength:navalStrength(p),token:0}));if(rows.length<2)return rows;const min=Math.min(...rows.map(r=>r.strength)),max=Math.max(...rows.map(r=>r.strength));if(min===max)return rows;
 for(const r of rows)if(r.strength===min)r.token=-age;
 const first=rows.filter(r=>r.strength===max);for(const r of first)r.token=first.length===1?2*age+1:2*age-1;
 if(first.length===1){const rest=rows.filter(r=>r.strength<max&&r.strength>min),second=Math.max(...rest.map(r=>r.strength)),tied=rest.filter(r=>r.strength===second);if(tied.length===1)tied[0].token=2*age-1;}
 return rows;
}
