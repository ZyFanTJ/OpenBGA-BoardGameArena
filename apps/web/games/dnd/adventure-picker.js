import { escapeHtml as e } from '../../ui.js';
import { adventureCatalog } from './catalog.js';
import { adventureCover } from './adventure-art.js';

export function adventureOptions(options = { adventureId: 'blackapple' }) {
  const selected = options.adventureId ?? 'mistlight';
  return `<fieldset class="dnd-adventure-picker"><legend>选择冒险</legend><div class="dnd-adventure-cards">${['blackapple','morgansfort','mistlight'].map(id => {
    const a = adventureCatalog.find(x => x.id === id);
    return `<label class="dnd-adventure-card"><input type="radio" name="adventureId" value="${id}" ${selected === id ? 'checked' : ''} required><span class="dnd-adventure-cover">${adventureCover(a.theme)}<i>✓</i></span><span class="dnd-adventure-copy"><small>${e(a.edition)}</small><strong>${e(a.title)}</strong><em>${e(a.duration)} · 1–4 人</em></span></label>`;
  }).join('')}</div></fieldset>
    <label for="dnd-mode">地下城主</label><select id="dnd-mode" name="dmMode"><option value="ai" ${options.dmMode !== 'local' ? 'selected' : ''}>AI DM</option><option value="local" ${options.dmMode === 'local' ? 'selected' : ''}>本地引导</option></select><label for="dnd-tone">故事风格</label><select id="dnd-tone" name="tone"><option value="heroic" ${options.tone !== 'mystery' ? 'selected' : ''}>英雄冒险</option><option value="mystery" ${options.tone === 'mystery' ? 'selected' : ''}>神秘探索</option></select><p class="dnd-creation-info">AI DM 使用模型服务处理场景、角色名与公开日志。</p>`;
}
export const adventureSummary = options => `${adventureCatalog.find(a => a.id === (options.adventureId ?? 'mistlight'))?.title ?? '冒险'} · ${options.dmMode === 'local' ? '本地引导' : 'AI DM'}`;

export const adventureCredits=()=>`<details class="dnd-adventure-sources"><summary>原作与收录范围</summary><p>两套现成冒险来自 Basic Fantasy，已改编为当前 SRD 5.2.1 精简规则的独立章节；保留核心设定，合并地图与遭遇，并非原书完整复刻。</p>${adventureCatalog.filter(a => a.source).map(a => `<p><a href="${a.source.publisherUrl}" target="_blank" rel="noopener noreferrer">${e(a.source.title)}</a> — ${e(a.source.copyright)}。${e(a.source.changes)} <a href="${a.source.licenseUrl}" target="_blank" rel="noopener noreferrer">${a.source.license}</a>；中文改编 © 2026 Happy Online contributors，同许可分享。</p>`).join('')}<p>想了解经典 D&D 战役：<a href="https://www.dndbeyond.com/sources/dnd/lmop" target="_blank" rel="noopener noreferrer">失落矿坑</a> · <a href="https://www.dndbeyond.com/sources/dnd/cos" target="_blank" rel="noopener noreferrer">施特拉德的诅咒</a> · <a href="https://www.dndbeyond.com/sources/dnd/doip" target="_blank" rel="noopener noreferrer">冰龙之峰</a>。这些官方书籍目前仅提供原作入口，未收录为可玩副本。</p></details>`;
