# 漫剧创作 V21 本地配音试听台与真实播放进度 Design Spec

## 0. 来源、基准与交付边界

- 产品：Windows 本地优先漫剧制作软件 `漫剧创作`。
- 当前应用版本基线：`1.18.0`；计划实现版本：`1.19.0`。
- 视觉源：`outputs/runtime/voice.png`，运行画布 `1777 × 974 px`；沿用已确认的天蓝渐变、明亮毛玻璃和顶部导航设计系统。
- 真实页面入口：`src/App.jsx` 的 `VoicePage`、`.voice-page` 与 `.audition-bar`。
- 代码证据：底部试听进度固定为 `42%`，时间固定从 `00:00.0` 开始，音量滑块只显示不控制 `Audio`；行播放会创建浏览器 `Audio` 对象，但没有活动台词、播放/暂停、进度、拖动、音量、结束和错误状态。
- 当前可用真实素材：用户导入的本地音频已写入 `line.audio`，并已具备时长探测；该能力是本轮真实试听的唯一音频来源。
- Provider 边界：单条与批量“生成配音”仍使用 Mock 流程；本轮不接入云端语音模型、不发网络请求、不生成真实 TTS 音频。
- 本轮目标：把底部装饰性试听栏升级为真实、可操作、可验证的本地音频试听台，并让右侧 Provider 参数区域明确显示为“接口预留”，不再伪装为已经生效。
- 本轮状态全部为会话态：活动台词、播放状态、当前时间、临时时长、音量、静音和错误不写入 `.manju`。
- 本轮不做：AI 配音、音色市场、真实波形分析、频谱渲染、音频剪辑、变速变调、停顿重写、降噪、响度归一化、跨场景连续播放、导出混音、依赖升级、IPC、权限、`.manju` 格式升级。
- 安全底线：切换台词或离开页面时必须暂停并释放旧播放器；没有本地音频时不得显示假进度或假时长；试听按钮不得隐式触发付费或 Mock 生成任务。
- 视觉源门禁：本文件完成后停止并等待确认；确认前不修改 React、CSS、Service、测试、版本号或安装包。

## 1. 项目设计分析

### 1.1 产品类型

面向漫剧编剧、导演和小型内容团队的 Windows 桌面创作工作台。配音页既承担台词整理和角色分配，也承担本地配音素材导入后的快速质检。试听台必须像一个轻量制作工具，而不是带有固定数字的演示组件。

### 1.2 目标用户

- 18–45 岁的漫剧创作者、配音导演、短剧剪辑师和小型工作室成员。
- 会在一个场景中连续检查多条角色对白，希望少移动鼠标即可切换试听。
- 需要知道当前播放的是哪一条、来自本地还是生成任务、已经播放多久以及是否出错。
- 对外部配音服务敏感，希望在接口未配置时软件明确告知，而不是让参数控件看起来已经生效。

### 1.3 使用场景

- 给某条对白导入本地 MP3、WAV 或 M4A 后立即试听。
- 在同一场景中用上一条/下一条快速检查所有已有本地音频的台词。
- 拖动进度条定位口误、停顿或尾音问题。
- 调整本地试听音量或临时静音，不改写源音频。
- 清楚区分“有真实本地音频”“只有 Mock 任务状态”“尚无音频”三种情况。
- 在 Provider 未接入时查看预留参数，但不会误以为语速、音调、情绪已经应用到本地音频。

### 1.4 核心价值

- 消除固定 `42%`、固定 `00:00.0` 和无效音量条带来的误导。
- 复用已经存在的本地音频导入能力，不增加外部服务、成本或权限。
- 通过明确的播放生命周期避免多条音频同时播放和旧播放器泄漏。
- 为后续真实 Provider 接入保留清晰边界：生成参数属于 Provider，试听控制属于本地播放器。

## 2. 用户画像

| 维度 | 画像 |
| --- | --- |
| 年龄 | 18–45 岁 |
| 职业 | 漫剧编剧、配音导演、剪辑师、AI 内容创作者、小型工作室成员 |
| 使用习惯 | Windows 桌面长时间工作；按场景逐条检查对白；依赖鼠标、空格键和方向键完成高频试听 |
| 主要痛点 | 不知道底部试听栏对应哪条台词；进度和时间是假数据；音量无效；切换后可能继续播放旧音频；Provider 控件看起来可用但实际未接入 |
| 成功标准 | 任意本地音频可真实播放、暂停、拖动和调音量；活动台词清楚；切换无串音；无音频时状态真实；所有 Provider 预留项不误导 |

## 3. 产品视觉方向

### 3.1 设计关键词

`Sky-blue glassmorphism`、`local audio transport`、`truthful states`、`desktop voice workflow`、`compact production controls`、`clear provider boundary`。

### 3.2 视觉原则

- 延续天蓝到浅青渐变背景、白色半透明玻璃卡片、深海军蓝正文和高亮青蓝主操作。
- 真实可用的本地试听控件使用青蓝强调；尚未接入的 Provider 参数使用低对比浅灰蓝、锁图标和说明标签。
- 播放中活动台词使用淡青蓝描边和左侧 `3 px` 状态条，不用大面积高饱和底色打断对白阅读。
- 进度轨道必须显示真实已播放比例；无音频时保持空轨道并显示短文案，不使用随机动画。
- 错误使用珊瑚红图标、文字和可恢复操作；不能只依赖颜色表达。
- 不显示伪波形。当前右侧装饰性波形区域改成“当前试听”状态卡；真实波形分析留到独立版本。
- 动效控制在 `120–180 ms`；播放进度由媒体时间驱动，不做人工缓动或循环假动画。

## 4. 页面整体分析

- 页面：配音页 `VoicePage`。
- 页面类型：三栏配音编辑工作区 + 跨栏本地试听传输条。
- 基准画布：`1777 × 974 px`；目标 Windows 桌面；最小支持宽度 `960 px`。
- 当前代码布局：`.voice-page` 为 `220px minmax(550px, 1fr) 300px`，高度 `calc(100vh - 138px)`；底部 `.audition-bar` 横跨三列。
- 视觉占比：左侧角色栏约屏宽 `12.4%`；中央对白区约 `63.5%`；右侧设置栏约 `16.9%`；间隙与外边距约 `7.2%`。
- 底部试听条推测尺寸：约 `1728 × 72 px`；占屏宽约 `97.2%`、占屏高约 `7.4%`。
- 页面滚动：左侧角色列表独立滚动；中央对白列表独立滚动；右侧设置区独立滚动；底部试听条固定在页面网格末行，不参与三栏滚动。
- Motion：活动行描边、按钮状态和锁定提示使用 `140 ms ease-out`；遵守 `prefers-reduced-motion`。

## 5. 页面结构拆解

```text
VoicePage
├── TopNavigation
├── SpeakerSidebar
│   ├── SpeakerHeader
│   ├── SpeakerList
│   └── MockBatchAssignAction
├── DialogueWorkspace
│   ├── SceneFilter
│   ├── VoiceSummary
│   └── VoiceLineList
│       └── VoiceLineCard
│           ├── ActiveIndicator
│           ├── SpeakerAvatar
│           ├── SpeakerSelector
│           ├── DialogueEditor
│           ├── SourceStatusBadge
│           ├── ImportAudioAction
│           └── GenerateOrPlayAction
├── VoiceInspector
│   ├── InspectorHeader
│   ├── ProviderLockNotice
│   ├── ReservedVoiceSelector
│   ├── ReservedStyleSelector
│   ├── ReservedParameterControls
│   └── CurrentAuditionCard
│       ├── ActiveLineSummary
│       ├── AudioSourceBadge
│       └── LocalAudioReadiness
└── LocalAuditionTransport
    ├── ActiveLineIdentity
    ├── SourceBadge
    ├── SeekTrack
    ├── TimeReadout
    ├── PreviousLocalAudioAction
    ├── PlayPauseAction
    ├── NextLocalAudioAction
    ├── MuteAction
    ├── VolumeSlider
    └── PlaybackErrorMessage
```

## 6. 关键组件设计规格

### 6.1 VoiceLineCard：对白行与活动状态

- 父容器：中央对白列表；单卡宽度约父容器 `100%`，相对整页约 `61%`。
- 高度：普通行约 `94–116 px`，根据台词长度自适应；相对整页约 `9.7%–11.9%`。
- 内边距：水平 `14 px`、垂直 `12 px`；组件间距 `10 px`。
- 圆角：`14 px`；边框 `1 px solid rgba(105, 181, 236, 0.18)`。
- 默认态：白色 `72%–82%` 透明度玻璃底。
- 当前活动态：边框切换为 `rgba(42, 166, 231, 0.72)`；左侧增加 `3 px` 青蓝状态条；背景增加 `rgba(197, 239, 255, 0.32)`。
- 播放态：活动条旁显示 `12 px` 动态声波图标；仅在真实 `playing` 时出现。
- 键盘焦点：`2 px` 外描边，不能与播放态只用同一种颜色表达。
- 交互：
  - 点击卡片空白区域只选择为当前试听台词，不自动播放。
  - 点击输入框、角色选择器或导入按钮时不改变编辑语义；导入成功后自动把该行设为活动台词。
  - 点击真实音频的播放按钮：若不是活动行，先切换活动行，再播放；若正在播放则暂停。
  - 无音频行的右侧主按钮继续承担 Mock 生成动作，但必须使用魔法棒图标和 `演示生成` 提示，不与播放图标混用。

### 6.2 SourceStatusBadge：来源与状态标签

- 位置：每条台词操作区，位于导入按钮左侧或上方。
- 尺寸：高度 `22 px`，水平内边距 `8 px`，最小宽度 `58 px`。
- 字体：`11 px / 16 px`，字重 `600`。
- 状态：
  - `本地音频`：淡青底、深青文字、文件图标。
  - `演示完成`：淡紫蓝底、紫蓝文字、实验烧杯或闪光图标；明确没有真实音频。
  - `未生成`：浅灰蓝底、中性文字、空心圆图标。
  - `读取失败`：淡珊瑚红底、红色文字、警告图标。
- 辅助信息：鼠标悬停或聚焦显示来源说明，不在标签中塞长文案。

### 6.3 ProviderLockNotice：接口参数预留区

- 位置：右侧检查器标题下方，占父容器宽度 `100%`，相对整页约 `16.2%`。
- 高度：约 `62 px`；内边距 `10 px 12 px`；圆角 `12 px`。
- 背景：`rgba(226, 241, 250, 0.74)`；边框 `1 px dashed rgba(91, 151, 190, 0.32)`。
- 内容：锁图标、标题 `配音接口未配置`、说明 `以下参数仅预留，暂不影响本地音频`。
- 控件规则：
  - “更换声音”、声音风格、情绪、语速、音调、停顿全部禁用。
  - 禁用控件保留结构以展示接口能力边界，但透明度不低于 `0.58`，确保文字可读。
  - 每个禁用控件必须有 `aria-disabled="true"` 或原生 `disabled`，鼠标不显示可点击手型。
  - 不保存这些预留值，不让默认值看起来像已经生效的当前设置。

### 6.4 CurrentAuditionCard：右侧当前试听状态卡

- 替换范围：替换现有装饰性波形预览，不做伪波形。
- 尺寸：父容器宽度 `100%`，高度约 `132 px`；相对整页约 `16.2% × 13.6%`。
- 背景：白色 `70%` 毛玻璃；圆角 `14 px`；阴影 `0 10px 24px rgba(42, 118, 168, 0.08)`。
- 内容：
  - 标题 `当前试听`。
  - 角色头像 `32 px` 与角色名称。
  - 最多两行台词摘要，超长省略；悬停显示完整文本。
  - 来源标签：`本地音频`、`暂无真实音频` 或 `读取失败`。
  - 次级信息：`时长 00:02.7` 或 `导入音频后可试听`。
- 状态：没有活动台词时显示空态 `选择一条台词开始检查`，不显示空头像和假数据。

### 6.5 LocalAuditionTransport：底部真实试听台

- 位置：页面主网格最后一行，横跨三列。
- 尺寸：宽度 `100%`；最小高度 `76 px`，错误态可扩展到 `96 px`。
- 相对整页：宽约 `97.2%`，高约 `7.8%–9.9%`。
- 内边距：`12 px 16 px`；列间距 `12 px`。
- 背景：`linear-gradient(115deg, rgba(255,255,255,.88), rgba(225,247,255,.76))` + `backdrop-filter: blur(22px)`。
- 边框：`1 px solid rgba(116, 199, 238, 0.28)`；圆角 `16 px`。
- 阴影：`0 14px 34px rgba(40, 128, 180, 0.12)`。
- 桌面网格建议：
  - 身份区 `minmax(220px, 0.95fr)`。
  - 进度区 `minmax(300px, 2.2fr)`。
  - 时间区 `106 px`。
  - 传输控制区 `132 px`。
  - 音量区 `142 px`。
- 禁止使用固定 `42%` 或任何随机进度；轨道宽度只能由 `currentTime / duration` 决定。

### 6.6 ActiveLineIdentity：活动台词身份区

- 相对试听条宽度约 `18%–24%`；高度 `48 px`。
- 头像：`38 × 38 px`；相对身份区高度约 `79%`。
- 文本：第一行角色名，`13 px`、`600`；第二行台词，`12 px`、最多一行省略。
- 来源标签：紧邻角色名，避免只靠底部提示判断来源。
- 无活动台词：显示小型音频图标和 `选择一条台词`，其他控制统一禁用。

### 6.7 SeekTrack：真实进度与拖动轨道

- 父容器：进度区；宽度 `100%`，可点击高度至少 `28 px`。
- 视觉轨道：高度 `4 px`；圆角 `999 px`；背景 `rgba(83, 148, 187, 0.18)`。
- 已播放轨道：`linear-gradient(90deg, #34A8E8, #73D6F4)`。
- 拖动手柄：默认 `10 px`，悬停/拖动 `14 px`；白色中心、青蓝描边和柔和阴影。
- 无音频：轨道保持中性灰蓝，手柄隐藏；上方短提示 `当前台词没有可试听音频`。
- 加载中：允许显示真实媒体加载状态的轻量脉冲，但不得改变进度值。
- 错误态：轨道左侧显示警告图标，文本 `音频读取失败，请重新导入`。
- 交互：
  - 点击轨道跳转到对应时刻。
  - 拖动期间即时更新预览时间；释放后设置真实 `currentTime`。
  - 进度计算必须 clamp 到 `0–duration`；`duration` 无效或为零时禁用拖动。
  - 结束时进度停在末尾并切换为 `ended`；再次播放从 `0` 开始。

### 6.8 TimeReadout：时间显示

- 宽度：`106 px`；右对齐；等宽数字。
- 字体：`12 px / 18 px`，`font-variant-numeric: tabular-nums`。
- 格式：`mm:ss.d / mm:ss.d`；不足 10 分钟仍保留两位分钟，如 `00:02.7`。
- 无音频：`--:--.- / --:--.-`。
- 加载中：当前时间保持 `00:00.0`，总时长显示 `读取中`，不使用猜测时长。
- 临时媒体时长以 `loadedmetadata` 的真实值为准；只用于试听，不静默回写项目字段。

### 6.9 TransportControls：上一条、播放/暂停、下一条

- 三个按钮组成紧凑控制组，整体约 `124 × 44 px`。
- 主播放按钮：`40 × 40 px`，圆形青蓝渐变；播放图标和暂停图标严格对应真实状态。
- 上一条/下一条：`32 × 32 px`，玻璃次级按钮。
- 切换范围：仅在当前筛选后的可见台词中，按顺序寻找具有 `line.audio` 的上一条或下一条。
- 切换行为：先暂停当前音频、释放监听器、选择目标行，再等待用户点击播放；不自动连播。
- 边界：没有上一条/下一条本地音频时按钮禁用，并提供可访问名称。
- 空态：无活动音频时三个按钮全部禁用，不把播放按钮变成“生成配音”。

### 6.10 VolumeControls：静音与音量

- 整体宽度约 `136 px`；图标按钮 `32 px`；滑轨最小宽度 `88 px`。
- 音量范围：`0–100` 映射为媒体对象 `0–1`，默认 `60`。
- 音量只影响当前试听播放器，不改写音频文件，不进入 `.manju`。
- 静音：点击后记住上一个非零音量；再次点击恢复。若用户手动拖到 `0`，图标显示静音。
- 切换台词时保留本次页面会话音量；刷新应用后恢复默认 `60`。
- 键盘：音量滑块使用原生方向键行为，并带 `aria-valuetext="音量 60%"`。

## 7. 页面与组件占比表

| 区域/组件 | 相对父容器 | 相对整页 | 关键尺寸 |
| --- | --- | --- | --- |
| SpeakerSidebar | `100% × 100%` | 约 `12.4% × 70%` | 代码列宽 `220 px` |
| DialogueWorkspace | `100% × 100%` | 约 `63.5% × 70%` | `minmax(550px, 1fr)` |
| VoiceInspector | `100% × 100%` | 约 `16.9% × 70%` | 代码列宽 `300 px` |
| VoiceLineCard | 中央区 `100% × auto` | 约 `61% × 9.7%–11.9%` | 高 `94–116 px` |
| ProviderLockNotice | 右栏 `100% × auto` | 约 `16.2% × 6.4%` | 高约 `62 px` |
| CurrentAuditionCard | 右栏 `100% × auto` | 约 `16.2% × 13.6%` | 高约 `132 px` |
| LocalAuditionTransport | 主网格 `100%` | 约 `97.2% × 7.8%–9.9%` | 最小高 `76 px` |
| ActiveLineIdentity | 试听条 `18%–24%` | 约 `18%–23% × 4.9%` | 高 `48 px` |
| SeekTrack 可点击区 | 进度区 `100% × 28 px` | 约 `30%–42% × 2.9%` | 轨道高 `4 px` |
| TimeReadout | 固定列 | 约 `6% × 2%` | 宽 `106 px` |
| TransportControls | 固定列 | 约 `7.4% × 4.5%` | `124 × 44 px` |
| VolumeControls | 固定列 | 约 `8.1% × 3.3%` | 宽 `136 px` |

## 8. 本地播放状态模型

### 8.1 会话态

```text
activeLineId: string | null
status: idle | loading | playing | paused | ended | error
currentTime: number
duration: number
volume: number          // 0–1，默认 0.6
muted: boolean
lastNonZeroVolume: number
errorMessage: string
```

### 8.2 状态边界

- `line.audio` 仍是是否存在真实本地音频的唯一项目数据依据。
- `line.status === completed` 不能证明存在真实音频；当没有 `line.audio` 时必须显示 `演示完成` 而不是 `可播放`。
- `Audio` 实例、事件监听器和播放进度属于 `VoicePage` 生命周期，不进入全局项目模型。
- 活动行切换不会修改台词内容、角色、状态或项目脏标记。
- 导入成功沿用现有项目保存逻辑；只选择和试听不会触发项目保存。
- 媒体对象解析出的临时时长只为播放 UI 服务；导入流程已有的 `line.duration` 继续按现有逻辑保存。

### 8.3 播放状态机

```text
idle
  └─ select local audio -> paused(currentTime=0)
paused
  ├─ play -> loading/playing
  ├─ seek -> paused(new currentTime)
  └─ switch line -> paused(new line, currentTime=0)
loading
  ├─ canplay/play -> playing
  ├─ pause -> paused
  └─ media error -> error
playing
  ├─ pause -> paused
  ├─ seek -> playing(new currentTime)
  ├─ ended -> ended
  └─ media error -> error
ended
  ├─ play -> playing(currentTime=0)
  ├─ seek -> paused(new current time)
  └─ switch line -> paused(new line)
error
  ├─ reselect/reload -> loading
  └─ import replacement -> paused(new local audio)
```

## 9. 核心交互规则

### 9.1 选择与播放

1. 点击台词卡空白区，把该台词设为活动台词。
2. 若该台词有 `line.audio`，试听台读取真实媒体元数据，停在 `00:00.0`，不自动播放。
3. 点击行内播放或底部播放后，状态才进入 `loading/playing`。
4. 再次点击播放按钮进入 `paused`，保留当前位置。
5. 选择另一条台词前先暂停并清理旧 `Audio` 事件；新台词不自动续播。
6. 没有 `line.audio` 的台词可被选择，但试听条明确显示 `暂无真实音频`，播放、拖动和切换控制按规则禁用。

### 9.2 生成与试听分离

- 无本地音频时，行内魔法棒按钮仍执行现有 Mock 生成流程，并标注 `演示生成`。
- 底部播放按钮永远只负责播放真实 `line.audio`，绝不触发生成任务。
- Mock 任务完成但没有真实音频时显示 `演示完成 · 无音频`。
- 导入本地音频成功后，来源状态优先显示 `本地音频`，并立即成为活动台词。

### 9.3 进度与定位

- 播放进度以媒体 `currentTime` 和 `duration` 为唯一来源。
- `timeupdate` 负责稳定同步；播放时可用 `requestAnimationFrame` 平滑视觉进度，但必须在暂停、结束、错误和卸载时取消。
- 点击或拖动进度轨道调用真实 seek，不做视觉上的假跳转。
- `duration` 为 `NaN`、`Infinity` 或小于等于零时，时间和拖动控件进入不可用状态。

### 9.4 上一条/下一条

- 只在当前场景过滤结果和当前角色过滤结果中查找带真实音频的台词。
- 到达首尾时按钮禁用；不循环播放。
- 切换后滚动活动行进入中央列表可见区域，使用 `block: nearest`，避免剧烈跳动。

### 9.5 生命周期与失败恢复

- 离开配音页、切换项目或组件卸载：暂停、移除监听器、取消动画帧、释放播放器引用。
- 播放被浏览器策略拒绝：状态进入 `error`，提示 `无法开始播放，请再次点击`。
- 解码失败或 Data URL 损坏：提示 `音频读取失败，请重新导入`，提供导入入口，不自动删除原字段。
- 切换到新音频时旧音频不得继续发声。
- 同一时刻最多存在一个活动播放器。

## 10. Provider 接口预留边界

- 右侧音色、风格、情绪、语速、音调和停顿属于未来 TTS Provider 请求参数。
- 在 Provider 未配置前统一禁用，不能影响本地导入音频，也不能假装改变试听结果。
- “更换声音”改为禁用按钮，说明 `连接配音接口后可用`。
- 单条和批量生成仍保留 Mock 能力，但视觉上标注 `演示`；本轮不改 Provider Service、不增加设置页密钥表单。
- 本地试听组件只消费 `line.audio`；未来真实 Provider 完成后，只要把真实音频写入同一字段即可复用试听台。
- 不记录、不读取任何 API Key、账号、模型、计费或网络配置。

## 11. 可访问性与键盘交互

- 活动台词卡使用 `aria-current="true"` 或等价语义。
- 播放按钮动态可访问名称：`播放《台词摘要》` / `暂停《台词摘要》`。
- 空格键：焦点不在输入框、下拉框或按钮内时，播放/暂停当前本地音频。
- 左右方向键：进度条聚焦时每次后退/前进 `0.1 s`；按住 `Shift` 时 `0.5 s`。
- `Home` 跳到 `0`；`End` 跳到结尾。
- 音量滑块使用原生键盘行为；静音按钮动态命名为 `静音` / `恢复音量`。
- 状态变化通过 `aria-live="polite"` 播报 `正在播放`、`已暂停`、`播放结束` 和错误，不播报每一次时间更新。
- 所有图标按钮可点击区域至少 `32 × 32 px`；主播放按钮至少 `40 × 40 px`。
- 色彩对比：正文至少 `4.5:1`；禁用说明至少 `3:1`；活动态同时使用描边、状态条和文字/图标。

## 12. 完整状态清单

| 状态 | 中央台词行 | 右侧状态卡 | 底部试听台 |
| --- | --- | --- | --- |
| 未选择 | 全部默认 | `选择一条台词开始检查` | 身份占位，控制禁用 |
| 已选但无音频 | 活动描边 + `未生成/演示完成` | `暂无真实音频` | 空轨道、无假时间、播放禁用 |
| 本地音频就绪 | 活动描边 + `本地音频` | 显示角色、台词、真实时长 | `paused`，时间从零开始 |
| 加载中 | 活动描边 + 加载图标 | `正在读取音频` | 播放按钮 loading，进度不伪造 |
| 播放中 | 活动状态条 + 声波图标 | `正在播放` | 真实进度、暂停图标 |
| 已暂停 | 活动描边 | `已暂停` | 保留进度、播放图标 |
| 播放结束 | 活动描边 | `播放结束` | 进度在末尾，再播从零开始 |
| 读取失败 | 红色状态图标 + `读取失败` | 错误说明与重新导入入口 | 错误文案，播放/拖动禁用 |
| Provider 未配置 | 生成入口标 `演示` | 参数锁定说明 | 本地试听不受影响 |
| 超长台词 | 两行/输入区正常编辑 | 两行省略 + tooltip | 单行省略，角色名保持可见 |
| 小屏 | 三栏按现有规则压缩/换行 | 锁定说明不遮挡控件 | 试听台分两行，不横向溢出 |
| 暗色模式 | 深蓝玻璃底、青色活动条 | 深蓝信息底 | 深色轨道，文字对比达标 |

## 13. 响应式、暗色与系统适配

### 13.1 宽度断点

- `≥ 1440 px`：试听台保持单行六区布局。
- `1180–1439 px`：身份区缩至 `200 px`，时间区 `92 px`，音量滑轨 `76 px`。
- `960–1179 px`：试听台改为两行；第一行身份 + 控制 + 音量，第二行进度 + 时间；高度约 `108–118 px`。
- `< 960 px`：不作为本轮主交付目标；保持现有应用最小宽度策略，不允许控件重叠或离开可视区。

### 13.2 暗色模式

- 页面底色：深海军蓝到蓝黑渐变。
- 玻璃面板：`rgba(19, 47, 70, 0.72)`；边框 `rgba(118, 205, 245, 0.22)`。
- 主文字：`#EAF8FF`；次级文字：`#A9C8D8`。
- 轨道底：`rgba(176, 219, 239, 0.20)`；已播放轨道保持青蓝渐变。
- Provider 禁用区仍需可读，不能只降低整体透明度。

### 13.3 Windows 与浏览器媒体边界

- 使用 Chromium/Electron 原生 `Audio` 能力，不新增 native 模块。
- 遵守媒体播放必须由用户手势触发的限制。
- 不假设所有文件扩展名都能解码；错误通过真实媒体事件反馈。
- Data URL 音频仍受当前项目 `3 MB` 导入上限约束；本轮不扩大上限。

## 14. 英文 AI 设计图 Prompt

### 页面名称：Voice Production — Local Audio Audition Transport

**Prompt**

```text
Design a high-fidelity Windows desktop application screen for a local-first manhua drama production studio, focused on voice dialogue editing and real local audio audition. Use a bright futuristic sky-blue gradient background with premium white glassmorphism panels, subtle cyan glow, soft layered shadows, crisp navy typography, and restrained aqua accents.

UI Design: professional desktop creative tool, truthful media states, dense but calm production workflow, no dark black panels, no purple-dominant palette, no fake audio waveform, no decorative random progress.

Layout: 1777x974 desktop canvas, top navigation for Script, Characters, Storyboard, Voice, Video; three-column workspace below. Left column is a compact speaker list with avatars and dialogue counts. Center column is a scrollable list of editable dialogue cards. One dialogue card is clearly active with a thin cyan border and a 3px status rail. Right column contains a glass voice inspector with a visible locked notice saying the cloud voice provider is not configured, disabled reserved controls for voice style, emotion, speed, pitch and pause, plus a truthful Current Audition card.

Bottom Transport: a full-width glass local audio audition bar spanning all columns. Include active character avatar, character name, a one-line dialogue excerpt, a small Local Audio source badge, a real seek rail with cyan elapsed progress and draggable handle, real time display like 00:01.2 / 00:02.7, previous local clip, play/pause, next local clip, mute button and volume slider. Make all controls visually production-ready and accessible. Show a secondary state reference for No Real Audio where the track is empty and controls are disabled.

Components: avatar chips, editable dialogue fields, source status badges for Local Audio / Demo Complete / Not Generated, import audio button, mock generation button labeled as demo, provider lock notice, current audition summary card, accessible media transport controls, precise disabled states, compact tooltips.

Style: sky-blue and pale cyan gradients, luminous white frosted glass, 16px rounded cards, thin blue borders, subtle depth, refined desktop SaaS aesthetics, premium but practical, consistent spacing and grid alignment.

Lighting: soft daylight glow from the upper left, gentle cyan refraction through glass, no harsh neon, no heavy bloom.

Animation: suggest subtle 140ms hover transitions, a real media-driven progress indicator, a minimal playing state icon, reduced-motion friendly; do not show looping fake equalizer animation.

Resolution: 1777x974, high fidelity, pixel-sharp desktop UI, realistic spacing, production-ready visual hierarchy.

Simplified Chinese UI text, Chinese labels, Chinese desktop app interface. Only render short Chinese titles, navigation labels, buttons, status badges and brief helper text. Do not render long Chinese paragraphs. Suggested labels: 配音, 对白列表, 配音设置, 配音接口未配置, 当前试听, 本地音频, 演示完成, 未生成, 导入音频, 播放, 暂停, 选择一条台词.
```

## 15. 中文文案表

| 区域 | 类型 | 文案 |
| --- | --- | --- |
| 配音页 | 页面标题 | 配音工作台 |
| 中央栏 | 分区标题 | 对白列表 |
| 台词来源 | 标签 | 本地音频 |
| 台词来源 | 标签 | 演示完成 |
| 台词来源 | 标签 | 未生成 |
| 台词来源 | 错误标签 | 读取失败 |
| 台词操作 | 按钮 | 导入音频 |
| 台词操作 | 按钮/提示 | 演示生成 |
| 右侧栏 | 标题 | 配音设置 |
| Provider | 锁定标题 | 配音接口未配置 |
| Provider | 锁定说明 | 以下参数仅预留，暂不影响本地音频 |
| Provider | 禁用按钮提示 | 连接配音接口后可用 |
| 当前试听 | 标题 | 当前试听 |
| 当前试听 | 空态 | 选择一条台词开始检查 |
| 当前试听 | 无音频 | 导入音频后可试听 |
| 当前试听 | 加载态 | 正在读取音频 |
| 当前试听 | 播放态 | 正在播放 |
| 当前试听 | 暂停态 | 已暂停 |
| 当前试听 | 结束态 | 播放结束 |
| 底部试听台 | 空态 | 选择一条台词 |
| 底部试听台 | 无音频 | 当前台词没有可试听音频 |
| 底部试听台 | Mock 说明 | 演示完成 · 无真实音频 |
| 播放错误 | 错误提示 | 无法开始播放，请再次点击 |
| 解码错误 | 错误提示 | 音频读取失败，请重新导入 |
| 传输控制 | 可访问名称 | 上一条本地音频 |
| 传输控制 | 可访问名称 | 播放当前音频 |
| 传输控制 | 可访问名称 | 暂停当前音频 |
| 传输控制 | 可访问名称 | 下一条本地音频 |
| 音量控制 | 可访问名称 | 静音 |
| 音量控制 | 可访问名称 | 恢复音量 |

## 16. React / Electron 实现映射

### 16.1 文件建议

- `src/services/voiceAuditionService.js`
  - 纯函数：时间格式化、音量 clamp、媒体时长合法性判断、可见本地音频索引查找。
  - 不持有 `Audio` 实例，不访问 Provider，不写项目数据。
- `src/App.jsx`
  - `VoicePage` 持有活动台词和播放会话状态。
  - 使用一个 `Audio` 引用和集中清理函数，绑定 `loadedmetadata`、`play`、`pause`、`timeupdate`、`ended`、`error`。
  - 将当前行播放按钮和底部试听台绑定到同一状态源。
  - Provider 参数控件设为真实禁用，并增加锁定说明。
- `src/App.css`
  - 活动台词、来源标签、锁定说明、当前试听卡、真实进度条、传输控制和两行断点样式。
- `scripts/test-voice-audition-service.mjs`
  - 覆盖格式化、合法时长、进度 clamp、前后可播放台词选择。
- `scripts/test-voice-audition-ui.mjs`
  - 覆盖无音频、真实音频、播放/暂停、seek、音量、切换和错误清理。
- `scripts/capture-voice-audition.mjs`
  - 截图至少覆盖：本地音频暂停态、播放中、无真实音频、Provider 锁定态。
- `package.json`
  - 实现完成并验证后将版本从 `1.18.0` 升为 `1.19.0`；本设计阶段不修改。

### 16.2 组件职责边界

- `VoicePage`：UI 状态和媒体生命周期协调。
- `VoiceLineCard`：编辑台词、显示来源、选择与触发操作；不自行创建第二个播放器。
- `LocalAuditionTransport`：展示统一播放器状态并发出 play/pause/seek/volume/switch 意图。
- `voiceAuditionService`：确定性工具函数；不负责网络、文件导入或项目持久化。
- 现有项目模型：继续负责 `line.audio` 与 `line.duration` 保存，不增加播放状态字段。
- Mock Provider：保持现有边界，不因试听改造变成真实服务。

### 16.3 不改动区域

- 不修改 Electron IPC 和文件菜单语义。
- 不改变 `.manju` 文档版本或迁移规则。
- 不修改视频合成、分镜、角色、场景元数据和最终页播放逻辑。
- 不新增 NPM 依赖，不修改 lockfile，不引入 Web Audio API 分析库。
- 不实现真实 Provider、密钥设置、账号登录或付费请求。

## 17. 验证计划

### 17.1 静态与构建

- `npm run lint`：应为 `passed`。
- `npm run build`：应为 `passed`。
- `npm run test:voice-audition` 或等价独立脚本：应为 `passed`。
- 现有全量项目回归：应为 `passed`，确保 V20 场景元数据和既有文档流转未受影响。

### 17.2 UI 自动化

- 打开配音页，未选择台词时底部控制全部禁用。
- 选择无音频台词，底部显示真实空态，不出现 `42%` 或伪时长。
- 导入测试音频后自动成为活动台词，并显示真实总时长。
- 点击播放后按钮变暂停，进度和当前时间随真实播放推进。
- 点击暂停后进度停止；再次播放从暂停点继续。
- 点击轨道中点后媒体位置接近总时长 `50%`，允许浏览器时间精度误差。
- 调整音量后媒体对象 `volume` 实际变化；静音/恢复符合上次非零音量。
- 切换到另一条本地音频后旧音频停止，活动行和试听台同步。
- 上一条/下一条只在当前可见本地音频中移动，首尾正确禁用。
- 错误音频进入错误态，不崩溃、不无限 loading。
- Provider 参数全部不可交互且说明可见。

### 17.3 运行截图

- `outputs/runtime/voice-audition-ready.png`：本地音频已选、暂停态。
- `outputs/runtime/voice-audition-playing.png`：真实播放进度态。
- `outputs/runtime/voice-audition-empty.png`：无真实音频态。
- 截图基准画布：`1777 × 974 px`；确认底部条不遮挡三栏滚动内容。

### 17.4 安装包与运行

- 完成代码与回归后再执行 Windows 打包。
- 验证 `win-unpacked` 应用可启动，配音页可进入，媒体播放行为与开发模式一致。
- 安装包签名状态如未配置证书，应明确记录为 `NotSigned`，不得冒充已签名。

## 18. 组件树

```text
VoicePage
├── SpeakerSidebar
│   └── SpeakerItem[]
├── DialogueWorkspace
│   ├── SceneSelector
│   └── VoiceLineCard[]
│       ├── ActiveIndicator
│       ├── SpeakerSelect
│       ├── DialogueInput
│       ├── SourceStatusBadge
│       ├── ImportAudioButton
│       └── MockGenerateOrLocalPlayButton
├── VoiceInspector
│   ├── ProviderLockNotice
│   ├── ReservedVoiceControls(disabled)
│   └── CurrentAuditionCard
└── LocalAuditionTransport
    ├── ActiveLineIdentity
    ├── SeekTrack
    ├── TimeReadout
    ├── PreviousButton
    ├── PlayPauseButton
    ├── NextButton
    ├── MuteButton
    └── VolumeSlider
```

## 19. 设计置信度

- 页面结构：`98%`，来自真实 `VoicePage`、CSS 网格和运行截图。
- 视觉系统：`97%`，沿用此前已确认的天蓝渐变毛玻璃方向。
- 交互模型：`98%`，本地音频字段、时长探测和原生 `Audio` 播放已经存在。
- Provider 边界：`99%`，用户明确要求暂不接入并预留接口。
- 响应式尺寸：`92%`，需要实现后在 `1180 px` 和 `960 px` 视口做截图复核。

## 20. 假设与不确定项

- 假设本轮只解决配音页的本地试听真实性，不实现真实 TTS Provider。
- 假设导入音频继续使用当前 `3 MB` 上限和现有 Data URL 保存方式。
- 假设音量属于页面会话偏好，不写入项目，也不跨重启保存。
- 假设上一条/下一条只遍历当前筛选范围中有真实本地音频的台词，不自动连播。
- 假设点击台词卡只选择不自动播放，符合桌面媒体工具的可控性和浏览器用户手势边界。
- 当前截图无法证明系统缩放比例，像素值以代码布局和 `1777 × 974` 运行画布共同推算；实现后需按实际截图微调。
- 当前没有真实波形数据，因此本轮明确移除伪波形，不推断音频振幅。

## 21. 等待确认

本设计稿完成后停在设计阶段。确认后进入 React / Electron 实现阶段：先实现单播放器状态与纯函数测试，再接入活动台词、真实进度、seek、音量、切换和 Provider 锁定态，最后完成 UI 回归、运行截图、版本升级与 Windows 安装包验证。
