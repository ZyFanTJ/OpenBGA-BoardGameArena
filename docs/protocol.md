# API 与存储协议

同源 JSON HTTP。身份来自 `moon_session` HttpOnly Cookie，所有房间操作校验成员。服务端默认绑定 `127.0.0.1:3000`。

| 方法 | 路径 | 输入/用途 |
| --- | --- | --- |
| GET | `/api/games` | 可用游戏 manifest |
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
