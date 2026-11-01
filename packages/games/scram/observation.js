// Public physical actions only: no hidden incoming card or private peek value.
// This is an ephemeral projection, never part of persisted game state.
export function publicMotion(state, transition) {
  const before=transition?.before, cmd=transition?.command, actorId=transition?.actorId;
  if(!before || !cmd || before.round!==state.round || before.sequence+1!==state.sequence)return null;
  const ref=r=>({playerId:r.playerId,slot:r.slot});
  const value=r=>r.playerId===null?before.deck.at(-1-r.slot).value:before.players.find(p=>p.id===r.playerId).cards[r.slot].value;
  const motion={sequence:state.sequence,actorId,type:cmd.type};
  if(cmd.type==='draw')return {...motion,source:cmd.source};
  if(cmd.type==='discard')return {...motion,value:before.drawn.card.value};
  if(cmd.type==='replace'){
    const outgoing=cmd.targets.map(r=>({...ref(r),value:value(r)}));
    const success=new Set(outgoing.map(r=>r.value).filter(v=>v!=='=')).size<=1;
    return {...motion,targets:outgoing,success,insertSlot:cmd.insertSlot??cmd.targets[0].slot,side:cmd.side??'right',
      incoming:before.drawn.source==='discard'?before.drawn.card.value:null,
      penalty:success?0:Math.min(before.deck.length,Math.min(3,Math.max(0,new Set(outgoing.map(r=>r.value).filter(v=>v!=='=')).size-2)))};
  }
  if(cmd.type==='ability'){
    const ability=before.drawn.card.value;
    return {...motion,ability,targets:(cmd.targets??[]).map(r=>[9,10].includes(ability)?{...ref(r),value:value(r)}:ref(r)),
      ...(ability===13?{playerId:cmd.playerId}:{}),side:cmd.side??'right'};
  }
  if(cmd.type==='resolve')return {...motion,swap:!!cmd.swap,targets:before.effect.targets.map(ref)};
  return motion;
}
