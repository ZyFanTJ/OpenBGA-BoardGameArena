// Whitelisted, original ornaments. Cosmetics never change game state or card values.
export const cosmeticSlot=item=>item.slot??item.type;
const backs={
 'cabo-back-constellation':{game:'cabo',ink:'#102a49',line:'#91c9ee',mark:'✧',motif:'stars'},
 'cabo-back-gilded':{game:'cabo',ink:'#30231b',line:'#edc671',mark:'◐',motif:'gold'},
 'cabo-back-jade':{game:'cabo',ink:'#103d3a',line:'#9ad6b7',mark:'❖',motif:'jade'},
 'uno-back-aurora':{game:'uno',ink:'#28234b',line:'#c8a8fa',mark:'✦',motif:'aurora'},
 'uno-back-arcade':{game:'uno',ink:'#12383d',line:'#6ef2cb',mark:'▣',motif:'arcade'},
};
export function cardBack(user,game){
 const appearance=user?.appearance??user?.equipped??{},back=backs[appearance[`${game}CardBack`]];
 if(!back||back.game!==game)return '';
 return `<span class="card-skin card-skin-${back.motif}" aria-hidden="true"><svg viewBox="0 0 100 148" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="96" height="144" rx="10" fill="${back.line}"/><rect x="6" y="6" width="88" height="136" rx="7" fill="${back.ink}"/><path d="M14 40 50 13l36 27v68l-36 27-36-27Z M20 44 50 22l30 22v60l-30 22-30-22Z" fill="none" stroke="${back.line}" stroke-width=".8"/><path d="m50 37 24 37-24 37-24-37Z" fill="${back.line}" opacity=".15"/><path d="M17 27h10m-5-5v10m51 89h10m-5-5v10M73 27h10m-5-5v10M17 121h10m-5-5v10" stroke="${back.line}"/><text x="50" y="86" text-anchor="middle" font-family="Georgia,serif" font-size="39" fill="${back.line}">${back.mark}</text><circle cx="50" cy="19" r="2" fill="${back.line}"/><circle cx="50" cy="129" r="2" fill="${back.line}"/></svg></span>`;
}
export const cardBackPreview=id=>cardBack({appearance:{[`${backs[id]?.game}CardBack`]:id}},backs[id]?.game);
