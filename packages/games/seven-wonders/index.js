import { ensure } from '../../platform/errors.js';
import { CARDS, WONDERS, RESOURCES, card, stages, effects } from './data.js';
import { sevenWondersBot } from './bot.js';
const clone = value => structuredClone(value);
export const neighbors = (state, player) => {
  const i=state.players.findIndex(p=>p.id===player.id), n=state.players.length;
  return [state.players[(i+1)%n],state.players[(i+n-1)%n]]; // left, right
};
const owns = (p,id) => p.cards.some(c=>card(c).kind===card(id).kind);
export const strength = p => effects(p).reduce((n,e)=>n+(e.shields??0),0);
export function production(p, tradeable=false) {
  return [[WONDERS[p.wonder].resource],...p.cards.filter(id=>!tradeable||['brown','grey'].includes(card(id).color)).flatMap(id=>card(id).effect.production??[]).map(r=>[...r]),...(!tradeable?stages(p).slice(0,p.stages).flatMap(s=>s.effect.production??[]).map(r=>[...r]):[])];
}
function shuffle(values,random) {
  const a=[...values];
  for(let i=a.length-1;i>0;i--) { const r=random();ensure(Number.isFinite(r)&&r>=0&&r<1,'随机源无效');const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
// Assign every production slot at most once. Keep distinct left/right payments,
// including optional purchases, so the player can choose who receives their coins.
export function paymentPlans(state,p,cost,explain=false) {
  const bank=cost.coins??0;
  if(p.coins<bank) return [];
  const demand=[...cost.resources], types=Object.keys(RESOURCES);
  const target=types.map(r=>demand.filter(x=>x===r).length);
  const [left,right]=neighbors(state,p), discounts=effects(p).map(e=>e.discount);
  const price=(r,side)=>discounts.includes('wsoc'.includes(r)?side:'goods')?1:2;
  const slots=[...production(p).map(resources=>({resources,side:'own'})),...production(left,true).map(resources=>({resources,side:'left'})),...production(right,true).map(resources=>({resources,side:'right'}))];
  let possible=new Map([['0,0,0,0,0,0,0:0:0',{counts:types.map(()=>0),left:0,right:0,...(explain?{sources:[]}: {})}]]);
  for(const slot of slots) {
    const next=new Map(possible);
    for(const item of possible.values()) for(const r of slot.resources) {
      const i=types.indexOf(r);if(item.counts[i]>=target[i])continue;
      const counts=[...item.counts];counts[i]++;
      const l=item.left+(slot.side==='left'?price(r,'left'):0), rr=item.right+(slot.side==='right'?price(r,'right'):0);
      if(l+rr+bank>p.coins)continue;
      next.set(`${counts}:${l}:${rr}`,{counts,left:l,right:rr,...(explain?{sources:[...item.sources,{resource:r,source:slot.side}]}:{})});
    }
    possible=next;
  }
  return [...possible.values()].filter(x=>x.counts.every((c,i)=>c===target[i])).map(({left,right,sources})=>({left,right,bank,reason:cost.resources||bank?'payment':'free',...(explain?{sources}: {})})).sort((a,b)=>(a.left+a.right)-(b.left+b.right)||a.left-b.left);
}
export function buildQuote(state,p,id,explain=false) {
  const c=card(id);
  if(owns(p,id))return {plans:[],reason:'已经建有同名建筑'};
  if(p.cards.some(id=>c.from.includes(card(id).kind)))return {plans:[{left:0,right:0,bank:0,reason:'chain'}],reason:''};
  const es=effects(p);
  if(es.some(e=>e.freeColor)&&!p.cards.some(id=>card(id).color===c.color)||es.some(e=>e.freeFirst)&&state.round===1||es.some(e=>e.freeLast)&&state.round===6) return {plans:[{left:0,right:0,bank:0,reason:'wonder'}],reason:''};
  const plans=paymentPlans(state,p,c.cost,explain);
  return {plans,reason:plans.length?'':'资源不足或钱币不够'};
}
function wonderQuote(state,p,explain=false) {
  const next=stages(p)[p.stages];
  if(!next)return {plans:[],reason:'奇迹已全部完成'};
  const plans=paymentPlans(state,p,next.cost,explain);
  return {plans,reason:plans.length?'':'资源不足或钱币不够',stage:p.stages+1};
}
export function scienceScore(counts,wild=0) {
  if(!wild)return counts.reduce((n,c)=>n+c*c,0)+7*Math.min(...counts);
  return Math.max(...counts.map((_,i)=>scienceScore(counts.map((c,j)=>c+Number(i===j)),wild-1)));
}
function quantity(state,p,rule) {
  const ns=neighbors(state,p), group=rule.scope==='all'?[p,...ns]:rule.scope==='neighbors'?ns:[p];
  if(rule.color==='stages')return group.reduce((n,x)=>n+x.stages,0);
  const colors=Array.isArray(rule.color)?rule.color:[rule.color];
  return group.reduce((n,x)=>n+x.cards.filter(id=>colors.includes(card(id).color)).length,0);
}
export function scores(state) {
  return state.players.map(p=>{
    const result={id:p.id,treasury:Math.floor(p.coins/3),military:p.military.reduce((a,b)=>a+b,0),wonder:0,blue:0,yellow:0,green:0,purple:0};
    const counts=[0,0,0];let wild=0;
    for(const id of p.cards) {
      const c=card(id),e=c.effect;
      result[c.color==='blue'?'blue':c.color==='purple'?'purple':'yellow']+=(e.points??0)+(e.scoring?quantity(state,p,e.scoring)*e.scoring.points:0)+(e.complete&&p.stages===stages(p).length?e.complete:0);
      if(Number.isInteger(e.science))counts[e.science]++;wild+=e.wild??0;
    }
    for(const s of stages(p).slice(0,p.stages)){result.wonder+=s.effect.points??0;wild+=s.effect.wild??0;}
    result.green=scienceScore(counts,wild); result.science={counts,wild};
    result.total=['treasury','military','wonder','blue','yellow','green','purple'].reduce((n,key)=>n+result[key],0);
    return result;
  });
}
function deal(state) {
  const deck=state.decks[state.age-1];
  state.players.forEach((p,i)=>{p.hand=deck.slice(i*7,(i+1)*7);});
  state.decks[state.age-1]=[];state.phase='draft';state.round=1;state.epoch++;
}
function create(ids,options={},random) {
  ensure(Array.isArray(ids)&&ids.length>=3&&ids.length<=7&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&id),'需要 3–7 位不同玩家');
  ensure(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(k=>k==='side')&&['choose','day','night'].includes(options.side??'choose'),'奇迹面选项无效');
  ensure(typeof random==='function','游戏需要注入随机源');
  const wonders=shuffle(Object.keys(WONDERS),random);
  const decks=[1,2,3].map(age=>{
    let cards=Object.values(CARDS).filter(c=>c.age===age&&c.color!=='purple').flatMap(c=>c.copies.filter(n=>n<=ids.length).map((_,i)=>`${c.key}@${i}`));
    if(age===3)cards.push(...shuffle(Object.values(CARDS).filter(c=>c.color==='purple'),random).slice(0,ids.length+2).map(c=>`${c.key}@0`));
    ensure(cards.length===7*ids.length,'时代牌数量错误');return shuffle(cards,random);
  });
  const state={phase:'setup',age:1,round:1,epoch:0,players:ids.map((id,i)=>({id,wonder:wonders[i],side:options.side&&options.side!=='choose'?options.side:null,coins:3,cards:[],stages:0,military:[],hand:[],buried:[]})),decks,pending:{},discard:[],reviveQueue:[],turnEffects:[],resume:null,lastActions:[],ageResults:[],winners:[]};
  if(state.players.every(p=>p.side))deal(state);
  return state;
}
function publicCard(id) {const c=card(id);return {id,key:c.key,kind:c.kind,name:c.name,age:c.age,color:c.color,cost:clone(c.cost),effect:clone(c.effect),text:c.text,from:[...c.from]};}
function cardForView(id) {const c=card(id);return {...publicCard(id),chains:{from:Object.values(CARDS).filter(x=>c.from.includes(x.kind)).map(x=>({kind:x.kind,name:x.name,age:x.age})),to:Object.values(CARDS).filter(x=>x.from.includes(c.kind)).map(x=>({kind:x.kind,name:x.name,age:x.age}))}};}

// Preview only the viewer's proposed action against public, revealed cities.
// Other players' pending choices, hands, decks and future trades never enter it.
function actionPreview(state,p,kind,id) {
  const effect=kind==='wonder'?stages(p)[p.stages]?.effect:card(id).effect;
  if(!effect)return null;
  const future={...p,cards:kind==='build'?[...p.cards,id]:p.cards,stages:p.stages+Number(kind==='wonder')};
  const next={...state,players:state.players.map(x=>x.id===p.id?future:x)};
  const before=scores(state).find(x=>x.id===p.id),after=scores(next).find(x=>x.id===p.id);
  return {production:production(future).map(r=>r.join('')),shields:strength(future),science:{...after.science,points:after.green},scienceBefore:before.green,
    pointsDelta:['wonder','blue','yellow','purple'].reduce((n,k)=>n+after[k]-before[k],0),
    income:(effect.coins??0)+(effect.income?quantity(next,future,effect.income)*effect.income.coins:0),incomeVariable:!!effect.income&&effect.income.scope!=='own',stages:future.stages};
}
function quoteForView(state,p,quote,cost) {
  if(quote.plans.length||quote.reason!=='资源不足或钱币不够')return quote;
  const unrestricted=paymentPlans(state,{...p,coins:cost.coins+cost.resources.length*2},cost);
  return {...quote,reason:unrestricted.length?`还差 ${unrestricted[0].left+unrestricted[0].right+unrestricted[0].bank-p.coins} 钱币`:'资源组合不足'};
}
function activate(state,p,e) {
  if(e.coins||e.income)state.turnEffects.push({id:p.id,effect:clone(e)});
  if(e.revive)state.reviveQueue.push(p.id);
}
function reviveChoices(state,p){return state.discard.filter(id=>!owns(p,id));}
function finishAge(state) {
  const military=state.players.map(p=>({id:p.id,shields:strength(p),tokens:neighbors(state,p).map(n=>strength(p)===strength(n)?0:strength(p)>strength(n)?state.age*2-1:-1)}));
  military.forEach(r=>state.players.find(p=>p.id===r.id).military.push(...r.tokens.filter(Boolean)));
  state.ageResults.push({age:state.age,military});
  if(state.age===3) {
    state.phase='finished';state.epoch++;
    const ranked=scores(state).sort((a,b)=>b.total-a.total||state.players.find(p=>p.id===b.id).coins-state.players.find(p=>p.id===a.id).coins);
    const best=ranked[0],coins=state.players.find(p=>p.id===best.id).coins;
    state.winners=ranked.filter(r=>r.total===best.total&&state.players.find(p=>p.id===r.id).coins===coins).map(r=>r.id);
  } else {state.age++;deal(state);}
}
function completeTurn(state) {
  for(const {id,effect:e} of state.turnEffects) {
    const p=state.players.find(p=>p.id===id);p.coins+=(e.coins??0)+(e.income?quantity(state,p,e.income)*e.income.coins:0);
  }
  state.turnEffects=[];
  const resume=state.resume;state.resume=null;
  if(resume==='pass') {
    const hands=state.players.map(p=>p.hand), direction=state.age===2?-1:1, n=state.players.length;
    state.players.forEach((p,i)=>{p.hand=hands[(i-direction+n)%n];});
    state.round++;state.phase='draft';state.epoch++;
  } else if(resume==='extra'&&state.players.some(p=>p.hand.length)) {
    state.round=7;state.phase='extra';state.epoch++;
  } else finishAge(state);
}
function nextRevive(state) {
  while(state.reviveQueue.length) {
    const p=state.players.find(p=>p.id===state.reviveQueue[0]);
    if(reviveChoices(state,p).length){state.phase='revive';state.epoch++;return;}
    state.reviveQueue.shift();
  }
  completeTurn(state);
}
function resolve(state) {
  const extra=state.phase==='extra';state.lastActions=[];
  // Validate all choices against start-of-turn cities before any effects or income.
  const choices=state.players.filter(p=>p.hand.length).map(p=>({p,choice:state.pending[p.id]}));
  for(const {p,choice:c} of choices) {
    const [left,right]=neighbors(state,p);p.coins-=c.payment.left+c.payment.right+c.payment.bank;
    left.coins+=c.payment.left;right.coins+=c.payment.right;
  }
  for(const {p,choice:c} of choices) {
    p.hand=p.hand.filter(id=>id!==c.cardId);
    if(c.action==='build') {p.cards.push(c.cardId);activate(state,p,card(c.cardId).effect);}
    if(c.action==='wonder') {const s=stages(p)[p.stages++];p.buried.push(c.cardId);activate(state,p,s.effect);}
    if(c.action==='sell') {state.discard.push(c.cardId);activate(state,p,{coins:3});}
    state.lastActions.push({id:p.id,action:c.action,...(c.action==='build'?{card:publicCard(c.cardId)}:{}),...(c.action==='wonder'?{stage:p.stages}:{})});
  }
  state.pending={};
  if(extra) state.resume='age';
  else if(state.round===6) {
    for(const p of state.players) if(!effects(p).some(e=>e.double)){state.discard.push(...p.hand);p.hand=[];}
    state.resume='extra';
  } else state.resume='pass';
  nextRevive(state);
}
function apply(input,playerId,command) {
  ensure(command&&typeof command==='object'&&!Array.isArray(command),'行动格式无效');
  const source=input.players.find(p=>p.id===playerId);ensure(source,'你不在此对局',403);
  ensure(input.phase!=='finished','本局已结束');
  ensure(command.epoch===input.epoch,'牌桌已进入下一步，请重新选择',409);
  const state=clone(input),p=state.players.find(p=>p.id===playerId);
  if(state.phase==='setup') {
    ensure(command.type==='side'&&['day','night'].includes(command.side),'请选择日面或夜面');
    ensure(!p.side,'你已选择奇迹面');p.side=command.side;
    if(state.players.every(p=>p.side))deal(state);
  } else if(state.phase==='revive') {
    ensure(state.reviveQueue[0]===playerId,'等待其他玩家回收建筑',403);
    ensure(command.type==='revive'&&reviveChoices(state,p).includes(command.cardId),'请选择可回收的建筑');
    p.cards.push(command.cardId);state.discard=state.discard.filter(id=>id!==command.cardId);activate(state,p,card(command.cardId).effect);
    state.lastActions.push({id:p.id,action:'revive',card:publicCard(command.cardId)});state.reviveQueue.shift();nextRevive(state);
  } else {
    ensure(command.type==='choose'&&['build','wonder','sell'].includes(command.action),'请选择建造、奇迹或出售');
    ensure(p.hand.length,'本回合无需你行动');ensure(!state.pending[playerId],'你已确认，等待其他玩家',409);
    ensure(p.hand.includes(command.cardId),'这张牌不在你的手中');
    const quote=command.action==='build'?buildQuote(input,source,command.cardId):command.action==='wonder'?wonderQuote(input,source):{plans:[{left:0,right:0,bank:0,reason:'sell'}]};
    ensure(quote.plans.length,quote.reason||'无法执行');
    const requested=command.payment??quote.plans[0];
    const payment=quote.plans.find(x=>x.left===requested.left&&x.right===requested.right&&x.bank===requested.bank);
    ensure(payment,'付款方案无效');
    state.pending[playerId]={cardId:command.cardId,action:command.action,payment:clone(payment)};
    if(state.players.filter(p=>p.hand.length).every(p=>state.pending[p.id]))resolve(state);
  }
  return state;
}
function view(state,viewerId) {
  const me=state.players.find(p=>p.id===viewerId);ensure(me,'你不在此对局',403);
  const choosing=['draft','extra'].includes(state.phase)&&me.hand.length>0&&!state.pending[viewerId];
  const active=state.phase==='revive'&&state.reviveQueue[0]===viewerId;
  return {phase:state.phase,age:state.age,round:state.round,epoch:state.epoch,
    players:state.players.map(p=>({id:p.id,wonder:p.wonder,wonderName:WONDERS[p.wonder].name,subtitle:WONDERS[p.wonder].subtitle,resource:WONDERS[p.wonder].resource,side:p.side,coins:p.coins,cards:p.cards.map(cardForView),stages:p.stages,stageList:clone(stages(p)),military:[...p.military],shields:strength(p),production:production(p).map(r=>r.join('')),tradeable:production(p,true).map(r=>r.join('')),submitted:!!state.pending[p.id],handCount:p.hand.length})),
    setupChoices:state.phase==='setup'&&!me.side?['day','night'].map(side=>({side,stages:clone(WONDERS[me.wonder][side])})):[],neighbors:neighbors(state,me).map(p=>p.id),hand:me.hand.map(id=>({...cardForView(id),build:choosing?quoteForView(state,me,buildQuote(state,me,id,true),card(id).cost):{plans:[],reason:'等待结算'},preview:choosing?actionPreview(state,me,'build',id):null})),
    wonderBuild:choosing?{...quoteForView(state,me,wonderQuote(state,me,true),stages(me)[me.stages]?.cost??{coins:0,resources:''}),preview:actionPreview(state,me,'wonder') }:{plans:[],reason:'等待结算'},pending:state.pending[viewerId]?clone(state.pending[viewerId]):null,
    canChoose:!!choosing,reviveId:state.phase==='revive'?state.reviveQueue[0]:null,discardChoices:active?reviveChoices(state,me).map(id=>({...cardForView(id),preview:actionPreview(state,me,'build',id)})):[],
    lastActions:clone(state.lastActions),ageResults:clone(state.ageResults),scores:scores(state),winners:[...state.winners]};
}
export const sevenWonders={manifest:{id:'seven-wonders',title:'七大奇迹',rulesVersion:'2020 second edition · base · FAQ 2026-10',stateVersion:1,minPlayers:3,maxPlayers:7},create,apply,view,isFinished:s=>s.phase==='finished',bot:sevenWondersBot};

