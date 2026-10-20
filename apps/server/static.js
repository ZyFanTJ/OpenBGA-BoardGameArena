import {readFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brotliCompress, gzip, constants} from 'node:zlib';
import {promisify} from 'node:util';

const brotli = promisify(brotliCompress), zip = promisify(gzip);
const compressible = /\.(?:html|js|css|svg)$/;
const immutable = /-v\d+\.(?:webp|png|svg)$/;

function encoding(header = '') {
  const preferences = new Map(header.toLowerCase().split(',').map(item => {
    const [name, ...parameters] = item.trim().split(';');
    const quality = parameters.find(value => value.trim().startsWith('q='));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return [name, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0];
  }));
  const quality = name => preferences.get(name) ?? preferences.get('*') ?? 0;
  const selected = ['br', 'gzip'].sort((a, b) => quality(b) - quality(a))[0];
  return quality(selected) > 0 && quality(selected) >= (preferences.get('identity') ?? 0) ? selected : 'identity';
}

/** Public files only. Cache encodings without changing API or event-stream responses. */
export function createStaticDelivery() {
  const cache = new Map();
  async function entry(file) {
    const info = await stat(file), signature = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
    let item = cache.get(file);
    if (item?.signature !== signature) {
      item = {signature, ready: readFile(file).then(raw => ({raw, etag: `W/"${createHash('sha256').update(raw).digest('hex').slice(0, 32)}"`, variants: new Map()}))};
      cache.set(file, item);
      item.ready.catch(() => { if (cache.get(file) === item) cache.delete(file); });
      if (cache.size > 128) cache.delete(cache.keys().next().value);
    }
    return item.ready;
  }
  return async function send(req, res, file, type) {
    let item;
    try { item = await entry(file); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') return false; throw error; }
    const text = compressible.test(file);
    const coding = text && item.raw.length >= 1024 ? encoding(req.headers['accept-encoding']) : 'identity';
    const headers = {'Content-Type': type, 'Cache-Control': immutable.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate', ETag: item.etag};
    if (text) headers.Vary = 'Accept-Encoding';
    if (coding !== 'identity') headers['Content-Encoding'] = coding;
    const validators = req.headers['if-none-match']?.split(',').map(value => value.trim().replace(/^W\//, '')) ?? [];
    if (validators.includes('*') || validators.includes(item.etag.replace(/^W\//, ''))) { res.writeHead(304, headers); res.end(); return true; }
    let content = item.raw;
    if (coding !== 'identity') {
      if (!item.variants.has(coding)) item.variants.set(coding, coding === 'br'
        ? brotli(item.raw, {params: {[constants.BROTLI_PARAM_QUALITY]: 5}}) : zip(item.raw));
      content = await item.variants.get(coding);
    }
    headers['Content-Length'] = content.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : content);
    return true;
  };
}
