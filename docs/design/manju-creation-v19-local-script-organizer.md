# 漫剧创作 V19 本地剧本整理与体检 Design Spec

## 0. 来源、基准与交付边界

- 产品：Windows 本地优先漫剧制作软件 `漫剧创作`。
- 当前应用版本基线：`1.16.0`；计划实现版本：`1.17.0`。
- 视觉源：`outputs/runtime/script.png`，运行画布 `1777 × 974 px`；同时沿用已确认的 V7/V8 天蓝渐变毛玻璃设计系统与 V18 模态工作台。
- 真实代码入口：`src/App.jsx` 的 `ScriptPage`；当前“整理剧本”按钮调用 `onMock('script', ...)`，只显示成功提示，不修改任何剧本数据。
- 数据源：当前场景 `scenes.action`、`scenes.narration` 与当前 `episodeId + sceneId` 下的 `lines`。
- 本轮目标：把 Mock 假入口改为完全本地、确定性、可预览、可逐项排除的“剧本整理与体检”工具。
- 本轮不做：AI 改写、剧情扩写、角色口吻润色、场景重写、自动新增角色、自动重建或删除分镜、Provider 接入、IPC 扩展、网络请求、付费调用、密钥读取、`.manju` 格式升级。
- 安全底线：打开模态、切换规则、取消或关闭都不得修改项目；只有确认应用后才更新当前场景与当前场景台词。
- 视觉源门禁：本文件完成后等待确认；确认前不修改 React、CSS、Service、测试、版本号或安装包。

## 1. 项目设计分析

### 1.1 产品类型

面向漫剧编剧、导演和小型制作团队的桌面创作工作台。剧本页是动作、旁白、台词进入分镜与配音链路前的结构化编辑中心，因此“整理”必须是可解释的数据处理，不能用成功 Toast 冒充真实结果。

### 1.2 目标用户

- 18–45 岁的漫剧编剧、短剧导演、AI 内容创作者、配音与剪辑协作者。
- 经常从 Word、聊天软件、网页或旧剧本文档中复制文字，容易带入制表符、异常换行、首尾空白和不可见控制字符。
- 需要快速发现空场景、空台词、重复台词和缺少标点，但不接受软件擅自重写剧情或覆盖已有配音、分镜。

### 1.3 使用场景

- 在生成分镜草稿前，快速清理当前场景动作、旁白和台词的格式问题。
- 检查空动作、空旁白、空台词、重复台词、超长台词和待设置的地点/时间。
- 预览“整理前 / 整理后”差异，逐项决定是否应用。
- 当前台词已有音频时，明确知道哪些变更会使配音失效。
- 当前场景已有分镜时，保留分镜并提示用户稍后决定是否重新生成，而不是静默覆盖。

### 1.4 核心价值

- 将“整理剧本”从本地 Mock 变为真实、可验证的生产工具。
- 只做确定性格式整理和质量诊断，不假装拥有 AI 语义能力。
- 先预览再提交，所有实际变化都可逐项排除。
- 继续复用现有 `scenes` 与 `lines`，保持剧本页、配音页和自动保存单一数据源。

## 2. 用户画像

| 维度 | 画像 |
| --- | --- |
| 年龄 | 18–45 岁 |
| 职业 | 漫剧编剧、短剧导演、内容工作室成员、配音与剪辑协作者 |
| 使用习惯 | Windows 桌面长时间编辑；重度复制粘贴；偏好批量工具、差异预览、快捷键和明确影响提示 |
| 主要痛点 | 不可见脏字符难发现；格式不统一；重复台词漏删；一键整理可能误改剧情或使音频失效 |
| 成功标准 | 1 秒内完成常规场景分析；每项变化可见可选；取消零副作用；提交后配音与自动保存状态正确 |

## 3. 产品视觉方向

### 3.1 设计关键词

`Sky-blue glassmorphism`、`local-first quality check`、`deterministic cleanup`、`before-after diff`、`safe bulk apply`、`desktop script workstation`。

### 3.2 视觉原则

- 延续项目现有天蓝到浅青渐变、明亮毛玻璃、深海军蓝文字和青蓝焦点光晕。
- 使用居中的工作台式模态，不离开当前剧本页；背景三栏结构仍可辨识但不可操作。
- 左栏回答“整理什么”：范围、规则、体检结果；右栏回答“会改什么”：差异预览与逐项选择。
- 自动可修复项使用青蓝状态；仅提醒、不自动修改的问题使用暖橙；阻断错误使用珊瑚红。
- 不用机器人、魔法棒或“AI 优化”话术；页首明确显示 `仅本机规则`。
- 不依赖大面积模糊或父级透明度入场动画，避免 Electron 隐藏窗口/离屏渲染冻结初始帧。

## 4. 页面整体分析

- 页面：剧本页 `ScriptPage` + `ScriptOrganizerModal`。
- 页面类型：三栏剧本编辑器上的本地质量检查与批量差异确认模态。
- 基准画布：`1777 × 974 px`；目标 Windows 桌面；最小支持宽度 `960 px`。
- 背景布局：场景列表约屏宽 `17.3%`；中央编辑区约 `58.0%`；右侧检查器约 `19.8%`；其余为间隙。
- 模态层：`100% × 100%` 视口固定覆盖；不改变背景滚动位置。
- 模态面板推测尺寸：`1220 × 748 px`；占屏宽约 `68.7%`；占页高约 `76.8%`。
- 面板行结构：Header `76 px / 10.2%`，Body `590 px / 78.9%`，Footer `82 px / 11.0%`。
- Body 列结构：规则/体检栏 `392 px / 32.1%`，差异预览栏 `828 px / 67.9%`。
- 布局模型：Fixed Overlay + Dialog Grid；Body 两栏独立滚动；Header 与 Footer 固定。
- Motion：状态卡和行级内容允许 `120 ms` 颜色/边框过渡；模态父层不使用 `opacity: 0` 起始动画；遵守 `prefers-reduced-motion`。

## 5. 页面结构拆解

```text
ScriptPage
├── TopNavigation
├── SceneList
├── ScriptEditor
│   ├── EditorHeading
│   │   ├── SceneTitle
│   │   ├── SplitDialogueTrigger
│   │   ├── OrganizeScriptTrigger
│   │   └── GenerateStoryboardDraft
│   ├── SceneMeta
│   ├── ActionInput
│   ├── NarrationInput
│   └── DialogueEditor
├── SceneInspector
└── ScriptOrganizerLayer
    └── ScriptOrganizerModal
        ├── ModalHeader
        │   ├── TitleGroup
        │   ├── LocalRuleBadge
        │   └── CloseButton
        ├── ModalBody
        │   ├── OrganizerControlPane
        │   │   ├── ScopeSelector
        │   │   ├── RuleList
        │   │   ├── QualitySummary
        │   │   └── DiagnosticList
        │   └── OrganizerPreviewPane
        │       ├── PreviewSummary
        │       ├── PreviewFilters
        │       ├── ChangeList
        │       │   └── ChangeCard
        │       │       ├── IncludeToggle
        │       │       ├── FieldBadge
        │       │       ├── BeforeText
        │       │       ├── AfterText
        │       │       └── ImpactBadge
        │       └── PreviewEmptyOrError
        └── ModalFooter
            ├── ImpactSummary
            ├── CancelButton
            └── ApplyButton
```

## 6. 组件级设计稿

### 6.1 OrganizeScriptTrigger

| 字段 | 规格 |
| --- | --- |
| 类型 | Secondary Button |
| 位置 | 中央编辑区标题右侧，位于“拆分台词”和“生成分镜草稿”之间 |
| 尺寸 | 推测 `134 × 48 px`；占屏宽约 `7.5%`；占标题操作组宽约 `29%`；占页高约 `4.9%` |
| Padding | `0 16 px`；图标与文字间距 `7 px` |
| 圆角 | `14 px` |
| 背景 | `rgba(255,255,255,.62)` 毛玻璃 |
| 边框 | `1 px solid rgba(255,255,255,.86)` |
| 图标 | Settings/Checklist，`16 × 16 px`；占按钮高度约 `33%`；青蓝描边 |
| 文字 | `整理剧本`；`13 px / 18 px / 720`；`#257DA9` |
| 交互 | 点击打开真实本地整理模态；移除 Mock busy 与伪成功 Toast |
| 辅助信息 | `aria-haspopup="dialog"`；`aria-controls="script-organizer-modal"` |

### 6.2 ScriptOrganizerLayer

| 字段 | 规格 |
| --- | --- |
| 类型 | Fixed Overlay |
| 位置 | `inset: 0`，应用视口最上层 |
| 尺寸 | 基准 `1777 × 974 px`；屏宽与页高均 `100%` |
| Padding | `24 px`，约占屏宽 `1.35%`、页高 `2.46%` |
| 背景 | `rgba(31,77,105,.24)`；保持背景可辨识 |
| 层级 | 高于 TopNavigation、页面 Toast 和表单；低于系统文件对话框 |
| 关闭 | 不允许点击遮罩关闭；仅关闭按钮、取消或 `Esc`，避免误丢选择 |

### 6.3 ScriptOrganizerModal

| 字段 | 规格 |
| --- | --- |
| 类型 | Accessible Dialog / Glass Workbench |
| 位置 | Overlay 正中央 |
| 宽度 | 推测 `1220 px`；占屏宽约 `68.7%`；最大 `calc(100vw - 48px)` |
| 高度 | 推测 `748 px`；占页高约 `76.8%`；最大 `calc(100vh - 48px)` |
| 圆角 | `24 px` |
| 背景 | 左上白 `rgba(251,255,255,.97)` 到右下浅天蓝 `rgba(220,246,255,.92)` 渐变 |
| 边框 | `1 px solid rgba(255,255,255,.94)` |
| 阴影 | `0 30px 90px rgba(24,99,142,.28)` + 顶部内高光 |
| 布局 | `grid-template-rows: 76px minmax(0,1fr) 82px` |
| 状态 | initial、analyzing、ready、no-change、warning、size-error、applying |
| 可访问性 | `role="dialog"`、`aria-modal="true"`、标题关联、焦点陷阱 |

### 6.4 ModalHeader

| 字段 | 规格 |
| --- | --- |
| 类型 | Header |
| 尺寸 | `1220 × 76 px`；占模态宽 `100%`；占模态高约 `10.2%` |
| Padding | 左右 `24/20 px`，上下 `14 px` |
| 标题 | `本地整理剧本`；`22 px / 30 px / 760`；`#173F58` |
| 副标题 | `按确定性规则检查格式，确认前不会修改项目`；`11 px / 16 px / 500` |
| Badge | 锁图标 + `仅本机规则`；约 `96 × 30 px`；浅青玻璃胶囊 |
| Close | `36 × 36 px`；图标 `16 px`；点击热区不小于 `36 px` |

### 6.5 ScopeSelector

| 字段 | 规格 |
| --- | --- |
| 类型 | Checkbox Card Group |
| 位置 | 左栏顶部 |
| 宽度 | `344 px`；占左栏内容宽约 `100%`；占模态宽约 `28.2%` |
| 高度 | 推测 `116 px`；占 Body 高约 `19.7%` |
| 标题 | `整理范围` |
| 选项 | `动作描述`、`旁白`、`角色台词（{count}）`；默认全选 |
| 交互 | 至少保留一项；切换后立即重新分析，不修改项目 |
| 状态 | 含音频的台词范围显示麦克风小标记，不依赖颜色 |

### 6.6 RuleList

| 字段 | 规格 |
| --- | --- |
| 类型 | Toggle List |
| 位置 | ScopeSelector 下方 |
| 宽度 | `344 px`；占左栏内容宽 `100%` |
| 单行高度 | `48–58 px`；约占 Body 高 `8.1–9.8%` |
| 默认开启 | `移除不可见控制字符`、`统一换行与制表符`、`清理首尾和重复空白`、`合并连续空行` |
| 默认关闭 | `补齐中文句末标点` |
| 每行结构 | Toggle + 标题 + 一行影响说明；右侧显示预计变更数 |
| Disabled | 对当前选择范围无影响时保留可见但弱化，并显示 `0 项` |
| 风险提示 | 标点规则使用暖橙 `可选` 标签，明确“不会改写词句” |

### 6.7 QualitySummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Compact Metric Card |
| 位置 | RuleList 下方 |
| 尺寸 | `344 × 86 px`；占左栏内容宽 `100%`；占 Body 高约 `14.6%` |
| 内容 | `可整理 {changeCount} 项`、`仅提醒 {warningCount} 项`、`影响配音 {audioCount} 条` |
| 视觉 | 三列小指标；青蓝、暖橙、紫蓝图标；数字使用 tabular nums |
| 动态 | 使用 `aria-live="polite"`，规则切换时不造成布局跳动 |

### 6.8 DiagnosticList

| 字段 | 规格 |
| --- | --- |
| 类型 | Quality Warning List |
| 位置 | 左栏底部，可独立滚动 |
| 宽度 | `344 px`；占左栏内容宽 `100%` |
| 项目 | 空动作、空旁白、空台词、重复台词、超过 500 字台词、地点/时间为 `待设置`、已有分镜可能需要复核 |
| 行高 | `38–52 px`；长文案最多两行，超出显示省略并保留 `title` |
| 交互 | 仅报告，不自动删除重复台词，不自动填写场景元数据 |
| 空态 | 勾选圆标 + `未发现额外问题` |

### 6.9 PreviewSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Sticky Section Header |
| 位置 | 右栏顶部 |
| 尺寸 | 推测 `780 × 62 px`；占右栏内容宽 `100%`；占 Body 高约 `10.5%` |
| 标题 | `变更预览` |
| 摘要 | `选中 {selectedCount}/{changeCount} 项 · 配音影响 {audioCount} 条` |
| 筛选 | `全部`、`动作`、`旁白`、`台词` 四个胶囊；默认 `全部` |
| 行为 | Header 固定，ChangeList 独立滚动 |

### 6.10 ChangeCard

| 字段 | 规格 |
| --- | --- |
| 类型 | Selectable Before/After Diff Card |
| 位置 | 右栏 ChangeList |
| 宽度 | 推测 `780 px`；占右栏内容宽 `100%`；占模态宽约 `63.9%` |
| 高度 | 最小 `112 px`，随文本增长；约占 Body 高至少 `19%` |
| 圆角 | `14 px` |
| 背景 | `rgba(255,255,255,.72)`；选中为浅天蓝；排除后弱化 |
| 顶行 | IncludeToggle `28 × 28 px` + 字段 Badge + 变化原因 + 影响 Badge |
| Before | 红灰 `原文` 标签；删除内容使用浅珊瑚底，不使用危险红大色块 |
| After | 青蓝 `整理后` 标签；新增/保留内容使用浅青底 |
| 文本 | `12–13 px / 19 px / 520`；保留换行；最长先展示 6 行，可展开全文 |
| 台词标识 | `角色名 · 第 N 条`；不以数组下标作为 React key，使用原 line ID |
| 音频影响 | 若选择后会重置音频，显示麦克风图标 + `配音将失效` 暖橙标签 |
| 交互 | 点击复选框包含/排除；Before/After 文本不可直接编辑，避免预览再制造第三份草稿 |

### 6.11 PreviewEmptyOrError

| 状态 | 视觉与文案 |
| --- | --- |
| no-change | 文档勾选图标；`当前范围无需整理`；提示可查看左侧体检结果 |
| all-excluded | 淡灰列表；`所有变更均已排除`；应用按钮禁用 |
| analyzing | 仅首次打开显示短骨架，不使用旋转 AI 图标；通常纯本地计算应在一帧内完成 |
| source-too-large | 珊瑚边框；`当前场景文本过大，无法安全整理，请先分段处理。` |
| size-error | Footer 与右栏同时提示完整项目超过 10 MB；保留全部选择 |

### 6.12 ModalFooter

| 字段 | 规格 |
| --- | --- |
| 类型 | Fixed Footer |
| 尺寸 | `1220 × 82 px`；占模态高约 `11.0%` |
| Padding | `16 px 24 px` |
| 背景 | `rgba(242,252,255,.88)`；顶部分割线 `1 px` |
| 影响摘要 | `将应用 {count} 项；{audioCount} 条配音会重置；现有 {shotCount} 个分镜保持不变` |
| Cancel | `取消`，`96 × 42 px`，白色毛玻璃 |
| Apply | `应用 {count} 项整理`，最小 `164 × 44 px`，天蓝渐变 |
| Warning | 有音频影响时按钮保留天蓝，旁边显示暖橙麦克风提示；不把整理误呈现为删除 |
| Disabled | 无选中变化、分析失败、项目超限或提交中 |
| 快捷键 | `Ctrl+Enter` 应用；IME 组合态不触发；`Esc` 取消 |

## 7. 本地整理规则

### 7.1 默认安全规则

1. **移除不可见控制字符**
   - 删除 `U+0000–U+001F` 与 `U+007F–U+009F` 中除换行、回车、Tab 外的控制字符。
   - 不删除 Emoji、中文标点、少数民族文字、零宽连接符构成的合法 Emoji 序列。
2. **统一换行与制表符**
   - `CRLF`、单独 `CR` 统一为 `LF`。
   - Tab 转为一个普通空格；不生成 HTML 或 Markdown。
3. **清理首尾和重复空白**
   - 每行去除首尾空格。
   - 连续两个及以上普通空格或全角空格折叠为一个普通空格。
   - 不修改换行数量，后续由“合并连续空行”单独控制。
4. **合并连续空行**
   - 三行及以上连续空行压缩为一行空行。
   - 段落之间仍保留一个空行，不把所有内容合成一段。

### 7.2 可选标点规则

- 默认关闭，必须由用户主动开启。
- 仅当非空动作段、旁白段或台词末尾不存在 `。！？!?…；;：:` 等终止标点时追加 `。`。
- 不替换词语，不改写句式，不转换引号，不拆句，不合并句子。
- 对 URL、文件路径、纯数字、只有表情或明显舞台标记的内容只报告，不自动补标点。
- 预览必须逐项显示，用户可排除任何一项。

### 7.3 仅诊断、不自动修改

- 动作描述为空。
- 旁白为空：只标为信息级，不视为必须填写。
- 台词为空或只有空白。
- 同一当前场景中 `speaker + trim(text)` 完全相同的重复台词。
- 单条台词超过 `500` Unicode 字符。
- 地点或时间为空、或等于 `待设置`。
- 当前场景已有分镜：提示整理后分镜不会自动重建。
- 当前选中台词包含真实或演示音频：显示可能重置的数量。

### 7.4 明确禁止的“整理”行为

- 不扩写或缩写剧情。
- 不改变人物关系、说话人、情绪或台词顺序。
- 不新增、删除、合并或拆分台词记录。
- 不猜测地点、时间、天气、时长或主要角色。
- 不自动删除重复台词；只报告。
- 不调用 `providerRegistry`、`MockProviderAdapter` 或任何网络服务。
- 不读取工作区 `key.txt` 或 API Key。

## 8. 分析与提交流程

### 8.1 打开与分析

```text
点击“整理剧本”
  -> 打开 ScriptOrganizerModal
  -> 默认勾选动作、旁白、台词
  -> 默认开启四项安全规则，标点规则关闭
  -> 纯函数同步/微任务分析当前场景
  -> 生成变化候选 + 诊断项 + 影响统计
  -> 不修改 scenes / lines / shots / audio / autosave
```

### 8.2 预览选择

- 每一个实际字段变化生成稳定的 Change Item。
- 动作与旁白按字段生成变化项；台词按原 `line.id` 每条生成变化项。
- 用户可以排除任意变化项；规则、范围或选中状态变化后重新计算统计。
- 未选择的变化不进入候选提交，也不影响音频状态。
- 诊断项不进入提交，不提供伪“修复”按钮。

### 8.3 提交数据语义

- 只更新当前场景的 `action` 与 `narration` 选中变化。
- 只更新当前 `episodeId + sceneId` 下被选中的台词文本；其他剧集、场景和台词不变。
- 台词文本只要发生实际字符串变化，就按现有安全语义设置：
  - `status = 未配音`
  - `duration = 0.0s`
  - `audioStatus = 未生成`
  - `audio = ''`
  - `audioSource = ''`
  - `audioFileName = ''`
  - `audioError = '台词内容已整理，请重新生成或替换音频'`
  - `audioAttempt = 0`
  - `audioUpdatedAt = ''`
- 动作或旁白变化不自动修改、删除或重建 `shots`；Footer 显示现有分镜数量并提示稍后人工复核。
- 不改变角色、情绪、variant、台词 ID、顺序、场景 ID、剧集 ID、字幕或音轨。
- 更新后沿用现有 800 ms 自动保存；配音页继续读取同一份 `lines`。

### 8.4 10 MB 候选项目预检

- 应用前以完整 `projectSnapshot` 替换候选 `scenes + lines`，复用现有 UTF-8 字节计算和 `maximumProjectBytes`。
- 候选超过 `10 MB` 时不得修改 `scenes`、`lines`、配音、分镜或自动保存；模态保持打开。
- 错误文案：`整理后项目将超过 10 MB，请先移除部分图片或音频。`

### 8.5 高影响确认

- 若选择项会重置一条及以上已有音频，点击应用后再确认一次：
  - `本次整理会重置 {audioCount} 条台词的配音状态，是否继续？`
- 若只有动作/旁白或无音频台词变化，不额外确认。
- 现有分镜只提示、不二次确认，因为提交不会修改分镜。

### 8.6 取消与焦点

- 取消、关闭按钮或 `Esc` 清理临时规则、预览与筛选，不修改项目。
- 遮罩点击不关闭。
- 关闭后焦点返回“整理剧本”按钮。
- 页面卸载时不允许异步分析继续回写。

## 9. 状态与异常

| 状态 | 视觉与行为 |
| --- | --- |
| initial | 首次打开立即分析，规则与范围使用默认值 |
| ready | 显示可应用变化、诊断和影响统计 |
| no-change | 右栏勾选空态，应用按钮禁用；诊断仍可查看 |
| warnings-only | 无可改项但有质量提醒；应用禁用，不显示伪成功 |
| optional-punctuation | 暖橙可选标签；开启后新增对应差异卡 |
| audio-impact | 行级与 Footer 同时显示配音影响；应用需确认 |
| shots-present | Footer 显示“现有 N 个分镜保持不变” |
| excluded | ChangeCard 弱化，仍可重新勾选 |
| all-excluded | 应用禁用，摘要显示 `选中 0/N 项` |
| source-too-large | 阻断分析并建议分段处理，不截断原文 |
| size-error | Footer 珊瑚错误，项目数据不变，保留选择 |
| applying | 按钮显示 `应用中…`，防重复提交 |
| success | 关闭模态；Toast：`已完成本地整理：更新 {count} 项` |
| cancel | scenes、lines、audio、shots 与 autosave 均无变化 |
| permission-denied | 不适用：本功能不请求文件、麦克风、网络或系统权限；不得出现伪权限弹窗 |

## 10. 响应式、长文本与可访问性

- `≥ 1280 px`：Body 使用 `32% / 68%` 双栏。
- `960–1279 px`：面板宽 `calc(100vw - 32px)`；Body 使用 `36% / 64%`；Footer 允许两行。
- `< 960 px`：Body 改为上下布局；规则栏最小 `330 px`，预览栏最小 `380 px`；面板内部纵向滚动。
- `< 720 px`：非主要交付目标；筛选胶囊可横向滚动，Footer 按钮保持可见，不隐藏影响摘要。
- 横屏桌面为主要方向；竖向窄窗口或旋转显示器按 `< 960 px` 上下布局处理，不丢失差异和 Footer。
- 底部安全区：模态与视口底部至少保持 `24 px`；Windows 任务栏或高缩放下由 `max-height: calc(100vh - 48px)` 兜底。
- 长动作/旁白：差异文本最多预览 6 行，提供 `展开全文 / 收起`；不可横向撑开。
- 长台词：角色名和文本分别省略；完整文本可展开，复制仍保留原字符。
- 长诊断：两行省略并使用 `title`；错误信息不能只显示 Tooltip。
- 键盘：打开后焦点进入第一个范围复选框；Tab/Shift+Tab 在模态内循环；`Esc` 取消；`Ctrl+Enter` 应用。
- IME：`compositionstart` 到 `compositionend` 期间不触发快捷提交。
- 屏幕阅读器：摘要使用 `aria-live="polite"`；阻断错误使用 `role="alert"`；Before/After 有明确可读标签。
- 高对比：状态通过图标、文字、边框和颜色共同表达。
- 暗色模式：当前不新增全局暗色主题；强制颜色模式保留原生表单边框和焦点轮廓。
- Windows 缩放：125%/150% 时不使用固定视口高度裁切 Footer；Body 保持 `minmax(0,1fr)`。

## 11. Design System

### 11.1 Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `organizer-surface` | `rgba(251,255,255,.97)` | 模态主表面 |
| `organizer-surface-blue` | `rgba(220,246,255,.92)` | 渐变终点 |
| `organizer-backdrop` | `rgba(31,77,105,.24)` | 背景遮罩 |
| `primary-gradient` | `linear-gradient(135deg,#8AD9FF,#43B9F8 52%,#188EDB)` | 应用按钮 |
| `ink-primary` | `#173F58` | 标题与主要文本 |
| `ink-secondary` | `#66879A` | 说明与原文标签 |
| `focus-cyan` | `#149EE2` | 聚焦边框与选中态 |
| `success` | `#168FCB` | 可安全整理项 |
| `warning` | `#B86B24` | 标点可选、音频与分镜提醒 |
| `error` | `#B85243` | 阻断错误与超限 |
| `diff-remove` | `rgba(239,132,118,.12)` | 原文删除/变化背景 |
| `diff-add` | `rgba(86,191,235,.14)` | 整理后背景 |

### 11.2 Typography

- 字体：现有 Windows 中文系统字体栈，不新增字体依赖。
- 模态标题：`22 / 30 / 760`。
- 栏标题：`14 / 20 / 740`。
- 表单与差异正文：`12–13 / 19–20 / 500–650`。
- 辅助与 Badge：`10–11 / 16 / 550–700`。
- 计数使用 tabular nums，避免规则切换时宽度跳动。

### 11.3 Component System

- Button：主操作天蓝渐变；取消为白色毛玻璃；危险影响用旁侧暖橙提示，不把主按钮染成删除红。
- Card：规则卡、体检卡、ChangeCard 使用 `14–16 px` 圆角、浅玻璃底和状态边线。
- Avatar：本模态不展示头像；角色通过文本 Badge 表达，避免预览密度过高。
- Navigation：背景顶部导航保持可见但被遮罩且不可交互。
- Modal：`24 px` 圆角，Header/Footer 固定，Body 双栏独立滚动，无父级透明度初始帧。
- List：最多按当前场景台词数生成差异项；使用稳定 ID，不以索引作为 key。
- Feed：不适用社交 Feed；以规则列表、诊断列表和差异列表替代。
- Input：范围复选框与规则 Toggle 至少 `36 px` 点击热区；青蓝 `focus-visible`。
- Badge：字段、规则原因、配音影响和仅本机状态使用图标 + 短文字。

## 12. 中文文案表

| 区域 | 文案 |
| --- | --- |
| 入口 | `整理剧本` |
| 模态标题 | `本地整理剧本` |
| 副标题 | `按确定性规则检查格式，确认前不会修改项目` |
| 本地 Badge | `仅本机规则` |
| 范围标题 | `整理范围` |
| 范围项 | `动作描述`、`旁白`、`角色台词（{count}）` |
| 规则标题 | `整理规则` |
| 规则 1 | `移除不可见控制字符` |
| 规则 2 | `统一换行与制表符` |
| 规则 3 | `清理首尾和重复空白` |
| 规则 4 | `合并连续空行` |
| 规则 5 | `补齐中文句末标点` |
| 标点说明 | `仅补末尾标点，不改写词句` |
| 体检标题 | `剧本体检` |
| 指标 | `可整理 {count} 项`、`仅提醒 {count} 项`、`影响配音 {count} 条` |
| 预览标题 | `变更预览` |
| 筛选 | `全部`、`动作`、`旁白`、`台词` |
| 差异标签 | `原文`、`整理后` |
| 影响标签 | `配音将失效`、`分镜保持不变` |
| 无变化 | `当前范围无需整理` |
| 无变化说明 | `可继续查看左侧剧本体检结果。` |
| 全排除 | `所有变更均已排除` |
| 空动作 | `动作描述为空，生成分镜草稿时内容可能不足。` |
| 空旁白 | `当前场景没有旁白；若非必要可忽略。` |
| 重复台词 | `发现 {count} 条重复台词；不会自动删除。` |
| 待设元数据 | `地点或时间仍为“待设置”。` |
| 分镜提醒 | `当前场景已有 {count} 个分镜；整理后不会自动重建。` |
| 体积超限 | `整理后项目将超过 10 MB，请先移除部分图片或音频。` |
| 音频确认 | `本次整理会重置 {count} 条台词的配音状态，是否继续？` |
| Footer 影响 | `将应用 {count} 项；{audioCount} 条配音会重置；现有 {shotCount} 个分镜保持不变` |
| 取消 | `取消` |
| 应用 | `应用 {count} 项整理` |
| 提交中 | `应用中…` |
| 成功 Toast | `已完成本地整理：更新 {count} 项` |

## 13. UI 设计 Prompt

--------------------------------
页面名称：剧本页—本地剧本整理与体检工作台

Prompt：

Design a polished Windows desktop manju production application in a deterministic local script-cleanup workflow. Canvas resolution 1777x974. Keep the existing bright sky-blue gradient background, premium white glassmorphism panels, deep navy typography, cyan focus glow, and the three-column Chinese script editor visible behind a restrained translucent overlay. Center a 1220x748 glass workbench modal with a fixed header, a 32/68 two-column body, and a fixed footer. In the header show the short Simplified Chinese title “本地整理剧本”, the subtitle “按确定性规则检查格式”, and a lock badge “仅本机规则”. The left pane contains a compact scope selector for “动作描述”, “旁白”, and “角色台词”, five cleanup rule toggles, a three-metric quality summary, and a concise diagnostic list. The right pane shows “变更预览”, filter chips “全部 / 动作 / 旁白 / 台词”, and several selectable before-after diff cards with short Chinese text, field badges, “原文” and “整理后” labels, plus a small orange “配音将失效” impact badge where relevant. The footer contains a one-line impact summary, a glass “取消” button, and a sky-blue gradient “应用 4 项整理” button. UI Design: dense yet calm professional desktop editor, explicit local processing, safe bulk confirmation, no AI mascot and no dashboard charts. Layout: fixed header and footer, independently scrollable panes, 20-24px spacing, precise alignment. Components: checkboxes, toggle rows, diagnostic cards, filters, before-after diff list, status badges, warning labels, primary and secondary buttons. Style: bright sky-blue glassmorphism, subtle cyan rim light, premium creator workstation, high legibility. Lighting: soft daylight with restrained blue glow and low-contrast shadows. Animation direction: immediate visible modal surface, 120ms row-state transitions only, reduced-motion fallback, no parent opacity entrance. Simplified Chinese UI text, Chinese labels, Chinese Windows desktop app interface, only short titles, labels, buttons, counts, and short example sentences, no long Chinese paragraphs.

--------------------------------

## 14. React 与服务映射

| 设计区域 | React / Service 建议 | 数据边界 |
| --- | --- | --- |
| 入口 | `ScriptPage` 内 `OrganizeScriptTrigger` | 只控制模态开关与焦点返回 |
| 模态 | 新增 `ScriptOrganizerModal` | 规则、范围、筛选、排除项为短生命周期 state |
| 分析服务 | 新增 `src/services/scriptOrganizerService.js` | 纯函数；不访问 React、DOM、Provider、localStorage 或 IPC |
| 安全归一化 | `normalizeScriptText` | 输入字符串，输出原文/整理后/原因/统计 |
| 诊断 | `analyzeScriptQuality` | 只报告，不直接修改项目 |
| 预览 | `createScriptOrganizerPreview` | 使用当前 scene、lines、shots；生成稳定 change IDs |
| 选择分析 | `summarizeScriptOrganizerSelection` | 计算选中项、配音影响和现有分镜数量 |
| 候选提交 | `createScriptOrganizerCommit` | 返回候选 scenes/lines；不在 Service 内调用 setState |
| 10 MB 预检 | `App` 现有 `createProjectSnapshot` + `getProjectSnapshotByteSize` | 完整项目候选通过后才 `setScenes/setLines` |
| 配音联动 | 继续使用现有 `lines` | 变化台词按现有安全语义重置音频字段 |
| 分镜 | 不自动更新 `shots` | 只显示影响提示，用户仍从现有按钮决定是否重建 |
| 自动保存 | 现有 800 ms autosave | 无新格式、无新 Repository、无 IPC |

## 15. 验证设计

### 15.1 纯函数测试

- CRLF、CR、LF、Tab、普通空格、全角空格和连续空行归一化。
- 控制字符移除，不破坏中文、Emoji、引号和合法换行。
- 句末标点规则默认关闭；开启后只补末尾，不改写文本。
- 动作、旁白和台词范围切换；至少保留一个范围。
- 空动作、空旁白、空台词、重复台词、超长台词、待设置地点/时间诊断。
- Change Item 使用稳定 ID；排除项不进入 Commit。
- 只更新当前 episodeId + sceneId；其他场景保持深度等价。
- 修改台词正确重置音频；未改台词与其音频保持不变。
- 候选顺序、角色、情绪、variant、台词 ID 不变。
- Unicode 长度和大文本阻断路径。

### 15.2 Electron UI 测试

- “整理剧本”不再调用 Mock；打开真实 `role=dialog` 模态。
- 默认范围和四项安全规则正确；标点默认关闭。
- 差异、诊断、筛选、逐项排除、统计与按钮禁用状态正确。
- 取消、关闭、`Esc` 零数据副作用，焦点返回入口。
- `Ctrl+Enter` 应用；IME 组合态不会误提交。
- 有音频影响时显示确认；取消确认不修改数据。
- 应用后剧本页显示整理结果，配音页同步并重置受影响音频。
- 现有分镜数量、内容、顺序和图片保持不变。
- 800 ms 后 autosave 写入候选结果；`.manju` 版本仍为 `1`。
- 10 MB 预检失败时模态不关闭、项目不变化。

### 15.3 回归测试

- `npm run lint`
- 新增 `npm run test:script-organizer`
- 新增 `npm run test:script-organizer-ui`
- `npm run test:dialogue-split`
- `npm run test:dialogue-split-ui`
- `npm run test:project`
- `npm run build`
- 打包后隐藏启动 `release/win-unpacked/漫剧创作.exe`

## 16. 完整组件树

```text
ScriptPage
├── SceneList
├── ScriptEditor
│   └── EditorHeading
│       └── OrganizeScriptTrigger
├── SceneInspector
└── ScriptOrganizerLayer
    └── ScriptOrganizerModal
        ├── ModalHeader
        │   ├── TitleGroup
        │   ├── LocalRuleBadge
        │   └── CloseButton
        ├── ModalBody
        │   ├── OrganizerControlPane
        │   │   ├── ScopeSelector
        │   │   ├── RuleList
        │   │   │   └── RuleToggle
        │   │   ├── QualitySummary
        │   │   └── DiagnosticList
        │   │       └── DiagnosticItem
        │   └── OrganizerPreviewPane
        │       ├── PreviewSummary
        │       ├── PreviewFilters
        │       ├── ChangeList
        │       │   └── ChangeCard
        │       │       ├── IncludeToggle
        │       │       ├── FieldBadge
        │       │       ├── BeforeBlock
        │       │       ├── AfterBlock
        │       │       └── ImpactBadge
        │       └── PreviewState
        └── ModalFooter
            ├── ImpactSummary
            └── FooterActions
                ├── CancelButton
                └── ApplyButton
```

## 17. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 95%
尺寸估算: 96%
数据与安全边界识别: 99%
```

所有尺寸均根据当前运行截图和实际 CSS 智能推算。若原始设计稿（Figma、Sketch、PSD）可获取，可进一步校准精确尺寸。

## 18. 不确定项与设计假设

- 将“下一步”解释为继续修复当前核心创作链路中最明确的假入口；代码证据是“整理剧本”仍只调用 `onMock('script', ...)`。
- 按用户既定要求，真实 AI 服务继续不接入；“整理”限定为确定性格式清理与质量诊断，而非剧情改写。
- 当前数据模型没有独立天气、预计时长或主要角色字段；V19 不借机扩展场景 schema，也不把界面展示值伪装成已保存数据。
- 当前剧本页没有通用历史栈；V19 通过预览、逐项排除、音频确认和候选预检降低风险，本轮不扩展跨页面撤销系统。
- 任何实际台词字符串变化都按现有规则重置该条音频；即使只有格式变化，也不静默保留可能已不匹配的音频。
- 现有分镜不自动同步动作、旁白或台词整理结果；Footer 明确提示数量，由用户决定是否重新生成草稿。
- 单场景极端大文本的具体阻断阈值在实现时应以 UI 响应测试确定，但不得截断或覆盖原始项目数据。
- V19 不修复同页“主要角色 +”按钮、固定天气和固定预计时长；这些属于后续独立数据模型设计，不与本次整理功能混做。

## 19. 确认与实现状态

- 用户已通过“下一步”确认本设计稿，并授权进入现有 React + Electron 实现阶段。
- V19 已按本稿实现到 `1.17.0`：入口、毛玻璃模态、范围与规则控制、差异预览、诊断、逐项排除、键盘与焦点行为均已落地。
- 整理引擎保持纯本地、确定性执行；没有接入 Provider、网络或 API Key，也没有修改 `.manju` schema 版本。
- 台词实际变化时会清空音频数据、来源、文件信息、错误和任务状态，并将 `duration` 重置为 `0.0s`、`audioUpdatedAt` 重置为空字符串；现有分镜不变。
- 为避免 Electron 截图和低性能设备上的合成层冻结，弹窗不对父层执行透明度动画或额外 `backdrop-filter`；天蓝渐变毛玻璃视觉仍由实体面板、边框、阴影和内部高光完成。
- 已通过服务单元测试、模态 UI 自动化、V18 台词拆分回归、全项目持久化回归、静态检查、构建与运行截图检查。
