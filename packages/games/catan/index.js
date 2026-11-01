import {ensure} from '../../platform/errors.js';
import {resources as R,empty,shuffle,makeBoard,longestRoad} from './board.js';
import {decide} from './bot.js';
export const costs={road:{wood:1,brick:1},settlement:{wood:1,brick:1,wool:1,grain:1},city:{grain:2,ore:3},development:{wool:1,grain:1,ore:1}};
const total=h=>R.reduce((n,r)=>n+h[r],0),current=s=>s.players[s.turn],has=(p,c)=>Object.entries(c).every(([r,n])=>p.hand[r]>=n);
function bundle(x){ensure(x&&typeof x==='object'&&!Array.isArray(x),'请选择资源');ensure(Object.keys(x).every(r=>R.includes(r)),'未知资源');const out=empty();for(const r of R){out[r]=x[r]??0;ensure(Number.isInteger(out[r])&&out[r]>=0&&out[r]<=19,'资源数量无效');}return out;}
function transfer(from,to,c){ensure(has({hand:from},c),'资源不足');for(const r of R){from[r]-=c[r]??0;to[r]+=c[r]??0;}}
function pieces(s,id){return {road:s.board.edges.filter(e=>e.owner===id).length,settlement:s.board.vertices.filter(v=>v.owner===id&&!v.city).length,city:s.board.vertices.filter(v=>v.owner===id&&v.city).length};}
function score(s,p,privateScore=false){const n=pieces(s,p.id);return n.settlement+2*n.city+2*(s.longest===p.id)+2*(s.army===p.id)+(privateScore?p.dev.filter(c=>c.type==='point').length:0);}
function award(s,key,values,min){const best=Math.max(min,...values.map(x=>x.value)),leaders=values.filter(x=>x.value===best);s[key]=leaders.some(x=>x.id===s[key])?s[key]:leaders.length===1?leaders[0].id:null;}
function update(s){s.players.forEach(p=>p.roadLength=longestRoad(s.board,p.id));award(s,'longest',s.players.map(p=>({id:p.id,value:p.roadLength})),5);award(s,'army',s.players.map(p=>({id:p.id,value:p.knights})),3);if(!s.phase.startsWith('setup')&&score(s,current(s),true)>=10){s.phase='finished';s.winner=current(s).id;}}
function locations(s,p,kind,setup=false){const b=s.board,n=pieces(s,p.id);if(n[kind]>={road:15,settlement:5,city:4}[kind])return [];
  if(kind==='city')return b.vertices.filter(v=>v.owner===p.id&&!v.city).map(v=>v.id);
  if(kind==='settlement')return b.vertices.filter(v=>!v.owner&&v.edges.every(i=>b.edges[i].ends.every(j=>!b.vertices[j].owner))&&(setup||v.edges.some(i=>b.edges[i].owner===p.id))).map(v=>v.id);
  return b.edges.filter(e=>!e.owner&&e.ends.some(v=>setup?v===s.setupVertex:b.vertices[v].owner===p.id||!b.vertices[v].owner&&b.vertices[v].edges.some(i=>b.edges[i].owner===p.id))).map(e=>e.id);
}
function rates(s,id){return Object.fromEntries(R.map(r=>[r,Math.min(4,...s.board.ports.filter(p=>p.vertices.some(v=>s.board.vertices[v].owner===id)).map(p=>p.type===r?2:p.type==='any'?3:4))]));}
function victims(s,id){return [...new Set(s.board.tiles[s.robber].vertices.map(v=>s.board.vertices[v].owner))].filter(x=>x&&x!==id&&total(s.players.find(p=>p.id===x).hand)>0);}
function resume(s){s.phase=s.resume??'action';s.resume=null;}
function produce(s,num){for(const r of R){const demands=s.players.map(p=>({p,n:s.board.tiles.filter(t=>t.number===num&&t.type===r&&t.id!==s.robber).reduce((n,t)=>n+t.vertices.reduce((a,i)=>a+(s.board.vertices[i].owner===p.id?(s.board.vertices[i].city?2:1):0),0),0)})).filter(x=>x.n);const sum=demands.reduce((a,x)=>a+x.n,0);if(sum<=s.bank[r]||demands.length===1)for(const {p,n} of demands){const amount=Math.min(n,s.bank[r]);s.bank[r]-=amount;p.hand[r]+=amount;}}}
export const catan={
 bot:{observe:()=>({}),decide},
 manifest:{id:'catan',title:'卡坦岛',rulesVersion:'base-2020-1',stateVersion:1,minPlayers:3,maxPlayers:4,defaultTurnSeconds:0},
 create(ids,options={},random){ensure(ids.length>=3&&ids.length<=4&&new Set(ids).size===ids.length,'卡坦岛需要 3–4 位玩家');ensure(Object.keys(options).length===0,'基础版不支持这些选项');const board=makeBoard(random);return {version:1,players:ids.map(id=>({id,hand:empty(),dev:[],knights:0,roadLength:0})),board,bank:empty(19),deck:shuffle([...Array(14).fill('knight'),...Array(5).fill('point'),...Array(2).fill('roads'),...Array(2).fill('plenty'),...Array(2).fill('monopoly')],random),turn:Math.floor(random()*ids.length),start:0,setupStep:0,setupVertex:null,phase:'setupSettlement',sequence:0,turnNumber:1,robber:board.tiles.find(t=>t.type==='desert').id,dice:[],played:false,freeRoads:0,resume:null,discard:{},offer:null,longest:null,army:null,winner:null,log:[]};},
 apply(state,id,c,{random}){
  ensure(c&&typeof c.type==='string','无效动作');ensure(state.phase!=='finished','本局已结束');const s=structuredClone(state),p=s.players.find(p=>p.id===id);ensure(p,'你不在本局');const active=current(s).id===id;
  if(c.type==='discard'){ensure(s.phase==='discard'&&s.discard[id]>0,'无需弃牌');const cards=bundle(c.cards);ensure(total(cards)===s.discard[id],'弃牌数量不符');transfer(p.hand,s.bank,cards);delete s.discard[id];if(!Object.keys(s.discard).length)s.phase='robber';}
  else if(c.type==='offer'){ensure(s.phase==='action','现在不能交易');const give=bundle(c.give),want=bundle(c.want);ensure(total(give)&&total(want)&&R.every(r=>!give[r]||!want[r]),'双方须交换不同资源');ensure(has(p,give),'资源不足');s.offer={from:id,to:active?null:current(s).id,give,want};}
  else if(c.type==='accept'){ensure(s.phase==='action'&&s.offer&&s.offer.from!==id,'没有可接受的交易');const o=s.offer;ensure(o.from===current(s).id||id===current(s).id,'交易须与当前玩家进行');const from=s.players.find(p=>p.id===o.from);transfer(p.hand,from.hand,o.want);transfer(from.hand,p.hand,o.give);s.offer=null;}
  else if(c.type==='cancelOffer'){ensure(s.offer&&(s.offer.from===id||active),'不能取消他人报价');s.offer=null;}
  else {ensure(active,'还没轮到你');
   if(c.type==='build'){
    const kind=c.kind,setup=s.phase.startsWith('setup');ensure(['road','settlement','city'].includes(kind),'未知建筑');ensure(setup?(s.phase==='setupSettlement'?kind==='settlement':kind==='road'):s.phase==='action'||s.phase==='freeRoads'&&kind==='road','现在不能建造');ensure(locations(s,p,kind,setup).includes(c.at),'这里不能建造');
    if(!setup&&s.phase!=='freeRoads')transfer(p.hand,s.bank,costs[kind]);if(kind==='road')s.board.edges[c.at].owner=id;else {s.board.vertices[c.at].owner=id;s.board.vertices[c.at].city=kind==='city';}
    if(setup&&kind==='settlement'){s.setupVertex=c.at;s.phase='setupRoad';if(s.setupStep>=s.players.length)for(const ti of s.board.vertices[c.at].tiles){const r=s.board.tiles[ti].type;if(r!=='desert'){s.bank[r]--;p.hand[r]++;}}}
    else if(setup){if(s.setupStep===0)s.start=s.turn;s.setupStep++;s.setupVertex=null;if(s.setupStep===2*s.players.length){s.turn=s.start;s.phase='roll';}else {if(s.setupStep<s.players.length)s.turn=(s.turn+1)%s.players.length;else if(s.setupStep>s.players.length)s.turn=(s.turn+s.players.length-1)%s.players.length;s.phase='setupSettlement';}}
    else if(s.phase==='freeRoads'){s.freeRoads--;if(!s.freeRoads||!locations(s,p,'road').length)resume(s);}
   }else if(c.type==='roll'){ensure(s.phase==='roll','现在不能掷骰');s.dice=[1+Math.floor(random()*6),1+Math.floor(random()*6)];const num=s.dice[0]+s.dice[1];if(num===7){s.discard=Object.fromEntries(s.players.filter(p=>total(p.hand)>7).map(p=>[p.id,Math.floor(total(p.hand)/2)]));s.resume='action';s.phase=Object.keys(s.discard).length?'discard':'robber';}else {produce(s,num);s.phase='action';}}
   else if(c.type==='robber'){ensure(s.phase==='robber'&&Number.isInteger(c.tile)&&s.board.tiles[c.tile]&&c.tile!==s.robber,'请选择另一块地形');s.robber=c.tile;if(victims(s,id).length)s.phase='steal';else resume(s);}
   else if(c.type==='steal'){ensure(s.phase==='steal'&&victims(s,id).includes(c.target),'不能抢夺该玩家');const victim=s.players.find(p=>p.id===c.target),pool=R.flatMap(r=>Array(victim.hand[r]).fill(r)),r=pool[Math.floor(random()*pool.length)];victim.hand[r]--;p.hand[r]++;resume(s);}
   else if(c.type==='bank'){ensure(s.phase==='action'&&R.includes(c.give)&&R.includes(c.want)&&c.give!==c.want,'交易无效');const n=rates(s,id)[c.give];transfer(p.hand,s.bank,{[c.give]:n});transfer(s.bank,p.hand,{[c.want]:1});}
   else if(c.type==='buy'){ensure(s.phase==='action'&&s.deck.length,'没有可买的发展卡');transfer(p.hand,s.bank,costs.development);p.dev.push({type:s.deck.pop(),bought:s.turnNumber});}
   else if(c.type==='play'){
    ensure(['roll','action'].includes(s.phase)&&!s.played,'每回合只能使用一张发展卡');const i=p.dev.findIndex(d=>d.type===c.card&&d.type!=='point'&&d.bought<s.turnNumber);ensure(i>=0,'这张发展卡现在不能使用');
    if(c.card==='plenty'){const cards=bundle(c.cards);ensure(total(cards)===Math.min(2,total(s.bank)),'请选择两份资源（银行不足时取剩余）');transfer(s.bank,p.hand,cards);}
    else if(c.card==='monopoly'){ensure(R.includes(c.resource),'请选择资源');for(const other of s.players)if(other!==p){p.hand[c.resource]+=other.hand[c.resource];other.hand[c.resource]=0;}}
    else if(c.card==='knight'){p.knights++;s.resume=s.phase;s.phase='robber';}
    else if(c.card==='roads'){ensure(locations(s,p,'road').length,'没有可放置的道路');s.resume=s.phase;s.phase='freeRoads';s.freeRoads=Math.min(2,15-pieces(s,id).road);}
    p.dev.splice(i,1);s.played=true;
   }else if(c.type==='end'){ensure(s.phase==='action','请先完成当前操作');s.turn=(s.turn+1)%s.players.length;s.turnNumber++;s.phase='roll';s.played=false;s.offer=null;s.dice=[];}
   else ensure(false,'未知动作');
  }
  if(s.phase==='freeRoads'&&!locations(s,current(s),'road').length)resume(s);
  s.sequence++;update(s);s.log.push({actor:id,type:c.type,kind:c.kind??null,dice:c.type==='roll'?s.dice:null});s.log=s.log.slice(-12);return s;
 },
 spectatorView(s){return catan.view(s,null);},
 view(s,id){const p=s.players.find(p=>p.id===id),active=current(s).id===id,legal={road:[],settlement:[],city:[],play:[],victims:[],roll:false,end:false,buy:false,bank:false,trade:s.phase==='action'&&!!p};if(p&&active){legal.roll=s.phase==='roll';legal.end=s.phase==='action';legal.bank=s.phase==='action';legal.buy=s.phase==='action'&&s.deck.length>0&&has(p,costs.development);if(['roll','action'].includes(s.phase)&&!s.played)legal.play=[...new Set(p.dev.filter(d=>d.bought<s.turnNumber&&d.type!=='point'&&(d.type!=='roads'||locations(s,p,'road').length)).map(d=>d.type))];for(const k of ['road','settlement','city'])if(s.phase==='setupSettlement'&&k==='settlement'||s.phase==='setupRoad'&&k==='road'||s.phase==='freeRoads'&&k==='road'||s.phase==='action'&&has(p,costs[k]))legal[k]=locations(s,p,k,s.phase.startsWith('setup'));if(s.phase==='steal')legal.victims=victims(s,id);}
 return structuredClone({phase:s.phase,sequence:s.sequence,turnNumber:s.turnNumber,turnId:current(s).id,board:s.board,bank:s.bank,deckCount:s.deck.length,robber:s.robber,dice:s.dice,longest:s.longest,army:s.army,winner:s.winner,log:s.log,offer:s.offer,discard:s.discard,hand:p?.hand??empty(),dev:p?.dev??[],rates:rates(s,id),legal,players:s.players.map(q=>({id:q.id,resources:total(q.hand),development:q.dev.length,knights:q.knights,roadLength:q.roadLength,score:score(s,q,q.id===id||s.phase==='finished'),pieces:pieces(s,q.id)}))});},
 isFinished:s=>s.phase==='finished',
 result:s=>({winners:[s.winner],rounds:s.turnNumber,scoreDirection:'higher',players:s.players.map(p=>({id:p.id,score:score(s,p,true),rank:p.id===s.winner?1:2}))}),
};
