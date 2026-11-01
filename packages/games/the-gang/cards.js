/** Standard 52-card deck. Rank 14 is ace; suits never break a tie. */
export const handNames = ['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'];
export const makeDeck = () => ['s','h','c','d'].flatMap(suit => Array.from({length:13}, (_,i) => ({rank:i+2,suit})));
export function shuffle(cards, random) {
  const out = cards.slice();
  for (let i=out.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
  return out;
}
export function compare(a,b) { for(let i=0;i<Math.max(a.length,b.length);i++) {const d=(a[i]??0)-(b[i]??0);if(d)return Math.sign(d);} return 0; }
function five(cards) {
  const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a), unique=[...new Set(ranks)];
  const flush=cards.every(c=>c.suit===cards[0].suit);
  const straight=unique.length===5 ? (unique[0]-unique[4]===4?unique[0]:unique.join(',')==='14,5,4,3,2'?5:0) : 0;
  const groups=unique.map(rank=>({rank,count:ranks.filter(r=>r===rank).length})).sort((a,b)=>b.count-a.count||b.rank-a.rank);
  if(flush&&straight)return [8,straight];
  if(groups[0].count===4)return [7,groups[0].rank,groups[1].rank];
  if(groups[0].count===3&&groups[1].count===2)return [6,groups[0].rank,groups[1].rank];
  if(flush)return [5,...ranks];
  if(straight)return [4,straight];
  if(groups[0].count===3)return [3,...groups.map(g=>g.rank)];
  if(groups[0].count===2&&groups[1].count===2)return [2,...groups.map(g=>g.rank)];
  if(groups[0].count===2)return [1,...groups.map(g=>g.rank)];
  return [0,...ranks];
}
/** Enumerating at most 21 combinations makes all kickers and board-only hands explicit. */
export function evaluate(cards) {
  if(cards.length<5||cards.length>7)throw new Error('需要 5–7 张牌');
  let best=null;
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
    const chosen=[cards[a],cards[b],cards[c],cards[d],cards[e]],score=five(chosen);
    if(!best||compare(score,best.score)>0)best={score,cards:chosen,name:score[0]===8&&score[1]===14?'皇家同花顺':handNames[score[0]]};
  }
  return best;
}
