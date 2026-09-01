# 漫剧创作 V35 多剧集独立制作与导出 Design Spec

> 文档状态：待用户确认  
> 目标平台：Windows 10/11 桌面 EXE  
> 技术基线：Electron + React + Vite + 本地 FFmpeg  
> 视觉基线：天蓝渐变、明亮毛玻璃、影视导演工作台  
> 数据原则：只使用用户真实项目数据；不生成模拟项目、模拟任务或模拟媒体  
> 费用边界：不调用 DashScope、OSS 或任何付费生成接口

## 1. 来源与基准

### 1.1 视觉来源

- 当前运行截图：`outputs/runtime/final.png`
- 当前页面实现：`src/App.jsx` 中 `FinalPage`
- 当前样式实现：`src/App.css` 中 `final-page`、`final-preview`、`export-panel`、`production-timeline`
- 当前时间线实现：`src/services/timelineService.js`
- 当前项目数据实现：`src/services/projectModel.js`
- 当前字幕与历史实现：
  - `src/services/subtitleService.js`
  - `src/services/timelineHistoryService.js`

### 1.2 画布与设备假设

- 主要验收画布：1440 × 900 px。
- 视觉参考截图：1783 × 942 px。
- 最小应用窗口：沿用当前 Electron 窗口下限，不在 V35 修改主窗口配置。
- Windows 标题栏、系统缩放和任务栏由系统处理；页面从应用顶部导航下方开始滚动。
- V35 只面向桌面横向布局，不增加移动端或竖屏编辑器。
- 当前产品没有完整暗色主题；V35 保持亮色天蓝毛玻璃。

### 1.3 当前事实

1. 剧本、分镜和配音页已经按 `selectedEpisode` 筛选数据。
2. 成片页直接把项目全部 `shots` 传给 `buildProductionTimeline`，当前没有剧集选择器。
3. `audioTracks`、`subtitleCues`、`subtitleStyle` 和 `timelineHistory` 当前是项目级状态。
4. 当前恢复点按项目隔离，没有剧集维度。
5. 当前本地 MP4 导出接收整条项目时间线，因此多剧集项目会形成一个连续成片。
6. V35 必须同时处理画面范围、字幕、BGM/SFX、撤销历史、恢复点和导出历史；只增加下拉框会造成跨剧集数据串用。

## 2. 产品目标

### 2.1 核心目标

- 成片页一次只编辑和预览一个真实剧集。
- 当前剧集的镜头、字幕、BGM/SFX、字幕样式、撤销历史和恢复点互不串用。
- 本地 MP4 只导出当前剧集，文件名和历史记录明确包含剧集。
- 剧集切换时不丢失当前编辑，不重置其他剧集数据。
- 旧版单集项目无感迁移。
- 旧版多集项目不猜测用户原有全项目时间线的归属，不静默拆分或删除数据。

### 2.2 明确不做

- 不接入图片、配音或视频付费生成执行器。
- 不增加发行、发布、平台上传、云同步或多人协作。
- 不做多剧集批量导出队列；V35 先保证逐集导出正确。
- 不把图片和音频迁移到外置托管区；该能力保留给 V36。
- 不实现剧本、角色和分镜的全项目撤销；该能力保留给后续版本。
- 不重新设计整个成片页，只在现有视觉结构内增加剧集作用域。

## 3. 用户任务

### 3.1 主流程

```text
进入成片页
→ 默认打开当前选中的剧集
→ 查看该集镜头数量、总时长和素材完整度
→ 编辑该集镜头、字幕、BGM/SFX
→ 预览该集
→ 导出该集 MP4
→ 切换下一集继续制作
```

### 3.2 切换剧集

```text
点击剧集选择器
→ 选择目标剧集
→ 停止当前播放和本地试听
→ 保存当前剧集短生命周期编辑状态
→ 加载目标剧集时间线、字幕、音轨、历史和恢复点
→ 播放头回到 00:00.0
```

### 3.3 切换阻断

以下任一状态存在时禁止切换：

- 正在导出 MP4。
- 正在导入或标准化本地镜头视频。
- 正在拖动、缩放、拆分、复制或删除镜头。
- 正在执行不可中断的迁移提交。

禁用时必须显示真实原因，不允许点击后无反馈。

## 4. 数据与兼容设计

### 4.1 项目正文升级

V35 将项目正文从 `manju-project@1` 升级为 `manju-project@2`，避免继续在同一版本内静默改变数据语义。

建议结构：

```text
content
├─ episodes
├─ scenes
├─ characters
├─ shots
├─ videoAssets
├─ lines
├─ episodeProductions
│  └─ EpisodeProduction
│     ├─ episodeId
│     ├─ audioTracks
│     ├─ subtitleCues
│     ├─ subtitleCuesInitialized
│     └─ subtitleStyle
└─ legacyProduction（只在旧版多集迁移时存在）
   ├─ sourceVersion
   ├─ episodeIds
   ├─ audioTracks
   ├─ subtitleCues
   ├─ subtitleCuesInitialized
   └─ subtitleStyle
```

约束：

- `episodeProductions` 每个有效剧集最多一项。
- 删除剧集时同步删除对应 `episodeProduction`，但必须在既有删除确认中说明字幕与音轨影响。
- 新增剧集时创建空的 `episodeProduction`。
- `subtitleStyle` 初始继承项目最后一次确认样式，但保存后各集独立。
- `audioTracks` 继续遵守最多 6 条和当前项目 10 MB 限制。

### 4.2 V1 单集迁移

- 全部镜头、字幕、音轨和字幕样式直接迁移到唯一剧集。
- 不改变字幕时间、音轨起点和镜头顺序。
- 不显示迁移选择弹窗，只在项目摘要中记录“已从 V1 安全迁移”。

### 4.3 V1 多集迁移

旧数据没有可靠的剧集级字幕和音轨归属，V35 不做猜测分配。

迁移规则：

1. 原有全项目字幕、音轨和样式完整写入 `legacyProduction`。
2. 每个剧集创建独立 `episodeProduction`。
3. 各集字幕默认从该集真实分镜台词重建。
4. 各集 BGM/SFX 初始为空，不复制原有项目级音频，避免重复嵌入导致项目超限。
5. 成片页显示一次性迁移说明：
   - “旧版全项目成片”仍可只读预览和导出。
   - 新的剧集工作区可以独立编辑。
   - 原始来源 `.manju` 不会在打开时被修改。
6. 用户首次显式保存 V2 到原路径前，主进程创建同目录 V1 备份；备份成功前不覆盖来源文件。

这样可以保证：

- 不丢失旧字幕和音轨。
- 不把跨集 BGM/SFX 随意分给某一集。
- 用户仍能导出迁移前的全项目成片。
- 新编辑从剧集级正确数据开始。

### 4.4 运行时状态

```text
selectedEpisode
→ activeEpisodeShots
→ activeEpisodeProduction
→ activeEpisodeTimeline
→ activeEpisodeHistory
→ activeEpisodeRecoveryKey
→ activeEpisodeExportHistory
```

建议恢复点 Key：

```text
<project-recovery-key>::episode::<episode-id>
```

建议导出历史增加：

```text
episodeId
episodeTitle
scope = "episode" | "legacy-project"
```

### 4.5 剧集内镜头操作

- 时间线只接收当前剧集镜头。
- 拖动、成组移动、删除、复制、拆分和批量编辑只能影响当前剧集。
- 写回全局 `shots` 时保留其他剧集原顺序和对象引用。
- 不允许把镜头拖到另一剧集。
- 当前剧集全部镜头删除后，只显示该集空态；其他剧集不受影响。

## 5. 整体页面分析

| 字段 | 规格 |
| --- | --- |
| 页面名称 | 成片预览 · 剧集独立工作区 |
| 页面类型 | 桌面影视制作工作台 |
| 核心任务 | 逐集预览、时间线编辑、字幕/音轨编辑和本地导出 |
| 布局模型 | 顶部双栏 Grid + 下方横向时间线 + 字幕/音轨编辑区 |
| 视觉风格 | 天蓝渐变、明亮毛玻璃、深色视频监看区 |
| 主要颜色 | `#1D9FE6`、`#64CCF7`、`#EAF8FF`、`#173F58` |
| 间距节奏 | 8 / 12 / 16 / 24 px |
| 圆角 | 控件 10–12 px；卡片 20–24 px |
| 阴影 | 蓝灰低透明软阴影，不增加强发光 |
| 动效 | 剧集切换 160 ms 淡入；禁用复杂整页位移 |

## 6. 页面结构拆解

```text
FinalPage
├─ FinalTopGrid
│  ├─ FinalPreviewCard
│  │  ├─ PreviewHeader
│  │  │  ├─ PageIdentity
│  │  │  ├─ EpisodeScopeSelector（新增）
│  │  │  └─ SceneBadge
│  │  ├─ PreviewStage
│  │  └─ PlaybackBar
│  └─ ExportPanel
│     ├─ ExportTitle
│     ├─ EpisodeExportIdentity（新增）
│     ├─ LocalShotVideoCard
│     ├─ AiVideoRequestPreview
│     ├─ PreviewEpisodeButton
│     ├─ ExportSettings
│     ├─ ReadinessChecks
│     ├─ ExportProgress
│     ├─ ExportAction
│     └─ EpisodeExportHistory
├─ ProductionTimeline
│  ├─ TimelineHeader
│  │  ├─ EpisodeTimelineIdentity（新增）
│  │  ├─ SafetyActions
│  │  └─ DurationSummary
│  ├─ EpisodeEmptyState
│  ├─ ShotTrack
│  ├─ AudioTracks
│  └─ SubtitleEditor
├─ EpisodeSwitchBlockedNotice
└─ LegacyProductionMigrationModal（仅 V1 多集迁移）
```

## 7. 组件级设计稿

### 7.1 EpisodeScopeSelector

| 字段 | 规格 |
| --- | --- |
| 类型 | Select + 状态摘要 |
| 位置 | `FinalPreviewCard` 顶部标题右侧 |
| 宽度 | 约 360 px；占 1440 画布 25%；占预览卡约 30% |
| 高度 | 40 px；占首屏高度约 4.4%；占标题栏约 50% |
| 内部结构 | 左侧剧集原生 Select 250 px；右侧状态摘要 98 px |
| Padding | 4 px 外壳；Select 水平 12 px |
| 圆角 | 12 px |
| 背景 | `rgba(255,255,255,0.58)` |
| 边框 | `1px solid rgba(54,159,213,0.20)` |
| 阴影 | `0 8px 20px rgba(31,119,167,0.08)` |
| 文字 | 12 px / 18 px，600；深蓝灰 |
| 图标 | 剧集/列表语义图标 16 × 16 px，占控件高度 40% |
| 状态 | ready、warning、empty、disabled、focus-visible |

短文案：

- `第 1 集 · 暗流初现`
- `6 镜头 · 23.1 秒`
- 空集：`0 镜头 · 待制作`

### 7.2 EpisodeExportIdentity

| 字段 | 规格 |
| --- | --- |
| 类型 | 信息卡 |
| 位置 | 导出面板标题下、本地镜头视频卡上 |
| 宽度 | 100% 父容器，约 360 px；占页面宽约 25% |
| 高度 | 64 px；占首屏高度约 7% |
| Padding | 12 px 14 px |
| 圆角 | 14 px |
| 背景 | 天蓝到白色的 135° 低透明渐变 |
| 内容 | 剧集标题、镜头数、时长、导出范围说明 |
| 状态色 | 完整为青绿；缺失为琥珀；空集为灰蓝 |

禁止只显示“当前项目”。必须明确显示：

```text
导出范围
第 1 集 · 暗流初现
仅包含本集 6 个镜头
```

### 7.3 FinalPreviewCard

| 字段 | 规格 |
| --- | --- |
| 类型 | 主预览容器 |
| 位置 | 页面左上 |
| 宽度 | 约 72% 页面内容宽；1440 下约 1000 px |
| 高度 | 约 650 px；首屏约 72% |
| Padding | 18 px |
| 圆角 | 24 px |
| 布局 | 标题栏 64 px + 深色预览区 + 播放控制 54 px |
| 改动 | 标题栏增加 EpisodeScopeSelector；其他视觉结构保持 |

剧集切换完成后：

- 预览画面淡出 80 ms，重置后淡入 80 ms。
- 播放头回到 `00:00.0`。
- 当前镜头切换到该集第一个镜头。
- 不保留上一集的字幕预览或音频播放器。

### 7.4 ExportPanel

| 字段 | 规格 |
| --- | --- |
| 类型 | 导出检查与操作面板 |
| 位置 | 页面右上 |
| 宽度 | 约 26% 页面内容宽；1440 下约 370 px |
| 高度 | 与预览卡对齐或内部滚动 |
| Padding | 16 px |
| 圆角 | 22 px |
| 滚动 | 内容超高时仅面板内部纵向滚动 |
| 主按钮 | `导出本集 MP4`，高度 48 px，宽 100% |

导出文件默认名：

```text
<项目名>-第<序号>集-<剧集标题>.mp4
```

文件名继续经过 Windows 非法字符清理。

### 7.5 ProductionTimeline Header

| 字段 | 规格 |
| --- | --- |
| 类型 | 时间线上下文标题栏 |
| 位置 | 页面下方时间线卡顶部 |
| 宽度 | 100% |
| 高度 | 64–72 px |
| 左侧 | `第 1 集成片时间线（6 个镜头）` |
| 右侧 | 撤销、重做、拆分、历史、恢复点、多选及总时长 |
| 状态 | 切换中显示 `正在载入本集时间线`，禁止操作 |

### 7.6 EpisodeEmptyState

| 字段 | 规格 |
| --- | --- |
| 类型 | 空态 |
| 位置 | 时间线轨道区域 |
| 宽度 | 100% 父容器 |
| 高度 | 180 px；占时间线卡约 38% |
| 图标 | 分镜图标 32 × 32 px |
| 标题 | `本集还没有分镜` |
| 说明 | `前往分镜页为“第 2 集”创建真实镜头后，再进行成片制作。` |
| 按钮 | `前往本集分镜`，切换到分镜页并保持当前剧集 |
| 导出 | 导出按钮禁用，提示 `本集没有可导出的镜头` |

### 7.7 EpisodeSwitchBlockedNotice

| 字段 | 规格 |
| --- | --- |
| 类型 | 就地状态提示，不使用系统 alert |
| 位置 | 剧集选择器下方或页面顶部 Toast |
| 宽度 | 约 320 px |
| 高度 | 44–64 px |
| 背景 | 琥珀色低透明毛玻璃 |
| 图标 | 锁/时钟 16 × 16 px |
| 文案 | 根据真实阻断原因变化 |

示例：

- `正在导出第 1 集，完成或取消后才能切换。`
- `正在处理当前镜头视频，安全停止后才能切换。`
- `请先结束镜头拖动，再切换剧集。`

### 7.8 LegacyProductionMigrationModal

| 字段 | 规格 |
| --- | --- |
| 类型 | 兼容迁移说明 Modal |
| 画布覆盖 | 100% 页面；遮罩 `rgba(19,54,76,0.34)` |
| 弹窗宽度 | 760 px；占 1440 宽约 53% |
| 最大高度 | 720 px；占 900 高约 80% |
| Padding | 24 px |
| 圆角 | 22 px |
| 初始焦点 | `保留旧版全片并进入分集模式` |
| 主按钮 | `保留旧版全片并进入分集模式` |
| 次按钮 | `暂不迁移，返回项目总览` |
| 禁止项 | 不提供“自动猜测拆分音轨”按钮 |

内容区：

1. 发现的剧集数量。
2. 原全项目镜头、字幕和音轨数量。
3. 将保留的旧版全片说明。
4. 新分集工作区的初始化规则。
5. 来源文件不修改和首次保存备份说明。

## 8. 页面尺寸比例

以 1440 × 900 px 内容画布推算：

| 区域 | 估算尺寸 | 屏幕占比 |
| --- | --- | --- |
| 页面内容左右边距 | 24 px × 2 | 每侧约 1.7% 屏宽 |
| 顶部双栏区域 | 1392 × 650 px | 约 96.7% 屏宽、72.2% 屏高 |
| 主预览卡 | 1008 × 650 px | 约 70% 屏宽、72.2% 屏高 |
| 导出面板 | 368 × 650 px | 约 25.6% 屏宽、72.2% 屏高 |
| 双栏间距 | 16 px | 约 1.1% 屏宽 |
| EpisodeScopeSelector | 360 × 40 px | 25% 屏宽、4.4% 屏高 |
| 时间线卡 | 1392 × 480 px 以上 | 约 96.7% 屏宽 |
| 迁移弹窗 | 760 × 620 px | 约 52.8% 屏宽、68.9% 屏高 |

以上均为结合当前截图和既有 CSS 的推测值，实现时优先复用现有 Grid 和 token。

## 9. 状态与交互

### 9.1 Loading

- 剧集数据切换是本地同步操作，正常情况下不显示虚构百分比。
- 若恢复点列表需要异步读取，只显示 `正在读取本集恢复点`。

### 9.2 Empty

- 项目无剧集：沿用项目空工作区，不进入成片页。
- 当前剧集无镜头：显示 EpisodeEmptyState。
- 当前剧集无字幕：可从本集分镜台词重建。
- 当前剧集无音轨：角色配音仍可独立工作。

### 9.3 Error

- 剧集生产数据损坏：该集进入只读错误态，其他集仍可打开。
- 迁移失败：不写自动保存、不覆盖来源、不返回部分成功。
- 导出失败：只标记当前剧集导出失败，不污染其他集历史。

### 9.4 Disabled

- 导出中、视频处理中、镜头拖动中禁用剧集选择。
- 空剧集禁用播放、时间线编辑和导出。
- 禁用控件必须保留可读原因。

### 9.5 Selected

- 顶部成片页选择、当前剧集、当前镜头和当前字幕分别保留清晰选中态。
- 剧集切换后不继承上一集多选镜头。

### 9.6 Keyboard

- 原生 Select 支持方向键、Home、End 和首字母定位。
- `Escape` 关闭迁移说明但不提交迁移。
- 迁移 Modal 内限制 Tab 焦点，关闭后返回成片入口或项目总览。
- 时间线既有快捷键只作用于当前剧集。

### 9.7 Long Text

- 剧集标题最多单行省略，完整标题通过 `title` 或辅助说明显示。
- 导出文件名使用清理后的真实标题。
- 迁移说明允许纵向滚动，不压缩按钮。

### 9.8 Small Screen

- 1360 px 以上：保持当前双栏。
- 1024–1359 px：剧集选择器缩至约 280 px；导出面板允许内部滚动。
- 低于当前应用最小宽度：沿用现有不支持边界，不新增移动布局。

### 9.9 Dark Mode 与高对比度

- V35 不新增完整暗色主题。
- Windows 高对比度下，当前剧集和告警不能只靠颜色区分，必须同时有文字和图标。

## 10. Design System

### 10.1 Color System

| Token | 颜色 | 用途 |
| --- | --- | --- |
| `episode-accent` | `#22A8EB` | 当前剧集、主按钮 |
| `episode-accent-soft` | `rgba(106,207,248,0.22)` | 剧集选择器背景 |
| `episode-success` | `#18A8A6` | 完整度通过 |
| `episode-warning` | `#D9952D` | 缺失或切换阻断 |
| `episode-danger` | `#D95B63` | 迁移失败、不可恢复错误 |
| `episode-ink` | `#173F58` | 主文字 |
| `episode-muted` | `#7693A4` | 次文字 |

### 10.2 Typography

- 页面标题：32–36 px，760。
- 卡片标题：18–22 px，720。
- 剧集选择：12–13 px，650。
- 状态说明：10–11 px，550。
- 数字时长：等宽数字特性优先。
- 字体沿用 Windows 中文系统字体栈。

### 10.3 Component System

- Button：主按钮天蓝渐变，48 px 高；次按钮白色毛玻璃。
- Card：20–24 px 圆角，边框透明白和蓝灰双层。
- Navigation：沿用顶部导航，不新增侧栏。
- Modal：居中毛玻璃、遮罩、焦点限制、Escape 返回。
- List：剧集选择使用原生 Select，避免为少量选项引入复杂虚拟列表。
- Badge：状态必须包含短文字，不使用纯色点代替。
- Avatar：V35 不新增头像。
- Feed：不适用；导出历史继续使用紧凑列表。

## 11. 中文文案表

| 场景 | 文案 |
| --- | --- |
| 剧集选择标签 | 当前制作剧集 |
| 剧集摘要 | 6 镜头 · 23.1 秒 |
| 导出范围标题 | 导出范围 |
| 导出范围说明 | 仅包含本集镜头、字幕、配音和音轨 |
| 预览按钮 | 从头预览本集 |
| 导出按钮 | 导出本集 MP4 |
| 时间线标题 | 第 1 集成片时间线（6 个镜头） |
| 空态标题 | 本集还没有分镜 |
| 空态按钮 | 前往本集分镜 |
| 空态导出提示 | 本集没有可导出的镜头 |
| 切换阻断 | 正在导出当前剧集，完成或取消后才能切换。 |
| 迁移标题 | 旧版多集成片需要安全迁移 |
| 迁移说明 | 旧版把全部剧集放在同一条成片时间线中，无法可靠判断字幕和音轨归属。 |
| 迁移主按钮 | 保留旧版全片并进入分集模式 |
| 迁移次按钮 | 暂不迁移，返回项目总览 |
| 旧版入口 | 旧版全项目成片 · 只读 |
| 保存备份 | 首次保存 V2 前会保留原 V1 项目备份 |
| 导出成功 | 第 1 集 MP4 已导出 |
| 导出取消 | 已取消第 1 集 MP4 导出 |

## 12. React / Electron 实现映射

```text
App
├─ projectModel / projectMigrationService
│  ├─ read V1 / V2
│  ├─ migrate V1 single episode
│  └─ preserve V1 multi-episode legacy production
├─ episodeProductionService
│  ├─ create/get/update EpisodeProduction
│  ├─ filter and merge episode shots
│  └─ validate cross-episode isolation
├─ FinalPage
│  ├─ EpisodeScopeSelector
│  ├─ activeEpisodeTimeline
│  ├─ EpisodeExportIdentity
│  └─ current episode editing controls
├─ projectRepository
│  └─ V1 source backup before first overwrite
├─ videoExportRepository
│  └─ current episode metadata
└─ exportHistoryRepository
   └─ episodeId / episodeTitle / scope
```

边界：

- 页面只负责选择剧集和展示状态。
- 剧集生产数据归一化、迁移和全局镜头合并放在纯服务。
- 文件备份和实际写入必须在 Electron 主进程。
- Renderer 不直接访问文件系统。
- Provider、Key 和付费锁不因 V35 改变。

## 13. 验收标准

### 13.1 功能

1. 多集项目进入成片页时只显示当前剧集镜头。
2. 切换剧集后，播放头、选择、字幕、音轨、历史和恢复点不串集。
3. 修改第 1 集字幕后，第 2 集数据字节不变化。
4. 修改第 2 集 BGM 后，第 1 集预览和导出不包含它。
5. 拖动、拆分、删除和复制只能修改当前剧集镜头。
6. 导出文件只包含当前剧集。
7. 导出历史明确显示剧集。
8. 单集 V1 项目无损迁移到 V2。
9. 多集 V1 的旧项目级字幕和音轨完整保留在只读兼容工作区。
10. 首次覆盖保存 V1 来源前创建可读取备份；备份失败则不覆盖。

### 13.2 安全

1. 不调用网络或付费接口。
2. 迁移失败不写入来源项目。
3. 剧集切换中不产生半完成时间线状态。
4. 导出取消等待 FFmpeg 退出并清理临时文件。
5. Key 不进入 V2 项目、备份或导出历史。

### 13.3 性能

1. 500 镜头、20 剧集的剧集切换 P95 小于 80 ms。
2. 剧集切换 Long Task 数为 0。
3. 100 条字幕和 6 条音轨的单集初始化 P95 小于 100 ms。
4. 其他剧集数据不参与当前预览播放器调度。

### 13.4 响应式与可访问性

1. 1440 × 900 和 1024 宽窗口无横向溢出。
2. Select、迁移 Modal 和导出确认支持完整键盘操作。
3. 焦点切换和 Escape 返回正确。
4. 状态不只依赖颜色。

## 14. 建议测试

```text
test:episode-production-service
test:project-v1-v2-migration
test:episode-production-ui
test:episode-export
test:timeline-history
test:timeline-edit
test:project
test:project-portability
test:user-data-only
test:product-acceptance
lint
build
package:win
```

新增测试必须覆盖：

- 两集各自不同图片、配音、字幕、BGM 和 SFX。
- 多次来回切换。
- 当前集空镜头。
- 导出中切换阻断。
- V1 单集与 V1 多集。
- 备份失败、迁移失败和无写入。
- HTTP/付费调用次数为 0。

## 15. 完整组件树

```text
FinalPage
├─ FinalPreviewCard
│  ├─ PreviewHeader
│  │  ├─ FinalCutTitle
│  │  ├─ EpisodeScopeSelector
│  │  └─ SceneBadge
│  ├─ PreviewStage
│  └─ PlaybackBar
├─ ExportPanel
│  ├─ ExportTitle
│  ├─ EpisodeExportIdentity
│  ├─ LocalShotVideoCard
│  ├─ AiVideoRequestPreview
│  ├─ PreviewEpisodeButton
│  ├─ ResolutionSelect
│  ├─ ReadinessChecks
│  ├─ ExportProgress
│  ├─ ExportEpisodeButton
│  └─ EpisodeExportHistory
├─ ProductionTimeline
│  ├─ EpisodeTimelineHeader
│  ├─ SafetyActions
│  ├─ ShotTrack
│  ├─ AudioTrackEditor
│  └─ SubtitleTrackEditor
├─ EpisodeEmptyState
├─ EpisodeSwitchBlockedNotice
└─ LegacyProductionMigrationModal
   ├─ MigrationSummary
   ├─ PreservedDataList
   ├─ NewEpisodeWorkspaceList
   ├─ SourceSafetyNotice
   └─ MigrationActions
```

## 16. 设计还原评分

```text
设计识别置信度: 99%
布局识别: 99%
颜色识别: 98%
字体识别: 96%
尺寸估算: 97%
数据兼容设计: 95%
```

现有成片截图、运行代码和 V9–V34 Design Spec 均可直接核对，因此视觉置信度较高。旧版多集项目的真实使用规模未知，所以数据迁移设计仍需用户确认。

## 17. 不确定项与推测值

- 旧版多集项目是否已经存在大量项目级 BGM/SFX，无法从仓库判断。
- 当前没有用户提供的真实多集 `.manju` 样本，迁移实现必须使用合成结构测试，但不得把测试数据带入成品。
- 迁移弹窗尺寸和新增剧集选择器尺寸为基于当前运行截图的推测值。
- V35 默认采用“保留旧版全项目成片为只读兼容工作区”的安全策略，不自动猜测拆分旧音轨。

## 18. 等待确认

请确认是否按本设计稿进入 React + Electron 实现阶段。

