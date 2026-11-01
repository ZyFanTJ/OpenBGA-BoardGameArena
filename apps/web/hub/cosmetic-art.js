// Decorative vectors only. Catalog ownership and pricing remain on the server.
export const portraitStyles=['ink','shiba','witch','mecha','rabbit','clockwork','phantom','oracle','noir','jazz','paladin','sprout'];
export const frameStyles=['prism','gilded','lunar','sakura','cyber','phoenix','abyss','verdant'];
export const titleStyles=['oracle','phoenix','tide','glitch','blossom','dice','void','sword','tea','comet'];

const gem=(x,y,size=5)=>`<path class="frame-jewel" d="m${x} ${y-size} ${size} ${size}-${size} ${size}-${size}-${size}Z"/>`;
const star=(x,y,size=4)=>`<path d="m${x} ${y-size} 1.2 ${size-1.2} ${size-1.2} 1.2-${size-1.2} 1.2-1.2 ${size-1.2}-1.2-${size-1.2}-${size-1.2}-1.2 ${size-1.2}-1.2Z"/>`;
const mirror=shape=>`${shape}<g transform="translate(128 0) scale(-1 1)">${shape}</g>`;
const petals='<path d="M64 10c-13-17-23 1-9 8-18-2-17 17-2 15-8 15 9 22 14 7 5 15 22 8 14-7 15 2 16-17-2-15 14-7 4-25-9-8Z"/>';
const frameDetails={
 prism:`<g class="frame-float">${gem(64,13,9)}${gem(17,63,5)}${gem(111,63,5)}${gem(64,114,5)}</g><path d="m49 15 15-7 15 7M49 115l15 5 15-5"/>`,
 gilded:`<g class="frame-crown"><path class="frame-metal" d="m43 22-4-16 15 8L64 1l10 13L89 6l-4 16Z"/><path d="M44 26h40"/>${gem(64,15,4)}</g>${mirror('<path class="frame-metal" d="M28 97C10 79 9 49 22 32c0 15 0 20 4 25-14-10-18-6-12 5l15 11c-17-6-16 3-9 10l15 8c-13 0-8 10 3 12"/>')}${gem(64,112,6)}`,
 lunar:`<g class="frame-float"><path class="frame-metal" d="M75 5a14 14 0 1 0 10 21C67 33 58 12 75 5Z"/>${star(90,15,5)}</g>${mirror('<path class="frame-metal" d="M24 79 4 59l5 24 16 9-13-2 16 14 13 1M9 64l13 20"/>')}${gem(64,113,4)}`,
 sakura:`${mirror('<path d="M31 105C7 83 10 40 35 21M20 58 6 43m13 27-12 9m18-42-8-15"/><path class="frame-metal" d="M15 41Q0 31 9 26q13 0 6 15M21 83Q4 82 9 93q13 3 12-10"/>')}<g class="frame-flower" transform="translate(-36 3) scale(.8)">${petals}<circle class="frame-jewel" cx="66" cy="25" r="4"/></g><g class="frame-petals">${gem(99,38,3)}${gem(107,65,4)}${gem(89,107,3)}</g>`,
 cyber:`${mirror('<path class="frame-metal" d="M41 11H23L10 25v20h7V29l12-11h12ZM11 84v19l14 14h18v-7H28l-10-10V84Z"/><path d="M29 27 21 35v12m2 47 8 8h13"/>')}<g class="frame-signal"><path d="M48 14h13m5 0h14M48 114h13m5 0h14"/>${gem(14,64,4)}${gem(114,64,4)}</g>`,
 phoenix:`${mirror('<path class="frame-metal" d="M35 101C14 95 4 72 5 47l12 18-6-36 18 24-6-31 16 17-8 8c-12 19-4 37 4 54Z"/><path d="M12 48q7 29 21 40M19 31l6 21"/>')}<g class="frame-flame"><path class="frame-metal" d="M64 2c1 13 19 11 12 25l-12-5-12 5C42 16 64 13 64 2Z"/>${gem(64,16,5)}</g><path d="m50 110 14 12 14-12"/>`,
 abyss:`<g class="frame-satellites">${gem(23,30,7)}${gem(105,98,7)}${gem(98,22,4)}${gem(30,106,4)}</g><path d="m48 13 16-9 16 9m-32 102 16 9 16-9"/><ellipse class="frame-ellipse" cx="64" cy="64" rx="61" ry="20" transform="rotate(-35 64 64)"/>`,
 verdant:`${mirror('<path d="M43 109C7 103 9 38 34 20"/><path class="frame-metal" d="M20 45Q3 40 8 24q20 1 12 21M17 70Q0 65 7 51q16 2 10 19M25 93Q5 97 7 78q18-1 18 15M30 32q-4-21 12-24 8 15-12 24"/>')}<g class="frame-butterfly"><path class="frame-metal" d="M64 19C36-5 42 30 62 27c-16 1-8 17 2 2 10 15 18-1 2-2 20 3 26-32-2-8Z"/><path d="M64 18v15"/></g>${gem(64,112,5)}`,
};

export function frameOrnament(id){
 const key=id?.replace(/^frame-/,'');
 if(!frameStyles.includes(key))return '';
 return `<svg class="frame-ornament" viewBox="0 0 128 128" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="frame-track" cx="64" cy="64" r="47"/><circle class="frame-track-inner" cx="64" cy="64" r="44"/><g class="frame-orbit"><circle class="frame-comet" cx="64" cy="64" r="49" stroke-dasharray="28 280"/>${star(64,15,3)}</g>${frameDetails[key]}<g class="frame-dust">${star(34,18,2)}${star(109,43,2)}${star(89,111,2)}</g></svg>`;
}

const titleEmblems={
 oracle:'<path class="title-emblem-fill" d="M57 15a29 29 0 1 0 23 41A29 29 0 0 1 57 15Z"/><g class="title-emblem-motion"><path d="m62 18 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/><circle cx="80" cy="15" r="2"/></g><path d="M18 73h60"/>',
 phoenix:'<g class="title-emblem-motion"><path class="title-emblem-fill" d="M48 69C23 65 9 49 8 25l20 17-10-24 24 17 6-24 6 24 24-17-10 24 20-17C87 49 73 65 48 69Z"/><path d="M19 37 37 53m40-16L59 53M48 35v39"/></g><path class="title-gem" d="m48 40 6 13-6 9-6-9Z"/>',
 tide:'<path d="M48 12v59m-19-45v20q0 14 19 14t19-14V26M22 32l7-12 7 12m24 0 7-12 7 12M40 20l8-13 8 13"/><g class="title-emblem-motion"><path class="title-emblem-fill" d="M10 63q10-12 20 0t20 0 20 0 16-3v13q-8 10-18 0t-20 0-20 0-18 0Z"/></g>',
 glitch:'<path class="title-emblem-fill" d="M27 21h42v45H27Z"/><path d="M34 29h28v29H34ZM15 30h12m-12 13h12M69 30h12M69 43h12M36 9v12M49 9v12M62 9v12M36 66v12M49 66v12M62 66v12"/><path class="title-emblem-motion" d="m48 30-9 16h12l-6 14 16-21H49l6-9Z"/>',
 blossom:'<g class="title-emblem-motion"><path class="title-emblem-fill" d="M48 38C19-2 75-2 48 38c25-40 51 9 9 10 45 10 3 47-9 10-12 37-54 0-9-10-42-1-16-50 9-10Z"/><circle class="title-gem" cx="48" cy="48" r="7"/></g><path d="M17 76q31-18 62 0"/>',
 dice:'<g class="title-emblem-motion"><path class="title-emblem-fill" d="m48 9 29 17 8 34-37 19L11 60l8-34Z"/><path d="m48 9-19 42h38L48 9M19 26l10 25-18 9m66-34L67 51l18 9M29 51l19 28 19-28"/><circle class="title-gem" cx="48" cy="39" r="3"/></g>',
 void:'<circle class="title-emblem-fill" cx="48" cy="44" r="21"/><circle cx="48" cy="44" r="26" stroke-dasharray="40 10 3 10"/><g class="title-emblem-motion"><ellipse cx="48" cy="44" rx="42" ry="14" transform="rotate(-30 48 44)"/><path class="title-gem" d="m81 16 4 6-4 6-4-6Z"/></g>',
 sword:'<path d="m24 19 50 51M72 19 22 70"/><path class="title-emblem-fill" d="m49 8 6 13-3 37h-8l-3-37Z"/><path d="M32 59h32M48 59v17m-8 2h16"/><path class="title-emblem-motion" d="m22 37 4 7 7 4-7 3-4 8-3-8-8-3 8-4Z"/>',
 tea:'<path class="title-emblem-fill" d="M23 39h45v16a19 19 0 0 1-19 19h-7a19 19 0 0 1-19-19Z"/><path d="M68 43h5a10 10 0 0 1 0 20h-8M16 78h61"/><g class="title-emblem-motion"><path d="M33 30c-12-10 11-12 0-23M47 30c-12-10 11-12 0-23M61 30c-12-10 11-12 0-23"/></g>',
 comet:'<g class="title-emblem-motion"><path class="title-emblem-fill" d="m34 42 6 12 14 2-11 10 2 14-13-7-13 7 3-14-11-10 15-2Z"/><path d="m42 41 35-30M53 51l32-28M31 34 58 10M64 53l22-19"/></g>',
};
export function themedTitleCrest(key){
 if(!titleStyles.includes(key))return '';
 return `<svg class="title-crest title-themed-crest" viewBox="0 0 96 88" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${titleEmblems[key]}</svg>`;
}
export const titleStyle=id=>titleStyles.find(key=>id===`title-${key}`)??'';
