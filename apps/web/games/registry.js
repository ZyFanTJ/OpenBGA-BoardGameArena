import { adventureOptions, adventureSummary } from './dnd/adventure-picker.js';
import { lazyRenderer } from './lazy.js';
import { catalogArt } from './marrakech/art.js';
import { cardArt } from './cabo-cards.js';
const wondersOptions=(options={})=>`<div class="sw-creation-scope"><b>第二版</b><span>3–7 人 · 三个时代</span></div><label for="wonder-side">奇迹面</label><select id="wonder-side" name="side">${[['choose','各自选择'],['day','全部日面'],['night','全部夜面']].map(([key,label])=>`<option value="${key}" ${(options.side??'choose')===key?'selected':''}>${label}</option>`).join('')}</select><fieldset class="sw-expansion-options"><legend>扩展</legend><label class="sw-expansion-toggle"><input type="checkbox" name="leaders" ${options.leaders?'checked':''}><span class="sw-expansion-seal">♛</span><span><b>领袖</b><small>选将 · 招募 · 文明能力</small></span></label><label class="sw-expert-option"><input type="checkbox" name="leaderExpert" ${options.leaderExpert?'checked':''} ${options.leaders?'':'disabled'}>加入专家领袖</label><label class="sw-expansion-toggle"><input type="checkbox" name="armada" ${options.armada?'checked':''}><span class="sw-expansion-seal">⚓</span><span><b>舰队</b><small>造船 · 探索 · 全桌海战</small></span></label></fieldset>`;
// Game-specific UI registration is independent of the platform shell.
export const renderers = {
  uno: lazyRenderer(() => import('./uno/index.js').then(module => module.createUnoRenderer)),
  dnd: lazyRenderer(() => import('./dnd/index.js').then(module => module.createDndRenderer)),
  'night-of-the-ninja': lazyRenderer(() => import('./night-of-the-ninja/index.js').then(module => module.createNinjaRenderer)),
  'seven-wonders': lazyRenderer(() => import('./seven-wonders/index.js').then(module => module.createSevenWondersRenderer)),
  cabo: lazyRenderer(() => import('./cabo.js').then(module => module.createCaboRenderer)),
  marrakech: lazyRenderer(() => import('./marrakech/index.js').then(module => module.createMarrakechRenderer)),
};
export const gameCards = {
  uno: {
    category: '卡牌游戏', catalogCategory: '卡牌游戏', duration: '15–30', tags: '配色 · 反转 · 欢乐', coverClass: 'cover-uno',
    artHtml: '<img src="/assets/lobby/cover-uno-v1.webp" width="384" height="256" loading="lazy" decoding="async" alt="四色卡牌">',
    optionsForm: (options={}) => `<label for="uno-target">获胜目标</label><select id="uno-target" name="target">${[[500,'500 分 · 官方标准'],[300,'300 分 · 线上短局'],[100,'100 分 · 线上速玩']].map(([n,label])=>`<option value="${n}" ${(options.target??500)===n?'selected':''}>${label}</option>`).join('')}</select><p>108 张经典版 · 2–10 人 · 不叠加罚牌、不抢出、不连出。支持 AI 陪练。</p>`,
    readOptions: data => ({ target: Number(data.target || 500) }),
    roomSummary: (options={}) => `108 张经典版 · ${options.target??500} 分${(options.target??500)===500?'':'（线上短局）'}`,
  },
  dnd: {
    category: '合作冒险', catalogCategory: '策略对战', duration: '20–90', tags: 'AI DM · 角色扮演 · 合作冒险', coverClass: 'cover-dnd',
    artHtml: '<img class="dnd-catalog-art" src="/assets/dnd/scenes/village-v1.webp" width="887" height="444" loading="lazy" decoding="async" alt=""><div class="dnd-cover dnd-cover-overlay"><span>✧</span><strong>雾灯纪行</strong><small>THE MISTLIGHT CHRONICLES</small></div>',
    optionsForm: adventureOptions,
    readOptions: data => ({ dmMode: data.dmMode || 'ai', tone: data.tone || 'heroic', adventureId: data.adventureId || 'blackapple' }),
    roomSummary: adventureSummary,
  },
  'night-of-the-ninja': {
    category: '聚会推理', catalogCategory: '聚会推理', duration: '15–30', tags: '暗藏身份 · 轮抽 · 忍者技能', coverClass: 'cover-ninja',
    artHtml: '<img src="/assets/night-of-the-ninja/cover-v1.webp" width="384" height="256" loading="lazy" decoding="async" alt=""><span class="nn-cover-title">忍者之夜<small>NIGHT OF THE NINJA</small></span>',
    optionsHtml: '<p class="nn-creation-info">4–11 人 · 基础版规则与官方 FAQ<br>线上荣誉池：2 / 3 / 4 分各 12 枚；完整说明见玩法手卡。支持 AI 陪练。</p>',
    readOptions: () => ({}), roomSummary: () => '基础版 · 荣誉池线上适配 · 10 分获胜',
  },
  'seven-wonders': {
    category: '策略对战', catalogCategory: '策略对战', duration: '30', tags: '选牌 · 文明 · 同时行动', coverClass: 'cover-seven-wonders',
    artHtml: '<img class="sw-city-art" src="/assets/lobby/wonders-cover-v1.webp" width="768" height="256" loading="lazy" decoding="async" alt=""><span class="sw-cover-title">7 WONDERS</span>',
    optionsHtml:wondersOptions(),optionsForm:wondersOptions,
    readOptions:data=>({side:data.side||'choose',leaders:data.leaders==='on',armada:data.armada==='on',leaderExpert:data.leaders==='on'&&data.leaderExpert==='on'}),
    roomSummary:options=>`第二版 · ${[options.leaders?(options.leaderExpert?'领袖（含专家）':'领袖'):null,options.armada?'舰队':null].filter(Boolean).join(' + ')||'基础版'} · ${{choose:'自选日夜面',day:'日面',night:'夜面'}[options.side||'choose']}`,
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
    optionsForm:(options={})=>`<label class="check"><input type="checkbox" name="expert" ${options.expert?'checked':''}>专家模式：牌始终盖住</label>`,
    readOptions: data => ({ expert: data.expert === 'on' }),
    roomSummary: options => `2019 英文第二版 · ${options.expert ? '专家模式' : '标准模式'}`,
  },
};
gameCards.dnd.optionsHtml = gameCards.dnd.optionsForm();
gameCards.uno.optionsHtml = gameCards.uno.optionsForm();

