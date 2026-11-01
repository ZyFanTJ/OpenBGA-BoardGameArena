import {frame} from '../spectator-ui.js';
import {createMarrakechRenderer} from './index.js';
export function render(room){return frame(room,createMarrakechRenderer().render(room,{id:null}));}
