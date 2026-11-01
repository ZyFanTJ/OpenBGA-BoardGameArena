import {apply,legal,actor,sets} from './engine.js';
import {deckFor,flip} from './deck.js';

// Memory contains only publicly revealed moves. A reconnect may forget; it never
// reconstructs private cards from the authoritative state.
function observe(v,id,previous){
 if(previous?.round===v.round&&previous.sequence===v.sequence)return previous;
 const m=previous?.round===v.round&&previous.sequence===v.sequence-1?structuredClone(previous):{round:v.round,hands:{},discard:[]};
 for(const event of v.events??[]){
  const h=m.hands[event.playerId]??={};
  if(event.type==='rotate')for(const key of Object.keys(h))h[key]=flip(h[key]);
  if(['play','add'].includes(event.type))for(const c of event.cards)delete h[c.id];
  if(['return','take'].includes(event.type))for(const c of event.cards)h[c.id]={...c};
  if(event.type==='discard')m.discard.push(...event.cards.map(c=>({...c})));
 }
 for(const p of v.players)if(p.out)m.hands[p.id]={};
 m.sequence=v.sequence;return m;
}
function choices(s,id){
 const l=legal(s,id);if(!l.act)return [];
 const hand=s.players.find(p=>p.id===id).hand,moves=[];
 for(const {value,count} of l.plays){
  const cards=hand.filter(c=>c.value===value);
  // Retain distinct reverse-value structures; duplicate physical cards are equivalent.
  const seen=new Set();let emitted=0;
  function choose(start,picked){
   if(picked.length===count){const key=picked.map(c=>c.reverse).sort((a,b)=>a-b).join(',');if(!seen.has(key)){seen.add(key);moves.push({type:'play',cards:picked.map(c=>c.id)});emitted++;}return;}
   for(let i=start;i<=cards.length-(count-picked.length)&&emitted<24;i++)choose(i+1,[...picked,cards[i]]);
  }choose(0,[]);
 }
 for(const t of l.adds){const seen=new Set();for(const c of hand.filter(c=>c.value===t.value))if(!seen.has(c.reverse)){seen.add(c.reverse);moves.push({type:'add',playerId:t.playerId,area:t.area,card:c.id});}}
 for(const t of l.takes)moves.push({type:'take',playerId:t.playerId,area:t.area});
 moves.push({type:'rotate'});return moves;
}
const groupCost=hand=>{const groups=new Map();for(const c of hand)groups.set(c.value,(groups.get(c.value)??0)+1);return groups.size*2.8+hand.length*.75-[...groups.values()].reduce((a,n)=>a+Math.max(0,n-1)*.35,0);};
function value(s,id){
 const p=s.players.find(p=>p.id===id),rivals=s.players.filter(p=>p.id!==id&&!p.out);
 if(s.phase==='finished')return s.winners.includes(id)?10000:-10000;
 let n=p.score*150+(p.out?160:0)-groupCost(p.hand)*5;
 for(const q of rivals)n+=groupCost(q.hand)*1.6-q.score*35-(q.hand.length<=2?18:0);
 for(const t of sets(s))if(t.playerId===id)n+=t.size*1.1+t.value*.2;
 return n;
}
function ranked(s,id){return choices(s,id).map(cmd=>{const next=apply(s,id,cmd);return {cmd,next,score:value(next,id)-(cmd.type==='rotate'?3:cmd.type==='take'?1.5:0)};}).sort((a,b)=>b.score-a.score);}
function quickRanked(s,id){
 const p=s.players.find(p=>p.id===id),table=sets(s);
 return choices(s,id).map(cmd=>{
  let hand=p.hand,bonus=0,size=0;
  if(cmd.type==='rotate'){hand=hand.map(flip);bonus-=3;}
  if(cmd.type==='take'){const t=table.find(t=>t.playerId===cmd.playerId&&t.area===cmd.area);hand=[...hand,...t.cards.map(flip)];bonus-=2;}
  if(cmd.type==='play'){hand=hand.filter(c=>!cmd.cards.includes(c.id));size=cmd.cards.length;bonus+=size*.7;}
  if(cmd.type==='add'){hand=hand.filter(c=>c.id!==cmd.card);size=table.find(t=>t.playerId===cmd.playerId&&t.area===cmd.area).size+1;bonus+=1;}
  if(size)for(const t of table.filter(t=>t.size===size)){
   if(t.playerId===id)hand=[...hand,...t.cards.map(flip)];
   else if(!s.players.find(p=>p.id===t.playerId).out)bonus+=t.size*2.5;
  }
  return {cmd,score:bonus-groupCost(hand)*5+(hand.length===0?1000:0)};
 }).sort((a,b)=>b.score-a.score);
}
function rng(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function world(v,id,m,random){
 const used=new Set();const reserve=c=>{used.add(c.id);return {...c};};
 const players=v.players.map(p=>({id:p.id,score:p.score,out:p.out,areas:p.areas.map(a=>a.map(reserve)),hand:p.id===id?p.hand.map(reserve):[]}));
 const discard=[];for(const c of m?.discard??[])if(!used.has(c.id))discard.push(reserve(c));
 for(const p of players)if(p.id!==id){const count=v.players.find(q=>q.id===p.id).handCount;for(const c of Object.values(m?.hands?.[p.id]??{}))if(!used.has(c.id)&&p.hand.length<count)p.hand.push(reserve(c));}
 const pool=deckFor(players.length).filter(c=>!used.has(c.id));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 for(const p of players)if(p.id!==id)while(p.hand.length<v.players.find(q=>q.id===p.id).handCount){const c=pool.pop();if(!c)throw new Error('DNUP public observation is inconsistent');p.hand.push(random()<.5?flip(c):c);}
 discard.push(...pool);
 return {players,discard,phase:v.phase,round:v.round,sequence:v.sequence,cursor:players.findIndex(p=>p.id===v.turnId),area:v.area,finishOrder:[...v.finishOrder],roundPoints:[...v.roundPoints],history:structuredClone(v.history),winners:[...v.winners],lastAction:v.lastAction,events:[]};
}
function decide(v,id,previous,options={}){
 if(!v.legal.act)return null;
 const m=observe(v,id,previous),random=rng(`${id}:${v.round}:${v.sequence}`),base=world(v,id,m,random),candidates=ranked(base,id);
 if(options.difficulty==='easy')return candidates[0].cmd;
 const expert=options.difficulty==='expert',samples=expert?18:8,depth=expert?6:3;
 // All actions use the same sampled worlds, so differences reflect choices,
 // not a lucky sample. A candidate never sees an actual opponent's hand.
 const shortlist=candidates.slice(0,expert?18:10).map(c=>({...c,total:0}));
 for(let sample=0;sample<samples;sample++){
  const s=world(v,id,m,random);
  for(const candidate of shortlist){let next=apply(s,id,candidate.cmd);
   for(let d=0;d<depth&&next.phase==='turn';d++){
    const nextId=actor(next),moves=quickRanked(next,nextId);
    // Sample a plausible near-best reply instead of assuming perfect opponents.
    const top=moves.filter(m=>m.score>=moves[0].score-3).slice(0,3);
    next=apply(next,nextId,top[Math.floor(random()*top.length)].cmd);
   }
   candidate.total+=value(next,id);
  }
 }
 shortlist.sort((a,b)=>(b.total/samples+b.score*.08)-(a.total/samples+a.score*.08));return shortlist[0].cmd;
}
export const dnupBot={observe,decide,difficulties:[{id:'smart',label:'策略玩家'},{id:'easy',label:'轻松入门'},{id:'expert',label:'翻转高手'}]};
