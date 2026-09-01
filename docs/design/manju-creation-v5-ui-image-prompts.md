# 漫剧创作 V5 全页面 UI 设计图提示词

> 文档状态：用户已否决暖灰编辑部配色；仅保留产品结构参考，不得作为后续视觉实现基准。
>
> 设计依据：当前 `Electron + React + Vite` 工程、用户明确的剧本/角色/分镜/配音/视频能力，以及“暂不接入 AI、先预留接口”的边界。
>
> 已排除方向：六步侧栏流水线、Premiere / DaVinci 式专业剪辑台、通用 AI SaaS 仪表盘。

# 项目设计分析

## 产品类型

- Windows 桌面端漫剧创作软件，最终以 EXE 形式安装运行。
- 不是单次生成器，也不是传统专业剪辑软件；它是围绕“剧集—场景—镜头—角色—台词”组织的故事生产空间。
- 第一版以本地项目、可编辑演示数据和服务适配器接口为核心，不调用付费 AI。

## 目标用户

- 个人漫剧创作者、短视频剧情作者、网文改编创作者、小型内容工作室。
- 有故事创意但不熟悉复杂剪辑软件，希望在一个应用内管理剧本、视觉设定、分镜、配音和镜头成片。

## 使用场景

- 从一句故事梗概创建新项目，拆分为剧集、场景和镜头。
- 建立角色档案、服装、表情、声音与关系设定，持续复用并避免角色漂移。
- 将剧本场景转换为可检查、可重排的分镜卡片。
- 为台词分配角色声音、试听节奏并检查缺失配音。
- 按镜头顺序检查画面、配音、字幕和视频状态，最后导出成片。
- 在未配置模型服务时使用本地演示模式；后续在设置中替换剧本、图片、配音、视频 Provider。

## 核心价值

- 以故事对象而不是模型名称组织工作，减少创作者在多个生成网站和文件夹之间来回切换。
- 让每个镜头都能追溯到剧本、角色、场景、台词和素材，形成连续性明确的项目数据。
- 先提供完整、可理解的本地工作流，再通过统一 Service Adapter 接入真实 AI。

## 产品边界

- 本轮设计覆盖：项目首页、项目总览、剧本编辑、角色设定、分镜板、配音台、视频成片、接口设置。
- 不设计账号登录、云端协作、在线支付、模型商城、社区广场和复杂多轨剪辑。
- 视频成片页只做镜头顺序、字幕/配音检查、转场与导出，不模拟 Premiere 的多轨专业工作区。

# 用户画像

## 画像 A：个人剧情创作者

- 年龄：20–38 岁。
- 职业：短视频博主、网文作者、自由创作者、AI 内容创作者。
- 使用习惯：先写故事梗概，再逐步补角色和分镜；经常重复生成同一人物；偏好可视化卡片和明确的完成状态。
- 痛点：工具分散、角色不一致、素材命名混乱、不会专业剪辑、无法快速知道哪个镜头缺图或缺配音。

## 画像 B：小型漫剧工作室成员

- 年龄：22–42 岁。
- 职业：编剧、分镜师、配音/后期兼岗人员、内容负责人。
- 使用习惯：按剧集推进，重视版本、设定一致性和交付检查；需要快速定位待处理镜头。
- 痛点：信息在文档、图片文件夹和剪辑工程之间断裂；修改角色设定后难以判断受影响镜头。

# 产品视觉方向

## 方向名称：故事制片桌 / Story Production Desk

## 设计关键词

- 编辑部式、故事优先、清晰、温和、专业、可长时间使用、轻电影感、可触摸的纸张层级、精确的桌面工具感。

## 视觉理由

- 使用“剧集封面、剧本页、角色档案、分镜卡、台词条、镜头带”等真实创作隐喻，用户不必理解模型术语。
- 主框架采用暖灰白和墨蓝，内容缩略图承担色彩；少量朱橙用于“生成/继续/导出”等创作动作。
- 页面按工作对象切换，每页只有一个主要任务；避免将所有步骤塞在同一个大工作台。
- 顶部使用项目级横向导航，不使用六步编号侧栏；局部左栏只展示当前页面需要的剧集、场景或角色树。
- 视频页采用镜头序列带，不使用多轨时间线、音频波形墙或专业剪辑软件式密集按钮。

## 画布与布局基准

- 主设计画布：`1600 × 1000 px`，16:10 桌面窗口，完整应用画面，不包含电脑外壳。
- 最小窗口：`1180 × 760 px`；低于该尺寸时右侧检查器改为抽屉。
- 顶部应用栏：`64 px`，约占页面高度 `6.4%`。
- 项目导航栏：`48 px`，约占页面高度 `4.8%`。
- 内容区：约占页面高度 `88.8%`；页面内部采用 `240 px` 上下文栏 + 自适应主画布 + `300 px` 可选检查器。
- 间距基线：`4 / 8 / 12 / 16 / 24 / 32 px`。

## 必须避免

- 六步编号侧栏、巨大流程 Stepper、统计卡片仪表盘。
- Premiere、DaVinci、Final Cut 式专业多轨时间线和密集工具图标。
- 大面积纯黑、霓虹紫粉渐变、玻璃拟态、营销页 Hero、漂浮装饰球。
- 每块内容都做成大圆角卡片；无意义英文标题；把模型名称当作主导航。

# 页面列表

| 页面 | 页面目标 | 核心模块 | 布局 | 核心交互 | 视觉重点 |
| --- | --- | --- | --- | --- | --- |
| 项目首页 | 创建和继续漫剧项目 | 最近项目、项目封面、新建项目、示例项目 | 左侧品牌引导 + 右侧封面书架 | 新建、打开、搜索、固定 | 像创作书架，不像后台列表 |
| 项目总览 | 看清一部漫剧的故事与当前制作状态 | 项目封面、故事简介、剧集卡、待处理镜头、角色速览 | 顶部项目导航 + 中央剧集画布 + 右侧下一步 | 进入剧集、继续上次编辑、添加剧集 | 用内容和缩略图表达进度，不用统计图表 |
| 剧本编辑 | 将主题整理为剧集、场景和可拍摄台词 | 剧集树、场景编辑器、角色台词、旁白、节奏提示 | 左侧结构树 + 中央纸页编辑器 + 右侧场景信息 | 新增场景、拆分台词、标记角色、模拟生成 | 专注写作、中文长文本易读 |
| 角色设定 | 建立可复用角色视觉与声音档案 | 角色列表、主视觉、外观锚点、表情/服装、声音档案、关系 | 左侧角色索引 + 中央角色档案 + 右侧一致性规则 | 新建角色、锁定设定、导入参考图、试听占位 | 像角色设定集，不像图片图库 |
| 分镜板 | 把场景拆成镜头并检查连续性 | 场景条、分镜卡、景别、运镜、台词、角色/场景引用 | 顶部场景切换 + 中央可重排网格 + 右侧镜头检查器 | 拖动排序、拆分/合并、锁定连续性、模拟生成 | 大图卡片和镜头叙事顺序 |
| 配音台 | 按台词分配声音并检查节奏 | 角色声音、台词列表、情绪、语速、试听、缺失状态 | 左侧说话人 + 中央台词清单 + 底部试听条 + 右侧参数 | 批量分配、单句试听、重置、标记确认 | 清晰的台词与说话人，不做专业音频 DAW |
| 视频成片 | 按镜头序列检查并导出成片 | 预览、镜头序列带、字幕开关、转场、配音状态、导出检查 | 左侧大预览 + 右侧导出检查 + 底部单层镜头带 | 播放、重排镜头、选择转场、导出演示 | 简单成片检查，不做多轨剪辑器 |
| 接口设置 | 为后续真实 AI 接入配置统一适配器 | 剧本/图片/配音/视频 Provider 卡、密钥状态、测试、模型映射 | 设置侧栏 + 四类接口卡 + 日志抽屉 | 选择适配器、保存本地配置、连接测试 | 明确显示“未配置/演示模式”，不暴露密钥 |

# UI设计Prompt

--------------------------------
页面名称：项目首页

Prompt：

Design a high-fidelity Windows desktop application screen for a Chinese manhua-drama creation product named “漫剧创作”. Product type: local-first story production desktop software, not a web dashboard. UI Design: a calm editorial story library where creators begin or resume projects. Layout: a 1600×1000 full-bleed application window with a compact 64px top bar, a distinctive brand block on the upper left, a search field and small settings button on the upper right, a narrow 300px welcome column, and a large project bookshelf area using cinematic cover tiles in a spacious asymmetric grid. Components: primary button “新建漫剧”, secondary button “导入项目”, recent project covers with title, episode count, last edited time and subtle local-save status, one empty new-project tile, a pinned-project marker, and a small offline mode badge. Style: editorial production notebook meets modern Windows creative software; warm cloud-gray surfaces, ink-navy typography, muted paper layers, cobalt selection and restrained vermilion creative actions; crisp borders, 6–10px radii, no glassmorphism. Lighting: soft neutral daylight, matte surfaces, very subtle ambient shadow. Animation direction: project covers lift by 2px on hover, new-project tile reveals a short action row, reduced-motion compatible. Resolution: 1600×1000, orthographic straight-on app screenshot, complete interface visible, no device mockup. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Use only short readable labels such as “漫剧创作”, “最近项目”, “新建漫剧”, “导入项目”, “本地项目”. Avoid analytics cards, purple AI gradients, numbered workflow sidebar, timeline editor, marketing hero, random English, watermark.

--------------------------------
页面名称：项目总览

Prompt：

Create a polished Windows desktop UI for the project overview of “漫剧创作”, a local-first AI-ready manhua-drama production application. UI Design: content-led production overview organized around episodes, story and characters rather than statistics. Layout: 1600×1000 window; 64px global top bar with back-to-projects, project name “雾城回声”, local save status and export; a 48px horizontal project navigation with “总览 / 剧本 / 角色 / 分镜 / 配音 / 成片”; main canvas with a large project cover and concise story synopsis on the left, an episode board with three wide episode cards in the center, and a slim right column titled “接着创作” showing the most relevant unfinished scene. Components: episode cards with a cinematic thumbnail strip, episode title, scene count, compact readiness labels for script, storyboard, voice and video, character portrait row, button “继续创作”, and an unobtrusive “新增一集” tile. Style: story production desk, warm off-white and mist-gray foundation, ink navy text, cobalt active navigation, vermilion only for the current next action, matte paper-like layers, sharp content thumbnails. Lighting: balanced soft studio daylight with subtle depth. Animation direction: episode thumbnail strip gently crossfades on hover; progress labels update without layout shift. Resolution: 1600×1000 full application screenshot. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Only short labels, no paragraphs in generated text. Avoid dashboard metrics, charts, giant stepper, left workflow sidebar, professional video editor, dark neon UI, watermark.

--------------------------------
页面名称：剧本编辑

Prompt：

Design a production-ready Chinese screenplay editor screen for a Windows manhua-drama creation app called “漫剧创作”. Product type: story-to-screen desktop authoring software. UI Design: focused long-form writing environment with clear scene and dialogue structure, not a generic document editor. Layout: 1600×1000; compact top bar and horizontal project navigation; a 240px left scene tree grouped by episode; a generous central screenplay page around 760px wide with scene heading, action description, narrator block and color-coded character dialogue blocks; a 300px right inspector for scene location, time, involved characters, duration estimate and storyboard readiness. Components: buttons “新增场景”, “拆分台词”, “整理剧本”, editable scene title, character chips with tiny portraits, dialogue rows, narrator marker, unsaved change indicator, mock-generation badge “演示模式”, empty and error placeholders kept local to the editor. Style: modern editorial manuscript, warm paper-white central page on cool mist background, ink-navy text, cobalt selection, restrained vermilion for creative actions, subtle ruled guides, 6px panel radii. Lighting: clean daylight, no dramatic glow. Animation direction: selected scene slides into focus with a 160ms fade; dialogue insertion uses a short height expansion; reduced-motion supported. Resolution: 1600×1000 straight-on full UI. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Use short labels such as “第1集”, “场景 03”, “新增场景”, “整理剧本”, “演示模式”. Avoid AI chat bubbles, marketing copy, numbered workflow sidebar, timeline, purple gradients, watermark.

--------------------------------
页面名称：角色设定

Prompt：

Create a high-fidelity character bible screen for “漫剧创作”, a Windows desktop manhua-drama production app. UI Design: a visual character design dossier that combines appearance consistency, costume variants, expressions and voice identity. Layout: 1600×1000 with global top bar and horizontal project tabs; 220px left character index with portrait thumbnails and “新建角色”; central workspace dominated by one large character key visual and a structured dossier beneath it; right inspector with locked appearance anchors, voice profile and relationships. Components: character name “沈砚”, role badge “男主”, main portrait, front/side/detail reference tiles, appearance anchor chips for hairstyle, face, clothing and signature prop, expression sheet, costume variant cards, reference upload area, consistency lock, voice card with play button, relationship mini-map, buttons “导入参考图” and “保存设定”. Style: animation production character bible, restrained editorial grid, warm cloud-gray background, white and pale-blue paper layers, ink text, cobalt locks and vermilion create action, content imagery supplies most color. Lighting: soft neutral studio light, matte UI surfaces. Animation direction: switching character crossfades key art; lock toggles use a precise 140ms motion; portrait variants slide horizontally. Resolution: 1600×1000 full desktop UI, complete and uncropped. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Short readable labels only. Avoid generic image gallery, glass cards, excessive rounded cards, purple neon, six-step workflow, professional editing timeline, watermark.

--------------------------------
页面名称：分镜板

Prompt：

Design a high-fidelity storyboard planning screen for the Chinese Windows app “漫剧创作”. Product type: story-driven manhua-drama production software for non-professional creators. UI Design: a spacious visual storyboard wall, not a video editor. Layout: 1600×1000 with compact app header and horizontal project navigation; a 56px scene switcher below the navigation; central 3-column storyboard grid with six large 16:9 or 9:16 shot cards depending on project format; a collapsible 300px right shot inspector; no permanent left workflow sidebar. Components: shot number, image preview, one-line action note, dialogue excerpt, duration, shot size, camera motion, character and scene reference chips, continuity lock, useful marker, buttons “新增镜头”, “拆分镜头”, “生成画面”, drag handle, local empty-state illustration for missing image. Show coherent thumbnails of the same black-haired protagonist in a misty futuristic Chinese city, but keep UI dominant. Style: modern animation storyboard board, warm neutral canvas, ink navy structure, cobalt selected shot border, vermilion current-action accent, square paper-card proportions with small corner radius, clear hierarchy. Lighting: soft editorial daylight, subtle paper shadow only under dragged card. Animation direction: cards reflow smoothly during drag, selected shot expands details in the inspector, generation placeholder uses a thin progress line without flashing. Resolution: 1600×1000 complete desktop UI. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Avoid multitrack timeline, giant video preview, dashboard cards, numbered stepper, neon gradients, random English, watermark.

--------------------------------
页面名称：配音台

Prompt：

Create a polished Chinese voice production screen for “漫剧创作”, a Windows desktop manhua-drama creation application. UI Design: dialogue-centric voice assignment and audition workspace for everyday creators, deliberately simpler than a professional DAW. Layout: 1600×1000 with project header and horizontal navigation; a 220px left speaker column showing character portraits and voice readiness; a wide central dialogue list grouped by scene; a 300px right voice settings inspector; a compact 72px bottom audition bar. Components: rows with speaker portrait, character name, editable dialogue text, emotion tag, duration estimate, status “未配音 / 待确认 / 已确认”, play button, retry placeholder, batch select; right settings for voice profile, emotion, speed, pitch and pause; buttons “批量分配”, “试听本句”, “生成配音”; obvious badge “接口未配置”; bottom bar with play/pause, sentence position and simple waveform thumbnail, not a full audio track. Style: clean editorial voice script, cloud gray and paper white surfaces, ink navy typography, cobalt active speaker, muted mint confirmed state, vermilion primary action. Lighting: soft neutral, high legibility, no glow. Animation direction: active dialogue row gains a subtle left accent; audition progress moves linearly; status change fades in without shifting columns. Resolution: 1600×1000 full application view. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Avoid professional mixer, complex waveforms, multitrack DAW, dark neon panels, workflow sidebar, watermark.

--------------------------------
页面名称：视频成片

Prompt：

Design a high-fidelity final assembly screen for the Windows application “漫剧创作”. Product type: simple manhua-drama sequence review and export tool, not professional nonlinear editing software. UI Design: calm review room focused on story order and completeness. Layout: 1600×1000 with app header and horizontal project navigation; a large 820×520 preview area on the left showing a vertical 9:16 manhua frame centered on a soft charcoal viewing surface; a 320px right export checklist; a single-layer horizontal shot sequence ribbon across the bottom with eight large thumbnails. Components: preview play controls, timecode, subtitle toggle, volume, aspect ratio, shot title, sequence thumbnails with simple duration and status, drag-to-reorder handle, transition dropdown between cards, retained-last-frame indicator, checklist items for image, voice, subtitle and video readiness, export preset “竖屏 1080×1920”, buttons “预览全片” and “导出成片”, disabled export state when provider is not configured. Style: modern cinematic review workspace embedded in a warm editorial app shell; neutral cloud-gray panels, ink text, charcoal only behind the preview, cobalt selection, vermilion export action, crisp dividers and minimal radii. Lighting: controlled neutral studio light; preview area visually isolated without making the whole app dark. Animation direction: shot ribbon scroll snaps, playhead moves smoothly, transition preview uses a short crossfade. Resolution: 1600×1000 complete UI. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Avoid multi-track timeline, scissors/tool overload, Premiere layout, giant analytics, purple neon, watermark.

--------------------------------
页面名称：接口设置

Prompt：

Create a trustworthy Windows desktop settings screen for “漫剧创作”, showing reserved AI service adapters without connecting to real providers. UI Design: clear local-first integration management with strong privacy cues. Layout: 1600×1000; standard app top bar; a 220px settings navigation on the left with “通用 / 项目存储 / AI 接口 / 导出”; main content titled “AI 接口” with four stacked adapter sections for script, image, voice and video; a 300px right help panel explaining demonstration mode and local secret storage. Components: adapter cards labeled “剧本服务”, “图片服务”, “配音服务”, “视频服务”; provider dropdown, model mapping field, endpoint field, masked API key field, local-storage lock icon, status badge “未配置”, buttons “保存配置” and “测试连接”, dry-run explanation, compact connection log drawer, reset confirmation modal preview. Style: precise settings UI, warm gray background, white structured sections, ink navy text, cobalt focus, amber warning, muted green success, restrained vermilion only for destructive reset; no decorative AI imagery. Lighting: flat neutral software lighting, crisp borders. Animation direction: connection test shows an inline progress indicator; log drawer slides from the bottom; sensitive values never reveal on hover. Resolution: 1600×1000 full application screenshot. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Use short labels only. Avoid exposed real keys, cloud billing visuals, glowing AI icons, generic SaaS pricing page, numbered workflow sidebar, watermark.

# Design System

## Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `canvas` | `#F3F4F2` | 应用背景，轻微暖灰 |
| `surface` | `#FFFFFF` | 主编辑面、设置面板 |
| `surface-muted` | `#E9ECEA` | 次级区域、上下文栏 |
| `paper` | `#FBFAF7` | 剧本页、档案纸张层 |
| `ink` | `#18212B` | 主文字、主要图标 |
| `ink-muted` | `#66717D` | 次级说明 |
| `line` | `#D7DCDA` | 分割线、普通边框 |
| `cobalt` | `#2457D6` | 选中、焦点、导航激活 |
| `cobalt-soft` | `#E8EEFF` | 选中背景 |
| `vermilion` | `#E15A3A` | 生成、继续、导出等主要创作动作 |
| `mint` | `#3F8C71` | 完成、已确认、连接成功 |
| `amber` | `#B87918` | 未配置、待确认、风险提示 |
| `danger` | `#C83B3B` | 删除、真实错误 |
| `preview-charcoal` | `#25282D` | 仅用于视频预览的影院底色 |

## Typography

- 中文：`Microsoft YaHei UI / PingFang SC / Noto Sans SC / Segoe UI`。
- 时间码和镜头编号：`Cascadia Mono / SFMono-Regular / Consolas`。
- 页面标题：`26px / 34px / 700`。
- 区块标题：`16px / 24px / 600`。
- 正文：`14px / 22px / 400`。
- 辅助文字：`12px / 18px / 400`，不得再缩小。
- 剧本文本：`15px / 26px / 400`；角色名 `13px / 20px / 700`。

## Component System

### Navigation

- 顶部全局栏承载产品、项目切换、本地保存、设置。
- 横向项目导航只显示：`总览 / 剧本 / 角色 / 分镜 / 配音 / 成片`。
- 当前项使用文字、底部 `2px` 线和 `aria-current` 共同表达，不用胶囊大底色。

### Button

- 主按钮高度 `40–44px`，朱橙底色，页面每次只出现一个最强主按钮。
- 次按钮白底 `1px` 边框；图标按钮最小点击区 `36×36px`。
- loading、disabled、pressed、focus-visible 必须都有稳定样式，不因文案变化改变宽度。

### Card

- 卡片只用于项目封面、角色档案、分镜和剧集等“真实内容对象”。
- 工具区优先使用连续面板和分割线，避免“万物卡片化”。
- 内容卡圆角 `6–8px`；浮层圆角 `10px`。

### Avatar

- 角色头像 `32 / 40 / 56px` 三档；无图时使用名字首字和角色色块，不显示破图。
- 头像旁始终显示角色名，不能只靠面孔辨认。

### Modal

- 仅用于删除、重置接口、关闭未保存项目等风险动作。
- 宽度 `420–520px`；标题、影响说明、取消和确认顺序固定。

### List

- 剧集、场景、台词使用结构化列表；行高不低于 `48px`。
- selected、hover、keyboard focus 三种状态必须区分。

### Feed / Activity

- 项目不设置社交 Feed。
- 最近操作只作为项目总览中的短列表，最多显示五条，避免变成日志后台。

### StoryboardCard

- 图片占卡片高度 `58–64%`；下方为镜头号、动作说明、台词和时长。
- 锁定、缺图、缺配音同时使用图标和文字，不只改变颜色。

### DialogueRow

- 固定包含说话人、台词、情绪、时长、状态和试听动作。
- 长台词最多显示三行，展开在行内完成。

### SequenceRibbon

- 单层镜头带，只支持排序、转场、状态和播放定位。
- 不引入专业剪辑工具、轨道混音、关键帧或复杂波形。

## 状态与适配

- loading：局部细进度条或骨架，禁止整页遮罩闪烁。
- empty：说明该区域用途，并提供唯一下一步按钮。
- error：靠近失败对象显示原因和重试；全局仅保留简短通知。
- disabled：保持可读边界，并说明“接口未配置”等禁用原因。
- selected：钴蓝描边/左标记 + 文字状态。
- pressed：下移 `1px` 或背景加深，不做缩放弹跳。
- permission denied：本地文件选择失败时提供“重新选择目录”与隐私说明。
- 长文本：剧本和台词允许展开；导航和对象名使用省略号并提供 title。
- 小屏：`1180–1359px` 收起右侧检查器；`<1180px` 显示不支持提示，不强行压缩为移动端。
- 暗色模式：首版可暂不提供完整暗色主题；视频预览保持局部深色。
- 横竖屏：桌面横屏主场景；素材画幅可为 `9:16 / 16:9 / 1:1`，不改变应用外壳方向。
- 安全区：Electron 内容区不覆盖系统标题栏；自定义标题栏时保留 Windows 拖拽区和窗口控制区。
- 无障碍：键盘可达、焦点可见、正文对比度至少 `4.5:1`、状态不只依赖颜色。

# 中文文案表

## 项目首页

| 类型 | 文案 |
| --- | --- |
| 标题 | 漫剧创作 |
| 区块 | 最近项目、本地项目 |
| 按钮 | 新建漫剧、导入项目、打开项目 |
| 搜索 | 搜索项目名称 |
| 空态 | 还没有漫剧项目，从一个故事开始吧 |
| 错误 | 项目文件无法读取，请检查文件位置 |

## 项目总览

| 类型 | 文案 |
| --- | --- |
| 导航 | 总览、剧本、角色、分镜、配音、成片 |
| 标题 | 雾城回声 |
| 区块 | 故事简介、剧集、主要角色、接着创作 |
| 按钮 | 继续创作、新增一集、编辑简介 |
| 状态 | 剧本已完成、分镜待补充、配音未开始、视频未生成 |

## 剧本编辑

| 类型 | 文案 |
| --- | --- |
| 标题 | 剧本 |
| 按钮 | 新增场景、拆分台词、整理剧本、保存修改 |
| 标签 | 场景、旁白、角色台词、时间、地点 |
| 空态 | 本集还没有场景 |
| 错误 | 剧本内容保存失败，请重试 |
| 模式 | 演示模式，暂未连接剧本服务 |

## 角色设定

| 类型 | 文案 |
| --- | --- |
| 标题 | 角色设定 |
| 区块 | 主视觉、外观锚点、表情、服装、声音、人物关系 |
| 按钮 | 新建角色、导入参考图、锁定设定、保存设定、试听声音 |
| 空态 | 还没有角色，先建立故事中的第一位人物 |
| 错误 | 参考图读取失败，请重新选择 |

## 分镜板

| 类型 | 文案 |
| --- | --- |
| 标题 | 分镜板 |
| 按钮 | 新增镜头、拆分镜头、生成画面、重新排序 |
| 标签 | 景别、运镜、时长、角色、场景、连续性 |
| 状态 | 待生成、已锁定、缺少角色、缺少场景 |
| 空态 | 当前场景还没有镜头 |
| 错误 | 分镜保存失败，排序已恢复 |

## 配音台

| 类型 | 文案 |
| --- | --- |
| 标题 | 配音台 |
| 按钮 | 批量分配、试听本句、生成配音、标记确认 |
| 标签 | 说话人、台词、情绪、语速、音调、停顿 |
| 状态 | 未配音、待确认、已确认、接口未配置 |
| 空态 | 当前场景没有可配音台词 |
| 错误 | 试听失败，请检查配音接口设置 |

## 视频成片

| 类型 | 文案 |
| --- | --- |
| 标题 | 视频成片 |
| 按钮 | 预览全片、导出成片、重新排序 |
| 标签 | 字幕、音量、转场、画面比例、分辨率 |
| 检查 | 画面完整、配音完整、字幕完整、视频已生成 |
| 禁用说明 | 视频接口未配置，暂不能生成或导出真实成片 |
| 错误 | 存在未完成镜头，请先处理后再导出 |

## 接口设置

| 类型 | 文案 |
| --- | --- |
| 标题 | AI 接口 |
| 分类 | 剧本服务、图片服务、配音服务、视频服务 |
| 字段 | 服务商、模型、服务地址、API Key |
| 按钮 | 保存配置、测试连接、恢复默认 |
| 状态 | 未配置、测试中、连接成功、连接失败 |
| 说明 | 密钥仅保存在本机，不会写入项目文件 |
| 弹窗 | 确定恢复默认接口设置吗？ |

# 设计生成与实现边界

- 设计图只验证页面结构、视觉层级、组件风格和信息密度。
- 图片模型中的中文只使用本文件要求的短标题、导航、按钮和标签；长文案以本文件中文文案表为准。
- 第一版真实实现仍保持本地演示模式；所有“生成”动作调用统一的 mock Service Adapter。
- 后续 Provider 接入应覆盖：Script Provider、Image Provider、Voice Provider、Video Provider；UI 不直接依赖具体厂商模型名。
- 设计确认前不修改 `src/App.jsx`、`src/App.css`、`src/index.css` 或 Electron 主进程。

# 等待确认

请确认是否基于本 V5 提示词进入下一阶段：

1. 生成全页面设计图；
2. 进入 Figma 设计阶段；
3. 进入 React + Electron 开发阶段；
4. 仅继续调整设计提示词。
