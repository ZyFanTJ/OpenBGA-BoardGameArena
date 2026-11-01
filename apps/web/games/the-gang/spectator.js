import {createGangRenderer} from './index.js';
export function render(room){return `<div class="spectator-gang">${createGangRenderer(()=>{}).render({...room,spectator:true},{id:null})}</div>`;}
