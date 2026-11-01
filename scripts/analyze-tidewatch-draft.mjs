// Acquisition-only model for docs/tidewatch-draft-design.md, not live game rules.
// Run: node scripts/analyze-tidewatch-draft.mjs [seeds]
// Does not simulate combat, bench management, gifts, recycling, relics or player skill.
import assert from 'node:assert/strict';

export const odds=[[100,0,0,0],[72,28,0,0],[45,43,12,0],[22,46,29,3],[10,36,49,5]];
const unlock=[1,1,3,6,10], upgrade=[0,80,120,180,240], names=['冲招募等级','均衡招募','停三级追合成'];
const schedules=[[1,1,3,6,10],[1,2,4,7,11],[1,2,4,99,99]];
const seeds=Number(process.argv[2]??20000);
assert(Number.isInteger(seeds)&&seeds>=100&&seeds<=200000);
for(const row of odds)assert.equal(row.reduce((a,b)=>a+b),100);

function rng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function roll(level,miss,random){
 let r=random()*100,tier=0;
 while(tier<3&&r>=odds[level-1][tier])r-=odds[level-1][tier++];
 // Higher-tier results satisfy every lower-tier guarantee. Only eligible rolls count.
 for(const [i,minLevel,limit] of [[1,2,4],[2,3,8],[3,5,miss[0]?20:12]])if(level>=minLevel&&miss[i]>=limit-1)tier=Math.max(tier,i);
 for(const [i,minLevel] of [[1,2],[2,3],[3,5]])if(level>=minLevel)miss[i]=tier>=i?0:miss[i]+1;
 if(tier===3)miss[0]=1;
 return tier;
}
for(const [level,tier,limit] of [[2,1,4],[3,2,8],[5,3,12]]){
 const miss=[0,0,0,0];let last=-1;
 for(let i=0;i<limit;i++)last=roll(level,miss,()=>0);
 assert(last>=tier,`hard pity level ${level}`);
}
{const miss=[1,0,0,0];let last;for(let i=0;i<20;i++)last=roll(5,miss,()=>0);assert.equal(last,3);}
// Recycling never creates gold by upgrading or evolving a stack.
const recycle=[6,10,16,24];
assert(recycle.every(x=>x<40));
assert(3*recycle[0]>recycle[1]);
assert(3*recycle[1]>recycle[2]);
assert(recycle[2]+2*recycle[1]>recycle[3]);

function run(seed,policy){
 const random=rng(seed),schedule=schedules[policy];
 let gold=120,level=1,paid=0,free=0,spent=0,firstOrange=null,level5=null;
 const miss=[0,0,0,0],counts=[0,0,0,0],orangeIds=[0,0,0,0],levelRolls=[0,0,0,0,0],snapshots={};
 const get=(wave)=>{const t=roll(level,miss,random);counts[t]++;levelRolls[level-1]++;if(t===3){orangeIds[Math.floor(random()*4)]++;firstOrange??=wave;}};
 for(let wave=1;wave<=18;wave++){
  while(level<5&&wave>=Math.max(unlock[level],schedule[level])&&gold>=upgrade[level]){gold-=upgrade[level];spent+=upgrade[level];level++;if(level===5)level5=wave;}
  // A free recruitment per wave, resolved after the chosen pre-wave upgrades.
  get(wave);free++;
  const next=level<5?Math.max(unlock[level],schedule[level]):99;
  const reserve=next<=wave+1?upgrade[level]:0;
  for(let n=0;n<(wave===18?100:policy===2?3:2)&&gold>=40+reserve;n++){gold-=40;paid++;get(wave);}
  assert(gold>=0);
  if([6,8,12,18].includes(wave))snapshots[wave]={orange:counts[3],firstOrange,level};
  if(wave<18)gold+=60+2*wave+([6,12].includes(wave)?50:0);
 }
 assert.equal(gold+spent+paid*40,1546);
 return {gold,level,paid,free,spent,firstOrange,level5,counts,orangeIds,levelRolls,snapshots};
}
const percentile=(array,p)=>[...array].sort((a,b)=>a-b)[Math.floor((array.length-1)*p)];
const mean=(a)=>a.reduce((x,y)=>x+y,0)/a.length;
const round=x=>Math.round(x*10000)/10000;
const reports=[];
for(let policy=0;policy<3;policy++){
 const rows=Array.from({length:seeds},(_,i)=>run(5101+i,policy));
 const acquired=rows.filter(r=>r.firstOrange!==null);
 const groups=Array.from({length:Math.floor(seeds/4)},(_,i)=>rows.slice(i*4,i*4+4));
 reports.push({policy:names[policy],seeds,
  economy:{paidDraws:rows[0].paid,freeDraws:rows[0].free,upgradeSpent:rows[0].spent,leftover:rows[0].gold,level5Wave:rows[0].level5,drawsByLevel:rows[0].levelRolls},
  meanRarityCounts:[0,1,2,3].map((_,i)=>round(mean(rows.map(r=>r.counts[i])))),
  recruitedOrangeByWave:Object.fromEntries([6,8,12,18].map(w=>[w,round(mean(rows.map(r=>Number(r.snapshots[w].orange>0))))])),
  firstOrangeWaveAmongRecipients:{p10:percentile(acquired.map(r=>r.firstOrange),.1)??null,p50:percentile(acquired.map(r=>r.firstOrange),.5)??null,p90:percentile(acquired.map(r=>r.firstOrange),.9)??null},
  orangeCountAt18:{p50:percentile(rows.map(r=>r.counts[3]),.5),p90:percentile(rows.map(r=>r.counts[3]),.9),p99:percentile(rows.map(r=>r.counts[3]),.99)},
  recruitedMatchingOrangePair:round(mean(rows.map(r=>Number(r.orangeIds.some(n=>n>=2))))),
  fourPlayerTeam:{samples:groups.length,anyRecruitedOrangeBy8:round(mean(groups.map(g=>Number(g.some(r=>r.snapshots[8].orange>0))))),totalOrangeP90:percentile(groups.map(g=>g.reduce((n,r)=>n+r.counts[3],0)),.9)},
 });
}
function drought(){
 // All natural rolls return white. Supply selections and cores are not random.
 const inventory={purple:1,blue:2,core:1}; // purple at end 4, blue supplies at end 3 & 7, core at end 8.
 inventory.purple--;inventory.blue-=2;inventory.core--;
 assert.deepEqual(inventory,{purple:0,blue:0,core:0});
 return {firstCraftedOrangeAvailableAfterWave:8,requires:'keep the selected purple and two matching blue supplies; consume one evolution core',combatSurvival:'not simulated'};
}
console.log(JSON.stringify({model:'draft-acquisition-v1',seedStart:5101,seedsPerPolicy:seeds,scope:'Acquisition model only; no combat/bench/recycling/gift simulation. No win-rate claims.',reports,drought:drought()},null,2));

