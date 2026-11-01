import {escapeHtml as e,button as b} from '../../ui.js';
import {resultActions} from '../../result-actions.js';
const stages=['底牌','翻牌','转牌','河牌'],suits={s:'♠',h:'♥',c:'♣',d:'♦'},ranks={11:'J',12:'Q',13:'K',14:'A'};
const card=c=>c?`<span class="gang-card ${'hd'.includes(c.suit)?'red':''}" aria-label="${suits[c.suit]}${ranks[c.rank]||c.rank}"><b>${ranks[c.rank]||c.rank}</b><i>${suits[c.suit]}</i></span>`:'<span class="gang-card gang-back" aria-label="未揭示">✦</span>';
const meter=(label,value,kind)=>`<div class="gang-meter ${kind}" aria-label="${label} ${value}/3"><span>${label}</span><div>${[0,1,2].map(i=>`<i class="${i<value?'filled':''}">${kind==='vault'?'◆':'!'}</i>`).join('')}</div><b>${value}/3</b></div>`;
export function createGangRenderer(send){
 return {
  render(snapshot,me){
   const s=snapshot.game,own=s.players.find(p=>p.id===me.id),active=!!own&&!snapshot.spectator&&!snapshot.dissolution,playing=s.phase==='playing';
   const name=id=>snapshot.players.find(p=>p.id===id)?.name||'玩家';
   const held=own?.chips[s.round],taken=s.players.filter(p=>p.chips[s.round]!==null).length;
   const identity=id=>`${e(name(id))}${snapshot.players.find(p=>p.id===id)?.isBot?'<em class="gang-ai">AI</em>':''}`;
   return `<section class="gang">
    <header><div><small>行动 ${s.heist}</small></div><div class="gang-meters">${meter('金库',s.vaults,'vault')}${meter('警报',s.alarms,'alarm')}</div></header>
    <nav aria-label="行动阶段">${stages.map((x,i)=>`<span class="${i===s.round?'current':i<s.round?'complete':''}" ${i===s.round?'aria-current="step"':''}><i class="color-${i}">${i<s.round?'✓':i+1}</i>${x}</span>`).join('')}</nav>
    <div class="gang-table-heading"><span>公共牌</span><span>${playing?`${stages[s.round]} · ${taken}/${s.players.length} 人已取筹码`:'摊牌'}</span></div>
    <div class="gang-board">${Array.from({length:5},(_,i)=>card(s.board[i])).join('')}</div>
    <div class="gang-seats">${s.players.map(p=>`<article class="${p.id===me.id?'self':''}"><div class="gang-seat-heading"><b>${identity(p.id)}${p.id===me.id?' · 你':''}</b><span class="gang-current-chip color-${s.round}" aria-label="当前筹码 ${p.chips[s.round]??'待选择'}">${p.chips[s.round]===null?'—':p.chips[s.round]+' ★'}</span></div><div class="gang-history" aria-label="筹码历史">${p.chips.map((v,i)=>`<span class="${i===s.round?'now':''}"><small>${stages[i]}</small><b class="color-${i}">${v??'·'}</b></span>`).join('')}</div></article>`).join('')}</div>
    ${playing?(own?`<div class="gang-controls"><section class="gang-private"><small>你的底牌 <span>仅你可见</span></small><div class="gang-hand">${own.hand.map(card).join('')}</div></section><section class="gang-pick"><div class="gang-action-heading"><h2>${held==null?'选择牌力位置':`你持有 ${held} 星`}</h2><span aria-live="polite">${held==null?'请选择筹码':'等待同伴 · 可以换筹码'}</span></div><div class="gang-scale"><span>较弱</span><span>较强</span></div><div class="gang-options">${s.players.map((_,i)=>{const owner=s.players.find(p=>p.chips[s.round]===i+1);return `<button type="button" data-action="game:take" data-chip="${i+1}" class="gang-option ${owner?.id===me.id?'selected':''}" ${!active||owner?.id===me.id?'disabled':''} aria-label="${owner?`拿取 ${name(owner.id)} 的`:'选择'} ${i+1} 星筹码"><strong class="gang-token color-${s.round}">${i+1}<small>★</small></strong><span>${owner?e(owner.id===me.id?'你':name(owner.id)):'可取'}</span></button>`;}).join('')}</div><div class="gang-action-foot"><small>全员取齐即翻牌</small>${b('放回筹码','game:return',!active||held==null,'class="gang-return"')}</div></section></div>`:'<p class="gang-watch">观战中 · 底牌保密</p>'):`<section class="gang-result"><div class="gang-result-heading"><h2>${s.phase==='finished'?(s.vaults===3?'完美收工':'行动失败'):(s.showdown.success?'金库已打开':'警报响起')}</h2><span>红筹码顺序 · 由弱到强</span></div>${s.showdown.rows.map((r,i)=>{const prev=s.showdown.rows[i-1];const wrong=prev&&compareScores(prev.score,r.score)>0;return `<div class="gang-result-row ${wrong?'wrong':''}"><b>${r.chip} ★ · ${identity(r.id)}</b><span class="gang-revealed">${r.hand.map(card).join('')}</span><strong>${e(r.name)}${wrong?' · 顺序错误':''}</strong><div class="gang-best"><small>最佳五张</small>${r.cards.map(card).join('')}</div></div>`;}).join('')}${s.phase==='result'?b(s.ready.includes(me.id)?`等待同伴 · ${s.ready.length}/${s.players.length}`:'下一次行动','game:next',!active||s.ready.includes(me.id),'class="gold-button gang-next"'):snapshot.spectator?'':resultActions(snapshot,me)}</section>`}
    <details><summary>玩法手卡</summary><p>通过筹码表达牌力，不能透露或暗示底牌。每轮每人一枚，可以拿走他人的筹码；换取时旧筹码回到桌面。全员取齐即推进。</p><p>红筹码从小到大，最佳五张牌须由弱到强，平手允许。三个金库获胜，三次警报失败。</p><p>高牌 → 一对 → 两对 → 三条 → 顺子 → 同花 → 葫芦 → 四条 → 同花顺。A 可组成 A2345；同牌型比较点数和踢脚，花色不分大小。</p></details></section>`;
  },
  handle(action,el){if(action==='take')send({type:'take',chip:Number(el.dataset.chip)});if(action==='return'||action==='next')send({type:action});}
 };
}
function compareScores(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
