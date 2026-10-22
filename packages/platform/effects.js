/** Runs plugin-declared I/O outside transactions. Never imports game rules. */
export class EffectRunner {
  constructor(rooms, { providers = {}, concurrency = 4, timeoutMs = 25000, onError = () => console.error('Game effect could not be committed') } = {}) {
    this.rooms = rooms; this.providers = providers; this.concurrency = concurrency; this.timeoutMs = timeoutMs; this.onError = onError;
    this.queue = new Set(); this.active = new Map(); this.cache = new Map(); this.stopped = false;
  }
  job(id) {
    const room = this.rooms.store.data.rooms[id];
    if (!room || room.status !== 'playing' || room.dissolution) return null;
    const game = this.rooms.registry.get(room.gameId);
    if (room.stateVersion !== game.manifest.stateVersion || !game.effect || !game.applyEffect) return null;
    const effect = game.effect(room.game);
    return effect ? { effect, revision: room.revision, matchId: room.matchId, fingerprint: JSON.stringify([room.matchId, room.stateVersion, effect]) } : null;
  }
  sync(id) {
    if (this.stopped) return;
    const room = this.rooms.store.data.rooms[id];
    if (!room || room.status !== 'playing') { this.cache.delete(id); this.active.get(id)?.abort(); this.queue.delete(id); return; }
    if (!this.active.has(id)) this.queue.add(id);
    this.pump();
  }
  pump() {
    if (this.stopped) return;
    while (this.active.size < this.concurrency && this.queue.size) {
      const id = this.queue.values().next().value; this.queue.delete(id);
      let job;
      try { job = this.job(id); } catch { this.onError(); continue; }
      if (!job) continue;
      const controller = new AbortController(); this.active.set(id, controller);
      void this.run(id, job, controller);
    }
  }
  async run(id, job, controller) {
    let failed = false, timer;
    try {
      let cached = this.cache.get(id), result;
      if (cached?.fingerprint === job.fingerprint) result = cached.result;
      else {
        const provider = !job.effect.local && this.providers[job.effect.kind];
        result = { source: 'local', value: null };
        if (provider) {
          try {
            result = await Promise.race([
              Promise.resolve().then(() => {
                let lastProgress = 0;
                return provider(job.effect.input, { signal: controller.signal, onProgress: value => {
                  if (this.stopped || controller.signal.aborted || Date.now() - lastProgress < 80) return;
                  lastProgress = Date.now();
                  this.rooms.publishEffectProgress(id, { matchId: job.matchId, effectId: job.effect.id, fingerprint: job.fingerprint, value });
                } });
              }),
              new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Effect timeout')); }, this.timeoutMs); timer.unref?.(); }),
            ]);
          } catch { result = { source: 'fallback', value: null }; }
          finally { clearTimeout(timer); }
        }
        if (this.stopped) return;
        this.cache.set(id, { fingerprint: job.fingerprint, result });
      }
      if (this.stopped) return;
      // First attempt always checks the revision captured BEFORE the network request.
      const committed = this.rooms.completeEffect(id, { revision: job.revision, matchId: job.matchId, effectId: job.effect.id, result });
      if (committed || !this.rooms.store.data.rooms[id]) this.cache.delete(id);
    } catch { failed = true; this.onError(); }
    finally {
      this.rooms.clearEffectProgress(id, job.matchId, job.effect.id);
      clearTimeout(timer); this.active.delete(id);
      // A revision conflict is retried against a freshly projected request. An unchanged
      // request reuses its result; changed state never receives stale model output.
      if (!this.stopped && !failed && this.job(id)) this.queue.add(id);
      this.pump();
    }
  }
  resume() { for (const id of Object.keys(this.rooms.store.data.rooms)) this.sync(id); }
  stop() { this.stopped = true; this.queue.clear(); this.cache.clear(); for (const controller of this.active.values()) controller.abort(); }
}
