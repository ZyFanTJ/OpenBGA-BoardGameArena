import { api } from './api.js';

// A transient motion descriptor is not part of the player's decision.
const decisionView=game=>{if(!game)return game;const {motion,...view}=game;return JSON.stringify(view);};

/** A pending room write blocks only another room write. Menus, chat, navigation
 * and game inspection keep working, and late responses cannot reopen old rooms. */
export function createRoomCommands({ getRoom, receive, left, resynced=()=>{}, request = api }) {
  const pending = new Set();
  return async function send(input) {
    const room = getRoom();
    if (!room) return;
    if (pending.has(room.id)) throw new Error('上一项牌桌操作仍在提交，请稍候');
    const { id, matchId } = room;
    pending.add(id);
    try {
      const body = {
        matchId, submissionKey: room.submissionKey, controlRevision: room.controlRevision, ...input, revision: input.revision ?? room.revision,
      };
      let snapshot;
      try {snapshot=await request(`/rooms/${id}/actions`,body);}
      catch(error){
        if(error.code!=='ROOM_REVISION_CONFLICT'||error.mayHaveCommitted)throw error;
        let latest=await request(`/rooms/${id}`);
        if(getRoom()?.id!==id||getRoom()?.matchId!==matchId)return;
        receive(latest,{resetPresentation:true,resetAnimations:true});
        if(getRoom()?.revision>latest.revision)latest=getRoom();
        // Only retry an explicitly rejected action whose entire private decision
        // view is unchanged. Never repeat uncertain writes or a changed turn.
        const sameDecision=input.type==='game'&&input.revision===undefined&&latest.matchId===matchId
          && latest.status==='playing'&&!latest.dissolution&&room.turn?.key!=null
          && latest.turn?.key===room.turn.key&&decisionView(latest.game)===decisionView(room.game);
        if(!sameDecision){
          if(input.type!=='game')throw Object.assign(new Error('牌桌已同步，请重新确认这项操作'),{status:409,resynced:true});
          resynced();return;
        }
        try {snapshot=await request(`/rooms/${id}/actions`,{...body,revision:latest.revision,submissionKey:latest.submissionKey});}
        catch(retryError){
          if(retryError.code!=='ROOM_REVISION_CONFLICT'||retryError.mayHaveCommitted)throw retryError;
          const current=await request(`/rooms/${id}`);
          if(getRoom()?.id===id&&getRoom()?.matchId===matchId){receive(current,{resetPresentation:true,resetAnimations:true});resynced();}
          return;
        }
      }
      if (getRoom()?.id !== id || getRoom()?.matchId !== matchId) return;
      if (snapshot.left) left(snapshot); else receive(snapshot);
    } catch (error) { error.roomId = id; throw error; }
    finally { pending.delete(id); }
  };
}
