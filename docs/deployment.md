# Docker 打包与部署

镜像 `happy-online:0.7.0` 包含服务端、CABO、魔毯商人、七大奇迹、忍者之夜、雾灯纪行（DND）、好友、账号、战绩、商城、管理员 AI DM 配置和全部运行所需美术。Linux amd64，Node 22，非 root 用户运行，无需额外 npm 依赖。构建时必须通过全部测试，最终镜像不包含测试、工作数据、会话或生成素材原稿。

## 在本机部署

先启动 Docker Desktop / Docker Engine，在项目根目录运行：

```sh
npm run image:build
docker compose up -d --wait
```

打开 <http://127.0.0.1:3100/>。也可直接运行 `npm run deploy`，它会构建并等待服务健康。默认监听主机所有网卡，局域网设备使用主机 IP:3100。仅本机使用时设置 `BIND_ADDRESS=127.0.0.1`；端口可设置 `PORT`。

```sh
docker compose ps
docker compose logs --tail 100 app
docker compose restart app
docker compose down
```

`down` 保留存档卷；不要添加 `-v`，该参数会删除玩家数据。卷挂载 `/data`，包含账号、好友、星辉、藏品、对局与迁移备份。健康检查为 `GET /api/health`。容器只读运行，数据卷可写，开启 init、自动重启与 20 秒停止宽限。

## 离线镜像包

```sh
npm run image:package
```

生成 `dist/happy-online-0.7.0-linux-amd64.tar.gz` 和同名 `.sha256`。将压缩包与 `compose.yaml` 复制到目标 Linux 机器；此处 `compose.yaml` 的 `build` 配置在 `--no-build` 时不会使用。

```sh
sha256sum -c happy-online-0.7.0-linux-amd64.tar.gz.sha256
docker load -i happy-online-0.7.0-linux-amd64.tar.gz
docker compose up -d --no-build --wait
```

## 上传 Docker Hub / GHCR / 私有仓库

先在自己的终端完成对应仓库的 `docker login`，再传入明确的镜像名：

```sh
npm run image:push -- your-account/moon-table:0.7.0
# 或
npm run image:push -- ghcr.io/your-account/moon-table:0.7.0
```

脚本会将本地 `happy-online:0.6.0` 标记为指定名称并上传。仓库账号、命名空间和权限由部署方配置；不会默认向任何外部账号上传。

## 域名与 HTTPS

将 `deploy/compose.production.yaml`、`deploy/Caddyfile` 和按 `deploy/.env.example` 填写的 `.env` 放在服务器同一目录。`IMAGE_REF` 填已上传镜像的完整名称与版本，`DOMAIN` 填解析到服务器的真实域名。放行 80 / 443 端口，运行：

```sh
docker compose --env-file .env -f compose.production.yaml pull
docker compose --env-file .env -f compose.production.yaml up -d --wait
```

Caddy 自动申请 TLS 证书并反向代理。正式配置不暴露应用的 3000 端口，使用 Secure Cookie，关闭 SSE 代理缓冲。需要自有反向代理时，保持 Host、支持持续 SSE 连接并设置 `SECURE_COOKIES=1`。HTTPS 配置不能直接用于纯 HTTP 地址登录。

## 升级、存档与恢复

目前是单实例 SQLite WAL 存储，一个数据卷仅供一个应用进程使用；不要横向扩容多个副本。首次启动自动把旧 `/data/platform.json` 导入 `/data/platform.json.sqlite`，保留原文件和 `/data/platform.json.secrets.key`。后续写入仅更新数据库，原 JSON 不再代表最新数据。建议升级前停止服务并备份整个数据卷。

运行需要 Node.js 22.13+。`DATABASE_FILE` 可指定数据库路径；`DATA_FILE` 继续指定旧 JSON 导入路径及其密钥位置。备份整个卷必须停服，包含数据库、可能存在的 `-wal`/`-shm` 文件和加密密钥；不能只复制正在运行的主数据库文件。回退旧 JSON 版本必须恢复升级前的整卷备份；保留下来的 JSON 只对应导入时刻。

生产配置通过 Caddy 作为唯一入口，应用服务不映射宿主端口，设置 `TRUSTED_PROXY_HOPS=1` 读取最近一层代理追加的地址。直接部署默认 `0`，忽略客户端转发头。改变网关拓扑时同时核对代理层数与应用端口隔离。已认证写请求按玩家 ID 独立计数（240/分钟）；匿名请求按来源计数；登录/注册另有来源（120/分钟）和标准化账号（15/分钟）两层保护。

```sh
docker compose stop app
# 使用 docker compose ps -a 和 docker volume ls 确认当前项目卷名
# 默认项目名 moon-table，卷名 moon-table_moon-data
docker run --rm -v moon-table_moon-data:/data:ro -v "${PWD}:/backup" alpine:3.22 tar czf /backup/moon-table-data.tar.gz -C /data .
docker compose up -d --wait
```

恢复时先停止应用，将备份解压到目标卷再启动；不要覆盖运行中的文件。0.6.0 的平台存储格式为 v7，启动时按顺序自动迁移 v1–v6，并以原始版本保留一次性备份。0.5.x 使用 v6；降回 0.5.x 及更早镜像前必须停止服务并恢复升级前存档，旧镜像不能直接读取 v7。

已有原生 Node 存档可在停止原服务后复制至数据卷的 `/data/platform.json`，设置属主为 UID/GID 1000，再启动容器。浏览器地址保持相同时原 Cookie 仍可使用；地址不同的游客先在原地址绑定账号，再到新地址登录。

参考：[Docker Node.js 指南](https://docs.docker.com/guides/nodejs/)、[多阶段构建](https://docs.docker.com/build/building/multi-stage/)。

### 0.4.0 游戏存档迁移

此版本保持平台存储 v3，同时将七大奇迹游戏状态从 v1 迁移到 v2。启动前备份 `moon-data` 卷，升级后原局仍按基础版继续，手牌、待确认行动和进度保留；房间 revision 增加以拒绝旧客户端操作。回滚到 0.3.0 时需恢复升级前的完整数据备份，旧镜像不能直接读取七大奇迹 v2。

### 0.4.1 领袖立绘

49 位二版领袖改用对应卡牌插画，随镜像本地提供，不请求外部图床。仅调整前端素材，存储格式 v3、七大奇迹状态版本 v2 不变，无新增存档迁移。图源和逐卡来源见 `docs/seven-wonders-art.md`。

### 0.4.2 公网复制兼容

好友码与所有房间邀请入口共用复制逻辑。优先使用 Clipboard API；HTTP 地址或权限拒绝时尝试选择复制；若浏览器仍禁止自动复制，则显示可选中的号码。存档版本不变。

### 0.4.3 本地操作反馈与时代战报

增加整块玩家确认高亮、领袖候选阶段提示、自动时代陆海战报和默认展开的终局分项。公开玩家投影新增操作三态，房间快照公开已有 matchId 以隔离已读偏好。持久游戏状态未改形，无新增存档迁移。按用户要求仅更新本地，云端仍为 0.4.2。

### 0.4.4 本地规划信息与房间好友邀请

奇迹阶段常驻印刷成本；舰队各节点常驻推进费用，商船同时显示商业等级、收入及征税额。新增按住 Tab 的公开全桌状态快览与触屏入口、岛屿获得弹窗及效果摘要、房间内好友筛选与邀请。

全部由现有玩家专属投影与事务式好友邀请接口实现，没有修改权威游戏状态的形状或结算公式。平台存储 v3、七大奇迹状态 v2 保持不变。岛屿阅读偏好按浏览器会话、房间、本局及玩家隔离。邀请继续校验好友关系、房间成员、准备状态、容量和 revision。

仅更新本地镜像与本地容器；云端仍为 0.4.2。隔离测试数据与截图保存在忽略的 `work/decision-hud/`，不进入运行镜像。

### 0.4.5 固定房间座位

房间名册新增固定 `seat`，点击哪个空位即在该位置添加 AI；移除和离开不压缩其他座位，真人加入使用最小空位，开局按座位升序创建游戏玩家环。平台存储迁移为 v4：按旧名册顺序补全 `seat`，每个房间 revision 增加 1，保存原始 `.v3.bak`。所有游戏内部状态、手牌、待确认操作、时代、计分和游戏状态版本保持原样。自动迁移会原子写入；回滚到旧镜像需恢复升级前整卷备份。

146 项测试覆盖指定座位、无效/占用/越界与过期 revision、房主权限、加入/离开/移除、开局邻国顺序、重开与迁移备份。双浏览器覆盖实时同步、刷新、手机端添加和实际开局。

0.4.5 已于 2026-10-20 更新本地和指定云服务器，部署记录及回滚备份位置见 `docs/remote-deployment.md`。此前 0.4.3 / 0.4.4 的“仅本地”记录为当时部署状态。

### 0.5.0 管理中心与系统配置

新增后台总览、全部用户查询、资料修正、星辉设置/增减、权限与账号状态、会话撤销、系统设置和审计。首次管理员需用 `ADMIN_BOOTSTRAP_HANDLE` 绑定一个已有注册账号，详见 `docs/administration.md`。配置文件不存储管理员密码；未指定账号时管理功能保持未授权。

平台存储更新至 v6，迁移保留现有账号、会话、资产、好友、房间、论坛内容和游戏内部状态；旧版存档原文件自动备份。旧镜像无法读取 v6，回滚应恢复升级前完整备份。此次本地开发不自动更新云端，线上部署记录仍见 `docs/remote-deployment.md`。

### 0.5.1 论坛与社区页面布局统一

玩家论坛、好友、战绩和商城共用 `apps/web/page-header.js`，统一页面宽度、顶部边距、标题及操作区域。论坛沿用月夜社交插画，话题分类与列表保留原有结构。搜索框在非搜索页面预留导航位置，移动端导航规则统一归属 `shell.css`；好友、战绩和商城加载时保留同一头部，避免闪空和位移。

平台存储保持 v6，所有游戏状态版本不变。174 项测试通过，实际浏览器覆盖 320/390/600/768/1024/1280/1440/1920px 的导航、头图和标题坐标一致性、无横向溢出，以及发帖、搜索、分类、回复、匿名发帖入口和慢速加载。管理员导航另覆盖 10 种宽度。本地 8 个房间、8 份资料及完整存档逐项比对保持不变。线上更新与备份记录见 `docs/remote-deployment.md`。

### 0.6.0 本人操作提示与单轮时限（本地）

三个游戏增加顶部倒计时、本人名牌和操作区域高亮、最后十秒警示，以及房间创建/等待区的不限时、30/60/120/300 秒选项。服务端按完整决策窗口计时并自动完成超时操作；解散投票冻结剩余时间，刷新和重连不会重置时限。论坛整行话题使用原生链接覆盖，支持键盘及新标签页访问。

平台存储 v7 增加房间计时元数据并递增旧房间 revision，旧房间保持不限时。全部游戏内部状态与 stateVersion 不变，自动保留原始 `.v6.bak`。186 项测试及三个游戏的浏览器交互验证通过，详细策略见 `docs/turn-limits.md`。本次更新本地镜像和容器；云端仍为 0.5.1，后续部署需先备份整卷并验证 v6 → v7 迁移，回滚到 0.5.x 需恢复该升级前备份。

### 0.7.0 忍者之夜、DND 与 AI DM 管理配置

完整运行镜像包含五款游戏，并加入忍者轮抽与技能反馈、DND 三个副本与全部运行美术、管理员 AI DM 配置。平台存储为 v8，只增加模型服务配置，不修改原有房间与游戏状态。原始 v7 文件自动保留 `.v7.bak`；回滚需恢复升级前整卷数据。密钥加密保存在 JSON 中，独立加密密钥位于数据卷内的 `platform.json.secrets.key`，备份与恢复必须包含该文件。详见 [管理员配置](administration.md)。

镜像构建通过全部 251 项测试，实际浏览器验证五游戏创建菜单、忍者开局轮抽、DND 建角掷骰、管理员密钥保存与清除、刷新和手机适配。本地及云端均已更新；线上镜像 ID、包摘要、备份和逐项验收见 [线上记录](remote-deployment.md)。
