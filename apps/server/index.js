import { resolve } from 'node:path';
import { JsonStore } from '../../packages/platform/store.js';
import { games } from '../../packages/games/registry.js';
import { createApp } from './http.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const app = createApp({ store: new JsonStore(resolve(process.env.DATA_FILE ?? '.data/platform.json')), registry: games,
  secureCookies: process.env.SECURE_COOKIES === '1' });
app.server.listen(port, host, () => console.log(`Moon Table ready: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  app.closeStreams(); app.server.close(() => process.exit(0));
});
