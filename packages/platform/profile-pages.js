import {ensure} from './errors.js';
import {boundedText} from './validation.js';
import {ownProfile,publicProfile,profileDetails} from './profiles.js';
import {cosmetics} from './economy.js';

/** Profile presentation is derived from records and owned cosmetics, never live game state. */
export class ProfilePageService{
  constructor(store,registry,social){this.store=store;this.registry=registry;this.social=social;}
  get(user,id=user.id){
    const data=this.store.data,p=data.profiles[id],owner=id===user.id;
    ensure(p&&(owner||this.social.accepted(data,user.id,id)),'资料不存在，或尚未成为好友',404);
    const details=profileDetails(p);
    ensure(owner||details.visibility==='friends','这位玩家的资料仅本人可见',403);
    const all=Object.values(data.matches).filter(m=>m.participants.some(row=>row.id===id&&!row.isBot));
    const own=m=>m.participants.find(row=>row.id===id);
    const complete=all.filter(m=>!own(m).left),wins=complete.filter(m=>own(m).won).length;
    const perGame=this.registry.list().map(game=>{
      const rows=complete.filter(m=>m.gameId===game.id),scores=rows.map(m=>own(m).score),direction=rows[0]?.scoreDirection??'higher';
      return {id:game.id,title:game.title,played:rows.length,wins:rows.filter(m=>own(m).won).length,practice:rows.filter(m=>m.practice).length,bestScore:scores.length?(direction==='lower'?Math.min(...scores):Math.max(...scores)):null,scoreDirection:direction};
    });
    const friendCount=Object.values(data.friendships).filter(f=>f.status==='accepted'&&(f.a===id||f.b===id)).length;
    const badges=[
      ['arrival','月下旅人','compass','建立自己的旅人身份',1,1],
      ['first-match','初试身手','dice','完成第一场对局，包含 AI 练习',complete.length,1],
      ['first-win','首胜之光','crown','赢得第一场对局，包含 AI 练习',wins,1],
      ['regular','常驻同桌','room','完成 10 场对局，包含 AI 练习',complete.length,10],
      ['collector','月辉收藏家','bag','拥有 6 件藏品，包含初始藏品',p.inventory.length,6],
      ['companion','同桌之谊','people','与 3 位玩家成为好友',friendCount,3],
    ].map(([id,name,icon,description,current,target])=>({id,name,icon,description,current:Math.min(current,target),target,earned:current>=target}));
    const recent=[...all].sort((a,b)=>(b.endedAt??b.recordedAt)-(a.endedAt??a.recordedAt)||b.id.localeCompare(a.id)).slice(0,4).map(m=>({id:m.id,gameId:m.gameId,gameTitle:m.gameTitle,endedAt:m.endedAt,practice:m.practice,scoreDirection:m.scoreDirection,rank:own(m).rank,score:own(m).score,won:own(m).won,left:own(m).left}));
    return {owner,profile:owner?ownProfile(data,id):{...publicProfile(p),details:structuredClone(details)},status:this.social.person(id)?.status??'offline',summary:{played:complete.length,wins,practice:complete.filter(m=>m.practice).length,perGame},badges,recent,friendCount,collectionCount:p.inventory.length,friends:owner?this.social.list(user).friends.slice(0,6):[]};
  }
  update(user,input){
    const name=boundedText(input.name,24);
    ensure(typeof input.bio==='string'&&input.bio.length<=160,'个人简介最多 160 个字符');
    const bio=input.bio.replace(/\r\n?/g,'\n').trim();
    ensure(!/[\x00-\x08\x0b-\x1f\x7f]/.test(bio),'个人简介包含无效字符');
    ensure(typeof input.favoriteGame==='string'&&(!input.favoriteGame||this.registry.list().some(game=>game.id===input.favoriteGame)),'请选择已上线的桌游');
    ensure(['friends','private'].includes(input.visibility),'资料可见范围无效');
    ensure(Array.isArray(input.showcase)&&input.showcase.length<=4&&new Set(input.showcase).size===input.showcase.length,'最多展示 4 件不同的藏品');
    ensure(input.appearance&&typeof input.appearance==='object'&&!Array.isArray(input.appearance),'外观选择无效');
    this.store.transaction(data=>{
      const p=data.profiles[user.id];ensure(p.revision===input.revision,'资料或藏品已更新，请重新打开编辑',409);
      for(const type of ['avatar','banner','title']){
        const item=cosmetics.find(item=>item.id===input.appearance[type]&&item.type===type);
        ensure(item&&p.inventory.includes(item.id),'只能装备已拥有的外观',403);
      }
      for(const id of input.showcase)ensure(p.inventory.includes(id)&&cosmetics.some(item=>item.id===id),'只能展示已拥有的藏品',403);
      p.name=name;p.equipped={avatar:input.appearance.avatar,banner:input.appearance.banner,title:input.appearance.title};
      p.details={bio,favoriteGame:input.favoriteGame,visibility:input.visibility,showcase:[...input.showcase]};p.revision++;
    });
    return this.get(user);
  }
}
