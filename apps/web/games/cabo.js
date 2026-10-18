import { escapeHtml as e, button as b } from '../ui.js';
import { renderCaboTable } from './cabo-table.js';
import { createTableAnimator } from './cabo-motion.js';
import { caboShell } from './cabo-guide.js';
import { caboResults } from './cabo/results.js';

export function createCaboRenderer(send, rerender) {
  let selected = [], previousKey = '';
  let current, user, room, motion;
  const keyOf = (id, slot) => `${id}:${slot}`;
  function ownSlots() { return selected.filter(x => x.id === user.id).map(x => x.slot); }
  const renderer = {
    update(container, snapshot, me) {
      if (!container.querySelector('.cabo-board')) container.innerHTML = caboShell(snapshot.game.expert);
      motion ??= createTableAnimator((snapshot, me) => renderer.render(snapshot, me));
      motion.update(container.querySelector('.cabo-board'), snapshot, me);
    },
    dispose() { motion?.dispose(); motion = null; },
    render(snapshot, me) {
      room = snapshot; current = room.game; user = me;
      const s = current;
      const key = `${s.round}:${s.phase}:${s.turnId}:${s.setup?.confirmed}:${s.setup?.slots?.join(',')}`;
      if (previousKey !== key) { selected = []; previousKey = key; }
      const myTurn = s.turnId === user.id;
      const name = id => room.players.find(p => p.id === id)?.name ?? '玩家';
      const selectable = (p, card) => (s.phase === 'setup' && !s.setup && p.id === user.id) || (myTurn && (
        (s.phase === 'drawn' && p.id === user.id) || (s.phase === 'peek' && p.id === user.id && !card.faceUp) ||
        (s.phase === 'spy' && p.id !== user.id && !card.faceUp) || s.phase === 'swap'));
      let controls = '';
      let help = '';
      if (s.phase === 'setup') {
        if (!s.setup) { help = `选择两张起始牌 · ${ownSlots().length}/2`; controls = b('查看', 'game:look', ownSlots().length !== 2); }
        else if (!s.setup.confirmed) { help = '记住这两张牌'; controls = b('盖牌', 'game:confirm'); }
        else help = '等待其他玩家';
      } else if (['roundEnd', 'finished'].includes(s.phase)) {
        help = s.phase === 'finished' ? `${s.winners.map(name).join('、')} 获胜` : '本轮结算';
        controls = caboResults(s, name, user.id);
        if (room.hostId === user.id) controls += s.phase === 'roundEnd' ? b('下一轮', 'game:nextRound') : b('再来一局', 'rematch');
      } else if (!myTurn) help = `${name(s.turnId)} 的回合`;
      else if (s.phase === 'turn') {
        help = '你的回合 · 选择牌堆';
        controls = b('CABO', 'game:cabo', !!s.caller, 'class="accent"');
      } else if (s.phase === 'drawn') {
        help = '选择要换出的牌';
        controls = b(`换牌${ownSlots().length ? ` · ${ownSlots().length}` : ''}`, 'game:exchange', !ownSlots().length);
        if (s.drawn.source === 'deck') {
          controls += b('弃牌', 'game:discard', false, 'class="secondary"');
          if (s.drawn.value >= 7 && s.drawn.value <= 12) controls += b(s.drawn.value <= 8 ? 'PEEK' : s.drawn.value <= 10 ? 'SPY' : 'SWAP', 'game:power');
        }
        if (ownSlots().length > 1) controls += '<label class="inline-label">失败加牌<select id="cabo-end"><option value="right">右端</option><option value="left">左端</option></select></label>';
      } else if (['peek', 'spy', 'swap'].includes(s.phase)) {
        help = s.phase === 'swap' ? '各选一张自己和对手的牌' : s.phase === 'peek' ? '选择自己的暗牌' : '选择对手的暗牌';
        controls = b('确认', 'game:ability', s.phase === 'swap' ? !(ownSlots().length === 1 && selected.length === 2) : selected.length !== 1) + b('跳过', 'game:skip', false, 'class="secondary"');
      } else if (s.phase === 'reveal') {
        help = `${name(s.reveal.playerId)} · 第 ${s.reveal.slot + 1} 张`;
        controls = b('盖牌', 'game:confirm');
      }
      if (s.caller && myTurn && !['setup', 'roundEnd', 'finished'].includes(s.phase)) help = `最后一次行动 · ${help}`;
      return renderCaboTable({ s, room, user, name, selectable, selected, help, controls });
    },
    async handle(action, element) {
      if (action === 'guide-open') { document.querySelector('#cabo-guide-dialog').showModal(); return; }
      if (action === 'guide-close') { document.querySelector('#cabo-guide-dialog').close(); return; }
      if (motion?.busy) return;
      const s = current;
      if (action === 'card') {
        const choice = { id: element.dataset.player, slot: Number(element.dataset.slot) };
        const exists = selected.some(x => keyOf(x.id, x.slot) === keyOf(choice.id, choice.slot));
        if (exists) selected = selected.filter(x => keyOf(x.id, x.slot) !== keyOf(choice.id, choice.slot));
        else {
          if (s.phase === 'setup' && selected.length >= 2) selected.shift();
          if (['peek', 'spy'].includes(s.phase)) selected = [];
          if (s.phase === 'swap') selected = selected.filter(x => (x.id === user.id) !== (choice.id === user.id));
          selected.push(choice);
        }
        rerender(); return;
      }
      const commands = { look: { type: 'look', slots: ownSlots() }, confirm: { type: 'confirm' },
        deck: { type: 'draw', source: 'deck' }, discardPile: { type: 'draw', source: 'discard' }, cabo: { type: 'cabo' },
        discard: { type: 'discard' }, power: { type: 'discard', useAbility: true }, skip: { type: 'skip' }, nextRound: { type: 'nextRound' },
        exchange: { type: 'exchange', slots: ownSlots(), replaceAt: ownSlots()[0], end: document.querySelector('#cabo-end')?.value ?? 'right' },
      };
      if (action === 'ability') {
        const other = selected.find(x => x.id !== user.id) ?? selected[0];
        commands.ability = { type: 'ability', targetId: other?.id, slot: other?.slot, ownSlot: ownSlots()[0] };
      }
      if (commands[action]) { await send(commands[action]); selected = []; }
    },
  };
  return renderer;
}
