import { escapeHtml as e, button as b } from '../../ui.js';

const signed = value => `${value >= 0 ? '+' : ''}${value}`;
export function checkSummary(spec) {
  if (!spec) return '<span class="dnd-check-preview is-free">直接行动 · 无需检定</span>';
  return `<span class="dnd-check-preview"><strong>${e(spec.dice)} ${signed(spec.bonus)}${spec.multiplier > 1 ? ` × ${spec.multiplier}` : ''}</strong>${spec.target !== null ? `<span>${spec.kind === 'attack' ? 'AC' : 'DC'} ${spec.target}</span>` : '<span>资源骰</span>'}${spec.mode !== 'normal' ? `<em>${spec.mode === 'advantage' ? '优势 · 两骰取高' : '劣势 · 两骰取低'}${spec.circumstance || spec.advantageReason ? ` · ${e(spec.circumstance || spec.advantageReason)}` : ''}</em>` : ''}</span><span class="dnd-check-terms">${spec.terms.map(t => `${e(t.label)}${t.score !== undefined ? ` ${t.score}` : ''} (${signed(t.bonus)})`).join(' + ')}${spec.successChance !== undefined ? ` · ${spec.kind === 'save' ? '造成伤害' : '成功'} ${spec.successChance}%` : ''}</span>`;
}
function dice(value, sides) {
  return `<div class="dnd-hero-die"><svg viewBox="0 0 160 180" aria-hidden="true"><path d="M80 5 150 48v84l-70 43-70-43V48Z"/><path class="dnd-die-facets" d="M80 5 39 59 10 48m29 11h82l29-11M80 5l41 54 29 73m-29-73L80 139 39 59l-29 73m70 7v36m0-36 70-7m-70 7-70-7"/></svg><span class="dnd-die-value" data-sides="${sides}">${e(value)}</span><small>d${sides}</small></div>`;
}
/** Animation is presentation only: numbers are revealed from the committed server event. */
export function createRollPresentation(rerender) {
  let seen, reveal = null, rolling = false, until = 0, frame = null, element = null, lastTick = -1;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate() {
    if (!rolling || !element) return;
    if (reveal && performance.now() >= until) { rolling = false; frame = null; rerender(); return; }
    const tick = Math.floor(performance.now() / 85);
    if (tick !== lastTick) {
      lastTick = tick;
      element.querySelectorAll('.dnd-die-value').forEach((node, i) => { node.textContent = String(1 + (tick * 7 + i * 9) % Number(node.dataset.sides)); });
    }
    frame = requestAnimationFrame(animate);
  }
  return {
    replay(result) { if (result) { this.close(); reveal = result; } },
    begin() { rolling = true; until = performance.now() + (reduced() ? 0 : 1250); lastTick = -1; },
    observe(view) {
      const id = view.lastCheck?.id ?? null;
      if (seen === undefined) { seen = id; return; }
      if (id && id !== seen) {
        reveal = view.lastCheck; seen = id;
        if (!rolling) { rolling = !reduced(); until = performance.now() + 1050; }
      }
    },
    html(view, userId, paused) {
      if (paused) return '';
      const pending = view.pendingCheck, spec = reveal?.spec ?? pending?.spec;
      if (!spec) return '';
      const stakes = spec.stakes ? `<div class="dnd-action-stakes"><b>${e(spec.title)}</b><p>${e(spec.reason)}</p><div><span>成功</span>${e(spec.stakes.success)}</div><div><span>失败</span>${e(spec.stakes.failure)}</div><small>${e(spec.consequence)}</small></div>` : '';
      const mine = pending?.playerId === userId, event = reveal?.event, shown = !!event && !rolling;
      const result = event?.roll ?? event?.damage;
      const values = shown ? result.dice : Array.from({ length: spec.count }, () => '✦');
      const success = event?.success !== false;
      const naturalCritical = spec.kind === 'attack' && event?.roll?.critical;
      const outcome = naturalCritical ? '重击' : spec.kind === 'effect' ? '结果已揭晓' : success ? '成功' : '未成功';
      return `<dialog class="dnd-roll-dialog ${rolling ? 'is-rolling' : ''} ${shown ? success ? 'is-success' : 'is-failure' : ''}" aria-labelledby="dnd-roll-heading"><div class="dnd-roll-ornament" aria-hidden="true">✧</div><span class="dnd-eyebrow">LET FATE SPEAK</span><h2 id="dnd-roll-heading">${e(spec.label)}</h2><p class="dnd-roll-context">${e(view.players.find(p => p.id === (reveal?.playerId ?? pending?.playerId))?.character?.name)}</p>${stakes}${spec.target !== null ? `<div class="dnd-roll-target"><span>${e(spec.targetLabel)}</span><b>${spec.target}</b></div>` : `<div class="dnd-roll-target"><span>${e(spec.rule)}</span></div>`}<div class="dnd-hero-dice">${values.map(v => dice(v, spec.sides)).join('')}</div>${spec.mode === 'advantage' ? `<div class="dnd-advantage-banner">优势 · 两枚 d20 取高${spec.advantageReason ? ` · ${e(spec.advantageReason)}` : ''}</div>` : ''}${spec.circumstance ? `<div class="dnd-advantage-banner">${spec.mode === 'advantage' ? '优势' : spec.mode === 'disadvantage' ? '劣势' : '优势与劣势抵消'} · ${e(spec.circumstance)}</div>` : ''}${spec.difficultyReason ? `<div class="dnd-advantage-banner">${e(spec.difficultyReason)}</div>` : ''}<div class="dnd-bonus-tray">${spec.terms.map(t => `<div><strong>${signed(t.bonus)}</strong><span>${e(t.label)}${t.score !== undefined ? ` · ${t.score}` : ''}</span></div>`).join('') || '<div><strong>+0</strong><span>没有属性加值</span></div>'}</div>${shown ? `<div class="dnd-roll-result" role="status"><span>${outcome}</span><strong>${result.total}</strong><p>${e(event.text)}</p></div>${b('继续冒险', 'game:roll-close', false, 'class="gold-button"')}` : `<details class="dnd-roll-rule"><summary>判定规则</summary><p>${e(spec.rule)}</p></details><div class="dnd-roll-buttons">${b(rolling ? '命运正在转动…' : mine ? '掷骰' : '等待同伴掷骰', 'game:roll', !mine || rolling, 'class="gold-button dnd-roll-trigger"')}${mine && !rolling ? b('重新选择', 'game:cancelCheck', false, 'class="secondary"') : ''}</div>`}<small class="dnd-roll-footnote">${shown ? '已保存' : spec.kind === 'effect' ? '确认后消耗资源' : ''}</small></dialog>`;
    },
    mount(container) {
      element = container.querySelector('.dnd-roll-dialog');
      if (!element) { if (frame) cancelAnimationFrame(frame); frame = null; return; }
      element.showModal();
      element.addEventListener('cancel', event => { event.preventDefault(); if (reveal && !rolling) { reveal = null; rerender(); } });
      if (rolling && !frame) frame = requestAnimationFrame(animate);
    },
    close() { reveal = null; rolling = false; if (frame) cancelAnimationFrame(frame); frame = null; },
    failed() { if (!reveal) this.close(); },
    dispose() { this.close(); seen = undefined; element = null; },
  };
}
