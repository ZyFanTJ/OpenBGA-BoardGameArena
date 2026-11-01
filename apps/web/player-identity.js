import {escapeHtml as e} from './ui.js';
import {titleBadge,avatar} from './hub/cosmetics.js';

// Room snapshots provide only the equipped title's public display metadata.
export function playerIdentity(player,label=player?.name??'玩家'){
 const badge=player&&!player.isBot&&player.title?titleBadge(player,[],'game-title-badge'):'';
 return `<span class="game-player-identity">${badge}<span class="game-player-nickname">${e(label)}</span></span>`;
}
export function playerName(room,id,label){
 return playerIdentity(room?.players?.find(p=>p.id===id),label);
}

export function playerAvatar(room,id,extra=''){return avatar(room?.players?.find(p=>p.id===id),`game-seat-avatar ${extra}`);}

export const playerTurnClass=(room,id)=>room?.turn?.key!=null&&!room.turn.paused&&room.turn.playerIds?.includes(id)?'is-turn-actor':'';
