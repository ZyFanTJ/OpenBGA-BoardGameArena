// Prefer the modern API; HTTP origins and restricted browsers need a fallback.
export async function copyText(value, label = '复制内容') {
  const text = String(value ?? '');
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Permission denied: try copying the current selection instead. */ }

  const focused = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const inputSelection = focused && typeof focused.selectionStart === 'number'
    ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection] : null;
  const buffer = document.createElement('textarea');
  buffer.className = 'clipboard-buffer';
  buffer.value = text;
  buffer.readOnly = true;
  buffer.tabIndex = -1;
  const parent = focused?.closest('dialog[open]') ?? [...document.querySelectorAll('dialog[open]')].at(-1) ?? document.body;
  let copied = false;
  try {
    parent.append(buffer);
    buffer.focus({preventScroll: true});
    buffer.select();
    buffer.setSelectionRange(0, text.length);
    copied = document.execCommand?.('copy') === true;
  } catch { /* Keep the text available even when both clipboard APIs fail. */ }
  finally {
    buffer.remove();
    if (focused?.isConnected) focused.focus({preventScroll: true});
    if (inputSelection && focused?.isConnected) focused.setSelectionRange(...inputSelection);
    else if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) if (range.commonAncestorContainer.isConnected) selection.addRange(range);
    }
  }
  if (!copied) manualCopy(text, label, focused);
  return copied;
}

function manualCopy(text, label, returnFocus) {
  const dialog = document.createElement('dialog');
  dialog.className = 'platform-dialog clipboard-dialog';
  dialog.setAttribute('aria-labelledby', 'clipboard-title');
  dialog.innerHTML = '<h2 id="clipboard-title"></h2><label class="sr-only" for="clipboard-value">待复制内容</label><input id="clipboard-value" type="text" readonly autocomplete="off" spellcheck="false"><p>按 Ctrl+C、⌘C 或长按复制</p><button type="button">完成</button>';
  dialog.querySelector('h2').textContent = label;
  const input = dialog.querySelector('input');
  input.value = text;
  input.addEventListener('click', () => input.select());
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
  }, {once: true});
  document.body.append(dialog);
  dialog.showModal();
  input.focus({preventScroll: true});
  input.select();
}
