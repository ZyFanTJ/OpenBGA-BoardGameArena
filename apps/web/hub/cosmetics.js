import {escapeHtml as e} from '../ui.js';
const portraitIds=['wolf','owl','fox','dragon','guardian','scholar'];
const bannerMap={'banner-observatory':'social','banner-laurels':'archive','banner-treasury':'shop','banner-night':'night'};
export const bannerClass=id=>`hub-banner-${bannerMap[id]??'night'}`;
export function avatar(user,extra=''){
 const id=user?.appearance?.avatar??user?.equipped?.avatar??'avatar-traveler',index=portraitIds.findIndex(x=>id===`avatar-${x}`);
 return `<span class="hub-avatar ${index>=0?`hub-portrait-${index}`:'hub-avatar-initial'} ${extra}" aria-hidden="true">${index<0?e(user?.name?.slice(0,1)??'◐'):''}</span>`;
}
export function itemArt(item,name='旅人'){
 if(item.type==='avatar')return `<div class="hub-item-art hub-avatar-art">${avatar({name,appearance:{avatar:item.id}},'hub-portrait-large')}<span class="hub-avatar-orbit" aria-hidden="true"></span></div>`;
 if(item.type==='banner')return `<div class="hub-item-art hub-banner-art ${bannerClass(item.id)}"><span class="hub-mini-nameplate">${avatar({name})}<b>${e(name)}</b></span></div>`;
 return `<div class="hub-item-art hub-title-art"><span aria-hidden="true">✦</span><strong>${e(item.name)}</strong><i aria-hidden="true"></i></div>`;
}
export function nameplate(user,items,extra=''){
 const appearance=user.appearance??user.equipped??{},title=items.find(x=>x.id===appearance.title)?.name??'初来乍到';
 return `<div class="hub-nameplate ${bannerClass(appearance.banner)} ${extra}"><div>${avatar(user)}<span><small>${e(title)}</small><h2>${e(user.name)}</h2>${user.friendCode?`<span class="hub-player-code"># ${e(user.friendCode)}</span>`:''}</span></div></div>`;
}
