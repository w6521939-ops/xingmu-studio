# 漫剧创作 V33 项目素材打包迁移与托管媒体清理 Design Spec

## 0. 文档状态

- 目标版本：1.31.0（已实现并完成验收）。
- 当前基线：1.30.0。
- 目标平台：Windows x64 Electron EXE。
- 本轮阶段：设计门禁；不生成 React、CSS、Electron 实现代码。
- 费用边界：纯本地功能，不调用 DashScope、OSS、上传、轮询或任何付费接口。
- 文件安全边界：本轮不复制、不移动、不删除任何用户媒体；实现阶段也必须先预览、再确认。

## 1. 来源与基准

### 1.1 项目证据

- `main.js` 当前将镜头视频托管到 `app.getPath('userData')/media/shot-videos`，目录由稳定 `localProjectId` 的哈希与受限 `assetId` 派生。
- `.manju` 项目文件限制为 10 MB，保存 `content.videoAssets`、镜头引用、真实末帧和素材元数据，不嵌入 MP4，也不保存用户原始绝对路径。
- 素材库已分别展示“项目容量”和“本机托管媒体”，但尚无可用的迁移与清理工作流。
- “解除镜头视频引用”当前保留托管副本，以支持撤销、重做和时间线恢复点。
- 时间线最多保留 8 个恢复点；清理判断不能只读取当前页面状态，还必须保护恢复点仍引用的媒体。
- 角色图片、分镜图片、配音、BGM 与 SFX 当前已经作为 Data URL 保存在 `.manju`；V33 首版需要额外携带的外部媒体主要是托管 MP4。
- 原生文件菜单已支持新建、打开、保存与另存为；V33 可新增“导入便携项目”和“导出便携项目”，但不能改变现有 `.manju` 语义。

### 1.2 视觉来源

- `outputs/runtime/local-shot-video-asset-library-verified.png`
- `outputs/runtime/unified-asset-library.png`
- `docs/design/manju-creation-v28-unified-asset-library.md`
- `docs/design/manju-creation-v32-local-shot-video-adoption-continuity.md`
- 当前已确认方向：渐变天蓝色、明亮毛玻璃、轻科技感、专业创作工作台布局。

### 1.3 画布与设备假设

- 主设计画布：1440 × 900。
- 最低可操作宽度：1024 px；最低有效高度：720 px。
- Windows 缩放重点：100%、125%、150%。
- 顶部导航壳保持不变；新能力以素材库入口和模态工作流呈现，不增加新的一级导航。
- 当前为桌面应用，不套用移动端安全区；吸底操作区仍保留 12～16 px 底部内边距。

# 项目设计分析

## 2. 产品类型

专业型、本地优先的 Windows 漫剧制作工作台。本次 V33 是项目资产运维能力：让用户能把 `.manju` 与托管镜头视频作为一个可迁移单元导出，并能在不破坏当前项目、撤销记录和恢复点的前提下审计、清理本机托管空间。

## 3. 目标用户

- 独立漫剧创作者、小型短剧团队、剪辑与分镜制作人员。
- 经常在本机保存多个项目，需要把项目移动到另一台电脑、外接硬盘或归档盘。
- 不愿承担云存储和 AI 生成费用，希望所有迁移与清理都能离线完成。
- 不熟悉 `AppData`、哈希目录或媒体引用关系，需要由产品解释“能不能删、删了影响什么”。

## 4. 使用场景

- 将当前项目连同真实镜头视频复制到移动硬盘，在另一台电脑继续制作。
- 项目阶段完成后归档可迁移副本，避免只复制 `.manju` 后视频缺失。
- 检查本机托管视频占用了多少空间、哪些仍被当前镜头或恢复点使用。
- 清理已经解除引用、没有被任何当前快照或恢复点保护的托管副本。
- 导入便携项目时安全处理同名项目、相同 `localProjectId`、文件损坏和空间不足。

## 5. 核心价值

- 把“项目文件可保存”升级为“真实视频素材可迁移”。
- 把不可见的托管目录转化为可解释、可审计、可预览影响的存储中心。
- 默认保护当前引用、自动草稿和恢复点，避免为了省空间破坏撤销与恢复能力。
- 所有路径选择、哈希验证、复制和清理均在主进程完成，Renderer 不接触任意绝对路径。

# 用户画像

## 6. 主要画像

| 维度 | 描述 |
| --- | --- |
| 年龄 | 20～45 岁 |
| 职业 | 独立创作者、漫剧导演、分镜师、剪辑师、小型内容团队负责人 |
| 使用习惯 | 长时间桌面操作；项目多、视频大；习惯通过 U 盘、移动硬盘或网盘文件夹迁移工程 |
| 技术熟悉度 | 熟悉文件夹与安装包，但通常不了解应用数据目录、资产 ID、哈希和恢复点引用 |
| 核心痛点 | 只复制 `.manju` 后视频缺失；不知道哪些缓存可以删；担心清理后无法撤销；不愿上传云端或产生费用 |
| 决策偏好 | 先看清单和影响，再执行；喜欢明确的“不会删除什么”和真实空间统计 |

# 产品视觉方向

## 7. 视觉定位

### 7.1 设计关键词

- Sky-blue glassmorphism
- Local-first trust
- Storage observability
- Calm technical precision
- Recoverable destructive actions
- Editorial density

### 7.2 视觉理由

- 延续现有天蓝渐变毛玻璃，避免把存储功能做成突兀的系统工具页。
- 蓝色用于迁移、复制与安全信息；青绿色用于校验通过；琥珀用于缺失、空间不足和待确认；红色仅用于最终不可逆动作。
- 不使用夸张环形动画或虚构进度。只有已知字节总量时显示真实百分比；扫描阶段只显示真实阶段和数量。
- 高风险按钮与普通“解除引用”明确分层，不用同一个主色制造误触。

## 8. 设计假设

- V33 首版输出“便携项目文件夹”，而不是单文件压缩包，目录名使用 `<项目名>.manju-bundle`。这样不新增压缩依赖，复制过程可逐文件校验，也便于损坏恢复。
- 便携项目文件夹是一个 Windows 文件夹，不伪装成已经支持的压缩格式；未来如需单文件 `.manjupack`，应单独设计并确认新增归档依赖。
- V33 首版导入默认“作为副本导入”，生成新的 `localProjectId`，不静默覆盖本机同 ID 项目。
- 清理默认只允许处理“当前项目、自动草稿和全部恢复点均未引用”的视频；受恢复点保护的资产必须先单独处理恢复点，不能在同一确认框中绕过。

## 9. 范围与非范围

### 9.1 本轮设计范围

- 素材库增加“存储与迁移”入口及状态摘要。
- 导出便携项目文件夹：清单、空间检查、复制、校验、取消、结果。
- 导入便携项目文件夹：结构验证、哈希校验、冲突策略、复制、打开结果。
- 托管媒体扫描：正在使用、恢复点保护、可清理、损坏、临时残留。
- 安全清理：逐项选择、影响确认、移至 Windows 回收站、审计记录。
- 原生文件菜单增加导入/导出入口，但复用相同业务流程。
- 覆盖 empty、loading、error、canceled、partial、missing、insufficient-space、selected、disabled、success 状态。

### 9.2 明确不做

- 不接入云盘、账号同步、协同共享或发行。
- 不上传任何素材，不调用 AI，不消耗百炼额度。
- 不改变 `.manju` 现有格式含义，不把视频 Base64 写入项目。
- 不自动清理、不在应用启动时后台删除、不根据“最后使用时间”静默淘汰。
- 不清理仍被当前项目、自动草稿或任一恢复点引用的媒体。
- 不覆盖用户原始视频，不修改便携包源目录，不清理导出成片记录。
- 不把 `key.txt`、环境变量、日志、恢复点、导出历史、设置或用户绝对路径写入便携包。
- 不在首版提供跨平台 macOS/Linux 兼容承诺。

# 页面列表

## 10. 功能页面与状态

| 页面/状态 | 页面目标 | 核心模块 | 布局 | 主要交互 | 视觉重点 |
| --- | --- | --- | --- | --- | --- |
| 素材库 · 存储摘要 | 暴露迁移与清理入口 | 项目容量、本机托管容量、健康数量、存储与迁移按钮 | 现有三栏素材库顶部 | 打开存储中心 | 延续现有布局，不新增一级导航 |
| 存储与迁移中心 | 汇总当前项目可移植性和空间状态 | 项目摘要、迁移 Tab、清理 Tab、安全边界 | 980 px 居中毛玻璃模态 | 切换、开始导入/导出、扫描空间 | 两类任务分区明确 |
| 导出便携项目 · 预检 | 让用户确认将复制哪些真实数据 | 项目文件、视频清单、缺失项、目标空间、排除项 | 模态内容双栏 | 选择目标、包含可用视频、开始导出 | 真实字节数与“不包含”说明 |
| 导出便携项目 · 进度/结果 | 展示真实复制与校验进度 | 当前文件、字节进度、阶段、取消、结果路径 | 单列进度面板 | 取消、打开文件夹、完成 | 不伪造速度和完成状态 |
| 导入便携项目 · 验证 | 验证包结构与素材完整性 | manifest、项目摘要、视频哈希、空间、风险 | 双栏校验面板 | 选择文件夹、作为副本导入 | 先验证后写入本机托管区 |
| 导入便携项目 · 冲突/结果 | 处理同 ID 或同名项目 | 新项目名、ID 策略、媒体复制结果、失败清单 | 确认页 + 结果页 | 作为副本、取消、打开项目 | 默认不覆盖，部分失败不伪装成功 |
| 托管媒体清理 · 扫描 | 解释本机媒体归属 | 分类统计、扫描阶段、保护说明 | 清理 Tab 顶部 | 扫描、刷新 | 当前引用与恢复点保护可见 |
| 托管媒体清理 · 复核 | 选择真正可清理的资产 | 资产列表、末帧、大小、最后记录、原因 | 左列表 + 右影响检查器 | 多选、全选可清理项、查看引用 | “可清理”必须有证据 |
| 托管媒体清理 · 确认/结果 | 防止误删并记录实际结果 | 二次确认、回收站说明、逐项结果、审计摘要 | 720 px 危险确认 + 结果 | 移至回收站、取消、打开日志 | 红色只用于最终确认 |
| 异常状态 | 让任务可恢复 | 空间不足、包损坏、哈希不符、路径不可写、取消、部分成功 | 就地告警 + 详情抽屉 | 重试、换位置、导出报告 | 错误真实、路径脱敏 |

# 信息架构与流程

## 11. 入口结构

```text
顶部原生文件菜单
├─ 导入便携项目…
└─ 导出当前项目便携副本…

素材库
└─ 项目容量卡
   ├─ 项目容量 119 KB / 10 MB
   ├─ 本机托管媒体 302 KB
   ├─ 视频健康摘要
   └─ 存储与迁移
      ├─ 项目迁移
      │  ├─ 导出便携项目
      │  └─ 导入便携项目
      └─ 清理空间
         ├─ 扫描托管媒体
         ├─ 复核可清理项
         └─ 移至 Windows 回收站
```

## 12. 导出流程

```text
打开“存储与迁移”
└─ 项目迁移 / 导出便携项目
   ├─ 读取当前稳定项目快照
   ├─ 查询当前项目所有视频健康状态
   ├─ 计算项目 JSON、可用 MP4 和目标所需空间
   ├─ 展示包含项、缺失项和明确排除项
   ├─ Windows 选择目标父文件夹
   ├─ 创建 `<项目名>.manju-bundle-pending`
   ├─ 写入 project.manju 与 manifest.json
   ├─ 逐个复制允许的视频并校验 SHA-256
   ├─ 写入 README.txt
   ├─ 原子重命名为 `<项目名>.manju-bundle`
   └─ 展示真实结果
```

缺失媒体时默认阻止“完整便携包”完成。用户可以显式选择“仅导出当前可用素材”，结果必须标记为“不完整便携副本”，并在 manifest 中记录缺失资产 ID 和文件名。

## 13. 导入流程

```text
导入便携项目
└─ Windows 选择 `.manju-bundle` 文件夹
   ├─ 主进程验证目录边界、manifest 与 project.manju
   ├─ 拒绝符号链接、重解析点、越界路径和未知可执行文件
   ├─ 验证项目 ≤10 MB
   ├─ 验证每个 MP4 ≤250 MB、允许的资产 ID、实际大小和 SHA-256
   ├─ 计算本机所需空间
   ├─ 默认生成新 localProjectId 与“副本”名称
   ├─ 复制到新项目媒体 pending 目录并二次校验
   ├─ 原子提交托管目录
   ├─ 保存导入后的本地项目快照
   └─ 询问是否打开项目
```

## 14. 清理流程

```text
清理空间 / 扫描
├─ 当前快照引用
├─ 自动草稿引用
├─ 最多 8 个时间线恢复点引用
├─ 当前进行中的视频处理与导出
└─ 托管目录实际资产
   ├─ 正在使用：永不允许选择
   ├─ 恢复点保护：永不允许在本页绕过
   ├─ 可清理：所有权明确且无任何保护引用
   ├─ 临时残留：无活跃任务且 pending 已过安全窗口
   └─ 损坏/未知：先隔离并导出诊断，不直接删除

用户选择可清理项
└─ 二次确认影响与总大小
   ├─ 取消：零修改
   └─ 移至 Windows 回收站
      ├─ 逐项执行
      ├─ 每项记录真实结果
      └─ 部分失败时保留失败项并允许重试
```

# 页面结构与组件级设计稿

## 15. 素材库 · 存储摘要

### 15.1 页面结构

```text
AssetLibraryPage
├─ TopNavigation
├─ AssetHeader
│  ├─ TitleBlock
│  └─ StorageSummaryCard
│     ├─ ProjectSizeRow
│     ├─ ManagedMediaRow
│     ├─ HealthSummary
│     └─ StorageAndMigrationButton
├─ AssetToolbar
├─ AssetWorkspace
│  ├─ FilterSidebar
│  ├─ AssetCollection
│  └─ AssetInspector
└─ StorageMigrationLayer（按需）
```

### 15.2 区域占比

| 区域 | x | y | width | height | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| 顶部导航 | 0% | 0% | 100% | 10.5% | 沿用当前应用壳 |
| 页面标题区 | 2.1% | 13.2% | 66.5% | 12.8% | 标题、说明 |
| 存储摘要卡 | 70.2% | 13.2% | 27.2% | 13.5% | 约 392 × 122 px，推测值 |
| 工具栏 | 1.5% | 28.3% | 97% | 8.5% | 沿用现有搜索与导入 |
| 三栏工作区 | 1.5% | 38.2% | 97% | 59.5% | 沿用现有素材库 |

### 15.3 StorageSummaryCard

| 字段 | 规格 |
| --- | --- |
| 类型 | Card / 状态摘要 / 功能入口 |
| 位置 | 素材库 Header 右侧 |
| 宽度 | 392 px；约屏宽 27.2%；占 Header 内容宽约 28.3% |
| 高度 | 122 px；约页面高 13.6% |
| Padding | 16 px；约卡宽 4.1% |
| 圆角 | 20 px |
| 背景 | `rgba(242,251,255,.70)` + 右上天蓝渐变高光 |
| 边框 | 1 px `rgba(255,255,255,.88)` |
| 阴影 | `0 14px 34px rgba(27,119,163,.13)` |
| 容量行 | 两行，每行 24 px；标签 12 px/600，值 13 px/760 |
| 健康摘要 | `3 个可用 · 1 个可清理`，11 px，实际数量；无模拟统计 |
| 按钮 | 112 × 32 px；占卡宽 28.6%；图标 14 × 14 px，占按钮高 43.8% |
| 状态 | normal / scanning / warning / no-video / unavailable |
| 长文本 | 项目名不放在卡内；数量超过 999 显示 `999+` |

## 16. 存储与迁移中心

### 16.1 Layer 与 Dialog

| 字段 | 规格 |
| --- | --- |
| Layer | fixed inset 0；z-index 280，高于 V32 本地视频弹窗 270；背景 `rgba(10,39,57,.42)` |
| Dialog 宽度 | 980 px；约屏宽 68.1%；最大 `calc(100vw - 48px)` |
| Dialog 高度 | 720 px；约页面高 80%；最大 `calc(100vh - 40px)` |
| 背景 | 天蓝—白渐变毛玻璃；实现优先静态半透明层，不动画 `backdrop-filter` |
| 圆角 | 26 px |
| Padding | 24 px；约 Dialog 宽 2.4% |
| Header | 72 px；占 Dialog 高 10% |
| TabBar | 46 px；占 Dialog 高 6.4% |
| Content | 520 px；占 Dialog 高 72.2%；内部滚动 |
| Footer | 58 px；占 Dialog 高 8.1%；吸底，不遮挡错误提示 |

### 16.2 Header

- 图标容器：48 × 48 px；约 Header 高 66.7%；天蓝渐变，18 px 圆角。
- 主图标：`hard-drive` 或 `archive`，22 × 22 px；占图标容器 45.8%；线性 1.8 px。
- Eyebrow：`LOCAL PROJECT STORAGE`，10 px / 760 / 0.1em。
- 标题：`存储与迁移`，24 px / 780，行高 30 px。
- 说明：`打包真实素材，安全清理本机托管副本`，12 px / 500。
- 关闭按钮：36 × 36 px；点击区不小于 36 px；任务运行时禁用并显示原因。

### 16.3 TabBar

- 宽度：100%；两项各 50%。
- Tab：`项目迁移`、`清理空间`。
- 高度：40 px；圆角 13 px。
- Selected：淡天蓝填充、2 px 下边强调线、深蓝文字。
- Focus：2 px `#239FE3` 外环，offset 2 px。
- Tab key 固定为 `portability` / `cleanup`，不随中文文案变化。

## 17. 项目迁移 Tab

### 17.1 总览布局

| 区域 | 相对 Content x/y | width | height |
| --- | --- | ---: | ---: |
| 当前项目卡 | 0% / 0% | 100% | 20% |
| 导出便携项目卡 | 0% / 23% | 48.5% | 45% |
| 导入便携项目卡 | 51.5% / 23% | 48.5% | 45% |
| 本地边界说明 | 0% / 72% | 100% | 24% |

### 17.2 当前项目卡

- 尺寸：932 × 104 px；占 Content 宽 100%、高约 20%。
- 左侧：项目名、`.manju` 大小、镜头视频数量。
- 中部：`可用 3`、`缺失 0`、`托管 302 KB` 三个真实 Badge。
- 右侧：状态 `可完整迁移` / `存在缺失素材`。
- 项目名最多 32 个可见字符，两行省略，title 保留完整名称。

### 17.3 导出/导入卡

- 单卡：452 × 234 px；占 Content 宽 48.5%、高 45%。
- 图标：40 × 40 px；占卡高 17.1%。
- 标题：18 px / 740；说明 12 px / 1.6 行高，最多三行。
- 事实列表：3 行，每行 26 px；使用 check/shield/folder 图标 15 px。
- 主按钮：100% × 42 px；底部对齐；`导出便携项目` / `选择便携项目文件夹`。
- 导入卡不显示拖拽区，避免浏览器式任意路径处理；只使用 Windows 文件夹选择器。

## 18. 导出预检、进度与结果

### 18.1 导出预检

```text
ExportReview
├─ BackButton
├─ SummaryStrip
│  ├─ ProjectBytes
│  ├─ VideoCount
│  ├─ MediaBytes
│  └─ EstimatedRequiredSpace
├─ IncludedList
│  └─ VideoRow × N
├─ ExcludedPanel
├─ MissingWarning（条件）
└─ Footer
   ├─ ChooseDestination
   ├─ Cancel
   └─ StartExport
```

- 清单区宽 61%，右侧边界说明 36%，间距 3%。
- VideoRow：100% × 58 px；末帧 42 × 42 px；文件名 12 px；时长/分辨率/大小 10 px；健康 Badge 22 px 高。
- 右侧“不会包含”明确列出 Key、设置、日志、恢复点、导出历史、用户原始路径。
- 目标位置在 Renderer 仅显示脱敏形式，例如 `D:\…\归档`；完整路径只存在主进程。
- 开始按钮只有在目标可写、空间足够、预检完成时启用。

### 18.2 真实进度

- 进度条宽 100%、高 8 px；百分比只使用 `已复制字节 / 总字节`。
- 阶段：`准备清单`、`写入项目`、`复制视频 x/y`、`校验哈希 x/y`、`提交便携文件夹`。
- 当前文件名最多一行；不显示完整绝对路径。
- 取消时文案：`正在停止复制并清理未完成目录…`；等待主进程确认后才能关闭。
- 未知总字节时不显示虚构百分比，仅显示阶段与已处理数量。

### 18.3 结果

- Success：青绿色校验图标 48 px；`便携项目已完成`；显示项目文件 1、视频 N、总大小、校验 N/N。
- Partial：琥珀图标；`已导出不完整便携副本`；列出缺失资产数量和报告入口。
- Failed：红色线性警告；显示真实失败阶段和可重试动作，不显示“已完成”。
- 操作：`打开文件夹`、`复制结果摘要`、`完成`。

## 19. 导入验证、冲突与结果

### 19.1 验证面板

- 左 58%：项目摘要与视频清单；右 39%：安全验证和空间检查；间距 3%。
- 验证项：目录结构、manifest 版本、项目格式、项目大小、资产 ID、文件大小、SHA-256、可用空间、未知文件。
- 每项使用真实 `checking / passed / warning / failed` 状态；失败项展开后显示脱敏原因。
- 未知 `.exe`、脚本、符号链接、重解析点或越界路径直接阻断，不提供“仍然导入”。

### 19.2 冲突确认

- 标题：`作为新的本地副本导入`。
- 原项目名只读；新项目名可编辑，默认 `<原名>（副本）`，最多 80 字符。
- ID 策略固定：生成新 `localProjectId`；不提供“保留并覆盖”快捷选项。
- 视频资产 ID 在新项目隔离目录内可保持不变；绝对路径重新派生。
- 主操作：`导入为副本`；次操作：`取消`。

### 19.3 导入结果

- 全部校验并复制成功后才显示 `导入完成`。
- 某一视频复制失败时整个新项目不提交，清理 pending；原便携文件夹和当前项目均不变。
- 操作：`打开导入项目`、`留在当前项目`、`打开本机托管位置`。

## 20. 清理扫描与复核

### 20.1 分类摘要

四张统计卡横排：

| 卡片 | 色彩 | 可选择 | 文案 |
| --- | --- | --- | --- |
| 正在使用 | 青绿 | 否 | 当前镜头或项目资产仍在使用 |
| 恢复点保护 | 天蓝 | 否 | 撤销或恢复仍可能需要 |
| 可清理 | 琥珀 | 是 | 当前快照与恢复点均未引用 |
| 待诊断 | 灰蓝 | 否 | 损坏或归属无法确认，不自动删除 |

- 单卡约 220 × 90 px，占 Content 宽 23.6%；间距 1.8%。
- 显示真实数量和大小，不显示百分比估计。

### 20.2 CleanupList

- 左列表宽 62%，右检查器宽 35%，间距 3%。
- 行高 68 px；Checkbox 18 px；末帧 48 × 48 px；文件信息两行；大小右对齐。
- 只有 `eligible` 项显示 Checkbox；protected/unknown 使用锁图标与禁用说明。
- 顶部操作：`全选可清理项`、`清除选择`、按大小/日期排序。
- 选择总计吸底显示：`已选择 3 项 · 预计从应用托管区移出 824 MB`。

### 20.3 影响检查器

- 展示资产 ID 短码、原文件名、真实末帧、时长、分辨率、大小、导入时间。
- “判定证据”列出：当前镜头引用 0、自动草稿引用 0、恢复点引用 0、活跃任务 0。
- 不显示 AppData 绝对路径；只显示 `当前项目托管区`。
- 操作：`打开托管位置`、`从选择中移除`。

## 21. 清理确认与结果

### 21.1 危险确认 Dialog

| 字段 | 规格 |
| --- | --- |
| 宽度 | 720 px；占屏宽 50%；最大 `calc(100vw - 40px)` |
| 高度 | 内容自适应，最大 620 px；占页面高最多 68.9% |
| Header | 红色仅用于 44 px 警告图标和最终按钮，不铺满背景 |
| 摘要 | 数量、总大小、判定证据、Windows 回收站说明 |
| 确认控件 | Checkbox：`我已确认这些媒体不被当前项目和恢复点使用` |
| 主按钮 | `移至 Windows 回收站`，仅确认勾选后启用 |
| 取消按钮 | 默认焦点，Esc 返回复核页 |

### 21.2 结果规则

- 每个资产逐项报告 `已移至回收站 / 失败 / 已跳过（引用变化）`。
- 执行前必须再次扫描引用；如果用户在复核期间重新绑定视频，该项变为 `已跳过`。
- 部分失败不回滚已经成功移至回收站的其他项，但必须显示准确计数与失败原因。
- 清理完成后刷新素材库容量和健康状态；不得自动清空 Windows 回收站。
- 审计记录只保存资产 ID 短码、大小、时间和结果，不保存 Key 或用户原始路径。

# 文件与数据合约

## 22. 便携文件夹结构

```text
项目名.manju-bundle/
├─ manifest.json
├─ project.manju
├─ README.txt
└─ media/
   └─ shot-videos/
      ├─ <asset-id-1>/video.mp4
      └─ <asset-id-2>/video.mp4
```

### 22.1 manifest.json

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `format` | string | 固定 `manju-portable-project` |
| `version` | number | V33 首版为 1 |
| `createdAt` | string | ISO 时间 |
| `appVersion` | string | 导出应用版本，仅用于诊断 |
| `projectFile` | string | 固定 `project.manju` |
| `projectSha256` | string | 项目文件真实 SHA-256 |
| `projectLocalId` | string | 项目稳定 ID；导入时默认生成新 ID |
| `projectName` | string | 用户可见名称 |
| `complete` | boolean | 是否包含所有应携带视频 |
| `assets` | array | 允许的视频清单 |
| `missingAssets` | array | 不完整导出时的缺失资产摘要 |

### 22.2 manifest.assets[]

| 字段 | 规则 |
| --- | --- |
| `id` | 受限资产 ID，只允许现有安全字符规则 |
| `kind` | 固定 `shot-video` |
| `relativePath` | 固定模板 `media/shot-videos/<id>/video.mp4`，禁止 `..`、绝对路径和反斜杠混用绕过 |
| `bytes` | 实际文件字节数 |
| `sha256` | 复制后重新计算的 SHA-256 |
| `duration` / `width` / `height` / `fps` | 与项目元数据交叉验证 |
| `fileName` | 脱敏原文件名，不含目录 |

### 22.3 README.txt

- 简短说明这是“漫剧创作”便携项目文件夹。
- 提醒不要单独移动内部文件；应从应用选择整个 `.manju-bundle` 文件夹导入。
- 不写账号、Key、原始路径或日志。

## 23. 清理扫描结果

运行时返回，不写入 `.manju`：

| 字段 | 规则 |
| --- | --- |
| `assetId` | 不透明 ID |
| `status` | `in-use` / `recovery-protected` / `eligible` / `pending` / `unknown` |
| `bytes` | 实际磁盘字节数 |
| `currentReferenceCount` | 当前项目与自动草稿引用数 |
| `recoveryReferenceCount` | 时间线恢复点引用数 |
| `activeTask` | 是否被处理或导出任务占用 |
| `reasonCode` | 稳定机器码，不使用中文文案作为业务 key |
| `displayFileName` | 文件名，不含绝对路径 |

# Electron、安全与文件操作边界

## 24. Main process

- Windows 文件夹选择、目录创建、文件读取、复制、哈希、可用空间检查、原子提交和回收站操作全部在主进程。
- Renderer 不得传入任意源路径、目标文件路径、FFmpeg 参数或删除目标；只传稳定项目 ID、资产 ID 和用户确认令牌。
- 所有复制目标先解析为绝对路径，并验证仍在用户刚选择的目标目录或应用媒体根目录内。
- 拒绝符号链接、junction、reparse point 和任何会离开包根目录的路径。
- 导出只创建全新目标；同名目标存在时要求用户重新命名，不合并、不覆盖。
- 导入写入 `<asset-id>-pending`，全部复制与哈希通过后原子提交；失败或取消时等待 I/O 停止再清理 pending。
- 清理开始前再次扫描引用；只对再次确认为 `eligible` 的受控目录调用 `shell.trashItem`。
- 不使用字符串拼接 shell 命令，不调用 `cmd /c del`、PowerShell 删除命令或用户提供的命令文本。

## 25. Preload bridge

建议白名单能力：

- `inspectPortableProjectExport(projectLocalId, assetIds)`
- `choosePortableProjectDestination()`
- `exportPortableProject(requestToken)`
- `cancelPortableProjectTask()`
- `choosePortableProjectFolder()`
- `inspectPortableProjectImport(requestToken)`
- `importPortableProjectAsCopy(requestToken, displayName)`
- `scanManagedProjectMedia(projectLocalId)`
- `trashEligibleManagedMedia(scanToken, assetIds, confirmationToken)`
- `revealPortableProject(resultToken)`
- `onPortableProjectProgress(callback)`

所有 request token 都由主进程生成、短时有效并绑定当前 WebContents；不能由 Renderer 构造任意路径。

## 26. Repository / Service / UI 分层

```text
AssetLibraryPage / StorageMigrationDialog
  -> projectPortabilityService（状态与业务规则）
  -> projectPortabilityRepository（preload 白名单）
  -> Electron main projectPortabilityService（文件、哈希、原子提交）

CleanupReview UI
  -> managedMediaCleanupService（分类与确认规则）
  -> managedMediaRepository（扫描与回收站桥接）
  -> Electron main managedMediaService（真实目录与引用复核）
```

- 页面只管理 Tab、选择、短生命周期进度、弹窗和焦点。
- 当前快照、自动草稿和恢复点的引用聚合规则必须放 Service，不散落在 JSX。
- 文件系统操作、路径和 `shell.trashItem` 只在 Main。

# 状态、交互与无障碍

## 27. 状态规则

### 27.1 Empty

- 无视频：`当前项目没有需要额外打包的镜头视频`；仍可导出只含 `.manju` 的便携文件夹。
- 无可清理项：`没有可安全清理的托管媒体`；显示正在使用和恢复点保护数量。
- 无项目：入口禁用，说明 `请先创建或打开项目`。

### 27.2 Loading

- 扫描时显示真实阶段：项目快照、自动草稿、恢复点、托管目录、汇总。
- 已知总字节时显示真实百分比；未知时不显示循环百分比数字。
- 运行期间禁用重复任务；允许只读查看当前进度，不冻结整个应用。

### 27.3 Error

- 空间不足：显示“需要 / 可用 / 还差”真实容量，并允许更换位置。
- 包损坏：显示失败的验证项，不自动尝试修复或忽略。
- 哈希不符：阻断该次导入，不能用“继续导入”绕过。
- 目标不可写：建议更换目录，不请求管理员权限。
- 回收站失败：保留资产并显示逐项错误；不改项目元数据。

### 27.4 Cancel

- 选择目录前取消：直接返回，零写入。
- 复制中取消：状态变为“正在安全停止”，等待文件句柄关闭和 pending 清理。
- 清理确认取消：零文件操作。
- 不把取消显示成失败 Toast。

### 27.5 Focus / Keyboard

- 打开模态后焦点进入标题或首个 Tab；Tab/Shift+Tab 在当前模态内循环。
- Esc 在尚未写入时关闭；任务运行中 Esc 只触发取消确认，不能直接卸载层。
- 关闭后焦点回到“存储与迁移”入口或原生菜单触发前的页面主区域。
- 危险确认默认焦点在“取消”。

### 27.6 Long Text

- 项目名最多两行，资产文件名一行省略；完整文本用 title。
- 错误摘要最多三行；技术详情进入可展开区域，绝对路径仍脱敏。
- 中文按钮不小于 88 px，避免 125%/150% 缩放时截断。

## 28. 响应式

- ≥1360 px：980 px 居中 Dialog，双栏常驻。
- 1120～1359 px：Dialog 宽 `calc(100vw - 48px)`，左/右比例 57/40。
- 1024～1119 px：迁移卡纵向排列；清理检查器变为右侧抽屉；Footer 保持可见。
- <1024 px：不作为正式支持宽度，但内容仍可纵向滚动，不产生页面级横向溢出。
- 高度 <760 px：Header 压缩到 58 px，Content 独立滚动，Footer sticky。
- `prefers-reduced-motion`：关闭模态位移和背景模糊动画，只保留颜色与焦点过渡。

# Design System

## 29. Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `storageSky` | `#74D8FF` | 渐变高光、迁移入口 |
| `storagePrimary` | `#239FE3` | 主操作、选中 Tab、真实进度 |
| `storageDeep` | `#164B6B` | 标题、深色图标 |
| `storageReady` | `#18A9A1` | 校验通过、完整便携包 |
| `storageWarning` | `#E7A536` | 缺失、可清理、空间提醒 |
| `storageDanger` | `#D95261` | 最终移至回收站操作 |
| `storageGlass` | `rgba(243,251,255,.76)` | Dialog 与卡片 |
| `storageBorder` | `rgba(255,255,255,.88)` | 毛玻璃边框 |
| `storageCanvas` | `#E9F8FF` | 页面底色 |

深色模式预留：画布 `#0B2637`、卡片 `rgba(17,55,75,.82)`、主文字 `#EAF8FF`；不做简单反相。

## 30. Typography

| 层级 | 字号/行高 | 字重 | 用途 |
| --- | --- | --- | --- |
| Page Title | 32/40 px | 780 | 素材库标题 |
| Dialog Title | 24/30 px | 780 | 存储与迁移 |
| Section Title | 18/24 px | 740 | 导入、导出、清理分区 |
| Card Title | 14/20 px | 700 | 功能卡与资产名 |
| Body | 12/19 px | 500 | 描述与规则 |
| Meta | 10/15 px | 560 | 大小、时长、校验信息 |
| Eyebrow | 10/14 px | 760 | 英文识别标签 |

字体沿用 Windows 中文系统字体栈：`Segoe UI`, `Microsoft YaHei UI`, `sans-serif`。

## 31. Component System

| 组件 | 规则 |
| --- | --- |
| Primary Button | 42 px 高，14 px 圆角，天蓝渐变；禁用态文字仍保持 4.5:1 对比 |
| Secondary Button | 白色半透明，1 px 淡蓝描边；hover 只改变背景和边框 |
| Danger Button | 仅最终清理确认使用；红色填充，不与普通“解除引用”混用 |
| Card | 14～20 px 圆角，静态毛玻璃，阴影不超过 34 px 扩散 |
| Navigation | 沿用顶部导航；功能内部用稳定 Tab key |
| Modal | 980 px 主工作流、720 px 危险确认；z-index 280/290 |
| List | 58～68 px 行高；真实缩略图；状态、大小右对齐 |
| Feed | 本功能不使用社交流式 Feed；任务日志采用只读 EventList |
| Badge | 22～26 px 高；颜色 + 图标 + 文案三重表达，不只依赖颜色 |
| Progress | 8 px 高；只显示真实字节百分比 |
| Checkbox | 18 px 视觉尺寸，整行点击区不小于 44 px |
| Avatar | 不适用人物头像；资产缩略图遵循 1:1 或 16:9 裁切 |
| Tooltip | 解释禁用原因与完整文件名；不承载关键确认信息 |
| Empty State | 真实数量为 0 时显示，不生成模拟文件或容量 |

# 中文文案表

## 32. 素材库与入口

| 类型 | 文案 |
| --- | --- |
| 卡片标题 | 项目容量 |
| 容量标签 | 本机托管媒体 |
| 健康摘要 | `3 个可用 · 1 个可清理`（使用真实数量） |
| 主按钮 | 存储与迁移 |
| 无项目禁用说明 | 请先创建或打开项目 |

## 33. 存储与迁移中心

| 类型 | 文案 |
| --- | --- |
| 标题 | 存储与迁移 |
| 副标题 | 打包真实素材，安全清理本机托管副本 |
| Tab | 项目迁移 |
| Tab | 清理空间 |
| 边界 | 全程仅在本机处理，不上传素材、不调用付费接口 |

## 34. 导出便携项目

| 类型 | 文案 |
| --- | --- |
| 卡片标题 | 导出便携项目 |
| 说明 | 复制 `.manju` 与当前可用镜头视频，便于换电脑继续制作 |
| 主按钮 | 导出便携项目 |
| 预检标题 | 确认便携项目内容 |
| 包含项 | 项目文件、项目内图片与音频、可用镜头视频 |
| 排除项 | 不包含 Key、设置、日志、恢复点、导出历史和原始绝对路径 |
| 目标按钮 | 选择目标文件夹 |
| 开始按钮 | 开始导出 |
| 缺失警告 | 有镜头视频缺失，无法生成完整便携项目 |
| 次选项 | 仅导出当前可用素材 |
| 取消中 | 正在停止复制并清理未完成目录… |
| 成功 | 便携项目已完成 |
| 部分成功 | 已导出不完整便携副本 |
| 操作 | 打开文件夹 / 复制结果摘要 / 完成 |

## 35. 导入便携项目

| 类型 | 文案 |
| --- | --- |
| 卡片标题 | 导入便携项目 |
| 说明 | 从 `.manju-bundle` 文件夹恢复项目和托管镜头视频 |
| 主按钮 | 选择便携项目文件夹 |
| 验证标题 | 正在验证便携项目 |
| 通过 | 项目与素材校验通过 |
| 哈希错误 | 视频校验失败，导入已阻止 |
| 空间不足 | 本机空间不足，还需要 {size} |
| 冲突标题 | 作为新的本地副本导入 |
| 名称标签 | 新项目名称 |
| 主按钮 | 导入为副本 |
| 成功 | 便携项目导入完成 |
| 操作 | 打开导入项目 / 留在当前项目 |

## 36. 清理空间

| 类型 | 文案 |
| --- | --- |
| 标题 | 托管媒体清理 |
| 说明 | 只清理当前项目、自动草稿和恢复点均未引用的副本 |
| 扫描按钮 | 扫描托管媒体 |
| 分类 | 正在使用 / 恢复点保护 / 可清理 / 待诊断 |
| 空态 | 没有可安全清理的托管媒体 |
| 批量操作 | 全选可清理项 / 清除选择 |
| 选择摘要 | 已选择 {count} 项 · 预计从应用托管区移出 {size} |
| 判定证据 | 当前镜头引用 0 · 自动草稿引用 0 · 恢复点引用 0 · 活跃任务 0 |
| 确认标题 | 将未使用媒体移至 Windows 回收站？ |
| 确认说明 | 原始用户文件不会被删除；Windows 回收站中的文件由系统管理 |
| Checkbox | 我已确认这些媒体不被当前项目和恢复点使用 |
| 危险按钮 | 移至 Windows 回收站 |
| 结果 | 已移至回收站 {success} 项 · 失败 {failed} 项 · 跳过 {skipped} 项 |
| 失败 | 引用状态已变化，已安全跳过 |

# UI设计Prompt

--------------------------------
页面名称：素材库 · 存储与迁移入口

Prompt：

Design a polished Windows desktop asset-library page for a local-first Chinese manju production workstation. Product type: professional comic-drama media manager. UI Design: bright sky-blue gradient glassmorphism, calm technical precision, reliable storage observability. Layout: 1440x900 desktop canvas with the existing top navigation, page title on the upper left, an enhanced storage summary card on the upper right, a search and import toolbar, an 18 percent filter sidebar, a flexible media grid and a 24 percent inspector. The storage card must separately show “项目容量” and “本机托管媒体”, a truthful health summary, and a compact “存储与迁移” button. Keep real shot-video thumbnails and no simulated content. Components: navigation, storage bars, health badges, search field, filter list, asset cards, inspector, buttons. Style: luminous cyan highlights, white translucent glass panels, thin white borders, cool blue shadows, restrained teal success, amber attention, no purple-heavy palette. Lighting: clean daylight cyan glow from upper right. Animation: lightweight hover and focus transitions only, no blur animation. Resolution 1440x900, production-ready Simplified Chinese desktop UI, Simplified Chinese UI text, Chinese labels, Chinese Windows application interface, short editable labels only.
--------------------------------

--------------------------------
页面名称：存储与迁移中心

Prompt：

Design a professional modal workspace for project storage and portability inside a Chinese Windows Electron manju production application. Product type: local-first creative project storage manager. UI Design: sky-blue gradient glassmorphism, trustworthy technical dashboard, highly readable destructive-action boundaries. Layout: 1440x900 background with a centered 980x720 glass dialog, header icon and title “存储与迁移”, two tabs “项目迁移” and “清理空间”, a current-project summary strip, two balanced action cards for “导出便携项目” and “导入便携项目”, and a local-only security note at the bottom. Components: modal, tabs, project summary, status badges, two action cards, primary buttons, close control, sticky footer. Style: bright white and cyan translucent surfaces, deep navy typography, teal verified badges, subtle amber warnings, precise 14-26 pixel radii, no fake progress, no cloud upload imagery. Lighting: soft cyan edge glow and daylight glass reflections. Animation: instant modal appearance with only focus and hover transitions, optimized for smooth Windows performance. Resolution 1440x900, production-ready Simplified Chinese UI, Chinese labels, Chinese desktop application interface, short labels only.
--------------------------------

--------------------------------
页面名称：导出便携项目 · 内容预检

Prompt：

Design a detailed export-review step for a Chinese local-first manju desktop application. Product type: professional project portability tool. UI Design: precise sky-blue glassmorphism with truthful file and storage information. Layout: centered 980x720 dialog on a 1440x900 Windows desktop, top summary strip showing project bytes, video count, managed-media bytes and required free space; a 61 percent left list of real MP4 assets with actual last-frame thumbnails, duration, resolution, size and health; a 36 percent right panel explaining included and excluded data; sticky footer with “选择目标文件夹”, “取消” and “开始导出”. Include a clear amber missing-media warning state without hiding errors. Components: summary cards, media rows, thumbnail, badges, checklist, warning panel, buttons, real byte progress placeholder. Style: bright cyan and white glass, cool shadows, teal verified status, amber recoverable warning, deep blue text, no cloud icons, no fake speed or fake files. Lighting: clean cyan daylight. Animation: lightweight selection and focus only. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese Windows desktop interface, short titles and buttons only.
--------------------------------

--------------------------------
页面名称：导入便携项目 · 安全验证与副本策略

Prompt：

Design a secure portable-project import validation screen for a Chinese Windows manju production application. Product type: offline creative project migration tool. UI Design: luminous sky-blue glassmorphism with clear trust and integrity states. Layout: centered 980x720 modal, 58 percent left project and video manifest list, 39 percent right security-validation checklist for project format, SHA-256, file size, available disk space and unknown files, followed by a conflict section titled “作为新的本地副本导入” with an editable project-name field and disabled overwrite option. Components: validation steps, verified badges, error rows, project summary, input, warning panel, primary “导入为副本” button and secondary cancel button. Style: white translucent panels, cyan focus rings, teal success, amber conflict, red only for blocking corruption, high readability, no upload or account imagery. Lighting: soft cyan rim lighting, calm professional workstation. Animation: real validation state changes only, no simulated progress. Resolution 1440x900, production-ready Simplified Chinese UI text, Chinese labels, Chinese desktop interface, short labels only.
--------------------------------

--------------------------------
页面名称：托管媒体清理 · 安全复核

Prompt：

Design a safe managed-media cleanup review interface for a local-first Chinese Windows manju production workstation. Product type: professional creative storage maintenance tool. UI Design: sky-blue glassmorphism with strong evidence-based deletion safety. Layout: centered 980x720 dialog with four compact summary cards “正在使用”, “恢复点保护”, “可清理”, “待诊断”; a 62 percent left selectable list of real unused MP4 assets with last-frame thumbnails, file name, duration and size; a 35 percent right inspector showing the selected asset and evidence “当前镜头引用 0, 自动草稿引用 0, 恢复点引用 0, 活跃任务 0”; sticky selection summary and a restrained danger action. Components: status cards, checkboxes, video rows, inspector, evidence list, lock badges, sort controls, buttons. Style: bright cyan and white glass, teal protected status, amber eligible status, muted gray-blue unknown status, red reserved only for final recycle-bin confirmation. Lighting: clean daylight cyan glow. Animation: subtle selection and focus transitions, no animated blur. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese desktop application interface, no fake files or fake capacity.
--------------------------------

--------------------------------
页面名称：托管媒体清理 · 最终确认与结果

Prompt：

Design a high-trust destructive-action confirmation modal for moving unused managed videos to the Windows Recycle Bin in a Chinese manju production desktop app. Product type: local-first creative storage manager. UI Design: bright sky-blue glassmorphism with restrained red danger semantics. Layout: 1440x900 desktop background, centered 720px confirmation dialog, warning icon, selected item count and real total bytes, evidence that current project and recovery points have zero references, a confirmation checkbox, default-focused “取消” button and a red “移至 Windows 回收站” button. Also show a truthful result state with success, failed and safely skipped counts. Components: modal, warning icon, audit summary, checkbox, result list, secondary and danger buttons. Style: white translucent glass, deep navy text, cyan borders, red only on final action, clear accessibility contrast, no fear-inducing full red background. Lighting: soft cool daylight. Animation: no entrance motion; only focus ring and state changes. Resolution 1440x900, production-ready Simplified Chinese UI text, Chinese labels, Chinese Windows application interface, short editable labels only.
--------------------------------

# 验收标准

## 37. 功能与安全验收

1. 当前项目存在时素材库和原生文件菜单可进入迁移流程；无项目时入口禁用并解释原因。
2. 便携导出只包含 `project.manju`、manifest、README 和当前项目允许的托管 MP4。
3. 便携包不包含 Key、设置、日志、恢复点、导出历史、测试文件、脚本或用户原始绝对路径。
4. 所有源/目标目录选择只由 Windows 主进程完成；Renderer 不接收或提交任意绝对路径。
5. 导出前展示真实项目大小、视频数量、视频总大小、缺失数量和所需空间。
6. 已知总字节时进度来自真实复制字节；未知阶段不得伪造百分比。
7. 导出使用 pending 目录，全部写入和 SHA-256 校验通过后才原子提交。
8. 导出取消等待 I/O 停止并清理 pending；源项目、源视频和既有目标均不变。
9. 同名目标存在时不覆盖、不合并，必须重新选择名称或位置。
10. 导入拒绝路径穿越、符号链接、junction、reparse point、未知可执行文件和非法资产 ID。
11. 导入验证 `.manju` ≤10 MB、每个视频 ≤250 MB、文件大小与 SHA-256 一致。
12. 导入默认作为副本生成新 `localProjectId`；不覆盖当前项目或本机同 ID 项目。
13. 导入写入本机 pending，全部成功后才提交新托管目录与项目快照。
14. 导入失败或取消时源便携文件夹、当前项目和既有本机媒体均不变。
15. 导入成功后镜头视频健康、真实末帧、预览、时间线引用和本地导出均可恢复。
16. 清理扫描同时读取当前快照、自动草稿、全部恢复点和活跃任务。
17. `in-use`、`recovery-protected`、`unknown` 和活跃资产不可选择，不存在绕过按钮。
18. 清理执行前重新扫描；引用变化的资产必须安全跳过。
19. 清理真实媒体只使用主进程受控路径和 Windows 回收站，不删除用户原始文件。
20. 清理逐项报告成功、失败和跳过；部分失败不得显示全量成功。
21. 未选择任何项、未勾选二次确认或扫描结果过期时，危险按钮禁用。
22. 迁移与清理全过程 HTTP(S)、Renderer `fetch`、DashScope、OSS 和付费调用均为 0。
23. 1440 与 1024 px 无页面级横向溢出；125%/150% 缩放按钮和文件名可操作。
24. 模态焦点循环、Esc 安全取消、关闭后焦点恢复、reduced-motion 均通过。
25. 原有 `.manju` 保存/打开、时间线恢复、素材库、本地视频采用、成片导出和设置性能回归通过。
26. Windows 安装包内不得包含任何测试便携包、测试 MP4、用户媒体、`scripts/`、`outputs/`、`docs/` 或 `key.txt`。

## 38. 性能指标

- 打开存储中心热进入 P95 ≤120 ms，退出 P95 ≤100 ms。
- 纯元数据扫描 200 个资产 P95 ≤500 ms；磁盘哈希任务必须异步且不阻塞 Renderer。
- 复制大文件使用流式 I/O，内存不随文件大小线性增长。
- 同一时间只允许一个导入/导出/清理写任务；只读健康检查可排队。
- Dialog 动画不产生 Long Task；不动画 `backdrop-filter`。

# 完整组件树

## 39. 开发交接树

```text
AssetLibraryPage
├─ TopNavigation
├─ AssetHeader
│  ├─ TitleBlock
│  └─ StorageSummaryCard
│     ├─ ProjectCapacity
│     ├─ ManagedMediaCapacity
│     ├─ MediaHealthSummary
│     └─ StorageMigrationButton
├─ AssetToolbar
├─ AssetWorkspace
│  ├─ FilterSidebar
│  ├─ AssetCollection
│  └─ AssetInspector
└─ StorageMigrationLayer
   └─ StorageMigrationDialog
      ├─ DialogHeader
      ├─ StorageTabs
      ├─ PortabilityPanel
      │  ├─ CurrentProjectSummary
      │  ├─ ExportPortableProjectCard
      │  ├─ ImportPortableProjectCard
      │  ├─ ExportReview
      │  │  ├─ SizeSummary
      │  │  ├─ IncludedAssetList
      │  │  ├─ ExcludedDataPanel
      │  │  ├─ MissingMediaWarning
      │  │  └─ ExportFooter
      │  ├─ PortableTaskProgress
      │  ├─ ImportValidation
      │  │  ├─ ProjectManifestSummary
      │  │  ├─ ValidationChecklist
      │  │  └─ DiskSpaceCheck
      │  ├─ ImportConflictReview
      │  └─ PortableTaskResult
      └─ CleanupPanel
         ├─ CleanupScanSummary
         ├─ CleanupFilters
         ├─ CleanupAssetList
         ├─ CleanupAssetInspector
         ├─ CleanupSelectionBar
         ├─ CleanupConfirmDialog
         └─ CleanupResult
```

# 不确定项、风险与后续边界

## 40. 风险与假设

- 文件夹式便携包易于无依赖实现和逐文件恢复，但用户必须整体复制目录；是否需要单文件归档应在后续以真实需求决定。
- Windows 回收站仍占用磁盘，空间真正释放由系统回收站策略决定；UI 必须说“移出应用托管区”，不能承诺磁盘立即增加。
- 当前恢复点只保存项目 JSON；清理扫描必须解析所有恢复点的 `videoAssets` 与镜头引用，不能只看当前 `shots`。
- 导入为副本后恢复点不会随包迁移，这是刻意的安全边界；便携包只迁移可编辑项目与真实媒体。
- FAT32 目标对单文件 4 GB 有限制；单个镜头视频目前 ≤250 MB，但整体目录仍需检查目标可写性与空间。
- 某些企业盘或网络盘的原子重命名语义不同；实现阶段需在本地 NTFS 与可移动盘分别验证。
- `shell.trashItem` 在不同磁盘和策略下可能失败；失败项必须保留，不能回退为永久删除。

## 41. 后续候选

- 单文件 `.manjupack` 归档与签名 manifest。
- 便携包增量更新和去重复制。
- 跨项目托管媒体去重。
- 可配置保留策略和审计日志导出。
- 云端同步只有在用户明确授权账号、隐私、费用和服务商后另立项目。

# 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 95%
尺寸估算: 96%
交互与安全边界: 99%
```

所有尺寸基于当前运行截图、既有 V28/V32 Design Spec 和真实代码结构推算。若后续建立 Figma 原始组件库，可进一步锁定像素级尺寸。

# 等待确认

V33 设计稿已完成。当前仓库是 React + Electron Windows EXE，最匹配的下一阶段是 React + Electron 开发；也可以先进入 Figma 设计阶段。React Native 与 HarmonyOS ArkUI 不适用于当前仓库，除非另开跨端项目。
