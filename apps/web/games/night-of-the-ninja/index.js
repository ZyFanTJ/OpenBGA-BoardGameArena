import {playerName} from '../../player-identity.js';
import { escapeHtml as e, button as b } from '../../ui.js';
import { illustration, houseLabel, houseNames, phaseNames } from './art.js';
import { currentNinjaAction, describeNinjaAction, publicEvent } from './presentation.js';
import { createNinjaAnimator } from './motion.js';

const action = (label, key, disabled = false, extra = '') => b(label, `game:${key}`, disabled, extra);
export function createNinjaRenderer(send, rerender) {
  let room, user, container, key = '', selected = [], targets = [], graveCard = null, inspect = 'house', ownToken = 0, otherToken = 0, guideOpen = false, intelOpen = false;
  let motion, inspectRole = null, historyOpen = false;
  const name = id => room.players.find(p => p.id === id)?.name ?? '玩家';
  const field = (text, content) => `<div class="nn-field"><span>${text}</span>${content}</div>`;
  function card(c, { selectable = false, chosen = false, compact = false, actionKey = 'card' } = {}) {
    const def = c ? room.game.reference[c.role] : null;
    const inner = `${illustration(def?.art ?? 14)}${c ? `<span class="nn-card-rank">${c.rank ?? '✦'}</span><span class="nn-card-caption"><strong>${def.name}</strong>${!compact ? `<small>${e(def.text)}</small>` : ''}</span>` : '<span class="nn-card-seal">忍</span>'}`;
    return selectable ? `<button type="button" class="nn-card ${chosen ? 'nn-selected' : ''} ${compact ? 'nn-mini' : ''}" data-action="game:${actionKey}" data-card="${e(c.id)}" aria-pressed="${chosen}" aria-label="${e(def.name)}${c.rank ?? ''}，${e(def.text)}">${inner}</button>`
      : `<button type="button" class="nn-card ${compact ? 'nn-mini' : ''}" data-card="${e(c?.id ?? '')}" ${c ? `data-action="game:inspect-card" data-role="${e(c.role)}"` : 'disabled'} title="${e(def?.text ?? '未公开的忍者牌')}" aria-label="${e(def ? `${def.name}${c.rank ?? ''}` : '未公开的忍者牌')}">${inner}${c ? '<span class="nn-card-zoom" aria-hidden="true">＋</span>' : ''}</button>`;
  }
  function tokens(p, selectable, owner) {
    return `<div class="nn-tokens">${p.honor.map((v, i) => selectable ? action(v ?? '✦', 'token', false, `class="nn-token" data-owner="${owner}" data-token="${i}" aria-label="${owner === 'own' ? '自己的' : '对方的'}第 ${i + 1} 枚荣誉${v === null ? '' : `，${v} 分`}" aria-pressed="${(owner === 'own' ? ownToken : otherToken) === i}"`)
      : `<span class="nn-token" title="${v === null ? '隐藏分值' : `${v} 分`}">${v ?? '✦'}</span>`).join('') || '<small>尚无荣誉</small>'}</div>`;
  }
  function privateHouse(house, label = '仅你可见') {
    return `<div class="nn-private-house nn-house-${house?.house ?? 'hidden'}">${illustration({ crane: 11, lotus: 12, ronin: 13 }[house?.house] ?? 14)}<span><small>${e(label)}</small><b>${houseLabel(house)}</b></span></div>`;
  }
  function guide() {
    return `<div class="nn-reference"><small>NIGHT OF THE NINJA</small><h2>忍者之夜 · 玩法手卡</h2><p>4–11 人 · 每轮换身份 · 个人荣誉累计至 10 分</p><ol><li><b>轮抽两张技能</b>每人三张，选一张传左边；再从传来的两张选一张，余牌暗弃。</li><li><b>夜幕行动</b>密探 → 秘术师 → 诡术师 → 盲眼刺客 → 上忍。各阶段同时决定亮哪些牌，再按 1 至 6 使用技能。跳过的牌不能补打。</li><li><b>家族揭晓</b>只揭晓幸存者；1 是最高身份，比较双方最优存活身份，若相同继续比下一位。胜方全员领一枚荣誉，包括阵亡者。完全平手则每位幸存者领一枚。</li><li><b>浪人与胜利</b>浪人存活便领一枚。轮末检查 10 分，最高总分者胜，同分共享胜利。</li></ol><p>你可以聊天、说谎或分享情报，阵亡后仍可发言。旧情报是当时的观察，易容师交换后不能自行重看身份。</p><div class="nn-role-reference">${Object.entries(room.game.reference).map(([role, def]) => `<article>${illustration(def.art)}<div><b>${def.name}</b><small>${e(def.text)}</small></div></article>`).join('')}</div><p class="nn-adaptation">线上适配：同时提交后统一亮牌；荣誉池采用 36 枚，2 / 3 / 4 分各 12 枚。公开规则书未列实体荣誉频数，故未宣称此配比为官方配比。完整边界与来源见仓库规则文档。</p><p><a href="https://www.brotherwisegames.com/night-of-the-ninja" target="_blank" rel="noopener noreferrer">出版方游戏页面</a> · <a href="https://www.brotherwisegames.com/s/NightoftheNinjaCoreRulebook.pdf" target="_blank" rel="noopener noreferrer">官方规则书</a> · <a href="https://www.brotherwisegames.com/s/NightOftheNinjaFAQ.pdf" target="_blank" rel="noopener noreferrer">官方 FAQ</a></p></div>`;
  }
  function render(snapshot, me, presentation = null) {
    room = snapshot; user = me;
    const s = room.game, p = s.players.find(p => p.id === me.id), ended = ['roundEnd', 'finished'].includes(s.phase);
    const nextKey = `${s.round}:${s.phase}:${s.draftStep}:${s.nightPhase}:${s.active?.card.id ?? ''}:${s.pending?.kind ?? ''}`;
    if (key !== nextKey) {
      key = nextKey; targets = []; graveCard = s.pending?.cards?.[0]?.id ?? null; inspect = 'house'; ownToken = 0; otherToken = 0;
      selected = s.phase === 'announce' ? p.hand.filter(c => c && s.reference[c.role].phase === s.nightPhase).map(c => c.id) : [];
    }
    const enabled = !room.dissolution, myAct = s.phase === 'act' && s.active?.playerId === me.id && enabled;
    const myDecision = s.pending?.actorId === me.id && enabled;
    const role = s.active?.card.role, needsTarget = myAct && !['gravedigger'].includes(role);
    const eligibleTarget = t => needsTarget && (role === 'shapeshifter' || t.id !== me.id && (!['judge', 'blindAssassin', 'shinobi'].includes(role) || t.alive)) && (role !== 'thief' || t.honorCount > p.honorCount);
    const targetControls = needsTarget ? `<div class="nn-targets" aria-label="选择技能目标">${s.players.filter(eligibleTarget).map(t => action(name(t.id), 'target', false, `class="nn-target ${targets.includes(t.id) ? 'nn-picked' : ''}" data-player="${e(t.id)}" aria-pressed="${targets.includes(t.id)}"`)).join('')}</div>` : '';
    let help = '', controls = '', choiceContent = '';
    if (s.phase === 'draft') {
      help = p.ready ? '选牌已锁定 · 等待同桌传牌' : s.draftStep === 1 ? '选择一张忍者牌，另外两张传给左边' : '从传来的两张中选一张，另一张暗弃';
      controls = action(p.ready ? '已选好' : '收下这张', 'draft', !enabled || p.ready || selected.length !== 1, 'class="gold-button"');
    } else if (s.phase === 'announce') {
      help = !p.alive ? '你已阵亡，仍可聊天并随家族获奖' : p.ready ? '行动已锁定 · 等待同桌亮牌' : `选择要亮出的${phaseNames[s.nightPhase]}牌，也可以保留`;
      controls = p.alive ? action(p.ready ? '已锁定' : selected.length ? `亮出 ${selected.length} 张` : '本阶段不出牌', 'announce', !enabled || p.ready, 'class="gold-button"') : '';
    } else if (myAct) {
      help = `使用${s.reference[role].name} · ${role === 'shapeshifter' ? '选两位玩家，可包含自己' : role === 'gravedigger' ? '查看两张随机暗弃牌' : '选择技能目标'}`;
      const noVictim = ['judge', 'blindAssassin', 'shinobi'].includes(role) && !s.players.some(t => t.id !== me.id && t.alive);
      controls = targetControls;
      if (role === 'spiritMerchant') {
        controls += `<div class="nn-choice-row">${action('查看家族牌', 'inspect-house', false, `aria-pressed="${inspect === 'house'}"`)}${action('查看荣誉', 'inspect-honor', !s.players.find(t => t.id === targets[0])?.honorCount, `aria-pressed="${inspect === 'honor'}"`)}</div>`;
      }
      const t = s.players.find(t => t.id === targets[0]);
      if ((role === 'thief' || role === 'spiritMerchant' && inspect === 'honor') && t) controls += field('选择对方的一枚荣誉', tokens(t, true, 'other'));
      controls += action(noVictim ? '没有可击杀目标 · 继续' : '使用技能', 'act', !noVictim && (role === 'shapeshifter' ? targets.length !== 2 : role === 'gravedigger' ? false : targets.length !== 1 && role !== 'thief'), 'class="gold-button"');
      if (role === 'thief') controls += action('不偷取', 'thief-pass', false, 'class="secondary"');
    } else if (myDecision) {
      const d = s.pending;
      if (d.kind === 'react') {
        help = `${name(d.attackerId)} 向你出手 · 选择反应`;
        controls = ['mirrorMonk', 'martyr'].filter(r => p.hand.some(c => c?.role === r)).map(r => action(`使用${s.reference[r].name}`, `react-${r}`, false, 'class="gold-button"')).join('') + action('承受击杀', 'react-accept', false, 'class="secondary"');
      } else {
        help = d.kind === 'intel' ? '记住你的侦查结果' : '情报仅你可见 · 完成这次技能';
        if (d.house) choiceContent = privateHouse(d.house, `${name(d.targetId)} · 此刻身份`);
        if (d.ninja) choiceContent += `<div class="nn-intel-ninja">${card(d.ninja)}<small>随机查看到的忍者牌</small></div>`;
        if (d.kind === 'shapeshifter') {
          choiceContent = d.houses.map((h, i) => privateHouse(h, `${name(d.targetIds[i])} · 此刻身份`)).join('');
          controls = action('秘密交换', 'swap-house', false, 'class="gold-button"') + action('保持原位', 'keep-house', false, 'class="secondary"');
        } else if (d.kind === 'shinobi') controls = action('击杀此人', 'kill', false, 'class="gold-button"') + action('放过此人', 'spare', false, 'class="secondary"');
        else if (d.kind === 'troublemaker') controls = action('公开身份', 'reveal', false, 'class="gold-button"') + action('保守秘密', 'conceal', false, 'class="secondary"');
        else if (d.kind === 'gravedigger') {
          choiceContent = d.cards.map(c => card(c, { selectable: true, chosen: graveCard === c.id, actionKey: 'grave-card' })).join('');
          const c = d.cards.find(c => c.id === graveCard), ph = c && s.reference[c.role].phase;
          controls = action('立即使用', 'grave-now', !(ph >= 1 && ph <= 5), 'class="gold-button"') + (ph === s.nightPhase && c.rank > s.active.card.rank ? action('按顺位使用', 'grave-ordered', false, 'class="secondary"') : '') + action('保留手中', 'grave-keep', false, 'class="secondary"');
        } else if (d.kind === 'spiritMerchant') {
          const t = s.players.find(t => t.id === d.targetId);
          if (d.token) choiceContent = `<p class="nn-token-result">${e(name(t.id))} 的第 ${d.token.slot + 1} 枚荣誉 <b>${d.token.value} 分</b></p>`;
          controls = field('选择你交出的荣誉', tokens(p, true, 'own')) + field('选择你拿走的荣誉', tokens(t, true, 'other')) + action('交换荣誉', 'swap-token', !p.honorCount || !t.honorCount, 'class="gold-button"') + action('不交换', 'keep-token', false, 'class="secondary"');
        } else controls = action('记住了', 'confirm', false, 'class="gold-button"');
      }
    } else if (!ended) help = `${name(s.pending?.actorId ?? s.active?.playerId)} 正在${s.phase === 'react' ? '选择反应' : '使用技能'}`;
    if (ended) {
      const result = s.roundResult;
      help = s.phase === 'finished' ? `${s.winners.map(name).join('、')} 获胜` : result.winningHouse ? `${houseNames[result.winningHouse]}赢得这一夜` : result.tied ? '双方平手 · 幸存者获得荣誉' : '浪人幕后主使 · 没有家族获胜';
      choiceContent = `<div class="nn-awards"><b>荣誉授予</b><span>${result.awarded.map(name).map(e).join('、') || '无人'}</span>${result.mastermindId ? `<small>${e(name(result.mastermindId))} 揭晓幕后主使</small>` : ''}</div>`;
      controls = s.phase === 'finished' ? '' : room.hostId === me.id ? action('下一轮', 'nextRound', false, 'class="gold-button"') : '<small>等待房主继续</small>';
      if (s.phase === 'finished') choiceContent += `<div class="nn-scoreboard">${[...s.players].sort((a, b) => b.score - a.score).map(t => `<span>${s.winners.includes(t.id) ? '♛ ' : ''}${e(name(t.id))}<b>${t.score} 分</b></span>`).join('')}</div>`;
    }
    const opponents = s.players.filter(t => t.id !== me.id), initial = [...s.intel].reverse().find(n => n.playerId === me.id);
    const cue = presentation ?? currentNinjaAction(s), description = describeNinjaAction(cue, s, name);
    const recent = s.log.slice(-3).reverse().map(event => describeNinjaAction(publicEvent(event, s), s, name));
    const actionTag = id => cue.actorId === id ? `${s.reference[cue.role]?.name ?? '忍者'} · ${cue.kind === 'play' ? '出牌' : '行动中'}` : cue.targetIds?.includes(id) ? cue.kind === 'round' ? '获得荣誉' : cue.kind === 'attack' ? '击杀目标' : cue.kind === 'reveal' ? '身份公开' : '技能目标' : '';
    const feedbackClass = id => `${cue.actorId === id ? 'nn-is-acting' : ''} ${cue.targetIds?.includes(id) ? 'nn-is-target' : ''}`;
    const spotlight = `<div class="nn-live-board"><section class="nn-spotlight nn-tone-${description.tone} nn-cue-${cue.kind}" aria-label="全桌当前行动">${cue.card ? `<div class="nn-spotlight-card">${card(cue.card, { compact: true })}</div>` : '<div class="nn-spotlight-symbol" aria-hidden="true">✦</div>'}<div class="nn-spotlight-copy"><span class="nn-action-label">${e(description.label)}</span><h2 aria-live="polite">${e(description.title)}</h2>${cue.actorId && cue.targetIds?.length ? `<div class="nn-action-path"><b>${e(name(cue.actorId))}</b><span aria-hidden="true">⟶</span><b>${e(cue.targetIds.map(name).join('、'))}</b></div>` : ''}<p>${e(description.detail)}</p>${cue.role && cue.kind !== 'play' ? `<p class="nn-skill-description">${e(s.reference[cue.role]?.text)}</p>` : ''}</div></section><aside class="nn-activity" aria-label="公开行动记录"><h3>刚刚发生</h3><ol>${recent.map(d => `<li><small>${e(d.label)}</small><span>${e(d.title)}</span></li>`).join('') || '<li><span>亮牌后，行动记录会保留在这里。</span></li>'}</ol>${s.log.length > 3 ? `<details class="nn-action-history"><summary>展开更多行动记录 · ${s.log.length} 条</summary><ol>${s.log.slice().reverse().map(event => { const d = describeNinjaAction(publicEvent(event, s), s, name); return `<li><small>${e(d.label)}</small><span>${e(d.title)}</span></li>`; }).join('')}</ol></details>` : ''}${s.queue.length ? `<div class="nn-up-next"><small>接下来 · 按顺位</small>${s.queue.slice(0, 3).map(q => `<span>${e(name(q.playerId))}<b>${s.reference[q.card.role].name} ${q.card.rank ?? ''}</b></span>`).join('')}</div>` : ''}</aside></div>`;
    const cards = s.phase === 'draft' ? s.pack : p.hand;
    const waiting = ['draft', 'announce'].includes(s.phase), ready = s.players.filter(t => (s.phase === 'draft' || t.alive) && t.ready).length, required = s.players.filter(t => s.phase === 'draft' || t.alive).length;
    const seat = t => `<article class="nn-seat ${feedbackClass(t.id)} ${!t.alive ? 'nn-dead' : ''} ${s.active?.playerId === t.id || s.pending?.actorId === t.id ? 'nn-active' : ''} ${targets.includes(t.id) ? 'nn-seat-selected' : ''}" data-player="${e(t.id)}" data-motion-player="${e(t.id)}"><button type="button" class="nn-player" data-action="game:target" data-player="${e(t.id)}" ${eligibleTarget(t) ? '' : 'disabled'} aria-label="选择 ${e(name(t.id))} 为目标" aria-pressed="${targets.includes(t.id)}"><span class="nn-avatar">${e(name(t.id).slice(0, 1))}</span><strong>${playerName(room,t.id)}</strong><span class="nn-life">${t.alive ? '存活' : '阵亡'}</span></button><div class="nn-seat-meta"><span>${houseLabel(t.house)}</span><span>✦ ${t.honorCount}${t.score !== null ? ` · ${t.score}分` : ' 枚'}</span>${waiting && (s.phase === 'draft' || t.alive) ? `<i>${t.ready ? '✓ 已锁定' : '选择中'}</i>` : ''}</div>${actionTag(t.id) ? `<span class="nn-seat-action">${e(actionTag(t.id))}</span>` : ''}<div class="nn-seat-cards">${(s.phase === 'draft' ? Array(t.packCount).fill(null) : t.hand).map(c => card(c, { compact: true })).join('')}${t.played.map(c => card(c, { compact: true })).join('')}${s.queue.filter(q => q.playerId === t.id).map(q => card(q.card, { compact: true })).join('')}</div><div class="nn-public-skills">${[...t.played.map(c => `<span>${s.reference[c.role].name}${c.rank ?? ''}${c.cancelled ? ' · 未发动' : ''}</span>`), ...s.queue.filter(q => q.playerId === t.id).map(q => `<span>${s.reference[q.card.role].name}${q.card.rank ?? ''} · 待发动</span>`)].join('') || '<span>尚无公开技能</span>'}</div></article>`;
    return `<div class="nn-layout"><section class="nn-stage nn-count-${s.players.length} ${s.players.length > 6 ? 'nn-large' : ''} nn-phase-${s.phase} nn-tone-${description.tone}" aria-label="忍者之夜牌桌"><div class="nn-felt" aria-hidden="true"><span>忍</span><small>NIGHT OF THE NINJA</small></div><header class="nn-heading"><div><small>NIGHT OF THE NINJA</small><h1>忍者之夜</h1></div><div class="nn-round"><small>ROUND</small><strong>${String(s.round).padStart(2, '0')}</strong></div><div class="nn-toolbar">${action('情报', 'intel-open', false, 'class="secondary"')}${action('玩法手卡', 'guide-open', false, 'class="secondary"')}</div></header><nav class="nn-phases" aria-label="行动阶段">${['轮抽', ...phaseNames.slice(1), '揭晓'].map((label, i) => `<span class="${(s.phase === 'draft' ? i === 0 : ended ? i === 6 : i === s.nightPhase) ? 'nn-current' : ''}"><i>${i + 1}</i>${label}</span>`).join('')}</nav><div class="nn-overview"><div class="nn-table-peers"><div class="nn-opponents">${opponents.map(seat).join('')}</div><div class="nn-center"><div class="nn-center-status"><span>${s.phase === 'draft' ? `轮抽 ${s.draftStep} / 2` : ended ? '天明 · 揭晓' : `夜幕 · ${phaseNames[s.nightPhase]}`}</span>${waiting ? `<small>${ready} / ${required} 已锁定</small>` : s.active ? `<small>${e(name(s.active.playerId))} · ${s.reference[s.active.card.role].name} ${s.active.card.rank ?? ''}</small>` : ''}</div></div></div>${spotlight}</div><div class="nn-play-zone"><section class="nn-own ${feedbackClass(me.id)}" data-motion-player="${e(me.id)}" aria-label="你的身份与手牌"><div class="nn-own-identity"><b>${e(name(me.id))} <small>你 · ${p.alive ? '存活' : '阵亡'}</small></b>${privateHouse(p.house ?? initial?.house, p.house ? '公开时身份' : '最近观察 · 可能已被易容')}<div class="nn-own-honor"><span>✦ ${p.score} / 10 分</span>${tokens(p, false)}</div>${p.played.length ? `<small>已用 ${p.played.map(c => s.reference[c.role].name).join(' · ')}</small>` : ''}${s.phase === 'draft' && p.hand.length ? `<small>已收下 ${p.hand.map(c => `${s.reference[c.role].name}${c.rank ?? ''}`).join(' · ')}</small>` : ''}</div><div class="nn-own-cards"><div class="nn-hand-label">${s.phase === 'draft' ? '轮抽牌 · 选一张' : '你的忍者牌'}<small>${s.phase === 'announce' ? '金边表示本阶段准备亮出' : '完整技能说明在牌面'}</small></div><div class="nn-hand">${cards.map(c => card(c, { selectable: enabled && !p.ready && (s.phase === 'draft' || s.phase === 'announce' && p.alive && s.reference[c.role].phase === s.nightPhase), chosen: selected.includes(c.id) })).join('') || '<p class="nn-empty">手中已无忍者牌</p>'}</div></div></section><section class="nn-actions ${ended ? 'nn-settlement' : ''}" aria-label="当前操作"><p class="nn-prompt" aria-live="polite">${e(help)}</p>${choiceContent ? `<div class="nn-private-result">${choiceContent}</div>` : ''}<div class="nn-controls">${controls}</div>${!p.alive && !ended ? '<small>阵亡后保持身份隐藏，聊天仍然开放。</small>' : ''}</section></div></section><dialog class="nn-guide-dialog" aria-label="玩法手卡">${action('×', 'guide-close', false, 'class="dialog-close" aria-label="关闭玩法手卡"')}${guide()}</dialog><dialog class="nn-intel-dialog" aria-label="私密情报">${action('×', 'intel-close', false, 'class="dialog-close" aria-label="关闭私密情报"')}<small>FOR YOUR EYES ONLY</small><h2>你的情报卷轴</h2><p>按发生顺序记录。易容师可能已经调换身份，历史情报不保证仍有效。</p><div class="nn-intel-list">${s.intel.map(n => `<article><div><b>${e(name(n.playerId))}</b><small>行动 ${n.sequence}</small></div>${privateHouse(n.house, '观察时身份')}${n.ninja ? `<p>同时看见 ${s.reference[n.ninja.role].name} ${n.ninja.rank ?? ''}</p>` : ''}</article>`).join('')}</div></dialog><dialog class="nn-card-dialog" aria-label="技能详情">${action('×', 'inspect-close', false, 'class="dialog-close" aria-label="关闭技能详情"')}${inspectRole ? `<div class="nn-inspect-art">${illustration(s.reference[inspectRole].art)}</div><h2>${s.reference[inspectRole].name}</h2><p>${e(s.reference[inspectRole].text)}</p>` : ''}</dialog></div>`;
  }
  function draw(element, snapshot, me, cue) {
    const focused = element.contains(document.activeElement) ? document.activeElement : null;
    const historyScroll = element.querySelector('.nn-action-history ol')?.scrollTop ?? 0;
    const keys = ['action', 'card', 'player', 'role', 'token', 'owner'];
    const focus = focused ? Object.fromEntries(keys.map(k => [k, focused.dataset[k]])) : null;
    container = element; element.innerHTML = render(snapshot, me, cue);
    if (guideOpen) element.querySelector('.nn-guide-dialog').showModal();
    if (intelOpen) element.querySelector('.nn-intel-dialog').showModal();
    if (inspectRole) element.querySelector('.nn-card-dialog').showModal();
    const history = element.querySelector('.nn-action-history');
    if (history) {
      history.open = historyOpen;
      history.addEventListener('toggle', () => { historyOpen = history.open; });
      history.querySelector('ol').scrollTop = historyScroll;
    }
    element.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', () => {
      if (d.classList.contains('nn-guide-dialog')) guideOpen = false;
      else if (d.classList.contains('nn-intel-dialog')) intelOpen = false;
      else inspectRole = null;
    }));
    if (focus?.action) [...element.querySelectorAll('[data-action]')].find(el => keys.every(k => el.dataset[k] === focus[k]))?.focus({ preventScroll: true });
  }
  return {
    render,
    update(element, snapshot, me) {
      motion ??= createNinjaAnimator(draw); motion.update(element, snapshot, me);
    },
    async handle(type, el) {
      if (type === 'inspect-card' && room.game.reference[el.dataset.role]) {
        inspectRole = el.dataset.role; rerender(); return;
      }
      if (type === 'inspect-close') { inspectRole = null; container.querySelector('.nn-card-dialog').close(); return; }
      if (type === 'guide-open' || type === 'intel-open') { guideOpen = type === 'guide-open'; intelOpen = type === 'intel-open'; container.querySelector(guideOpen ? '.nn-guide-dialog' : '.nn-intel-dialog').showModal(); return; }
      if (type === 'guide-close' || type === 'intel-close') { const isGuide = type === 'guide-close'; if (isGuide) guideOpen = false; else intelOpen = false; container.querySelector(isGuide ? '.nn-guide-dialog' : '.nn-intel-dialog').close(); return; }
      if (!room || room.dissolution || motion?.busy) return;
      const s = room.game;
      if (type === 'card') {
        const id = el.dataset.card;
        selected = selected.includes(id) ? selected.filter(c => c !== id) : s.phase === 'draft' ? [id] : [...selected, id]; rerender(); return;
      }
      if (type === 'target') {
        const id = el.dataset.player;
        targets = targets.includes(id) ? targets.filter(t => t !== id) : s.active?.card.role === 'shapeshifter' ? [...targets.slice(-1), id] : [id];
        otherToken = 0; rerender(); return;
      }
      if (type === 'grave-card') { graveCard = el.dataset.card; rerender(); return; }
      if (type.startsWith('inspect-')) { inspect = type.slice(8); rerender(); return; }
      if (type === 'token') { if (el.dataset.owner === 'own') ownToken = Number(el.dataset.token); else otherToken = Number(el.dataset.token); rerender(); return; }
      const commands = {
        draft: { type: 'draft', cardId: selected[0] }, announce: { type: 'announce', cardIds: [...selected] },
        act: { type: 'act', targetId: targets[0], targetIds: [...targets], token: otherToken, inspect },
        'thief-pass': { type: 'act' }, confirm: { type: 'decide' }, 'swap-house': { type: 'decide', swap: true }, 'keep-house': { type: 'decide', swap: false },
        kill: { type: 'decide', kill: true }, spare: { type: 'decide', kill: false }, reveal: { type: 'decide', reveal: true }, conceal: { type: 'decide', reveal: false },
        'grave-now': { type: 'decide', cardId: graveCard, immediate: true }, 'grave-keep': { type: 'decide', cardId: graveCard, immediate: false }, 'grave-ordered': { type: 'decide', cardId: graveCard, immediate: false, ordered: true },
        'swap-token': { type: 'decide', swap: true, ownToken, otherToken }, 'keep-token': { type: 'decide', swap: false }, nextRound: { type: 'nextRound' },
      };
      if (type.startsWith('react-')) commands[type] = { type: 'decide', choice: type.slice(6) };
      if (commands[type]) await send(commands[type]);
    },
    dispose() { motion?.dispose(); motion = null; guideOpen = false; intelOpen = false; inspectRole = null; historyOpen = false; room = null; key = ''; },
  };
}
