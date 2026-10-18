// Strategy receives only the same player-specific projection as a human.
const total=p=>p.left+p.right+p.bank;
function value(c,me,s) {
  const e=c.effect;let score=(e.points??0)+(e.coins??0)*.45+(e.shields??0)*(s.age===3?2:2.5);
  if(e.production)score+=e.production.length*(s.age===1?5: s.age===2?3:0.5)+e.production.reduce((n,r)=>n+r.length,0)*.3;
  if(Number.isInteger(e.science)){const counts=s.scores.find(p=>p.id===me.id).science.counts;score+=3+2*counts[e.science]+(counts.every((n,i)=>i===e.science||n>0)?4:0);}
  if(e.discount)score+=s.age===1?4:1;
  if(e.income)score+=2+me.cards.filter(c=>c.color===e.income.color).length*e.income.coins*.45;
  if(e.scoring)score+=3+(e.scoring.scope==='own'?me.cards.filter(c=>c.color===e.scoring.color).length:2)*e.scoring.points;
  if(e.wild)score+=7;
  if(e.complete)score+=me.stages===me.stageList.length?7:1;
  return score;
}
export const sevenWondersBot={observe:()=>({}),decide(s,id) {
  const me=s.players.find(p=>p.id===id);
  if(s.phase==='setup')return me.side?null:{type:'side',side:'day',epoch:s.epoch};
  if(s.phase==='revive')return s.reviveId===id&&s.discardChoices.length?{type:'revive',cardId:[...s.discardChoices].sort((a,b)=>value(b,me,s)-value(a,me,s))[0].id,epoch:s.epoch}:null;
  if(!s.canChoose)return null;
  const options=s.hand.flatMap(c=>c.build.plans.length?[{cardId:c.id,action:'build',payment:c.build.plans[0],value:value(c,me,s)-total(c.build.plans[0])*.7}]:[]);
  if(s.wonderBuild.plans.length) {
    const stage=me.stageList[me.stages],least=[...s.hand].sort((a,b)=>value(a,me,s)-value(b,me,s))[0];
    options.push({cardId:least.id,action:'wonder',payment:s.wonderBuild.plans[0],value:value(stage,me,s)+(stage.effect.revive?5:0)+(stage.effect.freeColor?7:0)+(stage.effect.double?7:0)-total(s.wonderBuild.plans[0])*.7});
  }
  options.push({cardId:[...s.hand].sort((a,b)=>value(a,me,s)-value(b,me,s))[0].id,action:'sell',payment:{left:0,right:0,bank:0},value:me.coins<2?4:1});
  const best=options.sort((a,b)=>b.value-a.value)[0];
  return {type:'choose',epoch:s.epoch,cardId:best.cardId,action:best.action,payment:best.payment};
}};
