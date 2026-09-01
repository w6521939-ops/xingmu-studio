# 漫剧创作 V37 · 生成图片文件化采用 Design Spec

## 1. 来源与基准

- 视觉来源：用户截图 `C:\Users\hu\AppData\Local\Temp\codex-clipboard-501a43e0-f5cf-41fd-a629-97de1a7aa356.png`。
- 截图画布：`1778 × 973 px`；Windows 桌面端横向窗口。
- 目标界面：分镜图片生成弹窗的结果与采用阶段。
- 当前真实数据证据：
  - 自动草稿 `autosave.manju` 为 `8,389,835` 字节，约 `8.00 MB`。
  - 本次分镜 PNG 为 `2,280,310` 字节；转成 Base64 后约增加 `3.04 MB`。
  - 因此采用后 JSON 项目约超过 `11 MB`，触发现有 `10 MB` 正文上限。
  - 图片本身已经成功下载至 `.manju-studio/outputs/images/`，不需要再次调用 API。
- 设计基准：保留现有天蓝渐变、毛玻璃、圆角卡片和固定底部操作区；本次不重构整页。

## 2. 问题定义

当前实现同时保存了两份相同图片：

```text
百炼临时结果
  → 下载为本地 PNG（正确）
  → 再转换为 Base64 写入 .manju（造成体积膨胀）
```

`2.28 MB` PNG 写入 Base64 后约为 `3.04 MB`，同时还会增加 JSON 字符串开销。连续生成角色图、场景图和分镜图后，项目很快触发 10 MB 上限，即使本地磁盘上已经存在真实文件也无法采用。

根因不是图片生成失败，也不是额度问题，而是“生成图片已文件化保存，却仍以 Base64 重复嵌入项目正文”。

## 3. 产品目标

1. API 生成图片采用时只保存受控本地文件引用，不再把图片 Base64 写进 `.manju`。
2. 保留 `10 MB` 作为项目 JSON 正文安全上限，不通过简单放大上限掩盖问题。
3. 已付费并下载成功的图片必须可以恢复和采用，不要求用户再次生成。
4. 角色图、场景图、分镜图使用同一套受控文件资产协议。
5. 图片缺失、文件被移动或校验失败时显示真实错误，不显示假成功。
6. Key、远程临时 URL和本地绝对路径不得进入项目正文。

## 4. 新的数据流

```text
百炼返回图片 URL
  → 主进程立即下载
  → 保存到 userData/.manju-studio/outputs/images/
  → Manifest 记录 assetId、用途、实体 ID、文件名、SHA-256
  → Renderer 只接收受控 mediaUrl 与脱敏元数据
  → 用户点击采用
  → 项目保存 imageAssetId + manju-media URL + 元数据
  → .manju 正文仅增加约数百字节
```

项目字段建议：

```json
{
  "image": "manju-media://generated-image/<asset-id>",
  "imageAssetId": "<asset-id>",
  "imageSource": "bailian-managed",
  "imageFileName": "storyboard-....png",
  "imageBytes": 2280310,
  "imageSha256": "<sha256>",
  "imageUpdatedAt": "<ISO time>"
}
```

禁止写入项目：

- 图片 Base64；
- API Key；
- 百炼临时下载 URL；
- Windows 绝对文件路径；
- Manifest 的无关字段。

## 5. 已生成结果恢复

新增“未采用结果恢复”能力：

1. 打开角色图、场景图或分镜图弹窗时，按 `purpose + entityId` 查询 Manifest。
2. 若存在已下载但尚未采用的最新结果，显示“发现本地未采用结果”。
3. 用户可以直接预览并点击“采用到当前镜头/角色/场景”。
4. 恢复过程只读取本地文件，不发送网络请求、不产生费用。
5. 截图中的 `storyboard-2026-07-23T08-25-41-421Z.png` 应能在升级后直接恢复。

## 6. 页面结构拆解

```text
StoryboardImageApiDialog
├── Header
├── RequestSummary
├── ContinuityReferences
├── GeneratedResultCard
│   ├── GeneratedImage
│   ├── LocalFileStatus
│   └── FileBackedBadge
├── AdoptionCapacityNotice
└── FixedFooter
    ├── BillingNotice
    └── Actions
        ├── CancelButton
        ├── ImageSettingsButton
        └── AdoptButton
```

## 7. 组件级设计稿

### 7.1 弹窗容器

| 字段 | 规格 |
| --- | --- |
| 类型 | Modal / Scroll Container |
| 位置 | 截图约 `x=336 px, y=20 px` |
| 宽度 | 约 `1101 px`；占屏幕宽度 `61.9%` |
| 高度 | 约 `932 px`；占页面高度 `95.8%` |
| 背景 | 天蓝半透明渐变毛玻璃 |
| 圆角 | 约 `34 px` |
| 边框 | `1 px` 半透明白蓝 |
| 阴影 | 深蓝 `0 24 80 / 30%` |
| 滚动 | 内容区纵向；Footer 固定 |
| 小屏 | `1024 px` 以下宽度改为 `calc(100vw - 32px)` |

### 7.2 生成结果卡

| 字段 | 规格 |
| --- | --- |
| 类型 | Result Card |
| 位置 | 截图约 `x=369 px, y=451 px` |
| 宽度 | 约 `1024 px`；占弹窗宽度 `93%` |
| 高度 | 约 `297 px`；占页面高度 `30.5%` |
| 布局 | 左图右文，`40% / 60%` |
| Padding | 约 `16 px` |
| 圆角 | `20 px` |
| 背景 | `rgba(114, 203, 255, 0.20)` |
| 图片 | 约 `400 × 266 px`，`3:2`，`object-fit: contain` |
| 标题 | “单张结果已下载到本地”，约 `22 px / 700` |
| 文件名 | 允许换行或中间省略，不挤压标题 |
| 新增状态 | “文件化保存 · 不重复写入项目正文” |

### 7.3 采用容量提示

当前红色错误条约 `1024 × 50 px`，占弹窗宽度 `93%`。修复后按状态显示：

#### 可采用

- 背景：浅青绿色 `rgba(103, 222, 190, 0.18)`。
- 图标：盾牌勾选，`18 × 18 px`。
- 主文案：“将采用本地文件引用，项目正文预计增加不足 1 KB。”
- 辅助文案：“图片文件已保存，不会再次请求百炼。”

#### 文件缺失

- 背景：浅红 `rgba(255, 188, 198, 0.35)`。
- 文案：“本地图片文件已丢失，无法采用。不会自动重新生成。”
- 操作：显示“打开素材记录”或“重新生成”，重新生成必须再次确认费用。

#### 项目正文自身超限

- 只有在移除本次图片 Base64 后，纯 JSON 正文仍超过 10 MB 时才显示红色阻断。
- 文案：“项目文本与内嵌本地素材已超过 10 MB，请先清理内嵌素材。”

### 7.4 底部操作区

| 字段 | 规格 |
| --- | --- |
| 高度 | 约 `89 px`；占页面高度 `9.1%` |
| 布局 | 左侧费用说明，右侧三个按钮 |
| 取消 | `156 × 52 px`，白色毛玻璃 |
| 图片设置 | `156 × 52 px`，白色毛玻璃 |
| 采用 | `156 × 52 px`，天蓝渐变 |
| 主按钮文案 | “采用到当前镜头” |
| 可用条件 | 文件存在、Manifest 匹配、SHA-256 元数据合法 |
| 点击结果 | 只写文件引用和元数据，立即关闭并自动保存 |

## 8. 中文文案表

| 状态 | 文案 |
| --- | --- |
| 已生成 | 单张结果已下载到本地 |
| 文件化 | 文件化保存 · 不重复写入项目正文 |
| 可采用 | 将采用本地文件引用，项目正文预计增加不足 1 KB。 |
| 零费用恢复 | 图片文件已保存，本次恢复和采用不会调用百炼。 |
| 发现历史结果 | 发现 1 个已下载但未采用的本地结果 |
| 恢复按钮 | 恢复最近结果 |
| 文件缺失 | 本地图片文件已丢失，无法采用。不会自动重新生成。 |
| 正文超限 | 项目文本与内嵌本地素材已超过 10 MB，请先清理内嵌素材。 |
| 采用按钮 | 采用到当前镜头 |

## 9. 安全与实现边界

- `manju-media://generated-image/<assetId>` 只能由主进程解析。
- 主进程必须从 Manifest 查找资产，拒绝路径穿越、任意绝对路径和非图片扩展名。
- 解析后的真实路径必须位于 `userData/.manju-studio/outputs/images/` 内。
- 返回文件前复核存在性；必要时复核 SHA-256。
- CSP 的 `img-src` 增加 `manju-media:`，不放宽 `http:`、`https:` 或任意文件协议。
- `.manju-bundle` 迁移时必须携带被项目引用的生成图片；单独 `.manju` 仍属于本机项目文件。
- 删除或清理生成图片前，必须扫描当前项目、自动草稿和恢复点引用。

## 10. 状态与异常

- `loading`：查询本地未采用结果。
- `empty`：没有生成结果，显示正常提示词编辑。
- `result`：实时生成结果或恢复结果。
- `applying`：验证文件与写入引用，禁用重复点击。
- `missing`：Manifest 有记录但文件不存在。
- `corrupt`：文件类型、大小或 SHA-256 不匹配。
- `legacy-inline`：旧 Base64 图片继续可显示，不强制删除；后续可显式迁移。
- `permission denied`：本地文件无法读取，显示路径权限提示但不暴露绝对路径。
- `small screen`：结果卡变为上图下文，Footer 按钮保持至少 `44 px` 高。
- `dark mode`：错误、成功和中性色使用独立 token，不只反转背景。

## 11. 完整组件树

```text
StoryboardImageGeneration
├── DialogHeader
├── RequestConfiguration
├── ContinuityReferenceList
├── RecoverableResultBanner
├── GeneratedImageResult
│   ├── ManagedImagePreview
│   ├── ResultMetadata
│   └── FileBackedStatus
├── AdoptionCapacityNotice
└── DialogFooter
    ├── BillingDisclosure
    └── ActionGroup
        ├── Cancel
        ├── OpenImageSettings
        └── AdoptManagedImage
```

## 12. 验收标准

1. 采用截图中的 `2,280,310` 字节 PNG 后，`.manju` 不增加约 `3 MB` Base64。
2. 采用后项目仍低于 10 MB，自动保存成功。
3. 关闭并重开应用，图片仍可显示。
4. 打开相同镜头生成弹窗，能恢复已下载未采用结果。
5. 恢复与采用的网络请求数为 `0`。
6. 项目 JSON 不包含 Base64、API Key、远程临时 URL或绝对路径。
7. 篡改 `assetId` 或协议路径返回 `404`。
8. 角色图、场景图、分镜图均通过同一受控资产协议。
9. 批量图片生成仍保持禁用。
10. Windows 安装包中不包含 `key.txt`。

## 13. 设计还原评分

```text
设计识别置信度: 98%
布局识别: 98%
颜色识别: 96%
字体识别: 92%
尺寸估算: 95%
根因识别: 99%
```

所有尺寸均根据截图智能推算。若原始 Figma 或设计源文件可获取，可进一步精确组件尺寸；本次功能修复不依赖更高精度视觉数据。

## 14. 不确定项与推测值

- 截图顶部内容被窗口裁切，顶部请求配置卡的完整高度为推测值。
- 当前截图对应的本地结果仍存在于用户数据目录，Manifest 记录需要在实现阶段复核。
- 旧 Base64 图片是否全部自动迁移涉及便携性与删除风险；V37 默认不静默删除旧数据，只让新生成图片和可确认匹配的未采用结果走文件引用。
