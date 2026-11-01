import {create,apply,view,actor} from './engine.js';
import {dnupBot} from './bot.js';
export const dnup={
 manifest:{id:'dnup',title:'DNUP',rulesVersion:'Space Cowboys / Asmodee 2026',stateVersion:1,minPlayers:2,maxPlayers:5},
 create,apply,view,spectatorView:s=>view(s,null),isFinished:s=>s.phase==='finished',bot:dnupBot,
 turn:s=>s.phase==='turn'?{key:String(s.sequence),players:[actor(s)]}:null,
 timeout:(v,id)=>dnupBot.decide(v,id,null,{difficulty:'easy'}),
 result:s=>({winners:[...s.winners],rounds:s.round,scoreDirection:'higher',players:s.players.map(p=>({id:p.id,score:p.score,rank:s.winners.includes(p.id)?1:1+s.players.filter(q=>q.score>p.score||s.winners.includes(q.id)).length,breakdown:[{label:s.players.length===2?'获胜轮数':'字母积分',value:p.score}]}))}),
};
