# API 与存储协议

同源 JSON HTTP。身份来自 `moon_session` HttpOnly Cookie，所有房间操作校验成员。服务端默认绑定 `127.0.0.1:3000`。

| 方法 | 路径 | 输入/用途 |
| --- | --- | --- |
| GET | `/api/games` | 可用游戏 manifest |
| POST | `/api/session` | `{ name }` 创建匿名玩家，设置 Cookie |
| GET | `/api/me` | 当前玩家与当前房间 ID |
| POST | `/api/rooms` | `{ title, gameId, options, visibility? }` |
| GET | `/api/lobby` | 公开房间目录摘要 |
| POST | `/api/rooms/:code/join` | `{}` 加入，已在房间时幂等 |
| GET | `/api/rooms/:code` | 该玩家可见的完整快照 |
| GET | `/api/rooms/:code/events` | SSE，连接建立即发送完整快照 |
| POST | `/api/rooms/:code/actions` | `{ revision, type, ...payload }` |
| POST | `/api/rooms/:code/chat` | `{ text }` |

平台 actions 为 `ready`（附 `ready: boolean`）、`start`、`leave`、`rematch`、`addBot`、`removeBot`（附 `playerId`）、`requestDissolve`、`voteDissolve`（附 `voteId, agree`）、`game`（附 `command`）。只有 `game.command` 是游戏自己的协议。房间 revision 与游戏状态放在一次事务中更新，聊天独立于 revision。

`addBot` / `removeBot` 仅允许房主在等待阶段操作；同样必须携带当前 revision，添加受房间人数上限和游戏是否提供 AI 策略限制。房间快照的 `supportsBots` 表示可用能力，名册中 `isBot: true` 标记自动玩家；旧名册缺少此字段时视为真人。AI 无会话 Cookie，客户端不能指定 AI 身份提交行动。

错误格式 `{ error: string }`。常用状态：400 非法输入/行动，401 无会话，403 无权限，404 不存在，409 旧版本/存档版本不匹配，413 请求过大，415 非 JSON，429 操作过快。

SSE 常规 `data` 是该玩家完整快照，不是可以向所有成员复用的公共载荷。每 20 秒注释心跳，重连延迟 1.5 秒；最多同房间同身份 5 个连接。客户端不能提交玩家 ID 冒充行动者。

游戏 `view` 可接收可选的本次 transition 上下文（旧状态、行动者、已验证命令），由游戏自己生成可公开的动作提示。CABO 的 `game.motion` 只含动作类型、行动者、牌堆来源和公开操作牌位，不含牌面值、牌库顺序或永久卡牌 ID；卡面一律来自玩家专属视图。HTTP 行动响应和该次 SSE 推送携带相同 revision 的提示，客户端只播放一次。GET、初始 SSE、聊天推送与重连的 `motion` 为 null。提示不写入存档，不增加权威游戏状态字段，CABO stateVersion 仍为 1。

存档 root 有版本、会话哈希索引、房间索引。每个房间存 `gameId` 与 `stateVersion`。状态迁移尚未实现，版本升级前需编写显式迁移并备份数据；未知 root 版本拒绝启动。

## 退出、解散与公开大厅

- `leave` 允许进行中退出。支持 AI 的游戏保留原座位 ID 与游戏状态，将该房间名册项标为 `isBot: true, departed: true`。原会话立即失去该房间的读取、行动和聊天权限，可加入其他房间，不能接管已经交给 AI 的本局座位。AI 只使用此座位的 `view`，不继承浏览器记忆。
- 房主退出时移交给首位仍在房间的真人；最后一位真人离开时关闭房间。无 AI 插件的游戏退出时清空本局并让其余玩家返回准备状态；前端事先提示这一结果。
- `requestDissolve` 仅当前房主可在 `playing` 状态发起，发起即投同意票。`voteDissolve` 输入为 `{ voteId, agree: boolean }`；只能投一次，必须同时匹配当前 revision 和投票 ID。任一真人拒绝则取消申请，全体在房真人同意才删除房间。AI 默认同意，不占投票人数。
- 投票期间暂停规则行动和 AI 定时器，聊天仍可用。断线不算同意，重连恢复待投票状态；不会超时自动通过。中途退出者不再属于投票成员，剩余成员仍需全票同意。
- 房间新增可选 `dissolution` 元数据；不存在表示没有投票。它与名册、revision 同事务持久化，游戏自身状态未改形，CABO stateVersion 仍为 1。
- 退出/解散后，相关 SSE 连接收到 `{ id, left: true, reason: 'left' | 'dissolved' }` 后关闭。行动者 HTTP 返回 `{ left: true, reason }`。所有打开的客户端回到大厅；普通快照仍只含接收者专属游戏视图。
- `POST /api/rooms` 可传 `visibility: 'public' | 'private'`。未传及旧存档默认 private。大厅创建弹窗明确提供公开选项，AI 快速练习默认 private。
- `GET /api/lobby` 无需会话，返回 `{ rooms }`，仅列公开房间的 `id, title, gameId, status, count, maxPlayers, host`，不含聊天、会话或游戏状态。大厅人数为公开房间当前座位数（含 AI），不伪造全站在线人数。筛选与搜索在客户端处理，加入权限最终仍由服务端校验。
