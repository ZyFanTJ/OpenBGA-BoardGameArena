import {setupIcon} from '../room-setup.js';
import {loadStyles} from '../styles-loader.js';
import { adventureOptions, adventureSummary } from './dnd/adventure-picker.js';
import { lazyRenderer } from './lazy.js';
const wondersOptions=(options={})=>`<div class="sw-creation-scope"><b>第二版</b><span>3–7 人 · 三个时代</span></div><label for="wonder-side">奇迹面</label><select id="wonder-side" name="side">${[['choose','各自选择'],['day','全部日面'],['night','全部夜面']].map(([key,label])=>`<option value="${key}" ${(options.side??'choose')===key?'selected':''}>${label}</option>`).join('')}</select><fieldset class="sw-expansion-options"><legend>扩展</legend><label class="sw-expansion-toggle"><input type="checkbox" name="leaders" ${options.leaders?'checked':''}>${setupIcon('crown')}<span><b>领袖</b></span></label><label class="sw-expert-option"><input type="checkbox" name="leaderExpert" ${options.leaderExpert?'checked':''} ${options.leaders?'':'disabled'}>加入专家领袖</label><label class="sw-expansion-toggle"><input type="checkbox" name="armada" ${options.armada?'checked':''}>${setupIcon('anchor')}<span><b>舰队</b></span></label></fieldset>`;
// Game-specific UI registration is independent of the platform shell.
export const renderers = {
  'the-gang': lazyRenderer(() => Promise.all([import('./the-gang/index.js'),loadStyles(['/games/the-gang/style.css'])]).then(([module])=>module.createGangRenderer)),
  dnup: lazyRenderer(() => Promise.all([import('./dnup/index.js'),loadStyles(['/games/dnup/style.css'])]).then(([module])=>module.createDnupRenderer)),
  scram: lazyRenderer(() => Promise.all([import('./scram/index.js'),loadStyles(['/games/scram/style.css'])]).then(([module])=>module.createScramRenderer)),
  tidewatch: lazyRenderer(() => Promise.all([import('/dist/tidewatch.js'),loadStyles(['/games/tidewatch/style.css'])]).then(([module])=>module.createTidewatchRenderer)),
  'texas-holdem': lazyRenderer(() => Promise.all([import('./texas-holdem/index.js'),loadStyles(['/games/texas-holdem/style.css'])]).then(([module])=>module.createHoldemRenderer)),
  catan: lazyRenderer(() => import('./catan/index.js').then(module => module.createCatanRenderer)),
  uno: lazyRenderer(() => import('./uno/index.js').then(module => module.createUnoRenderer)),
  dnd: lazyRenderer(() => Promise.all([import('./dnd/index.js'), loadStyles(["/games/dnd/immersion.css", "/games/dnd/play.css", "/games/dnd/art.css"])]).then(([module]) => module.createDndRenderer)),
  'night-of-the-ninja': lazyRenderer(() => Promise.all([import('./night-of-the-ninja/index.js'), loadStyles(["/games/night-of-the-ninja/style.css"])]).then(([module]) => module.createNinjaRenderer)),
  'seven-wonders': lazyRenderer(() => Promise.all([import('./seven-wonders/index.js'), loadStyles(["/games/seven-wonders/atlas.css", "/games/seven-wonders/hud.css", "/games/seven-wonders/clarity.css", "/games/seven-wonders/expansions.css", "/games/seven-wonders/feedback.css", "/games/seven-wonders/decision-hud.css"])]).then(([module]) => module.createSevenWondersRenderer)),
  cabo: lazyRenderer(() => Promise.all([import('./cabo.js'), loadStyles(["/games/cabo/call-effect.css", "/games/cabo/mobile.css", "/games/cabo-guide.css"])]).then(([module]) => module.createCaboRenderer)),
  marrakech: lazyRenderer(() => import('./marrakech/index.js').then(module => module.createMarrakechRenderer)),
};
export const gameCards = {
  'the-gang': {supportsTurnLimit:false,category:'卡牌游戏',catalogCategory:'卡牌游戏',duration:'20',tags:'合作 · 扑克 · 默契',coverClass:'cover-the-gang',artHtml:'<img src="/assets/the-gang/cover-v1.png" width="1536" height="1024" loading="lazy" decoding="async" alt="月夜金库前的扑克牌与四色筹码">',optionsHtml:'<p class="setup-standard">基础版 · 3–6 人 · 三个金库</p>',readOptions:()=>({}),roomSummary:()=> '基础版 · 合作扑克'},
  dnup: {
    category:'卡牌游戏',catalogCategory:'卡牌游戏',duration:'15–20',tags:'同值组合 · 旋转 · 清空手牌',coverClass:'cover-dnup',
    artHtml:'<img src="/assets/dnup/cover.svg" width="768" height="512" loading="lazy" decoding="async" alt="深绿桌面的双色翻转数字牌">',
    optionsHtml:'<p class="setup-standard">2026 官方基础规则 · 2–5 人<br>双人使用两个出牌区；多人先得 4 分获胜。</p>',
    readOptions:()=>({}),roomSummary:()=> '2–5 人 · 同值组牌 · 收回必旋转',
  },
  scram: {
    category:'卡牌游戏',catalogCategory:'卡牌游戏',duration:'20–30',tags:'组队 · 记忆 · 营地开溜',coverClass:'cover-scram',
    artHtml:'<img src="/assets/scram/cover-v1.webp" width="384" height="512" loading="lazy" decoding="async" alt="月光下的森林营地">',
    optionsHtml:'<p class="setup-standard">官方基础版 · 仅支持 3、4、6 人<br>3 人首席为单人队；4 / 6 人按座位交替分队。</p>',
    readOptions:()=>({}),roomSummary:()=> '3 / 4 / 6 人 · 交错分队 · 队伍罚分越少越好',
  },
  tidewatch: {
    supportsTurnLimit:false,category:'合作塔防',catalogCategory:'策略对战',duration:'10–15',tags:'抽卡合成 · 互送建筑 · 悬赏守岛',coverClass:'cover-tidewatch',
    artHtml:'<img src="/assets/tidewatch/cover-v2.webp" width="768" height="512" loading="lazy" decoding="async" alt="四派系防线围绕群岛，共同迎战潮王">',
    optionsForm:(o={})=>`<label for="tidewatch-difficulty">远航难度</label><select id="tidewatch-difficulty" name="difficulty">${[['practice','轻潮 · 初次守岛'],['normal','远航 · 标准挑战'],['storm','风暴 · 默契配合']].map(([id,name])=>`<option value="${id}" ${(o.difficulty??'normal')===id?'selected':''}>${name}</option>`).join('')}</select><p class="setup-standard">1–4 人合作 · 18 波 · 漏怪进入队友防区</p>`,
    readOptions:d=>({difficulty:d.difficulty||'normal'}),roomSummary:(o={})=>`${{practice:'轻潮',normal:'远航',storm:'风暴'}[o.difficulty??'normal']} · 18 波合作守岛 · 共享怪物上限`,
  },
  'texas-holdem': {
    category:'卡牌游戏',catalogCategory:'卡牌游戏',duration:'20–60',tags:'下注 · 博弈 · 最佳五张',coverClass:'cover-holdem',
    artHtml:'<img src="/assets/texas-holdem/cover.svg" width="768" height="512" loading="lazy" decoding="async" alt="绿绒桌上的扑克牌、筹码与庄家钮">',
    optionsForm:(o={})=>[['startingStack','每人初始筹码',[1000,2000,5000],2000],['bigBlind','初始大盲',[20,50,100],20],['handLimit','最多手数',[10,20,40],20]].map(([key,label,values,fallback])=>`<label for="holdem-${key}">${label}</label><select id="holdem-${key}" name="${key}">${values.map(value=>`<option value="${value}" ${(o[key]??fallback)===value?'selected':''}>${value}</option>`).join('')}</select>`).join(''),
    readOptions:d=>({startingStack:Number(d.startingStack||2000),bigBlind:Number(d.bigBlind||20),handLimit:Number(d.handLimit||20)}),
    roomSummary:(o={})=>`无上限 · ${o.startingStack??2000} 筹码 · 盲注 ${(o.bigBlind??20)/2}/${o.bigBlind??20} · 最多 ${o.handLimit??20} 手`,
  },
  catan: {
    category:'策略对战', catalogCategory:'策略对战', duration:'60–90', tags:'资源 · 交易 · 岛屿建设', coverClass:'cover-catan',
    artHtml:'<img src="/assets/lobby/catan-preview-v1.webp" width="384" height="256" loading="lazy" decoding="async" alt="森林、牧场与麦田环绕的卡坦岛">',
    optionsHtml:'<div class="setup-standard">基础版 · 10 分获胜</div>',
    readOptions:()=>({}), roomSummary:()=> '基础版 · 3–4 人 · 10 分获胜',
  },
  uno: {
    category: '卡牌游戏', catalogCategory: '卡牌游戏', duration: '15–30', tags: '配色 · 反转 · 欢乐', coverClass: 'cover-uno',
    artHtml: '<img src="/assets/lobby/cover-uno-v1.webp" width="384" height="256" loading="lazy" decoding="async" alt="四色卡牌">',
    optionsForm: (options={}) => `<label for="uno-target">获胜目标</label><select id="uno-target" name="target">${[[500,'500 分 · 官方标准'],[300,'300 分 · 线上短局'],[100,'100 分 · 线上速玩']].map(([n,label])=>`<option value="${n}" ${(options.target??500)===n?'selected':''}>${label}</option>`).join('')}</select>`,
    readOptions: data => ({ target: Number(data.target || 500) }),
    roomSummary: (options={}) => `108 张经典版 · ${options.target??500} 分${(options.target??500)===500?'':'（线上短局）'}`,
  },
  dnd: {
    supportsTurnLimit:false,
    category: '合作冒险', catalogCategory: '策略对战', duration: '20–90', tags: 'AI DM · 角色扮演 · 合作冒险', coverClass: 'cover-dnd',
    artHtml: '<img class="dnd-catalog-art" src="/assets/dnd/scenes/village-v1.webp" width="887" height="444" loading="lazy" decoding="async" alt=""><div class="dnd-cover dnd-cover-overlay"><span>✧</span><strong>雾灯纪行</strong><small>THE MISTLIGHT CHRONICLES</small></div>',
    optionsForm: adventureOptions,
    readOptions: data => ({ dmMode: data.dmMode || 'ai', tone: data.tone || 'heroic', adventureId: data.adventureId || 'blackapple' }),
    roomSummary: adventureSummary,
  },
  'night-of-the-ninja': {
    category: '聚会推理', catalogCategory: '聚会推理', duration: '15–30', tags: '暗藏身份 · 轮抽 · 忍者技能', coverClass: 'cover-ninja',
    artHtml: '<img src="/assets/night-of-the-ninja/cover-v1.webp" width="384" height="256" loading="lazy" decoding="async" alt=""><span class="nn-cover-title">忍者之夜<small>NIGHT OF THE NINJA</small></span>',
    optionsHtml: '<div class="setup-standard">基础版 · 10 分获胜</div>',
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
    artHtml: '<img src="/assets/lobby/marrakech-cover-v1.jpg" width="640" height="426" loading="lazy" decoding="async" alt="灯火市集中的织毯棋盘与商人木偶">', optionsHtml: '', readOptions: () => ({}),
    roomSummary: () => '原版规则 · 铺毯争市集',
  },
  cabo: {
    catalogCategory: '卡牌游戏', duration: '15–30', tags: '记忆 · 推理 · 轻松', coverClass: 'cover-cabo',
    category: '记忆 · 推理 · 运气', edition: '2019 · SECOND EDITION', description: '藏好你的牌，记住你的直觉。',
    playHint: '朋友同桌 · AI 陪练',
    artHtml: '<img src="/assets/lobby/cabo-cover-v1.jpg" width="640" height="426" loading="lazy" decoding="async" alt="月光桌面上的数字卡牌与独角兽">',
    optionsHtml: '<label class="check"><input type="checkbox" name="expert">专家模式 · 全程暗牌</label>',
    optionsForm:(options={})=>`<label class="check"><input type="checkbox" name="expert" ${options.expert?'checked':''}>专家模式 · 全程暗牌</label>`,
    readOptions: data => ({ expert: data.expert === 'on' }),
    roomSummary: options => `2019 英文第二版 · ${options.expert ? '专家模式' : '标准模式'}`,
  },
};
gameCards.dnd.optionsHtml = gameCards.dnd.optionsForm();
gameCards.tidewatch.optionsHtml = gameCards.tidewatch.optionsForm();
gameCards.uno.optionsHtml = gameCards.uno.optionsForm();


gameCards['texas-holdem'].optionsHtml=gameCards['texas-holdem'].optionsForm();
