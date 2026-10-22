// OpenAI-compatible Chat Completions transport. No game rules or room/session access.
import { readJsonStream, stringPrefix } from './json-stream.js';
import { defaultTextProvider } from '../../packages/platform/integrations.js';
import { prepareTextMessages } from './text-context.js';
export function createTextProvider({ apiKey, baseUrl = 'https://api.openai.com/v1', model, contextTokens = 100000, temperature = 1, dmStylePrompt = defaultTextProvider().dmStylePrompt, fetchImpl = fetch } = {}) {
  if (!apiKey || !model) return null;
  const endpoint = new URL(`${baseUrl.replace(/\/+$/, '')}/chat/completions`);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) throw new Error('AI endpoint must use HTTPS (HTTP is allowed for localhost)');
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid AI endpoint');
  if (!Number.isSafeInteger(contextTokens) || contextTokens < 4096 || contextTokens > 1000000 || !(temperature === null || typeof temperature === 'number' && Number.isFinite(temperature) && temperature >= 0 && temperature <= 2)) throw new Error('Invalid AI generation settings');
  return async (input, { signal, onProgress } = {}) => {
    const { streamField } = input;
    const messages = prepareTextMessages(input, { contextTokens, dmStylePrompt, outputTokens: 900 });
    const response = await fetchImpl(endpoint, {
      method: 'POST', signal, redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, ...(temperature === null ? {} : { temperature }),
        response_format: { type: 'json_object' }, max_completion_tokens: 900, stream: !!streamField, store: false }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('AI provider request failed'); }
    if (streamField && response.headers.get('content-type')?.includes('text/event-stream')) {
      const value = await readJsonStream(response, { field: streamField, onProgress });
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI response');
      return { source: 'ai', value };
    }
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new Error('AI response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const choice = envelope.choices?.[0];
    if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') throw new Error('AI response incomplete');
    const value = JSON.parse(choice.message.content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI response');
    // Some compatible gateways ignore stream; the final result remains usable.
    if (streamField) { const text = stringPrefix(choice.message.content, streamField); if (text) onProgress?.({ field: streamField, text: text.slice(0, 1200) }); }
    // Only the plugin validates and interprets the model's JSON.
    return { source: 'ai', value };
  };
}
