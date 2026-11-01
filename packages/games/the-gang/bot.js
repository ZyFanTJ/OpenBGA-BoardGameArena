import {makeDeck,evaluate,compare} from './cards.js';

const key=v=>`${v.heist}:${v.round}`;
const preflop=cards=>{const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a);return [ranks[0]===ranks[1]?1:0,...ranks];};
// Compare the current hand, not a hypothetical future board. Sampling is seeded
// solely from visible cards, so retries and server restarts make the same choice.
export function strength(view,id){
  const hand=view.players.find(p=>p.id===id)?.hand;
  if(hand?.length!==2)return .5;
  const known=[...hand,...view.board],deck=makeDeck().filter(c=>!known.some(k=>k.rank===c.rank&&k.suit===c.suit));
  const score=cards=>view.board.length?evaluate([...cards,...view.board]).score:preflop(cards);
  const mine=score(hand);let sum=0,count=0;
  // All possible opponent hands on the river; bounded deterministic sample earlier.
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){
    if(view.round<3&&(i*53+j)%7!==0)continue;
    const d=compare(mine,score([deck[i],deck[j]]));sum+=d>0?1:d===0?.5:0;count++;
  }
  return count?sum/count:.5;
}
export const gangBot={
  observe(view,id,previous,command){
    const memory=previous?.key===key(view)?{...previous}:{key:key(view),claims:0};
    if(command?.type==='take')memory.claims++;
    return memory;
  },
  decide(view,id,memory={}){
    const me=view.players.find(p=>p.id===id);if(!me||view.phase==='finished')return null;
    if(view.phase==='result')return view.ready.includes(id)?null:{type:'next'};
    if(me.chips[view.round]!==null)return null;
    const target=1+strength(view,id)*(view.players.length-1);
    const free=Array.from({length:view.players.length},(_,i)=>i+1).filter(n=>!view.players.some(p=>p.chips[view.round]===n));
    // One assertive claim per stage; after being displaced, accept a free chip.
    // This prevents bots repeatedly stealing the same chip and blocking humans.
    const desired=Math.round(target),owner=view.players.find(p=>p.chips[view.round]===desired);
    const canClaim=(memory.key===key(view)?memory.claims:0)===0&&owner&&Math.abs(target-desired)<.2;
    const chip=canClaim?desired:free.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b)[0];
    return chip?{type:'take',chip}:null;
  },
};
