import {FACTIONS,ROLES} from '../../../../packages/games/tidewatch/catalog.js';
const symbols={
 tide:'<path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
 ember:'<path d="M13 3c1 6-5 6-3 11 2-1 4-3 4-5 4 3 6 6 4 10-3 5-12 3-13-3-1-4 2-7 4-9-1 4 0 5 1 5 0-4 4-5 3-9Z"/>',
 gear:'<path d="m9 3-1 3-3 1 1 3-3 2 3 2-1 3 3 1 1 3h6l1-3 3-1-1-3 3-2-3-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
 star:'<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/>',
 damage:'<path d="m5 3 6 4-7 10-2-1 7-10M19 3l-6 4 7 10 2-1-7-10M3 17l4 4m14-4-4 4M5 19l-2 2m16-2 2 2"/>',
 support:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="M12 8v8m-4-4h8"/>',
 control:'<path d="M12 3v18M4 7l16 10M4 17 20 7M9 5l3 3 3-3M9 19l3-3 3 3M4 10l4-1-1-4m10 14-1-4 4-1M4 14l4 1-1 4m10-14-1 4 4 1"/>',
 amplify:'<path d="m6 15 6-6 6 6M6 9l6-6 6 6M12 10v11"/>'
};
function badge(kind,id,label){const name=kind==='faction'?FACTIONS[id]?.name:ROLES[id];if(!name||!symbols[id])return '';return `<span class="twv-badge twv-badge-${kind} twv-type-${id}" role="img" aria-label="${name}" title="${name}"><span class="twv-badge-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${symbols[id]}</svg></span>${label?`<span class="twv-badge-label" aria-hidden="true">${name}</span>`:''}</span>`;}
export const factionBadge=(id,label=false)=>badge('faction',id,label);
export const roleBadge=(id,label=false)=>badge('role',id,label);
