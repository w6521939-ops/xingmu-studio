# 漫剧创作 V8 创作启动台设计基准

> 状态：用户已确认首页母版；八张全页面设计图均已生成并保存。
>
> 继承 V7 的渐变天蓝色毛玻璃视觉，只重构页面布局与信息层级。

# 1. 布局问题诊断

- V7 首页以两排竖向项目封面为主，更像图片管理器，不像漫剧生产工具。
- 左侧欢迎栏占用约五分之一宽度，却只承载两个按钮，信息效率低。
- “新建漫剧”与真实创作输入分离，用户仍需先建空项目再填写故事。
- 最近项目全部同权，没有突出“继续上次制作”的最高频任务。
- 竖向海报网格抢占首屏，剧本、分镜、配音和视频的产品能力没有被表达。

# 2. 新布局方向：创作启动台

## 页面目标

用户打开软件后立即完成两件事之一：输入一句故事创建新漫剧，或继续上次未完成项目。

## 页面骨架

```text
CreationLaunchpad
├── GlobalTopBar (64px)
│   ├── Brand
│   ├── GlobalNavigation: 创作 / 项目 / 素材
│   ├── Search
│   ├── Settings
│   └── WindowControls
├── MainWorkspace
│   ├── LaunchRow (420px)
│   │   ├── StorySeedCanvas (62%)
│   │   │   ├── Title: 从一个故事开始
│   │   │   ├── StoryTextarea
│   │   │   ├── GenreChips
│   │   │   ├── FormatControls
│   │   │   └── CreateAction
│   │   └── ContinueProject (38%)
│   │       ├── ProjectPreview
│   │       ├── CurrentEpisode
│   │       ├── ProductionStatus
│   │       └── ContinueAction
│   ├── RecentProjectsFilmstrip
│   │   ├── SectionHeader
│   │   └── LandscapeProjectCard[4]
│   └── InspirationTemplates
│       ├── TemplateCard[4]
│       └── ImportProject
└── LocalModeStatus
```

## 比例

- 顶栏：`64px`，约占页面高度 `6.4%`。
- 工作区：左右内边距 `28px`，顶部 `24px`，底部 `20px`。
- 首行启动区：高度约 `400–420px`；故事输入 `62%`，继续项目 `38%`。
- 最近项目：高度约 `230px`，使用四张横向 `16:9` 卡片，不使用竖向海报墙。
- 灵感模板：高度约 `150px`，使用紧凑横向卡片，主要展示题材和视觉标签。

# 3. 交互重点

- 故事输入是全页第一视觉层级，支持输入一句故事或粘贴已有梗概。
- 创建前只要求题材、画幅和预计时长；其他设置进入项目后补充。
- “继续创作”只展示最近一个未完成项目，明确当前集和下一步。
- 最近项目按最后编辑时间排序，鼠标悬停显示打开、固定和项目目录。
- “导入项目”降级为最近项目区的次按钮，不与创建动作竞争。
- 演示模式在页面右下角显示简短状态，不占据主要内容。

# 4. V8 首页生成提示词

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI master mockup
Input image: style reference only. Inherit its bright sky-blue gradient palette, premium white frosted-glass materials, deep-blue Chinese typography, glass borders and soft blue shadows. DO NOT copy its left welcome column, poster grid or page layout.
Primary request: Create a completely NEW PROJECT HOME LAYOUT for a Chinese manhua-drama creation app named “漫剧创作”. This page is a creation launchpad, not a project gallery and not a dashboard.
Scene/backdrop: full-bleed 1600×1000 Windows desktop app, straight orthographic front view, complete uncropped UI.
Global top bar: 64px; brand “漫剧创作” on the left; three compact global navigation items “创作”, “项目”, “素材”; search, settings and Windows controls on the right. “创作” is active with a thin sky-blue gradient underline.
Main layout: generous 28px page padding. First row is 420px high with two large frosted-glass regions. Left region is 62% width and is the dominant STORY SEED CANVAS titled “从一个故事开始”; include a wide multi-line story input containing a short Chinese story seed, compact genre chips “古风 / 悬疑 / 科幻 / 都市”, controls “9:16” and “60秒”, and one strong gradient button “创建新漫剧”. Right region is 38% width and is “继续创作”; include one large 16:9 cinematic project preview for “雾城回声”, current episode “第2集 暗流涌动”, four compact readiness labels “剧本 / 分镜 / 配音 / 视频”, and button “继续制作”.
Second row: section “最近项目” with four compact horizontal landscape project cards in one filmstrip row, each showing thumbnail, title, episode count and last edited time. No tall poster cards and no second row grid.
Third row: compact “灵感模板” strip with four small content cards “古风悬疑 / 未来都市 / 甜宠日常 / 热血冒险” plus a subtle “导入项目” action.
Style: bright sky-blue gradient from #F4FBFF through #D7F1FF and #A9E1FF to #74CAFF; premium white frosted glass with 22–30px blur, rgba(255,255,255,.46) fill, bright glass edge, inner highlight and soft blue shadow; deep blue #12324B text; sky-blue gradient primary actions #8DD9FF to #48B9FA to #198FDC; visible but restrained technical grid and atmospheric light.
Text (verbatim): “漫剧创作”, “创作”, “项目”, “素材”, “从一个故事开始”, “创建新漫剧”, “继续创作”, “雾城回声”, “第2集 暗流涌动”, “剧本”, “分镜”, “配音”, “视频”, “继续制作”, “最近项目”, “灵感模板”, “导入项目”, “古风”, “悬疑”, “科幻”, “都市”, “9:16”, “60秒”.
Constraints: Simplified Chinese desktop UI, story input is the strongest visual focus, one dominant CTA, readable glass surfaces, mature creative-tool layout, complete interface visible.
Avoid: left welcome sidebar, two-row poster gallery, dashboard statistics, charts, giant marketing hero, six-step workflow sidebar, large stepper, multitrack timeline, dark navy, purple, pink, green, warm beige, opaque white cards, random English, device frame, watermark.
```

# 5. 项目内页面布局原则

- 项目内页面统一使用顶部项目导航：`总览 / 剧本 / 角色 / 分镜 / 配音 / 成片`。
- 不设置固定六步流程侧栏；左侧上下文栏只在剧本、角色、配音等需要对象索引的页面出现。
- 每个页面最多保留一个右侧检查器，并允许折叠。
- 分镜使用可重排画面板；配音使用台词清单；成片使用单层镜头带，不引入专业多轨编辑器。
- 所有页面继续沿用 V7 的天蓝色渐变毛玻璃设计系统。

# 6. 生成门禁

1. 先生成 V8 创作启动台首页。
2. 用户确认布局后，再以该图作为其余七页的布局和视觉母版。
3. 最终文件使用 `manju-v8-launchpad-*` 命名，不覆盖历史版本。

# 7. 最终设计图

- [项目首页](./manju-v8-launchpad-project-home.png)
- [项目总览](./manju-v8-launchpad-project-overview.png)
- [剧本编辑](./manju-v8-launchpad-script-editor.png)
- [角色设定](./manju-v8-launchpad-character-bible.png)
- [分镜板](./manju-v8-launchpad-storyboard.png)
- [配音台](./manju-v8-launchpad-voice-studio.png)
- [视频成片](./manju-v8-launchpad-final-assembly.png)
- [接口设置](./manju-v8-launchpad-ai-interface-settings.png)
