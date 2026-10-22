import { resolve } from 'node:path';
import { SqliteStore } from '../../packages/platform/sqlite-store.js';
import { games } from '../../packages/games/registry.js';
import { createApp } from './http.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const legacyFile = resolve(process.env.DATA_FILE ?? '.data/platform.json');
const store = new SqliteStore(resolve(process.env.DATABASE_FILE ?? `${legacyFile}.sqlite`), { legacyFile });
const app = createApp({ store, registry: games, trustedProxyHops: Number(process.env.TRUSTED_PROXY_HOPS ?? 0),
  secureCookies: process.env.SECURE_COOKIES === '1',adminBootstrapHandle:process.env.ADMIN_BOOTSTRAP_HANDLE,
  textProviderEnvironment: { apiKey: process.env.AI_DM_API_KEY, baseUrl: process.env.AI_DM_BASE_URL || undefined, model: process.env.AI_DM_MODEL } });
app.server.listen(port, host, () => console.log(`Moon Table ready: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  app.closeStreams(); app.server.close(() => { store.close(); process.exit(0); });
});
