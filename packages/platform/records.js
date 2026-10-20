import {ensure} from './errors.js';
import {rewardMatch} from './economy.js';
import {systemSettings} from './system.js';

/** Called inside the room's transaction. Stores result summaries, never game states. */
export function archiveMatch(data,room,game,{imported=false}={}){
 if(!game.result||!game.isFinished(room.game))return;
 const id=room.matchId??`legacy-${room.id}-${room.revision}`;if(data.matches[id])return;
 const result=game.result(room.game),practice=room.players.some(p=>p.isBot&&!p.departed);
 const participants=result.players.map(row=>{const seat=room.players.find(p=>p.id===row.id),human=!!data.profiles[row.id]&&(!seat?.isBot||seat?.departed),left=!!seat?.departed;
  return {...row,name:human?data.profiles[row.id].name:seat?.name??'AI',isBot:!human,left,won:result.winners.includes(row.id)&&!left};});
 data.matches[id]={id,gameId:room.gameId,gameTitle:game.manifest.title,roomTitle:room.title,startedAt:room.startedAt??room.createdAt,endedAt:imported?null:Date.now(),recordedAt:Date.now(),practice,rounds:result.rounds??1,scoreDirection:result.scoreDirection??'higher',participants,imported};
 if(!imported)for(const p of participants)if(!p.isBot&&!p.left)p.reward=rewardMatch(data,p.id,id,p.won,practice);
}
export class RecordService{
 constructor(store,registry){this.store=store;this.registry=registry;}
 backfill(){const pending=Object.values(this.store.data.rooms).filter(r=>r.status==='finished'&&!this.store.data.matches[r.matchId??`legacy-${r.id}-${r.revision}`]);if(pending.length)this.store.transaction(data=>{for(const r of pending)archiveMatch(data,data.rooms[r.id],this.registry.get(r.gameId),{imported:true});});}
 list(user,{game='all',outcome='all',mode='all',cursor='',limit=10}={}){
  ensure(['all','win','loss','left'].includes(outcome)&&['all','practice','multiplayer'].includes(mode),'筛选条件无效');
  limit=Math.max(1,Math.min(20,Number(limit)||10));
  const all=Object.values(this.store.data.matches).filter(m=>m.participants.some(p=>p.id===user.id&&!p.isBot)).sort((a,b)=>(b.endedAt??b.recordedAt)-(a.endedAt??a.recordedAt)||b.id.localeCompare(a.id));
  const own=m=>m.participants.find(p=>p.id===user.id);
  const filtered=all.filter(m=>(game==='all'||m.gameId===game)&&(mode==='all'||(mode==='practice')===m.practice)&&(outcome==='all'||(outcome==='win'?own(m).won:outcome==='left'?own(m).left:!own(m).won&&!own(m).left)));
  const index=cursor?filtered.findIndex(m=>m.id===cursor)+1:0;ensure(!cursor||index>0,'分页位置已失效',409);
  const items=filtered.slice(index,index+limit).map(m=>({...m,own:own(m)}));
  const perGame=this.registry.list().map(g=>{const records=all.filter(m=>m.gameId===g.id),wins=records.filter(m=>own(m).won).length;return {id:g.id,title:g.title,played:records.length,wins};});
  const settings=systemSettings(this.store.data),rewardPolicy={practiceWin:settings.practiceWinCredits,practiceLoss:settings.practiceLossCredits,multiplayerWin:settings.multiplayerWinCredits,multiplayerLoss:settings.multiplayerLossCredits};
  return {items,nextCursor:index+limit<filtered.length?items.at(-1).id:null,total:filtered.length,rewardPolicy,summary:{played:all.length,wins:all.filter(m=>own(m).won).length,practice:all.filter(m=>m.practice).length,perGame}};
 }
 detail(user,id){const match=this.store.data.matches[id];ensure(match&&match.participants.some(p=>p.id===user.id&&!p.isBot),'战绩不存在',404);return {...match,own:match.participants.find(p=>p.id===user.id)};}
}
