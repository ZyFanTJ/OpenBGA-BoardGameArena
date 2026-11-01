import {ensure} from '../../platform/errors.js';
import {makeDeck,shuffle,evaluate,compare} from './cards.js';
import {gangBot} from './bot.js';
const copy=x=>structuredClone(x);
function deal(s,random){const deck=shuffle(makeDeck(),random);s.players=s.players.map(p=>({id:p.id,hand:deck.splice(0,2),chips:[null,null,null,null]}));s.deck=deck;s.board=[];s.round=0;s.phase='playing';s.ready=[];s.showdown=null;s.heist++;}
function create(ids,options={},random){ensure(ids.length>=3&&ids.length<=6&&new Set(ids).size===ids.length,'需要 3–6 位玩家');ensure(Object.keys(options).length===0,'仅支持基础版');const s={players:ids.map(id=>({id})),vaults:0,alarms:0,heist:0};deal(s,random);return s;}
function apply(input,id,c,{random}={}){ensure(input.players.some(p=>p.id===id),'你不在本局');ensure(input.phase!=='finished','游戏已结束');const s=copy(input),p=s.players.find(p=>p.id===id);
 if(c.type==='next'){ensure(s.phase==='result','尚未结束本次行动');ensure(!s.ready.includes(id),'已准备');s.ready.push(id);if(s.ready.length===s.players.length)deal(s,random);return s;}
 ensure(s.phase==='playing','请查看结果');
 if(c.type==='return'){ensure(p.chips[s.round]!==null,'没有筹码');p.chips[s.round]=null;}
 else if(c.type==='take'){ensure(Number.isInteger(c.chip)&&c.chip>=1&&c.chip<=s.players.length,'无效筹码');ensure(p.chips[s.round]!==c.chip,'已持有该筹码');for(const q of s.players)if(q.chips[s.round]===c.chip)q.chips[s.round]=null;p.chips[s.round]=c.chip;}
 else ensure(false,'未知行动');
 if(s.players.every(q=>q.chips[s.round]!==null)){if(s.round<3){s.round++;s.board.push(...s.deck.splice(0,s.round===1?3:1));}else{const rows=[...s.players].sort((a,b)=>a.chips[3]-b.chips[3]).map(q=>({id:q.id,chip:q.chips[3],hand:q.hand,...evaluate([...q.hand,...s.board])}));const success=rows.every((q,i)=>!i||compare(rows[i-1].score,q.score)<=0);s.showdown={success,rows};s[success?'vaults':'alarms']++;s.phase=s.vaults===3||s.alarms===3?'finished':'result';}}
 return s;
}
function view(s,id){return copy({phase:s.phase,heist:s.heist,round:s.round,vaults:s.vaults,alarms:s.alarms,board:s.board,ready:s.ready,showdown:s.showdown,players:s.players.map(p=>({id:p.id,chips:p.chips,hand:p.id===id||s.phase!=='playing'?p.hand:[]}))});}
export const theGang={manifest:{id:'the-gang',title:'纸牌帮',rulesVersion:'KOSMOS 2024 · Basic',stateVersion:1,minPlayers:3,maxPlayers:6,defaultTurnSeconds:0},bot:gangBot,create,apply,view,spectatorView:s=>view(s,null),isFinished:s=>s.phase==='finished',result:s=>({winners:s.vaults===3?s.players.map(p=>p.id):[],rounds:s.heist,scoreDirection:'higher',players:s.players.map(p=>({id:p.id,score:s.vaults,rank:1,breakdown:[{label:'金库',value:s.vaults},{label:'警报',value:s.alarms}]}))})};
