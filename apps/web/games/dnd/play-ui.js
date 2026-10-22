import {playerName} from '../../player-identity.js';
import { actorImage, propImage } from './art.js';
import { escapeHtml as e, button as b } from '../../ui.js';
import { sceneStage, icon, shortAction, actionIcon, matchesFocus } from './scene-ui.js';
import { worldPanel, characterPanel } from './world-ui.js';
import { storyPanel } from './story-ui.js';

const resource = id => /^(potion|cure|rest|stabilize):?/.test(id);
function actionCard(action, s, disabled) {
  const spec = action.check, cost = action.id.startsWith('potion') ? '药水 ×1' : /^(cure|missile)/.test(action.id) ? '法术位 ×1' : action.id === 'rest' ? '生命骰 ×1' : '';
  const hint = cost || (spec?.successChance !== undefined ? `${spec.kind === 'save' ? '生效' : '成功'} ${spec.successChance}%` : action.battle || action.id === 'fight' || s.scene.id === 'trail' && action.id === 'travel' ? '进入战斗' : '');
  return `<button type="button" class="dnd-quick-action" data-action="game:choose" data-id="${e(action.id)}" ${disabled ? 'disabled' : ''} title="${e(action.hint)}" aria-label="${e(action.label)}${hint ? `，${hint}` : ''}"><span class="dnd-action-icon">${icon(actionIcon(action.id))}</span><span><b>${e(shortAction(action, s.scene.id))}</b>${hint ? `<small>${e(hint)}${spec?.mode === 'advantage' ? ' · 优势' : ''}</small>` : ''}</span>${spec ? `<i class="dnd-action-die">${icon('dice')}</i>` : ''}</button>`;
}
function partyHud(s, user, room) {
  return `<div class="dnd-party-hud" aria-label="冒险队伍">${s.players.map(p => {
    const c = p.character, a = s.archetypes[c.type];
    return `<button type="button" class="dnd-portrait-card ${s.actorId === p.id ? 'is-active' : ''} ${!c.hp ? 'is-down' : ''}" data-action="game:sheet" data-id="${e(p.id)}" aria-label="查看${e(c.name)}的角色，生命${c.hp}/${c.maxHp}" title="${e(c.name)} · ${e(a.title)}"><span class="dnd-class-portrait type-${c.type}">${actorImage(c.type, true)}${p.id === user.id ? '<i></i>' : ''}</span><span class="dnd-portrait-info"><b>${playerName(room,p.id,c.name)}</b><meter min="0" max="${c.maxHp}" value="${c.hp}" aria-label="${e(c.name)}生命值"></meter><small>${c.hp}<span> / ${c.maxHp}</span>${c.death.dead ? ' · 死亡' : c.death.stable ? ' · 稳定' : !c.hp ? ' · 倒地' : ''}</small></span></button>`;
  }).join('')}</div>`;
}
function journal(s) {
  return `<div class="dnd-journal">${s.journal.map(entry => `<article class="dnd-entry dnd-entry-${e(entry.kind)}"><span class="dnd-entry-label">${{ dm: '地下城主', player: '冒险者', roll: '判定', rules: '后果', scene: '新场景', combat: '遭遇', outcome: '结局' }[entry.kind]}</span><p>${e(entry.text)}</p>${entry.roll ? `<div class="dnd-dice"><b>d20</b>${entry.roll.dice.map(n => `<span>${n}</span>`).join('')}<small>${entry.roll.mode === 'advantage' ? '取高' : entry.roll.mode === 'disadvantage' ? '取低' : ''} ${entry.roll.bonus >= 0 ? '+' : ''}${entry.roll.bonus} = ${entry.roll.total}</small></div>` : ''}${entry.damage ? `<small class="dnd-damage">${entry.damage.dice.join(' + ')}，合计 ${entry.damage.total}</small>` : ''}</article>`).join('')}</div>`;
}
function panelContent(s, room, user, ui, guide) {
  if (ui.panel === 'map') return worldPanel(s);
  if (ui.panel === 'character') return characterPanel(s, ui.sheetId || user.id, user.id);
  if (ui.panel === 'journal') return journal(s);
  if (ui.panel === 'story') return storyPanel(s, ui.canAct);
  if (ui.panel === 'rules') return guide.replace('<details ', '<details open ');
  if (ui.panel === 'inventory') return `<div class="dnd-pack-items">${s.players.filter(p=>p.id===user.id).map(p=>`<div>${propImage('potion')}<span>治疗药水<strong>× ${p.character.potions}</strong></span></div>`).join('')}</div><div class="dnd-resource-grid">${s.choices.filter(a => resource(a.id)).map(a => actionCard(a, s, !ui.canAct)).join('') || '<p class="dnd-empty">当前没有需要使用的恢复物品。</p>'}</div><p class="dnd-panel-note">药水、治疗与休息会消耗资源，选中后查看具体效果。</p>`;
  if (ui.panel === 'more') return `<div class="dnd-resource-grid">${s.choices.filter(a => !['retreat', 'wait'].includes(a.id)).map(a => actionCard(a, s, !ui.canAct)).join('')}</div><div class="dnd-panel-secondary">${b('查看规则', 'game:panel', false, 'data-id="rules"')}${s.choices.some(a => a.id === 'wait') ? b('结束回合', 'game:choose', !ui.canAct, 'data-id="wait"') : ''}${s.choices.some(a => a.id === 'retreat') ? ui.retreat ? `<p>全队撤离会结束这次冒险。</p>${b('确认撤离', 'game:retreat-confirm')}${b('继续冒险', 'game:retreat-cancel')}` : b('撤回镇子', 'game:retreat') : ''}</div>`;
  return '';
}
export function adventureView(s, room, user, ui, guide) {
  const mine = s.actorId === user.id, canAct = mine && !s.pending && !s.pendingCheck && !room.dissolution && !ui.submitting;
  const actor = s.players.find(p => p.id === s.actorId)?.character?.name;
  const choices = s.choices.filter(a => !['wait', 'retreat'].includes(a.id) && !resource(a.id));
  const selected = choices.filter(a => matchesFocus(a, ui.focus));
  const mode = room.dissolution ? '冒险已暂停' : s.pendingCheck ? '等待掷骰' : s.pending ? 'DM 正在叙述…' : s.phase === 'finished' ? '冒险结束' : mine ? '你的回合' : `${actor ?? '同伴'}的回合`;
  const titles = { map: '冒险地图', character: '角色', journal: '冒险日志', rules: '规则手册', inventory: '物品与恢复', more: '更多行动', story: '你们写下的故事' };
  return `<div class="dnd-play"><div class="dnd-play-toolbar"><span class="dnd-brand">✧ ${e(s.adventure?.title ?? '雾灯纪行')}</span><nav aria-label="冒险工具">${[['map','map','地图'],['character','person','角色'],['journal','book','日志']].map(([id,img,label]) => `<button type="button" data-action="game:panel" data-id="${id}" aria-label="${label}">${icon(img)}<span>${label}</span></button>`).join('')}<button type="button" data-action="game:panel" data-id="rules" aria-label="规则手册">?</button></nav><span class="dnd-connection ${s.dmStatus === 'ai' ? 'is-online' : ''}" title="${{ ai: 'AI DM 在线', local: '本地引导', fallback: '本地接续', pending: 'DM 即将入席' }[s.dmStatus]}"><i></i>${s.dmStatus === 'ai' ? 'AI DM' : '本地 DM'}</span></div>
    ${sceneStage(s, ui.focus, canAct)}
    <div class="dnd-story-caption"><span class="dnd-narrator">✦</span><p class="dnd-caption-text" aria-label="DM 的叙述">${e(ui.narration ?? '')}</p>${b('展开', 'game:panel', false, 'data-id="journal" class="dnd-caption-more" aria-label="展开完整叙述与日志"')}</div>
    <div class="dnd-control-deck"><div class="dnd-deck-status"><span class="${canAct ? 'is-active' : ''}"><i></i>${e(mode)}</span>${s.combat ? `<b>第 ${s.combat.round} 轮</b>` : ''}${s.story?.memories.length || s.story?.threads.length || s.story?.edges.length ? `<button type="button" class="dnd-story-chip" data-action="game:panel" data-id="story">✧ ${s.story.threads.filter(t => t.status === 'open').length ? `支线 ${s.story.threads.filter(t => t.status === 'open').length}` : '故事'}</button>` : ''}${s.story?.edges[0] ? `<span class="dnd-circumstance ${s.story.edges[0].mode}" title="${e(s.story.edges[0].reason)}">${e(s.story.edges[0].label)} · ${s.story.edges[0].mode === 'advantage' ? '优势' : '劣势'}</span>` : ''}${ui.focus ? b('全部行动', 'game:focus', false, 'data-id="" class="dnd-clear-focus"') : ''}${s.lastCheck ? `<button type="button" class="dnd-last-roll" data-action="game:last-roll" aria-label="查看最近一次骰子结果">${icon('dice')}${s.lastCheck.event.roll?.total ?? s.lastCheck.event.damage?.total}</button>` : ''}</div>
    ${s.phase === 'finished' ? `<div class="dnd-ending"><h2>${e(s.outcome.title)}</h2><p>${e(s.outcome.text)}</p></div>` : `<div class="dnd-action-bar">${(selected.length ? selected : choices).slice(0, 5).map(a => actionCard(a, s, !canAct)).join('') || `<div class="dnd-action-wait">${s.pending ? '<i></i><i></i><i></i>' : e(mode)}</div>`}</div><div class="dnd-free-action"><label class="sr-only" for="dnd-intent">描述你的行动</label><input id="dnd-intent" maxlength="600" placeholder="描述任何做法，交给 DM 裁定…" value="${e(ui.draft)}" ${canAct ? '' : 'disabled'}>${b('↗', 'game:act', !canAct, 'aria-label="告诉 DM 你的行动"')}<button type="button" data-action="game:panel" data-id="inventory" title="物品与恢复" aria-label="物品与恢复">${icon('potion')}</button>${b('•••','game:panel',false,'data-id="more" aria-label="更多行动"')}</div>`}
    </div><footer class="dnd-bottom-hud">${partyHud(s, user, room)}${s.combat ? `<div class="dnd-initiative-strip" aria-label="先攻顺序">${s.combat.initiative.map(a => `<span class="${a.id === s.actorId ? 'is-current' : ''}" title="${e(a.name)} · 先攻 ${a.total}">${s.players.some(p=>p.id===a.id) ? icon('person') : icon('sword')}</span>`).join('')}</div>` : `<span class="dnd-hud-flavour">${e(s.adventure?.subtitle ?? '黎明之前，让灯火归家。')}</span>`}</footer>
    ${ui.panel ? `<dialog class="dnd-info-dialog" aria-labelledby="dnd-panel-title"><header><h2 id="dnd-panel-title">${titles[ui.panel]}</h2><button type="button" data-action="game:panel-close" aria-label="关闭面板">${icon('close')}</button></header><div class="dnd-info-body">${panelContent(s, room, user, { ...ui, canAct }, guide)}</div></dialog>` : ''}</div>`;
}
