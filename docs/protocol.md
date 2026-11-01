# API 与存储协议

房间 HTTP 响应及 SSE 快照中的 `players[]` 为真人玩家附带公开的已装备称号 `title: {id,name,rarity} | null`，与 `appearance.title` 同源，供游戏内昵称前的品质徽章使用。机器人不带称号。此字段由当前资料生成，不写入游戏状态或暴露背包、余额等私有资料。

## AI 冒险命令

`dnd` 沿用 `/api/rooms/:id/actions`，房间层输入 `{type:'game',revision,command}`。游戏命令包括 `{type:'character',archetype,name,note?}`、`{type:'choose',choiceId}`、`{type:'act',text}`、`{type:'roll'}` 和 `{type:'cancelCheck'}`；合法行动 ID 只取自该玩家当前 `game.choices`。角色名至多 24 字、私密背景 240 字、自由行动 600 字。等待 DM 期间禁止新的游戏行动。

选择带骰子的行动后持久化 `pendingCheck`，仅当前玩家可以投骰或取消；确认前不取随机数、不扣资源。公开 `pendingCheck` 包含 id、playerId 与服务器计算的判定说明，`lastCheck` 包含最近已提交的结果。所有命令仍同事务校验 revision；重复投骰不能产生第二个结果。`world` 是经过探索权限过滤的地图、目标和实体状态视图。DND 状态 v2 通过纯迁移为 v1 补充 `pendingCheck / lastCheck`，其余原状态保留。

`game.pending` 对客户端只公开当前是意图理解还是叙述，不发送 effect ID、系统提示或请求上下文。模型结果使用服务器内部 `RoomService.completeEffect`，HTTP 不开放同名命令，也不接受客户端指定的模型、密钥、骰点、HP 或结局。模型回复落库后以原有玩家专属快照推送。`dmStatus` 区分 `pending / ai / local / fallback`。规则版本、来源和限制见 [跑团方案](dnd-plan.md)。

同源 JSON HTTP。身份来自 `moon_session` HttpOnly Cookie，所有房间操作校验成员。服务端默认绑定 `127.0.0.1:3000`。

| 方法 | 路径 | 输入/用途 |
| --- | --- | --- |
| GET | `/api/games` | 已注册游戏 manifest 与 `enabled`；大厅和创建选项筛选已上线项，保留元信息供既有房间使用 |
| POST | `/api/session` | `{ name }` 创建匿名玩家，设置 Cookie |
| GET | `/api/me` | 当前玩家与当前房间 ID |
| GET | `/api/health` | 健康状态与程序版本，无需会话 |
| POST | `/api/auth/register` | `{handle,password,name}`；有游客会话时绑定原身份 |
| POST | `/api/auth/login` | `{handle,password}`，设置会话 Cookie |
| POST | `/api/auth/logout` | 注销当前会话 |
| GET / POST | `/api/account` | 读取资料 / `{name,revision}` 修改昵称 |
| GET | `/api/hub` | 资料、待处理数、好友与邀请摘要 |
| GET | `/api/friends` | 好友、申请、有效邀请、自己当前房间 |
| GET | `/api/friends/search?q=` | 好友码精确匹配 / 账号前缀搜索 |
| POST | `/api/friends/request` | `{playerId}` 申请好友 |
| POST | `/api/friends/respond` | `{requestId,action}`；action 为 accept 或 reject |
| POST | `/api/friends/remove` | `{playerId}` 移除好友 / 撤回申请 |
| POST | `/api/friends/invite` | `{playerId,roomId,revision}` |
| POST | `/api/invitations/accept` | `{invitationId,roomRevision}`；同事务验证邀请并加入 |
| POST | `/api/invitations/dismiss` | `{invitationId}` |
| GET | `/api/history` | `game,outcome,mode,cursor,limit` 筛选自己参与的终局摘要 |
| GET | `/api/history/:id` | 自己参与的一场战报 |
| GET | `/api/shop` | 服务端外观目录与自己的库存、余额、装备 |
| POST | `/api/shop/purchase` | `{itemId,revision,requestId}`，幂等兑换 |
| POST | `/api/shop/equip` | `{itemId,revision}`，仅允许装备已拥有藏品 |
| GET | `/api/profile` | 自己的资料、真实统计、徽章和展位 |
| POST | `/api/profile` | `{revision,name,bio,favoriteGame,visibility,showcase,appearance}`；事务内校验版本与所有权 |
| GET | `/api/profiles/:id` | 仅已接受好友且资料对好友可见；不含钱包、账号、完整库存或他人战报 |
| GET | `/api/wallet` | 自己的余额及最近 30 条收支 |
| POST | `/api/rooms` | `{ title, gameId, options, visibility? }` |
| GET | `/api/lobby` | 公开房间目录摘要 |
| POST | `/api/rooms/:code/join` | `{}` 加入，已在房间时幂等 |
| GET | `/api/rooms/:code` | 该玩家可见的完整快照 |
| GET | `/api/rooms/:code/events` | SSE，连接建立即发送完整快照 |
| POST | `/api/rooms/:code/actions` | `{ revision, type, ...payload }` |
| POST | `/api/rooms/:code/chat` | `{ text }` |

平台 actions 为 `ready`（附 `ready: boolean`）、`start`、`leave`、`rematch`、`addBot`（可附 `seat: integer`，从 0 开始）、`removeBot`（附 `playerId`）、`requestDissolve`、`voteDissolve`（附 `voteId, agree`）、`game`（附 `command`）。只有 `game.command` 是游戏自己的协议。房间 revision 与游戏状态放在一次事务中更新，聊天独立于 revision。

`addBot` / `removeBot` 仅允许房主在等待阶段操作；同样必须携带当前 revision，添加受房间人数上限和游戏是否提供 AI 策略限制。点击空位时必须传该空位的 `seat`；省略时仅为练习模式和旧客户端兼容，分配最小空位。目标需在游戏座位上限内且为空，否则拒绝，不能覆盖或挤动他人。名册的 `seat` 为固定的 0 起始编号，名册数组始终按它排序；移除和离开保留空位，真人加入填最小空位，开局按该顺序创建游戏玩家环。房间快照的 `supportsBots` 表示可用能力，名册中 `isBot: true` 标记自动玩家；旧名册缺少此字段时视为真人。AI 无会话 Cookie，客户端不能指定 AI 身份提交行动。

错误格式 `{ error: string }`。常用状态：400 非法输入/行动，401 无会话，403 无权限，404 不存在，409 旧版本/存档版本不匹配，413 请求过大，415 非 JSON，429 操作过快。

SSE 常规 `data` 是该玩家完整快照，不是可以向所有成员复用的公共载荷。每 20 秒注释心跳，重连延迟 1.5 秒；最多同房间同身份 5 个连接。客户端不能提交玩家 ID 冒充行动者。

房间快照的 `matchId` 是本局的公开不透明标识，首次开局前为 null，每次重新开局会变化。客户端可用它隔离每位玩家的战报已读偏好，不用房间码推断同一房间中的不同对局。它不会授权任何房间操作。

七大奇迹玩家投影增加 `actionStatus: "waiting" | "confirmed" | "inactive"`，覆盖选面、选将、招募、时代选牌、探索、回收、文明能力与海战决策。只公开是否需要操作、是否已确认，不公开他人的选择内容、备选牌或私密命令。时代战报读取原有 `ageResults` 的公开陆战、海战记录；阅读和关闭战报不发送游戏命令，也不构成新的结算阶段。

游戏 `view` 可接收可选的本次 transition 上下文（旧状态、行动者、已验证命令），由游戏自己生成可公开的动作提示。CABO 的 `game.motion` 只含动作类型、行动者、牌堆来源和公开操作牌位，不含牌面值、牌库顺序或永久卡牌 ID；卡面一律来自玩家专属视图。HTTP 行动响应和该次 SSE 推送携带相同 revision 的提示，客户端只播放一次。GET、初始 SSE、聊天推送与重连的 `motion` 为 null。提示不写入存档，不增加权威游戏状态字段，CABO stateVersion 仍为 1。

存档 root 当前版本为 3，包含会话摘要、房间、资料、账号、好友关系、邀请、战报与收支索引。自动执行 v1 → v2 → v3 迁移，按来源版本保留 `.v1.bak` / `.v2.bak`；v3 增加个人资料详情与展位；每个房间的游戏 `stateVersion` 不变。未知 root 版本拒绝启动；新增游戏状态版本仍需单独提供显式迁移。账号、好友与商城数据边界见 [功能说明](hub.md)。

## 退出、解散与公开大厅

- `leave` 允许进行中退出。支持 AI 的游戏保留原座位 ID 与游戏状态，将该房间名册项标为 `isBot: true, departed: true`。原会话立即失去该房间的读取、行动和聊天权限，可加入其他房间，不能接管已经交给 AI 的本局座位。AI 只使用此座位的 `view`，不继承浏览器记忆。
- 房主退出时移交给首位仍在房间的真人；最后一位真人离开时关闭房间。无 AI 插件的游戏退出时清空本局并让其余玩家返回准备状态；前端事先提示这一结果。
- `requestDissolve` 仅当前房主可在 `playing` 状态发起，发起即投同意票。`voteDissolve` 输入为 `{ voteId, agree: boolean }`；只能投一次，必须同时匹配当前 revision 和投票 ID。任一真人拒绝则取消申请，全体在房真人同意才删除房间。AI 默认同意，不占投票人数。
- 投票期间暂停规则行动和 AI 定时器，聊天仍可用。断线不算同意，重连恢复待投票状态；不会超时自动通过。中途退出者不再属于投票成员，剩余成员仍需全票同意。
- 房间新增可选 `dissolution` 元数据；不存在表示没有投票。它与名册、revision 同事务持久化，游戏自身状态未改形，CABO stateVersion 仍为 1。
- 退出/解散后，相关 SSE 连接收到 `{ id, left: true, reason: 'left' | 'dissolved' }` 后关闭。行动者 HTTP 返回 `{ left: true, reason }`。所有打开的客户端回到大厅；普通快照仍只含接收者专属游戏视图。
- `POST /api/rooms` 可传 `visibility: 'public' | 'private'`。未传及旧存档默认 private。大厅创建弹窗明确提供公开选项，AI 快速练习默认 private。
- `GET /api/lobby` 无需会话，返回 `{ rooms }`，仅列公开房间的 `id, title, gameId, status, count, maxPlayers, host`，不含聊天、会话或游戏状态。大厅人数为公开房间当前座位数（含 AI），不伪造全站在线人数。筛选与搜索在客户端处理，加入权限最终仍由服务端校验。

### 房间规则编辑

等待开局时房主发送 `{type:"updateOptions", revision, options}`。游戏模块验证选项，成功后保存整组选项并将真人 `ready` 清零，AI 保持准备。非法选项、非房主、对局已开始或旧 revision 都不写入。SSE 向每个成员推送更新后的房间摘要。`options` 的字段归对应游戏所有。

游戏契约可提供 `migrate(state, fromVersion)`。服务启动时在恢复 AI、生成视图及回填记录前通过注册表迁移旧游戏状态，同事务更新 stateVersion 与 revision，平台不解释游戏字段。

平台存储 v4 在 v3 基础上给房间名册补充 `seat`，按原名册顺序分配，房间 revision 增加 1。迁移不改游戏内部状态或游戏状态版本，原存档以 `.v3.bak` 一次性备份。

## 异步叙述的临时呈现

新客户端连接 `GET /api/rooms/:id/events?protocol=2`。初次连接、重连、规则/名册变化和游戏提交仍返回完整玩家专属快照；未声明协议的旧客户端沿用完整快照推送。

- 聊天更新为 `{type:"chat",id,revision,message}`，只含新增的一条消息，不附带游戏或重复历史，不调度机器人/计时器/效果。
- 流式展示更新为 `{type:"presentation",id,matchId,revision,presentationRevision,game}`；`game` 为游戏可选 `presentation(state,viewerId,{effectProgress})` 生成的视图片段。DND 的该投影与完整 `view` 共用字段过滤，不公开原始模型片段、提示或意图识别内容。未提供该投影的插件兼容完整快照。
- 客户端只合并同房间、同 match、同 revision 的展示片段，拒绝旧序号。遇到未知版本重新读取快照；重连首个快照允许新进程重置展示序号。延迟 HTTP 快照不会覆盖已收到的新聊天或同版本较新的展示进度。
- SSE 写入受阻时不继续计算/堆积每个事件；drain 后补一个最新玩家快照。15 秒未恢复的连接关闭，由 EventSource 重连。多个标签页的同一玩家复用本次广播投影；不同玩家严格隔离。

### 同时提交与客户端请求等待

游戏可以提供纯函数 `submissionKey(state,playerId,command?)`，仅在尚未提交的独立选择窗口返回标识。玩家快照的 `submissionKey` 随状态更新。新客户端的命令附带 `matchId,submissionKey,revision`。

服务器始终在提交事务内检查当前 revision。只有客户端版本落后、matchId 相同、当前游戏明确声明同一独立窗口且命令类型相符时，才基于当前状态继续校验并提交；`apply` 再次校验本人是否已提交、选择是否合法、阶段是否有效。重复、跨局、跨窗口、未来版本、解散中或截止后提交不会因此放行。不携带窗口的旧客户端仍严格要求 revision 相同。七大奇迹独立选面/轮抽/选牌/探索/海战选择、忍者之夜轮抽/亮牌、DND 建角已接入；平台不按游戏 ID 分支。顺序操作与其他房间命令保持原规则。

浏览器请求的连接和响应正文共用 12 秒等待上限。写请求超时按“结果未确认”处理，刷新最新牌桌而不自动重放。正在提交的房间写操作只阻止另一项房间写操作，聊天、菜单、规则查看及导航仍可使用；离开后的旧响应不能重新打开旧房间。

房间快照的 `presentationRevision` 表示临时效果进度，更新时游戏 revision 不变。客户端只更新游戏呈现，不重绘房间壳层。调度器在内存暂存进度，校验 matchId、effectId 和请求指纹，再通过 `view` 第四参数 `{effectProgress}` 让游戏决定投影。DND 只在叙述阶段公开 `narrationStream:{id,text}`，text 最多 1200 字；系统提示、意图识别片段和额外字段不公开。完整结果仍按原事务保存，之后 stream 为 null；片段不改变存档结构或规则状态。

## 玩家论坛

`GET /api/forum` 与 `GET /api/forum/:id` 允许公开浏览；写入使用现有会话 Cookie，作者身份由服务端确定。

| 接口 | 内容 |
| --- | --- |
| `GET /api/forum` | 查询 `category=all/suggestion/game/chat`、`status=all/open/closed`、`sort=activity/newest/popular`、`q`、`page`；每页 20 条，返回 `items,total,page,pages,counts` |
| `POST /api/forum` | `{title,body,category,contact?}` 创建话题，返回详情；标题 80 字，内容 2000 字，联系方式 120 字 |
| `GET /api/forum/:id` | 话题正文、公开联系方式和回复；含当前身份的 `owner,supported`，不含支持者列表、账号或私有资料 |
| `POST /api/forum/:id/replies` | `{body,contact?}` 追加回复；已结束话题返回 409 |
| `POST /api/forum/:id/support` | `{supported:boolean}` 设置当前玩家的支持状态，重复请求幂等 |
| `POST /api/forum/:id/status` | `{status:open/closed,revision}` 仅作者可结束或重新开启；事务内检查最新 revision |

平台存储 v5 从 v4 增加独立的 `forum:{nextNumber,topics}`，保留现有房间、游戏、账户与会话，并将旧文件一次性备份为 `.v4.bak`。论坛写入不改变任何房间 revision 或游戏 stateVersion。页面入口 `#forum`，话题直达链接 `#forum/:id`。

## 管理与系统设置

`GET /api/system` 公开站点名称、公告及功能开放状态；管理接口在 `/api/admin/*`，仅注册且未停用的管理员可用。接口、revision、requestId、审计和 v6 迁移约束见 `docs/administration.md`。用户自己的账号投影提供 `admin` 能力标志，不能从客户端设置该标志获得权限。


## 回合提示与操作时限（0.6.0）

`POST /api/rooms` 可传平台级 `turnSeconds:0|30|60|120|300`，与游戏的 `options` 分开；三个现有游戏新建房间默认为 60。等待区房主的 `updateOptions` 同时支持 `turnSeconds`，在同一 revision 检查事务内更新并重置真人准备状态。省略时限会保留当前设置。

每个成员快照新增 `turnSeconds` 及公开 `turn:{key,seconds,serverNow,required,playerIds,deadlineAt,paused,remainingMs,lastTimeout}`。`required` 仅表示当前查看者是否仍需操作，`playerIds` 为公开待操作玩家 ID；不包含选择内容或他人暗牌。`deadlineAt` 为服务端绝对时间，`remainingMs` 在暂停时冻结；`lastTimeout` 仅含对应房间 revision、玩家 ID 与时间。无决策阶段的 key/deadline 为 null，不限时房间仍返回操作提醒。普通操作、超时自动操作与投票均通过现有快照/SSE 更新。

客户端不能请求强制超时。服务端调度在房间事务内重新验证 revision、窗口、截止时间和投票状态。具体适配器、自动行动和 v7 迁移约定见 `docs/turn-limits.md`。


## 邀请与结算分享

- `GET /api/room-invites/:code` 无需登录，返回房间标题、房主昵称、桌游、人数、状态与 revision；不返回玩家列表、聊天或游戏状态。邀请地址为 `/#invite/:code`，首次访客填写昵称创建现有游客会话后入座。`POST /api/rooms/:code/join` 支持传入 `revision`，在入座事务内校验，过期时返回 409。
- 终局成员可发送 `rematchReady` 房间行动（携带 revision）表达继续意愿，推送的 `rematchVotes` 为已准备继续的玩家 ID。房主仍发送 `rematch` 返回原房间准备区，保留同桌、规则及已表达继续意愿者的准备状态，开始新局前房主需要准备。
- `POST /api/history/:matchId/share` 由该局真人参与者主动开启公开分享；`GET /api/shares/:matchId` 仅对已开启的战绩返回标题、结束时间、轮数和参与者昵称 / 名次 / 分数 / 胜负 / AI 与离席标记。不包含玩家 ID、好友码、奖励、计分明细、聊天或原始游戏状态。地址为 `/#result/:matchId`，未开启分享的记录返回 404。
- 结算图片在浏览器从已归档摘要绘制，支持 PNG 保存与系统文件分享。不支持系统文件分享的浏览器回退为图片下载。只有点击复制战绩链接才开启公开链接；保存图片不改变记录的公开状态。
- 结算同桌好友入口复用 `/api/friends/request` 与 `/api/friends/respond`，游客绑定账号后沿用相同身份和关系。

## 客户端异常恢复与展示

HTTP 客户端会检查完整 JSON 响应，对空白、截断或代理 HTML 错误显示可读提示。写请求响应不确定时仅重新获取当前成员快照，不自动重发命令，避免重复出牌。SSE 在进入渲染器前验证快照结构；异常推送保留最后有效视图，重新同步并建立连接。版本冲突后的同步失败也不会产生未捕获的 Promise 错误。

聊天继续复用房间内的 `chat` 和现有发送接口，不修改游戏 revision。前端快捷发言发送普通文本；新消息在聊天收起时显示限时气泡和未读数量，首次入房和重复推送不重播历史。离开房间时清理气泡与计时器。

七大奇迹在 setup 阶段的成员视图 `setupChoices` 包含每面的公开 `startingResource`、`startingCoins`、`startingEffects` 与 `stages`。确认后保留选面参考信息，仍由服务器拒绝重复选择；开局后清空参考选项。这些字段由规则实时投影，未增加持久状态字段，不需要存档版本迁移。

## 观战与对局类型（2026-10-24）

创建房间的 `allowSpectators` 为可选布尔值，默认 `true`。旧房间缺失该字段时同样允许观战；该字段属于房间元数据，不改变任何游戏存档结构或 stateVersion。

- `GET /api/rooms/:id/watch`：已登录或游客身份读取独立观战投影。允许通过已知房间码观战私人房间，关闭观战时返回 403。
- `GET /api/rooms/:id/watch-events`：相同权限的 SSE 观战流，支持协议 2 心跳。每次推送和心跳重查权限；关闭权限或房间后结束连接。慢连接恢复仍只发送观战投影。
- 房主命令 `{type:'setSpectators',allowSpectators,revision}` 在持久化事务内校验版本与身份，可在对局中开关。关闭后已连接观众立即退出。
- 观众不加入玩家席位、不参与准备与行动、不发言、不计入战绩或在线房间保活。席位专用 GET、聊天和动作接口保持成员校验。观看自己所在房间仍使用公开视角。
- 游戏模块显式提供 `spectatorView`，只公开棋盘、已公开牌面与公开进度；不传暗牌、手牌、私人情报、草稿选择、玩家笔记和牌库。观战界面由各游戏自己的 spectator 模块渲染。
- 房间目录以房间编号去重；创建与加入在事务内复查玩家已有席位。列表不会按玩家生成重复房间。

至少两位原始真人参与（包含后来离席由 AI 接管者）的对局归为真人对局；零或一位真人为 AI 练习。启动时修正旧战绩的 `practice` 分类，筛选与资料页统计随之统一；已发奖励不追溯重算。新完成对局按新的分类发放奖励。观众不计入真人数。

战绩卡片采用游戏封面/场景素材。皇冠对应未离席的第一名（并列时标注并列），本局徽章基于名次、零罚分或最终计分明细领先生成，不代表新解锁的永久藏品；没有记录的数据不会推测为高光。

### 账号与页脚管理

- 游客绑定注册账号时，客户端携带 `guestId`。服务端要求它与有效会话一致，在密码计算后再次检查会话，并在同一事务中保存账号和登录会话。绑定沿用原用户 ID，好友、战绩、资产与收支记录不迁移或重复发放。已经丢失会话的游客不会被静默注册成新身份。
- `POST /api/admin/users/:id/password` 接受 `password`（10–128 字符）、`accessRevision`、`requestId` 及可选 `reason`。仅管理员可为注册账号操作；保存新密码、递增访问版本、撤销全部会话与记录审计在同一事务完成。审计不含密码或密码摘要。同一请求标识的重试不会再次修改密码或撤销后续新登录。
- 所有管理员操作的 `reason` 均可省略或留空，填写时最多 200 字；权限、版本检查与审计仍保留。
- 系统设置新增 `githubUrl`、`authorName`、`authorUrl`、`copyright`。旧配置通过默认值补齐，管理员可在“系统设置 → 页脚信息”编辑。GitHub 链接默认空，作者主页默认 `https://zyfan.zone/`。链接只接受 HTTP/HTTPS，空链接显示文字或图标，不触发跳转。

### 好友上次在线时间

社交玩家投影新增 `lastSeenAt`，为已知最近认证访问的 Unix 毫秒时间，无记录返回 `null`。在线判定仍使用当前进程的心跳与 75 秒阈值；不会因为数据库里有时间记录就判为在线。心跳在内存保持精确时间，每名玩家最多每 60 秒将 `profiles[id].lastSeenAt` 写入一次，因此重启后的记录为约一分钟粒度。该字段是可选社交元数据，不递增钱包／可编辑资料 revision，也不改变游戏状态版本或补写旧用户的猜测时间。

大厅好友列表显示“离线 · 5 分钟前在线”等相对时间，随现有好友刷新更新；悬停可查看具体时间。没有历史记录时只显示“离线”，在线时保留当前活动说明。相对时间支持分钟、小时、天、月、年，未来时钟偏差按“刚刚在线”展示。

### 论坛公开作者外观

话题列表、主帖和回复的 `author` 按当前资料生成公开外观：`appearance` 仅包含头像、头像框和称号 ID；`title` 仅包含当前称号的 `id`、`name`、`rarity`，由服务器藏品目录解析。不返回完整背包、余额、个人简介、账号凭据或游戏专属装备。更换装备后重新读取帖子即可显示新外观；原有帖子和回复仍只保存作者 ID，不修改讨论存档或游戏状态版本。旧资料／缺失用户使用默认头像与初始称号。

论坛复用公共头像、动态头像框和称号徽章样式。话题列表保持整行原生链接行为，主帖及回复保留发帖人标识与时间，窄屏下作者和时间分行，长昵称可换行。

### 好友私聊与游戏预约

存储版本从 9 迁移到 10，新增独立记录集合 `friendConversations` 和 `gameAppointments`。JSON 迁移保留原文件备份，SQLite 在启动时完成迁移。房间及游戏状态形状、游戏 stateVersion 均不改变。

- `GET /api/friends/:playerId/messages?before=<sequence>` 仅限当前已接受的好友关系，按序返回最近 50 条、`nextBefore`、`latestSequence` 和未读数。每段好友关系保留最近 200 条消息，单条最多 500 字。`POST` 同一路径发送 `{text,requestId}`，以发送者及请求标识去重，保留窗口内同标识不同内容返回 409；两次新消息至少间隔 500 毫秒。
- `POST /api/friends/:playerId/messages/read` 接受 `{through}`，只推进到客户端已显示的消息序号，不允许越过最新消息。读取历史不会自动清空未读。好友关系在读取、发送、标记已读时均重新校验；移除后无法访问旧私聊，重新加好友开启新的会话。
- `GET /api/appointments` 只返回当前用户参与的预约，可用 `playerId` 筛选当前好友。`POST` 接受 `{playerId,gameId,startsAt,note,requestId}`。`startsAt` 为 Unix 毫秒时间，界面按用户当地时间输入和展示；允许 5 分钟后至 30 天内的有效游戏，留言最多 200 字。每人最多 20 条未结束预约，同一段好友关系最多 5 条。
- `POST /api/appointments/:id/respond` 接受 `{revision,action}`。`accept`、`decline` 仅限接收方处理待确认预约，发起方可 `cancel` 待确认预约，确认后双方均可取消。参与者、当前状态与 revision 在同一持久化事务校验，过时操作返回 409；陌生人无法读取或回复其他人的预约。
- 待确认预约在约定时间过期，已确认预约在约定时间后 2 小时过期；移除好友使这段关系的未结束预约失效，重新添加不会恢复。预约前 15 分钟显示「开房邀请」，预选约定游戏并复用现有房间创建、邀请与加入流程。预约不自动占位或创建房间，也不绕过房间版本检查。
- `/api/friends` 增加各好友的 `conversation` 摘要及当前用户的预约列表；`/api/hub` 增加 `unreadMessages` 和 `appointments: {pending,due}` 用于通知。私聊打开时每 3 秒刷新，隐藏或离开后停止读取，输入草稿和阅读位置保持；其他页面沿用现有 20 秒通知刷新。提醒为站内通知，未接入邮件或离线系统推送。

## 实时合作塔防（2026-10-28）

游戏可声明 `realtime` 能力，通用平台调度器负责时间与持久化，不导入塔防规则。模拟固定 50ms 子步，每 200ms 提交四步检查点；在同一事务内复查房间 revision、matchId、状态版本、运行状态，提交后才发布。解散投票暂停、恢复与服务重启不补算离线时间。AI 使用自己的 view 决策。

- `/api/rooms/:id/socket`：会话 cookie 鉴权及成员校验；每条消息是该玩家的投影。
- `/api/rooms/:id/watch-socket`：独立公开观战投影，持续复查观战权限。
- 两者仅推送状态，玩家命令继续走既有 HTTP 事务接口；跨来源升级请求被拒绝。每个用户在同房间最多五条连接，20 秒心跳，慢连接丢弃中间快照、下一次发送完整投影，持续阻塞会断开重连。
- 模拟推送带 `realtimeFrame`，客户端只更新当前游戏视图。断线后重连取得最新完整投影，不重放客户端推测的战斗结果。
- 游戏操作的 `submissionKey` 绑定当前对局和该玩家操作序号，模拟步不消耗个人序号。事务中校验最新键、费用、所有权、冷却与权限，重复/跨局请求不能再扣款。
- 实时房间投影增加 `controlRevision`。模拟检查点不改变它，实际玩家或房间命令提交会推进它。离席、解散请求/投票、观战开关可在同一事务内通过当前 matchId 和 controlRevision 验证，避免 200ms 模拟帧使房间菜单持续过期；竞争操作仍会冲突。输入 revision 仍须是合法且不超过当前 revision 的整数。

上述是平台的可选实时能力；其他回合制游戏沿用原有传输与版本流程。
