# 漫剧创作 V6 科技渐变全页面设计基准

> 状态：用户已否决深海蓝、青蓝紫配色；仅保留毛玻璃技术规则和页面结构参考，不得作为最终配色基准。
>
> 本文件是后续设计图生成和 React / Electron 实现的最新视觉基准。V5 仅保留为历史方案。

# 1. 调整范围

## 保留

- 项目首页、项目总览、剧本、角色、分镜、配音、成片、接口设置八个独立页面。
- 横向项目导航和按创作对象组织的工作区。
- 不采用六步编号侧栏，不采用 Premiere / DaVinci 式多轨专业剪辑器。
- 第一版不调用真实 AI，只显示演示模式和预留 Provider 接口。

## 重做

- 删除暖灰纸张、编辑部和文具桌氛围。
- 全局切换为深海蓝科技工作区。
- 青绿、亮蓝、极光紫组成渐变主视觉。
- 使用分层毛玻璃面板、低强度光晕、微网格与柔和径向渐变建立空间层级。
- 内容图片保持漫画影视感，工具框架保持精确、克制和可长时间使用。

# 2. 产品视觉方向

## 方向名称

AI 影像中枢 / AI Cinematic Nexus

## 关键词

- 科技、未来、沉浸、清晰、精确、创作能量、深色长时工作、可控光效、电影级内容。

## 核心视觉

- 页面背景是深海蓝而不是纯黑，使用非常轻的蓝紫径向渐变和细微网格。
- 外壳、导航、项目卡和检查器采用 `rgba(15, 24, 52, 0.62)` 深色毛玻璃表面，使用 `backdrop-blur: 20–28px`、`1px rgba(190,215,255,.16)` 边框和顶部内高光；背后必须能隐约看见环境渐变与微网格。
- 剧本正文、台词长列表和表单输入保持 `rgba(12, 20, 44, 0.86)` 较高不透明度，确保长时间阅读清晰。
- 主按钮使用青绿到亮蓝再到极光紫的线性渐变。
- 选中态使用亮蓝描边与低强度外发光；成功态使用青绿色，警告态使用琥珀色。
- 渐变只用于主按钮、当前导航、关键进度和局部背景光，不给每张卡片都加彩色描边。
- 中文文字保持高对比、短标签和成熟桌面软件排版。

## 必须避免

- 纯黑大底、夜店霓虹、赛博朋克城市背景、荧光色泛滥。
- 无层级的全屏透明、影响文字可读性的过度透明、过强模糊或炫光。
- 紫粉渐变独占主视觉；渐变必须包含青绿和亮蓝，紫色只作为末端色。
- 营销落地页、统计仪表盘、巨大 AI 球、机器人头像、无意义英文。

# 3. Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `app-bg` | `#070B18` | 应用最深背景 |
| `canvas` | `#0B1024` | 主工作区背景 |
| `surface` | `rgba(15, 24, 52, 0.62)` | 主要毛玻璃面板，模糊 `24px` |
| `surface-raised` | `rgba(22, 34, 70, 0.76)` | 浮层、选中内容，模糊 `28px` |
| `surface-reading` | `rgba(12, 20, 44, 0.86)` | 剧本、台词、表单等高可读区域 |
| `surface-soft` | `rgba(35, 50, 92, 0.46)` | 输入、次级玻璃区域 |
| `text-primary` | `#F3F7FF` | 主文字 |
| `text-secondary` | `#AAB8D6` | 次文字 |
| `text-muted` | `#7180A5` | 弱文字 |
| `line` | `rgba(138, 167, 223, 0.18)` | 边框、分割线 |
| `cyan` | `#2EE6D6` | 成功、能量起点 |
| `blue` | `#4D7CFE` | 选中、导航、焦点 |
| `violet` | `#9B5CFF` | 渐变末端和创意强调 |
| `amber` | `#FFB454` | 未配置、待确认 |
| `danger` | `#FF647C` | 错误、删除 |
| `primary-gradient` | `linear-gradient(135deg, #2EE6D6 0%, #4D7CFE 50%, #9B5CFF 100%)` | 主按钮、关键进度 |
| `ambient-gradient` | `radial-gradient(circle at 15% 10%, rgba(46,230,214,.13), transparent 30%), radial-gradient(circle at 85% 20%, rgba(155,92,255,.14), transparent 34%)` | 页面环境光 |

# 4. 通用组件调整

- 顶栏：深蓝毛玻璃，模糊 `24px`，底部 `1px` 冷蓝分割线；Windows 窗口控制保持清晰。
- 导航：当前项文字使用浅色，底部线使用完整科技渐变，不使用大胶囊底。
- 主按钮：渐变背景、白色文字、轻微内高光；hover 仅提高亮度并上移 `1px`。
- 次按钮：深蓝表面、冷蓝描边、无发光。
- 内容卡：分层毛玻璃面板、`10–12px` 圆角、半透明灰蓝边框与顶部内高光；只有 selected 卡出现蓝色微光。
- 输入框：`rgba(6, 12, 30, .72)` 背景，focus 使用亮蓝描边。
- 图片：影视漫画素材保持完整色彩；遮罩只用于保证文字可读。
- 状态：`接口未配置` 使用琥珀标签；完成使用青绿；错误使用珊瑚红。
- loading：使用青蓝紫细进度线，不做整页旋转光圈。
- empty：使用线性科技占位图和明确按钮，不使用机器人插画。

# 5. 全页面生成提示词

## 5.1 项目首页

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI master mockup
Primary request: Design the PROJECT HOME screen for a Chinese manhua-drama creation desktop product named “漫剧创作”. Establish a sophisticated technology-gradient design system for all later pages. The product is local-first story production software, not a web dashboard and not a professional video editor.
Scene/backdrop: full-bleed 1600×1000 Windows application interface, straight orthographic view, complete uncropped UI, no device frame or desk.
Layout: compact 64px top bar; brand block upper left; search and settings upper right; 300px welcome column; large project library with cinematic project-cover tiles in an asymmetric grid. Include “新建漫剧”, “导入项目”, recent projects, episode count, last edited time, local-save status, pinned marker and offline badge.
Style/medium: realistic shippable desktop UI; AI Cinematic Nexus; deep navy workspace #070B18 and #0B1024; layered frosted-glass navy panels with 20–28px background blur, translucent fill, subtle top inner highlight and 1px cool glass border; cyan and violet ambient radial gradients visible through glass; fine technical grid; high-contrast Chinese typography. Primary creative action uses gradient #2EE6D6 to #4D7CFE to #9B5CFF. Use gradient selectively.
Text (verbatim): “漫剧创作”, “最近项目”, “本地项目”, “新建漫剧”, “导入项目”, “打开项目”, “搜索项目名称”.
Constraints: Simplified Chinese UI text, Chinese desktop app interface, readable labels, one dominant CTA, cinematic project cover art, mature Windows tool aesthetic.
Avoid: warm paper/editorial style, pure black, nightclub neon, pink-only gradients, flat opaque dashboard cards, unreadably transparent text areas, six-step sidebar, giant stepper, timeline editor, charts, marketing hero, random English, duplicated labels, watermark.
```

## 5.2 项目总览

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Create the PROJECT OVERVIEW page for “漫剧创作”, preserving the approved dark navy cyan-blue-violet technology-gradient system.
Layout: 1600×1000 app; top project identity and local-save state; horizontal navigation “总览 / 剧本 / 角色 / 分镜 / 配音 / 成片”; project cover and synopsis left; three wide episode cards center; “接着创作” panel right.
Components: episode cinematic thumbnail strips, title, scene count, readiness labels for script/storyboard/voice/video, character portraits, “继续创作”, “新增一集”.
Style: deep navy cinematic production hub, translucent structured panels, cyan-blue-violet gradient active navigation and primary action, subtle ambient glow and micro-grid, no analytics dashboard.
Text (verbatim): “漫剧创作”, “雾城回声”, “总览”, “剧本”, “角色”, “分镜”, “配音”, “成片”, “故事简介”, “剧集”, “接着创作”, “继续创作”, “新增一集”.
Avoid: warm paper UI, charts, giant stepper, workflow sidebar, professional timeline, excessive neon, watermark.
```

## 5.3 剧本编辑

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Design the SCRIPT EDITOR page for “漫剧创作” using the same dark navy technology-gradient visual system.
Layout: 1600×1000; horizontal project navigation; 240px left episode/scene tree; wide central screenplay editor; 300px right scene inspector.
Components: scene heading, action text, narrator block, structured character dialogue rows, character chips, “新增场景”, “拆分台词”, “整理剧本”, unsaved state and “演示模式”.
Style: focused futuristic writing environment; deep navy panels, slightly brighter central editor surface for long-text readability, cobalt selection, cyan-blue-violet gradient primary action, subtle grid and restrained edge glow.
Text (verbatim): “漫剧创作”, “剧本”, “第1集”, “场景 03”, “新增场景”, “拆分台词”, “整理剧本”, “演示模式”, “场景信息”, “角色台词”, “旁白”.
Avoid: white paper manuscript, AI chat bubbles, timeline, dashboard cards, excessive glass, unreadable low-contrast text, watermark.
```

## 5.4 角色设定

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Create the CHARACTER BIBLE page for “漫剧创作” with a dark navy cyan-blue-violet technology-gradient shell.
Layout: 1600×1000; left character index; large central character key visual and reference views; right appearance anchors, expression, costume, voice and relationships.
Components: “沈砚”, “男主”, front/side/detail references, locked hairstyle/face/clothing/prop anchors, expression sheet, costume cards, voice preview, relationship map, “导入参考图”, “保存设定”.
Style: futuristic character consistency lab but still approachable; deep navy translucent panels; cyan lock states; blue-violet selected cards; gradient primary button; character artwork supplies cinematic color.
Constraints: same character identity in every reference tile; readable Chinese labels; subtle technology glow only.
Avoid: warm paper dossier, generic gallery, neon overload, six-step workflow, professional timeline, watermark.
```

## 5.5 分镜板

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Design the STORYBOARD BOARD page for “漫剧创作” using the same dark technology-gradient system.
Layout: 1600×1000; horizontal project navigation; scene switcher; central three-column storyboard grid with six large shot cards; right shot inspector; no workflow sidebar.
Components: coherent cinematic thumbnails, shot number, action note, dialogue excerpt, duration, shot size, camera motion, reference chips, continuity lock, “新增镜头”, “拆分镜头”, “生成画面”.
Style: deep navy visual planning wall, dark translucent cards, cobalt selected shot, cyan continuity lock, cyan-blue-violet gradient generation action, subtle background grid.
Avoid: multitrack timeline, giant preview, dashboard cards, warm paper, nightclub neon, watermark.
```

## 5.6 配音台

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Create the VOICE PRODUCTION page for “漫剧创作” in the same dark navy technology-gradient visual language, simpler than a professional DAW.
Layout: 1600×1000; left speaker column; central dialogue rows grouped by scene; right voice settings; compact bottom audition bar.
Components: speaker portraits, editable dialogue, emotion, duration, status “未配音 / 待确认 / 已确认”, “批量分配”, “试听本句”, “生成配音”, “接口未配置”, simple waveform preview.
Style: precise futuristic voice workspace, deep navy panels, cobalt active speaker, cyan confirmed state, amber unconfigured badge, gradient primary action, restrained glow.
Avoid: professional mixer, complex waveform tracks, multitrack DAW, warm paper, excessive neon, watermark.
```

## 5.7 视频成片

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Primary request: Design the FINAL ASSEMBLY page for “漫剧创作” in the same dark navy technology-gradient system, explicitly not professional editing software.
Layout: 1600×1000; large vertical 9:16 preview left; export checklist right; one single-layer shot sequence ribbon bottom.
Components: play controls, timecode, subtitle, volume, aspect ratio, shot thumbnails, simple transitions, retained-last-frame indicator, export readiness, “预览全片”, “导出成片”, “接口未配置”.
Style: immersive cinematic review room, deep navy shell, slightly darker preview stage, cyan-blue-violet active playhead and primary export action, subtle technical grid and cool dividers.
Avoid: multitrack timeline, audio tracks, scissors overload, Premiere layout, warm paper, neon excess, watermark.
```

## 5.8 接口设置

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application settings UI mockup
Primary request: Create the AI INTERFACE SETTINGS page for “漫剧创作”, showing reserved adapters without real connections, in the same dark navy technology-gradient style.
Layout: 1600×1000; left settings navigation “通用 / 项目存储 / AI 接口 / 导出”; main structured sections for script/image/voice/video; right privacy and demo-mode help panel.
Components: provider dropdown, model mapping, endpoint, masked API key, local lock icon, “未配置”, “保存配置”, “测试连接”, connection log drawer.
Style: trustworthy futuristic control center; deep navy panels, cyan-blue-violet gradient focus and main save action, amber warnings, crisp fields, restrained translucency.
Constraints: never show a real secret; Chinese labels must be readable.
Avoid: cloud pricing, exposed keys, glowing robot icons, warm paper, pink-only gradients, watermark.
```

# 6. 生成顺序

1. 先生成项目首页，作为科技渐变视觉母版。
2. 目视检查渐变比例、中文可读性、面板透明度和科技感是否克制。
3. 后续七页引用母版，只继承视觉系统，不复制首页布局。
4. 每张最终图保存到 `docs/design/`，使用 `manju-v6-*` 文件名，不覆盖 V5 历史图片。
