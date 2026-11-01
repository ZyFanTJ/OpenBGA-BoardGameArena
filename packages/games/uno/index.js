import { ensure } from '../../platform/errors.js';
import { COLORS, makeDeck, points, shuffle } from './cards.js';
import { safeCommand, unoBot } from './bot.js';

const clone = value => structuredClone(value);
const ended = s => ['roundEnd','finished'].includes(s.phase);
const index = (s, steps = 1) => (s.turn + steps * s.direction + s.players.length * 2) % s.players.length;
function log(s, type, actorId, extra = {}) {
  const entry = { sequence: s.sequence, type, actorId, ...extra };
  s.log.push(entry); s.log = s.log.slice(-24); s.lastEvent = entry;
}
function draw(s, player, count, random) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length > 1) {
      const top = s.discard.pop(); s.deck = shuffle(s.discard, random); s.discard = [top];
    }
    if (!s.deck.length) break;
    const card = s.deck.pop(); player.hand.push(card); cards.push(card);
  }
  if (player.hand.length !== 1) { player.announced = false; if (s.unoWindow === player.id) s.unoWindow = null; }
  return cards;
}
function advance(s, steps = 1) { s.turn = index(s, steps); s.turnNumber++; s.drawnId = null; s.phase = 'turn'; }
function settle(s) {
  const winner = s.players.find(p => !p.hand.length);
  if (!winner) return;
  const rows = s.players.map(p => ({ id: p.id, remaining: p.hand.reduce((n,c)=>n+points(c),0) }));
  const score = rows.reduce((n,p)=>n+p.remaining,0); winner.total += score;
  s.roundResult = { winnerId: winner.id, points: score, players: rows };
  s.history.push({ round: s.round, ...clone(s.roundResult) }); s.unoWindow = null; s.pending = null; s.drawnId = null;
  s.phase = winner.total >= s.target ? 'finished' : 'roundEnd'; s.winners = s.phase === 'finished' ? [winner.id] : [];
}
function startRound(s, random) {
  s.round++; s.direction = 1; s.phase = 'turn'; s.deck = shuffle(makeDeck(), random); s.discard = [];
  s.players.forEach(p=>{p.hand=[];p.announced=false;});
  for (let i=0;i<7;i++) for (const p of s.players) draw(s,p,1,random);
  let top = s.deck.pop();
  while (top.value === 'wild4') { s.deck = shuffle([top,...s.deck],random); top=s.deck.pop(); }
  s.discard=[top]; s.color=top.color; s.turn=(s.dealer+1)%s.players.length; s.turnNumber++;
  s.pending=null; s.drawnId=null; s.unoWindow=null; s.evidence=null; s.roundResult=null;
  if (top.value === 'wild') s.phase='color';
  if (top.value === 'reverse') {s.direction=-1;s.turn=s.dealer;}
  if (top.value === 'skip') s.turn=index(s);
  if (top.value === 'draw2') {draw(s,s.players[s.turn],2,random);s.turn=index(s);}
  log(s,'start',null);
}
function create(ids, options = {}, random) {
  ensure(Array.isArray(ids) && ids.length>=2 && ids.length<=10 && new Set(ids).size===ids.length, '需要 2–10 位不同玩家');
  ensure(options && typeof options==='object' && !Array.isArray(options) && Object.keys(options).every(k=>k==='target') && [100,300,500].includes(options.target??500), '计分目标只能为 100、300 或 500');
  const dealer = shuffle(ids.map((_,i)=>i),random)[0];
  const s={players:ids.map(id=>({id,hand:[],total:0,announced:false})),target:options.target??500,dealer,round:0,turn:0,turnNumber:0,sequence:0,history:[],log:[],winners:[]};
  startRound(s,random); return s;
}
function matches(s, card) { return !card.color || card.color===s.color || card.value===s.discard.at(-1).value; }
function apply(input, playerId, c, {random,isHost=false} = {}) {
  ensure(c && typeof c==='object' && !Array.isArray(c),'行动格式无效');
  ensure(input.players.some(p=>p.id===playerId),'你不在本局中',403);
  const s=clone(input), me=s.players.find(p=>p.id===playerId); s.sequence++;
  if(c.type==='nextRound') {
    ensure(s.phase==='roundEnd' && isHost,'只有房主能在结算后开始下一轮',403);
    s.dealer=(s.dealer+1)%s.players.length;startRound(s,random);return s;
  }
  ensure(!ended(s),'本轮已经结束');
  if(c.type==='uno') {
    ensure(s.unoWindow===me.id && me.hand.length===1 && !me.announced,'现在无需补喊 UNO');
    me.announced=true;s.unoWindow=null;log(s,'uno',me.id);return s;
  }
  if(c.type==='catch') {
    const target=s.players.find(p=>p.id===s.unoWindow);
    ensure(target && target.id!==me.id && !target.announced && target.hand.length===1,'没有可抓漏喊的玩家');
    const count=draw(s,target,2,random).length;s.unoWindow=null;log(s,'catch',me.id,{targetId:target.id,count});return s;
  }
  ensure(s.players[s.turn].id===me.id,'还没轮到你',403);
  if(c.type==='color') {
    ensure(s.phase==='color' && COLORS.includes(c.color),'请选择起始颜色');s.color=c.color;s.phase='turn';log(s,'color',me.id,{color:c.color});return s;
  }
  if(s.phase==='challenge') {
    ensure(['accept','challenge'].includes(c.type),'请先接受 +4 或质疑');
    s.unoWindow=null; const pending=s.pending, actor=s.players.find(p=>p.id===pending.actorId);
    if(c.type==='challenge') {
      s.evidence={viewerId:me.id,actorId:actor.id,hand:clone(pending.hand),illegal:pending.illegal,previousColor:pending.previousColor};
      if(pending.illegal) {
        const count=draw(s,actor,4,random).length;s.pending=null;s.phase='turn';s.turnNumber++;
        log(s,'challengeWon',me.id,{targetId:actor.id,count});
      } else {
        const count=draw(s,me,6,random).length;s.pending=null;advance(s);log(s,'challengeLost',me.id,{count});settle(s);
      }
    } else {
      s.evidence=null; const count=draw(s,me,4,random).length;s.pending=null;advance(s);log(s,'accept',me.id,{count});settle(s);
    }
    return s;
  }
  ensure(['turn','drawn'].includes(s.phase),'请先完成当前行动');
  if(c.type==='draw') {
    ensure(s.phase==='turn','每回合只能抽一张牌');s.unoWindow=null;s.evidence=null;
    const cards=draw(s,me,1,random);s.drawnId=cards[0]?.id??null;
    log(s,'draw',me.id,{count:cards.length});
    if(cards.length && matches(s,cards[0])) s.phase='drawn'; else advance(s);
  } else if(c.type==='pass') {
    ensure(s.phase==='drawn','只有抽牌后可以结束回合');s.unoWindow=null;s.evidence=null;advance(s);log(s,'pass',me.id);
  } else if(c.type==='play') {
    const card=me.hand.find(card=>card.id===c.cardId);
    ensure(card && matches(s,card),'请选择能匹配颜色、数字或符号的手牌');
    ensure(s.phase!=='drawn' || card.id===s.drawnId,'抽牌后只能打出刚抽到的牌');
    ensure(card.color || COLORS.includes(c.color),'万能牌需要选择颜色');
    ensure(c.uno===undefined || typeof c.uno==='boolean','UNO 宣告格式无效');
    const previousColor=s.color,illegal=card.value==='wild4' && me.hand.some(other=>other.id!==card.id && other.color===s.color);
    s.unoWindow=null;s.evidence=null;me.hand=me.hand.filter(other=>other.id!==card.id);s.discard.push(card);s.color=card.color??c.color;s.drawnId=null;
    me.announced=me.hand.length===1 && c.uno===true;
    if(me.hand.length===1 && !me.announced)s.unoWindow=me.id;
    const event={card:clone(card),color:s.color,uno:me.announced};
    if(card.value==='wild4') {
      s.pending={actorId:me.id,illegal,hand:clone(me.hand),previousColor};advance(s);s.phase='challenge';
    } else {
      let steps=1;
      if(card.value==='reverse') {s.direction*=-1;if(s.players.length===2)steps=2;}
      if(card.value==='skip')steps=2;
      if(card.value==='draw2') {const target=s.players[index(s)];event.targetId=target.id;event.count=draw(s,target,2,random).length;steps=2;}
      advance(s,steps);settle(s);
    }
    log(s,'play',me.id,event);
  } else ensure(false,'未知游戏行动');
  return s;
}
function view(s,id) {
  const me=s.players.find(p=>p.id===id), active=s.players[s.turn].id===id, canPlay=active && ['turn','drawn'].includes(s.phase);
  return {gameId:'uno',phase:s.phase,round:s.round,sequence:s.sequence,turnNumber:s.turnNumber,turnId:s.players[s.turn].id,dealerId:s.players[s.dealer].id,
    direction:s.direction,color:s.color,target:s.target,deckCount:s.deck.length,discardTop:clone(s.discard.at(-1)),hand:clone(me?.hand??[]),
    drawnId:active?s.drawnId:null,unoWindow:s.unoWindow,
    players:s.players.map(p=>({id:p.id,count:p.hand.length,total:p.total,announced:p.announced})),
    pending:s.pending?{actorId:s.pending.actorId,previousColor:s.pending.previousColor}:null,
    evidence:s.evidence?.viewerId===id?clone(s.evidence):null,
    legal:{play:canPlay?(me?.hand??[]).filter(c=>matches(s,c) && (s.phase!=='drawn'||c.id===s.drawnId)).map(c=>c.id):[],
      draw:active&&s.phase==='turn',pass:active&&s.phase==='drawn',challenge:active&&s.phase==='challenge',color:active&&s.phase==='color',
      catch:!!me&&!!s.unoWindow&&s.unoWindow!==id,uno:s.unoWindow===id,
      wild4Risk:canPlay&&(me?.hand??[]).some(c=>c.color===s.color)},
    lastEvent:clone(s.lastEvent),log:clone(s.log),roundResult:clone(s.roundResult),history:clone(s.history),winners:[...s.winners]};
}
export const uno={manifest:{id:'uno',title:'UNO',rulesVersion:'classic-108-W2085-online-1',stateVersion:1,minPlayers:2,maxPlayers:10},
  create,apply,view,spectatorView:s=>view(s,null),bot:unoBot,timeout:safeCommand,isFinished:s=>s.phase==='finished',
  turn(s){return ended(s)?null:{key:`uno:${s.round}:${s.turnNumber}:${s.phase==='challenge'?'challenge':'turn'}`,players:[s.players[s.turn].id]};},
  result(s){return {winners:[...s.winners],rounds:s.round,scoreDirection:'higher',players:s.players.map(p=>({id:p.id,score:p.total,rank:1+s.players.filter(q=>q.total>p.total).length,breakdown:[{label:'累计得分',value:p.total}]}))};}};
