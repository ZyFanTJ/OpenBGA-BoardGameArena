import {ensure} from '../../platform/errors.js';
import {CARDS,WONDERS,CHAIN_SYMBOLS,card,stages,builtStages,effects} from './data.js';
import {LEADERS} from './leaders.js';
import {ARMADA_CARDS,ISLANDS,SHIPYARDS,FLEET_COLORS,COMMERCIAL,BLUE_POINTS,RED_STRENGTH} from './armada.js';
import {neighbors,farNeighbors,owns,strength,production,paymentPlans,buildQuote,wonderQuote,availableStages,quantity,scores,totalPayment,commercial,navalStrength,navalResults} from './economy.js';
import {sevenWondersBot} from './bot.js';
export {neighbors,strength,production,paymentPlans,buildQuote,scores,scienceScore,navalResults} from './economy.js';
const clone=x=>structuredClone(x);
export function shuffle(values,random){const a=[...values];for(let i=a.length-1;i>0;i--){const r=random();ensure(Number.isFinite(r)&&r>=0&&r<1,'随机源无效');const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const expansions=s=>s.expansions??{leaders:false,armada:false,leaderExpert:false};
const turnCount=s=>expansions(s).armada?7:6;
const player=(s,id)=>s.players.find(p=>p.id===id);
const publicCard=id=>{const c=card(id);return {id,key:c.key,kind:c.kind,name:c.name,age:c.age,color:c.color,cost:clone(c.cost),effect:clone(c.effect),text:c.text,from:[...c.from],...(c.expansion?{expansion:c.expansion}:{}),...(c.level?{level:c.level}:{})};};
const chainSymbol=c=>{const [id,name]=CHAIN_SYMBOLS[c.kind];return {id,name};};
const chainReference=c=>({kind:c.kind,key:c.key,name:c.name,age:c.age,color:c.color,minPlayers:Math.min(...c.copies)});
function cardForView(id){const c=card(id);return {...publicCard(id),chains:{from:Object.values(CARDS).filter(x=>c.from.includes(x.kind)).map(x=>({...chainReference(x),symbol:chainSymbol(c)})),to:Object.values(CARDS).filter(x=>x.from.includes(c.kind)).map(x=>({...chainReference(x),symbol:chainSymbol(x)}))}};}
function resetTurn(s){s.players.forEach(p=>{p.bankBonusUsed=false;p.bankResourceUsed=false;p.refundUsed=[];});s.taxEvents=[];s.pirateEvents=[];}
function beginAge(s){if(expansions(s).leaders){s.phase='recruit';s.pending={};s.round=0;s.epoch++;resetTurn(s);}else deal(s);}
function beginGame(s){if(expansions(s).leaders){s.phase='leaderDraft';s.round=1;s.epoch++;}else deal(s);}
function deal(s){const size=turnCount(s)+1,deck=s.decks[s.age-1];s.players.forEach((p,i)=>{p.hand=deck.slice(i*size,(i+1)*size);});s.decks[s.age-1]=[];s.phase='draft';s.round=1;s.epoch++;resetTurn(s);}
function validateOptions(options){ensure(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(k=>['side','leaders','armada','leaderExpert'].includes(k))&&['choose','day','night'].includes(options.side??'choose'),'奇迹面或扩展选项无效');for(const k of ['leaders','armada','leaderExpert'])ensure(options[k]===undefined||typeof options[k]==='boolean','扩展开关无效');ensure(!options.leaderExpert||options.leaders,'专家领袖需要启用领袖扩展');}
function create(ids,options={},random){ensure(Array.isArray(ids)&&ids.length>=3&&ids.length<=7&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&id),'需要 3–7 位不同玩家');validateOptions(options);ensure(typeof random==='function','游戏需要注入随机源');
 const ex={leaders:!!options.leaders,armada:!!options.armada,leaderExpert:!!options.leaderExpert},wonders=shuffle(Object.keys(WONDERS).filter(k=>!WONDERS[k].expansion||ex[WONDERS[k].expansion]),random),yards=ex.armada?shuffle(SHIPYARDS.map((_,i)=>i),random):[];
 const decks=[1,2,3].map(age=>{let cards=Object.values(CARDS).filter(c=>c.age===age&&c.color!=='purple').flatMap(c=>c.copies.filter(n=>n<=ids.length).map((_,i)=>`${c.key}@${i}`));if(age===3)cards.push(...shuffle(Object.values(CARDS).filter(c=>c.color==='purple'),random).slice(0,ids.length+2).map(c=>`${c.key}@0`));if(ex.armada)cards.push(...shuffle(Object.values(ARMADA_CARDS).filter(c=>c.age===age&&(ids.length>3||c.copies[0]===3)),random).slice(0,ids.length).map(c=>c.key));ensure(cards.length===(ex.armada?8:7)*ids.length,'时代牌数量错误');return shuffle(cards,random);});
 const leaderDeck=ex.leaders?shuffle(Object.values(LEADERS).filter(c=>!c.expert||ex.leaderExpert).map(c=>c.key),random):[];
 const s={phase:'setup',age:1,round:1,epoch:0,expansions:ex,players:ids.map((id,i)=>({id,wonder:wonders[i],side:options.side&&options.side!=='choose'?options.side:null,coins:ex.leaders?6:3,cards:[],stages:0,builtStages:[],military:[],hand:[],buried:[],leaders:[],leaderHand:[],draftLeaders:ex.leaders?leaderDeck.splice(0,4):[],mummies:[],islands:[],navalMilitary:[],...(ex.armada?{shipyard:yards[i],fleets:{red:0,yellow:0,blue:0,green:0}}:{})})),decks,leaderDeck,islandDecks:ex.armada?[1,2,3].map(level=>shuffle(Object.values(ISLANDS).filter(c=>c.level===level).map(c=>c.key),random)):[],pending:{},discard:[],reviveQueue:[],turnEffects:[],tasks:[],exploreQueue:[],taxEvents:[],pirateEvents:[],boardings:[],resume:null,lastActions:[],ageResults:[],winners:[]};
 if(s.players.every(p=>p.side))beginGame(s);return s;
}
function gain(s,p,coins){if(coins<=0)return;p.coins+=coins;if(!p.bankBonusUsed&&effects(p).some(e=>e.bankBonus)){p.coins++;p.bankBonusUsed=true;}}
function queue(s,p,task){s.tasks.push({playerId:p.id,...task});}
function activate(s,p,e,random){if(e.coins||e.income)s.turnEffects.push({id:p.id,effect:clone(e)});if(e.revive){if(e.solomon)s.reviveQueue.unshift(p.id);else s.reviveQueue.push(p.id);}
 if(e.tax)s.taxEvents.push({id:p.id,value:e.tax});if(e.pirate)s.pirateEvents.push(p.id);
 if(e.advance)queue(s,p,{kind:'advance',remaining:e.advance,used:[]});if(e.advanceColor)advance(s,p,e.advanceColor);
 if(e.drawIsland){const id=s.islandDecks[e.drawIsland-1]?.shift();if(id){p.islands.push(id);activate(s,p,card(id).effect);}}
 if(e.explore)s.exploreQueue.push({id:p.id,level:e.explore});
 if(e.drawLeaders){ensure(typeof random==='function','抽取领袖需要注入随机源');s.leaderDeck=shuffle(s.leaderDeck,random);p.leaderHand.push(...s.leaderDeck.splice(0,e.drawLeaders));}
 if(e.recruitExtra&&p.leaderHand.length)queue(s,p,{kind:'recruit'});
 if(e.mummify&&p.leaders.length)queue(s,p,{kind:'mummify',eligible:[...p.leaders]});
 if(e.victoryToken){p.military.push(s.age*2-1);gain(s,p,effects(p).reduce((n,e)=>n+(e.victoryCoins??0),0));}
 if(e.removeDefeats){p.military=p.military.filter(v=>v>0);for(const other of s.players)if(other.id!==p.id)queue(s,other,{kind:'discardVictory'});}
 if(e.boarding){const target=farNeighbors(s,p)[e.boarding==='left'?0:1];if(!s.boardings.some(b=>b.age===s.age&&[b.a,b.b].includes(p.id)&&[b.a,b.b].includes(target.id)))s.boardings.push({age:s.age,a:p.id,b:target.id});}
}
function advance(s,p,color){if(!p.fleets||p.fleets[color]>=6)return;const pos=++p.fleets[color];fleetEffects(s,p,color,pos);}
function fleetEffects(s,p,color,pos){
 if(color==='yellow'){if(pos>=2&&pos<=5)s.turnEffects.push({id:p.id,effect:{coins:pos}});if([2,4,6].includes(pos))s.taxEvents.push({id:p.id,value:pos===2?1:pos===4?2:4});}
 if(color==='green'&&[2,4,6].includes(pos))s.exploreQueue.push({id:p.id,level:pos/2});
 const coins=effects(p).reduce((n,e)=>n+(e.advanceCoins??0),0);if(coins)s.turnEffects.push({id:p.id,effect:{coins}});
}
function actionIncome(s,p,c,reason){const es=effects(p);const amount=(c.color==='yellow'?es.reduce((n,e)=>n+(e.yellowCoins??0),0):0)+(reason==='chain'||reason?.chain?es.reduce((n,e)=>n+(e.chainCoins??0),0):0);if(amount)s.turnEffects.push({id:p.id,effect:{coins:amount}});}
function pay(s,p,q){const [left,right]=neighbors(s,p),[farLeft,farRight]=farNeighbors(s,p);p.coins-=totalPayment(q);left.coins+=q.left;right.coins+=q.right;farLeft.coins+=q.farLeft??0;farRight.coins+=q.farRight??0;if(q.reserve)p.bankResourceUsed=true;
 if(effects(p).some(e=>e.tradeRefund))for(const [n,amount] of [[left,q.left],[right,q.right]])if(amount&&!p.refundUsed.includes(n.id)){p.refundUsed.push(n.id);s.turnEffects.push({id:p.id,effect:{coins:1}});}
}
function buildAction(s,p,c,leader=false,random){if(c.action==='build'){if(leader)p.leaders.push(c.cardId);else p.cards.push(c.cardId);activate(s,p,card(c.cardId).effect);if(!leader)actionIncome(s,p,card(c.cardId),c.payment.chain?'chain':c.payment.reason);}
 if(c.action==='wonder'){const i=c.stage??availableStages(p)[0],old=effects(p).some(e=>e.wonderAdvance);p.builtStages.push(i);p.stages++;p.buried.push(c.cardId);activate(s,p,stages(p)[i].effect,random);if(old)queue(s,p,{kind:'advance',remaining:1,used:[]});}
 if(c.action==='sell'){if(!leader)s.discard.push(c.cardId);if(c.sellFleet)advance(s,p,'yellow');else s.turnEffects.push({id:p.id,effect:{coins:3}});}
 s.lastActions.push({id:p.id,action:c.action,...(c.action==='build'?{card:publicCard(c.cardId)}:{}),...(c.action==='wonder'?{stage:(c.stage??p.stages-1)+1}:{}),...(c.naval?{naval:c.naval}:{}),...(c.sellFleet?{sellFleet:true}:{})});
}
function reviveChoices(s,p){return s.discard.filter(id=>!owns(p,id));}
function startExploration(s){const queue=s.exploreQueue.splice(0),offers={};let seq=0;for(const level of [1,2,3]){const entries=queue.filter(x=>x.level===level),deck=s.islandDecks[level-1];if(!entries.length)continue;const size=entries.length===1?Math.min(4,deck.length):Math.floor(deck.length/entries.length);if(!size)continue;for(const item of entries){const key=`${s.epoch}-${seq++}`;offers[key]={playerId:item.id,level,cards:deck.splice(0,size)};}}
 if(!Object.keys(offers).length)return false;s.exploration={offers,picks:{}};s.phase='explore';s.pending={};s.epoch++;return true;
}
function drain(s){
 while(s.tasks.length){const t=s.tasks[0],p=player(s,t.playerId);if(t.kind==='recruit'){for(const entry of s.turnEffects.filter(x=>x.id===p.id&&x.effect.coins))gain(s,p,entry.effect.coins);s.turnEffects=s.turnEffects.filter(x=>!(x.id===p.id&&x.effect.coins));if(!p.leaderHand.some(id=>buildQuote(s,p,id).plans.length)){s.tasks.shift();continue;}} if(t.kind==='advance'&&(!t.remaining||!FLEET_COLORS.some(c=>!t.used.includes(c)&&p.fleets[c]<6))||t.kind==='recruit'&&!p.leaderHand.length||t.kind==='mummify'&&!t.eligible.some(id=>p.leaders.includes(id))||t.kind==='discardVictory'&&!p.military.some(v=>v>0)){s.tasks.shift();continue;}s.phase=t.kind==='recruit'?'recruitExtra':'ability';s.epoch++;return;}
 if(s.exploreQueue.length&&startExploration(s))return;
 while(s.reviveQueue.length){const p=player(s,s.reviveQueue[0]);if(reviveChoices(s,p).length){s.phase='revive';s.epoch++;return;}s.reviveQueue.shift();}
 completeTurn(s);
}
function loseCoins(s){const max=Math.max(0,...s.taxEvents.map(e=>e.value)),sources=s.taxEvents.filter(e=>e.value===max).map(e=>e.id);for(const p of s.players){if(effects(p).some(e=>e.taxShield))continue;const tax=max&&!sources.includes(p.id)?Math.max(0,max-commercial(p)):0;const pirate=s.pirateEvents.filter(id=>id!==p.id).length*commercial(p);p.coins=Math.max(0,p.coins-tax-pirate);}s.taxEvents=[];s.pirateEvents=[];}
function completeTurn(s){for(const {id,effect:e} of s.turnEffects)gain(s,player(s,id),(e.coins??0)+(e.income?quantity(s,player(s,id),e.income)*e.income.coins:0));s.turnEffects=[];loseCoins(s);
 const resume=s.resume;s.resume=null;
 if(resume==='deal'){deal(s);return;}
 if(resume==='pass'){const hands=s.players.map(p=>p.hand),direction=s.age===2?-1:1,n=s.players.length;s.players.forEach((p,i)=>{p.hand=hands[(i-direction+n)%n];});s.round++;s.phase='draft';s.epoch++;resetTurn(s);}
 else if(resume==='extra'&&s.players.some(p=>p.hand.length)){s.round=turnCount(s)+1;s.phase='extra';s.epoch++;resetTurn(s);}
 else if(resume==='finish')finishGame(s);
 else endAge(s);
}
function victory(s,p,value){if(value>0){p.military.push(value);gain(s,p,effects(p).reduce((n,e)=>n+(e.victoryCoins??0),0));}else p.military.push(value);}
function landConflicts(s){
 const military=s.players.map(p=>({id:p.id,shields:strength(p),tokens:neighbors(s,p).map(n=>strength(p)===strength(n)?0:strength(p)>strength(n)?s.age*2-1:-1),opponents:neighbors(s,p).map(n=>n.id)}));
 for(const b of s.boardings.filter(b=>b.age===s.age)){const a=player(s,b.a),c=player(s,b.b);if(neighbors(s,a).some(n=>n.id===c.id))continue;for(const [p,n] of [[a,c],[c,a]]){const r=military.find(r=>r.id===p.id);r.tokens.push(strength(p)===strength(n)?0:strength(p)>strength(n)?s.age*2-1:-1);r.opponents.push(n.id);}}
 const reflected=[];for(const r of military){const p=player(s,r.id);r.tokens.forEach((v,i)=>{if(v<0&&effects(p).some(e=>e.reflectDefeat))reflected.push(r.opponents[i]);else if(v)victory(s,p,v);});r.tokens=r.tokens.filter((v,i)=>v&&!(v<0&&effects(p).some(e=>e.reflectDefeat)));delete r.opponents;}
 for(const id of reflected){victory(s,player(s,id),-1);military.find(r=>r.id===id).tokens.push(-1);}return military;
}
function endAge(s){const military=landConflicts(s);s.ageResults.push({age:s.age,military});if(expansions(s).armada){const eligible=s.players.filter(p=>effects(p).some(e=>e.navalChoice));if(eligible.length){s.phase='navalChoice';s.navalChoices={};s.epoch++;return;}resolveNaval(s);}else nextAge(s);}
function resolveNaval(s){const participants=s.players.filter(p=>s.navalChoices?.[p.id]!==false),rows=navalResults(participants,s.age);for(const r of rows)if(r.token)player(s,r.id).navalMilitary.push(r.token);s.ageResults.at(-1).naval=rows;s.navalChoices=null;nextAge(s);}
function nextAge(s){if(s.age===3)finishGame(s);else{s.age++;beginAge(s);}}
function finishGame(s){s.phase='finished';s.epoch++;const ranked=scores(s).sort((a,b)=>b.total-a.total||player(s,b.id).coins-player(s,a.id).coins),best=ranked[0];s.winners=ranked.filter(r=>r.total===best.total&&player(s,r.id).coins===player(s,best.id).coins).map(r=>r.id);}
function resolve(s,random){const recruit=s.phase==='recruit',extra=s.phase==='extra';s.lastActions=[];const choices=s.players.filter(p=>recruit?p.leaderHand.length:p.hand.length).map(p=>({p,c:s.pending[p.id]}));
 // All payments use the start-of-turn quotes; income cannot finance an action in this turn.
 for(const {p,c} of choices)pay(s,p,c.payment);
 if(recruit)for(const {c} of choices)if(c.action==='sell')s.leaderDeck.push(c.cardId);
 // Naval construction precedes card effects. Its effects are resolved after the buildings below.
 const moves=[];for(const {p,c} of choices)if(c.naval){p.fleets[c.naval]++;moves.push({p,color:c.naval,pos:p.fleets[c.naval]});}
 for(const {p,c} of choices){if(recruit)p.leaderHand=p.leaderHand.filter(id=>id!==c.cardId);else p.hand=p.hand.filter(id=>id!==c.cardId);buildAction(s,p,c,recruit,random);}
 for(const {p,color,pos} of moves)fleetEffects(s,p,color,pos);
 s.pending={};if(recruit){if(s.age===3)for(const p of s.players)if(!(p.wonder==='roma'&&p.side==='night')){s.leaderDeck.push(...p.leaderHand);p.leaderHand=[];}s.resume='deal';}else if(extra)s.resume='age';else if(s.round===turnCount(s)){for(const p of s.players)if(!effects(p).some(e=>e.double)){s.discard.push(...p.hand);p.hand=[];}s.resume='extra';}else s.resume='pass';drain(s);
}
function checkedChoice(s,p,command,leader=false){ensure(command.type==='choose'&&['build','wonder','sell'].includes(command.action),'请选择建造、奇迹或出售');const hand=leader?p.leaderHand:p.hand;ensure(hand.length,'本回合无需你行动');ensure(!s.pending[p.id],'你已确认，等待其他玩家',409);ensure(hand.includes(command.cardId),'这张牌不在你的手中');
 const naval=command.naval??null;ensure(!naval||expansions(s).armada&&FLEET_COLORS.includes(naval),'舰队选项无效');const stage=command.stage??availableStages(p)[0];ensure(!command.sellFleet||command.action==='sell'&&expansions(s).armada&&p.fleets.yellow<6,'无法出售以推进舰队');
 ensure(command.action!=='sell'||!naval,'出售不能同时付费造船');
 const q=command.action==='build'?buildQuote(s,p,command.cardId,false,naval):command.action==='wonder'?wonderQuote(s,p,false,stage,naval):{plans:[{left:0,right:0,bank:0,reason:'sell'}]};ensure(q.plans.length,q.reason||'无法执行');const requested=command.payment??q.plans[0],payment=q.plans.find(x=>['left','right','bank','farLeft','farRight','reserve'].every(k=>(x[k]??0)===(requested[k]??0)));ensure(payment,'付款方案无效');return {cardId:command.cardId,action:command.action,payment:clone(payment),...(naval?{naval}:{}),...(command.action==='wonder'?{stage}:{}),...(command.sellFleet?{sellFleet:true}:{})};
}
function apply(input,playerId,command,context={}){ensure(command&&typeof command==='object'&&!Array.isArray(command),'行动格式无效');ensure(player(input,playerId),'你不在此对局',403);ensure(input.phase!=='finished','本局已结束');ensure(command.epoch===input.epoch,'牌桌已进入下一步，请重新选择',409);const s=clone(input),p=player(s,playerId);
 if(s.phase==='setup'){ensure(command.type==='side'&&['day','night'].includes(command.side),'请选择日面或夜面');ensure(!p.side,'你已选择奇迹面');p.side=command.side;if(s.players.every(p=>p.side))beginGame(s);}
 else if(s.phase==='leaderDraft'){ensure(command.type==='leaderPick'&&p.draftLeaders.includes(command.cardId),'请选择手中的领袖');ensure(!s.pending[p.id],'你已确认，等待其他玩家',409);s.pending[p.id]={cardId:command.cardId};if(s.players.every(p=>s.pending[p.id])){for(const x of s.players){const id=s.pending[x.id].cardId;x.leaderHand.push(id);x.draftLeaders=x.draftLeaders.filter(c=>c!==id);}s.pending={};const hands=s.players.map(p=>p.draftLeaders);s.players.forEach((p,i)=>{p.draftLeaders=hands[(i+1)%s.players.length];});if(s.players[0].draftLeaders.length===1){s.players.forEach(p=>{p.leaderHand.push(...p.draftLeaders);p.draftLeaders=[];});beginAge(s);}else{s.round++;s.epoch++;}}}
 else if(s.phase==='explore'){ensure(command.type==='islandPick','请选择岛屿');const offer=s.exploration.offers[command.offerId];ensure(offer&&offer.playerId===p.id&&!s.exploration.picks[command.offerId]&&offer.cards.includes(command.cardId),'岛屿选项已失效');s.exploration.picks[command.offerId]=command.cardId;if(Object.keys(s.exploration.offers).every(k=>s.exploration.picks[k])){ensure(typeof context.random==='function','探索需要注入随机源');const {offers,picks}=s.exploration;s.exploration=null;for(const [key,offer] of Object.entries(offers)){const id=picks[key];player(s,offer.playerId).islands.push(id);s.islandDecks[offer.level-1].push(...offer.cards.filter(c=>c!==id));}for(let i=0;i<3;i++)s.islandDecks[i]=shuffle(s.islandDecks[i],context.random);for(const [key,offer] of Object.entries(offers))activate(s,player(s,offer.playerId),card(picks[key]).effect);drain(s);}}
 else if(s.phase==='ability'){const t=s.tasks[0];ensure(t.playerId===p.id,'等待其他玩家处理效果',403);ensure(command.type==='ability','请选择效果');if(t.kind==='advance'){ensure(FLEET_COLORS.includes(command.value)&&!t.used.includes(command.value)&&p.fleets[command.value]<6,'请选择尚未推进的舰队');advance(s,p,command.value);t.used.push(command.value);t.remaining--;if(!t.remaining)s.tasks.shift();}
  else if(t.kind==='mummify'){ensure(t.eligible.includes(command.value)&&p.leaders.includes(command.value),'请选择此前已招募的领袖');p.leaders=p.leaders.filter(id=>id!==command.value);p.mummies.push(command.value);s.tasks.shift();}
  else if(t.kind==='discardVictory'){ensure(p.military.includes(command.value)&&command.value>0,'请选择胜利标记');p.military.splice(p.military.indexOf(command.value),1);s.tasks.shift();}drain(s);
 }
 else if(s.phase==='recruitExtra'){ensure(s.tasks[0].playerId===p.id,'等待额外招募',403);ensure(command.action==='build','额外招募请选择领袖');const c=checkedChoice(s,p,command,true);pay(s,p,c.payment);p.leaderHand=p.leaderHand.filter(id=>id!==c.cardId);s.tasks.shift();if(c.naval)advance(s,p,c.naval);buildAction(s,p,c,true,context.random);drain(s);}
 else if(s.phase==='revive'){ensure(s.reviveQueue[0]===p.id,'等待其他玩家回收建筑',403);ensure(command.type==='revive'&&reviveChoices(s,p).includes(command.cardId),'请选择可回收的建筑');p.cards.push(command.cardId);s.discard=s.discard.filter(id=>id!==command.cardId);s.reviveQueue.shift();activate(s,p,card(command.cardId).effect);actionIncome(s,p,card(command.cardId));s.lastActions.push({id:p.id,action:'revive',card:publicCard(command.cardId)});drain(s);}
 else if(s.phase==='navalChoice'){ensure(effects(p).some(e=>e.navalChoice)&&s.navalChoices[p.id]===undefined,'本次海战无需你选择');ensure(command.type==='navalChoice'&&typeof command.participate==='boolean','请选择是否参战');s.navalChoices[p.id]=command.participate;if(s.players.filter(p=>effects(p).some(e=>e.navalChoice)).every(p=>s.navalChoices[p.id]!==undefined))resolveNaval(s);}
 else{ensure(['draft','extra','recruit'].includes(s.phase),'当前无法出牌');const leader=s.phase==='recruit';s.pending[p.id]=checkedChoice(s,p,command,leader);if(s.players.filter(p=>leader?p.leaderHand.length:p.hand.length).every(p=>s.pending[p.id]))resolve(s,context.random);}
 return s;
}
function actionPreview(s,p,kind,id,stage=availableStages(p)[0]){const e=kind==='wonder'?stages(p)[stage]?.effect:card(id)?.effect;if(!e)return null;const leader=id&&card(id).color==='white',future={...p,cards:kind==='build'&&!leader?[...p.cards,id]:p.cards,leaders:kind==='build'&&leader?[...p.leaders,id]:p.leaders,stages:p.stages+Number(kind==='wonder'),builtStages:kind==='wonder'?[...builtStages(p),stage]:builtStages(p)},next={...s,players:s.players.map(x=>x.id===p.id?future:x)},before=scores(s).find(x=>x.id===p.id),after=scores(next).find(x=>x.id===p.id);
 return {production:production(future).map(r=>r.join('')),shields:strength(future),...(expansions(s).armada?{naval:navalStrength(future)}:{}),science:{...after.science,points:after.green},scienceBefore:before.green,pointsDelta:['wonder','blue','yellow','purple','leaders','islands'].reduce((n,k)=>n+(after[k]??0)-(before[k]??0),0),income:(e.coins??0)+(e.income?quantity(next,future,e.income)*e.income.coins:0),incomeVariable:!!e.income&&e.income.scope!=='own',stages:future.stages};
}
function quoteForView(s,p,q,cost){if(q.plans.length||q.reason!=='资源不足或钱币不够')return q;const unrestricted=paymentPlans(s,{...p,coins:(cost.coins??0)+cost.resources.length*2},cost);return {...q,reason:unrestricted.length?`还差 ${Math.max(1,totalPayment(unrestricted[0])-p.coins)} 钱币`:'资源组合不足'};}
function stagesForView(s,list){return list.map(stage=>{const out=clone(stage);if(out.effect.freeLast&&expansions(s).armada){out.effect.freeLastAt=turnCount(s);out.text=out.text.replace(/第\s*6\s*张/,`第 ${turnCount(s)} 张`);}return out;});}
// Public acknowledgement only; never expose another player's selected card or offers.
function actionStatus(s,p){
 if(s.phase==='setup')return p.side?'confirmed':'waiting';
 if(['leaderDraft','draft','extra','recruit'].includes(s.phase)){
  const required=s.phase==='leaderDraft'?p.draftLeaders.length:s.phase==='recruit'?p.leaderHand.length:p.hand.length;
  return s.pending[p.id]?'confirmed':required?'waiting':'inactive';
 }
 if(s.phase==='explore'){
  const offers=Object.entries(s.exploration.offers).filter(([,o])=>o.playerId===p.id);
  return !offers.length?'inactive':offers.every(([key])=>s.exploration.picks[key])?'confirmed':'waiting';
 }
 if(s.phase==='navalChoice')return !effects(p).some(e=>e.navalChoice)?'inactive':s.navalChoices[p.id]===undefined?'waiting':'confirmed';
 const active=s.phase==='revive'?s.reviveQueue[0]:['ability','recruitExtra'].includes(s.phase)?s.tasks[0]?.playerId:null;
 return active===p.id?'waiting':'inactive';
}
function view(s,viewerId){const me=player(s,viewerId);ensure(me,'你不在此对局',403);const ex=expansions(s),extra=s.phase==='recruitExtra'&&s.tasks[0].playerId===me.id,recruit=s.phase==='recruit'||extra,hand=recruit?me.leaderHand:me.hand,choosing=(['draft','extra','recruit'].includes(s.phase)||extra)&&hand.length>0&&!s.pending[viewerId],active=s.phase==='revive'&&s.reviveQueue[0]===viewerId;
 const stageOptions=choosing?availableStages(me).map(stage=>({...quoteForView(s,me,wonderQuote(s,me,true,stage),stages(me)[stage].cost),preview:actionPreview(s,me,'wonder',null,stage),naval:ex.armada&&!effects(me).some(e=>e.wonderAdvance)?{...wonderQuote(s,me,true,stage,SHIPYARDS[me.shipyard].linked),color:SHIPYARDS[me.shipyard].linked}:null})):[];
 const task=s.phase==='ability'?s.tasks[0]:null,offer=s.phase==='explore'?Object.entries(s.exploration.offers).find(([key,o])=>o.playerId===me.id&&!s.exploration.picks[key]):null;
 return {phase:s.phase,age:s.age,round:s.round,turnsPerAge:turnCount(s),epoch:s.epoch,expansions:clone(ex),
 chainCatalogue:Object.values(CARDS).filter(c=>c.from.length).map(c=>({symbol:chainSymbol(c),from:Object.values(CARDS).filter(x=>c.from.includes(x.kind)).map(chainReference),to:chainReference(c)})),
 players:s.players.map(p=>({id:p.id,wonder:p.wonder,wonderName:WONDERS[p.wonder].name,subtitle:WONDERS[p.wonder].subtitle,resource:WONDERS[p.wonder].resource,side:p.side,coins:p.coins,cards:p.cards.map(cardForView),stages:p.stages,builtStages:[...builtStages(p)],unorderedStages:!!WONDERS[p.wonder].unordered,stageList:stagesForView(s,stages(p)),military:[...p.military],shields:strength(p),production:production(p).map(r=>r.join('')),tradeable:production(p,true).map(r=>r.join('')),submitted:!!s.pending[p.id],actionStatus:actionStatus(s,p),handCount:p.hand.length,...(ex.leaders?{leaders:p.leaders.map(cardForView),leaderCount:p.leaderHand.length,mummies:p.mummies.map(id=>({name:card(id).name,points:2*(card(id).cost.age?3:card(id).cost.coins)}))}:{}),...(ex.armada?{islands:p.islands.map(cardForView),fleets:clone(p.fleets),shipyard:clone(SHIPYARDS[p.shipyard]),naval:navalStrength(p),commercial:commercial(p),fleetPoints:BLUE_POINTS[p.fleets.blue],navalMilitary:[...p.navalMilitary],boardings:s.boardings.filter(b=>b.age===s.age&&(b.a===p.id||b.b===p.id)).map(b=>b.a===p.id?b.b:b.a)}:{})})),
 setupChoices:s.phase==='setup'?['day','night'].map(side=>({side,startingResource:WONDERS[me.wonder].resource,startingCoins:me.coins,startingEffects:clone(effects({...me,side,cards:[],leaders:[],islands:[],stages:0,builtStages:[]})),stages:stagesForView(s,WONDERS[me.wonder][side])})):[],neighbors:neighbors(s,me).map(p=>p.id),
 hand:hand.map(id=>({...cardForView(id),build:choosing?quoteForView(s,me,buildQuote(s,me,id,true),card(id).cost):{plans:[],reason:'等待结算'},navalBuild:choosing&&ex.armada&&FLEET_COLORS.includes(card(id).color)?buildQuote(s,me,id,true,card(id).color):null,preview:choosing?actionPreview(s,me,'build',id):null})),
 wonderBuild:stageOptions[0]??{plans:[],reason:'等待结算'},wonderOptions:stageOptions,pending:s.pending[viewerId]?clone(s.pending[viewerId]):null,canChoose:!!choosing,canSellFleet:!!(choosing&&ex.armada&&me.fleets.yellow<6),
 reserveLeaders:ex.leaders&&s.phase!=='leaderDraft'?me.leaderHand.map(cardForView):[],leaderDraftChoices:s.phase==='leaderDraft'&&!s.pending[me.id]?me.draftLeaders.map(cardForView):[],draftedLeaders:s.phase==='leaderDraft'?me.leaderHand.map(cardForView):[],
 ability:task?{kind:task.kind,playerId:task.playerId,...(task.playerId===me.id?{options:task.kind==='advance'?FLEET_COLORS.filter(c=>!task.used.includes(c)&&me.fleets[c]<6).map(c=>({value:c,label:{red:'红色舰队',yellow:'黄色舰队',blue:'蓝色舰队',green:'绿色舰队'}[c]})):task.kind==='mummify'?task.eligible.filter(id=>me.leaders.includes(id)).map(id=>({value:id,label:card(id).name,card:cardForView(id)})):[...new Set(me.military.filter(v=>v>0))].map(v=>({value:v,label:`${v} 分胜利标记` })),remaining:task.remaining}:{} )}:null,
 exploration:offer?{offerId:offer[0],level:offer[1].level,cards:offer[1].cards.map(cardForView)}:null,canNavalChoice:s.phase==='navalChoice'&&effects(me).some(e=>e.navalChoice)&&s.navalChoices[me.id]===undefined,
 reviveId:s.phase==='revive'?s.reviveQueue[0]:null,discardChoices:active?reviveChoices(s,me).map(id=>({...cardForView(id),preview:actionPreview(s,me,'build',id)})):[],lastActions:clone(s.lastActions),ageResults:clone(s.ageResults),scores:scores(s),winners:[...s.winners]};
}
function result(s){const rows=scores(s),coins=id=>player(s,id).coins;return {winners:[...s.winners],rounds:3,scoreDirection:'higher',players:rows.map(p=>({id:p.id,score:p.total,rank:1+rows.filter(q=>q.total>p.total||q.total===p.total&&coins(q.id)>coins(p.id)).length,breakdown:[['wonder','奇迹'],['treasury','钱币'],['military','陆战'],['blue','市政'],['yellow','商业'],['green','科技'],['purple','行会'],...(expansions(s).leaders?[['leaders','领袖']]:[]),...(expansions(s).armada?[['naval','海战'],['fleet','舰队'],['islands','岛屿']]:[])].map(([key,label])=>({label,value:p[key]}))}))};}
function migrate(input,fromVersion){ensure(fromVersion===1,'不支持此七大奇迹存档版本');const s=clone(input);s.expansions={leaders:false,armada:false,leaderExpert:false};Object.assign(s,{leaderDeck:[],islandDecks:[],tasks:[],exploreQueue:[],taxEvents:[],pirateEvents:[],boardings:[]});for(const p of s.players)Object.assign(p,{builtStages:builtStages(p),leaders:[],leaderHand:[],draftLeaders:[],mummies:[],islands:[],navalMilitary:[],bankBonusUsed:false,bankResourceUsed:false,refundUsed:[]});return s;}
function submissionKey(s,id,command){
 const type={setup:'side',leaderDraft:'leaderPick',draft:'choose',extra:'choose',recruit:'choose',explore:'islandPick',navalChoice:'navalChoice'}[s.phase];
 const p=player(s,id);
 return type&&p&&actionStatus(s,p)==='waiting'&&(!command||command.type===type)
  ? `${s.epoch}:${s.phase}` : null;
}
export const sevenWonders={manifest:{id:'seven-wonders',title:'七大奇迹',rulesVersion:'2020 second edition · Leaders + Armada · FAQ 2026-10',stateVersion:2,minPlayers:3,maxPlayers:7},validateOptions,create,apply,view,spectatorView(s){const v=view(s,s.players[0].id);return Object.fromEntries(["phase","age","round","expansions","players","lastActions","ageResults","scores","winners"].map(k=>[k,v[k]]));},result,migrate,submissionKey,
 turn:s=>s.phase==='finished'?null:{key:String(s.epoch),players:s.players.filter(p=>actionStatus(s,p)==='waiting').map(p=>p.id)},
 timeout:(view,id)=>sevenWondersBot.decide(view,id,{}),isFinished:s=>s.phase==='finished',bot:sevenWondersBot};
