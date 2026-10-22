import { scenes, sceneActions, encounters, clueNames } from '../content.js';
import { blackapple } from './blackapple.js';
import { morgansfort } from './morgansfort.js';

const mistlight = {
  id: 'mistlight', title: '雾灯矿井', subtitle: '初次远征', setting: '渡鸦溪谷', start: 'village', theme: 'mist',
  summary: '在黎明前点亮矿山的雾灯，把失踪的修灯工带回家。适合第一次尝试掷骰与合作。',
  edition: '原创入门短篇', duration: '20–40 分钟', source: null,
  quest: '让灯火回家', winTitle: '雾灯归家', lossTitle: '雾中撤离',
  retreat: '你们决定先把掌握的线索带回镇子。此次远征结束，新的计划将从这里开始。',
  defeat: '队伍失去了继续冒险的能力。镇上的搜救队将幸存者带回，雾灯仍在等待下一次远征。',
  objectives: [{ text: '接下艾禾的委托', started: true }, { text: '穿过雾径，抵达矿门', visit: 'gate' }, { text: '深入矿井，寻找修灯工', visit: 'vault' }, { text: '营救三位修灯工，点亮雾灯', won: true }],
  scenes: Object.fromEntries(Object.entries(scenes).map(([id, scene], i) => [id, { ...scene, art: id, x: [13,38,65,87][i], y: [68,37,59,27][i] }])),
  actions: sceneActions, encounters: { ...encounters, sentinel: { ...encounters.sentinel, success: '锈甲守卫倒下，灯芯重归灯座。你们解开屏障，护送三位修灯工返回渡鸦溪镇。' } }, clueNames, flagNames: {},
};
export const adventures = { mistlight, blackapple, morgansfort };
export const adventureFor = s => adventures[s.options.adventureId ?? 'mistlight'];
export const publicAdventure = a => structuredClone(Object.fromEntries(['id', 'title', 'subtitle', 'setting', 'summary', 'edition', 'duration', 'theme', 'source'].map(k => [k, a[k]])));
export const adventureCatalog = Object.values(adventures).map(publicAdventure);
export const hasFlags = (s, flags = []) => flags.every(k => s.flags[k]);
export function actionAvailable(s, a) {
  return (!a.requires || s.clues.includes(a.requires)) && hasFlags(s, a.requiresFlags)
    && (!a.requiresAnyFlags || a.requiresAnyFlags.some(k => s.flags[k]))
    && !(a.excludesFlags ?? []).some(k => s.flags[k])
    && (!a.unlessAllFlags || !hasFlags(s, a.unlessAllFlags))
    && (a.repeat || !s.attempted.includes(`${s.scene}:${a.id}`));
}
export function actionDC(s, a) {
  return adventureFor(s).id === 'mistlight' && a.id === 'ritual' && s.clues.includes('rune') ? 10 : a.dcFlag && s.flags[a.dcFlag] ? a.raisedDC : a.dc;
}
// Only the observed room and already-earned facts reach clients or the language model.
export function publicScene(s) {
  const a = adventureFor(s), scene = a.scenes[s.scene];
  const description = scene.variants?.find(v => hasFlags(s, v.flags))?.description ?? scene.description;
  return { id: s.scene, title: scene.title, chapter: scene.chapter, description, art: scene.art,
    hotspots: structuredClone(scene.hotspots ?? null), entities: (scene.entities ?? []).map(x => ({ name: x.name, state: x.flag && s.flags[x.flag] ? x.after : x.state })) };
}
export function expeditionEnding(s, key, text) {
  if (adventureFor(s).id === 'blackapple') {
    const rescued = (s.flags.gardenChild ? 1 : 0) + (s.flags.hallChildren ? 3 : 0) + (s.flags.kitchenChildren ? 2 : 0) + (s.flags.arthur ? 1 : 0);
    return { won: rescued === 7, partial: rescued < 7, title: rescued === 7 ? '七个孩子，七个名字' : '尚未结束的营救', text: `${text}\n获救 ${rescued} / 7 人。${s.flags.alarm ? '宫廷已经警觉，下一次进入不会再被当作普通宾客。' : '你们没有惊动宫廷的追兵。'}` };
  }
  if (adventureFor(s).id === 'morgansfort' && key === 'relics') return { title: s.flags.passage ? '带回财富，也留下盟约' : '旧岛的幸存者', text: `${text}\n${s.flags.silver ? '银币 548 枚，古币税 55 枚（向上取整），余 493 枚。' : ''}${s.flags.jade ? '带回一件玉雕。' : ''}${s.flags.opener ? '带回一把金制裁信刀。' : ''}${s.flags.passage ? '与狗头人的通行约定仍然有效。' : ''}` };
  return { title: adventureFor(s).winTitle, text };
}
