# 漫剧创作 V38 · 0 元一键生成图片与视频 Design Spec

## 0. 来源、目标与设计边界

### 0.1 视觉来源

- 当前总览页截图：`outputs/runtime/overview.png`，画布约 `1782 × 1000 px`。
- 当前 AI 设置页截图：`outputs/runtime/settings-bailian-key-v24.png`，画布约 `1784 × 956 px`。
- 当前分镜文件化图片验收截图：`outputs/runtime/generated-image-recovery-v37.png`，画布约 `1782 × 974 px`。
- 当前产品视觉：天蓝渐变、轻毛玻璃、白色半透明卡片、深蓝文字、青蓝主按钮。
- 当前技术栈：Windows Electron + React + Vite；项目数据为本机 `.manju`，生成资产保存在 `.manju-studio/`。

### 0.2 用户目标

用户已经有剧本，希望把当前“角色图、场景图、分镜图、视频逐项打开、逐项预检、逐项确认、逐项采用”的操作压缩为：

```text
打开项目
  → 点击“一键制作整部漫剧”
  → 软件自动补齐可本地计算的分镜任务
  → 顺序生成缺失的角色图、场景图、分镜图
  → 顺序生成每个镜头视频
  → 自动下载、文件化采用、保存进度
  → 可暂停、可继续、可在重启后续作
```

### 0.3 费用硬边界

- 用户允许的最高实际费用：`0 元`。
- 百炼控制台必须为本次涉及的模型开启“免费额度用完即停”。
- 软件无法通过现有生成 API 实时、准确读取控制台剩余免费额度，也不能把分钟级更新的控制台数字当作实时余额。
- 因此应用只保存“用户已在控制台开启免费额度用完即停”的本地确认记录，不伪造“已自动检测”。
- 收到 `AllocationQuota.FreeTierOnly`、余额、欠费、配额或额度相关错误时，整个队列立即停止，不切换模型、不重试、不转付费。
- 自动队列固定单并发，图片固定 `n=1`，视频固定 `720P`，不自动升到 `1080P`。
- 本轮设计与后续离线验证不得发起真实生成调用；真实批量执行只能由用户在安装版中主动点击“一键制作整部漫剧”触发。

### 0.4 本轮包含

- 总览页“一键制作整部漫剧”主入口。
- 首次启用的“0 元安全模式”设置门。
- 整部项目的任务预检、任务队列、进度抽屉和断点续作。
- 自动生成并采用：
  - 缺失的角色图；
  - 缺失的场景图；
  - 缺失的分镜图；
  - 缺失的镜头视频。
- 已有合格素材自动跳过，不重复消耗额度。
- 图片、视频成功后立即下载到本地并写入受管资产引用。
- 任务失败、暂停、取消、重启恢复和配额用尽停止。

### 0.5 本轮不包含

- 自动配音、TTS、BGM、音效和字幕润色。
- 自动发行、上传平台或发布。
- 自动充值、余额支付、资源包购买或模型切换。
- 多任务并发、批量重试、失败后静默继续扣额度。
- 把 API Key、控制台状态或远程临时 URL 写入 `.manju`。
- 自动修改阿里云账号的控制台开关。

## 1. 产品设计分析

### 1.1 产品类型

Windows 本地优先的 AI 漫剧生产工作台。本次新增的是项目级自动生产编排器，不是新的素材编辑器。

### 1.2 目标用户

- 已经有故事或结构化剧本，但不愿逐页完成几十次相同操作的个人创作者。
- 希望使用百炼免费额度完成验证或小规模制作，不接受欠费风险的用户。
- 不熟悉图片、视频 API 任务、轮询、临时 URL 和本地素材管理的非技术用户。

### 1.3 核心体验原则

1. **一次启动**：配置完成后只需点击一次。
2. **不重复生成**：已有图片和视频直接复用。
3. **过程透明**：始终显示当前阶段、当前资产、已完成/跳过/失败数量。
4. **可中断恢复**：关闭软件、断网或手动暂停后可以继续。
5. **费用优先停止**：任何额度不确定性都停止，不以完成率为理由继续。
6. **本地是真相**：成功结果必须已下载并登记本地资产后才标记完成。

## 2. 简化后的操作模型

### 2.1 首次使用

```text
总览页点击“一键制作整部漫剧”
  → 若未记录 0 元安全模式：
      显示一次安全设置弹窗
      用户打开百炼控制台并开启三个模型的“免费额度用完即停”
      勾选“我已完成控制台设置”
      保存
  → 自动执行本地预检
  → 无阻塞项则立即进入队列
```

首次设置会多一次确认，但之后不再逐资产弹窗。

### 2.2 后续使用

```text
点击“一键制作整部漫剧”
  → 300 ms 内完成本地预检
  → 直接打开进度抽屉并开始
```

### 2.3 自动任务顺序

```text
阶段 0　本地预检
  ├─ 检查真实项目与剧本
  ├─ 检查 Key、模型和 0 元安全模式记录
  ├─ 生成缺失的本地分镜草稿
  └─ 计算任务数量与跳过数量

阶段 1　角色图
  └─ 仅生成没有有效受管图片的角色

阶段 2　场景图
  └─ 仅生成没有有效受管图片的场景

阶段 3　分镜图
  └─ 使用角色图、场景图和连续性约束生成缺失镜头画面

阶段 4　镜头视频
  ├─ 优先首尾帧模式
  ├─ 没有下一镜头画面时使用首帧模式
  └─ 下载 MP4、提取真实末帧、登记下一镜连续性

阶段 5　完成
  ├─ 保存项目
  ├─ 写入任务报告
  └─ 跳转成片页
```

### 2.4 自动采用规则

- 图片成功下载后直接写入 V37 的文件化字段，不再弹出“采用”按钮。
- 视频成功下载、通过文件大小与格式检查后直接登记受管视频资产。
- 自动采用只更新当前缺失字段，不覆盖用户已有真实图片或视频。
- 如果任务开始后用户手动替换了同一资产，任务完成时以较新的用户修改为准，生成结果保留在素材库但不覆盖。

## 3. 页面一：项目总览的一键制作入口

### 3.1 页面目标

让“一键制作”成为有剧本项目的最明显下一步，同时不挤压现有剧集管理。

### 3.2 页面结构

```text
OverviewPage
├── TopBar
├── ProjectIdentity
├── OverviewGrid
│   ├── EpisodePanel
│   └── OverviewSide
│       ├── StorySummary
│       └── OneClickProductionCard
│           ├── Header
│           ├── ReadinessSummary
│           ├── StageMiniRail
│           ├── ZeroCostBadge
│           ├── PrimaryAction
│           └── ResumeAction / BlockerAction
└── ProductionProgressDock
```

### 3.3 总览页尺寸与布局

基准画布：`1600 × 900 px`，最小窗口：`1000 × 700 px`。

| 区域 | 估算尺寸 | 屏幕占比 | 父容器占比 | 说明 |
| --- | --- | --- | --- | --- |
| TopBar | `1600 × 76 px` | 宽 `100%`，高 `8.4%` | 页面 `100%` | 保持现状 |
| ProjectIdentity | `1548 × 92 px` | 宽 `96.8%`，高 `10.2%` | 内容区 `100%` | 保持现状 |
| OverviewGrid | `1548 × 680 px` | 宽 `96.8%`，高 `75.6%` | 内容区 `100%` | 左 `74%` / 右 `24.5%` |
| EpisodePanel | `1145 × 680 px` | 屏宽 `71.6%` | Grid 宽 `74%` | 保持剧集滚动 |
| OverviewSide | `379 × 680 px` | 屏宽 `23.7%` | Grid 宽 `24.5%` | 间距约 `24 px` |
| StorySummary | `379 × 260 px` | 屏宽 `23.7%`，页高 `28.9%` | 侧栏宽 `100%` | 长文可折叠 |
| OneClickProductionCard | `379 × 396 px` | 屏宽 `23.7%`，页高 `44%` | 侧栏宽 `100%` | 替换现有“接着创作”卡 |

### 3.4 OneClickProductionCard 组件规格

| 字段 | 规格 |
| --- | --- |
| 类型 | Glass Card / Project Automation Entry |
| 宽度 | `379 px`，约屏宽 `23.7%`，父容器 `100%` |
| 高度 | `396 px`，约页面高度 `44%` |
| Padding | `24 px`，约卡片宽 `6.3%` |
| 圆角 | `26 px` |
| 背景 | `linear-gradient(145deg, rgba(255,255,255,.82), rgba(199,239,255,.72))` |
| 边框 | `1 px solid rgba(255,255,255,.78)` |
| 阴影 | `0 18px 40px rgba(29,115,164,.12)` |
| 标题 | `一键制作整部漫剧`，`22 px / 30 px / 700` |
| 说明 | `已有剧本，自动生成缺失图片与视频`，`13 px / 20 px / 400` |
| 状态徽标 | `0 元模式`，高度 `28 px`，青绿色；未设置时为琥珀色 |
| 主按钮 | `331 × 56 px`，父宽 `100%`，卡片高约 `14.1%` |
| 主按钮文字 | `一键生成图片和视频` |
| 主按钮图标 | Spark/Play，`18 × 18 px`，按钮高 `32%` |
| 次按钮 | `继续上次任务` 或 `查看阻塞项`，高度 `42 px` |

### 3.5 卡片内容

- `ReadinessSummary`：
  - “角色图 2/6”
  - “场景图 1/8”
  - “分镜图 3/42”
  - “视频 0/42”
- `StageMiniRail`：四段水平进度条，角色、场景、分镜、视频。
- `ZeroCostBadge`：
  - 已确认：绿色“0 元模式”
  - 未确认：琥珀色“需先设置”
  - 配额停止：红色“免费额度已停止”
- 主按钮行为：
  - 项目有剧本且安全门已完成：立即开始。
  - 安全门未完成：打开首次安全设置弹窗。
  - 项目无有效剧本：禁用，文案“请先准备剧本”。
  - 有未完成队列：文字改为“继续一键制作”。

## 4. 页面二：首次 0 元安全设置弹窗

### 4.1 目的

只出现一次，明确说明软件无法代替控制台验证余额，要求用户完成官方“免费额度用完即停”设置。

### 4.2 弹窗结构

```text
ZeroCostSafetyModal
├── ModalHeader
├── SafetyExplanation
├── ModelChecklist
│   ├── qwen-plus
│   ├── qwen-image-2.0-pro
│   └── wan2.7-i2v-2026-04-25
├── ConsoleAction
├── UserAttestationCheckbox
├── NonGuaranteeNotice
└── FooterActions
    ├── Cancel
    └── SaveAndEnable
```

### 4.3 尺寸

| 组件 | 估算尺寸 | 屏幕/父级占比 |
| --- | --- | --- |
| Backdrop | `1600 × 900 px` | 页面 `100%` |
| Modal | `760 × 620 px` | 屏宽 `47.5%`，页高 `68.9%` |
| Header | `712 × 84 px` | 弹窗宽 `93.7%`，高 `13.5%` |
| SafetyExplanation | `712 × 86 px` | 弹窗宽 `93.7%`，高 `13.9%` |
| ModelChecklist | `712 × 198 px` | 弹窗宽 `93.7%`，高 `31.9%` |
| ModelRow | `688 × 54 px` | 列表宽 `96.6%`，单行高 `27.3%` |
| Attestation | `712 × 72 px` | 弹窗宽 `93.7%`，高 `11.6%` |
| Footer | `712 × 64 px` | 弹窗宽 `93.7%`，高 `10.3%` |

### 4.4 状态与交互

- “打开百炼免费额度设置”通过主进程白名单打开阿里云官方 HTTPS 页面。
- 用户勾选前，“保存并启用 0 元模式”禁用。
- 不显示“已检测到开关”，只显示“已由用户确认”。
- 本地确认记录包含：
  - 确认时间；
  - 模型代码；
  - 官方说明版本/链接；
  - `freeTierStopConfirmed: true`。
- 模型配置变化后确认失效，必须重新确认。

## 5. 页面三：一键制作进度抽屉

### 5.1 目的

开始后不再用连续弹窗打断用户。右侧抽屉提供完整状态，并允许用户继续浏览项目。

### 5.2 页面结构

```text
OneClickProductionDrawer
├── DrawerHeader
│   ├── Title
│   ├── OverallProgress
│   └── MinimizeButton
├── ZeroCostStatusBar
├── StageRail
│   ├── PreflightStage
│   ├── CharacterStage
│   ├── SceneStage
│   ├── StoryboardStage
│   ├── VideoStage
│   └── FinalizeStage
├── CurrentTaskCard
│   ├── Thumbnail
│   ├── EntityName
│   ├── Model
│   ├── Elapsed
│   └── Status
├── Counters
├── TaskLog
└── DrawerFooter
    ├── Pause / Resume
    ├── Stop
    └── ViewResult
```

### 5.3 尺寸

| 组件 | 估算尺寸 | 屏幕/父级占比 |
| --- | --- | --- |
| Drawer | `520 × 824 px` | 屏宽 `32.5%`，页高 `91.6%` |
| Header | `472 × 96 px` | 抽屉宽 `90.8%`，高 `11.7%` |
| ZeroCostStatusBar | `472 × 54 px` | 抽屉宽 `90.8%`，高 `6.6%` |
| StageRail | `472 × 152 px` | 抽屉宽 `90.8%`，高 `18.4%` |
| CurrentTaskCard | `472 × 126 px` | 抽屉宽 `90.8%`，高 `15.3%` |
| Counters | `472 × 72 px` | 抽屉宽 `90.8%`，高 `8.7%` |
| TaskLog | `472 × 224 px` | 抽屉宽 `90.8%`，高 `27.2%` |
| Footer | `472 × 72 px` | 抽屉宽 `90.8%`，高 `8.7%` |

### 5.4 进度定义

- 总进度只按确定任务计数，不以轮询次数计算。
- 状态：
  - `等待`
  - `正在生成`
  - `正在下载`
  - `正在校验`
  - `已采用`
  - `已跳过`
  - `已失败`
  - `已暂停`
  - `免费额度停止`
- 已有素材显示“已跳过”，不发请求。
- 当前视频任务轮询间隔约 `15 秒`，但 UI 每秒更新已用时间，不伪造百分比。
- 视频服务没有真实进度时显示不确定进度条和已用时间。

### 5.5 暂停与停止

- “暂停”：
  - 不创建下一任务；
  - 当前已提交任务继续下载和落盘，避免丢失已消耗额度的结果；
  - 当前任务完成后进入暂停。
- “停止”：
  - 二次确认；
  - 不删除已生成资产；
  - 当前已提交的远程任务无法撤回，仍尝试下载成功结果；
  - 队列标记为“用户停止”，可稍后继续缺失项。

### 5.6 最小化 Dock

- 抽屉关闭后，窗口右下角显示 `312 × 54 px` 浮动 Dock。
- 显示“图片与视频 18/58 · 正在生成镜头 12”。
- 点击重新打开抽屉。
- Dock 宽约屏宽 `19.5%`，高约页面 `6%`。

## 6. 页面四：设置页的 0 元自动化状态

### 6.1 位置

在现有设置页右侧 `settings-status-rail` 顶部，将“主进程保密”下方增加 `ZeroCostAutomationCard`。

### 6.2 规格

| 字段 | 规格 |
| --- | --- |
| 宽度 | `438 px`，约设置内容宽 `29%`，父级 `100%` |
| 高度 | `148 px`，约页面高 `16.4%` |
| Padding | `18 px` |
| 圆角 | `20 px` |
| 背景 | 已启用为浅青绿；未启用为浅琥珀 |
| 标题 | `0 元自动化`，`16 px / 24 px / 700` |
| 状态 | `已由用户确认` / `未设置` / `模型变化，需重新确认` |
| 操作 | `查看设置`、`重新确认` |
| 说明 | `额度耗尽后必须由百炼控制台停止；软件不会自动转付费。` |

### 6.3 不伪造状态

- 不显示“剩余免费额度充足”。
- 不显示伪余额、伪调用次数或伪到期时间。
- 设置页只表示本机记录和官方停止错误，不代表读取到阿里云控制台实时状态。

## 7. 任务数据与断点续作

### 7.1 本地任务清单

保存到：

```text
<userData>/.manju-studio/automation/<projectLocalId>/one-click-production.json
```

建议字段：

```text
runId
projectLocalId
projectSnapshotHash
createdAt
updatedAt
status
freeTierStopConfirmedAt
models
stages[]
tasks[]
currentTaskId
completedCount
skippedCount
failedCount
stoppedReason
```

### 7.2 单任务字段

```text
taskId
kind: character-image | scene-image | storyboard-image | shot-video
entityId
episodeId
sceneId
shotId
model
inputHash
status
attempt: 0 | 1
remoteTaskId
localAssetId
errorCode
errorMessage
createdAt
updatedAt
```

### 7.3 幂等规则

- `inputHash` 相同且已有本地合格资产：跳过。
- 任务最多自动提交一次。
- 网络超时但无法确认服务端是否已创建任务时，标记“结果未知”，不自动重提。
- 重启后优先查询已有 `remoteTaskId`，不创建第二个任务。
- 项目数据发生变化时只重建受影响实体的任务，不清空其他已完成任务。

## 8. 百炼执行映射

| 阶段 | 模型 | 行为 |
| --- | --- | --- |
| 角色图 | `qwen-image-2.0-pro` | `n=1`，无参考或复用已有角色参考 |
| 场景图 | `qwen-image-2.0-pro` | `n=1`，保留时间、天气、空间与色板 |
| 分镜图 | `qwen-image-2.0-pro` | 最多 3 张受管参考，角色 → 场景 → 前镜头 |
| 镜头视频 | `wan2.7-i2v-2026-04-25` | 单并发，`720P`，2–15 秒，优先首尾帧 |
| 视频轮询 | `/api/v1/tasks/{task_id}` | 约 15 秒轮询，24 小时内下载 |
| 输入上传 | 百炼临时 OSS | 仅视频需要时上传，48 小时有效 |

成功视频必须：

1. 下载 MP4；
2. 校验真实文件；
3. 使用 FFmpeg 提取真实末帧；
4. 登记本地视频和末帧资产；
5. 再标记任务完成。

## 9. 状态、异常与边界

### 9.1 Loading

- 预检控制在 `300 ms` 目标内，超过后显示“正在扫描项目素材”。
- 图片同步调用使用不确定进度。
- 视频异步任务显示已用时间和轮询状态。

### 9.2 Empty

- 没有项目：入口不显示。
- 有项目无剧本：按钮禁用，“请先准备剧本”。
- 已全部完成：按钮改为“已完成 · 查看成片”，不创建请求。

### 9.3 Error

- `AllocationQuota.FreeTierOnly`：红色停止卡，文案“免费额度已用完，已停止且不会扣费”。
- Key 无效：整个队列停止，直达设置。
- 账号欠费：整个队列停止，不尝试其他模型。
- 远程 URL 过期：若任务仍可查询则重新下载；不能查询则标记失败，不重新生成。
- 本地磁盘空间不足：在创建下一任务前停止。
- 图片/视频校验失败：保留日志，不写入项目。

### 9.4 Disabled

- 安全模式未确认；
- Key 未配置；
- 项目无剧本；
- 本地写入目录不可用；
- 当前已有另一条生产队列正在运行。

### 9.5 Selected / Pressed

- 选中阶段使用青蓝描边和浅蓝底。
- 主按钮 pressed 状态下缩放不超过 `0.985`，持续 `90 ms`。
- 不使用长时间背景模糊动画，避免页面卡顿。

### 9.6 Permission denied

- 不能写入本地目录时显示明确路径与“重新检查”。
- 不能打开外部控制台时提供可复制的官方链接。

### 9.7 长文本

- 项目名、实体名最多两行，超出省略并保留 `title`。
- 错误消息首屏最多三行，完整内容进入任务日志详情。

### 9.8 小屏和响应式

- `≥ 1280 px`：右侧抽屉 `520 px`。
- `1000–1279 px`：抽屉 `440 px`；总览侧栏卡片保持 `310 px` 最小宽度。
- 小于 `1100 px` 时总览页上下排列，一键卡位于剧集列表上方。
- 弹窗宽度使用 `min(760px, calc(100vw - 32px))`。
- 底部操作区始终避开窗口边缘 `16 px`。

### 9.9 暗色模式

- 本轮保持现有浅色主题；预留 token，不在页面散写暗色。
- 若未来启用暗色，状态色必须同时调整背景、文字、描边和图标，不只反转背景。

### 9.10 横竖屏与安全区

- Windows 桌面以横屏为主。
- 窗口高度不足时弹窗和抽屉内部滚动，底部操作固定。
- 不使用浏览器移动端安全区；保留窗口内容边距 `20–28 px`。

## 10. Design System 增量

### 10.1 Color System

| Token | 值 | 用途 |
| --- | --- | --- |
| `--automation-primary` | `#149FE2` | 一键制作主按钮 |
| `--automation-primary-end` | `#4D7CFA` | 主按钮渐变尾色 |
| `--automation-free` | `#14B8A6` | 0 元模式成功 |
| `--automation-warning` | `#D99521` | 未确认或需处理 |
| `--automation-danger` | `#D94B59` | 配额、欠费、停止 |
| `--automation-surface` | `rgba(242,251,255,.82)` | 自动化卡片 |
| `--automation-border` | `rgba(104,196,236,.34)` | 玻璃描边 |
| `--automation-text` | `#163B55` | 主文字 |
| `--automation-muted` | `#68869A` | 次文字 |

### 10.2 Typography

- 标题：Microsoft YaHei UI / system-ui，`22 px`，`700`。
- 卡片小标题：`16 px`，`700`。
- 正文：`13–14 px`，`400–500`。
- 数据：`20 px`，`700`，tabular numbers。
- 日志：`12 px / 18 px`。

### 10.3 Component System

- Button：主按钮 `56 px` 高；普通按钮 `42–46 px`；点击面积不少于 `42 × 42 px`。
- Card：`20–26 px` 圆角，轻边框和单层阴影。
- Avatar：继续复用现有角色头像组件。
- Navigation：不新增顶级导航项，入口保留在项目总览。
- Modal：首次安全设置使用顶层 Portal，禁止背景滚动，焦点限制。
- Drawer：右侧固定，支持最小化为 Dock。
- List：任务日志虚拟化阈值为 `100` 条，避免长项目卡顿。
- Feed：不新增社交 Feed。
- Badge：状态必须同时包含文字，不能只用颜色。
- Progress：确定任务用分段进度；不确定远程任务不用伪百分比。

## 11. 中文文案表

### 11.1 总览页

| 类型 | 文案 |
| --- | --- |
| 标题 | 一键制作整部漫剧 |
| 说明 | 已有剧本，自动生成缺失图片与视频 |
| 主按钮 | 一键生成图片和视频 |
| 继续按钮 | 继续上次任务 |
| 已完成 | 已完成 · 查看成片 |
| 安全徽标 | 0 元模式 |
| 未设置 | 需先设置 0 元模式 |
| 无剧本 | 请先准备剧本 |

### 11.2 安全设置弹窗

| 类型 | 文案 |
| --- | --- |
| 标题 | 启用 0 元一键制作 |
| 说明 | 百炼免费额度用完后可能自动计费。请先在控制台为以下模型开启“免费额度用完即停”。 |
| 官方入口 | 打开百炼免费额度设置 |
| 勾选 | 我已为剧本、图片和视频模型开启“免费额度用完即停” |
| 限制说明 | 软件无法读取控制台实时余额；模型或账号设置变化后请重新确认。 |
| 取消 | 取消 |
| 保存 | 保存并启用 0 元模式 |

### 11.3 进度抽屉

| 类型 | 文案 |
| --- | --- |
| 标题 | 正在一键制作 |
| 安全状态 | 0 元模式 · 单任务顺序执行 |
| 暂停 | 完成当前任务后暂停 |
| 继续 | 继续制作 |
| 停止 | 停止后续任务 |
| 查看 | 查看成片 |
| 配额停止 | 免费额度已用完，已停止且不会继续调用 |
| 未知任务 | 当前任务结果未知，未自动重试 |
| 全部完成 | 图片与视频已全部完成 |

## 12. 英文 AI 设计图 Prompt

--------------------------------
页面名称：项目总览 · 一键制作入口

Prompt：

Design a polished Windows desktop AI manju production overview screen for “漫剧创作”. UI Design: local-first production dashboard with a prominent one-click automation entry, trustworthy zero-cost safety cues, and sky-blue frosted glass styling. Layout: 1600×900 desktop canvas, 76px top navigation, wide project identity bar, 74/24 two-column content grid; the left side contains episode production cards, while the right side contains a story summary and a new tall “一键制作整部漫剧” card. Components: project readiness counts for character images, scene images, storyboard frames and videos; four-stage mini progress rail; green “0 元模式” badge; large gradient button “一键生成图片和视频”; resume and blocker states. Style: refined sky-blue gradient, translucent white glass, crisp navy text, cyan-to-indigo primary action, subtle shadows, professional creative software, no generic SaaS pricing layout. Lighting: soft cool daylight with clean layered depth. Motion direction: brief button press, segmented progress transitions, no heavy background blur animation. Resolution: 1600×900. Simplified Chinese UI text, Chinese labels, Chinese Windows desktop app interface. Use short labels only.
--------------------------------

--------------------------------
页面名称：0 元安全设置弹窗

Prompt：

Design a focused safety setup modal for a Windows AI manju production app. UI Design: honest zero-cost automation onboarding that clearly states the software cannot read real-time cloud quota. Layout: 1600×900 blurred application background, centered 760×620 frosted glass modal with header, explanatory notice, three model checklist rows, official console action, one attestation checkbox and two footer buttons. Components: models “qwen-plus”, “qwen-image-2.0-pro”, “wan2.7-i2v-2026-04-25”; shield icon; amber warning; button “打开百炼免费额度设置”; checkbox “我已开启免费额度用完即停”; disabled and enabled save states. Style: sky-blue glass, calm navy typography, teal success, restrained amber warning, no exposed API key, no fake balance number. Lighting: neutral software lighting with clear foreground depth. Motion direction: modal fade and small checkbox confirmation only. Resolution: 1600×900. Simplified Chinese UI text, Chinese labels, Chinese Windows desktop app interface. Use short labels only.
--------------------------------

--------------------------------
页面名称：一键制作进度抽屉

Prompt：

Design a professional right-side automation progress drawer for a Windows AI manju production application. UI Design: transparent batch pipeline control with restart-safe progress and zero-cost stop behavior. Layout: 1600×900 desktop app with a 520px right drawer, page content still visible behind it; drawer sections include overall progress, green zero-cost status bar, six-stage vertical rail, current asset card, completed/skipped/failed counters, task log and footer controls. Components: stages “预检 / 角色图 / 场景图 / 分镜图 / 视频 / 完成”; current task thumbnail; indeterminate video spinner with elapsed time; buttons “完成当前任务后暂停” and “停止后续任务”; compact minimized dock preview. Style: sky-blue translucent glass, precise navy labels, cyan active progress, teal completed, muted skipped, restrained red quota-stop state. Lighting: crisp cool desktop lighting, subtle shadow separation. Motion direction: drawer slide, stage check transitions, no fake percentage for async video tasks. Resolution: 1600×900. Simplified Chinese UI text, Chinese labels, Chinese Windows desktop app interface. Use short labels only.
--------------------------------

## 13. React / Electron 实现映射

### 13.1 页面层

- `OverviewPage`：
  - 只显示就绪统计、当前运行摘要和入口。
  - 不直接创建 API 请求或持久化任务。
- `ZeroCostSafetyModal`：
  - 只编辑本机确认草稿和提交确认。
- `OneClickProductionDrawer`：
  - 订阅任务状态，发送暂停、继续、停止命令。
- `SettingsPage`：
  - 展示本机安全确认状态，不伪装成云端检测。

### 13.2 Service 层

- `oneClickProductionPlanService.js`
  - 从项目快照生成确定性任务计划。
  - 计算缺失、跳过、阻塞和 `inputHash`。
- `oneClickProductionStateService.js`
  - 状态机、阶段进度、恢复与错误映射。
- `oneClickProductionSafetyService.js`
  - 验证本机确认、模型一致性和费用停止错误。
- 现有角色、场景、分镜请求服务继续负责提示词和请求结构。

### 13.3 Electron 主进程

- 新增最小 IPC：
  - `automation:preflight`
  - `automation:start`
  - `automation:pause`
  - `automation:resume`
  - `automation:stop`
  - `automation:status`
  - `automation:open-free-quota-settings`
- 队列、Key、网络、下载、OSS 上传、视频轮询和 FFmpeg 必须在主进程。
- Renderer 不接收 Key、临时 OSS 凭证或绝对本地路径。
- 通过单个事件流推送状态，卸载页面时移除监听。

### 13.4 Repository

- `oneClickProductionRepository.js`：
  - 原子写入任务清单；
  - 保留最近一次运行报告；
  - 读取未完成任务并恢复。
- 项目自动保存继续通过现有 `projectRepository`。
- 媒体继续通过 V37 受管图片和 V32 受管视频边界。

## 14. 验收标准

### 14.1 功能验收

1. 已设置安全门后，从总览页只点一次即可开始。
2. 不再逐张弹出预检、确认和采用弹窗。
3. 只生成缺失素材，已有图片和视频不发请求。
4. 图片固定 `n=1`，视频固定 `720P`，队列并发为 `1`。
5. 图片、视频成功后自动下载、校验、文件化采用。
6. 视频成功后提取真实末帧并用于下一镜连续性。
7. 关闭软件后重新打开可继续未完成任务。
8. 暂停不会创建下一任务。
9. 停止不会删除已完成结果。
10. 不确定是否已提交的任务不自动重试。
11. 项目修改后不会用旧任务覆盖新素材。
12. 全部完成后可直达成片页。

### 14.2 零费用验收

1. 没有本机安全确认时不能启动真实队列。
2. 模型变化后安全确认自动失效。
3. `AllocationQuota.FreeTierOnly` 出现后整个队列立即停止。
4. 余额、欠费、配额错误均不自动重试或换模型。
5. 应用不显示伪造的剩余额度。
6. 自动化测试必须使用假响应或 `MANJU_DISABLE_PAID_GENERATION=1`。
7. 开发、测试、打包和安装验收期间真实生成请求数为 `0`。
8. API Key 不进入 Renderer、项目、任务清单、日志或安装包。

### 14.3 UI 与性能验收

1. 1600×900、1440×900、1000×700 无横向溢出。
2. 总览主入口首屏可见。
3. 抽屉打开时页面仍可浏览。
4. 抽屉最小化后 Dock 不遮挡成片导出主操作。
5. 任务日志达到 100 条后仍无明显卡顿。
6. 设置页进出无新增长任务。
7. 弹窗和抽屉焦点限制、Escape、回焦正确。
8. 状态不能只依赖颜色表达。

## 15. 完整组件树

```text
App
├── TopBar
├── OverviewPage
│   ├── ProjectIdentity
│   ├── EpisodePanel
│   └── OverviewSide
│       ├── StorySummary
│       └── OneClickProductionCard
│           ├── ZeroCostBadge
│           ├── ReadinessSummary
│           ├── StageMiniRail
│           ├── PrimaryAction
│           └── SecondaryAction
├── ZeroCostSafetyModal
│   ├── ModalHeader
│   ├── SafetyExplanation
│   ├── ModelChecklist
│   ├── ConsoleAction
│   ├── AttestationCheckbox
│   └── FooterActions
├── OneClickProductionDrawer
│   ├── DrawerHeader
│   ├── ZeroCostStatusBar
│   ├── StageRail
│   ├── CurrentTaskCard
│   ├── Counters
│   ├── TaskLog
│   └── DrawerFooter
├── ProductionProgressDock
└── SettingsPage
    └── SettingsStatusRail
        └── ZeroCostAutomationCard
```

## 16. 不确定项与设计假设

- 百炼当前公开生成 API 没有被本项目验证为可读取实时免费额度；本设计不依赖余额查询。
- “免费额度用完即停”需要用户在阿里云控制台完成，应用只保存用户确认。
- 用户本次只要求剧本后的图片和视频自动生产，因此配音不进入 V38。
- 默认对整个项目执行，而不是只处理当前集；任务计划中仍记录剧集，可在未来增加“仅当前集”。
- 自动队列不会覆盖已有真实素材；如果用户希望强制重做，必须走独立的手动流程。
- 真实视频调用尚未在当前 Electron 应用开放，V38 实现需要新增异步任务创建、轮询、下载与末帧提取。

## 17. 设计识别置信度

```text
设计识别置信度: 96%
布局识别: 98%
颜色识别: 97%
字体识别: 93%
尺寸估算: 94%
交互流程识别: 96%
```

所有尺寸均根据当前运行截图智能推算。若原始 Figma 设计稿可获取，则可以进一步精确到设计源尺寸。

## 18. 等待确认

本设计稿确认后进入 React + Electron 实现阶段。实现将以本文件作为 UI、任务状态、费用安全和验收的唯一基准；在确认前不修改页面或调用任何生成接口。
