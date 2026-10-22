import { sceneImage, sceneArt, sceneCast, partyFigures, enemyImage, propImage, sceneProp } from './art.js';
import { packScenery } from './adventure-art.js';
import { escapeHtml as e } from '../../ui.js';

const paths = {
  talk: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8m-8 3h5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6m-3-3h6"/>',
  move: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sword: '<path d="m5 20 14-16 1 7-12 11M4 14l7 6M3 21l3-3"/>',
  shield: '<path d="M12 3 4 6v7c0 4 8 8 8 8s8-4 8-8V6l-8-3Z"/><path d="M12 7v9"/>',
  spell: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  potion: '<path d="M9 3h6m-5 0v6l-5 8c-1 3 1 4 3 4h8c2 0 4-1 3-4l-5-8V3M7 15h10"/>',
  rest: '<path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2V5Zm6-2v15m6-12v15"/>',
  book: '<path d="M12 6C8 3 4 4 2 5v15c4-2 7-1 10 1 3-2 6-3 10-1V5c-2-1-6-2-10 1Zm0 0v15"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  dice: '<path d="m12 2 10 6v9l-10 5-10-5V8l10-6Z"/><path d="m12 2-5 7h10l-5-7Zm-5 7 5 10 5-10M2 8l5 1-5 8m20-9-5 1 5 8m-10 2v3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spell}</svg>`;
export const actionIcon = id => ({ talk: 'talk', investigate: 'search', scout: 'search', study: 'search', travel: 'move', waterway: 'move', sneak: 'move', unlock: 'move', force: 'shield', fight: 'sword', attack: 'sword', dodge: 'shield', rest: 'rest', potion: 'potion', cure: 'spell', stabilize: 'potion', deathSave: 'dice' }[id.split(':')[0]] ?? 'spell');

export function shortAction(action, scene) {
  if (action.focus) return action.label;
  const kind = action.id.split(':')[0];
  return { investigate: scene === 'village' ? '研究矿图' : '检查门锁', talk: scene === 'village' ? '询问艾禾' : '说服守矿人', travel: scene === 'village' ? '前往矿山' : '沿主路前进', waterway: '水渠绕行', scout: '侦查动静', sneak: '潜行通过', study: '解读符文', ritual: '点亮雾灯', force: '推开侧门', unlock: '打开门锁', fight: scene === 'gate' ? '制服守矿人' : '迎战守卫', rest: '短休', dodge: '闪避', deathSave: '死亡豁免' }[kind] ?? action.label.replace(/ · /g, ' → ');
}

const glow = (x, y, r = 130) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#dnd-light)"/>`;
const figure = (x, y, type = 'person') => `<g transform="translate(${x} ${y})"><ellipse cy="75" rx="40" ry="8" fill="#071116" opacity=".6"/>${type === 'wolf' ? '<path d="m-44 53 10-27 25 14 29-6 21 12 6-23 11 23-5 17-21-3-4 19-7-1-4-19-25-1-8 23-7-3 4-26-20 6Z" fill="#102027" stroke="#81908a"/>' : '<path d="m-20 15 20-12 20 12 16 57-23-4-7 31H-5l-5-31-25 6Z" fill="#14242c" stroke="#89948a"/><ellipse cy="-2" rx="12" ry="15" fill="#b7a180"/><path d="m-14-4 2-15 23 3 4 14-12-7Z" fill="#1b2d34"/><path d="m-18 18-16 36m53-36 19 34" stroke="#9a9078" stroke-width="5"/>'}</g>`;
function art(scene, combat) {
  const packArt = packScenery(scene);
  const sky = '<path fill="url(#dnd-sky)" d="M0 0h1000v500H0z"/><circle cx="760" cy="88" r="36" fill="#e8dcab" opacity=".7"/><path d="M0 262 145 73l93 137L387 40l195 210L735 137l169 100 96-90v353H0" fill="#203c45"/><path d="m0 270 164-99 115 93 157-126 178 125 130-51 256 57v231H0" fill="#182f37"/>';
  const pieces = {
    village: `${sky}<path d="m340 500 121-196h110l120 196Z" fill="#3c4540"/><path d="M40 336V202l113-70 120 70v134m-266-135 146-97 147 97M712 326V184l109-66 109 66v142m-243-141 134-90 137 90" fill="#10252d" stroke="#43554e" stroke-width="4"/><path d="M110 225h38v62h-38zm678-20h35v62h-35zM178 242h30v37h-30z" fill="#cdae73"/>${glow(129,260)}${glow(808,240)}<path d="M274 388h231v19H274zm23 19h11v74h-11zm175 0h11v74h-11" fill="#5b5141"/><path d="m310 377 73-31 85 36-85 16Z" fill="#c7b38a"/><path d="m324 377 55-16 60 19m-60-19 3 25" stroke="#7b846e" fill="none"/>${figure(602,309)}${glow(565,335,110)}<path d="M556 328h17v24h-17z" fill="#e7ca83"/>`,
    trail: `${sky}<path d="M0 460q200-85 360-75t260-85l34 25Q420 469 0 500Z" fill="#577d7a" opacity=".7"/><path d="m377 500 79-136 114-74 45-115 11 9-21 128-95 80-16 108Z" fill="#58615a"/><g fill="#0c222b" stroke="#28434b" stroke-width="3"><path d="M32 500V0h31v500m29-255L47 127-19 88m64 86 94-74M900 500V-10h42v510m-24-207-97-98m105-48 74-70M150 500V302h18v198"/></g><path d="m698 410 28-72 24 51 27-92 30 112 42-53 25 85Z" fill="#1b393a"/>${figure(771,337,'wolf')}<path d="M579 212v-53l27-21 26 21v53" fill="#152932"/><path d="M601 178h9v20h-9Z" fill="#dfc083"/>${glow(607,187,80)}`,
    gate: `${sky}<path d="M141 500 165 205 322 122l44-108h289l71 111 156 80 47 295Z" fill="#263b3e" stroke="#45554f" stroke-width="6"/><path d="M350 500V241a151 151 0 0 1 302 0v259Z" fill="#0b171c" stroke="#6b6b58" stroke-width="24"/><path d="M374 500V238a127 127 0 0 1 254 0v262" fill="#253333"/><g stroke="#70705a" stroke-width="9"><path d="M400 174v326m50-376v376m50-391v391m50-376v376m50-326v326M379 285h245M379 417h245"/></g><path d="M662 500V303h108v197Z" fill="#18282a" stroke="#505d51" stroke-width="7"/><path d="M631 321h26v28h-26Z" fill="#b99a59"/>${glow(308,253,130)}<path d="m298 227 10-17 10 17-6 31h-9Z" fill="#e4c27d"/><path d="M308 255v46" stroke="#5d503a" stroke-width="7"/>${figure(483,330)}<path d="m527 320-4 142" stroke="#b8aa88" stroke-width="4"/>`,
    vault: `<path fill="url(#dnd-sky)" d="M0 0h1000v500H0Z"/><path d="m0 500 112-370L325 4h361l205 133 109 363Z" fill="#172b32"/><path d="m111 500 90-348L365 43h263l162 116 91 341" fill="#0b1c24" stroke="#374b49" stroke-width="14"/><path d="M116 500 425 276h174l284 224Z" fill="#2b3939"/><g stroke="#59675a" fill="none" opacity=".5"><path d="m250 500 203-224m293 224L565 276M336 392h330M395 329h203M170 466h641"/></g><ellipse cx="510" cy="333" rx="117" ry="37" fill="#1e383c" stroke="#a99c6c" stroke-width="4"/><path d="M435 313v75q76 30 152-2v-73Z" fill="#3b4b44" stroke="#879479"/><ellipse cx="511" cy="312" rx="78" ry="26" fill="#697562"/><path d="m490 304 6-58h30l7 58Z" fill="#bca16b"/><path d="M500 257h23v32h-23Z" fill="#c5ead0"/>${glow(512,273,200)}${figure(778,302)}<path d="M718 187q100-100 209 0v197H718Z" fill="#a0d6bd" opacity=".12" stroke="#9fd5bb" stroke-width="3"/><g opacity=".8">${figure(819,277)}${figure(871,283)}</g>`,
  };
  return `<svg class="dnd-landscape" viewBox="0 0 1000 500" preserveAspectRatio="${packArt ? 'xMidYMax slice' : 'xMidYMid slice'}" aria-hidden="true"><defs><linearGradient id="dnd-sky" x2="0" y2="1"><stop stop-color="#142a39"/><stop offset="1" stop-color="#486164"/></linearGradient><radialGradient id="dnd-light"><stop stop-color="#e1bf76" stop-opacity=".3"/><stop offset="1" stop-color="#e1bf76" stop-opacity="0"/></radialGradient><linearGradient id="dnd-veil" x2="0" y2="1"><stop offset=".45" stop-color="#08151b" stop-opacity="0"/><stop offset="1" stop-color="#08151b" stop-opacity=".85"/></linearGradient></defs>${packArt ?? pieces[scene] ?? pieces.village}<path d="M0 399q230-46 485 1t515-17v37q-270 24-500-1T0 439Z" fill="#aec6b7" opacity=".035"/><path fill="url(#dnd-veil)" d="M0 0h1000v500H0Z"/></svg>`;
}
const hotspots = {
  village: [{ id: 'object', label: '旧矿图', icon: 'search', x: 38, y: 75 }, { id: 'npc', label: '艾禾', icon: 'talk', x: 61, y: 60 }, { id: 'exit', label: '矿山小径', icon: 'move', x: 52, y: 32 }],
  trail: [{ id: 'object', label: '灌木动静', icon: 'search', x: 77, y: 67 }, { id: 'exit', label: '前往矿门', icon: 'move', x: 59, y: 37 }],
  gate: [{ id: 'npc', label: '守矿人', icon: 'talk', x: 48, y: 65 }, { id: 'object', label: '门锁与侧门', icon: 'search', x: 70, y: 63 }],
  vault: [{ id: 'object', label: '雾灯', icon: 'spell', x: 51, y: 54 }, { id: 'npc', label: '锈甲守卫', icon: 'sword', x: 75, y: 67 }],
};
export function matchesFocus(choice, focus) {
  if (!focus) return true;
  if (choice.focus) return choice.focus === focus;
  if (focus.startsWith('enemy-')) return choice.id.endsWith(`:${focus}`) || !choice.id.includes(':');
  const kind = choice.id.split(':')[0];
  return focus === 'npc' ? ['talk', 'fight'].includes(kind) : focus === 'exit' ? ['travel', 'waterway', 'sneak'].includes(kind) : ['investigate', 'study', 'ritual', 'force', 'unlock', 'scout'].includes(kind);
}
export function sceneStage(s, focus, canAct) {
  const artId = s.scene.art ?? s.scene.id;
  const points = s.scene.hotspots ? Object.entries(s.scene.hotspots).map(([id,label]) => ({ id, label, icon: {npc:'talk',object:'search',exit:'move'}[id] })) : hotspots[s.scene.id] ?? [];
  const objective = s.world.quest.objectives.find(o => !o.done)?.text ?? '带着灯火回家';
  return `<section class="dnd-stage ${sceneArt[s.scene.id] ? 'has-raster' : ''}" data-scene="${artId}" aria-label="${e(s.scene.title)}场景">${art(artId, s.combat)}${sceneImage(s.scene.id)}${sceneCast(s)}${partyFigures(s)}<div class="dnd-stage-heading"><span>${e(s.scene.chapter)}</span><h1>${e(s.scene.title)}</h1><p><i>◇</i>${e(s.outcome?.title ?? objective)}</p></div><button type="button" class="dnd-minimap" data-action="game:panel" data-id="map" aria-label="打开冒险地图">${icon('map')}<span>${s.world.locations.map(l => `<i class="${l.status}"></i>`).join('')}</span></button>${s.combat ? `<div class="dnd-encounter-tokens" aria-label="战斗目标">${s.combat.enemies.map(enemy => `<button type="button" data-action="game:focus" data-id="${e(enemy.id)}" class="dnd-enemy-token ${focus === enemy.id ? 'is-selected' : ''}" ${!enemy.hp ? 'disabled' : ''} aria-label="${e(enemy.name)}，生命 ${enemy.hp}/${enemy.maxHp}"><span class="dnd-enemy-portrait">${enemyImage(s.scene.id, enemy) || icon('sword')}</span><b>${e(enemy.name)}</b><meter min="0" max="${enemy.maxHp}" value="${enemy.hp}"></meter><small>${enemy.hp} / ${enemy.maxHp}</small></button>`).join('')}</div>` : !s.outcome ? points.filter(h => s.choices.some(a => matchesFocus(a, h.id))).map(h => `<button type="button" class="dnd-hotspot ${focus === h.id ? 'is-selected' : ''}" data-action="game:focus" data-id="${h.id}" ${canAct ? '' : 'disabled'}>${h.id === 'object' ? propImage(sceneProp[s.scene.id]) || icon(h.icon) : icon(h.icon)}<span>${e(h.label)}</span></button>`).join('') : ''}<div class="dnd-stage-vignette"></div></section>`;
}
