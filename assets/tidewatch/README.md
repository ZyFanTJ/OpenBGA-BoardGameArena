# 潮汐守望美术资源

抽卡版使用四项新生成的栅格资源，均通过内置 `image_gen` 工具生成。完整提示词保存在 [prompts-v2.json](prompts-v2.json)，裁切与装箱记录见 [packing-v2.json](packing-v2.json)。运行时不访问外部图片服务。

| 项目内最终文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `apps/web/assets/tidewatch/towers-v2.png` | 1152×768 | 透明 6×4 建筑图集，每格 192×192 |
| `apps/web/assets/tidewatch/enemies-v2.png` | 768×768 | 透明 4×4 怪物图集，每格 192×192 |
| `apps/web/assets/tidewatch/island-v2.webp` | 1000×800 | 战场海岛底图 |
| `apps/web/assets/tidewatch/cover-v2.webp` | 960×640 | 大厅与准备房间封面 |

建筑按行对应潮汐、炉火、机巧、星灯。每行六帧依次为两座普通、两座精良、一座史诗、一座传奇，与 `draft-catalog.js` 的 `frame` 一致。192 像素格内保留透明边距，界面与画布共用同一图集。

怪物帧从 0 起逐行编号。0 潮灵，1 疾行蟹，2 铁壳寄居蟹，3 幽光水母，4 刺鲀，5 海藻巫医，6 珊瑚巨像，7 备用小怪，8 金壳巨蟹，9 晶壳搬运者，10 遗迹潮王，11 护卫，12 临时炮台形象，13 宝箱，14 核心，15 罗盘。当前临时炮台沿用机巧白塔轮廓，12 至 15 帧作为扩展素材保留。

原始输出保存在 `C:/Users/ZyFan/.codex/generated_images/01a17e5d-1959-76d2-bc6f-524f64947e29/`。四项源文件依次为 `exec-23f588c8-3aa5-47f8-ae55-8cbfbb02bfcf.png`、`exec-c9d824c8-d3a9-4707-8198-fde0a2b7d7c4.png`、`exec-3f8afa2e-1553-4d97-9afc-277e8b92e40a.png`、`exec-f7fb24a5-007b-4432-b827-4a2e42fcb3f7.png`。

使用 `scripts/prepare-tidewatch-v2.py` 提取透明连通区域，分离少量相接对象，再缩放装入带边距的规则网格。没有直接按生成图等分，避免建筑或怪物被切断。底图和封面压成 WebP，生成提示词与装箱记录随源代码保留。

图集提供静态形象。位移、摆动、受击、升星、进化、弹道、光束与状态环由 Phaser 表现。道路、建造位、射程圈、血条和粒子使用代码绘制，伤害与死亡以服务器结果为准。字体、概率和规则文本使用 DOM，图片内不绘制文字。

旧版 `units-v1.png`、`island-v1.png` 和 `cover-v1.png` 保留供经典存档使用，旧提示词见 `prompts.json`。音效由 `audio.ts` 使用 Web Audio 合成，默认关闭，无外部采样。
