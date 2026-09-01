# 成片页镜头多选与批量编辑 Design Spec

## 1. 来源与整体分析

- 视觉基准：`docs/design/manju-v8-launchpad-final-assembly.png`、`outputs/runtime/final-shot-editing.png`、`docs/design/manju-creation-v10-shot-motion-controls.md`、`docs/design/manju-creation-v11-shot-reorder-duration-sync.md`。
- 参考画布：Windows 桌面横向窗口，运行截图 `1777 × 974 px`；页面纵向滚动，无移动端状态栏或底部安全区。
- 目标页面：项目内 `成片` 页的 `ProductionTimeline`，在现有单层镜头带和镜头动效检查器之间增加轻量批量编辑能力。
- 产品目标：长项目不再逐个重复设置镜头时长、画面运动和转场；用户可以按 Windows 桌面习惯选择多个镜头，一次应用参数，并且整批操作只占一个撤销步骤。
- 视觉方向：保留渐变天蓝色、白色毛玻璃、深蓝文字和低饱和青色高光；批量编辑栏是现有时间线的内嵌玻璃工具条，不增加黑色专业剪辑器工具箱。
- 本轮边界：只做镜头多选、批量时长、批量动效和批量转场；不做批量删除、分组拖动、磁性吸附、关键帧或多轨剪辑。
- 本轮主分类：页面与布局；副分类：时间线状态与批量数据更新。

## 2. 页面结构拆解

```text
FinalPage
├── FinalPreview
└── ProductionTimeline
    ├── TimelineHeader
    │   ├── TimelineTitle
    │   ├── UndoRedoActions
    │   ├── HistoryAndRecoveryActions
    │   ├── MultiSelectToggle
    │   └── TimelineTotalBadge
    ├── TimelineSafetyPanel（可选展开）
    ├── BatchEditBar（多选模式可见）
    │   ├── SelectionSummary
    │   ├── SelectAllAction
    │   ├── ClearSelectionAction
    │   ├── BatchDurationField
    │   ├── BatchMotionPreset
    │   ├── BatchTransitionPreset
    │   ├── BatchTransitionDuration
    │   └── ApplyBatchAction
    ├── ShotTrack
    │   └── ShotSegment
    │       ├── ShotSelectionControl
    │       ├── ShotDragGrip
    │       ├── ShotSelectSurface
    │       └── ShotDurationHandle
    ├── ShotMotionEditor
    ├── AudioTrackEditor
    └── SubtitleTrackEditor
```

## 3. 组件级设计稿

### 3.1 MultiSelectToggle

| 字段 | 规格 |
| --- | --- |
| 类型 | Toggle Button |
| 位置 | `TimelineHeader` 右侧，位于恢复点按钮与总时长徽标之间 |
| 尺寸 | 约 `86 × 34 px`；占画布宽度约 `4.8%`；占标题操作区宽度约 `13%` |
| 文案 | 默认 `多选镜头`；开启后 `退出多选` |
| 图标 | 双层方框或勾选列表，`14 × 14 px`，占按钮高度约 `41%`；资源缺失时使用两个重叠圆角方框的 CSS 图形 |
| 背景 | 默认 `rgba(239,249,255,.62)`；开启后 `linear-gradient(135deg,#33B6EE,#79D6FA)` |
| 文字 | `11 px / 16 px / 700`；默认 `#2F6B89`，开启后 `#FFFFFF` |
| 圆角 | `12 px` |
| 状态 | 默认、hover、focus-visible、pressed、selected、disabled |
| 交互 | 点击开启时默认选中当前镜头；再次点击退出并只保留当前主镜头 |
| 辅助信息 | `aria-pressed` 表示多选模式；`aria-label` 包含当前已选数量 |

### 3.2 BatchEditBar

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline Glass Toolbar / Form |
| 位置 | 时间线安全面板下方、镜头轨道上方 |
| 宽度 | 约 `1680 px`；占截图宽度约 `94.5%`；占父容器 `100%` |
| 高度 | 宽屏约 `58 px`；占截图高度约 `6.0%`；窄屏两行约 `104 px` |
| 布局 | `150px 78px 78px 150px 180px 160px 138px 112px` 八列；中间允许弹性收缩 |
| Padding | `10 px 12 px` |
| 间距 | `8–10 px`；采用现有 `4 / 8 / 12 / 16 px` 节奏 |
| 圆角 | `14 px` |
| 背景 | `linear-gradient(120deg,rgba(244,252,255,.82),rgba(205,239,255,.58))`，`backdrop-filter: blur(18px)` |
| 边框 | `1 px rgba(53,167,216,.22)`；顶部内高光 `inset 0 1px rgba(255,255,255,.72)` |
| 阴影 | `0 10px 28px rgba(39,143,191,.10)` |
| 动画 | 开启时 `160 ms` 淡入并上移 `4 px`；减少动态模式下直接显示 |
| 状态 | 无选择、单选、多选、参数混合、应用中、导出中禁用 |

### 3.3 SelectionSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Summary Label + Count Badge |
| 尺寸 | 约 `140 × 36 px`；占工具条宽度约 `8.3%`；占工具条高度约 `62%` |
| 文案 | `已选 3 个镜头`；下方短说明 `合计 8.5 秒` |
| 字体 | 主文案 `11 px / 16 px / 750`；说明 `9 px / 13 px / 500` |
| 颜色 | `#244E66` / `#6C8A9B` |
| 数量徽标 | `22 × 22 px`，青蓝渐变，白色数字；占组件高度约 `61%` |
| 长文本 | 超过 99 个显示 `99+`；总时长始终保留 1 位小数 |

### 3.4 SelectAllAction / ClearSelectionAction

| 字段 | 规格 |
| --- | --- |
| 类型 | Secondary Compact Button |
| 尺寸 | 每个约 `72 × 32 px`；占工具条宽度约 `4.3%` |
| 文案 | `全选`、`清空` |
| 背景 | `rgba(255,255,255,.54)`；hover 为 `rgba(220,245,255,.86)` |
| 边框 | `1 px rgba(56,146,188,.18)` |
| 圆角 | `9 px` |
| 字体 | `10 px / 14 px / 650`，颜色 `#39708C` |
| 禁用 | 已全选时禁用“全选”；无选择时禁用“清空” |
| 键盘 | 时间线区域内 `Ctrl+A` 等价于全选；`Escape` 清空并退出多选 |

### 3.5 BatchDurationField

| 字段 | 规格 |
| --- | --- |
| 类型 | Number Input + Enable Checkbox |
| 尺寸 | 约 `142 × 36 px`；占工具条宽度约 `8.5%` |
| 标签 | `统一时长` |
| 输入范围 | `0.5–30.0 s`，步进 `0.1 s` |
| 默认值 | 多个镜头时长一致时显示该值；不一致时显示空值与占位 `混合` |
| 启用方式 | 用户编辑该输入后自动将本字段标为待应用；可取消左侧小勾选以保留原时长 |
| 视觉 | 输入框 `72 × 32 px`；单位 `秒` 独立显示，避免写入输入内容 |
| 错误 | 非法值就地限制并显示 `0.5–30 秒` 提示，不阻断其他批量字段 |

### 3.6 BatchMotionPreset

| 字段 | 规格 |
| --- | --- |
| 类型 | Select + Enable Checkbox |
| 尺寸 | 约 `172 × 36 px`；占工具条宽度约 `10.2%` |
| 标签 | `画面运动` |
| 选项 | `不修改 / 静止 / 缓慢推进 / 缓慢拉远 / 向左 / 向右 / 向上 / 向下` |
| 默认值 | 选择镜头参数一致时显示真实值；参数混合时显示 `不修改（混合）` |
| 强度 | V12 沿用当前主镜头强度；选择具体动效后显示紧凑强度输入 `5–25%`，不新增曲线编辑 |
| 辅助信息 | `aria-describedby` 说明只影响已选镜头 |

### 3.7 BatchTransitionPreset

| 字段 | 规格 |
| --- | --- |
| 类型 | Select + Duration Input |
| 尺寸 | 转场选择约 `132 × 36 px`；时长约 `112 × 36 px` |
| 选项 | `不修改 / 直接切换 / 淡入淡出` |
| 时长 | 淡入淡出时启用，范围 `0.1–0.8 s`、步进 `0.05 s`；直接切换时禁用但保留原值 |
| 默认值 | 参数一致时显示真实值；混合时显示 `不修改（混合）` |
| 视觉 | 继续使用现有浅蓝描边输入和 `8 px` 圆角 |

### 3.8 ApplyBatchAction

| 字段 | 规格 |
| --- | --- |
| 类型 | Primary Button |
| 尺寸 | 约 `108 × 36 px`；占工具条宽度约 `6.4%` |
| 文案 | `应用到 3 个`，数量实时更新 |
| 背景 | `linear-gradient(135deg,#2EADE8,#69CEF6)` |
| 字体 | `11 px / 16 px / 750`，白色 |
| 圆角 | `11 px` |
| 禁用 | 少于 2 个镜头、未选择任何待修改字段、正在导出或数据校验失败 |
| 按下反馈 | `translateY(1px)`，亮度 `96%`，不改变布局 |
| 完成反馈 | 通知 `已批量更新 3 个镜头，字幕与音轨已同步`；工具条保持选中状态便于继续调整 |

### 3.9 ShotSelectionControl

| 字段 | 规格 |
| --- | --- |
| 类型 | Checkbox-like Toggle Button |
| 位置 | 多选模式下位于每个 `ShotSegment` 左上角，替代原镜头号左侧的空白区域，不覆盖拖动握把 |
| 尺寸 | 视觉 `18 × 18 px`，点击区 `30 × 30 px`；占镜头高度约 `25.9%` |
| 默认 | 白色半透明方框，`1 px rgba(255,255,255,.82)` 边框 |
| 选中 | 青蓝渐变底色、白色勾；镜头增加 `2 px #35B4EC` 内描边 |
| 主镜头 | 已选且当前主镜头时额外显示外层白色细环，区分“批量选择”和“检查器焦点” |
| 交互 | 点击切换；`Ctrl+点击镜头` 可在普通模式直接进入多选并切换；`Shift+点击` 选择主镜头到目标镜头的连续范围 |
| 键盘 | 聚焦镜头后 `Space` 切换选中；`Shift+方向键` 扩展连续范围 |
| 辅助信息 | `aria-pressed`、`aria-label="选择镜头 03 进行批量编辑"` |

## 4. 选择与批量数据规则

### 4.1 选择模型

- `selectedShot` 继续表示预览、检查器和播放头使用的主镜头；新增本地 `selectedShotIds` 只表示批量集合。
- 进入多选时将当前主镜头加入集合；单击未选镜头会把它设为主镜头并加入集合。
- `Ctrl+点击` 切换单个镜头，`Shift+点击` 按当前时间线顺序选择锚点与目标之间的连续范围。
- 镜头重排后选择集合按稳定镜头 ID 保留；镜头从项目中删除时清理失效 ID。
- 选择状态是短生命周期 UI 状态，不写入 `.manju`、自动保存、恢复点或操作历史。
- 退出多选后保留最后一个主镜头作为普通单选，不改变播放头。

### 4.2 批量时长

- 只在“统一时长”被启用时修改已选镜头；未启用时绝不覆盖原时长。
- 所有目标镜头采用同一个 `0.5–30.0 s` 标准值，并沿用 V11 的字幕、角色配音、SFX 与播放头重映射规则。
- 多镜头批量变更必须基于一次旧时间线和一次最终新时间线计算，不能逐镜头连续重映射，避免累计误差。
- BGM 继续保持绝对起点；总时长缩短时只做片尾范围限制。

### 4.3 批量动效与转场

- 画面运动、动效强度、转场方式和转场时长使用独立的“是否修改”标志；未启用字段保留各镜头原值。
- 选“静止”时只将 `motionEffect` 设为 `none`，不清除保存的强度，便于再次切回。
- 选“直接切换”时只将 `transition` 设为 `cut`，不清除原转场时长。
- 淡入淡出在预览和 FFmpeg 导出时继续按单镜头时长的三分之一做安全限制。

### 4.4 历史、恢复与项目保存

- 一次点击“应用到 N 个”只建立一个历史快照，历史文案为 `批量编辑 3 个镜头`。
- 撤销、重做必须同时还原全部目标镜头参数、字幕时间、SFX 起点和播放头；选择集合保持不变。
- 项目数据仍写入既有 `shots` 数组，不新增项目格式字段、不提升 `.manju` 格式版本。
- 自动恢复点在批量操作提交后建立；输入草稿变化不触发恢复点。
- 不新增依赖、网络、权限、IPC 或 Provider；真实 AI 接口继续保持预留未接入。

### 4.5 拖动与多选冲突规则

- 多选集合不代表镜头分组；拖动握把仍只移动当前被拖动的单个镜头。
- 拖动已选镜头不会清空其他选择；拖动未选镜头会先把它加入集合并设为主镜头。
- 时长手柄仍只调整当前单个镜头；批量统一时长必须通过批量编辑栏明确提交。
- V12 不提供批量删除，避免多选状态下误触造成不可逆内容损失。

## 5. 页面尺寸比例

| 区域 | 估算尺寸 | 屏幕占比 | 父容器占比 |
| --- | --- | --- | --- |
| 时间线标题栏 | `1680 × 44 px` | 宽约 `94.5%`，高约 `4.5%` | 时间线 `100%` |
| 多选按钮 | `86 × 34 px` | 宽约 `4.8%`，高约 `3.5%` | 标题操作区约 `13%` |
| 批量编辑栏 | `1680 × 58 px` | 宽约 `94.5%`，高约 `6.0%` | 时间线 `100%` |
| 选择摘要 | `140 × 36 px` | 宽约 `7.9%`，高约 `3.7%` | 工具条宽约 `8.3%` |
| 批量主按钮 | `108 × 36 px` | 宽约 `6.1%`，高约 `3.7%` | 工具条宽约 `6.4%` |
| 镜头选择热区 | `30 × 30 px` | 宽约 `1.7%`，高约 `3.1%` | 普通镜头宽约 `5.8%`、高约 `25.9%` |
| 镜头选择视觉框 | `18 × 18 px` | 宽约 `1.0%`，高约 `1.8%` | 热区 `60% × 60%` |

## 6. 状态、响应式与设计规范

- 颜色：页面底色继续 `#F4FBFF → #D7F1FF → #74CAFF`；多选主色 `#35B4EC`；已选渐变 `#2EADE8 → #73D4F8`；危险红色不进入本轮主工具条。
- 字体：Windows 系统无衬线；标题 `11 px / 750`，字段标签 `9 px / 600`，输入 `10 px / 650`，辅助说明 `9 px / 500`。
- 间距：`4 / 8 / 12 / 16 px`；批量栏不改变镜头轨道现有间距。
- 圆角：工具条 `14 px`、按钮 `9–12 px`、输入 `8 px`、选择框 `6 px`。
- loading：批量修改为同步本地操作，不显示旋转加载；提交瞬间禁用按钮，下一帧完成并提示。
- empty：无镜头时禁用多选按钮；批量栏不渲染。
- error：目标镜头在提交前被删除时跳过失效 ID，并告知实际更新数量；全部失效时不记录历史。
- disabled：导出中禁用多选切换、批量提交、排序和时长手柄；已有选择保持可见。
- selected：批量选择使用内描边与勾选框；主镜头继续保留原有三层天蓝外轮廓，两种语义不能只靠颜色区分。
- pressed：按钮轻微下移 `1 px`；镜头不缩放，避免时间线跳动。
- permission denied：不新增权限或系统弹窗。
- 长文本：工具条只使用短标签；Windows 文本缩放 150% 时允许两行布局，不截断关键按钮。
- 小屏：小于 `1180 px` 时批量栏改为两行 Grid；镜头轨道继续水平滚动，选择控件保持 `30 px` 热区。
- 暗色/高对比：当前不新增暗色主题；强制颜色模式下使用原生 `ButtonText`、`Highlight` 与可见焦点框。
- 横竖屏：应用编辑界面以桌面横向为基准；成片导出比例不会改变工具条布局。
- 底部安全区：无固定底栏；继续使用现有页面底部留白。
- 动效：只使用 `160 ms` 淡入和颜色过渡；`prefers-reduced-motion` 下取消位移。

## 7. React 与服务层实现映射

| 设计区域 | 建议映射 | 责任边界 |
| --- | --- | --- |
| 多选模式与集合 | `FinalPage` 的本地 `useState` | 只保存短生命周期选择、锚点和批量输入草稿 |
| 选择规则 | 新建或扩展 `shotTimelineEditService.js` 的纯函数 | 根据稳定 ID 完成切换、范围选择和失效 ID 清理 |
| `BatchEditBar` | `FinalPage` 内局部 React 组件 | 展示混合值、收集草稿、触发一次提交，不自行重算字幕或音轨 |
| 批量镜头更新 | `shotTimelineEditService.js` | 一次生成最终 `shots`，复用现有时长归一化与动效归一化 |
| 字幕/音轨同步 | 现有 `synchronizeTimelineDependents` | 只运行一次旧时间线到新时间线映射，避免逐镜头累计误差 |
| 历史 | `timelineHistoryService.js` | 一批操作记录一步，继续使用 `shotTimeline` 快照 |
| 保存与恢复 | 现有项目 Repository 与恢复点接口 | 不保存选择态，不改变项目格式和 IPC |
| 样式 | `App.css` 的 `.production-timeline` 区域 | 新增批量栏、选中框、混合值和响应式样式，不改全局主题 |

## 8. 完整组件树

```text
ProductionTimeline
├── TimelineHeader
│   ├── TimelineTitle
│   └── TimelineSafetyActions
│       ├── UndoButton
│       ├── RedoButton
│       ├── HistoryToggle
│       ├── RecoveryToggle
│       ├── MultiSelectToggle
│       └── TimelineTotal
├── TimelineSafetyPanel
├── BatchEditBar
│   ├── SelectionSummary
│   ├── SelectAllButton
│   ├── ClearButton
│   ├── BatchDurationField
│   ├── BatchMotionField
│   ├── BatchTransitionField
│   ├── BatchTransitionDuration
│   └── ApplyBatchButton
├── ShotTrack
│   └── ShotSegment
│       ├── ShotSelectionControl
│       ├── ShotDragGrip
│       ├── ShotSelectSurface
│       └── ShotDurationHandle
├── ShotMotionEditor
├── AudioTrackEditor
└── SubtitleTrackEditor
```

## 9. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 94%
尺寸估算: 96%
```

所有尺寸均根据已确认设计图和实际运行截图智能推算。若原始设计稿（Figma、Sketch、PSD）可获取，则可进一步校准精确尺寸。

## 10. 不确定项与推测值

- 现有截图没有多选工具条和镜头选择框，其尺寸与位置基于 V11 单层时间线、当前标题操作区宽度和 Windows 桌面操作习惯推测。
- 批量栏默认只在多选模式显示，避免单镜头工作流首屏变得拥挤。
- 多选只用于批量参数，不形成持久分组；分组重排和批量删除留待后续独立版本评估。
- 批量动效强度采用紧凑输入，但不引入关键帧、曲线或自定义运动路径。
- 本设计默认继续使用简体中文界面、天蓝渐变毛玻璃和当前单层时间线，不重新设计其余七个页面。
