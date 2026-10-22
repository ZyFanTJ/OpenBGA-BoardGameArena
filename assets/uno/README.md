# UNO 素材与来源

2026-10-22 搜索核实。Mattel 有官方规则 PDF、官方商品展示图与新闻媒体附件；本次未找到可直接供网络游戏开发的完整官方卡面 PNG/SVG 图集。

- [Mattel W2085 产品及说明书入口](https://service.mattel.com/us/productDetail.aspx?prodno=W2085&siteid=27)
- [经典 108 张版英文规则 PDF](https://service.mattel.com/instruction_sheets/W2085-Eng.pdf)
- [Mattel 官方 50 周年新闻与 Download Media](https://mattel.iprsoftware.com/news/unoR-celebrates-50-years-of-bringing-people-together)
- [新闻附件整包端点](https://mattel.iprsoftware.com/_gallery/get_files/?page_id=5ffc55eb2cfac204adc526fa)（本次访问未能取得文件，不能报告为已下载或可用卡面包）

官方媒体页列出 Premium Card Set、1970s Deck、Anniversary Card Deck 三类产品图；用途为产品展示，并非逐张游戏卡面。具体 URL 保存在 sources.json，未将这些素材下载加入运行时。

运行时使用 `apps/web/games/uno/art.js` 的本站原创矢量卡面与牌背，支持 54 种正面及 108 张实体牌 ID。大厅复用现有 `cover-uno-v1.webp`，不将其称为官方授权素材。没有必须生成位图的插画，采用轻量可缩放矢量。

来源清单只记录发现结果，不表示取得 Mattel 的图形或品牌授权。UNO 名称及其商标归各权利人所有。
