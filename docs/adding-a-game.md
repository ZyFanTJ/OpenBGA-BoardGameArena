# 接入一个新游戏

## 1. 实现纯规则模块

新增 `packages/games/<id>/index.js`，导出符合 `GameModule` 的对象。状态结构由游戏决定，不继承 CABO 的牌/阶段/回合字段。棋类可以存棋盘、合作游戏可以存共享目标、投票游戏可以存私密选择。

```js
export const example = {
  manifest: { id: 'example', title: 'Example', rulesVersion: '1',
    stateVersion: 1, minPlayers: 2, maxPlayers: 6 },
  create(playerIds, options, random) { /* 返回初始 JSON 状态，校验选项 */ },
  apply(state, playerId, command, context) { /* 校验并返回新状态 */ },
  view(state, viewerId) { /* 显式挑选可见字段，不要展开整个 state */ },
  isFinished(state) { /* 整场结束判定 */ },
};
```

命令是游戏自己的 discriminated union，例如 `{ type: 'place', x, y }` 或 `{ type: 'vote', choice }`。不要将牌桌点击坐标或客户端计算的分数当成权威结果。全部玩家可以同时准备，但游戏是否同时行动由 `apply` 决定。

随机输入通过 `random` 获取；同一个状态、命令及相同随机序列应产生相同结果。不要在模块内部访问网络、文件或系统时钟。若需要时间，在扩展契约时由平台提供经过验证的时间/超时命令。

## 2. 注册服务端游戏

在 `packages/games/registry.js` 导入新模块，加入 `createRegistry([...])`。`GET /api/games` 会提供其元信息。房间人数和终局判定自动采用插件声明。

## 3. 添加客户端渲染器

在 `apps/web/games/<id>/index.js` 导出创建函数，接收 `send(command)` 和 `rerender()`，返回 `render(roomSnapshot, currentUser)` 与 `handle(action, element)`。将其注册到客户端 `games/registry.js`。渲染时转义来自玩家的文本。

在客户端注册表的 `gameCards` 中补充该游戏的说明、选项表单和 `readOptions`。大厅自动读取服务端目录并展示已安装的游戏渲染器。游戏按钮统一使用 `game:` 行动前缀，平台壳会分发给当前游戏，不需要修改房间服务、聊天、会话或传输层。

大厅由 `apps/web/lobby.js` / `lobby.css` 负责。`gameCards` 还可提供装饰卡面 `artHtml`、封面类名 `coverClass`、分类 `catalogCategory`、时长 `duration`、标签 `tags`。这些 HTML 只来自受信任的本地游戏模块，不能来自用户输入。桌游馆与开房类型选择自动使用已注册列表，切换游戏会替换其专属选项表单。

## 4. 必须验证的边界

- 合法流程、非法动作、其他玩家越权、重复旧命令。
- 任何玩家的投影都不出现其他人的私密字段；围观者若未来支持，须单独定义投影。
- 整局能结束、计分可复现、下一局/退出符合该游戏规则。
- 对象 JSON 往返不丢失信息；改状态结构时增加 `stateVersion` 并编写迁移。
- 多人视图同步、浏览器重连、键盘操作、窄屏显示。

`tests/platform.test.js` 的同时投票游戏提供最小契约测试样例，`tests/cabo.test.js` 提供复杂状态机的实际用例。

## 5. 可选自动玩家

在游戏模块导出 `bot: { observe, decide }`，签名见 `GameModule`。`observe(view, playerId, previous, ownCommand)` 返回新记忆，`decide(view, playerId, memory)` 返回合法游戏命令或 `null`（等待）。只根据自己的投影决策，不读取完整状态；函数保持纯计算。房间壳自动显示添加 AI，调度器负责执行和版本校验。重启时记忆可能为空，策略必须安全恢复。参考 `packages/games/marrakech/bot.js` 或 `packages/games/cabo/bot.js` 及 `tests/bots.test.js`。
