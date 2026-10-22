# 七大奇迹界面美术

使用内置 image_gen 生成原创插画。77 种建筑分为 6 张图集；七座奇迹与大厅封面共用一张图集；另有桌面背景和 13 个资源、钱币、军事、科技、分数 SVG。最终素材位于 apps/web/assets/seven-wonders，WebP 图像共约 4.7 MB。

完整生成提示词见 [prompts.json](prompts.json)，映射、尺寸、大小与校验值见 [manifest.json](manifest.json)。原始生成图保留在本机 Codex 的 generated_images 中。

art.js 按卡牌 kind 映射画面，atlas.css 定义图集位置，hud.css 管理深色高对比游戏主题。卡面以类别色与名称、插画、主要效果、费用四区排列；hud.js 负责产能、分类统计与行动前后对照，详细规则按需展开。symbols.js 绘制准确效果；计数图示中，亮起的小城市表示统计范围，分类符号表示对象，钱币或桂冠表示回报。参见 [界面信息层级](../../docs/seven-wonders-ui.md)。

新增卡牌时补齐映射并检查效果。图片仅作插画，规则与数字始终来自玩家视图。已发布的 v1.webp 使用长期缓存，替换画面需改用 v2 等新文件名并同步更新清单与引用。

2026-10-20：罗马、阿布辛贝、叙拉古增加独立原创城市插画，分别突出斗兽场、拉美西斯神庙和海港。使用内置 image_gen 分别生成，2172×724 原尺寸无损编码为 WebP，三张共约 6.7 MB，位于 `apps/web/assets/seven-wonders/wonders/`。完整提示词见 [expansion-wonders/prompts.json](expansion-wonders/prompts.json)，逐图尺寸、路径和校验值见 [expansion-wonders/manifest.json](expansion-wonders/manifest.json)。选面与牌桌自己的城市、邻国共用 `cityArt` 映射，夜面保留现有滤镜；七个基础文明及未知文明封面回退保持原映射。

初版验收覆盖全部卡牌与奇迹、390 px 手机、七人桌、三个时代完整对局、付款保留、抽屉返回与键盘操作。验收截图和测试数据保存在被忽略的 work/seven-wonders 中。

扩展文明插画验收：三位玩家分别验证选面日夜插画、自己的城市与两个邻国、390 px 手机无横向溢出，以及七个基础文明和未知值回退未受影响；图片均成功解码，无脚本错误。报告及截图位于忽略的 `work/expansion-city-art/`。本地稳定镜像只叠加 `art.js` 和三张插画，标记 `expansion-wonder-art-20261020`，8 个房间、8 份玩家资料及整个存档切换前后完全一致；可部署镜像包已同步，云端未更新。
