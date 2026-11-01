import {indexedRecords} from './record-index.js';
import {ensure} from './errors.js';
import {rewardMatch} from './economy.js';
import {systemSettings} from './system.js';

// Administrative history copies belong to one user; shared match participants
// remain intact without adding the copy to another player's career statistics.
export const matchVisibleTo=(match,userId)=>(match.historyOwnerId===undefined||match.historyOwnerId===userId)&&!(match.historyExcludedUserIds??[]).includes(userId);
export function recordView(match){const {historyOwnerId,historyExcludedUserIds,copiedFromMatchId,copiedFromUserId,gameDataCopyOperation,copiedAt,...view}=match;return view;}

/** Called inside the room's transaction. Stores result summaries, never game states. */
export function archiveMatch(data,room,game,{imported=false}={}){
 if(!game.result||!game.isFinished(room.game))return;
 const id=room.matchId??`legacy-${room.id}-${room.revision}`;if(data.matches[id])return;
 const result=game.result(room.game),practice=room.players.filter(p=>!p.isBot||p.departed).length<2;
 const participants=result.players.map(row=>{const seat=room.players.find(p=>p.id===row.id),human=!!data.profiles[row.id]&&(!seat?.isBot||seat?.departed),left=!!seat?.departed;
  return {...row,name:human?data.profiles[row.id].name:seat?.name??'AI',isBot:!human,left,won:result.winners.includes(row.id)&&!left};});
 data.matches[id]={id,gameId:room.gameId,gameTitle:game.manifest.title,roomTitle:room.title,startedAt:room.startedAt??room.createdAt,endedAt:imported?null:Date.now(),recordedAt:Date.now(),practice,rounds:result.rounds??1,scoreDirection:result.scoreDirection??'higher',participants,imported};
 if(!imported)for(const p of participants)if(!p.isBot&&!p.left)p.reward=rewardMatch(data,p.id,id,p.won,practice);
}
export class RecordService{
 constructor(store,registry){this.store=store;this.registry=registry;}
 backfill(){const outdated=Object.values(this.store.data.matches).filter(m=>m.practice!==(m.participants.filter(p=>!p.isBot).length<2));if(outdated.length)this.store.transaction(data=>{for(const m of outdated)data.matches[m.id].practice=m.participants.filter(p=>!p.isBot).length<2;});const pending=Object.values(this.store.data.rooms).filter(r=>r.status==='finished'&&!this.store.data.matches[r.matchId??`legacy-${r.id}-${r.revision}`]);if(pending.length)this.store.transaction(data=>{for(const r of pending)archiveMatch(data,data.rooms[r.id],this.registry.get(r.gameId),{imported:true});});}
 list(user,{game='all',outcome='all',mode='all',cursor='',limit=10}={}){
  ensure(['all','win','loss','left'].includes(outcome)&&['all','practice','multiplayer'].includes(mode),'筛选条件无效');
  limit=Math.max(1,Math.min(20,Number(limit)||10));
  const all=indexedRecords(this.store,'matches','human-player',m=>m.participants.filter(p=>!p.isBot).map(p=>p.id),user.id).filter(m=>matchVisibleTo(m,user.id)).sort((a,b)=>(b.endedAt??b.recordedAt)-(a.endedAt??a.recordedAt)||b.id.localeCompare(a.id));
  const own=m=>m.participants.find(p=>p.id===user.id);
  const filtered=all.filter(m=>(game==='all'||m.gameId===game)&&(mode==='all'||(mode==='practice')===m.practice)&&(outcome==='all'||(outcome==='win'?own(m).won:outcome==='left'?own(m).left:!own(m).won&&!own(m).left)));
  const index=cursor?filtered.findIndex(m=>m.id===cursor)+1:0;ensure(!cursor||index>0,'分页位置已失效',409);
  const items=filtered.slice(index,index+limit).map(m=>({...recordView(m),own:own(m)}));
  const perGame=this.registry.list().map(g=>{const records=all.filter(m=>m.gameId===g.id),wins=records.filter(m=>own(m).won).length;return {id:g.id,title:g.title,played:records.length,wins};});
  const settings=systemSettings(this.store.data),rewardPolicy={practiceWin:settings.practiceWinCredits,practiceLoss:settings.practiceLossCredits,multiplayerWin:settings.multiplayerWinCredits,multiplayerLoss:settings.multiplayerLossCredits};
  return {items,nextCursor:index+limit<filtered.length?items.at(-1).id:null,total:filtered.length,rewardPolicy,summary:{played:all.length,wins:all.filter(m=>own(m).won).length,practice:all.filter(m=>m.practice).length,perGame}};
 }
 detail(user,id){const match=this.store.data.matches[id];ensure(match&&matchVisibleTo(match,user.id)&&match.participants.some(p=>p.id===user.id&&!p.isBot),'战绩不存在',404);return {...recordView(match),own:match.participants.find(p=>p.id===user.id)};}
 share(user,id){this.detail(user,id);this.store.transaction(data=>{data.matches[id].shared=true;});return this.shared(id);}
 shared(id){const m=this.store.data.matches[id];ensure(m?.shared,'分享不存在',404);return {id:m.id,gameId:m.gameId,gameTitle:m.gameTitle,roomTitle:m.roomTitle,endedAt:m.endedAt,rounds:m.rounds,practice:m.practice,participants:m.participants.map(p=>({name:p.name,rank:p.rank,score:p.score,won:p.won,isBot:p.isBot,left:p.left}))};}
}
