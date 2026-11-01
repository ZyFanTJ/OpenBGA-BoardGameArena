import {loadStyles} from '../styles-loader.js';

// Only public rules and room options are needed before dealing cards.
export async function pregameGuide(id,options={}){
 switch(id){
  case 'dnup': {
   const [m]=await Promise.all([import('./dnup/guide.js'),loadStyles(['/games/dnup/style.css'])]);
   return m.guide();
  }
  case 'scram': {
   const [m]=await Promise.all([import('./scram/guide.js'),loadStyles(['/games/scram/style.css'])]);
   return m.guide();
  }
  case 'tidewatch': {
   const [module]=await Promise.all([import('/dist/tidewatch-guide.js'),loadStyles(['/games/tidewatch/guide.css'])]);
   return module.guide();
  }
  case 'cabo': {
   const [m]=await Promise.all([import('./cabo-guide.js'),loadStyles(['/games/cabo-guide.css'])]);
   return `<div class="cabo-reference">${m.content(!!options.expert)}</div>`;
  }
  case 'uno': return (await import('./uno/guide.js')).fullGuide();
  case 'catan': return (await import('./catan/guide.js')).fullGuide().replace('<details class="ct-guide">','<details class="ct-guide" open>');
  case 'marrakech': return (await import('./marrakech/guide.js')).visualGuide();
  case 'seven-wonders': return (await import('./seven-wonders/guide.js')).fullGuide({turnsPerAge:options.armada?7:6,expansions:{leaders:!!options.leaders,armada:!!options.armada}});
  case 'night-of-the-ninja': {
   const [m,reference]=await Promise.all([import('./night-of-the-ninja/guide.js'),import('./night-of-the-ninja/reference.js'),loadStyles(['/games/night-of-the-ninja/style.css'])]);
   return m.fullGuide(reference.roles);
  }
  case 'texas-holdem': {
   const [m]=await Promise.all([import('./texas-holdem/guide.js'),loadStyles(['/games/texas-holdem/style.css'])]);
   return m.guide();
  }
  case 'dnd': {
   const [m,catalog,credits]=await Promise.all([import('./dnd/guide.js'),import('./dnd/catalog.js'),import('./dnd/adventure-picker.js')]);
   const adventure=catalog.adventureCatalog.find(a=>a.id===(options.adventureId??'blackapple'))??catalog.adventureCatalog[0];
   return m.fullGuide({adventure,attribution:'This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'}).replace('<details class="dnd-guide">','<details class="dnd-guide" open>')+credits.adventureCredits();
  }
  default: throw new Error('暂无玩法手卡');
 }
}
