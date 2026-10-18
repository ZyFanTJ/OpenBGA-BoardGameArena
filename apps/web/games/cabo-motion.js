import { cardArt } from './cabo-cards.js';
import { playCaboCall, closeFinalRound } from './cabo/call-effect.js';

const handKey = (id, slot) => `hand:${id}:${slot}`;
const targetKey = target => handKey(target.playerId, target.slot);
const ended = state => ['roundEnd', 'finished'].includes(state?.phase);
const viewKey = snapshot => {
  const { motion, ...game } = snapshot.game;
  return JSON.stringify([game, snapshot.players, snapshot.hostId, snapshot.dissolution]);
};

function capture(container) {
  return new Map([...container.querySelectorAll('[data-motion-key]')].map(node => {
    const rect = node.getBoundingClientRect();
    return [node.dataset.motionKey, { node, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      value: node.dataset.value === '' ? null : Number(node.dataset.value),
      angle: node.classList.contains('draw-pile') ? -7 : node.classList.contains('discard-pile') ? 7 : 0 }];
  }));
}

/** Each scene owns its ghosts, animations and hidden destinations, including cancellation. */
class Scene {
  constructor(container, before, after, speed) {
    this.container = container; this.before = before; this.after = after; this.speed = speed;
    this.hidden = new Set(); this.animations = new Set(); this.holds = new Map(); this.cancelled = false;
    this.layer = document.createElement('div'); this.layer.className = 'cabo-motion-layer';
    this.layer.setAttribute('aria-hidden', 'true'); document.body.append(this.layer);
    // Mask changed faces before the browser paints the new snapshot, including final scoring reveals.
    for (const [key, card] of after) if (key.startsWith('hand:') && before.has(key) && before.get(key).value !== card.value) {
      this.hold(key, before.get(key));
    }
  }
  hide(key) {
    this.release(key);
    const node = this.after.get(key)?.node;
    if (node) { node.classList.add('motion-hidden'); this.hidden.add(node); }
  }
  show(key) { this.release(key); const node = this.after.get(key)?.node; node?.classList.remove('motion-hidden'); this.hidden.delete(node); }
  hold(key, anchor = this.before.get(key)) {
    if (!anchor || this.cancelled) return;
    this.hide(key);
    const ghost = document.createElement('div'); ghost.className = 'playing-card motion-card';
    Object.assign(ghost.style, { width: `${anchor.width}px`, height: `${anchor.height}px`, transform: `translate(${anchor.x}px,${anchor.y}px)` });
    ghost.innerHTML = `<span class="motion-face">${cardArt(anchor.value)}</span>`;
    this.layer.append(ghost); this.holds.set(key, ghost);
  }
  release(key) { this.holds.get(key)?.remove(); this.holds.delete(key); }
  async animate(node, frames, duration, delay = 0, easing = 'cubic-bezier(.22,.7,.2,1)') {
    if (this.cancelled) return;
    const animation = node.animate(frames, { duration: duration * this.speed, delay: delay * this.speed,
      easing, fill: 'both' });
    this.animations.add(animation);
    await animation.finished.catch(() => {});
    this.animations.delete(animation);
    return animation;
  }
  async fly(from, to, { duration = 540, delay = 0, value = to?.value, bend = -36, spin = 0, show = null } = {}) {
    if (!from || !to || this.cancelled) return;
    const ghost = document.createElement('div'); ghost.className = 'playing-card motion-card';
    Object.assign(ghost.style, { width: `${from.width}px`, height: `${from.height}px` });
    const flip = document.createElement('div'); flip.className = 'motion-flipper';
    flip.innerHTML = `<span class="motion-face">${cardArt(from.value)}</span><span class="motion-face motion-back">${cardArt(value)}</span>`;
    ghost.append(flip); this.layer.append(ghost);
    const sx = to.width / from.width, sy = to.height / from.height;
    const transform = (x, y, scaleX, scaleY, angle) => `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${scaleX},${scaleY})`;
    const tasks = [this.animate(ghost, [
      { transform: transform(from.x, from.y, 1, 1, from.angle ?? 0), filter: 'drop-shadow(0 3px 3px #00212d44)' },
      { offset: .46, transform: transform((from.x + to.x) / 2, (from.y + to.y) / 2 + bend, (1 + sx) / 2 * 1.09, (1 + sy) / 2 * 1.09, spin), filter: 'drop-shadow(0 18px 12px #00212d66)' },
      { offset: .88, transform: transform(to.x, to.y - 3, sx * 1.025, sy * 1.025, to.angle ?? 0) },
      { transform: transform(to.x, to.y, sx, sy, to.angle ?? 0), filter: 'drop-shadow(0 3px 3px #00212d44)' },
    ], duration, delay)];
    if (from.value !== value) tasks.push(this.animate(flip, [
      { transform: 'rotateY(0deg)' }, { offset: .18, transform: 'rotateY(0deg)' },
      { offset: .76, transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)' },
    ], duration, delay));
    await Promise.all(tasks); ghost.remove(); if (show) this.show(show);
  }
  async flip(key, delay = 0, lift = -14) {
    const from = this.before.get(key), to = this.after.get(key);
    if (!from || !to) return;
    this.hide(key);
    await this.fly(from, to, { duration: 480, delay, bend: lift, show: key });
  }
  async pulse(key, color = '#ffe6a3') {
    const anchor = this.after.get(key) ?? this.before.get(key);
    if (!anchor || this.cancelled) return;
    const ring = document.createElement('div'); ring.className = 'motion-ring';
    Object.assign(ring.style, { left: `${anchor.x - 8}px`, top: `${anchor.y - 8}px`, width: `${anchor.width + 16}px`, height: `${anchor.height + 16}px`, borderColor: color });
    this.layer.append(ring);
    await this.animate(ring, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: .8, offset: .25 }, { opacity: 0, transform: 'scale(1.32)' }], 560);
    ring.remove();
  }
  async title(text) {
    if (this.cancelled) return;
    const rect = this.container.getBoundingClientRect(), label = document.createElement('div');
    label.className = 'motion-title'; label.textContent = text;
    Object.assign(label.style, { left: `${rect.x + rect.width / 2}px`, top: `${rect.y + rect.height * .57}px` });
    this.layer.append(label);
    await this.animate(label, [{ opacity: 0, transform: 'translate(-50%,10px) scale(.9)' },
      { opacity: 1, offset: .22, transform: 'translate(-50%,0) scale(1)' },
      { opacity: 1, offset: .72 }, { opacity: 0, transform: 'translate(-50%,-12px) scale(1.02)' }], 620);
    label.remove();
  }
  cancel() { this.cancelled = true; for (const animation of this.animations) animation.cancel(); this.clean(); }
  clean() { for (const node of this.hidden) node.classList.remove('motion-hidden'); this.hidden.clear(); this.holds.clear(); this.layer.remove(); }
}

async function playMotion(scene, previous, next, actorName, reduced) {
  const motion = next.motion;
  if (!motion) return;
  const { before, after } = scene;
  const actor = motion.actorId, own = slot => handKey(actor, slot);
  switch (motion.kind) {
    case 'deal': {
      const targets = next.players.flatMap(p => p.cards.map(c => handKey(p.id, c.slot)));
      targets.forEach(key => scene.hide(key));
      await Promise.all(targets.map((key, i) => scene.fly({ ...after.get('deck'), value: null }, after.get(key),
        { duration: 400, delay: i * 24, bend: -22, show: key })));
      break;
    }
    case 'draw':
      scene.hide('held');
      await scene.fly(before.get(motion.source), after.get('held'), { duration: 580, spin: -9, show: 'held' });
      break;
    case 'discard':
      scene.hide('discard');
      await Promise.all([scene.fly(before.get('held'), after.get('discard'), { duration: 480, spin: 15, show: 'discard' }),
        scene.pulse('discard'), motion.ability ? scene.title(motion.ability.toUpperCase()) : null]);
      break;
    case 'exchange': {
      const oldCards = previous.players.find(p => p.id === actor).cards;
      const newCards = next.players.find(p => p.id === actor).cards;
      newCards.forEach(c => scene.hide(own(c.slot)));
      scene.hide('discard');
      const selected = new Set(motion.slots), survivorMoves = [];
      if (motion.success) {
        oldCards.filter(card => !selected.has(card.slot)).forEach(card => scene.hold(own(card.slot)));
        scene.hold('held');
        // Identical outgoing cards are now public on the discard pile; no hidden values are inferred.
        await Promise.all(motion.slots.map((slot, i) => scene.fly(before.get(own(slot)), after.get('discard'),
          { duration: 420, delay: i * 45, value: next.discardTop, spin: 12, bend: -45 })));
        scene.show('discard');
        oldCards.forEach(card => scene.release(own(card.slot))); scene.release('held');
        let index = 0;
        for (const card of oldCards) {
          if (selected.has(card.slot) && card.slot !== motion.replaceAt) continue;
          const destination = own(index++);
          survivorMoves.push(scene.fly(card.slot === motion.replaceAt ? before.get('held') : before.get(own(card.slot)), after.get(destination),
            { duration: card.slot === motion.replaceAt ? 460 : 340, bend: card.slot === motion.replaceAt ? -30 : 0, show: destination }));
        }
      } else {
        scene.show('discard');
        const added = newCards.length - oldCards.length, offset = motion.end === 'left' ? added : 0;
        for (const card of oldCards) {
          const destination = own(card.slot + offset);
          survivorMoves.push(scene.fly(before.get(own(card.slot)), after.get(destination),
            { duration: 480, bend: selected.has(card.slot) ? -28 : 0, show: destination }));
        }
        const incoming = motion.end === 'left' ? 0 : oldCards.length;
        survivorMoves.push(scene.fly(before.get('held'), after.get(own(incoming)), { delay: 160, duration: 460, show: own(incoming) }));
        if (added > 1) survivorMoves.push(scene.fly({ ...before.get('deck'), value: null }, after.get(own(incoming + 1)),
          { delay: 310, duration: 440, show: own(incoming + 1) }));
        survivorMoves.push(scene.title('换牌失败'));
      }
      await Promise.all(survivorMoves); break;
    }
    case 'swap': {
      const [a, b] = motion.targets.map(targetKey); scene.hide(a); scene.hide(b);
      await Promise.all([scene.fly(before.get(a), after.get(b), { duration: 760, bend: -65, spin: -12, show: b }),
        scene.fly(before.get(b), after.get(a), { duration: 760, bend: 45, spin: 12, show: a }), scene.pulse(a), scene.pulse(b)]);
      break;
    }
    case 'look': case 'peek': case 'spy': case 'cover':
      await Promise.all(motion.targets.map((target, i) => {
        const key = targetKey(target);
        return Promise.all([scene.flip(key, i * 65), motion.kind === 'cover' ? null : scene.pulse(key, motion.kind === 'spy' ? '#b9d9ff' : '#ffe6a3')]);
      }));
      break;
    case 'cabo': await playCaboCall(scene, actor, actorName, reduced); break;
  }
  if (ended(next) && !ended(previous) && !scene.cancelled) {
    if (previous?.caller) await closeFinalRound(scene);
    // Settlement reveals are supplied by this viewer's snapshot, never by the motion descriptor.
    await Promise.all(next.players.flatMap(p => p.cards.map((card, i) => {
      const key = handKey(p.id, card.slot);
      return scene.holds.has(key) ? scene.flip(key, i * 55) : null;
    })));
  }
}

/** Serialize authoritative snapshots; selection redraws use the same revision and never replay actions. */
export function createTableAnimator(render) {
  let displayed, latestRevision = -1, queue = [], running = false, scene, disposed = false, container;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = () => scene?.cancel();
  window.addEventListener('resize', cancel); window.addEventListener('scroll', cancel, true);
  document.addEventListener('visibilitychange', cancel); reduced.addEventListener('change', cancel);
  async function drain() {
    if (running || disposed) return;
    running = true; container.inert = true; container.setAttribute('aria-busy', 'true');
    let restoreFocus = container.contains(document.activeElement);
    try {
      while (queue.length && !disposed) {
        if (document.hidden || queue.length > 6) queue = [queue.at(-1)];
        const { snapshot, user } = queue.shift();
        // Chat/room-only revisions must not rebuild the table or reset a scrolled hand.
        if (displayed && viewKey(displayed) === viewKey(snapshot)) { displayed = snapshot; continue; }
        const before = capture(container), previous = displayed?.game;
        container.innerHTML = render(snapshot, user);
        const after = capture(container);
        const continuous = !displayed || snapshot.revision === displayed.revision + 1;
        const call = snapshot.game.motion?.kind === 'cabo' && previous && !previous.caller;
        const animate = snapshot.game.motion && continuous && !document.hidden && (!reduced.matches || call);
        displayed = snapshot;
        if (animate) {
          container.classList.add('motion-playing');
          scene = new Scene(container, before, after, queue.length > 1 ? .65 : 1);
          const actorName = snapshot.players.find(p => p.id === snapshot.game.motion.actorId)?.name ?? '玩家';
          try { await playMotion(scene, previous, snapshot.game, actorName, reduced.matches); }
          finally { scene.clean(); scene = null; container.classList.remove('motion-playing'); }
        }
      }
    } catch (error) {
      console.error('CABO animation failed', error);
      // An effect cannot leave the table locked or prevent the newest authoritative view from rendering.
      const latest = queue.at(-1); queue = [];
      if (latest) { displayed = latest.snapshot; container.innerHTML = render(latest.snapshot, latest.user); }
    } finally {
      running = false; container.inert = false; container.removeAttribute('aria-busy');
      if (restoreFocus && !disposed) container.querySelector('.table-actions button:not(:disabled), .playing-card:not(:disabled)')?.focus({ preventScroll: true });
    }
  }
  return {
    get busy() { return running; },
    update(target, snapshot, user) {
      if (disposed || snapshot.revision < latestRevision) return;
      container = target;
      if (snapshot.revision === latestRevision) {
        if (!running) {
          const before = capture(container); container.innerHTML = render(snapshot, user);
          // FLIP selection lift survives the otherwise stateless HTML renderer.
          if (!reduced.matches) for (const [key, card] of capture(container)) {
            const old = before.get(key);
            if (old && Math.abs(old.y - card.y) > 1) card.node.animate([
              { translate: `0 ${old.y - card.y}px` }, { translate: '0 0' },
            ], { duration: 180, easing: 'ease-out' });
          }
        }
        return;
      }
      latestRevision = snapshot.revision; queue.push({ snapshot, user }); void drain();
    },
    dispose() {
      disposed = true; queue = []; cancel();
      window.removeEventListener('resize', cancel); window.removeEventListener('scroll', cancel, true);
      document.removeEventListener('visibilitychange', cancel); reduced.removeEventListener('change', cancel);
    },
  };
}
