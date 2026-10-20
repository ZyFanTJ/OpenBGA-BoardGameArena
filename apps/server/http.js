import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomService } from '../../packages/platform/rooms.js';
import { SessionService } from '../../packages/platform/sessions.js';
import { ChatService } from '../../packages/platform/chat.js';
import { BotRunner } from '../../packages/platform/bots.js';
import {TurnRunner} from '../../packages/platform/turns.js';
import { ensure } from '../../packages/platform/errors.js';
import {AccountService} from '../../packages/platform/accounts.js';
import {SocialService} from '../../packages/platform/social.js';
import {RecordService} from '../../packages/platform/records.js';
import {EconomyService} from '../../packages/platform/economy.js';
import {ProfilePageService} from '../../packages/platform/profile-pages.js';
import {ForumService} from '../../packages/platform/forum.js';
import {AdminService} from '../../packages/platform/admin.js';
import {publicSystem} from '../../packages/platform/system.js';
import {createStaticDelivery} from './static.js';

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

export function createApp({ store, registry, random, secureCookies = false, botDelay = 800, adminBootstrapHandle }) {
  const sendStatic = createStaticDelivery();
  // Game-owned migrations run before bot recovery or any player-specific projection.
  const outdated=Object.values(store.data.rooms).filter(room=>room.stateVersion!==registry.get(room.gameId).manifest.stateVersion);
  if(outdated.length)store.transaction(data=>{for(const old of outdated){const room=data.rooms[old.id],game=registry.get(room.gameId);if(room.game){ensure(typeof game.migrate==='function','游戏存档需要迁移');room.game=game.migrate(room.game,room.stateVersion);}room.stateVersion=game.manifest.stateVersion;room.revision++;}});
  const subscriptions = new Map();
  const rate = new Map();
  let bots,turns;
  const service = new RoomService(store, registry, { random, notify(id, transition) {
    // Observe synchronously after commit, before the next action can change a private view.
    bots?.sync(id);turns?.sync(id);
    for (const client of subscriptions.get(id) ?? []) {
      try { sessions.authenticate(client.token);client.res.write(`data: ${JSON.stringify(service.snapshot(id, client.user, transition))}\n\n`); }
      catch (error) {
        if (error.status === 403 || error.status === 404) client.res.write(`data: ${JSON.stringify({ id, left: true, reason: store.data.rooms[id] ? 'left' : 'dissolved' })}\n\n`);
        client.res.end();
      }
    }
  } });
  bots = new BotRunner(service, { delay: botDelay });
  turns = new TurnRunner(service);
  const sessions = new SessionService(store);
  const accounts=new AccountService(store,sessions),social=new SocialService(store,service,registry),records=new RecordService(store,registry),economy=new EconomyService(store);
  const profilePages=new ProfilePageService(store,registry,social);
  const forum = new ForumService(store);
  const admin=new AdminService(store,{social});admin.bootstrap(adminBootstrapHandle);
  records.backfill();
  const chat = new ChatService(store, service);
  const issueSession=(res,session)=>{res.setHeader('Set-Cookie',`moon_session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secureCookies?'; Secure':''}`);return json(res,200,session.user);};
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://local');
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        if(path==='/api/health'&&req.method==='GET')return json(res,200,{status:'ok',version:'0.5.1'});
        if(path==='/api/system'&&req.method==='GET')return json(res,200,publicSystem(store.data));
        if (req.method !== 'GET') {
          const origin = req.headers.origin;
          ensure(!origin || new URL(origin).host === req.headers.host, '跨站请求被拒绝', 403);
          ensure(req.headers['content-type']?.startsWith('application/json'), '需要 JSON 请求', 415);
          const authRequest=['/api/auth/register','/api/auth/login'].includes(path);
          const key = (authRequest?'auth:':'')+req.socket.remoteAddress;
          const now = Date.now();
          if (rate.size > 1000) for (const [ip, entry] of rate) if (now - entry.at > 60000) rate.delete(ip);
          const item = rate.get(key) ?? { at: now, count: 0 };
          if (now - item.at > 60000) { item.at = now; item.count = 0; }
          item.count++; rate.set(key, item); ensure(item.count <= (authRequest?15:240), '操作过于频繁，请稍后再试', 429);
        }
        if (path === '/api/games' && req.method === 'GET') return json(res, 200, registry.list());
        if (path === '/api/lobby' && req.method === 'GET') return json(res, 200, { rooms: service.directory() });
        if (path === '/api/session' && req.method === 'POST') {
          const input = await body(req); const session = sessions.create(input.name);
          res.setHeader('Set-Cookie', `moon_session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secureCookies ? '; Secure' : ''}`);
          return json(res, 201, session.user);
        }
        if(path==='/api/auth/register'&&req.method==='POST'){
          let guest;try{guest=sessions.authenticate(cookie(req));}catch(error){if(error.status!==401)throw error;}
          return issueSession(res,await accounts.register(await body(req),guest));
        }
        if(path==='/api/auth/login'&&req.method==='POST')return issueSession(res,await accounts.login(await body(req)));
        if(path==='/api/auth/logout'&&req.method==='POST'){sessions.revoke(cookie(req));res.setHeader('Set-Cookie',`moon_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookies?'; Secure':''}`);return json(res,200,{ok:true});}
        const forumRoute = path.match(/^\/api\/forum(?:\/([a-zA-Z0-9-]{1,100})(?:\/(replies|support|status))?)?$/);
        if (forumRoute && req.method === 'GET' && !forumRoute[2]) {
          let viewer;
          try { viewer = sessions.authenticate(cookie(req)); } catch (error) { if (error.status !== 401) throw error; }
          return json(res, 200, forumRoute[1] ? forum.detail(viewer, forumRoute[1]) : forum.list(viewer, Object.fromEntries(url.searchParams)));
        }
        const user = sessions.authenticate(cookie(req));
        social.touch(user);
        if(path==='/api/admin/overview'&&req.method==='GET')return json(res,200,admin.overview(user));
        if(path==='/api/admin/users'&&req.method==='GET')return json(res,200,admin.users(user,Object.fromEntries(url.searchParams)));
        if(path==='/api/admin/audit'&&req.method==='GET')return json(res,200,admin.audit(user,Object.fromEntries(url.searchParams)));
        if(path==='/api/admin/settings'&&req.method==='GET')return json(res,200,admin.settings(user));
        if(path==='/api/admin/settings'&&req.method==='POST')return json(res,200,admin.updateSettings(user,await body(req)));
        const adminUser=path.match(/^\/api\/admin\/users\/([a-zA-Z0-9-]{1,100})(?:\/(credits|access|profile))?$/);
        if(adminUser){
          const [,id,action]=adminUser;
          if(!action&&req.method==='GET')return json(res,200,admin.detail(user,id));
          if(action&&req.method==='POST'){
            const input=await body(req),result=admin[action](user,id,input);
            if(action==='access'&&(input.action==='sessions'||input.action==='disabled'&&input.value))for(const clients of subscriptions.values())for(const client of clients)if(client.user.id===id)client.res.end();
            return json(res,200,result);
          }
          ensure(false,'请求方法不支持',405);
        }
        if (forumRoute) {
          ensure(req.method === 'POST', '请求方法不支持', 405);
          const [, id, action] = forumRoute;
          if (!id) return json(res, 201, forum.create(user, await body(req)));
          if (action === 'replies') return json(res, 201, forum.reply(user, id, await body(req)));
          if (action === 'support' || action === 'status') return json(res, 200, forum[action](user, id, await body(req)));
          ensure(false, '请求方法不支持', 405);
        }
        if (path === '/api/me' && req.method === 'GET') return json(res, 200, { user, roomId: service.currentRoom(user)?.id ?? null });
        if(path==='/api/account'&&req.method==='GET')return json(res,200,accounts.profile(user));
        if(path==='/api/account'&&req.method==='POST')return json(res,200,accounts.rename(user,await body(req)));
        if(path==='/api/profile'&&req.method==='GET')return json(res,200,profilePages.get(user));
        if(path==='/api/profile'&&req.method==='POST')return json(res,200,profilePages.update(user,await body(req)));
        const profileId=path.match(/^\/api\/profiles\/([a-zA-Z0-9-]{1,100})$/);
        if(profileId&&req.method==='GET')return json(res,200,profilePages.get(user,profileId[1]));
        if(path==='/api/hub'&&req.method==='GET'){const s=social.list(user);return json(res,200,{profile:accounts.profile(user),requests:s.requests.filter(r=>r.incoming).length,invitations:s.invitations,friends:s.friends.slice(0,5),currentRoom:s.currentRoom});}
        if(path==='/api/friends'&&req.method==='GET')return json(res,200,social.list(user));
        if(path==='/api/friends/search'&&req.method==='GET')return json(res,200,{players:social.search(user,url.searchParams.get('q'))});
        const friendAction=path.match(/^\/api\/friends\/(request|respond|remove|invite)$/);
        if(friendAction&&req.method==='POST')return json(res,200,social[friendAction[1]](user,await body(req)));
        if(path==='/api/invitations/accept'&&req.method==='POST')return json(res,200,social.acceptInvite(user,await body(req)));
        if(path==='/api/invitations/dismiss'&&req.method==='POST')return json(res,200,social.dismissInvite(user,await body(req)));
        if(path==='/api/history'&&req.method==='GET')return json(res,200,records.list(user,Object.fromEntries(url.searchParams)));
        const historyId=path.match(/^\/api\/history\/([a-zA-Z0-9-]{1,100})$/);if(historyId&&req.method==='GET')return json(res,200,records.detail(user,historyId[1]));
        if(path==='/api/shop'&&req.method==='GET')return json(res,200,economy.catalog(user));
        if(path==='/api/shop/purchase'&&req.method==='POST')return json(res,200,economy.purchase(user,await body(req)));
        if(path==='/api/shop/equip'&&req.method==='POST')return json(res,200,economy.equip(user,await body(req)));
        if(path==='/api/wallet'&&req.method==='GET')return json(res,200,{transactions:economy.ledger(user),credits:accounts.profile(user).credits});
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
          const client = { res, user, token:cookie(req) }; clients.add(client); subscriptions.set(id, clients);
          const timer = setInterval(() => res.write(': heartbeat\n\n'), 20000);
          res.on('close', () => { clearInterval(timer); clients.delete(client); if (!clients.size) subscriptions.delete(id); });
          return;
        }
        ensure(false, '请求方法不支持', 405);
      }
      ensure(req.method === 'GET' || req.method === 'HEAD', '请求方法不支持', 405);
      // Explicit public asset route; never expose the repository or vendor directory.
      if (path === '/assets/cabo-atlas-v1.png') {
        ensure(await sendStatic(req, res, cardAtlas, 'image/png'), '文件不存在', 404);
        return;
      }
      const file = resolve(webRoot, path === '/' ? 'index.html' : `.${decodeURIComponent(path)}`);
      ensure(file.startsWith(webRoot.endsWith(sep) ? webRoot : webRoot + sep), '路径无效', 403);
      ensure(mime[extname(file)], '文件不存在', 404);
      ensure(await sendStatic(req, res, file, mime[extname(file)]), '文件不存在', 404);
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) json(res, error.status ?? 500, { error: error.status ? error.message : '服务器暂时无法完成请求' });
      else res.end();
    }
  });
  server.on('listening', () => {bots.resume();turns.resume();});
  server.on('close', () => {bots.stop();turns.stop();});
  return { server, service, bots, turns, closeStreams() { bots.stop();turns.stop(); for (const clients of subscriptions.values()) for (const client of clients) client.res.end(); } };
}
