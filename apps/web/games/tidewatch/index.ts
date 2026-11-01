import {createDraftRenderer} from './draft-index';
import {createDraftRenderer as createV2Renderer} from './v2-index';
import {mountBattle as mountV2} from './v2-scene';
import {createTidewatchRenderer as createLegacyRenderer} from './legacy-index';
import {mountBattle as mountDraft} from './scene';
import {mountBattle as mountLegacy} from './legacy-scene';
export function createTidewatchRenderer(send:any,rerender:any){let renderer:any,mode='';return {update(el:any,room:any,user:any){const next=room.game?.version===1?'classic':room.game?.version===2?'v2':'draft';if(next!==mode){renderer?.dispose();mode=next;renderer=(next==='classic'?createLegacyRenderer:next==='v2'?createV2Renderer:createDraftRenderer)(send,rerender);}renderer.update(el,room,user);},handle:(...args:any[])=>renderer?.handle(...args),beforeOverlay:()=>renderer?.beforeOverlay?.(),afterOverlay:()=>renderer?.afterOverlay?.(),dispose:()=>renderer?.dispose()};}
export function mountBattle(parent:HTMLElement,onAim:any,onSound:any){let battle:any;return {scene:{setView(view:any,...args:any[]){battle??=(view.version===1?mountLegacy:view.version===2?mountV2:mountDraft)(parent,onAim,onSound);battle.scene.setView(view,...args);}},destroy(){battle?.destroy();battle=null;}};}
