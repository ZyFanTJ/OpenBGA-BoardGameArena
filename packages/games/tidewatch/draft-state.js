import {ensure} from '../../platform/errors.js';
import {CARDS,FACTIONS,RARITIES,RELICS,RECIPES,ODDS,LEVEL_COST,LEVEL_WAVE,commandCap,PADS,ROUTES,RELIC_SLOTS,growthCost,equipFirst,hasRelic} from './catalog.js';
export const copy=s=>structuredClone(s);
export const player=(s,id)=>{const p=s.players.find(x=>x.id===id);ensure(p,'不属于本场远航',403);return p;};
export function random(s){let x=s.randomState>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.randomState=x>>>0;return s.randomState/4294967296;}
export function shuffled(s,items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function emit(s,event){s.events.push({id:++s.eventSeq,at:s.time,...event,...(Number.isInteger(event.sector)?{route:s.players[event.sector].route}:{})});if(s.events.length>160)s.events.splice(0,s.events.length-160);}
export function spend(p,n){ensure(Number.isFinite(n)&&n>=0&&p.gold>=n,'金币不足');p.gold-=n;p.stats.invested+=n;}
export const owned=(s,p)=>[...p.inventory,...s.towers.filter(t=>t.owner===p.id&&!t.temporary)];
export const usage=(s,p)=>s.towers.filter(t=>t.owner===p.id&&!t.temporary).reduce((n,t)=>n+CARDS[t.kind].command,0);
function creditGift(s,card){if(card.giftFrom&&!card.giftUsed){player(s,card.giftFrom).stats.gifts++;card.giftUsed=true;}}
export function giveCard(s,p,kind,extra={}){const card={id:s.nextCardId++,kind,star:1,received:false,locked:false,nextShot:0,baseLevel:1,branch:null,baseSpent:0,...extra};if(p.inventory.length<8)p.inventory.push(card);else p.pending.push(card);return card;}
export function recruit(s,p,automatic=false){
 const free=p.freeRecruit>0;
 if(!automatic){ensure(!p.pending.length,'先领取或整理待领建筑');ensure(p.inventory.length<8,'备用栏已满');}
 if(free)p.freeRecruit--;else {ensure(!automatic,'没有免费招募');spend(p,40);}
 let r=random(s)*100,tier=0;while(tier<3&&r>=ODDS[p.recruitLevel-1][tier])r-=ODDS[p.recruitLevel-1][tier++];
 for(const [i,level,limit] of [[1,2,4],[2,3,8],[3,5,p.pity.obtainedOrange?20:12]])if(p.recruitLevel>=level&&p.pity.miss[i]>=limit-1)tier=Math.max(tier,i);
 for(const [i,level] of [[1,2],[2,3],[3,5]])if(p.recruitLevel>=level)p.pity.miss[i]=tier>=i?0:p.pity.miss[i]+1;
 if(tier===3)p.pity.obtainedOrange=true;
 const pool=Object.keys(CARDS).filter(k=>CARDS[k].rarity===tier),kind=pool[Math.floor(random(s)*pool.length)],card=giveCard(s,p,kind);
 p.stats.draws++;emit(s,{type:'recruit',owner:p.id,card:card.id,kind,rarity:tier});return card;
}
export function availableRelics(s,p,{start=false}={}){
 const ownedF=new Set(owned(s,p).map(c=>CARDS[c.kind].faction));
 let pool=Object.keys(RELICS).filter(id=>!p.relics.includes(id)&&p.bountyRelic!==id&&(RELICS[id].wave??0)<=s.wave&&(start?RELICS[id].stage==='start':!RELICS[id].faction||ownedF.has(RELICS[id].faction)));
 if(!pool.length)pool=Object.keys(RELICS).filter(id=>!p.relics.includes(id)&&p.bountyRelic!==id&&(RELICS[id].wave??0)<=s.wave);
 const shuffledPool=shuffled(s,pool);
 if(start){const first=shuffledPool.find(id=>RELICS[id].faction===p.faction);return first?[first,...shuffledPool.filter(id=>id!==first)]:shuffledPool;}
 return shuffledPool;
}
export function offerChoices(s,p,offer){if(offer.kind!=='relic'&&offer.kind!=='bountyRelic')return offer.choices;const choices=offer.choices.filter(id=>!p.relics.includes(id)&&p.bountyRelic!==id).slice(0,3);return choices.length||offer.kind!=='bountyRelic'?choices:['evolutionCore'];}
export function makeOffer(s,p,kind,choices,extra={}){const offer={id:s.nextOfferId++,kind,choices,...extra};p.offers.push(offer);return offer;}
export function craftPlan(s,p,recipe){
 const plan=[];for(const need of recipe.needs){let left=need.copies;const candidates=owned(s,p).filter(c=>c.kind===need.kind&&!c.locked&&!c.gift).sort((a,b)=>(a.pad!==undefined)-(b.pad!==undefined)||b.star-a.star||a.id-b.id);for(const c of candidates){if(left<=0)break;const take=Math.min(left,c.star===2?2:1);plan.push({id:c.id,take});left-=take;}if(left>0)return null;}
 return p.cores>=recipe.core?plan:null;
}
export function canCraft(s,p,recipe,plan){
 if(!plan)return false;const items=plan.map(x=>owned(s,p).find(t=>t.id===x.id)),main=items.find(x=>x.kind===recipe.needs[0].kind&&x.pad!==undefined)??items.find(x=>x.pad!==undefined),ids=items.map(x=>x.id),surplus=plan.filter(x=>items.find(t=>t.id===x.id).star===2&&x.take===1).length;
 if(p.inventory.filter(x=>!ids.includes(x.id)).length+(main?0:1)+surplus>8)return false;
 if(main){if(usage(s,p)-items.filter(x=>x.pad!==undefined).reduce((n,x)=>n+CARDS[x.kind].command,0)+CARDS[recipe.result].command>commandCap(s.wave))return false;if(CARDS[recipe.result].rarity===3&&s.towers.filter(t=>t.owner===p.id&&!ids.includes(t.id)&&CARDS[t.kind].rarity===3).length>=2)return false;}
 return true;
}
function remove(s,p,id){p.inventory=p.inventory.filter(c=>c.id!==id);s.towers=s.towers.filter(c=>c.id!==id&&c.parent!==id);}
function checkDeployment(s,p,kind,subtract=0,removeIds=[]){ensure(usage(s,p)-subtract+CARDS[kind].command<=commandCap(s.wave),'指挥点不足');if(CARDS[kind].rarity===3)ensure(s.towers.filter(t=>t.owner===p.id&&!removeIds.includes(t.id)&&CARDS[t.kind].rarity===3).length<2,'最多同时部署两座传奇建筑');}
export function inventoryCommand(s,p,c){
 switch(c.type){
 case 'route':{ensure(s.phase==='prepare','整备时才能改道');ensure(Object.hasOwn(ROUTES,c.route),'路线无效');ensure(!s.enemies.some(e=>e.sector===p.sector),'先清空本岛的遗留怪物');p.route=c.route;s.zones=s.zones.filter(z=>z.sector!==p.sector);s.echoes=s.echoes.filter(z=>z.sector!==p.sector);break;}
 case 'unlockSite':{const pad=PADS[c.pad];ensure(s.phase==='prepare','整备时才能开垦');ensure(pad&&!p.unlocked.includes(pad.id)&&pad.cost,'地块不可开垦');spend(p,pad.cost);p.unlocked.push(pad.id);break;}
 case 'move':{const t=s.towers.find(t=>t.id===c.tower&&t.owner===p.id&&!t.temporary);ensure(t,'只能迁移自己的建筑');ensure(s.phase==='prepare','整备时才能迁移');ensure(Number.isInteger(c.pad)&&p.unlocked.includes(c.pad),'地块尚未开垦');ensure(!s.towers.some(x=>x.owner===p.id&&x.pad===c.pad),'地块已经占用');spend(p,10);t.pad=c.pad;t.nextShot=Math.max(t.nextShot,s.time+500);break;}
 case 'grow':{const t=owned(s,p).find(t=>t.id===c.card&&!t.gift);ensure(t,'基座不可用');ensure((t.baseLevel??1)<3,'这条成长线已满级');if((t.baseLevel??1)===1){ensure(CARDS[t.kind].branches.some(b=>b.id===c.branch),'请选择这座基座的成长分支');t.branch=c.branch;}else ensure(!c.branch||c.branch===t.branch,'成长分支不能改选');const cost=growthCost(t);spend(p,cost);t.baseLevel=(t.baseLevel??1)+1;t.baseSpent=(t.baseSpent??0)+cost;t.nextShot=Math.max(t.nextShot??0,s.time+500);emit(s,{type:'growth',owner:p.id,kind:t.kind,...(t.pad!==undefined?{pad:t.pad,sector:p.sector}:{}),level:t.baseLevel});break;}
 case 'equipRelic':{ensure(s.phase==='prepare','整备时才能调整遗物');ensure(Object.hasOwn(RELIC_SLOTS,c.slot),'遗物位置无效');ensure(c.relic===null||p.relics.includes(c.relic)&&RELICS[c.relic].slots.includes(c.slot),'遗物不能装在这个位置');for(const key of Object.keys(RELIC_SLOTS))if(p.relicSlots[key]===c.relic)p.relicSlots[key]=null;p.relicSlots[c.slot]=c.relic;break;}
 case 'starter':{
  ensure(!p.started&&s.wave===1&&s.phase==='prepare','已经开始部署');ensure(Object.hasOwn(FACTIONS,c.faction),'派系无效');p.faction=c.faction;p.inventory=[];giveCard(s,p,`${c.faction}0`);giveCard(s,p,`${c.faction}1`);p.started=true;break;
 }
 case 'recruit':p.started=true;recruit(s,p);break;
 case 'recruitLevel':{ensure(p.recruitLevel<5,'招募已满级');ensure(s.wave>=LEVEL_WAVE[p.recruitLevel],'还未开放这一级招募');spend(p,LEVEL_COST[p.recruitLevel]);p.recruitLevel++;p.started=true;break;}
 case 'claimCard':{ensure(p.inventory.length<8,'备用栏已满');const card=p.pending.find(x=>x.id===c.card);ensure(card,'没有这张待领卡');p.pending=p.pending.filter(x=>x.id!==c.card);p.inventory.push(card);break;}
 case 'deploy':{
  const card=p.inventory.find(x=>x.id===c.card);ensure(card&&!card.gift,'建筑不可用');ensure(Number.isInteger(c.pad)&&PADS[c.pad],'位置无效');ensure(p.unlocked.includes(c.pad),'地块尚未开垦');ensure(!s.towers.some(t=>t.owner===p.id&&t.pad===c.pad),'位置已有建筑');checkDeployment(s,p,card.kind);creditGift(s,card);p.inventory=p.inventory.filter(x=>x.id!==card.id);s.towers.push({...card,owner:p.id,sector:p.sector,pad:c.pad,target:'first',shots:0,nextShot:Math.max(card.nextShot??0,s.time+500)});p.started=true;if(CARDS[card.kind].rarity===3)p.stats.firstLegendWave??=s.wave;emit(s,{type:'build',tower:card.id,kind:card.kind,sector:p.sector,pad:c.pad});break;
 }
 case 'recall':{
  const t=s.towers.find(x=>x.id===c.tower&&x.owner===p.id&&!x.temporary);ensure(t,'只能收起自己的建筑',403);ensure(p.inventory.length<8,'备用栏已满');ensure(s.phase==='prepare'||hasRelic(p,'crane')&&p.craneWave!==s.wave,'战斗中需要紧急吊装');if(s.phase!=='prepare')p.craneWave=s.wave;remove(s,p,t.id);const {pad,owner,sector,...card}=t;p.inventory.push({...card,nextShot:Math.max(t.nextShot,s.time+500)});break;
 }
 case 'lock':{const card=owned(s,p).find(x=>x.id===c.card);ensure(card&&!card.gift,'建筑不可用');card.locked=!card.locked;break;}
 case 'recycle':{const card=owned(s,p).find(x=>x.id===c.card);ensure(card&&!card.locked&&!card.gift,'建筑被锁定或不可用');p.gold+=RARITIES[CARDS[card.kind].rarity].recycle*(card.star===2?2:1)+Math.floor((card.baseSpent??0)*.7);remove(s,p,card.id);break;}
 case 'merge':{
  ensure(Array.isArray(c.cards)&&c.cards.length===2&&new Set(c.cards).size===2,'请选择两张同名一星卡');const items=c.cards.map(id=>owned(s,p).find(x=>x.id===id));ensure(items.every(x=>x&&!x.locked&&!x.gift&&x.star===1)&&items[0].kind===items[1].kind,'需要两张可用的同名一星卡');const upgraded=items.filter(x=>(x.baseLevel??1)>1);ensure(upgraded.length<2||upgraded[0].branch===upgraded[1].branch,'成长分支不同，不能升星');const best=[...items].sort((a,b)=>(b.baseLevel??1)-(a.baseLevel??1))[0],main=items.find(x=>x.pad!==undefined)??items[0];p.gold+=Math.floor((items.reduce((n,x)=>n+(x.baseSpent??0),0)-(best.baseSpent??0))*.7);for(const x of items){creditGift(s,x);remove(s,p,x.id);}const result={...main,baseLevel:best.baseLevel??1,branch:best.branch??null,baseSpent:best.baseSpent??0,star:2,received:items.some(x=>x.received),nextShot:Math.max(s.time+500,...items.map(x=>x.nextShot??0))};if(main.pad!==undefined){s.towers.push(result);emit(s,{type:'upgrade',tower:result.id,kind:result.kind,sector:p.sector,pad:result.pad,level:2});}else p.inventory.push(result);p.stats.merges++;break;
 }
 case 'craft':{
  const recipe=RECIPES.find(x=>x.id===c.recipe);ensure(recipe,'配方无效');const plan=craftPlan(s,p,recipe);ensure(plan,'材料或进化核心不足');if(c.materials)ensure(JSON.stringify([...c.materials].sort((a,b)=>a-b))===JSON.stringify(plan.map(x=>x.id).sort((a,b)=>a-b)),'材料已经变化，请重新选择');
  const items=plan.map(x=>owned(s,p).find(t=>t.id===x.id)),main=items.find(x=>x.kind===recipe.needs[0].kind&&x.pad!==undefined)??items.find(x=>x.pad!==undefined),received=items.some(x=>x.received),ids=items.map(x=>x.id);const surplus=plan.filter(x=>items.find(t=>t.id===x.id).star===2&&x.take===1);
  const nextInventory=p.inventory.filter(x=>!ids.includes(x.id)).length+(main?0:1)+surplus.length;ensure(nextInventory<=8,'先腾出备用栏位置');if(main)checkDeployment(s,p,recipe.result,items.filter(x=>x.pad!==undefined).reduce((n,x)=>n+CARDS[x.kind].command,0),ids);
  for(const x of items){creditGift(s,x);remove(s,p,x.id);}p.gold+=Math.floor(items.reduce((n,x)=>n+(x.baseSpent??0),0)*.7);p.cores-=recipe.core;
  for(const x of surplus){const old=items.find(t=>t.id===x.id);giveCard(s,p,old.kind,{received:old.received||received});}
  const result={id:s.nextCardId++,kind:recipe.result,star:1,received,locked:false,baseLevel:1,branch:null,baseSpent:0,nextShot:Math.max(s.time+500,...items.map(x=>x.nextShot??0))};
  if(main){s.towers.push({...result,owner:p.id,sector:p.sector,pad:main.pad,target:main.target??'first',shots:0});emit(s,{type:'evolve',tower:result.id,kind:result.kind,sector:p.sector,pad:main.pad});}else p.inventory.push(result);p.stats.evolutions++;if(CARDS[result.kind].rarity===3)p.stats.firstLegendWave??=s.wave;break;
 }
 case 'target':{const t=s.towers.find(t=>t.id===c.tower&&t.owner===p.id&&!t.temporary);ensure(t,'只能操作自己的建筑',403);ensure(['first','strong','healer'].includes(c.target),'目标无效');t.target=c.target;break;}
 case 'wish':{ensure(Array.isArray(c.kinds)&&c.kinds.length<=2&&c.kinds.every(k=>Object.hasOwn(CARDS,k)),'愿望单无效');p.wishes=[...new Set(c.kinds)];break;}
 case 'chooseOffer':{
  const offer=p.offers.find(x=>x.id===c.offer);ensure(offer,'选择已经领取');ensure(offerChoices(s,p,offer).includes(c.choice),'选项不可用');
  if(offer.kind==='relic'){p.relics.push(c.choice);equipFirst(p,c.choice);if(offer.start)giveCard(s,p,`${RELICS[c.choice].faction}4`);}
  else if(offer.kind==='bountyRelic'){if(c.choice==='evolutionCore')p.cores++;else {p.relics.push(c.choice);equipFirst(p,c.choice);}}
  else giveCard(s,p,c.choice);
  p.offers=p.offers.filter(x=>x.id!==offer.id);emit(s,{type:'choice',owner:p.id,choice:c.choice});break;
 }
 default:return false;
 }return true;
}
export function closeGift(s,g,accepted=false){
 const from=player(s,g.from),to=player(s,g.to),card=from.inventory.find(c=>c.id===g.card);
 if(card)delete card.gift;
  if(accepted){ensure(card,'赠送建筑已不存在');ensure(to.inventory.length<8,'对方备用栏已满');from.inventory=from.inventory.filter(c=>c.id!==card.id);to.inventory.push({...card,received:true,giftFrom:from.id,giftUsed:false});}
 else {from.shipping=Math.min(2,from.shipping+g.cost);to.receiving=Math.max(0,to.receiving-g.cost);}
 s.gifts=s.gifts.filter(x=>x.id!==g.id);
}
export function giftCommand(s,p,c){
 if(c.type==='gift'){
  ensure(s.wave>=2,'第二波开始开放赠送');const to=player(s,c.to);ensure(to.id!==p.id,'请选择队友');const card=p.inventory.find(x=>x.id===c.card);ensure(card&&!card.gift&&!card.locked&&!card.received,'这张建筑不能赠送');const cost=card.star===2||CARDS[card.kind].rarity===3?2:1;ensure(p.shipping>=cost,'航运额度不足');ensure(to.receiving+cost<=2,'对方本轮接收额度已满');p.shipping-=cost;to.receiving+=cost;const g={id:s.nextGiftId++,from:p.id,to:to.id,card:card.id,cost,expires:s.time+30000};card.gift=g.id;s.gifts.push(g);emit(s,{type:'gift',from:p.id,to:to.id});return true;
 }
 if(['acceptGift','cancelGift'].includes(c.type)){const g=s.gifts.find(x=>x.id===c.gift);ensure(g&&g.expires>s.time,'赠送已经到期');ensure(c.type==='acceptGift'?g.to===p.id:g.to===p.id||g.from===p.id,'无权操作此赠送',403);closeGift(s,g,c.type==='acceptGift');return true;}
 return false;
}
