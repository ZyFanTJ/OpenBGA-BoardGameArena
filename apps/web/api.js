export async function api(path, data, { timeoutMs = 12000 } = {}) {
  const writing = data !== undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, text;
  try {
    response = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal });
    text = await response.text();
  } catch {
    throw requestError(controller.signal.aborted
      ? writing ? '操作等待超时，结果尚未确认，正在核对牌桌' : '连接等待超时，请稍后重试'
      : writing ? '连接中断，操作结果尚未确认，请核对牌桌后再试' : '暂时无法连接服务器，请稍后重试', response?.status ?? 0, writing);
  } finally { clearTimeout(timer); }
  let result;
  try { result = JSON.parse(text); if (!result || typeof result !== 'object') throw new Error(); }
  catch { throw requestError(response.ok ? '服务器响应不完整，请稍后重试' : '服务暂时不可用，请稍后重试', response.status, writing && (response.ok || response.status >= 500)); }
  if (!response.ok) throw requestError(typeof result.error === 'string' ? result.error : '服务器暂时无法完成请求', response.status, writing && response.status >= 500);
  return result;
}

function requestError(message, status, mayHaveCommitted = false) {
  return Object.assign(new Error(message), {status, mayHaveCommitted});
}

/** A malformed/truncated push must never reach renderers or replace the last good view. */
export function parseRoomEvent(text) {
  let value;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object' || !/^[A-Z0-9]{8}$/.test(value.id)) return null;
  if (value.left === true) return value;
  if (value.type === 'chat') return Number.isSafeInteger(value.revision) && value.revision >= 0 && validMessage(value.message) ? value : null;
  if (value.type === 'presentation') return Number.isSafeInteger(value.revision) && value.revision >= 0
    && typeof value.matchId === 'string' && Number.isSafeInteger(value.presentationRevision) && value.presentationRevision > 0
    && value.game && typeof value.game === 'object' && !Array.isArray(value.game) ? value : null;
  return Number.isSafeInteger(value.revision) && value.revision >= 0 && typeof value.gameId === 'string'
    && ['lobby','playing','finished'].includes(value.status) && (value.game === null || typeof value.game === 'object' && !Array.isArray(value.game))
    && Array.isArray(value.players) && value.players.every(p=>p && typeof p.id==='string' && typeof p.name==='string')
    && Array.isArray(value.chat) && value.chat.every(validMessage) ? value : null;
}

function validMessage(m) {
  return m && typeof m.id === 'string' && typeof m.userId === 'string' && typeof m.name === 'string' && typeof m.text === 'string' && Number.isFinite(m.at);
}

/** Merge partial pushes without replacing game state or losing newer chat to a
 * delayed HTTP response. An unknown game revision needs a full resync. */
export function mergeRoomEvent(current, event, { resetPresentation = false } = {}) {
  if (!current || event.id !== current.id) return current;
  if (event.revision < current.revision) return current;
  if (event.type === 'chat') {
    if (event.revision > current.revision) return null;
    if (current.chat.some(message => message.id === event.message.id)) return current;
    return { ...current, chat: [...current.chat, event.message].slice(-100) };
  }
  if (event.type === 'presentation') {
    if (event.matchId !== current.matchId || event.revision > current.revision) return null;
    if (event.presentationRevision <= (current.presentationRevision ?? 0)) return current;
    return { ...current, presentationRevision: event.presentationRevision, game: { ...current.game, ...event.game } };
  }
  const messages = new Map([...current.chat, ...event.chat].map(message => [message.id, message]));
  const chat = [...messages.values()].sort((a, b) => a.at - b.at).slice(-100);
  if (!resetPresentation && current.revision === event.revision && current.matchId === event.matchId
    && current.presentationRevision > (event.presentationRevision ?? 0)) {
    return { ...event, chat, presentationRevision: current.presentationRevision, game: current.game };
  }
  return { ...event, chat };
}
