import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomService } from '../../packages/platform/rooms.js';
import { SessionService } from '../../packages/platform/sessions.js';
import { ChatService } from '../../packages/platform/chat.js';
import { BotRunner } from '../../packages/platform/bots.js';
import { ensure } from '../../packages/platform/errors.js';

const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
const cardAtlas = fileURLToPath(new URL('../../assets/cabo/reference-style/cabo-atlas-v1.png', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; ensure(Buffer.byteLength(text) <= 8192, '请求过大', 413); }
  try { const result = JSON.parse(text || '{}'); ensure(result && typeof result === 'object' && !Array.isArray(result), '请求格式无效'); return result; }
  catch { ensure(false, '请求不是有效 JSON'); }
}
function cookie(req) { return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('moon_session='))?.slice(13); }
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }

export function createApp({ store, registry, random, secureCookies = false, botDelay = 800 }) {
  const subscriptions = new Map();
  const rate = new Map();
  let bots;
  const service = new RoomService(store, registry, { random, notify(id, transition) {
    // Observe synchronously after commit, before the next action can change a private view.
    bots?.sync(id);
    for (const client of subscriptions.get(id) ?? []) {
      try { client.res.write(`data: ${JSON.stringify(service.snapshot(id, client.user, transition))}\n\n`); }
      catch (error) {
        if (error.status === 403 || error.status === 404) client.res.write(`data: ${JSON.stringify({ id, left: true, reason: store.data.rooms[id] ? 'left' : 'dissolved' })}\n\n`);
        client.res.end();
      }
    }
  } });
  bots = new BotRunner(service, { delay: botDelay });
  const sessions = new SessionService(store);
  const chat = new ChatService(store, service);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://local');
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        if (req.method !== 'GET') {
          const origin = req.headers.origin;
          ensure(!origin || new URL(origin).host === req.headers.host, '跨站请求被拒绝', 403);
          ensure(req.headers['content-type']?.startsWith('application/json'), '需要 JSON 请求', 415);
          const key = req.socket.remoteAddress;
          const now = Date.now();
          if (rate.size > 1000) for (const [ip, entry] of rate) if (now - entry.at > 60000) rate.delete(ip);
          const item = rate.get(key) ?? { at: now, count: 0 };
          if (now - item.at > 60000) { item.at = now; item.count = 0; }
          item.count++; rate.set(key, item); ensure(item.count <= 240, '操作过于频繁，请稍后再试', 429);
        }
        if (path === '/api/games' && req.method === 'GET') return json(res, 200, registry.list());
        if (path === '/api/lobby' && req.method === 'GET') return json(res, 200, { rooms: service.directory() });
        if (path === '/api/session' && req.method === 'POST') {
          const input = await body(req); const session = sessions.create(input.name);
          res.setHeader('Set-Cookie', `moon_session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secureCookies ? '; Secure' : ''}`);
          return json(res, 201, session.user);
        }
        const user = sessions.authenticate(cookie(req));
        if (path === '/api/me' && req.method === 'GET') return json(res, 200, { user, roomId: service.currentRoom(user)?.id ?? null });
        if (path === '/api/rooms' && req.method === 'POST') return json(res, 201, service.createRoom(user, await body(req)));
        const match = path.match(/^\/api\/rooms\/([A-Z0-9]{8})(?:\/(join|actions|chat|events))?$/);
        ensure(match, '接口不存在', 404);
        const [, id, action] = match;
        if (!action && req.method === 'GET') return json(res, 200, service.snapshot(id, user));
        if (action === 'join' && req.method === 'POST') return json(res, 200, service.join(user, id));
        if (action === 'actions' && req.method === 'POST') return json(res, 200, service.mutate(user, id, await body(req)));
        if (action === 'chat' && req.method === 'POST') return json(res, 200, chat.send(user, id, (await body(req)).text));
        if (action === 'events' && req.method === 'GET') {
          const snapshot = service.snapshot(id, user);
          const clients = subscriptions.get(id) ?? new Set();
          ensure([...clients].filter(c => c.user.id === user.id).length < 5, '打开的连接过多', 429);
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(`retry: 1500\ndata: ${JSON.stringify(snapshot)}\n\n`);
          const client = { res, user }; clients.add(client); subscriptions.set(id, clients);
          const timer = setInterval(() => res.write(': heartbeat\n\n'), 20000);
          res.on('close', () => { clearInterval(timer); clients.delete(client); if (!clients.size) subscriptions.delete(id); });
          return;
        }
        ensure(false, '请求方法不支持', 405);
      }
      ensure(req.method === 'GET' || req.method === 'HEAD', '请求方法不支持', 405);
      // Explicit public asset route; never expose the repository or vendor directory.
      if (path === '/assets/cabo-atlas-v1.png') {
        const content = await readFile(cardAtlas);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      const file = resolve(webRoot, path === '/' ? 'index.html' : `.${decodeURIComponent(path)}`);
      ensure(file.startsWith(webRoot.endsWith(sep) ? webRoot : webRoot + sep), '路径无效', 403);
      ensure(mime[extname(file)], '文件不存在', 404);
      let content;
      try { content = await readFile(file); } catch { ensure(false, '文件不存在', 404); }
      if (/-v\d+\.webp$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) json(res, error.status ?? 500, { error: error.status ? error.message : '服务器暂时无法完成请求' });
      else res.end();
    }
  });
  server.on('listening', () => bots.resume());
  server.on('close', () => bots.stop());
  return { server, service, bots, closeStreams() { bots.stop(); for (const clients of subscriptions.values()) for (const client of clients) client.res.end(); } };
}
