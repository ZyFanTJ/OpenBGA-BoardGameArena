/** Owns SSE connections, per-player projection and bounded slow-client recovery. */
export class RoomEvents {
  constructor(rooms, sessions, { heartbeatMs = 20000, drainTimeoutMs = 15000 } = {}) {
    this.rooms = rooms; this.sessions = sessions; this.heartbeatMs = heartbeatMs; this.drainTimeoutMs = drainTimeoutMs;
    this.subscriptions = new Map();
  }
  authorize(client) {
    this.sessions.authenticate(client.token);
    this.rooms.member(this.rooms.room(client.id), client.user);
  }
  fail(client, error) {
    if (client.res.destroyed || client.res.writableEnded) return;
    if (!client.blocked && (error.status === 403 || error.status === 404)) {
      client.res.write(`data: ${JSON.stringify({ id: client.id, left: true, reason: this.rooms.store.data.rooms[client.id] ? 'left' : 'dissolved' })}\n\n`);
    }
    client.res.end();
  }
  write(client, frame) {
    if (client.res.destroyed || client.res.writableEnded) return;
    if (client.blocked) { client.needsSnapshot = true; return; }
    if (client.res.write(frame)) return;
    client.blocked = true;
    client.drainTimer = setTimeout(() => client.res.destroy(), this.drainTimeoutMs);
    client.drainTimer.unref?.();
    client.res.once('drain', () => {
      clearTimeout(client.drainTimer); client.blocked = false;
      if (!client.needsSnapshot || client.res.destroyed || client.res.writableEnded) return;
      client.needsSnapshot = false;
      try {
        this.authorize(client);
        this.write(client, `data: ${JSON.stringify(this.rooms.snapshot(client.id, client.user))}\n\n`);
      } catch (error) { this.fail(client, error); }
    });
  }
  add(id, res, user, token, protocol = 1) {
    const snapshot = this.rooms.snapshot(id, user);
    const clients = this.subscriptions.get(id) ?? new Set();
    if ([...clients].filter(c => c.user.id === user.id).length >= 5) {
      const error = new Error('打开的连接过多'); error.status = 429; throw error;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const client = { id, res, user, token, protocol, blocked: false, needsSnapshot: false };
    clients.add(client); this.subscriptions.set(id, clients);
    const timer = setInterval(() => {
      try { this.authorize(client); if (!client.blocked) this.write(client, ': heartbeat\n\n'); }
      catch (error) { this.fail(client, error); }
    }, this.heartbeatMs);
    timer.unref?.();
    res.on('close', () => {
      clearInterval(timer); clearTimeout(client.drainTimer); clients.delete(client);
      if (!clients.size) this.subscriptions.delete(id);
    });
    res.on('error', () => res.destroy());
    this.write(client, `retry: 1500\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }
  publish(id, transition, update) {
    const encoded = new Map();
    for (const client of this.subscriptions.get(id) ?? []) {
      try {
        this.authorize(client);
        if (client.blocked) { client.needsSnapshot = true; continue; }
        const key = `${client.protocol}:${client.user.id}`;
        if (!encoded.has(key)) {
          let event;
          if (client.protocol === 2 && update?.type === 'chat') {
            event = { type: 'chat', id, revision: this.rooms.room(id).revision, message: update.message };
          } else if (client.protocol === 2 && update?.type === 'presentation') {
            event = this.rooms.presentation(id, client.user);
          }
          event ??= this.rooms.snapshot(id, client.user, transition);
          encoded.set(key, `data: ${JSON.stringify(event)}\n\n`);
        }
        this.write(client, encoded.get(key));
      } catch (error) { this.fail(client, error); }
    }
  }
  closeUser(userId) {
    for (const clients of this.subscriptions.values()) for (const client of clients) if (client.user.id === userId) client.res.end();
  }
  close() { for (const clients of this.subscriptions.values()) for (const client of clients) client.res.end(); }
}
