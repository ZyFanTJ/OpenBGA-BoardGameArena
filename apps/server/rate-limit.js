import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { ensure } from '../../packages/platform/errors.js';

// Trust exactly the configured number of reverse proxies, counting from the
// socket. The production app has no published port; its only ingress is Caddy.
export function clientAddress(req, trustedProxyHops = 0) {
  const peer = req.socket.remoteAddress ?? 'unknown';
  if (!trustedProxyHops) return peer;
  const forwarded = req.headers['x-forwarded-for']?.split(',').map(value => value.trim()) ?? [];
  const address = forwarded.at(-trustedProxyHops);
  return address && isIP(address) ? address : peer;
}

export function createRateLimiter({ now = Date.now, maxKeys = 50000 } = {}) {
  const buckets = new Map();
  let sweptAt = now();
  return {
    consume(key, limit) {
      const at = now();
      if (at - sweptAt >= 60000) {
        for (const [id, bucket] of buckets) if (at - bucket.at >= 60000) buckets.delete(id);
        sweptAt = at;
      }
      let bucket = buckets.get(key);
      if (!bucket || at - bucket.at >= 60000) {
        ensure(bucket || buckets.size < maxKeys, '请求过多，请稍后再试', 429);
        bucket = { at, count: 0 }; buckets.set(key, bucket);
      }
      ensure(++bucket.count <= limit, '操作过于频繁，请稍后再试', 429);
    },
    account(handle) {
      return createHash('sha256').update(typeof handle === 'string' ? handle.trim().toLowerCase() : '').digest('hex');
    },
  };
}
