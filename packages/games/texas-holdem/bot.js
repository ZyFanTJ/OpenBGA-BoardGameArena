import {evaluate} from './cards.js';
/** Deterministic practice opponent. Reads exactly the same projection as a player. */
export function decide(v,id){
  if(v.phase!=='betting'||v.turnId!==id)return null;
  const l=v.legal,p=v.players.find(p=>p.id===id),[a,b]=v.hand;
  const strength=v.board.length>=3?evaluate([...v.hand,...v.board]).score[0]:a.rank===b.rank?2+(a.rank>=10?1:0):a.rank>=11&&b.rank>=10?2:a.suit===b.suit?1:0;
  const salt=(v.handNumber*13+v.sequence*7+a.rank+b.rank)%11;
  if(l.raise&&strength>=2&&v.currentBet<=v.bigBlind*4&&salt<6){const amount=Math.min(l.maxRaiseTo,Math.max(l.fullRaiseTo,v.currentBet+Math.floor((v.pot+l.callAmount)*.6)));return {type:'raise',amount};}
  if(l.check)return {type:'check'};
  if(l.call&&(strength>=3||l.callAmount<=Math.max(v.bigBlind,strength>=1?p.stack*.2:p.stack*.04)||salt===0))return {type:'call'};
  return {type:'fold'};
}
