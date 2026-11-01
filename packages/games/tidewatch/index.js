import {INITIAL_SITES} from './geometry.js';
import {tidewatch as legacy} from './legacy.js';
import {draft} from './draft.js';
import {draft as v2} from './v2.js';
const classic=s=>s.mode==='classic'||s.version===1;
const engine=s=>classic(s)?legacy:s.mode==='draft-v2'||s.version===2?v2:draft;
export const tidewatch={...draft,manifest:{...legacy.manifest,rulesVersion:'4',stateVersion:4},
 migrate(state,fromVersion){if(fromVersion===1)return {...structuredClone(state),version:4,mode:'classic'};if(fromVersion===2)return {...structuredClone(state),version:4,mode:state.mode==='classic'?'classic':'draft-v2'};if(fromVersion===3){const s=structuredClone(state);s.version=4;if(s.mode!=='classic'&&s.mode!=='draft-v2')for(const p of s.players)p.unlocked=[...new Set([...p.unlocked,...INITIAL_SITES.filter(id=>id>=16)])];return s;}if(fromVersion===4)return structuredClone(state);throw new Error('Unsupported Tidewatch save version');},
 apply:(s,...args)=>engine(s).apply(s,...args),view:(s,...args)=>engine(s).view(s,...args),spectatorView:s=>engine(s).spectatorView(s),
 isFinished:s=>engine(s).isFinished(s),submissionKey:(s,...args)=>engine(s).submissionKey(s,...args),result:s=>engine(s).result(s),
 realtime:{...draft.realtime,advance:(s,...args)=>engine(s).realtime.advance(s,...args)},bot:{observe:()=>null,decide:(v,...args)=>(v.version===1?legacy:v.version===2?v2:draft).bot.decide(v,...args)}};
