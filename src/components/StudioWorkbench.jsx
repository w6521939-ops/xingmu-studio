import { useEffect, useMemo, useRef, useState } from 'react'
import { oneClickPlanRequiresProvider } from '../services/oneClickProductionPlanService.js'
import { videoExportRepository } from '../services/videoExportRepository.js'
import './StudioWorkbench.css'

const stageDefinitions = [
  { id: 'story', label: '故事构思', mark: '1' },
  { id: 'script', label: '剧本确认', mark: '2' },
  { id: 'assets', label: '角色与素材', mark: '3' },
  { id: 'storyboard', label: '分镜制作', mark: '4' },
  { id: 'production', label: '配音与视频', mark: '5' },
  { id: 'final', label: '成片交付', mark: '6' },
]

const assetDefinitions = [
  { id: 'character', label: '角色', mark: '人' },
  { id: 'prop', label: '道具', mark: '具' },
  { id: 'scene', label: '场景', mark: '景' },
  { id: 'shot', label: '镜头', mark: '镜' },
]

const productionPreferenceKey = 'xingmu-studio.production-preferences.v1'
const busyRunStatuses = new Set(['queued', 'running', 'cooldown', 'pausing', 'stopping'])
const resultRunStatuses = new Set(['completed', 'completed-with-errors', 'quota-stopped', 'failed', 'stopped'])
const runStatusLabels = {
  queued: '正在准备',
  running: '制作中',
  cooldown: '限流冷却中',
  pausing: '完成当前项后暂停',
  paused: '已暂停',
  stopping: '完成当前项后停止',
  stopped: '已停止',
  interrupted: '等待继续',
  'quota-stopped': '免费额度已停止',
  'completed-with-errors': '已完成，有失败项',
  completed: '整部制作完成',
  failed: '队列异常',
}
const productionStageDefinitions = [
  { id: 'images', label: '图片资产', stages: ['character-images', 'scene-images', 'storyboard-images'] },
  { id: 'voice', label: '配音字幕', stages: ['voice-assignment', 'voice-lines'] },
  { id: 'video', label: '镜头视频', stages: ['shot-videos'] },
  { id: 'export', label: '本地合成', stages: ['episode-exports'] },
]
const emptyProductionTasks = Object.freeze([])

const cleanText = (value, fallback = '') => String(value || '').trim() || fallback
const shortText = (value, maximum = 58) => {
  const text = cleanText(value)
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text
}
const imageOf = (item) => cleanText(item?.image || item?.thumbnailUrl || item?.lastFrame?.dataUrl)
const durationInSeconds = (shots = []) => shots.reduce((total, shot) => {
  const parsed = Number.parseFloat(String(shot?.duration || '').replace('s', ''))
  return total + (Number.isFinite(parsed) ? parsed : 3)
}, 0)
const readProductionPreferences = (ratio) => {
  const fallback = {
    aspect: ratio === '16:9' ? '16:9' : '9:16',
    continuity: true,
    autoFrameFill: true,
    voice: 'qwen3-tts-flash',
    subtitles: '简体中文',
    keepVersions: true,
  }
  try {
    const stored = JSON.parse(localStorage.getItem(productionPreferenceKey) || '{}')
    return { ...fallback, ...stored }
  } catch {
    return fallback
  }
}

function MediaFrame({ item, label, portrait = false }) {
  const image = imageOf(item)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image])
  const usableImage = image && !failed
  return (
    <div className={`xm-media-frame ${portrait ? 'is-portrait' : ''} ${usableImage ? 'has-image' : ''}`}>
      {usableImage ? <img src={image} alt={label} onError={() => setFailed(true)} /> : <span aria-hidden="true">{cleanText(label, '素材').slice(0, 1)}</span>}
      {!usableImage && <small>{image ? '图片不可用' : '待生成'}</small>}
    </div>
  )
}

function ProjectRail({
  hasProject,
  projectMeta,
  characters,
  propAssets,
  scenes,
  shots,
  recentProjects,
  activeAsset,
  onOpenProject,
  onCreateProject,
  onSelectAsset,
}) {
  const projectCards = [
    ...(hasProject ? [{
      key: projectMeta.localProjectId,
      name: projectMeta.name,
      subtitle: `${shots.length} 镜完整剧本`,
      status: '已保存',
      active: true,
    }] : []),
    ...(recentProjects || [])
      .filter((project) => project.path && project.name !== projectMeta.name)
      .slice(0, hasProject ? 1 : 3)
      .map((project) => ({
        key: project.path,
        name: project.name,
        subtitle: `${project.episodeCount || 1} 集项目`,
        status: '最近打开',
      })),
  ]
  const counts = {
    all: characters.length + propAssets.length + scenes.length + shots.length,
    character: characters.length,
    prop: propAssets.length,
    scene: scenes.length,
    shot: shots.length,
  }

  return (
    <aside className="xm-project-rail">
      <div className="xm-brand-block">
        <span className="xm-brand-mark">X</span>
        <span><strong>星幕工坊</strong><small>AI 漫剧制作</small></span>
      </div>
      <section className="xm-project-section">
        <header><strong>项目</strong><button type="button" onClick={onCreateProject}>＋ 新建项目</button></header>
        <div className="xm-project-list">
          {projectCards.length ? projectCards.map((project, index) => (
            <button type="button" className={`xm-project-card ${project.active ? 'is-active' : ''}`} key={project.key || index}>
              <span className="xm-project-cover">{cleanText(project.name, '新').slice(0, 1)}</span>
              <span><strong>{cleanText(project.name, '未命名项目')}</strong><small>{project.subtitle}</small><small className="xm-saved-state"><i />{project.status}</small></span>
            </button>
          )) : (
            <button type="button" className="xm-project-empty" onClick={onOpenProject}>
              <span>＋</span><strong>打开第一个项目</strong><small>支持本地 .manju 文件</small>
            </button>
          )}
        </div>
      </section>
      <nav className="xm-asset-menu" aria-label="资产库分类">
        <header><strong>资产库</strong><small>{counts.all}</small></header>
        <button type="button" className={!activeAsset ? 'is-active' : ''} onClick={() => onSelectAsset('character')}><span>◇</span>全部资源<small>{counts.all}</small></button>
        {assetDefinitions.map((asset) => (
          <button type="button" className={activeAsset === asset.id ? 'is-active' : ''} key={asset.id} onClick={() => onSelectAsset(asset.id)}>
            <span>{asset.mark}</span>{asset.label}<small>{counts[asset.id]}</small>
          </button>
        ))}
      </nav>
      <button type="button" className="xm-collapse-rail" aria-label="收起侧边栏"><span>‹</span>收起侧边栏</button>
    </aside>
  )
}

function StudioTopbar({ activeStage, setActiveStage, completedStages, hasProject, busy, preparing, providerReady, onOneClick, onSettings }) {
  return (
    <header className="xm-studio-topbar">
      <nav aria-label="漫剧生产阶段">
        {stageDefinitions.map((stage, index) => (
          <div className="xm-stage-item" key={stage.id}>
            <button
              type="button"
              className={`${activeStage === stage.id ? 'is-active' : ''} ${completedStages?.has(stage.id) ? 'is-complete' : ''}`}
              onClick={() => setActiveStage(stage.id)}
              aria-current={activeStage === stage.id ? 'step' : undefined}
            >
              <span>{completedStages?.has(stage.id) && activeStage !== stage.id ? '✓' : stage.mark}</span>{stage.label}
            </button>
            {index < stageDefinitions.length - 1 && <i />}
          </div>
        ))}
      </nav>
      <div className="xm-topbar-actions">
        <small className={providerReady ? 'is-ready' : 'is-warning'}><i />{providerReady ? '模型已连接' : '模型待配置'}</small>
        <button type="button" className="xm-settings-button" onClick={onSettings} aria-label="打开设置">⚙</button>
        <button type="button" className={`xm-one-click ${preparing ? 'is-preparing' : ''}`} disabled={busy || preparing} onClick={onOneClick}>
          <span>✦</span>{busy ? '生产队列运行中' : preparing ? '生成前校验中' : hasProject ? '一键成片' : '打开项目'}
        </button>
      </div>
    </header>
  )
}

function AssetTabs({ activeAsset, setActiveAsset, characters, propAssets, scenes, shots }) {
  const counts = { character: characters.length, prop: propAssets.length, scene: scenes.length, shot: shots.length }
  return (
    <nav className="xm-asset-tabs" aria-label="视觉资产类型">
      {assetDefinitions.map((asset) => (
        <button type="button" key={asset.id} className={activeAsset === asset.id ? 'is-active' : ''} onClick={() => setActiveAsset(asset.id)}>
          <span>{asset.mark}</span>{asset.label}卡<small>{counts[asset.id]}</small>
        </button>
      ))}
    </nav>
  )
}

function ResourceDock({ characters, propAssets, scenes, shots, onImport }) {
  const [expanded, setExpanded] = useState(true)
  const resources = useMemo(
    () => [...characters, ...propAssets, ...scenes, ...shots].filter((item) => imageOf(item)).slice(0, 10),
    [characters, propAssets, scenes, shots],
  )
  return (
    <footer className={`xm-resource-dock ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
      <header>
        <div><strong>资源库</strong><small>拖拽可快速添加到工作区</small></div>
        <button type="button" onClick={onImport}>＋ 本地上传</button>
        <button type="button" className="xm-dock-toggle" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? '收起资源库' : '展开资源库'}>{expanded ? '⌃' : '⌄'}</button>
      </header>
      {expanded && <div className="xm-resource-list">{resources.length ? resources.map((item, index) => (
        <button type="button" key={`${item.id}-${index}`}>
          <MediaFrame item={item} label={item.name || item.title || `资源 ${index + 1}`} />
          <span><strong>{cleanText(item.name || item.title || item.action, `资源 ${index + 1}`)}</strong><small>{imageOf(item) ? '● 已就绪' : '○ 待生成'}</small></span>
        </button>
      )) : <p>项目中的角色、道具、场景和镜头图片会汇总到这里。</p>}</div>}
    </footer>
  )
}

function AssetWorkspace({ projectMeta, activeAsset, setActiveAsset, characters, propAssets, scenes, shots, onUpdateAsset, onOpenAdvanced, onImport }) {
  const collections = { character: characters, prop: propAssets, scene: scenes, shot: shots }
  const items = collections[activeAsset] || []
  const [selectedByType, setSelectedByType] = useState({})
  const selectedIndex = Math.min(selectedByType[activeAsset] || 0, Math.max(0, items.length - 1))
  const selected = items[selectedIndex]
  const title = activeAsset === 'character' ? '角色卡' : activeAsset === 'prop' ? '道具卡' : activeAsset === 'scene' ? '场景卡' : '镜头画面'
  const description = activeAsset === 'prop'
    ? '独立保存道具外观、叙事功能和禁止漂移规则。'
    : '锁定基准资产，并让镜头复用同一组语义引用。'
  const allAssets = [...characters, ...propAssets, ...scenes, ...shots]
  const readyCount = allAssets.filter((item) => imageOf(item)).length
  const updateSelected = (field, value) => selected && onUpdateAsset(activeAsset, selected.id, { [field]: value })
  const detailFields = activeAsset === 'character'
    ? [['name', '角色名称'], ['role', '角色定位'], ['appearance', '外观锁定'], ['costume', '服装锁定']]
    : activeAsset === 'prop'
      ? [['name', '道具名称'], ['description', '外观描述'], ['function', '剧情作用']]
      : activeAsset === 'scene'
        ? [['title', '场景名称'], ['location', '地点'], ['time', '时间'], ['weather', '天气氛围'], ['layout', '环境布局']]
        : [['action', '镜头动作'], ['visualPrompt', '画面提示词'], ['duration', '镜头时长']]

  return (
    <section className="xm-visual-stage" data-testid="studio-step-assets">
      <header className="xm-workspace-heading xm-visual-heading">
        <div className="xm-heading-copy"><span>视觉资产</span><h1>角色与画面工作区</h1><p>锁定角色、道具和场景特征，为每个镜头准备一致的生成依据。</p></div>
        <div className="xm-project-summary"><span className="xm-summary-icon">▣</span><div><small>当前项目</small><strong>{cleanText(projectMeta.name, '未命名项目')}</strong><em>{shots.length} 镜完整剧本</em></div><b>⌄</b></div>
        <div className="xm-heading-metrics"><span><small>已就绪</small><strong>{readyCount}</strong></span><i /><span><small>待完善</small><strong>{Math.max(0, allAssets.length - readyCount)}</strong></span><i /><span><small>总资源</small><strong>{allAssets.length}</strong></span></div>
      </header>
      <AssetTabs {...{ activeAsset, setActiveAsset, characters, propAssets, scenes, shots }} />
      <div className="xm-asset-body">
        <section className="xm-asset-grid-panel">
          <header><div><strong>{title}</strong><small>{description}</small></div><div className="xm-grid-tools"><span>{items.length} 项</span><button type="button" aria-label="网格视图">▦</button><button type="button" aria-label="筛选">筛选</button></div></header>
          {items.length ? <div className="xm-asset-grid">
            {items.map((item, index) => (
              <button type="button" className={index === selectedIndex ? 'is-selected' : ''} key={item.id ?? index} onClick={() => setSelectedByType((current) => ({ ...current, [activeAsset]: index }))}>
                <MediaFrame item={item} label={item.name || item.title || `镜头 ${index + 1}`} portrait={activeAsset === 'character'} />
                <strong>{cleanText(item.name || item.title || item.action, `镜头 ${index + 1}`)}</strong>
                <span className={imageOf(item) ? 'is-ready' : ''}>{imageOf(item) ? '● 已就绪' : '○ 待生成'}</span>
                <footer><i>◎</i><i>•••</i></footer>
              </button>
            ))}
          </div> : <div className="xm-asset-empty"><span>{activeAsset === 'prop' ? '具' : '＋'}</span><strong>还没有{title}</strong><p>{activeAsset === 'prop' ? '由结构化剧本中的 props 自动建立，也可以在高级编辑器中新增。' : '先打开项目，或进入高级编辑器创建真实资产。'}</p><button type="button" onClick={onOpenAdvanced}>前往高级编辑</button></div>}
          <ResourceDock {...{ characters, propAssets, scenes, shots, onImport }} />
        </section>
        <aside className="xm-asset-inspector">
          {selected ? <>
            <header><div><strong>{cleanText(selected.name || selected.title, `镜头 ${selectedIndex + 1}`)}</strong><small>ID: {cleanText(selected.sourceId || selected.id, String(selectedIndex + 1))}</small></div><span className={imageOf(selected) ? 'is-ready' : ''}>{imageOf(selected) ? '● 已就绪' : '○ 待生成'}</span></header>
            <MediaFrame item={selected} label={selected.name || selected.title || '资产详情'} portrait={activeAsset === 'character'} />
            <div className="xm-asset-inline-form">{detailFields.map(([field, label], index) => <label key={field}><span>{label}</span>{index >= 2 || ['appearance', 'description', 'layout', 'visualPrompt', 'action', 'function', 'costume'].includes(field) ? <textarea aria-label={`素材${label}`} value={selected[field] || ''} onChange={(event) => updateSelected(field, event.target.value)} /> : <input aria-label={`素材${label}`} value={selected[field] || ''} onChange={(event) => updateSelected(field, event.target.value)} />}</label>)}</div>
            <section className="xm-inspector-tags"><span>稳定 ID</span><span>外观</span><span>材质</span><button type="button">＋</button></section>
            <section className="xm-lock-list"><header><strong>连续性锁定</strong><span>● 已开启</span></header><p>锁定外观特征，确保跨镜头一致性。</p><div><span>✓ 外观</span><span>✓ 材质</span><span>✓ 颜色</span><span>✓ 结构</span></div></section>
            <small className="xm-edit-save-state">● 修改已接入项目自动保存</small><button type="button" className="xm-inspector-primary" onClick={onOpenAdvanced}>进入高级素材编辑</button>
          </> : <div className="xm-inspector-empty"><span>◇</span><strong>选择一项资产</strong><small>右侧会显示连续性规则和生成状态。</small></div>}
        </aside>
      </div>
    </section>
  )
}

function ProductionPrepWorkspace({
  projectMeta,
  storySeed,
  characters,
  shots,
  lines,
  oneClickPlan,
  zeroCostSettings,
  providerReady,
  settings,
  setSettings,
  onUpdateProjectRatio,
  onStart,
  onCancel,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  const counts = oneClickPlan?.counts || {}
  const blockers = oneClickPlan?.blockers || []
  const canStart = Boolean(oneClickPlan?.ok && providerReady)
  const totalSeconds = Math.round(durationInSeconds(shots))
  const videoCalls = counts['shot-videos'] || 0
  const voiceCalls = counts['voice-lines'] || 0
  const imageCalls = (counts['character-images'] || 0) + (counts['scene-images'] || 0) + (counts['storyboard-images'] || 0)
  const updateSetting = (field, value) => {
    const nextSettings = { ...settingsRef.current, [field]: value }
    settingsRef.current = nextSettings
    setSaved(false)
    setSettings(nextSettings)
    if (field === 'aspect') onUpdateProjectRatio?.(value)
  }
  const saveSettings = () => {
    localStorage.setItem(productionPreferenceKey, JSON.stringify(settingsRef.current))
    setSaved(true)
  }
  const checks = [
    { label: '完整剧本', detail: storySeed && shots.length ? '已通过' : '需要完善', ok: Boolean(storySeed && shots.length) },
    { label: '角色与画面', detail: characters.length ? `${characters.length} 个角色已识别` : '缺少角色', ok: characters.length > 0 },
    { label: '镜头素材', detail: `${shots.length} / ${shots.length} 已纳入`, ok: shots.length > 0 },
    { label: '配音与字幕', detail: `${lines.length} 条台词待处理`, ok: true },
    { label: '保存位置', detail: '已设置', ok: true },
  ]

  return (
    <section className="xm-production-prep" data-testid="studio-production-prep">
      <header className="xm-prep-heading">
        <div><span>一键成片</span><h1>成片准备中心</h1><p>检查素材、确认模型与输出设置，确认后才会调用生成接口。</p></div>
        <aside className={canStart ? 'is-ready' : 'is-warning'}><strong>{canStart ? '✓ 检查完成' : '△ 需要处理'}</strong><span>可生成 {canStart ? shots.length : 0} / {shots.length} 镜</span></aside>
      </header>
      <nav className="xm-prep-steps" aria-label="成片制作步骤">
        <button type="button" className="is-active"><span>1</span>生成准备</button><i />
        <button type="button" disabled><span>2</span>生成进度</button><i />
        <button type="button" disabled><span>3</span>成片结果</button>
      </nav>
      <div className="xm-prep-layout">
        <section className="xm-prep-card xm-preflight-card">
          <h2>生成检查</h2>
          <div className="xm-check-list">{checks.map((item) => <article key={item.label}><span>{item.label.slice(0, 1)}</span><strong>{item.label}</strong><small className={item.ok ? 'is-ready' : 'is-warning'}>{item.ok ? '✓ ' : '△ '}{item.detail}</small></article>)}</div>
          <button type="button" className="xm-text-button" onClick={() => setDetailsOpen((current) => !current)}>查看检查详情 {detailsOpen ? '⌃' : '⌄'}</button>
          {detailsOpen && <div className="xm-preflight-details">{blockers.length ? blockers.map((blocker) => <p key={blocker}>△ {blocker}</p>) : <><p>✓ 项目结构完整</p><p>✓ 本地自动保存已启用</p><p>✓ 生成任务将按单并发执行</p></>}</div>}
        </section>
        <section className="xm-prep-card xm-parameters-card">
          <h2>成片参数</h2>
          <div className="xm-aspect-switch"><button type="button" className={settings.aspect === '16:9' ? 'is-active' : ''} onClick={() => updateSetting('aspect', '16:9')}>▭ 横屏 16:9</button><button type="button" className={settings.aspect === '9:16' ? 'is-active' : ''} onClick={() => updateSetting('aspect', '9:16')}>▯ 竖屏 9:16</button></div>
          <div className="xm-setting-rows">
            <label><span>清晰度</span><select value="1080P" disabled><option>1080P</option></select></label>
            <label><span>帧率</span><select value="30 FPS" disabled><option>30 FPS</option></select></label>
            <label title="一键制作固定启用连续性保护"><span>画面一致性</span><input type="checkbox" checked disabled /></label>
            <label title="一键制作会自动补齐计划中的缺失首帧"><span>自动补齐缺失首帧</span><input type="checkbox" checked disabled /></label>
          </div>
          <h3>声音与字幕</h3>
          <div className="xm-setting-rows">
            <label><span>角色配音</span><select value={settings.voice} onChange={(event) => updateSetting('voice', event.target.value)}><option value="qwen3-tts-flash">通义语音 · qwen3-tts-flash</option></select></label>
            <label><span>背景音乐</span><select value="manual" disabled><option value="manual">成片页手动添加</option></select></label>
            <label><span>字幕</span><select value={settings.subtitles} onChange={(event) => updateSetting('subtitles', event.target.value)}><option>简体中文</option></select></label>
          </div>
          <h3>输出设置</h3>
          <div className="xm-output-setting"><span>保存路径</span><code>应用数据 / exports / automatic / {cleanText(projectMeta.name, '当前项目')}</code><b>▣</b></div>
          <label className="xm-keep-versions" title="自动导出使用时间戳文件名，不覆盖历史成片"><input type="checkbox" checked disabled />自动保留历史版本</label>
        </section>
        <aside className="xm-prep-card xm-generation-summary">
          <h2>本次生成</h2>
          <article className="xm-generation-project"><span>灯</span><div><strong>{cleanText(projectMeta.name, '未命名项目')}</strong><small>{shots.length} 个镜头</small><small>预计时长 {totalSeconds} 秒</small></div></article>
          <dl><div><dt>图片生成</dt><dd>wan2.7-image-pro</dd></div><div><dt>视频生成</dt><dd>wan2.7-i2v</dd></div><div><dt>配音模型</dt><dd>qwen3-tts-flash</dd></div></dl>
          {oneClickPlan?.costEstimate?.hasEstimates && (
            <section className="xm-cost-estimate">
              <h3>成本预估</h3>
              <table className="xm-cost-table">
                <tbody>
                  {oneClickPlan.costEstimate.items.reduce((rows, item, index) => {
                    const last = rows[rows.length - 1]
                    if (last && last.kind === item.kind) {
                      last.count += 1
                      last.totalCost += item.estimatedCost || 0
                    } else {
                      rows.push({ kind: item.kind, label: item.label, count: 1, totalCost: item.estimatedCost || 0, currency: item.currency, index })
                    }
                    return rows
                  }, []).map((row) => (
                    <tr key={row.index}>
                      <td>{row.label}</td>
                      <td>×{row.count}</td>
                      <td>≈{Math.round(row.totalCost * 10000) / 10000} 元</td>
                    </tr>
                  ))}
                  <tr className="xm-cost-total">
                    <td>合计预估</td>
                    <td />
                    <td>≈{oneClickPlan.costEstimate.totalCost} 元</td>
                  </tr>
                </tbody>
              </table>
              <p className="xm-cost-warning">实际费用以百炼账单为准</p>
            </section>
          )}
          <section className={`xm-quota-protection ${zeroCostSettings?.confirmed ? 'is-confirmed' : ''}`}><span>✓</span><div><strong>免费额度优先</strong><p>{zeroCostSettings?.confirmed ? '已启用免费额度用完即停' : '开始前需完成免费额度确认'}</p><small>预计调用：图片 {imageCalls} 次 · 视频 {videoCalls} 次 · 配音 {voiceCalls} 次</small></div></section>
          <p className="xm-save-copy">▣ 生成结果将自动保存，不覆盖历史成片。</p>
          <div className="xm-prep-actions"><button type="button" className="xm-secondary-action" onClick={saveSettings}>{saved ? '✓ 设置已保存' : '保存设置'}</button><button type="button" className="xm-primary-action" disabled={!canStart || !oneClickPlan?.total} onClick={onStart}>{oneClickPlan?.total ? '确认并开始生成' : '当前项目已补齐'}</button><small>点击后才会调用模型接口</small><button type="button" className="xm-cancel-prep" onClick={onCancel}>返回工作台</button></div>
        </aside>
      </div>
    </section>
  )
}

function ProductionStepHeader({ activeStep }) {
  return <nav className="xm-prep-steps" aria-label="成片制作步骤">
    {['生成准备', '生成进度', '成片结果'].map((label, index) => <div className="xm-production-step-item" key={label}>
      <button type="button" className={activeStep === index + 1 ? 'is-active' : activeStep > index + 1 ? 'is-complete' : ''} disabled={activeStep !== index + 1}><span>{activeStep > index + 1 ? '✓' : index + 1}</span>{label}</button>
      {index < 2 && <i />}
    </div>)}
  </nav>
}

function ProductionProgressWorkspace({ run, projectMeta, onPause, onResume, onStop, onOpenSettings }) {
  const summary = run?.summary || {}
  const tasks = run?.tasks || emptyProductionTasks
  const currentTask = tasks.find((task) => task.id === run?.currentTaskId)
  const canPause = ['running', 'cooldown'].includes(run?.status)
  const canResume = ['paused', 'interrupted'].includes(run?.status)
  const canStop = ['running', 'cooldown', 'pausing', 'paused', 'interrupted'].includes(run?.status)
  const progress = summary.total ? Math.round(((summary.completed || 0) / summary.total) * 100) : 0
  const taskStatusLabel = (task) => task.status === 'succeeded' ? '已完成' : task.status === 'failed' ? '失败' : task.status === 'running' ? '生成中' : task.status === 'cooldown' ? '冷却中' : '等待中'

  return <section className="xm-production-progress" data-testid="studio-production-progress">
    <header className="xm-prep-heading"><div><span>一键成片</span><h1>生成进度</h1><p>所有任务按单并发执行，结果完成一项保存一项，关闭应用后仍可恢复。</p></div><aside className="is-ready"><strong>● {runStatusLabels[run?.status] || '正在处理'}</strong><span>{summary.completed || 0} / {summary.total || 0} 项</span></aside></header>
    <ProductionStepHeader activeStep={2} />
    <div className="xm-progress-layout">
      <section className="xm-progress-overview">
        <header><div><small>当前项目</small><h2>{cleanText(projectMeta.name, '未命名项目')}</h2></div><span>{progress}%</span></header>
        <div className="xm-real-progress"><i style={{ width: `${progress}%` }} /></div>
        <div className="xm-progress-counts"><span><strong>{summary.succeeded || 0}</strong><small>成功</small></span><span><strong>{summary.failed || 0}</strong><small>失败</small></span><span><strong>{summary.pending || 0}</strong><small>等待</small></span></div>
        <div className="xm-stage-progress-list">{productionStageDefinitions.map((stage) => {
          const stageTasks = tasks.filter((task) => stage.stages.includes(task.stage))
          const completed = stageTasks.filter((task) => ['succeeded', 'failed', 'skipped'].includes(task.status)).length
          const active = stageTasks.some((task) => ['running', 'cooldown'].includes(task.status))
          return <article className={active ? 'is-active' : stageTasks.length && completed === stageTasks.length ? 'is-complete' : ''} key={stage.id}><span>{stageTasks.length && completed === stageTasks.length ? '✓' : active ? '●' : '○'}</span><div><strong>{stage.label}</strong><small>{stageTasks.length ? `${completed} / ${stageTasks.length}` : '无需生成'}</small></div></article>
        })}</div>
        <section className="xm-progress-safety"><strong>✓ 免费额度保护运行中</strong><small>检测到额度或余额错误会立即停止整队，不会切换付费模型。</small></section>
      </section>
      <section className="xm-current-production">
        <header><div><small>当前任务</small><h2>{currentTask?.label || runStatusLabels[run?.status] || '等待任务'}</h2></div><em>{currentTask ? taskStatusLabel(currentTask) : '空闲'}</em></header>
        <div className="xm-current-task-visual"><span>{currentTask?.kind === 'voice-line' ? '声' : currentTask?.kind === 'shot-video' ? '播' : currentTask?.kind === 'episode-export' ? '片' : '图'}</span><div><strong>{currentTask?.label || '队列正在准备下一项任务'}</strong><p>{currentTask?.localMessage || (currentTask?.kind === 'shot-video' ? `百炼状态：${currentTask.pollStatus || '正在提交'}` : currentTask?.kind === 'episode-export' ? '本地 FFmpeg 正在合成视频、配音与字幕' : '生成完成后将自动下载并保存到本机')}</p><small>{currentTask?.attempt ? `第 ${currentTask.attempt} 次执行` : '任务状态会自动更新'}</small></div></div>
        <div className="xm-task-queue"><header><h3>任务队列</h3><span>{tasks.length} 项</span></header><div>{tasks.map((task, index) => <article data-status={task.status} key={task.id}><span>{task.status === 'succeeded' ? '✓' : task.status === 'failed' ? '!' : task.status === 'running' || task.status === 'cooldown' ? '●' : String(index + 1).padStart(2, '0')}</span><div><strong>{task.label}</strong><small>{task.status === 'failed' ? task.error || '任务失败' : taskStatusLabel(task)}</small></div><em>{task.kind === 'episode-export' ? '本地' : task.model || '百炼'}</em></article>)}</div></div>
      </section>
      <aside className="xm-progress-controls">
        <h2>队列控制</h2>
        <section><span>运行策略</span><strong>单并发安全生成</strong><small>减少限流与意外额度消耗</small></section>
        <section><span>保存策略</span><strong>完成一项保存一项</strong><small>应用退出后可以继续</small></section>
        {run?.cooldown?.until && <section className="is-warning"><span>限流冷却</span><strong>等待服务恢复</strong><small>{currentTask?.localMessage || '到期后自动继续'}</small></section>}
        {run?.error && <section className="is-danger"><span>队列错误</span><strong>{run.error}</strong></section>}
        <div className="xm-control-actions"><button type="button" onClick={onOpenSettings}>免费额度设置</button>{canPause && <button type="button" onClick={onPause}>暂停队列</button>}{canResume && <button type="button" className="is-primary" onClick={onResume}>继续制作</button>}{canStop && <button type="button" className="is-danger" onClick={onStop}>停止后续任务</button>}</div>
      </aside>
    </div>
  </section>
}

function ProductionResultWorkspace({ run, projectMeta, episodes, shots, videoAssets, onRevealExport, onResume, onOpenAdvanced, onRestart }) {
  const tasks = run?.tasks || emptyProductionTasks
  const exportTasks = useMemo(
    () => tasks.filter((task) => task.kind === 'episode-export' && task.result?.outputPath),
    [tasks],
  )
  const successfulClipTasks = tasks.filter((task) => task.kind === 'shot-video' && task.status === 'succeeded').length
  const videoIds = new Set(videoAssets.map((asset) => asset.id))
  const readyShotCount = shots.filter((shot) => videoIds.has(shot.videoAssetId)).length
  const preparedClipCount = Math.min(shots.length, Math.max(readyShotCount, successfulClipTasks + readyShotCount))
  const voiceTasks = tasks.filter((task) => task.kind === 'voice-line')
  const voiceSucceeded = voiceTasks.filter((task) => task.status === 'succeeded').length
  const [selectedOutputPath, setSelectedOutputPath] = useState('')
  const [preview, setPreview] = useState({ loading: false, mediaUrl: '', error: '' })
  const latestExport = exportTasks.find((task) => task.result.outputPath === selectedOutputPath) || exportTasks.at(-1)
  const failedTasks = tasks.filter((task) => task.status === 'failed')
  const complete = run?.status === 'completed'
  const quotaStopped = run?.status === 'quota-stopped'
  const outputPath = latestExport?.result?.outputPath || ''
  const outputName = outputPath ? outputPath.split(/[\\/]/u).at(-1) : ''

  useEffect(() => {
    const newestPath = exportTasks.at(-1)?.result?.outputPath || ''
    setSelectedOutputPath((current) => exportTasks.some((task) => task.result.outputPath === current) ? current : newestPath)
  }, [run?.id, exportTasks])

  useEffect(() => {
    let active = true
    if (!outputPath) {
      setPreview({ loading: false, mediaUrl: '', error: '' })
      return () => { active = false }
    }
    setPreview({ loading: true, mediaUrl: '', error: '' })
    videoExportRepository.preparePreview(outputPath).then((result) => {
      if (!active) return
      setPreview(result?.ok && result.mediaUrl
        ? { loading: false, mediaUrl: result.mediaUrl, error: '' }
        : { loading: false, mediaUrl: '', error: result?.error || '成片预览加载失败' })
    })
    return () => { active = false }
  }, [outputPath])

  return <section className="xm-production-result" data-testid="studio-production-result">
    <header className="xm-prep-heading"><div><span>第 6 步 · 整集成片</span><h1>{complete ? '整集视频已合成' : quotaStopped ? '免费额度已停止' : failedTasks.length ? '生成完成，存在失败项' : '生成已停止'}</h1><p>{complete ? '各镜头片段已按剧集顺序完成合并，最终 MP4 已保存，可直接预览或继续编辑。' : '已完成的镜头片段会继续保留，只需重试失败或未完成部分。'}</p></div><aside className={complete ? 'is-ready' : 'is-warning'}><strong>{complete ? '✓ 整集合成完成' : '△ 需要处理'}</strong><span>{exportTasks.length} 集成片 · {failedTasks.length} 项失败</span></aside></header>
    <ProductionStepHeader activeStep={3} />
    <div className="xm-result-layout">
      <aside className="xm-result-versions"><header><h2>整集成片</h2><span>{exportTasks.length}/{episodes.length}</span></header>{exportTasks.length ? exportTasks.slice().reverse().map((task, index) => <button type="button" className={task.result.outputPath === outputPath ? 'is-active' : ''} key={task.id} onClick={() => setSelectedOutputPath(task.result.outputPath)}><span>EP{String(task.entityId || exportTasks.length - index).padStart(2, '0')}</span><div><strong>{task.request?.episodeTitle || '自动成片'}</strong><small>{task.result.outputPath.split(/[\\/]/u).at(-1)}</small></div></button>) : <div className="xm-no-result"><span>片</span><strong>还没有整集 MP4</strong><small>镜头片段齐全后才能进行本集合成。</small></div>}
        {failedTasks.length > 0 && <section className="xm-failed-summary"><strong>{failedTasks.length} 项需要处理</strong>{failedTasks.slice(0, 4).map((task) => <small key={task.id}>! {task.label}</small>)}</section>}
      </aside>
      <section className="xm-result-preview">{preview.mediaUrl ? <video key={preview.mediaUrl} controls playsInline preload="metadata" src={preview.mediaUrl} aria-label="自动生成的成片预览" onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.08, video.duration / 2) }} onError={() => setPreview((current) => ({ ...current, mediaUrl: '', error: '播放器暂时无法读取整集视频，请重新加载或打开文件位置检查' }))} /> : <div><span>{preview.loading ? '…' : '▶'}</span><strong>{preview.loading ? '正在加载整集成片' : preview.error || (quotaStopped ? '额度停止前未完成本集合成' : '等待生成整集 MP4')}</strong><small>{preview.error ? '文件版本不会被删除，可以重新合成本集或打开所在文件夹。' : '已有镜头片段、配音和字幕不会丢失。'}</small></div>}<footer><div><strong>{outputName || cleanText(projectMeta.name, '当前项目')}</strong><small>{shots.length} 个镜头片段 · 约 {Math.round(durationInSeconds(shots))} 秒 · {latestExport?.request?.resolution || '1080P'}</small></div>{outputPath && <button type="button" onClick={() => onRevealExport(outputPath)}>打开文件夹</button>}</footer></section>
      <aside className="xm-result-details"><h2>本集合成详情</h2><dl><div><dt>项目</dt><dd>{cleanText(projectMeta.name, '未命名项目')}</dd></div><div><dt>镜头片段</dt><dd>{preparedClipCount} / {shots.length}</dd></div><div><dt>配音任务</dt><dd>{voiceTasks.length ? `${voiceSucceeded} / ${voiceTasks.length}` : '使用已有配音'}</dd></div><div><dt>整集输出</dt><dd>{exportTasks.length} / {episodes.length}</dd></div><div><dt>保存策略</dt><dd>按集保存 · 历史保留</dd></div></dl>{quotaStopped && <section className="xm-result-warning"><strong>免费额度用完即停已生效</strong><small>队列没有切换模型或继续产生调用。请确认控制台额度后再重试。</small></section>}<div className="xm-result-actions">{outputPath && <button type="button" className="is-primary" onClick={() => onRevealExport(outputPath)}>打开整集成片位置</button>}{failedTasks.length > 0 || quotaStopped ? <button type="button" onClick={onResume}>重试未完成任务</button> : <button type="button" onClick={onRestart}>{preview.error ? '重新合成本集' : '生成本集新版本'}</button>}<button type="button" onClick={onOpenAdvanced}>进入高级编辑</button></div></aside>
    </div>
  </section>
}

function StoryWorkspace({ storySeed, projectMeta, scenes, shots, busy, providerReady, onChangeStorySeed, onGenerateScript }) {
  const ready = cleanText(storySeed).length >= 2
  return (
    <section className="xm-simple-stage xm-story-stage" data-testid="studio-step-story">
      <header className="xm-workspace-heading">
        <div className="xm-heading-copy"><span>第 1 步 · 从一句话开始</span><h1>告诉我你想做什么故事</h1><p>输入主题、人物或冲突，AI 会整理成完整剧本，再继续拆分角色、场景和分镜。</p></div>
        <small className={`xm-provider-state ${providerReady ? '' : 'is-warning'}`}><i />{providerReady ? '剧本模型已就绪' : '需先配置剧本模型'}</small>
      </header>
      <div className="xm-story-layout">
        <section className="xm-story-editor">
          <header><div><small>故事需求</small><strong>用自然语言描述，不需要写专业格式</strong></div><span>{cleanText(storySeed).length} 字</span></header>
          <textarea
            value={storySeed}
            onChange={(event) => onChangeStorySeed(event.target.value)}
            placeholder="例如：暴雨夜，一名女孩登上废弃灯塔，寻找失踪七年的父亲，却从旧录音机里听见了自己的声音……"
            aria-label="故事需求"
          />
          <div className="xm-story-hints"><span>人物关系</span><span>核心冲突</span><span>故事地点</span><span>结局方向</span></div>
          <footer><small>生成前会显示模型和预计调用，确认后才发起请求。</small><button type="button" disabled={!ready || busy} onClick={onGenerateScript}>{busy ? '正在生成剧本…' : shots.length || scenes.length ? '重新生成完整剧本' : '✦ 生成完整剧本'}</button></footer>
        </section>
        <aside className="xm-story-brief">
          <header><span>项目简报</span><strong>{cleanText(projectMeta.name, '新漫剧项目')}</strong></header>
          <dl><div><dt>类型</dt><dd>{cleanText(projectMeta.genre, '剧情')}</dd></div><div><dt>画幅</dt><dd>{cleanText(projectMeta.ratio, '9:16')}</dd></div><div><dt>目标时长</dt><dd>{cleanText(projectMeta.duration, '60 秒')}</dd></div><div><dt>当前内容</dt><dd>{scenes.length} 场 · {shots.length} 镜</dd></div></dl>
          <section><strong>这一阶段完成后</strong><p>自动得到场景、角色、台词和分镜草稿，后续步骤仍可逐项修改。</p></section>
        </aside>
      </div>
    </section>
  )
}

function ScriptWorkspace({ storySeed, shots, scenes, lines, onUpdateScene, onUpdateLine, onOpenAdvanced }) {
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id || '')
  const selectedScene = scenes.find((scene) => String(scene.id) === String(selectedSceneId)) || scenes[0]
  const sceneLines = lines.filter((line) => String(line.sceneId) === String(selectedScene?.id))
  const [selectedLineId, setSelectedLineId] = useState(sceneLines[0]?.id || '')
  const selectedLine = sceneLines.find((line) => String(line.id) === String(selectedLineId)) || sceneLines[0]

  useEffect(() => {
    if (!scenes.some((scene) => String(scene.id) === String(selectedSceneId))) setSelectedSceneId(scenes[0]?.id || '')
  }, [scenes, selectedSceneId])
  useEffect(() => {
    if (!sceneLines.some((line) => String(line.id) === String(selectedLineId))) setSelectedLineId(sceneLines[0]?.id || '')
  }, [sceneLines, selectedLineId])

  const updateScene = (field, value) => selectedScene && onUpdateScene(selectedScene.id, { [field]: value })
  const updateLine = (field, value) => selectedLine && onUpdateLine(selectedLine.id, { [field]: value })
  return (
    <section className="xm-simple-stage" data-testid="studio-step-script">
      <header className="xm-workspace-heading"><div className="xm-heading-copy"><span>第 2 步 · 检查故事结构</span><h1>剧本确认工作区</h1><p>核对场景、台词和剧情节奏；需要精修时再进入完整编辑器。</p></div><small className="xm-provider-state"><i />{scenes.length ? `${scenes.length} 场已建立` : '等待生成剧本'}</small></header>
      <div className="xm-script-flow"><button type="button" className="is-active">1. 场景剧本 <small>{scenes.length} 场</small></button><i /><button type="button">2. 台词 <small>{lines.length} 条</small></button><i /><button type="button">3. 分镜草稿 <small>{shots.length} 镜</small></button></div>
      <div className="xm-script-columns">
        <section className="xm-script-source"><header><strong>故事与场景</strong><small>选择要编辑的场景</small></header><article><small>一句话故事</small><strong>{shortText(storySeed, 70) || '等待输入故事主题'}</strong><span>{scenes.length} 场 · {lines.length} 条台词 · {shots.length} 镜</span></article><div className="xm-scene-list">{scenes.map((scene, index) => <button type="button" className={String(scene.id) === String(selectedScene?.id) ? 'is-active' : ''} key={scene.id} onClick={() => setSelectedSceneId(scene.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{cleanText(scene.title, `场景 ${index + 1}`)}</strong><small>{cleanText(scene.location, '地点待补充')} · {cleanText(scene.time, '时间待补充')}</small></div></button>)}</div><button type="button" onClick={onOpenAdvanced}>打开完整剧本编辑器</button></section>
        <section className="xm-inline-editor"><header><strong>{selectedScene ? `场景 ${selectedScene.id} · 内容` : '场景内容'}</strong><small>输入后自动保存</small></header>{selectedScene ? <div className="xm-inline-form"><label><span>场景标题</span><input aria-label="场景标题" value={selectedScene.title || ''} onChange={(event) => updateScene('title', event.target.value)} /></label><div className="xm-inline-form-row"><label><span>地点</span><input aria-label="场景地点" value={selectedScene.location || ''} onChange={(event) => updateScene('location', event.target.value)} /></label><label><span>时间</span><input aria-label="场景时间" value={selectedScene.time || ''} onChange={(event) => updateScene('time', event.target.value)} /></label></div><label><span>天气/氛围</span><input aria-label="场景天气" value={selectedScene.weather || ''} onChange={(event) => updateScene('weather', event.target.value)} /></label><label><span>动作描述</span><textarea aria-label="场景动作" value={selectedScene.action || ''} onChange={(event) => updateScene('action', event.target.value)} /></label><label><span>旁白</span><textarea aria-label="场景旁白" value={selectedScene.narration || ''} onChange={(event) => updateScene('narration', event.target.value)} /></label></div> : <p>生成剧本后可在这里逐场编辑。</p>}</section>
        <section className="xm-inline-editor"><header><strong>角色台词</strong><small>{sceneLines.length} 条 · 修改后需重新配音</small></header><div className="xm-dialogue-list">{sceneLines.map((line) => <button type="button" className={String(line.id) === String(selectedLine?.id) ? 'is-active' : ''} key={line.id} onClick={() => setSelectedLineId(line.id)}><strong>{cleanText(line.speaker, '旁白')}</strong><small>{shortText(line.text, 34)}</small></button>)}</div>{selectedLine ? <div className="xm-inline-form"><div className="xm-inline-form-row"><label><span>说话人</span><input aria-label="台词说话人" value={selectedLine.speaker || ''} onChange={(event) => updateLine('speaker', event.target.value)} /></label><label><span>情绪</span><input aria-label="台词情绪" value={selectedLine.emotion || ''} onChange={(event) => updateLine('emotion', event.target.value)} /></label></div><label><span>台词内容</span><textarea aria-label="台词内容" value={selectedLine.text || ''} onChange={(event) => updateLine('text', event.target.value)} /></label><small className="xm-edit-save-state">● 已接入项目自动保存</small></div> : <p>当前场景没有台词，可在完整剧本编辑器中新增。</p>}</section>
      </div>
    </section>
  )
}

function ShotWorkspace({ mode, episodes = [], shots, scenes, characters, propAssets, videoAssets, lines = [], onUpdateShot, onOpenAdvanced, onOpenVoice }) {
  const isVideo = mode === 'production'
  const readyVideos = new Set(videoAssets.map((asset) => asset.id))
  const readyShotCount = shots.filter((shot) => readyVideos.has(shot.videoAssetId)).length
  const [selectedShotId, setSelectedShotId] = useState(shots[0]?.id || '')
  const selectedShot = shots.find((shot) => String(shot.id) === String(selectedShotId)) || shots[0]
  useEffect(() => {
    if (!shots.some((shot) => String(shot.id) === String(selectedShotId))) setSelectedShotId(shots[0]?.id || '')
  }, [selectedShotId, shots])
  const updateShot = (field, value) => selectedShot && onUpdateShot?.(selectedShot.id, { [field]: value })
  return (
    <section className="xm-simple-stage" data-testid={`studio-step-${mode}`}>
      <header className="xm-workspace-heading"><div className="xm-heading-copy"><span>{isVideo ? '第 5 步 · 逐镜头生成片段' : '第 4 步 · 组织镜头'}</span><h1>{isVideo ? '配音与镜头视频' : '分镜制作工作区'}</h1><p>{isVideo ? '每个分镜先生成一段独立视频，全部片段就绪后再进入下一步合成整集。' : '组合角色、道具和场景引用，确认每个镜头的画面与时长。'}</p></div><small className={`xm-provider-state ${isVideo && readyShotCount < shots.length ? 'is-warning' : ''}`}><i />{isVideo ? `镜头片段 ${readyShotCount} / ${shots.length}` : '引用图谱已建立'}</small></header>
      {isVideo && <div className="xm-clip-phase"><span>镜头片段区</span><strong>{episodes.length} 集 · {readyShotCount} 段已就绪 · {Math.max(0, shots.length - readyShotCount)} 段待生成</strong><small>片段保存在当前项目的本地媒体库中；第 6 步只负责按剧集顺序合成最终 MP4。</small></div>}
      <div className="xm-shot-layout"><section className="xm-shot-grid">{shots.length ? shots.map((shot, index) => <button type="button" className={`xm-shot-card ${String(shot.id) === String(selectedShot?.id) ? 'is-selected' : ''} ${isVideo ? readyVideos.has(shot.videoAssetId) ? 'is-clip-ready' : 'is-clip-pending' : ''}`} key={shot.id} onClick={() => setSelectedShotId(shot.id)}><MediaFrame item={shot} label={`镜头 ${index + 1}`} /><header><strong>S{String(shot.id).padStart(3, '0')}</strong><span>{shot.duration || '3.0s'}</span></header><p>{shortText(shot.action || shot.visualPrompt, 42)}</p><small>{isVideo ? readyVideos.has(shot.videoAssetId) ? '✓ 独立视频片段已保存' : '○ 等待生成镜头片段' : `${shot.characterIds?.length || 0} 角色 · ${shot.propIds?.length || 0} 道具`}</small></button>) : <div className="xm-asset-empty"><span>镜</span><strong>还没有镜头</strong><p>完成剧本拆镜后，镜头会按顺序进入这里。</p></div>}</section><aside>{!isVideo && selectedShot ? <><header className="xm-shot-editor-heading"><div><strong>S{String(selectedShot.id).padStart(3, '0')} · 分镜编辑</strong><small>修改后自动保存</small></div><span>镜头 {shots.findIndex((shot) => String(shot.id) === String(selectedShot.id)) + 1}/{shots.length}</span></header><div className="xm-inline-form"><label><span>镜头动作</span><textarea aria-label="分镜动作" value={selectedShot.action || ''} onChange={(event) => updateShot('action', event.target.value)} /></label><label><span>画面提示词</span><textarea aria-label="分镜画面提示词" value={selectedShot.visualPrompt || ''} onChange={(event) => updateShot('visualPrompt', event.target.value)} /></label><div className="xm-inline-form-row"><label><span>时长</span><input aria-label="分镜时长" value={selectedShot.duration || ''} onChange={(event) => updateShot('duration', event.target.value)} /></label><label><span>景别</span><input aria-label="分镜景别" value={selectedShot.size || ''} onChange={(event) => updateShot('size', event.target.value)} /></label></div><label><span>镜头运动</span><input aria-label="分镜镜头运动" value={selectedShot.motion || ''} onChange={(event) => updateShot('motion', event.target.value)} /></label><small className="xm-edit-save-state">● 已接入项目自动保存</small></div><button type="button" onClick={onOpenAdvanced}>进入高级分镜编辑</button></> : <><strong>本步检查</strong><ul><li>{shots.length ? '✓' : '○'} 分镜剧本</li><li>{shots.filter((shot) => imageOf(shot)).length ? '✓' : '○'} 镜头画面</li><li>{characters.length ? '✓' : '○'} 角色卡参考</li><li>{propAssets.length ? '✓' : '○'} 道具卡参考</li><li>{scenes.length ? '✓' : '○'} 场景卡参考</li><li>{lines.length ? '✓' : '○'} 台词与字幕</li><li>{readyShotCount === shots.length && shots.length ? '✓' : '○'} 视频片段 {readyShotCount}/{shots.length}</li></ul><button type="button" onClick={onOpenVoice}>管理配音与台词</button><button type="button" onClick={onOpenAdvanced}>生成/管理镜头片段</button></>}</aside></div>
    </section>
  )
}

function FinalWorkspace({ episodes, shots, lines, videoAssets, oneClickPlan, oneClickRun, onOpenAdvanced, onOpenPrep, onOpenProduction }) {
  const localOnly = Boolean(oneClickPlan?.total && !oneClickPlanRequiresProvider(oneClickPlan))
  const videoIds = new Set(videoAssets.map((asset) => asset.id))
  const readyShotCount = shots.filter((shot) => videoIds.has(shot.videoAssetId)).length
  const allClipsReady = Boolean(shots.length && readyShotCount === shots.length)
  const exportTasks = (oneClickRun?.tasks || []).filter((task) => task.kind === 'episode-export' && task.status === 'succeeded')
  return (
    <section className="xm-simple-stage xm-final-stage" data-testid="studio-step-final">
      <header className="xm-workspace-heading"><div className="xm-heading-copy"><span>第 6 步 · 按剧集合成</span><h1>整集成片与交付</h1><p>读取第 5 步保存的镜头片段，按剧集顺序合并配音、字幕和音轨，输出最终 MP4。</p></div><small className={`xm-provider-state ${allClipsReady ? '' : 'is-warning'}`}><i />{allClipsReady ? '所有镜头片段已就绪' : `还缺 ${Math.max(0, shots.length - readyShotCount)} 段视频`}</small></header>
      <div className="xm-final-cards"><article><span>01</span><strong>{episodes.length} 集</strong><small>按集独立合成与保存</small></article><article><span>02</span><strong>{readyShotCount}/{shots.length} 段</strong><small>镜头视频准备情况</small></article><article><span>03</span><strong>{lines.length} 条</strong><small>配音与字幕输入</small></article><article><span>04</span><strong>{exportTasks.length} 个</strong><small>已输出整集 MP4</small></article></div>
      <section className="xm-episode-assembly"><header><div><span>剧集合成队列</span><strong>一个剧集输出一个最终成片</strong></div><small>保存到：应用数据 / exports / automatic / 项目目录</small></header><div>{episodes.map((episode, index) => { const episodeShots = shots.filter((shot) => String(shot.episodeId) === String(episode.id)); const episodeReady = episodeShots.filter((shot) => videoIds.has(shot.videoAssetId)).length; const exported = exportTasks.some((task) => String(task.entityId) === String(episode.id)); return <article key={episode.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{cleanText(episode.title, `第 ${index + 1} 集`)}</strong><small>{episodeReady}/{episodeShots.length} 个镜头片段 · {exported ? '整集 MP4 已生成' : episodeReady === episodeShots.length && episodeShots.length ? '等待合成' : '片段未齐'}</small></div><em className={exported ? 'is-ready' : episodeReady === episodeShots.length && episodeShots.length ? 'is-waiting' : ''}>{exported ? '✓ 已成片' : episodeReady === episodeShots.length && episodeShots.length ? '可合成' : '待补片段'}</em></article> })}</div></section>
      <section className="xm-final-preview"><div><span>▶</span><strong>{allClipsReady ? '镜头片段已齐，可以合成本集视频' : '先完成所有镜头视频片段'}</strong><small>{allClipsReady ? '本地 FFmpeg 将按镜头顺序合并视频、配音、字幕和音轨。' : '缺失片段会在第 5 步明确标出；一键成片也可自动补齐后继续合成。'}</small></div><div><button type="button" onClick={allClipsReady ? onOpenPrep : onOpenProduction}>{allClipsReady ? localOnly ? '立即合成本集并预览' : '检查并合成本集' : '返回补齐镜头片段'}</button><button type="button" onClick={onOpenAdvanced}>高级成片工作台</button></div></section>
    </section>
  )
}

function WorkflowFooter({ activeStage, completedStages, blockers, onPrevious, onNext }) {
  const index = stageDefinitions.findIndex((stage) => stage.id === activeStage)
  const current = stageDefinitions[index] || stageDefinitions[0]
  const next = stageDefinitions[index + 1]
  return <footer className="xm-workflow-footer" data-testid="studio-workflow-footer">
    <div><span>第 {current.mark} 步 / 共 {stageDefinitions.length} 步</span><strong>{current.label}</strong><small>{blockers.length ? `还需处理：${blockers[0]}` : '本步已具备继续条件'}</small></div>
    <div className="xm-workflow-progress" aria-label="整体制作进度"><i style={{ width: `${(completedStages.size / stageDefinitions.length) * 100}%` }} /></div>
    <div className="xm-workflow-actions"><button type="button" disabled={index <= 0} onClick={onPrevious}>上一步</button>{next && <button type="button" className="is-primary" onClick={onNext}>{blockers.length ? '继续完善' : `保存并进入：${next.label}`} →</button>}</div>
  </footer>
}

export default function StudioWorkbench({
  projectMeta,
  storySeed,
  episodes,
  scenes,
  characters,
  propAssets,
  shots,
  lines,
  videoAssets,
  recentProjects,
  oneClickPlan,
  oneClickRun,
  zeroCostSettings,
  bailianStatus,
  hasProject,
  busy: appBusy,
  onNavigate,
  onOpenProject,
  onChangeStorySeed,
  onGenerateScript,
  onUpdateScene,
  onUpdateCharacter,
  onUpdateProp,
  onUpdateShot,
  onUpdateLine,
  onStartOneClick,
  onUpdateProjectRatio,
  onPauseOneClick,
  onResumeOneClick,
  onStopOneClick,
  onOpenProductionSettings,
  onRevealExport,
}) {
  const [activeStage, setActiveStage] = useState('story')
  const [activeAsset, setActiveAsset] = useState(propAssets.length ? 'prop' : 'character')
  const [assetSelectionTouched, setAssetSelectionTouched] = useState(false)
  const [productionPrepOpen, setProductionPrepOpen] = useState(false)
  const [productionSettings, setProductionSettings] = useState(() => readProductionPreferences(projectMeta.ratio))
  const busy = Boolean(oneClickRun && busyRunStatuses.has(oneClickRun.status))
  const providerReady = !oneClickPlanRequiresProvider(oneClickPlan)
    || Boolean(bailianStatus?.configured && bailianStatus?.paidGenerationEnabled === true)
  const videoAssetIds = useMemo(() => new Set(videoAssets.map((asset) => asset.id)), [videoAssets])
  const readyShotVideoCount = useMemo(
    () => shots.filter((shot) => videoAssetIds.has(shot.videoAssetId)).length,
    [shots, videoAssetIds],
  )
  const showProductionProgress = activeStage === 'final' && oneClickRun && !resultRunStatuses.has(oneClickRun.status)
  const showProductionResult = activeStage === 'final' && oneClickRun && resultRunStatuses.has(oneClickRun.status)
  const completedStages = useMemo(() => {
    const completed = new Set()
    if (cleanText(storySeed).length >= 2) completed.add('story')
    if (scenes.length && (lines.length || shots.length)) completed.add('script')
    if (characters.length && scenes.length) completed.add('assets')
    if (shots.length) completed.add('storyboard')
    if (shots.length && readyShotVideoCount === shots.length) completed.add('production')
    if (oneClickRun?.status === 'completed') completed.add('final')
    return completed
  }, [characters.length, lines.length, oneClickRun?.status, readyShotVideoCount, scenes.length, shots.length, storySeed])
  const stageBlockers = useMemo(() => ({
    story: cleanText(storySeed).length >= 2 ? [] : ['输入至少 2 个字的故事需求'],
    script: scenes.length ? [] : ['先生成或建立剧本场景'],
    assets: characters.length && scenes.length ? [] : ['补齐角色卡与场景信息'],
    storyboard: shots.length ? [] : ['从剧本生成分镜草稿'],
    production: !shots.length ? ['先完成分镜制作'] : readyShotVideoCount < shots.length ? [`还有 ${shots.length - readyShotVideoCount} 个镜头视频待生成`] : [],
    final: readyShotVideoCount < shots.length ? [`还有 ${shots.length - readyShotVideoCount} 个镜头视频待生成`] : oneClickPlan?.blockers || [],
  }), [characters.length, oneClickPlan?.blockers, readyShotVideoCount, scenes.length, shots.length, storySeed])

  useEffect(() => {
    if (!assetSelectionTouched && propAssets.length) setActiveAsset('prop')
  }, [assetSelectionTouched, propAssets.length])
  useEffect(() => {
    if (busy) setProductionPrepOpen(false)
  }, [busy])
  useEffect(() => {
    if (oneClickRun && resultRunStatuses.has(oneClickRun.status)) {
      setActiveStage('final')
      setProductionPrepOpen(false)
    }
  }, [oneClickRun])

  const selectAsset = (asset) => {
    setAssetSelectionTouched(true)
    setActiveAsset(asset)
    setActiveStage('assets')
    setProductionPrepOpen(false)
  }
  const selectStage = (stage) => {
    setActiveStage(stage)
    setProductionPrepOpen(false)
  }
  const advancedPage = activeStage === 'script' ? 'script' : activeStage === 'assets' ? activeAsset === 'shot' ? 'storyboard' : activeAsset === 'character' ? 'character' : 'assets' : activeStage === 'storyboard' ? 'storyboard' : 'final'
  const openProductionPrep = () => {
    if (!hasProject) {
      onOpenProject()
      return
    }
    setActiveStage('final')
    setProductionPrepOpen(true)
  }
  const moveStage = (offset) => {
    const currentIndex = stageDefinitions.findIndex((stage) => stage.id === activeStage)
    const nextStage = stageDefinitions[currentIndex + offset]
    if (nextStage) selectStage(nextStage.id)
  }
  const generateScript = () => {
    if ((scenes.length > 1 || shots.length) && !window.confirm('重新生成完整剧本会替换当前场景、角色和分镜。现有项目会继续保留在本地自动草稿中，确定继续吗？')) return
    onGenerateScript({
      storySeed,
      genre: projectMeta.genre || '悬疑',
      ratio: projectMeta.ratio || '9:16',
      duration: projectMeta.duration || '60 秒',
    })
  }
  const updateAsset = (type, id, changes) => {
    if (type === 'character') onUpdateCharacter(id, changes)
    else if (type === 'prop') onUpdateProp(id, changes)
    else if (type === 'scene') onUpdateScene(id, changes)
    else onUpdateShot(id, changes)
  }

  return (
    <div className="xm-studio-shell">
      <ProjectRail {...{ hasProject, projectMeta, episodes, characters, propAssets, scenes, shots, recentProjects, activeAsset, onOpenProject }} onCreateProject={() => onNavigate('home')} onSelectAsset={selectAsset} />
      <StudioTopbar activeStage={activeStage} setActiveStage={selectStage} completedStages={completedStages} hasProject={hasProject} busy={busy} preparing={productionPrepOpen} providerReady={providerReady} onOneClick={openProductionPrep} onSettings={() => onNavigate('settings')} />
      <main className="xm-studio-main">
        {productionPrepOpen ? <ProductionPrepWorkspace
          {...{ projectMeta, storySeed, characters, shots, lines, oneClickPlan, zeroCostSettings, providerReady }}
          settings={productionSettings}
          setSettings={setProductionSettings}
          onUpdateProjectRatio={onUpdateProjectRatio}
          onStart={onStartOneClick}
          onCancel={() => { setProductionPrepOpen(false); setActiveStage('visual') }}
        /> : showProductionProgress ? <ProductionProgressWorkspace
          run={oneClickRun}
          projectMeta={projectMeta}
          onPause={onPauseOneClick}
          onResume={onResumeOneClick}
          onStop={onStopOneClick}
          onOpenSettings={onOpenProductionSettings}
        /> : showProductionResult ? <ProductionResultWorkspace
          run={oneClickRun}
          projectMeta={projectMeta}
          episodes={episodes}
          shots={shots}
          videoAssets={videoAssets}
          onRevealExport={onRevealExport}
          onResume={onResumeOneClick}
          onOpenAdvanced={() => onNavigate('final')}
          onRestart={openProductionPrep}
        /> : <>
          {activeStage === 'story' && <StoryWorkspace {...{ storySeed, projectMeta, scenes, shots, providerReady }} busy={appBusy === 'script'} onChangeStorySeed={onChangeStorySeed} onGenerateScript={generateScript} />}
          {activeStage === 'script' && <ScriptWorkspace {...{ storySeed, shots, scenes, lines, onUpdateScene, onUpdateLine }} onOpenAdvanced={() => onNavigate('script')} />}
          {activeStage === 'assets' && <AssetWorkspace projectMeta={projectMeta} activeAsset={activeAsset} setActiveAsset={selectAsset} {...{ characters, propAssets, scenes, shots }} onUpdateAsset={updateAsset} onOpenAdvanced={() => onNavigate(advancedPage)} onImport={() => onNavigate('assets')} />}
          {activeStage === 'storyboard' && <ShotWorkspace mode="storyboard" {...{ episodes, shots, scenes, characters, propAssets, videoAssets, onUpdateShot }} onOpenAdvanced={() => onNavigate('storyboard')} />}
          {activeStage === 'production' && <ShotWorkspace mode="production" {...{ episodes, shots, scenes, characters, propAssets, videoAssets, lines }} onOpenVoice={() => onNavigate('voice')} onOpenAdvanced={() => onNavigate('final')} />}
          {activeStage === 'final' && <FinalWorkspace {...{ episodes, shots, lines, videoAssets, oneClickPlan, oneClickRun }} onOpenAdvanced={() => onNavigate('final')} onOpenPrep={openProductionPrep} onOpenProduction={() => selectStage('production')} />}
        </>}
        {!productionPrepOpen && !showProductionProgress && !showProductionResult && <WorkflowFooter activeStage={activeStage} completedStages={completedStages} blockers={stageBlockers[activeStage] || []} onPrevious={() => moveStage(-1)} onNext={() => moveStage(1)} />}
      </main>
    </div>
  )
}
