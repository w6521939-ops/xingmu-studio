# 漫剧创作 V7 渐变天蓝色毛玻璃设计基准

> 状态：天蓝色毛玻璃色系保留；用户已否决“左欢迎栏 + 两排项目封面墙”首页布局，不得作为最终布局基准。

# 1. 最终候选视觉方向

## 方向名称

Sky Studio / 天空影像工坊

## 关键词

- 天蓝渐变、通透、明亮、清爽、科技、毛玻璃、轻盈、专业、长时间使用舒适。

## 明确排除

- 深海蓝大底、纯黑背景、紫色、粉色、青绿色、夜店霓虹。
- 暖灰纸张、米黄色、复古编辑部风格。
- 不透明白色后台卡片和泛滥的彩色描边。

# 2. Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `sky-050` | `#F4FBFF` | 最亮环境光 |
| `sky-100` | `#E6F6FF` | 页面浅背景 |
| `sky-200` | `#C9ECFF` | 渐变中段 |
| `sky-300` | `#9EDCFF` | 渐变亮色 |
| `sky-400` | `#67C5FF` | 高亮、图标 |
| `sky-500` | `#2FA8F5` | 主操作、选中 |
| `sky-600` | `#1589D5` | pressed、强调文字 |
| `text-primary` | `#12324B` | 主文字 |
| `text-secondary` | `#496D87` | 次文字 |
| `text-muted` | `#7899AF` | 弱文字 |
| `glass` | `rgba(255,255,255,.46)` | 主毛玻璃面板 |
| `glass-raised` | `rgba(255,255,255,.62)` | 浮层、选中卡 |
| `glass-reading` | `rgba(248,253,255,.82)` | 剧本和长文本区域 |
| `glass-line` | `rgba(255,255,255,.78)` | 玻璃边框与内高光 |
| `primary-gradient` | `linear-gradient(135deg, #8DD9FF 0%, #48B9FA 48%, #198FDC 100%)` | 主按钮、当前导航、关键进度 |
| `ambient-gradient` | `linear-gradient(135deg, #F4FBFF 0%, #D7F1FF 34%, #A9E1FF 68%, #74CAFF 100%)` | 整页背景 |

# 3. 毛玻璃规则

- 顶栏、导航、项目卡、检查器：白色半透明毛玻璃，背景模糊 `22–30px`。
- 边框：`1px rgba(255,255,255,.78)`，顶部加入非常轻的白色内高光。
- 阴影：`0 14px 36px rgba(31,125,181,.13)`，不得使用黑色重阴影。
- 背景：天蓝色渐变上叠加柔和白云状光斑和极淡科技网格；不能出现真实云朵照片。
- 剧本、台词和表单区：提高到 `82%` 不透明度，保证深蓝文字清晰。
- 主按钮：`#8DD9FF → #48B9FA → #198FDC` 天蓝渐变，白色文字，轻微蓝色光晕。
- selected：天蓝描边、浅蓝光晕和文字加深，不使用紫色。

# 4. 首页母版生成提示词

```text
Use case: precise-object-edit
Asset type: high-fidelity Windows desktop application UI master mockup
Input image: edit target. Preserve the exact project-home information architecture, project-cover grid, card count, Chinese labels, spacing and complete 1600×1000 Windows framing.
Primary request: Transform the interface into a bright SKY-BLUE GRADIENT FROSTED-GLASS creative studio for the Chinese app “漫剧创作”.
Background: luminous sky-blue gradient from #F4FBFF through #D7F1FF and #A9E1FF to #74CAFF; soft abstract white atmospheric light shapes and an extremely subtle technical grid; no real clouds.
Materials: top bar, left welcome panel, tab container, search field, project cards and empty tile use premium white frosted glass with 22–30px background blur, rgba(255,255,255,.46) fill, bright white glass edge, subtle inner highlight and soft blue shadow. Long-text areas remain more opaque.
Typography: deep blue #12324B and blue-gray #496D87, crisp and highly readable.
Primary action: “新建漫剧” uses a sky-blue gradient from #8DD9FF through #48B9FA to #198FDC, white text and restrained glow. Active tab uses the same gradient as a thin underline.
Text invariants: “漫剧创作”, “最近项目”, “本地项目”, “新建漫剧”, “导入项目”, “打开项目”, “搜索项目名称”.
Constraints: Simplified Chinese desktop UI, bright airy technology feeling, visible but tasteful glass blur, one dominant CTA, cinematic project artwork unchanged, complete interface visible.
Avoid: dark navy background, pure black, purple, pink, green/cyan-green, warm beige, opaque dashboard cards, nightclub neon, overexposure, low-contrast text, six-step sidebar, timeline editor, charts, watermark.
```

# 5. 其余页面继承规则

以下页面全部引用确认后的 V7 首页母版，只继承色彩、玻璃材质、字体、阴影和选中态，不复制首页布局：

| 页面 | 主要玻璃区域 | 高可读区域 | 天蓝渐变动作 |
| --- | --- | --- | --- |
| 项目总览 | 顶栏、剧集卡、接着创作 | 故事简介 | 继续创作 |
| 剧本编辑 | 场景树、检查器、工具栏 | 中央剧本文本 | 整理剧本 |
| 角色设定 | 角色索引、锚点、声音、关系 | 角色信息 | 保存设定 |
| 分镜板 | 场景切换、分镜卡、检查器 | 动作与台词 | 生成画面 |
| 配音台 | 说话人、台词行、参数面板 | 台词正文 | 生成配音 |
| 视频成片 | 预览控制、镜头序列、导出检查 | 状态说明 | 导出成片 |
| 接口设置 | 设置导航、Provider 卡、帮助 | 表单字段 | 保存配置 |

# 6. 生成门禁

1. 先生成一张 V7 项目首页母版。
2. 用户确认天蓝色、明暗度和毛玻璃强度后，才生成其余七页。
3. 最终文件使用 `manju-v7-skyblue-glass-*` 命名，不覆盖 V5/V6 历史图片。
