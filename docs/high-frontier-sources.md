# 高边疆第四版：已收集规则资料目录

收集与校验日期：2026-10-08。

已将 **20 份 PDF 保存到本地**，其中 **16 份来自官方入口，共 423 页**；另外 2 份社区数据参考表及 2 份旧版镜像用于比对。主干规则（核心含模组 0、附录、模组 1—6）共 8 册、324 页。总计 529 页包含重复版本，不应理解为 529 页不同规则。

这次完成的是完整原件的收集、文件校验、文本提取和初步规则梳理。**没有宣称所有离线文件都是最新 Living Rules，也没有宣称中文规格已逐条完成。** 已收集范围内的 PDF 均可打开并提取文本；图形和颜色仍以 PDF 为准。

- [中文规则导读与开发索引](high-frontier-rules.md)
- [机器可读来源清单](high-frontier-source-manifest.json)：原始下载地址、SHA-256、页数和 PDF 元数据。
- [本地研究入口](../work/high-frontier/README.md)
- [出版社产品页](https://iongamedesign.com/products/high-frontier-4-all)
- [官方规则索引](https://docs.google.com/spreadsheets/d/1dt1g3XGxMcQPIij1uLAc-x9-TiZXiwHTX8-jYK-3hEg/edit?gid=0)
- [出版社公开规则库](https://nx86265.your-storageshare.de/s/sNyb57oRF4djgQi)

原件及提取文本位于 `work/high-frontier/sources/`。`work/` 已被本仓库忽略，因此原件保留在本机，不会随普通 Git 提交进入代码库。本文和精简来源清单位于 `docs/`，供后续开发持续维护。

## 1. 本地文件

文件名中的日期沿用发现时的官方索引标注；真实版本请看“版本记录”。PDF 导出日期是文件元数据，不能单独证明规则修订时间。链接后的“文本”是供检索使用的提取结果，不是官方另一版本。

| 材料 | 页数 | 来源 | 版本记录 | 本地副本 |
| --- | ---: | --- | --- | --- |
| 核心规则（含模组 0、词汇表） | 56 | 官方规则索引 | 索引 2026-04；书内 2025-04；PDF 导出 2026-04-29 | [PDF](../work/high-frontier/sources/core-official-2026-04.pdf) · [文本](../work/high-frontier/sources/core-official-2026-04.txt) |
| 附录：变体、剧本及参考 | 40 | 官方规则索引 | 书内 2025-10 | [PDF](../work/high-frontier/sources/appendix-official-2025-10.pdf) · [文本](../work/high-frontier/sources/appendix-official-2025-10.txt) |
| 模组 1：Terawatt & Futures | 40 | 出版社资料库 | 书内 2021-02；较旧离线版 | [PDF](../work/high-frontier/sources/m1-official-share.pdf) · [文本](../work/high-frontier/sources/m1-official-share.txt) |
| 模组 2：Colonization | 28 | 官方规则索引 | 书内 2025-10 | [PDF](../work/high-frontier/sources/m2-official-2025-10.pdf) · [文本](../work/high-frontier/sources/m2-official-2025-10.txt) |
| 模组 3：Conflict | 44 | 出版社资料库 | 书内 2021-03-11；较旧离线版 | [PDF](../work/high-frontier/sources/m3-official-share.pdf) · [文本](../work/high-frontier/sources/m3-official-share.txt) |
| 模组 4：Exodus | 44 | 官方规则索引 | 索引 2023-07；PDF 导出 2023-11-10 | [PDF](../work/high-frontier/sources/m4-official-2023-07.pdf) · [文本](../work/high-frontier/sources/m4-official-2023-07.txt) |
| 模组 5：Economy | 44 | 官方规则索引 | 书内 2025-10；PDF 导出 2026-05-12 | [PDF](../work/high-frontier/sources/m5-official-2025-10.pdf) · [文本](../work/high-frontier/sources/m5-official-2025-10.txt) |
| 模组 6：Odyssey | 28 | 官方规则索引 | 索引 2026-05；书内 2026-09；PDF 导出 2026-09-22 | [PDF](../work/high-frontier/sources/m6-official-2026-05.pdf) · [文本](../work/high-frontier/sources/m6-official-2026-05.txt) |
| Read Me First 开箱与入门指南 | 8 | 出版社资料库 | 文件名 v0-936；PDF 导出 2020-05 | [PDF](../work/high-frontier/sources/read-me-first-official.pdf) · [文本](../work/high-frontier/sources/read-me-first-official.txt) |
| Space Diamonds / Starship Builder | 8 | 出版社资料库 | PDF 导出 2020-12-20 | [PDF](../work/high-frontier/sources/space-diamonds-official.pdf) · [文本](../work/high-frontier/sources/space-diamonds-official.txt) |
| Race to Mars + Race for Glory 教程 | 28 | 出版社资料库 | PDF 导出 2020-12-20 | [PDF](../work/high-frontier/sources/race-for-glory-official.pdf) · [文本](../work/high-frontier/sources/race-for-glory-official.txt) |
| Tools 1：Jump Start 预组装飞船 | 24 | 出版社资料库 | 书内 2022-04-30；PDF 导出 2026-08-31 | [PDF](../work/high-frontier/sources/jump-start-official.pdf) · [文本](../work/high-frontier/sources/jump-start-official.txt) |
| 玩家辅助表 | 6 | 出版社资料库 | PDF 导出 2020-12-20 | [PDF](../work/high-frontier/sources/player-aid-official.pdf) · [文本](../work/high-frontier/sources/player-aid-official.txt) |
| 核心专用玩家辅助表 | 4 | 出版社资料库 | 文件名 2021-02-14 | [PDF](../work/high-frontier/sources/player-aid-core-official.pdf) · [文本](../work/high-frontier/sources/player-aid-core-official.txt) |
| 模组 3 策略册 | 8 | 出版社资料库 | 文件名 v0-636；PDF 导出 2020-09-04 | [PDF](../work/high-frontier/sources/m3-strategy-official.pdf) · [文本](../work/high-frontier/sources/m3-strategy-official.txt) |
| 殖民卡散热标记修正资料 | 13 | 出版社资料库 | 文件名 v05c；PDF 导出 2021-02-09 | [PDF](../work/high-frontier/sources/colonization-cards-official.pdf) · [文本](../work/high-frontier/sources/colonization-cards-official.txt) |
| 卡牌参考表 | 18 | Ian Hayward 社区资料 | PDF 导出 2023-07-09；非当前全扩展卡库 | [PDF](../work/high-frontier/sources/cards-community.pdf) · [文本](../work/high-frontier/sources/cards-community.txt) |
| 地点参考表 | 4 | Ian Hayward 社区资料 | PDF 导出 2023-07-09；不包含完整路线拓扑 | [PDF](../work/high-frontier/sources/sites-community.pdf) · [文本](../work/high-frontier/sources/sites-community.txt) |
| 模组 1 旧版镜像 | 40 | Boardgamesbot 镜像 | PDF 导出 2020-06-17；比官方离线版更旧 | [PDF](../work/high-frontier/sources/m1-mirror.pdf) · [文本](../work/high-frontier/sources/m1-mirror.txt) |
| 模组 3 镜像 | 44 | Gamers HQ 镜像 | 与官方资料库版本 SHA-256 相同 | [PDF](../work/high-frontier/sources/m3-mirror-2021-03-11.pdf) · [文本](../work/high-frontier/sources/m3-mirror-2021-03-11.txt) |

## 2. 初学者阅读路线

1. **Read Me First**：认识盒内材料和分层学习方式。
2. **Space Diamonds / Starship Builder**：分别熟悉地图移动和设备组合。
3. **Race for Glory**：按教学规则完成一局；不要把教程省略的支援、事件等当成核心游戏也不存在。
4. **核心规则 A–N 与 Glossary**：正式研究完整核心。实际规则总则在 A2，术语定义也是规则的一部分。
5. **政治 O 章**：明确增加政治后改变了哪些操作和计分。
6. **模组 1、2**：逐步研究货船、高功率推进、殖民站和殖民者；再处理模组 3—6。
7. **附录及 Jump Start**：选择独立的新手、单人或合作配置，而不是无条件合入标准规则。

## 3. 版本冲突与使用决策

| 问题 | 已核实证据 | 本轮处理 |
| --- | --- | --- |
| 核心的三个日期不完全一致 | 索引 PDF 栏 2026-04；第 2 页 Updated Apr 2025；文件导出 2026-04-29 | 按文件哈希固定快照，保留三个日期，不简称“2025 核心”或“2026 全规则” |
| 模组 1 存档落后在线入口 | 官方存档第 2 页 2021-02；索引在线规则栏 2023-05 | 官方 2021 原件作为完整参考；在线差异待逐项比对，不能声称最新 |
| 模组 3 存档落后在线入口 | 官方存档第 2 页 2021-03-11；索引在线规则栏 2025-07 | 同上；商店镜像与官方存档哈希相同，不能当另一份更新 |
| 模组 4 索引与导出时间不同 | 索引 2023-07，PDF 导出 2023-11-10 | 不以导出时间擅自改规则版本 |
| 模组 5 第 2 页存在标题笔误 | 封面和章节为 Module 5 / 5A 等，第 2 页一行写 Module 6 - Economy | 归类为模组 5；保留原件不改写 |
| 模组 5 下载文件晚于索引 | 索引和书内 2025-10，PDF 导出 2026-05-12 | URL 内容可能被更新；使用哈希核对而非只看 URL |
| 模组 6 已有更晚书内修订 | 索引 PDF 栏 2026-05；第 28 页 Updated Sept, 2026；PDF 导出 2026-09-22 | 记录实际取得的 2026-09 书内修订，不把旧索引时间当真实内容日期 |
| Jump Start 日期有差异 | 书内 2022-04-30；PDF 导出 2026-08-31 | 区分内容更新与重新导出 |
| 模组人数声明不同 | 模组 1、2 有 1–5 人声明；核心 1–6；模组 3 正文竞争模式 2–6 且无单人 | 按具体配置验证，不以最大宣传人数覆盖所有配置 |
| 在线摘要混有旧条款 | 本轮核心 I9 允许白面交付，G7 允许与任何人员同地维修等 | 中文导读以本地核心快照为准；不采信未标版本的摘要来填空 |

在线入口：[核心](https://cutt.ly/hf4-core)、[模组 1](https://cutt.ly/hf4-m1)、[模组 2](https://cutt.ly/hf4-m2)、[模组 3](https://cutt.ly/hf4-m3)、[附录](https://cutt.ly/hf4-appendix)。本轮成功解析了核心、模组 1、3 的公开 Adobe 入口；尚未完成其在线内容与 PDF 的逐条差异核验。

辅助勘误线索：[BGG 核心／附录／模组 1—3 Living Rules 改动记录](https://boardgamegeek.com/thread/2838108/hf4-coreappendixm1-3-living-rules-changes-since-2n)。这是比对线索，不能越过对应官方文本直接合并到引擎。

## 4. 为开发保留的辅助材料

- 官方索引 CSV 快照：`work/high-frontier/official-rulebook-index.csv`。
- 官方公开库文件目录快照：`work/high-frontier/hf-share-list.xml`。
- 完整采集清单与自动章节索引：`work/high-frontier/catalog.json`。
- 核心第 7 页地图符号、第 15 页质量／燃料图已渲染并目视核对，预览在 `work/high-frontier/previews/`。
- [官方 TTS 模组入口](https://steamcommunity.com/sharedfiles/filedetails/?id=1904166818) 与 [VASSAL 模组入口](https://vassalengine.org/wiki_old/wiki/Module%3AHigh_Frontier_4_All) 可用于后续核对配件及实际桌面操作；本轮未宣称已提取其全部资源。

PDF 原件已完整下载，文本提取保留逐页标记。公式、彩色模块条文、图标、卡面和地图不能只靠提取文本判断。社区参考表的文字提取也有列粘连；殖民卡修正 PDF 主要是图像。这些材料还需要视觉核对后再录入数据库。

本轮检查了所有文件的 PDF 签名、可解析页数及 SHA-256。社区表出现可恢复的 PDF 对象索引告警，已成功解析；本轮只抽查核心图示，尚未逐页视觉检查全部 529 页。没有修改游戏代码，也未运行应用测试。

## 5. 收集阶段完成与后续边界

已完成主干规则、模组 0—6、附录、正式教程与辅助表的离线资料收集，不再需要用户上传规则书。后续规则规格可以从这些本地原件直接推进。

尚未完成的是“统一到选定修订版并可直接编程”的全过程：模组 1、3 在线修订比对，全部卡面／地图路线／燃料轨的数据化，逐条动作及例外规格，以及跨模组验收。不能把已有资料目录和中文导读当成已经完成的规则引擎。
