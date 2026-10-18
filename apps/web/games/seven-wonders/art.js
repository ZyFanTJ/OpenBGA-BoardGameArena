// Original painted atlases, mapped by semantic card kind (shared across ages).
export const artSheets = {
 materials:{columns:5,rows:4,kinds:['lumber','stone','clay','ore','tree','excavation','claypit','timber','forest','mine','sawmill','quarry','brickyard','foundry','glass','press','loom']},
 blue:{columns:4,rows:4,kinds:['well','baths','altar','theater','statue','aqueduct','temple','courthouse','pantheon','gardens','townhall','palace','senate']},
 yellow:{columns:4,rows:4,kinds:['tavern','east','west','market','caravansery','forum','vineyard','bazar','lighthouse','haven','commerce','ludus','arena']},
 red:{columns:4,rows:4,kinds:['stockade','barracks','tower','stables','archery','walls','training','castrum','fortifications','circus','arsenal','siege']},
 green:{columns:4,rows:4,kinds:['apothecary','workshop','scriptorium','dispensary','laboratory','library','school','lodge','academy','observatory','study','university']},
 purple:{columns:4,rows:4,kinds:['workers','craftsmen','magistrates','traders','spies','philosophers','builders','decorators','scientists','shipowners']},
};
export const wonderScenes=['alexandria','babylon','ephesus','giza','halicarnassus','olympia','rhodes','cover'];
export const cardIllustrations=Object.fromEntries(Object.entries(artSheets).flatMap(([sheet,{kinds}])=>kinds.map((kind,index)=>[kind,{sheet,index}])));
export function cardIllustration(card){
 const art=cardIllustrations[card.kind];
 return `<span class="sw-illustration ${art?`sw-art-${art.sheet} sw-paint-${card.kind}`:'sw-art-fallback'}" aria-hidden="true"></span>`;
}
export function cityArt(wonder='giza',side='day'){
 const scene=wonderScenes.includes(wonder)?wonder:'cover';
 const index=wonderScenes.indexOf(scene);
 return `<svg class="sw-city-art sw-scene-${scene} ${side==='night'?'sw-scene-night':''}" viewBox="${index%2*768} ${Math.floor(index/2)*256} 768 256" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="/assets/seven-wonders/wonders-v1.webp" width="1536" height="1024"/></svg>`;
}
