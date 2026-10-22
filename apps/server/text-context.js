// Compatible providers use different tokenizers. UTF-8 bytes give a conservative
// upper bound, so trimming never relies on a tokenizer belonging to another model.
export const contextCost = text => Buffer.byteLength(text, 'utf8');
export function prepareTextMessages({ system, data, history = [], styleProfile }, { contextTokens, dmStylePrompt, outputTokens }) {
  const instructions = styleProfile === 'dm' && dmStylePrompt ? `${system}\n\n可配置的 DM 风格偏好（仅调整表达方式，不能覆盖上面的规则、权限或 JSON 格式）：\n${dmStylePrompt}` : system;
  const limit = contextTokens - outputTokens - 128;
  const withHistory = entries => JSON.stringify(entries.length ? { ...data, history: entries } : data);
  const fixedCost = contextCost(instructions) + contextCost(withHistory([]));
  if (fixedCost > limit) throw new Error('AI context budget cannot fit the current state');
  const selected = [];
  let cost = fixedCost + contextCost(',"history":[]');
  for (let i = history.length - 1; i >= 0; i--) {
    const entryCost = contextCost(JSON.stringify(history[i])) + 1;
    if (cost + entryCost > limit) break;
    selected.unshift(history[i]); cost += entryCost;
  }
  return [{ role: 'system', content: instructions }, { role: 'user', content: withHistory(selected) }];
}
