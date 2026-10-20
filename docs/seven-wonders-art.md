# 七大奇迹领袖素材

2026-10-19：49 位二版领袖全部使用对应卡牌插画，覆盖 34 位标准领袖和 15 位专家领袖。没有加入 Cities 专属或宣传领袖。旧的共用 SVG 人像已移除。

## 来源

- [出版社 Leaders 媒体页面](https://www.rprod.com/en/press/7-wonders-leaders) 提供英文素材包。其中阿米蒂斯、柏拉图、梅塞纳斯、伊姆霍特普、基尼斯卡、芙里涅六张高清样图用于对应肖像；包中的 Arsinoe 属于 Cities，未使用。
- 其余 43 位来自 [7 Wonders Second Edition 社区桌游图集](https://steamcommunity.com/sharedfiles/filedetails/?id=2620130114) 的二版领袖卡面。逐一按照卡牌名称与 CardID 对应，并用出版社样图核对版本与画面。这个来源是社区镜像，并非出版社提供的完整素材包。

原画、商标及相应版权属于 Repos Production 与原权利人。公开下载不等于开放许可，此处记录素材来源，不表示已经取得开放再分发或商业使用授权。

## 集成

素材位于 `apps/web/assets/seven-wonders/leaders/`，49 张 WebP 总计约 1.25 MB。移除印刷卡面的名称、效果栏、价格角标和边框，仅保留插画；高分辨率样图缩至最多 640px 宽。没有生成或重绘人物。

`apps/web/games/seven-wonders/leader-art.js` 显式绑定每张领袖的 key 与本地素材。选将、招募、详情和城市收藏共用同一渲染入口，费用、效果和姓名仍由游戏界面独立呈现。肖像保留完整纵向画面，前端按既有卡牌区域取景；少数头饰较高的人物使用单独焦点位置。

`assets/seven-wonders/leaders/sources.json` 保存逐卡图源、原图裁切坐标、尺寸、文件大小和 SHA-256。原始下载包、对照图、浏览器截图只保留在忽略的 `work/leader-art/`，不进入运行镜像。
