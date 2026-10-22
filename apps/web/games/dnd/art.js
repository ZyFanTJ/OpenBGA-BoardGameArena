import { escapeHtml as e } from '../../ui.js';

const base = '/assets/dnd';
export const sceneArt = Object.fromEntries([
  'village', 'trail', 'gate', 'vault', 'appleVillage', 'sanitarium', 'manor', 'tavern', 'cloakroom', 'bluehouse', 'banquet', 'service', 'cellar', 'treasury',
  'dragonInn', 'river', 'entry', 'wolvesDen', 'traps', 'kobolds', 'store', 'lower', 'nest',
].map(id => [id, `${base}/scenes/${id}-v1.webp`]));
export const actorIds = ['fighter', 'rogue', 'cleric', 'wizard', 'messenger', 'warden', 'mother', 'physician', 'fairy-lord', 'jester', 'attendant', 'bart', 'kobold-chief', 'boy', 'girl', 'miner'];
export const foeIds = ['wolf', 'den-wolf', 'sentinel', 'goat-guard', 'mirror-guard', 'stirge', 'kobold', 'mine-warden'];
export const propIds = ['lantern', 'map', 'mirror', 'thread', 'rope', 'silver', 'jade', 'opener', 'key', 'rune', 'potion', 'flower'];
export function actorImage(id, portrait = false) {
  return actorIds.includes(id) ? `<img class="dnd-pixel-actor" src="${base}/${portrait ? 'portraits' : 'actors'}/${id}-v1.webp" width="${portrait ? 128 : 224}" height="${portrait ? 128 : 256}" alt="" draggable="false" decoding="async">` : '';
}
export function propImage(id) {
  return propIds.includes(id) ? `<img class="dnd-prop-art" src="${base}/props/${id}-v1.webp" width="256" height="256" alt="" draggable="false" loading="lazy" decoding="async">` : '';
}
export function sceneImage(id) {
  return sceneArt[id] ? `<img class="dnd-scene-image" src="${sceneArt[id]}" alt="" draggable="false" decoding="async" fetchpriority="high">` : '';
}
export function coverImage(theme) {
  const pack = { mist: 'mistlight', fairy: 'blackapple', ruins: 'morgansfort' }[theme];
  return pack ? `<img src="${base}/covers/${pack}-v1.webp" alt="" width="384" height="448" loading="lazy" decoding="async">` : '';
}
export function enemyImage(sceneId, enemy) {
  const name = enemy.name;
  const key = /狼/.test(name) ? sceneId === 'wolvesDen' ? 'den-wolf' : 'wolf' : /羊足/.test(name) ? 'goat-guard'
    : /镜|追兵/.test(name) ? 'mirror-guard' : /嗜血|鸟/.test(name) ? 'stirge' : /守矿/.test(name) ? 'mine-warden'
      : /锈甲/.test(name) ? 'sentinel' : /狗头/.test(name) ? 'kobold' : null;
  return key ? `<img class="dnd-foe-art" src="${base}/foes/${key}-v1.webp" width="256" height="256" alt="" draggable="false" decoding="async">` : '';
}

const cast = {
  village: [['messenger','信使艾禾']], gate: [['warden','守矿人']], vault: [['miner','三位修灯工'],['miner','三位修灯工']],
  appleVillage: [['mother','菲格沃特夫人'],['boy','村里的孩子']], sanitarium: [['physician','利维尼乌斯'],['boy','“亚瑟”']], manor: [['mother','菲格沃特夫人']], tavern: [['bart','酒馆店员']],
  cloakroom: [['attendant','羊足侍者']], bluehouse: [['boy','吉尔斯']], banquet: [['fairy-lord','妖精领主'],['jester','水中蛾'],['girl','三名孩子']],
  service: [['boy','菲利普与史蒂维'],['girl','菲利普与史蒂维']], cellar: [['boy','真正的亚瑟']],
  dragonInn: [['bart','独眼巴特']], kobolds: [['kobold-chief','狗头人首领']],
};
// Cast selection is grounded exclusively in the current player's public entities.
// No future NPCs, encounter definitions, private notes or full game state enter this module.
export function sceneCast(s) {
  if (s.combat) return '';
  const entities = s.world.entities;
  return `<div class="dnd-scene-cast" aria-hidden="true">${(cast[s.scene.id] ?? []).filter(([,name]) => entities.some(x => x.name === name)).map(([id,name],i) => `<span class="dnd-cast-figure cast-${i}" data-actor="${id}" title="${e(name)}">${actorImage(id)}</span>`).join('')}</div>`;
}
export function partyFigures(s) {
  return `<div class="dnd-world-party" aria-hidden="true">${s.players.filter(p=>p.character).map((p,i) => `<span class="dnd-party-figure party-${i} ${p.id === s.actorId ? 'is-current' : ''} ${!p.character.hp ? 'is-down' : ''}">${actorImage(p.character.type)}<i></i></span>`).join('')}</div>`;
}
export const sceneProp = { village: 'map', gate: 'key', vault: 'lantern', manor: 'mirror', tavern: 'mirror', bluehouse: 'thread', banquet: 'thread', service: 'thread', cellar: 'thread', treasury: 'mirror', river: 'rope', wolvesDen: 'silver', traps: 'rope', store: 'opener', lower: 'rope', nest: 'jade' };
export function clueImage(text) {
  const id = /金线|魅惑/.test(text) ? 'thread' : /镜|歌谣/.test(text) ? 'mirror' : /符文|幻象/.test(text) ? 'rune' : /木筏|翻板|通道|陷阱/.test(text) ? 'rope' : /银币/.test(text) ? 'silver' : /玉雕/.test(text) ? 'jade' : /裁信刀/.test(text) ? 'opener' : /灯/.test(text) ? 'lantern' : 'map';
  return propImage(id);
}
