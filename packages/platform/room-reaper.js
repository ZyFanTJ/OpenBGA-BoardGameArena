/** Owns inactivity scheduling. Presence is injected; room transactions own deletion. */
export class RoomReaper {
  constructor(rooms, {isOnline, timeoutMs = 300000, intervalMs = 10000, onError = console.error} = {}) {
    if (typeof isOnline !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('Invalid room cleanup configuration');
    this.rooms = rooms; this.isOnline = isOnline; this.timeoutMs = timeoutMs; this.intervalMs = intervalMs; this.onError = onError;
    this.absentSince = new Map(); this.timer = null; this.stopped = false;
  }
  occupied(room) { return room.players.some(player => !player.isBot && !player.departed && this.isOnline(player.id)); }
  touch(userId) {
    if (!this.absentSince.size) return;
    const room = this.rooms.currentRoom({id:userId});
    if (room) this.absentSince.delete(room.id);
  }
  sync(id) {
    if (this.stopped) return;
    const room = this.rooms.store.data.rooms[id];
    if (!room || this.occupied(room)) this.absentSince.delete(id);
    else if (!this.absentSince.has(id)) this.absentSince.set(id, this.rooms.now());
  }
  sweep() {
    if (this.stopped) return;
    const ids = new Set([...this.absentSince.keys(), ...Object.keys(this.rooms.store.data.rooms)]);
    for (const id of ids) {
      try {
        this.sync(id);
        const since = this.absentSince.get(id), room = this.rooms.store.data.rooms[id];
        if (!room || since === undefined || this.rooms.now() - since < this.timeoutMs) continue;
        this.rooms.reclaim(id, {revision:room.revision, isVacant:current => this.absentSince.get(id) === since
          && this.rooms.now() - since >= this.timeoutMs && !this.occupied(current)});
      } catch (error) { this.onError(error); }
    }
  }
  resume() {
    if (this.timer) return;
    this.stopped = false;
    // Presence is intentionally ephemeral: a restart gives existing rooms a full reconnect grace period.
    this.sweep();
    this.timer = setInterval(() => this.sweep(), this.intervalMs); this.timer.unref?.();
  }
  stop() { this.stopped = true; clearInterval(this.timer); this.timer = null; this.absentSince.clear(); }
}
