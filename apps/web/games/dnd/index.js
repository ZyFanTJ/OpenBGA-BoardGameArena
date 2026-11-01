import {fullGuide as guide} from './guide.js';
import { actorImage } from './art.js';
import { escapeHtml as e, button as b } from '../../ui.js';
import { createRollPresentation } from './roll-ui.js';
import { adventureView } from './play-ui.js';
import { createNarrationPresentation } from './narration-ui.js';

const button = (label, action, disabled = false, extra = '') => b(label, `game:${action}`, disabled, extra);
const status = { pending: 'DM 即将入席', ai: 'AI DM 在线', local: '本地引导 · 未调用模型', fallback: 'AI 暂不可用 · 本地接续' };

export function createDndRenderer(send, rerender) {
  let room, user, container, selected = 'fighter', draft = '', characterName = '', note = '', retreat = false, submitting = false, shown = -1;
  const rolls = createRollPresentation(rerender);
  const narration = createNarrationPresentation();
  let panel = null, focus = '', sheetId = null, sceneId = null;
  function remember() {
    draft = container?.querySelector('#dnd-intent')?.value ?? draft;
    characterName = container?.querySelector('#dnd-name')?.value ?? characterName;
    note = container?.querySelector('#dnd-note')?.value ?? note;
  }

  function characterSetup(s) {
    const me = s.players.find(p => p.id === user.id), ready = s.players.filter(p => p.character).length;
    return `<section class="dnd-setup"><div class="dnd-setup-heading"><span class="dnd-eyebrow">WRITE YOUR FIRST CHAPTER</span><h2>${e(s.adventure.title)}</h2><p>${e(s.adventure.summary)}</p></div><div class="dnd-archetypes">${Object.entries(s.archetypes).map(([id, a]) => `<button type="button" data-action="game:archetype" data-id="${id}" class="dnd-archetype ${selected === id ? 'is-selected' : ''}" aria-pressed="${selected === id}" ${me.character ? 'disabled' : ''}><span class="dnd-class-icon">${actorImage(id)}</span><small>${e(a.className)}</small><strong>${e(a.title)}</strong><p>${e(a.description)}</p><span class="dnd-class-stats">HP ${a.hp} <i>·</i> AC ${a.ac}</span></button>`).join('')}</div>${me.character ? `<p class="dnd-ready" role="status">${e(me.character.name)} 已整装待发 · ${ready} / ${s.players.length} 位冒险者准备完成</p>` : `<div class="dnd-character-form"><label for="dnd-name">角色名<input id="dnd-name" maxlength="24" placeholder="给你的旅人起个名字" value="${e(characterName)}" autocomplete="off"></label><label for="dnd-note">私密背景 <small>仅自己可见 · 选填</small><textarea id="dnd-note" maxlength="240" rows="2" placeholder="你为何愿意接下这份委托？">${e(note)}</textarea></label>${button('带着这个名字出发 →', 'character', submitting || !!room.dissolution, 'class="gold-button"')}</div>`}</section>`;
  }
  function render(s) {
    const setup = s.phase === 'characters';
    return `<div class="dnd-game">${setup ? `<header class="dnd-header"><div><span class="dnd-eyebrow">THE MISTLIGHT CHRONICLES</span><h1>${e(s.adventure.title)}</h1></div></header>${characterSetup(s)}${guide(s)}` : adventureView(s, room, user, { panel, focus, sheetId, draft, retreat, submitting, narration: narration.text() }, guide(s))}${rolls.html(s, user.id, room.dissolution)}</div>`;
  }

  return {
    update(element, snapshot, me) {
      // Streaming updates change only narration; keep dialog focus, draft and scene DOM stable.
      if (room && room.revision === snapshot.revision && room.presentationRevision !== snapshot.presentationRevision && container === element) {
        room = snapshot; narration.observe(snapshot.game); return;
      }
      remember();
      const previous = element.querySelector('.dnd-journal'), scroll = previous?.scrollTop ?? 0;
      const atEnd = !previous || previous.scrollHeight - previous.scrollTop - previous.clientHeight < 80;
      const focusId = element.contains(document.activeElement) ? document.activeElement.id : null;
      const caret = focusId ? document.activeElement.selectionStart : null;
      const opened = [...element.querySelectorAll('details[open]')].map(d => d.className).filter(Boolean);
      room = snapshot; user = me; container = element;
      narration.observe(snapshot.game);
      rolls.observe(snapshot.game);
      if (sceneId !== snapshot.game.scene.id) { focus = ''; sceneId = snapshot.game.scene.id; }
      if (snapshot.game.combat && !snapshot.game.combat.enemies.some(e => e.id === focus && e.hp > 0)) focus = snapshot.game.combat.enemies.find(e => e.hp > 0)?.id ?? '';
      if (shown !== snapshot.game.step) retreat = false;
      shown = snapshot.game.step;
      element.innerHTML = render(snapshot.game);
      const info = element.querySelector('.dnd-info-dialog');
      if (info) { info.showModal(); info.addEventListener('cancel', event => { event.preventDefault(); panel = null; rerender(); }); }
      rolls.mount(element);
      narration.mount(element);
      const journal = element.querySelector('.dnd-journal'); if (journal) journal.scrollTop = atEnd ? journal.scrollHeight : scroll;
      for (const cls of opened) element.querySelector(`details.${cls}`)?.setAttribute('open', '');
      const focusedElement = focusId && element.querySelector(`#${focusId}`);
      if (focusedElement && !focusedElement.disabled) { focusedElement.focus({ preventScroll: true }); if (caret !== null) focusedElement.setSelectionRange(caret, caret); }
    },
    async handle(action, target) {
      remember();
      if (action === 'panel') { panel = target.dataset.id; sheetId = null; rerender(); return; }
      if (action === 'panel-close') { panel = null; rerender(); return; }
      if (action === 'sheet') { panel = 'character'; sheetId = target.dataset.id; rerender(); return; }
      if (action === 'focus') { focus = focus === target.dataset.id ? '' : target.dataset.id; rerender(); return; }
      if (action === 'last-roll') { rolls.replay(room.game.lastCheck); rerender(); return; }
      if (action === 'roll-close') { rolls.close(); rerender(); return; }
      if (action === 'archetype') { selected = target.dataset.id; rerender(); return; }
      if (action === 'retreat' || action === 'retreat-cancel') { retreat = action === 'retreat'; rerender(); return; }
      if (submitting || room.dissolution) return;
      let command;
      if (action === 'roll' || action === 'cancelCheck') { command = { type: action }; if (action === 'roll') rolls.begin(); }
      else if (action === 'character') { if (!characterName.trim()) { container.querySelector('#dnd-name').focus(); return; } command = { type: 'character', archetype: selected, name: characterName.trim(), note: note.trim() }; }
      else if (action === 'act') { if (!draft.trim()) { container.querySelector('#dnd-intent').focus(); return; } command = { type: 'act', text: draft.trim() }; }
      else if (action === 'choose') command = { type: 'choose', choiceId: target.dataset.id };
      else if (action === 'retreat-confirm') command = { type: 'choose', choiceId: 'retreat' };
      if (!command) return;
      panel = null; submitting = true; rerender();
      try { await send(command); if (action === 'act') { draft = ''; const input = container.querySelector('#dnd-intent'); if (input) input.value = ''; } }
      catch (error) { rolls.failed(); throw error; }
      finally { submitting = false; rerender(); }
    },
    dispose() { panel = null; focus = ''; sheetId = null; sceneId = null; narration.dispose(); rolls.dispose(); room = null; container = null; selected = 'fighter'; draft = ''; characterName = ''; note = ''; shown = -1; },
  };
}
