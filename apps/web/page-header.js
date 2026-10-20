import {escapeHtml as e} from './ui.js';

/** Shared masthead geometry for community, friends, career and collections. */
export function pageHeader({art,title,eyebrow,subtitle,content='',sigil='✦'}){
 return `<section class="hub-hero hub-art-${e(art)}"><div class="hub-hero-shade"></div><div class="hub-hero-copy"><p class="hub-eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p>${e(subtitle)}</p><div class="hub-hero-footer">${content}</div></div><span class="hub-hero-sigil" aria-hidden="true">${e(sigil)}</span></section>`;
}
