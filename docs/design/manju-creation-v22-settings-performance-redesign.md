# 漫剧创作 V22 设置页性能与视觉重构设计稿

> 文档状态：已确认、已实现并完成验证（2026-07-22）  
> 目标版本：1.20.0  
> 设计范围：Windows Electron 应用「设置页」  
> 主任务分类：页面与布局  
> 副任务分类：稳定性与性能  

## 1. 来源与设计基准

### 1.1 项目定位

本项目是一款面向 Windows 桌面的漫剧制作软件，核心工作流覆盖剧本、角色、分镜、配音和视频。当前 AI 服务尚未正式接入，设置页只允许提供真实、可替换的接口配置边界和演示状态，不得将演示结果描述为真实联网能力。

### 1.2 视觉与代码来源

- 当前运行截图：`outputs/runtime/settings.png`
- 当前页面组件：`src/App.jsx` 中的 `SettingsPage`
- 当前样式：`src/App.css` 中的 `.settings-page`、`.provider-card`、`.glass` 等规则
- 当前版本基线：1.19.0
- 用户确认的卡顿触发点：进入设置页、退出设置页
- 用户确认的改造范围：设置页

### 1.3 参考画布

- 设计画布：1777 × 974 px，对应当前 Windows 运行截图
- 主内容安全区：顶部应用栏以下，约 `y = 112 px`
- 页面左右安全边距：约 44 px，占整页宽度 2.48%
- 页面底部安全边距：约 24 px，占整页高度 2.46%
- 主要缩放适配：100%、125%、150% Windows 显示缩放
- 最小有效窗口：1280 × 720 px
- 推荐窗口：1440 × 900 px 及以上

### 1.4 本轮边界

- 重做设置页布局、视觉层级和进出场性能。
- 保留现有顶部应用栏、整体天蓝渐变产品方向和项目导航结构。
- 保留四类能力：剧本、图像、配音、视频。
- 保留演示模式、测试连接、保存配置的交互语义。
- AI Provider 暂不接入，不发起真实外部请求，不新增付费调用。
- 不修改主进程、IPC、文件格式、项目存储语义、全局导航和安装逻辑。
- 本文档确认前不进入代码实现。

## 2. 现状诊断

### 2.1 进入和退出时卡顿的主要证据

当前设置页在一次挂载中同时生成以下高成本视觉层：

1. 左侧设置导航毛玻璃层 1 个。
2. 四个 Provider 大型毛玻璃表单 4 个。
3. 右侧演示模式和安全提示毛玻璃层 2 个。
4. 底部连接日志毛玻璃层 1 个。
5. 顶部栏及应用背景仍存在额外模糊和阴影。

设置页自身至少有 8 个大面积 `.glass` 容器，而 `.glass` 使用 `backdrop-filter: blur(26px) saturate(140%)` 和大范围阴影。页面进入时浏览器需要同时创建这些合成层，退出时又要销毁；应用背景还有两个带 `filter: blur(80px)` 的大面积固定光斑，进一步增加 GPU 合成开销。

当前四套 Provider 配置表单始终同时挂载，约包含：

- 16 个输入控件；
- 8 个操作按钮；
- 4 组状态、标题和说明；
- 多组网格、阴影、边框和响应式计算。

因此，进入和退出卡顿更符合「大面积滤镜层创建/销毁 + 高密度 DOM 同步挂载 + 整页重新布局」的特征，而不是接口或网络请求问题。

### 2.2 视觉问题

- 三列布局同时争夺注意力，视觉焦点不清晰。
- 四张大表单完全重复，页面过长，首次进入信息量过载。
- 天蓝色使用面积过大，亮度接近，层级主要依赖阴影而非结构。
- 每个区域都使用毛玻璃，导致材质失去重点，并增加渲染成本。
- 左侧「通用 / 项目存储 / AI 接口 / 导出」看似可点击，但当前没有真实页面切换，属于误导性入口。
- 右侧提示卡和底部静态日志挤压核心配置区，却没有形成真实的状态反馈闭环。
- 表单标签、状态、按钮和说明密度接近，缺少明显的主次关系。

### 2.3 体验问题

- 用户只配置一种能力时，仍被迫浏览全部四套表单。
- 保存后缺少明确的「已保存 / 有未保存修改」区分。
- 测试连接结果与具体 Provider 的关联不够紧密。
- 日志为静态展示，无法准确解释用户刚才执行的操作。
- 页面没有为键盘切换 Provider、减少动态效果等桌面场景提供清晰规则。

## 3. V22 目标

### 3.1 核心目标

将设置页从「四个重复配置表单堆叠」改为「轻量 Provider 控制中心」：一次只渲染一个 Provider 的表单，用清晰的状态卡切换能力，并把安全说明与本次会话日志整合到固定侧栏。

### 3.2 成功标准

- 进入设置页不出现明显停顿或整页闪烁。
- 退出设置页导航反馈立即发生，不等待模糊层释放。
- 同一时刻只挂载一个 Provider 的输入表单。
- 设置页大面积毛玻璃层不超过 2 个。
- 页面首屏完整展示 Provider 选择、当前配置、状态和主要操作。
- 不出现可点击但无结果的假入口。
- 所有状态都如实区分「演示模式」「未配置」「测试中」「测试完成」。
- 保留未来接入真实 Provider 的替换接口，不改变当前本地演示边界。

## 4. 设计方向

### 4.1 视觉关键词

- Sky-blue gradient control center
- Calm futuristic workspace
- Lightweight frosted shell
- Crisp solid panels
- Clear operational hierarchy
- Desktop productivity UI
- Low-composition-cost visuals

### 4.2 视觉原则

1. 毛玻璃只用于最外层设置容器和少量浮动反馈，不用于每张卡片。
2. 内容卡使用轻透明实色背景和 1 px 冷蓝边框，不再使用 `backdrop-filter`。
3. 以深海军蓝文字建立层级，天蓝渐变仅用于选中态、主按钮和小面积光晕。
4. 阴影收敛为短距离、低透明度，避免 40–60 px 大扩散阴影。
5. 页面切换只动画外层容器的 `opacity` 和 `transform`，不动画 blur、shadow 或尺寸。
6. 视觉精致感来自比例、留白、排版和状态，而不是叠加更多特效。

## 5. 新信息架构

```text
设置页
├─ 页面标题区
│  ├─ 标题：AI 接口设置
│  ├─ 说明：配置各生产环节的服务接口
│  └─ 总状态：4 项能力 / 演示模式
├─ Provider 快速选择区
│  ├─ 剧本生成
│  ├─ 图像生成
│  ├─ 配音生成
│  └─ 视频生成
├─ 主配置区
│  ├─ 当前 Provider 标题与状态
│  ├─ Provider / 模型 / Base URL / API Key
│  ├─ 未保存状态提示
│  └─ 测试连接 / 保存配置
└─ 状态侧栏
   ├─ 本地优先与密钥安全说明
   ├─ 四项能力状态总览
   └─ 本次会话日志（可折叠）
```

移除当前左侧的假设置分类导航。V22 只展示当前真实存在的 AI 接口设置能力，不用未实现的「通用 / 项目存储 / 导出」制造虚假完整感。未来这些功能具备真实内容后，再恢复为可操作分类。

## 6. 页面布局规格

### 6.1 整体页面

| 区域 | x% | y% | width% | height% | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| 设置页内容安全区 | 2.48 | 12.32 | 95.04 | 84.60 | 顶部栏以下，页面不整体横向滚动 |
| 设置主壳层 | 0 | 0 | 100 | 100 | 唯一大面积毛玻璃层，内部使用实色卡 |
| 标题区 | 2.0 | 2.3 | 96.0 | 10.5 | 标题、说明、总状态 |
| Provider 选择区 | 2.0 | 14.5 | 96.0 | 14.0 | 四个等宽状态卡 |
| 主内容区 | 2.0 | 30.5 | 96.0 | 66.5 | 左侧配置 + 右侧状态 |

像素参考：设置主壳层约 `1688 × 824 px`，圆角 28 px，内边距 28–32 px。

### 6.2 标题区

- 相对父容器宽度：100%。
- 左侧标题组：约 72%。
- 右侧状态胶囊：约 28%，右对齐。
- 标题字号：24 px，行高 32 px，字重 700。
- 说明字号：13 px，行高 20 px，字重 400。
- 标题与说明间距：6 px。
- 总状态胶囊高度：34 px，圆角 17 px。
- 标题区不使用阴影和独立毛玻璃。

### 6.3 Provider 快速选择区

- 使用 4 列等宽网格。
- 卡片间距：12 px。
- 单卡相对选择区宽度：约 24.2%。
- 单卡高度：88–96 px。
- 内边距：16 px。
- 卡片圆角：18 px。
- 图标容器：36 × 36 px，占单卡高度约 40%。
- 图标本体：18 × 18 px，占图标容器 50%。
- 标题字号：14 px，字重 650。
- 状态字号：12 px，字重 500。
- 选中态：2 px 渐变边框、浅天蓝底、顶部 2 px 光带。
- 未选中态：1 px 冷蓝边框、近白实色背景，无模糊。
- 鼠标悬停仅使用 `translateY(-1px)` 和边框变色，不使用阴影扩散动画。

### 6.4 主配置区

| 子区域 | 相对主内容区宽度 | 相对整页宽度 | 高度 | 说明 |
| --- | ---: | ---: | ---: | --- |
| Provider 配置面板 | 68.5% | 65.8% | 100% | 只渲染当前选中能力 |
| 区域间距 | 1.5% | 1.44% | 100% | 约 20–24 px |
| 状态侧栏 | 30.0% | 28.8% | 100% | 状态、安全、日志 |

主配置区高度固定在可视区域内，内部按需滚动。切换 Provider 时不改变外壳高度，避免布局跳动。

### 6.5 Provider 配置面板

- 背景：`rgba(249, 253, 255, 0.92)`，不使用 `backdrop-filter`。
- 边框：1 px `rgba(96, 165, 250, 0.22)`。
- 圆角：22 px。
- 内边距：24 px。
- 顶部信息区高度：约 72 px。
- 表单区使用 2 列网格；Base URL 和 API Key 跨两列。
- 纵向字段间距：18 px。
- 标签与输入框间距：8 px。
- 输入框高度：44 px，圆角 12 px。
- 底部操作栏高度：64 px，顶部以 1 px 分割线隔开。
- 「测试连接」为次按钮，「保存配置」为主按钮。
- 两个按钮总宽度不超过操作栏的 42%，右对齐。
- 表单高度不足时保留空白，不拉伸输入框。

### 6.6 状态侧栏

状态侧栏分为三个轻量区块，不再拆成多个大毛玻璃卡。

#### A. 安全说明

- 高度约占侧栏 23%。
- 图标 20 × 20 px。
- 标题「本地保存」；说明 API Key 仅保存在本机配置中。
- 背景使用浅青蓝实色渐变，不使用模糊。

#### B. 能力状态总览

- 高度约占侧栏 37%。
- 四行状态，每行高度 42 px。
- 左侧为能力名称，右侧为状态圆点和文字。
- 当前能力行使用浅蓝背景强调。
- 状态颜色：未配置灰蓝、演示模式天蓝、测试中琥珀、成功青绿、失败珊瑚红。

#### C. 本次会话日志

- 高度约占侧栏 40%。
- 默认显示最近 4 条。
- 每条包括时间、动作、结果，最大两行。
- 超出区域内部滚动，不延长整页。
- 支持「展开 / 收起」，展开后仍在侧栏内部，不创建覆盖整页的模糊弹层。
- 初始为空时显示真实空态：「还没有测试或保存记录」。

## 7. 组件清单与占比

| 组件 | 相对父容器宽度 | 相对父容器高度 | 相对整页占比 | 实现备注 |
| --- | ---: | ---: | ---: | --- |
| SettingsShell | 100% | 100% | 95.04% × 84.60% | 唯一主体毛玻璃层 |
| SettingsHeader | 100% | 10.5% | 91.24% × 8.88% | 无独立滤镜 |
| ProviderSwitcher | 100% | 14.0% | 91.24% × 11.84% | 四列网格 |
| ProviderTile | 24.2% | 100% | 22.08% × 11.84% | 实色卡片 |
| ProviderDetailPanel | 68.5% | 100% | 62.50% × 56.26% | 单个表单 |
| ProviderHeader | 100% | 15% | 62.50% × 8.44% | 标题、说明、状态 |
| ProviderForm | 100% | 67% | 62.50% × 37.70% | 4 个字段 |
| ProviderActions | 100% | 18% | 62.50% × 10.13% | 操作按钮 |
| StatusRail | 30% | 100% | 27.37% × 56.26% | 三段实色区块 |
| SecurityNotice | 100% | 23% | 27.37% × 12.94% | 本地安全说明 |
| CapabilitySummary | 100% | 37% | 27.37% × 20.82% | 四条状态 |
| SessionLog | 100% | 40% | 27.37% × 22.50% | 最大 20 条内存日志 |

## 8. Color System

### 8.1 浅色主题

| Token | 色值 | 用途 |
| --- | --- | --- |
| `--settings-bg-start` | `#EAF8FF` | 页面背景起点 |
| `--settings-bg-mid` | `#DDF2FF` | 页面背景中段 |
| `--settings-bg-end` | `#F6FBFF` | 页面背景终点 |
| `--settings-shell` | `rgba(247, 252, 255, 0.78)` | 唯一毛玻璃主壳 |
| `--settings-panel` | `rgba(250, 253, 255, 0.96)` | 内容面板 |
| `--settings-panel-muted` | `#F0F8FD` | 次级区块 |
| `--settings-primary-start` | `#38BDF8` | 主渐变起点 |
| `--settings-primary-end` | `#4F8CFF` | 主渐变终点 |
| `--settings-accent` | `#22D3EE` | 小面积科技感点缀 |
| `--settings-text` | `#12304A` | 主文字 |
| `--settings-text-secondary` | `#57738A` | 次文字 |
| `--settings-text-muted` | `#8299AA` | 辅助文字 |
| `--settings-border` | `rgba(72, 154, 214, 0.22)` | 普通边框 |
| `--settings-success` | `#14B8A6` | 成功 |
| `--settings-warning` | `#F59E0B` | 测试中 |
| `--settings-danger` | `#F06C75` | 失败 |

### 8.2 深色主题预留

- 背景：`#071827 → #0B2237`。
- 面板：`rgba(15, 39, 59, 0.92)`。
- 主文字：`#E8F6FF`。
- 次文字：`#A7C4D8`。
- 边框：`rgba(93, 194, 255, 0.20)`。
- 不通过简单颜色反转生成暗色模式。

## 9. Typography

| 层级 | 字号 | 行高 | 字重 | 用途 |
| --- | ---: | ---: | ---: | --- |
| Page Title | 24 px | 32 px | 700 | AI 接口设置 |
| Section Title | 17 px | 26 px | 650 | 当前 Provider 名称 |
| Tile Title | 14 px | 21 px | 650 | 能力卡标题 |
| Body | 13 px | 20 px | 400 | 说明文本 |
| Form Label | 12 px | 18 px | 600 | 表单标签 |
| Status | 12 px | 18 px | 500 | 能力状态 |
| Caption | 11 px | 16 px | 400 | 时间和辅助信息 |

默认使用项目现有系统字体栈，优先保证 Windows 中文渲染稳定，不新增字体依赖。

## 10. Component System

### 10.1 Button

- 主按钮：天蓝到靛蓝渐变，高 42 px，圆角 12 px。
- 次按钮：近白背景、冷蓝边框，高 42 px，圆角 12 px。
- 按压态：`transform: translateY(1px)`，禁止缩放导致文字抖动。
- 禁用态：透明度 0.55，保持可读，不响应点击。
- Loading：按钮宽度固定，以旋转图标替换左侧图标，不改变文案区域宽度。

### 10.2 Card

- 普通内容卡不使用 `backdrop-filter`。
- 圆角 18–22 px。
- 边框 1 px。
- 阴影最大 `0 8px 24px rgba(49, 108, 150, 0.08)`。
- Provider 选中卡通过边框和顶部光带突出，不使用强发光。

### 10.3 Navigation / Provider Tabs

- 语义采用 `tablist / tab / tabpanel`。
- 左右方向键切换能力，Enter 或 Space 激活。
- `aria-selected` 反映当前选中状态。
- Tab 切换不触发路由变化，不写浏览器历史。

### 10.4 Input

- 高 44 px，边框 1 px。
- 聚焦态使用 2 px 天蓝 focus ring，不改变整体尺寸。
- API Key 默认密码掩码，提供显示/隐藏按钮。
- 长 URL 横向可滚动，不把容器撑宽。
- 错误信息位于输入框下方并预留 18 px 高度，避免布局跳动。

### 10.5 Status Badge

- 高 24–28 px，圆角 999 px。
- 状态圆点 7 × 7 px。
- 使用文字和颜色共同表达状态，不只依赖颜色。

### 10.6 Modal

- V22 设置页不主动使用 Modal。
- 保存成功使用面板内状态与全局轻提示，不创建大面积模糊遮罩。
- 只有未来涉及清除密钥等不可逆操作时才使用确认弹窗。

### 10.7 List / Feed

- 会话日志按时间倒序。
- 单条高度 44–52 px。
- 最多保留 20 条内存记录，页面卸载后不冒充永久日志。
- 列表滚动区域使用稳定高度和细滚动条。

### 10.8 Avatar

- 设置页没有人物身份场景，不使用 Avatar。
- Provider 以能力图标作为识别元素，避免无意义装饰头像。

## 11. 状态与交互

### 11.1 页面进入

1. 用户点击顶部「设置」。
2. 导航选中态立即更新。
3. 设置主壳以 120 ms `opacity: 0 → 1`、`translateY(4px) → 0` 进入。
4. 不动画背景模糊、阴影、宽高或网格列。
5. 默认选中上次会话中的 Provider；无会话状态时默认「剧本生成」。

### 11.2 页面退出

1. 用户点击其他主导航。
2. 新页面立即替换设置页，不等待长退出动画。
3. 设置页只允许最多 80 ms 的透明度淡出；如果影响导航反馈，则直接取消退出动画。
4. 页面卸载前不发起保存、测试或网络请求。

### 11.3 切换 Provider

- 单击 Provider 卡切换当前表单。
- 外壳和配置区尺寸保持稳定。
- 表单只做 80 ms 透明度切换，不做横向滑动和 blur。
- 未保存修改存在时，在对应 Provider 卡显示 5 px 琥珀圆点。
- 切换不会自动保存，也不会丢失 App 顶层已有的草稿配置。

### 11.4 测试连接

- 点击后按钮进入「测试中…」，当前 Provider 状态同步更新。
- 只禁用当前 Provider 的测试按钮，不锁死整个页面。
- 演示模式结果必须显示「演示测试完成」，不得显示「真实连接成功」。
- 结果写入本次会话日志。
- 失败时在当前面板显示可理解的错误文本，不泄露 API Key。

### 11.5 保存配置

- 表单改动后显示「有未保存修改」。
- 保存成功显示「已保存到本机」，并写入会话日志。
- 保存按钮在无修改时可保持可用但视觉弱化，或禁用并给出明确 tooltip。
- 不新增云端同步或账号存储含义。

### 11.6 Loading / Empty / Error / Disabled

- Loading：仅操作按钮和当前 Provider 状态变化。
- Empty：日志区显示「还没有测试或保存记录」。
- Error：字段级错误优先，Provider 状态显示「配置有误」。
- Disabled：未提供必要字段时，真实测试按钮禁用；演示模式仍允许演示测试。
- Selected：Provider 卡具备边框、光带和 `aria-selected`。
- Pressed：按钮下移 1 px，100 ms 恢复。
- Permission denied：本页当前不申请系统权限，不展示虚假权限状态。

### 11.7 长文本和小屏

- Provider 名称超过 16 个中文字符时单行省略，悬停显示完整文本。
- Base URL 不换行撑开网格。
- 1280–1439 px：主配置区比例调整为 64% / 36%。
- 1024–1279 px：状态侧栏移到主配置区下方，Provider 卡保持两列。
- 小于 1024 px：四个 Provider 卡改为横向滚动，不压缩到不可读宽度。
- 页面主壳内部滚动，顶部应用栏不随设置内容滚动。

### 11.8 暗色、横竖屏和安全区

- 暗色模式从 token 层切换，输入框、边框、禁用态、阴影和日志分割线同时校正。
- Windows 桌面优先横向布局；纵向窄窗口使用单列响应式。
- 底部保留至少 20 px 安全间距，避免日志区紧贴窗口边缘。

### 11.9 减少动态效果

- 遵循 `prefers-reduced-motion: reduce`。
- 减少动态效果时，页面和 Provider 切换均无位移动画，仅做即时状态更新。
- 所有核心能力不依赖动画表达。

## 12. 性能实现约束

### 12.1 渲染预算

- 设置页大面积 `backdrop-filter` 层：最多 1 个主壳层，绝对上限 2 个。
- Provider 表单：同时挂载 1 套，不再同时挂载 4 套。
- 输入控件：从约 16 个降至当前面板的 4 个。
- 操作按钮：从约 8 个降至当前面板的 2 个。
- 会话日志：最多 20 条，首屏最多展示 4 条。
- 不在页面进出动画中使用 blur、box-shadow、width、height、grid-template-columns。
- 页面局部容器使用 `contain: layout paint style`，隔离布局和绘制影响。

### 12.2 背景与合成规则

- 设置页进入时禁用或显著减弱主背景的两个 `blur(80px)` 光斑，不叠加额外固定滤镜层。
- 内容卡使用预混合 rgba/渐变色，不读取背后像素。
- 阴影只用于外层和选中状态，避免每个字段、卡片都创建阴影。
- `will-change` 只在短暂页面过渡期间使用，过渡结束后移除，不长期占用合成层。

### 12.3 React 组件边界

```text
SettingsPage
├─ SettingsHeader
├─ ProviderSwitcher
│  └─ ProviderTile × 4
├─ SettingsWorkspace
│  ├─ ActiveProviderPanel
│  │  ├─ ProviderPanelHeader
│  │  ├─ ProviderForm
│  │  └─ ProviderActions
│  └─ SettingsStatusRail
│     ├─ LocalSecurityNotice
│     ├─ CapabilityStatusList
│     └─ SessionActivityLog
```

- `SettingsPage` 只维护当前 Provider、未保存标记和本次会话日志等短生命周期 UI 状态。
- Provider 配置仍由 App 顶层现有 settings 状态承载，保持现有持久化路径。
- 测试逻辑继续经 `providerRegistry.test`，不把 Provider 逻辑写入输入组件。
- 拆分并 `memo` 化 Provider 卡和状态行，避免输入一个字符导致所有状态区重绘。
- 不新增第三方状态管理或动画依赖。

### 12.4 性能验收预算

在 1440 × 900、Windows 常用 125% 缩放环境下，使用开发构建与打包构建分别测试：

| 指标 | 目标 | 最低验收线 |
| --- | ---: | ---: |
| 冷进入设置页，点击至双 RAF 稳定 | ≤ 100 ms | ≤ 160 ms |
| 热进入设置页 P95，20 次循环 | ≤ 80 ms | ≤ 120 ms |
| 退出设置页 P95，20 次循环 | ≤ 60 ms | ≤ 100 ms |
| 进出场期间 Long Task > 50 ms | 0 个 | 最多 1 个且需记录原因 |
| Provider 切换至双 RAF 稳定 | ≤ 50 ms | ≤ 80 ms |
| 设置页布局偏移 | 0 | 不可肉眼感知 |
| 同时存在的 Provider 表单 | 1 | 1 |

以上为 V22 目标预算，只有实际测试后才能标记为 passed，不能以代码推断替代验证。

## 13. 测试与验证计划

### 13.1 自动化性能测试

计划新增独立设置页性能测试脚本，执行 20 次循环：

1. 从项目页进入设置页。
2. 通过 `performance.now()` 记录导航点击时间。
3. 等待连续两个 `requestAnimationFrame`，记录页面稳定时间。
4. 使用 `PerformanceObserver` 收集大于 50 ms 的 Long Task。
5. 从设置页退出到项目页并重复记录。
6. 输出平均值、P95、最大值和 Long Task 数量。

### 13.2 功能回归

- 四个 Provider 可切换。
- 每个 Provider 的 Provider、模型、Base URL、API Key 字段可编辑。
- API Key 掩码及显示/隐藏行为正确。
- 保存后配置仍可恢复。
- 演示测试不发起外部网络请求。
- 测试中、演示完成、失败状态文案准确。
- 日志只记录当前会话的真实操作。
- 快捷键、Tab 顺序和方向键切换正确。
- 1280 × 720 下无水平整页滚动。
- `prefers-reduced-motion` 下无位移动画。

### 13.3 项目验证命令

实现阶段预计运行：

```powershell
npm run lint
npm run test
npm run build
npm run typecheck
```

实际命令以 `package.json` 当前存在的脚本为准；不存在的命令标记为 `not run`，不得伪造。

还需运行：

- 设置页 UI 自动化回归；
- 设置页 20 次进入/退出性能测试；
- 打包后应用启动验证；
- 运行截图对比与人工视觉检查；
- Provider 外部请求审计，确认演示模式未联网。

## 14. 中文文案表

| 区域 | 类型 | 文案 |
| --- | --- | --- |
| 页面标题 | 标题 | AI 接口设置 |
| 页面标题 | 说明 | 为剧本、图像、配音和视频配置生成服务 |
| 总状态 | 标签 | 4 项能力 |
| 总状态 | 标签 | 演示模式 |
| Provider | 标题 | 剧本生成 |
| Provider | 说明 | 故事扩写、对白和结构化剧本 |
| Provider | 标题 | 图像生成 |
| Provider | 说明 | 角色设定、场景和分镜画面 |
| Provider | 标题 | 配音生成 |
| Provider | 说明 | 角色声音、旁白与对白音频 |
| Provider | 标题 | 视频生成 |
| Provider | 说明 | 分镜动画与成片合成 |
| 状态 | 标签 | 未配置 |
| 状态 | 标签 | 演示模式 |
| 状态 | 标签 | 测试中 |
| 状态 | 标签 | 演示测试完成 |
| 状态 | 标签 | 配置有误 |
| 表单 | 标签 | 服务提供方 |
| 表单 | 标签 | 模型 |
| 表单 | 标签 | Base URL |
| 表单 | 标签 | API Key |
| 表单 | 占位 | 请选择或输入服务提供方 |
| 表单 | 占位 | 输入模型名称 |
| 表单 | 占位 | 输入服务地址 |
| 表单 | 占位 | 输入 API Key |
| 表单 | 辅助 | API Key 仅保存在本机配置中 |
| 操作 | 按钮 | 测试连接 |
| 操作 | 按钮 | 测试中… |
| 操作 | 按钮 | 保存配置 |
| 操作 | 提示 | 有未保存修改 |
| 操作 | 成功 | 已保存到本机 |
| 操作 | 演示结果 | 演示测试完成，未发起真实外部请求 |
| 安全区 | 标题 | 本地优先 |
| 安全区 | 说明 | 配置保存在当前设备，不自动上传云端 |
| 状态区 | 标题 | 能力状态 |
| 日志区 | 标题 | 本次会话 |
| 日志区 | 空态 | 还没有测试或保存记录 |
| 日志区 | 操作 | 展开 |
| 日志区 | 操作 | 收起 |
| 错误态 | 文案 | 请检查服务地址和模型配置 |

## 15. AI 设计图生成 Prompt

### 页面名称：Windows 漫剧创作软件 — AI 接口设置

**Prompt**

Design a premium Windows desktop AI comic-drama production application settings screen, focused on AI provider configuration for script generation, image generation, voice generation, and video generation. Create a calm futuristic sky-blue gradient UI with a lightweight frosted-glass outer shell and crisp nearly-solid inner panels, avoiding excessive blur and excessive glowing shadows. Use a 1777x974 desktop canvas, a persistent top application navigation bar, generous 44px side margins, and a compact control-center layout.

The settings page contains a clean page header with the title “AI 接口设置”, a short subtitle, and compact status pills “4 项能力” and “演示模式”. Below it, place four equal horizontal provider selector cards with simple line icons, Chinese labels “剧本生成”, “图像生成”, “配音生成”, “视频生成”, and honest configuration status indicators. The selected provider card uses a refined cyan-to-blue gradient border and a thin top light strip; inactive cards are crisp pale blue-white panels without background blur.

The main workspace uses a 68/30 two-column layout. On the left, show only one active provider configuration panel with fields for “服务提供方”, “模型”, “Base URL”, and “API Key”, a masked key visibility control, an unsaved-change indicator, and two actions “测试连接” and “保存配置”. On the right, create a compact vertical status rail containing a local-security notice, four provider status rows, and a small recent-session activity log with a truthful empty state. Do not show multiple full provider forms at once. Do not include fake left navigation categories.

Style: premium desktop productivity software, refined sky-blue and icy-white gradient, deep navy typography, subtle cyan accents, crisp one-pixel borders, 18–24px corner radius, disciplined spacing, minimal short shadows, lightweight glassmorphism only on the outer shell, calm technological atmosphere, high legibility, realistic native Windows app proportions. Lighting: soft daylight, faint cyan ambient glow, no neon overload. Animation intent: 120ms opacity and 4px vertical entrance motion on the outer shell only, no blur animation, no animated layout dimensions. Accessibility: strong focus rings, high text contrast, clear selected states, keyboard-friendly tabs. Simplified Chinese UI text, Chinese labels, Chinese desktop app interface; use only short accurate Chinese titles, field labels, buttons, and status labels, no long paragraphs. Resolution: 1777x974, high-fidelity UI mockup, sharp vector icons, production-ready design system, no device frame, no marketing poster, no people, no 3D objects.

## 16. React 实现映射

| 设计区域 | React 组件建议 | 状态归属 | 业务边界 |
| --- | --- | --- | --- |
| 设置主壳 | `SettingsPage` | 页面进出状态 | 不处理 Provider 业务 |
| Provider 选择 | `ProviderSwitcher` | `activeCapability` | 只选择当前能力 |
| 能力卡 | `ProviderTile` | props + memo | 不写配置 |
| 配置面板 | `ActiveProviderPanel` | 当前草稿、dirty 状态 | 调用现有 update/test/save |
| 配置表单 | `ProviderForm` | 受控字段 | 不直接持久化 |
| 测试保存 | `ProviderActions` | loading/disabled | 经现有 Registry 和保存函数 |
| 状态总览 | `CapabilityStatusList` | connectionStates | 只读显示 |
| 安全说明 | `LocalSecurityNotice` | 无 | 如实说明本地边界 |
| 会话日志 | `SessionActivityLog` | 页面内存数组 | 不冒充永久审计日志 |

本项目不是 HarmonyOS 项目，因此不套用 ArkUI、ViewModel、Preferences 或 RelationalStore 实现；继续沿用当前 React + Electron 架构。

## 17. 不确定项与设计假设

- 当前截图显示设置页为 1777 × 974 视觉基准，但用户实际显示缩放可能不同；实现后需在 100%、125%、150% 下验证。
- 现阶段没有真实 Provider 接入，因此所有连接结果继续标识为演示或未配置。
- 「通用 / 项目存储 / 导出」当前没有真实设置内容，V22 假设先移除这些假入口，而不是制作空白页面。
- 本次会话日志假设只存于设置页生命周期内；若未来需要永久审计日志，需另行确认数据格式和存储位置。
- 页面进出性能预算需要在真实开发构建和打包应用中测量，本文档中的数值是验收目标，不是已通过结果。
- 若实测发现全局背景光斑仍造成明显合成开销，允许仅在设置页对其降级为静态径向渐变，但不改变其他页面视觉。

## 18. 预计修改范围（确认后执行）

- `src/App.jsx`：拆分设置页组件、只挂载当前 Provider 表单、加入短生命周期日志和真实状态反馈。
- `src/App.css`：重写设置页布局、减少毛玻璃层、增加低成本进场样式和响应式规则。
- `scripts/`：新增设置页 UI 与进出场性能回归脚本。
- `docs/design/`：保留本文档作为实现基准。
- `.agent/`：记录 V22 变更、验证和交接结果。
- `package.json`：仅在现有版本流程允许时升级至 1.20.0；不新增依赖、不改 lockfile 依赖内容。

## 19. 暂不修改范围

- Electron 主进程和窗口生命周期。
- 文件打开、保存和项目格式。
- AI Provider 的真实网络实现。
- 付费 API、账号、密钥和云端服务。
- 其他业务页面的视觉重构。
- 全局主导航的信息架构。

## 20. 实现与验证结果

用户已确认本设计稿，V22 已完成实现。为满足首次进入性能预算，最终实现进一步取消了设置页自身的 `backdrop-filter` 和进场动画，改用预混合天蓝渐变、半透明实色面板和细边框模拟毛玻璃观感；顶部应用栏仍保留既有玻璃材质。该调整把设置页新增 GPU 背景滤镜层降为 0，同时保持设计稿的视觉方向。

最终验证结果：

- 同时挂载的 Provider 表单：1 套，passed。
- 旧设置分类导航、四卡堆叠和静态连接日志：已移除，passed。
- API Key 不进入 `localStorage`、项目文件或构建产物：passed。
- 当前能力通过 `sessionStorage` 在设置页进出后恢复：passed。
- 冷进入：66.3 ms，目标 ≤ 100 ms，passed。
- 冷退出：8.3 ms，passed。
- 20 次热进入平均值：31.19 ms；P95：33.4 ms，目标 ≤ 80 ms，passed。
- 20 次退出平均值：14.63 ms；P95：19.3 ms，目标 ≤ 60 ms，passed。
- 大于 50 ms 的 Long Task：0，passed。
- 1440 × 900 UI 回归无横向溢出，passed。
- 最终运行截图：`outputs/runtime/settings-v22.png`。
- 最终 Windows 安装包：`release/漫剧创作-Setup-1.20.0-x64.exe`。
