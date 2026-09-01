# 漫剧创作 V8 其余七页设计图生成提示词

> 视觉母版：`manju-v8-launchpad-project-home.png`
>
> 共性：`1600 × 1000` Windows 桌面应用、渐变天蓝色、白色毛玻璃、深蓝文字、顶部项目导航；不采用六步侧栏或专业多轨剪辑器。
>
> 生成状态：七页均已完成；与已确认的首页共同构成八张全页面设计图。

# 1. 项目总览

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: style and app-shell reference only. Inherit its exact sky-blue gradient, premium white frosted-glass material, deep-blue Chinese typography, top-bar proportions, glass borders and soft blue shadows. Do not copy the launchpad content layout.
Primary request: Create the PROJECT OVERVIEW page for “漫剧创作”.
Layout: global top bar; second horizontal project navigation “总览 / 剧本 / 角色 / 分镜 / 配音 / 成片”; project identity strip with “雾城回声”, local-save state and export. Main area: left 64% episode production board with three wide episode rows; right 36% project story and “接着创作” panel. Each episode row contains a cinematic 16:9 strip, episode title, scene count, character portraits and four readiness statuses for script/storyboard/voice/video. Bottom has compact “新增一集”.
Text: “漫剧创作”, “雾城回声”, “总览”, “剧本”, “角色”, “分镜”, “配音”, “成片”, “剧集”, “故事简介”, “接着创作”, “继续制作”, “新增一集”.
Constraints: Simplified Chinese desktop UI, content-driven production overview, no charts or metric dashboard.
Avoid: left workflow sidebar, poster wall, giant stepper, timeline, dark navy, purple, green, beige, opaque white cards, watermark.
```

# 2. 剧本编辑

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: visual-system reference only. Preserve the sky-blue gradient glass style and top application shell; create a dedicated script-writing layout.
Primary request: Design the SCRIPT EDITOR page for “漫剧创作”.
Layout: global top bar and horizontal project navigation; 230px left episode/scene tree; central screenplay editor occupying about 58%; 310px right scene inspector. Central editor uses a more opaque icy-white glass reading surface for long Chinese text. Include scene heading “场景 03 月下相逢”, action paragraphs, narrator block, structured character dialogue rows with portraits, insert-dialogue action and word count. Left tree shows completed and unfinished scenes. Right inspector shows location, time, weather, characters, estimated duration and storyboard readiness.
Text: “漫剧创作”, “剧本”, “第1集”, “场景 03”, “新增场景”, “拆分台词”, “整理剧本”, “演示模式”, “场景信息”, “角色台词”, “旁白”.
Constraints: Simplified Chinese desktop UI, excellent long-text readability, one primary action, glass blur visible outside reading surface.
Avoid: AI chat, generic word processor, timeline, dark editor, purple, green, beige, watermark.
```

# 3. 角色设定

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: visual-system reference only. Preserve the sky-blue gradient frosted glass and app shell; create a character consistency workspace.
Primary request: Design the CHARACTER BIBLE page for “漫剧创作”.
Layout: horizontal project navigation; 210px left character index; central 56% character canvas; right 31% consistency inspector. Central canvas contains one large key visual of “沈砚”, front/side/detail reference views and basic profile. Right inspector contains locked appearance anchors, expression row, costume variants, voice preview and compact relationship map. Character identity must remain consistent across all reference images.
Text: “漫剧创作”, “角色”, “角色设定”, “新建角色”, “沈砚”, “男主”, “主视觉”, “外观锚点”, “表情”, “服装”, “声音”, “人物关系”, “导入参考图”, “保存设定”.
Constraints: Simplified Chinese desktop UI, vivid cinematic character art within bright glass shell, blue lock states, one gradient save button.
Avoid: generic gallery, dark navy, purple, green, beige, workflow sidebar, timeline, watermark.
```

# 4. 分镜板

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: visual-system reference only. Preserve sky-blue gradient, white frosted-glass materials and top app shell; create a story-planning board.
Primary request: Design the STORYBOARD BOARD page for “漫剧创作”.
Layout: project navigation; compact horizontal scene switcher under it; center 76% contains six large shot cards in a three-column grid; right 24% collapsible shot inspector. Each shot card includes coherent cinematic preview with the same black-haired protagonist, shot number, one-line action, dialogue, duration, shot size, camera movement, character/scene chips and continuity lock. Include “新增镜头”, “拆分镜头”, “生成画面”.
Text: “漫剧创作”, “分镜”, “分镜板”, “第1集”, “场景 03”, “新增镜头”, “拆分镜头”, “生成画面”, “镜头信息”, “动作”, “台词”, “时长”, “景别”, “运镜”, “连续性”.
Constraints: Simplified Chinese desktop UI, selected card uses sky-blue edge and soft glow, cinematic images stay dominant.
Avoid: multitrack timeline, giant preview, dashboard cards, dark navy, purple, green, beige, watermark.
```

# 5. 配音台

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: visual-system reference only. Preserve sky-blue gradient frosted-glass design and app shell; create a simple voice-production workspace.
Primary request: Design the VOICE PRODUCTION page for “漫剧创作”, simpler than a professional DAW.
Layout: horizontal project navigation; 210px left speaker column with character portraits and readiness; central 58% dialogue list grouped by scene; right 28% voice settings inspector; compact 70px bottom audition bar. Dialogue rows show portrait, speaker, editable text, emotion, duration, status and play. Settings include voice profile, emotion, speed, pitch and pause. Show amber “接口未配置”.
Text: “漫剧创作”, “配音”, “配音台”, “说话人”, “台词”, “情绪”, “语速”, “音调”, “停顿”, “批量分配”, “试听本句”, “生成配音”, “未配音”, “待确认”, “已确认”, “接口未配置”.
Constraints: Simplified Chinese desktop UI, readable dialogue text, simple waveform preview only, one gradient generation action.
Avoid: professional mixer, multitrack DAW, complex waveforms, dark navy, purple, green, beige, watermark.
```

# 6. 视频成片

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application UI mockup
Input image: visual-system reference only. Preserve sky-blue gradient glass app shell; create a focused final review page.
Primary request: Design the FINAL ASSEMBLY page for “漫剧创作”, not professional editing software.
Layout: horizontal project navigation; left 68% large preview stage with vertical 9:16 manhua frame centered on a lightly darkened blue-gray viewing surface; right 32% export checklist; bottom full-width single-layer shot ribbon with eight landscape thumbnails. Include playback, timecode, subtitle, volume, aspect ratio, simple transition selector, retained-last-frame indicator, image/voice/subtitle/video readiness and export preset “竖屏 1080×1920”.
Text: “漫剧创作”, “成片”, “视频成片”, “预览全片”, “导出成片”, “字幕”, “音量”, “转场”, “画面比例”, “分辨率”, “画面完整”, “配音完整”, “字幕完整”, “接口未配置”.
Constraints: Simplified Chinese desktop UI, only one shot sequence ribbon, sky-blue gradient export button, preview visually isolated without darkening whole app.
Avoid: multitrack timeline, audio tracks, scissors toolbar, Premiere layout, dark navy, purple, green, beige, watermark.
```

# 7. 接口设置

```text
Use case: ui-mockup
Asset type: high-fidelity Windows desktop application settings UI mockup
Input image: visual-system reference only. Preserve sky-blue gradient frosted glass, top app shell and typography.
Primary request: Design the AI INTERFACE SETTINGS page for “漫剧创作”, showing reserved adapters without real connections.
Layout: 220px left settings navigation “通用 / 项目存储 / AI 接口 / 导出”; central 60% structured provider sections for script, image, voice and video; right help panel for demo mode and local secret storage. Each provider section contains provider dropdown, model mapping, endpoint, masked API key, local lock, “未配置”, “保存配置” and “测试连接”. Include compact connection-log drawer.
Text: “漫剧创作”, “设置”, “通用”, “项目存储”, “AI 接口”, “导出”, “剧本服务”, “图片服务”, “配音服务”, “视频服务”, “服务商”, “模型”, “服务地址”, “API Key”, “未配置”, “保存配置”, “测试连接”, “演示模式”.
Constraints: Simplified Chinese desktop UI, no real secrets, clear privacy cues, amber unconfigured states, one sky-blue gradient save action.
Avoid: exposed keys, cloud pricing, robot illustration, dark navy, purple, green, beige, watermark.
```
