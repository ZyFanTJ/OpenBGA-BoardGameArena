import { escapeHtml as e, button as b } from '../../ui.js';

export function storyPanel(s, canAct) {
  const story = s.story;
  return `<section class="dnd-story-panel"><p class="dnd-panel-note">你们做过的事，会成为接下来故事的一部分。</p>${story.threads.length ? story.threads.map(t => `<article class="dnd-thread ${t.status === 'resolved' ? 'is-resolved' : ''}"><span>${t.status === 'resolved' ? '✓ 已解决' : '◇ 衍生支线'}</span><h3>${e(t.title)}</h3><p>${e(t.prompt)}</p>${t.status === 'open' ? b('继续追踪', 'game:choose', !canAct || !!s.combat, `data-id="story:${e(t.id)}"`) : ''}</article>`).join('') : '<p class="dnd-muted">留意你与人物的交流，意外的故事可能从一次选择开始。</p>'}${story.edges.length ? `<h3>当前行动影响</h3>${story.edges.map(x => `<p class="dnd-story-edge"><b>${e(x.label)} · ${x.mode === 'advantage' ? '优势' : '劣势'}</b><span>${e(x.reason)}</span></p>`).join('')}` : ''}${story.memories.length ? `<details class="dnd-story-memories"><summary>回看你们留下的变化</summary>${[...story.memories].reverse().map(x => `<article><b>${e(x.title)}</b><p>${e(x.detail)}</p></article>`).join('')}</details>` : ''}</section>`;
}
