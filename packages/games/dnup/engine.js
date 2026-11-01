import {ensure} from '../../platform/errors.js';
import {deckFor,flip} from './deck.js';
const copy=x=>structuredClone(x);
export const actor=s=>s.players[s.cursor].id;
export const finishedRound=s=>s.phase!=='turn';
export const sets=s=>s.players.flatMap(p=>p.areas.flatMap((cards,area)=>cards.length?[{playerId:p.id,area,cards,value:cards[0].value,size:cards.length}]:[]));
function randomIndex(random,n){const r=random?.();ensure(Number.isFinite(r)&&r>=0&&r<1,'需要有效随机源');return Math.floor(r*n);}
function deal(s,random){
 const deck=deckFor(s.players.length).map(c=>randomIndex(random,2)?flip(c):c);
 for(let i=deck.length-1;i>0;i--){const j=randomIndex(random,i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 s.players.forEach(p=>{p.hand=[];p.areas=Array.from({length:s.players.length===2?2:1},()=>[]);p.out=false;});
 deck.forEach((c,i)=>s.players[i%s.players.length].hand.push(c));
 s.cursor=s.players.findIndex(p=>p.hand.some(c=>c.star));s.area=s.players.length===2?1:0;
 s.phase='turn';s.finishOrder=[];s.discard=[];s.roundPoints=s.players.map(()=>0);s.sequence++;s.lastAction='星标 1 / 5 的持有者先手';s.events=[];
}
export function create(ids,options={},random){
 ensure(Array.isArray(ids)&&ids.length>=2&&ids.length<=5&&new Set(ids).size===ids.length,'DNUP 支持 2–5 位不同玩家');
 ensure(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).length===0,'DNUP 使用官方基础规则');
 const s={players:ids.map(id=>({id,score:0,hand:[],areas:[],out:false})),round:1,sequence:0,cursor:0,area:0,phase:'turn',finishOrder:[],discard:[],roundPoints:[],history:[],winners:[],lastAction:'',events:[]};deal(s,random);return s;
}
export function legal(s,id){
 if(s.phase!=='turn'||actor(s)!==id)return {act:false,plays:[],adds:[],takes:[]};
 const hand=s.players.find(p=>p.id===id).hand,table=sets(s),plays=[];
 for(let value=1;value<=10;value++)for(let count=1;count<=hand.filter(c=>c.value===value).length;count++)if(table.every(t=>t.size!==count||value>t.value))plays.push({value,count});
 const opponents=table.filter(t=>t.playerId!==id);
 return {act:true,plays,adds:opponents.filter(t=>hand.some(c=>c.value===t.value)&&table.every(o=>o.size!==t.size+1||t.value>o.value)).map(t=>({playerId:t.playerId,area:t.area,value:t.value,size:t.size})),takes:opponents.map(t=>({playerId:t.playerId,area:t.area,size:t.size}))};
}
function discard(s,p,area){const cards=p.areas[area];if(cards.length){s.discard.push(...cards);s.events.push({type:'discard',playerId:p.id,cards:copy(cards)});p.areas[area]=[];}}
function collide(s,value,size){
 for(const t of sets(s).filter(t=>t.size===size)){
  ensure(value>t.value,'同张数组必须严格大于桌上的数字');const p=s.players.find(p=>p.id===t.playerId);
  if(p.out)discard(s,p,t.area);else{const cards=t.cards.map(flip);p.hand.push(...cards);p.areas[t.area]=[];s.events.push({type:'return',playerId:p.id,cards:copy(cards)});}
 }
}
function record(s){s.history.push({round:s.round,order:[...s.finishOrder],points:[...s.roundPoints]});}
function score(s,p){
 if(p.hand.length)return;
 p.out=true;s.finishOrder.push(p.id);const points=s.players.length===2?1:s.finishOrder.length===1?2:1;
 p.score+=points;s.roundPoints[s.players.indexOf(p)]=points;s.events.push({type:'out',playerId:p.id,points});
 if(p.score>=(s.players.length===2?2:4)){s.phase='finished';s.winners=[p.id];record(s);}
 else if(s.players.length===2||s.finishOrder.length===2){s.phase='roundEnd';record(s);}
}
function advance(s){
 if(s.players.length===2&&s.area===0)s.area=1;
 else{s.cursor=(s.cursor+1)%s.players.length;s.area=0;}
 while(s.players[s.cursor].out){s.players[s.cursor].areas.forEach((_,a)=>discard(s,s.players[s.cursor],a));s.cursor=(s.cursor+1)%s.players.length;}
 discard(s,s.players[s.cursor],s.area);
}
export function apply(state,id,cmd,context={}){
 ensure(cmd&&typeof cmd==='object'&&!Array.isArray(cmd),'无效行动');const s=copy(state);
 if(cmd.type==='nextRound'){ensure(s.phase==='roundEnd','本轮尚未结束');ensure(context.isHost,'只有房主可以开始下一轮');s.round++;deal(s,context.random);return s;}
 ensure(s.phase==='turn'&&actor(s)===id,'请等待你的回合');s.events=[];
 const p=s.players[s.cursor];
 if(cmd.type==='play'){
  ensure(Array.isArray(cmd.cards)&&cmd.cards.length>0&&new Set(cmd.cards).size===cmd.cards.length,'请选择不重复的手牌');
  const cards=cmd.cards.map(id=>p.hand.find(c=>c.id===id));ensure(cards.every(Boolean)&&cards.every(c=>c.value===cards[0].value),'只能打出自己手中的同值牌');
  p.hand=p.hand.filter(c=>!cmd.cards.includes(c.id));collide(s,cards[0].value,cards.length);p.areas[s.area]=cards;
  s.events.push({type:'play',playerId:id,area:s.area,cards:copy(cards)});s.lastAction=`打出 ${cards.length} 张 ${cards[0].value}`;
 }else if(cmd.type==='add'||cmd.type==='take'){
  const other=s.players.find(q=>q.id===cmd.playerId);ensure(other&&other!==p&&Number.isInteger(cmd.area)&&cmd.area>=0&&cmd.area<other.areas.length,'请选择对手的出牌区');
  const target=other.areas[cmd.area];ensure(target.length,'这个出牌区没有牌');
  if(cmd.type==='take'){const cards=target.map(flip);p.hand.push(...cards);other.areas[cmd.area]=[];s.events.push({type:'take',playerId:id,from:other.id,area:cmd.area,cards:copy(cards)});s.lastAction=`收回 ${cards.length} 张牌并旋转`;}
  else{const c=p.hand.find(c=>c.id===cmd.card);ensure(c&&c.value===target[0].value,'添牌数字必须与目标牌组相同');
   p.hand=p.hand.filter(x=>x.id!==c.id);collide(s,c.value,target.length+1);target.push(c);s.events.push({type:'add',playerId:id,to:other.id,area:cmd.area,cards:[copy(c)]});s.lastAction=`向对手牌组添入 1 张 ${c.value}`;}
 }else if(cmd.type==='rotate'){p.hand=p.hand.map(flip);s.events.push({type:'rotate',playerId:id});s.lastAction='整手牌旋转 180°';}
 else ensure(false,'未知游戏行动');
 s.sequence++;score(s,p);if(s.phase==='turn')advance(s);return s;
}
export function view(s,id){return {phase:s.phase,round:s.round,sequence:s.sequence,turnId:actor(s),area:s.area,players:s.players.map(p=>({id:p.id,score:p.score,out:p.out,handCount:p.hand.length,hand:p.id===id?copy(p.hand):null,areas:copy(p.areas)})),discardCount:s.discard.length,finishOrder:[...s.finishOrder],roundPoints:[...s.roundPoints],history:copy(s.history),winners:[...s.winners],lastAction:s.lastAction,events:copy(s.events),legal:legal(s,id)};}
