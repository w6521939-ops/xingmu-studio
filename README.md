<div align="center">

# 星幕工坊 | Xingmu Studio

### 本地优先的 AI 漫剧视频生产平台

</div>

<p align="center">
  <img src="https://img.shields.io/badge/版本-v2.0.0-6366f1" alt="Version">
  <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Remotion-47848F" alt="Remotion">
  <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/平台-Windows-0078D6?logo=windows&logoColor=white" alt="Platform">
</p>

<p align="center">
  <a href="#核心能力">核心能力</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="#provider-扩展">Provider 扩展</a> ·
  <a href="#管线扩展">管线扩展</a> ·
  <a href="CONTRIBUTING.md">贡献</a>
</p>

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **剧本创作** | AI 结构化剧本，台词拆分，角色自动匹配 |
| **角色管理** | 参考图生成，跨镜头连续性锁定，自动音色匹配 |
| **分镜编排** | 场景/分镜/镜头三级结构，首尾帧衔接，拖拽排序 |
| **图片生成** | 多 Provider 支持（百炼 wan2.7 / OpenAI gpt-image-2） |
| **配音生成** | 多 Provider 支持（百炼 TTS / ElevenLabs 多语言） |
| **视频生成** | 图片动画 + 真实视频双模式，Google Veo 3 支持 |
| **成片合成** | Remotion 组件化渲染 + FFmpeg 降级方案 |
| **2.5D 视差** | AI 深度图分层，多速视差运动 |
| **成本治理** | 生成前逐项预估，超预算警告 |
| **制作看板** | 实时管线可视化，审批门，暂停/恢复 |

## 快速开始

```bash
git clone https://github.com/w6521939-ops/xingmu-studio.git
cd xingmu-studio
npm install
npm run dev
```

**环境变量**（在 `.env` 中配置，不要提交到 Git）：

```env
DASHSCOPE_API_KEY=your_bailian_key
BAILIAN_WORKSPACE_ID=your_workspace_id
OPENAI_API_KEY=your_openai_key          # 可选
GOOGLE_API_KEY=your_google_key           # 可选（Veo 3）
ELEVENLABS_API_KEY=your_elevenlabs_key   # 可选
PEXELS_API_KEY=your_pexels_key           # 可选（素材库）
PIXABAY_API_KEY=your_pixabay_key         # 可选（素材库）
```

## 架构

```
┌──────────────────────────────────────────────────────────┐
│                   Electron 渲染进程                      │
│  剧本页 · 角色页 · 分镜页 · 成片页 · 制作看板             │
├──────────────────────────────────────────────────────────┤
│                   Electron 主进程                       │
│                                                        │
│  PipelineRunner (状态机)    ·    CostTracker            │
│  ├ pipeline_defs/*.yaml    ·    RenderRouter            │
│  └ 9 阶段 + 审批门          ·    ├ Remotion              │
│                              ·    └ FFmpeg              │
│  Provider Selector 层                                   │
│  ├ script  ├ image  ├ voice  ├ video                   │
│  └ 百炼 / OpenAI / ElevenLabs / Google Veo              │
└──────────────────────────────────────────────────────────┘
```

## Provider 扩展

新增 Provider 只需 3 步：

1. 在 `src/services/providers/implementations/` 下新建文件
2. 继承 `BaseProvider`，实现 `probe()` / `dryRun()` / `generate()` / `estimateCost()`
3. 在 `index.js` 中注册

内置 Provider：

| Provider | 能力 | 模型 | 币种 |
|----------|------|------|------|
| 阿里云百炼 | 剧本/图片/配音/视频 | qwen-plus / wan2.7 / qwen-tts / wan2.7-i2v | CNY |
| OpenAI | 图片 | gpt-image-2 | USD |
| Google Veo | 视频 | veo-3.0 | USD |
| ElevenLabs | 配音 | multilingual-v2 | USD |

## 管线扩展

内置管线：

| 管线 | 场景 |
|------|------|
| 漫剧制作 | 剧本→角色→场景→分镜→配音→视频→成片 |
| 口播视频 | 数字人头像 + 语音 + 字幕 |
| 屏幕录制演示 | 屏幕录制 + 旁白 + 标注 |
| 播客再利用 | 播客音频 → 短视频片段 |

新增管线只需在 `src/services/pipelineDefs/` 添加定义文件。

## 渲染引擎

| 引擎 | 场景 | 特点 |
|------|------|------|
| Remotion | 默认 | 缓动运动、逐字字幕、2.5D 视差、粒子叠加 |
| FFmpeg | 降级 | 零依赖、速度快、zoompan 基础运动 |

## 许可证

MIT（核心引擎）+ 商业许可证（高级模板和云端功能）。

详见 [LICENSE](LICENSE)。

---

## English

Xingmu Studio is a local-first AI comic drama video production platform.

### Key Features

- **Multi-Provider**: Bailian (Alibaba Cloud), OpenAI, Google Veo, ElevenLabs
- **Pipeline State Machine**: Declarative YAML pipeline definitions with approval gates
- **Dual Rendering**: Remotion (component-based) + FFmpeg (fallback)
- **2.5D Parallax**: AI depth map layering with multi-speed parallax
- **Cost Governance**: Per-task cost estimation before generation
- **Production Board**: Real-time pipeline visualization

### Quick Start

```bash
git clone https://github.com/w6521939-ops/xingmu-studio.git
cd xingmu-studio
npm install
npm run dev
```

### License

MIT (core engine). See [LICENSE](LICENSE) for details.
