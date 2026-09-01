# 漫剧创作 V4 设计图生成提示词

## 1. 需求补全

用户原始需求被映射为以下六个稳定入口：

1. `剧本扩写`：输入故事主题，生成并继续编辑剧本。
2. `角色与资产`：文生图，同时记忆角色卡、道具卡和场景卡。
3. `画面组合`：选择角色、道具、场景并生成统一画面。
4. `图生视频`：输入导演提示词，生成视频并保留最后一帧供下一镜头续接。
5. `资源库`：标记有用资源，支持本地上传图片。
6. `一键成片`：将步骤 1–5 串成可检查、可调整、可重新生成的完整流程。

## 2. 新设计定位

- 产品定位：日常使用的 AI 漫剧制片工作台，不是专业剪辑软件，也不是统计仪表盘。
- 视觉关键词：明亮、清晰、亲和、专业、内容优先、中等信息密度。
- 页面模型：六步流程导航 + 一键成片主画布 + 创作记忆侧栏。
- 核心视觉：四格连续分镜和清晰的生成流程，而不是时间线或大表单。
- 目标设备：桌面端 Electron，参考画布 `1536 × 1024`，约 `3:2` 横向比例。
- 本轮仅生成视觉确认图，不修改 React 页面。

## 3. 页面结构

```text
ManjuProductionStudio
├── TopBar
│   ├── Brand
│   ├── ProjectName
│   ├── SaveState
│   ├── Help
│   └── Export
├── WorkflowSidebar
│   ├── ScriptExpansion
│   ├── CharacterAssets
│   ├── ImageComposition
│   ├── ImageToVideo
│   ├── ResourceLibrary
│   └── OneClickMovie
├── MainWorkspace
│   ├── PageTitleAndPrimaryAction
│   ├── StoryPrompt
│   ├── PipelineOverview
│   ├── StoryboardPreview
│   │   └── ShotCard[4]
│   └── GenerationSettings
└── MemoryDock
    ├── CharacterTab
    ├── PropTab
    ├── SceneTab
    ├── MemoryAssetCards
    ├── UsefulMarker
    └── LocalUpload
```

## 4. 布局比例

- 顶栏：约 `60 px`，占页面高度约 `5.9%`。
- 左侧流程导航：约 `218 px`，占页面宽度约 `14.2%`。
- 中央工作区：约 `980 px`，占页面宽度约 `63.8%`。
- 右侧创作记忆：约 `338 px`，占页面宽度约 `22%`。
- 中央主题输入与流程区：占中央工作区高度约 `34%`。
- 四格分镜预览：占中央工作区高度约 `48%`。
- 底部生成设置：占中央工作区高度约 `18%`。

## 5. 视觉系统

- 页面背景：云灰白 `#F4F6F5`。
- 主表面：纯净白 `#FFFFFF`。
- 次表面：淡青灰 `#EEF3F1`。
- 主文字：深墨灰 `#1F2937`。
- 次文字：石板灰 `#64748B`。
- 主操作色：深青绿 `#176B67`。
- 主操作浅背景：`#E5F1EF`。
- 创作强调色：珊瑚橙 `#E76F51`，只用于生成动作、分镜编号和有用标记。
- 辅助沙色：`#F6EBDD`，用于道具与提示状态。
- 边框：`#DDE3E1`。
- 禁止：纯黑大面积背景、紫色/粉色 AI 渐变、米黄复古纸张、霓虹光、玻璃拟态。
- 圆角：面板 `10–12 px`，输入框与按钮 `8 px`，不使用胶囊式大圆角。
- 阴影：只使用非常轻的环境阴影，主要依靠边框与背景明度区分层级。
- 图标：统一线性 SVG 风格，`18–20 px`，不用 emoji。

## 6. 完整 ImageGen 提示词

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design mockup for product review
Primary request: Create a brand-new polished Chinese desktop UI for an AI manhua-drama production app named "漫剧创作". The interface must be designed directly around six product capabilities: script expansion, character/prop/scene memory, image composition, image-to-video with director prompts and retained last frame, useful-resource marking plus local image upload, and a unified one-click movie workflow. This is an approachable AI production studio for everyday creators, not a professional video editor and not a generic analytics dashboard.

Scene/backdrop: full-bleed desktop software interface only, straight orthographic front view, no monitor or laptop frame, no desk, no perspective presentation.

Style/medium: realistic shippable product UI; bright, calm, friendly, professional; medium information density; strong Chinese typography; practical interaction hierarchy; no concept-art styling.

Composition/framing: landscape desktop canvas around 3:2 or 16:10, with the complete interface visible and no cropping.

Layout:
- A compact 60px top bar containing the "漫剧创作" brand, project name "末日长安", local-save state, help, and export.
- A 218px left workflow sidebar titled "创作流程" with six numbered items in this exact order: "1 剧本扩写", "2 角色与资产", "3 画面组合", "4 图生视频", "5 资源库", "6 一键成片". Make "6 一键成片" the active item using a calm teal highlight.
- A spacious central workspace titled "一键成片" with subtitle "从主题到成片，一次完成" and one clear coral primary button "开始生成".
- Near the top center, a large story-theme input labeled "故事主题" containing a short readable Chinese story seed about a swordsman searching for his lost memories in future Chang'an.
- Below the story input, a five-stage horizontal production flow with clear compact stages: "剧本", "角色资产", "画面组合", "视频生成", "成片". Each stage should show a visible status icon and a short state such as ready or editable.
- The central visual focus is a four-card storyboard preview titled "分镜预览". Show four coherent manhua frames with the same black-haired swordsman, the same long sword, and the same rainy futuristic Chang'an environment. Use varied shots: wide establishing shot, medium character shot, prop close-up, and action shot. Each card has a coral shot number, a one-line director note, duration, and a small continuity-lock icon.
- Under the storyboard, include a compact generation-settings row with "画面比例 9:16", "成片时长 60秒", "导演提示词", and a clearly enabled toggle "保留尾帧" with helper text explaining that the last frame continues the next shot.
- A fixed 338px right panel titled "创作记忆" with tabs "角色", "道具", "场景". Show visible memory cards for "沈砚", "照影剑", and "雨夜长安", each with thumbnail, lock state, and consistency status. Include a star-style "有用" marker on selected resources and a clear outlined button "本地上传".

Color palette: cloud-gray application background #F4F6F5; white surfaces #FFFFFF; pale teal-gray secondary surface #EEF3F1; ink text #1F2937; slate secondary text #64748B; deep teal primary #176B67; pale teal selected background #E5F1EF; coral creative accent #E76F51 used only for the main generation action, storyboard numbers, and useful-resource markers; soft sand #F6EBDD for prop/helper states; border #DDE3E1.

Materials/textures: clean matte software surfaces, crisp 1px borders, subtle ambient shadows, 10–12px panel radius, 8px inputs and buttons, no glass.

Text (verbatim): "漫剧创作", "末日长安", "创作流程", "1 剧本扩写", "2 角色与资产", "3 画面组合", "4 图生视频", "5 资源库", "6 一键成片", "一键成片", "从主题到成片，一次完成", "故事主题", "剧本", "角色资产", "画面组合", "视频生成", "成片", "分镜预览", "导演提示词", "保留尾帧", "创作记忆", "角色", "道具", "场景", "沈砚", "照影剑", "雨夜长安", "有用", "本地上传", "开始生成". Render these simplified-Chinese labels clearly, exactly once where appropriate, with clean system sans-serif typography. Do not invent English headings.

Interaction cues: one primary CTA only; visible active workflow step; visible locked-memory states; useful marker uses star plus text; local upload uses icon plus text; selected storyboard card uses teal outline; all buttons at least 40px high; clear disabled/loading-ready hierarchy.

Constraints: the six-step workflow, four-frame storyboard, and right-side creation-memory panel must all be immediately understandable. Make the product feel purpose-built for AI manhua production. Keep the page bright but not washed out. Use consistent characters and scenes across thumbnails. Full UI must fit inside the image. No watermark.

Avoid: previous dark film-editor layout, timeline tracks, Premiere-like or DaVinci-like editing software, giant video preview, generic AI SaaS dashboard, statistic cards, purple or pink gradients, neon, black full-screen background, beige vintage paper, excessive rounded cards, glassmorphism, decorative blobs, giant marketing headlines, tiny illegible labels, random English, duplicated text, device mockup, promotional poster composition.
```

## 7. 生成边界

- 本次从零生成，不把 V2/V3 图片作为参考图，避免继承用户不喜欢的结构和色彩。
- 生成图只用于确认视觉方向；用户确认后，才能将其作为 React 页面实现基准。
- 如果生成图中文字存在少量 AI 字形误差，以本文件中的逐字文案为准。

## 8. 生成结果

- V4 设计图：[`manju-ai-production-studio-v4.png`](./manju-ai-production-studio-v4.png)
- 生成方式：Codex 内置 `imagegen`，全新生成，未引用 V2/V3 图片。
- 当前状态：视觉确认稿，尚未用于修改 React 页面。
