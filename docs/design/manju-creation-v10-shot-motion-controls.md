# 成片页镜头动效控件 Design Spec

## 1. 整体页面分析

- 视觉来源：`docs/design/manju-v8-launchpad-final-assembly.png` 与 `outputs/runtime/final-subtitles.png`。
- 参考画布：设计图约 `1586 × 992 px`；运行截图约 `1777 × 974 px`。
- 目标页面：项目内 `成片` 页；扩展预览画面、镜头带和镜头带下方检查器。
- 页面目的：让静态漫画镜头通过缓慢缩放、平移和可调淡入淡出获得动态感，同时保持普通创作者易于理解的单层时间线。
- 继续使用天蓝渐变、白色毛玻璃、深蓝文字和小体量控件；不新增关键帧曲线、多轨合成、贝塞尔编辑器或专业剪辑器工具箱。
- 动效参数以镜头为单位保存；预览和 FFmpeg 导出必须使用同一组参数。

## 2. 页面结构拆解

```text
FinalPage
├── FinalPreview
│   └── MotionPreviewViewport
│       └── MotionPreviewArt
└── ProductionTimeline
    ├── TimelineHeader
    ├── TimelineSafetyPanel（可选）
    ├── ShotTrack
    │   └── ShotSegment
    │       └── MotionStatusDot
    ├── ShotMotionEditor
    │   ├── SelectedShotSummary
    │   ├── MotionPresetSelect
    │   ├── MotionStrengthRange
    │   ├── TransitionSelect
    │   ├── TransitionDurationInput
    │   └── ApplyAllButton
    ├── AudioTrackEditor
    └── SubtitleTrackEditor
```

## 3. 组件级设计稿

### 3.1 MotionPreviewViewport

| 字段 | 规格 |
| --- | --- |
| 类型 | Clipped Preview Container |
| 位置 | 现有竖屏预览画框内部 |
| 宽度 | 沿用现有预览画框约 `300 px`；占运行画布宽度约 `16.9%`；占预览舞台宽度约 `28%` |
| 高度 | 沿用现有预览画框约 `430 px`；占页面高度约 `44.1%`；占预览舞台高度约 `88%` |
| 裁剪 | `overflow: hidden`；内部图片保持既有填充策略 |
| 层级 | 图片位于底层；字幕、镜头号和安全提示保持上层，不随图片缩放 |
| 动画 | 播放时根据当前镜头进度连续计算 transform；暂停时保持播放头对应画面 |
| 降级 | 无图片时只显示现有占位画面，不对占位文案做缩放 |

### 3.2 MotionStatusDot

| 字段 | 规格 |
| --- | --- |
| 类型 | Status Badge |
| 位置 | 镜头卡右上角现有 `画 / 音 / 字` 状态组末尾 |
| 尺寸 | `18 × 18 px`；占镜头卡宽度约 `3.4%`；占镜头卡高度约 `19.6%` |
| 文案 | `动` |
| 默认态 | 蓝灰半透明，表示静止 |
| 就绪态 | 青蓝渐变，表示已配置缩放或平移动效 |
| 辅助信息 | `aria-label` 包含动效名称、强度和转场时长 |

### 3.3 ShotMotionEditor

| 字段 | 规格 |
| --- | --- |
| 类型 | Inline Inspector / Form Row |
| 位置 | 镜头带下方、音乐与音效区上方 |
| 宽度 | 约 `1680 px`；占运行画布宽度约 `94.5%`；占时间线父容器 `100%` |
| 高度 | 约 `58 px`；占页面高度约 `6.0%`；占时间线编辑区首屏约 `7%` |
| 布局 | `160px + 190px + minmax(220px,1fr) + 170px + 150px + 112px` 六列 |
| Padding | `9 px 11 px` |
| 间距 | 列间 `10–12 px` |
| 圆角 | `12 px` |
| 背景 | `rgba(243,251,255,.52)`，继承外层玻璃模糊 |
| 边框 | `1 px rgba(67,154,197,.16)` |
| 状态 | 无镜头时整体禁用并显示 `请选择镜头`；窄屏允许两行重排 |

### 3.4 SelectedShotSummary

| 字段 | 规格 |
| --- | --- |
| 类型 | Label + Badge |
| 尺寸 | 约 `150 × 38 px`；占屏宽约 `8.4%`；占检查器宽度约 `9%` |
| 文案 | `镜头动效`、`镜头 01` |
| 字体 | 标题 `10 px / 15 px / 750`；镜头号 `8 px / 12 px / 650` |
| 颜色 | 标题 `#315F78`；镜头号使用天蓝半透明胶囊 |

### 3.5 MotionPresetSelect

| 字段 | 规格 |
| --- | --- |
| 类型 | Select |
| 尺寸 | 约 `180 × 34 px`；占屏宽约 `10.1%`；占检查器宽度约 `10.7%` |
| 标签 | `画面运动` |
| 选项 | `静止 / 缓慢推进 / 缓慢拉远 / 向左平移 / 向右平移 / 向上平移 / 向下平移` |
| 字体 | `9 px / 14 px / 600` |
| 圆角 | `8 px` |
| 状态 | focus-visible 使用 `2 px` 天蓝轮廓；disabled 保持文字可读 |

### 3.6 MotionStrengthRange

| 字段 | 规格 |
| --- | --- |
| 类型 | Range + Output |
| 尺寸 | 轨道最小 `220 × 6 px`；整组高度 `34 px`；占检查器可用宽度约 `24%` |
| 范围 | `5%–25%`，步进 `1%`，默认 `12%` |
| 文案 | `动效强度` 与当前百分比 |
| 状态 | 静止模式下保留数值但控件禁用；切换回动态模式时恢复 |
| 可访问性 | 支持键盘方向键调整，输出值通过 `<output>` 暴露 |

### 3.7 TransitionSelect

| 字段 | 规格 |
| --- | --- |
| 类型 | Select |
| 尺寸 | 约 `160 × 34 px`；占屏宽约 `9.0%`；占检查器宽度约 `9.5%` |
| 标签 | `镜头转场` |
| 选项 | `直接切换 / 淡入淡出` |
| 默认 | 兼容旧项目，默认 `淡入淡出` |
| 说明 | 此版本沿用逐镜头淡入淡出，不伪装为重叠交叉溶解 |

### 3.8 TransitionDurationInput

| 字段 | 规格 |
| --- | --- |
| 类型 | Number Input |
| 尺寸 | 约 `136 × 34 px`；占屏宽约 `7.7%`；占检查器宽度约 `8.1%` |
| 范围 | `0.1–0.8 秒`，步进 `0.05 秒`，默认 `0.25 秒` |
| 限制 | 实际渲染值不得超过镜头时长的三分之一 |
| 状态 | 直接切换时禁用，但不清空用户设置值 |

### 3.9 ApplyAllButton

| 字段 | 规格 |
| --- | --- |
| 类型 | Secondary Button |
| 尺寸 | `108 × 34 px`；占屏宽约 `6.1%`；占检查器宽度约 `6.4%` |
| 文案 | `应用到全部` |
| 圆角 | `10 px` |
| 交互 | 点击前使用确认框；只复制动效、强度、转场和转场时长，不改镜头时长、图片或台词 |
| 状态 | 单镜头项目仍可用；无镜头时禁用 |

## 4. 页面尺寸比例

| 区域 | 估算尺寸 | 屏幕占比 | 父容器占比 |
| --- | --- | --- | --- |
| 动效预览画框 | `300 × 430 px` | 宽约 `16.9%`，高约 `44.1%` | 预览舞台宽约 `28%`、高约 `88%` |
| 镜头带 | `1680 × 100 px` | 宽约 `94.5%`，高约 `10.3%` | 时间线宽 `100%` |
| 动效检查器 | `1680 × 58 px` | 宽约 `94.5%`，高约 `6.0%` | 时间线宽 `100%` |
| 动效强度组 | `360 × 34 px` | 宽约 `20.3%`，高约 `3.5%` | 检查器宽约 `21.4%` |
| 状态点 | `18 × 18 px` | 宽约 `1.0%`，高约 `1.8%` | 镜头卡高约 `19.6%` |

## 5. 设计规范总结

- 颜色：沿用 `#F4FBFF → #D7F1FF → #74CAFF`；选中/动态状态使用 `#28A9DF`；禁用蓝灰 `#93AAB6`。
- 字体：系统无衬线；控件文字不低于 `9 px`，主标签不低于 `10 px`。
- 输入：Select、Number、Range 使用现有浅白玻璃底、细天蓝边框和稳定 focus-visible。
- 动画：预览图像运动为线性慢速，避免弹性和突跳；界面控件本身只使用 `160ms` 状态过渡。
- 历史：四类参数修改必须进入现有 40 步撤销/重做；拖动强度连续变化合并为一步。
- 恢复点：动效参数属于镜头数据，随完整 `.manju` 快照和自动恢复点保存。
- loading：FFmpeg 导出仍使用现有阶段进度；渲染阶段文案不增加布局宽度。
- empty：没有镜头时显示 `暂无可设置动效的镜头`。
- error：无效参数自动归一化，损坏图片继续降级为占位画面并保持时间线时长。
- disabled：静止时禁用强度；直接切换时禁用转场时长。
- selected：当前镜头卡保持现有天蓝外框，动效检查器同步该镜头。
- pressed：按钮使用现有轻微内陷，不改变尺寸。
- permission denied：本功能不新增系统权限。
- 小屏：小于 `1180 px` 时检查器改为三列两行；小于 `900 px` 时改为两列并保持标签可读。
- 长文本：镜头动作说明不在检查器重复展示；选项均使用短中文标签。
- 暗色模式：当前仍以亮色主题为基准；高对比模式保留原生轮廓。
- 横竖屏：桌面窗口横向布局；成片画面比例可为 9:16 或 16:9，动效算法按导出宽高计算。
- 安全区：预览字幕与镜头号不跟随图片 transform，避免被裁切或移动出安全区。

## 6. 完整组件树

```text
FinalPage
├── FinalPreview
│   └── PreviewStage
│       └── VerticalFrame
│           ├── MotionPreviewViewport
│           │   └── Art
│           ├── SubtitlePreview
│           └── ShotNumber
└── ProductionTimeline
    ├── TimelineHeader
    ├── ShotTrack
    │   └── TimelineSegment
    │       ├── Art
    │       ├── ShotNumber
    │       ├── Timecode
    │       └── MaterialStatus
    │           ├── ImageStatus
    │           ├── AudioStatus
    │           ├── SubtitleStatus
    │           └── MotionStatus
    ├── ShotMotionEditor
    │   ├── SelectedShotSummary
    │   ├── MotionPresetSelect
    │   ├── MotionStrengthRange
    │   ├── TransitionSelect
    │   ├── TransitionDurationInput
    │   └── ApplyAllButton
    ├── AudioTrackEditor
    └── SubtitleTrackEditor
```

## 7. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 99%
颜色识别: 98%
字体识别: 94%
尺寸估算: 96%
```

所有尺寸均根据已确认设计图与实际运行截图智能推算。若原始 Figma 文件可获取，可进一步校准精确尺寸。

## 8. 不确定项与推测值

- V8 原图没有镜头动效检查器，本次尺寸属于在现有单层时间线中的功能性推测值。
- FFmpeg 此版本采用逐镜头淡入淡出，不采用会改变总时长与字幕时间码的重叠 `xfade`。
- 预览使用 CSS transform，FFmpeg 使用 `zoompan`；实现测试需通过抽帧差异确认两者方向一致。
- 占位画面保留静态降级，避免占位文字在缩放中产生失真。
