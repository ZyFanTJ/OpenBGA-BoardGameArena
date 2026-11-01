import {renderCaboTable} from '../cabo-table.js';
import {caboResults} from './results.js';
import {frame,name,phaseText} from '../spectator-ui.js';

export function render(room,{focusId=null}={}) {
  const s=room.game,ended=['roundEnd','finished'].includes(s.phase);
  return frame(room,renderCaboTable({s,room,user:{id:null},name:id=>name(room,id),
    selectable:()=>false,selected:[],help:phaseText(room),controls:'',spectator:true,focusId,
    settlementOpen:false})+(ended?`<section class="spectator-results"><h2>本轮结算</h2>${caboResults(s,id=>name(room,id),null)}</section>`:''));
}
