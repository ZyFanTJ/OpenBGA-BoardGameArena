import { createSevenWondersRenderer, cityArt } from './seven-wonders/index.js';
import { createCaboRenderer } from './cabo.js';
import { createMarrakechRenderer } from './marrakech/index.js';
import { catalogArt } from './marrakech/art.js';
import { cardArt } from './cabo-cards.js';
// Game-specific UI registration is independent of the platform shell.
export const renderers = { 'seven-wonders': createSevenWondersRenderer, cabo: createCaboRenderer, marrakech: createMarrakechRenderer };
export const gameCards = {
  'seven-wonders': {
    category: '策略对战', catalogCategory: '策略对战', duration: '30', tags: '选牌 · 文明 · 同时行动', coverClass: 'cover-seven-wonders',
    artHtml: cityArt('cover') + '<span class="sw-cover-title">7 WONDERS</span>',
    optionsHtml: '<label for="wonder-side">奇迹面</label><select id="wonder-side" name="side"><option value="choose">开局各自选择（推荐）</option><option value="day">全部日面 · 初次游玩</option><option value="night">全部夜面 · 变化策略</option></select>',
    readOptions: data => ({ side: data.side || 'choose' }),
    roomSummary: options => `第二版基础游戏 · ${{choose:'各自选择日夜面',day:'全部日面',night:'全部夜面'}[options.side || 'choose']}`,
  },
  marrakech: {
    category: '策略对战', duration: '20', tags: '铺放 · 策略 · 运气', coverClass: 'cover-marrakech',
    artHtml: catalogArt, optionsHtml: '', readOptions: () => ({}),
    roomSummary: () => '原版规则 · 铺毯争市集',
  },
  cabo: {
    catalogCategory: '卡牌游戏', duration: '15–30', tags: '记忆 · 推理 · 轻松', coverClass: 'cover-cabo',
    category: '记忆 · 推理 · 运气', edition: '2019 · SECOND EDITION', description: '藏好你的牌，记住你的直觉。',
    playHint: '朋友同桌 · AI 陪练',
    artHtml: [4, 0, 9].map(value => `<span class="playing-card display-card">${cardArt(value)}</span>`).join(''),
    optionsHtml: '<label class="check"><input type="checkbox" name="expert">专家模式：牌始终盖住</label>',
    readOptions: data => ({ expert: data.expert === 'on' }),
    roomSummary: options => `2019 英文第二版 · ${options.expert ? '专家模式' : '标准模式'}`,
  },
};

