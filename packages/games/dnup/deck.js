// Numeric data transcribed from the licensed BGA card sheet; see docs/dnup-rules.md.
const pairs=[[2,4],[2,4],[3,4],[3,4],[1,5],[2,5],[2,5],[3,5],[3,5],[4,5],[1,6],[1,6],[2,6],[2,6],[3,6],[3,6],[4,6],[1,7],[1,7],[2,7],[3,7],[4,7],[5,7],[7,6],[7,6],[1,8],[1,8],[2,8],[3,8],[4,8],[5,8],[5,8],[1,9],[1,9],[2,9],[3,9],[4,9],[1,10],[2,10],[3,10]];
export const deckData=pairs.map(([value,reverse],i)=>({id:String(i),value,reverse,star:i===4,minPlayers:[23,30,36,39].includes(i)?5:[2,7,12,19,25,32].includes(i)?4:[9,14,27,37].includes(i)?3:2}));
export const deckFor=n=>deckData.filter(c=>c.minPlayers<=n).map(c=>({...c}));
export const flip=c=>({...c,value:c.reverse,reverse:c.value});
