/** Generic bot scheduling. Game decisions use only the plugin's redacted view. */
export class BotRunner {
  constructor(rooms, { delay = 800, onError = console.error } = {}) {
    this.rooms = rooms; this.delay = delay; this.onError = onError;
    this.timers = new Map(); this.memories = new Map(); this.applying = new Map(); this.revisions = new Map(); this.stopped = false;
  }
  sync(roomId, transition) {
    try { this.schedule(roomId, transition); } catch (error) { this.onError(error); }
  }
  schedule(roomId, transition) {
    const room = this.rooms.store.data.rooms[roomId];
    // Chat notifications share the revision and must not postpone or replay a turn.
    if (!this.stopped && room?.status === 'playing' && this.revisions.get(roomId) === room.revision) return;
    clearTimeout(this.timers.get(roomId)); this.timers.delete(roomId);
    if (this.stopped || !room || room.status !== 'playing') { this.memories.delete(roomId); this.revisions.delete(roomId); return; }
    if (room.dissolution) { this.revisions.delete(roomId); return; }
    this.revisions.set(roomId, room.revision);
    const game = this.rooms.registry.get(room.gameId);
    if (!game.bot || game.realtime || room.stateVersion !== game.manifest.stateVersion) return;
    const memories = this.memories.get(roomId) ?? new Map(); this.memories.set(roomId, memories);
    const applying = this.applying.get(roomId);
    const candidates = [];
    for (const player of room.players.filter(p => p.isBot)) {
      const view = game.view(room.game, player.id, transition);
      const memory = game.bot.observe(view, player.id, memories.get(player.id), applying?.playerId === player.id ? applying.command : null);
      memories.set(player.id, memory);
      candidates.push({player, view, memory});
    }
    if (!candidates.length) return;
    const revision = room.revision;
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      try {
        if (this.stopped) return;
        if (this.rooms.store.data.rooms[roomId]?.revision !== revision) return this.sync(roomId);
        // Keep observation in commit order, but move decision work off the HTTP response path.
        // Once a bot can act, later candidates will be reconsidered against the next revision.
        let next;
        for (const {player, view, memory} of candidates) {
          const command = game.bot.decide(view, player.id, memory, {difficulty:player.botDifficulty});
          if (command) { next = {player, command}; break; }
        }
        if (!next) return;
        this.applying.set(roomId, { playerId: next.player.id, command: next.command });
        this.rooms.mutate(next.player, roomId, { type: 'game', command: next.command, revision }, { bot: true });
      } catch (error) {
        // Failed actions never spin in a retry loop. Another room change can retry.
        this.onError(error);
      } finally { this.applying.delete(roomId); }
    }, this.delay);
    timer.unref?.(); this.timers.set(roomId, timer);
  }
  resume() { for (const id of Object.keys(this.rooms.store.data.rooms)) this.sync(id); }
  stop() {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear(); this.memories.clear(); this.applying.clear(); this.revisions.clear();
  }
}
