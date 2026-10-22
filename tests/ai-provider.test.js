import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextProvider } from '../apps/server/ai-provider.js';
import { stringPrefix } from '../apps/server/json-stream.js';
import { contextCost, prepareTextMessages } from '../apps/server/text-context.js';

test('OpenAI-compatible transport sends server credentials, bounded JSON and explicit model, not retained conversations', async () => {
  let captured;
  const provider = createTextProvider({ apiKey: 'test-only', baseUrl: 'https://provider.example/v1/', model: 'configured-model', fetchImpl: async (url, input) => {
    captured = { url, input }; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"choiceId":"talk"}' } }] });
  } });
  const result = await provider({ system: 'JSON please', data: { intent: 'Hello' } });
  assert.deepEqual(result, { source: 'ai', value: { choiceId: 'talk' } });
  assert.equal(captured.url.href, 'https://provider.example/v1/chat/completions');
  assert.equal(captured.input.headers.Authorization, 'Bearer test-only');
  assert.equal(captured.input.redirect, 'error');
  const body = JSON.parse(captured.input.body); assert.equal(body.model, 'configured-model'); assert.equal(body.store, false);
  assert.equal(body.max_completion_tokens, 900); assert.equal(body.messages.length, 2);
  assert.equal(createTextProvider(), null); assert.throws(() => createTextProvider({ apiKey: 'k', model: 'm', baseUrl: 'http://remote.example/v1' }));
});

test('Streaming narration handles UTF-8 network splits, JSON escapes and emits text before completion', async () => {
  const parts = ['{"narration":"雾', '灯\\n照亮', '\\u4f60', '的路', '。🌙"}'];
  const wire = parts.map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\n`).join('') + 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  const bytes = new TextEncoder().encode(wire), seen = []; let input;
  const response = new Response(new ReadableStream({ start(controller) {
    // Byte-wise chunks split Chinese code points, JSON escapes, CRLF and SSE boundaries.
    for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1)); controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
  const provider = createTextProvider({ apiKey: 'test-only', model: 'm', fetchImpl: async (_, request) => { input = JSON.parse(request.body); return response; } });
  const result = await provider({ system: 'JSON', data: {}, streamField: 'narration' }, { onProgress: progress => seen.push(progress.text) });
  assert.equal(input.stream, true); assert.equal(result.value.narration, '雾灯\n照亮你的路。🌙');
  assert.equal(seen[0], '雾'); assert.equal(seen.at(-1), result.value.narration); assert.ok(seen.length > 2);
  assert.equal(stringPrefix('{"narration":"a\\u4f', 'narration'), 'a');
  assert.equal(stringPrefix('{"narration":"a\\q', 'narration'), '');
  assert.equal(stringPrefix('{"private":"secret","narration":"x', 'narration'), '');
  assert.equal(stringPrefix('{"narration":"\\uD83C', 'narration'), '');
});

test('Interrupted, refused and malformed streams reject instead of committing a partial story', async () => {
  const wires = [
    'data: {"choices":[{"delta":{"content":"{\\"narration\\":\\"unfinished"}}]}\n\n',
    'data: {"choices":[{"delta":{"refusal":"no"},"finish_reason":"stop"}]}\n\n',
    'data: invalid-json\n\n',
    'data: {"error":{"message":"SECRET"}}\n\n',
  ];
  for (const wire of wires) {
    const provider = createTextProvider({ apiKey: 'test-only', model: 'm', fetchImpl: async () => new Response(wire, { headers: { 'Content-Type': 'text/event-stream' } }) });
    await assert.rejects(provider({ system: 'JSON', data: {}, streamField: 'narration' }), error => !error.message.includes('SECRET'));
  }
});

test('Provider rejects HTTP errors, oversized, truncated, refused and malformed outputs without echoing secrets', async () => {
  const responses = [new Response('SECRET-provider-error', { status: 401 }), new Response('x'.repeat(70000)), Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'no', content: '{}' } }] }), Response.json({ choices: [{ finish_reason: 'stop', message: { content: '[]' } }] })];
  for (const response of responses) {
    const provider = createTextProvider({ apiKey: 'SECRET-key', model: 'm', fetchImpl: async () => response });
    await assert.rejects(provider({ system: 's', data: {} }), error => !error.message.includes('SECRET'));
  }
});

test('Temperature and independent DM style reach compatible requests; model-default temperature is omitted', async () => {
  const bodies = [], fetchImpl = async (_, request) => { bodies.push(JSON.parse(request.body)); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"narration":"故事"}' } }] }); };
  const input = { system: 'SERVER-RULES', styleProfile: 'dm', data: { scene: '当前局势' } };
  await createTextProvider({ apiKey: 'test-only', model: 'm', temperature: .65, dmStylePrompt: 'CUSTOM-DM-STYLE', fetchImpl })(input);
  assert.equal(bodies[0].temperature, .65); assert.match(bodies[0].messages[0].content, /SERVER-RULES/); assert.match(bodies[0].messages[0].content, /CUSTOM-DM-STYLE/);
  assert.equal(bodies[0].max_completion_tokens, 900); assert.equal(bodies[0].contextTokens, undefined);
  await createTextProvider({ apiKey: 'test-only', model: 'm', temperature: null, dmStylePrompt: '', fetchImpl })(input);
  assert.equal(Object.hasOwn(bodies[1], 'temperature'), false); assert.equal(bodies[1].messages[0].content, 'SERVER-RULES');
  await createTextProvider({ apiKey: 'test-only', model: 'm', dmStylePrompt: 'ONLY-FOR-DM', fetchImpl })({ system: 'GENERIC-RULES', data: {} });
  assert.equal(bodies[2].messages[0].content, 'GENERIC-RULES');
});

test('Context budget retains mandatory public state and the newest whole records, reserves output and never mutates input', () => {
  const input = { system: '规则', data: { intent: 'CURRENT-ACTION', scene: 'CURRENT-SCENE' }, history: Array.from({ length: 50 }, (_, i) => ({ id: i, text: '旧历史'.repeat(60) })) };
  const before = JSON.stringify(input), config = { contextTokens: 4096, outputTokens: 900, dmStylePrompt: '' };
  const messages = prepareTextMessages(input, config), data = JSON.parse(messages[1].content);
  assert.equal(data.intent, 'CURRENT-ACTION'); assert.equal(data.scene, 'CURRENT-SCENE');
  assert.ok(data.history.length > 0 && data.history.length < 50); assert.equal(data.history.at(-1).id, 49);
  assert.ok(messages.reduce((n, m) => n + contextCost(m.content), 0) + 900 + 128 <= 4096);
  assert.equal(JSON.stringify(input), before);
  const full = prepareTextMessages(input, { ...config, contextTokens: 100000 }); assert.equal(JSON.parse(full[1].content).history.length, 50);
  assert.throws(() => prepareTextMessages({ ...input, system: 'x'.repeat(4000) }, config));
});
