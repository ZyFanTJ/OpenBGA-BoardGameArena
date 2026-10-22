/** A DOM-only presentation buffer. Rules and transcript stay server-owned. */
export function createNarrationPresentation({ reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches, now = () => performance.now(), requestFrame = fn => requestAnimationFrame(fn), cancelFrame = id => cancelAnimationFrame(id) } = {}) {
  let key = null, target = '', shown = '', node = null, frame = null, previousTime = 0, credit = 0, live = false;
  const reduced = reducedMotion;
  function paint() {
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
    node.textContent = shown;
    node.classList.toggle('is-typing', shown !== target || live);
    node.setAttribute('aria-busy', String(shown !== target || live));
    if (atBottom) node.scrollTop = node.scrollHeight;
  }
  function tick(now) {
    frame = null;
    const backlog = Array.from(target.slice(shown.length));
    if (reduced()) shown = target;
    else {
      credit += Math.min(now - previousTime, 80) / 1000 * (backlog.length > 50 ? 90 : 35);
      const count = Math.floor(credit); credit -= count;
      shown += backlog.slice(0, count).join('');
    }
    previousTime = now; paint();
    if (shown !== target) frame = requestFrame(tick);
  }
  function schedule() {
    paint();
    if (node && shown !== target && !frame) { previousTime = now(); frame = requestFrame(tick); }
  }
  return {
    observe(s) {
      const scene = s.journal.findLast(a => a.kind === 'scene');
      const last = s.journal.findLast(a => a.kind === 'dm' && a.id > (scene?.id ?? 0));
      const nextKey = s.narrationStream ? `stream:${s.narrationStream.id}` : last ? `entry:${last.id}` : `scene:${s.scene.id}`;
      const text = s.narrationStream?.text ?? last?.text ?? s.scene.description;
      const wasLive = live; live = !!s.narrationStream;
      if (key === null) shown = live ? '' : text;
      else if (nextKey !== key) {
        if (!(wasLive && !live && text.startsWith(target))) shown = live ? '' : text;
      } else if (!text.startsWith(shown)) shown = live ? '' : text;
      target = text; key = nextKey;
      if (reduced()) shown = target;
      schedule();
    },
    text: () => shown,
    mount(container) { node = container.querySelector('.dnd-caption-text'); schedule(); },
    dispose() { if (frame) cancelFrame(frame); frame = null; key = null; node = null; target = ''; shown = ''; live = false; credit = 0; },
  };
}
