import {escapeHtml as e} from '../ui.js';

// Presentation only. Each game's guide owns its rules and illustrations.
export const badge=(art,title,text)=>`<article class="rg-item"><div class="rg-art" aria-hidden="true">${art}</div><div><b>${e(title)}</b><p>${e(text)}</p></div></article>`;
export const section=(title,body)=>`<section class="rg-section"><h3>${e(title)}</h3>${body}</section>`;
export const flow=items=>`<ol class="rg-flow">${items.map(([art,title,text],i)=>`<li><span class="rg-step">${i+1}</span><div class="rg-art" aria-hidden="true">${art}</div><b>${e(title)}</b><small>${e(text)}</small></li>`).join('')}</ol>`;
export const grid=items=>`<div class="rg-grid">${items.join('')}</div>`;
export const source=(url,label)=>`<a class="rg-source" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>`;
export const sheet=(edition,body)=>`<div class="rules-visual"><p class="rg-edition">${e(edition)}</p>${body}</div>`;
export const token=(label)=>`<span class="rg-token">${e(label)}</span>`;

export const choices=items=>flow(items).replace("rg-flow", "rg-flow rg-choices");

export function dieFace(value){const dots={1:[[18,18]],2:[[10,10],[26,26]],3:[[10,10],[18,18],[26,26]],4:[[10,10],[26,10],[10,26],[26,26]],5:[[10,10],[26,10],[18,18],[10,26],[26,26]],6:[[10,9],[26,9],[10,18],[26,18],[10,27],[26,27]]};return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="2" y="2" width="32" height="32" rx="6" fill="#ead8ad" stroke="#a88a51"/>${dots[value].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.6" fill="#23444b"/>`).join('')}</svg>`;}
