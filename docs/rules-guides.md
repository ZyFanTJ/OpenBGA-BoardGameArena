# 图解玩法手卡

2026-10-24。本次覆盖注册表内全部七款游戏。规则引擎与存档格式没有变化；图解使用本站已有牌面、角色美术及原创 SVG，不嵌入规则书截图或复制全文。图示均附文字说明，颜色不作为唯一识别线索。

## 来源与版本

| 游戏 | 采用的资料 | 手卡呈现 |
| --- | --- | --- |
| CABO | [2019 第二版官方文件条目](https://boardgamegeek.com/filepage/183443/cabo-second-edition-official-rules)、仓库 cabo-rules.md 的既有版本核对；本次重新查看[出版方专家选项](https://beziergames.com/pages/cabo) | 保留真实游戏能力牌面；回合三选一、同点数多换一、呼叫和计分。注明本站专家开关不采用官网另列四轮制。 |
| UNO | [Mattel W2085](https://service.mattel.com/instruction_sheets/W2085-Eng.pdf)，第 1–3 页 | 六类牌面及分值、配色/配数示例、抽牌、UNO 宣告、+4 质疑分支；完整原有细则可展开。 |
| 魔毯商人 | [Gigamic 英文规则](https://en.gigamic.com/index.php?controller=attachment&id_attachment=603)，第 1–2 页 | 先转向再掷骰、专用骰面、共边铺放示意、收费和计分。 |
| 七大奇迹 | [第二版中文规则](https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders/rules/sev-cnt02-rules-1631177987iqAmT.pdf)、[效果参考表](https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders/en/sev-en02-effects-description-1716388911mLqDj.pdf)、[连锁参考表](https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders/en/sev-en02-chain-list-1598888877Na4yW.pdf) | 三种用途、资源图例、科技平方与套装示例、军事和钱币计分；按房间启用情况展示领袖及舰队。扩展规则来源见 seven-wonders-expansions.md，本次重新打开官方第二版两本规则。 |
| 忍者之夜 | [出版方规则入口](https://www.brotherwisegames.com/night-of-the-ninja)、Core Rulebook 2020、[官方 FAQ](https://www.brotherwisegames.com/s/NightOftheNinjaFAQ.pdf) | 轮抽、五阶段角色美术、家族地位与技能顺位区别、胜负与全部角色卡。官方规则 PDF 超出网页读取大小限制，改读已有官方 PDF 的文本；FAQ 直接读取官方地址。保留线上荣誉池适配声明。 |
| 雾灯纪行 | [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)，第 5–8、13–18 页；仓库 dnd-rules.md | 描述—确认—投骰流程、d20 公式、优势劣势示例、攻击与生存。明确为精简改编，保留授权署名、线上简化和内容来源。 |
| 卡坦岛 | [2020 Rules & Almanac](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf)，特别是建造第 4–5 页 | 对齐实体费用参考卡，用资源与建筑图标列道路/村庄/城市/发展卡费用；补充交易比例、七点流程、奖励与发展卡限制。 |

## 组织方式

游戏内容在 `apps/web/games/<id>/guide.js`；`guide-ui.js` / `guide-ui.css` 仅负责流程、图文条目、骰子等展示，不包含特定游戏规则。各游戏原有完整细则保留在原入口中，速查优先展示。UNO 增加直接手卡入口。卡坦规则面板增加独立滚动范围，避免被棋盘容器裁切。

## 验证

七个真实渲染器均通过独立内存房间打开手卡核验，未使用真实用户存档。截图及临时服务仅保存在忽略的 `work/rules-guides/`。桌面检查包括牌面、资源图标、角色图、流程、展开细则及关闭入口；窄屏检查以 390 像素视口进行。现有完整测试 403 项通过。
