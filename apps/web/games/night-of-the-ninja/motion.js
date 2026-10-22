import { ninjaCues } from './presentation.js';

/** Preserve each public action across fast pushes; room/chat redraws never replay it. */
export function createNinjaAnimator(draw) {
  let container, displayed, latest, acceptedRevision = -1, queue = [], running = false, disposed = false;
  const animations = new Set(), overlays = new Set(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = () => { animations.forEach(a => a.cancel()); overlays.forEach(o => o.remove()); };
  window.addEventListener('resize', cancel); window.addEventListener('scroll', cancel, true);
  document.addEventListener('visibilitychange', cancel); reduced.addEventListener('change', cancel);
  function animate(el, frames, duration) {
    if (!el || reduced.matches) return Promise.resolve();
    const animation = el.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }); animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => { animations.delete(animation); animation.cancel(); });
  }
  const seat = id => [...container.querySelectorAll('[data-motion-player]')].find(el => el.dataset.motionPlayer === id);
  const lockInputs = locked => container?.querySelectorAll('.nn-controls,.nn-hand').forEach(el => { el.inert = locked; });
  const sourceRect = cue => seat(cue.actorId)?.querySelector('.nn-seat-cards .nn-card, .nn-hand .nn-card')?.getBoundingClientRect() ?? seat(cue.actorId)?.getBoundingClientRect();
  async function play(cue, origin, speed) {
    if (disposed || document.hidden) return;
    const stage = container.querySelector('.nn-stage'); stage?.classList.add('nn-motion-playing');
    const work = [], actor = seat(cue.actorId);
    work.push(animate(container.querySelector('.nn-spotlight'), [{ opacity: .35, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], 280 * speed));
    if (actor) work.push(animate(actor, [{ boxShadow: '0 0 0 0 #ffe4a800' }, { boxShadow: '0 0 0 4px #ffe4a8,0 0 32px #ffe4a866' }, { boxShadow: '0 0 0 2px #ffe4a877' }], 1050 * speed));
    let overlay;
    if (!reduced.matches) {
      overlay = document.createElement('div'); overlay.className = 'nn-motion-layer'; overlay.setAttribute('aria-hidden', 'true');
      document.body.append(overlay); overlays.add(overlay);
    }
    if (cue.kind === 'play' && origin && overlay) {
      const destination = container.querySelector('.nn-spotlight-card .nn-card');
      if (destination) {
        const end = destination.getBoundingClientRect(), ghost = destination.cloneNode(true);
        ghost.classList.add('nn-flying-card'); ghost.style.width = `${end.width}px`; ghost.style.height = `${end.height}px`;
        overlay.append(ghost); destination.classList.add('nn-motion-hidden');
        work.push(animate(ghost, [
          { transform: `translate(${origin.x}px,${origin.y}px) scale(${origin.width / end.width},${origin.height / end.height}) rotate(-12deg)`, opacity: .6 },
          { transform: `translate(${end.x}px,${end.y - 16}px) scale(1.08) rotate(3deg)`, opacity: 1, offset: .7 },
          { transform: `translate(${end.x}px,${end.y}px) scale(1) rotate(0)`, opacity: 1 },
        ], 720 * speed).finally(() => destination.classList.remove('nn-motion-hidden')));
      }
    }
    const targets = cue.kind === 'reaction' && cue.choice !== 'mirrorMonk' ? [cue.actorId] : cue.targetIds ?? [];
    for (const id of targets) {
      const target = seat(id); if (!target) continue;
      const danger = cue.kind === 'attack' || cue.kind === 'reaction' && cue.choice !== 'mirrorMonk', color = danger ? '#ffad88' : '#ffe2a1';
      work.push(animate(target, [{ boxShadow: `0 0 0 0 ${color}00` }, { boxShadow: `0 0 0 4px ${color},0 0 34px ${color}66` }, { boxShadow: `0 0 0 2px ${color}88` }], 1050 * speed));
      if (danger) work.push(animate(target, [{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '5px 0' }, { translate: '0 0' }], 400 * speed));
      if (overlay && actor && target !== actor && ['attack', 'ability', 'reaction'].includes(cue.kind)) {
        const a = actor.getBoundingClientRect(), b = target.getBoundingClientRect(), ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('nn-target-line');
        svg.setAttribute('width', String(window.innerWidth)); svg.setAttribute('height', String(window.innerHeight));
        svg.innerHTML = `<defs><marker id="nn-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="${color}" stroke-width="2"/></marker></defs><path d="M${ax},${ay} Q${(ax + bx) / 2},${Math.min(ay, by) - 75} ${bx},${by}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="12 7" marker-end="url(#nn-arrow)"/>`;
        overlay.append(svg); work.push(animate(svg, [{ opacity: 0, strokeDashoffset: 70 }, { opacity: 1, strokeDashoffset: 0, offset: .25 }, { opacity: .85, strokeDashoffset: -90 }], 1050 * speed));
      }
    }
    // A readable pause remains even when motion is reduced; cancellation resolves it immediately.
    const pause = container.querySelector('.nn-spotlight');
    if (pause) {
      const hold = pause.animate([{ opacity: 1 }, { opacity: 1 }], { duration: (cue.kind === 'phase' ? 600 : 1150) * speed });
      animations.add(hold); work.push(hold.finished.catch(() => {}).finally(() => { animations.delete(hold); hold.cancel(); }));
    }
    await Promise.all(work);
    overlay?.remove(); overlays.delete(overlay); stage?.classList.remove('nn-motion-playing');
  }
  async function drain() {
    if (running || disposed) return;
    running = true; container.setAttribute('aria-busy', 'true'); lockInputs(true);
    try {
      while (queue.length && !disposed) {
        if (document.hidden || queue.length > 6) queue = [queue.at(-1)];
        const { snapshot, me } = queue.shift(), previous = displayed?.game;
        const continuous = !previous || snapshot.game.sequence === previous.sequence + 1;
        const cues = continuous && !document.hidden ? ninjaCues(previous, snapshot.game) : [];
        for (const cue of cues) {
          const origin = sourceRect(cue); draw(container, snapshot, me, cue); lockInputs(true);
          await play(cue, origin, queue.length > 2 ? .65 : 1); if (disposed) break;
        }
        if (disposed) break;
        draw(container, snapshot, me, null); displayed = snapshot;
      }
    } catch (error) {
      console.error('Ninja presentation failed', error);
      queue = []; cancel(); overlays.clear();
      if (latest && !disposed) draw(container, latest.snapshot, latest.me, null);
    } finally {
      running = false; if (!disposed && container) { lockInputs(false); container.removeAttribute('aria-busy'); }
    }
  }
  return {
    get busy() { return running; },
    update(target, snapshot, me) {
      if (disposed || snapshot.revision < acceptedRevision) return;
      container = target; latest = { snapshot, me };
      if (snapshot.revision === acceptedRevision) { if (!running) draw(container, snapshot, me, null); return; }
      acceptedRevision = snapshot.revision;
      // Duplicate/chat pushes cannot cancel a visible play or its target guide.
      if (displayed && snapshot.game.sequence === displayed.game.sequence && !running) { displayed = snapshot; draw(container, snapshot, me, null); return; }
      queue.push({ snapshot, me }); void drain();
    },
    dispose() {
      disposed = true; queue = []; cancel(); overlays.clear(); animations.clear(); if (container) { lockInputs(false); container.removeAttribute('aria-busy'); }
      window.removeEventListener('resize', cancel); window.removeEventListener('scroll', cancel, true);
      document.removeEventListener('visibilitychange', cancel); reduced.removeEventListener('change', cancel);
    },
  };
}
