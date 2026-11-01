import {ensure} from '../../platform/errors.js';
import {makeDeck,shuffle,evaluate,compare} from './cards.js';
import {decide} from './bot.js';

const streets=['preflop','flop','turn','river'];
const alive=s=>s.players.filter(p=>!p.out&&!p.folded);
const canAct=p=>!p.out&&!p.folded&&p.stack>0;
const nextSeat=(s,from,predicate)=>{for(let i=1;i<=s.players.length;i++){const at=(from+i)%s.players.length;if(predicate(s.players[at]))return at;}return -1;};
const pot=s=>s.players.reduce((n,p)=>n+p.total,0);
const push=(s,type,id,amount=null)=>{s.log.push({hand:s.handNumber,street:s.street,type,id,amount});s.log=s.log.slice(-60);};
function pay(p,amount){const n=Math.min(p.stack,amount);p.stack-=n;p.bet+=n;p.total+=n;return n;}
function mayRaise(s,p){return s.players.some(q=>q.id!==p.id&&canAct(q))&&(p.actedAt===null||p.lastAction==='check'&&p.actedAt===0||s.currentBet-p.actedAt>=s.lastFullRaise);}
function legal(s,id){
  const p=s.players.find(p=>p.id===id),active=s.phase==='betting'&&s.players[s.turn]?.id===id&&p&&canAct(p);
  if(!active)return {fold:false,check:false,call:false,raise:false,allIn:false,callAmount:0,minRaiseTo:0,maxRaiseTo:0};
  const due=Math.max(0,s.currentBet-p.bet),max=p.bet+p.stack,min=s.currentBet+s.lastFullRaise,raise=mayRaise(s,p)&&max>s.currentBet;
  return {fold:true,check:due===0,call:due>0,raise,allIn:max<=s.currentBet||raise,callAmount:Math.min(due,p.stack),minRaiseTo:Math.min(min,max),maxRaiseTo:max,fullRaiseTo:min,raiseReopened:mayRaise(s,p)};
}
/** Contribution layers include folded money but exclude folded players from eligibility. */
export function potsFor(players){
  const levels=[...new Set(players.map(p=>p.total).filter(n=>n>0))].sort((a,b)=>a-b),pots=[];let previous=0;
  for(const level of levels){
    const contributors=players.filter(p=>p.total>=level),eligible=contributors.filter(p=>!p.folded&&!p.out).map(p=>p.id),amount=(level-previous)*contributors.length,last=pots.at(-1);
    // Folded money can create contribution levels, but never an additional contest.
    if(last&&last.eligible.length===eligible.length&&last.eligible.every((id,i)=>id===eligible[i]))last.amount+=amount;
    else pots.push({amount,eligible});
    previous=level;
  }
  return pots;
}
function refund(s){
  const sorted=[...s.players].sort((a,b)=>b.total-a.total),excess=sorted[0].total-sorted[1].total;
  if(excess>0){const p=sorted[0];p.total-=excess;p.bet=Math.max(0,p.bet-excess);p.stack+=excess;push(s,'refund',p.id,excess);return {id:p.id,amount:excess};}
  return null;
}
function finishHand(s,showdown){
  const returned=refund(s),live=alive(s),scores=Object.fromEntries(showdown?live.map(p=>[p.id,evaluate([...p.hole,...s.board])]):[]);
  const layers=potsFor(s.players),awards=Object.fromEntries(s.players.map(p=>[p.id,0]));
  const pots=layers.map(layer=>{
    const eligible=showdown?layer.eligible:live.map(p=>p.id);
    ensure(eligible.length,'底池缺少有效玩家');
    let winners=[eligible[0]];
    for(const id of eligible.slice(1)){const c=compare(scores[id].score,scores[winners[0]].score);if(c>0)winners=[id];else if(c===0)winners.push(id);}
    winners.sort((a,b)=>(s.players.findIndex(p=>p.id===a)-s.dealer-1+s.players.length)%s.players.length-(s.players.findIndex(p=>p.id===b)-s.dealer-1+s.players.length)%s.players.length);
    const share=Math.floor(layer.amount/winners.length),odd=layer.amount%winners.length;
    const payouts=winners.map((id,i)=>({id,amount:share+(i<odd?1:0)}));for(const p of payouts)awards[p.id]+=p.amount;
    return {...layer,winners,payouts};
  });
  for(const p of s.players){p.stack+=awards[p.id];if(!p.out&&p.stack===0){p.out=true;p.eliminatedHand=s.handNumber;}}
  s.roundResult={hand:s.handNumber,showdown,board:s.board.slice(),pots,returned,players:s.players.map(p=>({id:p.id,won:awards[p.id],net:p.stack-p.startStack,stack:p.stack,...(scores[p.id]?{cards:p.hole.slice(),best:scores[p.id]}:{})}))};
  s.history.push({hand:s.handNumber,pot:layers.reduce((n,p)=>n+p.amount,0),winners:s.players.filter(p=>awards[p.id]>0).map(p=>p.id)});
  s.phase=s.players.filter(p=>!p.out).length===1||s.handNumber>=s.options.handLimit?'finished':'roundEnd';
  s.pending=[];s.turn=-1;push(s,showdown?'showdown':'uncontested',null);
}
function dealStreet(s){
  s.street=streets[streets.indexOf(s.street)+1];s.burn.push(s.deck.pop());
  for(let i=0;i<(s.street==='flop'?3:1);i++)s.board.push(s.deck.pop());
  s.currentBet=0;s.lastFullRaise=s.bigBlind;
  for(const p of s.players){p.bet=0;p.actedAt=null;p.lastAction=null;}
  s.pending=s.players.filter(canAct).map(p=>p.id);s.turn=nextSeat(s,s.dealer,canAct);push(s,s.street,null);
}
function advance(s,from){
  if(alive(s).length===1){finishHand(s,false);return;}
  s.pending=s.pending.filter(id=>canAct(s.players.find(p=>p.id===id)));
  const actors=s.players.filter(canAct);
  // A lone stack can only answer an outstanding bet, never bet into a dry side pot.
  if(actors.length===1&&actors[0].bet>=Math.min(s.currentBet,Math.max(...alive(s).filter(p=>p!==actors[0]).map(p=>p.bet))))s.pending=[];
  if(s.pending.length){s.turn=nextSeat(s,from,p=>s.pending.includes(p.id));return;}
  if(actors.length<=1){while(s.street!=='river')dealStreet(s);finishHand(s,true);return;}
  if(s.street==='river'){finishHand(s,true);return;}
  dealStreet(s);
}
function startHand(s,random){
  const oldBig=s.bigSeat;
  s.handNumber++;s.bigBlind=s.options.bigBlind*2**Math.floor((s.handNumber-1)/5);s.smallBlind=s.bigBlind/2;
  if(s.handNumber>1){
    if(s.players.filter(p=>p.stack>0).length===2){s.bigSeat=nextSeat(s,oldBig,p=>p.stack>0);s.dealer=nextSeat(s,s.bigSeat,p=>p.stack>0);}
    else s.dealer=nextSeat(s,s.dealer,p=>p.stack>0);
  }
  const heads=s.players.filter(p=>p.stack>0).length===2;
  s.smallSeat=heads?s.dealer:nextSeat(s,s.dealer,p=>p.stack>0);s.bigSeat=nextSeat(s,s.smallSeat,p=>p.stack>0);
  s.deck=shuffle(makeDeck(),random);s.burn=[];s.board=[];s.roundResult=null;s.street='preflop';s.phase='betting';
  for(const p of s.players){p.hole=[];p.bet=0;p.total=0;p.folded=false;p.out=p.stack===0;p.actedAt=null;p.lastAction=null;p.startStack=p.stack;}
  for(let round=0;round<2;round++){let seat=s.dealer;for(let i=0;i<s.players.filter(p=>!p.out).length;i++){seat=nextSeat(s,seat,p=>!p.out);s.players[seat].hole.push(s.deck.pop());}}
  pay(s.players[s.smallSeat],s.smallBlind);pay(s.players[s.bigSeat],s.bigBlind);
  s.currentBet=s.bigBlind;s.lastFullRaise=s.bigBlind;s.pending=s.players.filter(canAct).map(p=>p.id);
  push(s,'deal',null);advance(s,s.bigSeat);
}
export const texasHoldem={
 manifest:{id:'texas-holdem',title:'德州扑克',rulesVersion:'no-limit-social-1',stateVersion:1,minPlayers:2,maxPlayers:8,defaultTurnSeconds:60},
 create(ids,options={},random){
  ensure(Array.isArray(ids)&&ids.length>=2&&ids.length<=8&&new Set(ids).size===ids.length,'德州扑克需要 2–8 位不同玩家');
  ensure(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(k=>['startingStack','bigBlind','handLimit'].includes(k)),'德州规则选项无效');
  const o={startingStack:options.startingStack??2000,bigBlind:options.bigBlind??20,handLimit:options.handLimit??20};
  ensure([1000,2000,5000].includes(o.startingStack)&&[20,50,100].includes(o.bigBlind)&&[10,20,40].includes(o.handLimit),'筹码、盲注或手数设置无效');
  const s={version:1,options:o,players:ids.map(id=>({id,stack:o.startingStack,hole:[],out:false,eliminatedHand:null})),dealer:Math.floor(random()*ids.length),bigSeat:0,smallSeat:0,handNumber:0,sequence:0,history:[],log:[]};
  startHand(s,random);return s;
 },
 apply(state,id,c,{random,isHost=false}){
  ensure(c&&typeof c.type==='string','动作无效');ensure(state.players.some(p=>p.id===id),'你不在本局',403);ensure(state.phase!=='finished','本局已结束');
  const s=structuredClone(state);
  if(c.type==='nextRound'){ensure(s.phase==='roundEnd'&&isHost,'只有房主可以开始下一手',403);startHand(s,random);s.sequence++;return s;}
  ensure(s.phase==='betting'&&s.players[s.turn]?.id===id,'还没轮到你');
  const p=s.players[s.turn],l=legal(s,id),from=s.turn;let type=c.type,amount=null;
  if(type==='allIn'){ensure(l.allIn,'当前不能全押');type=l.maxRaiseTo<=s.currentBet?'call':'raise';}
  if(type==='fold'){p.folded=true;}
  else if(type==='check'){ensure(l.check,'需要跟注或弃牌');}
  else if(type==='call'){ensure(l.call,'无需跟注');amount=pay(p,l.callAmount);}
  else if(type==='raise'){
    ensure(l.raise,'当前不能加注');const target=c.type==='allIn'?l.maxRaiseTo:c.amount;
    ensure(Number.isSafeInteger(target)&&target>s.currentBet&&target<=l.maxRaiseTo&&(target>=l.fullRaiseTo||target===l.maxRaiseTo),'加注总额无效，须达到最小加注或全押');
    const increase=target-s.currentBet;amount=pay(p,target-p.bet);
    if(increase>=s.lastFullRaise)s.lastFullRaise=increase;
    s.currentBet=target;s.pending=s.players.filter(q=>q.id!==id&&canAct(q)).map(q=>q.id);
  }else ensure(false,'未知动作');
  p.actedAt=s.currentBet;p.lastAction=c.type==='allIn'||p.stack===0&&type!=='fold'?'allIn':type;
  s.pending=s.pending.filter(x=>x!==id);push(s,p.lastAction,id,amount);advance(s,from);s.sequence++;return s;
 },
 view(s,id){
  const p=s.players.find(p=>p.id===id),ended=s.phase!=='betting',reveals=s.roundResult?.showdown?s.roundResult.players:[];
  return structuredClone({phase:s.phase,street:s.street,handNumber:s.handNumber,sequence:s.sequence,options:s.options,dealerId:s.players[s.dealer].id,smallId:s.players[s.smallSeat].id,bigId:s.players[s.bigSeat].id,smallBlind:s.smallBlind,bigBlind:s.bigBlind,turnId:s.players[s.turn]?.id??null,board:s.board,pot:ended?0:pot(s),pots:ended?[]:potsFor(s.players),currentBet:s.currentBet,hand:p?.hole??[],legal:legal(s,id),roundResult:s.roundResult,history:s.history,log:s.log,players:s.players.map(q=>({id:q.id,stack:q.stack,bet:q.bet,total:q.total,folded:q.folded,out:q.out,eliminatedHand:q.eliminatedHand,allIn:!q.out&&!q.folded&&q.stack===0,lastAction:q.lastAction,cards:reveals.find(r=>r.id===q.id)?.cards??q.hole.map(()=>null)}))});
 },
 spectatorView(s){return texasHoldem.view(s,null);},
 isFinished:s=>s.phase==='finished',
 turn:s=>s.phase==='betting'?{key:`holdem:${s.handNumber}:${s.sequence}`,players:[s.players[s.turn].id]}:null,
 timeout:(v,id)=>v.turnId===id?(v.legal.check?{type:'check'}:{type:'fold'}):null,
 bot:{observe:()=>({}),decide},
 result(s){const rows=[...s.players].sort((a,b)=>b.stack-a.stack||(b.eliminatedHand??Infinity)-(a.eliminatedHand??Infinity));return {winners:rows.filter(p=>p.stack===rows[0].stack).map(p=>p.id),rounds:s.handNumber,scoreDirection:'higher',players:rows.map(p=>({id:p.id,score:p.stack,rank:1+rows.filter(q=>q.stack>p.stack||q.stack===p.stack&&q.stack===0&&q.eliminatedHand>p.eliminatedHand).length,breakdown:[{label:'筹码净变化',value:p.stack-s.options.startingStack}]}))};},
};
