import {escapeHtml as e} from '../ui.js';
const portraitIds=['wolf','owl','fox','dragon','guardian','scholar'];
const bannerMap={'banner-observatory':'social','banner-laurels':'archive','banner-treasury':'shop','banner-night':'night'};
export const bannerClass=id=>`hub-banner-${bannerMap[id]??'night'}`;
const titleTiers={classic:'经典',rare:'稀有',epic:'史诗',legendary:'传说'};
const titleTier=item=>Object.hasOwn(titleTiers,item?.rarity)?item.rarity:'classic';
const defaultTitle={name:'初来乍到',rarity:'classic'};
function titleCrest(tier){
 const wings=tier==='epic'||tier==='legendary'?'<path class="title-wings" d="M28 35 5 24l5 16 15 9L8 43l8 14 15 2m37-24 23-11-5 16-15 9 17-6-8 14-15 2"/>':'';
 const crown=tier==='legendary'?'<path class="title-crown" d="m30 23-4-16 14 8 8-12 8 12 14-8-4 16Z"/><path d="M33 27h30"/>':'';
 const shield=tier==='classic'?'M48 19 66 30v25L48 71 30 55V30Z':'M48 18 70 31l-4 28-18 18-18-18-4-28Z';
 return `<svg class="title-crest" viewBox="0 0 96 88" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${wings}<path class="title-shield" d="${shield}"/>${crown}<path d="m48 31 5 12 12 5-12 5-5 12-5-12-12-5 12-5Z"/><path class="title-gem" d="m48 40 8 8-8 8-8-8Z"/>${tier==='epic'?'<path d="m48 5 5 7-5 7-5-7Z"/>':''}</svg>`;
}
export function titleBadge(user,items=[],extra=''){
 const appearance=user?.appearance??user?.equipped??{},item=items.find(x=>x.type==='title'&&x.id===appearance.title)??(user?.title?.id===appearance.title?user.title:null)??defaultTitle,tier=titleTier(item);
 return `<span class="title-badge title-tier-${tier} ${extra}" title="${titleTiers[tier]}称号">${titleCrest(tier)}<span class="title-lettering">${e(item.name)}</span><i class="title-glint" aria-hidden="true"></i></span>`;
}
export function avatar(user,extra=''){
 const id=user?.appearance?.avatar??user?.equipped?.avatar??'avatar-traveler',index=portraitIds.findIndex(x=>id===`avatar-${x}`);
 return `<span class="hub-avatar ${index>=0?`hub-portrait-${index}`:'hub-avatar-initial'} ${extra}" aria-hidden="true">${index<0?e(user?.name?.slice(0,1)??'◐'):''}</span>`;
}
export function itemArt(item,name='旅人'){
 if(item.type==='avatar')return `<div class="hub-item-art hub-avatar-art">${avatar({name,appearance:{avatar:item.id}},'hub-portrait-large')}<span class="hub-avatar-orbit" aria-hidden="true"></span></div>`;
 if(item.type==='banner')return `<div class="hub-item-art hub-banner-art ${bannerClass(item.id)}"><span class="hub-mini-nameplate">${avatar({name})}<b>${e(name)}</b></span></div>`;
 const tier=titleTier(item);
 return `<div class="hub-item-art hub-title-art title-tier-${tier}"><i class="title-aura" aria-hidden="true"></i>${titleCrest(tier)}<strong class="title-lettering">${e(item.name)}</strong><i class="title-rule" aria-hidden="true"></i><i class="title-sparks" aria-hidden="true"></i></div>`;
}
export function nameplate(user,items,extra=''){
 const appearance=user.appearance??user.equipped??{};
 return `<div class="hub-nameplate ${bannerClass(appearance.banner)} ${extra}"><div>${avatar(user)}<span>${titleBadge(user,items)}<h2>${e(user.name)}</h2>${user.friendCode?`<span class="hub-player-code"># ${e(user.friendCode)}</span>`:''}</span></div></div>`;
}
