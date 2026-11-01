import {ensure} from '../../platform/errors.js';
import {BOUNTIES,CARDS,ENEMIES,DIFFICULTIES} from './v2-catalog.js';
import {player,spend,shuffled,availableRelics,makeOffer,emit} from './v2-state.js';
const open=b=>['warning','active','failed'].includes(b.status);
export function bountyCommand(s,p,c){
 if(c.type==='signBounty'){
  const d=BOUNTIES[c.kind];ensure(d&&s.wave>=d.wave&&s.wave<=15,'当前不能接这份悬赏');ensure(d.rewards.includes(c.reward),'请选择奖励');ensure(p.bountiesUsed<2,'本局悬赏次数已用完');ensure(!s.bounties.some(b=>b.owner===p.id&&open(b)),'先解决已有悬赏');ensure(s.bounties.filter(open).length<Math.min(2,s.players.length),'全队悬赏名额已满');ensure(s.enemies.length<s.cap,'全图怪物数量已满');ensure(p.bountyCancelWave!==s.wave,'本波取消后不能再次接取');spend(p,d.deposit);
  const b={id:s.nextBountyId++,owner:p.id,kind:c.kind,reward:c.reward,wave:s.wave,status:'warning',spawnAt:s.time+8000,cancelUntil:s.time+3000,deposit:d.deposit,depositLost:false,leaked:false,guardQueue:[],choices:c.reward==='card'?shuffled(s,Object.keys(CARDS).filter(k=>CARDS[k].rarity===2)).slice(0,3):c.reward==='relic'?availableRelics(s,p):[],hp:Math.round(1100*Math.pow(1.17,s.wave-1)*DIFFICULTIES[s.difficulty].hp*d.hp*(1+.35*(s.players.length-1))),batchFactor:1+.2*(s.players.length-1)};
  s.bounties.push(b);emit(s,{type:'bountySign',owner:p.id,kind:c.kind,sector:p.sector});return true;
 }
 if(c.type==='cancelBounty'){
  const b=s.bounties.find(b=>b.id===c.bounty);ensure(b&&b.owner===p.id&&b.status==='warning'&&s.time<=b.cancelUntil,'已经无法撤回');b.status='cancelled';p.gold+=b.deposit;p.stats.invested-=b.deposit;p.bountyCancelWave=s.wave;return true;
 }
 return false;
}
function queue(s,b,count,delay=0,entry=false){let at=Math.max(s.time+delay,(b.guardQueue.at(-1)?.at??(s.time-750))+750);for(let i=0;i<Math.ceil(count*b.batchFactor);i++){b.guardQueue.push({at,entry});at+=750;}}
export function tickBounties(s,spawn){
 for(const b of s.bounties){
  const d=BOUNTIES[b.kind],p=player(s,b.owner);
  if(b.status==='warning'&&s.time>=b.spawnAt){const e=spawn(s,b.kind,p.sector,{hp:b.hp,maxHp:b.hp,bounty:b.id,origin:p.sector,wave:b.wave});b.enemy=e.id;b.status='active';b.deadline=s.time+d.limit;b.nextAdd=s.time+d.interval;p.bountiesUsed++;queue(s,b,d.initial,0,true);emit(s,{type:'bountyStart',owner:p.id,kind:b.kind,sector:p.sector});}
  if(!['active','failed'].includes(b.status))continue;const body=s.enemies.find(e=>e.id===b.enemy&&e.hp>0);if(!body)continue;
  if(s.time>=b.nextAdd){queue(s,b,d.batch);b.nextAdd=s.time+Math.round(d.interval*(b.status==='failed'?2/3:1));}
  while(b.guardQueue[0]?.at<=s.time){const next=b.guardQueue.shift();spawn(s,'guard',next.entry?p.sector:body.sector,{d:next.entry?0:body.d,origin:p.sector,sourceBounty:b.id,wave:b.wave});}
 }
}
export function crossedBounty(s,e){
 if(!e.bounty)return;const b=s.bounties.find(b=>b.id===e.bounty);if(!b||b.leaked)return;b.leaked=true;b.depositLost=true;emit(s,{type:'bountyLeak',owner:b.owner,kind:b.kind,sector:e.sector});if(b.kind==='ancient')queue(s,b,BOUNTIES.ancient.initial,3000);
}
export function finishBounties(s){
 for(const b of s.bounties){
  if(!['active','failed'].includes(b.status))continue;const body=s.enemies.find(e=>e.id===b.enemy&&e.hp>0),p=player(s,b.owner),d=BOUNTIES[b.kind];
  if(!body){
   const success=b.status==='active'&&s.time<=b.deadline&&s.enemies.length<=s.cap;b.status='cleared';b.success=success;b.guardQueue=[];
   if(success){if(!b.depositLost){p.gold+=b.deposit;p.stats.invested-=b.deposit;}if(b.reward==='gold'){p.gold+=d.gold;p.stats.income+=d.gold;}else if(b.reward==='core')p.cores++;else if(b.reward==='card')makeOffer(s,p,'bountyCard',b.choices);else {const choices=b.choices.filter(id=>!p.relics.includes(id)&&p.bountyRelic!==id);if(choices.length)makeOffer(s,p,'bountyRelic',choices);else p.cores++;}
    const others=s.players.filter(x=>x.id!==p.id);for(let i=0;i<others.length;i++){const amount=Math.floor(d.team/others.length)+(i<d.team%others.length?1:0);others[i].gold+=amount;others[i].stats.income+=amount;}p.stats.bounties++;emit(s,{type:'bountyWin',owner:p.id,kind:b.kind,sector:p.sector});
   }else emit(s,{type:'bountyClear',owner:p.id,kind:b.kind,sector:p.sector});
  }else if(b.status==='active'&&s.time>=b.deadline){b.status='failed';b.depositLost=true;body.speed*=1.2;b.nextAdd=Math.min(b.nextAdd,s.time+Math.round(d.interval*2/3));emit(s,{type:'bountyFail',owner:p.id,kind:b.kind,sector:body.sector});}
 }
}
