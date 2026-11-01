import { ensure } from './errors.js';
export function validateRequestId(value) {
  ensure(typeof value==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(value),'请求标识无效，请重新打开后重试');
}
export function boundedText(value, max) {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `请输入 1–${max} 个字符`);
  return value.trim();
}
