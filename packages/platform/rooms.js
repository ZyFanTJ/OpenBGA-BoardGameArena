import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ensure } from './errors.js';
import { boundedText } from './validation.js';
import {archiveMatch} from './records.js';
import {systemSettings} from './system.js';
import {validateTurnSeconds,syncTurnClock,turnWindow,turnView} from './turns.js';

const secureRandom = () => randomInt(0, 0x100000000) / 0x100000000;
const firstFreeSeat=(players,max)=>Array.from({length:max},(_,i)=>i).find(seat=>!players.some(p=>p.seat===seat));
const orderSeats=players=>players.sort((a,b)=>a.seat-b.seat);
export class RoomService {
  constructor(store, registry, { random = secureRandom, notify = () => {}, now = () => Date.now() } = {}) {
    this.now = now; this.store = store; this.registry = registry; this.random = random; this.notify = notify;
  }
  room(id, data = this.store.data) {
    const room = data.rooms[id]; ensure(room, '房间不存在', 404); return room;
  }
  member(room, user, bot = false) { ensure(room.players.some(p => p.id === user.id && !!p.isBot === bot), '你不在此房间', 403); }
  currentRoom(user) { return Object.values(this.store.data.rooms).find(r => r.players.some(p => p.id === user.id && !p.isBot)); }
  directory() {
    return Object.values(this.store.data.rooms).filter(r => r.visibility === 'public').map(r => ({
      id: r.id, title: r.title, gameId: r.gameId, status: r.status, count: r.players.length,
      maxPlayers: this.registry.get(r.gameId).manifest.maxPlayers,
      host: this.store.data.profiles[r.hostId]?.name ?? r.players.find(p => p.id === r.hostId)?.name ?? '房主',
    }));
  }
  createRoom(user, input) {
    ensure(!this.currentRoom(user), '请先离开当前房间');
    const game = this.registry.get(input.gameId);
    let code;
    do { code = randomBytes(4).toString('hex').toUpperCase(); } while (this.store.data.rooms[code]);
    const room = { id: code, title: boundedText(input.title, 40), gameId: game.manifest.id,
      stateVersion: game.manifest.stateVersion, options: input.options ?? {}, hostId: user.id,
      players: [{ id: user.id, name: user.name, ready: false, seat: 0 }], status: 'lobby', revision: 0,
      game: null, chat: [], turnSeconds:validateTurnSeconds(input.turnSeconds??(game.turn&&game.timeout?60:0),game),turnClock:null,lastTimeout:null,createdAt: this.now(), visibility: input.visibility === 'public' ? 'public' : 'private' };
    // Validate options through the game before storing a room.
    game.create(Array.from({ length: game.manifest.minPlayers }, (_, i) => String(i)), room.options, this.random);
    this.store.transaction(data => { ensure(systemSettings(data).roomCreationEnabled,'新建房间暂时关闭，已有房间可继续游戏',403);data.rooms[code] = room; });
    return this.snapshot(code, user);
  }
  join(user, id, {revision,authorize=()=>{}} = {}) {
    const current = this.currentRoom(user);
    ensure(!current || current.id === id, '请先离开当前房间');
    this.store.transaction(data => {
      const r = this.room(id, data);
      if(revision!==undefined)ensure(r.revision===revision,'房间已更新，请重试',409);
      authorize(data,r);
      if (r.players.some(p => p.id === user.id && !p.isBot)) return;
      ensure(r.status === 'lobby', '此房间已经开始游戏');
      ensure(r.players.length < this.registry.get(r.gameId).manifest.maxPlayers, '房间已满');
      r.players.push({ id: user.id, name: user.name, ready: false, seat: firstFreeSeat(r.players,this.registry.get(r.gameId).manifest.maxPlayers) });
      orderSeats(r.players); r.revision++;
    });
    this.notify(id); return this.snapshot(id, user);
  }
  mutate(user, id, input, { bot = false } = {}) {
    let transition;
    this.store.transaction(data => {
      const r = this.room(id, data); this.member(r, user, bot);
      ensure(!bot || input.type === 'game', 'AI 只能执行游戏行动', 403);
      ensure(Number.isInteger(input.revision) && input.revision === r.revision, '房间已更新，请按最新状态重试', 409);
      const game = this.registry.get(r.gameId);
      ensure(r.stateVersion === game.manifest.stateVersion, '存档版本不匹配，需要迁移', 409);
      switch (input.type) {
        case 'updateOptions': {
          ensure(r.hostId===user.id&&r.status==='lobby','只有房主可以在等待开局时修改规则',403);
          ensure(input.options&&typeof input.options==='object'&&!Array.isArray(input.options),'规则选项无效');
          // Validation stays with the selected game, inside the revision-checked transaction.
          game.create(Array.from({length:Math.max(game.manifest.minPlayers,r.players.length)},(_,i)=>String(i)),input.options,this.random);
          r.options=structuredClone(input.options);
          r.turnSeconds=validateTurnSeconds(input.turnSeconds??r.turnSeconds??0,game);
          r.players.forEach(player=>{player.ready=!!player.isBot;});
          break;
        }
        case 'addBot': {
          ensure(r.hostId === user.id && r.status === 'lobby', '只有房主可以在等待房间添加 AI', 403);
          ensure(game.bot, '此游戏尚不支持 AI');
          ensure(r.players.length < game.manifest.maxPlayers, '房间已满');
          const seat=input.seat===undefined?firstFreeSeat(r.players,game.manifest.maxPlayers):input.seat;
          ensure(Number.isInteger(seat)&&seat>=0&&seat<game.manifest.maxPlayers,'座位编号无效');
          ensure(!r.players.some(p=>p.seat===seat),'这个座位已有人，请刷新重试',409);
          let number = 1;
          while (r.players.some(p => p.name === `AI ${number}`)) number++;
          r.players.push({ id: randomUUID(), name: `AI ${number}`, ready: true, isBot: true, seat });
          orderSeats(r.players);
          break;
        }
        case 'removeBot':
          ensure(r.hostId === user.id && r.status === 'lobby', '只有房主可以在等待房间移除 AI', 403);
          ensure(r.players.some(p => p.id === input.playerId && p.isBot), '目标不是 AI 玩家');
          r.players = r.players.filter(p => p.id !== input.playerId); break;
        case 'ready':
          ensure(r.status === 'lobby', '游戏已经开始');
          ensure(typeof input.ready === 'boolean', '准备状态无效');
          r.players.find(p => p.id === user.id).ready = input.ready; break;
        case 'start':
          ensure(r.hostId === user.id && r.status === 'lobby', '只有房主可以开始游戏', 403);
          ensure(r.players.length >= game.manifest.minPlayers && r.players.every(p => p.ready), '需要足够玩家且所有玩家都准备好');
          transition = { before: null, actorId: user.id, command: { type: 'start' } };
          r.game = game.create(r.players.map(p => p.id), r.options, this.random); r.status = 'playing';r.matchId=randomUUID();r.startedAt=this.now();r.lastTimeout=null; break;
        case 'game':
          ensure(r.status === 'playing', '对局尚未开始或已经结束');
          ensure(!r.dissolution, '解散投票中，请先完成投票', 409);
          ensure(bot||!r.turnClock||this.now()<r.turnClock.deadlineAt,'操作已超时，系统正在完成本轮',409);
          transition = { before: r.game, actorId: user.id, command: input.command };
          r.game = game.apply(r.game, user.id, input.command, { random: this.random, isHost: r.hostId === user.id });
          if (game.isFinished(r.game)){r.status = 'finished';archiveMatch(data,r,game);} break;
        case 'rematch':
          ensure(r.hostId === user.id && r.status === 'finished', '只有房主可以在终局后再开一局');
          r.status = 'lobby'; r.game = null; r.players = r.players.filter(p => !p.departed);
          r.players.forEach(p => { p.ready = !!p.isBot; }); break;
        case 'requestDissolve':
          ensure(r.hostId === user.id && r.status === 'playing', '只有房主可以发起中途解散', 403);
          ensure(!r.dissolution, '已有解散投票正在进行', 409);
          r.dissolution = { id: randomUUID(), requestedBy: user.id, votes: [user.id], at: this.now() }; break;
        case 'voteDissolve':
          ensure(r.dissolution && input.voteId === r.dissolution.id, '此解散投票已结束', 409);
          ensure(typeof input.agree === 'boolean', '投票内容无效');
          ensure(!r.dissolution.votes.includes(user.id), '你已经投过票', 409);
          if (!input.agree) delete r.dissolution;
          else r.dissolution.votes.push(user.id);
          break;
        case 'leave':
          if (r.status === 'playing' && game.bot) {
            const seat = r.players.find(p => p.id === user.id);
            seat.isBot = true; seat.departed = true; seat.name += ' · AI';
          } else {
            r.players = r.players.filter(p => p.id !== user.id);
            // Games without an AI adapter safely return remaining members to the lobby.
            if (r.status === 'playing') { r.status = 'lobby'; r.game = null; delete r.dissolution; r.players.forEach(p => { p.ready = !!p.isBot; }); }
          }
          if (!r.players.some(p => !p.isBot)) { delete data.rooms[id]; return; }
          if (r.hostId === user.id) r.hostId = r.players.find(p => !p.isBot).id;
          break;
        default: ensure(false, '未知房间行动');
      }
      if (r.dissolution && r.players.filter(p => !p.isBot).every(p => r.dissolution.votes.includes(p.id))) {
        delete data.rooms[id]; return;
      }
      syncTurnClock(r,game,this.now());
      r.revision++;
    });
    this.notify(id, transition);
    return input.type === 'leave' || !this.store.data.rooms[id] ? { left: true, reason: input.type === 'leave' ? 'left' : 'dissolved' } : this.snapshot(id, user, transition, bot);
  }
  expireTurn(id,{revision,key,deadlineAt}) {
    let changed=false;
    this.store.transaction(data=>{
      const room=data.rooms[id],clock=room?.turnClock;
      if(!room||room.status!=='playing'||room.revision!==revision||room.dissolution||!clock||clock.key!==key||clock.deadlineAt!==deadlineAt||this.now()<deadlineAt)return;
      const game=this.registry.get(room.gameId);
      ensure(room.stateVersion===game.manifest.stateVersion,'存档版本不匹配，需要迁移',409);
      const timedOut=[];
      for(let step=0;step<32;step++){
        const window=turnWindow(room,game);
        if(!window||window.key!==key)break;
        const actor=room.players.find(p=>!p.isBot&&window.players.includes(p.id));
        if(!actor)break;
        const command=game.timeout(game.view(room.game,actor.id),actor.id);
        ensure(command,'游戏缺少有效超时行动');
        room.game=game.apply(room.game,actor.id,command,{random:this.random,isHost:room.hostId===actor.id});
        if(!timedOut.includes(actor.id))timedOut.push(actor.id);
        if(game.isFinished(room.game)){room.status='finished';archiveMatch(data,room,game);break;}
        if(step===31)ensure(turnWindow(room,game)?.key!==key,'超时行动未能完成');
      }
      ensure(timedOut.length,'没有需要处理的超时操作');
      room.lastTimeout={revision:revision+1,playerIds:timedOut,at:this.now()};
      syncTurnClock(room,game,this.now());room.revision++;changed=true;
    });
    if(changed)this.notify(id);
    return changed;
  }
  snapshot(id, user, transition, bot = false) {
    const r = this.room(id); this.member(r, user, bot);
    const game = this.registry.get(r.gameId);
    return { id: r.id, matchId: r.matchId ?? null, title: r.title, gameId: r.gameId, options: r.options, hostId: r.hostId,
      players: r.players.map(p=>({...p,...(!p.isBot&&this.store.data.profiles[p.id]?{name:this.store.data.profiles[p.id].name,appearance:{...this.store.data.profiles[p.id].equipped}}: {})})), status: r.status, revision: r.revision, chat: r.chat,
      dissolution: r.dissolution ?? null, visibility: r.visibility ?? 'private',
      maxPlayers: game.manifest.maxPlayers,
      supportsBots: !!game.bot,turnSeconds:r.turnSeconds??0,turn:turnView(r,game,user.id,this.now()),
      game: r.game ? game.view(r.game, user.id, transition) : null };
  }
}
