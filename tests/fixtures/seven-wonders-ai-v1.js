// Strategy receives only the same player-specific projection as a human.
const total=p=>p.left+p.right+p.bank+(p.farLeft??0)+(p.farRight??0);
function value(c,me,s) {
  const e=c.effect;let score=(e.points??0)+(e.coins??0)*.45+(e.shields??0)*(s.age===3?2:2.5);
  if(e.production)score+=e.production.length*(s.age===1?5: s.age===2?3:0.5)+e.production.reduce((n,r)=>n+r.length,0)*.3;
  if(Number.isInteger(e.science)){const counts=s.scores.find(p=>p.id===me.id).science.counts;score+=3+2*counts[e.science]+(counts.every((n,i)=>i===e.science||n>0)?4:0);}
  if(e.discount)score+=s.age===1?4:1;
  if(e.income)score+=2+me.cards.filter(c=>c.color===e.income.color).length*e.income.coins*.45;
  if(e.scoring)score+=3+(e.scoring.scope==='own'?me.cards.filter(c=>c.color===e.scoring.color).length:2)*e.scoring.points;
  if(e.wild)score+=7;
  if(e.complete)score+=me.stages===me.stageList.length?7:1;
  score+=(e.naval??0)*2+(e.advance??0)*3+(e.drawIsland??0)*3+(e.majorityScience??0)*5;
  if(e.freeLeaders||e.bankResource||e.reduceColor||e.reduceWonder)score+=s.age===1?6:2;
  if(e.stagePoints)score+=me.stages*e.stagePoints;
  if(e.leaderColorPoints)score+=me.cards.filter(c=>c.color===e.leaderColorPoints.color).length*e.leaderColorPoints.points+2;
  if(e.scienceSet||e.freePurple)score+=4;
  if(e.colorSet)score+=3;
  if(e.yellowCoins||e.chainCoins||e.tradeRefund||e.bankBonus)score+=s.age===1?5:2;
  if(e.majority||e.victoryPoints||e.treasuryBonus||e.victoryPairs||e.noDefeat)score+=3;
  return score;
}
export const sevenWondersBot={observe:()=>({}),decide(s,id) {
  const me=s.players.find(p=>p.id===id);
  if(s.phase==='setup')return me.side?null:{type:'side',side:'day',epoch:s.epoch};
  if(s.phase==='leaderDraft')return s.leaderDraftChoices.length?{type:'leaderPick',cardId:[...s.leaderDraftChoices].sort((a,b)=>value(b,me,s)-value(a,me,s))[0].id,epoch:s.epoch}:null;
  if(s.phase==='explore')return s.exploration?{type:'islandPick',offerId:s.exploration.offerId,cardId:[...s.exploration.cards].sort((a,b)=>value(b,me,s)-value(a,me,s))[0].id,epoch:s.epoch}:null;
  if(s.phase==='ability')return s.ability?.playerId===id?{type:'ability',value:s.ability.options[0].value,epoch:s.epoch}:null;
  if(s.phase==='navalChoice')return s.canNavalChoice?{type:'navalChoice',participate:me.naval>Math.min(...s.players.map(p=>p.naval)),epoch:s.epoch}:null;
  if(s.phase==='revive')return s.reviveId===id&&s.discardChoices.length?{type:'revive',cardId:[...s.discardChoices].sort((a,b)=>value(b,me,s)-value(a,me,s))[0].id,epoch:s.epoch}:null;
  if(!s.canChoose)return null;
  const options=s.hand.flatMap(c=>c.build.plans.length?[{cardId:c.id,action:'build',payment:c.build.plans[0],value:value(c,me,s)-total(c.build.plans[0])*.7}]:[]);
  for(const c of s.hand)if(c.navalBuild?.plans.length){const q=c.navalBuild.plans[0],pos=me.fleets[c.color];options.push({cardId:c.id,action:'build',naval:c.color,payment:q,value:value(c,me,s)+(c.color==='green'?5:c.color==='yellow'&&pos>=1?4:3)-total(q)*.7});}
  if(s.wonderBuild.plans.length) {
    const least=[...s.hand].sort((a,b)=>value(a,me,s)-value(b,me,s))[0];
    for(const q of s.wonderOptions??[s.wonderBuild])if(q.plans.length){const index=(q.stage??me.stages+1)-1,stage=me.stageList[index];options.push({cardId:least.id,action:'wonder',stage:index,payment:q.plans[0],value:value(stage,me,s)+(stage.effect.revive?5:0)+(stage.effect.freeColor?7:0)+(stage.effect.double?7:0)-total(q.plans[0])*.7});}
  }
  options.push({cardId:[...s.hand].sort((a,b)=>value(a,me,s)-value(b,me,s))[0].id,action:'sell',payment:{left:0,right:0,bank:0},value:me.coins<2?4:1});
  if(s.canSellFleet)options.push({cardId:s.hand[0].id,action:'sell',sellFleet:true,payment:{left:0,right:0,bank:0},value:me.fleets.yellow>=1?3:1.5});
  const best=options.filter(x=>s.phase!=='recruitExtra'||x.action==='build').sort((a,b)=>b.value-a.value)[0];
  return {type:'choose',epoch:s.epoch,cardId:best.cardId,action:best.action,payment:best.payment,...(best.naval?{naval:best.naval}:{}),...(best.stage!==undefined?{stage:best.stage}:{}),...(best.sellFleet?{sellFleet:true}:{})};
}};
