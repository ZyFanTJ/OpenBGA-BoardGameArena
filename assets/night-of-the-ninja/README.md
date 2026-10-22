# 忍者之夜素材

查找日期：2026-10-20。检查了 [出版方产品页](https://www.brotherwisegames.com/night-of-the-ninja)、其规则书/FAQ 下载及 [Press 页面](https://www.brotherwisegames.com/press)，没有找到公开可下载的完整卡牌素材图包。因此按任务要求，用内置 `image_gen` 工具制作原创插画；未将原创图标记为官方美术。

官方游戏名称、规则和原版美术的著作权归其权利人。这里的图像是为本平台生成的原创配图，中文卡名是界面译名。

## 交付文件

- `apps/web/assets/night-of-the-ninja/atlas-v1.webp`：4×4 图集，密探、秘术师、灵魂商人、盗贼、掘墓人、易容师、盲眼刺客、上忍、装饰武僧、镜僧、幕后主使、鹤、莲、浪人、牌背、月夜场景。
- `apps/web/assets/night-of-the-ninja/extra-v1.webp`：2×2 图集，挑拨者、裁决者、殉道者、装饰卷轴。
- `apps/web/assets/night-of-the-ninja/cover-v1.webp`：大厅封面，第一张图集右下角场景。
- `apps/web/assets/night-of-the-ninja/house-{crane,lotus,ronin}-v1.webp`：从原图分离的身份插画，用于横向身份条。

图集居中裁切并排成 256×384 的竖向格，避免将横构图拉伸成人物变形。图集坐标由 UI 的 `art.js` 与样式表消费，游戏文字、顺位和技能说明由 HTML 叠加，便于阅读、翻译与无障碍操作。卡背统一，不用素材变化泄露牌面。生成源图和官方 PDF 的研究副本仅保存在忽略的 `work/night-of-the-ninja/`，不提交研究副本、会话或对局快照。

## 生成提示词

两次调用都使用内置工具，`transparent_background: false`，未使用 CLI 或外部 API Key。原始提示词如下。

### 图集 A

```text
Use case: stylized-concept. Asset type: ONE production sprite atlas for a Chinese online tabletop social deduction game titled Night of the Ninja. Create a perfectly aligned 4 by 4 grid of sixteen equal portrait illustration panels, no spacing, no gutters, edge to edge. Overall image landscape 1536 by 1024 if possible, each panel therefore slightly landscape; composition should keep primary subjects inside central 65% so portrait CSS cropping is safe. Original illustrated cut-paper shadowbox ninja world, richly layered handmade paper, dark midnight teal, jade, warm ivory, muted vermilion, antique gold; elegant luminous moonlight, tactile paper grain, clear silhouettes at small size. Each tile a self-contained central subject, no labels, no text, no logos, no watermark, no numbers, no borders. Reading order left to right top to bottom: row1 tile1 Spy crouching on a roof observing, tile2 Mystic holding a glowing crystal ball, tile3 Spirit Merchant with lantern and spirit masks, tile4 Thief taking a gold star coin. Row2 tile1 grave digger beside ancient graves with spade, tile2 shapeshifter with two overlapping fox masks, tile3 blind assassin with eye wrap and dagger, tile4 shinobi wielding katana in moonlight. Row3 tile1 unyielding monk guarding with bamboo staff, tile2 mirror monk reflecting a blade with circular mirror, tile3 mastermind strategist with golden folding fan, tile4 elegant crane bird among pine branches. Row4 tile1 lotus flower on jade water, tile2 lone ronin swordsman under rain, tile3 repeating symmetrical gold ninja shuriken and crescent moon ornamental card back on deep teal, tile4 moonlit Japanese temple rooftops with red maple and teal mist as game cover. Cohesive exquisite premium board game illustration. This is a single sprite atlas image.
```

### 图集 B

```text
Use case: stylized-concept. Asset type: one small production board-game sprite atlas. Perfect two by two equal grid of 4 illustrations, no gutters, no labels, no text, no borders. Original lavish layered cut-paper shadowbox Japanese ninja night scenes in midnight teal, jade, muted vermilion, antique gold and warm ivory, tactile paper grain and moonlight. Keep subjects central for portrait cropping. Top left: mischievous troublemaker revealing a secret scroll under a red lantern. Top right: stern judge ninja with ceremonial katana and imposing gold and red robes in a moonlit hall. Bottom left: self-sacrificing martyr ninja kneeling calmly as a radiant golden shuriken star rises above, no injuries or blood. Bottom right: a moonlit ornamental secret scroll, ink brush and ninja seal on dark teal. Match cohesive premium handmade paper illustration quality. This is one single four-panel sprite atlas, square image.
```

风格沿用 CABO 的青绿牌桌、金色选中边框、奶油色卡框和柔和纸艺质感。UI 支持选牌抬起、发牌翻转、击杀闪烁与提示过渡，并尊重 `prefers-reduced-motion`。多人与手机布局使用正常文档流，避免绝对坐标让 11 人席位相互遮挡。
