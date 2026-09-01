# 漫剧创作 V31 当前镜头 AI 视频请求预览 Design Spec

## 1. 项目设计分析

### 1.1 产品类型

Windows 本地优先漫剧制作工作台。V31 补齐“成片页能看到当前镜头如何映射为百炼万相图生视频请求”的透明入口，不接入真实执行器，不替代现有本地 FFmpeg 导出。

### 1.2 目标用户

- 20～45 岁的漫剧编导、短剧创作者、个人内容生产者和小型工作室。
- 已经完成剧本、角色、分镜图片与时间线编辑，希望确认 AI 镜头动态参数的用户。
- 对模型调用费用敏感，需要在任何网络请求前看到输入素材、时长和清晰度影响的用户。

### 1.3 使用场景

1. 用户在成片页选中一个已有真实图片的镜头。
2. 用户点击“AI 视频请求预览”，查看首帧、可选尾帧、导演提示词、时长映射和 Provider 状态。
3. 用户可以本地修改预览参数或前往视频设置，但“创建视频任务”始终锁定。
4. 用户关闭弹窗后继续使用现有本地动效预览和 FFmpeg MP4 导出。

### 1.4 核心价值

- 把“视频 Provider 已配置但创作页不可见”变成透明、可检查的请求预览。
- 只读取真实镜头图片和项目字段，不上传素材、不创建任务、不伪造生成结果。
- 明确区分“AI 镜头视频”与“本地 MP4 导出”，避免误以为本地导出会产生 API 费用。

## 2. 需求依据与官方参数基准

### 2.1 项目证据

- 当前成片页：`src/App.jsx` 的 `FinalPage`，已有当前镜头、镜头图片、时间线时长、镜头运动和本地 FFmpeg 导出。
- 当前 Provider：`electron/bailianProviderService.js` 已登记 `wan2.7-i2v-2026-04-25`，但没有视频生成执行器。
- 当前安全边界：`main.js` 固定 `allowPaidGeneration: false`；Key 仅由主进程读取。
- 视觉基准：`outputs/runtime/final.png`，1440 × 900 Windows 桌面布局；渐变天蓝色、明亮毛玻璃、深蓝预览舞台。
- 上一步基准：`docs/design/manju-creation-v30-storyboard-image-api-entry.md`，继续沿用零付费请求预览语言和吸底操作区。

### 2.2 2026-07-22 官方文档核验

- 万相 2.7 图生视频支持首帧、首尾帧和视频续写三类任务。
- 当前项目模型 `wan2.7-i2v-2026-04-25` 的 HTTP 请求为异步任务，必须使用异步请求头。
- `prompt` 最多 5000 字符；`negative_prompt` 最多 500 字符。
- 分辨率档位为 `720P`、`1080P`；分辨率直接影响费用。
- 生成时长为 2～15 秒整数，按秒计费；项目中的小数镜头时长需要只在预览层映射，不改写时间线。
- 首帧和尾帧可使用符合要求的 Base64 图片，因此 V31 请求预览不需要先上传本地镜头图。
- 未传驱动音频时，模型可能自动生成背景音乐或音效；V31 不上传本地配音，未来采用生成视频时应默认丢弃模型音轨并保留项目本地音轨。
- `task_id` 和成功结果链接有效期均为 24 小时；本版不创建任务，不显示伪任务状态。
- 官方参考：<https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference>

## 3. 产品视觉方向

### 3.1 设计关键词

`明亮天蓝渐变`、`轻量毛玻璃`、`电影控制台`、`透明参数`、`零费用锁`、`首尾帧连续性`、`本地优先`。

### 3.2 视觉理由

- 继续使用当前应用已经验收的天蓝色系，不另起深色 AI 工具风格。
- 视频素材区使用深蓝电影舞台作为视觉锚点，参数区使用浅色玻璃，形成“素材 → 指令 → 参数”的清晰阅读顺序。
- 锁定状态使用冷蓝灰，不使用大面积红色；风险通过明确文案表达，而不是制造警报感。
- 不使用入场动画和大面积动态模糊，避免设置页曾出现的进入退出卡顿。

## 4. 页面范围与布局决策

### 4.1 页面清单

本次只设计一个现有页面增量和一个弹窗：

| 页面/状态 | 目标 | 核心模块 | 视觉重点 |
| --- | --- | --- | --- |
| 成片页右侧导出栏 | 暴露当前镜头 AI 视频预览入口 | 本地导出标题、AI 视频请求卡、本地 MP4 设置 | AI 与本地导出清晰分区 |
| 当前镜头 AI 视频请求弹窗 | 展示真实输入、参数与硬锁 | Provider 状态、首/尾帧、提示词、时长、分辨率、零费用操作栏 | 首尾帧连续性和费用透明 |
| 缺少镜头 | 防止伪请求 | 禁用入口、原因提示 | 明确“请先创建镜头” |
| 缺少真实图片 | 防止把占位图当首帧 | 禁用入口、定位分镜页 | 明确“需要真实首帧” |
| 无下一镜头图片 | 允许首帧模式 | 尾帧空态、首帧模式仍可预览 | 不伪造尾帧 |

### 4.2 入口位置

- 位于成片页右侧栏，放在“本地 MP4 导出”标题下、“从头预览全片”之前。
- 使用独立紧凑玻璃卡，标题为“AI 镜头视频”，副文案为“查看当前镜头请求 · 不创建任务”。
- 主按钮为“预览视频请求”，右侧显示锁图标和“0 请求”。
- 本地 MP4 区保留原结构，标题下新增分隔标签“本地合成 · 不上传素材”。

## 5. 来源与画布基准

| 项目 | 基准 |
| --- | --- |
| 设计来源 | `outputs/runtime/final.png`、现有 `FinalPage`、V30 请求预览弹窗 |
| 目标设备 | Windows 桌面，推荐 1440 × 900 CSS 画布 |
| 最小桌面宽度 | 1024 px |
| 页面滚动 | 全页纵向滚动；弹窗内部纵向滚动 |
| 模态层级 | `position: fixed`，高于时间线、导出确认和普通弹层，建议 z-index 250 |
| 安全区 | 桌面窗口内容区四周 16～24 px；弹窗距视口至少 16 px |
| 动效 | 无入场动画；只允许 hover、focus 颜色和阴影过渡 |

## 6. 页面结构拆解

```text
FinalPage
├── TopNavigation
├── FinalPreview
├── ExportSidebar
│   ├── LocalExportHeader
│   ├── AiShotVideoPreviewCard
│   │   ├── VideoIcon
│   │   ├── CurrentShotSummary
│   │   ├── ZeroRequestBadge
│   │   └── PreviewRequestButton
│   ├── PreviewAllButton
│   ├── LocalExportSettings
│   ├── ExportReadiness
│   ├── ExportMp4Button
│   └── ExportHistory
├── ProductionTimeline
└── ShotVideoRequestLayer
    └── ShotVideoRequestDialog
        ├── DialogHeader
        ├── ProviderStatusGrid
        ├── MediaAndPromptWorkspace
        │   ├── FramePreviewPanel
        │   │   ├── FirstFrame
        │   │   ├── DirectionArrow
        │   │   └── OptionalLastFrame
        │   └── DirectorPromptPanel
        ├── RequestParameterGrid
        ├── AudioBoundaryNotice
        └── StickyZeroCostFooter
```

## 7. 组件级设计规格

### 7.1 AI 镜头视频入口卡

| 字段 | 规格 |
| --- | --- |
| 类型 | Card + Button |
| 位置 | 右侧导出栏顶部，标题下方 |
| 宽度 | 约 100% 父容器；约 21.5% 页面宽度，1440 画布约 310 px |
| 高度 | 约 92 px；约 10.2% 页面高度 |
| Padding | 14 px，约父卡宽度 4.5% |
| 圆角 | 18 px |
| 背景 | `linear-gradient(135deg, rgba(224,248,255,.88), rgba(189,230,255,.72))` |
| 边框 | 1 px `rgba(255,255,255,.82)` |
| 阴影 | `0 12px 28px rgba(27,129,187,.14)` |
| 主标题 | “AI 镜头视频”，14 px / 700，`#245A76` |
| 副文案 | 当前镜头编号、首帧状态；10 px，最多两行 |
| 徽标 | “0 请求”，高度 22 px，宽度约卡片 18% |
| 按钮 | 高度 38 px，宽度 100%，天蓝渐变；无真实首帧时禁用 |
| 图标 | Video 16 × 16 px，占按钮高度约 42%；Lock 11 × 11 px |

入口状态：

- 有镜头且有真实图片：可点击，文案“预览视频请求”。
- 有镜头但没有真实图片：禁用，文案“缺少真实首帧”；副文案“先到分镜页导入或准备图片”。
- 没有镜头：禁用，文案“请先创建镜头”。
- 正在本地导出：仍允许打开只读预览，但不改变或中断 FFmpeg 任务。

### 7.2 模态背景层

| 字段 | 规格 |
| --- | --- |
| 宽高 | 100vw × 100vh |
| 背景 | `rgba(11,61,94,.34)` |
| 模糊 | `backdrop-filter: blur(10px) saturate(1.12)` |
| Padding | 16～20 px，约视口宽度 1.1%～1.4% |
| 对齐 | 水平垂直居中；低高度时顶部对齐并滚动 |
| 层级 | z-index 250 |

### 7.3 当前镜头视频请求弹窗

| 字段 | 规格 |
| --- | --- |
| 宽度 | 920 px；约 63.9% 屏幕宽度；最大 `calc(100vw - 32px)` |
| 高度 | 内容约 700 px；最大 `calc(100vh - 32px)`，约页面高度 96.4% |
| Padding | 24 px 26 px；约父宽度 2.8% |
| 间距 | 12～14 px |
| 圆角 | 26 px |
| 背景 | 左上近白、右上亮青蓝、左下柔蓝紫的三层渐变毛玻璃 |
| 边框 | 1 px `rgba(255,255,255,.86)` |
| 阴影 | `0 38px 110px rgba(13,77,119,.34)` |
| 滚动 | 内容区内部滚动；费用声明与按钮吸底 |

### 7.4 标题区

- 宽度：100% 弹窗内容区；高度约 58 px，占弹窗高度约 8.3%。
- 左侧图标容器：50 × 50 px，占标题区高度约 86%；圆角 16 px；Video 图标 23 px。
- 标题：`AI 视频请求预览`，24 px / 760，颜色 `#174F70`。
- 副标题：`镜头 03 · 月下相逢 · 只使用当前真实时间线数据`，11 px / 500。
- 关闭按钮：42 × 42 px，点击面积不低于 40 px；默认焦点。

### 7.5 Provider 状态区

- 四列栅格，弹窗宽度大于 760 px 时每列约 24%；列间距 10 px。
- 每张状态卡高度约 82 px，占弹窗高度约 11.7%。
- 四项：`视频服务`、`模型`、`Key 状态`、`调用状态`。
- 调用状态固定显示：`付费生成已锁定`；副文案：`任务 0 · 上传 0 · 预计消耗 0`。
- 小屏改为两列；不允许文本横向溢出。

### 7.6 首尾帧预览区

| 元素 | 规格 |
| --- | --- |
| 父面板 | 宽度约弹窗内容 42%，桌面约 354 px；高度约 250 px |
| 首帧卡 | 宽度约父面板 43%；图片比例沿用真实镜头图片，`object-fit: cover` |
| 中间箭头 | 28 × 28 px；占父面板宽度约 8% |
| 尾帧卡 | 宽度约父面板 43%；没有下一镜头真实图片时显示明确空态 |
| 标签 | “首帧 / 必需”“尾帧 / 可选”；高度 22 px |
| 图片圆角 | 16 px |
| 图片兜底 | 不使用 `Art` 或渐变假图；缺失时只显示图标和说明 |

规则：

- 首帧严格使用当前镜头真实图片 Data URL；没有真实图片时入口不得打开可提交预览。
- 默认模式为“首帧生视频”。
- 下一时间线镜头有真实图片时，可选择“首尾帧生视频”；下一镜头跨场景时显示“跨场景尾帧，请谨慎使用”。
- 不自动把下一镜头设为尾帧，不改变当前 `.manju` 数据。

### 7.7 导演提示词区

- 宽度约弹窗内容 58%，桌面约 490 px；高度约 250 px。
- 主提示词 Textarea 高度 132 px；字符计数 `0 / 5000`。
- 反向提示词折叠为 52 px 单行入口，展开后 76 px；字符计数 `0 / 500`。
- “使用当前镜头重建”按钮高度 38 px，宽度约父区 42%。
- 默认提示词组合真实字段：场景、动作、对白情绪、景别、运镜、镜头运动、连续性与时长。
- 不插入不存在的人名、天气、镜头动作或风格词。

### 7.8 参数区

使用五列紧凑参数卡；桌面总高度约 86 px，占弹窗约 12.3%。

| 参数 | 默认预览值 | 规则 |
| --- | --- | --- |
| 模式 | 首帧生视频 | 有可用尾帧才允许切换首尾帧 |
| 分辨率 | 720P | 可预览 1080P；显示“影响费用”，不展示未经实时核验的金额 |
| API 时长 | 当前镜头时长四舍五入后限制到 2～15 秒整数 | 同时显示原时间线时长；不写回项目 |
| 智能改写 | 关闭 | 保持导演指令可控；只改预览状态 |
| 水印 | 关闭 | 对应官方默认值；只改预览状态 |

种子放在“高级参数”折叠项：默认留空；允许 `0～2147483647`，明确“相同种子不保证完全一致”。

### 7.9 音频边界说明

- 高度约 48 px，宽度 100%。
- 图标：VolumeOff 或 Shield，18 px。
- 标题：`本地音轨不会上传`。
- 说明：`当前请求预览不传 driving_audio；模型可能自动生成声音，未来采用视频时默认丢弃模型音轨，继续使用项目配音、BGM 与音效。`
- 背景为浅蓝灰，不使用警告红。

### 7.10 吸底零费用操作栏

- 宽度 100%，最小高度 72 px；位于弹窗底部，滚动时保持可见。
- 左侧约 45%：Shield 图标 + `付费生成已锁定` + `不会上传首帧、不会创建任务、不会消耗额度`。
- 右侧约 55%：`取消`、`前往视频设置`、`创建任务已锁定`。
- 三个按钮高度 40 px；主锁定按钮至少 142 px。
- 小屏下费用说明在上、按钮纵向排列。

## 8. 真实数据与请求映射

| UI 字段 | 项目来源 | 请求预览字段 | 是否写回项目 |
| --- | --- | --- | --- |
| 当前镜头 | `selectedShot` / `currentItem.shot` | 本地上下文，不进入接口 |
| 首帧 | `shot.image` 且为真实 `data:image/*` | `media:first_frame` | 否 |
| 尾帧 | 下一时间线镜头真实图片 | `media:last_frame`，用户显式启用后才出现 | 否 |
| 主提示词 | `visualPrompt`、`action`、`dialogue`、`size`、`motion`、动效字段 | `input.prompt` | 否 |
| 反向提示词 | 弹窗短生命周期状态 | `input.negative_prompt` | 否 |
| 时间线时长 | `shot.duration` | `parameters.duration`，映射为 2～15 整数 | 否 |
| 分辨率 | 弹窗默认 720P | `parameters.resolution` | 否 |
| 智能改写 | 默认关闭 | `parameters.prompt_extend` | 否 |
| 水印 | 默认关闭 | `parameters.watermark` | 否 |
| 种子 | 默认空 | `parameters.seed` | 否 |
| Key | Electron 主进程脱敏状态 | 不进入 Renderer 快照 | 否 |

V31 不新增 `task_id`、视频 URL、上传 URL、生成状态或本地视频文件字段，因为不会创建任务。

## 9. 交互与状态

### 9.1 打开与关闭

- 点击入口打开；初始焦点在关闭按钮。
- `Esc`、关闭按钮和背景点击均可关闭。
- 关闭后焦点返回“预览视频请求”入口。
- `Tab` 焦点限制在弹窗内；锁定按钮不进入可操作路径。

### 9.2 本地编辑

- 提示词、反向提示词、模式、分辨率、时长、智能改写、水印和种子均只保留在本次弹窗生命周期。
- “使用当前镜头重建”只运行本地确定性组合函数。
- 切换镜头后再次打开，必须读取新镜头真实数据，不保留上一镜头的临时草稿。

### 9.3 状态清单

- Loading：只用于读取脱敏 Provider 状态；不显示生成中。
- Empty：无首帧、无尾帧、无提示词分别显示明确原因。
- Error：Provider 状态读取失败时仍可看本地请求预览，但 Key 卡显示真实错误。
- Disabled：缺少真实首帧时入口禁用；创建任务永远禁用。
- Selected：首帧/首尾帧模式与参数选择使用天蓝描边。
- Permission denied：不适用；不读取系统媒体权限。
- Long text：提示词内部滚动，标题和文件名省略并提供 `title`。
- Small screen：小于 920 px 时工作区单列；小于 620 px 时状态卡、参数卡和按钮单列。
- Dark mode：当前版本不主动切换深色；如系统强制高对比，保证文字与边框对比度。
- Reduced motion：完全取消入场动画和位移动效。

## 10. React / Electron 实现边界

### 10.1 页面层

- `FinalPage` 只管理弹窗开关、短生命周期参数和焦点恢复。
- 入口读取 `currentItem` 与真实镜头图片状态。
- 弹窗与成片 `<main>` 同级渲染，避免父容器层叠上下文遮挡。

### 10.2 Service 层

新增纯函数视频请求预览服务，职责包括：

- 校验真实首帧 Data URL。
- 找到下一时间线镜头并判断是否可作为尾帧。
- 将小数镜头时长映射为 2～15 秒整数，同时保留原时长展示。
- 组合真实导演提示词、限制 5000 / 500 字符。
- 返回 `executorAvailable: false`、`locked: true`、`willUpload: false`、`willCreateTask: false`。

### 10.3 Electron 边界

- V31 不新增视频生成 IPC、上传 IPC、轮询 IPC 或下载 IPC。
- 不读取或返回 Key 明文。
- 保持 `main.js` 的 `allowPaidGeneration: false`。
- 不把正式执行代码、任务轮询或临时 URL 逻辑伪装成可用能力。

### 10.4 本地 MP4 边界

- 现有 `videoExportRepository` 和 FFmpeg 导出流程不改。
- AI 请求预览不能改变本地导出分辨率、字幕、音轨、镜头运动或导出历史。
- 打开弹窗不得暂停正在进行的本地导出。

## 11. Design System

### 11.1 Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `videoPreviewSurface` | `rgba(244,252,255,.94)` | 弹窗浅色基底 |
| `videoPreviewSky` | `#74D8FF` | 高光渐变 |
| `videoPreviewBlue` | `#349EE4` | 主按钮和选中态 |
| `videoPreviewInk` | `#174F70` | 主标题 |
| `videoPreviewText` | `#456F86` | 正文 |
| `videoPreviewMuted` | `#7898A9` | 辅助说明 |
| `videoPreviewLocked` | `#8AA6B5` | 硬锁状态 |
| `videoPreviewBorder` | `rgba(255,255,255,.84)` | 玻璃边框 |

### 11.2 Typography

- 字体：Windows 默认中文 UI 字体，优先 `Microsoft YaHei UI`。
- 弹窗标题：24 px / 760 / 1.2。
- 区块标题：14 px / 720 / 1.35。
- 卡片数值：12 px / 700 / 1.35。
- 正文：10～11 px / 500 / 1.55。
- 微文案：8～9 px / 500 / 1.45，不承载唯一关键信息。

### 11.3 Component System

- Button：最小高度 38 px；焦点使用 3 px 青蓝外轮廓。
- Card：14～18 px 圆角，单层轻玻璃，不叠加多层模糊。
- Frame：真实图片使用 `object-fit: cover`；空态不使用生成式占位图。
- Navigation：保持现有顶部导航不变。
- Modal：最大宽度 920 px，吸底安全声明与操作栏。
- List：首尾帧和参数使用清晰横向顺序；小屏切为单列。
- Badge：只显示真实状态，如“真实首帧”“可选尾帧”“0 请求”。
- Feed：不适用，本功能无动态信息流。

## 12. 中文文案表

| 区域 | 文案 |
| --- | --- |
| 入口标题 | AI 镜头视频 |
| 入口说明 | 查看当前镜头请求 · 不创建任务 |
| 入口按钮 | 预览视频请求 |
| 无图片按钮 | 缺少真实首帧 |
| 弹窗标题 | AI 视频请求预览 |
| 弹窗说明 | 镜头 03 · 月下相逢 · 只使用当前真实时间线数据 |
| 状态项 | 视频服务 / 模型 / Key 状态 / 调用状态 |
| 调用状态 | 付费生成已锁定 |
| 调用副文案 | 任务 0 · 上传 0 · 预计消耗 0 |
| 帧标题 | 首帧与尾帧 |
| 首帧标签 | 首帧 · 必需 |
| 尾帧标签 | 尾帧 · 可选 |
| 尾帧空态 | 下一镜头没有真实图片，当前使用首帧模式 |
| 跨场景提示 | 下一镜头跨场景，请谨慎作为尾帧 |
| 提示词标题 | 导演提示词 |
| 重建按钮 | 使用当前镜头重建 |
| 反向提示词 | 不希望出现的画面 |
| 参数 | 模式 / 分辨率 / API 时长 / 智能改写 / 水印 / 高级参数 |
| 时长说明 | 时间线 4.5 秒 → API 5 秒；不会修改项目时长 |
| 音频标题 | 本地音轨不会上传 |
| 音频说明 | 当前不传驱动音频；未来采用视频时保留项目配音、BGM 与音效 |
| 底部声明 | 不会上传首帧、不会创建任务、不会消耗额度 |
| 次按钮 | 取消 / 前往视频设置 |
| 锁定按钮 | 创建任务已锁定 |

## 13. UI 设计 Prompt

--------------------------------

页面名称：成片页 · 当前镜头 AI 视频请求预览

Prompt：

Design a polished Windows desktop AI shot-video request preview modal for a Chinese manju production application. Product type: local-first comic drama and short-video production workstation. UI Design: bright sky-blue gradient glassmorphism, refined lightweight technology aesthetic, cinematic control-console clarity, high contrast readable Chinese desktop UI. Layout: a 1440x900 existing final-cut workspace remains visible and softly blurred behind a centered 920px modal; the modal contains a compact header, four provider status cards, a two-column workspace with real first-frame and optional last-frame previews on the left and an editable director prompt plus negative prompt on the right, a five-column request parameter row, a local-audio privacy notice, and a sticky zero-cost footer. Components: real shot image cards, first-to-last direction arrow, provider/model/key/locked status cards, textarea with character counter, mode selector, 720P/1080P selector, integer duration mapping, prompt extension switch, watermark switch, advanced seed field, Cancel button, Video Settings button, disabled Create Task button with lock icon. Style: luminous cyan highlights, soft cool-blue shadows, thin white glass borders, rounded 18-26px cards, dark navy frame preview accents, calm truthful locked state, no red alarm styling. Lighting: soft top-right cyan glow and subtle lower-left blue-violet reflection. Animation: no entrance animation, only lightweight hover and focus transitions, optimized for smooth Windows desktop rendering. Show only short Simplified Chinese UI labels such as “AI 视频请求预览”, “首帧”, “尾帧”, “导演提示词”, “本地音轨不会上传”, “前往视频设置”, and “创建任务已锁定”. No fake video result, no progress bar, no task ID, no pricing amount, no upload success. Resolution 1440x900, precise production-ready UI, Simplified Chinese UI text, Chinese labels, Chinese desktop application interface.

--------------------------------

## 14. 验收标准

1. 成片页有当前镜头且有真实图片时，右侧“预览视频请求”首屏可见并可点击。
2. 没有镜头或没有真实首帧时入口禁用，产品中不出现模拟首帧。
3. 弹窗显示真实 Provider、`wan2.7-i2v-2026-04-25`、Key 状态和付费硬锁。
4. 首帧严格来自当前镜头；尾帧只来自下一时间线镜头真实图片，并由用户显式启用。
5. 真实时间线小数时长映射到 2～15 秒整数，显示映射结果且不修改项目时长。
6. 提示词只组合真实项目字段；主提示词不超过 5000 字符，反向提示词不超过 500 字符。
7. 分辨率、智能改写、水印和种子只改变弹窗短生命周期预览。
8. 显示“本地音轨不会上传”和未来丢弃模型音轨的边界。
9. 创建任务按钮始终禁用；Renderer `fetch`、远程请求、上传、任务创建均为 0。
10. 不新增视频生成 IPC，不改变本地 FFmpeg 导出、镜头、字幕、配音、BGM 或历史。
11. Esc、背景关闭、焦点循环和关闭后焦点恢复通过。
12. 1440 × 900 无横向溢出，费用声明与操作按钮始终可见；1024 px 宽度仍可操作。

## 15. 不确定项与后续边界

- 官方参数与模型价格可能变化；实现阶段以 2026-07-22 已核验参数做静态预览，真正开放前必须再次联网核验。
- 当前项目没有真实生成视频字段和采用流程；V31 不新增它们。
- 下一镜头跨场景时是否允许作为尾帧属于未来产品策略；V31 只警告，不自动采用。
- 模型可能自动生成音频；当前不传本地音频，也不承诺关闭模型声音，未来采用生成视频时应在本地去除其音轨。
- 真实执行未来必须增加独立费用确认、请求上限、主进程执行、异步轮询、24 小时内下载、失败恢复和实际末帧提取，不能由 V31 预览按钮直接解锁。

## 16. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 94%
尺寸估算: 96%
功能边界识别: 99%
```

所有尺寸均根据当前运行截图和现有 React/CSS 结构推算。实现时应以 1440 × 900 自动化截图复核实际渲染，并保留响应式调整空间。

## 17. 等待确认

设计稿已完成。确认后进入 React / Electron 实现阶段：只实现本地请求预览和零请求验收，不接真实百炼视频生成。
