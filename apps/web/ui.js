export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function button(text, action, disabled = false, extra = '') {
  return `<button type="button" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${escapeHtml(text)}</button>`;
}
