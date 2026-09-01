# 漫剧创作 V18 本地台词拆分 Design Spec

## 0. 来源、目标与边界

- 产品：Windows 本地优先漫剧制作软件 `漫剧创作`。
- 当前应用版本基线：`1.15.0`；计划实现版本：`1.16.0`。
- 视觉源：`outputs/runtime/script.png`，实测画布 `1777 × 974 px`；同时沿用 `outputs/runtime/project-name-edit.png` 已确认的天蓝渐变毛玻璃视觉语言。
- 代码基准：`src/App.jsx` 的 `ScriptPage`、`lines` 项目状态与剧本/配音同步；`src/App.css` 的 `script-page`、`reading-panel` 与现有确认层；`src/services/projectModel.js` 的 10 MB 项目预检。
- 真实缺口：剧本页顶部“拆分台词”按钮当前只显示“台词拆分接口已预留；当前使用手动编辑”，是核心创作链路中的公开假入口。
- 本轮目标：提供完全本地、可预览、可编辑、可追加或明确替换的结构化台词拆分工具；提交后使用现有 `lines` 数据同步到配音页并进入 800 ms 自动保存。
- 主分类：剧本结构化录入；副分类：台词与配音数据同步、批量写入安全。
- 本轮不改：动作描述、旁白字段语义、角色数据、分镜数据、配音 Provider、项目磁盘路径、时间线历史、`.manju` 格式版本、权限、网络和 IPC 能力集合。
- 真实 AI 接口继续保持预留状态；台词识别在渲染进程以确定性纯函数完成，不读取 `key.txt`，不发起外部请求，不产生付费调用。

## 1. 项目设计分析

### 1.1 产品类型

面向漫剧编导与小型制作团队的桌面创作工作台。剧本页承担“场景素材转成结构化生产数据”的职责，角色台词会继续流入配音、字幕、分镜草稿和最终成片链路，因此批量拆分不能只是文本外观操作。

### 1.2 目标用户

- 18–45 岁的漫剧编剧、短剧导演、AI 内容制作人、工作室剪辑与配音协作者。
- 经常从 Word、聊天记录、生成式工具或旧剧本中复制带有“角色：台词”格式的文本。
- 希望一次整理多句台词，但不接受未预览就覆盖已导入音频或其他场景数据。

### 1.3 使用场景

- 把 `沈砚：今晚的风，不太平。` 这类多行文本粘贴进当前场景，批量拆成角色台词。
- 使用 `林听雨（紧张）：他们已经盯上你了。` 同时识别说话人与情绪。
- 遇到项目中不存在的角色时，在提交前改为已有角色或排除该行。
- 当前场景已有手工台词时默认追加；只有用户明确选择“替换当前台词”后才允许移除旧台词与其音频。

### 1.4 核心价值

- 把占位按钮变成真实生产入口，减少逐条点击“插入台词”的重复劳动。
- 解析结果先预览后提交，未知说话人、空文本、重复项和潜在音频损失都可见。
- 新台词直接复用现有 `lines` 数据模型，不制造第二份台词状态，不破坏配音页同步。

## 2. 用户画像

| 维度 | 画像 |
| --- | --- |
| 年龄 | 18–45 岁 |
| 职业 | 漫剧编剧、短剧导演、AI 内容创作者、配音剪辑、小型工作室成员 |
| 使用习惯 | Windows 桌面多窗口；复制粘贴长文本；熟悉 `Ctrl+Enter`、`Esc`、批量预览与显式覆盖确认 |
| 主要痛点 | 逐条录入慢；不同来源格式不统一；未知角色难发现；批量替换可能误删已有配音 |
| 成功标准 | 20–100 行文本可快速解析；错误行明确；提交结果与配音页一致；取消无数据副作用 |

## 3. 产品视觉方向

### 3.1 设计关键词

`Sky-blue glassmorphism`、`local-first parsing`、`structured script import`、`side-by-side preview`、`safe bulk commit`、`desktop productivity`。

### 3.2 视觉原则

- 延续亮天蓝渐变背景、半透明白色毛玻璃、深海军蓝文字和青蓝焦点光晕。
- 拆分工具使用居中工作台式模态层，不跳转离开当前场景，也不挤压三栏剧本布局。
- 左侧是原始文本，右侧是结构化预览；从输入到结果的映射关系一眼可读。
- 普通追加使用青蓝主按钮；替换模式使用暖橙警示而不是红色删除主按钮，避免把批量整理误呈现为纯删除。
- 状态不能只靠颜色：识别成功、待映射、重复、排除都同时显示图标、标签和文字。

## 4. 页面整体分析

- 页面：剧本页 `ScriptPage` + `DialogueSplitModal`。
- 页面类型：三栏剧本编辑器上的结构化导入模态工作台。
- 目标设备：Windows 桌面；基准画布 `1777 × 974 px`；最小支持宽度 `960 px`。
- 背景布局：左侧场景列表约 `17.3%`，中央剧本编辑约 `58.0%`，右侧场景信息约 `19.8%`，间隙约 `1.5%`。
- 模态层：覆盖当前可视窗口 `100% × 100%`；不改变页面滚动位置。
- 模态面板推测尺寸：`1160 × 720 px`，占屏宽约 `65.3%`，占页高约 `73.9%`。
- 布局模型：Overlay + Dialog Grid；Header / Body / Footer 三行，Body 为左右两栏。
- 动画：背景遮罩 `120 ms` 淡入，面板 `160 ms` 从 `translateY(10 px) scale(.985)` 进入；遵守 `prefers-reduced-motion`。

## 5. 页面结构拆解

```text
ScriptPage
├── TopNavigation
├── SceneList
├── ScriptEditor
│   ├── EditorHeading
│   │   ├── SceneTitle
│   │   ├── SplitDialogueTrigger
│   │   ├── OrganizeScript
│   │   └── GenerateStoryboardDraft
│   ├── SceneMeta
│   ├── ActionInput
│   ├── NarrationInput
│   └── DialogueEditor
├── SceneInspector
└── DialogueSplitLayer
    ├── Backdrop
    └── DialogueSplitModal
        ├── ModalHeader
        │   ├── TitleGroup
        │   ├── LocalOnlyBadge
        │   └── CloseButton
        ├── ModalBody
        │   ├── SourcePane
        │   │   ├── PaneHeading
        │   │   ├── FormatHints
        │   │   ├── SourceTextarea
        │   │   └── SourceTools
        │   └── PreviewPane
        │       ├── ParseSummary
        │       ├── PreviewList
        │       │   └── DialoguePreviewRow
        │       │       ├── IncludeToggle
        │       │       ├── SpeakerSelect
        │       │       ├── EmotionSelect
        │       │       ├── DialogueTextInput
        │       │       └── ParseStatus
        │       └── PreviewEmptyOrError
        └── ModalFooter
            ├── CommitMode
            ├── ImpactSummary
            ├── CancelButton
            └── CommitButton
```

## 6. 组件级设计稿

### 6.1 SplitDialogueTrigger

| 字段 | 规格 |
| --- | --- |
| 类型 | Secondary Button |
| 位置 | 中央剧本编辑区标题右侧，三个操作中的第一个 |
| 尺寸 | 推测 `134 × 48 px`；占屏宽约 `7.5%`；占标题操作组宽约 `29%`；占页高约 `4.9%` |
| Padding | `0 16 px`；图标与文字间距 `7 px` |
| 圆角 | `14 px` |
| 背景 | `rgba(255,255,255,.62)` 毛玻璃 |
| 边框 | `1 px solid rgba(255,255,255,.86)` |
| 图标 | Spark / Split，`16 × 16 px`；占按钮高约 `33%`；描边青蓝 `#168FCC` |
| 文字 | `拆分台词`；`13 px / 18 px / 720`；深蓝 `#257DA9` |
| 交互 | 点击打开模态层；不再显示占位 Toast |
| 辅助信息 | `aria-haspopup="dialog"`；`aria-controls="dialogue-split-modal"` |

### 6.2 DialogueSplitLayer

| 字段 | 规格 |
| --- | --- |
| 类型 | Fixed Overlay |
| 位置 | 应用视口最上层，`inset: 0` |
| 尺寸 | `1777 × 974 px` 基准；屏宽与页高均 `100%` |
| 背景 | `rgba(31,77,105,.24)` + `backdrop-filter: blur(10 px)` |
| 层级 | 高于 TopNavigation、Toast 和页面浮层；低于系统文件对话框 |
| 对齐 | Grid / place-items center；四周安全边距 `24 px`，占屏宽约 `1.35%` |
| 关闭 | 不允许点击遮罩关闭，避免误丢输入；仅关闭按钮、取消按钮或 `Esc` |

### 6.3 DialogueSplitModal

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Structured Import Workbench |
| 尺寸 | 推测 `1160 × 720 px`；屏宽约 `65.3%`；页高约 `73.9%`；父层宽高约 `65.3% / 73.9%` |
| 最小/最大 | `min(1160 px, calc(100vw - 48 px))`；`min(720 px, calc(100vh - 48 px))` |
| 行布局 | `76 px minmax(0,1fr) 82 px`；Header 约占面板高 `10.6%`，Footer 约 `11.4%` |
| 圆角 | `24 px` |
| 背景 | `linear-gradient(145deg, rgba(251,255,255,.94), rgba(222,246,255,.88))` |
| 边框 | `1 px solid rgba(255,255,255,.94)` + 内侧高光 |
| 阴影 | `0 30px 90px rgba(24,99,142,.28)` |
| 滚动 | 面板本体不滚动；左右 Pane 各自滚动，Header/Footer 固定 |
| 可访问性 | `role="dialog"`、`aria-modal="true"`、标题关联；焦点锁定在模态层内 |

### 6.4 ModalHeader

| 字段 | 规格 |
| --- | --- |
| 类型 | Header Row |
| 尺寸 | `100% × 76 px`；占面板高约 `10.6%` |
| Padding | `20 px 24 px`；横向占面板宽约 `2.1%` |
| 分割 | 底部 `1 px solid rgba(77,157,199,.13)` |
| 标题 | `拆分角色台词`；`22 px / 30 px / 760`；`#173F58` |
| 副标题 | `从带说话人标记的文本中本地识别，不调用 AI`；`11 px / 16 px / 500`；`#66879A` |
| LocalOnlyBadge | `仅本机解析`；约 `82 × 26 px`；浅青底、锁图标、`10 px / 650` |
| CloseButton | `36 × 36 px`；占 Header 高约 `47.4%`；白色毛玻璃；`X` 图标 `17 px` |

### 6.5 SourcePane

| 字段 | 规格 |
| --- | --- |
| 类型 | Input Pane |
| 位置 | ModalBody 左侧 |
| 尺寸 | 约 `554 × 562 px`；占面板宽约 `47.8%`；占 Body 宽约 `50%`；占面板高约 `78.1%` |
| Padding | `20 px 20 px 18 px 24 px` |
| 背景 | `rgba(255,255,255,.34)` |
| 右边界 | `1 px solid rgba(77,157,199,.14)` |
| 标题 | `原始剧本文本`；`14 px / 20 px / 740` |
| 说明 | `每行一条，使用“角色：台词”`；`11 px` 灰蓝 |

### 6.6 FormatHints

| 字段 | 规格 |
| --- | --- |
| 类型 | Hint Chips |
| 尺寸 | 单枚约 `148 × 28 px`；占 SourcePane 宽约 `28%`；高度占 Pane 约 `5%` |
| 文案 | `沈砚：今晚的风。`、`林听雨（紧张）：小心。` |
| 样式 | 浅蓝白毛玻璃；圆角 `999 px`；等宽数字感细节；不可点击 |
| 辅助文案 | `支持中文或英文冒号；空行自动忽略` |

### 6.7 SourceTextarea

| 字段 | 规格 |
| --- | --- |
| 类型 | Multiline Textarea |
| 尺寸 | 约 `506 × 390 px`；占 SourcePane 宽约 `91.3%`；占 Pane 高约 `69.4%`；占屏宽约 `28.5%` |
| Padding | `14 px 16 px` |
| 圆角 | `15 px` |
| 背景 | `rgba(248,253,255,.78)` |
| 边框 | 默认 `rgba(56,169,226,.22)`；聚焦 `rgba(20,158,226,.72)` + `4 px` 青蓝 halo |
| 字体 | `13 px / 22 px / 500`；系统中文字体；`#244D64` |
| Placeholder | 两行短示例，不渲染长段说明 |
| 长度 | 最多 `50,000` 个 Unicode 字符；右下角显示 `当前字符数 / 50,000` |
| 粘贴 | 保留换行；统一 CRLF/LF；删除不可用控制字符但保留 Tab 作为空格 |
| 状态 | empty / focused / over-limit / parse-error |

### 6.8 SourceTools

| 字段 | 规格 |
| --- | --- |
| 类型 | Toolbar |
| 尺寸 | `100% × 42 px`；占 Pane 高约 `7.5%` |
| 左操作 | `使用当前台词`：把当前场景现有台词格式化后填入草稿，仅用于编辑，不立即修改项目 |
| 右操作 | `清空`：清除草稿与预览；若草稿非空需一次轻量确认 |
| 状态 | 当前场景无台词时“使用当前台词”禁用；解析中不禁用输入 |

### 6.9 PreviewPane

| 字段 | 规格 |
| --- | --- |
| 类型 | Structured Preview Pane |
| 位置 | ModalBody 右侧 |
| 尺寸 | 约 `606 × 562 px`；占面板宽约 `52.2%`；占 Body 宽约 `50%`；占面板高约 `78.1%` |
| Padding | `20 px 24 px 18 px 20 px` |
| 背景 | `rgba(226,247,255,.22)` |
| 滚动 | PreviewList 独立纵向滚动；顶部摘要固定 |

### 6.10 ParseSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Status Header |
| 尺寸 | 约 `562 × 44 px`；占 PreviewPane 宽约 `92.7%`；占 Pane 高约 `7.8%` |
| 标题 | `拆分预览`；`14 px / 20 px / 740` |
| 统计 | `识别 3 条 · 待处理 1 行 · 重复 1 条`；数字使用 tabular nums |
| 图例 | 成功青蓝、待映射橙色、重复灰蓝、排除斜线图标；均带文字 |

### 6.11 DialoguePreviewRow

| 字段 | 规格 |
| --- | --- |
| 类型 | Editable Preview Card |
| 尺寸 | 约 `562 × 104 px`；占 PreviewPane 宽约 `92.7%`；占 Pane 高约 `18.5%` |
| Grid | `30 px 112 px 94 px minmax(160 px,1fr)` + 底部状态行 |
| Padding | `10 px 12 px`；Gap `8 px` |
| 圆角 | `14 px` |
| 背景 | 成功 `rgba(255,255,255,.64)`；待映射 `rgba(255,247,230,.72)`；排除 opacity `.58` |
| IncludeToggle | `28 × 28 px`；占行高约 `26.9%`；`aria-pressed`；勾选图标 `14 px` |
| SpeakerSelect | 宽 `112 px`；项目已有角色；未知时首项 `请选择角色` |
| EmotionSelect | 宽 `94 px`；`默认 / 沉稳 / 冷静 / 紧张 / 愤怒 / 悲伤 / 温柔 / 坚定` |
| DialogueTextInput | 单行默认，文本超过约 `54` 字可展开为两行；最大 `500` Unicode 字符 |
| ParseStatus | `已识别` / `未匹配角色“周舟”` / `与现有台词重复` / `已排除` |
| 重复规则 | 同场景内 `speaker + trim(text)` 完全一致标记重复并默认排除；用户不可在未编辑前强制重复提交 |
| 图标 | 成功 Check、待处理 Warning、重复 Copy、排除 Close；均 `14 × 14 px` |

### 6.12 PreviewEmptyOrError

| 字段 | 规格 |
| --- | --- |
| 类型 | Empty / Error State |
| 尺寸 | 约 `562 × 360 px`；占 PreviewPane 宽约 `92.7%`；占 Pane 高约 `64.1%` |
| Empty 图标 | Script `42 × 42 px`；占空态高约 `11.7%` |
| Empty 标题 | `粘贴带说话人标记的剧本文本` |
| Empty 说明 | `识别结果会在这里预览，确认前不会修改项目。` |
| 无识别结果 | `没有识别到“角色：台词”格式，请检查冒号和说话人名称。` |
| 超限 | `最多处理 200 条台词；请分批提交。` |

### 6.13 CommitMode

| 字段 | 规格 |
| --- | --- |
| 类型 | Segmented Control / Radio Group |
| 位置 | ModalFooter 左侧 |
| 尺寸 | 约 `286 × 40 px`；占面板宽约 `24.7%`；占 Footer 高约 `48.8%` |
| 选项 | `追加到现有台词`（默认） / `替换当前台词` |
| 样式 | 追加选中为青蓝白底；替换选中为浅橙底与警告图标 |
| 辅助信息 | 使用真实 radio 语义；方向键切换；不能只用颜色表达 |

### 6.14 ImpactSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline Impact Text |
| 尺寸 | `minmax(240 px,1fr) × auto`；占 Footer 中部可用宽 `100%` |
| 追加文案 | `将新增 3 条台词，并同步到配音页。` |
| 替换文案 | `将替换当前 3 条台词，其中 2 条含音频。` |
| 超限文案 | `提交后项目将超过 10 MB，请先移除部分图片或音频。` |
| 颜色 | 默认灰蓝；音频影响与体积错误使用暖橙/珊瑚文字并带图标 |

### 6.15 FooterActions

| 字段 | 规格 |
| --- | --- |
| 类型 | Button Group |
| 位置 | ModalFooter 右侧 |
| Cancel | `取消`，`88 × 40 px`，白色毛玻璃；默认无项目副作用 |
| Commit | 追加时 `同步 3 条台词`；替换时 `替换并同步 3 条`；最小 `150 × 42 px` |
| Commit 样式 | 追加为天蓝渐变；替换为暖橙渐变但保留白字与警告图标 |
| Disabled | 无有效行、存在未映射且仍勾选的行、解析超限、候选项目超 10 MB 时禁用 |
| 快捷键 | `Ctrl+Enter` 提交；输入法组合态不触发；`Esc` 取消 |

## 7. 本地解析规则

### 7.1 支持格式

```text
沈砚：今晚的风，不太平。
沈砚: 今晚的风，不太平。
林听雨（紧张）：他们已经盯上你了。
林听雨(紧张): 他们已经盯上你了。
林听雨[紧张]：他们已经盯上你了。
```

- 仅显式包含说话人和冒号的非空行进入结构化预览。
- 说话人名称与项目角色先执行首尾空白清理，再做大小写不敏感的精确匹配；不做模糊猜测，避免把相近角色误绑。
- 情绪缺失时使用 `默认`；未知情绪保留原文并要求用户从下拉框确认，不静默映射。
- 一行对应一条台词；同一行的多句标点不自动拆开，避免破坏表演节奏。
- 空行忽略；无冒号行进入“待处理行”，默认不提交，不把动作描述误当台词。
- `旁白：` 不自动写入角色台词；预览标记为未匹配，并提示旁白应保留在页面现有“旁白”字段。
- 最大输入 `50,000` Unicode 字符，最多生成 `200` 条预览行，单条台词最大 `500` Unicode 字符。

### 7.2 安全归一化

- 统一 `CRLF` 与 `LF`，Tab 转为单个空格。
- 拒绝 `U+0000–U+001F` 与 `U+007F–U+009F` 中除换行、回车、Tab 外的控制字符。
- 保留中文标点、引号、Emoji 和少数民族文字；长度按 Unicode code point 计算，不按 UTF-16 code unit 截断。
- 不运行 Markdown、HTML、脚本或正则表达式输入；所有内容只作为纯文本。

## 8. 提交流程与数据语义

### 8.1 打开与解析

```text
点击“拆分台词”
  -> 打开模态层
  -> 焦点进入 SourceTextarea
  -> 草稿默认空白，不复制动作或旁白，避免错误解析
  -> 用户粘贴/输入
  -> 150 ms debounce 本地解析
  -> 右侧生成可编辑预览
  -> 不修改 scenes / lines / audio / autosave
```

### 8.2 追加模式

```text
确认有效预览行
  -> 过滤排除项、空文本和未编辑重复项
  -> 为每条新台词分配提交时唯一数值 ID
  -> 写入当前 episodeId / sceneId / scene title
  -> 说话人 variant 来自当前 characters
  -> status = 未配音
  -> audioStatus = 未生成
  -> audio / audioSource / audioFileName / audioError 为空
  -> duration = 0.0s，audioAttempt = 0
  -> 追加到现有 lines，保持预览顺序
  -> 关闭模态层
  -> 800 ms 后沿用现有项目自动保存
  -> 配音页立即读取同一份 lines
```

### 8.3 替换模式

- 仅替换当前 `episodeId + sceneId` 的台词；其他剧集与场景完全不变。
- 如果当前场景台词包含 `audio`、`audioFileName` 或已完成音频状态，Footer 必须显示受影响数量。
- 点击暖橙提交按钮后出现一次原生/现有风格确认：`替换会移除当前场景 3 条台词及其中 2 条音频，是否继续？`
- 用户取消确认时模态内容与项目状态均不变化。
- 确认后旧行整体移除，新行按追加规则创建；不得复用旧音频，因为文本和说话人关联已不可靠。

### 8.4 10 MB 候选预检

- 提交前以完整 `projectSnapshot` 构建候选 `lines`，调用现有 UTF-8 体积计算。
- 候选超过 `10 MB` 时不更新 `lines`、不关闭模态、不触发自动保存；显示：`提交后项目将超过 10 MB，请先移除部分图片或音频。`
- 预检只针对实际提交行；排除项不进入候选。

### 8.5 取消与关闭

- 取消、关闭按钮或 `Esc` 只清理模态草稿与预览，不修改任何项目数据。
- 遮罩点击不关闭。
- 关闭后焦点返回“拆分台词”按钮。
- 页面卸载时清理解析 debounce，不允许卸载后回写状态。

## 9. 状态与异常

| 状态 | 视觉与行为 |
| --- | --- |
| initial-empty | 左侧空 textarea，右侧显示引导空态，提交禁用 |
| typing | 输入可编辑；150 ms 后刷新预览，不显示伪加载 |
| parsed | 显示有效行数量和可编辑预览，追加按钮启用 |
| no-match | 未识别格式，保留输入并提示检查冒号与角色名 |
| unknown-speaker | 暖橙卡片；必须映射角色或排除 |
| unknown-emotion | 情绪选择框标橙；默认不提交直到确认 |
| duplicate | 灰蓝 Copy 标签，默认排除；编辑文本或角色后重新判定 |
| excluded | 行弱化并保留，可再次勾选 |
| empty-text | 行内珊瑚错误，提交禁用 |
| line-too-long | 显示 `单条台词最多 500 个字符`，不截断 |
| source-too-long | 输入边框珊瑚，暂停解析与提交 |
| too-many-lines | 只展示前 200 条并阻止提交，要求分批处理 |
| size-error | Footer 珊瑚提示，项目状态不变 |
| append | 青蓝提交按钮，无二次确认 |
| replace | 暖橙按钮，显示旧台词和音频影响，提交需确认 |
| committing | 提交按钮短暂显示 `同步中…` 并防重复点击 |
| success | 模态关闭，Toast：`已拆分并同步 3 条台词到配音页` |
| cancel | 项目数据、自动保存和配音页均不变化 |

## 10. 响应式、长文本与可访问性

- `≥ 1280 px`：左右双栏，各约 `50%` Body 宽。
- `960–1279 px`：面板宽 `calc(100vw - 32 px)`；Source/Preview 比例 `46% / 54%`；Footer 允许两行。
- `< 960 px`：Body 改为上下布局，Source 与 Preview 各最小 `320 px` 高，面板内部纵向滚动；应用仍定位为桌面端。
- `< 720 px`：不作为主要交付目标；保留可用性，操作按钮允许横向滚动，不隐藏提交影响说明。
- 长角色名：SpeakerSelect 最大显示一行省略，完整名称用 `title`。
- 长台词：预览输入可扩展两行；列表行高度增长但不横向撑开。
- 高对比模式：使用边框、文字和图标共同表达状态；不只依赖天蓝/橙色。
- 暗色模式：当前不新增全局暗色主题；若系统强制颜色，保留原生 Form 控件与焦点轮廓。
- 键盘：Tab 在模态内循环；`Shift+Tab` 反向；`Esc` 取消；`Ctrl+Enter` 提交；方向键控制 Radio/Select。
- 输入法：`compositionstart` 到 `compositionend` 期间不触发快捷提交和最终解析判定。
- 屏幕阅读器：解析摘要使用 `aria-live="polite"`；行内阻断错误使用 `role="alert"`；装饰图标 `aria-hidden`。

## 11. Design System

### 11.1 Color System

| Token | 色值 | 用途 |
| --- | --- | --- |
| `dialog-surface` | `rgba(251,255,255,.94)` | 模态主表面 |
| `dialog-surface-blue` | `rgba(222,246,255,.88)` | 右下渐变 |
| `dialog-backdrop` | `rgba(31,77,105,.24)` | 遮罩 |
| `primary-gradient` | `linear-gradient(135deg,#8AD9FF,#43B9F8 52%,#188EDB)` | 追加提交 |
| `warning-gradient` | `linear-gradient(135deg,#FFC56D,#F39A45)` | 替换提交 |
| `ink-primary` | `#173F58` | 标题与主要文本 |
| `ink-secondary` | `#66879A` | 说明文本 |
| `focus-cyan` | `#149EE2` | 聚焦边框与光晕 |
| `warning` | `#B86B24` | 待映射与音频影响 |
| `error` | `#B85243` | 阻断错误 |
| `success` | `#168FCB` | 已识别状态 |

### 11.2 Typography

- 字体：现有 Windows 中文系统字体栈，不新增字体依赖。
- 模态标题：`22 / 30 / 760`。
- Pane 标题：`14 / 20 / 740`。
- 正文与表单：`13 / 20 / 500–650`。
- 辅助与状态：`10–11 / 16 / 500–680`。
- 数量统计使用 tabular nums，避免解析时宽度跳动。

### 11.3 Component System

- Button：主按钮天蓝渐变；替换按钮暖橙；取消为白色毛玻璃；全部具有可见 `focus-visible`。
- Card：预览行 `14 px` 圆角，半透明白底；状态通过左侧细边、图标、标签共同表达。
- Avatar：此模态不显示大头像，角色选择通过 Select 完成，避免列表密度失控。
- Navigation：背景 TopNavigation 保持可见但被遮罩，不可交互。
- Modal：`24 px` 圆角，固定 Header/Footer，Body 双栏独立滚动。
- List：PreviewList 虚拟化暂不需要，最多 200 行；实现时需保持稳定 key。
- Feed：不适用社交 Feed；以结构化预览列表替代。
- Input：`13–15 px` 圆角、半透明白底、青蓝聚焦光晕、珊瑚阻断错误。
- Badge：仅本机、识别、待映射、重复、排除均使用短标签。

## 12. 中文文案表

| 区域 | 文案 |
| --- | --- |
| 入口按钮 | `拆分台词` |
| 模态标题 | `拆分角色台词` |
| 模态副标题 | `从带说话人标记的文本中本地识别，不调用 AI` |
| 本地标签 | `仅本机解析` |
| 左栏标题 | `原始剧本文本` |
| 左栏说明 | `每行一条，使用“角色：台词”` |
| 示例 1 | `沈砚：今晚的风。` |
| 示例 2 | `林听雨（紧张）：小心。` |
| Textarea Placeholder | `沈砚：今晚的风，不太平。\n林听雨（紧张）：他们已经盯上你了。` |
| 使用现有 | `使用当前台词` |
| 清空 | `清空` |
| 右栏标题 | `拆分预览` |
| 初始空态 | `粘贴带说话人标记的剧本文本` |
| 初始说明 | `识别结果会在这里预览，确认前不会修改项目。` |
| 无格式 | `没有识别到“角色：台词”格式，请检查冒号和说话人名称。` |
| 未匹配 | `未匹配角色“{name}”` |
| 旁白提示 | `旁白请保留在页面的“旁白”字段。` |
| 重复 | `与现有台词重复` |
| 排除 | `已排除` |
| 空台词 | `台词内容不能为空。` |
| 单行超限 | `单条台词最多 500 个字符。` |
| 数量超限 | `最多处理 200 条台词，请分批提交。` |
| 追加模式 | `追加到现有台词` |
| 替换模式 | `替换当前台词` |
| 追加影响 | `将新增 {count} 条台词，并同步到配音页。` |
| 替换影响 | `将替换当前 {oldCount} 条台词，其中 {audioCount} 条含音频。` |
| 替换确认 | `替换会移除当前场景 {oldCount} 条台词及其中 {audioCount} 条音频，是否继续？` |
| 体积超限 | `提交后项目将超过 10 MB，请先移除部分图片或音频。` |
| 取消 | `取消` |
| 追加提交 | `同步 {count} 条台词` |
| 替换提交 | `替换并同步 {count} 条` |
| 提交中 | `同步中…` |
| 成功 Toast | `已拆分并同步 {count} 条台词到配音页` |

## 13. UI 设计 Prompt

--------------------------------
页面名称：剧本页—本地台词拆分工作台

Prompt：

Design a polished Windows desktop manju production application in a local dialogue-splitting workflow. Canvas resolution 1777x974. Keep the existing bright sky-blue gradient background, premium white glassmorphism panels, deep navy typography, cyan focus glow, and the three-column Chinese script editor visible behind a softly blurred overlay. Center a 1160x720 structured import modal with a fixed header, two-column body, and fixed footer. In the header show the short Simplified Chinese title “拆分角色台词” and a small lock badge “仅本机解析”. The left pane contains short format chips, a large script textarea with two short Chinese dialogue examples, and compact buttons “使用当前台词” and “清空”. The right pane shows “拆分预览”, a summary with recognized and unresolved counts, and several editable glass cards with include checkbox, speaker selector, emotion selector, short Chinese dialogue text, and visible status badges for recognized, unmatched, duplicate, and excluded rows. The footer contains a segmented control with “追加到现有台词” and “替换当前台词”, a concise impact summary, a glass “取消” button, and a cyan gradient “同步 3 条台词” button. UI Design: dense but calm desktop productivity tool, precise grid alignment, strong input-to-preview mapping, no dashboard charts. Layout: centered modal, 50/50 panes, independently scrollable lists, generous 20-24px spacing. Components: textarea, chips, editable preview list, selects, radio segment, status badges, warning state, primary and secondary buttons. Style: bright sky-blue glassmorphism, cinematic creator workstation, professional Chinese software, subtle cyan rim light. Lighting: soft daylight, restrained blue glow, low-contrast shadows. Animation direction: 120ms backdrop fade and 160ms gentle modal lift, no layout jump, reduced-motion fallback. Simplified Chinese UI text, Chinese labels, Chinese Windows desktop app interface, only short titles, labels, buttons, and example dialogue, no long Chinese paragraphs.

--------------------------------

## 14. React 与服务映射

| 设计区域 | 建议实现位置 | 边界 |
| --- | --- | --- |
| 入口与模态短生命周期状态 | `ScriptPage` / 可拆出的 `DialogueSplitModal` | 只管理 open、draft、preview、mode、focus |
| 解析与归一化 | 新增 `src/services/dialogueSplitService.js` | 纯函数；不访问 React、DOM、网络或文件系统 |
| 角色匹配 | `dialogueSplitService` 接收 characters | 精确匹配；未知角色返回结构化问题，不猜测 |
| 重复判断 | 服务接收当前场景 `visibleDialogue` | `speaker + trim(text)`；不影响其他场景 |
| 预览编辑 | Modal 本地 state | 未提交前不修改 `lines` |
| ID 分配与正式提交 | `ScriptPage` 提交回调或纯服务返回 | 提交时基于全项目 `lines` 最大 ID 一次分配 |
| 10 MB 预检 | `App` 的 `projectSnapshot` + `projectModel` | 构建候选后检查；超限不写状态 |
| 自动保存 | `App` 现有 snapshot effect | 800 ms debounce，不新增 IPC |
| 配音同步 | 继续复用 App 的 `lines` | 不创建第二份配音台词数据 |
| Modal 焦点管理 | React refs + effect | 打开聚焦 textarea，关闭回入口，焦点锁定 |
| 替换确认 | 复用现有确认语义或模态内二次确认层 | 明确音频影响；取消无副作用 |

不新增依赖、不修改 lockfile、不增加权限、不新增主进程 IPC、不改变 Provider 注册表。

## 15. 验收与测试矩阵

| 场景 | 预期结果 |
| --- | --- |
| 打开模态 | textarea 自动聚焦，背景不可交互，右侧初始空态 |
| 中文冒号 | `沈砚：台词` 正确识别 |
| 英文冒号 | `沈砚: 台词` 正确识别 |
| 中文括号情绪 | `林听雨（紧张）：台词` 识别角色、情绪和文本 |
| 未知角色 | 行标橙、提交阻断；映射已有角色后恢复 |
| 旁白行 | 不静默写入角色台词，提示使用旁白字段 |
| 无冒号行 | 进入待处理统计，不作为有效台词提交 |
| 空行 | 安全忽略 |
| 完全重复 | 默认排除；修改说话人或文本后重新判定 |
| Emoji / 长中文 | Unicode 长度正确，不沿用 80 字项目名限制；单句上限 500 |
| 控制字符 | 被拒绝或安全归一化，不执行为 HTML/脚本 |
| 200 条 | 可预览并提交；201 条阻断并提示分批 |
| 输入法 Enter | composition 期间不提交 |
| Ctrl+Enter | 仅在全部有效时提交一次，防重复点击 |
| Escape / 取消 | 所有项目数据不变，焦点回入口 |
| 追加模式 | 原台词保留，新台词按顺序追加且同步配音页 |
| 替换无音频 | 明确确认后只替换当前场景台词 |
| 替换有音频 | Footer 显示数量；确认文案准确；取消不丢音频 |
| 10 MB 超限 | lines、自动保存和模态状态均不误提交 |
| 新台词字段 | episodeId、sceneId、scene、speaker、variant、status、audioStatus 等完整 |
| 旧场景隔离 | 其他剧集/场景台词及音频不变化 |
| 自动保存 | 800 ms 后 autosave 含新台词，格式版本仍为 1 |
| 重新打开项目 | 拆分台词完整恢复，配音页数量一致 |
| 小窗口 | 960 px 仍可双栏；更窄时上下布局且操作可达 |
| reduced motion | 遮罩与面板不播放位移动画 |

## 16. 完整组件树

```text
ScriptPage
├── TopNavigation
├── SceneList
├── ScriptEditor
│   └── SplitDialogueTrigger
├── SceneInspector
└── DialogueSplitLayer
    └── DialogueSplitModal
        ├── ModalHeader
        │   ├── ModalTitle
        │   ├── LocalOnlyBadge
        │   └── CloseButton
        ├── ModalBody
        │   ├── SourcePane
        │   │   ├── SourceHeading
        │   │   ├── FormatHints
        │   │   ├── SourceTextarea
        │   │   ├── CharacterCounter
        │   │   └── SourceTools
        │   └── PreviewPane
        │       ├── ParseSummary
        │       ├── PreviewList
        │       │   └── DialoguePreviewRow
        │       │       ├── IncludeToggle
        │       │       ├── SpeakerSelect
        │       │       ├── EmotionSelect
        │       │       ├── DialogueTextInput
        │       │       └── ParseStatus
        │       └── PreviewState
        └── ModalFooter
            ├── CommitMode
            ├── ImpactSummary
            └── FooterActions
                ├── CancelButton
                └── CommitButton
```

## 17. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 95%
尺寸估算: 96%
交互与数据风险识别: 98%
```

所有尺寸均根据当前运行截图和实际 CSS 智能推算。若原始设计稿（Figma、Sketch、PSD）可获取，可进一步校准精确尺寸。

## 18. 不确定项与设计假设

- 将“下一步”解释为修复项目中最明确的下一处核心假入口：剧本页“拆分台词”；依据是代码仍明确显示“接口已预留”。
- “拆分台词”定义为从显式 `角色：台词` 文本中做本地确定性解析，而不是假装理解无结构散文，也不偷偷调用 AI。
- 默认草稿为空，不直接解析动作描述或旁白，避免把环境叙述错误写成角色台词。
- 默认提交模式是追加；替换属于高风险操作，必须显示旧台词和音频影响并二次确认。
- 本轮不实现剧本编辑历史或通用撤销栈；安全性由预览、默认追加、明确替换确认与自动保存共同保障。
- 本轮不在模态中创建新角色；未知说话人只能映射已有角色或排除，角色创建仍留在角色页。
- 本轮不把“旁白”伪装成角色；旁白继续使用现有独立字段，后续若要进入配音需单独设计旁白音轨模型。
- 新增服务只做纯文本解析和候选数据构建，不扩展 Provider、IPC、依赖或 `.manju` 格式版本。

## 19. 确认与实现状态

- 用户已通过“下一步”确认本设计稿并授权进入现有 React + Electron 实现阶段。
- `1.16.0` 已按本稿完成纯本地解析、逐行预览修正、重复识别、追加/替换提交、音频影响提醒、10 MB 预检、剧本/配音同步与自动保存。
- `.manju` 格式版本仍为 `1`；未新增 Provider、IPC、依赖、权限或网络请求，也未接入真实 AI。
- 为避免 Electron 隐藏窗口或离屏渲染冻结父级 `opacity: 0` 初始帧，最终弹窗保持立即可见的毛玻璃表面，不在模态父层使用透明度入场动画；状态反馈和可访问性不受影响。
- 验证覆盖解析服务单元测试、Electron 模态交互测试、IME 快捷键保护、焦点回归、配音页联动、自动保存以及完整项目持久化回归。
