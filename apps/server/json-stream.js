/** Decode only a selected top-level JSON string prefix, never execute model output. */
export function stringPrefix(source, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\s*\\{\\s*"${escaped}"\\s*:\\s*"`).exec(source);
  if (!match) return '';
  let value = '';
  for (let i = match[0].length; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') break;
    if (ch !== '\\') { if (ch.charCodeAt(0) < 32) return ''; value += ch; continue; }
    const next = source[++i]; if (next === undefined) break;
    if (next === 'u') {
      const hex = source.slice(i + 1, i + 5); if (hex.length < 4) break;
      if (!/^[\da-f]{4}$/i.test(hex)) return '';
      value += String.fromCharCode(parseInt(hex, 16)); i += 4;
    } else {
      const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (!Object.hasOwn(escapes, next)) return ''; value += escapes[next];
    }
  }
  // Do not flash half of a Unicode surrogate pair at a chunk boundary.
  return /[\uD800-\uDBFF]$/.test(value) ? value.slice(0, -1) : value;
}

export async function readJsonStream(response, { field, onProgress }) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', content = '', bytes = 0, finish, refusal = false;
  function event(block) {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    const envelope = JSON.parse(data); if (envelope.error) throw new Error('AI stream failed');
    const choice = envelope.choices?.[0]; if (!choice) return;
    refusal ||= !!choice.delta?.refusal;
    if (typeof choice.delta?.content === 'string') {
      content += choice.delta.content;
      if (Buffer.byteLength(content) > 65536) throw new Error('AI response too large');
      const value = stringPrefix(content, field);
      if (value) onProgress?.({ field, text: value.slice(0, 1200) });
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      bytes += value.byteLength; if (bytes > 1048576) throw new Error('AI stream too large');
      buffer += decoder.decode(value, { stream: true });
      // Normalize after buffering so CR/LF split across network chunks stays valid.
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        event(buffer.slice(0, match.index).replace(/\r\n/g, '\n'));
        buffer = buffer.slice(match.index + match[0].length);
      }
    }
    if (buffer.trim()) event(buffer.replace(/\r\n/g, '\n'));
    if (finish !== 'stop' || refusal) throw new Error('AI response incomplete');
    return JSON.parse(content);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
