import {ensure} from './errors.js';

export const defaultSettings={
 githubUrl:'',authorName:'ZyFan',authorUrl:'https://zyfan.zone/',copyright:'© 2026 Moon Table. All rights reserved.',
 siteName:'Moon Table',announcement:'',registrationEnabled:true,guestAccessEnabled:true,
 roomCreationEnabled:true,shopEnabled:true,forumPostingEnabled:true,
 gameAvailability:{},gameHot:{},
 welcomeCredits:300,practiceWinCredits:30,practiceLossCredits:20,multiplayerWinCredits:70,multiplayerLossCredits:40,
};
export const systemSettings=data=>({...defaultSettings,...data.system?.settings,gameAvailability:{...data.system?.settings?.gameAvailability},gameHot:{...data.system?.settings?.gameHot}});
export const gameEnabled=(data,id)=>data.system?.settings?.gameAvailability?.[id]!==false;
export const gameHot=(data,id)=>data.system?.settings?.gameHot?.[id]===true;
export function validateSettings(input,registry,current=defaultSettings){
 ensure(input&&typeof input==='object'&&!Array.isArray(input),'系统设置无效');
 input={...input,gameAvailability:Object.hasOwn(input,'gameAvailability')?input.gameAvailability:current.gameAvailability??{},gameHot:Object.hasOwn(input,'gameHot')?input.gameHot:current.gameHot??{}};
 ensure(Object.keys(input).length===Object.keys(defaultSettings).length&&Object.keys(input).every(k=>Object.hasOwn(defaultSettings,k)),'系统设置字段无效');
 const out={};
 for(const [key,fallback]of Object.entries(defaultSettings)){
  const value=input[key];
  if(key==='gameAvailability'||key==='gameHot'){
   ensure(value&&typeof value==='object'&&!Array.isArray(value),'游戏上线设置无效');
   ensure(Object.entries(value).every(([id,on])=>/^[a-z0-9-]{1,64}$/.test(id)&&typeof on==='boolean'&&(registry?registry.list().some(g=>g.id===id):Object.hasOwn(current[key]??{},id))),'游戏标识或开关无效');
   out[key]={...value};continue;
  }
  if(typeof fallback==='boolean')ensure(typeof value==='boolean','开关设置必须为布尔值');
  else if(typeof fallback==='number')ensure(Number.isSafeInteger(value)&&value>=0&&value<=100000,'发放星辉需为 0–100000 的整数');
  else ensure(typeof value==='string'&&value.trim().length<=(key==='siteName'?32:300)&&(key!=='siteName'||value.trim().length>0),'站点名称或公告长度无效');
  if(['githubUrl','authorUrl'].includes(key)&&value.trim()){let url;try{url=new URL(value.trim());}catch{}ensure(url&&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password,'页脚链接需为完整的 HTTP 或 HTTPS 地址');}
  out[key]=typeof value==='string'?value.trim():value;
 }
 return out;
}
export function publicSystem(data){const s=systemSettings(data);return {githubUrl:s.githubUrl,authorName:s.authorName,authorUrl:s.authorUrl,copyright:s.copyright,siteName:s.siteName,announcement:s.announcement,registrationEnabled:s.registrationEnabled,guestAccessEnabled:s.guestAccessEnabled,roomCreationEnabled:s.roomCreationEnabled,shopEnabled:s.shopEnabled,forumPostingEnabled:s.forumPostingEnabled,welcomeCredits:s.welcomeCredits,gameAvailability:s.gameAvailability,gameHot:s.gameHot};}
