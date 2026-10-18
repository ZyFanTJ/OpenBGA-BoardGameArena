import { ensure } from './errors.js';
export function boundedText(value, max) {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `请输入 1–${max} 个字符`);
  return value.trim();
}
