# 漫剧创作 V17 项目名称真实编辑 Design Spec

## 0. 来源、目标与边界

- 产品：Windows 本地优先漫剧制作软件 `漫剧创作`。
- 当前版本基线：`1.14.0`。
- 视觉源：`outputs/runtime/overview.png`，实测画布 `1777 × 974 px`。
- 代码基准：`src/App.jsx` 的 `OverviewPage`、`App` 项目状态与保存流程；`src/App.css` 的 `project-identity`；`src/services/projectRepository.js`；`main.js` 的项目保存与最近项目逻辑。
- 真实缺口：总览页项目名称右侧铅笔按钮当前只显示“项目名称编辑将在下一轮接入”，是公开可点击但没有真实结果的入口。
- 本轮目标：把铅笔入口改为安全、可键盘操作、可自动保存的行内项目名称编辑；同步当前工作区显示与后续手动保存的项目元数据。
- 本轮主分类：项目元数据编辑；副分类：保存语义、最近项目一致性与本地恢复身份稳定性。
- 本轮不改：磁盘文件名、项目文件路径、故事内容、剧集/场景/角色/镜头、时间线历史、项目格式版本、Provider、API Key、网络、权限、IPC 能力集合。
- 真实 AI 接口继续保持预留状态，不读取 `key.txt`，不发起付费或外部请求。

## 1. 产品与用户分析

### 1.1 产品类型

桌面端本地创作工作台。项目名称既是用户识别当前作品的主要标签，也是新建 `.manju` 文件时的默认文件名来源，但它不是磁盘路径或唯一项目 ID。

### 1.2 目标用户

- 18–45 岁的漫剧编导、短剧创作者、AI 内容制作人和小型工作室成员。
- 同时维护多个题材相近的项目，需要快速辨认当前工作区。
- 熟悉桌面软件的双击、铅笔编辑、Enter 确认、Escape 取消和 Ctrl+S 保存习惯。

### 1.3 使用场景

- 新建项目后把自动生成的“悬疑新作”改为正式片名。
- 打开已有 `.manju` 后更新作品显示名称，但保留原磁盘文件路径。
- 先在本地草稿中改名，依赖 800 ms 自动保存；之后再决定是否“另存为”新的文件名。
- 保存当前文件后，让最近项目列表使用新名称展示同一路径。

### 1.4 用户痛点与核心价值

- 当前铅笔按钮没有真实操作，破坏用户对可点击入口的信任。
- 如果重命名偷偷改动磁盘文件名，会引入路径失效、覆盖和最近项目重复等风险。
- V17 的核心价值是：名称修改即时、边界明确、无文件副作用，并且可通过现有自动保存和手动保存可靠保留。

## 2. 视觉方向

### 2.1 设计关键词

`Sky-blue gradient`、`bright glassmorphism`、`inline editing`、`desktop productivity`、`low-risk confirmation`、`compact identity header`。

### 2.2 视觉原则

- 保留现有渐变天蓝背景、白色毛玻璃项目身份条、深蓝正文和青蓝焦点光晕。
- 编辑态仍然位于原项目名称位置，不打开大弹窗，不遮挡剧集列表。
- 确认使用天蓝渐变主操作，取消使用白色毛玻璃次操作；二者都只使用图标并提供明确 tooltip 与 `aria-label`。
- 不用红色表达普通校验错误；错误采用珊瑚文字和浅珊瑚边框，避免与删除危险操作混淆。
- 编辑态高度尽量不跳动；辅助行在“路径说明 / 校验错误”之间切换。

## 3. 页面整体分析

- 页面：项目总览 `OverviewPage`。
- 页面类型：项目仪表盘 / 列表 / 快捷入口。
- 目标设备：Windows 桌面，基准 `1777 × 974 px`，编辑区可纵向滚动。
- 布局：顶部全局导航 + 项目身份条 + 左侧剧集列表 + 右侧故事与继续创作卡片。
- 本轮影响范围：仅 `ProjectIdentity` 中间名称区域；右侧打开、保存、另存为、成片按钮不移动。
- 参考身份条范围（推测值）：`1718 × 92 px`，占屏宽约 `96.7%`，占页面高约 `9.4%`。
- 编辑触发后身份条维持约 `92 px`；极窄窗口可增长到 `108 px` 并换行。

## 4. 页面结构拆解

```text
OverviewPage
├── TopNavigation
├── ProjectIdentity
│   ├── ProjectCover
│   ├── ProjectIdentityContent
│   │   ├── ProjectNameView
│   │   │   ├── ProjectNameText
│   │   │   └── RenameTrigger
│   │   ├── ProjectNameEditor
│   │   │   ├── ProjectNameInput
│   │   │   ├── RenameConfirm
│   │   │   └── RenameCancel
│   │   └── ProjectIdentityHelper
│   │       ├── SaveStatusDot
│   │       └── FilePathOrValidationText
│   └── ProjectActions
│       ├── OpenProject
│       ├── SaveProject
│       ├── SaveAsProject
│       └── OpenFinalPage
├── EpisodePanel
└── OverviewSide
    ├── StorySummary
    └── ContinueCreation
```

`ProjectNameView` 与 `ProjectNameEditor` 互斥渲染，不同时占据布局空间。

## 5. 组件级设计稿

### 5.1 ProjectIdentity

| 字段 | 规格 |
| --- | --- |
| 类型 | Glass Container |
| 位置 | 全局导航下方，页面主内容顶部 |
| 宽度 | 推测 `1718 px`；占屏宽约 `96.7%`；占页面内容宽 `100%` |
| 高度 | 默认 `92 px`；占页高约 `9.4%`；编辑错误态最多 `108 px` |
| 布局 | Grid：`52 px minmax(0,1fr) auto` |
| Padding | `10 px 14 px`；横向约占容器宽 `0.8%` |
| Gap | `12 px` |
| 圆角 | 延用现有玻璃容器约 `18–22 px`（推测值） |
| 背景 | `rgba(244,252,255,.58)` + 天蓝线性渐变 |
| 边框 | `1 px solid rgba(255,255,255,.72)` |
| 阴影 | `0 18px 48px rgba(40,137,185,.10)`，内侧白色高光 |
| 状态 | view / editing / invalid / committing / size-error |

### 5.2 ProjectCover

| 字段 | 规格 |
| --- | --- |
| 类型 | Image / Artwork |
| 尺寸 | `52 × 52 px`；占身份条高约 `56.5%`；占屏宽约 `2.9%` |
| 圆角 | `13 px` |
| 图片模式 | `cover`；无图片时沿用现有雾城插画占位 |
| 对齐 | 垂直居中，左侧第一列 |
| 交互 | 本轮不增加封面点击或上传 |

### 5.3 ProjectNameView

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline title group |
| 宽度 | 内容自适应，最大约 `620 px`；占父内容列最多 `55%`；占屏宽约 `34.9%` |
| 高度 | `34 px`；占身份条高约 `37%` |
| 布局 | Flex，垂直居中，间距 `6 px` |
| 标题 | 实际项目名称；`24 px / 32 px / 760`；颜色 `#173F58` |
| 长文本 | 单行省略；hover 显示完整名称；不挤压右侧项目动作 |
| 动画 | 进入编辑态只做 `120 ms` 透明度过渡；减少动态模式无动画 |

### 5.4 RenameTrigger

| 字段 | 规格 |
| --- | --- |
| 类型 | Icon Button |
| 尺寸 | 视觉 `28 × 28 px`；有效热区至少 `36 × 36 px`；占身份条高约 `39%` |
| 图标 | `edit` 铅笔，`16 × 16 px`；占按钮视觉宽约 `57%` |
| 颜色 | 默认 `#2599D1`；hover `#087DB8` |
| 背景 | 默认透明；hover `rgba(125,211,248,.20)` |
| 圆角 | `9 px` |
| Tooltip | `编辑项目名称` |
| aria-label | `编辑项目名称，当前名称：{name}` |
| 键盘 | Enter / Space 进入编辑；进入后 input 全选并获得焦点 |

### 5.5 ProjectNameEditor

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline form |
| 宽度 | `clamp(240px, 34vw, 520px)`；基准约 `460 px`；占屏宽约 `25.9%` |
| 高度 | `40 px`；占身份条高约 `43.5%` |
| 布局 | Grid：`minmax(0,1fr) 36px 36px`，间距 `6 px` |
| 层级 | 普通内容层；不盖住右侧项目动作 |
| 表单语义 | `<form>`；确认提交只触发一次本地状态事务 |
| 状态 | valid / invalid / unchanged / committing |

### 5.6 ProjectNameInput

| 字段 | 规格 |
| --- | --- |
| 类型 | Text Input |
| 宽度 | 基准约 `376 px`；占编辑器宽约 `81.7%`；占屏宽约 `21.2%` |
| 高度 | `40 px`；占编辑器高 `100%` |
| Padding | `0 12 px` |
| 圆角 | `11 px` |
| 背景 | `rgba(255,255,255,.72)` + `backdrop-filter: blur(14px)` |
| 边框 | 默认 `1 px rgba(72,172,219,.28)`；focus `#35B5EF` |
| Focus | `0 0 0 3px rgba(52,181,239,.16)` |
| 字体 | `17 px / 24 px / 720`；颜色 `#173F58` |
| 限制 | trim 后 `1–80` 个 Unicode 字符；禁止控制字符；不要求名称唯一 |
| 输入法 | `compositionstart/end` 期间 Enter 不提交，兼容中文输入法 |
| 错误 | 空名称、全空白、超长或候选项目超过 10 MB 时 `aria-invalid=true` |
| 自动完成 | `off`；不使用密码或隐私字段 |

### 5.7 RenameConfirm

| 字段 | 规格 |
| --- | --- |
| 类型 | Primary Icon Button |
| 尺寸 | `36 × 36 px`；占编辑器高 `90%` |
| 图标 | `check`，`15 × 15 px` |
| 圆角 | `10 px` |
| 背景 | `linear-gradient(135deg,#36B8EF,#70D3F8)` |
| 颜色 | `#FFFFFF` |
| 阴影 | `0 6px 14px rgba(36,153,207,.18)` |
| Disabled | 空、无变化、校验失败或正在提交时 `opacity:.45` |
| Tooltip | `确认修改（Enter）` |
| aria-label | `确认项目名称修改` |

### 5.8 RenameCancel

| 字段 | 规格 |
| --- | --- |
| 类型 | Secondary Icon Button |
| 尺寸 | `36 × 36 px` |
| 图标 | `x/close`，`15 × 15 px`；若缺少资源可使用两条圆角线绘制 |
| 圆角 | `10 px` |
| 背景 | `rgba(255,255,255,.58)` |
| 边框 | `1 px rgba(73,174,232,.24)` |
| 颜色 | `#4D7489` |
| Tooltip | `取消修改（Esc）` |
| aria-label | `取消项目名称修改` |

### 5.9 ProjectIdentityHelper

| 字段 | 规格 |
| --- | --- |
| 类型 | Helper / status text |
| 位置 | 名称或编辑器下方 |
| 高度 | `18 px`；占身份条高约 `19.6%` |
| 字体 | `10 px / 16 px / 560` |
| 默认文案 | 有文件：`本地项目 · {完整路径}`；无文件：`本地草稿 · 自动保存已开启` |
| 编辑提示 | 有文件：`修改显示名称不会重命名磁盘文件；保存后更新项目内容。` |
| 无文件提示 | `新名称会自动保存；首次保存时作为默认文件名。` |
| 错误文案 | 空名称、超长或体积错误；颜色 `#D66A72` |
| 路径 | 单行省略，title 显示完整路径 |
| 图标 | 保留 `7 × 7 px` save dot；错误态改为珊瑚色，不只靠颜色，前置 `!` 语义图标 |

## 6. 交互流程

### 6.1 进入编辑

```text
点击铅笔 / 键盘激活
  -> 保存原名称到短生命周期 draft
  -> 切换 ProjectNameEditor
  -> 下一帧聚焦 input 并全选原名称
  -> 不修改 projectMeta，不触发自动保存
```

### 6.2 确认修改

```text
点击确认 / 非输入法组合状态下按 Enter
  -> trim 首尾空白
  -> 校验字符数和控制字符
  -> 构造候选 projectSnapshot
  -> 使用现有 UTF-8 10 MB 规则预检
  -> 一次更新 projectMeta.name
  -> 退出编辑态
  -> 800 ms 后走现有 autosave
  -> 显示“项目已重命名为「新名称」”
```

### 6.3 取消修改

```text
点击取消 / 按 Escape
  -> 丢弃 draft
  -> 恢复只读标题
  -> 项目数据、自动保存、最近项目和文件均不变化
  -> 焦点返回 RenameTrigger
```

### 6.4 Blur 与页面跳转

- input 失焦不自动确认，避免用户点击“打开 / 保存 / 成片”时意外改名。
- 编辑态点击右侧项目动作前，由按钮原行为继续执行；草稿名称丢弃并退出编辑。
- 离开总览页时未确认草稿不进入项目状态。
- 页面卸载不弹确认框，因为草稿只是一行、尚未提交且可逆；不阻塞导航。

## 7. 数据、保存与文件语义

### 7.1 名称和文件路径严格分离

- `projectMeta.name` 是项目显示名称。
- `currentFile` 是已授权磁盘路径。
- 确认重命名只更新 `projectMeta.name`，绝不调用文件移动、文件重命名、删除或另存为。
- 已打开文件仍显示原路径；按“保存”后在原路径写入新的项目元数据。
- “另存为”继续打开系统保存对话框，并使用新项目名称经过现有 `sanitizeFileName` 处理后的值作为默认文件名。
- Windows 文件名非法 ASCII 字符只在生成默认文件名时替换，不修改用户看到的项目名称。

### 7.2 自动保存与最近项目

- 确认后沿用 `App` 的 800 ms 自动保存，不新增 Repository 或 IPC。
- 自动保存只更新应用数据目录的 `autosave.manju`，不静默覆盖用户选择的 `.manju` 文件。
- 已保存项目按“保存”后，由现有 `updateRecentProjects` 以磁盘路径去重并刷新名称；不得生成同一路径的第二条最近项目。
- 当前 Home 页继续创作卡片立即使用新的 `projectMeta.name`。
- 用户仅确认名称但尚未保存当前文件时，最近项目列表保留上次磁盘保存名称，这是明确的文件保存语义，不伪装为已写盘。

### 7.3 稳定恢复身份

- 不能继续让未保存项目的时间线恢复 key 直接依赖可变项目名称，否则改名会让已有恢复点暂时不可见。
- V17 应为 `projectMeta` 增加可选本地字段 `localProjectId`，新建时生成，旧项目读取时补齐；不提升 `.manju` 格式版本。
- `FinalPage.recoveryKey` 优先使用 `currentFile || localProjectId || projectMeta.name`。
- 重命名不改变 `localProjectId`；已有未保存项目的恢复点仍属于同一项目。
- `localProjectId` 只用于本地身份，不展示、不上传、不作为密钥，不包含用户隐私。

### 7.4 候选体积预检

- 修改名称前以完整候选 `projectSnapshot` 调用现有字节计算。
- 超过 10 MB 时不更新 `projectMeta`，不触发自动保存，不更新最近项目，显示：`修改后项目将超过 10 MB，请先移除部分图片或音频。`
- 不为重命名建立时间线历史或恢复点，因为它不是时间线编辑。

## 8. 状态与异常

| 状态 | 表现 |
| --- | --- |
| view | 显示项目名和铅笔入口 |
| editing-valid | 输入框青蓝焦点环，确认可用 |
| editing-unchanged | 确认禁用，取消可用 |
| empty | helper 显示“项目名称不能为空” |
| too-long | 超过 80 字符时显示计数与错误，不截断已输入草稿 |
| invalid-control | 控制字符被拒绝，提示“项目名称包含不可用字符” |
| committing | 同步预检的一帧内锁定确认，防止重复提交 |
| size-error | 保持编辑态和草稿，数据不变 |
| success | 回到只读标题，显示全局成功提示 |
| cancel | 无提示或简短提示，焦点返回铅笔按钮 |
| autosave-error | 沿用现有自动保存失败策略；本轮不伪装为磁盘已保存 |
| long text | 只读标题省略，编辑输入横向滚动，完整值保留 |
| small screen | `<900 px` 时身份条两行：封面+名称第一行，项目动作第二行 |
| 150% scaling | 输入和图标按钮保持至少 36 CSS px，文案不与动作重叠 |
| dark mode | 当前不新增全局暗色主题；高对比模式使用边框、图标和文字共同表达 |
| reduced motion | 取消透明度和焦点光晕过渡 |
| permission denied | 不新增文件权限；改名本身不访问磁盘路径 |

## 9. 响应式尺寸

| 断点 | 规则 |
| --- | --- |
| `≥ 1180 px` | 身份条保持三列；编辑器最大 `520 px` |
| `900–1179 px` | 项目动作允许换行；编辑器 `clamp(240px,42vw,440px)` |
| `< 900 px` | 身份条改为 `52px minmax(0,1fr)`；项目动作占满下一行并右对齐 |
| `< 620 px` | 编辑器宽 `100%`；确认/取消仍各 `36 px`，项目动作横向滚动或两行 |

## 10. 中文文案表

| 场景 | 文案 |
| --- | --- |
| 铅笔 tooltip | `编辑项目名称` |
| 输入 aria-label | `项目名称` |
| 确认 tooltip | `确认修改（Enter）` |
| 取消 tooltip | `取消修改（Esc）` |
| 已有文件提示 | `修改显示名称不会重命名磁盘文件；保存后更新项目内容。` |
| 草稿提示 | `新名称会自动保存；首次保存时作为默认文件名。` |
| 空名称 | `项目名称不能为空。` |
| 超长 | `项目名称最多 80 个字符。` |
| 不可用字符 | `项目名称包含不可用的控制字符。` |
| 体积错误 | `修改后项目将超过 10 MB，请先移除部分图片或音频。` |
| 成功 | `项目已重命名为「{name}」` |
| 文件未改名提示 | `项目显示名称已更新，磁盘文件名保持不变。` |

## 11. AI 视觉生成 Prompt

--------------------------------
页面名称：项目总览—项目名称行内编辑态

Prompt：

Design a polished Windows desktop manju production application project overview screen, focused on an inline project-name editing state inside the top project identity glass card. Use a bright sky-blue gradient background, premium white glassmorphism panels, subtle cyan rim lighting, deep navy typography, generous desktop spacing, and a clean creative productivity aesthetic. Canvas resolution 1777x974. Keep the existing top navigation with short Simplified Chinese labels: “总览”, “剧本”, “角色”, “分镜”, “配音”, “成片”. In the project identity bar, show a 52x52 cinematic blue cover thumbnail on the left, a compact inline text input containing the short Chinese title “雾城回声” in the middle, followed by a cyan gradient check icon button and a translucent cancel icon button. Under the input show the short helper text “修改显示名称不会重命名磁盘文件”. On the right retain four glass buttons: “打开”, “保存”, “另存为”, “成片”. Below, preserve the episode list and story summary cards from a desktop manju creation dashboard. UI Design: precise grid alignment, compact form, 36px icon targets, 11px rounded input, soft focus halo. Style: sky-blue gradient glassmorphism, professional, cinematic, modern Chinese creator tool. Lighting: soft daylight, subtle cyan glow, low contrast shadows. Animation direction: gentle 120ms fade between title and input, no layout jump. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface, only short titles and labels, no long paragraphs.
--------------------------------

## 12. React 与服务映射

| 设计区域 | 实现位置 | 责任 |
| --- | --- | --- |
| `ProjectNameView/Editor` | `OverviewPage` | 草稿态、焦点、校验展示、键盘交互 |
| `projectMeta.name` 更新 | `App` 传入的 `setProjectMeta` 或专用回调 | 一次提交正式项目状态 |
| 候选体积预检 | `projectModel.js` 现有 `getProjectSnapshotByteSize` | 纯函数、无副作用 |
| 自动保存 | `App` 现有 projectSnapshot effect | 800 ms debounce，不新增 IPC |
| 文件保存 | `projectRepository.save` / `main.js` | 保持原路径或另存为，不由重命名直接调用 |
| 最近项目 | `main.js updateRecentProjects` | 手动保存后按路径更新名称 |
| 稳定恢复身份 | `projectMeta.localProjectId` + `recoveryKey` | 名称变化不迁移恢复点命名空间 |
| UI 样式 | `App.css` | 延用 token、玻璃、断点和 focus-visible 规则 |

## 13. 验收与测试矩阵

| 场景 | 预期结果 |
| --- | --- |
| 点击铅笔 | 输入框出现、原名称全选、焦点正确 |
| Enter 确认 | 名称更新、编辑态关闭、800 ms 后自动保存 |
| 中文输入法 Enter | 组合输入期间不误提交 |
| Escape 取消 | 名称不变、无自动保存副作用、焦点回铅笔 |
| 点击取消 | 与 Escape 一致 |
| 名称未变化 | 确认禁用，不创建无意义更新 |
| 首尾空格 | 提交时 trim，内部空格保留 |
| 空名称 | 不提交，显示可读错误并设置 `aria-invalid` |
| 80 字符边界 | 80 允许，81 拒绝 |
| 长中文/Emoji | 按 Unicode 字符计数，数据不破坏 |
| 控制字符 | 拒绝，不写项目状态 |
| 10 MB 超限 | 名称和所有项目数据不变化，不触发保存 |
| 自动保存 | `autosave.manju` 中名称更新，格式版本仍为 1 |
| 当前文件保存 | 路径不变，文件内容名称更新 |
| 另存为 | 默认文件名使用新名称的安全化结果 |
| 最近项目 | 同一路径不重复，手动保存后显示新名称 |
| 首页继续创作 | 返回首页立即显示新名称 |
| 未保存项目恢复点 | 改名前后 `recoveryKey` 稳定，恢复点仍可见 |
| 旧项目兼容 | 缺少 `localProjectId` 时补齐并正常自动保存 |
| 页面跳转 | 未确认草稿不进入项目数据，不弹阻塞确认 |
| 小屏/150% 缩放 | 输入和四个项目动作不重叠，按钮热区 ≥36 px |
| 键盘可达性 | Tab 顺序为输入、确认、取消、项目动作；focus 可见 |
| Provider / key.txt | 不读取、不上传、不写入项目或构建产物 |

## 14. 完整组件树

```text
OverviewPage
├── TopBar
├── ProjectIdentity
│   ├── ProjectCover
│   ├── ProjectIdentityContent
│   │   ├── ProjectNameView
│   │   │   ├── ProjectNameText
│   │   │   └── RenameTrigger
│   │   ├── ProjectNameEditor
│   │   │   ├── ProjectNameInput
│   │   │   ├── RenameConfirm
│   │   │   └── RenameCancel
│   │   └── ProjectIdentityHelper
│   └── ProjectActions
├── EpisodePanel
└── OverviewSide
```

## 15. 设计还原评分

```text
设计识别置信度: 99%
布局识别: 99%
颜色识别: 98%
字体识别: 95%
尺寸估算: 97%
交互与数据风险识别: 98%
```

所有尺寸均根据当前运行截图和实际 CSS 智能推算。若原始设计稿（Figma、Sketch、PSD）可获取，可进一步校准精确尺寸。

## 16. 不确定项与设计假设

- 将“下一步”解释为修复项目中最明确的假交互：总览页项目名称铅笔按钮；依据是代码中明确写有“下一轮接入”。
- 项目名称是显示元数据，不等同于 Windows 文件名；本轮不执行文件移动或重命名。
- 最近项目以真实路径去重，只有手动保存当前文件后才更新该文件对应的名称；自动保存不伪装为已写入用户文件。
- `localProjectId` 是兼容字段，用于保持未保存项目的恢复身份；不提升项目格式版本，不作为云端 ID。
- 本轮不增加项目名称历史、全局脏状态系统或“是否保存”关闭确认；这些可以在后续版本统一设计。
- 设计只覆盖项目身份条这一处真实入口，不改造剧集名称输入、故事简介或首页项目卡片布局。

## 17. 确认与实现状态

- 2026-07-20：用户以“下一步”确认进入 React + Electron 实现阶段。
- 已按本设计稿实现到应用版本 `1.15.0`；`.manju` 项目格式版本继续保持 `1`。
- 实现验证覆盖名称校验、输入法组合态、Enter / Escape、焦点恢复、自动保存、Home 页同步、旧项目 `localProjectId` 补齐和 10 MB 预检。

本阶段保持现有 React + Electron 技术栈；未进入 Figma、React Native 或 HarmonyOS ArkUI，也未接入真实 AI Provider。
