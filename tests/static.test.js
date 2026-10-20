import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, utimesSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {JsonStore} from '../packages/platform/store.js';
import {games} from '../packages/games/registry.js';
import {createApp} from '../apps/server/http.js';
import {createStaticDelivery} from '../apps/server/static.js';

async function appFixture(t) {
  const app = createApp({store: new JsonStore(), registry: games});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.closeStreams(); await new Promise(resolve => app.server.close(resolve)); });
  return `http://127.0.0.1:${app.server.address().port}`;
}

test('static styles negotiate Brotli and gzip, preserve bytes and honor disabled encodings', async t => {
  const base = await appFixture(t), expected = readFileSync('apps/web/styles.css', 'utf8');
  for (const [accept, encoding] of [['identity', null], ['gzip', 'gzip'], ['br, gzip', 'br'], ['gzip;q=0, br;q=0', null], ['br;q=0.2, gzip;q=0.8', 'gzip'], ['br;q=0, *;q=0.5', 'gzip'], ['gzip;q=0.5, identity;q=1', null]]) {
    const response = await fetch(base + '/styles.css', {headers: {'Accept-Encoding': accept}});
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-encoding'), encoding);
    assert.equal(response.headers.get('vary'), 'Accept-Encoding');
    if (encoding) assert.ok(Number(response.headers.get('content-length')) < Buffer.byteLength(expected) / 2);
    assert.equal(await response.text(), expected);
  }
});

test('mutable source files revalidate with ETags, including multiple validators and HEAD', async t => {
  const base = await appFixture(t), url = base + '/app.js';
  const original = await fetch(url, {headers: {'Accept-Encoding': 'br'}}), etag = original.headers.get('etag');
  assert.equal(original.headers.get('cache-control'), 'public, max-age=0, must-revalidate'); assert.ok(etag);
  await original.text();
  const cached = await fetch(url, {headers: {'If-None-Match': `"different", ${etag}`, 'Accept-Encoding': 'gzip'}});
  assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
  assert.equal(cached.headers.get('etag'), etag); assert.equal(cached.headers.get('vary'), 'Accept-Encoding');
  const head = await fetch(url, {method: 'HEAD', headers: {'Accept-Encoding': 'br'}});
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-encoding'), 'br');
  assert.equal(head.headers.get('content-length'), original.headers.get('content-length')); assert.equal(await head.text(), '');
  const html = await fetch(base + '/'); assert.equal(html.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
});

test('versioned image art is immutable, conditional requests transfer no body, and binary pixels are untouched', async t => {
  const base = await appFixture(t), path = '/assets/lobby/cabo-0-v1.webp';
  const response = await fetch(base + path), bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(bytes, readFileSync('apps/web' + path));
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const cached = await fetch(base + path, {headers: {'If-None-Match': response.headers.get('etag')}});
  assert.equal(cached.status, 304); assert.equal((await cached.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(base + '/assets/cabo-atlas-v1.png')).status, 200);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
});

test('session and player data remain uncacheable while static delivery is enabled', async t => {
  const base = await appFixture(t);
  const session = await fetch(base + '/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: 'Cache test'})});
  const cookie = session.headers.get('set-cookie').split(';')[0];
  for (const path of ['/api/me', '/api/profile', '/api/hub']) {
    const response = await fetch(base + path, {headers: {cookie, 'Accept-Encoding': 'br'}});
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('etag'), null); assert.equal(response.headers.get('content-encoding'), null);
  }
});

test('in-memory encodings invalidate when a same-sized source file changes', async t => {
  const base = resolve('work'); mkdirSync(base, {recursive: true});
  const dir = mkdtempSync(join(base, 'static-cache-')), file = join(dir, 'fixture.js');
  const before = 'const value = "' + 'a'.repeat(2000) + '";', after = before.replaceAll('a', 'b');
  writeFileSync(file, before);
  const deliver = createStaticDelivery(), server = createServer(async (req, res) => { await deliver(req, res, file, 'text/javascript'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, {recursive: true, force: true}); });
  const url = `http://127.0.0.1:${server.address().port}/fixture.js`;
  const first = await fetch(url, {headers: {'Accept-Encoding': 'br'}}), etag = first.headers.get('etag'); assert.equal(await first.text(), before);
  writeFileSync(file, after); utimesSync(file, new Date(), new Date(Date.now() + 1000));
  const next = await fetch(url, {headers: {'Accept-Encoding': 'br', 'If-None-Match': etag}});
  assert.equal(next.status, 200); assert.notEqual(next.headers.get('etag'), etag); assert.equal(await next.text(), after);
});
