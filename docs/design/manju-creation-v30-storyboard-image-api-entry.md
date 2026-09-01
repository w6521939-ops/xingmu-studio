# 漫剧制作 V30：分镜图片 API 入口 Design Spec

## 1. 设计目标与范围

当前分镜页顶部已经存在“批量画面未启用”和“画面生成未启用”两个禁用按钮，但用户无法点击查看模型、Key、提示词、角色参考图或付费锁原因。右侧镜头检查器已经保存真实的动作、台词、画面提示词、景别、运镜、时长、出镜角色、服装和连续性状态。

V30 只补齐“当前镜头”的图片 API 请求预览入口：

- 将完全禁用的“画面生成未启用”改为可点击的“API 生成当前画面”。
- 点击后打开当前镜头的真实图片请求预览弹窗。
- 使用镜头现有 `visualPrompt`，不生成虚构动作、对白、角色或场景。
- 只把真实 `data:image/*` 图片计入参考图，不使用 `Art` 装饰画面冒充参考素材。
- 显示真实 Provider、模型、Key、付费锁和图片执行器状态。
- 当前仍不发送请求，生成按钮保持硬锁，预计消耗为 0。
- “批量画面未启用”继续禁用；本期不设计批量任务、队列或费用汇总。

本设计不授权开启真实付费生成。

## 2. 来源与基准

- 代码基准：`src/App.jsx` 中的 `StoryboardPage`。
- 运行视觉源：`outputs/runtime/storyboard.png`。
- 已确认视觉体系：渐变天蓝色、明亮毛玻璃、细蓝描边、轻科技感。
- 已实现交互参考：V29 `CharacterImageApiDialog`。
- Provider 基准：阿里云百炼 `qwen-image-2.0-pro`。
- 图片能力约束：未来可支持文生图或 1–3 张真实参考图；当前只做本地预览。
- 付费边界：Electron 主进程固定 `allowPaidGeneration: false`，图片执行器未开放。
- 基准窗口：1440 × 900；项目内容区约 1368 × 824 px。
- 当前页面布局：主分镜区约 1044 px，右侧检查器约 310 px，中间间距 14 px。

## 3. 页面结构

```text
StoryboardPage
├─ TopNavigation
├─ StoryboardWorkspace
│  ├─ StoryboardMain
│  │  ├─ StoryboardToolbar
│  │  │  ├─ EpisodeSelect
│  │  │  ├─ SceneSelect
│  │  │  ├─ AddShotButton
│  │  │  ├─ SplitShotButton
│  │  │  ├─ BatchImageDisabledButton
│  │  │  └─ StoryboardImageApiButton
│  │  ├─ SceneSwitcher
│  │  ├─ ShotGrid
│  │  └─ ShotSummaryFooter
│  └─ ShotInspector
└─ StoryboardImageApiDialog
   ├─ DialogHeader
   ├─ ProviderStatusGrid
   ├─ RequestWorkspace
   │  ├─ ShotPreviewPanel
   │  └─ PromptAndOptionsPanel
   ├─ ContinuityReferenceStrip
   ├─ CostSafetyNotice
   └─ DialogActions
```

## 4. 整体布局与比例

### 4.1 分镜页面

- 页面宽度：约 1368 px，占 1440 px 屏幕宽度约 95%。
- 页面最小高度：约 824 px，占 900 px 窗口高度约 91.6%。
- 主分镜区：约 1044 px，占页面宽度约 76.3%。
- 右侧检查器：310 px，占页面宽度约 22.7%。
- 两栏间距：14 px，占页面宽度约 1%。
- 本期不调整现有分镜卡片、场景切换和右侧检查器尺寸。

### 4.2 API 弹窗

- 宽度：880 px，占 1440 px 屏幕宽度约 61.1%；最大 `calc(100vw - 32px)`。
- 高度：约 680 px，占 900 px 页面高度约 75.6%；最大 `calc(100vh - 32px)`。
- 内边距：26 px，占弹窗宽度约 3%。
- 内容纵向间距：14–16 px，采用 4/8 px 节奏。
- 圆角：26 px。
- 遮罩：`rgba(16, 74, 112, 0.30)`，背景模糊 10–12 px。
- 弹窗背景：三层天蓝径向渐变与 `rgba(252,255,255,0.94)` 预混合面板。
- z-index：245，高于顶部导航、检查器和 Toast。
- 动效：无透明度或缩放入场动画，避免隐藏窗口停帧和低性能设备合成卡顿。

## 5. 组件级设计稿

### 5.1 StoryboardImageApiButton

| 字段 | 规格 |
| --- | --- |
| 类型 | Button / Dialog Trigger |
| 位置 | 分镜页工具栏最右侧，替换“画面生成未启用” |
| 宽度 | 约 172 px；占主分镜区约 16.5%；占屏幕约 11.9% |
| 高度 | 48 px；占工具栏高度约 100%；占页面高度约 5.3% |
| Padding | 水平 14 px，垂直 0 |
| 圆角 | 14 px |
| 背景 | `linear-gradient(135deg, #77DFFF, #2AA7EA 56%, #5D83EB)` |
| 边框 | 1 px `rgba(255,255,255,0.76)` |
| 阴影 | `0 12px 26px rgba(29,142,205,0.22)` |
| 图标 | Spark 16 × 16 px，占按钮高度约 33%；右侧 Lock 11 × 11 px |
| 文字 | `API 生成当前画面`，12 px，780，白色 |
| 状态标记 | `已锁定`，8 px，半透明白色胶囊 |
| 点击目标 | 整体不小于 44 px 高 |
| Hover | 上移 1 px，外阴影增强；不播放大面积动画 |
| Focus | 3 px `rgba(60,181,236,0.18)` 外轮廓 |
| Disabled | 没有当前镜头时禁用并显示“请先创建镜头” |

按钮在付费锁定时仍可点击，因为用户需要查看真实状态和进入图片设置；只禁用弹窗内的最终提交按钮。

### 5.2 BatchImageDisabledButton

- 保持现有位置和禁用状态。
- 文案：`批量画面未启用`。
- Tooltip：`当前只开放单镜头请求预览，批量生成仍未接入`。
- 不打开弹窗，不创建选择、多任务、费用估算或队列。

### 5.3 DialogHeader

- 宽度：828 px，占弹窗内容宽度 100%。
- 高度：54 px，占弹窗高度约 7.9%。
- 布局：`50 px 图标 + 1fr 标题区 + 36 px 关闭按钮`。
- 图标容器：50 × 50 px，约标题区高度 93%，16 px 圆角。
- 图标：Image/Spark，23 × 23 px，蓝青描边。
- 眉题：`STORYBOARD IMAGE API`，8 px，880，字距 0.16em。
- 标题：`API 生成当前画面`，22 px，760，颜色 `#1D5270`。
- 副标题：`镜头 03 · 月下相逢 · 只使用当前真实分镜数据`，11 px，颜色 `#688B9D`。
- 关闭按钮：36 × 36 px，12 px 圆角；Esc 和背景点击等价关闭。

### 5.4 ProviderStatusGrid

- 宽度：828 px，占内容宽度 100%。
- 高度：92 px，占弹窗高度约 13.5%。
- 四列等宽，每列约 200 px，占父容器约 24.2%；间距 9 px。
- 卡片圆角：15 px；内边距 12 px。
- 背景：`rgba(255,255,255,0.50)`。
- 字段：
  - 图片服务：当前 `providerSettings.image.provider`。
  - 模型：当前配置模型或百炼状态中的图片模型。
  - Key 状态：读取中 / 本地 Key 已接入 / 未找到本地 Key / 读取失败。
  - 调用状态：付费生成已锁定 / 图片执行器未开放。
- 每张卡片底部使用 8 px 说明文本；Endpoint 过长使用单行省略，不展示 Key。
- 当前调用卡必须显示：`本次请求数 0 · 预计消耗 0`。

### 5.5 ShotPreviewPanel

- 宽度：292 px，占弹窗内容宽度约 35.3%。
- 高度：286 px，占弹窗高度约 42%。
- 圆角：18 px；内边距 14 px。
- 标题：`当前镜头`，12 px，760。
- 状态：`已有本地图片` 或 `没有真实镜头图片`。
- 图片区：264 × 164 px，16:10；占面板宽度约 90.4%，占面板高度约 57.3%。
- 图片有真实 Data URL 时：`object-fit: cover`，14 px 圆角，显示文件来源标签。
- 图片为空时：显示 Image 图标、`当前镜头没有真实图片` 和 `可使用提示词与角色参考准备文生图请求`。
- 不渲染 `Art` 作为 API 参考图。
- 图片下方显示真实镜头摘要：景别、运镜、时长、连续性锁状态；每项为短标签。

### 5.6 PromptAndOptionsPanel

- 宽度：522 px，占弹窗内容宽度约 63%；与左栏间距 14 px。
- 高度：286 px，与左侧对齐。
- 圆角：18 px；内边距 14 px。
- 提示词标题：`画面提示词`；右侧显示字符计数。
- Textarea：494 × 134 px，占面板宽度约 94.6%，占面板高度约 46.9%。
- 初始值：当前 `shot.visualPrompt`；为空时只显示空态，不自动虚构内容。
- 最大长度：1500 字符。
- 提供次级按钮：`使用当前设定重建提示词`，复用现有确定性本地方法，不调用网络。
- 选项区三列：
  - 图片尺寸：`1536 × 1024 · 分镜画面`。
  - 生成数量：固定 `1 张`。
  - 水印：`关闭`。
- 所有选项均明确为请求预览值；当前不发送。

### 5.7 ContinuityReferenceStrip

- 宽度：828 px，占弹窗内容宽度 100%。
- 高度：104 px，占弹窗高度约 15.3%。
- 标题：`角色与连续性参考`。
- 右侧计数：`真实参考图 0/3` 至 `3/3`。
- 参考来源：当前镜头 `characterIds` 对应角色中，实际存在 `data:image/*` 的角色图片；最多 3 张。
- 单个参考项：86 × 64 px 图片 + 角色名；图片区域约占卡片高度 72%。
- 有真实图：显示图片和角色名。
- 角色存在但无真实图：显示头像首字和 `无参考图`，不计入请求参考图数量。
- 没有绑定角色：显示 `当前镜头未绑定角色，可在右侧“角色与连续性”中选择`。
- 当前镜头已有图片时，未来图片编辑流程可把它作为第一个基础参考；角色图从剩余名额中选择，总数仍不得超过 3。

### 5.8 CostSafetyNotice

- 宽度：828 px，占内容宽度 100%。
- 高度：62 px，占弹窗高度约 9.1%。
- 图标：Shield/Lock 19 × 19 px。
- 标题：`付费生成已锁定` 或 `图片执行器未开放`。
- 说明：`本次只展示请求配置，不会向百炼发送图片生成请求，也不会消耗额度。`
- 背景：蓝青与淡靛色轻渐变，不使用橙红告警以免与错误态混淆。
- 不显示“免费”“剩余额度”或无法实时核验的费用数字。

### 5.9 DialogActions

- 宽度：828 px；高度 44 px。
- 右对齐，按钮间距 9 px。
- `取消`：124 × 42 px，关闭无副作用。
- `前往图片设置`：144 × 42 px，关闭并进入设置页图片能力。
- `生成已锁定`：144 × 42 px，禁用，显示 Lock 图标。
- 禁用 Tooltip：`图片付费生成未开放，本次不会发送请求`。
- 将来真实生成也必须先经过本地 dry-run 和单独费用确认，不允许直接复用当前按钮绕过确认。

## 6. 真实数据与请求预览映射

弹窗仅派生以下现有数据，不修改 canonical project data：

| 预览字段 | 真实来源 |
| --- | --- |
| episodeId / 剧集 | `selectedEpisode` 与 `episodes` |
| sceneId / 场景 | `activeScene` |
| shotId / 镜头 | `current.id` |
| prompt | `current.visualPrompt` |
| action | `current.action` |
| dialogue | `current.dialogue` |
| size | `current.size` |
| motion | `current.motion` |
| duration | `current.duration` |
| costume | `current.costume` |
| continuityLocked | `current.continuityLocked` |
| character references | `current.characterIds` 对应的真实角色图片 |
| existing shot image | `current.image`，仅当有效 Data URL |
| provider/model/endpoint | `providerSettings.image` 与脱敏百炼状态 |
| request count | 固定 1 |
| watermark | 固定 false |
| willSendRequest | 固定 false |

初始提示词为空时，弹窗应显示“请先填写或重建画面提示词”，不能自动补写剧情。用户在弹窗里的编辑是短生命周期请求草稿；V30 不自动回写镜头提示词，避免取消弹窗仍改变项目。未来可以增加明确的“同步回镜头”操作。

## 7. 状态与交互

### 7.1 正常锁定态

- 当前镜头存在。
- 按钮可点击。
- 弹窗显示真实数据。
- 提交按钮禁用。
- 网络请求数保持 0。

### 7.2 无 Key

- 显示 `未找到本地 Key`。
- 仍允许检查和编辑请求预览。
- 提供 `前往图片设置`。
- 不尝试鉴权或生成。

### 7.3 Key 已接入但付费锁定

- 显示 `本地 Key 已接入`。
- 调用状态显示 `付费生成已锁定`。
- 不读取 Key 内容，不把 Key 放入 Renderer、项目或日志。

### 7.4 无当前镜头

- 工具栏入口禁用。
- Tooltip：`请先创建镜头`。
- 不挂载弹窗。

### 7.5 无提示词

- Textarea 显示真实空态。
- 提供本地“使用当前设定重建提示词”。
- `生成已锁定`仍禁用；未来执行状态下也必须因提示词为空而禁用。

### 7.6 无真实参考图

- 显示角色名和 `无参考图`，参考计数为 0。
- 不显示 `Art`、随机人物或默认城市画面作为参考。
- 文案说明未来将按纯文生图请求处理。

### 7.7 键盘与焦点

- 打开后焦点进入关闭按钮或第一个可编辑字段。
- Tab 焦点限制在弹窗内。
- Esc 关闭并回到工具栏入口。
- 点击遮罩关闭。
- 点击设置跳转不强制恢复旧入口焦点。

### 7.8 小窗口与长文本

- 小于 920 px：弹窗宽 `calc(100vw - 28px)`，两栏改为单栏。
- 小于 620 px：四状态卡改为单列，底部按钮垂直排列。
- 最大高度 `calc(100vh - 28px)`，弹窗内部滚动。
- Prompt、Endpoint、场景名和角色名使用换行或省略，不撑破布局。
- 当前 Windows 应用最小页面宽度仍沿用项目现状，不额外引入移动端导航。

### 7.9 Reduced Motion 与深色模式

- 本弹窗不使用 opacity/scale 入场动画。
- 只保留按钮 hover 的 1 px 位移；系统减少动态时完全关闭 transition。
- 当前项目没有正式深色模式，不伪造反色版本；颜色继续使用明亮天蓝体系。

## 8. React 实现映射

```text
StoryboardPage
├─ local state: storyboardImageApiDialogOpen
├─ ref: storyboardImageApiButtonRef
├─ close and focus restoration
└─ StoryboardImageApiDialog
   ├─ useState: promptDraft
   ├─ useState: size
   ├─ useMemo: requestPreview
   └─ no provider execute call

storyboardImageRequestService.js
├─ createStoryboardImagePromptDraft
├─ collectStoryboardImageReferences
├─ createStoryboardImageRequestPreview
└─ validateStoryboardImageRequestPreview
```

- 页面层只负责展示、弹窗开关和提示词草稿。
- 纯服务负责确定性请求预览、真实参考图识别、数量限制和校验。
- 不向 `providerRegistry.execute('image', ...)` 接线。
- 不新增 preload、IPC、主进程生成方法或网络权限。
- 不修改 `characters`、`shots`、素材库索引和 `.manju` schema。
- “前往设置”复用 V29 的图片能力会话定位方式。

## 9. 中文文案表

| 场景 | 文案 |
| --- | --- |
| 工具栏入口 | API 生成当前画面 |
| 锁定徽标 | 已锁定 |
| 批量入口 | 批量画面未启用 |
| 弹窗标题 | API 生成当前画面 |
| 弹窗副标题 | 只使用当前真实分镜数据准备图片请求 |
| Provider | 图片服务 |
| 模型 | 模型 |
| Key | Key 状态 |
| 调用状态 | 付费生成已锁定 |
| 当前画面 | 当前镜头 |
| 无画面 | 当前镜头没有真实图片 |
| 提示词 | 画面提示词 |
| 重建提示词 | 使用当前设定重建提示词 |
| 角色参考 | 角色与连续性参考 |
| 无角色 | 当前镜头未绑定角色 |
| 角色无图 | 无参考图 |
| 图片尺寸 | 图片尺寸 |
| 数量 | 生成数量 |
| 水印 | 水印 |
| 锁定说明 | 本次只展示请求配置，不会向百炼发送图片生成请求，也不会消耗额度。 |
| 取消 | 取消 |
| 设置 | 前往图片设置 |
| 禁用提交 | 生成已锁定 |

## 10. AI 视觉参考 Prompt

```text
Design a polished Windows desktop storyboard image API request-preview modal for a Chinese manju production application. Use a bright sky-blue gradient glassmorphism design system, luminous cyan highlights, soft cool-blue shadows, thin white glass borders, and a refined lightweight technology aesthetic. The underlying screen is a professional storyboard board with shot cards and a right-side inspector. Center an 880 by 680 pixel modal with four compact provider status cards, a real current-shot preview panel, an editable visual prompt textarea, image size and count controls, a horizontal character continuity reference strip, a clear zero-cost locked notice, and three footer actions. Show only short Simplified Chinese UI labels such as “API 生成当前画面”, “画面提示词”, “角色与连续性参考”, “前往图片设置”, and “生成已锁定”. Make the locked state truthful and calm, not alarming. No fake generation progress, no success image, no pricing claims. No entrance animation; optimize for responsive Windows desktop rendering. Resolution 1440x900, precise production-ready UI, Simplified Chinese UI text, Chinese labels, Chinese desktop application interface.
```

生成图只用于检查布局、层级和视觉方向；中文文案必须在实现中使用真实文本。

## 11. 验收标准

1. 有当前镜头时，“API 生成当前画面”在工具栏首屏可见并可点击。
2. 没有当前镜头时入口真实禁用，不能打开空弹窗。
3. 弹窗显示当前剧集、场景、镜头和实际图片 Provider 状态。
4. 初始提示词等于当前镜头真实 `visualPrompt`，不虚构内容。
5. 只把有效 Data URL 计入镜头图和角色参考图。
6. 参考图总数最多 3；缺图角色不能用 `Art` 冒充。
7. 当前硬锁下提交按钮禁用，远程请求和 Renderer `fetch` 均为 0。
8. 不出现模拟队列、进度、任务 ID、成功结果或无法核验的免费额度。
9. “前往图片设置”自动选中图片能力。
10. Esc、遮罩关闭、Tab 限制和焦点回归正确。
11. 原有本地图片导入、移除、提示词重建、角色连续性和镜头编辑不受影响。
12. 设置页进出性能和分镜页核心回归继续通过。

## 12. 不确定项与明确假设

- 当前百炼图片执行器未接入，因此本稿不设计异步任务轮询和结果下载 UI。
- 分镜目标画幅可能随项目横竖屏变化；首期请求预览沿用技能已记录的 `1536 × 1024`，未来接线前需按模型官方当前参数重新核验。
- 当前场景没有独立真实场景图片字段，因此不把场景 `Art` 加入参考图。
- 当前镜头已有图片时，未来是作为编辑基础图还是覆盖生成，需要在开放真实执行前再次确认。
- 批量生成涉及费用上限、失败重试、部分成功和队列取消，不属于 V30。

## 13. 设计还原评分

- 页面结构识别：99%。
- 现有数据映射：99%。
- 视觉方向：99%。
- 弹窗尺寸估算：95%。
- 未来 API 执行流程：88%，需在付费开放前重新核验模型参数与费用。

所有尺寸均根据现有运行截图和项目 CSS 智能推算。V30 的实现必须以真实运行截图复核 1440 × 900、125% 缩放和无当前镜头状态。

## 14. 等待确认

确认后进入 React / Electron 实现阶段；当前不进入真实百炼图片生成阶段，不产生任何 API 费用。
