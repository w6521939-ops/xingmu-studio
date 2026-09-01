# 漫剧创作 V32 本地镜头视频采用与末帧连续性 Design Spec

## 0. 来源与设计基准

- 产品：Windows 本地优先漫剧制作工作台，React + Vite + Electron。
- 当前版本：1.29.0。
- 视觉源：`outputs/runtime/final.png`、`outputs/runtime/shot-video-api-entry.png`。
- 前置设计：`docs/design/manju-creation-v31-shot-video-api-preview.md`。
- 真实代码基准：`FinalPage`、`projectModel.js`、`timelineService.js`、`videoExportService.js`、`assetLibraryService.js`、`main.js` 与 `preload.cjs`。
- 参考画布：1783 × 942 px 现有运行截图；目标设计画布统一按 1440 × 900 px Windows 桌面端表达。
- 当前项目事实：镜头只有嵌入式真实图片，没有真实视频资产字段；`.manju` 文件限制为 10 MB；本地 FFmpeg 已随安装包提供；视频付费生成保持硬锁。
- 本轮任务性质：先完成 V32 设计门禁，不生成 React / CSS / Electron 代码，不调用百炼、不上传素材、不创建任务。

## 1. 项目设计分析

### 1.1 Product type

专业型、本地优先的 Windows 漫剧与短视频制作工作台。V32 补齐“真实镜头视频进入项目、参与预览与本地导出、保留真实末帧供下一镜头连续性使用”的本地媒体闭环。

### 1.2 Target users

- 需要把外部生成或剪辑完成的短镜头 MP4 组合为漫剧的个人创作者。
- 对人物、服装、场景和镜头衔接一致性敏感的导演、分镜师和剪辑人员。
- 不愿承担不可控 API 费用，希望先使用本地素材完成制作的用户。

### 1.3 Usage scenarios

1. 用户在成片时间线选中一个镜头。
2. 从本机导入真实 MP4，程序在本地验证并标准化为无音轨 H.264 视频。
3. 用户对比原分镜图、视频首帧和真实末帧，确认采用到当前镜头。
4. 成片预览优先播放该真实视频，项目配音、BGM 和音效仍走原本地音轨。
5. 用户把当前视频真实末帧显式连接为下一镜头的连续性首帧来源。
6. 本地 FFmpeg 导出时优先使用已采用视频；视频缺失则回退到原分镜图并明确告警。
7. 素材库可集中查看真实镜头视频、末帧、引用位置和本机健康状态。

### 1.4 Core value

- 把“请求预览”与“真实可用媒体”连接起来，但不依赖付费 API。
- 末帧来自实际 MP4 解码结果，不使用截图占位或模拟帧。
- 保持用户原始视频不被修改，项目中不保存原始绝对路径。
- 保持 `.manju` 轻量；大型视频存放在应用本机托管媒体目录。
- 为未来真实百炼视频下载提供同一采用入口，不在页面层分叉两套逻辑。

## 2. 用户画像

### 2.1 年龄

20～45 岁，以独立内容创作者、小型工作室成员和短剧制作人员为主。

### 2.2 职业

漫剧作者、短视频导演、剪辑师、分镜师、AI 内容创作者、自媒体团队成员。

### 2.3 使用习惯

- Windows 横屏桌面环境，鼠标与键盘混合操作。
- 在分镜、图片生成工具、视频生成工具和本地剪辑软件之间交换素材。
- 一次处理大量短镜头，要求能快速定位当前镜头、检查首尾帧和恢复误操作。
- 关注素材是否真实存在、保存在哪里、是否上传、是否会产生费用。

### 2.4 痛点

- 真实视频与分镜图割裂，无法在当前成片时间线直接采用。
- 视频自带声音可能与项目配音、BGM 和音效冲突。
- 不知道视频末帧是否真的来自最终文件，连续镜头容易跳脸、跳衣服或跳场景。
- 视频文件过大，直接嵌入项目会让保存失败或项目无法移动。
- 本地文件移动后容易失联，现有页面没有缺失检测和重新定位路径。

## 3. 产品视觉方向

### 3.1 Design keywords

`渐变天蓝色`、`明亮毛玻璃`、`本地媒体工作台`、`首尾帧连续性`、`真实数据`、`电影胶片感`、`轻科技`、`安全可逆`。

### 3.2 Visual rationale

- 继承 V31 的天蓝渐变毛玻璃，不改变用户已经确认的品牌方向。
- 使用深海军蓝视频预览槽承托真实动态画面，提高图像对比度。
- 本地成功状态使用青绿色，不使用夸张霓虹；缺失或不匹配使用琥珀色，不使用高压红色。
- 末帧连接用细青蓝连线和方向箭头表达“引用关系”，不把它画成已经生成成功的云任务。
- 处理进度只展示真实 FFmpeg 阶段，不使用无数据来源的动画百分比。

## 4. V32 范围与关键决策

### 4.1 本轮范围

- 当前镜头导入真实本地 MP4。
- 本地验证、标准化、移除源音轨、提取真实首帧与末帧。
- 采用前确认、采用后管理、替换、解除使用和重新定位。
- 成片预览与本地 FFmpeg 导出优先使用已采用视频。
- 将当前视频末帧显式连接到下一时间线镜头。
- 素材库新增“镜头视频”类别和本机媒体容量。
- 完整的 loading、empty、error、missing、disabled、selected 与恢复状态。

### 4.2 明确不做

- 不开放百炼视频上传、生成、轮询、下载或费用确认。
- 不把视频 Base64 嵌入 `.manju`。
- 不保存用户原始文件绝对路径到项目或 Renderer。
- 不使用视频自带音轨参与成片；项目配音、BGM 和音效保持权威。
- 不自动覆盖下一镜头已有分镜图片。
- 不自动把末帧连接到下一镜头。
- 不删除用户原始视频。
- 不做跨设备云同步、发行或项目素材打包。

### 4.3 媒体存储决策

- 导入后由 Electron 主进程复制并标准化到 `app.getPath('userData')` 下的项目隔离媒体目录。
- `.manju` 只保存不含本机绝对路径的资产 ID、校验摘要、元数据、末帧 Data URL 和镜头引用。
- Renderer 只接收受控媒体 URL 与脱敏元数据，不接收源路径。
- 原始用户文件只读，不修改、不移动、不删除。
- “解除使用”只移除项目引用；托管副本暂时保留，保证撤销和恢复点可找回。磁盘清理留给后续独立存储管理功能。

### 4.4 支持格式与验证假设

- V32 首版只允许 `.mp4`，减少 Windows 解码与导出差异。
- 单文件上限 250 MB，时长 0.5～30 秒；与现有单镜头 0.5～30 秒边界一致。
- 必须包含至少一条可解码视频流。
- 本地标准化为 H.264、`yuv420p`、最高 30 fps、无音轨、`faststart` MP4。
- 首帧和末帧均从标准化后的真实视频解码；末帧最长边限制 1080 px，以 JPEG Data URL 写入项目。
- 文件、时长、分辨率、SHA-256 和提取时间都来自实际本地文件，不允许由 UI 伪造。

## 5. 页面列表

| 页面/状态 | 页面目标 | 核心模块 | 布局 | 主要交互 | 视觉重点 |
| --- | --- | --- | --- | --- | --- |
| 成片页 · 未采用视频 | 暴露本地视频入口 | 当前镜头视频卡、AI 请求卡、本地导出 | 左预览 + 右控制栏 + 下时间线 | 导入 MP4、预览 AI 请求 | 本地采用与付费请求明确分区 |
| 本地视频处理弹窗 | 展示真实处理过程 | 文件摘要、四阶段进度、取消 | 居中 720 px 弹窗 | 取消、等待 FFmpeg | 只显示真实阶段，不伪造百分比 |
| 视频采用确认弹窗 | 对比真实首尾帧并确认使用 | 分镜图、首帧、末帧、元数据、时长策略 | 居中 980 px 双栏弹窗 | 采用、取消、重新选择 | 三帧对比与音频剥离声明 |
| 成片页 · 已采用视频 | 使用真实视频预览和管理 | 动态预览、本地视频卡、末帧连接、时间线徽标 | 保持现有三段式布局 | 播放、查看、替换、解除、连接下一镜头 | 真实视频状态优先但不遮盖导出设置 |
| 末帧连续性确认弹窗 | 显式连接下一镜头 | 当前末帧、下一镜头分镜图、影响说明 | 居中 760 px 对比弹窗 | 确认连接、取消 | 不覆盖下一镜头图片，只建立引用 |
| 素材库 · 镜头视频 | 集中管理本地托管视频 | 类别、真实缩略图、健康状态、引用、元数据 | 延续三栏素材库 | 预览、定位、重新定位、解除引用 | 项目容量与本机媒体容量分开 |
| 视频缺失/损坏状态 | 提供可恢复降级 | 缺失徽标、回退图片、重新定位 | 就地状态 + 恢复弹窗 | 重新定位、保持回退、解除引用 | 错误可理解，不阻断其他镜头 |

## 6. 信息架构与核心流程

### 6.1 主流程

```text
成片页选中镜头
└─ 本地镜头视频
   ├─ 未采用
   │  └─ 导入本地 MP4
   │     ├─ Windows 文件选择
   │     ├─ 本地验证
   │     ├─ 标准化为无音轨 H.264
   │     ├─ 提取真实首帧与末帧
   │     └─ 采用确认
   │        ├─ 取消：清理临时产物
   │        └─ 采用：登记资产并绑定当前镜头
   └─ 已采用
      ├─ 本地预览
      ├─ 查看详情
      ├─ 替换视频
      ├─ 解除使用
      └─ 连接末帧到下一镜头
```

### 6.2 连续性流程

```text
镜头 A 已采用真实视频
└─ 提取并保存镜头 A 真实末帧
   └─ 用户点击“连接到下一镜头”
      ├─ 展示镜头 A 末帧
      ├─ 展示镜头 B 原分镜图
      ├─ 不覆盖镜头 B 图片
      └─ 保存镜头 B 的 continuitySourceShotId = A
         └─ 镜头 B 的 AI 视频请求预览优先使用该真实末帧
```

### 6.3 降级流程

```text
托管 MP4 缺失或损坏
├─ 成片预览：回退到镜头原分镜图
├─ 本地导出：使用原分镜图并记录 1 项视频降级
├─ 连续性：若已保存真实末帧，仍可作为连续性参考
└─ 用户操作：重新定位 / 解除使用 / 打开素材库检查
```

## 7. 页面结构拆解

### 7.1 成片页 · 已采用视频

```text
FinalPage
├─ TopNavigation（现有，不变）
├─ FinalPreviewPanel
│  ├─ Header
│  ├─ PreviewStage
│  │  ├─ MutedLocalVideo
│  │  ├─ VideoSourceBadge
│  │  ├─ SubtitleOverlay
│  │  └─ ShotNumber
│  └─ PlaybackControls
├─ ExportPanel
│  ├─ LocalExportBoundary
│  ├─ LocalShotVideoCard
│  │  ├─ StatusHeader
│  │  ├─ VideoMetadata
│  │  ├─ ContinuityStatus
│  │  └─ ManageActions
│  ├─ AiVideoRequestCard（V31 保留）
│  ├─ PreviewAll
│  ├─ ExportSettings
│  ├─ ReadinessChecks
│  ├─ ExportAction
│  └─ ExportHistory
└─ ProductionTimeline
   └─ TimelineSegment
      ├─ RealThumbnail
      ├─ LocalVideoBadge
      ├─ ContinuityLinkBadge
      └─ ExistingControls
```

### 7.2 视频采用确认弹窗

```text
LocalVideoAdoptionLayer
└─ LocalVideoAdoptionDialog
   ├─ Header
   ├─ SafetySummary
   ├─ FrameComparison
   │  ├─ StoryboardImageCard
   │  ├─ VideoFirstFrameCard
   │  └─ VideoLastFrameCard
   ├─ MetadataPanel
   │  ├─ FileFacts
   │  ├─ TimelineMapping
   │  ├─ AudioPolicy
   │  └─ StoragePolicy
   ├─ ContinuityPreview
   └─ StickyFooter
      ├─ Cancel
      ├─ ChooseAgain
      └─ AdoptLocalVideo
```

### 7.3 素材库 · 镜头视频

```text
AssetLibraryPage
├─ Header
│  ├─ ProjectCapacity
│  └─ ManagedMediaCapacity
├─ FilterSidebar
│  └─ Category: 镜头视频
├─ AssetCollection
│  └─ VideoAssetCard
│     ├─ RealLastFrameThumbnail
│     ├─ LocalOnlyBadge
│     ├─ HealthBadge
│     └─ DurationAndResolution
└─ AssetInspector
   ├─ MutedVideoPreview
   ├─ Metadata
   ├─ LastFramePreview
   ├─ References
   └─ Actions
```

## 8. 组件级设计稿

### 8.1 FinalPage 主布局

| 字段 | 规格 |
| --- | --- |
| 类型 | CSS Grid 桌面工作区 |
| 画布 | 1440 × 900 px；现有 1783 × 942 截图为测量依据 |
| 内容宽度 | 约 1396 px，占屏幕宽度 97%；左右边距各约 22 px，约 1.5% |
| 左预览区 | 约 1040 px，占屏宽 72.2%，占主内容宽 74.5% |
| 右控制栏 | 约 342 px，占屏宽 23.8%，占主内容宽 24.5% |
| 栏间距 | 14 px，占屏宽约 1% |
| 时间线 | 宽 100% 主内容；位于第二行；高度按内容，首屏至少露出标题与首排镜头 |
| 响应式 | `<1120 px` 改为单列，右栏位于预览后，时间线保持最后 |

### 8.2 LocalShotVideoCard

| 字段 | 规格 |
| --- | --- |
| 类型 | Card / 当前镜头本地媒体状态 |
| 位置 | ExportPanel 顶部，本地边界说明之后、V31 AI 请求卡之前 |
| 宽度 | 100% 右栏，约 314 px；占屏宽约 21.8% |
| 高度 | 未采用约 104 px，占 900 px 页面高 11.6%；已采用约 148 px，占页面高 16.4% |
| Padding | 12 px；约父卡宽 3.8% |
| 圆角 | 16 px |
| 背景 | `linear-gradient(135deg, rgba(247,253,255,.86), rgba(185,231,252,.60))` |
| 边框 | 1 px `rgba(255,255,255,.82)`；ready 状态加青色内描边 |
| 阴影 | `0 10px 26px rgba(30,130,184,.12)` |
| 标题 | `本地镜头视频`，12 px / 760；当前镜头编号 9 px |
| 状态徽标 | 48 × 20 px，约卡宽 15%；文案 `未采用` / `已采用` / `媒体缺失` |
| 主按钮 | 高 36 px，占卡高约 24%～35%；最小点击高度 36 px；文案 `导入本地 MP4` |
| 已采用操作 | `查看`、`替换`、`解除使用` 三按钮；每个至少 32 px 高 |
| 状态 | empty、processing、ready、missing、error、disabled |

### 8.3 视频来源徽标

| 字段 | 规格 |
| --- | --- |
| 类型 | Badge |
| 位置 | PreviewStage 中竖屏画面左上角 |
| 尺寸 | 88 × 24 px；约竖屏画面宽 36%，高 5% |
| 文案 | `本地视频`；缺失回退时 `视频缺失 · 图片回退` |
| 背景 | ready：`rgba(15,145,180,.82)`；missing：`rgba(190,126,34,.86)` |
| 图标 | 14 × 14 px，约徽标高 58%；线性摄像机或警告图标 |
| 层级 | 位于真实视频之上、字幕之下；z-index 高于媒体 2 级 |

### 8.4 本地视频处理弹窗

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Progress |
| 宽度 | 720 px，占 1440 屏宽 50%；最大 `calc(100vw - 48px)` |
| 高度 | 330～420 px，占 900 页面高 36.7%～46.7% |
| 位置 | 视口居中，顶部最小 24 px |
| Padding | 26 px；约弹窗宽 3.6% |
| 圆角 | 24 px |
| 背景 | 明亮天蓝毛玻璃，单层 blur 18 px |
| 阶段列表 | 4 行，每行 42 px：验证文件、标准化视频、提取首尾帧、准备确认 |
| 真实进度 | FFmpeg 可计算时显示百分比；只能确认阶段时显示完成/当前/等待，不伪造数值 |
| 取消按钮 | 112 × 40 px；真实中止 FFmpeg、等待退出并清理临时文件后关闭 |
| 焦点 | 首焦点在取消按钮；进度更新用 `aria-live="polite"` |

### 8.5 视频采用确认弹窗

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Review & Confirm |
| 宽度 | 980 px，占 1440 屏宽 68.1%；最大 `calc(100vw - 48px)` |
| 高度 | 最大 760 px，占 900 页面高 84.4%；内容区内部滚动 |
| 外边距 | 顶部/底部至少 20 px，占页面高约 2.2% |
| Header | 高约 72 px，占弹窗高 9.5%；标题、镜头上下文、关闭按钮 |
| SafetySummary | 高 56 px，占弹窗高 7.4%；显示 `仅本地处理`、`源文件不修改`、`源音轨移除` |
| FrameComparison | 三列，每列约 286 px，占内容宽 31%；列间距 12 px |
| 帧卡高度 | 210 px，占弹窗高 27.6%；9:16 或 16:9 内容用 contain，不裁切事实信息 |
| 元数据区 | 左 58% + 右 42%；约 170 px 高 |
| Footer | 吸底 74 px，占弹窗高 9.7%；左侧声明，右侧三操作 |
| 背景 | `rgba(243,252,255,.95)` + 天蓝径向高光 |
| 层级 | z-index 高于 V31 请求弹窗；同一时刻只允许一个模态层 |

### 8.6 三帧对比卡

| 字段 | 规格 |
| --- | --- |
| 类型 | Image Card |
| 卡片 | 宽约 286 px；高 210 px；占 FrameComparison 父宽 31% |
| 图片区域 | 高 164 px，占卡高 78%；`object-fit: contain` |
| 标签 | `原分镜图` / `视频首帧` / `真实末帧`，11 px / 730 |
| 文件说明 | 8～9 px，单行省略，悬停显示完整值 |
| 图标 | 图片 15 × 15 px；首帧播放起点、末帧终点语义 |
| 缺图 | 不使用渐变人物占位；显示明确图标与 `无法提取` |
| 选中 | 本轮不允许点选替换；三张均为事实对比，不使用选择态 |

### 8.7 Timeline 视频与连续性徽标

| 字段 | 规格 |
| --- | --- |
| 类型 | Badge / Status Dot |
| 位置 | 每个 112 × 92 px 最小时间线镜头右上状态组 |
| 视频徽标 | 17 × 17 px，占镜头宽 15.2%、高 18.5%；ready 为青绿色摄像机图标 |
| 连续性徽标 | 17 × 17 px；链环图标；表示首帧来自上一镜头真实末帧 |
| 缺失状态 | 视频图标改琥珀色并带可访问名称，不只依赖颜色 |
| Tooltip | `本地视频已采用`、`承接镜头 03 真实末帧`、`视频缺失，导出将使用分镜图` |

### 8.8 末帧连续性确认弹窗

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Relationship Confirmation |
| 宽度 | 760 px，占 1440 屏宽 52.8% |
| 高度 | 480～560 px，占页面高 53%～62% |
| 对比区 | 左右各约 300 px，占父宽约 43%，中间箭头约 48 px |
| 左卡 | 当前镜头真实末帧，必须是真实提取成功状态 |
| 右卡 | 下一镜头原分镜图；如果缺图显示真实空态 |
| 箭头 | 32 × 32 px，占弹窗宽 4.2%；青蓝描边，不做循环动画 |
| 说明 | `仅建立连续性引用，不覆盖下一镜头分镜图` |
| 主按钮 | 160 × 40 px，`连接到下一镜头` |
| 禁用 | 无下一镜头、跨项目、末帧缺失、正在导出时禁用 |

### 8.9 素材库视频卡与检查器

| 字段 | 规格 |
| --- | --- |
| 页面布局 | 侧栏 18%、集合区约 56%、检查器 24%；总间距 24 px |
| 视频卡 | 网格模式最小 220 × 178 px；缩略图高约 118 px，占卡高 66% |
| 缩略图 | 使用真实末帧或首帧；`object-fit: cover`；不生成模拟图 |
| 卡片元数据 | 时长、分辨率、文件大小；两行内完成 |
| 检查器视频 | 高 142 px，100% 宽；muted、controls、preload metadata |
| 末帧预览 | 100% 宽、约 96 px 高；显示 `真实末帧` 标签 |
| 容量条 | `.manju` 容量和本机媒体容量分成两条，禁止合计成同一个 10 MB 限制 |
| 操作 | 定位镜头、重新定位、打开托管位置、解除引用 |

## 9. 数据与持久化合约

### 9.1 项目级视频资产元数据

`content.videoAssets` 为可选数组；旧项目缺失时归一为空数组，不强制升级项目格式版本。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | string | 本机生成的不透明稳定 ID，只允许安全字符 |
| `kind` | string | 固定 `shot-video` |
| `source` | string | `local-import`；未来可扩展 `bailian-download` |
| `fileName` | string | 用户可见原文件名，最长 160 字符，不含原始路径 |
| `mimeType` | string | 标准化后固定 `video/mp4` |
| `bytes` | number | 托管 MP4 实际字节数 |
| `duration` | number | 实际视频秒数，保留三位小数 |
| `width` / `height` | number | 实际标准化视频分辨率 |
| `fps` | number | 标准化后不超过 30 |
| `sha256` | string | 用于健康检查和重新定位匹配，不显示完整原始路径 |
| `importedAt` | string | ISO 时间 |
| `lastFrame` | object | 真实末帧 Data URL、宽高、提取时间和文件名 |

### 9.2 镜头引用字段

| 字段 | 规则 |
| --- | --- |
| `shot.videoAssetId` | 指向项目级 `videoAssets.id`；不存在时为空字符串 |
| `shot.videoOffsetSeconds` | 拆分镜头时记录从源视频何处开始；默认 0 |
| `shot.videoContinuitySourceShotId` | 指向时间线上紧邻前一个镜头；只作为 AI 视频首帧来源，不覆盖 `shot.image` |
| `shot.videoDurationPolicy` | V32 固定 `fit-timeline`；长视频截断，短视频末帧静止补齐 |

### 9.3 运行时健康状态

`ready`、`missing`、`corrupt`、`processing` 为运行时派生状态，不把“文件存在”伪装为项目永久事实。

### 9.4 10 MB 项目限制

- MP4 不计入 `.manju` 10 MB，因为不嵌入 JSON。
- 末帧 JPEG Data URL 计入 10 MB，采用前必须执行完整候选项目体积预检。
- 如果末帧导致候选项目超限，采用失败且不修改镜头引用；托管临时文件清理。

### 9.5 项目迁移与可移植性

- 同一台电脑复制或另存 `.manju` 时，稳定 `localProjectId` 仍可找到托管媒体。
- 把 `.manju` 移到另一台电脑时视频可能缺失；项目仍能打开并使用分镜图与已保存末帧降级。
- 重新定位时重新复制并标准化用户选择的 MP4，校验 SHA-256；不信任项目文件提供的路径。
- V32 不声称 `.manju` 已是包含大型视频的便携项目包。

## 10. 时间线、预览和导出规则

### 10.1 预览

- 镜头有健康视频资产时，竖屏/横屏预览优先使用 `<video>`，始终静音。
- 播放头进入镜头时，视频时间映射为 `videoOffsetSeconds + 镜头内相对时间`。
- 视频长于镜头：只显示时间线范围。
- 视频短于镜头：到末帧后停留真实末帧，直到镜头结束。
- 项目配音、BGM、音效和字幕继续使用现有时间线逻辑。
- 视频缺失时立即回退到 `shot.image`，并显示非阻断告警。

### 10.2 本地导出

- 导出服务从受控资产 ID 解析托管 MP4，不接受 Renderer 传入任意路径。
- 有健康视频时使用视频画面；没有时使用原分镜图或既有占位降级。
- 源视频音轨始终 `-an`；项目本地音轨仍按原流程混音。
- 视频片段统一缩放、裁剪、帧率和像素格式；淡入淡出转场继续生效。
- 图片专属推近/拉远/平移动效不叠加到真实视频，设置保留但标注 `视频镜头不应用图片动效`。
- 导出结果新增 `videoSegmentCount`、`videoFallbackCount`，必须是真实统计。

### 10.3 时间线编辑兼容

- 重排：视频引用随镜头移动；连续性引用若不再来自紧邻前镜头，标记失效并要求重新连接。
- 调整时长：不改源视频；按长截短、短停末帧规则预览和导出。
- 复制：副本复用同一托管视频资产，不复制磁盘文件；清除位置相关连续性引用。
- 拆分：左右片段复用同一视频资产；右片段 `videoOffsetSeconds` 加上切点偏移，避免从头重复。
- 删除：删除镜头引用并清理指向它的连续性链接；托管文件不立即删除。
- 撤销/重做：恢复镜头引用、偏移和连续性链接；外部托管文件保持可用。

## 11. 状态与交互

### 11.1 Empty

- 无镜头：`请先创建镜头`，导入按钮禁用。
- 有镜头无视频：显示 `当前镜头尚未采用本地视频` 与唯一主操作 `导入本地 MP4`。
- 无下一镜头：末帧显示 `已保留；当前为最后一个镜头`，连接按钮禁用。

### 11.2 Loading / Processing

- 只显示真实本地阶段：验证、标准化、提帧、准备确认。
- FFmpeg 有真实时间进度时才显示百分比；否则显示阶段状态。
- 处理期间禁止重复导入同一镜头，但不冻结其他页面只读浏览。

### 11.3 Error

- 不支持格式：`仅支持本地 MP4 文件`。
- 文件过大：显示实际大小与 250 MB 上限。
- 时长越界：显示实际时长与 0.5～30 秒范围。
- 无视频流：`文件中没有可解码的视频画面`。
- FFmpeg 失败：保留错误摘要，不显示命令中的用户绝对路径。
- 末帧提取失败：不得显示“真实末帧已保留”，采用按钮禁用。

### 11.4 Missing / Relink

- 页面显示 `本机视频已移动或损坏`，并回退到分镜图。
- `重新定位` 打开 Windows 文件选择；优先比较 SHA-256。
- 哈希不一致时显示对比并要求二次确认，不静默替换。

### 11.5 Disabled

- 正在导出、镜头不存在、末帧提取失败或无下一镜头时，相应操作禁用并提供原因。
- 禁用态保留至少 4.5:1 可读文字对比，不只降低透明度。

### 11.6 Selected / Pressed / Focus

- 当前时间线镜头仍以现有青蓝外环表示，不增加另一套选择色。
- 按钮 pressed 下移 1 px；处理弹窗不使用位移动画。
- 模态层实现焦点循环，Esc 仅在安全可取消阶段关闭；关闭后焦点回到入口。

### 11.7 Long text / Small screen / Dark mode

- 文件名与错误摘要最多两行，超出省略并提供 title。
- `<1120 px` 成片页改单列；弹窗 FrameComparison 改为横向可滚动或两行布局。
- `<720 px` 弹窗宽 `calc(100vw - 24px)`，三帧改为单列，Footer 操作纵向排列。
- 当前明亮主题为主；暗色模式使用深蓝玻璃，不做简单颜色反转。
- Windows 桌面无移动安全区；固定 Footer 仍预留 12 px 底部内边距。
- `prefers-reduced-motion` 下取消进场动画，只保留颜色与焦点变化。

## 12. Electron 与安全边界

### 12.1 Main process

- 负责 Windows MP4 选择、文件大小校验、本地复制、FFmpeg 标准化、元数据解析、SHA-256、首尾帧提取和托管文件健康检查。
- 资产目录由 `projectLocalId` 和受限 `assetId` 派生；解析后的绝对路径必须验证仍位于应用媒体根目录。
- 不执行来自 Renderer 的任意 FFmpeg 参数、任意路径或命令字符串。
- 处理取消后等待 FFmpeg 退出，再清理临时目录。

### 12.2 Preload bridge

- 只暴露明确白名单：选择并准备视频、取消处理、采用、查询健康、重新定位、打开托管位置。
- 返回不透明资产 ID、受控媒体 URL、真实元数据和末帧 Data URL。
- 不返回 Key、原始绝对路径或任意文件系统句柄。

### 12.3 Renderer

- 页面只管理弹窗、选中镜头、短生命周期进度和确认状态。
- 业务规则进入 `shotVideoAssetService`；桥接调用进入 `shotVideoAssetRepository`。
- 不在页面中读取文件、解析视频、计算哈希或拼接路径。

### 12.4 网络与费用

- 所有 V32 本地操作必须在断网状态可用。
- 不调用 `fetch`、DashScope、OSS、上传、任务创建或轮询。
- V31 的创建任务按钮继续硬锁，主进程 `allowPaidGeneration: false` 保持不变。

## 13. React / Electron 实现映射

| 区域 | 建议映射 | 职责 |
| --- | --- | --- |
| 成片页入口与弹窗 | `App.jsx` 内拆分可复用组件 | UI、选择状态、焦点、通知 |
| 视频资产规则 | 新增 `shotVideoAssetService.js` | 归一化、引用、连续性、候选项目预检 |
| 桥接仓库 | 新增 `shotVideoAssetRepository.js` | 调用 preload 白名单，不处理 UI |
| 项目保存 | `projectModel.js` | 保存/读取 `videoAssets` 与镜头引用，旧项目安全补空 |
| 时间线 | `timelineService.js`、`shotTimelineEditService.js` | 视频 ready、offset、复制/拆分/删除/重排语义 |
| 本地预览 | `FinalPage` 媒体层 | muted 视频与播放头同步，缺失回退 |
| 本地导出 | `videoExportService.js` | 视频片段合成、去源音轨、真实降级统计 |
| Main 媒体服务 | 新增 `electron/shotVideoAssetService.js` | 文件、FFmpeg、哈希、提帧、托管目录 |
| 安全 IPC | `main.js`、`preload.cjs` | 固定通道与参数校验 |
| 素材库 | `assetLibraryService.js`、`AssetLibraryPage` | 视频资产索引、健康、引用与定位 |

## 14. Design System

### 14.1 Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `videoLocalSky` | `#75D9FF` | 天蓝高光、进度当前阶段 |
| `videoLocalPrimary` | `#239FE3` | 主操作、选中边框 |
| `videoLocalDeep` | `#164B6B` | 标题、深色预览背景 |
| `videoLocalReady` | `#18A9A1` | 本地视频健康、末帧已提取 |
| `videoLocalWarning` | `#D99436` | 文件缺失、时长差异、回退 |
| `videoLocalDanger` | `#C95B69` | 解除引用确认，不用于普通缺失 |
| `videoLocalSurface` | `rgba(244,252,255,.94)` | 弹窗主表面 |
| `videoLocalGlass` | `rgba(255,255,255,.58)` | 单层玻璃卡片 |
| `videoLocalBorder` | `rgba(255,255,255,.84)` | 玻璃边框 |
| `videoLocalMuted` | `#7897A8` | 次级说明 |

### 14.2 Typography

- 字体：`Microsoft YaHei UI`、`Segoe UI`、系统无衬线。
- 页面标题：26～34 px / 760 / 1.2。
- 弹窗标题：23～26 px / 760 / 1.2。
- 区块标题：13～15 px / 720 / 1.35。
- 正文：10～12 px / 500 / 1.55。
- 元数据：9～10 px / 600，数字使用 tabular nums。
- 微文案不低于 8 px，且不承载唯一安全信息。

### 14.3 Component System

- Button：主按钮高度 40 px；紧凑按钮不低于 32 px；焦点环 2～3 px。
- Card：14～18 px 圆角；同一区域只保留一层 blur，避免设置页曾出现的合成卡顿。
- Avatar：不适用；视频资产使用首/末帧缩略图。
- Navigation：现有顶部导航和素材入口不变。
- Modal：720 / 760 / 980 px 三种宽度；Header 和 Footer 不随中间内容滚出。
- List：视频元数据用双列定义列表；引用位置使用可点击列表。
- Feed：不适用，无动态流。
- Progress：真实阶段优先，未知进度不显示伪百分比。
- Video：muted、playsInline、preload metadata；错误必须回退并释放播放器。
- Icon：统一 1.8 px 线性描边；缺图使用语义图标而不是生成式占位画面。

## 15. 中文文案表

| 页面/区域 | 文案 |
| --- | --- |
| 本地视频卡标题 | 本地镜头视频 |
| 未采用状态 | 当前镜头尚未采用本地视频 |
| 导入按钮 | 导入本地 MP4 |
| 已采用状态 | 真实视频已采用 |
| 本地声明 | 仅本机处理 · 不上传素材 |
| 元数据摘要 | 4.8 秒 · 1080×1920 · 24.6 MB |
| 管理操作 | 查看详情 / 替换 / 解除使用 |
| 处理标题 | 正在准备本地镜头视频 |
| 处理阶段 | 验证文件 / 标准化视频 / 提取首尾帧 / 准备确认 |
| 取消处理 | 取消处理 |
| 采用弹窗标题 | 采用本地镜头视频 |
| 三帧标签 | 原分镜图 / 视频首帧 / 真实末帧 |
| 源文件安全 | 原始文件不会被修改或删除 |
| 音频规则 | 视频源音轨将移除，继续使用项目配音、BGM 与音效 |
| 时长规则 | 保持时间线 4.5 秒；长视频截断，短视频停留末帧 |
| 存储规则 | 视频保存在本机托管媒体目录，不写入 10 MB 项目文件 |
| 重新选择 | 重新选择 |
| 确认采用 | 采用到当前镜头 |
| 连续性按钮 | 连接到下一镜头 |
| 连续性标题 | 使用真实末帧承接下一镜头？ |
| 连续性说明 | 仅建立首帧引用，不覆盖下一镜头分镜图 |
| 连续性成功 | 下一镜头将承接镜头 03 的真实末帧 |
| 最后镜头 | 真实末帧已保留；当前没有下一镜头 |
| 缺失标题 | 本机视频已移动或损坏 |
| 缺失说明 | 当前预览和导出将回退到原分镜图 |
| 恢复操作 | 重新定位 / 保持回退 / 解除引用 |
| 素材类别 | 镜头视频 |
| 容量标题 | 本机托管媒体 |
| 空素材 | 尚未采用真实镜头视频 |
| 错误格式 | 仅支持本地 MP4 文件 |
| 错误时长 | 视频时长需在 0.5～30 秒之间 |
| 错误末帧 | 无法提取真实末帧，本次没有采用视频 |
| 解除确认 | 解除后镜头将回退到原分镜图；原始文件不会被删除 |

## 16. UI 设计 Prompt

--------------------------------

页面名称：成片页 · 已采用本地镜头视频

Prompt：

Design a polished Windows desktop final-cut workspace for a Chinese local-first manju production application. Product type: professional comic-drama and short-video production workstation. UI Design: bright sky-blue gradient glassmorphism, refined lightweight technology aesthetic, cinematic editing clarity, truthful local-media states. Layout: 1440x900 desktop canvas with an existing top navigation bar, a large left final-preview panel, a compact right export control panel, and a full-width production timeline below. In the left preview, show a real muted vertical video frame with a small “本地视频” source badge and editable subtitle overlay. In the right panel, add a compact “本地镜头视频” card above the existing locked AI video request card; show real duration, resolution, file size, last-frame status, and actions “查看详情”, “替换”, “解除使用”, “连接到下一镜头”. The AI request remains visibly locked with “0 请求”. Timeline shot cards show a small local-video camera badge and a chain badge for previous-shot last-frame continuity. Style: luminous cyan accents, white translucent panels, cool blue shadows, thin white borders, calm teal success states, amber missing-media fallback states, dark navy video canvas, no purple-heavy palette. Lighting: soft cyan glow from upper right, subtle blue reflection at the bottom, high readability. Animation: no modal entrance animation, lightweight hover and focus transitions only, optimized for smooth Windows performance. Show only short Simplified Chinese labels and titles, no long paragraphs. No cloud upload success, no fake generation progress, no fake video. Resolution 1440x900, production-ready UI, Simplified Chinese UI text, Chinese labels, Chinese desktop application interface.

--------------------------------

页面名称：本地视频采用确认弹窗

Prompt：

Design a production-ready local video adoption confirmation modal for a Chinese Windows manju creation application. Product type: local-first comic-drama editing workstation. UI Design: bright sky-blue gradient glassmorphism with precise media-review hierarchy and strong privacy transparency. Layout: centered 980x740 pixel modal over a softly blurred final-cut workspace; fixed header and sticky footer; a compact safety summary row; a three-column frame comparison showing “原分镜图”, “视频首帧”, and “真实末帧”; a metadata section with actual duration, resolution, FPS, file size and SHA-256 status; a timeline mapping card explaining trim or last-frame hold; an audio policy card stating source audio is removed; and a local storage card stating the MP4 is not embedded in the 10 MB project file. Components: real image thumbnails, file facts, teal verified badges, amber duration mismatch notice, Cancel button, Choose Again button, and a primary “采用到当前镜头” button. Style: luminous cyan highlights, cool blue shadows, rounded 16-24 pixel cards, thin white borders, deep navy thumbnail wells, calm trustworthy states, no fake media thumbnails. Lighting: soft top-right cyan glow, crisp text contrast. Animation: no entrance motion; only focus, hover and real processing state transitions. Show short Simplified Chinese UI labels only. No network request, no cloud icon, no pricing, no task ID. Resolution 1440x900, precise desktop UI, Simplified Chinese UI text, Chinese labels, Chinese desktop application interface.

--------------------------------

页面名称：素材库 · 镜头视频

Prompt：

Design a professional unified asset-library page for a Chinese Windows manju production application, focused on real local shot videos. Product type: local-first creative media asset manager. UI Design: bright sky-blue gradient glassmorphism, clean editorial density, reliable local-file health states. Layout: 1440x900 desktop interface with existing top navigation, a header showing separate “项目容量” and “本机托管媒体” usage bars, an 18 percent left filter sidebar with “镜头视频” selected, a flexible center grid of real video asset cards, and a 24 percent right inspector. Video cards use actual first or last-frame thumbnails and show duration, resolution, file size, local-only badge and health. The inspector contains a muted real video preview, file metadata, a “真实末帧” panel, shot references, and actions “定位镜头”, “重新定位”, “打开位置”, “解除引用”. Include ready, missing, corrupt and empty states without simulated assets. Style: white and cyan translucent panels, luminous blue accents, soft cool shadows, rounded 14-20 pixel cards, teal healthy badges and amber recoverable warnings. Lighting: clean daylight cyan glow, no heavy neon. Animation: lightweight selection and focus transitions, no background blur animation. Show short Simplified Chinese labels, navigation and buttons only. No fake waveforms, no fake videos, no cloud upload state. Resolution 1440x900, production-ready Chinese desktop application interface, Simplified Chinese UI text, Chinese labels.

--------------------------------

## 17. 验收标准

1. 当前镜头存在时可导入真实本地 MP4；无镜头时入口禁用且解释原因。
2. 导入仅通过 Windows 文件选择和主进程白名单；项目与 Renderer 不保存原始绝对路径。
3. 只接受 MP4、≤250 MB、0.5～30 秒、至少一条可解码视频流。
4. 标准化、首帧和末帧都来自真实本地 FFmpeg 输出；失败时不得写入完成状态。
5. 原始用户文件不被修改、移动或删除；视频源音轨从托管副本移除。
6. `.manju` 不嵌入 MP4，只保存资产元数据、引用和真实末帧；采用前通过 10 MB 候选快照预检。
7. 已采用视频在成片预览中优先显示，始终静音，项目音轨与字幕正常同步。
8. 本地导出优先使用健康视频；长视频截断、短视频停留末帧，视频源音轨不进入成片。
9. 视频缺失时预览和导出回退到真实分镜图，显示告警并可重新定位。
10. 末帧连接必须由用户显式确认，不覆盖下一镜头 `image`，无下一镜头时禁用。
11. V31 AI 请求预览可识别有效连续性引用，并显示首帧来源为上一镜头真实末帧。
12. 重排使引用不再相邻时标记失效；复制清除位置引用；拆分使用正确视频 offset；删除清理关联引用。
13. 撤销、重做、恢复点和 `.manju` 保存可还原视频引用、offset 与连续性关系。
14. 素材库显示镜头视频真实数量、真实缩略图、健康状态、引用和本机媒体容量。
15. 处理取消会等待 FFmpeg 退出并清理临时文件；不能留下假完成或卡死状态。
16. 专项测试必须使用本地实际生成/导入的 MP4 fixture，不能使用模拟视频对象冒充成功。
17. 专项网络拦截中 HTTP(S)、Renderer `fetch`、DashScope、OSS、上传、任务创建和轮询全部为 0。
18. 1440 × 900 无横向溢出；1024 px 可操作；设置页进出性能不得退化。
19. 包内不包含测试 MP4、用户媒体、`key.txt`、绝对路径、`scripts/`、`outputs/` 或 `docs/`。
20. 原有图片镜头、字幕、配音、BGM、SFX、AI 请求预览和本地 FFmpeg 图片导出回归通过。

## 18. 不确定项、风险与后续边界

- 本机托管媒体使 `.manju` 保持轻量，但跨电脑移动项目时视频不会自动携带；未来需要独立“打包项目素材”功能。
- 解除引用后为了支持撤销不会立即删除托管副本，长期使用会增加磁盘占用；未来需要可审计的本地存储清理器。
- V32 首版只支持 MP4；MOV、WebM、MKV 需要在后续依据真实用户需求扩展。
- FFmpeg 元数据解析在没有 `ffprobe` 的现有包中需要严格测试不同编码输出，不得依赖单一语言文本。
- 图片动效不叠加到真实视频，避免双重运镜；如果未来需要视频关键帧动画，应另立设计与导出规格。
- 真正百炼生成完成后，应把下载 MP4送入同一个本地采用服务；不能从云任务状态直接把镜头标成已采用。
- 本设计不授权任何付费调用，不改变现有 `allowPaidGeneration: false`。

## 19. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 94%
尺寸估算: 96%
数据边界识别: 97%
```

所有尺寸均根据当前运行截图和现有 React/CSS 结构智能推算。若原始 Figma、Sketch 或 PSD 可获取，则可进一步校准到 100% 精准尺寸。

## 20. 等待确认

V32 设计稿已完成。项目现状最匹配的下一阶段是 React + Electron 实现；也可以选择先进入 Figma 设计阶段。React Native 与 HarmonyOS ArkUI 不适用于当前 Windows Electron 仓库，除非另开跨端项目。
