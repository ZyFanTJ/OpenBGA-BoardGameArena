// Decisions use only the player's projection and public component definitions.
// This is an evaluation model, never a second authoritative game transition.
import {CARDS, WONDERS, card, effects, stages} from './data.js';
import {scores, quantity, neighbors, strength, production, navalStrength, buildQuote, totalPayment} from './economy.js';
import {COMMERCIAL} from './armada.js';

const sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const remaining=s=>Math.max(0,(3-s.age)*(s.turnsPerAge??6)+(s.turnsPerAge??6)-s.round);
const own=(s,id)=>s.players.find(p=>p.id===id);
const best=options=>options.reduce((a,b)=>!a||b.value>a.value+1e-9?b:a,null);
// No hands, draft decks, offers or other players' pending commands are reconstructed.
function publicPosition(view){return {age:view.age,round:view.round,turnsPerAge:view.turnsPerAge,phase:view.phase,expansions:view.expansions,players:view.players.map(p=>({
 id:p.id,wonder:p.wonder,side:p.side,coins:p.coins,cards:p.cards.map(c=>c.id),leaders:(p.leaders??[]).map(c=>c.id),islands:(p.islands??[]).map(c=>c.id),mummies:[],stages:p.stages,builtStages:[...p.builtStages],military:[...p.military],navalMilitary:[...(p.navalMilitary??[])],fleets:p.fleets?{...p.fleets}:undefined,
 // Current legal payments come from the view; these flags are used only for estimates.
 bankResourceUsed:false,refundUsed:[],bankBonusUsed:false,
}))};}
function replace(s,p){return {...s,players:s.players.map(x=>x.id===p.id?p:x)};}
function coinsValue(coins,s){const turns=remaining(s);return coins/3+(turns?Math.min(coins,6)*Math.min(.5,turns*.045):0);}
function conflictValue(gap,age,confidence){const exact=gap>0?2*age-1:gap<0?-1:0;
 const soft=((2*age-1)*Math.tanh(Math.max(0,gap)*.65)-Math.tanh(Math.max(0,-gap)*.65));
 return confidence*exact+(1-confidence)*soft;
}
function militaryPotential(s,p){const es=effects(p),power=strength(p),last=s.turnsPerAge??6;let value=0;
 for(let age=s.age;age<=3;age++)for(const n of neighbors(s,p)){
  const weight=age===s.age?1:age===s.age+1?.55:.3;
  const confidence=age===s.age?clamp(s.round/last,0,1)*.85:0;
  const gap=power-strength(n),win=conflictValue(gap,age,confidence);
  value+=weight*(win+(gap>0?sum(es,e=>(e.victoryPoints??0)+(e.victoryCoins??0)/3):0));
  if(gap<0&&es.some(e=>e.noDefeat))value-=weight*1.5;
  if(gap<0&&es.some(e=>e.reflectDefeat))value+=weight;
 }
 if(p.fleets){const powers=s.players.map(n=>navalStrength(n)),v=navalStrength(p),min=Math.min(...powers),max=Math.max(...powers);
  if(min!==max){const winners=powers.filter(n=>n===max).length,rest=powers.filter(n=>n<max&&n>min),second=Math.max(...rest);
   value+=v===min?-s.age:v===max?(winners===1?2*s.age+1:2*s.age-1):v===second&&rest.filter(n=>n===second).length===1?2*s.age-1:0;
  }
  // Small progress value avoids treating a non-winning naval step as worthless.
  value+=remaining(s)*.035*v;
 }
 return value;
}
function economyPotential(s,p){const turns=remaining(s);if(!turns)return 0;
 const ns=neighbors(s,p),supply=production(p),market=ns.flatMap(n=>production(n,true)),weights={w:1,s:1,o:1,c:1,g:1.05,p:1.05,t:1.05};
 // A scarce home resource and resources needed by unfinished wonder stages matter more.
 for(const stage of stages(p).filter((_,i)=>!p.builtStages.includes(i)))for(const r of stage.cost.resources)weights[r]+=.14;
 let value=0;
 for(const r of 'wsocgpt'){
  const amount=sum(supply,slot=>slot.includes(r)?1/slot.length:0),available=sum(market,slot=>slot.includes(r)?1/slot.length:0);
  value+=weights[r]*(available? .8:1.15)*(Math.min(amount,1)*3+clamp(amount-1,0,1)*1.6+clamp(amount-2,0,1)*.65);
 }
 return value*Math.min(1.25,turns/10);
}
function futureEffects(s,p){const turns=remaining(s),es=effects(p),colors=Object.fromEntries(['brown','grey','blue','yellow','red','green','purple'].map(color=>[color,p.cards.filter(id=>card(id).color===color).length]));let value=0;
 for(const e of es){
  if(e.discount)value+=Math.min(3,turns*.25)*(e.discount==='goods'?1.05:1);
  if(e.bankResource)value+=Math.min(4,turns*.32);
  if(e.reduceColor)value+=turns*.19*(1+(e.reduceColor==='green'?colors.green*.12:0));
  if(e.reduceWonder)value+=Math.min(Math.max(0,stages(p).length-p.stages),turns*.15)*.9;
  if(e.freePurple)value+=s.age<3?2.2:Math.min(2,turns*.55);
  if(e.freeLeaders)value+=Math.max(0,3-s.age)*1.6;
  if(e.leaderDiscount)value+=Math.max(0,3-s.age)*e.leaderDiscount*.45;
  if(e.double)value+=Math.max(0,4-s.age)*3.3;
  if(e.freeColor)value+=Math.min(3,turns*.2)*1.3;
  if(e.freeFirst)value+=Math.max(0,3-s.age)*1.7;
  if(e.freeLast)value+=Math.max(0,4-s.age)*1.5;
  value+=turns*((e.yellowCoins??0)*.08+(e.chainCoins??0)*.07+(e.tradeRefund??0)*.13+(e.bankBonus??0)*.12+(e.advanceCoins??0)*.1);
  if(e.leaderColorPoints)value+=turns*.13*e.leaderColorPoints.points;
  if(e.stagePoints)value+=Math.min(Math.max(0,stages(p).length-p.stages),turns*.15)*e.stagePoints;
  if(e.scienceSet)value+=turns*.045*e.scienceSet;
  if(e.farTrade)value+=Math.min(2,turns*.15);
  if(e.taxShield)value+=turns*.08;
  if(e.reduceNaval)value+=turns*.18;
  if(e.wonderAdvance)value+=Math.min(3,turns*.3);
 }
 return value;
}
function utility(s,id){const p=own(s,id),row=scores(s).find(r=>r.id===id),sc=row.science;
 let value=row.total-row.treasury+coinsValue(p.coins,s)+militaryPotential(s,p)+economyPotential(s,p)+futureEffects(s,p);
 // Reward a developing science engine, while terminal science remains the exact rule score.
 value+=Math.min(1.6,remaining(s)*.13)*(sum(sc.counts,n=>n)*.9+sc.counts.filter(n=>n>0).length*.35+Math.max(...sc.counts)*.45+sc.wild*.7);
 // Public free-chain links: credit only future-age buildings present at this player count.
 if(remaining(s))for(const c of Object.values(CARDS))if(c.age>s.age&&c.copies.some(n=>n<=s.players.length)&&p.cards.some(id=>c.from.includes(card(id).kind)))value+=.45;
 return value;
}
function advanceEstimate(s,p,color){const pos=p.fleets?.[color];if(pos===undefined||pos>=6)return {state:s,bonus:0};
 let next={...p,fleets:{...p.fleets,[color]:pos+1}},bonus=0;
 if(color==='yellow'){if(pos+1>=2&&pos+1<=5)next.coins+=pos+1;bonus+=(COMMERCIAL[pos+1]-COMMERCIAL[pos])*(.35+remaining(s)*.1);if([2,4,6].includes(pos+1))bonus+=.6;}
 if(color==='green'){const level=Math.ceil((pos+1)/2);bonus+=[2,4,6].includes(pos+1)?[0,3.5,5,7][level]:Math.min(2,remaining(s)*.2);}
 next.coins+=sum(effects(p),e=>e.advanceCoins??0);
 return {state:replace(s,next),bonus};
}
function applyEstimate(s,id,c,action='build',stage){let p=own(s,id),next={...p,cards:[...p.cards],leaders:[...p.leaders],islands:[...p.islands],builtStages:[...p.builtStages]},bonus=0;
 if(action==='wonder'){next.stages++;next.builtStages.push(stage);}else if(c.color==='white')next.leaders.push(c.id);else if(c.color==='island')next.islands.push(c.id);else next.cards.push(c.id);
 let after=replace(s,next),e=c.effect;
 next.coins+=(e.coins??0)+(e.income?quantity(after,next,e.income)*e.income.coins:0);
 const es=effects(p);
 if(action==='build'&&c.color==='yellow')next.coins+=sum(es,e=>e.yellowCoins??0);
 if(e.victoryToken)next.military=[...next.military,s.age*2-1];
 if(e.removeDefeats)next.military=next.military.filter(v=>v>0);
 if(e.advanceColor){const a=advanceEstimate(after,next,e.advanceColor);after=a.state;next=own(after,id);bonus+=a.bonus;}
 if(e.advance){const used=new Set();for(let i=0;i<e.advance;i++){const choices=['red','yellow','blue','green'].filter(k=>!used.has(k)&&next.fleets?.[k]<6).map(k=>{const a=advanceEstimate(after,next,k);return {...a,color:k,value:utility(a.state,id)-utility(after,id)+a.bonus};});const a=best(choices);if(!a)break;after=a.state;next=own(after,id);bonus+=a.bonus;used.add(a.color);}}
 if(e.drawIsland||e.explore)bonus+=[0,3.5,5,7][e.drawIsland??e.explore];
 if(e.revive)bonus+=s.age===3?5:s.age===2?3.5:2;
 if(e.drawLeaders)bonus+=e.drawLeaders*.65;
 if(e.recruitExtra)bonus+=1.5;
 if(e.pirate)bonus+=sum(s.players.filter(x=>x.id!==id),x=>COMMERCIAL[x.fleets?.yellow??0])*.12;
 if(action==='wonder'&&es.some(e=>e.wonderAdvance)&&next.fleets)bonus+=2.5;
 return {state:after,bonus};
}
function evaluation(s,id,c,action='build',stage){const estimate=applyEstimate(s,id,c,action,stage);let value=utility(estimate.state,id)+estimate.bonus;
 if(action==='wonder'){
  // Building a low-point first stage can unlock a strong engine in the next stage.
  const p=own(estimate.state,id),future=stages(p),index=WONDERS[p.wonder].unordered?-1:stage+1;
  if(index>=0&&future[index]&&!p.builtStages.includes(index)&&remaining(s)>2){const follow={...future[index],id:null};const next=applyEstimate(estimate.state,id,follow,'wonder',index);value+=Math.max(0,utility(next.state,id)+next.bonus-utility(estimate.state,id))*.28;}
 }
 return value;
}
function paidValue(s,id,estimate,q){const p=own(estimate,id),es=effects(own(s,id));let delta=-totalPayment(q),opponentCost=0;
 if(q.chain||q.reason==='chain')delta+=sum(es,e=>e.chainCoins??0);
 if(es.some(e=>e.tradeRefund))delta+=Number(q.left>0)+Number(q.right>0);
 const ns=neighbors(s,p),i=s.players.findIndex(x=>x.id===id),n=s.players.length;
 const receipts=new Map();
 for(const [key,target] of [['left',ns[0]],['right',ns[1]],['farLeft',s.players[(i+2)%n]],['farRight',s.players[(i+n-2)%n]]]){
  opponentCost+=(q[key]??0)*(.08+(target.coins<3?.07:0));
  receipts.set(target.id,(receipts.get(target.id)??0)+(q[key]??0));
 }
 const paid=replace(estimate,{...p,coins:p.coins+delta});
 return {state:{...paid,players:paid.players.map(x=>receipts.has(x.id)?{...x,coins:x.coins+receipts.get(x.id)}:x)},penalty:opponentCost};
}
function chooseSide(s,v,id){return best(v.setupChoices.map(choice=>{const p={...own(s,id),side:choice.side},ss=replace(s,p);let value=utility(ss,id);
 for(const [i,stage] of choice.stages.entries()){const future=applyEstimate(ss,id,{...stage,id:null},'wonder',i);value+=(utility(future.state,id)+future.bonus-utility(ss,id))*Math.pow(.68,i);value-=stage.cost.resources.length*.2;}
 return {side:choice.side,value};})).side;}
function threat(s,id,c){if(c.color==='white')return 0;const i=s.players.findIndex(p=>p.id===id),target=s.players[(i+(s.age===2?-1:1)+s.players.length)%s.players.length];
 if(target.cards.some(x=>card(x).kind===c.kind)||!buildQuote(s,target,c.id).plans.length)return 0;
 return Math.max(0,evaluation(s,target.id,c)-utility(s,target.id));
}
export const sevenWondersBot={observe:()=>({}),decide(view,id){
 const me=view.players.find(p=>p.id===id);if(!me)return null;
 const actionable=view.phase==='setup'?!me.side:view.phase==='leaderDraft'?view.leaderDraftChoices.length>0:
  view.phase==='explore'?!!view.exploration:view.phase==='ability'?view.ability?.playerId===id:
  view.phase==='navalChoice'?view.canNavalChoice:view.phase==='revive'?view.reviveId===id&&view.discardChoices.length>0:view.canChoose;
 if(!actionable)return null;
 const s=publicPosition(view),base=utility(s,id),command=c=>({...c,epoch:view.epoch});
 if(view.phase==='setup')return me.side?null:command({type:'side',side:chooseSide(s,view,id)});
 if(view.phase==='leaderDraft'){
  const drafted=view.draftedLeaders??[];
  const options=view.leaderDraftChoices.map(c=>{const p=own(s,id),projected=replace(s,{...p,leaders:[...p.leaders,...drafted.map(x=>x.id)]}),q=applyEstimate(projected,id,c);return {cardId:c.id,value:utility(q.state,id)+q.bonus-utility(projected,id)-(c.cost.age?2:c.cost.coins)*.55};});
  const pick=best(options);return pick?command({type:'leaderPick',cardId:pick.cardId}):null;
 }
 if(view.phase==='explore'){const pick=best((view.exploration?.cards??[]).map(c=>({cardId:c.id,value:evaluation(s,id,c)})));return pick?command({type:'islandPick',offerId:view.exploration.offerId,cardId:pick.cardId}):null;}
 if(view.phase==='ability'){
  if(view.ability?.playerId!==id)return null;
  const pick=best(view.ability.options.map(o=>{let value=0;const p=own(s,id);
   if(view.ability.kind==='advance'){const a=advanceEstimate(s,p,o.value);value=utility(a.state,id)-base+a.bonus;}
   if(view.ability.kind==='discardVictory'){const military=[...p.military];military.splice(military.indexOf(o.value),1);value=utility(replace(s,{...p,military}),id)-base;}
   if(view.ability.kind==='mummify'){const next=replace(s,{...p,leaders:p.leaders.filter(x=>x!==o.value)});value=utility(next,id)-base+2*(o.card.cost.age?3:o.card.cost.coins);}
   return {value,option:o.value};}));return pick?command({type:'ability',value:pick.option}):null;
 }
 if(view.phase==='navalChoice'){if(!view.canNavalChoice)return null;const powers=s.players.map(p=>navalStrength(p));return command({type:'navalChoice',participate:navalStrength(own(s,id))>Math.min(...powers)||Math.max(...powers)===Math.min(...powers)});}
 if(view.phase==='revive'){if(view.reviveId!==id)return null;const pick=best(view.discardChoices.map(c=>({cardId:c.id,value:evaluation(s,id,c)})));return pick?command({type:'revive',cardId:pick.cardId}):null;}
 if(!view.canChoose||!view.hand.length)return null;
 const danger=new Map(view.hand.map(c=>[c.id,threat(s,id,c)])),options=[];
 for(const c of view.hand){const estimated=applyEstimate(s,id,c);
  for(const q of c.build.plans){const paid=paidValue(s,id,estimated.state,q,c);options.push({cardId:c.id,action:'build',payment:q,value:utility(paid.state,id)+estimated.bonus-paid.penalty+danger.get(c.id)*.14});}
  if(c.navalBuild)for(const q of c.navalBuild.plans){const p=own(estimated.state,id),naval=advanceEstimate(estimated.state,p,c.color),paid=paidValue(s,id,naval.state,q,c);options.push({cardId:c.id,action:'build',naval:c.color,payment:q,value:utility(paid.state,id)+estimated.bonus+naval.bonus-paid.penalty+danger.get(c.id)*.14});}
 }
 if(view.phase!=='recruitExtra'){
  const buried=best(view.hand.map(c=>({card:c,value:danger.get(c.id)*.14-Math.max(0,evaluation(s,id,c)-base)*.03}))).card;
  for(const q of view.wonderOptions??[view.wonderBuild]){const stage=(q.stage??me.stages+1)-1,c={...me.stageList[stage],id:null};if(!c.effect)continue;
   for(const naval of [false,true]){const quote=naval?q.naval:q;if(!quote?.plans.length)continue;
    const estimated=applyEstimate(s,id,c,'wonder',stage);let future=estimated.state,bonus=estimated.bonus;
    if(naval){const advanced=advanceEstimate(future,own(future,id),quote.color);future=advanced.state;bonus+=advanced.bonus;}
    const unlock=evaluation(s,id,c,'wonder',stage)-utility(estimated.state,id)-estimated.bonus;
    for(const payment of quote.plans){const paid=paidValue(s,id,future,payment,c);options.push({cardId:buried.id,action:'wonder',stage,payment,...(naval?{naval:quote.color}:{}),value:utility(paid.state,id)+bonus+unlock-paid.penalty+danger.get(buried.id)*.14});}
   }
  }
  const p=own(s,id),sold=replace(s,{...p,coins:p.coins+3});options.push({cardId:buried.id,action:'sell',value:utility(sold,id)+danger.get(buried.id)*.14});
  if(view.canSellFleet){const a=advanceEstimate(s,p,'yellow');options.push({cardId:buried.id,action:'sell',sellFleet:true,value:utility(a.state,id)+a.bonus+danger.get(buried.id)*.14});}
 }
 const pick=best(options);if(!pick)return null;const {value,...choice}=pick;return command({type:'choose',...choice});
}};
