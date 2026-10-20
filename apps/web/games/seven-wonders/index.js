import {createDiscoveryTracker,islandSummary,discoveryDialog} from './discoveries.js';
import {tableOverview,createTablePeek} from './overview.js';
import {battleReport,reportBanner,createReportTracker} from './reports.js';
import {extensionArt,fleetPanel,expansionCity,fleetNames,fleetReward} from './expansions.js';
import {resourceLedger,collectionBar,outcomePreview,chainDetails} from './hud.js';
import {outgoingMarks,requiredMark,ownedChainBar,chainRoutes} from './chains.js';
import { cityArt, cardIllustration } from './art.js';
export { cityArt } from './art.js';
import { escapeHtml as e, button as b } from '../../ui.js';
import { icon, resourceNames, colorNames, scienceIcons, colorIcons, production, costSymbols, effectSymbols } from './symbols.js';

const total = plan => plan.left + plan.right + plan.bank + (plan.farLeft??0) + (plan.farRight??0);
const costText = cost => cost.age?'按当前时代支付钱币':[cost.coins ? `${cost.coins} 钱币` : '', [...cost.resources].map(r => resourceNames[r]).join('、')].filter(Boolean).join('，') || '免费';
const productionText = slots => slots.map(slot => [...slot].map(r => resourceNames[r]).join('/')).join('、');
const control = (html, action, attributes = '', disabled = false) => `<button type="button" data-action="game:${action}" ${attributes} ${disabled ? 'disabled' : ''}>${html}</button>`;
const metric = (symbol, value, label) => `<span class="sw-metric" title="${e(label)}" aria-label="${e(label)} ${e(value)}">${icon(symbol)}<b>${e(value)}</b></span>`;

export function createSevenWondersRenderer(send, rerender) {
  let current, user, epoch = -1, selected = null, mode = 'build', planIndex = 0;
  let overlay = null, returnOverlay = null, focusRequested = false, restoreFocus = null;
  let filter = 'all', queriedCard = null, chainFilter = 'all';
  let railObserver = null,navalOn=false,sellFleet=false,stageIndex=null;
  const reportTracker = createReportTracker();
  const discoveryTracker=createDiscoveryTracker(),tablePeek=createTablePeek();
  const name = id => current.players.find(p => p.id === id)?.name ?? '玩家';
  const player = id => current.game.players.find(p => p.id === id);
  const sourceCards=()=>current.game.phase==='leaderDraft'?current.game.leaderDraftChoices:current.game.phase==='explore'?current.game.exploration?.cards??[]:current.game.phase==='revive'?current.game.discardChoices:current.game.hand;
  const active = () => !current.dissolution && (current.game.canChoose || current.game.reviveId === user.id || current.game.leaderDraftChoices?.length>0 || !!current.game.exploration);
  const selectedCard = () => sourceCards().find(c => c.id === selected);
  const closeButton = () => control(icon(returnOverlay ? 'left' : 'close'), 'close', `class="sw-close" aria-label="${returnOverlay ? ({action:'返回选牌操作',table:'返回全桌建筑',history:'返回上次揭晓',report:'返回时代战报'}[returnOverlay.type]??'返回') : '关闭详情'}"`);

  function cardFace(c, { interactive = true, enabled = true, query = false, miniature = false, availability = true } = {}) {
    const plans=c.build?.plans, cheapest=plans?.[0], reason=cheapest?.reason;
    const priceLabel=plans?(plans.length?(reason==='chain'?'连锁免费':reason==='wonder'?'奇迹能力免费':`${total(cheapest)} 钱币`):c.build.reason):'';
    const badge=availability&&plans?(!plans.length?icon('lock'):`${icon(reason==='chain'?'check':reason==='wonder'?'wonder':'coin')}<b>${reason==='chain'?'免费':total(cheapest)}</b>`):'';
    const timing=c.effect.production?'每回合':c.effect.income&&c.effect.scoring?'收入 / 终局':c.effect.scoring||c.effect.complete||c.effect.wild?'终局':c.effect.income||c.effect.coins?'揭晓收入':'';
    const tag=interactive?'button':'div';
    return `<${tag} ${interactive?`type="button" data-action="game:${query?'query-card':'card'}" data-card="${e(c.id)}" ${enabled?'':'disabled'} aria-pressed="${(query?queriedCard:selected)===c.id}"`:''} title="${e(c.text)}" class="sw-card sw-${c.color} ${miniature?'sw-card-mini':''} ${selected===c.id&&!query?'sw-selected':''}" aria-label="${e([c.name,colorNames[c.color],c.text,priceLabel].filter(Boolean).join('，'))}"><span class="sw-card-identity"><span class="sw-card-class">${icon(colorIcons[c.color]??(c.color==='white'?'crown':'island'))}${colorNames[c.color]??(c.color==='white'?'领袖':'岛屿')}<i>${c.age?['I','II','III'][c.age-1]:'♛'}</i></span><strong class="sw-card-name">${e(c.name)}</strong></span><span class="sw-card-scene">${extensionArt(c)??cardIllustration(c)}${outgoingMarks(c)}</span><span class="sw-card-visual"><small class="sw-effect-timing">${c.effect.discount?'贸易':timing}</small><span class="sw-card-symbols" role="img" aria-label="${e(c.text)}">${effectSymbols(c.effect)}</span></span><span class="sw-card-top"><span class="sw-card-cost ${reason==='chain'?'sw-cost-waived':''}" title="${e(costText(c.cost))}">${costSymbols(c.cost)||'<small>无费用</small>'}</span>${requiredMark(c,query?[]:player(user.id).cards)}${badge?`<span class="sw-card-quote ${!plans.length?'sw-unavailable':reason==='chain'?'sw-quote-chain':''}" title="${e(priceLabel)}">${badge}</span>`:''}</span></${tag}>`;
  }

  function stageTrack(p) {
    const built=p.builtStages??Array.from({length:p.stages},(_,n)=>n);
    return `<div class="sw-stage-track" role="group" aria-label="奇迹 ${p.stages}/${p.stageList.length}">${p.stageList.map((stage,i)=>{
      const done=built.includes(i),next=!done&&(p.unorderedStages||i===p.stages);
      return control(`<span class="sw-stage-number">${done?icon('check'):i+1}</span><span class="sw-stage-effect">${effectSymbols(stage.effect)}</span><span class="sw-stage-price" aria-label="印刷成本：${e(costText(stage.cost))}">${costSymbols(stage.cost)||'<small>免费</small>'}</span>`,'stages',`class="sw-stage ${done?'sw-built':next?'sw-next':''}" data-player="${e(p.id)}" title="${e(`阶段 ${i+1}：${stage.text}；印刷成本 ${costText(stage.cost)}`)}" aria-label="${e(`阶段 ${i+1}，${done?'已完成':'未完成'}，${stage.text}，印刷成本 ${costText(stage.cost)}`)}"`);
    }).join('')}</div>`;
  }

  function seats() {
    const s = current.game;
    return `<nav class="sw-seats sw-seats-${s.players.length}" aria-label="全桌状态">${s.players.map(p => {
      const status=p.actionStatus??(s.phase==='setup'?(p.side?'confirmed':'waiting'):p.submitted?'confirmed':'waiting'),ready=status==='confirmed';
      const relation = p.id === user.id ? '你' : s.neighbors[0] === p.id ? '左邻' : s.neighbors[1] === p.id ? '右邻' : '';
      return control(`<span class="sw-seat-avatar ${p.id === user.id ? 'sw-own-avatar' : ''}">${e(name(p.id).slice(0,1))}</span><span class="sw-seat-body"><b>${e(name(p.id))}</b><span>${metric('coin',p.coins,'钱币')}${metric('shield',p.shields,'军力')}${p.fleets?metric('naval',p.naval,'海军'):''}</span></span><span class="sw-ready-dot ${ready ? 'sw-ready' : ''}" aria-label="${ready?'已确认':status==='waiting'?'待操作':'本步无需操作'}">${ready ? icon('check') : ''}</span><span class="sw-seat-buildings">${icon('cards')}<b>${p.cards.length}</b></span>`, 'inspect', `class="sw-seat ${ready?'sw-seat-confirmed':status==='waiting'?'sw-seat-waiting':'sw-seat-inactive'} ${p.id === user.id ? 'sw-self' : ''} ${s.neighbors.includes(p.id) ? 'sw-neighbor' : ''}" data-player="${e(p.id)}" title="${e(`${relation ? relation + ' · ' : ''}${p.wonderName}`)}" aria-label="查看 ${e(name(p.id))} 的城市${relation ? `，${relation}` : ''}，${ready?'已确认':status==='waiting'?'待操作':'本步无需操作'}"`);
    }).join('')}</nav>`;
  }

  function neighborBoard(id,side) {
    const p=player(id),own=player(user.id),difference=own.shields-p.shields;
    return `<aside class="sw-neighbor-board" aria-label="${side}邻国">${control(`<span class="sw-neighbor-direction">${icon(side==='左'?'left':'right')}${side}邻</span><h3>${e(name(id))}</h3><span class="sw-neighbor-city">${p.wonderName}</span>`,'inspect',`class="sw-neighbor-title" data-player="${e(id)}"`)}<div class="sw-neighbor-scene">${cityArt(p.wonder,p.side)}</div><div class="sw-border-strength">${metric('shield',p.shields,'军力')}<span class="${difference>0?'sw-winning':difference<0?'sw-losing':''}" title="按当前公开军力比较">${difference>0?'你领先':difference<0?'你落后':'势均力敌'}</span></div><div class="sw-neighbor-trade"><h4>可购买产能</h4>${resourceLedger(p.tradeable,{compact:true})}</div>${control(`<span>已建建筑</span><b>${p.cards.length}</b>${icon('right')}`,'inspect',`class="sw-neighbor-buildings" data-player="${e(id)}" aria-label="查看 ${e(name(id))} 的 ${p.cards.length} 张已建建筑"`)}</aside>`;
  }
  function ownBoard() {
    const p=player(user.id),score=current.game.scores.find(r=>r.id===p.id),last=current.game.lastActions.find(a=>a.id===p.id);
    const gained=last?.action==='build'?last.card.effect.production??[]:last?.action==='wonder'?p.stageList[last.stage-1]?.effect.production??[]:[];
    return `<div class="sw-civilizations">${neighborBoard(current.game.neighbors[0],'左')}<section class="sw-own-board" aria-label="你的城市"><div class="sw-wonder-scene">${cityArt(p.wonder,p.side)}<div class="sw-board-title"><small>你的文明</small>${control(`<h2>${p.wonderName}</h2>${icon(p.side==='night'?'moon':'sun')}`,'inspect',`class="sw-city-link" data-player="${e(p.id)}" aria-label="查看我的城市"`)}<span>${p.subtitle}</span></div></div><div class="sw-wonder-progress"><div class="sw-zone-heading"><h3>奇迹建设</h3><span>${p.stages} / ${p.stageList.length}</span></div>${stageTrack(p)}</div><div class="sw-supply"><div class="sw-zone-heading"><h3>每回合产能</h3><span>永久供给</span></div>${resourceLedger(p.production,{gained})}</div><div class="sw-city-hud"><div class="sw-player-totals">${metric('coin',p.coins,'钱币')}${metric('shield',p.shields,'军力')}<span class="sw-science-totals">${scienceIcons.map((key,i)=>metric(key,score.science.counts[i],['圆规','齿轮','石板'][i])).join('')}${score.science.wild?`<span title="任选科技符号">+${score.science.wild} ?</span>`:''}</span></div>${collectionBar(p)}</div>${ownedChainBar(current.game,p)}${p.leaders||p.islands?`<div class="sw-civilization-assets">${p.leaders?control(`${icon('crown')}领袖 ${p.leaders.length} · ${p.leaders.map(c=>e(c.name)).join(' / ')}`,'expansion-city',`data-player="${e(p.id)}"`):''}${p.islands?control(`${icon('island')}岛屿 ${p.islands.length}`,'expansion-city',`data-player="${e(p.id)}"`):''}</div>`:''}${islandSummary(p.islands,p.id)}</section>${neighborBoard(current.game.neighbors[1],'右')}</div>`;
  }

  function setup() {
    const s = current.game, p = player(user.id);
    if(p.side) return `<section class="sw-waiting">${icon('check')}<h2>${p.wonderName}</h2><p>等待同桌</p></section>`;
    return `<section class="sw-setup"><h2>${p.wonderName}</h2><div class="sw-side-options">${s.setupChoices.map(option => `<article class="sw-side sw-side-${option.side}"><div class="sw-side-scene">${cityArt(p.wonder,option.side)}<h3>${icon(option.side === 'day' ? 'sun' : 'moon')}${option.side === 'day' ? '日面' : '夜面'}</h3></div><div class="sw-side-stages">${option.stages.map((stage,i) => `<div><small>${i + 1}</small><span class="sw-stage-effect" title="${e(stage.text)}">${effectSymbols(stage.effect)}</span><span class="sw-stage-cost">${costSymbols(stage.cost)}</span></div>`).join('')}</div><details class="sw-side-help"><summary>能力</summary>${option.stages.map((stage,i) => `<p>${i + 1} · ${e(stage.text)}</p>`).join('')}</details>${b('选择','game:side',!!current.dissolution,`data-side="${option.side}" class="sw-primary" aria-label="选择${option.side === 'day' ? '日' : '夜'}面"`)}</article>`).join('')}</div></section>`;
  }

  function hand() {
    const s = current.game, source = sourceCards(), revive = s.phase === 'revive',recruit=['recruit','recruitExtra'].includes(s.phase),draft=s.phase==='leaderDraft',explore=s.phase==='explore';
    const ready = s.players.filter(p => p.actionStatus==='confirmed'||!p.actionStatus&&p.submitted).length, all=s.players.filter(p=>p.actionStatus?p.actionStatus!=='inactive':draft||recruit||p.handCount).length;
    return `${leaderFlow()}<section class="sw-hand-section"><div class="sw-hand-heading"><h2>${draft?'选择领袖':explore?'探索岛屿':recruit?'招募领袖':revive ? '回收' : s.phase === 'extra' ? '额外行动' : '手牌'}<small>${draft&&source.length?`${source.length} 选 1`:recruit&&source.length?`${source.length} 位候选 · 本次 1 位`:source.length||''}</small></h2><div class="sw-hand-controls"><span class="sw-turn-status" role="status" ${s.pending ? 'aria-label="选择已确认"' : ''}>${current.dissolution ? '行动暂停' : s.pending ? `${icon('check')}已确认` : revive && s.reviveId !== user.id ? `${e(name(s.reviveId))} · 回收` : `${ready} / ${all}`}</span><div class="sw-hand-navigation">${control(icon('left'),'hand-left','aria-label="向左浏览手牌"')}${control(icon('right'),'hand-right','aria-label="向右浏览手牌"')}</div></div></div><div class="sw-hand ${!active() ? 'sw-hand-locked' : ''}" aria-label="${revive ? '可回收建筑' : '你的手牌'}">${source.map(c => cardFace(c,{enabled:active(),availability:active()})).join('') || `<div class="sw-table-wait">${icon('cards')}<span>等待同桌</span></div>`}</div></section>`;
  }

  function leaderFlow(){
    const s=current.game;if(!['leaderDraft','recruit','recruitExtra'].includes(s.phase))return '';
    const draft=s.phase==='leaderDraft';
    return `<div class="sw-leader-flow"><ol aria-label="领袖与时代阶段"><li class="${draft?'sw-flow-current':''}"><i>1</i>开局选将</li><li class="${!draft?'sw-flow-current':''}"><i>2</i>时代 ${['I','II','III'][s.age-1]} 招募</li><li><i>3</i>时代选牌</li></ol><details><summary>为什么有 4 位候选？</summary><p>开局通过传牌保留 4 位候选领袖，最后一张自动保留。三个时代开始前各处理 1 位：招募、用于奇迹或出售。未招募的候选不会生效；第三时代通常从剩下的 2 位中选 1 位，罗马夜面等能力另行处理。</p></details></div>`;
  }

  function taxImpact(effect,p,color){const pos=color==='yellow'?p.fleets.yellow+1:0,tax=Math.max(effect?.tax??0,pos===2?1:pos===4?2:pos===6?4:0);if(!tax&&!effect?.pirate)return '';return `<div class="sw-tax-impact" aria-label="按当前商业等级预览钱币损失">${current.game.players.filter(x=>x.id!==p.id).map(x=>`<span>${e(name(x.id))} −${x.islands?.some(c=>c.effect.taxShield)?0:effect?.pirate?x.commercial:Math.max(0,tax-x.commercial)}${icon('coin')}</span>`).join('')}</div>`;}
  function selectionDialog(c){const s=current.game;return `<dialog data-surface="action" class="sw-dialog sw-selection-dialog" aria-label="${s.phase==='leaderDraft'?'选择领袖':'选择岛屿'}"><div class="sw-drawer-heading"><h2>${s.phase==='leaderDraft'?'选择领袖':'探索岛屿'}</h2>${closeButton()}</div><div class="sw-selection-content">${cardFace(c,{interactive:false,availability:false})}<div><h3>${e(c.name)}</h3><div class="sw-selection-effect">${effectSymbols(c.effect)}</div><p>${e(c.text)}</p>${s.phase==='leaderDraft'?`<span class="sw-selection-cost">未来招募费用 ${costSymbols(c.cost)}</span>`:''}${control('确认选择','confirm','class="sw-primary"',!active())}</div></div></dialog>`;}
  function abilityPanel(){const s=current.game,p=player(user.id);if(s.phase==='ability'){const a=s.ability;return `<section class="sw-ability-panel"><h2>${a.kind==='advance'?'免费推进舰队':a.kind==='mummify'?'埋葬领袖':'移除胜利标记'}</h2>${a.playerId===user.id?`<div class="sw-ability-choices">${a.options.map((o,i)=>control(`${a.kind==='advance'?icon('ship'):a.kind==='mummify'?icon('crown'):icon('shield')}<b>${e(o.label)}</b>${a.kind==='advance'?fleetReward(o.value,p.fleets[o.value]+1):''}`,'ability',`data-index="${i}" class="sw-ability-choice ${a.kind==='advance'?'sw-'+o.value:''}"`,!!current.dissolution)).join('')}</div>`:`<p>等待 ${e(name(a.playerId))}</p>`}</section>`;}
    if(s.phase==='navalChoice')return `<section class="sw-ability-panel"><h2>全桌海战</h2><div class="sw-naval-comparison">${[...s.players].sort((a,b)=>b.naval-a.naval).map(x=>`<span>${e(name(x.id))}${icon('naval')}<b>${x.naval}</b></span>`).join('')}</div>${s.canNavalChoice?`<div class="sw-ability-choices">${control('参加海战','naval-choice','data-participate="true" class="sw-primary"',!!current.dissolution)}${control('退出本次海战','naval-choice','data-participate="false"',!!current.dissolution)}</div>`:'<p>等待海战决策</p>'}</section>`;
    if(s.phase==='leaderDraft'&&s.draftedLeaders.length)return `<div class="sw-drafted-leaders"><span>已选领袖</span>${s.draftedLeaders.map(c=>`<b title="${e(c.text)}">${icon('crown')}${e(c.name)}</b>`).join('')}<span>向右传递 →</span></div>`;return '';}
  function paymentTargets(plan) {
    const unavailable=!plan;plan??={left:0,right:0,bank:0};
    if(plan.reason==='chain')return '';
    if(['chain','wonder'].includes(plan.reason))return `<div class="sw-free-build-note">${icon(plan.reason==='chain'?'chain':'wonder')}<b>${plan.reason==='chain'?'通过连锁免费建造':'由奇迹能力免费建造'}</b></div>`;
    const sources=plan.sources??[],sourceSymbols=key=>production(sources.filter(x=>x.source===key).map(x=>x.resource))||'<span class="sw-source-empty">—</span>';
    return `<div class="sw-payment-targets" aria-label="建造资源来源"><div class="sw-payment-own"><span>自有产能</span><div>${sourceSymbols('own')}</div>${icon(unavailable?'lock':'check')}</div>${current.game.neighbors.map((id,i)=>control(`<span>${i===0?'左邻':'右邻'} · ${e(name(id))}</span><div>${sourceSymbols(i===0?'left':'right')}</div>${unavailable?'<small>查看产能</small>':metric('coin',i===0?plan.left:plan.right,'支付')}`,'inspect',`data-player="${e(id)}" class="sw-payment-target" aria-label="查看${i===0?'左':'右'}邻 ${e(name(id))} 的可购买资源"`)).join('')}${['farLeft','farRight'].filter(key=>plan[key]).map(key=>`<div class="sw-bank-payment">${key==='farLeft'?'左':'右'}隔一位 ${metric('coin',plan[key],'支付远方贸易')} ${sourceSymbols(key)}</div>`).join('')}${plan.bank?`<div class="sw-bank-payment">${icon('building')}银行 ${metric('coin',plan.bank,'支付银行')}</div>`:''}</div>`;
  }

  function actionDialog() {
    const s=current.game,c=selectedCard(),p=player(user.id);
    if(!c)return '';
    if(['leaderDraft','explore'].includes(s.phase))return selectionDialog(c);
    const revive=s.phase==='revive',wq=s.wonderOptions?.find(q=>q.stage-1===stageIndex)??s.wonderBuild,stage=p.stageList[(wq.stage??p.stages+1)-1],shipColor=mode==='wonder'?wq.naval?.color:c.color,navalQuote=mode==='wonder'?wq.naval:c.navalBuild;
    const quote=mode==='wonder'?(navalOn?navalQuote:wq):(navalOn?c.navalBuild:c.build);
    const plans=quote?.plans??[];
    planIndex=plans.length?planIndex%plans.length:0;
    const payment=plans[planIndex],selling=!revive&&mode==='sell';
    const result=revive||mode==='build'?c:mode==='wonder'?stage:{effect:{coins:3},text:'获得 3 钱币'};
    const rawPreview=mode==='wonder'?wq.preview:c.preview,preview=navalOn&&rawPreview?{...rawPreview,income:rawPreview.income+(shipColor==='yellow'&&p.fleets.yellow>=1&&p.fleets.yellow<5?p.fleets.yellow+1:0)}:rawPreview;
    const canConfirm=active()&&(revive||selling||!!payment),sources=sourceCards(),index=sources.findIndex(x=>x.id===selected);
    const freeReason=payment?.reason==='chain'?'连锁免费':payment?.reason==='wonder'?'奇迹能力免费':'免费';
    const summary=revive?'免费':selling?sellFleet?`${icon('ship')}<b>+1</b>`:`${icon('coin')}<b>+3</b>`:payment?total(payment)?`${icon('coin')}<b>${total(payment)}</b>`:`<b>${freeReason}</b>`:icon('lock');
    const confirmLabel=revive?'确认回收':selling?'确认卖牌':mode==='wonder'?'确认建造奇迹':c.color==='white'?'确认招募领袖':'确认建造建筑';
    return `<dialog data-surface="action" data-mode="${mode}" class="sw-dialog sw-action-dialog" aria-label="选牌操作"><div class="sw-action-layout"><section class="sw-action-preview"><div class="sw-card-navigation">${control(icon('left'),'previous','aria-label="上一张牌"',sources.length<2)}<span>${index+1} / ${sources.length}</span>${control(icon('right'),'next','aria-label="下一张牌"',sources.length<2)}</div>${mode==='build'||revive?cardFace(c,{interactive:false,availability:false}):`<div class="sw-card-back" aria-label="所选牌${selling?'用于出售':'作为奇迹建材'}"><span>VII</span>${icon('wonder')}<small>${e(c.name)}</small></div>`}${mode==='wonder'?`<div class="sw-bury-indicator">${icon('wonder')}作为奇迹建材</div>`:selling?`<div class="sw-bury-indicator">${icon('sell')}出售此牌</div>`:''}</section><section class="sw-action-controls"><div class="sw-action-top"><div class="sw-action-title"><span class="sw-category-label sw-${c.color}">${icon(colorIcons[c.color]??(c.color==='white'?'crown':'island'))}${colorNames[c.color]??(c.color==='white'?'领袖':'岛屿')}</span><h2>${e(c.name)}</h2></div>${closeButton()}</div>${revive||s.phase==='recruitExtra'?'':`<div class="sw-modes" role="group" aria-label="卡牌用途">${[['build',c.color==='white'?'crown':'building',c.color==='white'?'招募':'建筑'],['wonder','wonder','奇迹'],['sell','sell','卖牌']].map(([key,symbol,label])=>control(`${icon(symbol)}<span>${label}</span>`,'mode',`data-mode="${key}" class="sw-mode" aria-pressed="${mode===key}" aria-label="${key==='sell'?'卖牌 +3':key==='wonder'?'建奇迹':'建建筑'}"`,!!current.dissolution)).join('')}</div>`}${!revive&&mode==='wonder'&&s.wonderOptions?.length>1?`<div class="sw-wonder-stage-picker" role="group" aria-label="选择奇迹阶段">${s.wonderOptions.map(q=>control(`阶段 ${q.stage}`,'choose-stage',`data-stage="${q.stage-1}" aria-pressed="${q.stage===wq.stage}"`)).join('')}</div>`:''}${!revive&&!selling&&navalQuote&&p.fleets[shipColor]<6?control(`${icon('ship')}<span>同时建造${fleetNames[shipColor]}</span>${icon(navalOn?'check':'close')}`,'naval',`class="sw-naval-toggle sw-${shipColor}" aria-pressed="${navalOn}"`):''}${selling&&s.canSellFleet?`<div class="sw-selling-options">${control(`${icon('coin')}+3`,'sell-reward',`data-fleet="false" aria-pressed="${!sellFleet}"`)}${control(`${icon('ship')}商船 +1`,'sell-reward',`data-fleet="true" aria-pressed="${sellFleet}"`)}</div>`:''}${!canConfirm&&!selling&&!revive?`<p class="sw-cannot">${icon('lock')}${e(quote?.reason??'无法建造')}</p>`:''}<div class="sw-action-outcome"><div class="sw-preview-heading">${mode==='wonder'&&!revive?`<span>${p.wonderName} · 阶段 ${wq.stage??p.stages+1}</span>`:'<span>行动影响</span>'}<details class="sw-effect-help"><summary aria-label="查看效果说明">${icon('help')}</summary><p>${e(result?.text??'奇迹已全部完成')}</p></details></div><div class="sw-outcome-deltas">${selling&&sellFleet?`<div class="sw-delta sw-delta-changed">${icon('coin')}<span>预计自身收支</span><span class="sw-delta-values"><s>${p.coins}</s>${icon('arrow')}<b>${p.coins+([1,2,3,4].includes(p.fleets.yellow)?p.fleets.yellow+1:0)+(p.islands??[]).filter(c=>c.effect.advanceCoins).length}</b></span></div>`:result?outcomePreview(s,p,result.effect,preview,revive?{left:0,right:0,bank:0}:payment,selling?'sell':mode):'<p>奇迹已完成</p>'}</div></div>${c.expansion||result?.effect?.advance?`<p class="sw-extension-effect-copy">${e(result?.text??'')}</p>`:''}${navalOn&&!selling?`<div class="sw-naval-impact sw-${shipColor}"><span>${fleetNames[shipColor]} ${p.fleets[shipColor]} → ${p.fleets[shipColor]+1}</span><strong>${fleetReward(shipColor,p.fleets[shipColor]+1)}</strong></div>`:''}${selling&&sellFleet?`<div class="sw-naval-impact sw-yellow"><span>商船 ${p.fleets.yellow} → ${p.fleets.yellow+1}</span><strong>${fleetReward('yellow',p.fleets.yellow+1)}</strong></div>`:''}${!revive&&!selling?paymentTargets(payment):''}${taxImpact(result?.effect,p,selling&&sellFleet?'yellow':navalOn?shipColor:null)}${mode==='build'&&!selling?chainDetails(c,p):''}<div class="sw-action-utilities">${!revive&&!selling&&plans.length>1?`<label class="sw-plan-control"><span>${icon('coin')}付款</span><select id="sw-payment-plan" aria-label="付款方案">${plans.map((plan,i)=>`<option value="${i}" ${i===planIndex?'selected':''}>${total(plan)} · 左 ${plan.left} / 右 ${plan.right}${plan.bank?` / 银行 ${plan.bank}`:''}</option>`).join('')}</select></label>`:''}${!revive&&!selling&&(mode!=='wonder'||stage)?`<details class="sw-cost-detail"><summary>所需费用</summary><div>${costSymbols(mode==='wonder'&&stage?stage.cost:c.cost)}${navalOn?`<span>＋</span>${costSymbols(p.shipyard.costs[shipColor][p.fleets[shipColor]])}`:''}</div></details>`:''}</div><div class="sw-action-footer"><span class="sw-total" aria-label="${selling?'获得 3 钱币':payment?`支付 ${total(payment)} 钱币`:revive?'免费回收':'无法建造'}">${summary}</span>${b(revive?'回收':selling?sellFleet?'推进商船':'卖出 +3':mode==='wonder'?'建造奇迹':c.color==='white'?'招募领袖':'建造建筑','game:confirm',!canConfirm,`class="sw-primary sw-confirm" aria-label="${confirmLabel}"`)}</div></section></div></dialog>`;
  }

  function openCity(id, tab = 'cards', initialFilter = 'all', cardId = null) {
    if(['action','table','history'].includes(overlay?.type)) returnOverlay = {...overlay};
    overlay = {type:'city',id,tab}; filter = initialFilter; queriedCard = cardId; focusRequested = true;
    rerender();
  }

  const relation = id => id===user.id?'你':current.game.neighbors[0]===id?'左邻':current.game.neighbors[1]===id?'右邻':'同桌';
  function cityDialog() {
    const p=player(overlay.id),own=p.id===user.id,cards=p.cards.filter(c=>filter==='all'||c.color===filter),chosen=p.cards.find(c=>c.id===queriedCard);
    const switcher=`<nav class="sw-city-switcher" aria-label="查看玩家城市">${current.game.players.map(x=>control(`<span>${e(name(x.id))}</span><small>${relation(x.id)}</small>`,'city-player',`data-player="${e(x.id)}" aria-pressed="${x.id===p.id}"`)).join('')}</nav>`;
    const stages=`<div class="sw-stage-detail-list">${p.stageList.map((stage,i)=>`<section class="${(p.builtStages??Array.from({length:p.stages},(_,n)=>n)).includes(i)?'sw-built':''}"><span class="sw-stage-number">${(p.builtStages??Array.from({length:p.stages},(_,n)=>n)).includes(i)?icon('check'):i+1}</span><div><div class="sw-stage-effect" role="img" aria-label="${e(stage.text)}">${effectSymbols(stage.effect)}</div><div class="sw-stage-cost">${costSymbols(stage.cost)}</div><details><summary>能力</summary><p>${e(stage.text)}</p></details></div></section>`).join('')}</div>`;
    const buildings=`<div class="sw-color-filters" role="group" aria-label="建筑分类">${control(`全部 <b>${p.cards.length}</b>`,'filter',`data-filter="all" aria-label="全部建筑" aria-pressed="${filter==='all'}"`)}${Object.entries(colorNames).map(([key,label])=>control(`${icon(colorIcons[key])}<b>${p.cards.filter(c=>c.color===key).length}</b><small>${label}</small>`,'filter',`class="sw-${key}" data-filter="${key}" aria-label="${label}" aria-pressed="${filter===key}"`)).join('')}</div>${chosen?`<section class="sw-card-note sw-${chosen.color}" role="status"><div><b>${e(chosen.name)}</b><span>${effectSymbols(chosen.effect)}</span></div><p>${e(chosen.text)}</p>${chainDetails(chosen,p)}</section>`:''}<div class="sw-city-cards">${cards.map(c=>cardFace(c,{query:true,miniature:true,availability:false})).join('')||'<p class="sw-empty-city">尚未建造这类建筑</p>'}</div>`;
    return `<dialog data-surface="city" class="sw-dialog sw-city-drawer" aria-label="${own?'我的城市':'公开城市'}"><div class="sw-drawer-heading"><div><span>${e(name(p.id))} · ${relation(p.id)}</span><h2>${p.wonderName} ${p.side?icon(p.side==='night'?'moon':'sun'):''}</h2></div>${closeButton()}</div>${switcher}<div class="sw-drawer-stats">${metric('coin',p.coins,'钱币')}${metric('shield',p.shields,'军力')}${metric('points',current.game.scores.find(x=>x.id===p.id)?.total??0,'当前计分')}</div><section class="sw-drawer-resources"><h3>${own?'每回合产能':current.game.neighbors.includes(p.id)?'可购买产能':'公开产能'}</h3><div class="sw-production" role="group" aria-label="${e(productionText(own||!current.game.neighbors.includes(p.id)?p.production:p.tradeable))}">${production(own||!current.game.neighbors.includes(p.id)?p.production:p.tradeable,true)}</div></section><div class="sw-drawer-tabs" role="group" aria-label="城市内容">${control(`已建建筑 <small>${p.cards.length}</small>`,'city-tab',`data-tab="cards" aria-pressed="${overlay.tab==='cards'}"`)}${control(`奇迹 <small>${p.stages}/${p.stageList.length}</small>`,'city-tab',`data-tab="stages" aria-pressed="${overlay.tab==='stages'}"`)}${p.leaders||p.fleets?control('领袖 / 舰队','city-tab',`data-tab="expansions" aria-pressed="${overlay.tab==='expansions'}"`):''}</div>${overlay.tab==='stages'?stages:overlay.tab==='expansions'?`${expansionCity(p,cardFace)}${own&&current.game.reserveLeaders?.length?`<section class="sw-extension-collection"><h3>${icon('lock')}待招募领袖 <b>${current.game.reserveLeaders.length}</b></h3><div class="sw-city-cards">${current.game.reserveLeaders.map(c=>cardFace(c,{interactive:false,miniature:true,availability:false})).join('')}</div></section>`:''}<details class="sw-expansion-reference"><summary>能力说明</summary>${[...(p.leaders??[]),...(p.islands??[]),...(own?current.game.reserveLeaders??[]:[])].map(c=>`<p><b>${e(c.name)}</b>${e(c.text)}</p>`).join('')}</details>`:buildings}</dialog>`;
  }
  function tableDialog(){
    const s=current.game;
    return `<dialog data-surface="table" class="sw-dialog sw-table-dossier" aria-label="全桌建筑"><div class="sw-drawer-heading"><div><span>公开城市 · ${s.players.length} 位玩家</span><h2>全桌建筑</h2></div>${closeButton()}</div><div class="sw-table-cities">${s.players.map(p=>`<section class="sw-table-city ${p.id===user.id?'sw-table-own':''}"><div class="sw-table-city-heading">${control(`<span class="sw-table-city-seal">${e(name(p.id).slice(0,1))}</span><span><b>${e(name(p.id))}<small>${relation(p.id)}</small></b><span>${p.wonderName} · ${p.stages}/${p.stageList.length}</span></span>${icon('right')}`,'inspect',`class="sw-table-city-name" data-player="${e(p.id)}"`)}<div class="sw-table-city-metrics">${metric('coin',p.coins,'钱币')}${metric('shield',p.shields,'军力')}${metric('points',s.scores.find(x=>x.id===p.id)?.total??0,'当前计分')}</div></div><div class="sw-table-color-counts" role="group" aria-label="${e(name(p.id))} 的建筑分类">${Object.entries(colorNames).map(([color,label])=>control(`${icon(colorIcons[color])}<b>${p.cards.filter(c=>c.color===color).length}</b><small>${label}</small>`,'player-collection',`class="sw-${color}" data-player="${e(p.id)}" data-color="${color}" aria-label="查看 ${e(name(p.id))} 的${label}建筑"`)).join('')}</div><div class="sw-table-recent"><span>${p.cards.length?'最近建成':'尚未建造'}</span>${p.cards.slice(-3).reverse().map(c=>control(`<i class="sw-public-card-color sw-${c.color}"></i><b>${e(c.name)}</b><span>${effectSymbols(c.effect)}</span>`,'published-card',`class="sw-public-card" data-player="${e(p.id)}" data-card="${e(c.id)}" aria-label="查看 ${e(name(p.id))} 的 ${e(c.name)}"`)).join('')}</div></section>`).join('')}</div></dialog>`;
  }
  function chainsDialog(){
    return `<dialog data-surface="chains" class="sw-dialog sw-chains-dossier" aria-label="连锁图谱"><div class="sw-drawer-heading"><div><span>第二版 · 基础版</span><h2>连锁图谱</h2></div>${closeButton()}</div><p class="sw-chain-intro">持有左侧建筑与对应图案，即可免费建造右侧建筑。</p><div class="sw-chain-filters" role="group" aria-label="连锁筛选">${[['all','全部连锁'],['owned','已持有图案'],['ready','手牌可免费']].map(([key,label])=>control(label,'chain-filter',`data-filter="${key}" aria-pressed="${chainFilter===key}"`)).join('')}</div><div class="sw-chain-routes">${chainRoutes(current.game,player(user.id),chainFilter)}</div></dialog>`;
  }

  function guideDialog() {
    return `<dialog data-surface="guide" class="sw-dialog sw-guide-dialog" aria-label="玩法手卡"><div class="sw-drawer-heading"><h2>玩法</h2>${closeButton()}</div><div class="sw-rules-scope"><b>第二版</b><span>3–7 人 · ${current.game.expansions?.leaders?'领袖 ':''}${current.game.expansions?.armada?'舰队':''}</span></div><div class="sw-guide-actions">${[['building','建筑','获得牌面效果'],['wonder','奇迹','推进下一阶段'],['sell','卖牌','获得 3 钱币']].map(([symbol,label,text]) => `<div>${icon(symbol)}<b>${label}</b><span>${text}</span></div>`).join('')}</div><details><summary>连锁免费建造</summary><p>费用旁的图案表示可用连锁。你已建成的建筑若提供相同图案，就能忽略该牌的全部资源与钱币费用免费建造；仍不能重复建造同名建筑。牌面右侧的图案表示建成后可解锁的后续建筑。可在「连锁图谱」查看对应关系。</p></details><details><summary>资源与贸易</summary><p>每种产能每回合使用一次，下回合恢复。斜线表示任选一种。计数效果中，亮起的小城市表示统计范围。只能购买左右邻国起始资源及棕、灰牌产出，每份通常 2 钱币；黄牌和奇迹产能不能购买。同回合收入不能用于当前行动。</p></details><details><summary>时代与军事</summary><p>每时代选牌 ${current.game.turnsPerAge??6} 次，余牌依次向左、右、左传递。时代结束与左右邻国分别比较军力，胜利 +1 / +3 / +5，失败 -1，平局 0。</p></details><details><summary>科技与终局</summary><p>三类科技数量各自平方相加，每套三个不同符号另加 7 分。三个时代后总分最高者获胜，同分先比钱币，再共享胜利。</p></details><details><summary>特殊能力</summary><p>日面奥林匹亚尚未拥有的每种颜色首张建筑免费；夜面对应第 1 / 第 ${current.game.turnsPerAge??6} 次选牌。巴比伦夜面在时代末多打一张。陵墓可从弃牌免费建建筑。触发后会出现对应操作。</p></details>${current.game.expansions?.leaders?'<details><summary>领袖</summary><p>开局每人拿 4 张候选领袖，保留 1 张后向右传递，最后一张自动保留，最终有 4 位候选。每时代开始前处理 1 位：招募、用于奇迹或出售；只有已招募领袖生效。第三时代通常从剩下 2 位中处理 1 位，另一位退回。</p></details>':''}${current.game.expansions?.armada?'<details><summary>舰队与岛屿</summary><p>红、黄、蓝、绿建筑可额外造同色舰队。建筑与造船共用本轮产能，连锁不免造船费用。探索时秘密选 1 座岛屿。卖牌可选择推进商船，替代 3 钱币。</p></details><details><summary>全桌海战</summary><p>时代末比较全桌海军，最弱 −1/−2/−3，第一 +3/+5/+7，第二 +1/+3/+5。第一并列均得第二名奖励，第二并列无奖励，全桌相同则无标记。</p></details>':''}<div class="sw-symbol-key">${Object.entries(resourceNames).map(([key,label]) => `<span>${icon(key)}${label}</span>`).join('')}</div><a href="https://www.rprod.com/en/games/7-wonders" target="_blank" rel="noopener">官方规则 ↗</a></dialog>`;
  }

  function historyDialog() {
    const s = current.game;
    return `<dialog data-surface="history" class="sw-dialog sw-history-dialog" aria-label="上次揭晓"><div class="sw-drawer-heading"><h2>上次揭晓</h2>${closeButton()}</div><div class="sw-history-list">${s.lastActions.map(a => `<div><b>${e(name(a.id))}</b><span>${icon(a.action === 'build' || a.action === 'revive' ? 'building' : a.action === 'wonder' ? 'wonder' : 'sell')}${a.card ? e(a.card.name) : a.action === 'wonder' ? a.stage : a.sellFleet?`${icon('ship')}商船 +1`:metric('coin','+3','获得')}</span></div>`).join('') || '<p>尚未揭晓</p>'}</div>${s.ageResults.map(result => `<details><summary>时代 ${['I','II','III'][result.age - 1]}</summary>${control('查看时代战报','reports',`data-age="${result.age}" class="sw-report-link"`)}${result.military.map(p => `<p>${e(name(p.id))}<b>${p.tokens.reduce((a,b) => a+b,0)}</b></p>`).join('')}${result.naval?`<h3>海战</h3>${result.naval.map(p=>`<p>${e(name(p.id))}${icon('naval')}${p.strength}<b>${p.token>0?'+':''}${p.token}</b></p>`).join('')}`:''}</details>`).join('')}</dialog>`;
  }

  function finish() {
    const s = current.game, scoreColumns=[['wonder','奇迹'],['treasury','钱币'],['military','陆战'],['blue','市政'],['yellow','商业'],['green','科技'],['purple','行会'],...(s.expansions?.leaders?[['leaders','领袖']]:[]),...(s.expansions?.armada?[['naval','海战'],['fleet','舰队'],['islands','岛屿']]:[]),['total','总分']], ranking = [...s.scores].sort((a,b) => b.total-a.total || player(b.id).coins-player(a.id).coins);
    return `<section class="sw-finish"><h2>${icon('crown')}${e(s.winners.map(name).join('、'))}</h2><div class="sw-podium">${ranking.map((score,i) => `<article class="${s.winners.includes(score.id) ? 'sw-winner' : ''}"><span>${i+1}</span><b>${e(name(score.id))}</b><strong>${score.total}</strong></article>`).join('')}</div><details class="sw-score-detail" open><summary>计分</summary><div class="sw-score-scroll"><table><thead><tr><th>玩家</th>${scoreColumns.map(([,label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${ranking.map(score => `<tr><th>${e(name(score.id))}</th>${scoreColumns.map(([key]) => `<td>${score[key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>${current.hostId === user.id ? b('再来一局','rematch',false,'class="sw-primary"') : '<p>等待房主</p>'}</section>`;
  }

  function render(snapshot, me) {
    current = snapshot; user = me;
    const s = snapshot.game;
    if(s.epoch !== epoch) {
      epoch = s.epoch; selected = null; mode = 'build'; planIndex = 0;navalOn=false;sellFleet=false;stageIndex=null;
      if(overlay?.type === 'action') overlay = null;
      returnOverlay = null;
    }
    if(overlay?.type==='report'&&!s.ageResults.some(r=>r.age===overlay.age)){overlay=null;returnOverlay=null;}
    if(selected && !sourceCards().some(c => c.id === selected)) selected = null;
    if(overlay?.type === 'action' && (!selected || !active())) overlay = null;
    const phase=({finished:'终局',setup:'奇迹面',leaderDraft:`选将 ${s.round} / 3`,recruit:'招募',recruitExtra:'额外招募',explore:'探索',ability:'文明能力',navalChoice:'海战'})[s.phase]??(s.phase==='extra'?'+1':`${s.round} / ${s.turnsPerAge??6}`);
    const discovery=discoveryTracker.pending(snapshot,me.id);
    if(overlay?.type==='discovery')overlay=discovery;
    if(discovery&&(!overlay||overlay.type==='action')){overlay=discovery;returnOverlay=null;focusRequested=true;}
    const pendingReport=reportTracker.pending(snapshot,me.id);
    if(pendingReport&&(!overlay||overlay.type==='action')){overlay=pendingReport;returnOverlay=null;focusRequested=true;}
    const dialog = overlay?.type==='discovery'?discoveryDialog(overlay.cards,cardFace):overlay?.type==='overview'?`<dialog data-surface="overview" class="sw-dialog sw-overview-dialog" aria-label="全桌状态">${closeButton()}${tableOverview(snapshot,me.id)}</dialog>`:overlay?.type === 'report' ? battleReport(snapshot,me.id,overlay) : overlay?.type === 'action' ? actionDialog() : overlay?.type === 'city' ? cityDialog() : overlay?.type === 'table' ? tableDialog() : overlay?.type === 'chains' ? chainsDialog() : overlay?.type === 'guide' ? guideDialog() : overlay?.type === 'history' ? historyDialog() : '';
    return `<div class="sw-game" data-epoch="${s.epoch}"><div class="sw-heading"><h1>七大奇迹<small class="sw-edition-badge">${[s.expansions?.leaders?'领袖':null,s.expansions?.armada?'舰队':null].filter(Boolean).join(' + ')||'基础版'}</small></h1><div class="sw-age" aria-label="时代 ${s.age}，${phase}"><b>${['I','II','III'][s.age-1]}</b><span>${phase}</span><span class="sw-round-track" aria-hidden="true">${Array.from({length:s.phase==='leaderDraft'?3:s.turnsPerAge??6},(_,i)=>`<i class="${i<s.round?'sw-round-lit':''}"></i>`).join('')}</span>${['draft','extra','leaderDraft'].includes(s.phase) ? icon(s.age===2||s.phase==='leaderDraft'?'right':'left',s.age===2||s.phase==='leaderDraft'?'向右传牌':'向左传牌') : ''}</div><div class="sw-table-tools">${control(`${icon('building')}<span>全桌状态</span><kbd>Tab</kbd>`,'overview','class="sw-tool sw-tool-labeled" aria-label="查看全桌状态，按住 Tab 快览"')}${control(`${icon('cards')}<span>全桌建筑</span>`,'table','class="sw-tool sw-tool-labeled" aria-label="查看全桌已建建筑"')}${control(`${icon('chain')}<span>连锁图谱</span>`,'chains','class="sw-tool sw-tool-labeled" aria-label="查看连锁图谱"')}${control(icon('history'),'history','class="sw-tool" aria-label="上次揭晓"')}${control(icon('help'),'guide','class="sw-tool" aria-label="玩法手卡"')}</div></div>${seats()}${reportBanner(s,user.id)}${s.phase === 'setup' ? setup() : s.phase === 'finished' ? finish() : `${s.phase==='leaderDraft'?'':ownBoard()}${s.expansions?.armada&&s.phase!=='leaderDraft'?fleetPanel(player(user.id)):''}${abilityPanel()}${!['ability','navalChoice'].includes(s.phase)?hand():''}`}${dialog}<div class="sw-peek" popover="manual" role="region" aria-label="全桌状态快览">${tableOverview(snapshot,me.id)}<div class="sw-peek-hint">松开 <kbd>Tab</kbd> 返回牌桌</div></div></div>`;
  }

  function focusMatch(container, data) {
    if(!data) return null;
    return [...container.querySelectorAll('[data-action]')].find(el => ['action','card','mode','player','filter','tab'].every(key => !data[key] || el.dataset[key] === data[key]));
  }
  function closeOverlay() {
    if(overlay?.type==='discovery'){discoveryTracker.dismiss(overlay.cards);overlay=null;returnOverlay=null;restoreFocus={action:'game:expansion-city',player:user.id};rerender();return;}
    if(overlay?.type==='report'){reportTracker.dismiss(current.game,overlay.age);restoreFocus={action:'game:reports'};overlay=null;returnOverlay=null;rerender();return;}
    if(returnOverlay) { overlay = returnOverlay; returnOverlay = null; focusRequested = true; }
    else { restoreFocus = overlay?.type === 'action' ? {action:'game:card',card:selected} : overlay?.type === 'city' ? {action:'game:inspect',player:overlay.id} : {action:`game:${overlay?.type}`}; overlay = null; }
    rerender();
  }
  function update(container, snapshot, me) {
    const handScroll=container.querySelector('.sw-game')?.dataset.epoch===String(snapshot.game.epoch)?container.querySelector('.sw-hand')?.scrollLeft??0:0;
    const focused = container.contains(document.activeElement) ? document.activeElement : null;
    const focusData = focused?.dataset ? {...focused.dataset} : null;
    const oldDialog = container.querySelector('.sw-dialog'), oldType = oldDialog?.dataset.surface, scrollTop = oldDialog?.scrollTop ?? 0;
    const disclosures = [...(oldDialog?.querySelectorAll('details') ?? [])].map(el => el.open);
    container.innerHTML = render(snapshot,me);
    tablePeek.attach(container);
    const rail=container.querySelector('.sw-hand');
    railObserver?.disconnect();
    if(rail){
      rail.scrollLeft=handScroll;
      const sync=()=>{const left=container.querySelector('[data-action="game:hand-left"]'),right=container.querySelector('[data-action="game:hand-right"]');if(left)left.disabled=rail.scrollLeft<2;if(right)right.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;};
      rail.addEventListener('scroll',sync,{passive:true});sync();
      railObserver=new ResizeObserver(sync);railObserver.observe(rail);
    }
    const dialog = container.querySelector('.sw-dialog');
    container.querySelector('#sw-payment-plan')?.addEventListener('change',event => { planIndex = Number(event.target.value); rerender(); });
    if(dialog) {
      tablePeek.hide();
      dialog.showModal();
      if(oldType === overlay.type) [...dialog.querySelectorAll('details')].forEach((el,i) => { el.open = disclosures[i] ?? false; });
      dialog.scrollTop = oldType === overlay.type ? scrollTop : 0;
      dialog.addEventListener('cancel',event => { event.preventDefault(); closeOverlay(); });
      dialog.addEventListener('click',event => {
        const rect = dialog.getBoundingClientRect();
        if(event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeOverlay();
      });
      const target = focusRequested ? overlay.type === 'action' ? dialog.querySelector('.sw-mode[aria-pressed=true],.sw-close') : dialog.querySelector('.sw-close') : focusMatch(dialog,focusData);
      target?.focus({preventScroll:true}); focusRequested = false;
      if(focused?.id === 'sw-payment-plan') dialog.querySelector('#sw-payment-plan')?.focus({preventScroll:true});
    } else {
      const target = focusMatch(container,restoreFocus ?? focusData);
      target?.focus({preventScroll:true}); restoreFocus = null;
    }
  }

  function shiftCard(delta) {
    const cards = sourceCards(), index = cards.findIndex(c => c.id === selected);
    selected = cards[(index+delta+cards.length)%cards.length]?.id ?? null;
    mode = 'build'; planIndex = 0;navalOn=false;sellFleet=false;stageIndex=null; rerender();
  }
  async function handle(action, element) {
    if(action==='reports'){overlay={type:'report',age:Number(element?.dataset.age??current.game.ageResults.at(-1)?.age),step:'land'};returnOverlay=null;focusRequested=true;rerender();return;}
    if(action==='report-step'){if(overlay?.type==='report'){overlay.step=element.dataset.step;focusRequested=true;rerender();}return;}
    if(action==='report-age'){if(overlay?.type==='report'){overlay.age=Number(element.dataset.age);overlay.step='land';focusRequested=true;rerender();}return;}
    if(action==='report-dismiss'){closeOverlay();return;}
    if(action === 'card') {
      if(!active()) return;
      selected = element.dataset.card; mode = 'build'; planIndex = 0;navalOn=false;sellFleet=false;stageIndex=null;
      overlay = {type:'action'}; returnOverlay = null; focusRequested = true; rerender();
    } else if(action === 'hand-left'||action === 'hand-right') {
      const rail=element.closest('.sw-hand-section')?.querySelector('.sw-hand');
      rail?.scrollBy({left:(action==='hand-left'?-1:1)*(rail.clientWidth-30),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    } else if(action === 'inspect' || action === 'stages') openCity(element.dataset.player,action === 'stages' ? 'stages' : 'cards');
    else if(action==='expansion-city')openCity(element.dataset.player,'expansions');
    else if(action === 'collection') openCity(user.id,'cards',element.dataset.color);
    else if(['guide','history','table','chains','overview'].includes(action)) { returnOverlay=overlay?.type==='action'?{type:'action'}:overlay?.type==='report'?{...overlay}:null;overlay={type:action};focusRequested=true;rerender(); }
    else if(action === 'city-player') openCity(element.dataset.player);
    else if(action === 'player-collection') openCity(element.dataset.player,'cards',element.dataset.color);
    else if(action === 'published-card') openCity(element.dataset.player,'cards','all',element.dataset.card);
    else if(action === 'chain-filter') {chainFilter=element.dataset.filter;rerender();}
    else if(action === 'close') closeOverlay();
    else if(action === 'previous' || action === 'next') shiftCard(action === 'previous' ? -1 : 1);
    else if(action === 'mode') { mode = element.dataset.mode; planIndex = 0;navalOn=false;sellFleet=false;rerender(); }
    else if(action==='naval'){const s=current.game,p=player(user.id),c=selectedCard(),q=s.wonderOptions?.find(q=>q.stage-1===stageIndex)??s.wonderBuild,color=mode==='wonder'?q.naval?.color:c?.color;if(!color||!p.fleets||p.fleets[color]>=6)return;navalOn=!navalOn;planIndex=0;rerender();}
    else if(action==='choose-stage'){stageIndex=Number(element.dataset.stage);navalOn=false;planIndex=0;rerender();}
    else if(action==='sell-reward'){sellFleet=element.dataset.fleet==='true';rerender();}
    else if(action==='ability'){const option=current.game.ability.options[Number(element.dataset.index)];await send({type:'ability',value:option.value,epoch:current.game.epoch});}
    else if(action==='naval-choice')await send({type:'navalChoice',participate:element.dataset.participate==='true',epoch:current.game.epoch});
    else if(action === 'city-tab') { overlay.tab = element.dataset.tab; queriedCard = null; rerender(); }
    else if(action === 'filter') { filter = element.dataset.filter; queriedCard = null; rerender(); }
    else if(action === 'query-card') { queriedCard = queriedCard === element.dataset.card ? null : element.dataset.card; rerender(); }
    else if(action === 'side') await send({type:'side',side:element.dataset.side,epoch:current.game.epoch});
    else if(action === 'confirm') {
      if(!active() || !selectedCard()) return;
      const s = current.game;
      if(s.phase==='leaderDraft')await send({type:'leaderPick',cardId:selected,epoch:s.epoch});
      else if(s.phase==='explore')await send({type:'islandPick',offerId:s.exploration.offerId,cardId:selected,epoch:s.epoch});
      else if(s.phase === 'revive') await send({type:'revive',cardId:selected,epoch:s.epoch});
      else {
        const wq=s.wonderOptions?.find(q=>q.stage-1===stageIndex)??s.wonderBuild,quote=mode==='wonder'?(navalOn?wq.naval:wq):(navalOn?selectedCard().navalBuild:selectedCard().build),plans=quote?.plans??[];
        if(mode !== 'sell' && !plans[planIndex]) return;
        await send({type:'choose',cardId:selected,action:mode,payment:mode === 'sell' ? {left:0,right:0,bank:0} : plans[planIndex],epoch:s.epoch,...(navalOn&&mode!=='sell'?{naval:mode==='wonder'?wq.naval.color:selectedCard().color}:{}),...(mode==='wonder'?{stage:(wq.stage??player(user.id).stages+1)-1}:{}),...(mode==='sell'&&sellFleet?{sellFleet:true}:{})});
      }
      overlay = null; returnOverlay = null; rerender();
    }
  }
  return {render,update,handle,dispose() { overlay = null; returnOverlay = null; railObserver?.disconnect(); tablePeek.dispose(); }};
}
