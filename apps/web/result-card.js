const serif='"Noto Serif SC","Songti SC","SimSun",serif';
const sans='"Microsoft YaHei",system-ui,sans-serif';
const gold='#e5c98d',ivory='#f2e6c9',jade='#9cbab1';
let artwork;
function loadArtwork(){
  return artwork??=new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{artwork=null;reject(new Error('卡片插画暂时无法载入，请重试'));};
    image.src='/assets/social/moon-card-v1.webp';
  });
}

/** A reusable illustrated memento; all identities and scores are drawn from the archived result. */
export async function resultCard(match){
  const image=await loadArtwork();
  const players=[...match.participants].sort((a,b)=>a.rank-b.rank),lead=players.find(p=>p.won)??players[0];
  const columns=players.length>4?3:2,rows=Math.ceil(players.length/columns);
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=Math.max(1000,910+rows*78);
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${match.gameTitle} · ${players.map(p=>`${p.name} 第 ${p.rank} 名 ${p.score} 分`).join('，')}`);
  const c=canvas.getContext('2d'),h=canvas.height;
  c.fillStyle='#002329';c.fillRect(0,0,1600,h);c.drawImage(image,0,0,1600,1000);
  const shade=c.createLinearGradient(0,720,0,1000);shade.addColorStop(0,'#00232900');shade.addColorStop(1,'#002329');c.fillStyle=shade;c.fillRect(0,720,1600,h-720);

  function text(value,x,y,size,{color=ivory,font=serif,width=680,weight=400,align='left',shrink=false}={}){
    let label=String(value),actual=size;c.textAlign=align;
    c.font=`${weight} ${actual}px ${font}`;
    if(shrink)while(c.measureText(label).width>width&&actual>size*.55){actual-=2;c.font=`${weight} ${actual}px ${font}`;}
    if(c.measureText(label).width>width){let chars=Array.from(label);while(chars.length&&c.measureText(chars.join('')+'…').width>width)chars.pop();label=chars.join('')+'…';}
    c.fillStyle=color;c.fillText(label,x,y);return c.measureText(label).width;
  }
  function rule(x,y,width,color='#c7ad7166'){c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+width,y);c.stroke();}
  function star(x,y,r=8){c.fillStyle=gold;c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+2,y-2,x+r,y);c.quadraticCurveTo(x+2,y+2,x,y+r);c.quadraticCurveTo(x-2,y+2,x-r,y);c.quadraticCurveTo(x-2,y-2,x,y-r);c.fill();}
  function avatar(name,x,y,r){
    c.fillStyle='#092f35';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.strokeStyle='#d8bb7c';c.lineWidth=2;c.stroke();
    c.beginPath();c.arc(x,y,r-8,0,Math.PI*2);c.strokeStyle='#d8bb7c66';c.lineWidth=1;c.stroke();
    text(Array.from(name)[0]??'月',x,y+r*.38,r*1.05,{align:'center',color:gold,width:r*1.6});
  }

  // Compact club signature, with a crescent drawn independently of dynamic type.
  c.fillStyle=gold;c.beginPath();c.arc(108,104,38,0,Math.PI*2);c.fill();c.fillStyle='#073239';c.beginPath();c.arc(124,92,36,0,Math.PI*2);c.fill();star(143,106,8);
  text('M O O N  T A B L E',178,96,29,{color:gold,font:'Georgia,serif',width:540});
  text('今 夜 同 桌',180,135,21,{color:gold,font:sans});rule(352,127,85);
  text(match.gameTitle,68,298,100,{width:710,shrink:true});
  rule(72,343,270);star(367,343,9);rule(393,343,250);
  text(match.roomTitle,74,401,31,{color:gold,width:610});

  avatar(lead.name,143,562,72);
  text(lead.name,253,535,52,{width:490,shrink:true});
  const joint=players.filter(p=>p.won).length;
  text(joint>1?`${joint} 位牌友共同优胜`:lead.won?'本 局 优 胜':'对 局 留 念',256,578,23,{color:jade,font:sans,width:470});
  const number=lead.left?'—':String(lead.score);
  const numberWidth=text(number,247,724,151,{color:gold,font:'Georgia,serif',width:370,shrink:true});
  text(lead.left?'离席':'分',265+numberWidth,714,34,{color:gold,width:180});
  text(`${match.practice?'AI 练习':'真人同桌'}  ·  ${players.length} 人`,76,772,22,{color:jade,font:sans});

  rule(72,812,1456);star(800,812,7);
  const cellWidth=1456/columns;
  players.forEach((p,i)=>{
    const x=72+(i%columns)*cellWidth,y=868+Math.floor(i/columns)*78;
    const color=p.won?gold:jade;
    text(String(p.rank).padStart(2,'0'),x,y,31,{color,font:'Georgia,serif',width:55});
    text(p.name+(p.isBot?' · AI':''),x+72,y,30,{color:p.won?ivory:jade,width:cellWidth-218});
    text(p.left?'离席':p.score,x+cellWidth-38,y,35,{color,font:'Georgia,serif',align:'right',width:120});
  });
  rule(72,h-70,48);text('下一局，等你入座。',140,h-58,22,{color:gold,width:500});
  text(location.host,1528,h-58,20,{font:sans,color:jade,align:'right',width:580});
  return canvas;
}
