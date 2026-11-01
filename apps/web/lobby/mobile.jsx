import React,{useDeferredValue,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChevronRight,Clock,DoorOpen,Gamepad2,Heart,Megaphone,Search,SlidersHorizontal,UserPlus,Users,X} from 'lucide-react';

const categories=['推荐','策略烧脑','欢乐聚会','剧情沉浸','双人','多人'];
const featured=['the-gang','cabo','marrakech','seven-wonders'];
const Button=({action,children,...props})=><button type="button" data-action={action} {...props}>{children}</button>;
export function MobileWelcome({currentRoomId}){return <div className="mobile-welcome">
 <section className="mobile-hero" aria-label="开局入口"><h1>和好友一起<br/>探索<span>桌游的乐趣</span></h1><p>发现好游戏 · 组局开玩 · 认识同好</p>
 <div className="mobile-hero-actions"><Button action={currentRoomId?"my-room":"open-create"} className="mobile-gold">{currentRoomId?<DoorOpen/>:<UserPlus/>}{currentRoomId?"回到房间":"创建房间"}<ArrowRight/></Button><Button action="focus-join"><Users/>加入房间<ArrowRight/></Button></div></section>
 <Button action="help" className="mobile-guide"><Megaphone/><span>新玩家指南：3 分钟了解如何开始</span><ChevronRight/></Button>
 </div>;}

export function MobileCatalog({state,store,games}){
 const [category,setCategory]=useState('推荐'),[onlyFavorites,setOnlyFavorites]=useState(false),[onlyAvailable,setOnlyAvailable]=useState(false);
 const [favorites,setFavorites]=useState(()=>{try{const value=JSON.parse(localStorage.getItem('moon-table:favorites')??'[]');return Array.isArray(value)?value.filter(id=>typeof id==='string'):[];}catch{return [];}});
 const dialog=useRef(null),tabs=useRef(null),query=useDeferredValue(state.query);
 const cards=useMemo(()=>games.filter(game=>{
  const [min,max]=game.players.split('–').map(Number);
  return game.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(!onlyFavorites||favorites.includes(game.id))&&(!onlyAvailable||game.available)&&
   (category==='推荐'||category==='策略烧脑'&&game.category==='策略对战'&&game.id!=='dnd'||category==='欢乐聚会'&&['聚会推理','卡牌游戏','家庭休闲'].includes(game.category)||category==='剧情沉浸'&&game.id==='dnd'||category==='双人'&&min<=2&&max>=2||category==='多人'&&max>=3);
 }).sort((a,b)=>{
  const rank=game=>featured.includes(game.id)?featured.indexOf(game.id):game.available?10:20;
  return Number(b.hot===true)-Number(a.hot===true)||rank(a)-rank(b);
 }),[games,query,category,onlyFavorites,onlyAvailable,favorites]);
 function favorite(id){setFavorites(previous=>{const next=previous.includes(id)?previous.filter(value=>value!==id):[...previous,id];try{localStorage.setItem('moon-table:favorites',JSON.stringify(next));}catch{}return next;});}
 return <section className="mobile-catalog" aria-label="游戏目录">
  <div className="mobile-catalog-heading"><h2><Gamepad2/>今天玩什么</h2><label className="mobile-game-search"><Search/><input id="mobile-game-search" type="search" aria-label="搜索游戏" placeholder="搜索游戏" value={state.query} onChange={event=>store.patch({query:event.target.value,page:0})}/></label><button className="mobile-filter" aria-label="筛选游戏" aria-haspopup="dialog" aria-pressed={onlyFavorites||onlyAvailable} onClick={()=>dialog.current.showModal()}><SlidersHorizontal/></button></div>
  <div className="mobile-categories"><div ref={tabs} className="mobile-category-track" role="group" aria-label="游戏分类">{categories.map(label=><button key={label} aria-pressed={category===label} onClick={()=>setCategory(label)}>{label}</button>)}</div><button className="mobile-category-next" aria-label="更多分类" onClick={()=>tabs.current.scrollBy({left:150,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})}><ChevronRight/></button></div>
  <div className="mobile-game-grid" aria-busy={query!==state.query}>{cards.map(game=>{
   const room=state.rooms.find(room=>room.gameId===game.id&&room.status==='lobby'&&room.count<room.maxPlayers);
   const saved=favorites.includes(game.id);
   return <article key={game.id} className="mobile-game-card">
    <div className={`mobile-game-art game-cover ${game.coverClass??''}`} aria-hidden="true" dangerouslySetInnerHTML={{__html:game.artHtml??''}}/>
    <button className="mobile-favorite" aria-label={`${saved?'取消收藏':'收藏'} ${game.title}`} aria-pressed={saved} onClick={()=>favorite(game.id)}><Heart fill={saved?'currentColor':'none'}/></button>
    <div className="mobile-game-copy"><h3>{game.title}</h3><div className="mobile-game-facts"><span><Users/>{game.players} 人</span><span><Clock/>{game.duration} 分钟</span></div><div className="mobile-game-tags">{game.tags.split(' · ').slice(0,3).map(tag=><span key={tag}>{tag}</span>)}</div>
    {game.available?<Button action={room?'join-public':'open-create'} data-room-id={room?.id} data-game-id={game.id} className="mobile-gold" aria-label={`${room?'加入':'创建'} ${game.title} 房间`}>快速加入<ArrowRight/></Button>:<button disabled className="mobile-unavailable">即将上线</button>}</div>
   </article>;
  })}</div>
  {!cards.length&&<div className="mobile-no-results"><Search/><p>没有找到相关游戏</p><button onClick={()=>{setCategory('推荐');setOnlyFavorites(false);setOnlyAvailable(false);store.patch({query:''});}}>查看全部游戏</button></div>}
  <dialog ref={dialog} className="mobile-filter-dialog" aria-labelledby="mobile-filter-title"><div><h2 id="mobile-filter-title">筛选游戏</h2><button aria-label="关闭筛选" onClick={()=>dialog.current.close()}><X/></button></div><label><span>只看已收藏</span><input type="checkbox" checked={onlyFavorites} onChange={event=>setOnlyFavorites(event.target.checked)}/></label><label><span>只看已上线</span><input type="checkbox" checked={onlyAvailable} onChange={event=>setOnlyAvailable(event.target.checked)}/></label><button className="mobile-gold" onClick={()=>dialog.current.close()}>查看 {cards.length} 款游戏</button></dialog>
 </section>;
}
