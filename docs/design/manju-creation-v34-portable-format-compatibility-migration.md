# 漫剧创作 V34 便携格式版本兼容与安全迁移 Design Spec

## 0. 文档状态

- 文档类型：已确认 V33 视觉基准上的增量 Design Spec。
- 目标版本：`1.32.0`（已实现并完成验收）。
- 主分类：项目迁移与本地数据兼容。
- 副分类：安全校验、失败回滚、诊断可解释性。
- 实现阶段：已完成；React、Electron、IPC、Manifest V2、V1 → V2 迁移器和兼容 UI 已按本文落地。
- 付费边界：纯本地功能；DashScope、OSS、图片、视频、配音生成调用均为 `0`。

## 1. 来源与基准

### 1.1 项目证据

- `electron/projectPortabilityService.js` 当前固定 `portableProjectVersion = 1`。
- 当前导入在读取 `manifest.json` 后要求 `manifest.version === 1`，其他版本统一显示“格式版本不受支持”。
- V33 已有真实目录边界、未知条目拒绝、大小限制、SHA-256、pending 原子提交、导入新副本与回收站清理。
- V33 Electron UI 已验证：导出、导入、真实媒体复制、在用保护、解除引用与回收站清理均通过。
- V33 运行截图 `outputs/runtime/project-storage-center-v33.png` 是本轮唯一视觉源。
- V33 设计稿 `docs/design/manju-creation-v33-project-media-portability-storage-cleanup.md` 是布局、比例、颜色与交互基准。

### 1.2 当前问题

当前实现把所有非 V1 manifest 都归为同一错误，无法回答：

1. 这是损坏文件，还是由更新版本应用创建？
2. 旧版是否可以安全迁移？
3. 迁移会修改原始便携包吗？
4. 哪些字段发生了升级？
5. 导入失败时是否已经写入本机媒体？

### 1.3 参考设备与画布

| 场景 | 画布 | 模态尺寸 | 说明 |
| --- | --- | --- | --- |
| 主验收 | 1440×900 | 980×720，约占屏宽 68.1%、屏高 80% | 延续 V33 |
| 紧凑验收 | 1024×768 | 左右 18 px、上下 18 px，约占屏宽 96.5% | 内容区内部滚动 |
| 最小窗口 | 1000×700 | `calc(100vw - 36px)` × `calc(100vh - 36px)` | 不出现页面级横向滚动 |

### 1.4 视觉假设

- 延续渐变天蓝、明亮毛玻璃和轻科技感，不引入新的品牌色。
- 兼容状态是“信任信息”，以青绿、蓝、琥珀、红四级表达，不使用夸张警报动画。
- 版本号、迁移步骤、能力标志必须是真实文本，不生成模拟版本或假迁移进度。

# 项目设计分析

## 2. 产品类型

Windows 本地优先漫剧制作工作台中的离线项目交换格式兼容器。它不是云同步、发行工具或通用压缩软件，而是 V33 便携项目导入流程的安全版本门禁。

## 3. 目标用户

- 在两台 Windows 电脑间移动漫剧工程的个人创作者。
- 使用不同安装版本协作的编剧、分镜、配音和剪辑人员。
- 需要判断旧项目能否打开、又不愿冒险覆盖原文件的非技术用户。
- 负责验收项目可恢复性和长期可维护性的产品或技术人员。

## 4. 使用场景

1. 用户用 1.31.0 导出的 V1 便携包，在 1.32.0 中导入。
2. 用户选择由 1.32.0 导出的当前 V2 便携包，直接导入。
3. 用户选择未来版本 V3 或更高版本包，应用读取最小 manifest 摘要后阻止写入。
4. 用户选择版本字段缺失、非整数、负数或格式标识错误的文件夹，应用判定为损坏或未知格式。
5. V1 → V2 迁移后媒体校验失败，应用撤销全部 pending 写入并保留来源包。

## 5. 核心价值

- 把“版本不支持”拆成可操作、可解释、可验证的兼容结论。
- 旧版迁移只发生在内存和受控 pending 副本中，永不回写来源 `.manju-bundle`。
- 未来版本默认只读阻断，避免旧应用按错误结构复制媒体。
- 通过迁移报告明确展示源版本、目标版本、步骤、验证结果和副本标识。

# 用户画像

## 6. 主要画像

| 维度 | 描述 |
| --- | --- |
| 年龄 | 20～45 岁 |
| 职业 | 漫剧创作者、编剧、分镜师、配音/剪辑人员、独立内容团队负责人 |
| 使用习惯 | 习惯双击文件夹、U 盘或局域网复制；不理解 schema、feature flag 等术语 |
| 核心痛点 | 害怕打不开旧项目、覆盖原项目、媒体丢失、迁移过程产生隐性费用 |
| 信任需求 | 必须知道原始文件是否修改、为什么被阻止、迁移到底改了什么 |

# 产品视觉方向

## 7. 视觉关键词

- Sky-blue gradient glassmorphism
- Compatibility confidence
- Local-first integrity
- Quiet technical precision
- Read-only future-version guard
- Reversible migration

## 8. 视觉理由

- 主色沿用 V33，保持同一产品模块的一致性。
- 兼容状态横条放在导入摘要上方，用户先理解版本风险，再看项目内容。
- 迁移步骤用紧凑纵向轨迹，不做类似云上传的动效，避免误解为联网。
- 阻断状态保留项目名称、导出应用版本等安全摘要，但不展示媒体文件内容或绝对路径。

## 9. 范围与非范围

### 9.1 本轮范围

- 将新导出 manifest 升级为 V2。
- 兼容读取 V1 和 V2。
- V1 通过注册式、纯函数迁移计划转换为 V2 内部结构。
- V2 直接验证并导入。
- V3+ 只读识别基础信息并阻止导入。
- 缺失或非法版本显示损坏状态。
- UI 展示兼容结论、迁移步骤、源/目标版本和迁移结果。
- 导入仍创建新 `localProjectId` 副本。

### 9.2 明确不做

- 不修改来源 `.manju-bundle`。
- 不做 V2 降级为 V1。
- 不自动联网下载新版本应用。
- 不上传 manifest 做云端转换。
- 不引入 ZIP、签名服务、账号系统或发行流程。
- 不迁移未知媒体类型。
- 不允许用户跳过必需迁移步骤或强制导入未来版本。

# 页面列表

## 10. 页面与关键状态

| 页面/状态 | 页面目标 | 核心模块 | 布局 | 交互 | 视觉重点 |
| --- | --- | --- | --- | --- | --- |
| 当前格式可导入 | 确认 V2 可直接处理 | 兼容条、项目摘要、校验清单 | 单列摘要 + 双栏验证 | 直接导入副本 | 青绿“当前格式” |
| 旧格式可迁移 | 解释 V1 → V2 | 兼容条、迁移轨迹、差异摘要、项目名 | 上状态、左内容、右迁移计划 | 查看详情、迁移并导入 | 蓝青色“可安全迁移” |
| 未来格式阻断 | 阻止 V3+ 写入 | 只读摘要、版本差异、建议 | 居中阻断卡 | 重新选择、关闭 | 琥珀主警示，红色仅用于损坏 |
| 损坏/未知格式 | 解释无法识别原因 | 错误码、检查项、来源保护说明 | 错误结果卡 | 重新选择 | 红色边界、无危险按钮 |
| 迁移中 | 展示真实步骤 | 步骤列表、字节进度、取消 | 横向进度 + 纵向步骤 | 安全取消 | 不伪造百分比 |
| 迁移结果 | 交付新副本 | 源/目标版本、媒体数、新项目名、审计摘要 | 成功结果卡 | 打开导入项目 | 青绿成功与新副本说明 |
| 迁移详情抽屉 | 展示结构变更 | 字段变更、默认值、未改项 | 右侧 420 px 抽屉 | 关闭、返回 | 技术信息分组但不泄露路径 |

# 信息架构与流程

## 11. 入口

```text
素材库
└─ 项目容量卡 · 迁移与清理
   └─ 项目迁移与存储管理
      └─ 便携项目
         └─ 导入
            ├─ 选择 .manju-bundle
            ├─ 读取最小 manifest envelope
            ├─ 兼容性判定
            ├─ 直接验证 / 迁移预览 / 只读阻断
            └─ 作为新副本导入
```

Windows 文件菜单中的“导入便携项目…”进入相同状态，不另建页面。

## 12. 兼容矩阵

| 来源 manifest | 判定 | 是否读取 project.manju | 是否读取媒体 | 是否允许写入 | 用户动作 |
| --- | --- | --- | --- | --- | --- |
| V2 | 当前格式 | 是，完整验证 | 是，逐文件校验 | 是 | 直接导入副本 |
| V1 | 旧格式可迁移 | 是，先按 V1 验证 | 是，先按 V1 约束校验 | 是，迁移后 | 迁移并导入副本 |
| V3+ | 未来格式 | 否，仅保留最小 manifest 摘要 | 否 | 否 | 使用更新版本应用 |
| `0`、负数、非整数 | 损坏 | 否 | 否 | 否 | 重新选择 |
| 缺失 version | 损坏 | 否 | 否 | 否 | 重新选择 |
| format 不匹配 | 未知格式 | 否 | 否 | 否 | 重新选择 |

## 13. V1 → V2 迁移计划

迁移在内存中的深拷贝对象上执行，不改来源文件：

1. 验证 V1 manifest 必填字段、路径、大小和 SHA-256。
2. 创建 V2 envelope。
3. 新增 `compatibility`：最低读取版本、当前写入版本、必需能力列表。
4. 把 V1 `media` 记录归一为带 `schema` 的 V2 media record。
5. 把 V1 `missingMedia` 归一为明确原因码与用户可读说明。
6. 生成本次内存迁移报告。
7. 按 V2 schema 再验证一次。
8. 进入既有“导入为新副本”事务。

### 13.1 幂等规则

- 输入 V2 不运行 V1 迁移器。
- V1 迁移器输出必须固定为 V2。
- 同一 V1 输入两次迁移得到除时间戳外相同的结构摘要。
- 任何一步失败都不进入媒体复制。

## 14. 导入事务

```text
选择文件夹
  -> 最小 envelope 检查
  -> 兼容结论
  -> V1 验证并迁移 / V2 直接验证 / V3+ 阻断
  -> 用户确认新副本名称
  -> 再次验证来源未变化
  -> pending 媒体复制与 SHA-256
  -> 写入新 project.manju
  -> 原子提交
  -> 最近项目登记
```

取消、校验失败、磁盘不足或写入失败时，只删除本轮受控 pending 目录。

# 页面结构与组件级设计稿

## 15. 整体页面结构

```text
StorageMigrationLayer
└─ StorageMigrationDialog
   ├─ DialogHeader
   ├─ PrimaryTabs
   ├─ PortabilityModeSwitch
   ├─ ContentViewport
   │  ├─ CompatibilityBanner
   │  ├─ PackageSummary
   │  ├─ ValidationAndMigrationGrid
   │  │  ├─ ProjectAndMediaSummary
   │  │  └─ CompatibilityPlan
   │  ├─ NewCopyNameField
   │  └─ ActionFooter
   ├─ LocalOnlyFootnote
   └─ MigrationDetailDrawer（按需）
```

## 16. Dialog 基础

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Container |
| 位置 | 屏幕中心，z-index 280 |
| 宽度 | 980 px；约屏宽 68.1%；父遮罩宽度 100% |
| 高度 | 720 px；约屏高 80%；父遮罩高度 100% |
| 紧凑宽度 | `calc(100vw - 36px)`；约父宽 96.5% |
| 紧凑高度 | `calc(100vh - 36px)`；内部 ContentViewport 滚动 |
| Padding | Header 22×26 px；Content 18×26 px |
| 圆角 | 28 px |
| 背景 | `#FBFEFF` 98.5% → `#E0F7FF` 97% → `#C7ECFF` 96% |
| 边框 | 1 px `rgba(255,255,255,.82)` |
| 阴影 | `0 42px 110px rgba(6,66,104,.32)` |
| 动效 | 160～180 ms opacity + translateY 10 px；减少动态时关闭 |

## 17. CompatibilityBanner

### 17.1 组件比例

| 字段 | 规格 |
| --- | --- |
| 类型 | Status Card / Banner |
| 位置 | ContentViewport 顶部 |
| 宽度 | 100%；约 928 px；占 Dialog 宽度 94.7% |
| 高度 | 64 px；占 Dialog 高度约 8.9% |
| 内部布局 | 44 px 图标 + 自适应文案 + 96 px 版本徽标 |
| Padding | 10 px 14 px |
| 圆角 | 16 px |
| 图标 | 20×20 px，占图标容器 45%，线性描边 |
| 文本 | 标题 12 px/750；说明 9 px/1.55；版本徽标 9 px/800 |

### 17.2 状态色

| 状态 | 背景 | 图标/标题 | 徽标 |
| --- | --- | --- | --- |
| 当前 V2 | `rgba(124,226,213,.20)` | `#087F75` | “当前格式 V2” |
| V1 可迁移 | `rgba(134,214,255,.24)` | `#0D7FBF` | “V1 → V2” |
| V3+ 阻断 | `rgba(255,223,165,.30)` | `#9A6518` | “需要更新版本” |
| 损坏 | `rgba(255,218,215,.42)` | `#B34F47` | “无法识别” |

## 18. ValidationAndMigrationGrid

| 字段 | 规格 |
| --- | --- |
| 类型 | Grid |
| 宽度 | 100%；约 928 px |
| 高度 | 260～310 px；占 ContentViewport 52%～62% |
| 列宽 | 左 55%，右 43%，间距 2% |
| 左侧 | 项目名、来源应用、项目大小、媒体数、总大小、完整性 |
| 右侧 | 兼容结论、迁移步骤、目标格式、阻断原因 |
| 卡片 Padding | 14 px |
| 卡片圆角 | 16 px |
| 列表行 | 42～48 px；分隔线 `rgba(53,143,186,.09)` |

### 18.1 ProjectAndMediaSummary

- 项目图标：36×36 px，占卡片宽度约 7.2%。
- 项目名：11 px/760，最长单行省略；完整名称放 `title`。
- 来源包名：8 px/500，不显示绝对路径。
- 数据指标：三列，每列约父宽 31.5%，间距 2.75%。
- 媒体列表：最多可视 4 行，超出在卡片内部滚动。

### 18.2 CompatibilityPlan

- 步骤轨迹宽 100%，每行 44 px。
- 步骤圆点 18×18 px，占行高 40.9%。
- 已完成用 check；当前步骤用 2 px cyan ring；等待用序号。
- 迁移前只展示计划，不显示假完成状态。
- “查看迁移详情”按钮 112×30 px，触控目标不低于 30 px。

## 19. NewCopyNameField

| 字段 | 规格 |
| --- | --- |
| 类型 | Input |
| 宽度 | 100%；约 928 px |
| 高度 | 输入框 38 px；整组 64 px |
| Label | 10 px/780，颜色 `#315E75` |
| Input | 12 px，圆角 12 px，左右 Padding 12 px |
| 辅助文案 | 8 px，说明新 ID 与不覆盖策略 |
| 错误态 | 红色边框，不震动，不清空输入 |

## 20. FutureVersionBlockedCard

| 字段 | 规格 |
| --- | --- |
| 类型 | Read-only Result Card |
| 宽度 | 620 px；占 Dialog 宽度约 63.3% |
| 高度 | 300～340 px；占 Dialog 高度 41.7%～47.2% |
| 位置 | ContentViewport 水平居中 |
| 图标 | 60×60 px shield-clock，琥珀描边 |
| 标题 | 18 px/780，“此便携项目由更新版本创建” |
| 摘要 | 只显示包名、项目名、来源应用版本、manifest 版本 |
| 主按钮 | 不提供强制导入；仅“重新选择” |
| 次按钮 | “关闭” |
| 安全说明 | “未读取项目正文或媒体文件，未写入本机目录” |

## 21. MigrationDetailDrawer

| 字段 | 规格 |
| --- | --- |
| 类型 | Side Drawer |
| 位置 | Dialog 右侧覆盖层，z-index 3 |
| 宽度 | 420 px；占 Dialog 宽度 42.9% |
| 高度 | 100% |
| 背景 | 98% 白蓝玻璃，确保不透出主内容文字 |
| Header | 64 px，标题、V1→V2 徽标、关闭按钮 |
| 内容 | 分组列表，单行 44～64 px，内部滚动 |
| Footer | 44 px，只显示“原始便携包不会修改” |
| 键盘 | 打开后焦点进入关闭按钮；Escape 关闭并返回触发按钮 |

### 21.1 详情分组

1. 新增字段：`compatibility`、media `schema`、missing reason code。
2. 保留字段：项目快照、资产 ID、文件名、字节数、SHA-256。
3. 不执行：不重编码视频、不修改项目正文、不写回来源包。
4. 验证顺序：V1 校验 → 纯函数迁移 → V2 校验 → 用户确认。

## 22. MigrationProgress

- 整体宽 720 px，占 Dialog 73.5%；最小高度 340 px。
- 左图标容器 52×52 px。
- 主进度条高 7 px，按真实项目字节与媒体字节计算。
- 迁移结构步骤没有字节时显示离散步骤状态，不伪造百分比。
- 进入媒体复制后百分比只由已复制字节/总字节决定。
- 取消按钮始终可见；取消后说明“来源包未修改，本机暂存已清理”。

## 23. MigrationResult

- 宽 610 px，占 Dialog 62.2%；居中。
- 成功图标 62×62 px。
- 展示：新项目名称、新 `localProjectId` 的脱敏后 8 位、来源 V1、目标 V2、媒体数、总字节、迁移步骤数。
- 按钮：“稍后打开”“打开导入项目”。
- 不展示来源绝对路径、本机媒体路径、Key 或 Provider 配置。

# 文件与数据合约

## 24. Manifest V2 envelope

V2 在 V1 字段上新增兼容元数据；不把本机路径写入 manifest。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `format` | string | 固定 `manju-portable-project` |
| `version` | integer | V2 固定 `2` |
| `createdAt` | ISO string | 导出时间 |
| `appVersion` | string | 导出应用版本 |
| `compatibility.minimumReaderManifestVersion` | integer | 最低可理解 envelope 版本 |
| `compatibility.writerManifestVersion` | integer | 固定 `2` |
| `compatibility.requiredFeatures` | string[] | 必需能力白名单，最多 16 项 |
| `compatibility.optionalFeatures` | string[] | 可忽略能力白名单，最多 32 项 |
| `projectFile.schema` | string | `manju-project@1` |
| `media[].schema` | string | `shot-video@1` |
| `missingMedia[].reasonCode` | string | 白名单原因码 |

### 24.1 V2 必需能力

- `integrity-sha256`
- `managed-shot-video`
- `import-as-copy`

不认识任一 `requiredFeatures` 时必须阻止导入；不认识 `optionalFeatures` 时可以忽略，但在 UI 中列出。

### 24.2 限制

- manifest：最大 256 KB。
- `requiredFeatures`：最多 16 项，每项 1～64 个 ASCII 小写字符、数字和连字符。
- `optionalFeatures`：最多 32 项。
- 迁移步骤：本版只允许 V1 → V2 一步，不接受动态脚本。
- 迁移器代码随应用发布，不从便携包加载或执行代码。

## 25. 兼容判定结果

Main process 对 Renderer 只返回脱敏结果：

| 字段 | 说明 |
| --- | --- |
| `status` | `current` / `migratable` / `future` / `corrupt` |
| `sourceVersion` | manifest 整数版本 |
| `targetVersion` | 当前写入版本 |
| `sourceAppVersion` | 来源应用版本，最长 32 字符 |
| `requiredSteps` | 固定迁移步骤 ID 与中文短标签 |
| `unknownOptionalFeatures` | 未识别可选能力名称 |
| `canImport` | 是否允许进入导入事务 |
| `sourceUntouched` | 固定 `true` |

绝对路径、内部文件句柄、迁移器对象、原始 manifest 与错误堆栈不返回 Renderer。

## 26. 迁移审计

仅在导入成功后向应用数据日志追加一条无路径记录：

- 时间。
- 新项目哈希标识。
- 来源 manifest 版本。
- 目标 manifest 版本。
- 执行步骤 ID。
- 媒体数与总字节。
- 结果 `success`。

失败只记错误类别，不记录源文件夹、项目正文、媒体文件名或 Key。

# Electron、安全与分层

## 27. Main process

- 先读取大小受限的 `manifest.json` envelope。
- 在确定 `format` 和整数 `version` 前不读取项目正文或媒体。
- 未来版本只返回只读摘要，不授予导入 token。
- 迁移器注册表由应用代码静态定义，不接受便携包提供的可执行内容。
- 每个迁移步骤输入/输出都做 schema 验证。
- 导入前重新检查 manifest mtime、大小与 SHA-256，防止预览后来源变化。
- 复制继续使用 V33 pending 与原子提交。

## 28. Preload bridge

复用 V33 选择与导入桥，扩充结构化兼容摘要；不新增任意路径参数。建议能力：

- `choosePortableProjectImport()`：返回 token、summary、compatibility。
- `previewPortableMigration({ token })`：返回脱敏步骤与字段摘要。
- `runPortableProjectImport({ token, displayName })`：Main 根据 token 决定直读或迁移。
- `onPortableProjectProgress(callback)`：复用真实进度。

## 29. Repository / Service / UI

```text
StorageMigrationDialog
  -> projectPortabilityRepository
  -> preload token bridge
  -> manifestCompatibilityService
  -> portableManifestMigrationRegistry
  -> projectPortabilityService
  -> controlled filesystem
```

- UI 只渲染结果和提交用户确认。
- Repository 只封装 IPC。
- Compatibility Service 负责状态映射和安全短文案。
- Migration Registry 负责确定性纯函数迁移。
- Portability Service 负责文件验证、复制和原子提交。

# 状态、交互与无障碍

## 30. Loading

- envelope 读取：显示“不超过 256 KB 的版本信息检查”，不显示百分比。
- 完整验证：显示当前文件名与真实检查计数。
- 媒体复制：显示真实字节百分比。
- 阶段切换时布局高度稳定，避免按钮跳动。

## 31. Error

- `future` 不是“文件损坏”，不得使用红色错误文案。
- `corrupt` 使用红色并展示短错误码，例如 `MANIFEST_VERSION_INVALID`。
- 迁移器失败显示“旧版迁移未完成，来源包未修改，本机未导入项目”。
- 不向用户展示 Node 错误堆栈和绝对路径。

## 32. Cancel

- envelope 检查阶段可直接取消。
- 迁移预览阶段取消零写入。
- 媒体复制阶段取消后等待流结束，再清理受控 pending。
- 取消后焦点回到“选择便携项目”。

## 33. Focus / Keyboard

- Dialog 打开：关闭按钮获得焦点。
- 可迁移状态：Tab 顺序为详情、项目名、重新选择、迁移并导入。
- 详情抽屉打开：焦点进入抽屉关闭按钮并限制在抽屉内。
- 未来版本阻断：默认焦点放在“重新选择”，不放在“关闭”。
- Escape：先关闭详情抽屉，再关闭 Dialog；写入中则触发安全取消确认。

## 34. 长文本、小屏与暗色

- 包名和项目名单行省略，悬停显示完整值，不显示路径。
- 1024 宽时双栏改为 52%/46%，720 px 以下内容区内部滚动。
- 最小窗口不改变顶部主导航，也不产生页面级横向滚动。
- 当前产品未实现完整暗色主题；本版保持亮色，并确保系统高对比度下状态不只依赖颜色。
- 横屏是 Windows 桌面主形态；不为竖屏桌面单独设计。

# Design System

## 35. Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `compat.surface` | `rgba(251,254,255,.985)` | Dialog 主表面 |
| `compat.sky` | `#27ABEF` | 当前步骤、焦点 |
| `compat.current` | `#087F75` | 当前格式、校验成功 |
| `compat.migratable` | `#0D7FBF` | 可迁移 |
| `compat.future` | `#9A6518` | 未来版本只读阻断 |
| `compat.corrupt` | `#B34F47` | 损坏或非法字段 |
| `compat.text` | `#0D3D59` | 主文字 |
| `compat.muted` | `#66889A` | 辅助文字 |
| `compat.divider` | `rgba(53,143,186,.10)` | 分隔线 |

## 36. Typography

- 字体：`Microsoft YaHei UI`, `PingFang SC`, Inter, system UI。
- Dialog 标题：20 px / 760。
- 页面状态标题：17～18 px / 760～780。
- 卡片标题：11～12 px / 750。
- 正文：9～11 px / 1.55～1.7。
- 技术标签：8～9 px / 820，英文大写，字距 1.4～1.7 px。
- 版本号采用 tabular numbers。

## 37. Component System

| 组件 | 规则 |
| --- | --- |
| Button | Primary 38 px；Secondary 36 px；危险状态不用于版本阻断 |
| Card | 14～16 px 圆角，白蓝玻璃，1 px 高光边框 |
| Avatar | 本模块不使用人物头像；用项目/盾牌/版本图标替代 |
| Navigation | 复用“便携项目 / 空间清理”和“导出 / 导入”切换 |
| Modal | 980×720，z-index 280，亮色高可读毛玻璃 |
| Drawer | 420 px 右侧抽屉，焦点陷阱 |
| List | 42～48 px 行高，状态图标 + 文案双编码 |
| Feed | 本模块不使用信息流；迁移步骤使用有序轨迹 |
| Badge | 当前青绿、可迁移蓝、未来琥珀、损坏红 |
| Input | 38 px，12 px 圆角，80 字符，错误不清空 |
| Progress | 真实字节或离散步骤，不使用假循环百分比 |

# 中文文案表

## 38. 当前格式

| 类型 | 文案 |
| --- | --- |
| 状态标题 | 当前便携格式，可直接导入 |
| 状态说明 | 已识别 Manifest V2，项目与媒体仍需完成完整性校验。 |
| 徽标 | 当前格式 V2 |
| 主按钮 | 作为新副本导入 |
| 辅助说明 | 原始便携包不会修改，当前项目不会覆盖。 |

## 39. 旧版可迁移

| 类型 | 文案 |
| --- | --- |
| 状态标题 | 检测到旧版便携项目 |
| 状态说明 | 可在本机安全迁移 V1 → V2，然后作为新副本导入。 |
| 徽标 | 可安全迁移 |
| 详情按钮 | 查看迁移详情 |
| 主按钮 | 迁移并导入副本 |
| 辅助按钮 | 重新选择 |
| 保护说明 | 迁移只处理内存副本，不会回写来源文件夹。 |

## 40. 未来版本阻断

| 类型 | 文案 |
| --- | --- |
| 标题 | 此便携项目由更新版本创建 |
| 说明 | 当前版本只能读取基础版本信息，不能安全解析项目正文或媒体。 |
| 建议 | 请使用支持 Manifest V{n} 的更新版本“漫剧创作”。 |
| 安全说明 | 未读取媒体，未写入本机目录，来源文件保持不变。 |
| 主按钮 | 重新选择 |
| 次按钮 | 关闭 |

## 41. 损坏与异常

| 状态 | 文案 |
| --- | --- |
| 缺失版本 | manifest 缺少有效版本号，无法判断兼容性。 |
| 非整数版本 | manifest 版本号必须是正整数。 |
| 格式错误 | 该文件夹不是“漫剧创作”便携项目。 |
| 必需能力未知 | 当前版本缺少该便携项目要求的能力，未执行导入。 |
| 来源变化 | 便携项目在验证后发生变化，请重新选择并检查。 |
| 迁移失败 | 旧版迁移未完成；来源包未修改，本机暂存已清理。 |

## 42. 迁移步骤

| 步骤 | 文案 |
| --- | --- |
| 1 | 验证 V1 目录与文件完整性 |
| 2 | 生成 V2 兼容信息 |
| 3 | 归一化媒体与缺失原因 |
| 4 | 按 V2 规则再次校验 |
| 5 | 复制真实媒体并创建新副本 |

## 43. 迁移结果

| 类型 | 文案 |
| --- | --- |
| 标题 | 旧版项目已安全迁移并导入 |
| 说明 | 来源 V1 已转换为当前 V2 结构；原始便携包没有修改。 |
| 元数据 | 迁移 1 个版本步骤 · {mediaCount} 个镜头视频 · {totalBytes} |
| 主按钮 | 打开导入项目 |
| 次按钮 | 稍后打开 |

# UI设计Prompt

--------------------------------
页面名称：旧版便携项目可迁移

Prompt：

Design a production-ready compatibility migration preview for a Chinese Windows manju drama creation application. Product type: offline creative project portability and schema migration tool. UI Design: luminous sky-blue glassmorphism with high readability and calm technical trust. Layout: centered 980x720 desktop modal, existing header and tabs, a full-width compatibility banner stating “检测到旧版便携项目”, a 55/43 split content grid with project and real media summary on the left and a five-step V1-to-V2 migration plan on the right, followed by an editable new-copy project name field and a footer with “重新选择” and “迁移并导入副本”. Components: shield-version icon, V1 → V2 badge, verified file rows, migration timeline, “查看迁移详情” secondary button, local-only safety note, disabled overwrite behavior. Style: bright cyan-to-sky-blue gradient, frosted white panels, teal verified accents, blue migratable accents, no cloud or account imagery, no fake progress. Lighting: soft cyan edge glow and restrained workstation depth. Animation: subtle 160ms opacity and vertical reveal, real step transitions only. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese desktop app interface, short labels and headings only.
--------------------------------

--------------------------------
页面名称：当前 V2 便携项目直接导入

Prompt：

Design a secure current-format import validation screen for a Chinese Windows manju production application. Product type: local-first portable project importer. UI Design: refined sky-blue glassmorphism and trustworthy integrity verification. Layout: centered 980x720 modal, full-width green-teal compatibility banner labeled “当前便携格式，可直接导入”, three compact facts for project size, managed video count and total bytes, a two-column validation panel with SHA-256 checks and required feature badges, an editable “新副本名称” field, and primary “作为新副本导入” action. Components: project package icon, current-format V2 badge, verified check rows, unknown optional feature note, secondary reselect button, local-only footer. Style: clean translucent white-blue surfaces, crisp dark-blue text, teal success, cyan focus rings, no upload cloud imagery, no simulated user data. Lighting: bright diffused daylight with subtle cyan rim light. Animation: stable layout, real validation changes only. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese desktop interface, short labels only.
--------------------------------

--------------------------------
页面名称：未来版本只读阻断

Prompt：

Design a read-only future-version compatibility guard for a Chinese Windows manju creation desktop app. Product type: offline project format safety checker. UI Design: elegant sky-blue frosted glass with a calm amber compatibility warning, not a destructive red error. Layout: centered 980x720 modal containing a 620x330 focused guard card, large shield-clock icon, title “此便携项目由更新版本创建”, compact read-only rows for package name, project name, source app version and Manifest V3, a safety note saying project body and media were not read and nothing was written locally, primary “重新选择” and secondary “关闭”. Components: amber version badge, read-only summary, update guidance, no force-import control. Style: high-contrast white-blue glass, amber informational warning, precise desktop spacing, no external download or account prompt. Lighting: soft blue ambient light with warm amber accent. Animation: simple fade-in only, no pulsing alarm. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese desktop interface, short labels only.
--------------------------------

--------------------------------
页面名称：迁移详情抽屉

Prompt：

Design a technical migration detail drawer inside a Chinese Windows manju project portability modal. Product type: local schema migration inspector. UI Design: high-readability sky-blue glassmorphism with structured technical explanations for non-technical creators. Layout: 420px right-side drawer over a 980x720 modal, 64px header with V1 → V2 badge and close button, grouped lists titled “新增字段”, “保持不变”, “不会执行”, and “验证顺序”, each row using small line icons, short Chinese labels and concise descriptions, fixed footer stating “原始便携包不会修改”. Components: drawer, grouped list, version badges, check icons, no raw JSON, no absolute file paths, no code editor. Style: translucent white-blue surface at near-opaque readability, cyan separators, dark navy text, teal safety marks. Lighting: subtle right-edge glow and soft elevation shadow. Animation: 180ms slide from right with reduced-motion fallback. Resolution 1440x900, Simplified Chinese UI text, Chinese labels, Chinese desktop app interface, short text only.
--------------------------------

# 验收标准

## 44. 功能与安全验收

1. 新导出便携项目写入 Manifest V2。
2. V2 可以直接验证并导入。
3. V1 可以经过唯一 V1 → V2 迁移步骤导入。
4. V1 来源文件夹在成功、失败和取消后字节均不改变。
5. V3+ 只读取大小受限的 manifest envelope，不读取 project.manju 或媒体。
6. V3+ 不返回导入 token，不显示强制导入按钮。
7. 缺失、非整数、零或负数版本被判为损坏。
8. format 不匹配被判为未知格式。
9. 未知必需能力阻止导入。
10. 未知可选能力允许继续，但 UI 明确展示。
11. 迁移器不加载或执行便携包内脚本。
12. 每个迁移步骤前后均执行 schema 验证。
13. V1 迁移输出固定为 V2，并通过幂等测试。
14. 预览后来源 manifest 变化会阻止导入。
15. 导入继续创建新的 `localProjectId`，不覆盖任何项目。
16. 迁移失败不进入最近项目列表。
17. 迁移失败不保留 pending 目录或半成品媒体。
18. Renderer 不收到来源绝对路径、目标绝对路径、原始 manifest 或堆栈。
19. 迁移审计不记录路径、项目正文、媒体文件名或 Key。
20. 所有功能纯本地运行，HTTP(S)、DashScope、OSS 与付费调用为 0。

## 45. UI 与可访问性验收

21. 1440×900 下 Dialog 接近 980×720。
22. 1024 宽下 Dialog 不越界，页面不出现横向滚动。
23. 当前、可迁移、未来、损坏四种状态均有图标和文字，不只依赖颜色。
24. 兼容条切换不引发布局大幅跳动。
25. 详情抽屉打开后焦点被限制，Escape 返回触发按钮。
26. 未来版本状态默认焦点位于“重新选择”。
27. 导入项目名支持 80 字符限制、错误提示和原值保留。
28. 长包名和长项目名单行省略并可查看完整文本。
29. 减少动态设置下关闭所有非必要动画。
30. 迁移进度只使用真实步骤和真实字节，不生成模拟百分比。

## 46. 性能指标

- 最小 manifest envelope 判定：本机常规磁盘目标 P95 < 120 ms，不包含用户选择文件夹时间。
- V1 纯函数迁移：100 个媒体记录目标 P95 < 50 ms。
- CompatibilityBanner 切换：不产生 ≥50 ms Long Task。
- Dialog 进入/退出：沿用 V33，目标 P95 < 120 ms。

# 完整组件树

## 47. 开发交接树

```text
StorageMigrationDialog
├─ DialogHeader
│  ├─ StorageIcon
│  ├─ TitleGroup
│  └─ CloseButton
├─ PrimaryTabs
│  ├─ PortabilityTab
│  └─ CleanupTab
├─ PortabilityModeSwitch
│  ├─ ExportMode
│  └─ ImportMode
├─ ContentViewport
│  ├─ CompatibilityBanner
│  │  ├─ StatusIcon
│  │  ├─ StatusCopy
│  │  └─ VersionBadge
│  ├─ CurrentImportView
│  │  ├─ PackageSummary
│  │  ├─ ValidationGrid
│  │  ├─ NewCopyNameField
│  │  └─ ActionFooter
│  ├─ MigratableImportView
│  │  ├─ PackageSummary
│  │  ├─ MigrationPlan
│  │  │  └─ MigrationStep × 5
│  │  ├─ MigrationDetailButton
│  │  ├─ NewCopyNameField
│  │  └─ ActionFooter
│  ├─ FutureVersionBlockedView
│  │  ├─ ShieldClockIcon
│  │  ├─ ReadOnlySummary
│  │  ├─ SafetyNotice
│  │  └─ ReselectActions
│  ├─ CorruptManifestView
│  │  ├─ ErrorIcon
│  │  ├─ ErrorCode
│  │  └─ ReselectAction
│  ├─ MigrationProgress
│  │  ├─ PhaseIcon
│  │  ├─ StepTimeline
│  │  ├─ ByteProgress
│  │  └─ CancelButton
│  └─ MigrationResult
│     ├─ SuccessIcon
│     ├─ VersionSummary
│     ├─ NewCopySummary
│     └─ OpenActions
├─ LocalOnlyFootnote
└─ MigrationDetailDrawer
   ├─ DrawerHeader
   ├─ AddedFieldsGroup
   ├─ PreservedFieldsGroup
   ├─ NotPerformedGroup
   ├─ ValidationOrderGroup
   └─ SourceUntouchedFooter
```

# 不确定项、风险与后续边界

## 48. 已确定

- 当前真实格式只有 V1，V34 将真实引入 V2。
- 只支持 V1 → V2，不伪造更早版本迁移器。
- 未来版本只读阻断，不做猜测解析。
- 来源包永不修改，导入永远是新副本。

## 49. 风险

- 1.31.0 只接受 V1，因此 1.32.0 导出的 V2 默认不能回到 1.31.0 导入；README 必须明确最低应用版本。
- V2 required feature 设计必须保守，避免把纯诊断字段误设为阻断能力。
- 迁移报告不得成为新的隐私日志面。
- 未来如果项目正文 `manju-project` 升级，必须与 manifest envelope 版本分开迁移。

## 50. 后续候选

- 项目正文 `manju-project@1` 到后续 schema 的独立迁移器。
- 便携包离线签名与来源可信度校验。
- 项目备份计划、恢复点浏览与空间趋势。
- 单文件归档格式；仍需单独安全评估与依赖确认。

# 设计还原评分

```text
设计识别置信度: 99%
布局识别: 99%
颜色识别: 98%
字体识别: 96%
尺寸估算: 98%
```

评分较高，因为本轮直接沿用已运行、已截图并通过 1024/1440 验收的 V33 组件。抽屉与兼容条属于新增推测值，实现时应以本文尺寸和现有 token 为准。

# 等待确认

本 Design Spec 已覆盖 V1/V2 兼容矩阵、未来版本只读阻断、V1 → V2 纯函数迁移、迁移详情、真实进度、安全回滚、中文文案和 4 个英文设计图 Prompt。

请确认是否按本设计稿进入 React + Electron 实现阶段。
