const root = '/assets/cabo/audio/';
const preferenceKey = 'moon-table:cabo-audio:v1';
export const soundFiles = {
  deal: 'card-shuffle.mp3', draw: 'card-slide-1.mp3', place: 'card-place-1.mp3',
  flip: 'card-shove-1.mp3', select: 'click_001.mp3', peek: 'glass_001.mp3',
  spy: 'glass_002.mp3', swap: 'card-slide-4.mp3', failure: 'error_001.mp3',
  cabo: 'jingles_PIZZI01.mp3', result: 'jingles_PIZZI09.mp3', win: 'jingles_PIZZI10.mp3',
};

// Only public action descriptors and this player's view determine sounds.
export function transitionSound(previous, next, userId, stage = 'start') {
  if (!previous) return null;
  const ended = s => ['roundEnd', 'finished'].includes(s.phase);
  if (stage === 'end') return ended(next) && !ended(previous)
    ? next.phase === 'finished' && next.winners?.includes(userId) ? 'win' : 'result' : null;
  const motion = next.motion;
  if (!motion) return null;
  if (motion.kind === 'exchange') return motion.success ? 'place' : 'failure';
  return ({deal:'deal', draw:'draw', discard:'place', look:'flip', cover:'flip', peek:'peek', spy:'spy', swap:'swap', cabo:'cabo'})[motion.kind] ?? null;
}

export function audioControls() {
  return `<details class="cabo-audio"><summary aria-label="声音设置">♫ 声音</summary><div class="cabo-audio-panel">
    <label><input type="checkbox" data-cabo-audio="music">背景音乐</label>
    <label>音乐音量<input type="range" min="0" max="100" data-cabo-audio="musicVolume" aria-label="音乐音量"></label>
    <label><input type="checkbox" data-cabo-audio="effects">游戏音效</label>
    <label>音效音量<input type="range" min="0" max="100" data-cabo-audio="effectsVolume" aria-label="音效音量"></label>
    <small data-cabo-audio-status role="status">点击牌桌后开启声音</small>
    <details class="cabo-audio-credits"><summary>音乐与音效来源</summary><p><a href="https://opengameart.org/content/happy-go-lucky-puzzle" target="_blank" rel="noopener noreferrer">Happy-Go-Lucky Puzzle</a> — Axton Crolley<br><a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a> · 原始音频，未修改</p><p>音效：<a href="https://kenney.nl/assets" target="_blank" rel="noopener noreferrer">Kenney</a> · Casino Audio / Interface Sounds / Music Jingles · <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a> · 转为 MP3</p></details>
  </div></details>`;
}

export function createCaboAudio(container) {
  let preferences = {music:true, effects:true, musicVolume:22, effectsVolume:55};
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    for (const key of ['music','effects']) if (typeof saved?.[key] === 'boolean') preferences[key] = saved[key];
    for (const key of ['musicVolume','effectsVolume']) if (Number.isFinite(saved?.[key])) preferences[key] = Math.max(0, Math.min(100, saved[key]));
  } catch { /* Storage can be unavailable in private browsing. */ }
  const music = new Audio(root + 'periwinkle.mp3');
  music.loop = true; music.preload = 'none';
  let context, unlocked = false, disposed = false, loading = false, musicPending = false, musicBlocked = false;
  const buffers = new Map(), playing = new Set();
  function status() {
    const el = container.querySelector('[data-cabo-audio-status]');
    if (el) el.textContent = music.error ? '音乐暂不可用，可继续游戏' : !unlocked || musicBlocked ? '点击牌桌后开启声音' : '切到后台自动暂停';
  }
  function syncMusic() {
    music.volume = preferences.musicVolume / 100;
    if (disposed || document.hidden || !unlocked || !preferences.music || !preferences.musicVolume) { music.pause(); return; }
    if (!music.paused || musicPending) return;
    musicPending = true;
    Promise.resolve(music.play()).then(() => {
      musicBlocked = false;
      if (disposed || document.hidden || !preferences.music || !preferences.musicVolume) music.pause();
    }).catch(() => { musicBlocked = true; }).finally(() => { musicPending = false; status(); });
  }
  function stopEffects() {
    for (const node of playing) { try { node.stop(); } catch {} }
    playing.clear();
  }
  function loadEffects() {
    if (loading || !context || !preferences.effects) return;
    loading = true;
    for (const [name, file] of Object.entries(soundFiles)) {
      fetch(root + file).then(response => { if (!response.ok) throw new Error('Audio unavailable'); return response.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes)).then(buffer => { if (!disposed) buffers.set(name, buffer); }).catch(() => {});
    }
  }
  function unlock() {
    if (disposed || document.hidden) return;
    unlocked = true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!context && preferences.effects && AudioContext) { try { context = new AudioContext(); } catch {} }
    if (preferences.effects) context?.resume().catch(() => {});
    loadEffects(); syncMusic(); status();
  }
  function play(name) {
    if (disposed || document.hidden || !unlocked || !preferences.effects || !preferences.effectsVolume || context?.state !== 'running' || !buffers.has(name)) return;
    if (playing.size >= 4) { const first = playing.values().next().value; first.stop(); playing.delete(first); }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffers.get(name); gain.gain.value = preferences.effectsVolume / 100 * .65;
    source.connect(gain); gain.connect(context.destination); playing.add(source);
    source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }
  function change(event) {
    const key = event.target.dataset?.caboAudio;
    if (!Object.hasOwn(preferences, key)) return;
    preferences[key] = event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value);
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
    if (!preferences.effects || key === 'effectsVolume') stopEffects();
    unlock();
  }
  function visibility() {
    stopEffects();
    if (document.hidden) context?.suspend().catch(() => {});
    else if (unlocked && preferences.effects) context?.resume().catch(() => {});
    syncMusic();
  }
  for (const el of container.querySelectorAll('[data-cabo-audio]')) {
    const value = preferences[el.dataset.caboAudio];
    if (el.type === 'checkbox') el.checked = value; else el.value = value;
  }
  container.addEventListener('pointerdown', unlock);
  container.addEventListener('keydown', unlock);
  container.addEventListener('input', change);
  document.addEventListener('visibilitychange', visibility);
  music.addEventListener('error', status);
  return {
    play, stopEffects,
    transition(previous, next, user, stage) { const sound = transitionSound(previous, next, user.id, stage); if (sound) play(sound); },
    dispose() {
      disposed = true; stopEffects(); music.pause(); music.removeAttribute('src'); music.load();
      context?.close().catch(() => {}); buffers.clear();
      container.removeEventListener('pointerdown', unlock); container.removeEventListener('keydown', unlock);
      container.removeEventListener('input', change); document.removeEventListener('visibilitychange', visibility);
      music.removeEventListener('error', status);
    },
  };
}
