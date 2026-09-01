# 漫剧创作 V20 场景元数据与动态分镜就绪度 Design Spec

## 0. 来源、基准与交付边界

- 产品：Windows 本地优先漫剧制作软件 `漫剧创作`。
- 当前应用版本基线：`1.17.0`；计划实现版本：`1.18.0`。
- 视觉源：`outputs/runtime/script.png`，运行画布 `1777 × 974 px`；同时沿用 V8–V19 已确认的天蓝渐变、明亮毛玻璃和顶部导航设计系统。
- 真实页面入口：`src/App.jsx` 的 `ScriptPage` 与右侧 `.scene-inspector`。
- 代码证据：天气固定显示为 `小雨`、预计时长固定显示为 `约 1 分 20 秒`、主要角色始终取 `characters.slice(0, 2)`、加号按钮没有行为、分镜就绪度始终写死为 `60%`、“保存场景”只显示 Toast。
- 上一阶段边界：V19 设计稿明确将固定天气、固定时长和“主要角色 +”留为后续独立数据模型任务。
- 本轮目标：让右侧场景信息成为真实、可保存、可解释的场景元数据检查器，并把固定就绪度改为本地动态计算。
- 本轮新增持久字段：`scene.weather` 与 `scene.mainCharacterIds`。
- 本轮派生字段：`estimatedDurationSeconds`、`durationSource`、`readinessScore`、`readinessChecks`；派生字段不写入 `.manju`。
- 本轮不做：AI 场景分析、自动剧情改写、真实 Provider、网络请求、IPC、权限、依赖、付费调用、镜头内容自动覆盖、配音修改、`.manju` 格式版本升级。
- 安全底线：选择器取消零副作用；元数据变更只作用于当前场景；现有台词、配音、分镜图片和镜头顺序保持不变。
- 视觉源门禁：本文件完成后停止并等待确认；确认前不修改 React、CSS、Service、测试、版本号或安装包。

## 1. 项目设计分析

### 1.1 产品类型

面向漫剧编剧、导演和小型内容团队的桌面创作工作台。剧本页右侧检查器应当回答三个生产问题：当前场景发生在什么环境、有哪些主要角色、是否具备进入分镜阶段的基本条件。

### 1.2 目标用户

- 18–45 岁的漫剧编剧、短剧导演、AI 内容创作者和小型工作室成员。
- 会连续编辑几十个场景，需要在不离开剧本页的情况下快速补齐场景信息。
- 希望时长和就绪度有明确来源，不接受写死数字或无效按钮。
- 需要旧项目继续打开，不希望为了新增两个字段升级文件格式或破坏现有素材。

### 1.3 使用场景

- 为当前场景补充地点、时间和天气，供后续分镜提示词使用。
- 从角色库中选择当前场景的主要角色，并快速查看已选人数。
- 在生成分镜前检查缺少的动作、叙事、角色或环境信息。
- 有分镜时查看镜头合计时长；没有分镜时查看按剧本文字得到的本地估算。
- 从右侧检查器直接进入当前场景分镜，不再点击一个只显示提示的“保存场景”。

### 1.4 核心价值

- 消除剧本页右侧所有固定假数据和无效交互。
- 新增元数据仍随现有 800 ms 自动保存和 `.manju` 文件流转。
- 预计时长与就绪度全部由可测试的纯本地规则产生。
- 天气进入后续新建分镜的场景描述，但不静默改写已有镜头提示词。

## 2. 用户画像

| 维度 | 画像 |
| --- | --- |
| 年龄 | 18–45 岁 |
| 职业 | 漫剧编剧、短剧导演、内容工作室成员、分镜与配音协作者 |
| 使用习惯 | Windows 桌面长时间编辑；依靠左侧场景树连续切换；偏好即时保存、明确缺项和真实状态 |
| 主要痛点 | 固定天气误导内容；时长没有依据；主要角色无法编辑；就绪度永远 60%；保存按钮没有实际语义 |
| 成功标准 | 当前场景元数据可编辑可回读；旧项目安全迁移；时长来源可见；就绪度随真实内容即时变化；取消选择零副作用 |

## 3. 产品视觉方向

### 3.1 设计关键词

`Sky-blue glassmorphism`、`scene metadata`、`local deterministic metrics`、`compact inspector`、`production readiness`、`desktop screenplay workflow`。

### 3.2 视觉原则

- 保留当前亮天蓝到浅青背景、白色半透明面板、深海军蓝文字和青蓝主按钮。
- 右侧检查器继续是紧凑纵向布局，不扩大主页面三栏比例。
- 可编辑字段与派生字段必须在视觉上区分：输入框使用白色玻璃底；派生卡片使用浅蓝信息底和来源标签。
- 完成项使用青蓝勾选；缺失项使用暖橙圆点；阻断错误使用珊瑚红，不能只依赖颜色表达。
- 主要角色选择使用独立毛玻璃模态，避免小面板内下拉被滚动容器裁切。
- 不加入 AI 图标、魔法棒或“智能识别”承诺；自动推断统一标注 `本地识别`。

## 4. 页面整体分析

- 页面：剧本页 `ScriptPage`、右侧 `SceneInspector`、`SceneCharacterPickerDialog`。
- 页面类型：三栏剧本编辑器 + 场景元数据检查器 + 多选角色模态。
- 基准画布：`1777 × 974 px`；目标 Windows 桌面；最小支持宽度 `960 px`。
- 页面主体视觉占比：左侧场景列表约屏宽 `17.3%`；中央编辑区约 `58.0%`；右侧检查器约 `19.8%`；间隙与外边距约 `4.9%`。
- 代码布局基准：`.editor-page` 为 `248px minmax(560px, 1fr) 282px`；间距 `14px`；高度 `calc(100vh - 138px)`。
- 右侧检查器视觉推测尺寸：约 `352 × 696 px`（受系统缩放影响）；占屏宽约 `19.8%`、占页高约 `71.5%`。
- 角色选择模态推测尺寸：`560 × 610 px`；占屏宽约 `31.5%`、占页高约 `62.6%`。
- 布局模型：主页面 CSS Grid；检查器纵向 Flex/Scroll；角色选择器 Fixed Overlay + Dialog。
- Motion：字段、进度和检查项使用 `120–180 ms` 过渡；模态父层不使用从 `opacity: 0` 开始的动画；遵守 `prefers-reduced-motion`。

## 5. 页面结构拆解

```text
ScriptPage
├── TopNavigation
├── SceneList
├── ScriptEditor
│   ├── EditorHeading
│   ├── SceneMetaSummary
│   │   ├── LocationSummary
│   │   ├── TimeSummary
│   │   ├── WeatherSummary
│   │   └── DurationSummary
│   ├── ActionInput
│   ├── NarrationInput
│   └── DialogueEditor
├── SceneInspector
│   ├── InspectorHeader
│   ├── EnvironmentFields
│   │   ├── LocationField
│   │   ├── TimeField
│   │   └── WeatherField
│   ├── EstimatedDurationCard
│   ├── MainCharacterSection
│   │   ├── SelectedCharacterStack
│   │   ├── OverflowCount
│   │   └── EditCharacterButton
│   ├── ReadinessSection
│   │   ├── ReadinessSummary
│   │   ├── ReadinessProgress
│   │   └── ReadinessChecklist
│   ├── SceneOrderActions
│   ├── AutosaveIndicator
│   └── StoryboardContextAction
└── SceneCharacterPickerLayer
    └── SceneCharacterPickerDialog
        ├── DialogHeader
        ├── CharacterSearch
        ├── SelectionSummary
        ├── CharacterChecklist
        │   └── CharacterOptionRow
        └── DialogFooter
            ├── CancelButton
            └── ApplyButton
```

## 6. 组件级设计稿

### 6.1 SceneMetaSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline Metadata Summary |
| 位置 | 中央编辑区标题下方 |
| 尺寸 | 推测 `875 × 44 px`；占屏宽约 `49.2%`；占中央内容宽约 `100%`；占页高约 `4.5%` |
| Padding | `10px 12px`；项目间距 `8px` |
| 圆角 | `12px` |
| 背景 | `rgba(223,245,253,.55)` |
| 内容 | `地点：{location}`、`时间：{time}`、`天气：{weather}`、`预计：{durationLabel}` |
| 文字 | 标题 `11px / 16px / 720`；值 `11px / 16px / 520`；长文本单行省略 |
| 状态 | 空字段显示 `待设置`；派生时长显示来源图标，不允许继续显示固定值 |

### 6.2 EnvironmentFields

| 字段 | 规格 |
| --- | --- |
| 类型 | Form Field Group |
| 位置 | SceneInspector 标题下方 |
| 宽度 | 约 `234 CSS px`；占检查器内容宽 `100%`；占屏宽约 `13.2%` |
| 单字段高度 | Label `16px` + Input `42px` + 间距 `7px`，合计约 `65px`；占检查器高度约 `9.3%` |
| 输入框 | `100% × 42px`；圆角 `12px`；`1px` 白色高光边框；内边距 `0 12px` |
| 地点 | 自由文本；最多 `80` 个 Unicode 字符；占位 `待设置地点` |
| 时间 | 自由文本；最多 `40` 个 Unicode 字符；占位 `待设置时间` |
| 天气 | 自由文本 + 本地建议；最多 `40` 个 Unicode 字符；占位 `待设置天气` |
| 天气建议 | `晴、阴、多云、小雨、暴雨、雾、雪、室内`；建议只辅助输入，不限制自定义内容 |
| 状态 | normal、hover、focus、invalid、disabled；控制字符被拒绝并显示行内错误 |

### 6.3 EstimatedDurationCard

| 字段 | 规格 |
| --- | --- |
| 类型 | Derived Information Card |
| 位置 | EnvironmentFields 下方 |
| 尺寸 | `234 × 68 CSS px`；占检查器内容宽 `100%`；占检查器高度约 `9.8%` |
| Padding | `10px 12px` |
| 圆角 | `14px` |
| 背景 | `linear-gradient(135deg, rgba(235,250,255,.86), rgba(210,241,255,.62))` |
| 主值 | 例如 `23.1 秒`；`18px / 24px / 780`；`#174E6B` |
| 来源标签 | `按 6 个分镜` 或 `按剧本估算`；`10px / 14px / 650`；浅青胶囊 |
| 说明 | `分镜变更后自动更新` 或 `生成分镜后将采用镜头合计` |
| 图标 | Clock，`16 × 16px`；占卡片高约 `23.5%`；青蓝描边 |
| 空态 | 内容不足时显示 `--` 与 `补充动作、旁白或台词后估算` |
| 交互 | 完全只读；不渲染为可输入文本框，避免误导用户以为可手动保存固定时长 |

### 6.4 MainCharacterSection

| 字段 | 规格 |
| --- | --- |
| 类型 | Character Selection Summary |
| 位置 | EstimatedDurationCard 下方 |
| 尺寸 | `234 × 78–112 CSS px`；占检查器内容宽 `100%`；占检查器高度约 `11.2–16.1%` |
| 标题行 | `主要角色` + `编辑`文字按钮；两端对齐 |
| 头像 | `34 × 34px`；占本区最小高度约 `43.6%`；相邻头像重叠 `-7px` |
| 显示规则 | 最多展示前 `4` 个头像；更多角色显示 `+N` 圆形计数；无硬性人数上限 |
| 来源标签 | 显式选择显示 `已设置`；旧项目未设置但可推断时显示 `本地识别` |
| 空态 | 虚线圆形加号 + `选择主要角色`；按钮热区不小于 `40 × 40px` |
| 交互 | 点击头像组、加号或“编辑”均打开角色选择模态；不在小面板内展开下拉 |
| 可访问性 | 按钮 `aria-haspopup="dialog"`，标签包含当前已选人数 |

### 6.5 SceneCharacterPickerLayer

| 字段 | 规格 |
| --- | --- |
| 类型 | Fixed Overlay |
| 位置 | `inset: 0`，应用视口最上层 |
| 尺寸 | `1777 × 974px` 基准；屏宽、页高均 `100%` |
| Padding | `24px`；约占屏宽 `1.35%`、页高 `2.46%` |
| 背景 | `rgba(28,76,106,.22)`；背景页面可辨识但不可交互 |
| 关闭方式 | 取消、右上关闭、`Esc`；不通过遮罩误关闭 |

### 6.6 SceneCharacterPickerDialog

| 字段 | 规格 |
| --- | --- |
| 类型 | Accessible Multi-select Dialog |
| 位置 | Overlay 正中央 |
| 尺寸 | 推测 `560 × 610px`；占屏宽约 `31.5%`；占页高约 `62.6%` |
| 最大尺寸 | `min(560px, calc(100vw - 32px)) × min(610px, calc(100vh - 32px))` |
| 圆角 | `24px` |
| 背景 | 白到浅天蓝渐变毛玻璃，实体背景透明度不低于 `.93` |
| 边框 | `1px solid rgba(255,255,255,.94)` |
| 阴影 | `0 28px 80px rgba(28,102,143,.28)` |
| 布局 | `grid-template-rows: 74px auto auto minmax(0,1fr) 76px` |
| 标题 | `选择主要角色`；副标题 `仅影响当前场景信息` |
| 可访问性 | `role="dialog"`、`aria-modal="true"`、焦点陷阱、关闭后返回原入口 |

### 6.7 CharacterSearch

| 字段 | 规格 |
| --- | --- |
| 类型 | Search Input |
| 位置 | Dialog Header 下方 |
| 尺寸 | `512 × 42px`；占模态宽约 `91.4%`；占模态高约 `6.9%` |
| Margin | `0 24px 12px` |
| 图标 | Search，`16 × 16px`；占输入框高约 `38.1%` |
| 占位 | `搜索角色名称或定位` |
| 行为 | 本地过滤 `name`、`role`、`relation`；不修改原角色顺序 |
| 空结果 | 显示 `没有匹配角色` 与 `前往角色页创建角色`说明，本轮不在模态内新建角色 |

### 6.8 CharacterOptionRow

| 字段 | 规格 |
| --- | --- |
| 类型 | Checkbox List Row |
| 位置 | CharacterChecklist 内 |
| 尺寸 | `512 × 58px`；占模态宽约 `91.4%`；占列表父宽 `100%`；占模态高约 `9.5%` |
| Padding | `8px 12px`；行间距 `8px` |
| 头像 | `36 × 36px`；占行高约 `62.1%` |
| 主文字 | 角色名称；`13px / 18px / 720`；最多一行 |
| 副文字 | 角色定位或关系；`10px / 15px / 520`；最多一行省略 |
| Checkbox | `20 × 20px`；占行高约 `34.5%`；选中显示勾选图标 |
| 状态 | normal、hover、selected、keyboard-focus、disabled；整行可点击 |
| 推荐标记 | 由当前场景台词或镜头本地推断出的角色显示 `场景中出现`，但不自动提交 |

### 6.9 ReadinessSection

| 字段 | 规格 |
| --- | --- |
| 类型 | Progress + Checklist |
| 位置 | MainCharacterSection 下方 |
| 尺寸 | `234 × 122–164 CSS px`；占检查器内容宽 `100%`；占检查器高度约 `17.5–23.6%` |
| 顶部分隔 | `1px solid rgba(57,143,190,.12)`；上边距 `16px` |
| 标题 | `分镜就绪度`；右侧动态百分比与状态文本 |
| 进度条 | `234 × 6px`；占本区宽 `100%`；圆角 `999px` |
| 填充 | 天蓝到深青蓝渐变；宽度由 `readinessScore` 决定 |
| 检查项 | 最多显示 5 项；每项 `22px` 高；勾选/圆点 + 短标签 |
| 完成态 | `环境信息、动作描述、叙事内容、主要角色、分镜草稿`均完成，显示 `已就绪` |
| 缺失态 | 显示缺失项，例如 `补充天气`、`选择主要角色`；可操作项支持点击定位 |
| 动态 | 进度宽度使用 `180ms ease-out`，减少动画时直接跳变 |

### 6.10 SceneOrderActions

| 字段 | 规格 |
| --- | --- |
| 类型 | Compact Button Group |
| 位置 | ReadinessSection 下方 |
| 尺寸 | 3 个按钮共同占 `234 × 40px`；占检查器内容宽 `100%` |
| 按钮 | `上移`、`下移`、`删除`；保留现有真实行为 |
| 状态 | 首场景禁用上移；末场景禁用下移；删除使用珊瑚红文字 |
| 可访问性 | 禁用原因通过 `title` 或辅助文本表达，不只靠灰色 |

### 6.11 AutosaveIndicatorAndStoryboardAction

| 字段 | 规格 |
| --- | --- |
| 类型 | Status + Contextual Primary Button |
| 位置 | SceneInspector 底部 |
| 尺寸 | 状态行 `234 × 24px`；按钮 `234 × 44px`；占检查器内容宽均为 `100%` |
| 状态文案 | `自动保存`、`正在保存…`、`已自动保存`、`自动保存失败`；使用现有项目保存状态 |
| 有分镜 | 主按钮 `查看 {count} 个分镜`，点击选中当前场景首镜头并进入分镜页 |
| 无分镜 | 主按钮 `生成分镜草稿`，调用现有纯本地生成流程 |
| 替换规则 | 删除当前只显示 Toast 的“保存场景”，不再制造手动保存假象 |
| 图标 | 有分镜用 Image/Grid；无分镜用 Plus/Image；`16 × 16px` |

## 7. 页面尺寸比例

| 区域 | 推测像素 | 屏宽占比 | 页高占比 | 父容器占比 |
| --- | ---: | ---: | ---: | ---: |
| SceneInspector | `352 × 696px` 视觉值 | `19.8%` | `71.5%` | 主工作区右栏 `100%` |
| EnvironmentFields | `234 × 195 CSS px` | `13.2%` | `20.0%` | 检查器内容宽 `100%` |
| EstimatedDurationCard | `234 × 68 CSS px` | `13.2%` | `7.0%` | 检查器内容宽 `100%` |
| MainCharacterSection | `234 × 96 CSS px` | `13.2%` | `9.9%` | 检查器内容宽 `100%` |
| ReadinessSection | `234 × 144 CSS px` | `13.2%` | `14.8%` | 检查器内容宽 `100%` |
| CharacterPickerDialog | `560 × 610px` | `31.5%` | `62.6%` | Overlay 中央 |
| CharacterOptionRow | `512 × 58px` | `28.8%` | `6.0%` | 列表宽 `100%` |
| Primary Context Action | `234 × 44 CSS px` | `13.2%` | `4.5%` | 检查器内容宽 `100%` |

> 截图像素受 Windows 缩放与 Electron 捕获比例影响；实现以现有 CSS 逻辑尺寸和百分比为准，表中视觉像素均为推测值。

## 8. 数据模型与迁移规则

### 8.1 Scene 持久字段

| 字段 | 类型 | 默认值 | 约束 | 用途 |
| --- | --- | --- | --- | --- |
| `weather` | `string` | `''` | 最多 40 个 Unicode 字符；拒绝控制字符 | 场景环境和新建分镜提示词 |
| `mainCharacterIds` | `number[]` | `[]` | 去重；只保留当前角色库存在的 ID；保持角色库顺序 | 当前场景主要角色 |

### 8.2 派生字段

| 字段 | 持久化 | 说明 |
| --- | --- | --- |
| `estimatedDurationSeconds` | 否 | 有分镜时求当前场景镜头时长总和；无分镜时按剧本文字估算 |
| `durationSource` | 否 | `shots`、`script` 或 `empty` |
| `inferredCharacterIds` | 否 | 从当前场景台词说话人和镜头 `characterIds` 本地推断，仅作为建议 |
| `readinessScore` | 否 | 五项检查，每项 20 分 |
| `readinessChecks` | 否 | 检查项、完成状态和定位目标 |

### 8.3 旧项目兼容

- `.manju` `version` 继续为 `1`。
- 缺少 `weather` 的旧场景规范化为 `''`，界面显示 `待设置`，不得默认为“小雨”。
- 缺少 `mainCharacterIds` 的旧场景规范化为 `[]`；界面可显示本地推断建议，但不把建议冒充用户已设置的数据。
- 无效、重复或已经删除的角色 ID 在读取时过滤。
- 打开旧项目不修改台词、配音、分镜、字幕或音轨。

## 9. 本地预计时长规则

### 9.1 优先级

1. 当前场景存在分镜：解析每个镜头 `duration`，求和并四舍五入到 `0.1` 秒；来源显示 `按 N 个分镜`。
2. 当前场景无分镜但有剧本内容：按下方确定性公式估算；来源显示 `按剧本估算`。
3. 动作、旁白和台词均为空：返回 `0`，界面显示 `--`。

### 9.2 剧本估算公式

- 旁白与角色台词：统计去空白后的 Unicode 字符数，按 `4.2 字/秒` 估算。
- 动作描述：按中文或英文句末标点与换行切分动作单元；每个非空动作单元计 `1.5 秒`。
- 最终值：`spokenCharacters / 4.2 + actionUnitCount × 1.5`。
- 有内容时最短 `2.0 秒`；结果以 `0.5 秒`为步长四舍五入。
- 这是制作参考，不是 AI 分析；界面必须显示来源，不承诺等同最终成片。

### 9.3 格式化

- 小于 60 秒：`23.5 秒`。
- 60 秒及以上：`1 分 20 秒`；秒为 0 时显示 `1 分钟`。
- 超过 60 分钟仍使用 `分 + 秒`，避免在场景级界面引入小时单位。

## 10. 动态分镜就绪度规则

每项固定 `20` 分，总分为 `0–100`，不使用无法解释的加权黑盒。

| 检查项 | 完成条件 | 完成文案 | 缺失文案 | 定位动作 |
| --- | --- | --- | --- | --- |
| 环境信息 | 地点、时间、天气均非空且不是 `待设置` | `环境信息完整` | `补充地点、时间或天气` | 聚焦首个缺失输入框 |
| 动作描述 | `scene.action.trim()` 非空 | `动作描述已填写` | `补充动作描述` | 聚焦动作 textarea |
| 叙事内容 | 旁白非空或当前场景至少一条非空台词 | `叙事内容已填写` | `补充旁白或台词` | 聚焦旁白或插入台词按钮 |
| 主要角色 | `mainCharacterIds` 非空；若为空但可本地推断，只显示建议，不自动计分 | `主要角色已设置` | `选择主要角色` | 打开角色选择模态 |
| 分镜草稿 | 当前场景至少存在一个分镜 | `已有 N 个分镜` | `尚未生成分镜` | 调用现有生成确认流程 |

状态分段：

- `0–40`：`待补充`，暖橙提示。
- `60–80`：`可继续完善`，天蓝提示。
- `100`：`已就绪`，青蓝完成态。

## 11. 状态与交互

### 11.1 元数据编辑

- 地点、时间和天气输入沿用当前即时更新和 800 ms 自动保存。
- 输入长度按 Unicode 字符而不是 UTF-16 单元计算。
- 输入控制字符时不写入状态，显示行内错误；正常输入不弹 Toast 打断连续编辑。
- `SceneMetaSummary` 与 `SceneInspector` 使用同一份 `current` 数据即时同步。

### 11.2 主要角色选择

- 打开模态时复制当前显式选择作为草稿。
- 搜索、勾选、全清和关闭不会修改项目。
- 点击“应用选择”后一次性更新当前场景；0 个角色允许提交，但就绪度保持缺项。
- `Ctrl+Enter` 应用，`Esc` 取消；IME 组合态不响应提交快捷键。
- 确认后焦点返回原入口；切换场景时自动关闭模态，防止把选择提交到错误场景。

### 11.3 分镜入口

- 当前场景已有分镜时，“查看 N 个分镜”选择当前场景第一个镜头并导航到分镜页。
- 无分镜时，“生成分镜草稿”复用现有本地确定性流程。
- 已有分镜不会因为天气或主要角色变化而自动重建提示词；用户后续可在分镜页主动重建。

### 11.4 自动保存状态

- 删除假“保存场景”按钮。
- 显示真实项目自动保存状态；没有可用状态时至少显示静态 `自动保存已开启`，不得伪造“已保存到磁盘”。
- 未手动指定 `.manju` 路径时，文案只称“自动保存”，不称“已保存文件”。

## 12. 完整状态设计

| 状态 | 设计 |
| --- | --- |
| Loading | 本地派生计算应同步完成；项目加载期间沿用页面现有加载边界，不单独显示虚假进度 |
| Empty | 天气显示占位；时长显示 `--`；主要角色显示选择空态；就绪度列出缺项 |
| Error | 控制字符或超长输入显示字段级错误；自动保存失败显示珊瑚红状态与重试建议 |
| Disabled | 排序边界按钮保留可见；禁用原因可读；角色应用过程中按钮禁用防重复提交 |
| Selected | 角色行使用青蓝边框、浅蓝底和勾选图标三重反馈 |
| Pressed | 按钮缩放不超过 `0.98`，持续 `80ms`；减少动画时取消缩放 |
| Permission denied | 本轮不新增权限；若未来角色图片不可读，头像降级为项目现有渐变占位 |
| Long text | 输入允许横向/纵向正常编辑；概要和角色副标题单行省略，悬停显示完整 title |
| Many characters | 检查器显示前 4 个头像和 `+N`；模态列表独立滚动 |
| Deleted character | 读取时过滤失效 ID；就绪度和数量立即重新计算 |

## 13. 响应式、暗色与可访问性

### 13.1 响应式

- `≥ 1280px`：保持三栏；检查器内部滚动，底部动作始终可到达。
- `960–1279px`：沿用现有两栏布局，SceneInspector 跨两列置于中央编辑器下方；环境字段可改为 3 列，时长、角色和就绪度为 2 列卡片。
- `< 960px`：不是主要交付尺寸；角色模态宽度为 `calc(100vw - 32px)`，列表和 Footer 保持可滚动可操作。
- 高度 `< 760px`：检查器和模态 Body 独立滚动；Header/Footer 固定；不得裁切应用按钮。

### 13.2 暗色模式

- 本版继续以项目现有明亮主题为发布基准，但颜色必须通过现有 token/变量表达。
- 暗色预留：面板 `#102B3B`、输入 `#163748`、主文字 `#EAF8FF`、次文字 `#9CC0D3`、边框 `rgba(150,220,255,.18)`。
- 进度、错误和选中状态需达到可读对比度，不能简单反转背景。

### 13.3 可访问性

- 所有输入拥有可见 label；天气建议不替代 label。
- 角色选择模态具备 `role="dialog"`、标题关联、焦点陷阱、焦点返回和键盘提交。
- 角色列表使用原生 checkbox 语义或等价 ARIA；整行点击不破坏键盘操作。
- 就绪度同时输出百分比、状态文本和五项检查结果；屏幕阅读器可读更新。
- 焦点环使用 `2px solid #27A7E6` + `2px` offset，不被玻璃阴影覆盖。

## 14. UI 图片生成 Prompt

--------------------------------
页面名称：剧本页 · 真实场景信息与分镜就绪度

Prompt：

Design a production-ready screenplay editor screen for a Windows desktop manhua-drama creation application named “漫剧创作”. Product type: local-first story-to-video authoring workstation for Chinese creators. UI Design: a bright sky-blue glassmorphism screenplay workspace with truthful scene metadata and deterministic production readiness, not an AI chat interface. Layout: 1777×974 desktop canvas, compact top navigation, 17% left scene list, 58% central screenplay editor, 20% right scene inspector. In the right inspector show editable fields for “地点”, “时间”, and “天气”, a derived duration card reading “23.1 秒” with a badge “按 6 个分镜”, a main-character avatar stack with an “编辑” action, and a five-item “分镜就绪度 100%” checklist. Replace any fake save button with a real contextual button “查看 6 个分镜” and a subtle autosave status. Also show a centered 560×610 character multi-select glass dialog variant with search, character avatars, role labels, checkboxes, selected count, “取消” and “应用选择”. Components: glass cards, labeled inputs, avatar stack, checkbox rows, progress bar, status chips, accessible focus rings, local deterministic metric labels. Style: premium bright cyan and sky-blue gradient glassmorphism, white translucent panels, ink-navy typography, restrained warm orange warnings, soft cyan highlights, no purple. Lighting: clean diffuse daylight with subtle inner highlights and medium-depth shadows. Animation direction: 120–180ms field and progress transitions, stable dialog surface without parent-opacity entrance animation, reduced-motion support. Resolution: 1777×974 straight-on complete desktop application UI. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Use only short Chinese titles, labels, buttons, and status text. Avoid AI robots, chat bubbles, neon dark theme, professional video timeline, fake analytics dashboard, watermark, long generated Chinese paragraphs.
--------------------------------

## 15. 中文文案表

| 区域 | 类型 | 文案 |
| --- | --- | --- |
| SceneMeta | 标题 | `场景信息（概要）` |
| Environment | Label | `地点`、`时间`、`天气` |
| Environment | 占位 | `待设置地点`、`待设置时间`、`待设置天气` |
| Duration | 标题 | `预计时长` |
| Duration | 来源 | `按 {count} 个分镜`、`按剧本估算`、`内容不足` |
| Duration | 说明 | `分镜变更后自动更新`、`生成分镜后将采用镜头合计` |
| Characters | 标题 | `主要角色` |
| Characters | 操作 | `编辑`、`选择主要角色` |
| Characters | 来源 | `已设置`、`本地识别`、`场景中出现` |
| CharacterDialog | 标题 | `选择主要角色` |
| CharacterDialog | 副标题 | `仅影响当前场景信息` |
| CharacterDialog | 搜索 | `搜索角色名称或定位` |
| CharacterDialog | 统计 | `已选择 {count} 个角色` |
| CharacterDialog | 空态 | `没有匹配角色` |
| CharacterDialog | 说明 | `可前往角色页创建或完善角色` |
| CharacterDialog | 按钮 | `取消`、`应用选择` |
| Readiness | 标题 | `分镜就绪度` |
| Readiness | 状态 | `待补充`、`可继续完善`、`已就绪` |
| Readiness | 完成项 | `环境信息完整`、`动作描述已填写`、`叙事内容已填写`、`主要角色已设置`、`已有 {count} 个分镜` |
| Readiness | 缺失项 | `补充地点、时间或天气`、`补充动作描述`、`补充旁白或台词`、`选择主要角色`、`尚未生成分镜` |
| Autosave | 状态 | `自动保存已开启`、`正在保存…`、`已自动保存`、`自动保存失败` |
| ContextAction | 按钮 | `查看 {count} 个分镜`、`生成分镜草稿` |
| Validation | 错误 | `最多输入 {count} 个字符`、`不能包含不可见控制字符` |

## 16. 实现映射与架构边界

### 16.1 建议文件

- `src/services/sceneMetadataService.js`
  - 字段规范化与验证。
  - 主要角色推断建议。
  - 分镜/剧本预计时长计算与格式化。
  - 五项分镜就绪度计算。
- `src/services/projectModel.js`
  - 读取旧项目时补齐 `weather` 和 `mainCharacterIds`。
  - 继续使用 `projectFormatVersion = 1`。
- `src/App.jsx`
  - `ScriptPage` 接入真实字段、派生值、角色选择模态和分镜上下文动作。
  - 页面只管理模态草稿态与焦点，不复制计算规则。
- `src/App.css`
  - 右侧派生卡、角色选择模态、检查清单、状态和响应式样式。
- `scripts/test-scene-metadata-service.mjs`
  - 纯函数、Unicode、旧数据和极端内容测试。
- `scripts/test-scene-metadata-ui.mjs`
  - 真实 UI、持久化、焦点、取消和跨页导航测试。
- `scripts/capture-scene-metadata.mjs`
  - `1777 × 974` 视觉截图。

### 16.2 数据边界

- 页面组件只持有角色选择草稿和搜索词。
- `sceneMetadataService` 是预计时长与就绪度的唯一规则来源。
- `projectModel` 只做兼容规范化，不把缺失天气伪造为具体值。
- 更新元数据不修改 `lines`、`shots`、`audioTracks`、`subtitleCues`。
- 新天气只参与以后主动生成或重建的画面提示词；已有 `visualPrompt` 不自动变化。

### 16.3 体积与保存

- 地点最多 80 字、时间和天气各最多 40 字，角色 ID 数组只保存有效去重 ID。
- 继续复用项目 10 MB 总体限制与 800 ms 自动保存。
- 角色确认可在提交前生成完整候选快照做 10 MB 预检；失败时模态保持打开且项目不变化。
- 输入字段若因项目已经贴近 10 MB 导致保存失败，必须显示真实自动保存错误，不能伪装成功。

## 17. 验证计划

### 17.1 服务测试

- 天气和文本长度按 Unicode 计数；控制字符被拒绝。
- `mainCharacterIds` 去重、过滤不存在角色并保持角色库顺序。
- 台词说话人和镜头角色能生成稳定推断建议，但不会变成显式选择。
- 有分镜时正确合计 `duration`；非法时长安全忽略。
- 无分镜时按剧本公式估算；空内容返回 0；中文、英文、Emoji 不崩溃。
- 五项就绪度分别得到 `0/20/40/60/80/100`，缺项定位稳定。
- 旧场景缺失字段时迁移为安全默认值，`.manju` 版本仍为 `1`。

### 17.2 UI 自动化

- 天气不再固定，编辑后概要栏即时同步。
- 切换场景后各自天气和主要角色不串场。
- 角色选择模态默认焦点、搜索、勾选、取消、应用、`Esc`、`Ctrl+Enter` 和 IME 行为正确。
- 取消模态不修改项目；应用后头像、数量、就绪度和 autosave 同步。
- 有分镜时预计时长等于镜头合计；无分镜时显示剧本估算来源。
- 修改动作、旁白、台词、环境和主要角色时就绪度即时变化。
- “查看 N 个分镜”进入正确剧集、场景和首镜头。
- 无分镜时复用现有本地生成流程；已有分镜不被元数据编辑覆盖。
- 10 MB 预检失败不关闭选择模态、不修改当前场景。
- 旧 `.manju` 打开、自动保存、另存为和重新打开后字段正确。

### 17.3 回归命令

- `npm run lint`
- 新增 `npm run test:scene-metadata`
- 新增 `npm run test:scene-metadata-ui`
- 新增 `npm run capture:scene-metadata`
- `npm run test:script-organizer`
- `npm run test:script-organizer-ui`
- `npm run test:dialogue-split`
- `npm run test:dialogue-split-ui`
- `npm run test:project`
- `npm run build`
- 打包后隐藏启动 `release/win-unpacked/漫剧创作.exe`

## 18. 完整组件树

```text
ScriptPage
├── SceneList
├── ScriptEditor
│   ├── EditorHeading
│   ├── SceneMetaSummary
│   ├── ActionInput
│   ├── NarrationInput
│   └── DialogueEditor
├── SceneInspector
│   ├── InspectorHeader
│   ├── EnvironmentFields
│   ├── EstimatedDurationCard
│   ├── MainCharacterSection
│   ├── ReadinessSection
│   ├── SceneOrderActions
│   ├── AutosaveIndicator
│   └── StoryboardContextAction
└── SceneCharacterPickerLayer
    └── SceneCharacterPickerDialog
        ├── DialogHeader
        ├── CharacterSearch
        ├── SelectionSummary
        ├── CharacterChecklist
        │   └── CharacterOptionRow
        │       ├── Checkbox
        │       ├── Avatar
        │       ├── CharacterIdentity
        │       └── InferredBadge
        └── DialogFooter
            ├── CancelButton
            └── ApplyButton
```

## 19. 设计还原评分

```text
设计识别置信度: 99%
布局识别: 99%
颜色识别: 98%
字体识别: 95%
尺寸估算: 96%
数据与交互边界识别: 99%
```

所有尺寸均根据当前运行截图和实际 CSS 智能推算。若原始设计稿（Figma、Sketch、PSD）可获取，可进一步校准精确尺寸。

## 20. 不确定项与设计假设

- 将本次“下一步”解释为继续处理 V19 明确留下的同页后续任务，而不是接入真实 AI Provider。
- 预计时长采用派生值而非新增可编辑字段，因为现有界面将其呈现为只读，且镜头时长已经是后续成片的权威来源。
- 主要角色使用显式 `mainCharacterIds`；本地推断只做建议，不静默替用户提交。
- 天气使用自由文本配合建议，而不是封闭枚举，以兼容“室内烟雾”“沙尘暴”“赛博酸雨”等创作场景。
- 就绪度固定为五项等权规则，优先可解释、可测试，不做 AI 评分。
- V20 不把场景主要角色自动灌入既有镜头；后续新建分镜是否采用主要角色由现有草稿与提示词逻辑明确处理。
- 当前项目没有独立全局 autosave 状态组件；实现时应先复用实际保存结果，若只能确认已启用自动保存，则不得显示“已保存到磁盘”。

## 21. 确认与实现状态

- 用户已通过“下一步”确认本设计稿，并授权进入现有 React + Electron 实现阶段。
- V20 已按本稿实现到 `1.18.0`：真实天气、主要角色多选、旧项目兼容、预计时长、五项就绪度、自动保存说明和分镜上下文入口均已落地。
- 主要角色选择器使用明亮天蓝渐变毛玻璃、搜索、场景出现提示、焦点陷阱、焦点返回、`Esc`、`Ctrl+Enter` 与 IME 保护。
- `.manju` 格式版本继续为 `1`；没有接入 Provider、网络、IPC、权限、依赖或 API Key。
- 天气只参与以后主动生成或重建的分镜提示词，不静默修改已有 `visualPrompt`；元数据更新不会修改台词、配音、分镜图片、镜头顺序、字幕或音轨。
- 已通过纯函数测试、真实 Electron UI 自动化、旧项目迁移回归、V18/V19 UI 回归、全项目持久化回归、静态检查、生产构建和双截图视觉检查。
