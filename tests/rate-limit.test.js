import test from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress, createRateLimiter } from '../apps/server/rate-limit.js';

test('forwarded addresses require explicitly configured proxy hops and cannot be prepended to spoof the nearest trusted source', () => {
  const req = { socket: { remoteAddress: '172.20.0.2' }, headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.4' } };
  assert.equal(clientAddress(req), '172.20.0.2');
  assert.equal(clientAddress(req, 1), '198.51.100.4');
  assert.equal(clientAddress(req, 2), '203.0.113.9');
  req.headers['x-forwarded-for'] = 'invalid'; assert.equal(clientAddress(req, 1), '172.20.0.2');
  req.headers['x-forwarded-for'] = '2001:db8::7'; assert.equal(clientAddress(req, 1), '2001:db8::7');
});

test('player and account limits stay independent, expire at the boundary and bound attacker-created buckets', () => {
  let at = 0; const rate = createRateLimiter({ now: () => at, maxKeys: 3 });
  rate.consume('player:a', 2); rate.consume('player:a', 2);
  assert.throws(() => rate.consume('player:a', 2), { status: 429 });
  rate.consume('player:b', 2); rate.consume('account:c', 2);
  assert.throws(() => rate.consume('new', 2), { status: 429 });
  at = 60000; rate.consume('new', 2); rate.consume('player:a', 2);
  assert.equal(rate.account(' Test_User '), rate.account('test_user'));
  assert.notEqual(rate.account('a'), rate.account('b'));
});
