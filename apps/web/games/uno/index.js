import {playerName} from '../../player-identity.js';
import { escapeHtml as e, button } from '../../ui.js';
import { cardArt, cardLabel, colors } from './art.js';
const b=(label,action,disabled=false,extra='')=>button(label,`game:${action}`,disabled,extra);
function style(){if(typeof document==='undefined'||document.querySelector('#uno-style'))return;const link=document.createElement('link');link.id='uno-style';link.rel='stylesheet';link.href='/games/uno/style.css';document.head.append(link);}
export function createUnoRenderer(send,rerender) {
  style();let room,user,container,selected=null,announce=true,showGuide=false,showEvidence=true,selectionKey='',sort=false,focusGuide=false,evidence=null,evidenceKey='',evidenceRound=null;
  const name=id=>room.players.find(p=>p.id===id)?.name??'玩家';
  const card=(c,extra='')=>`<span class="uno-card" ${extra}>${cardArt(c)}</span>`;
  function eventText(event){
    if(!event||event.type==='start')return '每人七张牌，先出完手牌赢得本轮';
    const who=name(event.actorId);
    return ({play:`${who} 打出 ${cardLabel(event.card)}${event.uno?' · UNO!':''}${event.count?` · ${name(event.targetId)} 抽 ${event.count} 张`:''}`,draw:`${who} 抽了 ${event.count} 张牌`,pass:`${who} 保留新牌，结束回合`,color:`${who} 选择${colors[event.color]?.name}`,uno:`${who} 喊了 UNO!`,catch:`${who} 抓到 ${name(event.targetId)} 漏喊 · 补 ${event.count} 张`,accept:`${who} 接受 +4 · 抽 ${event.count} 张`,challengeWon:`${who} 质疑成功 · ${name(event.targetId)} 抽 ${event.count} 张`,challengeLost:`${who} 质疑失败 · 抽 ${event.count} 张`})[event.type]??'';
  }
  function guide(){return `<div class="uno-guide"><small>CLASSIC · 108 CARDS</small><h2>UNO 玩法手卡</h2><p>每人 7 张，轮到你时打出一张同颜色、数字或符号的牌。万能牌可选颜色。先出完手牌赢得本轮。</p><h3>抽牌与罚牌</h3><p>可主动抽 1 张；抽牌后只能出刚抽的牌，也可保留。无牌可出时自动结束回合。+2 让下家抽两张并跳过；跳过和反转改变行动顺序。两人时反转等同跳过。罚牌不能叠加。</p><h3>+4 可以质疑</h3><p>仅当没有当前颜色的手牌时才能合法出 +4。被罚者可接受抽 4 张并跳过，或质疑并私下查看出牌者当时的剩余手牌。质疑成功，对方抽 4 张，你继续；失败，你抽 6 张并跳过。界面允许冒险出牌，可能被质疑。</p><h3>别忘记喊 UNO</h3><p>出牌后仅剩一张时须喊 UNO。出牌前可勾选随牌宣告；漏喊后可补喊，其他玩家也可在下一位开始行动前抓漏喊，罚抽两张。网络先收到的有效行动为准。</p><h3>计分与下一轮</h3><p>数字计牌面分；跳过、反转、+2 各 20 分；变色、+4 各 50 分。胜者得到其他人剩余牌的分数。末张 +2 / +4 先处理罚牌与质疑，再结算。标准先到 500 分胜；100 / 300 分是明确标注的线上短局。</p><p>初始 +4 重洗；初始变色由首位选色；初始功能牌照常生效。牌库用完保留顶牌，洗回其余弃牌。</p><p>本作采用经典个人计分赛，不含叠加、抢出、连出、7–0 换手或自定义牌。首轮庄家由服务器随机决定，此后轮庄。</p><a href="https://service.mattel.com/instruction_sheets/W2085-Eng.pdf" target="_blank" rel="noopener noreferrer">Mattel 官方经典版说明书 ↗</a><p class="uno-muted">卡面为本站原创矢量绘制，官方素材来源与版本差异见仓库 docs/uno-rules.md。</p></div>`;}
  function render(snapshot,me) {
    room=snapshot;user=me;const s=room.game,mine=s.turnId===me.id,ended=['roundEnd','finished'].includes(s.phase),paused=!!room.dissolution;
    const key=`${s.round}:${s.sequence}`;if(key!==selectionKey){selected=null;selectionKey=key;}
    if(evidenceRound!==s.round){evidenceRound=s.round;evidence=null;evidenceKey='';}
    if(s.evidence){const nextEvidence=JSON.stringify(s.evidence);if(nextEvidence!==evidenceKey){evidence=structuredClone(s.evidence);evidenceKey=nextEvidence;showEvidence=true;}}
    const enabled=mine&&!ended&&!paused,legal=s.legal;
    let help=ended?`${name(s.roundResult.winnerId)} 赢得本轮 · +${s.roundResult.points} 分`:mine?s.phase==='challenge'?`${name(s.pending.actorId)} 打出 +4，请决定是否质疑`:s.phase==='color'?'由你选择起始颜色':s.phase==='drawn'?'这是刚抽到的牌，打出或保留':'轮到你 · 点一张亮起的牌':`等待 ${name(s.turnId)} ${s.phase==='challenge'?'处理 +4':'出牌'}`;
    if(paused)help='解散投票中 · 游戏操作已暂停';
    const rotation=s.players.findIndex(p=>p.id===me.id),opponents=Array.from({length:s.players.length-1},(_,i)=>s.players[(rotation+i+1)%s.players.length]);
    const hand=sort?[...s.hand].sort((a,b)=>Object.keys(colors).indexOf(a.color)-Object.keys(colors).indexOf(b.color)||String(a.value).localeCompare(String(b.value))):s.hand;
    const choose=s.hand.find(c=>c.id===selected);
    let actions='';
    if(enabled&&s.phase==='challenge')actions=`<span class="uno-challenge-hint">出牌前为${colors[s.pending.previousColor]?.name??'当前色'}，对方当时有该颜色手牌即质疑成功</span>`+b('接受 · 抽 4 张','accept',false,'class="uno-primary"')+b('质疑 +4','challenge',false,'class="uno-secondary"');
    else if(enabled&&s.phase!=='color')actions=b('抽一张','draw',!legal.draw,'class="uno-primary"')+(legal.pass?b('保留 · 结束回合','pass',false,'class="uno-secondary"'):'');
    if(legal.uno)actions+=b('补喊 UNO!','uno',paused,'class="uno-call"');
    if(legal.catch)actions+=b(`抓 ${name(s.unoWindow)} 漏喊`,'catch',paused,'class="uno-call"');
    const colorPicker=enabled&&(s.phase==='color'||choose&&!choose.color)?`<div class="uno-color-picker" role="group" aria-label="选择接下来的颜色"><strong>${s.phase==='color'?'选择起始颜色':'选择颜色并出牌'}</strong>${Object.entries(colors).map(([id,c])=>b(`${c.mark} ${c.name}`,'color',false,`class="uno-swatch uno-color-${id}" data-color="${id}"`)).join('')}${choose?b('取消','cancel',false,'class="uno-secondary"'):''}${choose?.value==='wild4'&&legal.wild4Risk?'<p class="uno-risk">你还有当前颜色的牌；出 +4 可能被质疑并罚抽 4 张。</p>':''}</div>`:'';
    return `<section class="uno-stage uno-phase-${s.phase}" aria-label="UNO 牌桌"><div class="uno-felt" aria-hidden="true"><span>UNO</span><small>MOON TABLE · CLASSIC</small></div><header class="uno-hud"><div><span class="uno-kicker">CLASSIC · 108</span><h1>UNO<span>第 ${s.round} 轮</span></h1></div><div class="uno-hud-right"><span>${s.target} 分${s.target===500?'赛制':' · 线上短局'}</span>${b('玩法手卡','guide',false,'class="uno-secondary" aria-label="打开玩法手卡"')}</div></header>
    <div class="uno-opponents uno-count-${opponents.length}" aria-label="其他玩家">${opponents.map((p,i)=>`<article class="uno-seat ${p.id===s.turnId&&!ended?'uno-active':''}"><div class="uno-badge"><span class="uno-avatar uno-avatar-${i%4}">${e(name(p.id).slice(0,1))}</span><b>${playerName(room,p.id)}</b><span class="uno-score">${p.total}<small> 分</small></span></div><div class="uno-fan" aria-hidden="true">${Array.from({length:Math.min(p.count,5)},()=>card(null)).join('')}</div><span class="uno-hand-count">${p.count} 张${p.count===1?` <em>${p.announced?'UNO!':'剩一张'}</em>`:''}</span>${p.id===s.turnId&&!ended?'<span class="uno-turn-label">正在行动</span>':''}</article>`).join('')}</div>
    <div class="uno-center"><div class="uno-color-status uno-color-${s.color??'none'}"><span>${colors[s.color]?.mark??'✦'}</span><div><small>当前颜色</small><b>${colors[s.color]?.name??'等待选色'}</b></div><strong title="出牌方向：${s.direction===1?'顺时针':'逆时针'}">${s.direction===1?'↻':'↺'}</strong></div><div class="uno-piles"><div><button class="uno-card uno-deck ${legal.draw&&!paused?'uno-playable':''}" data-action="game:draw" ${legal.draw&&!paused?'':'disabled'} aria-label="从牌库抽一张">${cardArt(null)}</button><span>抽牌堆 <b>${s.deckCount}</b></span></div><div><div class="uno-card uno-discard" role="img" aria-label="${cardLabel(s.discardTop)}">${cardArt(s.discardTop)}</div><span>上一张 · ${cardLabel(s.discardTop)}</span></div></div><p class="uno-event" role="status">${e(eventText(s.lastEvent))}</p></div>
    <div class="uno-decision"><p class="uno-prompt" aria-live="polite">${e(help)}</p>${colorPicker}<div class="uno-actions">${actions}</div></div>
    <section class="uno-own-hand" aria-label="你的手牌"><div class="uno-hand-header"><span><strong>${playerName(room,me.id)} · 你</strong><span>${s.hand.length} 张手牌 · ${s.players.find(p=>p.id===me.id).total} 分</span></span><div>${b(sort?'恢复手牌顺序':'按颜色整理','sort',false,'class="uno-text-button" aria-pressed="'+sort+'"')}<label><input type="checkbox" data-uno-announce ${announce?'checked':''}> 剩一张时喊 UNO</label></div></div><div class="uno-hand-scroll" tabindex="0" aria-label="手牌横向滚动">${hand.map(c=>`<button class="uno-card ${legal.play.includes(c.id)&&!paused?'uno-playable':''} ${c.id===selected?'uno-selected':''} ${s.drawnId===c.id?'uno-new':''}" data-action="game:card" data-card-id="${c.id}" ${legal.play.includes(c.id)&&!paused?'':'disabled'} aria-label="${cardLabel(c)}${s.drawnId===c.id?'，刚抽到':''}${legal.play.includes(c.id)?'，可出':'，当前不可出'}" aria-pressed="${c.id===selected}">${cardArt(c)}${s.drawnId===c.id?'<small>新抽到</small>':''}</button>`).join('')}</div><small class="uno-hand-hint">${enabled&&s.phase==='drawn'?'抽牌后，只能打出刚抽到的牌':enabled?'亮起的牌可以出 · 万能牌点选后选择颜色':'仅你可见的手牌'}${s.hand.length>8?' · 可左右滚动查看全部手牌':''}</small></section>
    ${ended?`<div class="uno-overlay"><section class="uno-result" role="dialog" aria-modal="true" aria-label="本轮结算"><small>${s.phase==='finished'?'MATCH COMPLETE':'ROUND COMPLETE'}</small><h2>${e(name(s.roundResult.winnerId))} ${s.phase==='finished'?'赢得整场比赛':'出完了手牌'}</h2><p>本轮获得 <strong>${s.roundResult.points}</strong> 分 · 目标 ${s.target} 分</p><table><thead><tr><th>玩家</th><th>剩余牌分</th><th>累计得分</th></tr></thead><tbody>${[...s.players].sort((a,b)=>b.total-a.total).map(p=>`<tr><td>${e(name(p.id))}${p.id===s.roundResult.winnerId?' ♛':''}</td><td>${s.roundResult.players.find(r=>r.id===p.id).remaining}</td><td>${p.total}</td></tr>`).join('')}</tbody></table>${s.phase==='roundEnd'?room.hostId===me.id?b('开始下一轮','nextRound',paused,'class="uno-primary"'):'<p>等待房主开始下一轮</p>':'<p>可在房间菜单再来一局，或保存战绩。</p>'}</section></div>`:''}
    ${evidence&&showEvidence?`<div class="uno-evidence" role="dialog" aria-label="质疑证据，仅你可见"><button data-action="game:evidence-close" aria-label="关闭质疑证据">×</button><strong>仅你可见 · 质疑${evidence.illegal?'成功':'失败'}</strong><p>${e(name(evidence.actorId))} 出 +4 时剩余的手牌 · 原颜色${colors[evidence.previousColor]?.name??'已记录'}</p><div>${evidence.hand.map(c=>card(c)).join('')||'<span>没有剩余手牌</span>'}</div></div>`:''}
    ${showGuide?`<div class="uno-overlay"><section class="uno-guide-panel" role="dialog" aria-modal="true" aria-label="玩法手卡"><button class="uno-close" data-action="game:guide" aria-label="关闭玩法手卡">×</button>${guide()}</section></div>`:''}</section>`;
  }
  function keyboard(event){
    if(!showGuide)return;
    if(event.key==='Escape'){event.preventDefault();showGuide=false;focusGuide=true;rerender();return;}
    if(event.key==='Tab'){
      const targets=[...container.querySelectorAll('.uno-guide-panel button,.uno-guide-panel a')],first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  }
  return {render,update(el,snapshot,me){
    if(container!==el){container?.removeEventListener('keydown',keyboard);el.addEventListener('keydown',keyboard);}
    announce=container?.querySelector('[data-uno-announce]')?.checked??announce;
    container=el;const before=room?.game?.sequence,previousDraw=room?.game?.drawnId,focused=el.contains(document.activeElement)?document.activeElement:null;
    const focusCard=focused?.dataset.cardId,focusAction=focused?.dataset.action,inGuide=focused?.closest('.uno-guide-panel'),guideLink=focused?.tagName==='A';
    const handOffset=el.querySelector('.uno-hand-scroll')?.scrollLeft??0,guideOffset=el.querySelector('.uno-guide-panel')?.scrollTop??0;
    el.innerHTML=render(snapshot,me);
    const hand=el.querySelector('.uno-hand-scroll'),guidePanel=el.querySelector('.uno-guide-panel');
    if(hand){hand.scrollLeft=handOffset;const drawn=hand.querySelector('.uno-new');if(drawn&&snapshot.game.drawnId!==previousDraw)hand.scrollLeft+=drawn.getBoundingClientRect().left-hand.getBoundingClientRect().left-(hand.clientWidth-drawn.clientWidth)/2;}
    if(guidePanel)guidePanel.scrollTop=guideOffset;
    if(focusGuide){el.querySelector(showGuide?'.uno-close':'[data-action="game:guide"]')?.focus({preventScroll:true});focusGuide=false;}
    else if(inGuide&&showGuide)el.querySelector(guideLink?'.uno-guide-panel a':'.uno-close')?.focus({preventScroll:true});
    else if(focusCard)el.querySelector(`[data-card-id="${focusCard}"]:not(:disabled)`)?.focus({preventScroll:true});
    else if(focusAction)el.querySelector(`[data-action="${focusAction}"]:not(:disabled)`)?.focus({preventScroll:true});
    if(before!==undefined&&before!==snapshot.game.sequence&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.querySelector('.uno-discard')?.animate([{transform:'translateY(-18px) rotate(-8deg)',opacity:.5},{transform:'translateY(0) rotate(7deg)',opacity:1}],{duration:260,easing:'ease-out'});
  },
    async handle(action,el){
      announce=container?.querySelector('[data-uno-announce]')?.checked??announce;
      if(action==='guide'){showGuide=!showGuide;focusGuide=true;rerender();return;}
      if(action==='sort'){sort=!sort;rerender();return;}
      if(action==='evidence-close'){showEvidence=false;rerender();return;}
      if(action==='cancel'){selected=null;rerender();return;}
      if(!room||room.dissolution)return;
      announce=container?.querySelector('[data-uno-announce]')?.checked??announce;
      const s=room.game;
      if(action==='card'){
        const c=s.hand.find(c=>c.id===el.dataset.cardId);if(!c||!s.legal.play.includes(c.id))return;
        if(!c.color){selected=c.id;rerender();return;}
        await send({type:'play',cardId:c.id,uno:announce});
      }else if(action==='color'){
        if(s.legal.color)await send({type:'color',color:el.dataset.color});
        else if(selected)await send({type:'play',cardId:selected,color:el.dataset.color,uno:announce});
      }else if(['draw','pass','accept','challenge','catch','uno','nextRound'].includes(action))await send({type:action});
    },dispose(){container?.removeEventListener('keydown',keyboard);room=null;container=null;selected=null;}};
}
