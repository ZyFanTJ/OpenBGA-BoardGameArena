# 卡坦岛美术与规则资源索引

检索日期：2026-10-22。官方素材与原创运行素材分开记录，未把第六版宣传图当作 2020 规则书的版本证明。

## 官方公开来源

| 资源 | 来源 | 本次取得情况 |
| --- | --- | --- |
| 第六版官方新闻稿 | [Asmodee 媒体文件](https://b2b-media-production-ana.s3.amazonaws.com/filer_public/74/c8/74c8436a-92d0-426f-85d6-98a363f7cb8a/catan___6th_edition_press_release.pdf) | 已下载 `official-sixth-edition-press-release.pdf` |
| 第六版 Media assets 资源包入口 | [官方新闻稿内链接的 Google Drive 文件夹](https://drive.google.com/drive/folders/1kVDBGinMK260E-oo2s-hWR4QRKNaIvxY) | 已从新闻稿超链接核实地址；浏览器访问超时，未能核实包内卡牌文件 |
| 官方完整棋盘展示 | [CATAN Board 3D Render](https://www.catan.com/sites/default/files/2025-04/CATAN_Board_3DRender.jpg) | 官网产品页确认链接，直接下载连接中断，未保存 |
| 官方棋盘近景 | [CATAN Board close shot](https://www.catan.com/sites/default/files/2025-04/CATAN_Boardcloseshot.jpg) | 官网产品页确认链接，直接下载连接中断，未保存 |
| 2020 基础版规则及卡牌示意图 | [Rules & Almanac](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf) | 已通过网页工具阅读，直接下载超时；未将低分辨率示意图冒充完整卡牌源文件 |
| 官方规则下载中心 | [Game Rules](https://www.catan.com/understand-catan/game-rules) | 可继续查阅其它版本 |
| 官方媒体联系入口 | [Press inquiries](https://www.catan.com/press-inquiries-catan-studio) | 当前页面为 TBD，没有资源附件 |

本次未取得可以确认覆盖所有资源卡和发展卡的官方独立高清卡面包。上述链接是来源索引，不表示通用再分发许可。运行界面不依赖远程下载，也没有盗链官方图片。

## 已交付的原创运行美术

`apps/web/assets/catan/terrain-v1.png`：1536×1024、三列两行，依次为木材森林、红土砖丘、羊毛牧场、粮食麦田、矿石山地、沙漠。由内置 imagegen 生成，实际用于棋盘地形与资源手牌。数字、概率、名称与建筑在界面独立呈现，不烧进图片。道路和建筑保留为可交互矢量/文字标记。

使用的完整提示词：

> Create an original premium tabletop strategy game terrain texture atlas. EXACT 3 columns by 2 rows equal rectangular panels, no gaps, no borders, no text or typography, landscape total image 1536x1024. Each panel a distinct hand-painted gouache / etched storybook landscape viewed from elevated overhead oblique angle, rich tactile paper detail with understated warm sunlight. Top left dense dark evergreen forest (wood); top middle terracotta clay hills and clay quarry (brick); top right lush soft green meadow with tiny white sheep (wool). Bottom left golden ripe wheat fields (grain); bottom middle slate blue rocky mountain quarry (ore); bottom right ochre sand dunes and dry desert (desert). Every panel fills its entire sixth of canvas. Composition within each panel center-safe for hexagon crop; evenly textured, no dominant focal object. Harmonized muted earthy palette, detailed beautiful boardgame illustration, no buildings, no logos. This is original artwork for a web board game.
