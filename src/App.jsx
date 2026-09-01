import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import './App.css'
import StudioWorkbench from './components/StudioWorkbench.jsx'
import { ProductionBoard } from './components/ProductionBoard.jsx'
import './components/ProductionBoard.css'
import {
  applyBailianStatusToSettings,
  bailianProviderName,
  createDefaultProviderSettings,
  providerCapabilities,
  providerRegistry,
} from './services/providerRegistry.js'
import { createProjectFromBailianScript } from './services/bailianScriptMapper.js'
import {
  loadProviderSettings,
  saveProviderSettings,
} from './services/localSettingsRepository.js'
import {
  analyzeDialoguePreviewRows,
  createDialogueCommit,
  dialogueEmotionOptions,
  maximumDialogueSourceCharacters,
  parseDialogueSource,
  summarizeDialoguePreviewRows,
} from './services/dialogueSplitService.js'
import {
  createScriptOrganizerCommit,
  createScriptOrganizerPreview,
  defaultScriptOrganizerRules,
  defaultScriptOrganizerScopes,
  scriptOrganizerRuleOptions,
  scriptOrganizerScopeOptions,
  summarizeScriptOrganizerSelection,
} from './services/scriptOrganizerService.js'
import {
  maximumSceneLocationCharacters,
  maximumSceneTimeCharacters,
  maximumSceneWeatherCharacters,
  normalizeMainCharacterIds,
  sceneWeatherSuggestions,
  summarizeSceneMetadata,
  validateSceneMetadataField,
} from './services/sceneMetadataService.js'
import {
  createProjectLocalId,
  createProjectRenameCandidate,
  createProjectSnapshot,
  getProjectSnapshotByteSize,
  maximumProjectBytes,
  readProjectSnapshot,
  validateProjectName,
} from './services/projectModel.js'
import { projectRepository } from './services/projectRepository.js'
import {
  managedMediaRepository,
  projectPortabilityRepository,
} from './services/projectPortabilityRepository.js'
import {
  createInitialPortabilityState,
  formatPortabilityBytes,
  managedMediaStatusDetails,
  portableCompatibilityDetails,
  portableMigrationDetailGroups,
  validatePortableImportName,
} from './services/projectPortabilityService.js'
import { createStoryboardDrafts } from './services/storyboardDraftService.js'
import { createShotVisualPrompt } from './services/storyboardPromptService.js'
import {
  createSubtitleCuesFromTimeline,
  defaultSubtitleStyle,
  normalizeSubtitleCues,
  normalizeSubtitleStyle,
  parseSrt,
  resolveSubtitleCueAtTime,
  serializeSrt,
} from './services/subtitleService.js'
import { subtitleRepository } from './services/subtitleRepository.js'
import {
  getShotMotionLabel,
  normalizeShotMotionRange,
  normalizeShotMotionSettings,
  normalizeShotTransitionEdges,
  resolveShotMotionPreviewStyle,
  shotMotionOptions,
  shotTransitionOptions,
} from './services/shotMotionService.js'
import {
  analyzeShotDeletion,
  applyBatchShotEdits,
  deleteShotSelectionFromTimeline,
  duplicateShotSelectionInTimeline,
  formatShotDuration,
  getShotGroupInsertionIndex,
  moveShotToIndex,
  moveShotGroupByStep,
  normalizeShotDuration,
  normalizeShotSelection,
  remapTimelinePlayhead,
  reorderShotGroupByInsertion,
  selectShotRange,
  analyzeShotSplit,
  splitShotAtPlayhead,
  synchronizeTimelineDependents,
  toggleShotSelection,
} from './services/shotTimelineEditService.js'
import {
  createEmptyTimelineHistory,
  createTimelineSnapshot,
  recordTimelineEdit,
  redoTimelineEdit,
  undoTimelineEdit,
} from './services/timelineHistoryService.js'
import {
  buildProductionTimeline,
  findTimelineItemAtTime,
  formatTimelineTime,
} from './services/timelineService.js'
import {
  createEmptyEpisodeProduction,
  createEpisodeProductionFromTimeline,
  flattenEpisodeAudioTracks,
  getEpisodeProduction,
  replaceEpisodeShots,
  updateEpisodeProduction,
} from './services/episodeProductionService.js'
import { videoExportRepository } from './services/videoExportRepository.js'
import { shotVideoAssetRepository } from './services/shotVideoAssetRepository.js'
import {
  applyShotVideoAsset,
  connectShotVideoLastFrame,
  detachShotVideoAsset,
  normalizeShotVideoAsset,
  resolveShotVideoAsset,
  resolveShotVideoContinuityFrame,
} from './services/shotVideoAssetService.js'
import { getExportReadinessIssues } from './services/exportReadinessService.js'
import { localSearchGroupDetails, searchLocalProject } from './services/localSearchService.js'
import {
  findAdjacentPlayableLineId,
  formatAuditionTime,
  getAuditionProgress,
  getVoiceLineAudioSourceStatus,
  isValidAuditionDuration,
  normalizeAuditionVolume,
} from './services/voiceAuditionService.js'
import {
  buildAssetLibraryIndex,
  filterAssetLibraryIndex,
  formatAssetBytes,
  isAssetFileCompatible,
  maximumAssetFileBytes,
  removeProjectAsset,
  replaceProjectAsset,
  summarizeAssetLibrary,
} from './services/assetLibraryService.js'
import {
  characterImageSizeOptions,
  createCharacterEntityGenerationRequest,
  createCharacterImageGenerationRequest,
  createCharacterImagePrompt,
  createCharacterImageRequestPreview,
  createCharacterSettingPrompt,
  maximumCharacterImagePromptCharacters,
} from './services/characterImageRequestService.js'
import {
  createStoryboardImageGenerationRequest,
  createStoryboardImagePromptDraft,
  createStoryboardImageRequestPreview,
  maximumStoryboardImagePromptCharacters,
  maximumStoryboardImageReferences,
  storyboardImageSizeOptions,
} from './services/storyboardImageRequestService.js'
import {
  createSceneEntityGenerationRequest,
  createSceneImageGenerationRequest,
  createSceneImagePrompt,
  createSceneSettingPrompt,
} from './services/sceneGenerationService.js'
import { createGeneratedImageProjectFields } from './services/generatedImageAssetService.js'
import {
  createShotVideoDirectorPrompt,
  createShotVideoPromptDraft,
  createShotVideoRequestPreview,
  isShotVideoFrameDataUrl,
  mapShotVideoDuration,
  maximumShotVideoNegativePromptCharacters,
  maximumShotVideoPromptCharacters,
  maximumShotVideoSeed,
  shotVideoModeOptions,
  shotVideoResolutionOptions,
} from './services/shotVideoRequestService.js'
import {
  createOneClickProductionPlan,
  oneClickPlanRequiresProvider,
  oneClickProductionStageDefinitions,
  summarizeOneClickRun,
} from './services/oneClickProductionPlanService.js'
import { oneClickProductionRepository } from './services/oneClickProductionRepository.js'
import {
  confirmZeroCostAutomationSettings,
  loadZeroCostAutomationSettings,
  requiredZeroCostModels,
} from './services/zeroCostAutomationSettings.js'
import {
  assignCharacterVoice,
  characterVoiceCatalog,
  getCharacterVoice,
} from './services/characterVoiceService.js'

const projectNavigation = [
  { id: 'studio', label: '工作台' },
  { id: 'overview', label: '总览' },
  { id: 'script', label: '剧本' },
  { id: 'character', label: '角色' },
  { id: 'assets', label: '素材' },
  { id: 'storyboard', label: '分镜' },
  { id: 'voice', label: '配音' },
  { id: 'final', label: '成片' },
]

const globalNavigation = [
  { id: 'studio', label: '工作台' },
  { id: 'home', label: '创作' },
  { id: 'overview', label: '项目' },
  { id: 'assets', label: '素材' },
]

const createEmptyBatchShotEdits = () => ({
  duration: '',
  motionEffect: '',
  motionStrength: '',
  transition: '',
  transitionDuration: '',
})

const initialEpisodes = []
const initialScenes = []
const initialCharacters = []
const initialPropAssets = []
const initialShots = []
const initialDialogue = []
const initialAudioTracks = []
const initialVideoAssets = []
const initialSubtitleCues = []
const initialSubtitleStyle = { ...defaultSubtitleStyle }
const initialEpisodeProductions = []
const initialLegacyProduction = null
const ignoreProductionUpdate = () => undefined

const defaultStorySeed = ''

const defaultProjectMeta = {
  localProjectId: '',
  name: '',
  genre: '',
  ratio: '9:16',
  duration: '60秒',
  episodeCount: 0,
}

const legacyDemoSignature = '58a18bef'

const createSnapshotSignature = (snapshot) => {
  const canonical = {
    ...snapshot,
    savedAt: '',
    project: {
      ...snapshot?.project,
      localProjectId: '',
    },
  }
  const value = JSON.stringify(canonical)
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const isLegacyBuiltInDemoSnapshot = (snapshot) => {
  try {
    return createSnapshotSignature(snapshot) === legacyDemoSignature
  } catch {
    return false
  }
}

const deriveProjectName = (storySeed, genre) => {
  const firstSentence = String(storySeed || '')
    .split(/[。！？!?\n]/u)[0]
    .replace(/^[\s“”‘’"']+|[\s“”‘’"']+$/gu, '')
  if (firstSentence) return Array.from(firstSentence).slice(0, 18).join('')
  return (genre || '新建') + '项目'
}

const createAudioWaveform = async (file, bucketCount = 48) => {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextConstructor) return []
  const context = new AudioContextConstructor()
  try {
    const audioBuffer = await context.decodeAudioData(await file.arrayBuffer())
    const buckets = Array.from({ length: bucketCount }, () => 0)
    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
      const samples = audioBuffer.getChannelData(channelIndex)
      const bucketSize = Math.max(1, Math.floor(samples.length / bucketCount))
      buckets.forEach((_, bucketIndex) => {
        const start = bucketIndex * bucketSize
        const end = bucketIndex === bucketCount - 1 ? samples.length : Math.min(samples.length, start + bucketSize)
        const stride = Math.max(1, Math.floor((end - start) / 160))
        let peak = buckets[bucketIndex]
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
          peak = Math.max(peak, Math.abs(samples[sampleIndex]))
        }
        buckets[bucketIndex] = peak
      })
    }
    const maximum = Math.max(...buckets)
    return maximum > 0 ? buckets.map((sample) => Number((sample / maximum).toFixed(3))) : []
  } finally {
    await context.close()
  }
}

const readLocalFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.addEventListener('load', () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('素材读取结果无效')), { once: true })
  reader.addEventListener('error', () => reject(new Error('素材读取失败，请重新选择文件')), { once: true })
  reader.readAsDataURL(file)
})

const probeAudioDuration = (source) => new Promise((resolve) => {
  const player = new Audio(source)
  let completed = false
  const finish = (duration = 0) => {
    if (completed) return
    completed = true
    player.removeAttribute('src')
    player.load()
    resolve(Number.isFinite(duration) && duration > 0 ? duration : 0)
  }
  player.addEventListener('loadedmetadata', () => finish(player.duration), { once: true })
  player.addEventListener('error', () => finish(0), { once: true })
  window.setTimeout(() => finish(0), 1500)
})

const splitSubtitleText = (value) => {
  const text = String(value || '').trim()
  if (text.length < 2) return [text, '']
  const midpoint = Math.floor(text.length / 2)
  const punctuation = Array.from(text).map((character, index) => /[，。！？；,.!?;]/u.test(character) ? index : -1).filter((index) => index >= 0)
  const splitIndex = punctuation.length
    ? punctuation.reduce((nearest, index) => Math.abs(index - midpoint) < Math.abs(nearest - midpoint) ? index : nearest, punctuation[0]) + 1
    : midpoint
  return [text.slice(0, splitIndex).trim(), text.slice(splitIndex).trim()]
}

const formatHistoryTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  const paths = {
    home: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.36.5.72 1 .92.2.08.42.1.64.1H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></>,
    spark: <><path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 22l-.7-2.3L16 18l2.3-.7Z"/></>,
    folder: <><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 9h18"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></>,
    script: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-3A4 4 0 0 1 7.5 13h3A4 4 0 0 1 14.5 17v3"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.5 14h2.5a3 3 0 0 1 3 3v3"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2Z"/></>,
    play: <path d="m9 7 8 5-8 5Z" fill="currentColor"/>,
    pause: <><path d="M9 7v10M15 7v10"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    history: <><path d="M4 7v5h5"/><path d="M5.6 16.5A8 8 0 1 0 6 6l-2 2"/><path d="M12 8v5l3 2"/></>,
    warning: <><path d="M10.2 4.7 3.3 17a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3L13.8 4.7a2 2 0 0 0-3.6 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    export: <><path d="M12 3v12M8 7l4-4 4 4M5 13v7h14v-7"/></>,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    scissors: <><circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="m8.2 8.2 11.3 7.3M8.2 15.8 19.5 8.5"/></>,
    upload: <><path d="M12 16V4M8 8l4-4 4 4M5 14v6h14v-6"/></>,
    download: <><path d="M12 4v12M8 12l4 4 4-4M5 14v6h14v-6"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.7 7M17.9 16A7 7 0 0 1 5.3 17"/></>,
    cloudOff: <><path d="m3 3 18 18M5.2 13A4 4 0 0 0 9 18h8a4 4 0 0 0 2.5-7.1A7 7 0 0 0 8 7.1"/></>,
    volume: <><path d="M5 10h3l4-4v12l-4-4H5zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    volumeOff: <><path d="M5 10h3l4-4v12l-4-4H5zM16 10l5 5M21 10l-5 5"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1" fill="currentColor" stroke="none"/></>,
    previous: <><path d="M7 6v12M18 7l-8 5 8 5Z" fill="currentColor"/></>,
    next: <><path d="M17 6v12M6 7l8 5-8 5Z" fill="currentColor"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  }
  return <svg {...common}>{paths[name] || paths.spark}</svg>
}

function Art({ variant = 1, portrait = false, image, label = '漫剧场景预览' }) {
  if (image) return <img className="art art--image" src={image} alt={label} />
  return (
    <div className={`art art--${variant} ${portrait ? 'art--portrait' : ''}`} role="img" aria-label={label}>
      <span className="art__moon" />
      <span className="art__city art__city--back" />
      <span className="art__city art__city--front" />
      <span className="art__figure"><i /></span>
      <span className="art__rain" />
      <span className="art__glow" />
    </div>
  )
}

function Avatar({ person, size = 'medium' }) {
  return (
    <span className={`avatar avatar--${size}`} title={person.name}>
      <Art variant={person.variant} portrait image={person.image} label={person.name} />
    </span>
  )
}

function TopBar({ page, onNavigate, onSearch, onSelectSearchResult }) {
  const projectPage = projectNavigation.some((item) => item.id === page)
  const navItems = projectPage ? projectNavigation : page === 'settings' ? [] : globalNavigation
  const [searchQuery, setSearchQuery] = useState('')
  const [searchPanel, setSearchPanel] = useState({ open: false, invalid: false, query: '', results: [] })
  const searchRef = useRef(null)
  const searchContainerRef = useRef(null)

  useEffect(() => {
    setSearchPanel((current) => current.open ? { ...current, open: false } : current)
  }, [page])

  useEffect(() => {
    if (!searchPanel.open) return undefined
    const closeOnOutsidePointer = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) {
        setSearchPanel((current) => ({ ...current, open: false }))
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [searchPanel.open])

  const runSearch = (value) => {
    const query = value.trim()
    if (!query) {
      setSearchPanel({ open: true, invalid: true, query: '', results: [] })
      searchRef.current?.focus()
      return
    }
    setSearchPanel({ open: true, invalid: false, query, results: onSearch(query) })
  }

  const submitSearch = (event) => {
    event.preventDefault()
    runSearch(searchQuery)
  }

  const updateSearchQuery = (value) => {
    setSearchQuery(value)
    if (searchPanel.open) runSearch(value)
  }

  const selectSearchResult = (result) => {
    setSearchPanel((current) => ({ ...current, open: false }))
    onSelectSearchResult(result)
  }

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Escape' || !searchPanel.open) return
    event.preventDefault()
    setSearchPanel((current) => ({ ...current, open: false }))
    searchRef.current?.focus()
  }

  const groupedResults = Object.entries(localSearchGroupDetails)
    .map(([type, details]) => ({ ...details, type, results: searchPanel.results.filter((result) => result.type === type) }))
    .filter((group) => group.results.length)

  return (
    <header className="topbar glass glass--bar">
      <button className="brand" onClick={() => onNavigate('studio')} aria-label="返回星幕工坊工作台">
        <span className="brand__mark">漫</span>
        <strong>星幕工坊</strong>
      </button>
      {page === 'settings' ? <span className="topbar__title">设置</span> : (
        <nav className="topnav" aria-label={projectPage ? '项目导航' : '全局导航'}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'is-active' : ''}
              onClick={() => onNavigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <form ref={searchContainerRef} className={`searchbox ${searchPanel.open ? 'is-open' : ''}`} onSubmit={submitSearch}>
        <Icon name="search" size={18} />
        <input
          ref={searchRef}
          value={searchQuery}
          onChange={(event) => updateSearchQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-label="搜索项目或素材"
          aria-controls="local-search-results"
          aria-expanded={searchPanel.open}
          aria-haspopup="listbox"
          placeholder="搜索项目或素材"
        />
        {searchPanel.open && <section id="local-search-results" className="local-search-popover" role="listbox" aria-label="本地搜索结果">
          {searchPanel.invalid ? <div className="local-search-empty is-invalid" role="alert"><Icon name="search" size={22} /><strong>请输入搜索关键词</strong><span>可搜索项目、角色、场景、分镜或台词</span></div> : groupedResults.length ? <>
            <header><span>本地搜索</span><small>{searchPanel.results.length} 条结果</small></header>
            <div className="local-search-groups">{groupedResults.map((group) => <section key={group.type} className="local-search-group" aria-label={group.label}>
              <h2><Icon name={group.icon} size={14} />{group.label}</h2>
              {group.results.map((result) => <button type="button" role="option" aria-selected="false" key={result.key} onClick={() => selectSearchResult(result)}>
                <span className="local-search-result__icon"><Icon name={group.icon} size={16} /></span>
                <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                <Icon name="arrow" size={14} />
              </button>)}
            </section>)}</div>
          </> : <div className="local-search-empty"><Icon name="search" size={22} /><strong>未找到本地结果</strong><span>没有与“{searchPanel.query}”匹配的项目内容</span></div>}
        </section>}
      </form>
      <button className={`icon-button ${page === 'settings' ? 'is-active' : ''}`} onClick={() => onNavigate('settings')} aria-label="打开设置">
        <Icon name="settings" size={21} />
      </button>
    </header>
  )
}

function StatusPill({ children, tone = 'ready' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

function HomePage({
  storySeed,
  setStorySeed,
  projectMeta,
  hasProject,
  episodes,
  scenes,
  characters,
  shots,
  recentProjects,
  onNavigate,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
  busy,
}) {
  const [genre, setGenre] = useState('悬疑')
  const [ratio, setRatio] = useState('9:16')
  const [duration, setDuration] = useState('60秒')
  const canCreate = storySeed.trim().length >= 2 && busy !== 'script'
  const visibleProjects = recentProjects.map((project, index) => ({
    id: project.path,
    name: project.name,
    episodes: project.episodeCount || 1,
    edited: new Date(project.updatedAt).toLocaleString('zh-CN', { hour12: false }),
    variant: (index % 6) + 1,
    path: project.path,
  }))

  return (
    <main className="page home-page">
      <section className="launch-grid">
        <article className="glass launch-card story-launch">
          <div className="section-title section-title--large">
            <span className="title-icon"><Icon name="spark" size={23} /></span>
            <div><h1>从一个故事开始</h1><p>输入故事灵感或梗概，我们帮你开启创作之旅</p></div>
          </div>
          <textarea
            value={storySeed}
            onChange={(event) => setStorySeed(event.target.value)}
            maxLength={500}
            placeholder="输入你自己的故事灵感或梗概。应用不会自动填充示例内容。"
            aria-label="故事灵感"
          />
          <div className="story-controls">
            <div className="chip-row" aria-label="选择题材">
              {['古风', '悬疑', '科幻', '都市'].map((item) => (
                <button key={item} className={genre === item ? 'is-active' : ''} onClick={() => setGenre(item)}>{item}</button>
              ))}
            </div>
            <label className="compact-select"><select value={ratio} onChange={(event) => setRatio(event.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select><Icon name="chevron" size={14} /></label>
            <label className="compact-select"><Icon name="clock" size={15} /><select value={duration} onChange={(event) => setDuration(event.target.value)}><option>60秒</option><option>30秒</option><option>90秒</option></select><Icon name="chevron" size={14} /></label>
          </div>
          <button className="primary-button primary-button--wide" disabled={!canCreate} onClick={() => onCreateProject({ storySeed, genre, ratio, duration })}>
            <Icon name="spark" size={20} />{busy === 'script' ? '正在创建…' : '创建新漫剧'}
          </button>
        </article>

        <article className="glass launch-card continue-card">
          <div className="section-title section-title--large"><span className="title-icon"><Icon name="play" size={22} /></span><h2>继续创作</h2></div>
          {hasProject ? <>
            <button className="continue-preview" onClick={() => onNavigate('overview')}><Art variant={1} label={`${projectMeta.name}项目预览`} /><span><strong>{projectMeta.name}</strong><small>{projectMeta.genre || '未设置题材'} · {projectMeta.ratio}</small></span></button>
            <div className="production-status">
              {[
                ['剧集', episodes.length],
                ['场景', scenes.length],
                ['角色', characters.length],
                ['分镜', shots.length],
              ].map(([label, count]) => <span key={label}><Icon name={count ? 'check' : 'clock'} size={15} /><b>{label}</b><small>{count} 项</small></span>)}
            </div>
            <button className="primary-button" onClick={() => onNavigate('overview')}>继续制作 <Icon name="arrow" size={17} /></button>
          </> : <div className="continue-empty">
            <span><Icon name="folder" size={28} /></span>
            <strong>还没有当前项目</strong>
            <p>输入自己的故事创建项目，或打开本机已有的 .manju 文件。</p>
            <button className="secondary-button" onClick={onOpenProject}><Icon name="upload" size={16} />打开本地项目</button>
          </div>}
        </article>
      </section>

      <section className="glass content-section recent-section">
        <div className="section-heading"><h2><Icon name="clock" size={21} />最近项目</h2><button className="link-button" onClick={onOpenProject}><Icon name="upload" size={16} />打开本地项目</button></div>
        {visibleProjects.length ? <div className="project-filmstrip">
          {visibleProjects.map((project) => (
            <button className="project-card" key={project.id} onClick={() => onOpenRecentProject(project.path)}>
              <Art variant={project.variant} label={project.name} />
              <span><strong>{project.name}</strong><small>共 {project.episodes} 集</small><small>上次编辑：{project.edited}</small></span>
              <i><Icon name="more" size={17} /></i>
            </button>
          ))}
        </div> : <div className="home-empty-data"><Icon name="folder" size={24} /><span><strong>暂无最近项目</strong><small>这里只显示你实际打开或保存过的本地项目。</small></span></div>}
      </section>

      <section className="glass content-section template-section">
        <div className="section-heading"><h2><Icon name="shield" size={21} />真实数据边界</h2></div>
        <div className="user-data-boundary">
          <article><Icon name="edit" size={20} /><span><strong>你输入的内容</strong><small>故事、角色、场景、台词与镜头参数</small></span></article>
          <article><Icon name="upload" size={20} /><span><strong>你导入的素材</strong><small>本地图片、音频与 .manju 项目</small></span></article>
          <article><Icon name="folder" size={20} /><span><strong>你保存的项目</strong><small>自动保存与最近项目均来自本机</small></span></article>
        </div>
      </section>
      <span className="local-mode"><Icon name="cloudOff" size={15} />仅展示本机真实用户数据 · 不填充示例内容</span>
    </main>
  )
}

function EmptyWorkspacePage({ onNavigate, onOpenProject }) {
  return (
    <main className="page project-page empty-workspace-page">
      <section className="glass empty-workspace-card">
        <span><Icon name="folder" size={34} /></span>
        <small>LOCAL USER DATA</small>
        <h1>还没有可编辑的项目</h1>
        <p>工作区只显示你输入、导入或保存到本机的真实内容，不会自动载入示例故事。</p>
        <div><button className="primary-button" onClick={() => onNavigate('home')}><Icon name="edit" size={16} />输入故事创建</button><button className="secondary-button" onClick={onOpenProject}><Icon name="upload" size={16} />打开本地项目</button></div>
      </section>
    </main>
  )
}

function EmptyProjectDataPage({ icon, title, description, actionLabel, onAction }) {
  return (
    <main className="page project-page empty-workspace-page">
      <section className="glass empty-workspace-card">
        <span><Icon name={icon} size={34} /></span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div><button className="primary-button" onClick={onAction}>{actionLabel}</button></div>
      </section>
    </main>
  )
}

const oneClickRunStatusDetails = {
  queued: { label: '正在准备', tone: 'running' },
  running: { label: '制作中', tone: 'running' },
  cooldown: { label: '限流冷却中', tone: 'warning' },
  pausing: { label: '完成当前项后暂停', tone: 'warning' },
  paused: { label: '已暂停', tone: 'warning' },
  stopping: { label: '完成当前项后停止', tone: 'warning' },
  stopped: { label: '已停止', tone: 'muted' },
  interrupted: { label: '等待继续', tone: 'warning' },
  'quota-stopped': { label: '免费额度已停止', tone: 'danger' },
  'completed-with-errors': { label: '已完成，有失败项', tone: 'warning' },
  completed: { label: '整部制作完成', tone: 'success' },
  failed: { label: '队列异常', tone: 'danger' },
}
const terminalTaskStatuses = new Set(['succeeded', 'failed', 'skipped'])

const formatOneClickElapsed = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`
}

function ZeroCostSafetyModal({ mode = 'start', settings, onClose, onConfirm, onOpenOfficial }) {
  const [checked, setChecked] = useState(false)
  const [openingOfficial, setOpeningOfficial] = useState(false)
  const confirmRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const openOfficial = async () => {
    setOpeningOfficial(true)
    await onOpenOfficial()
    setOpeningOfficial(false)
  }

  return <div className="zero-cost-safety-layer" role="presentation">
    <section className="zero-cost-safety-modal" role="dialog" aria-modal="true" aria-labelledby="zero-cost-safety-title">
      <header>
        <span><Icon name="shield" size={25} /></span>
        <div>
          <small>ZERO-COST SAFETY</small>
          <h2 id="zero-cost-safety-title">先开启“免费额度用完即停”</h2>
          <p>软件无法读取阿里云控制台的实时剩余额度，只保存你的本机确认，不会伪造已检测状态。</p>
        </div>
      </header>
      <div className="zero-cost-safety-warning">
        <Icon name="warning" size={20} />
        <span><strong>已认证账号默认可能在免费额度耗尽后转为按量计费</strong><small>请在官方控制台为下列模型逐一开启停止保护，再回到这里确认。</small></span>
      </div>
      <div className="zero-cost-model-list">
        {requiredZeroCostModels.map((item) => <article key={item.capability}>
          <span><Icon name={item.capability === 'script' ? 'script' : item.capability === 'image' ? 'image' : item.capability === 'voice' ? 'mic' : 'video'} size={18} /></span>
          <div><strong>{item.label}</strong><small>{item.model}</small></div>
          <em>需开启</em>
        </article>)}
      </div>
      <button type="button" className="zero-cost-official-button" disabled={openingOfficial} onClick={openOfficial}>
        <Icon name="export" size={16} />{openingOfficial ? '正在打开…' : '打开百炼免费额度设置'}
      </button>
      <label className={`zero-cost-attestation ${checked ? 'is-checked' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
        <span><Icon name={checked ? 'check' : 'shield'} size={17} /></span>
        <div><strong>我已为以上模型开启“免费额度用完即停”</strong><small>模型变化后本确认会自动失效；额度耗尽错误会立即停止整队。</small></div>
      </label>
      {settings?.invalidatedByModelChange && <p className="zero-cost-invalidated"><Icon name="warning" size={15} />模型配置已变化，需要重新确认。</p>}
      <footer>
        <button type="button" className="secondary-button" onClick={onClose}>暂不启用</button>
        <button
          ref={confirmRef}
          type="button"
          className="primary-button"
          disabled={!checked}
          onClick={onConfirm}
        ><Icon name="shield" size={16} />{mode === 'start' ? '确认并开始一键制作' : '保存 0 元保护确认'}</button>
      </footer>
    </section>
  </div>
}

function OneClickProductionDrawer({
  run,
  minimized,
  onMinimize,
  onExpand,
  onPause,
  onResume,
  onStop,
  onOpenSettings,
}) {
  if (!run) return null
  const summary = run.summary || summarizeOneClickRun(run)
  const status = oneClickRunStatusDetails[run.status] || { label: run.status || '未知状态', tone: 'muted' }
  const currentTask = run.tasks?.find((task) => task.id === run.currentTaskId)
  const canPause = ['running', 'cooldown'].includes(run.status)
  const canResume = ['paused', 'interrupted', 'stopped', 'completed-with-errors', 'quota-stopped'].includes(run.status)
  const canStop = ['running', 'cooldown', 'pausing', 'paused', 'interrupted'].includes(run.status)

  if (minimized) {
    return <button type="button" className={`one-click-production-dock is-${status.tone}`} onClick={onExpand}>
      <span><Icon name={run.status === 'completed' ? 'check' : run.status === 'quota-stopped' ? 'warning' : 'spark'} size={19} /></span>
      <div><strong>{status.label}</strong><small>{summary.completed}/{summary.total} 项 · 点击展开</small></div>
      <i style={{ '--one-click-progress': `${summary.total ? (summary.completed / summary.total) * 100 : 100}%` }} />
    </button>
  }

  return <div className="one-click-production-drawer-layer">
    <aside className="one-click-production-drawer" aria-label="整部漫剧制作进度">
      <header>
        <span><Icon name="spark" size={22} /></span>
        <div><small>ONE-CLICK PRODUCTION</small><h2>整部漫剧制作</h2></div>
        <em data-tone={status.tone}><i />{status.label}</em>
        <button type="button" className="inline-icon" onClick={onMinimize} aria-label="最小化制作进度"><Icon name="chevron" size={18} /></button>
      </header>
      <div className="one-click-production-overall">
        <div><strong>{summary.completed}<small> / {summary.total}</small></strong><span>已处理任务</span></div>
        <i><b style={{ width: `${summary.total ? (summary.completed / summary.total) * 100 : 100}%` }} /></i>
        <p><span>{summary.succeeded} 成功</span><span>{summary.failed} 失败</span><span>{summary.pending} 等待</span></p>
      </div>
      <div className="one-click-production-stages">
        {oneClickProductionStageDefinitions.filter((stage) => !['preflight', 'finalize'].includes(stage.id)).map((stage) => {
          const stageTasks = run.tasks?.filter((task) => task.stage === stage.id) || []
          const completed = stageTasks.filter((task) => terminalTaskStatuses.has(task.status)).length
          const active = stageTasks.some((task) => ['running', 'cooldown'].includes(task.status))
          const failed = stageTasks.some((task) => task.status === 'failed')
          return <article key={stage.id} className={active ? 'is-active' : completed === stageTasks.length && stageTasks.length ? 'is-complete' : ''}>
            <span><Icon name={completed === stageTasks.length && stageTasks.length ? 'check' : active ? 'spark' : failed ? 'warning' : 'clock'} size={15} /></span>
            <div><strong>{stage.label}</strong><small>{stageTasks.length ? `${completed}/${stageTasks.length}` : '无需生成'}</small></div>
          </article>
        })}
      </div>
      <section className="one-click-current-task">
        <header><h3>当前任务</h3>{currentTask?.elapsedMilliseconds > 0 && <time>{formatOneClickElapsed(currentTask.elapsedMilliseconds)}</time>}</header>
        {currentTask ? <div>
          <span><Icon name={currentTask.kind === 'shot-video' || currentTask.kind === 'episode-export' ? 'video' : currentTask.kind === 'voice-line' || currentTask.kind === 'voice-assignment' ? 'mic' : 'image'} size={18} /></span>
          <p><strong>{currentTask.label}</strong><small>{currentTask.localMessage || (currentTask.kind === 'shot-video'
            ? `百炼状态：${currentTask.pollStatus || '正在提交'}`
            : currentTask.kind === 'voice-line' ? '真实 TTS · 下载 WAV 后自动采用'
              : currentTask.kind === 'episode-export' ? '本地 FFmpeg 正在合成配音、字幕与视频'
                : currentTask.kind === 'voice-assignment' ? '按角色属性匹配官方音色'
                  : '单张生成 · 本地保存后自动采用')}</small></p>
        </div> : <div className="is-idle"><span><Icon name={run.status === 'completed' ? 'check' : 'clock'} size={18} /></span><p><strong>{status.label}</strong><small>{run.status === 'completed' ? '所有缺失资产已处理并保存到本机' : '当前没有正在执行的任务'}</small></p></div>}
      </section>
      {run.status === 'quota-stopped' && <div className="one-click-quota-stop"><Icon name="shield" size={19} /><span><strong>免费额度已用完，队列已停止</strong><small>没有切换模型、没有重试，也不会继续调用。请先到百炼控制台处理。</small></span></div>}
      {run.error && <div className="one-click-run-error"><Icon name="warning" size={17} />{run.error}</div>}
      <section className="one-click-task-log">
        <header><h3>任务记录</h3><span>{run.tasks?.length || 0} 项</span></header>
        <div>{(run.tasks || []).slice().reverse().map((task) => <article key={task.id} data-status={task.status}>
          <span><Icon name={task.status === 'succeeded' ? 'check' : task.status === 'failed' ? 'warning' : task.status === 'running' ? 'spark' : 'clock'} size={14} /></span>
          <div><strong>{task.label}</strong><small>{task.status === 'failed' ? task.error : task.status === 'succeeded' ? task.kind === 'episode-export' ? '本地 MP4 已导出' : '已保存并采用' : task.status === 'cooldown' ? task.localMessage || '冷却后自动重试' : task.status === 'running' ? '正在执行' : '等待执行'}</small></div>
        </article>)}</div>
      </section>
      <footer>
        <button type="button" className="secondary-button" onClick={onOpenSettings}><Icon name="shield" size={15} />0 元设置</button>
        <span />
        {canPause && <button type="button" className="secondary-button" onClick={onPause}><Icon name="pause" size={15} />暂停</button>}
        {canResume && <button type="button" className="primary-button" onClick={onResume}><Icon name="play" size={15} />{run.status === 'quota-stopped' ? '确认后重试失败项' : '继续制作'}</button>}
        {canStop && <button type="button" className="secondary-button one-click-stop-button" onClick={onStop}>停止后续任务</button>}
      </footer>
    </aside>
  </div>
}

function OverviewPage({
  projectMeta,
  storySeed,
  currentFile,
  episodes,
  setEpisodes,
  scenes,
  setScenes,
  setShots,
  setLines,
  characters,
  selectedEpisode,
  setSelectedEpisode,
  setSelectedScene,
  onNavigate,
  onNotice,
  onOpenProject,
  onSaveProject,
  onSaveAsProject,
  onRenameProject,
  oneClickPlan,
  oneClickRun,
  zeroCostSettings,
  onStartOneClick,
  onOpenOneClickProgress,
}) {
  const [renamingProject, setRenamingProject] = useState(false)
  const [storyExpanded, setStoryExpanded] = useState(false)
  const [storyCanExpand, setStoryCanExpand] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState(projectMeta.name)
  const [projectNameError, setProjectNameError] = useState('')
  const projectNameInputRef = useRef(null)
  const storySummaryTextRef = useRef(null)
  const renameTriggerRef = useRef(null)
  const restoreRenameFocusRef = useRef(false)
  const projectNameHelperId = 'project-name-helper'

  useEffect(() => {
    if (!renamingProject) {
      if (!restoreRenameFocusRef.current) return undefined
      restoreRenameFocusRef.current = false
      const focusTimer = window.setTimeout(() => renameTriggerRef.current?.focus(), 0)
      return () => window.clearTimeout(focusTimer)
    }
    const focusProjectName = () => {
      projectNameInputRef.current?.focus()
      projectNameInputRef.current?.select()
    }
    focusProjectName()
    const focusTimer = window.setTimeout(focusProjectName, 0)
    return () => window.clearTimeout(focusTimer)
  }, [renamingProject])

  useEffect(() => {
    setStoryExpanded(false)
  }, [projectMeta.localProjectId])

  useEffect(() => {
    const updateStoryOverflow = () => {
      const element = storySummaryTextRef.current
      if (!element) return
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 24
      setStoryCanExpand(element.scrollHeight > lineHeight * 4 + 1)
    }
    updateStoryOverflow()
    const timer = window.setTimeout(updateStoryOverflow, 0)
    const resizeObserver = new ResizeObserver(updateStoryOverflow)
    if (storySummaryTextRef.current) resizeObserver.observe(storySummaryTextRef.current)
    window.addEventListener('resize', updateStoryOverflow)
    return () => {
      window.clearTimeout(timer)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateStoryOverflow)
    }
  }, [storySeed])

  const beginProjectRename = () => {
    setProjectNameDraft(projectMeta.name)
    setProjectNameError('')
    setRenamingProject(true)
  }

  const cancelProjectRename = () => {
    restoreRenameFocusRef.current = true
    setRenamingProject(false)
    setProjectNameDraft(projectMeta.name)
    setProjectNameError('')
  }

  const confirmProjectRename = () => {
    const result = onRenameProject(projectNameDraft)
    if (!result.ok) {
      setProjectNameError(result.error)
      projectNameInputRef.current?.focus()
      return
    }
    restoreRenameFocusRef.current = true
    setRenamingProject(false)
    setProjectNameDraft(result.name)
    setProjectNameError('')
  }

  const updateProjectNameDraft = (value) => {
    setProjectNameDraft(value)
    const validation = validateProjectName(value)
    setProjectNameError(validation.ok ? '' : validation.error)
  }

  const handleProjectNameKeyDown = (event) => {
    if (event.key === 'Enter' && !event.isComposing && !event.nativeEvent?.isComposing) {
      event.preventDefault()
      confirmProjectRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelProjectRename()
    }
  }

  const updateEpisode = (id, field, value) => setEpisodes((items) => items.map((episode) => episode.id === id ? { ...episode, [field]: value } : episode))
  const addEpisode = () => {
    const id = Math.max(0, ...episodes.map((episode) => episode.id)) + 1
    const sceneId = Math.max(0, ...scenes.map((scene) => scene.id)) + 1
    setEpisodes((items) => [...items, { id, title: '未命名剧集', variant: (id % 6) + 1, statuses: ['剧本'], next: '继续剧本' }])
    setScenes((items) => [...items, { id: sceneId, episodeId: id, title: `场景 ${sceneId}`, location: '', time: '', weather: '', mainCharacterIds: [], status: '当前编辑', action: '', narration: '' }])
    setSelectedEpisode(id)
    setSelectedScene(sceneId)
    onNotice('已新增剧集并创建第一个场景')
  }
  const moveEpisode = (id, direction) => setEpisodes((items) => {
    const index = items.findIndex((episode) => episode.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return items
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const deleteEpisode = (id) => {
    if (episodes.length === 1) {
      onNotice('项目至少需要保留一个剧集')
      return
    }
    const target = episodes.find((episode) => episode.id === id)
    if (!window.confirm(`删除“${target?.title || '该剧集'}”及其全部场景、分镜和台词？`)) return
    const remaining = episodes.filter((episode) => episode.id !== id)
    setEpisodes(remaining)
    setScenes((items) => items.filter((scene) => scene.episodeId !== id))
    setShots((items) => items.filter((shot) => shot.episodeId !== id))
    setLines((items) => items.filter((line) => line.episodeId !== id))
    if (selectedEpisode === id) {
      const nextEpisode = remaining[0]
      setSelectedEpisode(nextEpisode.id)
      setSelectedScene(scenes.find((scene) => scene.episodeId === nextEpisode.id)?.id || 1)
    }
    onNotice('剧集及其关联场景、分镜和台词已删除')
  }
  return (
    <main className="page project-page overview-page">
      <section className="glass project-identity">
        <Art variant={1} label={`${projectMeta.name}封面`} />
        <div className="project-identity__meta">
          {renamingProject ? (
            <div className="project-name-editor">
              <div className="project-name-editor__row">
                <input
                  ref={projectNameInputRef}
                  className={`project-name-input ${projectNameError ? 'is-invalid' : ''}`}
                  value={projectNameDraft}
                  onChange={(event) => updateProjectNameDraft(event.target.value)}
                  onKeyDown={handleProjectNameKeyDown}
                  aria-label="项目名称"
                  aria-invalid={Boolean(projectNameError)}
                  aria-describedby={projectNameHelperId}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button type="button" className="project-name-action project-name-action--confirm" onClick={confirmProjectRename} aria-label="确认项目名称修改" title="确认修改"><Icon name="check" size={17} /></button>
                <button type="button" className="project-name-action project-name-action--cancel" onClick={cancelProjectRename} aria-label="取消项目名称修改" title="取消修改"><Icon name="close" size={17} /></button>
              </div>
              <p id={projectNameHelperId} className={projectNameError ? 'project-name-helper is-error' : 'project-name-helper'} role={projectNameError ? 'alert' : undefined}>
                {projectNameError || (currentFile ? '修改显示名称不会重命名磁盘文件；保存后更新项目内容。' : '新名称会自动保存；首次保存时作为默认文件名。')}
              </p>
            </div>
          ) : (
            <>
              <h1 title={projectMeta.name}><span>{projectMeta.name}</span> <button ref={renameTriggerRef} type="button" className="inline-icon project-name-edit" onClick={beginProjectRename} aria-label={`编辑项目名称，当前名称：${projectMeta.name}`} title="编辑项目名称"><Icon name="edit" size={16} /></button></h1>
              <p><span className="save-dot" />{currentFile ? `本地项目 · ${currentFile}` : '本地草稿 · 自动保存已开启'}</p>
            </>
          )}
        </div>
        <div className="project-actions"><button className="secondary-button" onClick={onOpenProject}><Icon name="folder" size={17} />打开</button><button className="secondary-button" onClick={() => onSaveProject(false)}><Icon name="check" size={17} />保存</button><button className="secondary-button" onClick={onSaveAsProject}>另存为</button><button className="secondary-button" onClick={() => onNavigate('final')}><Icon name="export" size={17} />成片</button></div>
      </section>
      <div className="overview-grid">
        <section className="glass episode-panel">
          <div className="section-heading"><h2><Icon name="video" size={21} />剧集</h2></div>
          <div className="episode-list">
            {episodes.map((episode, index) => (
              <article className="episode-row" key={episode.id}>
                <button className="episode-art" onClick={() => { setSelectedEpisode(episode.id); setSelectedScene(scenes.find((scene) => scene.episodeId === episode.id)?.id || 1); onNavigate('script') }}><Art variant={episode.variant} label={`第${index + 1}集`} /></button>
                <div className="episode-info"><h3><span>第 {index + 1} 集</span><input className="episode-title-input" value={episode.title} onChange={(event) => updateEpisode(episode.id, 'title', event.target.value)} /></h3><p>场景 {scenes.filter((scene) => scene.episodeId === episode.id).length}</p><div className="avatar-stack">{characters.slice(0, 4).map((person) => <Avatar key={person.id} person={person} size="small" />)}</div><div className="episode-status">{['剧本', '分镜', '配音', '成片'].map((status) => <span key={status} className={episode.statuses.includes(status) ? 'is-ready' : ''}><Icon name={episode.statuses.includes(status) ? 'check' : 'clock'} size={14} />{status}<small>{episode.statuses.includes(status) ? '已完成' : '未开始'}</small></span>)}</div></div>
                <div className="episode-actions"><button className="inline-icon move-up" disabled={index === 0} onClick={() => moveEpisode(episode.id, -1)} aria-label="上移剧集"><Icon name="arrow" size={15} /></button><button className="inline-icon move-down" disabled={index === episodes.length - 1} onClick={() => moveEpisode(episode.id, 1)} aria-label="下移剧集"><Icon name="arrow" size={15} /></button><button className="inline-icon delete-action" onClick={() => deleteEpisode(episode.id)} aria-label="删除剧集"><Icon name="trash" size={15} /></button></div>
              </article>
            ))}
          </div>
          <button className="dashed-button" onClick={addEpisode}><Icon name="plus" size={18} />新增一集</button>
        </section>
        <aside className="overview-side">
          <section className={`glass story-summary ${storyExpanded ? 'is-expanded' : ''}`}><h2><Icon name="script" size={20} />故事简介</h2><p ref={storySummaryTextRef} className="story-summary__text">{storySeed}</p>{storyCanExpand && <button type="button" className="story-summary__toggle" aria-expanded={storyExpanded} onClick={() => setStoryExpanded((current) => !current)}>{storyExpanded ? '收起' : '展开全部'} <Icon name="chevron" size={15} /></button>}</section>
          <section className="glass next-work one-click-overview-card" data-testid="one-click-overview-card">
            <header>
              <span><Icon name="spark" size={21} /></span>
              <div><small>ONE-CLICK PRODUCTION</small><h2>一键制作整部漫剧</h2></div>
              <em className={zeroCostSettings?.confirmed ? 'is-ready' : ''}><Icon name="shield" size={13} />{zeroCostSettings?.confirmed ? '0 元保护已确认' : '首次需确认'}</em>
            </header>
            <p>从现有剧本自动匹配角色音色、补齐图片、生成台词配音和镜头视频，最后在本机直接合成每集 MP4。</p>
            <div className="one-click-overview-counts">
              <span><b>{oneClickPlan?.counts?.['character-images'] || 0}</b><small>角色图</small></span>
              <span><b>{oneClickPlan?.counts?.['storyboard-images'] || 0}</b><small>分镜图</small></span>
              <span><b>{oneClickPlan?.counts?.['voice-lines'] || 0}</b><small>台词配音</small></span>
              <span><b>{oneClickPlan?.counts?.['shot-videos'] || 0}</b><small>镜头视频</small></span>
              <span><b>{oneClickPlan?.counts?.['episode-exports'] || 0}</b><small>自动成片</small></span>
            </div>
            {oneClickRun && !['completed', 'stopped'].includes(oneClickRun.status)
              ? <button type="button" className="primary-button" onClick={onOpenOneClickProgress}><Icon name="spark" size={17} />查看制作进度 <span>{oneClickRun.summary?.completed || 0}/{oneClickRun.summary?.total || 0}</span></button>
              : <button type="button" className="primary-button" disabled={!oneClickPlan?.ok} onClick={onStartOneClick}><Icon name="play" size={17} />{oneClickPlan?.total ? `开始制作 ${oneClickPlan.total} 项` : '当前项目已补齐'}</button>}
            <footer><span><Icon name="clock" size={13} />主动限流 · 限流后最多自动重试 3 次</span><button type="button" onClick={() => onNavigate('script')}>先检查剧本 <Icon name="arrow" size={13} /></button></footer>
          </section>
        </aside>
      </div>
    </main>
  )
}

function DialogueSplitModal({ characters, existingLines, episodeId, scene, onClose, onCommit }) {
  const [source, setSource] = useState('')
  const [rows, setRows] = useState([])
  const [parseResult, setParseResult] = useState(() => parseDialogueSource({ source: '', characters }))
  const [mode, setMode] = useState('append')
  const [composing, setComposing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [commitError, setCommitError] = useState('')
  const [sizeBlocked, setSizeBlocked] = useState(false)
  const modalRef = useRef(null)
  const sourceRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusSource = () => sourceRef.current?.focus()
    focusSource()
    const focusFrame = window.requestAnimationFrame(focusSource)
    const focusTimer = window.setTimeout(focusSource, 0)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (composing) return undefined
    const parseTimer = window.setTimeout(() => {
      const result = parseDialogueSource({ source, characters })
      setParseResult(result)
      setRows(result.rows)
      setCommitError('')
      setSizeBlocked(false)
    }, 150)
    return () => window.clearTimeout(parseTimer)
  }, [source, characters, composing])

  const analyzedRows = useMemo(() => analyzeDialoguePreviewRows({
    rows,
    characters,
    existingLines,
    episodeId,
    sceneId: scene.id,
    mode,
  }), [rows, characters, existingLines, episodeId, scene.id, mode])
  const summary = useMemo(() => summarizeDialoguePreviewRows(analyzedRows), [analyzedRows])
  const replaceAudioCount = existingLines.filter((line) => line.audio || line.audioFileName || line.audioSource || line.audioStatus === '已完成').length
  const canCommit = !submitting
    && !parseResult.blocked
    && !sizeBlocked
    && summary.readyCount > 0
    && summary.unresolvedCount === 0

  const updateRow = (id, patch) => {
    setRows((items) => items.map((row) => row.id === id ? { ...row, ...patch } : row))
    setCommitError('')
    setSizeBlocked(false)
  }

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setCommitError('')
    setSizeBlocked(false)
  }

  const useCurrentDialogue = () => {
    setSource(existingLines.map((line) => (
      `${line.speaker}${line.emotion && line.emotion !== '默认' ? `（${line.emotion}）` : ''}：${line.text}`
    )).join('\n'))
  }

  const clearSource = () => {
    if (source.trim() && !window.confirm('清空当前台词拆分草稿？')) return
    setSource('')
    setRows([])
    setParseResult(parseDialogueSource({ source: '', characters }))
    setCommitError('')
    setSizeBlocked(false)
    sourceRef.current?.focus()
  }

  const submit = async () => {
    if (!canCommit) return
    if (mode === 'replace' && existingLines.length) {
      const confirmed = window.confirm(`替换会移除当前场景 ${existingLines.length} 条台词及其中 ${replaceAudioCount} 条音频，是否继续？`)
      if (!confirmed) return
    }
    setSubmitting(true)
    setCommitError('')
    const result = await Promise.resolve(onCommit({ mode, rows, episodeId, scene }))
    if (!result.ok) {
      setCommitError(result.error || '台词同步失败，请重试。')
      setSizeBlocked(Boolean(result.sizeBlocked))
      setSubmitting(false)
      return
    }
    onClose()
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Enter' && event.ctrlKey && !event.isComposing && !composing) {
      event.preventDefault()
      submit()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled)') || [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const statusIcon = (status) => status === 'ready'
    ? 'check'
    : status === 'duplicate'
      ? 'copy'
      : status === 'excluded' || status === 'unrecognized-format'
        ? 'close'
        : 'warning'
  const impactText = commitError || (mode === 'replace'
    ? `将替换当前 ${existingLines.length} 条台词，其中 ${replaceAudioCount} 条含音频。`
    : `将新增 ${summary.readyCount} 条台词，并同步到配音页。`)

  return (
    <div className="dialogue-split-layer" onKeyDown={handleDialogKeyDown}>
      <section ref={modalRef} id="dialogue-split-modal" className="dialogue-split-modal" role="dialog" aria-modal="true" aria-labelledby="dialogue-split-title">
        <header className="dialogue-split-header">
          <div><h2 id="dialogue-split-title">拆分角色台词</h2><p>从带说话人标记的文本中本地识别，不调用 AI</p></div>
          <span className="dialogue-local-badge"><Icon name="lock" size={14} />仅本机解析</span>
          <button className="dialogue-split-close" type="button" onClick={onClose} aria-label="关闭台词拆分"><Icon name="close" size={18} /></button>
        </header>
        <div className="dialogue-split-body">
          <section className="dialogue-source-pane">
            <div className="dialogue-pane-heading"><div><h3>原始剧本文本</h3><p>每行一条，使用“角色：台词”</p></div></div>
            <div className="dialogue-format-hints"><span>角色名：台词内容</span><span>角色名（情绪）：台词内容</span></div>
            <div className={`dialogue-source-input ${parseResult.blocked ? 'is-invalid' : ''}`}>
              <textarea
                ref={sourceRef}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(event) => { setComposing(false); setSource(event.currentTarget.value) }}
                placeholder={'角色名：输入台词内容\n角色名（紧张）：输入带情绪的台词'}
                aria-label="原始剧本文本"
                aria-describedby="dialogue-source-help"
                spellCheck="false"
              />
              <small id="dialogue-source-help">{parseResult.removedControlCharacters ? `已移除 ${parseResult.removedControlCharacters} 个控制字符 · ` : ''}{Array.from(source).length.toLocaleString('zh-CN')} / {maximumDialogueSourceCharacters.toLocaleString('zh-CN')}</small>
            </div>
            {parseResult.error && <p className="dialogue-source-error" role="alert">{parseResult.error}</p>}
            <div className="dialogue-source-tools"><button type="button" disabled={!existingLines.length} onClick={useCurrentDialogue}>使用当前台词</button><button type="button" disabled={!source} onClick={clearSource}>清空</button></div>
          </section>
          <section className="dialogue-preview-pane">
            <header className="dialogue-preview-summary"><div><h3>拆分预览</h3><p aria-live="polite">识别 {summary.readyCount} 条 · 待处理 {summary.unresolvedCount} 行 · 重复 {summary.duplicateCount} 条</p></div><span>{parseResult.totalRows || 0} 行</span></header>
            {analyzedRows.length ? (
              <div className="dialogue-preview-list">
                {analyzedRows.map((row) => (
                  <article className={`dialogue-preview-row dialogue-preview-row--${row.status}`} key={row.id}>
                    <button
                      type="button"
                      className="dialogue-include-toggle"
                      disabled={!row.formatRecognized}
                      aria-pressed={row.included}
                      aria-label={`${row.included ? '排除' : '包含'}第 ${row.lineNumber} 行`}
                      onClick={() => updateRow(row.id, { included: !row.included })}
                    ><Icon name={row.included ? 'check' : 'close'} size={14} /></button>
                    <select
                      value={row.speaker}
                      disabled={!row.formatRecognized || !row.included}
                      aria-label={`第 ${row.lineNumber} 行说话人`}
                      onChange={(event) => updateRow(row.id, { speaker: event.target.value })}
                    ><option value="">请选择角色</option>{characters.map((character) => <option key={character.id} value={character.name}>{character.name}</option>)}</select>
                    <select
                      value={row.emotion}
                      disabled={!row.formatRecognized || !row.included}
                      aria-label={`第 ${row.lineNumber} 行情绪`}
                      onChange={(event) => updateRow(row.id, { emotion: event.target.value })}
                    ><option value="">{row.originalEmotion ? `原：${row.originalEmotion}` : '请选择情绪'}</option>{dialogueEmotionOptions.map((emotion) => <option key={emotion} value={emotion}>{emotion}</option>)}</select>
                    <input
                      value={row.text}
                      disabled={!row.formatRecognized || !row.included}
                      aria-label={`第 ${row.lineNumber} 行台词`}
                      onChange={(event) => updateRow(row.id, { text: event.target.value })}
                    />
                    <span className="dialogue-parse-status"><Icon name={statusIcon(row.status)} size={14} />{row.message}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dialogue-preview-empty"><Icon name="script" size={42} /><strong>{source.trim() ? '没有识别到可预览的台词' : '粘贴带说话人标记的剧本文本'}</strong><p>{source.trim() ? '请检查输入长度、冒号和说话人名称。' : '识别结果会在这里预览，确认前不会修改项目。'}</p></div>
            )}
          </section>
        </div>
        <footer className="dialogue-split-footer">
          <div className="dialogue-commit-mode" role="radiogroup" aria-label="台词同步模式">
            <label className={mode === 'append' ? 'is-active' : ''}><input type="radio" name="dialogue-commit-mode" value="append" checked={mode === 'append'} onChange={() => changeMode('append')} />追加到现有台词</label>
            <label className={mode === 'replace' ? 'is-active is-warning' : ''}><input type="radio" name="dialogue-commit-mode" value="replace" checked={mode === 'replace'} onChange={() => changeMode('replace')} />替换当前台词</label>
          </div>
          <p className={commitError ? 'dialogue-impact is-error' : mode === 'replace' ? 'dialogue-impact is-warning' : 'dialogue-impact'}><Icon name={commitError || mode === 'replace' ? 'warning' : 'check'} size={15} />{impactText}</p>
          <div className="dialogue-footer-actions"><button className="secondary-button" type="button" disabled={submitting} onClick={onClose}>取消</button><button className={`dialogue-commit-button ${mode === 'replace' ? 'is-warning' : ''}`} type="button" disabled={!canCommit} onClick={submit}>{submitting ? '同步中…' : mode === 'replace' ? `替换并同步 ${summary.readyCount} 条` : `同步 ${summary.readyCount} 条台词`}</button></div>
        </footer>
      </section>
    </div>
  )
}

function ScriptOrganizerModal({ scene, lines, shots, episodeId, onClose, onCommit }) {
  const [scopes, setScopes] = useState(() => ({ ...defaultScriptOrganizerScopes }))
  const [rules, setRules] = useState(() => ({ ...defaultScriptOrganizerRules }))
  const [excludedIds, setExcludedIds] = useState(() => new Set())
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [filter, setFilter] = useState('all')
  const [composing, setComposing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [commitError, setCommitError] = useState('')
  const [sizeBlocked, setSizeBlocked] = useState(false)
  const modalRef = useRef(null)
  const firstScopeRef = useRef(null)

  const preview = useMemo(() => createScriptOrganizerPreview({
    scene,
    lines,
    shots,
    episodeId,
    scopes,
    rules,
  }), [scene, lines, shots, episodeId, scopes, rules])
  const includedIds = useMemo(() => preview.changes
    .filter((change) => !excludedIds.has(change.id))
    .map((change) => change.id), [preview.changes, excludedIds])
  const summary = useMemo(() => summarizeScriptOrganizerSelection(preview, includedIds), [preview, includedIds])
  const visibleChanges = filter === 'all' ? preview.changes : preview.changes.filter((change) => change.kind === filter)
  const selectedScopeCount = Object.values(scopes).filter(Boolean).length
  const currentLineCount = lines.filter((line) => line.episodeId === episodeId && line.sceneId === scene.id).length
  const canCommit = summary.canCommit && !submitting && !sizeBlocked

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => firstScopeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const changeIds = new Set(preview.changes.map((change) => change.id))
    setExcludedIds((current) => {
      const next = new Set([...current].filter((id) => changeIds.has(id)))
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current
      return next
    })
    setCommitError('')
    setSizeBlocked(false)
  }, [preview.changes])

  const toggleScope = (scopeId) => {
    if (scopes[scopeId] && selectedScopeCount === 1) return
    setScopes((current) => ({ ...current, [scopeId]: !current[scopeId] }))
    setCommitError('')
    setSizeBlocked(false)
  }

  const toggleRule = (ruleId) => {
    setRules((current) => ({ ...current, [ruleId]: !current[ruleId] }))
    setCommitError('')
    setSizeBlocked(false)
  }

  const toggleChange = (changeId) => {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (next.has(changeId)) next.delete(changeId)
      else next.add(changeId)
      return next
    })
    setCommitError('')
    setSizeBlocked(false)
  }

  const toggleExpanded = (changeId) => setExpandedIds((current) => {
    const next = new Set(current)
    if (next.has(changeId)) next.delete(changeId)
    else next.add(changeId)
    return next
  })

  const submit = async () => {
    if (!canCommit) return
    if (summary.audioCount > 0 && !window.confirm(`本次整理会重置 ${summary.audioCount} 条台词的配音状态，是否继续？`)) return
    setSubmitting(true)
    setCommitError('')
    const result = await Promise.resolve(onCommit({
      selectedChanges: summary.selectedChanges,
      episodeId,
      sceneId: scene.id,
    }))
    if (!result.ok) {
      setCommitError(result.error || '剧本整理失败，请重试。')
      setSizeBlocked(Boolean(result.sizeBlocked))
      setSubmitting(false)
      return
    }
    onClose()
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Enter' && event.ctrlKey && !event.isComposing && !event.nativeEvent?.isComposing && !composing) {
      event.preventDefault()
      submit()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const impactText = commitError || `将应用 ${summary.selectedCount} 项；${summary.audioCount} 条配音会重置；现有 ${summary.shotCount} 个分镜保持不变`
  const filterOptions = [
    { id: 'all', label: '全部', count: preview.changes.length },
    { id: 'action', label: '动作', count: preview.changes.filter((change) => change.kind === 'action').length },
    { id: 'narration', label: '旁白', count: preview.changes.filter((change) => change.kind === 'narration').length },
    { id: 'dialogue', label: '台词', count: preview.changes.filter((change) => change.kind === 'dialogue').length },
  ]

  return (
    <div className="script-organizer-layer" onKeyDown={handleDialogKeyDown} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      <section ref={modalRef} id="script-organizer-modal" className="script-organizer-modal" role="dialog" aria-modal="true" aria-labelledby="script-organizer-title">
        <header className="script-organizer-header">
          <div><h2 id="script-organizer-title">本地整理剧本</h2><p>按确定性规则检查格式，确认前不会修改项目 · {scene.title}</p></div>
          <span className="script-organizer-local-badge"><Icon name="lock" size={14} />仅本机规则</span>
          <button className="script-organizer-close" type="button" onClick={onClose} aria-label="关闭剧本整理"><Icon name="close" size={18} /></button>
        </header>
        <div className="script-organizer-body">
          <aside className="script-organizer-controls">
            <section className="organizer-control-section organizer-scope-section">
              <h3>整理范围</h3>
              <div className="organizer-scope-list">
                {scriptOrganizerScopeOptions.map((scope, index) => (
                  <label className={scopes[scope.id] ? 'is-selected' : ''} key={scope.id}>
                    <input ref={index === 0 ? firstScopeRef : undefined} autoFocus={index === 0} type="checkbox" checked={scopes[scope.id]} disabled={scopes[scope.id] && selectedScopeCount === 1} onChange={() => toggleScope(scope.id)} />
                    <span><b>{scope.label}{scope.id === 'dialogue' ? `（${currentLineCount}）` : ''}</b><small>{scope.id === 'action' ? '镜头可见事件' : scope.id === 'narration' ? '旁白与内心独白' : '保持角色、情绪和顺序'}</small></span>
                    {scope.id === 'dialogue' && <Icon name="mic" size={14} />}
                  </label>
                ))}
              </div>
            </section>
            <section className="organizer-control-section organizer-rule-section">
              <h3>整理规则</h3>
              <div className="organizer-rule-list">
                {scriptOrganizerRuleOptions.map((rule) => (
                  <label className={`${rules[rule.id] ? 'is-selected' : ''} ${rule.optional ? 'is-optional' : ''}`} key={rule.id}>
                    <input type="checkbox" checked={rules[rule.id]} onChange={() => toggleRule(rule.id)} />
                    <span><b>{rule.label}{rule.optional && <em>可选</em>}</b><small>{rule.hint}</small></span>
                    <output>{preview.ruleCounts[rule.id] || 0} 项</output>
                  </label>
                ))}
              </div>
            </section>
            <section className="organizer-quality-card" aria-live="polite">
              <span><Icon name="check" size={15} /><b>{preview.changes.length}</b><small>可整理</small></span>
              <span><Icon name="warning" size={15} /><b>{summary.warningCount}</b><small>仅提醒</small></span>
              <span><Icon name="mic" size={15} /><b>{summary.audioCount}</b><small>影响配音</small></span>
            </section>
            <section className="organizer-diagnostics">
              <h3>剧本体检 <span>{preview.diagnostics.length}</span></h3>
              {preview.diagnostics.length ? <div>{preview.diagnostics.map((item) => <p className={`is-${item.severity}`} key={item.id} title={item.title || item.message}><Icon name={item.severity === 'info' ? 'check' : 'warning'} size={13} />{item.message}</p>)}</div> : <p className="organizer-diagnostics-empty"><Icon name="check" size={14} />未发现额外问题</p>}
            </section>
          </aside>
          <section className="script-organizer-preview">
            <header className="organizer-preview-header">
              <div><h3>变更预览</h3><p aria-live="polite">选中 {summary.selectedCount}/{summary.totalCount} 项 · 配音影响 {summary.audioCount} 条</p></div>
              <div className="organizer-preview-filters" role="tablist" aria-label="筛选变更类型">{filterOptions.map((item) => <button type="button" className={filter === item.id ? 'is-active' : ''} role="tab" aria-selected={filter === item.id} key={item.id} onClick={() => setFilter(item.id)}>{item.label} <span>{item.count}</span></button>)}</div>
            </header>
            {preview.error ? (
              <div className="organizer-preview-empty is-error" role="alert"><Icon name="warning" size={40} /><strong>无法安全整理</strong><p>{preview.error}</p></div>
            ) : visibleChanges.length ? (
              <div className="organizer-change-list">
                {visibleChanges.map((change) => {
                  const included = !excludedIds.has(change.id)
                  const expanded = expandedIds.has(change.id)
                  const expandable = Math.max(change.before.length, change.after.length) > 240 || change.before.includes('\n') || change.after.includes('\n')
                  return <article className={`organizer-change-card ${included ? 'is-included' : 'is-excluded'}`} key={change.id}>
                    <header>
                      <button type="button" className="organizer-include-toggle" aria-pressed={included} aria-label={`${included ? '排除' : '包含'}${change.title}`} onClick={() => toggleChange(change.id)}><Icon name={included ? 'check' : 'close'} size={14} /></button>
                      <span className={`organizer-field-badge is-${change.kind}`}>{change.label}</span>
                      <strong>{change.title}</strong>
                      <small>{change.reasonLabels.join(' · ')}</small>
                      {change.audioImpact && <em className="organizer-audio-impact"><Icon name="mic" size={12} />配音将失效</em>}
                    </header>
                    <div className={`organizer-diff-grid ${expanded ? 'is-expanded' : ''}`}>
                      <section><span>原文</span><p>{change.before || '（空）'}</p></section>
                      <Icon name="arrow" size={15} />
                      <section><span>整理后</span><p>{change.after || '（空）'}</p></section>
                    </div>
                    {expandable && <button type="button" className="organizer-expand" onClick={() => toggleExpanded(change.id)}>{expanded ? '收起' : '展开全文'}</button>}
                  </article>
                })}
              </div>
            ) : (
              <div className="organizer-preview-empty"><Icon name="script" size={40} /><strong>{preview.changes.length ? '当前筛选没有变更' : '当前范围无需整理'}</strong><p>{preview.changes.length ? '切换上方筛选可查看其他变化。' : '可继续查看左侧剧本体检结果。'}</p></div>
            )}
          </section>
        </div>
        <footer className="script-organizer-footer">
          <p className={`${commitError ? 'is-error' : summary.audioCount ? 'is-warning' : ''}`}><Icon name={commitError || summary.audioCount ? 'warning' : 'check'} size={15} />{impactText}</p>
          <div><button type="button" className="secondary-button" disabled={submitting} onClick={onClose}>取消</button><button type="button" className="script-organizer-apply" disabled={!canCommit} onClick={submit}>{submitting ? '应用中…' : `应用 ${summary.selectedCount} 项整理`}</button></div>
        </footer>
      </section>
    </div>
  )
}

function SceneCharacterPickerDialog({ characters, selectedIds, inferredIds, sceneTitle, onClose, onApply }) {
  const [search, setSearch] = useState('')
  const [draftIds, setDraftIds] = useState(() => new Set(selectedIds))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [composing, setComposing] = useState(false)
  const dialogRef = useRef(null)
  const searchRef = useRef(null)
  const inferredSet = useMemo(() => new Set(inferredIds), [inferredIds])
  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('zh-CN')
    if (!query) return characters
    return characters.filter((character) => `${character.name} ${character.role || ''} ${character.relation || ''}`.toLocaleLowerCase('zh-CN').includes(query))
  }, [characters, search])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const toggleCharacter = (characterId) => {
    setDraftIds((current) => {
      const next = new Set(current)
      if (next.has(characterId)) next.delete(characterId)
      else next.add(characterId)
      return next
    })
    setError('')
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    const result = await Promise.resolve(onApply([...draftIds]))
    if (!result?.ok) {
      setError(result?.error || '主要角色保存失败，请重试。')
      setSubmitting(false)
      return
    }
    onClose()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Enter' && event.ctrlKey && !event.isComposing && !event.nativeEvent?.isComposing && !composing) {
      event.preventDefault()
      submit()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="scene-character-picker-layer" onKeyDown={handleKeyDown} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      <section ref={dialogRef} id="scene-character-picker-dialog" className="scene-character-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="scene-character-picker-title">
        <header className="scene-character-picker-header">
          <div><h2 id="scene-character-picker-title">选择主要角色</h2><p>仅影响当前场景信息 · {sceneTitle}</p></div>
          <button type="button" onClick={onClose} aria-label="关闭主要角色选择"><Icon name="close" size={18} /></button>
        </header>
        <label className="scene-character-search"><Icon name="search" size={16} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索角色名称或定位" aria-label="搜索角色名称或定位" /></label>
        <div className="scene-character-selection-summary"><span>已选择 <b>{draftIds.size}</b> 个角色</span>{inferredIds.length > 0 && <small><Icon name="check" size={12} />本地识别 {inferredIds.length} 个场景角色</small>}</div>
        <div className="scene-character-checklist">
          {filteredCharacters.length ? filteredCharacters.map((character) => {
            const selected = draftIds.has(character.id)
            return <label className={`scene-character-option ${selected ? 'is-selected' : ''}`} key={character.id}>
              <input type="checkbox" checked={selected} onChange={() => toggleCharacter(character.id)} />
              <Avatar person={character} size="small" />
              <span><strong>{character.name}</strong><small>{character.role || '角色'} · {character.relation || character.tone || '待完善'}</small></span>
              {inferredSet.has(character.id) && <em>场景中出现</em>}
              <i aria-hidden="true"><Icon name={selected ? 'check' : 'plus'} size={13} /></i>
            </label>
          }) : <div className="scene-character-picker-empty"><Icon name="users" size={34} /><strong>没有匹配角色</strong><p>可前往角色页创建或完善角色。</p></div>}
        </div>
        <footer className="scene-character-picker-footer">
          <p className={error ? 'is-error' : ''} role={error ? 'alert' : undefined}>{error || '确认前不会修改项目 · Ctrl+Enter 应用'}</p>
          <div><button type="button" className="secondary-button" disabled={submitting} onClick={onClose}>取消</button><button type="button" className="scene-character-apply" disabled={submitting} onClick={submit}>{submitting ? '应用中…' : '应用选择'}</button></div>
        </footer>
      </section>
    </div>
  )
}

function ControlledGenerationDialog({
  id,
  eyebrow,
  title,
  description,
  initialPrompt,
  maximumPromptCharacters = 1500,
  requestFactory,
  onDryRun,
  onGenerate,
  onApply,
  onClose,
  tabs = null,
  activeTab = '',
  onTabChange = null,
  recoveryQuery = null,
  currentImageAssetId = '',
}) {
  const modalRef = useRef(null)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [stage, setStage] = useState('editing')
  const [dryRun, setDryRun] = useState(null)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [recoverableImage, setRecoverableImage] = useState(null)
  const promptLength = Array.from(prompt).length
  const recoveryPurpose = recoveryQuery?.purpose || ''
  const recoveryEntityId = recoveryQuery?.entityId || ''

  useEffect(() => {
    modalRef.current?.querySelector('textarea')?.focus()
  }, [])

  useEffect(() => {
    let active = true
    if (!recoveryPurpose || !recoveryEntityId) return undefined
    providerRegistry.listImages({ purpose: recoveryPurpose, entityId: recoveryEntityId, limit: 3 }).then((result) => {
      if (!active || !result?.ok) return
      const candidate = result.assets?.find((asset) => asset.assetId !== currentImageAssetId)
      setRecoverableImage(candidate || null)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [currentImageAssetId, recoveryEntityId, recoveryPurpose])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || stage === 'generating') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, stage])

  const prepare = async () => {
    setError('')
    try {
      if (promptLength < 4) throw new Error('提示词至少需要 4 个字符')
      if (promptLength > maximumPromptCharacters) throw new Error(`提示词不能超过 ${maximumPromptCharacters} 个字符`)
      const request = requestFactory(prompt)
      const result = await onDryRun(request)
      if (!result?.ok) throw new Error(result?.error || '请求预检失败')
      setDryRun(result)
      setStage('review')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '请求预检失败')
    }
  }

  const generate = async () => {
    setError('')
    setStage('generating')
    try {
      const result = await onGenerate({ ...requestFactory(prompt), confirmed: true })
      if (!result?.ok) throw new Error(result?.error || '生成失败')
      setResponse(result)
      setStage('result')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败')
      setStage('review')
    }
  }

  const applyResult = () => {
    const result = onApply(response)
    if (result?.ok === false) {
      setError(result.error || '采用结果失败')
      return
    }
    onClose()
  }

  const generatedEntity = response?.result
  const generatedImage = response?.image
  return (
    <div className="controlled-generation-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && stage !== 'generating') onClose()
    }}>
      <section ref={modalRef} id={id} className="controlled-generation-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header>
          <span><Icon name="spark" size={22} /></span>
          <div><small>{eyebrow}</small><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
          <button type="button" aria-label={`关闭${title}`} disabled={stage === 'generating'} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        {tabs && <nav className="controlled-generation-tabs" aria-label="生成类型">{tabs.map((tab) => <button type="button" className={tab.id === activeTab ? 'is-active' : ''} key={tab.id} onClick={() => onTabChange?.(tab.id)}>{tab.label}</button>)}</nav>}
        <div className="controlled-generation-progress" aria-label="生成步骤">
          {['编辑提示词', '确认请求', '查看结果', '手动采用'].map((label, index) => {
            const activeIndex = stage === 'editing' ? 0 : stage === 'review' || stage === 'generating' ? 1 : 2
            return <span className={index <= activeIndex ? 'is-active' : ''} key={label}><i>{index + 1}</i>{label}</span>
          })}
        </div>
        {stage !== 'result' ? <div className="controlled-generation-editor">
          {recoverableImage && stage === 'editing' && <div className="managed-image-recovery"><span><Icon name="database" size={17} /><b>发现已下载但未采用的本地结果</b><small>{recoverableImage.fileName} · 恢复不会调用百炼</small></span><button type="button" className="secondary-button" onClick={() => {
            setResponse({ ok: true, image: recoverableImage, recovered: true })
            setStage('result')
            setError('')
          }}>恢复最近结果</button></div>}
          <label>
            <span>生成提示词 <small>{promptLength} / {maximumPromptCharacters}</small></span>
            <textarea value={prompt} maxLength={maximumPromptCharacters} disabled={stage === 'generating'} onChange={(event) => {
              setPrompt(event.target.value)
              setStage('editing')
              setDryRun(null)
              setError('')
            }} />
          </label>
          {dryRun && <section className="controlled-generation-review">
            <div><small>模型</small><strong>{dryRun.model}</strong></div>
            <div><small>请求数量</small><strong>{dryRun.requestCount || 1} 次</strong></div>
            {dryRun.size && <div><small>图片规格</small><strong>{dryRun.size} · {dryRun.n || 1} 张</strong></div>}
            <p><Icon name="shield" size={15} />{dryRun.billingNotice || '真实请求可能产生费用，实际账单以百炼控制台为准。'}</p>
          </section>}
        </div> : <div className="controlled-generation-result">
          {generatedImage
            ? <><img src={generatedImage.mediaUrl || generatedImage.dataUrl} alt={`${title}生成结果`} /><p>{generatedImage.fileName} · {formatAssetBytes(generatedImage.bytes || 0)}</p></>
            : <dl>{Object.entries(generatedEntity || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.map((item) => typeof item === 'object' ? `${item.speaker}：${item.text}` : String(item)).join('；') : String(value || '—')}</dd></div>)}</dl>}
          <div className="controlled-generation-local"><Icon name="check" size={14} />文件化保存 · 采用时不重复写入项目正文。</div>
        </div>}
        {error && <p className="controlled-generation-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary-button" disabled={stage === 'generating'} onClick={onClose}>取消</button>
          {stage === 'editing' && <button type="button" className="primary-button" onClick={prepare}>预检本次请求</button>}
          {stage === 'review' && <button type="button" className="primary-button controlled-generation-confirm" onClick={generate}><Icon name="shield" size={15} />确认单次真实生成</button>}
          {stage === 'generating' && <button type="button" className="primary-button" disabled>正在生成，请稍候…</button>}
          {stage === 'result' && <><button type="button" className="secondary-button" onClick={() => {
            setStage('editing')
            setResponse(null)
          }}>返回修改</button><button type="button" className="primary-button" onClick={applyResult}>采用到当前项目</button></>}
        </footer>
      </section>
    </div>
  )
}

function SceneGenerationDialog({ scene, storySeed, characters, bailianStatus, initialMode = 'setting', onApplySetting, onApplyImage, onClose }) {
  const [mode, setMode] = useState(initialMode)
  const isImage = mode === 'image'
  const runDryCheck = (callback, request) => {
    if (!bailianStatus?.configured) return Promise.resolve({ ok: false, error: '未找到本地百炼 Key，请先前往设置页检查。' })
    if (bailianStatus?.paidGenerationEnabled !== true) return Promise.resolve({ ok: false, error: '真实生成当前已锁定，不会发送请求。' })
    return callback(request)
  }
  return <ControlledGenerationDialog
    key={`${scene.id}:${mode}`}
    id="scene-generation-dialog"
    eyebrow="SCENE AI"
    title={isImage ? '生成场景设定图' : '生成场景设定'}
    description={isImage ? '使用当前场景和已绑定角色参考图，固定生成 1 张。' : '只扩写当前场景资料，生成后由你决定是否采用。'}
    initialPrompt={isImage ? createSceneImagePrompt({ scene, storySeed, characters }) : createSceneSettingPrompt({ scene, storySeed, characters })}
    maximumPromptCharacters={isImage ? 1500 : 3000}
    requestFactory={(prompt) => isImage
      ? createSceneImageGenerationRequest({ scene, characters, prompt })
      : createSceneEntityGenerationRequest({ scene, storySeed, characters, prompt })}
    onDryRun={isImage
      ? (request) => runDryCheck((payload) => providerRegistry.dryRunImage(payload), request)
      : (request) => runDryCheck((payload) => providerRegistry.dryRunEntity(payload), request)}
    onGenerate={isImage ? (request) => providerRegistry.generateImage(request) : (request) => providerRegistry.generateEntity(request)}
    onApply={isImage ? (response) => onApplyImage(response.image) : (response) => onApplySetting(response.result)}
    onClose={onClose}
    tabs={[{ id: 'setting', label: '场景设定' }, { id: 'image', label: '场景图片' }]}
    activeTab={mode}
    onTabChange={setMode}
    recoveryQuery={isImage ? { purpose: 'scene', entityId: String(scene.id) } : null}
    currentImageAssetId={scene.imageAssetId || ''}
  />
}

function ScriptPage({ storySeed, episodes, scenes, setScenes, selectedEpisode, setSelectedEpisode, selectedScene, setSelectedScene, characters, shots, lines, setShots, setLines, setSelectedShot, bailianStatus, onOpenImageSettings, onNavigate, onCommitDialogueSplit, onCommitScriptOrganizer, onCommitSceneCharacters, onApplySceneSetting, onApplySceneImage, onNotice }) {
  const [dialogueSplitOpen, setDialogueSplitOpen] = useState(false)
  const [scriptOrganizerOpen, setScriptOrganizerOpen] = useState(false)
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false)
  const [sceneGenerationMode, setSceneGenerationMode] = useState('')
  const [metadataErrors, setMetadataErrors] = useState({})
  const splitDialogueTriggerRef = useRef(null)
  const organizeScriptTriggerRef = useRef(null)
  const characterPickerTriggerRef = useRef(null)
  const locationInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const weatherInputRef = useRef(null)
  const actionInputRef = useRef(null)
  const narrationInputRef = useRef(null)
  const addDialogueTriggerRef = useRef(null)
  const restoreSplitFocusRef = useRef(false)
  const restoreOrganizerFocusRef = useRef(false)
  const restoreCharacterPickerFocusRef = useRef(false)
  const visibleScenes = scenes.filter((scene) => scene.episodeId === selectedEpisode)
  const current = visibleScenes.find((scene) => scene.id === selectedScene) || visibleScenes[0]
  const visibleDialogue = lines.filter((line) => line.episodeId === selectedEpisode && line.sceneId === current.id)
  const currentShots = shots.filter((shot) => shot.episodeId === selectedEpisode && shot.sceneId === current.id)
  const metadataSummary = useMemo(
    () => summarizeSceneMetadata({ scene: current, lines, shots, characters }),
    [current, lines, shots, characters],
  )
  const displayCharacters = metadataSummary.displayCharacterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter(Boolean)
  const dialogueWordCount = visibleDialogue.reduce((total, line) => total + line.text.length, 0)
  const sceneWordCount = (current.action?.length || 0) + (current.narration?.length || 0) + dialogueWordCount
  useEffect(() => {
    if (dialogueSplitOpen || !restoreSplitFocusRef.current) return undefined
    restoreSplitFocusRef.current = false
    const focusTimer = window.setTimeout(() => splitDialogueTriggerRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [dialogueSplitOpen])
  useEffect(() => {
    if (scriptOrganizerOpen || !restoreOrganizerFocusRef.current) return undefined
    restoreOrganizerFocusRef.current = false
    const focusTimer = window.setTimeout(() => organizeScriptTriggerRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [scriptOrganizerOpen])
  useEffect(() => {
    if (characterPickerOpen || !restoreCharacterPickerFocusRef.current) return undefined
    restoreCharacterPickerFocusRef.current = false
    const focusTimer = window.setTimeout(() => characterPickerTriggerRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [characterPickerOpen])
  useEffect(() => {
    setCharacterPickerOpen(false)
    setSceneGenerationMode('')
    setMetadataErrors({})
    restoreCharacterPickerFocusRef.current = false
  }, [selectedScene])
  const closeDialogueSplit = () => {
    restoreSplitFocusRef.current = true
    setDialogueSplitOpen(false)
  }
  const closeScriptOrganizer = () => {
    restoreOrganizerFocusRef.current = true
    setScriptOrganizerOpen(false)
  }
  const closeCharacterPicker = () => {
    restoreCharacterPickerFocusRef.current = true
    setCharacterPickerOpen(false)
  }
  const updateCurrent = (field, value) => {
    setScenes((items) => items.map((scene) => scene.id === current.id ? { ...scene, [field]: value } : scene))
    if (field === 'title') setLines((items) => items.map((line) => line.sceneId === current.id ? { ...line, scene: value } : line))
  }
  const updateMetadataField = (field, value) => {
    const result = validateSceneMetadataField(field, value)
    if (!result.ok) {
      setMetadataErrors((currentErrors) => ({ ...currentErrors, [field]: result.error }))
      return
    }
    setMetadataErrors((currentErrors) => ({ ...currentErrors, [field]: '' }))
    updateCurrent(field, result.value)
  }
  const addScene = () => {
    const id = Math.max(0, ...scenes.map((scene) => scene.id)) + 1
    setScenes((items) => [...items, { id, episodeId: selectedEpisode, title: `场景 ${id}`, location: '', time: '', weather: '', mainCharacterIds: [], status: '当前编辑', action: '', narration: '' }])
    setSelectedScene(id)
  }
  const changeEpisode = (episodeId) => {
    setSelectedEpisode(episodeId)
    setSelectedScene(scenes.find((scene) => scene.episodeId === episodeId)?.id || 1)
  }
  const moveScene = (direction) => setScenes((items) => {
    const episodeIndexes = items.map((scene, index) => scene.episodeId === selectedEpisode ? index : -1).filter((index) => index >= 0)
    const currentIndex = items.findIndex((scene) => scene.id === current.id)
    const localIndex = episodeIndexes.indexOf(currentIndex)
    const targetIndex = episodeIndexes[localIndex + direction]
    if (localIndex < 0 || targetIndex === undefined) return items
    const next = [...items]
    ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
    return next
  })
  const deleteScene = () => {
    if (visibleScenes.length === 1) {
      onNotice('每个剧集至少需要保留一个场景')
      return
    }
    if (!window.confirm(`删除场景“${current.title}”及其分镜和台词？`)) return
    const currentIndex = visibleScenes.findIndex((scene) => scene.id === current.id)
    const replacement = visibleScenes[currentIndex + 1] || visibleScenes[currentIndex - 1]
    setScenes((items) => items.filter((scene) => scene.id !== current.id))
    setShots((items) => items.filter((shot) => shot.sceneId !== current.id))
    setLines((items) => items.filter((line) => line.sceneId !== current.id))
    setSelectedScene(replacement.id)
    onNotice('场景及其关联分镜和台词已删除')
  }
  const addDialogueLine = () => {
    const speaker = characters[0]
    if (!speaker) {
      onNotice('请先在角色页创建真实角色，再插入台词')
      return
    }
    const id = Math.max(0, ...lines.map((line) => line.id)) + 1
    setLines((items) => [...items, {
      id,
      episodeId: selectedEpisode,
      sceneId: current.id,
      scene: current.title,
      speaker: speaker.name,
      text: '',
      emotion: '默认',
      duration: '0.0s',
      status: '未配音',
      variant: speaker.variant,
      audio: '',
      audioStatus: '未生成',
      audioSource: '',
      audioFileName: '',
      audioError: '',
      audioAttempt: 0,
    }])
    onNotice('已新增台词，并同步到配音页')
  }
  const updateDialogueLine = (id, field, value) => setLines((items) => items.map((line) => {
    if (line.id !== id) return line
    if (field === 'speaker') {
      const speaker = characters.find((person) => person.name === value)
      return { ...line, speaker: value, variant: speaker?.variant || line.variant, status: '未配音', audioStatus: '未生成', audioError: '说话人已变化，请重新生成或替换音频' }
    }
    return { ...line, [field]: value, ...(field === 'text' ? { status: '未配音', audioStatus: '未生成', audioError: '台词内容已变化，请重新生成或替换音频' } : {}) }
  }))
  const deleteDialogueLine = (line) => {
    if (!window.confirm(`删除“${line.speaker}”的这句台词？`)) return
    setLines((items) => items.filter((item) => item.id !== line.id))
    onNotice('台词已从剧本和配音页同步删除')
  }
  const convertToStoryboard = () => {
    const sceneShots = shots.filter((shot) => shot.episodeId === selectedEpisode && shot.sceneId === current.id)
    if (sceneShots.length && !window.confirm(`当前场景已有 ${sceneShots.length} 个分镜，重新生成草稿会替换它们。是否继续？`)) return
    const retainedShots = shots.filter((shot) => !(shot.episodeId === selectedEpisode && shot.sceneId === current.id))
    const startId = Math.max(0, ...retainedShots.map((shot) => shot.id)) + 1
    const drafts = createStoryboardDrafts({
      scene: current,
      lines: visibleDialogue,
      characters,
      episodeId: selectedEpisode,
      startId,
    }).map((shot) => ({
      ...shot,
      visualPrompt: createShotVisualPrompt({ shot, scene: current, characters }),
    }))
    setShots([...retainedShots, ...drafts])
    setSelectedShot(drafts[0].id)
    onNotice(`已生成 ${drafts.length} 个本地分镜草稿`)
    onNavigate('storyboard')
  }
  const applyMainCharacters = (mainCharacterIds) => onCommitSceneCharacters({
    sceneId: current.id,
    mainCharacterIds,
  })
  const viewCurrentStoryboard = () => {
    if (!currentShots.length) {
      convertToStoryboard()
      return
    }
    setSelectedShot(currentShots[0].id)
    onNavigate('storyboard')
  }
  const focusMissingEnvironment = () => {
    if (!String(current.location || '').trim() || /^(待设置|待设定|未设置)/u.test(String(current.location))) locationInputRef.current?.focus()
    else if (!String(current.time || '').trim() || /^(待设置|待设定|未设置)/u.test(String(current.time))) timeInputRef.current?.focus()
    else weatherInputRef.current?.focus()
  }
  const handleReadinessAction = (target) => {
    if (target === 'environment') focusMissingEnvironment()
    else if (target === 'action') actionInputRef.current?.focus()
    else if (target === 'narrative') {
      if (!String(current.narration || '').trim()) narrationInputRef.current?.focus()
      else addDialogueTriggerRef.current?.focus()
    } else if (target === 'characters') setCharacterPickerOpen(true)
    else if (target === 'shots') convertToStoryboard()
  }
  const durationSourceLabel = metadataSummary.duration.source === 'shots'
    ? `按 ${metadataSummary.duration.shotCount} 个分镜`
    : metadataSummary.duration.source === 'script'
      ? '按剧本估算'
      : '内容不足'
  const durationDescription = metadataSummary.duration.source === 'shots'
    ? '分镜变更后自动更新'
    : metadataSummary.duration.source === 'script'
      ? '生成分镜后将采用镜头合计'
      : '补充动作、旁白或台词后估算'
  return (
    <main className="page project-page editor-page script-page">
      <aside className="glass context-panel scene-list">
        <div className="panel-toolbar"><label className="compact-select compact-select--wide"><select value={selectedEpisode} onChange={(event) => changeEpisode(Number(event.target.value))}>{episodes.map((episode, index) => <option key={episode.id} value={episode.id}>第 {index + 1} 集 · {episode.title}</option>)}</select><Icon name="chevron" size={14} /></label></div>
        <button className="primary-button" onClick={addScene}><Icon name="plus" size={17} />新增场景</button>
        <div className="context-list">{visibleScenes.map((scene, index) => <button key={scene.id} className={selectedScene === scene.id ? 'is-active' : ''} onClick={() => setSelectedScene(scene.id)}><strong>场景 {String(index + 1).padStart(2, '0')}　{scene.title}</strong><small><span className={`dot dot--${scene.status === '已完成' ? 'ready' : scene.status === '当前编辑' ? 'active' : 'muted'}`} />{scene.status}</small></button>)}</div>
        <p className="panel-foot">共 {visibleScenes.length} 个场景</p>
      </aside>
      <section className="glass reading-panel script-editor">
        <div className="editor-heading"><h1>场景 {String(current.id).padStart(2, '0')}　<input value={current.title} onChange={(event) => updateCurrent('title', event.target.value)} /></h1><div><button className="secondary-button scene-ai-setting-button" aria-haspopup="dialog" aria-controls="scene-generation-dialog" onClick={() => setSceneGenerationMode('setting')}><Icon name="spark" size={16} />AI 完善场景</button><button ref={splitDialogueTriggerRef} className="secondary-button dialogue-split-trigger" aria-haspopup="dialog" aria-controls="dialogue-split-modal" onClick={() => setDialogueSplitOpen(true)}><Icon name="spark" size={16} />拆分台词</button><button ref={organizeScriptTriggerRef} className="secondary-button script-organizer-trigger" aria-haspopup="dialog" aria-controls="script-organizer-modal" onClick={() => setScriptOrganizerOpen(true)}><Icon name="settings" size={16} />整理剧本</button><button className="primary-button storyboard-draft-button" onClick={convertToStoryboard}><Icon name="image" size={16} />生成分镜草稿</button></div></div>
        <div className="scene-meta"><strong>场景信息（概要）</strong><span>地点：{current.location || '待设置'}</span><span>时间：{current.time || '待设置'}</span><span>天气：{current.weather || '待设置'}</span><span className="scene-meta-duration"><Icon name="clock" size={12} />预计：{metadataSummary.duration.label}</span></div>
        <label className="script-block"><strong>动作描述 <small>自动保存</small></strong><textarea ref={actionInputRef} className="scene-action-input" value={current.action || ''} onChange={(event) => updateCurrent('action', event.target.value)} placeholder="描述人物动作、环境变化和镜头可见事件" /></label>
        <label className="script-block"><strong>旁白 <small>自动保存</small></strong><textarea ref={narrationInputRef} className="scene-narration-input" value={current.narration || ''} onChange={(event) => updateCurrent('narration', event.target.value)} placeholder="输入场景旁白或内心独白" /></label>
        <div className="dialogue-editor"><strong>角色台词 <small>与配音页实时同步</small></strong>{visibleDialogue.length ? visibleDialogue.map((line) => <div className="dialogue-edit-row" key={line.id}><Avatar person={{ name: line.speaker, variant: line.variant }} size="small" /><select className="dialogue-speaker-select" value={line.speaker} onChange={(event) => updateDialogueLine(line.id, 'speaker', event.target.value)}>{characters.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select><input value={line.text} onChange={(event) => updateDialogueLine(line.id, 'text', event.target.value)} /><button className="inline-icon" title="已同步到配音" onClick={() => onNotice('这句台词已和配音页使用同一份数据')}><Icon name="mic" size={15} /></button><button className="inline-icon delete-dialogue-line" title="删除台词" onClick={() => deleteDialogueLine(line)}><Icon name="trash" size={15} /></button></div>) : <div className="script-dialogue-empty">当前场景还没有角色台词，插入后会自动出现在配音页。</div>}<button ref={addDialogueTriggerRef} className="dashed-button script-dialogue-add-button" onClick={addDialogueLine}><Icon name="plus" size={17} />插入台词</button></div>
        <footer className="editor-footer"><span>场景总字数：{sceneWordCount} 字</span><span>台词：{visibleDialogue.length} 条 · {dialogueWordCount} 字</span></footer>
      </section>
      <aside className="glass inspector scene-inspector">
        <h2><Icon name="script" size={20} />场景信息</h2>
        <div className="scene-environment-fields">
          <label className={metadataErrors.location ? 'has-error' : ''}><span>地点</span><input ref={locationInputRef} data-scene-field="location" value={current.location || ''} placeholder="待设置地点" title={`最多 ${maximumSceneLocationCharacters} 个字符`} aria-invalid={Boolean(metadataErrors.location)} onChange={(event) => updateMetadataField('location', event.target.value)} />{metadataErrors.location && <small role="alert">{metadataErrors.location}</small>}</label>
          <label className={metadataErrors.time ? 'has-error' : ''}><span>时间</span><input ref={timeInputRef} data-scene-field="time" value={current.time || ''} placeholder="待设置时间" title={`最多 ${maximumSceneTimeCharacters} 个字符`} aria-invalid={Boolean(metadataErrors.time)} onChange={(event) => updateMetadataField('time', event.target.value)} />{metadataErrors.time && <small role="alert">{metadataErrors.time}</small>}</label>
          <label className={metadataErrors.weather ? 'has-error' : ''}><span>天气</span><input ref={weatherInputRef} data-scene-field="weather" list="scene-weather-suggestions" value={current.weather || ''} placeholder="待设置天气" title={`最多 ${maximumSceneWeatherCharacters} 个字符`} aria-invalid={Boolean(metadataErrors.weather)} onChange={(event) => updateMetadataField('weather', event.target.value)} />{metadataErrors.weather && <small role="alert">{metadataErrors.weather}</small>}</label>
          <datalist id="scene-weather-suggestions">{sceneWeatherSuggestions.map((suggestion) => <option value={suggestion} key={suggestion} />)}</datalist>
        </div>
        <section className="scene-duration-card" data-duration-source={metadataSummary.duration.source} aria-label={`预计时长 ${metadataSummary.duration.label}，${durationSourceLabel}`}>
          <Icon name="clock" size={17} />
          <div><span>预计时长 <em>{durationSourceLabel}</em></span><strong>{metadataSummary.duration.label}</strong><small>{durationDescription}</small></div>
        </section>
        <section className="scene-ai-image-card">
          <header><span>场景设定图</span><small>{current.image ? '已保存' : '未生成'}</small></header>
          {current.image ? <img src={current.image} alt={`${current.title}场景设定图`} /> : <div><Icon name="image" size={24} /><span>可用提示词生成一张场景设定图</span></div>}
          <button type="button" className="secondary-button" aria-haspopup="dialog" aria-controls="scene-generation-dialog" onClick={() => setSceneGenerationMode('image')}><Icon name="spark" size={14} />{current.image ? '重新生成单张' : 'API 生成单张'}</button>
          {!bailianStatus?.configured && <button type="button" className="scene-ai-settings-link" onClick={onOpenImageSettings}>检查图片设置</button>}
        </section>
        <section className="scene-main-characters">
          <header><span>主要角色</span><button ref={characterPickerTriggerRef} type="button" aria-haspopup="dialog" aria-controls="scene-character-picker-dialog" onClick={() => setCharacterPickerOpen(true)}>编辑</button></header>
          <button type="button" className={`scene-character-stack ${metadataSummary.selectedCharacterIds.length ? 'is-explicit' : displayCharacters.length ? 'is-inferred' : 'is-empty'}`} aria-label={`选择主要角色，当前${metadataSummary.selectedCharacterIds.length ? `已设置 ${metadataSummary.selectedCharacterIds.length} 个` : displayCharacters.length ? `本地识别 ${displayCharacters.length} 个` : '未设置'}`} onClick={() => setCharacterPickerOpen(true)}>
            <span>{displayCharacters.length ? displayCharacters.slice(0, 4).map((person) => <Avatar person={person} key={person.id} size="small" />) : <i><Icon name="plus" size={15} /></i>}{displayCharacters.length > 4 && <b>+{displayCharacters.length - 4}</b>}</span>
            <small>{metadataSummary.selectedCharacterIds.length ? `已设置 ${metadataSummary.selectedCharacterIds.length} 个角色` : displayCharacters.length ? `本地识别 ${displayCharacters.length} 个，点击确认` : '选择主要角色'}</small>
            <Icon name="chevron" size={14} />
          </button>
        </section>
        <section className={`scene-readiness is-score-${metadataSummary.readiness.score}`}>
          <header><span>分镜就绪度 <small>{metadataSummary.readiness.status}</small></span><b>{metadataSummary.readiness.score}%</b></header>
          <i className="scene-readiness-bar"><b style={{ width: `${metadataSummary.readiness.score}%` }} /></i>
          <ul>{metadataSummary.readiness.checks.map((check) => <li className={check.complete ? 'is-complete' : 'is-missing'} key={check.key}><button type="button" disabled={check.complete} onClick={() => handleReadinessAction(check.target)}><i><Icon name={check.complete ? 'check' : 'warning'} size={11} /></i><span>{check.label}</span>{!check.complete && <Icon name="arrow" size={11} />}</button></li>)}</ul>
        </section>
        <div className="data-actions"><button className="secondary-button" title={visibleScenes.indexOf(current) === 0 ? '已经是当前剧集第一个场景' : '上移当前场景'} disabled={visibleScenes.indexOf(current) === 0} onClick={() => moveScene(-1)}>上移</button><button className="secondary-button" title={visibleScenes.indexOf(current) === visibleScenes.length - 1 ? '已经是当前剧集最后一个场景' : '下移当前场景'} disabled={visibleScenes.indexOf(current) === visibleScenes.length - 1} onClick={() => moveScene(1)}>下移</button><button className="secondary-button delete-action" onClick={deleteScene}><Icon name="trash" size={15} />删除</button></div>
        <p className="scene-autosave-status"><Icon name="check" size={13} />自动保存已开启</p>
        <button className="primary-button scene-storyboard-action" onClick={viewCurrentStoryboard}><Icon name="image" size={16} />{currentShots.length ? `查看 ${currentShots.length} 个分镜` : '生成分镜草稿'}</button>
      </aside>
      {dialogueSplitOpen && <DialogueSplitModal characters={characters} existingLines={visibleDialogue} episodeId={selectedEpisode} scene={current} onClose={closeDialogueSplit} onCommit={onCommitDialogueSplit} />}
      {scriptOrganizerOpen && <ScriptOrganizerModal scene={current} lines={lines} shots={shots} episodeId={selectedEpisode} onClose={closeScriptOrganizer} onCommit={onCommitScriptOrganizer} />}
      {characterPickerOpen && <SceneCharacterPickerDialog characters={characters} selectedIds={metadataSummary.selectedCharacterIds} inferredIds={metadataSummary.inferredCharacterIds} sceneTitle={current.title} onClose={closeCharacterPicker} onApply={applyMainCharacters} />}
      {sceneGenerationMode && <SceneGenerationDialog scene={current} storySeed={storySeed} characters={characters} bailianStatus={bailianStatus} initialMode={sceneGenerationMode} onApplySetting={(result) => onApplySceneSetting({ sceneId: current.id, result })} onApplyImage={(image) => onApplySceneImage({ sceneId: current.id, image })} onClose={() => setSceneGenerationMode('')} />}
    </main>
  )
}

function CharacterImageApiDialog({ person, providerConfig, bailianStatus, onClose, onOpenSettings, onApply }) {
  const modalRef = useRef(null)
  const closeRef = useRef(null)
  const [prompt, setPrompt] = useState(() => createCharacterImagePrompt(person))
  const [size, setSize] = useState(characterImageSizeOptions[0].value)
  const [stage, setStage] = useState('editing')
  const [dryRun, setDryRun] = useState(null)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [recoverableImage, setRecoverableImage] = useState(null)
  const preview = useMemo(() => createCharacterImageRequestPreview({
    character: person,
    prompt,
    size,
    providerConfig,
    bailianStatus,
  }), [bailianStatus, person, prompt, providerConfig, size])

  useEffect(() => {
    let active = true
    providerRegistry.listImages({ purpose: 'character', entityId: String(person.id), limit: 3 }).then((result) => {
      if (!active || !result?.ok) return
      setRecoverableImage(result.assets?.find((asset) => asset.assetId !== person.imageAssetId) || null)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [person.id, person.imageAssetId])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (stage === 'generating') return
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, stage])

  const keyStatus = bailianStatus.loading
    ? '正在读取本地状态'
    : preview.configured
      ? '本地 Key 已接入'
      : '未找到本地 Key'
  const generationStatus = preview.executorAvailable
    ? stage === 'result' ? '单张图片已生成' : '单张真实生成可用'
    : preview.paidGenerationEnabled ? '请先检查本地 Key' : '真实生成已锁定'
  const promptLength = Array.from(prompt).length
  const prepareGeneration = async () => {
    setError('')
    if (!preview.ok) {
      setError(preview.errors[0] || '请检查图片请求')
      return
    }
    if (!preview.executorAvailable) {
      setError(preview.configured ? '真实生成当前已锁定，不会发送请求。' : '未找到本地百炼 Key，请先前往设置页检查。')
      return
    }
    const result = await providerRegistry.dryRunImage(createCharacterImageGenerationRequest({ character: person, prompt, size }))
    if (!result?.ok) {
      setError(result?.error || '图片请求预检失败')
      return
    }
    setDryRun(result)
    setStage('review')
  }
  const confirmGeneration = async () => {
    setError('')
    setStage('generating')
    const result = await providerRegistry.generateImage({
      ...createCharacterImageGenerationRequest({ character: person, prompt, size }),
      confirmed: true,
    })
    if (!result?.ok) {
      setError(result?.error || '角色图片生成失败')
      setStage('review')
      return
    }
    setResponse(result)
    setStage('result')
  }
  const applyGeneration = () => {
    const result = onApply(response.image)
    if (result?.ok === false) {
      setError(result.error || '采用角色图片失败')
      return
    }
    onClose()
  }

  return (
    <div className="character-image-api-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && stage !== 'generating') onClose()
    }}>
      <section ref={modalRef} id="character-image-api-dialog" className="character-image-api-dialog" role="dialog" aria-modal="true" aria-labelledby="character-image-api-title" aria-describedby="character-image-api-description">
        <header className="character-image-api-header">
          <span><Icon name="spark" size={23} /></span>
          <div><small>CHARACTER IMAGE API</small><h2 id="character-image-api-title">API 生成角色图</h2><p id="character-image-api-description">使用当前角色的真实字段准备图片请求，不补写虚构设定。</p></div>
          <button ref={closeRef} type="button" className="character-image-api-close" aria-label="关闭角色图片 API 配置" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="character-image-api-status-grid" aria-label="图片服务状态">
          <article><small>图片服务</small><strong>{preview.provider}</strong><span>{preview.endpoint || '服务地址由设置页管理'}</span></article>
          <article><small>模型</small><strong>{preview.model}</strong><span>当前图片能力配置</span></article>
          <article data-tone={preview.configured ? 'ready' : 'warning'}><small>Key 状态</small><strong>{keyStatus}</strong><span>Key 不会显示或写入项目</span></article>
          <article data-tone={preview.executorAvailable ? 'ready' : 'locked'}><small>调用状态</small><strong>{generationStatus}</strong><span>{dryRun ? `本次请求 ${dryRun.requestCount || 1} 次 · 固定 ${dryRun.n || 1} 张` : '预检前不会发送请求'}</span></article>
        </div>

        <div className="character-image-api-body">
          <section className="character-image-api-reference">
            <header><div><small>REFERENCE</small><h3>角色参考图</h3></div><span>{preview.referenceCount ? '已载入 1 张' : '未载入'}</span></header>
            {preview.referenceCount
              ? <img src={person.image} alt={`${person.name || '当前角色'}的本地参考图`} />
              : <div className="character-image-api-reference-empty"><Icon name="image" size={28} /><strong>没有本地参考图</strong><span>可先关闭弹窗，通过左侧“导入参考图”载入真实图片。</span></div>}
          </section>

          <section className="character-image-api-request">
            <label className={promptLength > maximumCharacterImagePromptCharacters ? 'is-invalid' : ''}>
              <span>图片提示词 <small>{promptLength} / {maximumCharacterImagePromptCharacters}</small></span>
              <textarea value={prompt} maxLength={maximumCharacterImagePromptCharacters} onChange={(event) => {
                setPrompt(event.target.value)
                setStage('editing')
                setDryRun(null)
                setError('')
              }} aria-label="角色图片提示词" spellCheck="false" />
            </label>
            <div className="character-image-api-options">
              <label><span>图片尺寸</span><select value={size} onChange={(event) => {
                setSize(event.target.value)
                setStage('editing')
                setDryRun(null)
              }}>{characterImageSizeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <article><span>生成数量</span><strong>1 张</strong><small>固定单张，避免误耗额度</small></article>
              <article><span>水印</span><strong>关闭</strong><small>请求预览值</small></article>
            </div>
          </section>
        </div>

        {recoverableImage && stage === 'editing' && <div className="managed-image-recovery"><span><Icon name="database" size={17} /><b>发现已下载但未采用的本地结果</b><small>{recoverableImage.fileName} · 恢复不会调用百炼</small></span><button type="button" className="secondary-button" onClick={() => {
          setResponse({ ok: true, image: recoverableImage, recovered: true })
          setStage('result')
        }}>恢复最近结果</button></div>}
        {response?.image && <div className="character-image-api-generated"><img src={response.image.mediaUrl || response.image.dataUrl} alt={`${person.name}的生成角色图`} /><span><strong>单张结果已下载到本地</strong><small>{response.image.fileName} · 文件化保存，不重复写入项目正文</small></span></div>}
        <div className="character-image-api-lock-notice"><Icon name="shield" size={19} /><span><strong>{dryRun?.billingNotice || generationStatus}</strong><small>{stage === 'review' ? '点击确认后只发送这 1 次请求；不会自动重试或批量生成。' : preview.executorAvailable ? '先预检，再由你明确确认单次真实请求。' : '当前锁定不会向百炼发送图片生成请求。'}</small></span></div>
        {error && <p className="controlled-generation-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-button" disabled={stage === 'generating'} onClick={onClose}>取消</button><button type="button" className="secondary-button character-image-api-settings" disabled={stage === 'generating'} onClick={onOpenSettings}>前往图片设置</button>{stage === 'editing' && <button type="button" className="primary-button character-image-api-submit" disabled={!preview.ok || !preview.executorAvailable} onClick={prepareGeneration}><Icon name="shield" size={15} />预检单张请求</button>}{stage === 'review' && <button type="button" className="primary-button character-image-api-submit" onClick={confirmGeneration}>确认单次真实生成</button>}{stage === 'generating' && <button type="button" className="primary-button character-image-api-submit" disabled>正在生成，请稍候…</button>}{stage === 'result' && <button type="button" className="primary-button character-image-api-submit" onClick={applyGeneration}>采用到当前角色</button>}</footer>
      </section>
    </div>
  )
}

function CharacterVoicePickerDialog({ person, onApply, onClose }) {
  const suggested = assignCharacterVoice(person)
  const [selectedVoiceId, setSelectedVoiceId] = useState(person.voiceId || suggested.voiceId)
  const selectedVoice = getCharacterVoice(selectedVoiceId) || getCharacterVoice(suggested.voiceId)
  return <div className="character-voice-picker-layer" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="character-voice-picker" role="dialog" aria-modal="true" aria-labelledby="character-voice-picker-title">
      <header><span><Icon name="mic" size={22} /></span><div><small>OFFICIAL VOICE CATALOG</small><h2 id="character-voice-picker-title">为 {person.name} 选择音色</h2><p>根据性别、年龄与性格自动推荐，也可以手动更换。</p></div><button type="button" aria-label="关闭音色选择" onClick={onClose}><Icon name="close" size={18} /></button></header>
      <div className="character-voice-picker-summary"><span>自动推荐</span><strong>{suggested.voiceName}</strong><small>{suggested.voiceReason}</small></div>
      <div className="character-voice-catalog">
        {characterVoiceCatalog.map((voice) => <button type="button" key={voice.id} className={voice.id === selectedVoiceId ? 'is-active' : ''} onClick={() => setSelectedVoiceId(voice.id)}>
          <i><Icon name="mic" size={15} /></i><span><strong>{voice.name}</strong><small>{voice.gender} · {voice.age} 岁 · {voice.trait}</small></span>{voice.id === suggested.voiceId && <em>推荐</em>}
        </button>)}
      </div>
      <footer><span><strong>{selectedVoice?.name}</strong><small>{selectedVoice?.trait} · 官方基础音色</small></span><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={() => onApply(selectedVoice)}>采用此音色</button></footer>
    </section>
  </div>
}

function CharacterPage({ storySeed, characters, setCharacters, selectedCharacter, setSelectedCharacter, selectedSpeaker, setSelectedSpeaker, setScenes, setLines, imageProviderConfig, bailianStatus, onOpenImageSettings, onApplyCharacterProfile, onApplyCharacterImage, onNavigate, onNotice }) {
  const [imageApiDialogOpen, setImageApiDialogOpen] = useState(false)
  const [profileGenerationOpen, setProfileGenerationOpen] = useState(false)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const imageApiButtonRef = useRef(null)
  const restoreImageApiFocusRef = useRef(false)
  const person = characters.find((item) => item.id === selectedCharacter) || characters[0]
  const closeImageApiDialog = () => {
    restoreImageApiFocusRef.current = true
    setImageApiDialogOpen(false)
  }
  useEffect(() => {
    if (imageApiDialogOpen || !restoreImageApiFocusRef.current) return
    restoreImageApiFocusRef.current = false
    imageApiButtonRef.current?.focus()
  }, [imageApiDialogOpen])
  const addCharacter = () => {
    const id = Math.max(0, ...characters.map((item) => item.id)) + 1
    const character = { id, name: '未命名角色', role: '', variant: (id % 6) + 1, tone: '', relation: '', gender: '', age: '', personality: '' }
    setCharacters((items) => [...items, character])
    setSelectedCharacter(id)
    setSelectedSpeaker('未命名角色')
    onNotice('已创建空白角色卡，请填写真实角色信息')
  }
  if (!person) {
    return (
      <main className="page project-page character-page character-page--empty">
        <aside className="glass context-panel character-index"><button className="primary-button" onClick={addCharacter}><Icon name="plus" size={17} />新建角色</button></aside>
        <section className="glass character-empty-state"><Icon name="users" size={34} /><h1>还没有角色</h1><p>新建空白角色卡后，填写的姓名、定位、声音气质与关系会作为真实项目数据保存。</p><button className="primary-button" onClick={addCharacter}><Icon name="plus" size={17} />创建第一个角色</button></section>
      </main>
    )
  }
  const personIndex = characters.indexOf(person)
  const updatePerson = (field, value) => {
    if (field === 'name') {
      setLines((items) => items.map((line) => line.speaker === person.name ? { ...line, speaker: value } : line))
    }
    setCharacters((items) => items.map((item) => item.id === person.id ? { ...item, [field]: value } : item))
    if (field === 'name' && selectedSpeaker === person.name) setSelectedSpeaker(value)
  }
  const moveCharacter = (direction) => setCharacters((items) => {
    const index = items.findIndex((item) => item.id === person.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return items
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const deleteCharacter = () => {
    if (characters.length === 1) {
      onNotice('项目至少需要保留一个角色')
      return
    }
    if (!window.confirm(`删除角色“${person.name}”？历史台词将保留原姓名。`)) return
    const replacement = characters[personIndex + 1] || characters[personIndex - 1]
    setCharacters((items) => items.filter((item) => item.id !== person.id))
    setScenes((items) => items.map((scene) => ({
      ...scene,
      mainCharacterIds: Array.isArray(scene.mainCharacterIds)
        ? scene.mainCharacterIds.filter((characterId) => characterId !== person.id)
        : [],
    })))
    setSelectedCharacter(replacement.id)
    if (selectedSpeaker === person.name) setSelectedSpeaker(replacement.name)
    onNotice('角色已删除')
  }
  const uploadReference = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      onNotice('参考图需小于 2 MB，避免项目文件过大')
      return
    }
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return
      setCharacters((items) => items.map((item) => item.id === person.id ? {
        ...item,
        image: reader.result,
        imageFileName: file.name,
        imageSource: 'local',
        imageError: '',
        imageUpdatedAt: new Date().toISOString(),
      } : item))
      onNotice(`已载入并保存参考图：${file.name}`)
    }, { once: true })
    reader.readAsDataURL(file)
  }
  const openVoiceStudio = () => {
    setSelectedSpeaker(person.name)
    onNavigate('voice')
  }
  const voiceAssignment = assignCharacterVoice(person)
  const applyVoice = (voice) => {
    if (!voice) return
    setCharacters((items) => items.map((item) => item.id === person.id ? {
      ...item,
      voiceId: voice.id,
      voiceName: voice.name,
      voiceModel: 'qwen3-tts-flash',
      voiceMode: 'manual',
      voiceReason: '用户在角色页手动选择',
    } : item))
    setLines((items) => items.map((line) => {
      if (line.speaker !== person.name || line.audioSource === 'local') return line
      return {
        ...line,
        audio: '',
        audioAssetId: '',
        audioStatus: '未生成',
        audioSource: '',
        audioFileName: '',
        audioError: '角色音色已更换，将在下一次一键制作时重新生成',
        status: '未配音',
      }
    }))
    setVoicePickerOpen(false)
    onNotice(`已为 ${person.name} 采用官方音色：${voice.name}`)
  }
  return (
    <>
    <main className="page project-page character-page">
      <aside className="glass context-panel character-index"><button className="primary-button" onClick={addCharacter}><Icon name="plus" size={17} />新建角色</button><div className="character-image-actions"><button type="button" className="secondary-button character-profile-ai-button" aria-haspopup="dialog" aria-controls="character-profile-generation-dialog" onClick={() => setProfileGenerationOpen(true)}><Icon name="spark" size={17} /><span>AI 完善角色设定</span></button><button ref={imageApiButtonRef} type="button" className="character-api-image-button" aria-haspopup="dialog" aria-controls="character-image-api-dialog" onClick={() => setImageApiDialogOpen(true)}><Icon name="spark" size={17} /><span>API 生成角色图</span><small>{bailianStatus?.paidGenerationEnabled ? '单张' : '已锁定'}</small></button><label className="secondary-button upload-reference"><Icon name="upload" size={17} />导入参考图<input type="file" accept="image/*" onChange={uploadReference} /></label></div><div className="character-list">{characters.map((item) => <button key={item.id} className={item.id === person.id ? 'is-active' : ''} onClick={() => setSelectedCharacter(item.id)}><Avatar person={item} /><span><strong>{item.name}</strong><small>{item.role}</small></span></button>)}</div></aside>
      <section className="glass character-canvas"><header><h1><input className="character-name-input" value={person.name} onChange={(event) => updatePerson('name', event.target.value)} /><StatusPill>{person.role || '待填写'}</StatusPill></h1><span>主视觉</span></header><div className="character-visual-grid"><div className="character-key"><Art variant={person.variant} image={person.image} portrait label={`${person.name}主视觉`} /></div><div className="reference-sheet"><h3>外观参考</h3><div className="face-views">{['正面', '侧面', '细节'].map((label, index) => <article key={label}><Art variant={person.variant + index} portrait label={`${person.name}${label}`} /><span>{label}</span></article>)}</div><h3>全身参考</h3><div className="body-views">{['正面', '侧面', '背面'].map((label, index) => <article key={label}><Art variant={person.variant + index + 1} portrait label={`${person.name}${label}`} /><span>{label}</span></article>)}</div><h3>细节参考</h3><div className="detail-views">{[1, 2, 3].map((id) => <Art key={id} variant={person.variant + id} portrait label="服装细节" />)}</div></div></div><div className="character-profile"><label><span>角色定位</span><input value={person.role || ''} placeholder="填写角色定位" onChange={(event) => updatePerson('role', event.target.value)} /></label><label><span>性别</span><select value={person.gender || ''} onChange={(event) => updatePerson('gender', event.target.value)}><option value="">自动判断</option><option value="女">女</option><option value="男">男</option></select></label><label><span>年龄</span><input type="number" min="3" max="100" value={person.age || ''} placeholder="例如 24" onChange={(event) => updatePerson('age', event.target.value ? Number(event.target.value) : '')} /></label><label><span>性格</span><input value={person.personality || ''} placeholder="例如温柔、冷静、活泼" onChange={(event) => updatePerson('personality', event.target.value)} /></label><label><span>声音气质</span><input value={person.tone || ''} placeholder="填写声音气质" onChange={(event) => updatePerson('tone', event.target.value)} /></label><label><span>人物关系</span><input value={person.relation || ''} placeholder="填写人物关系" onChange={(event) => updatePerson('relation', event.target.value)} /></label><label><span>外观设定</span><textarea value={person.appearance || ''} placeholder="发型、脸型、体态、标志物" onChange={(event) => updatePerson('appearance', event.target.value)} /></label><label><span>固定服装</span><textarea value={person.costume || ''} placeholder="主服装、材质与配色" onChange={(event) => updatePerson('costume', event.target.value)} /></label><label><span>外观编号</span><input type="number" min="1" max="8" value={person.variant} onChange={(event) => updatePerson('variant', Number(event.target.value) || 1)} /></label><p>角色名称和关键属性会实时进入项目自动保存队列。</p></div></section>
      <aside className="glass inspector character-inspector"><section><h2>外观锚点 <Icon name="lock" size={17} /></h2><div className="anchor-grid">{['发型', '面部', '服饰', '标志物'].map((label, index) => <article key={label}><Art variant={person.variant + index} portrait label={label} /><span>{label}</span><i><Icon name="lock" size={12} /></i></article>)}</div></section><section><h2>表情</h2><div className="expression-row">{['平静', '凝视', '冷峻', '愤怒', '沉思'].map((label, index) => <article key={label}><Art variant={person.variant + index} portrait label={label} /><span>{label}</span></article>)}</div></section><section><h2>造型参考位</h2><div className="costume-row">{['默认造型', '造型 2', '造型 3'].map((label, index) => <article key={label} className={index === 0 ? 'is-active' : ''}><Art variant={person.variant + index} portrait label={label} /><span>{label}</span></article>)}</div></section><div className="character-lower"><section className="character-voice-entry"><h2>角色音色</h2><p><strong>{person.voiceName || voiceAssignment.voiceName}</strong><small>{person.voiceMode === 'manual' ? '手动选择' : `自动推荐 · ${voiceAssignment.voiceReason}`}</small></p><button type="button" onClick={openVoiceStudio}><Icon name="mic" size={15} />查看台词配音</button><button type="button" className="character-change-voice-button" onClick={() => setVoicePickerOpen(true)}><Icon name="settings" size={15} />更换音色</button></section><section><h2>人物关系</h2><div className="relation-map"><Avatar person={person} /><span>{person.name}</span><small>{person.relation || '未填写'}</small></div></section></div><div className="data-actions"><button className="secondary-button" disabled={personIndex === 0} onClick={() => moveCharacter(-1)}>上移</button><button className="secondary-button" disabled={personIndex === characters.length - 1} onClick={() => moveCharacter(1)}>下移</button><button className="secondary-button delete-action" onClick={deleteCharacter}><Icon name="trash" size={15} />删除</button></div><button className="primary-button" onClick={() => onNotice(`${person.name}的角色设定已写入自动保存队列`)}>保存设定</button></aside>
    </main>
    {profileGenerationOpen && <ControlledGenerationDialog id="character-profile-generation-dialog" eyebrow="CHARACTER AI" title="AI 完善角色设定" description="使用当前角色字段和故事梗概生成候选设定，采用前不会修改项目。" initialPrompt={createCharacterSettingPrompt(person, storySeed)} maximumPromptCharacters={3000} requestFactory={(prompt) => createCharacterEntityGenerationRequest({ character: person, storySeed, prompt })} onDryRun={(request) => {
      if (!bailianStatus?.configured) return Promise.resolve({ ok: false, error: '未找到本地百炼 Key，请先前往设置页检查。' })
      if (bailianStatus?.paidGenerationEnabled !== true) return Promise.resolve({ ok: false, error: '真实生成当前已锁定，不会发送请求。' })
      return providerRegistry.dryRunEntity(request)
    }} onGenerate={(request) => providerRegistry.generateEntity(request)} onApply={(response) => onApplyCharacterProfile({ characterId: person.id, result: response.result })} onClose={() => setProfileGenerationOpen(false)} />}
    {imageApiDialogOpen && <CharacterImageApiDialog person={person} providerConfig={imageProviderConfig} bailianStatus={bailianStatus} onClose={closeImageApiDialog} onOpenSettings={onOpenImageSettings} onApply={(image) => onApplyCharacterImage({ characterId: person.id, image })} />}
    {voicePickerOpen && <CharacterVoicePickerDialog person={person} onApply={applyVoice} onClose={() => setVoicePickerOpen(false)} />}
    </>
  )
}

function StoryboardImageApiDialog({ shot, shotNumber, episode, scene, characters, providerConfig, bailianStatus, onRegeneratePrompt, onClose, onOpenSettings, onApply }) {
  const modalRef = useRef(null)
  const closeRef = useRef(null)
  const [prompt, setPrompt] = useState(() => createStoryboardImagePromptDraft(shot))
  const [size, setSize] = useState(storyboardImageSizeOptions[0].value)
  const [stage, setStage] = useState('editing')
  const [dryRun, setDryRun] = useState(null)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [recoverableImage, setRecoverableImage] = useState(null)
  const preview = useMemo(() => createStoryboardImageRequestPreview({
    shot,
    characters,
    prompt,
    size,
    providerConfig,
    bailianStatus,
  }), [bailianStatus, characters, prompt, providerConfig, shot, size])

  useEffect(() => {
    let active = true
    providerRegistry.listImages({ purpose: 'storyboard', entityId: String(shot.id), limit: 3 }).then((result) => {
      if (!active || !result?.ok) return
      setRecoverableImage(result.assets?.find((asset) => asset.assetId !== shot.imageAssetId) || null)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [shot.id, shot.imageAssetId])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (stage === 'generating') return
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, stage])

  const promptLength = Array.from(prompt).length
  const keyStatus = bailianStatus.loading
    ? '正在读取本地状态'
    : !bailianStatus.ok
      ? bailianStatus.error || '状态读取失败'
      : preview.configured
        ? '本地 Key 已接入'
        : '未找到本地 Key'
  const generationStatus = preview.executorAvailable
    ? stage === 'result' ? '单张图片已生成' : '单张真实生成可用'
    : preview.paidGenerationEnabled ? '请先检查本地 Key' : '真实生成已锁定'
  const rebuildPrompt = () => {
    setPrompt(onRegeneratePrompt())
    setStage('editing')
    setDryRun(null)
    setError('')
  }
  const prepareGeneration = async () => {
    setError('')
    if (!preview.ok) {
      setError(preview.errors[0] || '请检查图片请求')
      return
    }
    if (!preview.executorAvailable) {
      setError(preview.configured ? '真实生成当前已锁定，不会发送请求。' : '未找到本地百炼 Key，请先前往设置页检查。')
      return
    }
    const result = await providerRegistry.dryRunImage(createStoryboardImageGenerationRequest({ shot, characters, prompt, size }))
    if (!result?.ok) {
      setError(result?.error || '图片请求预检失败')
      return
    }
    setDryRun(result)
    setStage('review')
  }
  const confirmGeneration = async () => {
    setError('')
    setStage('generating')
    const result = await providerRegistry.generateImage({
      ...createStoryboardImageGenerationRequest({ shot, characters, prompt, size }),
      confirmed: true,
    })
    if (!result?.ok) {
      setError(result?.error || '分镜图片生成失败')
      setStage('review')
      return
    }
    setResponse(result)
    setStage('result')
  }
  const applyGeneration = () => {
    const result = onApply(response.image)
    if (result?.ok === false) {
      setError(result.error || '采用分镜图片失败')
      return
    }
    onClose()
  }

  return (
    <div className="storyboard-image-api-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && stage !== 'generating') onClose()
    }}>
      <section ref={modalRef} id="storyboard-image-api-dialog" className="storyboard-image-api-dialog" role="dialog" aria-modal="true" aria-labelledby="storyboard-image-api-title" aria-describedby="storyboard-image-api-description">
        <header className="storyboard-image-api-header">
          <span><Icon name="image" size={23} /></span>
          <div><small>STORYBOARD IMAGE API</small><h2 id="storyboard-image-api-title">API 生成当前画面</h2><p id="storyboard-image-api-description">镜头 {String(shotNumber).padStart(2, '0')} · {scene?.title || '未命名场景'} · 只使用当前真实分镜数据</p></div>
          <button ref={closeRef} type="button" className="storyboard-image-api-close" aria-label="关闭分镜图片 API 配置" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="storyboard-image-api-status-grid" aria-label="分镜图片服务状态">
          <article><small>图片服务</small><strong>{preview.provider}</strong><span>{preview.endpoint || '服务地址由设置页管理'}</span></article>
          <article><small>模型</small><strong>{preview.model}</strong><span>当前图片能力配置</span></article>
          <article data-tone={preview.configured ? 'ready' : 'warning'}><small>Key 状态</small><strong>{keyStatus}</strong><span>Key 不会显示或写入项目</span></article>
          <article data-tone={preview.executorAvailable ? 'ready' : 'locked'}><small>调用状态</small><strong>{generationStatus}</strong><span>{dryRun ? `本次请求 ${dryRun.requestCount || 1} 次 · 固定 ${dryRun.n || 1} 张` : '预检前不会发送请求'}</span></article>
        </div>

        <div className="storyboard-image-api-workspace">
          <section className="storyboard-image-api-preview">
            <header><div><small>CURRENT SHOT</small><h3>当前镜头</h3></div><span>{preview.shotHasImage ? '已有本地图片' : '没有真实镜头图片'}</span></header>
            {preview.shotHasImage
              ? <img src={shot.image} alt={`镜头 ${shotNumber} 的本地图片`} />
              : <div className="storyboard-image-api-preview-empty"><Icon name="image" size={29} /><strong>当前镜头没有真实图片</strong><span>可使用提示词与角色参考准备文生图请求。</span></div>}
            <div className="storyboard-image-api-shot-tags"><span>{shot.size || '未设景别'}</span><span>{shot.motion || '未设运镜'}</span><span>{shot.duration || '未设时长'}</span><span><Icon name={shot.continuityLocked === false ? 'edit' : 'lock'} size={10} />{shot.continuityLocked === false ? '连续性未锁定' : '连续性已锁定'}</span></div>
            <small className="storyboard-image-api-shot-source">{preview.shotHasImage ? shot.imageFileName || '本地镜头图片' : `${episode?.title || '未命名剧集'} · ${scene?.title || '未命名场景'}`}</small>
          </section>

          <section className="storyboard-image-api-request">
            <label className={!preview.ok && !prompt.trim() ? 'is-invalid' : ''}>
              <span>画面提示词 <small>{promptLength} / {maximumStoryboardImagePromptCharacters}</small></span>
              <textarea value={prompt} maxLength={maximumStoryboardImagePromptCharacters} onChange={(event) => {
                setPrompt(event.target.value)
                setStage('editing')
                setDryRun(null)
                setError('')
              }} aria-label="分镜画面提示词" placeholder="请先填写或使用当前设定重建提示词" spellCheck="false" />
            </label>
            <button type="button" className="secondary-button storyboard-image-api-rebuild" onClick={rebuildPrompt}><Icon name="spark" size={14} />使用当前设定重建提示词</button>
            <div className="storyboard-image-api-options">
              <label><span>图片尺寸</span><select value={size} onChange={(event) => {
                setSize(event.target.value)
                setStage('editing')
                setDryRun(null)
              }}>{storyboardImageSizeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <article><span>生成数量</span><strong>1 张</strong><small>固定单张，避免误耗额度</small></article>
              <article><span>水印</span><strong>关闭</strong><small>请求预览值</small></article>
            </div>
          </section>
        </div>

        <section className="storyboard-image-api-references">
          <header><div><small>CONTINUITY REFERENCES</small><h3>角色与连续性参考</h3></div><span>请求参考图 {preview.referenceCount}/{maximumStoryboardImageReferences}</span></header>
          {preview.characterBindings.length ? <div>{preview.characterBindings.map((binding) => <article className={binding.included ? 'is-included' : ''} key={binding.id}>
            {binding.hasImage ? <img src={binding.image} alt={`${binding.name}的本地角色参考图`} /> : <i>{Array.from(binding.name)[0] || '角'}</i>}
            <span><strong>{binding.name}</strong><small>{binding.included ? '已计入' : binding.hasImage ? '超出 3 张上限' : '无参考图'}</small></span>
          </article>)}</div> : <div className="storyboard-image-api-references-empty"><Icon name="users" size={18} /><span>当前镜头未绑定角色，可在右侧“角色与连续性”中选择。</span></div>}
          {preview.shotHasImage && <p><Icon name="check" size={12} />当前镜头图片优先占用 1 个参考位。</p>}
        </section>

        {recoverableImage && stage === 'editing' && <div className="managed-image-recovery"><span><Icon name="database" size={17} /><b>发现已下载但未采用的本地结果</b><small>{recoverableImage.fileName} · 恢复不会调用百炼</small></span><button type="button" className="secondary-button" onClick={() => {
          setResponse({ ok: true, image: recoverableImage, recovered: true })
          setStage('result')
        }}>恢复最近结果</button></div>}
        {response?.image && <div className="storyboard-image-api-generated"><img src={response.image.mediaUrl || response.image.dataUrl} alt={`镜头 ${shotNumber} 的生成画面`} /><span><strong>单张结果已下载到本地</strong><small>{response.image.fileName} · 文件化保存，不重复写入项目正文</small></span></div>}
        {response?.image && <div className="managed-image-adoption-notice"><Icon name="shield" size={18} /><span><strong>将采用本地文件引用，项目正文预计增加不足 1 KB</strong><small>图片文件已保存，本次采用不会调用百炼。</small></span></div>}
        {error && <p className="controlled-generation-error" role="alert">{error}</p>}
        <footer>
          <div className="storyboard-image-api-lock-notice"><Icon name="shield" size={19} /><span><strong>{dryRun?.billingNotice || generationStatus}</strong><small>{stage === 'review' ? '点击确认后只发送这 1 次请求；不会自动重试或批量生成。' : preview.executorAvailable ? '先预检，再由你明确确认单次真实请求。' : '当前锁定不会向百炼发送图片生成请求。'}</small></span></div>
          <div className="storyboard-image-api-actions"><button type="button" className="secondary-button" disabled={stage === 'generating'} onClick={onClose}>取消</button><button type="button" className="secondary-button storyboard-image-api-settings" disabled={stage === 'generating'} onClick={onOpenSettings}>前往图片设置</button>{stage === 'editing' && <button type="button" className="primary-button storyboard-image-api-submit" disabled={!preview.ok || !preview.executorAvailable} onClick={prepareGeneration}><Icon name="shield" size={15} />预检单张请求</button>}{stage === 'review' && <button type="button" className="primary-button storyboard-image-api-submit" onClick={confirmGeneration}>确认单次真实生成</button>}{stage === 'generating' && <button type="button" className="primary-button storyboard-image-api-submit" disabled>正在生成，请稍候…</button>}{stage === 'result' && <button type="button" className="primary-button storyboard-image-api-submit" onClick={applyGeneration}>采用到当前镜头</button>}</div>
        </footer>
      </section>
    </div>
  )
}

function StoryboardPage({ episodes, scenes, characters, selectedEpisode, setSelectedEpisode, selectedScene, setSelectedScene, shots, setShots, selectedShot, setSelectedShot, imageProviderConfig, bailianStatus, onOpenImageSettings, onApplyStoryboardImage, onNotice }) {
  const [storyboardImageApiDialogOpen, setStoryboardImageApiDialogOpen] = useState(false)
  const storyboardImageApiButtonRef = useRef(null)
  const restoreStoryboardImageApiFocusRef = useRef(false)
  const episodeScenes = useMemo(() => scenes.filter((scene) => scene.episodeId === selectedEpisode), [scenes, selectedEpisode])
  const activeScene = episodeScenes.find((scene) => scene.id === selectedScene) || episodeScenes[0]
  const activeSceneId = activeScene?.id || 0
  const visibleShots = useMemo(
    () => shots.filter((shot) => shot.episodeId === selectedEpisode && shot.sceneId === activeSceneId),
    [shots, selectedEpisode, activeSceneId],
  )
  const current = visibleShots.find((shot) => shot.id === selectedShot) || visibleShots[0]
  const currentIndex = visibleShots.indexOf(current)
  const totalDuration = visibleShots.reduce((total, shot) => total + (Number.parseFloat(shot.duration) || 0), 0)

  const closeStoryboardImageApiDialog = () => {
    restoreStoryboardImageApiFocusRef.current = true
    setStoryboardImageApiDialogOpen(false)
  }

  useEffect(() => {
    if (storyboardImageApiDialogOpen || !restoreStoryboardImageApiFocusRef.current) return
    restoreStoryboardImageApiFocusRef.current = false
    storyboardImageApiButtonRef.current?.focus()
  }, [storyboardImageApiDialogOpen])

  useEffect(() => {
    if (!episodes.some((episode) => episode.id === selectedEpisode) && episodes[0]) {
      setSelectedEpisode(episodes[0].id)
    }
  }, [episodes, selectedEpisode, setSelectedEpisode])

  useEffect(() => {
    if (activeSceneId !== selectedScene) setSelectedScene(activeSceneId)
  }, [activeSceneId, selectedScene, setSelectedScene])

  useEffect(() => {
    if ((current?.id || 0) !== selectedShot) setSelectedShot(current?.id || 0)
  }, [current, selectedShot, setSelectedShot])

  const changeEpisode = (episodeId) => {
    const firstScene = scenes.find((scene) => scene.episodeId === episodeId)
    setSelectedEpisode(episodeId)
    setSelectedScene(firstScene?.id || 0)
    setSelectedShot(shots.find((shot) => shot.episodeId === episodeId && shot.sceneId === firstScene?.id)?.id || 0)
  }
  const changeScene = (sceneId) => {
    setSelectedScene(sceneId)
    setSelectedShot(shots.find((shot) => shot.episodeId === selectedEpisode && shot.sceneId === sceneId)?.id || 0)
  }
  const updateShot = (field, value) => {
    if (!current) return
    setShots((items) => items.map((shot) => shot.id === current.id ? { ...shot, [field]: value } : shot))
  }
  const updateShotById = (shotId, changes) => setShots((items) => items.map((shot) => shot.id === shotId ? { ...shot, ...changes } : shot))
  const addShot = () => {
    if (!activeScene) {
      onNotice('请先在剧本页为当前剧集新增场景')
      return
    }
    const id = Math.max(0, ...shots.map((shot) => shot.id)) + 1
    const template = current || visibleShots[visibleShots.length - 1] || {}
    const shotBase = {
      ...template,
      id,
      episodeId: selectedEpisode,
      sceneId: activeScene.id,
      variant: (id % 6) + 1,
      action: '',
      dialogue: '',
      duration: '3.0s',
      size: template.size || '中景',
      motion: template.motion || '固定',
      motionEffect: template.motionEffect || 'none',
      motionStrength: template.motionStrength || 35,
      transition: template.transition || 'cut',
      transitionDuration: template.transitionDuration || 0,
      characterIds: [],
      costume: '',
      continuityLocked: false,
      image: '',
      imageStatus: '未生成',
      imageSource: '',
      imageFileName: '',
      imageError: '',
      imageAttempt: 0,
    }
    const shot = { ...shotBase, visualPrompt: createShotVisualPrompt({ shot: shotBase, scene: activeScene, characters }) }
    setShots((items) => [...items, shot])
    setSelectedShot(id)
    onNotice(`已在“${activeScene.title}”新增镜头`)
  }
  const splitShot = () => {
    if (!current) return
    const id = Math.max(0, ...shots.map((shot) => shot.id)) + 1
    const shotBase = { ...current, id, variant: (current.variant % 6) + 1, action: `${current.action}（后半段）`, duration: '2.0s', image: '', imageStatus: '未生成', imageSource: '', imageFileName: '', imageError: '', imageAttempt: 0 }
    const shot = { ...shotBase, visualPrompt: createShotVisualPrompt({ shot: shotBase, scene: activeScene, characters }) }
    const sourceIndex = shots.findIndex((item) => item.id === current.id)
    setShots((items) => [...items.slice(0, sourceIndex + 1), shot, ...items.slice(sourceIndex + 1)])
    setSelectedShot(id)
    onNotice('已将当前镜头拆分为两个连续镜头')
  }
  const moveShot = (direction) => setShots((items) => {
    if (!current) return items
    const visible = items.filter((shot) => shot.episodeId === selectedEpisode && shot.sceneId === activeSceneId)
    const index = visible.findIndex((shot) => shot.id === current.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= visible.length) return items
    const sourceIndex = items.findIndex((shot) => shot.id === visible[index].id)
    const targetIndex = items.findIndex((shot) => shot.id === visible[target].id)
    const next = [...items]
    ;[next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]]
    return next
  })
  const deleteShot = () => {
    if (!current || !window.confirm(`删除镜头 ${String(current.id).padStart(2, '0')}？`)) return
    const replacement = visibleShots[currentIndex + 1] || visibleShots[currentIndex - 1]
    setShots((items) => items.filter((shot) => shot.id !== current.id))
    setSelectedShot(replacement?.id || 0)
    onNotice('镜头已删除')
  }
  const toggleShotCharacter = (characterId) => {
    if (!current) return
    const currentIds = Array.isArray(current.characterIds) ? current.characterIds : []
    updateShot('characterIds', currentIds.includes(characterId)
      ? currentIds.filter((id) => id !== characterId)
      : [...currentIds, characterId])
  }
  const regenerateVisualPrompt = () => {
    if (!current) return
    updateShot('visualPrompt', createShotVisualPrompt({ shot: current, scene: activeScene, characters }))
    onNotice('已根据当前镜头和连续性设定重建画面提示词')
  }
  const importShotImage = (event) => {
    const file = event.target.files?.[0]
    if (!file || !current) return
    if (file.size > 2 * 1024 * 1024) {
      onNotice('镜头图片需小于 2 MB，避免项目文件过大')
      event.target.value = ''
      return
    }
    const shotId = current.id
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return
      updateShotById(shotId, {
        image: reader.result,
        imageStatus: '已完成',
        imageSource: 'local',
        imageFileName: file.name,
        imageError: '',
        imageUpdatedAt: new Date().toISOString(),
      })
      onNotice(`已导入镜头图片：${file.name}`)
    }, { once: true })
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const removeShotImage = () => {
    if (!current?.image || !window.confirm('移除当前镜头图片？提示词和镜头参数会继续保留。')) return
    updateShotById(current.id, { image: '', imageStatus: '未生成', imageSource: '', imageFileName: '', imageError: '' })
    onNotice('镜头图片已移除')
  }

  return (
    <>
    <main className="page project-page storyboard-page">
      <section className="glass storyboard-main">
        <div className="storyboard-toolbar">
          <div>
            <h1>分镜板</h1>
            <label className="compact-select compact-select--wide">
              <select value={selectedEpisode} onChange={(event) => changeEpisode(Number(event.target.value))}>
                {episodes.map((episode, index) => <option key={episode.id} value={episode.id}>第 {index + 1} 集 · {episode.title}</option>)}
              </select>
              <Icon name="chevron" size={14} />
            </label>
            <label className="compact-select compact-select--wide">
              <select value={activeSceneId} onChange={(event) => changeScene(Number(event.target.value))} disabled={!episodeScenes.length}>
                {episodeScenes.map((scene, index) => <option key={scene.id} value={scene.id}>场景 {String(index + 1).padStart(2, '0')} · {scene.title}</option>)}
              </select>
              <Icon name="chevron" size={14} />
            </label>
          </div>
          <div>
            <button className="secondary-button add-shot-button" onClick={addShot}><Icon name="plus" size={16} />新增镜头</button>
            <button className="secondary-button" disabled={!current} onClick={splitShot}>拆分镜头</button>
            <button className="secondary-button batch-image-button" disabled title="当前只开放单镜头请求预览，批量生成仍未接入">批量画面未启用</button>
            <button ref={storyboardImageApiButtonRef} className="primary-button generate-current-shot-button storyboard-image-api-button" disabled={!current} title={current ? '预检并按确认生成单张分镜画面' : '请先创建镜头'} aria-haspopup="dialog" aria-controls="storyboard-image-api-dialog" onClick={() => setStoryboardImageApiDialogOpen(true)}><Icon name="spark" size={16} /><span>API 生成当前画面</span><small>{bailianStatus?.paidGenerationEnabled ? '单张' : '已锁定'}</small></button>
          </div>
        </div>
        <div className="scene-switcher">
          {episodeScenes.map((scene, index) => <button key={scene.id} className={scene.id === activeSceneId ? 'is-active' : ''} onClick={() => changeScene(scene.id)}><Art variant={scene.id} label={scene.title} /><span>场景 {String(index + 1).padStart(2, '0')} · {scene.title}</span></button>)}
        </div>
        {visibleShots.length ? (
          <div className="shot-grid">{visibleShots.map((shot, index) => <button key={shot.id} className={`shot-card ${shot.id === current?.id ? 'is-active' : ''}`} onClick={() => setSelectedShot(shot.id)}><div className="shot-visual"><Art variant={shot.variant} image={shot.image} label={`镜头${shot.id}`} /><b>{String(index + 1).padStart(2, '0')}</b><i><Icon name={shot.continuityLocked === false ? 'edit' : 'lock'} size={15} /></i><em className={`shot-image-status shot-image-status--${shot.imageStatus}`}>{shot.imageStatus || '未生成'}</em></div><div className="shot-copy"><p><strong>动作</strong>{shot.action}</p><p><strong>台词</strong>{shot.dialogue}</p><div><span><Icon name="clock" size={14} />{shot.duration}</span><span>景别　{shot.size}</span><span>运镜　{shot.motion}</span></div><small>场景　{activeScene?.title} · 提示词 {shot.visualPrompt ? '已就绪' : '待补充'}</small></div></button>)}</div>
        ) : (
          <div className="empty-data"><Icon name="image" size={28} /><strong>当前场景还没有分镜</strong><p>新增第一个镜头后，画面描述、台词与镜头参数会自动保存。</p><button className="primary-button" onClick={addShot}><Icon name="plus" size={16} />新增镜头</button></div>
        )}
        <footer><span>共 {visibleShots.length} 个镜头</span><span>时长合计　{totalDuration.toFixed(1)}s</span></footer>
      </section>
      <aside className="glass inspector shot-inspector">
        {current ? <>
          <h2>镜头信息</h2>
          <div className="shot-id"><strong>{String(currentIndex + 1).padStart(2, '0')}</strong><span>镜头 {String(currentIndex + 1).padStart(2, '0')}</span><Icon name="lock" size={16} /></div>
          <div className="shot-asset-preview"><Art variant={current.variant} image={current.image} label={`镜头 ${currentIndex + 1} 画面`} /><span className={`shot-image-status shot-image-status--${current.imageStatus}`}>{current.imageStatus || '未生成'}</span></div>
          <div className="shot-asset-actions"><label className="secondary-button"><Icon name="upload" size={15} />{current.image ? '替换图片' : '导入图片'}<input className="shot-image-file-input" type="file" accept="image/*" onChange={importShotImage} /></label><button className="secondary-button" disabled={!current.image} onClick={removeShotImage}><Icon name="trash" size={14} />移除</button></div>
          {current.imageError && <div className="shot-image-error">{current.imageError}</div>}
          <label><span>动作</span><textarea value={current.action} onChange={(event) => updateShot('action', event.target.value)} /></label>
          <label><span>台词</span><textarea value={current.dialogue} onChange={(event) => updateShot('dialogue', event.target.value)} /></label>
          <label><span>画面提示词</span><textarea className="shot-prompt-input" value={current.visualPrompt || ''} onChange={(event) => updateShot('visualPrompt', event.target.value)} /></label>
          <button className="secondary-button prompt-regenerate-button" onClick={regenerateVisualPrompt}><Icon name="spark" size={15} />根据设定重建提示词</button>
          <label><span>时长</span><input value={current.duration} onChange={(event) => updateShot('duration', event.target.value)} /></label>
          <label><span>景别</span><select value={current.size} onChange={(event) => updateShot('size', event.target.value)}><option>全景</option><option>中景</option><option>中近景</option><option>近景</option></select></label>
          <label><span>运镜</span><select value={current.motion} onChange={(event) => updateShot('motion', event.target.value)}><option>缓慢前移</option><option>推进</option><option>推近</option><option>跟拍</option><option>水平摇移</option><option>轻微变焦</option><option>固定</option></select></label>
          <div className="continuity continuity-editor"><span>角色与连续性 <button className={`continuity-lock-button ${current.continuityLocked === false ? '' : 'is-locked'}`} onClick={() => updateShot('continuityLocked', current.continuityLocked === false)}><Icon name={current.continuityLocked === false ? 'edit' : 'lock'} size={13} />{current.continuityLocked === false ? '未锁定' : '已锁定'}</button></span><div className="continuity-character-list">{characters.map((character) => { const selected = current.characterIds?.includes(character.id); return <button key={character.id} className={selected ? 'is-selected' : ''} onClick={() => toggleShotCharacter(character.id)} title={character.name}><Avatar person={character} size="small" /><span>{character.name}</span></button> })}</div><label className="shot-costume-field"><span>服装</span><input className="shot-costume-input" value={current.costume || ''} onChange={(event) => updateShot('costume', event.target.value)} /></label><div className="continuity-links"><small>{episodes.find((episode) => episode.id === selectedEpisode)?.title}</small><small>{activeScene?.title}</small></div></div>
          <div className="data-actions"><button className="secondary-button" disabled={currentIndex === 0} onClick={() => moveShot(-1)}>上移</button><button className="secondary-button" disabled={currentIndex === visibleShots.length - 1} onClick={() => moveShot(1)}>下移</button><button className="secondary-button delete-action" onClick={deleteShot}><Icon name="trash" size={15} />删除</button></div>
          <button className="primary-button" onClick={() => onNotice(`镜头 ${currentIndex + 1} 信息已进入自动保存队列`)}>保存镜头信息</button>
        </> : <div className="empty-inspector"><Icon name="image" size={30} /><h2>暂无镜头</h2><p>先为当前场景创建镜头，再编辑动作、台词和运镜信息。</p><button className="primary-button" onClick={addShot}>创建镜头</button></div>}
      </aside>
    </main>
    {storyboardImageApiDialogOpen && current && <StoryboardImageApiDialog shot={current} shotNumber={currentIndex + 1} episode={episodes.find((episode) => episode.id === selectedEpisode)} scene={activeScene} characters={characters} providerConfig={imageProviderConfig} bailianStatus={bailianStatus} onRegeneratePrompt={() => createShotVisualPrompt({ shot: current, scene: activeScene, characters })} onClose={closeStoryboardImageApiDialog} onOpenSettings={onOpenImageSettings} onApply={(image) => onApplyStoryboardImage({ shotId: current.id, image })} />}
    </>
  )
}

const createEmptyVoiceAuditionState = (activeLineId = null) => ({
  activeLineId,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  errorMessage: '',
})

const disposeVoiceAudioPlayer = (player) => {
  if (!player) return
  player.onloadedmetadata = null
  player.oncanplay = null
  player.ontimeupdate = null
  player.onplay = null
  player.onpause = null
  player.onended = null
  player.onerror = null
  player.pause()
  player.removeAttribute('src')
  player.load()
}

function VoicePage({ episodes, scenes, selectedEpisode, setSelectedEpisode, selectedScene, setSelectedScene, characters, lines, setLines, selectedSpeaker, setSelectedSpeaker, onNavigate, onNotice }) {
  const audioPlayerRef = useRef(null)
  const auditionSourceRef = useRef('')
  const lastNonZeroVolumeRef = useRef(0.6)
  const [auditionState, setAuditionState] = useState(() => createEmptyVoiceAuditionState())
  const [auditionVolume, setAuditionVolume] = useState(0.6)
  const [auditionMuted, setAuditionMuted] = useState(false)
  const currentSpeaker = characters.find((person) => person.name === selectedSpeaker) || characters[0]
  const episodeScenes = useMemo(() => scenes.filter((scene) => scene.episodeId === selectedEpisode), [scenes, selectedEpisode])
  const activeScene = episodeScenes.find((scene) => scene.id === selectedScene) || episodeScenes[0]
  const activeSceneId = activeScene?.id || 0
  const visibleLines = useMemo(
    () => lines.filter((line) => line.episodeId === selectedEpisode && line.sceneId === activeSceneId),
    [lines, selectedEpisode, activeSceneId],
  )
  const activeAuditionLine = visibleLines.find((line) => line.id === auditionState.activeLineId) || null
  const activeAuditionPerson = activeAuditionLine
    ? characters.find((person) => person.name === activeAuditionLine.speaker) || { name: activeAuditionLine.speaker, variant: activeAuditionLine.variant }
    : null
  const activeSourceStatus = getVoiceLineAudioSourceStatus(activeAuditionLine)
  const hasPlayableAudition = Boolean(activeAuditionLine?.audio)
  const hasValidAuditionDuration = hasPlayableAudition && isValidAuditionDuration(auditionState.duration)
  const auditionProgress = getAuditionProgress(auditionState.currentTime, auditionState.duration)
  const previousPlayableLineId = findAdjacentPlayableLineId(visibleLines, auditionState.activeLineId, -1)
  const nextPlayableLineId = findAdjacentPlayableLineId(visibleLines, auditionState.activeLineId, 1)

  const releaseAuditionPlayer = () => {
    disposeVoiceAudioPlayer(audioPlayerRef.current)
    audioPlayerRef.current = null
    auditionSourceRef.current = ''
  }

  const resetAudition = () => {
    releaseAuditionPlayer()
    setAuditionState(createEmptyVoiceAuditionState())
  }

  const setAuditionError = (message) => {
    setAuditionState((current) => ({ ...current, status: 'error', errorMessage: message }))
  }

  const prepareAuditionLine = (line, autoplay = false) => {
    if (!line) {
      resetAudition()
      return
    }
    if (auditionState.activeLineId === line.id && auditionSourceRef.current === line.audio && audioPlayerRef.current) {
      if (autoplay && audioPlayerRef.current.paused) {
        if (audioPlayerRef.current.ended) audioPlayerRef.current.currentTime = 0
        audioPlayerRef.current.play().catch(() => setAuditionError('无法开始播放，请再次点击'))
      }
      return
    }

    releaseAuditionPlayer()
    setAuditionState(createEmptyVoiceAuditionState(line.id))
    if (!line.audio) return

    const player = new Audio()
    player.preload = 'metadata'
    player.volume = auditionMuted ? 0 : auditionVolume
    audioPlayerRef.current = player
    auditionSourceRef.current = line.audio
    setAuditionState({
      activeLineId: line.id,
      status: 'loading',
      currentTime: 0,
      duration: 0,
      errorMessage: '',
    })

    player.onloadedmetadata = () => {
      if (audioPlayerRef.current !== player) return
      setAuditionState((current) => ({
        ...current,
        duration: isValidAuditionDuration(player.duration) ? player.duration : 0,
        status: player.paused ? 'paused' : current.status,
      }))
    }
    player.oncanplay = () => {
      if (audioPlayerRef.current !== player) return
      setAuditionState((current) => current.status === 'loading' ? { ...current, status: player.paused ? 'paused' : 'playing' } : current)
    }
    player.ontimeupdate = () => {
      if (audioPlayerRef.current !== player) return
      setAuditionState((current) => ({
        ...current,
        currentTime: Number.isFinite(player.currentTime) ? player.currentTime : 0,
        duration: isValidAuditionDuration(player.duration) ? player.duration : current.duration,
      }))
    }
    player.onplay = () => {
      if (audioPlayerRef.current !== player) return
      setAuditionState((current) => ({ ...current, status: 'playing', errorMessage: '' }))
    }
    player.onpause = () => {
      if (audioPlayerRef.current !== player || player.ended) return
      setAuditionState((current) => current.status === 'error' ? current : { ...current, status: 'paused' })
    }
    player.onended = () => {
      if (audioPlayerRef.current !== player) return
      setAuditionState((current) => ({
        ...current,
        status: 'ended',
        currentTime: isValidAuditionDuration(player.duration) ? player.duration : current.duration,
      }))
    }
    player.onerror = () => {
      if (audioPlayerRef.current !== player) return
      updateLineById(line.id, { audioStatus: '失败', audioError: '音频读取失败，请重新导入' })
      setAuditionError('音频读取失败，请重新导入')
    }
    player.src = line.audio
    player.load()
    if (autoplay) player.play().catch(() => setAuditionError('无法开始播放，请再次点击'))
  }

  const toggleAuditionLine = (line) => {
    if (!line?.audio) {
      prepareAuditionLine(line)
      onNotice('当前台词没有真实音频，请先导入本地音频')
      return
    }
    if (auditionState.activeLineId !== line.id || auditionSourceRef.current !== line.audio || !audioPlayerRef.current) {
      prepareAuditionLine(line, true)
      return
    }
    const player = audioPlayerRef.current
    if (!player.paused) {
      player.pause()
      return
    }
    if (player.ended || (isValidAuditionDuration(player.duration) && player.currentTime >= player.duration)) player.currentTime = 0
    player.play().catch(() => setAuditionError('无法开始播放，请再次点击'))
  }

  useEffect(() => {
    if (activeSceneId !== selectedScene) setSelectedScene(activeSceneId)
  }, [activeSceneId, selectedScene, setSelectedScene])

  useEffect(() => () => {
    disposeVoiceAudioPlayer(audioPlayerRef.current)
    audioPlayerRef.current = null
  }, [])

  useEffect(() => {
    if (!auditionState.activeLineId) return
    const visibleLine = visibleLines.find((line) => line.id === auditionState.activeLineId)
    if (!visibleLine) resetAudition()
  }, [auditionState.activeLineId, visibleLines])

  useEffect(() => {
    const player = audioPlayerRef.current
    if (player) player.volume = auditionMuted ? 0 : auditionVolume
  }, [auditionMuted, auditionVolume])

  useEffect(() => {
    const handleSpacePlayback = (event) => {
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [contenteditable="true"]')) return
      const player = audioPlayerRef.current
      if (!player || !activeAuditionLine?.audio) return
      event.preventDefault()
      if (!player.paused) player.pause()
      else {
        if (player.ended || (isValidAuditionDuration(player.duration) && player.currentTime >= player.duration)) player.currentTime = 0
        player.play().catch(() => setAuditionError('无法开始播放，请再次点击'))
      }
    }
    document.addEventListener('keydown', handleSpacePlayback)
    return () => document.removeEventListener('keydown', handleSpacePlayback)
  }, [activeAuditionLine?.audio])

  const changeEpisode = (episodeId) => {
    const firstScene = scenes.find((scene) => scene.episodeId === episodeId)
    setSelectedEpisode(episodeId)
    setSelectedScene(firstScene?.id || 0)
  }
  const updateLine = (id, field, value) => setLines((items) => items.map((line) => line.id === id ? {
    ...line,
    [field]: value,
    ...(['text', 'emotion'].includes(field) ? { status: '未配音', audioStatus: '未生成', audioError: '台词内容已变化，请重新生成或替换音频' } : {}),
  } : line))
  const updateLineById = (lineId, changes) => setLines((items) => items.map((line) => line.id === lineId ? { ...line, ...changes } : line))
  const addLine = () => {
    if (!activeScene || !currentSpeaker) {
      onNotice('请先准备场景和角色')
      return
    }
    const id = Math.max(0, ...lines.map((line) => line.id)) + 1
    setLines((items) => [...items, {
      id,
      episodeId: selectedEpisode,
      sceneId: activeScene.id,
      scene: activeScene.title,
      speaker: currentSpeaker.name,
      text: '',
      emotion: '默认',
      duration: '0.0s',
      status: '未配音',
      variant: currentSpeaker.variant,
      audio: '',
      audioStatus: '未生成',
      audioSource: '',
      audioFileName: '',
      audioError: '',
      audioAttempt: 0,
    }])
    onNotice(`已在“${activeScene.title}”新增台词`)
  }
  const moveLine = (lineId, direction) => setLines((items) => {
    const visible = items.filter((line) => line.episodeId === selectedEpisode && line.sceneId === activeSceneId)
    const index = visible.findIndex((line) => line.id === lineId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= visible.length) return items
    const sourceIndex = items.findIndex((line) => line.id === visible[index].id)
    const targetIndex = items.findIndex((line) => line.id === visible[target].id)
    const next = [...items]
    ;[next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]]
    return next
  })
  const deleteLine = (line) => {
    if (!window.confirm(`删除“${line.speaker}”的这句台词？`)) return
    if (auditionState.activeLineId === line.id) resetAudition()
    setLines((items) => items.filter((item) => item.id !== line.id))
    onNotice('台词已删除')
  }
  const importLineAudio = (event, line) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      onNotice('单句音频需小于 3 MB，避免项目文件过大')
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') return
      const importedLine = {
        ...line,
        audio: reader.result,
        audioAssetId: '',
        audioBytes: 0,
        audioDuration: 0,
        audioSha256: '',
        audioInputHash: '',
        audioStatus: '已完成',
        audioSource: 'local',
        audioFileName: file.name,
        audioError: '',
        audioUpdatedAt: new Date().toISOString(),
        status: '待确认',
      }
      updateLineById(line.id, importedLine)
      prepareAuditionLine(importedLine)
      onNotice(`已导入台词音频：${file.name}`)
    }, { once: true })
    reader.addEventListener('error', () => {
      updateLineById(line.id, { audioStatus: '失败', audioError: '音频读取失败，请重新导入' })
      onNotice('音频读取失败，请重新导入')
    }, { once: true })
    reader.readAsDataURL(file)

    const objectUrl = URL.createObjectURL(file)
    const audioProbe = new Audio()
    const releaseProbe = () => URL.revokeObjectURL(objectUrl)
    audioProbe.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audioProbe.duration)) updateLineById(line.id, { duration: `${audioProbe.duration.toFixed(1)}s` })
      releaseProbe()
    }, { once: true })
    audioProbe.addEventListener('error', releaseProbe, { once: true })
    audioProbe.src = objectUrl
    input.value = ''
  }
  const seekAudition = (value) => {
    const player = audioPlayerRef.current
    if (!player || !hasValidAuditionDuration) return
    const nextTime = Math.min(Math.max(Number(value) || 0, 0), auditionState.duration)
    player.currentTime = nextTime
    setAuditionState((current) => ({ ...current, currentTime: nextTime, status: player.paused ? 'paused' : current.status }))
  }
  const selectAdjacentAudition = (direction) => {
    const targetId = direction < 0 ? previousPlayableLineId : nextPlayableLineId
    const targetLine = visibleLines.find((line) => line.id === targetId)
    if (!targetLine) return
    prepareAuditionLine(targetLine)
    window.requestAnimationFrame(() => document.querySelector(`[data-voice-line-id="${targetLine.id}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  const changeAuditionVolume = (value) => {
    const normalized = normalizeAuditionVolume(Number(value) / 100)
    if (normalized > 0) lastNonZeroVolumeRef.current = normalized
    setAuditionVolume(normalized)
    setAuditionMuted(normalized === 0)
  }
  const toggleAuditionMute = () => {
    if (auditionMuted || auditionVolume === 0) {
      const restoredVolume = normalizeAuditionVolume(lastNonZeroVolumeRef.current, 0.6) || 0.6
      setAuditionVolume(restoredVolume)
      setAuditionMuted(false)
      return
    }
    lastNonZeroVolumeRef.current = auditionVolume
    setAuditionMuted(true)
  }
  const getAuditionStatusLabel = () => {
    if (!activeAuditionLine) return '选择一条台词开始检查'
    if (!activeAuditionLine.audio) return '导入真实音频后可试听'
    if (auditionState.status === 'loading') return '正在读取音频'
    if (auditionState.status === 'playing') return '正在播放'
    if (auditionState.status === 'paused') return '已暂停'
    if (auditionState.status === 'ended') return '播放结束'
    if (auditionState.status === 'error') return auditionState.errorMessage
    return '本地音频已就绪'
  }
  const volumePercent = Math.round((auditionMuted ? 0 : auditionVolume) * 100)

  return (
    <main className="page project-page voice-page">
      <aside className="glass context-panel speaker-list">
        <div className="panel-title"><h2>说话人</h2><button type="button" onClick={() => onNavigate('character')}>角色音色</button></div>
        {characters.map((person) => {
          const statuses = lines.filter((line) => line.episodeId === selectedEpisode && line.speaker === person.name).map((line) => line.status)
          const status = statuses.includes('未配音') ? '未配音' : statuses.includes('待确认') ? '待确认' : statuses.length ? '已确认' : '无台词'
          return <button key={person.id} className={person.name === currentSpeaker.name ? 'is-active' : ''} onClick={() => setSelectedSpeaker(person.name)}><Avatar person={person} /><span><strong>{person.name}</strong><small className={`voice-status voice-status--${status}`}>{status}</small></span></button>
        })}
      </aside>
      <section className="glass dialogue-list">
        <div className="panel-title dialogue-title">
          <h2>台词</h2>
          <div><label className="compact-select compact-select--wide"><select value={selectedEpisode} onChange={(event) => changeEpisode(Number(event.target.value))}>{episodes.map((episode, index) => <option key={episode.id} value={episode.id}>第 {index + 1} 集 · {episode.title}</option>)}</select><Icon name="chevron" size={14} /></label><label className="compact-select compact-select--wide"><select value={activeSceneId} onChange={(event) => setSelectedScene(Number(event.target.value))} disabled={!episodeScenes.length}>{episodeScenes.map((scene, index) => <option key={scene.id} value={scene.id}>场景 {String(index + 1).padStart(2, '0')} · {scene.title}</option>)}</select><Icon name="chevron" size={14} /></label><button className="secondary-button dialogue-add-button" onClick={addLine}><Icon name="plus" size={15} />新增台词</button></div>
        </div>
        {visibleLines.length ? (
          <section className="dialogue-group"><h3>{activeScene?.title}</h3>{visibleLines.map((line, index) => {
            const sourceStatus = getVoiceLineAudioSourceStatus(line)
            const lineIsActive = auditionState.activeLineId === line.id
            const lineIsPlaying = lineIsActive && auditionState.status === 'playing'
            return (
              <div
                className={`voice-line ${lineIsActive ? 'is-audition-active' : ''} ${lineIsPlaying ? 'is-audition-playing' : ''}`}
                data-voice-line-id={line.id}
                aria-current={lineIsActive ? 'true' : undefined}
                key={line.id}
                onClick={() => prepareAuditionLine(line)}
              >
                <span className="voice-line-index">{String(index + 1).padStart(2, '0')}</span>
                <Avatar person={{ name: line.speaker, variant: line.variant }} size="small" />
                <strong>{line.speaker}</strong>
                <input aria-label={`${line.speaker}的台词`} value={line.text} onClick={(event) => event.stopPropagation()} onChange={(event) => updateLine(line.id, 'text', event.target.value)} />
                <select aria-label={`${line.speaker}的情绪`} value={line.emotion} onClick={(event) => event.stopPropagation()} onChange={(event) => updateLine(line.id, 'emotion', event.target.value)}>{dialogueEmotionOptions.map((emotion) => <option key={emotion}>{emotion}</option>)}</select>
                <span className="audio-meta"><small>{line.duration}</small><em className={`audio-source-badge audio-source-badge--${sourceStatus.key}`} title={sourceStatus.detail}>{sourceStatus.label}</em></span>
                <StatusPill tone={line.status === '已确认' ? 'success' : line.status === '待确认' ? 'warning' : 'muted'}>{line.status}</StatusPill>
                <button
                  className={`round-play line-audio-task-button ${lineIsPlaying ? 'is-playing' : ''}`}
                  disabled={!line.audio}
                  onClick={(event) => { event.stopPropagation(); toggleAuditionLine(line) }}
                  title={line.audio ? (lineIsPlaying ? '暂停本地音频' : '播放本地音频') : '请先导入真实音频'}
                  aria-label={line.audio ? (lineIsPlaying ? `暂停${line.speaker}的本地音频` : `播放${line.speaker}的本地音频`) : `${line.speaker}还没有真实音频`}
                >
                  <Icon name={line.audio ? (lineIsPlaying ? 'pause' : 'play') : 'upload'} size={15} />
                </button>
                <div className="line-actions" onClick={(event) => event.stopPropagation()}><button disabled={index === 0} onClick={() => moveLine(line.id, -1)} title="上移">↑</button><button disabled={index === visibleLines.length - 1} onClick={() => moveLine(line.id, 1)} title="下移">↓</button><label title={line.audio ? '替换音频' : '导入音频'}><Icon name="upload" size={13} /><input className="line-audio-file-input" type="file" accept="audio/*" onChange={(event) => importLineAudio(event, line)} /></label><button className="delete-line" onClick={() => deleteLine(line)} title="删除"><Icon name="trash" size={13} /></button></div>
              </div>
            )
          })}</section>
        ) : <div className="empty-data"><Icon name="mic" size={28} /><strong>当前场景还没有台词</strong><p>选择说话人后新增台词，即可继续编辑和生成配音。</p><button className="primary-button" onClick={addLine}><Icon name="plus" size={16} />新增台词</button></div>}
      </section>
      <aside className="glass inspector voice-inspector">
        <h2>配音设置</h2>
        <div className="provider-lock-notice is-ready"><Icon name="check" size={18} /><div><strong>真实配音已接入一键制作</strong><p>角色音色自动匹配，WAV 下载到本机后直接进入成片混音</p></div></div>
        <div className={`current-audition-card current-audition-card--${auditionState.status}`}>
          <header><strong>当前试听</strong>{activeAuditionLine && <em className={`audio-source-badge audio-source-badge--${activeSourceStatus.key}`}>{activeSourceStatus.label}</em>}</header>
          {activeAuditionLine ? <div className="current-audition-card__body"><Avatar person={activeAuditionPerson} size="small" /><div><strong>{activeAuditionLine.speaker}</strong><p title={activeAuditionLine.text}>{activeAuditionLine.text}</p></div></div> : <div className="current-audition-card__empty"><Icon name="volume" size={22} /><span>选择一条台词开始检查</span></div>}
          <p className={`current-audition-card__status ${auditionState.status === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{getAuditionStatusLabel()}{hasValidAuditionDuration ? ` · ${formatAuditionTime(auditionState.duration)}` : ''}</p>
        </div>
        <div className="speaker-profile"><Avatar person={currentSpeaker} /><span><strong>{currentSpeaker.name}</strong><small>角色音色</small><small>{currentSpeaker.voiceName || assignCharacterVoice(currentSpeaker).voiceName}</small></span><button type="button" onClick={() => onNavigate('character')}>更换声音</button></div>
        <label className="reserved-voice-control"><span>声音风格 · 自动</span><select disabled aria-label="声音风格由一键制作自动匹配"><option>{currentSpeaker.tone || '按角色设定匹配'}</option></select></label>
        <label className="reserved-voice-control"><span>情绪 · 跟随台词</span><select disabled aria-label="情绪由台词字段自动控制"><option>读取每句台词情绪</option></select></label>
        {[['语速', '自动'], ['音调', '自动'], ['停顿', '自动']].map(([label, value]) => <label className="range-field reserved-voice-control" key={label}><span>{label}</span><input type="range" min="0" max="100" defaultValue="50" disabled aria-label={`${label}由模型自动处理`} /><output>{value}</output></label>)}
        <button className="primary-button batch-voice-button" type="button" onClick={() => onNavigate('final')}><Icon name="spark" size={17} />前往一键生成配音和视频</button>
      </aside>
      <section className={`glass audition-bar audition-bar--${auditionState.status}`} aria-label="本地音频试听台" data-audition-status={auditionState.status}>
        <div className="audition-identity">
          {activeAuditionPerson ? <Avatar person={activeAuditionPerson} size="small" /> : <span className="audition-identity__placeholder"><Icon name="mic" size={18} /></span>}
          <div><span>{activeAuditionLine?.speaker || '选择一条台词'}{activeAuditionLine && <em className={`audio-source-badge audio-source-badge--${activeSourceStatus.key}`}>{activeSourceStatus.label}</em>}</span><strong title={activeAuditionLine?.text}>{activeAuditionLine?.text || '导入本地音频后可进行真实试听'}</strong></div>
        </div>
        <div className="audition-seek">
          <input
            className="audition-seek__range"
            type="range"
            min="0"
            max={hasValidAuditionDuration ? auditionState.duration : 1}
            step="0.1"
            value={hasValidAuditionDuration ? Math.min(auditionState.currentTime, auditionState.duration) : 0}
            disabled={!hasValidAuditionDuration || auditionState.status === 'error'}
            onChange={(event) => seekAudition(event.target.value)}
            aria-label="试听进度"
            aria-valuetext={hasValidAuditionDuration ? `${formatAuditionTime(auditionState.currentTime)}，总时长 ${formatAuditionTime(auditionState.duration)}` : '当前台词没有可试听音频'}
            style={{ '--audition-progress': `${auditionProgress}%` }}
          />
          <small className={auditionState.status === 'error' ? 'is-error' : ''}>{auditionState.status === 'error' ? auditionState.errorMessage : !activeAuditionLine ? '选择一条台词' : !hasPlayableAudition ? '当前台词没有真实音频' : auditionState.status === 'loading' ? '正在读取音频' : '本地音频试听'}</small>
        </div>
        <output className="audition-time">{hasValidAuditionDuration ? `${formatAuditionTime(auditionState.currentTime)} / ${formatAuditionTime(auditionState.duration)}` : '--:--.- / --:--.-'}</output>
        <div className="audition-transport-controls">
          <button disabled={previousPlayableLineId === null} onClick={() => selectAdjacentAudition(-1)} title="上一条本地音频" aria-label="上一条本地音频"><Icon name="previous" size={16} /></button>
          <button className="audition-play-button" disabled={!hasPlayableAudition || auditionState.status === 'error'} onClick={() => toggleAuditionLine(activeAuditionLine)} title={auditionState.status === 'playing' ? '暂停当前音频' : '播放当前音频'} aria-label={auditionState.status === 'playing' ? '暂停当前音频' : '播放当前音频'}><Icon name={auditionState.status === 'playing' ? 'pause' : 'play'} size={19} /></button>
          <button disabled={nextPlayableLineId === null} onClick={() => selectAdjacentAudition(1)} title="下一条本地音频" aria-label="下一条本地音频"><Icon name="next" size={16} /></button>
        </div>
        <div className="audition-volume">
          <button disabled={!hasPlayableAudition} onClick={toggleAuditionMute} title={volumePercent === 0 ? '恢复音量' : '静音'} aria-label={volumePercent === 0 ? '恢复音量' : '静音'}><Icon name={volumePercent === 0 ? 'volumeOff' : 'volume'} size={18} /></button>
          <input type="range" min="0" max="100" value={volumePercent} disabled={!hasPlayableAudition} onChange={(event) => changeAuditionVolume(event.target.value)} aria-label="试听音量" aria-valuetext={`音量 ${volumePercent}%`} style={{ '--audition-volume': `${volumePercent}%` }} />
          <output>{volumePercent}%</output>
        </div>
      </section>
    </main>
  )
}

const assetCategoryOptions = [
  { id: 'all', label: '全部素材', icon: 'folder' },
  { id: 'character-image', label: '角色图片', icon: 'users' },
  { id: 'shot-image', label: '分镜图片', icon: 'image' },
  { id: 'shot-video', label: '镜头视频', icon: 'video' },
  { id: 'voice-audio', label: '角色配音', icon: 'mic' },
  { id: 'bgm', label: '背景音乐', icon: 'volume' },
  { id: 'sfx', label: '音效', icon: 'spark' },
]

const assetHealthOptions = [
  { id: 'all', label: '全部状态' },
  { id: 'ready', label: '已引用' },
  { id: 'unused', label: '未使用' },
  { id: 'missing', label: '缺失' },
  { id: 'broken', label: '损坏' },
]

const assetHealthDetails = {
  ready: { label: '已引用', icon: 'check' },
  unused: { label: '未使用', icon: 'warning' },
  missing: { label: '缺失', icon: 'warning' },
  broken: { label: '损坏', icon: 'warning' },
}

const formatAssetUpdatedAt = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '未记录'
    : date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function AssetPreview({ asset, compact = false }) {
  if (asset.mediaType === 'video' && asset.thumbnailUrl) {
    return <img className="asset-preview__image" src={asset.thumbnailUrl} alt={`${asset.name}真实末帧`} />
  }
  if (asset.mediaType === 'image' && asset.health === 'ready') {
    return <img className="asset-preview__image" src={asset.dataUrl} alt={asset.name} />
  }
  if (asset.mediaType === 'audio' && asset.health === 'ready' && asset.waveform.length) {
    return (
      <div className={`asset-waveform ${compact ? 'asset-waveform--compact' : ''}`} aria-label="真实音频波形">
        {asset.waveform.map((sample, index) => <i key={`${asset.id}-${index}`} style={{ height: `${Math.max(12, sample * 100)}%` }} />)}
      </div>
    )
  }
  const issue = asset.health === 'missing' || asset.health === 'broken'
  return (
    <div className={`asset-preview__placeholder ${issue ? 'is-issue' : ''}`}>
      <Icon name={issue ? 'warning' : asset.mediaType === 'audio' ? 'volume' : 'image'} size={compact ? 20 : 34} />
      {!compact && <span>{issue ? assetHealthDetails[asset.health].label : asset.categoryLabel}</span>}
    </div>
  )
}

function StorageMigrationDialog({ request, projectSnapshot, recoveryKey, onClose, onOpenImportedProject }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const cleanupCancelRef = useRef(null)
  const migrationDrawerRef = useRef(null)
  const migrationDrawerCloseRef = useRef(null)
  const migrationDetailButtonRef = useRef(null)
  const futureReselectRef = useRef(null)
  const returnFocusRef = useRef(document.activeElement)
  const [state, setState] = useState(() => createInitialPortabilityState(request?.action))

  useEffect(() => {
    setState(createInitialPortabilityState(request?.action))
  }, [request?.id, request?.action])

  useEffect(() => projectPortabilityRepository.onProgress((progress) => {
    setState((current) => current.busy ? { ...current, progress } : current)
  }), [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [request?.id])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (state.migrationDetailsOpen) {
          setState((current) => ({ ...current, migrationDetailsOpen: false }))
          requestAnimationFrame(() => migrationDetailButtonRef.current?.focus())
          return
        }
        if (state.busy) projectPortabilityRepository.cancel()
        else onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusRoot = state.migrationDetailsOpen ? migrationDrawerRef.current : dialogRef.current
      const focusable = Array.from(focusRoot?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, state.busy, state.migrationDetailsOpen])

  useEffect(() => () => returnFocusRef.current?.focus?.(), [])

  useEffect(() => {
    if (state.cleanupConfirm) cleanupCancelRef.current?.focus()
  }, [state.cleanupConfirm])

  useEffect(() => {
    if (state.migrationDetailsOpen) migrationDrawerCloseRef.current?.focus()
  }, [state.migrationDetailsOpen])

  useEffect(() => {
    if (state.importCompatibility?.status === 'future') futureReselectRef.current?.focus()
  }, [state.importCompatibility?.status])

  const setFailure = (error) => setState((current) => ({
    ...current,
    busy: false,
    progress: null,
    error: error || '操作失败，请重试。',
  }))

  const inspectExport = async () => {
    setState((current) => ({ ...current, busy: true, error: '', progress: { percent: 0, message: '正在检查项目与托管媒体' } }))
    const result = await projectPortabilityRepository.inspectExport(projectSnapshot)
    if (!result.ok) return setFailure(result.error)
    setState((current) => ({
      ...current,
      busy: false,
      progress: null,
      stage: 'export-review',
      exportToken: result.token,
      exportSummary: result.summary,
      exportLocation: null,
      allowIncomplete: false,
      error: '',
      result: null,
    }))
  }

  const chooseExportLocation = async () => {
    if (!state.exportToken) return
    const result = await projectPortabilityRepository.chooseExportLocation(state.exportToken)
    if (result.canceled) return
    if (!result.ok) return setFailure(result.error)
    setState((current) => ({ ...current, exportLocation: result, error: '' }))
  }

  const runExport = async () => {
    if (!state.exportToken || !state.exportLocation) return
    setState((current) => ({ ...current, busy: true, error: '', progress: { percent: 0, message: '正在准备导出' } }))
    const result = await projectPortabilityRepository.runExport(state.exportToken, state.allowIncomplete)
    if (result.canceled) return setFailure('便携项目导出已取消。')
    if (!result.ok) return setFailure(result.error)
    setState((current) => ({ ...current, busy: false, progress: null, stage: 'export-result', result: { type: 'export', ...result }, error: '' }))
  }

  const chooseImport = async () => {
    setState((current) => ({ ...current, busy: true, error: '', progress: { percent: 0, message: '正在读取并校验便携项目' } }))
    const result = await projectPortabilityRepository.chooseImport()
    if (result.canceled) return setState((current) => ({ ...current, busy: false, progress: null }))
    if (!result.ok) return setFailure(result.error)
    setState((current) => ({
      ...current,
      busy: false,
      progress: null,
      stage: result.compatibility?.canImport ? 'import-review' : result.compatibility?.status || 'import-review',
      importToken: result.token,
      importSummary: result.summary,
      importCompatibility: result.compatibility || result.summary?.compatibility || null,
      importName: result.compatibility?.canImport ? `${result.summary.projectName} - 导入副本` : '',
      migrationDetailsOpen: false,
      error: '',
      result: null,
    }))
  }

  const runImport = async () => {
    if (!state.importToken || !state.importCompatibility?.canImport) return
    const validation = validatePortableImportName(state.importName)
    if (!validation.ok) return setFailure(validation.error)
    setState((current) => ({ ...current, busy: true, error: '', progress: { percent: 0, message: '正在导入托管媒体' } }))
    const result = await projectPortabilityRepository.runImport(state.importToken, validation.name)
    if (result.canceled) return setFailure('便携项目导入已取消。')
    if (!result.ok) return setFailure(result.error)
    setState((current) => ({ ...current, busy: false, progress: null, stage: 'import-result', result: { type: 'import', ...result }, error: '' }))
  }

  const scanManagedMedia = async () => {
    setState((current) => ({ ...current, busy: true, error: '', progress: { percent: 0, message: '正在比对项目、自动保存和恢复点' } }))
    const result = await managedMediaRepository.scan(projectSnapshot, recoveryKey)
    if (!result.ok) return setFailure(result.error)
    const eligible = result.records.filter((record) => record.status === 'eligible').map((record) => record.assetId)
    setState((current) => ({
      ...current,
      busy: false,
      progress: null,
      stage: 'cleanup-review',
      cleanupToken: result.token,
      cleanupSummary: result.summary,
      cleanupRecords: result.records,
      cleanupSelection: eligible,
      cleanupConfirm: false,
      error: '',
      result: null,
    }))
  }

  const runCleanup = async () => {
    if (!state.cleanupSelection.length) return
    setState((current) => ({ ...current, busy: true, cleanupConfirm: false, error: '', progress: { percent: 0, message: '正在重新扫描引用并移入 Windows 回收站' } }))
    const result = await managedMediaRepository.trash(state.cleanupToken, projectSnapshot, state.cleanupSelection)
    if (!result.ok && !Array.isArray(result.results)) return setFailure(result.error)
    setState((current) => ({ ...current, busy: false, progress: null, stage: 'cleanup-result', result: { type: 'cleanup', ...result }, error: '' }))
  }

  const switchTab = (tab) => setState((current) => ({
    ...createInitialPortabilityState(tab === 'cleanup' ? 'cleanup' : current.mode),
    tab,
    mode: current.mode,
  }))

  const setMode = (mode) => setState({ ...createInitialPortabilityState(mode), tab: 'portability', mode })
  const selectedCleanupBytes = state.cleanupRecords
    .filter((record) => state.cleanupSelection.includes(record.assetId))
    .reduce((sum, record) => sum + record.bytes, 0)

  const renderProgress = () => {
    const stepProgress = state.progress?.progressKind === 'steps'
    const currentStep = Math.max(1, Number(state.progress?.currentStep) || 1)
    const totalSteps = Math.max(currentStep, Number(state.progress?.totalSteps) || currentStep)
    const visualPercent = stepProgress
      ? Math.round((currentStep / totalSteps) * 100)
      : Math.max(0, Number(state.progress?.percent) || 0)
    return state.busy && <section className="storage-migration-progress" aria-live="polite">
    <span><Icon name={state.progress?.operation === 'import' ? 'download' : 'refresh'} size={21} /></span>
    <div><strong>{state.progress?.message || '正在处理真实本地数据'}</strong><i><b style={{ width: `${Math.max(2, visualPercent)}%` }} /></i><small>{stepProgress ? `真实步骤 ${currentStep} / ${totalSteps}` : `${visualPercent}% · ${state.progress?.completedBytes ? `${formatPortabilityBytes(state.progress.completedBytes)} / ${formatPortabilityBytes(state.progress.totalBytes)}` : '请勿关闭应用'}`}</small></div>
    <button type="button" className="secondary-button" onClick={() => projectPortabilityRepository.cancel()}>取消</button>
  </section>
  }

  const renderExport = () => {
    if (state.result?.type === 'export') return <section className="storage-migration-result is-success" data-testid="portable-export-result">
      <span><Icon name="check" size={30} /></span><h3>便携项目已导出</h3><p><strong>{state.result.bundleName}</strong> 已包含项目快照、校验清单和 {state.result.videoAssetCount} 个真实镜头视频。</p>
      {!state.result.complete && <p className="storage-migration-alert is-warning"><Icon name="warning" size={15} />这是已确认的不完整副本，缺失媒体会在导入后回退到分镜图。</p>}
      <div><button type="button" className="secondary-button" onClick={() => projectPortabilityRepository.reveal(state.result.revealToken)}><Icon name="folder" size={15} />打开所在位置</button><button type="button" className="primary-button" onClick={onClose}>完成</button></div>
    </section>
    if (!state.exportSummary) return <section className="storage-migration-empty">
      <span><Icon name="export" size={28} /></span><h3>导出完整的便携项目</h3><p>创建一个 <strong>.manju-bundle</strong> 文件夹，包含当前项目文件、真实托管镜头视频、SHA-256 校验清单和使用说明。</p>
      <ul><li>不包含本地 Key、供应商配置或绝对路径</li><li>导出前检查缺失媒体和目标磁盘空间</li><li>写入暂存目录，全部校验通过后再完成</li></ul>
      <button type="button" className="primary-button" onClick={inspectExport}><Icon name="shield" size={16} />检查并准备导出</button>
    </section>
    const summary = state.exportSummary
    return <section className="storage-migration-review" data-testid="portable-export-review">
      <header><div><small>EXPORT PREFLIGHT</small><h3>导出前检查</h3></div><span className={summary.complete ? 'is-safe' : 'is-warning'}><Icon name={summary.complete ? 'check' : 'warning'} size={14} />{summary.complete ? '媒体完整' : `${summary.missingAssets.length} 项缺失`}</span></header>
      <div className="storage-migration-facts"><article><small>项目文件</small><strong>{formatPortabilityBytes(summary.projectBytes)}</strong><span>10 MB 安全限制内</span></article><article><small>托管镜头视频</small><strong>{summary.videoAssetCount} 个</strong><span>{formatPortabilityBytes(summary.videoBytes)}</span></article><article><small>预计总大小</small><strong>{formatPortabilityBytes(summary.totalBytes)}</strong><span>逐文件真实复制</span></article></div>
      {summary.missingAssets.length > 0 && <div className="storage-migration-missing"><strong><Icon name="warning" size={15} />以下托管媒体不可用</strong>{summary.missingAssets.map((asset) => <p key={asset.assetId}><span title={asset.fileName}>{asset.fileName}</span><small>{asset.reason}</small></p>)}<label><input type="checkbox" checked={state.allowIncomplete} onChange={(event) => setState((current) => ({ ...current, allowIncomplete: event.target.checked }))} />我了解缺失媒体不会包含在副本中，仍要导出</label></div>}
      <div className="storage-migration-location"><span><Icon name="folder" size={18} /></span><div><small>导出位置</small><strong>{state.exportLocation ? `${state.exportLocation.locationLabel} / ${state.exportLocation.bundleName}` : '尚未选择文件夹'}</strong><p>界面不会读取或显示完整本地路径。</p></div><button type="button" className="secondary-button" onClick={chooseExportLocation}>{state.exportLocation ? '更换位置' : '选择位置'}</button></div>
      <footer><button type="button" className="secondary-button" onClick={inspectExport}>重新检查</button><button type="button" className="primary-button" disabled={!state.exportLocation || (!summary.complete && !state.allowIncomplete)} onClick={runExport}><Icon name="export" size={15} />开始导出</button></footer>
    </section>
  }

  const renderImport = () => {
    if (state.result?.type === 'import') {
      const migrated = state.result.migration?.sourceVersion < state.result.migration?.targetVersion
      return <section className="storage-migration-result is-success" data-testid="portable-import-result">
      <span><Icon name="check" size={30} /></span><h3>{migrated ? '旧版项目已安全迁移并导入' : '便携项目已作为新副本导入'}</h3><p>{migrated ? `来源 V${state.result.migration.sourceVersion} 已转换为当前 V${state.result.migration.targetVersion} 结构；原始便携包没有修改。` : `已分配新的本地项目标识，并复制 ${state.result.videoAssetCount} 个真实托管镜头视频；原项目不会被覆盖。`}</p>
      {migrated && <p className="storage-migration-alert is-safe"><Icon name="shield" size={15} />迁移 {state.result.migration.steps.length} 个真实结构步骤 · {state.result.videoAssetCount} 个镜头视频 · {formatPortabilityBytes(state.result.totalBytes)}</p>}
      <div><button type="button" className="secondary-button" onClick={onClose}>稍后打开</button><button type="button" className="primary-button" onClick={() => { onOpenImportedProject(state.result); onClose() }}>打开导入项目</button></div>
    </section>
    }
    if (!state.importSummary) return <section className="storage-migration-empty">
      <span><Icon name="download" size={28} /></span><h3>导入便携项目副本</h3><p>选择整个 <strong>.manju-bundle</strong> 文件夹。应用会先验证目录结构、项目格式、文件大小和 SHA-256，再复制到本机托管目录。</p>
      <ul><li>原项目和现有项目均不会被覆盖</li><li>不接受符号链接、目录联接或未知文件</li><li>导入完成前不会出现在最近项目中</li></ul>
      <button type="button" className="primary-button" onClick={chooseImport}><Icon name="folder" size={16} />选择便携项目</button>
    </section>
    const summary = state.importSummary
    const compatibility = state.importCompatibility || summary.compatibility || { status: 'corrupt', canImport: false }
    const compatibilityDetails = portableCompatibilityDetails[compatibility.status] || portableCompatibilityDetails.corrupt
    if (compatibility.status === 'future') return <section className="portable-version-guard is-future" data-testid="portable-future-version">
      <span className="portable-version-guard__icon"><Icon name="clock" size={34} /></span>
      <small>{compatibilityDetails.eyebrow}</small><h3>{compatibilityDetails.title}</h3><p>{compatibilityDetails.description}</p>
      <div className="portable-version-readonly"><p><span>便携项目</span><strong title={summary.bundleName}>{summary.bundleName}</strong></p><p><span>项目名称</span><strong title={summary.projectName}>{summary.projectName}</strong></p><p><span>来源应用</span><strong>{compatibility.sourceAppVersion || '未记录'}</strong></p><p><span>格式版本</span><strong>Manifest V{compatibility.sourceVersion}</strong></p></div>
      <label><Icon name="shield" size={15} />未读取项目正文或媒体，未写入本机目录，来源文件保持不变。</label>
      <p className="portable-version-guard__advice">请使用支持 Manifest V{compatibility.sourceVersion} 的更新版本“星幕工坊”。</p>
      <footer><button type="button" className="secondary-button" onClick={onClose}>关闭</button><button ref={futureReselectRef} type="button" className="primary-button" onClick={chooseImport}>重新选择</button></footer>
    </section>
    if (compatibility.status === 'corrupt') return <section className="portable-version-guard is-corrupt" data-testid="portable-corrupt-version">
      <span className="portable-version-guard__icon"><Icon name="warning" size={34} /></span>
      <small>{compatibilityDetails.eyebrow}</small><h3>{compatibilityDetails.title}</h3><p>{compatibility.errorMessage || compatibilityDetails.description}</p>
      <code>{compatibility.errorCode || 'MANIFEST_INVALID'}</code>
      <label><Icon name="shield" size={15} />未导入项目、未复制媒体、未修改来源文件。</label>
      <footer><button type="button" className="secondary-button" onClick={onClose}>关闭</button><button type="button" className="primary-button" onClick={chooseImport}>重新选择</button></footer>
    </section>
    const nameValidation = validatePortableImportName(state.importName)
    const migratable = compatibility.status === 'migratable'
    const importLabel = migratable ? '迁移并导入副本' : '作为新副本导入'
    return <section className="storage-migration-review portable-import-compatibility" data-testid="portable-import-review">
      <div className={`portable-compatibility-banner is-${compatibilityDetails.tone}`} data-testid={`portable-compatibility-${compatibility.status}`}><span><Icon name={compatibilityDetails.icon} size={21} /></span><div><small>{compatibilityDetails.eyebrow}</small><h3>{compatibilityDetails.title}</h3><p>{compatibilityDetails.description}</p></div><b>{migratable ? `V${compatibility.sourceVersion} → V${compatibility.targetVersion}` : compatibilityDetails.badge}</b></div>
      <div className="portable-compatibility-grid">
        <article className="portable-package-summary"><header><span><Icon name="database" size={20} /></span><div><small>PROJECT AND MEDIA</small><strong title={summary.bundleName}>{summary.bundleName}</strong></div></header><p>{summary.videoAssetCount} 个镜头视频 · {formatPortabilityBytes(summary.totalBytes)} · 来源应用 {summary.appVersion || '未记录'}</p><div><span><small>项目文件</small><b>{formatPortabilityBytes(summary.projectBytes)}</b></span><span><small>托管视频</small><b>{summary.videoAssetCount} 个</b></span><span><small>完整性</small><b>{summary.complete ? '已验证' : '有缺失'}</b></span></div><ul><li><Icon name="check" size={13} />项目 SHA-256 已验证</li><li><Icon name="check" size={13} />媒体大小与哈希已验证</li><li><Icon name="check" size={13} />始终导入为新副本</li></ul></article>
        <article className="portable-migration-plan"><header><div><small>{migratable ? 'MIGRATION PLAN' : 'CURRENT VALIDATION'}</small><strong>{migratable ? 'V1 → V2 安全迁移' : 'Manifest V2 可直接导入'}</strong></div>{migratable && <button ref={migrationDetailButtonRef} type="button" className="secondary-button" onClick={() => setState((current) => ({ ...current, migrationDetailsOpen: true }))}>查看迁移详情</button>}</header><ol>{migratable ? [...compatibility.requiredSteps, { id: 'import-copy', label: '复制真实媒体并创建新副本' }].map((step, index) => <li key={step.id}><span>{index + 1}</span><p><strong>{step.label}</strong><small>{index < compatibility.requiredSteps.length ? '内存副本处理并再次校验' : '通过 pending 目录原子提交'}</small></p></li>) : <><li><span><Icon name="check" size={12} /></span><p><strong>必需能力均受支持</strong><small>完整性、托管视频、导入为副本</small></p></li><li><span><Icon name="check" size={12} /></span><p><strong>项目与媒体结构兼容</strong><small>project schema 1 · media schema 1</small></p></li><li><span><Icon name="shield" size={12} /></span><p><strong>来源保持只读</strong><small>导入不会回写便携项目</small></p></li></>}</ol>{compatibility.unknownOptionalFeatures?.length > 0 && <p className="portable-optional-features">未知可选能力：{compatibility.unknownOptionalFeatures.join('、')}；已忽略并继续。</p>}</article>
      </div>
      {summary.missingAssets.length > 0 && <p className="storage-migration-alert is-warning"><Icon name="warning" size={15} />此副本缺少 {summary.missingAssets.length} 个媒体文件，相关镜头会安全回退。</p>}
      <label className="storage-migration-name"><span>新副本名称</span><input value={state.importName} maxLength={80} onChange={(event) => setState((current) => ({ ...current, importName: event.target.value, error: '' }))} aria-invalid={!nameValidation.ok} /><small>{nameValidation.ok ? '将创建新的本地项目标识，不覆盖任何现有项目。' : nameValidation.error}</small></label>
      <footer><span><Icon name="shield" size={14} />原始便携包不会修改</span><div><button type="button" className="secondary-button" onClick={chooseImport}>重新选择</button><button type="button" className="primary-button" disabled={!nameValidation.ok} onClick={runImport}><Icon name="download" size={15} />{importLabel}</button></div></footer>
    </section>
  }

  const renderCleanup = () => {
    if (state.result?.type === 'cleanup') return <section className="storage-migration-result is-success" data-testid="managed-media-cleanup-result">
      <span><Icon name="trash" size={30} /></span><h3>安全清理已完成</h3><p>已将 <strong>{state.result.trashed}</strong> 个托管媒体目录移入 Windows 回收站；失败 {state.result.failed} 项，状态变化跳过 {state.result.skipped} 项。</p>
      <p className="storage-migration-alert is-safe"><Icon name="shield" size={15} />文件仍可从 Windows 回收站恢复，项目内正在使用和恢复点保护的媒体未处理。</p>
      <div><button type="button" className="secondary-button" onClick={scanManagedMedia}><Icon name="refresh" size={14} />重新扫描</button><button type="button" className="primary-button" onClick={onClose}>完成</button></div>
    </section>
    if (!state.cleanupSummary) return <section className="storage-migration-empty">
      <span><Icon name="database" size={28} /></span><h3>扫描本机托管媒体</h3><p>应用会比对当前项目、自动保存、全部时间线恢复点和正在运行的媒体任务，仅把确定未引用的目录标为可清理。</p>
      <ul><li>未知文件与异常目录始终保留</li><li>写入任务进行时禁止清理</li><li>确认后只移入 Windows 回收站</li></ul>
      <button type="button" className="primary-button" onClick={scanManagedMedia}><Icon name="refresh" size={16} />开始安全扫描</button>
    </section>
    const summary = state.cleanupSummary
    return <section className="storage-cleanup-review" data-testid="managed-media-cleanup-review">
      <header><div><small>REFERENCE SAFE SCAN</small><h3>托管媒体扫描结果</h3></div><button type="button" className="secondary-button" onClick={scanManagedMedia}><Icon name="refresh" size={14} />重新扫描</button></header>
      <div className="storage-cleanup-summary"><article><span className="is-safe" /><small>正在使用</small><strong>{summary.inUse}</strong></article><article><span className="is-protected" /><small>恢复点保护</small><strong>{summary.protected}</strong></article><article><span className="is-eligible" /><small>可安全清理</small><strong>{summary.eligible}</strong></article><article><span className="is-unknown" /><small>保留/未知</small><strong>{summary.pending + summary.unknown}</strong></article></div>
      <div className="storage-cleanup-list" role="table" aria-label="托管媒体扫描结果">
        <div className="storage-cleanup-row is-header" role="row"><span /><span>文件</span><span>状态</span><span>大小</span></div>
        {state.cleanupRecords.length ? state.cleanupRecords.map((record) => {
          const details = managedMediaStatusDetails[record.status] || managedMediaStatusDetails.unknown
          return <label className={`storage-cleanup-row is-${details.tone}`} role="row" key={record.assetId}><span><input type="checkbox" disabled={!record.selectable} checked={state.cleanupSelection.includes(record.assetId)} onChange={(event) => setState((current) => ({ ...current, cleanupSelection: event.target.checked ? [...current.cleanupSelection, record.assetId] : current.cleanupSelection.filter((id) => id !== record.assetId) }))} aria-label={`选择 ${record.fileName}`} /></span><span><strong title={record.fileName}>{record.fileName}</strong><small>{record.assetId}</small></span><span><b>{details.label}</b><small>{record.reason || details.description}</small></span><span>{formatPortabilityBytes(record.bytes)}</span></label>
        }) : <div className="storage-cleanup-empty">当前项目没有本机托管镜头视频。</div>}
      </div>
      <footer><span>已选择 <strong>{state.cleanupSelection.length}</strong> 项 · {formatPortabilityBytes(selectedCleanupBytes)}</span><button type="button" className="storage-danger-button" disabled={!state.cleanupSelection.length} onClick={() => setState((current) => ({ ...current, cleanupConfirm: true }))}><Icon name="trash" size={15} />移入 Windows 回收站</button></footer>
    </section>
  }

  return <div className="storage-migration-layer" role="presentation" onMouseDown={(event) => { if (!state.busy && event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="storage-migration-dialog" role="dialog" aria-modal="true" aria-labelledby="storage-migration-title" aria-describedby="storage-migration-description">
      <header className="storage-migration-header"><span><Icon name="database" size={23} /></span><div><small>PROJECT STORAGE CENTER</small><h2 id="storage-migration-title">项目迁移与存储管理</h2><p id="storage-migration-description">真实项目数据、本机托管媒体与可恢复清理</p></div><button ref={closeRef} type="button" aria-label={state.busy ? '取消当前操作' : '关闭项目迁移与存储管理'} onClick={() => state.busy ? projectPortabilityRepository.cancel() : onClose()}><Icon name="close" size={18} /></button></header>
      <nav className="storage-migration-tabs" aria-label="存储管理分类"><button type="button" className={state.tab === 'portability' ? 'is-active' : ''} onClick={() => switchTab('portability')}><Icon name="export" size={15} />便携项目</button><button type="button" className={state.tab === 'cleanup' ? 'is-active' : ''} onClick={() => switchTab('cleanup')}><Icon name="trash" size={15} />空间清理</button></nav>
      {state.tab === 'portability' && <div className="storage-migration-mode" aria-label="便携项目操作"><button type="button" className={state.mode === 'export' ? 'is-active' : ''} onClick={() => setMode('export')}><Icon name="export" size={15} />导出</button><button type="button" className={state.mode === 'import' ? 'is-active' : ''} onClick={() => setMode('import')}><Icon name="download" size={15} />导入</button></div>}
      <div className="storage-migration-content">{renderProgress()}{!state.busy && (state.tab === 'cleanup' ? renderCleanup() : state.mode === 'import' ? renderImport() : renderExport())}{state.error && <p className="storage-migration-error" role="alert"><Icon name="warning" size={15} />{state.error}</p>}</div>
      <footer className="storage-migration-footnote"><Icon name="shield" size={14} /><span>全部操作仅在本机执行；不联网、不调用 AI、不消耗任何额度。</span></footer>
      {state.migrationDetailsOpen && <div className="portable-migration-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setState((current) => ({ ...current, migrationDetailsOpen: false })) }}><aside ref={migrationDrawerRef} className="portable-migration-drawer" role="dialog" aria-modal="true" aria-labelledby="portable-migration-drawer-title"><header><div><small>MIGRATION DETAILS</small><h3 id="portable-migration-drawer-title">V1 → V2 迁移详情</h3></div><button ref={migrationDrawerCloseRef} type="button" aria-label="关闭迁移详情" onClick={() => { setState((current) => ({ ...current, migrationDetailsOpen: false })); requestAnimationFrame(() => migrationDetailButtonRef.current?.focus()) }}><Icon name="close" size={17} /></button></header><div className="portable-migration-drawer__body">{portableMigrationDetailGroups.map((group) => <section key={group.title}><h4>{group.title}</h4>{group.items.map((item) => <p key={item}><Icon name="check" size={13} /><span>{item}</span></p>)}</section>)}<section><h4>验证顺序</h4>{(state.importCompatibility?.requiredSteps || []).map((step, index) => <p key={step.id}><b>{index + 1}</b><span>{step.label}</span></p>)}</section></div><footer><Icon name="shield" size={15} />原始便携包不会修改</footer></aside></div>}
    </section>
    {state.cleanupConfirm && <div className="storage-cleanup-confirm-layer" role="presentation"><section className="storage-cleanup-confirm" role="alertdialog" aria-modal="true" aria-labelledby="storage-cleanup-confirm-title"><header><span><Icon name="warning" size={22} /></span><div><small>FINAL SAFETY CHECK</small><h3 id="storage-cleanup-confirm-title">将 {state.cleanupSelection.length} 项移入 Windows 回收站？</h3></div></header><p>操作前会再次读取当前项目、自动保存和全部恢复点。只有仍然未被引用的媒体才会移动；状态已变化的项目会自动跳过。</p><div><strong>{formatPortabilityBytes(selectedCleanupBytes)}</strong><span>预计可释放空间</span></div><label><Icon name="shield" size={15} /><span>文件不会永久删除，可在 Windows 回收站中恢复。</span></label><footer><button ref={cleanupCancelRef} type="button" className="secondary-button" onClick={() => setState((current) => ({ ...current, cleanupConfirm: false }))}>取消</button><button type="button" className="storage-danger-button" onClick={runCleanup}><Icon name="trash" size={15} />确认移入回收站</button></footer></section></div>}
  </div>
}

function AssetLibraryPage({
  projectSnapshot,
  episodes,
  scenes,
  characters,
  shots,
  lines,
  videoAssets,
  audioTracks,
  onImportRoute,
  onLocateReference,
  onReplaceAsset,
  onRemoveAsset,
  onOpenStorageMigration,
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [health, setHealth] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('grid')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [checkedAssetIds, setCheckedAssetIds] = useState([])
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [pendingReplace, setPendingReplace] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [shotVideoHealth, setShotVideoHealth] = useState({})

  const assets = useMemo(() => buildAssetLibraryIndex({ episodes, scenes, characters, shots, lines, videoAssets, shotVideoHealth, audioTracks }), [episodes, scenes, characters, shots, lines, videoAssets, shotVideoHealth, audioTracks])
  const summary = useMemo(() => summarizeAssetLibrary(assets), [assets])
  const filteredAssets = useMemo(() => filterAssetLibraryIndex(assets, { query, kind, health, sort }), [assets, query, kind, health, sort])
  const projectBytes = useMemo(() => getProjectSnapshotByteSize(projectSnapshot), [projectSnapshot])
  const projectPercent = Math.min(100, (projectBytes / maximumProjectBytes) * 100)
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null
  const checkedAssets = assets.filter((asset) => checkedAssetIds.includes(asset.id))

  useEffect(() => {
    let active = true
    const assetIds = videoAssets.map((asset) => asset.id)
    if (!assetIds.length) {
      setShotVideoHealth({})
      return () => { active = false }
    }
    shotVideoAssetRepository.check(projectSnapshot.project.localProjectId, assetIds).then((result) => {
      if (active && result.ok) setShotVideoHealth(result.assets || {})
    }).catch(() => undefined)
    return () => { active = false }
  }, [projectSnapshot.project.localProjectId, videoAssets])

  useEffect(() => {
    setSelectedAssetId((current) => filteredAssets.some((asset) => asset.id === current) ? current : filteredAssets[0]?.id || '')
  }, [filteredAssets])

  useEffect(() => {
    setCheckedAssetIds((current) => current.filter((id) => assets.some((asset) => asset.id === id)))
  }, [assets])

  const toggleCheckedAsset = (assetId) => setCheckedAssetIds((current) => current.includes(assetId)
    ? current.filter((id) => id !== assetId)
    : [...current, assetId])

  const startReplace = (asset, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || asset.readOnly) return
    setPendingReplace({ asset, file })
  }

  const confirmReplace = async () => {
    if (!pendingReplace || actionBusy) return
    setActionBusy(true)
    const result = await onReplaceAsset(pendingReplace.asset, pendingReplace.file)
    setActionBusy(false)
    if (result?.ok) setPendingReplace(null)
  }

  const confirmRemove = async () => {
    if (!pendingRemove || actionBusy) return
    setActionBusy(true)
    const result = await onRemoveAsset(pendingRemove)
    setActionBusy(false)
    if (result?.ok) {
      setPendingRemove(null)
      setSelectedAssetId('')
    }
  }

  const chooseImportRoute = (page) => {
    setImportMenuOpen(false)
    onImportRoute(page)
  }

  const renderAssetCard = (asset) => {
    const healthDetails = assetHealthDetails[asset.health]
    return (
      <article className={`asset-card ${selectedAssetId === asset.id ? 'is-selected' : ''} is-${asset.health}`} key={asset.id}>
        <label className="asset-card__check" title="选择素材">
          <input type="checkbox" checked={checkedAssetIds.includes(asset.id)} onChange={() => toggleCheckedAsset(asset.id)} aria-label={`选择${asset.name}`} />
          <span />
        </label>
        <span className={`asset-health-badge is-${asset.health}`}><Icon name={healthDetails.icon} size={11} />{healthDetails.label}</span>
        <button type="button" className="asset-card__open" onClick={() => setSelectedAssetId(asset.id)} aria-label={`查看${asset.name}详情`}>
          <div className="asset-card__preview"><AssetPreview asset={asset} /></div>
          <div className="asset-card__body">
            <strong title={asset.name}>{asset.name}</strong>
            <p title={asset.description}>{asset.description || asset.categoryLabel}</p>
            <footer><span>{asset.categoryLabel}</span><span>{formatAssetBytes(asset.estimatedBytes)}</span></footer>
          </div>
        </button>
      </article>
    )
  }

  const renderAssetRow = (asset) => {
    const healthDetails = assetHealthDetails[asset.health]
    return (
      <div className={`asset-table__row ${selectedAssetId === asset.id ? 'is-selected' : ''}`} role="row" key={asset.id}>
        <label><input type="checkbox" checked={checkedAssetIds.includes(asset.id)} onChange={() => toggleCheckedAsset(asset.id)} aria-label={`选择${asset.name}`} /></label>
        <button type="button" className="asset-table__preview" onClick={() => setSelectedAssetId(asset.id)} aria-label={`查看${asset.name}`}><AssetPreview asset={asset} compact /></button>
        <button type="button" className="asset-table__name" onClick={() => setSelectedAssetId(asset.id)}><strong>{asset.name}</strong><small>{asset.fileName || '未记录原文件名'}</small></button>
        <span>{asset.categoryLabel}</span>
        <span title={asset.description}>{asset.description || '当前项目'}</span>
        <span>{asset.references.length} 处</span>
        <span>{formatAssetBytes(asset.estimatedBytes)}</span>
        <span className={`asset-health-text is-${asset.health}`}><Icon name={healthDetails.icon} size={12} />{healthDetails.label}</span>
      </div>
    )
  }

  return (
    <main className="page project-page asset-library-page">
      <header className="asset-library-heading">
        <div><span className="asset-library-heading__icon"><Icon name="folder" size={22} /></span><div><h1>素材库</h1><p>统一管理当前项目中的真实图片、视频与音频素材</p></div></div>
        <section className={`glass asset-storage-card ${projectPercent >= 90 ? 'is-danger' : projectPercent >= 70 ? 'is-warning' : ''}`} aria-label="项目容量">
          <header><span>项目容量</span><button type="button" className="asset-storage-card__manage" onClick={() => onOpenStorageMigration('export')}><Icon name="database" size={13} />迁移与清理</button><strong>{formatAssetBytes(projectBytes)} / 10 MB</strong></header>
          <i><b style={{ width: `${projectPercent}%` }} /></i>
          <footer><span>{summary.total} 个真实素材</span><span>项目内 {formatAssetBytes(summary.totalBytes)}</span><span>本机托管 {formatAssetBytes(summary.managedBytes)}</span></footer>
        </section>
      </header>

      <section className="glass asset-toolbar">
        <label className="asset-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索素材名称、角色、场景或台词" aria-label="搜索素材" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清空素材搜索"><Icon name="close" size={13} /></button>}</label>
        <div className="asset-import-menu">
          <button type="button" className="primary-button" onClick={() => setImportMenuOpen((current) => !current)} aria-expanded={importMenuOpen}><Icon name="upload" size={16} />导入素材<Icon name="chevron" size={13} /></button>
          {importMenuOpen && <div className="asset-import-popover">
            <strong>选择真实素材的归属位置</strong>
            <button type="button" onClick={() => chooseImportRoute('character')}><Icon name="users" size={16} /><span>角色参考图<small>进入角色页选择角色</small></span></button>
            <button type="button" onClick={() => chooseImportRoute('storyboard')}><Icon name="image" size={16} /><span>分镜图片<small>进入分镜页选择镜头</small></span></button>
            <button type="button" onClick={() => chooseImportRoute('voice')}><Icon name="mic" size={16} /><span>角色配音<small>进入配音页选择台词</small></span></button>
            <button type="button" onClick={() => chooseImportRoute('final')}><Icon name="video" size={16} /><span>镜头视频<small>进入成片页选择镜头</small></span></button>
            <button type="button" onClick={() => chooseImportRoute('final')}><Icon name="volume" size={16} /><span>背景音乐或音效<small>进入成片时间线导入</small></span></button>
          </div>}
        </div>
        <label className="asset-sort-select"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="素材排序"><option value="recent">最近使用</option><option value="name">按名称</option><option value="type">按类型</option><option value="size-desc">按大小降序</option></select><Icon name="chevron" size={14} /></label>
        <div className="asset-view-toggle" aria-label="素材视图">
          <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} title="卡片视图" aria-label="卡片视图"><Icon name="grid" size={16} /></button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} title="列表视图" aria-label="列表视图"><Icon name="list" size={16} /></button>
        </div>
        <span className="asset-result-count">共 <strong>{filteredAssets.length}</strong> 个真实素材</span>
      </section>

      <section className="asset-library-workspace">
        <aside className="glass asset-filter-sidebar">
          <h2>素材分类</h2>
          <div className="asset-filter-list">{assetCategoryOptions.map((option) => <button type="button" key={option.id} className={kind === option.id ? 'is-active' : ''} onClick={() => setKind(option.id)}><Icon name={option.icon} size={16} /><span>{option.label}</span><b>{option.id === 'all' ? summary.total : summary.byKind[option.id]}</b></button>)}</div>
          <h2>素材状态</h2>
          <div className="asset-health-filter">{assetHealthOptions.map((option) => <button type="button" key={option.id} className={health === option.id ? 'is-active' : ''} onClick={() => setHealth(option.id)}><i className={`is-${option.id}`} /><span>{option.label}</span>{option.id !== 'all' && <b>{summary.byHealth[option.id]}</b>}</button>)}</div>
          <div className="asset-source-note"><Icon name="shield" size={18} /><div><strong>仅真实用户素材</strong><p>不生成模拟缩略图、波形或配音。</p></div></div>
        </aside>

        <section className="glass asset-collection">
          <header><div><h2>{assetCategoryOptions.find((option) => option.id === kind)?.label}</h2><p>{query ? `搜索“${query}”` : '当前项目素材'}</p></div><span>{filteredAssets.length} / {summary.total}</span></header>
          {filteredAssets.length ? view === 'grid' ? <div className="asset-grid">{filteredAssets.map(renderAssetCard)}</div> : <div className="asset-table" role="table" aria-label="素材列表">
            <div className="asset-table__header" role="row"><span /><span>预览</span><span>名称</span><span>类型</span><span>来源</span><span>使用</span><span>大小</span><span>状态</span></div>
            {filteredAssets.map(renderAssetRow)}
          </div> : <div className="asset-empty-state"><span><Icon name={query ? 'search' : 'folder'} size={32} /></span><h2>{query ? '没有找到匹配的真实素材' : assets.length ? '当前分类暂无素材' : '暂无真实素材'}</h2><p>{query ? '请尝试其他名称、角色、场景或台词。' : '从角色、分镜、配音或成片页面导入后，会自动汇总到这里。'}</p><div>{query ? <button type="button" className="secondary-button" onClick={() => { setQuery(''); setKind('all'); setHealth('all') }}>清除筛选</button> : <><button type="button" className="primary-button" onClick={() => setImportMenuOpen(true)}><Icon name="upload" size={16} />导入素材</button><button type="button" className="secondary-button" onClick={() => onImportRoute('character')}>前往角色设定</button></>}</div></div>}
          {checkedAssets.length > 0 && <div className="asset-bulk-bar"><span><Icon name="check" size={15} />已选择 <strong>{checkedAssets.length}</strong> 项</span><button type="button" onClick={() => setCheckedAssetIds([])}>取消选择</button><button type="button" onClick={() => setSelectedAssetId(checkedAssets[0].id)}>查看首项</button><button type="button" disabled={checkedAssets.some((asset) => asset.readOnly || asset.references.length > 0)} title="只有未引用且非旧版只读的素材可以直接批量清理"><Icon name="trash" size={14} />清理未使用素材</button></div>}
        </section>

        <aside className="glass asset-inspector">
          {selectedAsset ? <>
            <header><div><span>{selectedAsset.categoryLabel}</span><h2 title={selectedAsset.name}>{selectedAsset.name}</h2></div><span className={`asset-health-badge is-${selectedAsset.health}`}><Icon name={assetHealthDetails[selectedAsset.health].icon} size={11} />{assetHealthDetails[selectedAsset.health].label}</span></header>
            <div className="asset-inspector__preview"><AssetPreview asset={selectedAsset} />{selectedAsset.mediaType === 'audio' && selectedAsset.health === 'ready' && <audio controls preload="metadata" src={selectedAsset.dataUrl}>当前环境不支持音频试听</audio>}{selectedAsset.mediaType === 'video' && selectedAsset.health === 'ready' && selectedAsset.mediaUrl && <video controls muted playsInline preload="metadata" src={selectedAsset.mediaUrl}>当前环境不支持视频预览</video>}</div>
            <section className="asset-metadata"><h3>文件信息</h3><dl><div><dt>文件名</dt><dd title={selectedAsset.fileName}>{selectedAsset.fileName || '未记录原文件名'}</dd></div><div><dt>格式</dt><dd>{selectedAsset.mimeType || '无法识别'}</dd></div><div><dt>大小</dt><dd>{formatAssetBytes(selectedAsset.estimatedBytes)}</dd></div><div><dt>来源</dt><dd>{selectedAsset.source === 'local' ? '用户本地导入' : selectedAsset.source || '未记录'}</dd></div><div><dt>更新时间</dt><dd>{formatAssetUpdatedAt(selectedAsset.updatedAt)}</dd></div></dl></section>
            <section className="asset-references"><header><h3>使用位置</h3><span>{selectedAsset.references.length} 处</span></header>{selectedAsset.references.length ? selectedAsset.references.map((reference) => <button type="button" key={reference.id} onClick={() => onLocateReference(reference)}><span><i>{reference.type}</i><strong>{reference.title}</strong></span><Icon name="arrow" size={14} /></button>) : <p>当前素材没有被项目内容引用。</p>}</section>
            {selectedAsset.readOnly && <p className="asset-legacy-readonly"><Icon name="lock" size={14} />旧版全项目成片素材仅供查看、试听与导出，不会写入任何分集。</p>}
            {selectedAsset.error && <p className="asset-error-message"><Icon name="warning" size={14} />{selectedAsset.error}</p>}
            <footer className="asset-inspector__actions">
              <button type="button" className="primary-button" disabled={!selectedAsset.references.length} onClick={() => onLocateReference(selectedAsset.references[0])}><Icon name="arrow" size={15} />定位到使用处</button>
              <div>{selectedAsset.mediaType === 'video' ? <><button type="button" className="secondary-button" onClick={() => onImportRoute('final')}><Icon name="upload" size={14} />重新定位</button><button type="button" className="secondary-button" disabled={selectedAsset.health !== 'ready'} onClick={() => shotVideoAssetRepository.reveal(projectSnapshot.project.localProjectId, selectedAsset.entityId)}><Icon name="folder" size={14} />打开位置</button></> : <><label className={`secondary-button ${selectedAsset.readOnly ? 'is-disabled' : ''}`} aria-disabled={selectedAsset.readOnly}><Icon name={selectedAsset.readOnly ? 'lock' : 'upload'} size={14} />{selectedAsset.readOnly ? '旧版只读' : '替换'}{!selectedAsset.readOnly && <input type="file" accept={selectedAsset.mediaType === 'image' ? 'image/*' : 'audio/*'} onChange={(event) => startReplace(selectedAsset, event)} />}</label>{selectedAsset.health === 'ready' && <a className="secondary-button" href={selectedAsset.dataUrl} download={selectedAsset.fileName || `${selectedAsset.name}.${selectedAsset.mediaType === 'image' ? 'png' : 'wav'}`}><Icon name="export" size={14} />另存</a>}</>}<button type="button" className="secondary-button delete-action" disabled={selectedAsset.readOnly} onClick={() => setPendingRemove(selectedAsset)}><Icon name={selectedAsset.readOnly ? 'lock' : 'trash'} size={14} />{selectedAsset.readOnly ? '不可移除' : selectedAsset.mediaType === 'video' ? '解除引用' : '移除'}</button></div>
            </footer>
          </> : <div className="asset-inspector-empty"><span><Icon name="image" size={30} /></span><h2>选择一个素材</h2><p>查看真实文件信息、使用位置和安全操作。</p></div>}
        </aside>
      </section>

      {pendingReplace && <div className="asset-dialog-layer" role="presentation"><section className="glass asset-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-replace-title"><header><span><Icon name="upload" size={19} /></span><div><h2 id="asset-replace-title">确认替换素材</h2><p>所有使用此素材的位置将同步更新。</p></div></header><div className="asset-replace-summary"><div><small>当前素材</small><strong>{pendingReplace.asset.fileName || pendingReplace.asset.name}</strong><span>{formatAssetBytes(pendingReplace.asset.estimatedBytes)}</span></div><Icon name="arrow" size={20} /><div><small>新素材</small><strong>{pendingReplace.file.name}</strong><span>{formatAssetBytes(pendingReplace.file.size)}</span></div></div><section><strong>将影响 {pendingReplace.asset.references.length} 个使用位置</strong>{pendingReplace.asset.references.map((reference) => <p key={reference.id}>{reference.title}</p>)}</section><footer><button type="button" className="secondary-button" disabled={actionBusy} onClick={() => setPendingReplace(null)}>取消</button><button type="button" className="primary-button" disabled={actionBusy} onClick={confirmReplace}>{actionBusy ? '正在替换…' : '确认替换'}</button></footer></section></div>}
      {pendingRemove && <div className="asset-dialog-layer" role="presentation"><section className="glass asset-confirm-dialog asset-confirm-dialog--danger" role="dialog" aria-modal="true" aria-labelledby="asset-remove-title"><header><span><Icon name="warning" size={19} /></span><div><h2 id="asset-remove-title">{pendingRemove.mediaType === 'video' ? '解除镜头视频引用？' : '移除真实素材？'}</h2><p>{pendingRemove.mediaType === 'video' ? '镜头将回退到原分镜图，本机托管副本不会删除。' : pendingRemove.kind === 'bgm' || pendingRemove.kind === 'sfx' ? '对应时间线音轨会被移除。' : '业务实体会保留并回到未完成状态。'}</p></div></header><section><strong>{pendingRemove.name}</strong><p>当前正在 {pendingRemove.references.length} 个位置使用：</p>{pendingRemove.references.map((reference) => <p key={reference.id}>{reference.title}</p>)}</section><footer><button type="button" className="secondary-button" disabled={actionBusy} onClick={() => setPendingRemove(null)}>取消</button><button type="button" className="primary-button asset-danger-button" disabled={actionBusy} onClick={confirmRemove}>{actionBusy ? '正在处理…' : pendingRemove.mediaType === 'video' ? '解除引用' : '移除素材'}</button></footer></section></div>}
    </main>
  )
}

const emptyShotVideoItem = Object.freeze({})

function ShotVideoRequestDialog({ item, nextItem, episode, scene, providerConfig, bailianStatus, onClose, onOpenSettings, returnFocusRef }) {
  const modalRef = useRef(null)
  const closeRef = useRef(null)
  const shot = item?.shot || emptyShotVideoItem
  const nextShot = nextItem?.shot || emptyShotVideoItem
  const nextFrameAvailable = isShotVideoFrameDataUrl(nextShot.image)
  const [prompt, setPrompt] = useState(() => createShotVideoPromptDraft(shot) || createShotVideoDirectorPrompt({ shot, nextShot, episode, scene }))
  const [negativePrompt, setNegativePrompt] = useState('')
  const [mode, setMode] = useState(shotVideoModeOptions[0].value)
  const [resolution, setResolution] = useState(shotVideoResolutionOptions[0].value)
  const [duration, setDuration] = useState(() => mapShotVideoDuration(shot.duration).apiDuration)
  const [promptExtend, setPromptExtend] = useState(false)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState('')
  const preview = useMemo(() => createShotVideoRequestPreview({
    shot,
    nextShot,
    prompt,
    negativePrompt,
    mode,
    resolution,
    duration,
    promptExtend,
    watermark,
    seed,
    providerConfig,
    bailianStatus,
  }), [bailianStatus, duration, mode, negativePrompt, nextShot, prompt, promptExtend, providerConfig, resolution, seed, shot, watermark])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled), summary') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => () => {
    window.setTimeout(() => returnFocusRef?.current?.focus({ preventScroll: true }), 0)
  }, [returnFocusRef])

  const keyStatus = bailianStatus.loading
    ? '正在读取本地状态'
    : !bailianStatus.ok
      ? bailianStatus.error || '状态读取失败'
      : preview.configured
        ? '本地 Key 已接入'
        : '未找到本地 Key'
  const generationStatus = preview.paidGenerationEnabled ? '视频执行器未开放' : '付费生成已锁定'
  const rebuildPrompt = () => setPrompt(createShotVideoDirectorPrompt({ shot, nextShot, episode, scene }))
  const shotNumber = Number(item?.index || 0) + 1
  const nextShotNumber = Number(nextItem?.index || 0) + 1
  const nextFrameCrossesScene = nextFrameAvailable
    && Boolean(shot.sceneId)
    && Boolean(nextShot.sceneId)
    && String(shot.sceneId) !== String(nextShot.sceneId)

  return (
    <div className="shot-video-api-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section ref={modalRef} id="shot-video-api-dialog" className="shot-video-api-dialog" role="dialog" aria-modal="true" aria-labelledby="shot-video-api-title" aria-describedby="shot-video-api-description">
        <header className="shot-video-api-header">
          <span><Icon name="video" size={23} /></span>
          <div><small>SHOT VIDEO REQUEST</small><h2 id="shot-video-api-title">AI 视频请求预览</h2><p id="shot-video-api-description">镜头 {String(shotNumber).padStart(2, '0')} · {item?.sceneTitle || scene?.title || '未命名场景'} · 只使用当前真实时间线数据</p></div>
          <button ref={closeRef} type="button" className="shot-video-api-close" aria-label="关闭 AI 视频请求预览" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="shot-video-api-status-grid" aria-label="视频服务状态">
          <article><small>视频服务</small><strong>{preview.provider}</strong><span>{preview.endpoint || '服务地址由设置页管理'}</span></article>
          <article><small>模型</small><strong>{preview.model}</strong><span>万相 2.7 图生视频</span></article>
          <article data-tone={preview.configured ? 'ready' : 'warning'}><small>Key 状态</small><strong>{keyStatus}</strong><span>Key 不会显示或写入项目</span></article>
          <article data-tone="locked"><small>调用状态</small><strong>{generationStatus}</strong><span>任务 0 · 上传 0 · 预计消耗 0</span></article>
        </div>

        <div className="shot-video-api-workspace">
          <section className="shot-video-api-frames">
            <header><div><small>REAL MEDIA</small><h3>首帧与尾帧</h3></div><span>{preview.mediaCount} 个请求素材</span></header>
            <div className="shot-video-api-frame-flow">
              <article className="is-ready"><span>首帧 · 必需</span><img src={shot.image} alt={`镜头 ${shotNumber} 的真实首帧`} /><small>{shot.imageFileName || `镜头 ${String(shotNumber).padStart(2, '0')} 本地图片`}</small></article>
              <i><Icon name="arrow" size={18} /></i>
              <article className={nextFrameAvailable ? 'is-ready' : 'is-empty'}><span>尾帧 · 可选</span>{nextFrameAvailable ? <img src={nextShot.image} alt={`镜头 ${nextShotNumber} 的可选真实尾帧`} /> : <div><Icon name="image" size={24} /><strong>没有真实尾帧</strong></div>}<small>{nextFrameAvailable ? nextShot.imageFileName || `镜头 ${String(nextShotNumber).padStart(2, '0')} 本地图片` : '当前保持首帧模式'}</small></article>
            </div>
            {nextFrameCrossesScene && <p className="shot-video-api-cross-scene"><Icon name="warning" size={13} />下一镜头跨场景，请谨慎作为尾帧。</p>}
            {!nextFrameAvailable && <p className="shot-video-api-frame-note"><Icon name="check" size={12} />下一镜头没有真实图片，首帧模式仍可预览。</p>}
          </section>

          <section className="shot-video-api-prompts">
            <label><span>导演提示词 <small>{Array.from(prompt).length} / {maximumShotVideoPromptCharacters}</small></span><textarea className="shot-video-api-prompt" value={prompt} maxLength={maximumShotVideoPromptCharacters} onChange={(event) => setPrompt(event.target.value)} aria-label="AI 视频导演提示词" placeholder="请填写当前镜头的动态、运镜和连续性要求" spellCheck="false" /></label>
            <button type="button" className="secondary-button shot-video-api-rebuild" onClick={rebuildPrompt}><Icon name="spark" size={14} />使用当前镜头重建</button>
            <label><span>不希望出现的画面 <small>{Array.from(negativePrompt).length} / {maximumShotVideoNegativePromptCharacters}</small></span><textarea className="shot-video-api-negative-prompt" value={negativePrompt} maxLength={maximumShotVideoNegativePromptCharacters} onChange={(event) => setNegativePrompt(event.target.value)} aria-label="AI 视频反向提示词" placeholder="可选，例如：人物变形、低清晰度" spellCheck="false" /></label>
          </section>
        </div>

        <section className="shot-video-api-parameters" aria-label="AI 视频请求参数">
          <label><span>模式</span><select value={mode} onChange={(event) => setMode(event.target.value)}>{shotVideoModeOptions.map((option) => <option value={option.value} key={option.value} disabled={option.value === 'first-last' && !nextFrameAvailable}>{option.label}{option.value === 'first-last' && !nextFrameAvailable ? ' · 缺少尾帧' : ''}</option>)}</select></label>
          <label><span>分辨率</span><select value={resolution} onChange={(event) => setResolution(event.target.value)}>{shotVideoResolutionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><small>分辨率会影响费用</small></label>
          <label><span>API 时长</span><i><input type="number" min="2" max="15" step="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} aria-label="AI 视频 API 时长" /><em>秒</em></i><small>时间线 {preview.sourceDuration}s → API {duration}s，不写回项目</small></label>
          <label className="shot-video-api-toggle"><span>智能改写</span><input type="checkbox" checked={promptExtend} onChange={(event) => setPromptExtend(event.target.checked)} /><strong>{promptExtend ? '开启' : '关闭'}</strong></label>
          <label className="shot-video-api-toggle"><span>水印</span><input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} /><strong>{watermark ? '开启' : '关闭'}</strong></label>
        </section>

        <details className="shot-video-api-advanced"><summary>高级参数 <small>可选</small></summary><label><span>随机种子</span><input type="number" min="0" max={maximumShotVideoSeed} step="1" value={seed} onChange={(event) => setSeed(event.target.value)} aria-label="AI 视频随机种子" placeholder="留空则由服务生成" /><small>0～{maximumShotVideoSeed}；相同种子不保证结果完全一致。</small></label></details>

        <div className="shot-video-api-audio-notice"><Icon name="volumeOff" size={19} /><span><strong>本地音轨不会上传</strong><small>当前不传 driving_audio；未来采用视频时默认丢弃模型音轨，继续使用项目配音、BGM 与音效。</small></span></div>

        <footer>
          <div className="shot-video-api-lock-notice"><Icon name="shield" size={19} /><span><strong>{generationStatus}</strong><small>不会上传首帧、不会创建任务、不会消耗额度。</small></span></div>
          <div className="shot-video-api-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="secondary-button shot-video-api-settings" onClick={() => { onClose(); onOpenSettings() }}>前往视频设置</button><button type="button" className="primary-button shot-video-api-submit" disabled title="视频付费生成未开放，本次不会创建任务"><Icon name="lock" size={15} />创建任务已锁定</button></div>
        </footer>
      </section>
    </div>
  )
}

const localShotVideoPhases = [
  ['validating', '验证文件'],
  ['normalizing', '标准化视频'],
  ['extracting', '提取首尾帧'],
  ['ready', '准备确认'],
]

function LocalShotVideoProcessingDialog({ progress, onCancel }) {
  const activeIndex = Math.max(0, localShotVideoPhases.findIndex(([phase]) => phase === progress.phase))
  return <div className="local-shot-video-layer" role="presentation"><section className="local-shot-video-processing" role="dialog" aria-modal="true" aria-labelledby="local-video-processing-title" aria-describedby="local-video-processing-message">
    <header><span><Icon name="video" size={24} /></span><div><small>LOCAL MEDIA</small><h2 id="local-video-processing-title">正在准备本地镜头视频</h2><p id="local-video-processing-message" aria-live="polite">{progress.message || '等待选择本地 MP4'}</p></div></header>
    <div className="local-shot-video-phase-list">{localShotVideoPhases.map(([phase, label], index) => <span key={phase} className={index < activeIndex ? 'is-complete' : index === activeIndex ? 'is-current' : 'is-waiting'}><i>{index < activeIndex ? <Icon name="check" size={13} /> : index + 1}</i><strong>{label}</strong><small>{index < activeIndex ? '完成' : index === activeIndex ? '处理中' : '等待'}</small></span>)}</div>
    <div className="local-shot-video-processing-note"><Icon name="shield" size={16} /><span>仅本机 FFmpeg 处理；原始文件不会被修改、移动或删除。</span></div>
    <footer><button type="button" className="secondary-button" onClick={onCancel}>取消处理</button></footer>
  </section></div>
}

function LocalShotVideoAdoptionDialog({ review, shot, shotNumber, onCancel, onChooseAgain, onAdopt, busy = false }) {
  const asset = review.asset
  const frames = [
    { label: '原分镜图', image: shot.image, fileName: shot.imageFileName || '当前镜头分镜图' },
    { label: '视频首帧', image: review.firstFrame?.dataUrl, fileName: review.firstFrame?.fileName || '真实视频首帧' },
    { label: '真实末帧', image: asset.lastFrame?.dataUrl, fileName: asset.lastFrame?.fileName || '真实视频末帧' },
  ]
  return <div className="local-shot-video-layer" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel() }}><section className="local-shot-video-adoption" role="dialog" aria-modal="true" aria-labelledby="local-video-adoption-title">
    <header><span><Icon name="video" size={24} /></span><div><small>REVIEW REAL MEDIA</small><h2 id="local-video-adoption-title">采用本地镜头视频</h2><p>镜头 {String(shotNumber).padStart(2, '0')} · 对比标准化视频的真实首尾帧</p></div><button type="button" aria-label="关闭采用确认" disabled={busy} onClick={onCancel}><Icon name="close" size={18} /></button></header>
    <div className="local-shot-video-safety"><span><Icon name="shield" size={15} />仅本地处理</span><span><Icon name="check" size={15} />源文件不修改</span><span><Icon name="volumeOff" size={15} />源音轨已移除</span></div>
    <div className="local-shot-video-frames">{frames.map((frame) => <article key={frame.label}><strong>{frame.label}</strong><div>{frame.image ? <img src={frame.image} alt={frame.label} /> : <span><Icon name="image" size={28} />当前没有真实图片</span>}</div><small title={frame.fileName}>{frame.fileName}</small></article>)}</div>
    <div className="local-shot-video-facts"><section><h3>真实文件信息</h3><dl><div><dt>文件名</dt><dd title={asset.fileName}>{asset.fileName}</dd></div><div><dt>时长</dt><dd>{asset.duration.toFixed(1)} 秒</dd></div><div><dt>分辨率</dt><dd>{asset.width}×{asset.height}</dd></div><div><dt>帧率</dt><dd>{asset.fps || 30} fps</dd></div><div><dt>托管副本</dt><dd>{formatAssetBytes(asset.bytes)}</dd></div><div><dt>校验</dt><dd>{asset.sha256 ? `${asset.sha256.slice(0, 12)}…` : '未记录'}</dd></div></dl></section><aside><span><Icon name="clock" size={17} /><b>保持时间线 {normalizeShotDuration(shot.duration).toFixed(1)} 秒</b><small>长视频截断，短视频停留真实末帧。</small></span><span><Icon name="volumeOff" size={17} /><b>继续使用项目音轨</b><small>配音、BGM 与音效保持权威。</small></span><span><Icon name="folder" size={17} /><b>不嵌入 10 MB 项目文件</b><small>项目只保存元数据与真实末帧。</small></span></aside></div>
    <footer><p><Icon name="shield" size={15} />原始文件不会被删除；确认后仅绑定到当前镜头。</p><div><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>取消</button><button type="button" className="secondary-button" disabled={busy} onClick={onChooseAgain}>重新选择</button><button type="button" className="primary-button" disabled={busy || !asset.lastFrame?.dataUrl} onClick={onAdopt}>{busy ? '正在采用…' : '采用到当前镜头'}</button></div></footer>
  </section></div>
}

function ShotVideoContinuityDialog({ sourceItem, nextItem, asset, onCancel, onConfirm }) {
  return <div className="local-shot-video-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><section className="shot-video-continuity-dialog" role="dialog" aria-modal="true" aria-labelledby="shot-video-continuity-title">
    <header><span><Icon name="history" size={23} /></span><div><small>LAST FRAME CONTINUITY</small><h2 id="shot-video-continuity-title">使用真实末帧承接下一镜头？</h2><p>镜头 {String(sourceItem.index + 1).padStart(2, '0')} → 镜头 {String(nextItem.index + 1).padStart(2, '0')}</p></div></header>
    <div className="shot-video-continuity-frames"><article><strong>当前镜头真实末帧</strong><div><img src={asset.lastFrame.dataUrl} alt="当前镜头真实末帧" /></div></article><i><Icon name="arrow" size={24} /></i><article><strong>下一镜头原分镜图</strong><div>{nextItem.shot.image ? <img src={nextItem.shot.image} alt="下一镜头原分镜图" /> : <span><Icon name="image" size={28} />尚无分镜图</span>}</div></article></div>
    <p className="shot-video-continuity-note"><Icon name="shield" size={16} />仅建立首帧引用，不覆盖下一镜头分镜图。</p>
    <footer><button type="button" className="secondary-button" onClick={onCancel}>取消</button><button type="button" className="primary-button" onClick={onConfirm}>连接到下一镜头</button></footer>
  </section></div>
}

function LocalShotVideoDetailDialog({ asset, mediaUrl, health, onClose, onReveal }) {
  return <div className="local-shot-video-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="local-shot-video-detail" role="dialog" aria-modal="true" aria-labelledby="local-shot-video-detail-title">
    <header><span><Icon name="video" size={22} /></span><div><small>MANAGED LOCAL MEDIA</small><h2 id="local-shot-video-detail-title">本地镜头视频详情</h2><p>{health === 'ready' ? '本机托管副本可用' : '本机视频已移动或损坏'}</p></div><button type="button" aria-label="关闭视频详情" onClick={onClose}><Icon name="close" size={18} /></button></header>
    <div className="local-shot-video-detail-preview">{health === 'ready' && mediaUrl ? <video controls muted playsInline preload="metadata" src={mediaUrl}>当前环境不支持视频预览</video> : <span><Icon name="warning" size={28} />当前预览将回退到原分镜图</span>}</div>
    <dl><div><dt>文件名</dt><dd title={asset.fileName}>{asset.fileName}</dd></div><div><dt>时长</dt><dd>{asset.duration.toFixed(1)} 秒</dd></div><div><dt>分辨率</dt><dd>{asset.width}×{asset.height}</dd></div><div><dt>大小</dt><dd>{formatAssetBytes(asset.bytes)}</dd></div><div><dt>来源</dt><dd>用户本地导入</dd></div><div><dt>源音轨</dt><dd>已移除</dd></div></dl>
    <section><strong>真实末帧</strong><img src={asset.lastFrame.dataUrl} alt="视频真实末帧" /></section>
    <footer><button type="button" className="secondary-button" disabled={health !== 'ready'} onClick={onReveal}>打开托管位置</button><button type="button" className="primary-button" onClick={onClose}>完成</button></footer>
  </section></div>
}

function FinalPage({
  projectName,
  projectLocalId,
  projectSnapshot,
  recoveryKey,
  episodes,
  selectedEpisode,
  setSelectedEpisode,
  scenes,
  shots: projectShots,
  setShots: setProjectShots,
  lines,
  videoAssets,
  setVideoAssets,
  audioTracks: episodeAudioTracks,
  setAudioTracks: setEpisodeAudioTracks,
  subtitleCues: episodeSubtitleCues,
  setSubtitleCues: setEpisodeSubtitleCues,
  subtitleCuesInitialized: episodeSubtitleCuesInitialized,
  setSubtitleCuesInitialized: setEpisodeSubtitleCuesInitialized,
  subtitleStyle: episodeSubtitleStyle,
  setSubtitleStyle: setEpisodeSubtitleStyle,
  timelineHistory: episodeTimelineHistory,
  setTimelineHistory: setEpisodeTimelineHistory,
  legacyProduction,
  readTimelineRecoverySnapshot,
  selectedShot,
  setSelectedShot,
  videoProviderConfig,
  bailianStatus,
  onOpenVideoSettings,
  oneClickPlan,
  oneClickRun,
  onStartOneClick,
  onOpenOneClickProgress,
  onNavigate,
  onNotice,
}) {
  const [advancedEditing, setAdvancedEditing] = useState(false)
  const [productionScope, setProductionScope] = useState('episode')
  const [legacyMigrationOpen, setLegacyMigrationOpen] = useState(Boolean(legacyProduction))
  const legacyReadOnly = productionScope === 'legacy' && Boolean(legacyProduction)
  const activeEpisode = episodes.find((episode) => Number(episode.id) === Number(selectedEpisode)) || episodes[0]
  const activeEpisodeIndex = Math.max(0, episodes.findIndex((episode) => Number(episode.id) === Number(activeEpisode?.id)))
  const activeEpisodeTitle = activeEpisode?.title || '未命名剧集'
  const shots = useMemo(
    () => legacyReadOnly
      ? projectShots
      : projectShots.filter((shot) => Number(shot.episodeId) === Number(activeEpisode?.id)),
    [activeEpisode?.id, legacyReadOnly, projectShots],
  )
  const setShots = useCallback((valueOrUpdater) => {
    if (legacyReadOnly || !activeEpisode) return
    setProjectShots((current) => {
      const currentEpisodeShots = current.filter((shot) => Number(shot.episodeId) === Number(activeEpisode.id))
      const nextEpisodeShots = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(currentEpisodeShots)
        : valueOrUpdater
      return replaceEpisodeShots(current, activeEpisode.id, nextEpisodeShots)
    })
  }, [activeEpisode, legacyReadOnly, setProjectShots])
  const audioTracks = legacyReadOnly ? legacyProduction.audioTracks : episodeAudioTracks
  const subtitleCues = legacyReadOnly ? legacyProduction.subtitleCues : episodeSubtitleCues
  const subtitleCuesInitialized = legacyReadOnly
    ? legacyProduction.subtitleCuesInitialized
    : episodeSubtitleCuesInitialized
  const subtitleStyle = legacyReadOnly ? legacyProduction.subtitleStyle : episodeSubtitleStyle
  const timelineHistory = legacyReadOnly ? createEmptyTimelineHistory() : episodeTimelineHistory
  const setAudioTracks = legacyReadOnly ? ignoreProductionUpdate : setEpisodeAudioTracks
  const setSubtitleCues = legacyReadOnly ? ignoreProductionUpdate : setEpisodeSubtitleCues
  const setSubtitleCuesInitialized = legacyReadOnly ? ignoreProductionUpdate : setEpisodeSubtitleCuesInitialized
  const setSubtitleStyle = legacyReadOnly ? ignoreProductionUpdate : setEpisodeSubtitleStyle
  const setTimelineHistory = legacyReadOnly ? ignoreProductionUpdate : setEpisodeTimelineHistory
  const timeline = useMemo(
    () => buildProductionTimeline({ episodes, scenes, shots, lines, videoAssets }),
    [episodes, scenes, shots, lines, videoAssets],
  )
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true)
  const [volume, setVolume] = useState(60)
  const [resolution, setResolution] = useState('1080x1920')
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({ percent: 0, message: '' })
  const [exportedPath, setExportedPath] = useState('')
  const [exportHistory, setExportHistory] = useState([])
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false)
  const [previewingTrack, setPreviewingTrack] = useState(0)
  const [playbackRevision, setPlaybackRevision] = useState(0)
  const [draggingTrackId, setDraggingTrackId] = useState(0)
  const [selectedSubtitleCue, setSelectedSubtitleCue] = useState(0)
  const [subtitleOffset, setSubtitleOffset] = useState('-0.5')
  const [draggingSubtitleCue, setDraggingSubtitleCue] = useState(0)
  const [timelineSafetyPanel, setTimelineSafetyPanel] = useState('')
  const [recoveryPoints, setRecoveryPoints] = useState([])
  const [recoveryStatus, setRecoveryStatus] = useState('idle')
  const [restoringRecoveryId, setRestoringRecoveryId] = useState('')
  const [shotInteraction, setShotInteraction] = useState(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedShotIds, setSelectedShotIds] = useState([])
  const [selectionAnchorId, setSelectionAnchorId] = useState(0)
  const [batchShotEdits, setBatchShotEdits] = useState(createEmptyBatchShotEdits)
  const [shotDeleteDialog, setShotDeleteDialog] = useState(null)
  const [shotDeleteUndo, setShotDeleteUndo] = useState(null)
  const [duplicatingShots, setDuplicatingShots] = useState(false)
  const [splittingShot, setSplittingShot] = useState(false)
  const [splitGuideEmphasis, setSplitGuideEmphasis] = useState(false)
  const [shotVideoDialogOpen, setShotVideoDialogOpen] = useState(false)
  const [localVideoProcessing, setLocalVideoProcessing] = useState(null)
  const [localVideoReview, setLocalVideoReview] = useState(null)
  const [localVideoAdoptionBusy, setLocalVideoAdoptionBusy] = useState(false)
  const [shotVideoHealthMap, setShotVideoHealthMap] = useState({})
  const [shotVideoContinuityDialog, setShotVideoContinuityDialog] = useState(null)
  const [localVideoDetailOpen, setLocalVideoDetailOpen] = useState(false)
  const audioPlayerRef = useRef(null)
  const audioTrackPreviewRef = useRef(null)
  const dragStateRef = useRef(null)
  const subtitleDragStateRef = useRef(null)
  const shotInteractionRef = useRef(null)
  const timelineTrackRef = useRef(null)
  const shotDeleteModalRef = useRef(null)
  const shotDeleteCancelRef = useRef(null)
  const exportConfirmModalRef = useRef(null)
  const exportConfirmCancelRef = useRef(null)
  const shotVideoButtonRef = useRef(null)
  const localShotVideoButtonRef = useRef(null)
  const localShotVideoPreviewRef = useRef(null)
  const restoreShotVideoFocusRef = useRef(false)
  const shotDeleteUndoTimerRef = useRef(null)
  const shotDuplicateBusyRef = useRef(false)
  const shotSplitBusyRef = useRef(false)
  const playheadRef = useRef(0)
  const timelineHistoryRef = useRef(timelineHistory)
  const projectSnapshotRef = useRef(projectSnapshot)
  const recoveryFingerprintRef = useRef({ key: '', value: '' })
  const latestRecoveryFingerprintRef = useRef('')
  const timelineActionRef = useRef({ undo: () => undefined, redo: () => undefined, duplicate: () => false, split: () => false })
  const cancelShotInteractionRef = useRef(() => undefined)
  const onNoticeRef = useRef(onNotice)
  const playheadItem = findTimelineItemAtTime(timeline.items, playhead)
  const selectedItem = timeline.items.find((item) => item.shot.id === selectedShot)
  const selectedMotionItem = selectedItem || timeline.items[0] || null
  const selectedMotionShot = selectedMotionItem?.shot || null
  const selectedMotionSettings = normalizeShotMotionSettings(selectedMotionShot || {})
  const validSelectedShotIds = normalizeShotSelection(shots, selectedShotIds)
  const selectedShotKeySet = new Set(validSelectedShotIds.map(String))
  const selectedBatchShots = shots.filter((shot) => selectedShotKeySet.has(String(shot.id)))
  const selectedBatchDuration = selectedBatchShots.reduce((total, shot) => total + normalizeShotDuration(shot.duration), 0)
  const sharedBatchDuration = selectedBatchShots.length
    && selectedBatchShots.every((shot) => normalizeShotDuration(shot.duration) === normalizeShotDuration(selectedBatchShots[0].duration))
    ? normalizeShotDuration(selectedBatchShots[0].duration).toFixed(1)
    : ''
  const hasBatchShotEdits = Object.values(batchShotEdits).some((value) => value !== '')
  const allShotsSelected = multiSelectMode && shots.length > 0 && validSelectedShotIds.length === shots.length
  const splitAnalysis = analyzeShotSplit({ shots, previousItems: timeline.items, playhead })
  const splitGuidePercent = splitAnalysis.targetItem?.duration
    ? Math.min(100, Math.max(0, ((playhead - splitAnalysis.targetItem.start) / splitAnalysis.targetItem.duration) * 100))
    : 0
  const activeReorderGroupKeys = new Set(
    shotInteraction?.mode === 'reorder' ? (shotInteraction.groupShotIds || []).map(String) : [],
  )
  const currentItem = playing ? playheadItem : selectedItem || playheadItem
  const current = currentItem?.shot || { id: 0, variant: 1, duration: '0.0s' }
  const currentVideoAsset = resolveShotVideoAsset(current, videoAssets)
  const currentVideoHealth = currentVideoAsset ? shotVideoHealthMap[currentVideoAsset.id]?.health || 'checking' : 'none'
  const currentVideoUrl = currentVideoAsset && currentVideoHealth === 'ready'
    ? shotVideoHealthMap[currentVideoAsset.id]?.mediaUrl || ''
    : ''
  const currentMotion = normalizeShotMotionSettings(current)
  const currentMotionProgress = currentItem?.duration
    ? Math.min(1, Math.max(0, (playhead - currentItem.start) / currentItem.duration))
    : 0
  const resolvedMotionPreviewStyle = resolveShotMotionPreviewStyle(current, currentMotionProgress, currentItem?.duration)
  const currentMotionPreviewStyle = playing
    ? resolvedMotionPreviewStyle
    : { ...resolvedMotionPreviewStyle, opacity: 1 }
  const videoRequestItem = selectedItem || timeline.items[0] || null
  const videoRequestItemIndex = videoRequestItem ? timeline.items.findIndex((item) => item.id === videoRequestItem.id) : -1
  const videoRequestNextItem = videoRequestItemIndex >= 0 ? timeline.items[videoRequestItemIndex + 1] || null : null
  const videoRequestEpisode = episodes.find((episode) => episode.id === videoRequestItem?.shot.episodeId) || null
  const videoRequestScene = scenes.find((scene) => scene.id === videoRequestItem?.shot.sceneId) || null
  const videoRequestContinuity = resolveShotVideoContinuityFrame({ shot: videoRequestItem?.shot, shots, assets: videoAssets })
  const resolvedVideoRequestItem = videoRequestContinuity
    ? {
      ...videoRequestItem,
      shot: {
        ...videoRequestItem.shot,
        image: videoRequestContinuity.dataUrl,
        imageFileName: `承接上一镜头真实末帧`,
      },
    }
    : videoRequestItem
  const hasVideoRequestFirstFrame = isShotVideoFrameDataUrl(resolvedVideoRequestItem?.shot.image)
  const selectedLocalVideoAsset = resolveShotVideoAsset(videoRequestItem?.shot, videoAssets)
  const selectedLocalVideoHealth = selectedLocalVideoAsset ? shotVideoHealthMap[selectedLocalVideoAsset.id]?.health || 'checking' : 'none'
  const selectedLocalVideoNextItem = videoRequestNextItem
  const selectedLocalVideoAlreadyConnected = Boolean(selectedLocalVideoNextItem
    && String(selectedLocalVideoNextItem.shot.videoContinuitySourceShotId || '') === String(videoRequestItem?.shot.id || ''))
  const activeSubtitleCue = resolveSubtitleCueAtTime(subtitleCues, playhead)
  const progress = timeline.totalDuration ? Math.min(100, (playhead / timeline.totalDuration) * 100) : 0
  const scopedRecoveryKey = legacyReadOnly
    ? `${recoveryKey}::legacy-project`
    : `${recoveryKey}::episode::${activeEpisode?.id || 0}`
  timelineHistoryRef.current = timelineHistory
  projectSnapshotRef.current = projectSnapshot
  onNoticeRef.current = onNotice

  const getScopeSwitchBlockedReason = () => {
    if (exporting) return '正在导出当前剧集，完成或取消后才能切换。'
    if (localVideoProcessing || localVideoAdoptionBusy) return '正在处理当前镜头视频，安全停止后才能切换。'
    if (shotInteraction || draggingTrackId || draggingSubtitleCue) return '请先结束当前拖动，再切换剧集。'
    if (duplicatingShots || splittingShot || shotDeleteDialog?.status === 'saving') return '正在提交时间线操作，完成后才能切换。'
    return ''
  }

  const switchProductionScope = (value) => {
    const blockedReason = getScopeSwitchBlockedReason()
    if (blockedReason) {
      onNotice(blockedReason)
      return
    }
    const nextLegacy = value === 'legacy'
    const nextEpisodeId = nextLegacy ? activeEpisode?.id : Number(String(value).replace(/^episode:/u, ''))
    const nextEpisode = episodes.find((episode) => Number(episode.id) === Number(nextEpisodeId)) || activeEpisode
    setPlaying(false)
    audioPlayerRef.current?.pause()
    audioPlayerRef.current = null
    audioTrackPreviewRef.current?.player.pause()
    audioTrackPreviewRef.current = null
    setPreviewingTrack(0)
    setPlayhead(0)
    setSelectedShotIds([])
    setSelectionAnchorId(0)
    setMultiSelectMode(false)
    setBatchShotEdits(createEmptyBatchShotEdits())
    setTimelineSafetyPanel('')
    setSelectedSubtitleCue(0)
    setRecoveryPoints([])
    setRecoveryStatus('loading')
    setProductionScope(nextLegacy ? 'legacy' : 'episode')
    if (!nextLegacy && nextEpisode) setSelectedEpisode(nextEpisode.id)
    const nextShots = nextLegacy
      ? projectShots
      : projectShots.filter((shot) => Number(shot.episodeId) === Number(nextEpisode?.id))
    setSelectedShot(nextShots[0]?.id || 0)
  }

  const closeShotVideoDialog = () => {
    const trigger = shotVideoButtonRef.current
    restoreShotVideoFocusRef.current = true
    flushSync(() => setShotVideoDialogOpen(false))
    ;(trigger || shotVideoButtonRef.current || document.querySelector('.shot-video-entry-card > button'))?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    if (shotVideoDialogOpen || !restoreShotVideoFocusRef.current) return
    restoreShotVideoFocusRef.current = false
    shotVideoButtonRef.current?.focus({ preventScroll: true })
  }, [shotVideoDialogOpen])

  useEffect(() => {
    setLegacyMigrationOpen(Boolean(legacyProduction))
    if (!legacyProduction) setProductionScope('episode')
  }, [legacyProduction, projectLocalId])

  useEffect(() => {
    if (legacyReadOnly || shots.some((shot) => String(shot.id) === String(selectedShot))) return
    setPlaying(false)
    setPlayhead(0)
    setSelectedShot(shots[0]?.id || 0)
    setSelectedSubtitleCue(subtitleCues[0]?.id || 0)
  }, [legacyReadOnly, selectedShot, setSelectedShot, shots, subtitleCues])

  const captureTimelineSnapshot = (overrides = {}) => createTimelineSnapshot({
    audioTracks,
    subtitleCues,
    subtitleCuesInitialized,
    subtitleStyle,
    shots,
    selectedSubtitleCue,
    playhead,
    focusedShotId: selectedShot,
    ...overrides,
  })

  const createScopedProjectCandidate = ({
    nextShots = shots,
    nextAudioTracks = audioTracks,
    nextSubtitleCues = subtitleCues,
    nextSubtitleCuesInitialized = subtitleCuesInitialized,
    nextSubtitleStyle = subtitleStyle,
    nextVideoAssets = videoAssets,
  } = {}) => {
    const currentSnapshot = projectSnapshotRef.current
    if (legacyReadOnly || !activeEpisode) {
      return {
        ...currentSnapshot,
        savedAt: new Date().toISOString(),
        content: {
          ...currentSnapshot.content,
          videoAssets: nextVideoAssets,
        },
      }
    }
    return {
      ...currentSnapshot,
      savedAt: new Date().toISOString(),
      content: {
        ...currentSnapshot.content,
        shots: replaceEpisodeShots(currentSnapshot.content.shots, activeEpisode.id, nextShots),
        videoAssets: nextVideoAssets,
        episodeProductions: updateEpisodeProduction(
          currentSnapshot.content.episodeProductions,
          activeEpisode.id,
          (production) => ({
            ...production,
            audioTracks: nextAudioTracks,
            subtitleCues: nextSubtitleCues,
            subtitleCuesInitialized: nextSubtitleCuesInitialized,
            subtitleStyle: nextSubtitleStyle,
          }),
          initialSubtitleStyle,
        ),
      },
    }
  }

  const applyTimelineSnapshot = (snapshot) => {
    setAudioTracks(snapshot.audioTracks)
    setSubtitleCues(snapshot.subtitleCues)
    setSubtitleCuesInitialized(snapshot.subtitleCuesInitialized)
    setSubtitleStyle(snapshot.subtitleStyle)
    const shotTimeline = snapshot.shotTimeline?.length ? snapshot.shotTimeline : snapshot.shotMotions || []
    setShots((items) => {
      const currentById = new Map(items.map((shot) => [String(shot.id), shot]))
      const restorableById = new Map((snapshot.restorableShots || []).map((shot) => [String(shot.id), shot]))
      const restored = shotTimeline.flatMap((entry) => {
        const shot = currentById.get(String(entry.id)) || restorableById.get(String(entry.id))
        if (!shot) return []
        return [{ ...shot, ...entry, ...normalizeShotMotionSettings(entry) }]
      })
      const restoredIds = new Set(restored.map((shot) => String(shot.id)))
      return snapshot.shotSetAuthoritative
        ? restored
        : [...restored, ...items.filter((shot) => !restoredIds.has(String(shot.id)))]
    })
    const restoredFocusId = snapshot.shotSetAuthoritative
      && shotTimeline.some((entry) => String(entry.id) === String(snapshot.focusedShotId))
      ? snapshot.focusedShotId
      : shotTimeline[0]?.id || 0
    setSelectedShot(restoredFocusId)
    setSelectedSubtitleCue(snapshot.selectedSubtitleCue || snapshot.subtitleCues[0]?.id || 0)
    const restoredDuration = shotTimeline.reduce((total, shot) => total + normalizeShotDuration(shot.duration), 0)
    setPlayhead(Math.min(restoredDuration || timeline.totalDuration, Math.max(0, snapshot.playhead || 0)))
    setPlaying(false)
  }

  const rememberTimelineSnapshot = (label, key, snapshot, coalesceMs = 800) => {
    const nextHistory = recordTimelineEdit(
      timelineHistoryRef.current,
      label,
      snapshot,
      { key, coalesceMs },
    )
    timelineHistoryRef.current = nextHistory
    setTimelineHistory(nextHistory)
  }

  const rememberTimelineEdit = (label, key = label, coalesceMs = 800) => {
    rememberTimelineSnapshot(label, key, captureTimelineSnapshot(), coalesceMs)
  }

  const startLocalShotVideoImport = async () => {
    const targetItem = selectedItem || timeline.items[0]
    if (legacyReadOnly || !targetItem || exporting || localVideoProcessing) return
    setPlaying(false)
    setLocalVideoProcessing({ phase: 'selecting', message: '等待选择本地 MP4' })
    try {
      const result = await shotVideoAssetRepository.prepare(projectLocalId)
      if (result?.canceled) return
      if (!result?.ok || !result.asset || !result.firstFrame) {
        onNotice(result?.error || '本地视频处理失败')
        return
      }
      setLocalVideoReview({ ...result, shotId: targetItem.shot.id, shotNumber: targetItem.index + 1 })
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '本地视频处理失败')
    } finally {
      setLocalVideoProcessing(null)
    }
  }

  const cancelLocalShotVideoProcessing = async () => {
    setLocalVideoProcessing((currentProgress) => currentProgress
      ? { ...currentProgress, message: '正在取消并清理临时文件…' }
      : currentProgress)
    await shotVideoAssetRepository.cancel().catch(() => undefined)
  }

  const discardLocalVideoReview = async () => {
    const review = localVideoReview
    setLocalVideoReview(null)
    if (review?.asset?.id) {
      await shotVideoAssetRepository.discard(projectLocalId, review.asset.id).catch(() => undefined)
    }
    window.setTimeout(() => localShotVideoButtonRef.current?.focus(), 0)
  }

  const chooseAnotherLocalShotVideo = async () => {
    await discardLocalVideoReview()
    await startLocalShotVideoImport()
  }

  const adoptLocalShotVideo = async () => {
    const review = localVideoReview
    if (!review || localVideoAdoptionBusy) return
    setLocalVideoAdoptionBusy(true)
    const result = applyShotVideoAsset({ shots, assets: videoAssets, shotId: review.shotId, asset: review.asset })
    const candidate = createScopedProjectCandidate({
      nextShots: result.shots,
      nextVideoAssets: result.assets,
    })
    if (!result.ok || getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
      await shotVideoAssetRepository.discard(projectLocalId, review.asset.id).catch(() => undefined)
      setLocalVideoReview(null)
      setLocalVideoAdoptionBusy(false)
      onNotice(result.error || '真实末帧会使项目超过 10 MB，本次没有采用视频')
      return
    }
    rememberTimelineEdit('采用本地镜头视频', `shot-video-adopt-${review.shotId}-${Date.now()}`, 0)
    setShots(result.shots)
    setVideoAssets(result.assets)
    setShotVideoHealthMap((currentMap) => ({
      ...currentMap,
      [review.asset.id]: { health: 'ready', mediaUrl: review.mediaUrl, bytes: review.asset.bytes },
    }))
    setLocalVideoReview(null)
    setLocalVideoAdoptionBusy(false)
    onNotice(`镜头 ${String(review.shotNumber).padStart(2, '0')} 已采用真实本地视频`)
  }

  const detachSelectedLocalShotVideo = () => {
    if (legacyReadOnly || !videoRequestItem || !selectedLocalVideoAsset) return
    if (!window.confirm('解除后镜头将回退到原分镜图；原始文件和本机托管副本不会被删除。确定解除使用吗？')) return
    rememberTimelineEdit('解除本地镜头视频', `shot-video-detach-${videoRequestItem.shot.id}-${Date.now()}`, 0)
    setShots(detachShotVideoAsset({ shots, shotId: videoRequestItem.shot.id }).shots)
    onNotice('已解除使用；镜头已回退到原分镜图')
  }

  const openShotVideoContinuity = () => {
    if (legacyReadOnly || !videoRequestItem || !selectedLocalVideoAsset || !selectedLocalVideoNextItem || exporting) return
    setPlaying(false)
    setShotVideoContinuityDialog({
      sourceItem: videoRequestItem,
      nextItem: selectedLocalVideoNextItem,
      asset: selectedLocalVideoAsset,
    })
  }

  const confirmShotVideoContinuity = () => {
    if (legacyReadOnly) return
    const sourceItem = shotVideoContinuityDialog?.sourceItem
    if (!sourceItem) return
    const result = connectShotVideoLastFrame({ shots, shotId: sourceItem.shot.id })
    if (!result.ok) {
      onNotice(result.error)
      setShotVideoContinuityDialog(null)
      return
    }
    rememberTimelineEdit('连接真实末帧到下一镜头', `shot-video-continuity-${sourceItem.shot.id}-${Date.now()}`, 0)
    setShots(result.shots)
    setShotVideoContinuityDialog(null)
    onNotice(`下一镜头将承接镜头 ${String(sourceItem.index + 1).padStart(2, '0')} 的真实末帧`)
  }

  const undoTimeline = () => {
    if (legacyReadOnly) return
    const result = undoTimelineEdit(timelineHistoryRef.current, captureTimelineSnapshot())
    if (!result.state) return
    timelineHistoryRef.current = result.history
    setTimelineHistory(result.history)
    applyTimelineSnapshot(result.state)
    setShotDeleteUndo(null)
    window.clearTimeout(shotDeleteUndoTimerRef.current)
    onNotice(`已撤销：${result.label}`)
  }

  const redoTimeline = () => {
    if (legacyReadOnly) return
    const result = redoTimelineEdit(timelineHistoryRef.current, captureTimelineSnapshot())
    if (!result.state) return
    timelineHistoryRef.current = result.history
    setTimelineHistory(result.history)
    applyTimelineSnapshot(result.state)
    setShotDeleteUndo(null)
    window.clearTimeout(shotDeleteUndoTimerRef.current)
    onNotice(`已重做：${result.label}`)
  }
  timelineActionRef.current = { undo: undoTimeline, redo: redoTimeline, duplicate: () => false, split: () => false }

  const recoveryFingerprint = useMemo(() => JSON.stringify({
    audioTracks: audioTracks.map((track) => ({
      id: track.id,
      kind: track.kind,
      name: track.name,
      fileName: track.fileName,
      start: track.start,
      duration: track.duration,
      volume: track.volume,
      fadeIn: track.fadeIn,
      fadeOut: track.fadeOut,
    })),
    subtitleCues,
    subtitleCuesInitialized,
    subtitleStyle,
    shotTimeline: shots.map((shot) => ({
      id: shot.id,
      duration: shot.duration,
      ...normalizeShotMotionSettings(shot),
      ...normalizeShotMotionRange(shot),
      ...normalizeShotTransitionEdges(shot),
      voiceSourceShotId: shot.voiceSourceShotId || 0,
      voiceOffsetSeconds: Number(Math.max(0, Number(shot.voiceOffsetSeconds) || 0).toFixed(3)),
      videoAssetId: shot.videoAssetId || '',
      videoOffsetSeconds: Number(Math.max(0, Number(shot.videoOffsetSeconds) || 0).toFixed(3)),
      videoContinuitySourceShotId: shot.videoContinuitySourceShotId || 0,
    })),
  }), [audioTracks, shots, subtitleCues, subtitleCuesInitialized, subtitleStyle])
  latestRecoveryFingerprintRef.current = recoveryFingerprint

  useEffect(() => {
    if (!playing || !timeline.totalDuration) return undefined
    const timer = window.setInterval(() => {
      setPlayhead((currentTime) => Math.min(timeline.totalDuration, currentTime + 0.1))
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, timeline.totalDuration])

  useEffect(() => {
    if (playing && playhead >= timeline.totalDuration) setPlaying(false)
  }, [playhead, playing, timeline.totalDuration])

  useEffect(() => {
    playheadRef.current = playhead
  }, [playhead])

  useEffect(() => {
    const player = localShotVideoPreviewRef.current
    if (!player || !currentVideoUrl || !currentItem) return undefined
    const requestedTime = Math.max(0, Number(current.videoOffsetSeconds) || 0)
      + Math.max(0, playhead - currentItem.start)
    const syncPlayer = () => {
      const sourceDuration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0
      const reachedRealLastFrame = sourceDuration > 0 && requestedTime >= sourceDuration
      const targetTime = reachedRealLastFrame
        ? Math.max(0, sourceDuration - (1 / 30))
        : requestedTime
      if (Math.abs((player.currentTime || 0) - targetTime) > 0.16) {
        try {
          player.currentTime = targetTime
        } catch {
          // Metadata may still be loading; loadedmetadata or the next playhead tick retries.
        }
      }
      if (playing && !reachedRealLastFrame) player.play().catch(() => undefined)
      else player.pause()
    }
    syncPlayer()
    player.addEventListener('loadedmetadata', syncPlayer)
    return () => {
      player.removeEventListener('loadedmetadata', syncPlayer)
      player.pause()
    }
  }, [current.id, current.videoOffsetSeconds, currentItem, currentVideoUrl, playhead, playing])

  useEffect(() => {
    setLocalVideoDetailOpen(false)
  }, [videoRequestItem?.shot.id])

  useEffect(() => {
    setSelectedShotIds((currentIds) => {
      const normalized = normalizeShotSelection(shots, currentIds)
      return normalized.map(String).join('|') === currentIds.map(String).join('|') ? currentIds : normalized
    })
    if (!shots.length) {
      setMultiSelectMode(false)
      setSelectionAnchorId(0)
    }
  }, [shots])

  useEffect(() => videoExportRepository.onProgress(setExportProgress), [])

  useEffect(() => shotVideoAssetRepository.onProgress((progressUpdate) => {
    setLocalVideoProcessing((currentProgress) => currentProgress
      ? { ...currentProgress, ...progressUpdate }
      : currentProgress)
  }), [])

  useEffect(() => {
    let active = true
    const assetIds = videoAssets.map((asset) => asset.id)
    if (!projectLocalId || !assetIds.length) {
      setShotVideoHealthMap({})
      return () => { active = false }
    }
    shotVideoAssetRepository.check(projectLocalId, assetIds).then((result) => {
      if (active && result.ok) setShotVideoHealthMap(result.assets || {})
    }).catch(() => undefined)
    return () => { active = false }
  }, [projectLocalId, videoAssets])

  useEffect(() => {
    const handleTimelineShortcut = (event) => {
      if (legacyReadOnly) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const elementName = event.target?.tagName?.toLowerCase()
      const isFormControl = elementName === 'input'
        || elementName === 'select'
        || elementName === 'textarea'
        || event.target?.isContentEditable
        || Boolean(event.target?.closest?.('[contenteditable="true"]'))
      if (key === 'z' && event.shiftKey) {
        timelineActionRef.current.redo()
        event.preventDefault()
      } else if (key === 'z') {
        timelineActionRef.current.undo()
        event.preventDefault()
      } else if (key === 'y') {
        timelineActionRef.current.redo()
        event.preventDefault()
      } else if (key === 'd' && !event.shiftKey && !isFormControl && timelineActionRef.current.duplicate()) {
        event.preventDefault()
      } else if (key === 'b' && !event.shiftKey && !isFormControl && timelineActionRef.current.split()) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handleTimelineShortcut)
    return () => window.removeEventListener('keydown', handleTimelineShortcut)
  }, [legacyReadOnly])

  useEffect(() => {
    if (legacyReadOnly) {
      setRecoveryPoints([])
      setRecoveryStatus('idle')
      return undefined
    }
    let active = true
    recoveryFingerprintRef.current = { key: scopedRecoveryKey, value: latestRecoveryFingerprintRef.current }
    setRecoveryStatus('loading')
    projectRepository.listTimelineRecoveries(scopedRecoveryKey).then((result) => {
      if (!active) return
      setRecoveryPoints(result.ok && Array.isArray(result.points) ? result.points : [])
      setRecoveryStatus(result.ok ? 'idle' : 'error')
    }).catch(() => {
      if (active) setRecoveryStatus('error')
    })
    return () => { active = false }
  }, [legacyReadOnly, scopedRecoveryKey])

  useEffect(() => {
    if (legacyReadOnly || shotInteraction?.mode) return undefined
    const marker = recoveryFingerprintRef.current
    if (marker.key !== scopedRecoveryKey) {
      recoveryFingerprintRef.current = { key: scopedRecoveryKey, value: recoveryFingerprint }
      return undefined
    }
    if (marker.value === recoveryFingerprint) return undefined
    recoveryFingerprintRef.current = { key: scopedRecoveryKey, value: recoveryFingerprint }
    setRecoveryStatus('pending')
    const recoveryTimer = window.setTimeout(async () => {
      setRecoveryStatus('saving')
      const result = await projectRepository.saveTimelineRecovery(scopedRecoveryKey, projectSnapshotRef.current)
      if (result.ok) {
        setRecoveryPoints(Array.isArray(result.points) ? result.points : [])
        setRecoveryStatus('saved')
      } else {
        setRecoveryStatus('error')
        onNoticeRef.current(result.error || '自动恢复点保存失败')
      }
    }, 1600)
    return () => window.clearTimeout(recoveryTimer)
  }, [legacyReadOnly, recoveryFingerprint, scopedRecoveryKey, shotInteraction?.mode])

  useEffect(() => {
    if (!subtitleCuesInitialized && timeline.items.length) {
      const generatedCues = createSubtitleCuesFromTimeline(timeline.items)
      setSubtitleCues(generatedCues)
      setSubtitleCuesInitialized(true)
      setSelectedSubtitleCue(generatedCues[0]?.id || 0)
    }
  }, [setSubtitleCues, setSubtitleCuesInitialized, subtitleCuesInitialized, timeline.items])

  useEffect(() => {
    let active = true
    videoExportRepository.listHistory().then((result) => {
      if (active && result.ok) setExportHistory(result.history || [])
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (playing && playheadItem && playheadItem.shot.id !== selectedShot) {
      setSelectedShot(playheadItem.shot.id)
    }
  }, [playheadItem, playing, selectedShot, setSelectedShot])

  useEffect(() => {
    audioPlayerRef.current?.pause()
    audioPlayerRef.current = null
    const audioSource = currentItem?.audioLine?.audio
    if (!playing || !audioSource) return undefined
    const player = new Audio(audioSource)
    player.volume = volume / 100
    player.currentTime = Math.max(0, currentItem.voiceOffsetSeconds + playheadRef.current - currentItem.start)
    audioPlayerRef.current = player
    player.play().catch(() => undefined)
    return () => player.pause()
  }, [currentItem?.audioLine?.audio, currentItem?.start, currentItem?.voiceOffsetSeconds, playing, volume])

  useEffect(() => {
    const activePreview = audioTrackPreviewRef.current
    if (playing && activePreview) {
      activePreview.player.pause()
      audioTrackPreviewRef.current = null
      setPreviewingTrack(0)
    }
    if (!playing) return undefined

    const players = []
    const timers = []
    const playbackStart = playheadRef.current
    const startTrack = (track, offset) => {
      if (!track.audio || !track.duration) return
      try {
        const player = new Audio(track.audio)
        player.volume = Math.min(1, Math.max(0, (track.volume / 100) * (volume / 100)))
        player.loop = track.kind === 'bgm'
        player.currentTime = track.kind === 'bgm' ? offset % track.duration : offset
        players.push(player)
        player.play().catch(() => undefined)
      } catch {
        // Invalid preview audio is handled as a skipped track by the FFmpeg exporter.
      }
    }

    audioTracks.forEach((track) => {
      const trackEnd = track.kind === 'bgm' ? timeline.totalDuration : track.start + track.duration
      if (!track.audio || track.start >= timeline.totalDuration || playbackStart >= trackEnd) return
      if (playbackStart >= track.start) {
        startTrack(track, playbackStart - track.start)
        return
      }
      const timer = window.setTimeout(() => startTrack(track, 0), (track.start - playbackStart) * 1000)
      timers.push(timer)
    })

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      players.forEach((player) => player.pause())
    }
  }, [audioTracks, playbackRevision, playing, timeline.totalDuration, volume])

  useEffect(() => {
    const activePreview = audioTrackPreviewRef.current
    if (!activePreview) return
    const track = audioTracks.find((item) => item.id === activePreview.trackId)
    if (track) activePreview.player.volume = Math.min(1, Math.max(0, track.volume / 100))
  }, [audioTracks])

  useEffect(() => () => {
    audioTrackPreviewRef.current?.player.pause()
  }, [])

  useEffect(() => () => window.clearTimeout(shotDeleteUndoTimerRef.current), [])

  useEffect(() => {
    if (!shotDeleteDialog) return undefined
    shotDeleteCancelRef.current?.focus()
    const focusFrame = window.requestAnimationFrame(() => shotDeleteCancelRef.current?.focus())
    const focusTimer = window.setTimeout(() => shotDeleteCancelRef.current?.focus(), 0)
    const handleDeleteDialogKeyDown = (event) => {
      if (event.key === 'Escape' && shotDeleteDialog.status !== 'saving') {
        setShotDeleteDialog(null)
        event.preventDefault()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(shotDeleteModalRef.current?.querySelectorAll('button:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        last.focus()
        event.preventDefault()
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus()
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handleDeleteDialogKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleDeleteDialogKeyDown)
    }
  }, [shotDeleteDialog])

  useEffect(() => {
    if (!exportConfirmOpen) return undefined
    exportConfirmCancelRef.current?.focus()
    const focusTimer = window.setTimeout(() => exportConfirmCancelRef.current?.focus(), 0)
    const handleExportConfirmKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExportConfirmOpen(false)
        event.preventDefault()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(exportConfirmModalRef.current?.querySelectorAll('button:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        last.focus()
        event.preventDefault()
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus()
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handleExportConfirmKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleExportConfirmKeyDown)
    }
  }, [exportConfirmOpen])

  const focusTimelineItem = (item) => {
    setPlaying(false)
    setSelectedShot(item.shot.id)
    setPlayhead(item.start)
  }

  const toggleMultiSelectMode = () => {
    if (legacyReadOnly || shotSplitBusyRef.current) return
    if (multiSelectMode) {
      setMultiSelectMode(false)
      setSelectedShotIds([])
      setSelectionAnchorId(0)
      setBatchShotEdits(createEmptyBatchShotEdits())
      return
    }
    const initialShotId = selectedShot || timeline.items[0]?.shot.id || 0
    setMultiSelectMode(true)
    setSelectedShotIds(initialShotId ? [initialShotId] : [])
    setSelectionAnchorId(initialShotId)
  }

  const openShotDeleteDialog = () => {
    if (legacyReadOnly || exporting || shotDuplicateBusyRef.current || shotSplitBusyRef.current || shotInteractionRef.current || shotDeleteDialog?.status === 'saving') return
    const targetIds = normalizeShotSelection(shots, selectedShotIds)
    if (!targetIds.length) return
    const impact = analyzeShotDeletion({
      shots,
      selectedShotIds: targetIds,
      previousItems: timeline.items,
      subtitleCues,
      audioTracks,
    })
    setPlaying(false)
    audioPlayerRef.current?.pause()
    audioPlayerRef.current = null
    audioTrackPreviewRef.current?.player.pause()
    audioTrackPreviewRef.current = null
    setPreviewingTrack(0)
    setShotDeleteDialog({ targetIds, impact, status: 'idle', error: '' })
  }

  const closeShotDeleteDialog = () => {
    if (shotDeleteDialog?.status === 'saving') return
    setShotDeleteDialog(null)
  }

  const selectTimelineItem = (item, event) => {
    if (legacyReadOnly) {
      focusTimelineItem(item)
      return
    }
    const wantsRange = Boolean(event?.shiftKey)
    const wantsToggle = Boolean(event?.ctrlKey || event?.metaKey)
    if (multiSelectMode || wantsRange || wantsToggle) {
      focusTimelineItem(item)
      setMultiSelectMode(true)
      if (wantsRange) {
        const anchorId = selectionAnchorId || selectedShot || item.shot.id
        setSelectedShotIds((currentIds) => selectShotRange(shots, anchorId, item.shot.id, currentIds, wantsToggle))
      } else if (wantsToggle) {
        setSelectedShotIds((currentIds) => {
          const baseIds = multiSelectMode
            ? currentIds
            : selectedShot && selectedShot !== item.shot.id ? [selectedShot] : []
          return toggleShotSelection(baseIds, item.shot.id)
        })
        setSelectionAnchorId(item.shot.id)
      } else {
        setSelectedShotIds((currentIds) => currentIds.some((id) => String(id) === String(item.shot.id))
          ? currentIds
          : normalizeShotSelection(shots, [...currentIds, item.shot.id]))
        setSelectionAnchorId(item.shot.id)
      }
      return
    }
    focusTimelineItem(item)
  }

  const toggleTimelineItemSelection = (event, item) => {
    if (legacyReadOnly) return
    event.stopPropagation()
    setPlaying(false)
    setMultiSelectMode(true)
    setSelectedShotIds((currentIds) => toggleShotSelection(currentIds, item.shot.id))
    setSelectionAnchorId(item.shot.id)
    setSelectedShot(item.shot.id)
    setPlayhead(item.start)
  }

  const extendTimelineSelection = (event, item) => {
    if (legacyReadOnly) return
    if (!event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    const targetItem = timeline.items[item.index + (event.key === 'ArrowRight' ? 1 : -1)]
    if (!targetItem) return
    const anchorId = selectionAnchorId || item.shot.id
    setMultiSelectMode(true)
    setSelectedShotIds((currentIds) => selectShotRange(shots, anchorId, targetItem.shot.id, currentIds, false))
    focusTimelineItem(targetItem)
    event.preventDefault()
  }

  const handleProductionTimelineKeyDown = (event) => {
    if (legacyReadOnly) return
    const elementName = event.target?.tagName?.toLowerCase()
    const isFormControl = elementName === 'input'
      || elementName === 'select'
      || elementName === 'textarea'
      || event.target?.isContentEditable
      || Boolean(event.target?.closest?.('[contenteditable="true"]'))
    if (!isFormControl && multiSelectMode && validSelectedShotIds.length && (event.key === 'Delete' || event.key === 'Backspace')) {
      openShotDeleteDialog()
      event.preventDefault()
    } else if (!isFormControl && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && shots.length) {
      setMultiSelectMode(true)
      setSelectedShotIds(shots.map((shot) => shot.id))
      setSelectionAnchorId(selectedShot || shots[0].id)
      event.preventDefault()
    } else if (event.key === 'Escape' && multiSelectMode && !shotInteractionRef.current) {
      setMultiSelectMode(false)
      setSelectedShotIds([])
      setSelectionAnchorId(0)
      setBatchShotEdits(createEmptyBatchShotEdits())
      event.preventDefault()
    }
  }

  const updateSelectedShotMotion = (changes, label, key) => {
    if (legacyReadOnly || !selectedMotionShot) return
    rememberTimelineEdit(label, key || `shot-${selectedMotionShot.id}-motion`, 1800)
    setShots((items) => items.map((shot) => {
      if (shot.id !== selectedMotionShot.id) return shot
      const settings = normalizeShotMotionSettings({ ...shot, ...changes })
      return {
        ...shot,
        ...settings,
        ...(changes.motionEffect !== undefined ? { motionRangeStart: 0, motionRangeEnd: 1 } : {}),
        ...(changes.transition !== undefined
          ? { transitionIn: settings.transition, transitionOut: settings.transition }
          : {}),
      }
    }))
  }

  const applyShotMotionToAll = () => {
    if (legacyReadOnly || !selectedMotionShot || !shots.length) return
    if (!window.confirm(`将镜头 ${selectedMotionItem.index + 1} 的动效与转场应用到全部 ${shots.length} 个镜头？`)) return
    rememberTimelineEdit('应用镜头动效到全部', `shot-motion-apply-all-${Date.now()}`)
    const settings = normalizeShotMotionSettings(selectedMotionShot)
    setShots((items) => items.map((shot) => ({
      ...shot,
      ...settings,
      motionRangeStart: 0,
      motionRangeEnd: 1,
      transitionIn: settings.transition,
      transitionOut: settings.transition,
    })))
    onNotice(`已将${getShotMotionLabel(settings.motionEffect)}应用到全部镜头`)
  }

  const shotTimelineSignature = (items) => items
    .map((shot) => `${shot.id}:${formatShotDuration(shot.duration)}:${JSON.stringify({
      ...normalizeShotMotionSettings(shot),
      ...normalizeShotMotionRange(shot),
      ...normalizeShotTransitionEdges(shot),
    })}`)
    .join('|')

  const buildTimelineForShots = (nextShots) => buildProductionTimeline({ episodes, scenes, shots: nextShots, lines })

  const duplicateSelectedShots = () => {
    if (legacyReadOnly
      || !multiSelectMode
      || exporting
      || shotDuplicateBusyRef.current
      || shotSplitBusyRef.current
      || shotInteractionRef.current
      || shotDeleteDialog) return false
    const targetIds = normalizeShotSelection(shots, selectedShotIds)
    if (!targetIds.length) return false

    shotDuplicateBusyRef.current = true
    setDuplicatingShots(true)
    const releaseDuplicateLock = () => {
      shotDuplicateBusyRef.current = false
      setDuplicatingShots(false)
    }

    try {
      const result = duplicateShotSelectionInTimeline({
        shots,
        selectedShotIds: targetIds,
        previousItems: timeline.items,
        subtitleCues,
        audioTracks,
        playhead,
      })
      if (!result.duplicatedShots.length) {
        releaseDuplicateLock()
        onNotice('所选镜头已发生变化，没有执行复制。')
        return true
      }

      const candidateSnapshot = createScopedProjectCandidate({
        nextShots: result.shots,
        nextSubtitleCues: result.subtitleCues,
        nextSubtitleCuesInitialized: true,
        nextAudioTracks: result.audioTracks,
      })
      if (getProjectSnapshotByteSize(candidateSnapshot) > maximumProjectBytes) {
        releaseDuplicateLock()
        onNotice('复制后项目将超过 10 MB，请先移除部分图片或音频。')
        return true
      }

      const label = `复制 ${result.duplicatedShots.length} 个镜头`
      rememberTimelineSnapshot(
        label,
        `shot-duplicate-${Date.now()}`,
        captureTimelineSnapshot({
          shotSetAuthoritative: true,
          restorableShots: result.duplicatedShots,
          focusedShotId: selectedShot,
        }),
        0,
      )
      setPlaying(false)
      audioPlayerRef.current?.pause()
      audioPlayerRef.current = null
      audioTrackPreviewRef.current?.player.pause()
      audioTrackPreviewRef.current = null
      setPreviewingTrack(0)
      setShots(result.shots)
      setSubtitleCues(result.subtitleCues)
      setSubtitleCuesInitialized(true)
      setAudioTracks(result.audioTracks)
      setPlayhead(result.playhead)
      setSelectedShot(result.focusShotId)
      setMultiSelectMode(true)
      setSelectedShotIds(result.duplicateShotIds)
      setSelectionAnchorId(result.focusShotId)
      window.clearTimeout(shotDeleteUndoTimerRef.current)
      setShotDeleteUndo({
        kind: 'duplicate',
        count: result.duplicatedShots.length,
        insertionPosition: result.insertionIndex + 1,
      })
      shotDeleteUndoTimerRef.current = window.setTimeout(() => setShotDeleteUndo(null), 8000)
      releaseDuplicateLock()
      window.requestAnimationFrame(() => {
        const target = document.querySelector(`.timeline-segment[data-shot-id="${result.focusShotId}"]`)
        target?.scrollIntoView?.({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      })
      return true
    } catch (error) {
      releaseDuplicateLock()
      onNotice(error instanceof Error ? error.message : '复制镜头失败，请重试。')
      return true
    }
  }
  timelineActionRef.current.duplicate = duplicateSelectedShots

  const splitCurrentShot = () => {
    if (legacyReadOnly) return false
    if (multiSelectMode) {
      onNotice('多选模式下不能拆分镜头，请先退出多选。')
      return true
    }
    if (exporting || shotDuplicateBusyRef.current || shotSplitBusyRef.current || shotInteractionRef.current || shotDeleteDialog) return false

    const result = splitShotAtPlayhead({
      shots,
      previousItems: timeline.items,
      subtitleCues,
      audioTracks,
      playhead,
    })
    if (!result.valid) {
      onNotice(result.reason === 'no-target'
        ? '当前播放头没有可拆分的镜头。'
        : '当前播放头距离镜头边缘不足 0.5 秒，无法拆分。')
      return true
    }

    shotSplitBusyRef.current = true
    setSplittingShot(true)
    const releaseSplitLock = () => {
      shotSplitBusyRef.current = false
      setSplittingShot(false)
    }

    try {
      const candidateSnapshot = createScopedProjectCandidate({
        nextShots: result.shots,
        nextSubtitleCues: result.subtitleCues,
        nextSubtitleCuesInitialized: true,
        nextAudioTracks: result.audioTracks,
      })
      if (getProjectSnapshotByteSize(candidateSnapshot) > maximumProjectBytes) {
        releaseSplitLock()
        onNotice('拆分后项目将超过 10 MB，请先移除部分图片或音频。')
        return true
      }

      const shotNumber = result.targetIndex + 1
      const label = `拆分镜头 ${String(shotNumber).padStart(2, '0')}`
      rememberTimelineSnapshot(
        label,
        `shot-split-${Date.now()}`,
        captureTimelineSnapshot({
          shotSetAuthoritative: true,
          restorableShots: [result.splitShot],
          focusedShotId: result.targetShot.id,
        }),
        0,
      )
      setPlaying(false)
      audioPlayerRef.current?.pause()
      audioPlayerRef.current = null
      audioTrackPreviewRef.current?.player.pause()
      audioTrackPreviewRef.current = null
      setPreviewingTrack(0)
      setShots(result.shots)
      setSubtitleCues(result.subtitleCues)
      setSubtitleCuesInitialized(true)
      setAudioTracks(result.audioTracks)
      setPlayhead(result.playhead)
      setSelectedShot(result.focusShotId)
      setSelectedSubtitleCue((currentCueId) => result.subtitleCues.some((cue) => cue.id === currentCueId)
        ? currentCueId
        : result.subtitleCues[0]?.id || 0)
      setMultiSelectMode(false)
      setSelectedShotIds([])
      setSelectionAnchorId(0)
      setBatchShotEdits(createEmptyBatchShotEdits())
      window.clearTimeout(shotDeleteUndoTimerRef.current)
      setShotDeleteUndo({
        kind: 'split',
        shotNumber,
        leftDuration: result.leftDuration,
        rightDuration: result.rightDuration,
      })
      shotDeleteUndoTimerRef.current = window.setTimeout(() => setShotDeleteUndo(null), 8000)
      releaseSplitLock()
      window.requestAnimationFrame(() => {
        const target = document.querySelector(`.timeline-segment[data-shot-id="${result.focusShotId}"]`)
        target?.scrollIntoView?.({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      })
      return true
    } catch (error) {
      releaseSplitLock()
      onNotice(error instanceof Error ? error.message : '拆分镜头失败，请重试。')
      return true
    }
  }
  timelineActionRef.current.split = splitCurrentShot

  const confirmShotDeletion = async () => {
    if (legacyReadOnly || !shotDeleteDialog || shotDeleteDialog.status === 'saving') return
    const targetIds = normalizeShotSelection(shots, shotDeleteDialog.targetIds)
    if (!targetIds.length) {
      setShotDeleteDialog(null)
      onNotice('所选镜头已发生变化，没有执行删除')
      return
    }

    const impact = analyzeShotDeletion({
      shots,
      selectedShotIds: targetIds,
      previousItems: timeline.items,
      subtitleCues,
      audioTracks,
    })
    setShotDeleteDialog((currentDialog) => currentDialog ? { ...currentDialog, impact, status: 'saving', error: '' } : currentDialog)
    setRecoveryStatus('saving')
    try {
      const recoveryResult = await projectRepository.saveTimelineRecovery(scopedRecoveryKey, projectSnapshotRef.current)
      if (!recoveryResult.ok) {
        setRecoveryStatus('error')
        setShotDeleteDialog((currentDialog) => currentDialog
          ? { ...currentDialog, status: 'error', error: recoveryResult.error || '恢复点建立失败，镜头尚未删除。' }
          : currentDialog)
        return
      }

      setRecoveryPoints(Array.isArray(recoveryResult.points) ? recoveryResult.points : [])
      setRecoveryStatus('saved')
      const nextTimeline = buildTimelineForShots(impact.remainingShots)
      const result = deleteShotSelectionFromTimeline({
        shots,
        selectedShotIds: targetIds,
        previousItems: timeline.items,
        nextItems: nextTimeline.items,
        subtitleCues,
        audioTracks,
        playhead,
        focusShotId: selectedShot,
      })
      if (!result.removedShots.length) {
        setShotDeleteDialog(null)
        onNotice('所选镜头已发生变化，没有执行删除')
        return
      }

      const label = `删除 ${result.removedShots.length} 个镜头`
      rememberTimelineSnapshot(
        label,
        `shot-delete-${Date.now()}`,
        captureTimelineSnapshot({
          shotSetAuthoritative: true,
          restorableShots: result.removedShots,
          focusedShotId: selectedShot,
        }),
        0,
      )
      setShots(result.shots)
      setSubtitleCues(result.subtitleCues)
      setSubtitleCuesInitialized(true)
      setAudioTracks(result.audioTracks)
      setPlayhead(result.playhead)
      setSelectedShot(result.focusShotId)
      setSelectedSubtitleCue((currentCueId) => result.subtitleCues.some((cue) => cue.id === currentCueId)
        ? currentCueId
        : result.subtitleCues[0]?.id || 0)
      setPlaying(false)
      setMultiSelectMode(false)
      setSelectedShotIds([])
      setSelectionAnchorId(0)
      setBatchShotEdits(createEmptyBatchShotEdits())
      setShotDeleteDialog(null)
      window.clearTimeout(shotDeleteUndoTimerRef.current)
      setShotDeleteUndo({ kind: 'delete', count: result.removedShots.length })
      shotDeleteUndoTimerRef.current = window.setTimeout(() => setShotDeleteUndo(null), 8000)
    } catch (error) {
      const message = error instanceof Error ? error.message : '恢复点建立失败，镜头尚未删除。'
      setRecoveryStatus('error')
      setShotDeleteDialog((currentDialog) => currentDialog
        ? { ...currentDialog, status: 'error', error: message }
        : currentDialog)
    }
  }

  const synchronizeShotTimelineChange = ({
    previousTimeline,
    nextShots,
    sourceSubtitleCues,
    sourceAudioTracks,
    sourcePlayhead,
    focusShotId,
  }) => {
    const nextTimeline = buildTimelineForShots(nextShots)
    const synchronized = synchronizeTimelineDependents({
      previousItems: previousTimeline.items,
      nextItems: nextTimeline.items,
      subtitleCues: sourceSubtitleCues,
      audioTracks: sourceAudioTracks,
    })
    return {
      ...synchronized,
      nextTimeline,
      playhead: remapTimelinePlayhead({
        previousItems: previousTimeline.items,
        nextItems: nextTimeline.items,
        shotId: focusShotId,
        playhead: sourcePlayhead,
      }),
    }
  }

  const commitShotTimelineChange = (nextShots, label, key, focusShotId = selectedShot) => {
    if (legacyReadOnly) return false
    if (shotTimelineSignature(nextShots) === shotTimelineSignature(shots)) return false
    const result = synchronizeShotTimelineChange({
      previousTimeline: timeline,
      nextShots,
      sourceSubtitleCues: subtitleCues,
      sourceAudioTracks: audioTracks,
      sourcePlayhead: playhead,
      focusShotId,
    })
    rememberTimelineEdit(label, key, 0)
    setShots(nextShots)
    setSubtitleCues(result.subtitleCues)
    setAudioTracks(result.audioTracks)
    setPlayhead(result.playhead)
    setSelectedShot(focusShotId)
    setPlaying(false)
    return true
  }

  const commitBatchShotEdits = () => {
    if (legacyReadOnly || shotDuplicateBusyRef.current || shotSplitBusyRef.current) return
    const targetIds = normalizeShotSelection(shots, selectedShotIds)
    if (targetIds.length < 2 || !hasBatchShotEdits) return
    const nextShots = applyBatchShotEdits(shots, targetIds, batchShotEdits)
    if (commitShotTimelineChange(
      nextShots,
      `批量编辑 ${targetIds.length} 个镜头`,
      `shot-batch-${Date.now()}`,
      selectedShot || targetIds[0],
    )) {
      onNotice(`已批量更新 ${targetIds.length} 个镜头，字幕与音轨已同步`)
    } else {
      onNotice('所选镜头已经是当前批量参数')
    }
  }

  const moveShotWithKeyboard = (item, direction) => {
    if (legacyReadOnly || shotSplitBusyRef.current) return
    const nextShots = moveShotToIndex(shots, item.shot.id, item.index + direction)
    const nextIndex = nextShots.findIndex((shot) => shot.id === item.shot.id)
    if (nextIndex === item.index) return
    if (commitShotTimelineChange(
      nextShots,
      `重排镜头 ${String(item.index + 1).padStart(2, '0')} → ${String(nextIndex + 1).padStart(2, '0')}`,
      `shot-${item.shot.id}-reorder-${Date.now()}`,
      item.shot.id,
    )) onNotice(`镜头已移动到第 ${nextIndex + 1} 位，字幕与音效已同步`)
  }

  const moveShotGroupWithKeyboard = (item, direction) => {
    if (legacyReadOnly || shotSplitBusyRef.current) return
    const groupShotIds = selectedShotKeySet.has(String(item.shot.id))
      ? validSelectedShotIds
      : normalizeShotSelection(shots, [...validSelectedShotIds, item.shot.id])
    if (groupShotIds.length < 2 || groupShotIds.length === shots.length) return
    const nextShots = moveShotGroupByStep(shots, groupShotIds, direction)
    if (nextShots === shots) return
    const firstGroupIndex = nextShots.findIndex((shot) => groupShotIds.some((id) => String(id) === String(shot.id)))
    setSelectedShotIds(groupShotIds)
    if (commitShotTimelineChange(
      nextShots,
      `成组移动 ${groupShotIds.length} 个镜头 → 第 ${String(firstGroupIndex + 1).padStart(2, '0')} 位`,
      `shot-group-keyboard-${Date.now()}`,
      item.shot.id,
    )) onNotice(`已成组移动 ${groupShotIds.length} 个镜头，字幕与音效已同步`)
  }

  const updateShotDurationWithKeyboard = (item, requestedDuration) => {
    if (legacyReadOnly || shotSplitBusyRef.current) return
    const duration = normalizeShotDuration(requestedDuration, item.duration)
    if (duration === normalizeShotDuration(item.duration)) return
    const nextShots = shots.map((shot) => shot.id === item.shot.id
      ? { ...shot, duration: formatShotDuration(duration) }
      : shot)
    if (commitShotTimelineChange(
      nextShots,
      `调整镜头 ${String(item.index + 1).padStart(2, '0')} 时长`,
      `shot-${item.shot.id}-duration-keyboard`,
      item.shot.id,
    )) onNotice(`镜头 ${String(item.index + 1).padStart(2, '0')} 已调整为 ${duration.toFixed(1)} 秒`)
  }

  const beginShotReorder = (event, item) => {
    if (legacyReadOnly || event.button !== 0 || exporting || shotSplitBusyRef.current || shots.length < 2) return
    const groupShotIds = multiSelectMode
      ? selectedShotKeySet.has(String(item.shot.id))
        ? validSelectedShotIds
        : normalizeShotSelection(shots, [...validSelectedShotIds, item.shot.id])
      : [item.shot.id]
    if (groupShotIds.length === shots.length) return
    if (multiSelectMode && !selectedShotKeySet.has(String(item.shot.id))) {
      setSelectedShotIds(groupShotIds)
      setSelectionAnchorId(item.shot.id)
    }
    const track = timelineTrackRef.current
    const trackBounds = track?.getBoundingClientRect()
    const badgeLeft = trackBounds
      ? Math.max(track.scrollLeft + 8, Math.min(track.scrollLeft + trackBounds.width - 140, track.scrollLeft + event.clientX - trackBounds.left + 12))
      : 8
    const groupKeySet = new Set(groupShotIds.map(String))
    const interaction = {
      mode: 'reorder',
      pointerId: event.pointerId,
      shotId: item.shot.id,
      originIndex: item.index,
      originClientX: event.clientX,
      groupShotIds,
      groupDuration: shots.filter((shot) => groupKeySet.has(String(shot.id))).reduce((total, shot) => total + normalizeShotDuration(shot.duration), 0),
      remainingShotIds: shots.filter((shot) => !groupKeySet.has(String(shot.id))).map((shot) => shot.id),
      insertionIndex: getShotGroupInsertionIndex(shots, groupShotIds),
      badgeLeft,
      moved: false,
      originShots: shots,
    }
    shotInteractionRef.current = interaction
    setShotInteraction(interaction)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPlaying(false)
    setSelectedShot(item.shot.id)
    event.stopPropagation()
    event.preventDefault()
  }

  const updateShotReorderInsertion = (clientX) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'reorder') return
    const track = timelineTrackRef.current
    if (!track) return
    const groupKeys = new Set((interaction.groupShotIds || [interaction.shotId]).map(String))
    const segments = Array.from(track.children).filter((element) => (
      element.classList.contains('timeline-segment') && !groupKeys.has(String(element.dataset.shotId))
    ))
    let insertionIndex = segments.length
    for (let index = 0; index < segments.length; index += 1) {
      const bounds = segments[index].getBoundingClientRect()
      if (clientX < bounds.left + bounds.width / 2) {
        insertionIndex = index
        break
      }
    }
    const bounds = track.getBoundingClientRect()
    const badgeLeft = Math.max(track.scrollLeft + 8, Math.min(track.scrollLeft + bounds.width - 140, track.scrollLeft + clientX - bounds.left + 12))
    const moved = interaction.moved || Math.abs(clientX - interaction.originClientX) >= 4
    if (interaction.insertionIndex !== insertionIndex || interaction.badgeLeft !== badgeLeft || interaction.moved !== moved) {
      interaction.insertionIndex = insertionIndex
      interaction.badgeLeft = badgeLeft
      interaction.moved = moved
      setShotInteraction({ ...interaction })
    }
  }

  const moveShotReorder = (event, item) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'reorder' || interaction.shotId !== item.shot.id || interaction.pointerId !== event.pointerId) return
    updateShotReorderInsertion(event.clientX)
    event.preventDefault()
  }

  const completeShotReorder = (interaction, canceled = false) => {
    shotInteractionRef.current = null
    setShotInteraction(null)
    if (!canceled && interaction.moved) {
      const groupShotIds = interaction.groupShotIds || [interaction.shotId]
      const nextShots = reorderShotGroupByInsertion(interaction.originShots, groupShotIds, interaction.insertionIndex)
      const nextIndex = nextShots.findIndex((shot) => shot.id === interaction.shotId)
      const isGroupMove = groupShotIds.length > 1
      const label = isGroupMove
        ? `成组移动 ${groupShotIds.length} 个镜头 → 第 ${String(Math.max(0, nextShots.findIndex((shot) => String(shot.id) === String(groupShotIds[0]))) + 1).padStart(2, '0')} 位`
        : `重排镜头 ${String(interaction.originIndex + 1).padStart(2, '0')} → ${String(nextIndex + 1).padStart(2, '0')}`
      if (commitShotTimelineChange(
        nextShots,
        label,
        `${isGroupMove ? 'shot-group' : `shot-${interaction.shotId}`}-reorder-${Date.now()}`,
        interaction.shotId,
      )) onNotice(isGroupMove
        ? `已成组移动 ${groupShotIds.length} 个镜头，字幕与音效已同步`
        : `镜头已移动到第 ${nextIndex + 1} 位，字幕与音效已同步`)
    }
  }

  const finishShotReorder = (event, item, canceled = false) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'reorder' || interaction.shotId !== item.shot.id || interaction.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    completeShotReorder(interaction, canceled)
    event.stopPropagation()
  }

  const moveShotReorderOnTrack = (event) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'reorder' || interaction.pointerId !== event.pointerId) return
    updateShotReorderInsertion(event.clientX)
    event.preventDefault()
  }

  const finishShotReorderOnTrack = (event, canceled = false) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'reorder' || interaction.pointerId !== event.pointerId) return
    completeShotReorder(interaction, canceled)
    event.preventDefault()
  }

  const beginShotDurationResize = (event, item) => {
    if (legacyReadOnly || event.button !== 0 || exporting || shotSplitBusyRef.current || !timeline.totalDuration) return
    const bounds = timelineTrackRef.current?.getBoundingClientRect()
    if (!bounds?.width) return
    const interaction = {
      mode: 'resize',
      pointerId: event.pointerId,
      shotId: item.shot.id,
      originIndex: item.index,
      originClientX: event.clientX,
      originDuration: item.duration,
      duration: item.duration,
      secondsPerPixel: timeline.totalDuration / bounds.width,
      originShots: shots,
      originTimeline: timeline,
      originSubtitleCues: subtitleCues,
      originAudioTracks: audioTracks,
      originPlayhead: playhead,
      originSnapshot: captureTimelineSnapshot(),
      changed: false,
    }
    shotInteractionRef.current = interaction
    setShotInteraction(interaction)
    event.currentTarget.setPointerCapture(event.pointerId)
    setPlaying(false)
    setSelectedShot(item.shot.id)
    event.stopPropagation()
    event.preventDefault()
  }

  const updateShotDurationResize = (clientX) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'resize') return
    const duration = normalizeShotDuration(
      interaction.originDuration + (clientX - interaction.originClientX) * interaction.secondsPerPixel,
      interaction.originDuration,
    )
    if (duration === interaction.duration) return
    const nextShots = interaction.originShots.map((shot) => shot.id === interaction.shotId
      ? { ...shot, duration: formatShotDuration(duration) }
      : shot)
    const result = synchronizeShotTimelineChange({
      previousTimeline: interaction.originTimeline,
      nextShots,
      sourceSubtitleCues: interaction.originSubtitleCues,
      sourceAudioTracks: interaction.originAudioTracks,
      sourcePlayhead: interaction.originPlayhead,
      focusShotId: interaction.shotId,
    })
    interaction.duration = duration
    interaction.changed = duration !== normalizeShotDuration(interaction.originDuration)
    setShots(nextShots)
    setSubtitleCues(result.subtitleCues)
    setAudioTracks(result.audioTracks)
    setPlayhead(result.playhead)
    setShotInteraction({ ...interaction })
  }

  const moveShotDurationResize = (event, item) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'resize' || interaction.shotId !== item.shot.id || interaction.pointerId !== event.pointerId) return
    updateShotDurationResize(event.clientX)
    event.preventDefault()
  }

  const cancelShotInteraction = (showNotice = true) => {
    const interaction = shotInteractionRef.current
    if (!interaction) return
    if (interaction.mode === 'resize') {
      setShots(interaction.originShots)
      setSubtitleCues(interaction.originSubtitleCues)
      setAudioTracks(interaction.originAudioTracks)
      setPlayhead(interaction.originPlayhead)
    }
    shotInteractionRef.current = null
    setShotInteraction(null)
    if (showNotice) onNoticeRef.current('已取消本次镜头时间线调整')
  }
  cancelShotInteractionRef.current = cancelShotInteraction

  const completeShotDurationResize = (interaction, canceled = false) => {
    if (canceled) {
      cancelShotInteraction(false)
    } else {
      shotInteractionRef.current = null
      setShotInteraction(null)
      if (interaction.changed) {
        rememberTimelineSnapshot(
          `调整镜头 ${String(interaction.originIndex + 1).padStart(2, '0')} 时长`,
          `shot-${interaction.shotId}-duration-${Date.now()}`,
          interaction.originSnapshot,
          0,
        )
        onNotice(`镜头 ${String(interaction.originIndex + 1).padStart(2, '0')} 已调整为 ${interaction.duration.toFixed(1)} 秒，字幕与音轨已同步`)
      }
    }
  }

  const finishShotDurationResize = (event, item, canceled = false) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'resize' || interaction.shotId !== item.shot.id || interaction.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    completeShotDurationResize(interaction, canceled)
    event.stopPropagation()
  }

  const moveShotDurationResizeOnTrack = (event) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'resize' || interaction.pointerId !== event.pointerId) return
    updateShotDurationResize(event.clientX)
    event.preventDefault()
  }

  const finishShotDurationResizeOnTrack = (event, canceled = false) => {
    const interaction = shotInteractionRef.current
    if (!interaction || interaction.mode !== 'resize' || interaction.pointerId !== event.pointerId) return
    completeShotDurationResize(interaction, canceled)
    event.preventDefault()
  }

  useEffect(() => {
    const cancelWithEscape = (event) => {
      if (event.key === 'Escape' && shotInteractionRef.current) {
        cancelShotInteractionRef.current()
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', cancelWithEscape)
    return () => window.removeEventListener('keydown', cancelWithEscape)
  }, [])

  const seekTimeline = (value) => {
    const nextTime = Number(value)
    const item = findTimelineItemAtTime(timeline.items, nextTime)
    setPlayhead(nextTime)
    if (item) setSelectedShot(item.shot.id)
    if (playing) setPlaybackRevision((currentRevision) => currentRevision + 1)
  }

  const togglePlayback = () => {
    if (playhead >= timeline.totalDuration) setPlayhead(0)
    setPlaying((currentState) => {
      if (!currentState) setPlaybackRevision((currentRevision) => currentRevision + 1)
      return !currentState
    })
  }

  const performExportMp4 = async () => {
    setPlaying(false)
    setExporting(true)
    setExportedPath('')
    setExportProgress({ percent: 1, message: '等待选择保存位置' })
    try {
      const result = await videoExportRepository.export({
        projectName: legacyReadOnly
          ? `${projectName}-旧版全项目成片`
          : `${projectName}-第${activeEpisodeIndex + 1}集-${activeEpisodeTitle}`,
        projectLocalId,
        episodeId: legacyReadOnly ? 0 : activeEpisode?.id,
        episodeTitle: legacyReadOnly ? '旧版全项目成片' : activeEpisodeTitle,
        scope: legacyReadOnly ? 'legacy-project' : 'episode',
        timeline,
        resolution,
        transition: 'fade',
        subtitlesEnabled,
        subtitleCues,
        subtitleStyle,
        audioTracks,
      })
      if (result.ok) {
        setExportedPath(result.outputPath)
        setExportHistory(result.history || [])
        const skippedTracks = result.skippedTrackCount ? `，跳过 ${result.skippedTrackCount} 条无效音轨` : ''
        onNotice(`${legacyReadOnly ? '旧版全项目成片' : `第 ${activeEpisodeIndex + 1} 集`} MP4 已导出：${result.segmentCount} 个镜头，已混合 ${result.mixedTrackCount || 0} 条音乐与音效轨道${skippedTracks}`)
      } else if (result.canceled) {
        setExportProgress({ percent: 0, message: '' })
        onNotice('已取消 MP4 导出')
      } else {
        setExportProgress({ percent: 0, message: result.error || 'MP4 导出失败' })
        onNotice(result.error || 'MP4 导出失败')
      }
    } finally {
      setExporting(false)
    }
  }

  const cancelExport = async () => {
    const result = await videoExportRepository.cancel()
    if (result.ok) {
      setExportProgress((currentState) => ({ ...currentState, message: '正在安全取消导出' }))
    } else {
      onNotice(result.error || '取消导出失败')
    }
  }

  const revealExport = async (filePath) => {
    const result = await videoExportRepository.reveal(filePath)
    onNotice(result.ok ? '已在文件资源管理器中定位成片' : result.error || '无法打开文件位置')
  }

  const updateAudioTrack = (trackId, changes, label = '调整音轨参数', key = `audio-${trackId}-${Object.keys(changes).sort().join('-')}`) => {
    if (legacyReadOnly) return
    rememberTimelineEdit(label, key, 1600)
    setAudioTracks((items) => items.map((track) => track.id === trackId ? { ...track, ...changes } : track))
  }

  const removeAudioTrack = (trackId) => {
    if (legacyReadOnly) return
    if (audioTrackPreviewRef.current?.trackId === trackId) {
      audioTrackPreviewRef.current.player.pause()
      audioTrackPreviewRef.current = null
      setPreviewingTrack(0)
    }
    rememberTimelineEdit('移除音频轨道', `audio-${trackId}-remove`)
    setAudioTracks((items) => items.filter((track) => track.id !== trackId))
    onNotice('音频轨道已从项目中移除')
  }

  const importAudioTrack = (event, kind) => {
    if (legacyReadOnly) {
      event.target.value = ''
      return
    }
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      onNotice('请选择有效的音频文件')
      return
    }
    if (audioTracks.length >= 6) {
      onNotice('每集最多添加 6 条背景音乐或音效轨道')
      return
    }
    const embeddedBytes = audioTracks.reduce((total, track) => {
      const payload = track.audio?.split(',')[1] || ''
      return total + Math.floor(payload.length * 0.75)
    }, 0)
    if (file.size > 4 * 1024 * 1024 || embeddedBytes + file.size > 5 * 1024 * 1024) {
      onNotice('单个音频需小于 4 MB，项目音轨合计不能超过 5 MB')
      return
    }
    const reader = new FileReader()
    reader.addEventListener('load', async () => {
      if (typeof reader.result !== 'string') return
      const source = reader.result
      const waveform = await createAudioWaveform(file).catch(() => [])
      const preview = new Audio(source)
      let completed = false
      const finish = (detectedDuration) => {
        if (completed) return
        completed = true
        const duration = Number.isFinite(detectedDuration) && detectedDuration > 0
          ? detectedDuration
          : kind === 'bgm' ? Math.max(1, timeline.totalDuration) : 1
        rememberTimelineEdit(`导入${kind === 'bgm' ? '背景音乐' : '音效'}`, `audio-import-${Date.now()}`)
        setAudioTracks((items) => [...items, {
          id: Math.max(0, ...items.map((track) => track.id)) + 1,
          kind,
          name: file.name.replace(/\.[^.]+$/u, '') || (kind === 'bgm' ? '背景音乐' : '音效'),
          fileName: file.name,
          audio: source,
          start: kind === 'bgm' ? 0 : Number(playhead.toFixed(1)),
          duration: Number(duration.toFixed(2)),
          volume: kind === 'bgm' ? 35 : 70,
          fadeIn: kind === 'bgm' ? 1.5 : 0,
          fadeOut: kind === 'bgm' ? 1.5 : 0,
          waveform,
        }])
        onNotice(`已导入${kind === 'bgm' ? '背景音乐' : '音效'}：${file.name}`)
      }
      preview.addEventListener('loadedmetadata', () => finish(preview.duration), { once: true })
      preview.addEventListener('error', () => finish(0), { once: true })
      window.setTimeout(() => finish(0), 1200)
    })
    reader.readAsDataURL(file)
  }

  const toggleAudioTrackPreview = (track) => {
    setPlaying(false)
    const activePreview = audioTrackPreviewRef.current
    if (activePreview) {
      activePreview.player.pause()
      audioTrackPreviewRef.current = null
      if (activePreview.trackId === track.id) {
        setPreviewingTrack(0)
        return
      }
    }
    try {
      const player = new Audio(track.audio)
      player.volume = Math.min(1, Math.max(0, track.volume / 100))
      player.addEventListener('ended', () => {
        if (audioTrackPreviewRef.current?.player === player) {
          audioTrackPreviewRef.current = null
          setPreviewingTrack(0)
        }
      }, { once: true })
      audioTrackPreviewRef.current = { trackId: track.id, player }
      setPreviewingTrack(track.id)
      player.play().catch(() => {
        if (audioTrackPreviewRef.current?.player === player) {
          audioTrackPreviewRef.current = null
          setPreviewingTrack(0)
          onNotice('该音频无法在预览器中播放，导出时会由 FFmpeg 再次校验')
        }
      })
    } catch {
      setPreviewingTrack(0)
      onNotice('该音频无法在预览器中播放')
    }
  }

  const updateAudioTrackStart = (track, requestedStart) => {
    const occupiedDuration = track.kind === 'sfx' ? Math.min(track.duration, timeline.totalDuration) : Math.min(0.1, timeline.totalDuration)
    const maxStart = Math.max(0, timeline.totalDuration - occupiedDuration)
    const nextStart = Math.min(maxStart, Math.max(0, Number(requestedStart) || 0))
    updateAudioTrack(track.id, { start: Number(nextStart.toFixed(1)) }, '移动音轨起点', `audio-${track.id}-start`)
  }

  const audioTrackPointerTime = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0
    return Math.min(timeline.totalDuration, Math.max(0, ratio * timeline.totalDuration))
  }

  const beginAudioTrackDrag = (event, track) => {
    if (legacyReadOnly || event.button !== 0 || !timeline.totalDuration) return
    const pointerTime = audioTrackPointerTime(event)
    const isClip = event.target.closest?.('.audio-track-clip')
    dragStateRef.current = {
      trackId: track.id,
      pointerId: event.pointerId,
      offset: isClip ? pointerTime - track.start : 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingTrackId(track.id)
    updateAudioTrackStart(track, pointerTime - dragStateRef.current.offset)
    event.preventDefault()
  }

  const moveAudioTrackDrag = (event, track) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.trackId !== track.id || dragState.pointerId !== event.pointerId) return
    updateAudioTrackStart(track, audioTrackPointerTime(event) - dragState.offset)
  }

  const finishAudioTrackDrag = (event, track) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.trackId !== track.id || dragState.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragStateRef.current = null
    setDraggingTrackId(0)
  }

  const renderAudioTrack = (track) => {
    const timelineRemaining = Math.max(0, timeline.totalDuration - track.start)
    const effectiveDuration = track.kind === 'bgm' ? timelineRemaining : Math.min(track.duration, timelineRemaining)
    const left = timeline.totalDuration ? Math.min(100, (track.start / timeline.totalDuration) * 100) : 0
    const width = timeline.totalDuration ? Math.max(1, (effectiveDuration / timeline.totalDuration) * 100) : 1
    const waveform = Array.isArray(track.waveform) ? track.waveform : []
    return (
      <article className={`audio-track-row audio-track-row--${track.kind}`} key={track.id}>
        <header>
          <span><b>{track.kind === 'bgm' ? 'BGM' : 'SFX'}</b><input className="audio-track-name" value={track.name} onChange={(event) => updateAudioTrack(track.id, { name: event.target.value })} /></span>
          <small>{track.fileName} · {track.duration.toFixed(1)}s</small>
          <div className="audio-track-actions">
            <button className={previewingTrack === track.id ? 'is-playing' : ''} onClick={() => toggleAudioTrackPreview(track)} title={previewingTrack === track.id ? '停止试听' : '试听音轨'}><Icon name={previewingTrack === track.id ? 'pause' : 'play'} size={12} /></button>
            <button onClick={() => removeAudioTrack(track.id)} title="移除音频轨道"><Icon name="trash" size={12} /></button>
          </div>
        </header>
        <div
          className={`audio-track-rail ${draggingTrackId === track.id ? 'is-dragging' : ''}`}
          role="slider"
          tabIndex="0"
          aria-label={`${track.name} 时间线起点`}
          aria-valuemin="0"
          aria-valuemax={timeline.totalDuration}
          aria-valuenow={track.start}
          title="点击或拖动波形调整起点"
          onPointerDown={(event) => beginAudioTrackDrag(event, track)}
          onPointerMove={(event) => moveAudioTrackDrag(event, track)}
          onPointerUp={(event) => finishAudioTrackDrag(event, track)}
          onPointerCancel={(event) => finishAudioTrackDrag(event, track)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              updateAudioTrackStart(track, track.start + (event.key === 'ArrowRight' ? 0.1 : -0.1))
              event.preventDefault()
            }
          }}
        >
          <div className="audio-track-clip" style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }}>
            <div className="audio-track-waveform" aria-hidden="true">{waveform.length ? waveform.map((sample, index) => <b key={`${track.id}-${index}`} style={{ height: `${Math.max(16, sample * 100)}%` }} />) : <small>无波形数据</small>}</div>
            <span>{track.kind === 'bgm' ? '循环至片尾' : `${track.duration.toFixed(1)}s`}</span>
          </div>
        </div>
        <div className="audio-track-controls">
          <label>起点<input className="audio-track-start" type="number" min="0" max={timeline.totalDuration} step="0.1" value={track.start} onChange={(event) => updateAudioTrackStart(track, event.target.value)} /><em>s</em></label>
          <label>音量<input className="audio-track-volume" type="range" min="0" max="100" value={track.volume} onChange={(event) => updateAudioTrack(track.id, { volume: Number(event.target.value) }, '调整音轨音量')} /><output>{track.volume}%</output></label>
          <label>淡入<input type="number" min="0" max="10" step="0.1" value={track.fadeIn} onChange={(event) => updateAudioTrack(track.id, { fadeIn: Math.min(10, Math.max(0, Number(event.target.value) || 0)) }, '调整音轨淡入')} /><em>s</em></label>
          <label>淡出<input type="number" min="0" max="10" step="0.1" value={track.fadeOut} onChange={(event) => updateAudioTrack(track.id, { fadeOut: Math.min(10, Math.max(0, Number(event.target.value) || 0)) }, '调整音轨淡出')} /><em>s</em></label>
        </div>
      </article>
    )
  }

  const updateSubtitleCue = (cueId, changes) => {
    if (legacyReadOnly) return
    const isTextEdit = Object.prototype.hasOwnProperty.call(changes, 'text')
    rememberTimelineEdit(
      isTextEdit ? '编辑字幕文本' : '调整字幕时间',
      `subtitle-${cueId}-${isTextEdit ? 'text' : 'timing'}`,
      isTextEdit ? 2200 : 1600,
    )
    setSubtitleCues((items) => normalizeSubtitleCues(
      items.map((cue) => cue.id === cueId ? { ...cue, ...changes } : cue),
      timeline.totalDuration,
    ))
  }

  const selectSubtitleCue = (cue) => {
    setSelectedSubtitleCue(cue.id)
    seekTimeline(cue.start)
  }

  const addSubtitleCue = () => {
    if (legacyReadOnly) return
    const start = Math.min(Math.max(0, timeline.totalDuration - 0.1), playhead)
    const cue = {
      id: `subtitle-custom-${Date.now()}`,
      sourceItemId: '',
      start,
      end: Math.min(timeline.totalDuration, start + 2),
      text: '新字幕',
    }
    rememberTimelineEdit('新增字幕', `subtitle-add-${cue.id}`)
    setSubtitleCues((items) => normalizeSubtitleCues([...items, cue], timeline.totalDuration))
    setSubtitleCuesInitialized(true)
    setSelectedSubtitleCue(cue.id)
    onNotice('已在当前播放位置添加字幕')
  }

  const removeSubtitleCue = (cueId) => {
    if (legacyReadOnly) return
    rememberTimelineEdit('删除字幕', `subtitle-${cueId}-remove`)
    setSubtitleCues((items) => items.filter((cue) => cue.id !== cueId))
    if (selectedSubtitleCue === cueId) setSelectedSubtitleCue(0)
    onNotice('字幕条目已移除')
  }

  const rebuildSubtitlesFromShots = () => {
    if (legacyReadOnly) return
    if (subtitleCues.length && !window.confirm('将使用当前分镜台词覆盖字幕轨道，是否继续？')) return
    const generatedCues = createSubtitleCuesFromTimeline(timeline.items)
    rememberTimelineEdit('从分镜重建字幕', 'subtitle-rebuild')
    setSubtitleCues(generatedCues)
    setSubtitleCuesInitialized(true)
    setSelectedSubtitleCue(generatedCues[0]?.id || 0)
    onNotice(`已从分镜重建 ${generatedCues.length} 条字幕`)
  }

  const importSrt = async () => {
    if (legacyReadOnly) return
    const result = await subtitleRepository.importSrt()
    if (result.canceled) return
    if (!result.ok) {
      onNotice(result.error || 'SRT 字幕导入失败')
      return
    }
    try {
      const importedCues = parseSrt(result.text, timeline.totalDuration)
      if (subtitleCues.length && !window.confirm(`导入 ${importedCues.length} 条字幕将覆盖当前字幕轨道，是否继续？`)) return
      rememberTimelineEdit('导入 SRT 字幕', `subtitle-import-${Date.now()}`)
      setSubtitleCues(importedCues)
      setSubtitleCuesInitialized(true)
      setSelectedSubtitleCue(importedCues[0]?.id || 0)
      setPlayhead(importedCues[0]?.start || 0)
      onNotice(`已导入 ${result.fileName}：${importedCues.length} 条字幕`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'SRT 字幕解析失败')
    }
  }

  const exportSrt = async () => {
    const text = serializeSrt(subtitleCues)
    if (!text) {
      onNotice('当前没有可导出的字幕')
      return
    }
    const result = await subtitleRepository.exportSrt(projectName, text)
    if (result.canceled) return
    onNotice(result.ok ? `SRT 已导出：${result.path}` : result.error || 'SRT 字幕导出失败')
  }

  const updateSubtitleStyle = (changes) => {
    if (legacyReadOnly) return
    rememberTimelineEdit('调整字幕样式', `subtitle-style-${Object.keys(changes).sort().join('-')}`, 1800)
    setSubtitleStyle((currentStyle) => normalizeSubtitleStyle({ ...currentStyle, ...changes }))
  }

  const updateSubtitleTiming = (cueId, start, end, label = '调整字幕时间', key = `subtitle-${cueId}-timing`) => {
    if (legacyReadOnly) return
    rememberTimelineEdit(label, key, 5000)
    setSubtitleCues((items) => normalizeSubtitleCues(
      items.map((cue) => cue.id === cueId ? { ...cue, start, end } : cue),
      timeline.totalDuration,
    ))
  }

  const subtitlePointerTime = (event) => {
    const rail = event.currentTarget.parentElement
    const bounds = rail.getBoundingClientRect()
    const ratio = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0
    return Math.min(timeline.totalDuration, Math.max(0, ratio * timeline.totalDuration))
  }

  const beginSubtitleDrag = (event, cue) => {
    if (legacyReadOnly || event.button !== 0 || !timeline.totalDuration) return
    const mode = event.target.dataset.edge || 'move'
    subtitleDragStateRef.current = {
      cueId: cue.id,
      pointerId: event.pointerId,
      mode,
      originPointerTime: subtitlePointerTime(event),
      originStart: cue.start,
      originEnd: cue.end,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedSubtitleCue(cue.id)
    setDraggingSubtitleCue(cue.id)
    setPlaying(false)
    event.preventDefault()
  }

  const moveSubtitleDrag = (event, cue) => {
    const dragState = subtitleDragStateRef.current
    if (!dragState || dragState.cueId !== cue.id || dragState.pointerId !== event.pointerId) return
    const delta = subtitlePointerTime(event) - dragState.originPointerTime
    if (dragState.mode === 'start') {
      updateSubtitleTiming(cue.id, Math.min(dragState.originEnd - 0.1, Math.max(0, dragState.originStart + delta)), dragState.originEnd, '调整字幕入点', `subtitle-${cue.id}-resize-start`)
    } else if (dragState.mode === 'end') {
      updateSubtitleTiming(cue.id, dragState.originStart, Math.min(timeline.totalDuration, Math.max(dragState.originStart + 0.1, dragState.originEnd + delta)), '调整字幕出点', `subtitle-${cue.id}-resize-end`)
    } else {
      const duration = dragState.originEnd - dragState.originStart
      const start = Math.min(Math.max(0, timeline.totalDuration - duration), Math.max(0, dragState.originStart + delta))
      updateSubtitleTiming(cue.id, start, start + duration, '移动字幕', `subtitle-${cue.id}-move`)
    }
  }

  const finishSubtitleDrag = (event, cue) => {
    const dragState = subtitleDragStateRef.current
    if (!dragState || dragState.cueId !== cue.id || dragState.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    subtitleDragStateRef.current = null
    setDraggingSubtitleCue(0)
  }

  const moveSubtitleCueBy = (cue, offset) => {
    if (legacyReadOnly) return
    const duration = cue.end - cue.start
    const start = Math.min(Math.max(0, timeline.totalDuration - duration), Math.max(0, cue.start + offset))
    updateSubtitleTiming(cue.id, start, start + duration, '微调字幕位置', `subtitle-${cue.id}-keyboard-move`)
  }

  const applySubtitleOffset = () => {
    if (legacyReadOnly) return
    const offset = Number(subtitleOffset)
    if (!Number.isFinite(offset) || offset === 0) {
      onNotice('请输入非零的字幕偏移秒数')
      return
    }
    rememberTimelineEdit('整体偏移字幕', 'subtitle-batch-offset')
    setSubtitleCues((items) => normalizeSubtitleCues(items.map((cue) => {
      const duration = cue.end - cue.start
      const start = Math.min(Math.max(0, timeline.totalDuration - duration), Math.max(0, cue.start + offset))
      return { ...cue, start, end: start + duration }
    }), timeline.totalDuration))
    onNotice(`全部字幕已${offset > 0 ? '后移' : '前移'} ${Math.abs(offset)} 秒`)
  }

  const splitSelectedSubtitleCue = () => {
    if (legacyReadOnly) return
    const cue = subtitleCues.find((item) => item.id === selectedSubtitleCue)
    if (!cue) {
      onNotice('请先选择要拆分的字幕')
      return
    }
    if (cue.end - cue.start < 0.2 || cue.text.trim().length < 2) {
      onNotice('该字幕过短，无法继续拆分')
      return
    }
    const splitPoint = playhead > cue.start + 0.1 && playhead < cue.end - 0.1
      ? playhead
      : cue.start + (cue.end - cue.start) / 2
    const [leftText, rightText] = splitSubtitleText(cue.text)
    const rightCue = {
      ...cue,
      id: `subtitle-split-${Date.now()}`,
      sourceItemId: '',
      start: splitPoint,
      text: rightText || leftText,
    }
    rememberTimelineEdit('拆分字幕', `subtitle-${cue.id}-split`)
    setSubtitleCues((items) => normalizeSubtitleCues(items.flatMap((item) => item.id === cue.id
      ? [{ ...item, end: splitPoint, text: leftText }, rightCue]
      : [item]), timeline.totalDuration))
    setSelectedSubtitleCue(cue.id)
    onNotice('字幕已按当前播放位置拆分')
  }

  const mergeSelectedSubtitleCue = () => {
    if (legacyReadOnly) return
    const ordered = [...subtitleCues].sort((left, right) => left.start - right.start)
    const selectedIndex = ordered.findIndex((cue) => cue.id === selectedSubtitleCue)
    if (selectedIndex < 0 || ordered.length < 2) {
      onNotice('请先选择要合并的字幕')
      return
    }
    const leftIndex = selectedIndex < ordered.length - 1 ? selectedIndex : selectedIndex - 1
    const left = ordered[leftIndex]
    const right = ordered[leftIndex + 1]
    const separator = /[，。！？；,.!?;]$/u.test(left.text.trim()) ? '\n' : ''
    const merged = {
      ...left,
      end: Math.max(left.end, right.end),
      text: `${left.text.trim()}${separator}${right.text.trim()}`.slice(0, 500),
    }
    rememberTimelineEdit('合并相邻字幕', `subtitle-${left.id}-${right.id}-merge`)
    setSubtitleCues(normalizeSubtitleCues(ordered.flatMap((cue, index) => {
      if (index === leftIndex) return [merged]
      if (index === leftIndex + 1) return []
      return [cue]
    }), timeline.totalDuration))
    setSelectedSubtitleCue(merged.id)
    setPlayhead(merged.start)
    onNotice('已合并相邻字幕')
  }

  const restoreTimelineRecovery = async (point) => {
    if (legacyReadOnly) return
    if (!window.confirm(`恢复 ${formatHistoryTime(point.savedAt)} 的时间线状态？当前状态仍可通过“撤销”找回。`)) return
    setRestoringRecoveryId(point.id)
    try {
      const result = await projectRepository.restoreTimelineRecovery(scopedRecoveryKey, point.id)
      if (!result.ok || !result.snapshot) {
        onNotice(result.error || '恢复点读取失败')
        return
      }
      const recovered = readTimelineRecoverySnapshot(result.snapshot, {
        episodeId: activeEpisode?.id,
        legacy: legacyReadOnly,
      })
      rememberTimelineEdit('恢复自动恢复点', `recovery-${point.id}`)
      applyTimelineSnapshot(createTimelineSnapshot(recovered))
      onNotice(`已恢复 ${formatHistoryTime(point.savedAt)} 的时间线，可继续撤销`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '恢复点读取失败')
    } finally {
      setRestoringRecoveryId('')
    }
  }

  const orderedSubtitleCues = [...subtitleCues].sort((left, right) => left.start - right.start)
  const previewSubtitleText = activeSubtitleCue?.text || (!subtitleCues.length ? currentItem?.subtitle : '')
  const subtitleBackgroundAlpha = Math.round((subtitleStyle.backgroundOpacity / 100) * 255).toString(16).padStart(2, '0')
  const previewSubtitleStyle = {
    color: subtitleStyle.color,
    backgroundColor: `${subtitleStyle.outlineColor}${subtitleBackgroundAlpha}`,
    fontSize: `${Math.max(12, Math.round(subtitleStyle.fontSize * 0.34))}px`,
    fontWeight: subtitleStyle.bold ? 800 : 500,
    textShadow: `0 1px 4px ${subtitleStyle.outlineColor}`,
  }

  const readinessRows = [
    { key: 'image', label: '画面', ready: timeline.readiness.imageReady, total: timeline.readiness.imageTotal },
    { key: 'audio', label: '配音', ready: timeline.readiness.audioReady, total: timeline.readiness.audioTotal },
    { key: 'subtitle', label: '字幕', ready: subtitleCues.filter((cue) => cue.text).length, total: subtitleCues.length || timeline.readiness.subtitleTotal },
  ]
  const exportReadinessIssues = getExportReadinessIssues(readinessRows, { subtitlesEnabled })
  const requestExportMp4 = () => {
    if (exporting || !shots.length) return
    if (exportReadinessIssues.length) {
      setPlaying(false)
      setExportConfirmOpen(true)
      return
    }
    performExportMp4()
  }
  const confirmDegradedExport = () => {
    setExportConfirmOpen(false)
    performExportMp4()
  }
  const scopeSelectValue = legacyReadOnly ? 'legacy' : `episode:${activeEpisode?.id || 0}`
  const scopeSwitchBlockedReason = getScopeSwitchBlockedReason()
  const visibleExportHistory = exportHistory.filter((entry) => (
    entry.projectLocalId === projectLocalId
    && (legacyReadOnly
      ? entry.scope === 'legacy-project'
      : entry.scope !== 'legacy-project' && Number(entry.episodeId) === Number(activeEpisode?.id))
  ))
  const activeEpisodeExportTask = (oneClickRun?.tasks || []).findLast((task) => (
    task.kind === 'episode-export'
    && String(task.entityId) === String(activeEpisode?.id)
    && task.status === 'succeeded'
    && task.result?.outputPath
  ))
  const oneClickBusy = ['queued', 'running', 'cooldown', 'pausing', 'stopping'].includes(oneClickRun?.status)

  return (
    <>
    <main className={`page project-page final-page ${advancedEditing ? 'is-advanced' : 'is-simple'}`}>
      <section className="glass final-preview"><header><span><small>FINAL CUT</small><h1>成片预览</h1></span><label className="episode-scope-selector" title={scopeSwitchBlockedReason || '切换当前制作剧集'}><Icon name="list" size={16} /><select aria-label="当前制作剧集" value={scopeSelectValue} disabled={Boolean(scopeSwitchBlockedReason)} onChange={(event) => switchProductionScope(event.target.value)}>{episodes.map((episode, index) => <option key={episode.id} value={`episode:${episode.id}`}>第 {index + 1} 集 · {episode.title}</option>)}{legacyProduction && <option value="legacy">旧版全项目成片 · 只读</option>}</select><small>{legacyReadOnly ? `${shots.length} 镜头 · 只读` : `${shots.length} 镜头 · ${timeline.totalDuration.toFixed(1)} 秒`}</small></label><em>{currentItem ? `${currentItem.episodeTitle} · ${currentItem.sceneTitle}` : legacyReadOnly ? '旧版全片等待分镜' : `第 ${activeEpisodeIndex + 1} 集等待分镜`}</em></header><div className="preview-stage"><div className="vertical-frame">{currentVideoUrl ? <video key={`${currentVideoAsset.id}-${current.id}`} ref={localShotVideoPreviewRef} className="local-shot-video-preview" src={currentVideoUrl} muted playsInline preload="metadata" aria-label="当前镜头真实本地视频" /> : <div className={`motion-preview-art motion-preview-art--${currentMotion.motionEffect}`} style={current.image ? currentMotionPreviewStyle : undefined}><Art variant={current.variant} image={current.image} label="竖屏成片预览" /></div>}{currentVideoUrl && <span className="local-shot-video-source-badge"><Icon name="video" size={12} />本地视频</span>}{currentVideoAsset && currentVideoHealth !== 'ready' && <span className="local-shot-video-source-badge is-warning"><Icon name="warning" size={12} />视频缺失 · 已回退</span>}{subtitlesEnabled && previewSubtitleText && <span className={`subtitle-preview subtitle-preview--${subtitleStyle.position}`} style={previewSubtitleStyle}>{previewSubtitleText}</span>}<small>镜头 {currentItem ? String(currentItem.index + 1).padStart(2, '0') : '--'}</small></div></div><div className="playback"><button className="round-play" disabled={!shots.length} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={18} /></button><span>{formatTimelineTime(playhead)} / {formatTimelineTime(timeline.totalDuration)}</span><i><b style={{ width: `${progress}%` }} /></i><input className="timeline-seek" aria-label="成片进度" type="range" min="0" max={timeline.totalDuration || 0} step="0.1" value={Math.min(playhead, timeline.totalDuration)} onChange={(event) => seekTimeline(event.target.value)} /><label>字幕 <input type="checkbox" checked={subtitlesEnabled} onChange={(event) => setSubtitlesEnabled(event.target.checked)} /></label><label><Icon name="volume" size={17} /><input type="range" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label><label className="compact-select"><select><option>9:16</option><option>16:9</option></select><Icon name="chevron" size={13} /></label></div></section>
      <aside className="glass final-one-click-center">
        <header><span><Icon name="spark" size={22} /></span><div><small>AUTO FINISHED VIDEO</small><h2>一键生成配音与成片</h2></div><button type="button" className="secondary-button" onClick={() => setAdvancedEditing((currentValue) => !currentValue)}>{advancedEditing ? '返回简洁模式' : '高级编辑'}</button></header>
        <p>软件会自动完成角色音色、图片、台词配音、镜头视频和本地 MP4 合成，不需要逐页操作。</p>
        <div className="final-one-click-readiness">
          <span className={timeline.readiness.imageReady === timeline.readiness.imageTotal ? 'is-ready' : ''}><Icon name="image" size={17} /><b>画面</b><small>{timeline.readiness.imageReady}/{timeline.readiness.imageTotal}</small></span>
          <span className={timeline.readiness.audioReady === timeline.readiness.audioTotal ? 'is-ready' : ''}><Icon name="mic" size={17} /><b>配音</b><small>{timeline.readiness.audioReady}/{timeline.readiness.audioTotal}</small></span>
          <span className={timeline.items.filter((item) => item.videoReady).length === timeline.items.length ? 'is-ready' : ''}><Icon name="video" size={17} /><b>视频</b><small>{timeline.items.filter((item) => item.videoReady).length}/{timeline.items.length}</small></span>
          <span className={activeEpisodeExportTask ? 'is-ready' : ''}><Icon name="export" size={17} /><b>成片</b><small>{activeEpisodeExportTask ? '已导出' : '待生成'}</small></span>
        </div>
        {activeEpisodeExportTask && <button type="button" className="final-one-click-result" onClick={() => revealExport(activeEpisodeExportTask.result.outputPath)}><Icon name="check" size={17} /><span><strong>本集 MP4 已生成</strong><small title={activeEpisodeExportTask.result.outputPath}>{activeEpisodeExportTask.result.outputPath.split(/[\\/]/u).at(-1)}</small></span><em>打开位置</em></button>}
        {oneClickBusy
          ? <button type="button" className="primary-button final-one-click-action" onClick={onOpenOneClickProgress}><Icon name="spark" size={18} />查看自动制作进度</button>
          : <button type="button" className="primary-button final-one-click-action" disabled={!oneClickPlan?.ok} onClick={onStartOneClick}><Icon name="play" size={18} />{activeEpisodeExportTask ? '重新检查并生成成片' : '一键生成配音和视频'}</button>}
        <small className="final-one-click-safety"><Icon name="shield" size={13} />免费额度用完即停 · 图片主动限流 · 成片只在本机合成</small>
      </aside>
      <aside className={`glass export-panel ${legacyReadOnly ? 'is-legacy-readonly' : ''}`}>
        <h2><Icon name="export" size={20} />本地 MP4 导出</h2>
        <p className="local-export-boundary">本地合成 · 不上传素材</p>
        <section className={`episode-export-identity ${legacyReadOnly ? 'is-legacy' : ''}`}>
          <span><Icon name={legacyReadOnly ? 'history' : 'list'} size={17} /></span>
          <div><small>{legacyReadOnly ? 'LEGACY PROJECT CUT' : `EPISODE ${String(activeEpisodeIndex + 1).padStart(2, '0')}`}</small><strong>{legacyReadOnly ? '旧版全项目成片' : activeEpisodeTitle}</strong></div>
          <em>{legacyReadOnly ? '只读可导出' : '独立制作与导出'}</em>
        </section>
        {legacyReadOnly && <p className="legacy-production-notice"><Icon name="lock" size={14} />旧版内容不会写入任何分集；可预览和导出，但不可继续编辑。</p>}
        <section className={`local-shot-video-card ${selectedLocalVideoAsset ? selectedLocalVideoHealth === 'ready' ? 'is-ready' : selectedLocalVideoHealth === 'checking' ? 'is-checking' : 'is-missing' : 'is-empty'}`}>
          <header><span><Icon name="video" size={17} /></span><div><strong>本地镜头视频</strong><small>{videoRequestItem ? `镜头 ${String(videoRequestItem.index + 1).padStart(2, '0')}` : '当前没有镜头'}</small></div><em>{selectedLocalVideoAsset ? selectedLocalVideoHealth === 'ready' ? '已采用' : selectedLocalVideoHealth === 'checking' ? '检查中' : '媒体缺失' : '未采用'}</em></header>
          {!selectedLocalVideoAsset ? <><p>{videoRequestItem ? '当前镜头尚未采用本地视频' : '请先创建镜头'}</p><button ref={localShotVideoButtonRef} type="button" className="primary-button" disabled={legacyReadOnly || !videoRequestItem || exporting || Boolean(localVideoProcessing)} onClick={startLocalShotVideoImport}><Icon name="upload" size={14} />导入本地 MP4</button></> : <><div className="local-shot-video-summary"><strong title={selectedLocalVideoAsset.fileName}>{selectedLocalVideoAsset.fileName}</strong><small>{selectedLocalVideoAsset.duration.toFixed(1)} 秒 · {selectedLocalVideoAsset.width}×{selectedLocalVideoAsset.height} · {formatAssetBytes(selectedLocalVideoAsset.bytes)}</small><span><Icon name={selectedLocalVideoHealth === 'ready' ? 'check' : 'warning'} size={12} />{selectedLocalVideoHealth === 'ready' ? '真实末帧已保留' : '预览和导出将回退到分镜图'}</span></div><div className="local-shot-video-actions"><button type="button" onClick={() => setLocalVideoDetailOpen(true)}>查看详情</button><button type="button" disabled={legacyReadOnly || exporting || Boolean(localVideoProcessing)} onClick={startLocalShotVideoImport}>替换</button><button type="button" className="is-danger" disabled={legacyReadOnly || exporting} onClick={detachSelectedLocalShotVideo}>解除使用</button></div><button type="button" className={`local-shot-video-continuity ${selectedLocalVideoAlreadyConnected ? 'is-connected' : ''}`} disabled={legacyReadOnly || exporting || selectedLocalVideoHealth === 'missing' || !selectedLocalVideoNextItem || selectedLocalVideoAlreadyConnected || !selectedLocalVideoAsset.lastFrame?.dataUrl} onClick={openShotVideoContinuity}><Icon name="history" size={14} />{selectedLocalVideoAlreadyConnected ? '下一镜头已承接真实末帧' : selectedLocalVideoNextItem ? '连接到下一镜头' : '真实末帧已保留 · 当前为末镜'}</button></>}
        </section>
        <section className={`shot-video-entry-card ${hasVideoRequestFirstFrame ? 'is-ready' : 'is-blocked'}`}>
          <header><span><Icon name="video" size={17} /></span><div><strong>AI 镜头视频</strong><small>{videoRequestItem ? `镜头 ${String(videoRequestItem.index + 1).padStart(2, '0')} · ${videoRequestContinuity ? '承接上一镜头真实末帧' : hasVideoRequestFirstFrame ? '真实首帧已就绪' : '缺少真实首帧'}` : '当前没有镜头'}</small></div><em>0 请求</em></header>
          <button ref={shotVideoButtonRef} type="button" disabled={legacyReadOnly || !videoRequestItem || !hasVideoRequestFirstFrame} aria-haspopup="dialog" aria-controls="shot-video-api-dialog" title={legacyReadOnly ? '旧版全项目成片仅支持预览和导出' : !videoRequestItem ? '请先创建镜头' : !hasVideoRequestFirstFrame ? '请先到分镜页导入当前镜头的真实图片' : '查看当前镜头的 AI 视频请求配置'} onClick={() => { setPlaying(false); setShotVideoDialogOpen(true) }}><Icon name={hasVideoRequestFirstFrame ? 'spark' : 'lock'} size={15} /><span>{legacyReadOnly ? '旧版内容只读' : !videoRequestItem ? '请先创建镜头' : hasVideoRequestFirstFrame ? '预览视频请求' : '缺少真实首帧'}</span><small><Icon name="lock" size={10} />已锁定</small></button>
        </section>
        <button className="preview-all" disabled={!shots.length || exporting} onClick={() => { setPlayhead(0); setPlaying(true) }}><span><strong>{legacyReadOnly ? '从头预览旧版全片' : '从头预览本集'}</strong><small>按时间线连续检查画面、配音与字幕</small></span><Icon name="play" size={18} /></button>
        <h3>成片设置</h3>
        <label className="compact-select compact-select--wide"><span>分辨率</span><select value={resolution} onChange={(event) => setResolution(event.target.value)}><option value="1080x1920">竖屏 1080×1920</option><option value="1920x1080">横屏 1920×1080</option></select><Icon name="chevron" size={14} /></label>
        <div className="export-checks">{readinessRows.map((row) => { const ready = row.ready === row.total && row.total > 0; return <span key={row.key} className={`readiness-${row.key} ${ready ? 'is-ready' : 'is-warning'}`}><Icon name={ready ? 'check' : 'clock'} size={16} /><b>{row.label} {row.ready}/{row.total}</b><small>{ready ? '真实素材检查通过' : `缺失项将使用${row.key === 'image' ? '占位画面' : row.key === 'audio' ? '静音' : '无字幕'}降级`}</small></span> })}<span className="is-ready readiness-provider"><Icon name="check" size={16} /><b>本地 FFmpeg</b><small>无需视频 Provider，不上传素材</small></span></div>
        <div className="motion-export-summary"><span>镜头动效</span><b>{timeline.items.filter((item) => item.motionSettings.motionEffect !== 'none').length}/{timeline.items.length} 已配置</b><small>按镜头设置运动与转场</small></div>
        {exportProgress.message && <div className={`export-progress ${exporting ? 'is-running' : ''}`}><span><b>{exportProgress.message}</b><small>{exportProgress.percent}%</small></span><i><b style={{ width: `${exportProgress.percent}%` }} /></i></div>}
        {exportedPath && <div className="export-result" title={exportedPath}><small>已保存：{exportedPath}</small><button onClick={() => revealExport(exportedPath)}>打开位置</button></div>}
        <div className="export-actions"><button className="primary-button export-mp4-button" disabled={exporting || !shots.length} onClick={requestExportMp4}><Icon name={exporting ? 'clock' : 'export'} size={18} />{exporting ? `本地渲染 ${exportProgress.percent}%` : legacyReadOnly ? '导出旧版全片 MP4' : '导出本集 MP4'}</button>{exporting && <button className="secondary-button cancel-export-button" onClick={cancelExport}>取消</button>}</div>
        <section className="export-history"><header><strong>{legacyReadOnly ? '旧版全片导出记录' : `第 ${activeEpisodeIndex + 1} 集导出记录`}</strong><small>{visibleExportHistory.length} 条</small></header>{visibleExportHistory.length ? visibleExportHistory.slice(0, 3).map((entry) => <button key={`${entry.outputPath}-${entry.exportedAt}`} disabled={!entry.exists} onClick={() => revealExport(entry.outputPath)} title={entry.outputPath}><span><b>{entry.outputPath.split(/[\\/]/u).at(-1)}</b><small>{entry.resolution} · {entry.segmentCount} 镜头{entry.mixedTrackCount ? ` · ${entry.mixedTrackCount} 音轨` : ''}</small></span><em>{entry.exists ? '打开位置' : '文件已移动'}</em></button>) : <p>当前制作范围还没有 MP4 导出记录。</p>}</section>
      </aside>
      <section className={`glass shot-ribbon production-timeline ${legacyReadOnly ? 'is-legacy-readonly' : ''}`} onKeyDown={handleProductionTimelineKeyDown}>
        <header className="production-timeline-header">
          <span><small>{legacyReadOnly ? 'LEGACY PRODUCTION TIMELINE' : `EPISODE ${String(activeEpisodeIndex + 1).padStart(2, '0')} PRODUCTION TIMELINE`}</small><h2>{legacyReadOnly ? '旧版全项目成片时间线' : `第 ${activeEpisodeIndex + 1} 集成片时间线`}（{shots.length} 个镜头）</h2></span>
          <div className="timeline-safety-actions">
            <button className="timeline-history-icon timeline-undo-button" disabled={legacyReadOnly || !timelineHistory.past.length} onClick={undoTimeline} title="撤销 Ctrl+Z" aria-label="撤销时间线操作">↶</button>
            <button className="timeline-history-icon timeline-redo-button" disabled={legacyReadOnly || !timelineHistory.future.length} onClick={redoTimeline} title="重做 Ctrl+Y 或 Ctrl+Shift+Z" aria-label="重做时间线操作">↷</button>
            <button
              className={`timeline-split-button ${splitGuideEmphasis ? 'is-emphasized' : ''}`}
              disabled={legacyReadOnly || exporting || duplicatingShots || splittingShot || multiSelectMode || Boolean(shotInteraction) || Boolean(shotDeleteDialog) || !splitAnalysis.valid}
              onClick={splitCurrentShot}
              onMouseEnter={() => setSplitGuideEmphasis(true)}
              onMouseLeave={() => setSplitGuideEmphasis(false)}
              onFocus={() => setSplitGuideEmphasis(true)}
              onBlur={() => setSplitGuideEmphasis(false)}
              title={multiSelectMode ? '请先退出镜头多选' : !splitAnalysis.valid ? '播放头两侧至少各保留 0.5 秒' : '在播放头位置拆分镜头 Ctrl+B'}
              aria-label="在播放头位置拆分当前镜头，快捷键 Ctrl+B"
            ><Icon name="scissors" size={14} />{splittingShot ? '拆分中…' : '拆分镜头'}</button>
            <button className={`timeline-panel-toggle timeline-history-toggle ${timelineSafetyPanel === 'history' ? 'is-active' : ''}`} disabled={legacyReadOnly} aria-expanded={timelineSafetyPanel === 'history'} onClick={() => setTimelineSafetyPanel((currentPanel) => currentPanel === 'history' ? '' : 'history')}>操作历史 <b>{Math.min(99, timelineHistory.entries.length)}{timelineHistory.entries.length > 99 ? '+' : ''}</b></button>
            <button className={`timeline-panel-toggle timeline-recovery-toggle ${timelineSafetyPanel === 'recovery' ? 'is-active' : ''}`} disabled={legacyReadOnly} aria-expanded={timelineSafetyPanel === 'recovery'} onClick={() => setTimelineSafetyPanel((currentPanel) => currentPanel === 'recovery' ? '' : 'recovery')}><i className={`recovery-status-dot recovery-status-dot--${recoveryStatus}`} />{recoveryStatus === 'saving' || recoveryStatus === 'pending' ? '正在建立…' : `恢复点 ${recoveryPoints.length}`}</button>
            <button className={`timeline-panel-toggle timeline-multiselect-toggle ${multiSelectMode ? 'is-active' : ''}`} disabled={legacyReadOnly || exporting || duplicatingShots || splittingShot || !shots.length} aria-pressed={multiSelectMode} aria-label={`${multiSelectMode ? '退出' : '开启'}镜头多选，当前已选 ${validSelectedShotIds.length} 个`} onClick={toggleMultiSelectMode}><i aria-hidden="true" />{multiSelectMode ? '退出多选' : '多选镜头'}</button>
            <b className="timeline-total">总时长 {formatTimelineTime(timeline.totalDuration)} · {timeline.totalDuration.toFixed(1)} 秒</b>
          </div>
        </header>
        {legacyReadOnly && <div className="legacy-timeline-banner"><Icon name="shield" size={16} /><span><strong>旧版全项目制作内容已安全保留</strong><small>它没有被自动分配给任何剧集；当前仅支持预览与导出。</small></span></div>}
        {timelineSafetyPanel && <section className={`timeline-safety-panel timeline-safety-panel--${timelineSafetyPanel}`}>
          <div className="timeline-operation-history">
            <header><strong>本次操作</strong><small>最多保留 40 步</small></header>
            {timelineHistory.entries.length ? <div className="timeline-history-list">{timelineHistory.entries.slice(0, 4).map((entry) => <span key={entry.id} className={`timeline-history-entry timeline-history-entry--${entry.kind}`} title={entry.label}><i /><b>{entry.label}</b><time>{formatHistoryTime(entry.at)}</time></span>)}</div> : <p>还没有时间线操作。</p>}
          </div>
          <div className="timeline-recovery-points">
            <header><strong>自动恢复点</strong><small>本机保存 · 最多 8 个</small></header>
            {recoveryStatus === 'loading' ? <p>正在读取恢复点…</p> : recoveryPoints.length ? <div className="timeline-recovery-list">{recoveryPoints.slice(0, 4).map((point) => <span className="timeline-recovery-row" key={point.id}><i /><b>{formatHistoryTime(point.savedAt)}</b><small>{point.projectName} · {(point.bytes / 1024 / 1024).toFixed(2)} MB</small><button disabled={restoringRecoveryId === point.id} onClick={() => restoreTimelineRecovery(point)}>{restoringRecoveryId === point.id ? '恢复中…' : '恢复'}</button></span>)}</div> : <p>{recoveryStatus === 'error' ? '恢复点读取失败，项目自动保存不受影响。' : '完成一次时间线编辑后将自动建立恢复点。'}</p>}
          </div>
        </section>}
        {multiSelectMode && <section className="timeline-batch-editor" aria-label="镜头批量编辑">
          <header className="timeline-batch-summary"><b>{validSelectedShotIds.length > 99 ? '99+' : validSelectedShotIds.length}</b><span><strong>已选 {validSelectedShotIds.length} 个镜头</strong><small>合计 {selectedBatchDuration.toFixed(1)} 秒 · {allShotsSelected ? '全部已选，顺序不变' : validSelectedShotIds.length >= 2 ? '可成组拖动' : '选择 2 个可成组拖动'}</small></span></header>
          <div className="timeline-batch-selection-actions">
            <button className="timeline-batch-compact timeline-batch-select-all" disabled={exporting || validSelectedShotIds.length === shots.length} onClick={() => { setSelectedShotIds(shots.map((shot) => shot.id)); setSelectionAnchorId(selectedShot || shots[0]?.id || 0) }}>全选</button>
            <button className="timeline-batch-compact timeline-batch-clear" disabled={exporting || !validSelectedShotIds.length} onClick={() => setSelectedShotIds([])}>清空</button>
            <button className="timeline-batch-compact timeline-batch-duplicate" disabled={exporting || duplicatingShots || splittingShot || !validSelectedShotIds.length || Boolean(shotInteraction)} aria-label={`复制已选 ${validSelectedShotIds.length} 个镜头，副本将插入最后一个所选镜头之后`} onClick={duplicateSelectedShots}><Icon name="copy" size={13} />{duplicatingShots ? '复制中…' : '复制所选'}</button>
            <button className="timeline-batch-compact timeline-batch-delete" disabled={exporting || duplicatingShots || splittingShot || !validSelectedShotIds.length || shotDeleteDialog?.status === 'saving' || Boolean(shotInteraction)} aria-label={`删除已选 ${validSelectedShotIds.length} 个镜头；将先显示确认信息`} onClick={openShotDeleteDialog}><Icon name="trash" size={12} />删除所选</button>
          </div>
          <label className="timeline-batch-field timeline-batch-duration"><span>统一时长</span><i><input type="number" min="0.5" max="30" step="0.1" disabled={exporting} value={batchShotEdits.duration} placeholder={sharedBatchDuration || '混合'} onChange={(event) => setBatchShotEdits((current) => ({ ...current, duration: event.target.value }))} /><em>秒</em></i></label>
          <label className="timeline-batch-field"><span>画面运动</span><select className="timeline-batch-motion" disabled={exporting} value={batchShotEdits.motionEffect} onChange={(event) => setBatchShotEdits((current) => ({ ...current, motionEffect: event.target.value, motionStrength: event.target.value && event.target.value !== 'none' && current.motionStrength === '' ? String(selectedMotionSettings.motionStrength) : current.motionStrength }))}><option value="">不修改</option>{shotMotionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="timeline-batch-field timeline-batch-strength"><span>动效强度</span><i><input type="number" min="5" max="25" step="1" disabled={exporting || !batchShotEdits.motionEffect || batchShotEdits.motionEffect === 'none'} value={batchShotEdits.motionStrength} placeholder="混合" onChange={(event) => setBatchShotEdits((current) => ({ ...current, motionStrength: event.target.value }))} /><em>%</em></i></label>
          <label className="timeline-batch-field"><span>镜头转场</span><select className="timeline-batch-transition" disabled={exporting} value={batchShotEdits.transition} onChange={(event) => setBatchShotEdits((current) => ({ ...current, transition: event.target.value, transitionDuration: event.target.value === 'fade' && current.transitionDuration === '' ? String(selectedMotionSettings.transitionDuration) : current.transitionDuration }))}><option value="">不修改</option>{shotTransitionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="timeline-batch-field timeline-batch-transition-duration"><span>转场时长</span><i><input type="number" min="0.1" max="0.8" step="0.05" disabled={exporting || batchShotEdits.transition !== 'fade'} value={batchShotEdits.transitionDuration} placeholder="混合" onChange={(event) => setBatchShotEdits((current) => ({ ...current, transitionDuration: event.target.value }))} /><em>秒</em></i></label>
          <button className="primary-button timeline-batch-apply" disabled={exporting || duplicatingShots || splittingShot || validSelectedShotIds.length < 2 || !hasBatchShotEdits} onClick={commitBatchShotEdits}>应用到 {validSelectedShotIds.length} 个</button>
        </section>}
        <div
          className={`timeline-track ${multiSelectMode ? 'is-multiselect' : ''} ${shotInteraction?.mode ? `is-${shotInteraction.mode}` : ''} ${shotInteraction?.mode === 'reorder' && shotInteraction.groupShotIds?.length > 1 ? 'is-group-reorder' : ''}`}
          ref={timelineTrackRef}
          data-insertion-index={shotInteraction?.mode === 'reorder' ? shotInteraction.insertionIndex : undefined}
          onPointerMove={(event) => {
            moveShotReorderOnTrack(event)
            moveShotDurationResizeOnTrack(event)
          }}
          onPointerUp={(event) => {
            finishShotReorderOnTrack(event)
            finishShotDurationResizeOnTrack(event)
          }}
          onPointerCancel={(event) => {
            finishShotReorderOnTrack(event, true)
            finishShotDurationResizeOnTrack(event, true)
          }}
        >
          {!timeline.items.length && <div className="timeline-empty-state">
            <Icon name="image" size={28} />
            <span><strong>{legacyReadOnly ? '旧版成片时间线为空' : `第 ${activeEpisodeIndex + 1} 集成片时间线为空`}</strong><small>{legacyReadOnly ? '旧版项目没有可预览的全局镜头。' : '请前往分镜页为本集新增镜头，再继续编排成片。'}</small></span>
            {!legacyReadOnly && <button className="secondary-button" onClick={() => onNavigate('storyboard')}>前往本集分镜</button>}
          </div>}
          {shotInteraction?.mode === 'reorder' && shotInteraction.groupShotIds?.length > 1 && <output className="timeline-group-drag-badge" style={{ left: `${shotInteraction.badgeLeft}px` }} aria-live="polite">
            <i aria-hidden="true"><b /><b /><b /></i>
            <span><strong>移动 {shotInteraction.groupShotIds.length} 个镜头</strong><small>{shotInteraction.moved ? `目标第 ${String(shotInteraction.insertionIndex + 1).padStart(2, '0')} 位` : `合计 ${shotInteraction.groupDuration.toFixed(1)} 秒`}</small></span>
          </output>}
          {timeline.items.map((item) => {
            const isReordering = shotInteraction?.mode === 'reorder' && shotInteraction.shotId === item.shot.id
            const isGroupDragging = shotInteraction?.mode === 'reorder' && shotInteraction.groupShotIds?.length > 1 && activeReorderGroupKeys.has(String(item.shot.id))
            const isResizing = shotInteraction?.mode === 'resize' && shotInteraction.shotId === item.shot.id
            const isBatchSelected = selectedShotKeySet.has(String(item.shot.id))
            const remainingTargetShotId = shotInteraction?.mode === 'reorder' ? shotInteraction.remainingShotIds?.[shotInteraction.insertionIndex] : undefined
            const showDropBefore = shotInteraction?.mode === 'reorder' && String(remainingTargetShotId) === String(item.shot.id)
            const wouldSelectAllForGroup = multiSelectMode && !isBatchSelected && validSelectedShotIds.length === shots.length - 1
            const groupMoveDisabled = allShotsSelected || wouldSelectAllForGroup
            const groupSizeForItem = isBatchSelected ? validSelectedShotIds.length : validSelectedShotIds.length + 1
            const itemVideoAsset = resolveShotVideoAsset(item.shot, videoAssets)
            const itemVideoHealth = itemVideoAsset ? shotVideoHealthMap[itemVideoAsset.id]?.health || 'checking' : 'none'
            return <div
              key={item.id}
              className={`timeline-segment ${item.shot.id === selectedShot ? 'is-active' : ''} ${isBatchSelected ? 'is-batch-selected' : ''} ${isReordering ? 'is-reordering' : ''} ${isGroupDragging ? 'is-group-dragging' : ''} ${isResizing ? 'is-resizing' : ''}`}
              style={{ flexGrow: item.duration }}
              data-shot-id={item.shot.id}
            >
              {showDropBefore && <i className={`timeline-drop-indicator ${shotInteraction.groupShotIds?.length > 1 ? 'timeline-drop-indicator--group' : ''}`} aria-hidden="true">{shotInteraction.groupShotIds?.length > 1 && <span>移动到第 {String(shotInteraction.insertionIndex + 1).padStart(2, '0')} 位</span>}</i>}
              {!multiSelectMode && splitAnalysis.targetItem?.id === item.id && <i
                className={`timeline-split-guide ${splitAnalysis.valid ? 'is-valid' : 'is-invalid'} ${splitGuideEmphasis ? 'is-emphasized' : ''}`}
                style={{ left: `${splitGuidePercent}%` }}
                aria-hidden="true"
              ><span><Icon name="scissors" size={10} /></span></i>}
              <button className="timeline-segment__select" onClick={(event) => selectTimelineItem(item, event)} onKeyDown={(event) => extendTimelineSelection(event, item)} aria-label={`选择镜头 ${item.index + 1}`}>
                <Art variant={item.shot.variant} image={item.shot.image} label={`镜头${item.index + 1}`} />
                {(itemVideoAsset || item.shot.videoContinuitySourceShotId) && <span className="timeline-video-badges">{itemVideoAsset && <i className={itemVideoHealth === 'ready' ? 'is-ready' : 'is-warning'} title={itemVideoHealth === 'ready' ? '本地视频已采用' : '视频缺失，导出将使用分镜图'} aria-label={itemVideoHealth === 'ready' ? '本地视频已采用' : '视频缺失，导出将使用分镜图'}><Icon name={itemVideoHealth === 'ready' ? 'video' : 'warning'} size={10} /></i>}{item.shot.videoContinuitySourceShotId && <i className="is-continuity" title="首帧承接上一镜头真实末帧" aria-label="首帧承接上一镜头真实末帧"><Icon name="history" size={10} /></i>}</span>}
                <span className="timeline-segment__number">{String(item.index + 1).padStart(2, '0')}</span>
                <span className="timeline-segment__time">{formatTimelineTime(item.start)}–{formatTimelineTime(item.end)}</span>
                <span className="timeline-segment__status" aria-label={`素材状态；${getShotMotionLabel(item.motionSettings.motionEffect)}；${item.motionSettings.transition === 'fade' ? `淡入淡出 ${item.motionSettings.transitionDuration} 秒` : '直接切换'}`}><i className={item.imageReady ? 'is-ready' : ''}>画</i><i className={item.audioReady ? 'is-ready' : ''}>音</i><i className={item.subtitleReady ? 'is-ready' : ''}>字</i><i className={`timeline-motion-status ${item.motionSettings.motionEffect !== 'none' ? 'is-ready' : ''}`}>动</i></span>
              </button>
              {multiSelectMode && <button className="timeline-selection-control" aria-pressed={isBatchSelected} aria-label={`${isBatchSelected ? '取消选择' : '选择'}镜头 ${String(item.index + 1).padStart(2, '0')} 进行批量编辑`} onClick={(event) => toggleTimelineItemSelection(event, item)}><span aria-hidden="true">{isBatchSelected ? '✓' : ''}</span></button>}
              <button
                className="timeline-segment__drag"
                disabled={exporting || duplicatingShots || splittingShot || shots.length < 2 || groupMoveDisabled}
                aria-label={multiSelectMode && groupSizeForItem >= 2 ? `拖动成组排序 ${groupSizeForItem} 个镜头，Alt+Shift+方向键可调整` : `拖动排序镜头 ${String(item.index + 1).padStart(2, '0')}，Alt+方向键可调整`}
                title={allShotsSelected ? '全部镜头已选，顺序保持不变' : multiSelectMode && groupSizeForItem >= 2 ? `拖动成组移动 ${groupSizeForItem} 个镜头；Alt+Shift+左右方向键微调` : '拖动排序；Alt+左右方向键微调'}
                onPointerDown={(event) => beginShotReorder(event, item)}
                onPointerMove={(event) => moveShotReorder(event, item)}
                onPointerUp={(event) => finishShotReorder(event, item)}
                onPointerCancel={(event) => finishShotReorder(event, item, true)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                    if (event.shiftKey && multiSelectMode && validSelectedShotIds.length >= 2) {
                      moveShotGroupWithKeyboard(item, event.key === 'ArrowRight' ? 1 : -1)
                    } else {
                      moveShotWithKeyboard(item, event.key === 'ArrowRight' ? 1 : -1)
                    }
                    event.preventDefault()
                  }
                }}
              ><span aria-hidden="true">⋮⋮</span></button>
              {isResizing && <output className="timeline-duration-bubble">{shotInteraction.duration.toFixed(1)} 秒</output>}
              <button
                className="timeline-duration-handle"
                disabled={exporting || duplicatingShots || splittingShot}
                role="slider"
                aria-label={`镜头 ${String(item.index + 1).padStart(2, '0')} 时长`}
                aria-valuemin="0.5"
                aria-valuemax="30"
                aria-valuenow={item.duration}
                title="拖动调整时长；方向键可微调"
                onPointerDown={(event) => beginShotDurationResize(event, item)}
                onPointerMove={(event) => moveShotDurationResize(event, item)}
                onPointerUp={(event) => finishShotDurationResize(event, item)}
                onPointerCancel={(event) => finishShotDurationResize(event, item, true)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    const step = event.shiftKey ? 0.5 : 0.1
                    updateShotDurationWithKeyboard(item, item.duration + (event.key === 'ArrowRight' ? step : -step))
                    event.preventDefault()
                  }
                }}
              ><span aria-hidden="true" /></button>
            </div>
          })}
          {shotInteraction?.mode === 'reorder' && shotInteraction.insertionIndex === shotInteraction.remainingShotIds?.length && <i className={`timeline-drop-indicator timeline-drop-indicator--tail ${shotInteraction.groupShotIds?.length > 1 ? 'timeline-drop-indicator--group' : ''}`} aria-hidden="true">{shotInteraction.groupShotIds?.length > 1 && <span>移动到第 {String(shotInteraction.insertionIndex + 1).padStart(2, '0')} 位</span>}</i>}
        </div>
        <section className="shot-motion-editor">
          <header><strong>镜头动效</strong><small>{selectedMotionItem ? `镜头 ${String(selectedMotionItem.index + 1).padStart(2, '0')}` : '请选择镜头'}</small></header>
          <label>画面运动<select className="shot-motion-preset" disabled={!selectedMotionShot} value={selectedMotionSettings.motionEffect} onChange={(event) => updateSelectedShotMotion({ motionEffect: event.target.value }, '调整镜头运动', `shot-${selectedMotionShot?.id}-motion-effect`)}>{shotMotionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="shot-motion-strength">动效强度<input className="shot-motion-strength-input" type="range" min="5" max="25" step="1" disabled={!selectedMotionShot || selectedMotionSettings.motionEffect === 'none'} value={selectedMotionSettings.motionStrength} onChange={(event) => updateSelectedShotMotion({ motionStrength: Number(event.target.value) }, '调整动效强度', `shot-${selectedMotionShot?.id}-motion-strength`)} /><output>{selectedMotionSettings.motionStrength}%</output></label>
          <label>镜头转场<select className="shot-transition-select" disabled={!selectedMotionShot} value={selectedMotionSettings.transition} onChange={(event) => updateSelectedShotMotion({ transition: event.target.value }, '调整镜头转场', `shot-${selectedMotionShot?.id}-transition`)}>{shotTransitionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>转场时长<span className="shot-transition-duration-wrap"><input className="shot-transition-duration" type="number" min="0.1" max="0.8" step="0.05" disabled={!selectedMotionShot || selectedMotionSettings.transition === 'cut'} value={selectedMotionSettings.transitionDuration} onChange={(event) => updateSelectedShotMotion({ transitionDuration: Number(event.target.value) }, '调整转场时长', `shot-${selectedMotionShot?.id}-transition-duration`)} /><em>秒</em></span></label>
          <button className="secondary-button shot-motion-apply-all" disabled={!selectedMotionShot} onClick={applyShotMotionToAll}>应用到全部</button>
        </section>
        <section className="audio-track-editor">
          <header><span><strong>音乐与音效</strong><small>导入本地音频并在 FFmpeg 导出时混音</small></span><div><label className="secondary-button"><Icon name="volume" size={14} />添加背景音乐<input className="bgm-file-input" type="file" accept="audio/*" onChange={(event) => importAudioTrack(event, 'bgm')} /></label><label className="secondary-button"><Icon name="spark" size={14} />添加音效<input className="sfx-file-input" type="file" accept="audio/*" onChange={(event) => importAudioTrack(event, 'sfx')} /></label></div></header>
          {audioTracks.length ? <div className="audio-track-list">{audioTracks.map(renderAudioTrack)}</div> : <div className="audio-track-empty">尚未添加背景音乐或音效；现有角色配音仍会正常导出。</div>}
        </section>
        <section className="subtitle-track-editor">
          <header>
            <span><strong>字幕时间轴</strong><small>本地编辑、SRT 交换，并在 FFmpeg 导出时烧录</small></span>
            <div>
              <button className="secondary-button subtitle-rebuild-button" onClick={rebuildSubtitlesFromShots}>从分镜重建</button>
              <button className="secondary-button subtitle-import-button" onClick={importSrt}><Icon name="upload" size={13} />导入 SRT</button>
              <button className="secondary-button subtitle-export-button" onClick={exportSrt}><Icon name="export" size={13} />导出 SRT</button>
              <button className="primary-button subtitle-add-button" onClick={addSubtitleCue}><Icon name="plus" size={13} />新增字幕</button>
            </div>
          </header>
          <div className="subtitle-style-controls">
            <label>字号<input className="subtitle-font-size" type="number" min="32" max="96" value={subtitleStyle.fontSize} onChange={(event) => updateSubtitleStyle({ fontSize: Number(event.target.value) })} /></label>
            <label>文字<input className="subtitle-color" type="color" value={subtitleStyle.color} onChange={(event) => updateSubtitleStyle({ color: event.target.value })} /></label>
            <label>描边<input className="subtitle-outline-color" type="color" value={subtitleStyle.outlineColor} onChange={(event) => updateSubtitleStyle({ outlineColor: event.target.value })} /></label>
            <label>位置<select className="subtitle-position" value={subtitleStyle.position} onChange={(event) => updateSubtitleStyle({ position: event.target.value })}><option value="top">顶部</option><option value="middle">居中</option><option value="bottom">底部</option></select></label>
            <label className="subtitle-opacity-control">底色<input className="subtitle-background-opacity" type="range" min="0" max="90" value={subtitleStyle.backgroundOpacity} onChange={(event) => updateSubtitleStyle({ backgroundOpacity: Number(event.target.value) })} /><output>{subtitleStyle.backgroundOpacity}%</output></label>
            <label className="subtitle-bold-control"><input className="subtitle-bold" type="checkbox" checked={subtitleStyle.bold} onChange={(event) => updateSubtitleStyle({ bold: event.target.checked })} />粗体</label>
          </div>
          <div className="subtitle-batch-tools">
            <span>时间工具</span>
            <label>整体偏移<input className="subtitle-offset-input" type="number" step="0.1" value={subtitleOffset} onChange={(event) => setSubtitleOffset(event.target.value)} /><em>秒</em></label>
            <button className="secondary-button subtitle-offset-button" onClick={applySubtitleOffset}>应用偏移</button>
            <button className="secondary-button subtitle-split-button" disabled={!subtitleCues.some((cue) => cue.id === selectedSubtitleCue)} onClick={splitSelectedSubtitleCue}>拆分字幕</button>
            <button className="secondary-button subtitle-merge-button" disabled={subtitleCues.length < 2 || !subtitleCues.some((cue) => cue.id === selectedSubtitleCue)} onClick={mergeSelectedSubtitleCue}>合并相邻</button>
            <small>拖动字幕块移动；拖动左右边缘调整入点和出点</small>
          </div>
          <div className="subtitle-overview-rail">
            {orderedSubtitleCues.map((cue, index) => {
              const left = timeline.totalDuration ? (cue.start / timeline.totalDuration) * 100 : 0
              const width = timeline.totalDuration ? ((cue.end - cue.start) / timeline.totalDuration) * 100 : 0
              return <div
                key={cue.id}
                className={`subtitle-cue-block ${selectedSubtitleCue === cue.id ? 'is-selected' : ''} ${draggingSubtitleCue === cue.id ? 'is-dragging' : ''}`}
                style={{ left: `${left}%`, width: `${Math.max(1, Math.min(100 - left, width))}%` }}
                role="button"
                tabIndex="0"
                onClick={() => selectSubtitleCue(cue)}
                onPointerDown={(event) => beginSubtitleDrag(event, cue)}
                onPointerMove={(event) => moveSubtitleDrag(event, cue)}
                onPointerUp={(event) => finishSubtitleDrag(event, cue)}
                onPointerCancel={(event) => finishSubtitleDrag(event, cue)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    const step = event.shiftKey ? 0.5 : 0.1
                    moveSubtitleCueBy(cue, event.key === 'ArrowRight' ? step : -step)
                    event.preventDefault()
                  }
                }}
                title={`${formatTimelineTime(cue.start)} - ${formatTimelineTime(cue.end)} ${cue.text}`}
              ><i className="subtitle-resize-handle subtitle-resize-handle--start" data-edge="start" /><span>{index + 1}</span><i className="subtitle-resize-handle subtitle-resize-handle--end" data-edge="end" /></div>
            })}
            <i className="subtitle-playhead-marker" style={{ left: `${progress}%` }} aria-hidden="true" />
          </div>
          {orderedSubtitleCues.length ? <div className="subtitle-cue-list">{orderedSubtitleCues.map((cue, index) => (
            <article key={cue.id} className={selectedSubtitleCue === cue.id ? 'is-selected' : ''} onClick={() => setSelectedSubtitleCue(cue.id)}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <label>入<input className="subtitle-cue-start" type="number" min="0" max={Math.max(0, cue.end - 0.1)} step="0.1" value={cue.start} onChange={(event) => updateSubtitleCue(cue.id, { start: Math.min(cue.end - 0.1, Math.max(0, Number(event.target.value) || 0)) })} /></label>
              <label>出<input className="subtitle-cue-end" type="number" min={cue.start + 0.1} max={timeline.totalDuration} step="0.1" value={cue.end} onChange={(event) => updateSubtitleCue(cue.id, { end: Math.min(timeline.totalDuration, Math.max(cue.start + 0.1, Number(event.target.value) || cue.start + 0.1)) })} /></label>
              <textarea className="subtitle-cue-text" rows="1" maxLength="500" value={cue.text} onChange={(event) => updateSubtitleCue(cue.id, { text: event.target.value })} />
              <button onClick={() => removeSubtitleCue(cue.id)} title="删除字幕"><Icon name="trash" size={12} /></button>
            </article>
          ))}</div> : <div className="audio-track-empty">当前没有字幕；可以从分镜重建、导入 SRT 或新增字幕。</div>}
        </section>
      </section>
      {exportConfirmOpen && <div className="export-confirm-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportConfirmOpen(false) }}>
        <section ref={exportConfirmModalRef} className="export-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="export-confirm-title" aria-describedby="export-confirm-description">
          <header><span><Icon name="warning" size={22} /></span><div><h2 id="export-confirm-title">素材尚未完整</h2><p id="export-confirm-description">继续导出会使用兼容内容降级，原项目素材不会被修改。</p></div></header>
          <div className="export-confirm-issues" aria-label="缺失素材统计">{exportReadinessIssues.map((issue) => <article key={issue.key}><Icon name={issue.key === 'image' ? 'image' : issue.key === 'audio' ? 'mic' : 'script'} size={18} /><strong>{issue.label}缺失 {issue.missing} 项</strong><small>导出时使用{issue.fallback}</small></article>)}</div>
          <div className="export-confirm-notice"><Icon name="shield" size={17} /><span><strong>仅影响本次导出结果</strong><small>项目内容、原始图片、音频和字幕不会被删除或覆盖。</small></span></div>
          <footer><button type="button" ref={exportConfirmCancelRef} className="secondary-button" onClick={() => setExportConfirmOpen(false)}>返回补充素材</button><button type="button" className="export-confirm-continue" onClick={confirmDegradedExport}>仍然导出</button></footer>
        </section>
      </div>}
      {shotDeleteDialog && <div className="shot-delete-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShotDeleteDialog() }}>
        <section className="shot-delete-modal" ref={shotDeleteModalRef} role="alertdialog" aria-modal="true" aria-labelledby="shot-delete-title" aria-describedby="shot-delete-description">
          <header className="shot-delete-header">
            <span><Icon name="trash" size={20} /></span>
            <div><h2 id="shot-delete-title">{shotDeleteDialog.impact.allSelected ? `删除全部 ${shotDeleteDialog.impact.targetIds.length} 个镜头？` : shotDeleteDialog.impact.targetIds.length === 1 ? '删除这个镜头？' : `删除 ${shotDeleteDialog.impact.targetIds.length} 个镜头？`}</h2><p id="shot-delete-description">这些镜头会从项目分镜与成片时间线中移除。</p></div>
          </header>
          <div className="shot-delete-consequence"><strong>{shotDeleteDialog.impact.allSelected ? '删除后成片时间线将为空，导出按钮会停用。' : `删除后成片将缩短 ${shotDeleteDialog.impact.removedDuration.toFixed(1)} 秒，剩余 ${shotDeleteDialog.impact.remainingShots.length} 个镜头。`}</strong><small>源台词、角色、剧集与场景不会删除。</small></div>
          <div className="shot-delete-stats" aria-label="删除影响统计">
            <span><b>{shotDeleteDialog.impact.targetIds.length}</b><small>镜头</small></span>
            <span><b>{shotDeleteDialog.impact.removedSubtitleCount}</b><small>关联字幕</small></span>
            <span><b>{shotDeleteDialog.impact.removedSfxCount}</b><small>时间线音效</small></span>
          </div>
          <div className={`shot-delete-recovery shot-delete-recovery--${shotDeleteDialog.status}`}>
            <span className="shot-delete-recovery__icon"><Icon name={shotDeleteDialog.status === 'error' ? 'warning' : 'history'} size={17} /></span>
            <div><strong>{shotDeleteDialog.status === 'saving' ? '正在建立恢复点…' : shotDeleteDialog.status === 'error' ? '恢复点建立失败，镜头尚未删除。' : '删除前会先建立本地恢复点'}</strong><small>{shotDeleteDialog.status === 'error' ? shotDeleteDialog.error : '确认后仍可使用 Ctrl+Z 或操作历史撤销。'}</small></div>
          </div>
          <footer className="shot-delete-actions">
            <button className="secondary-button" ref={shotDeleteCancelRef} disabled={shotDeleteDialog.status === 'saving'} onClick={closeShotDeleteDialog}>取消</button>
            <button className="shot-delete-confirm" disabled={shotDeleteDialog.status === 'saving'} onClick={confirmShotDeletion}>{shotDeleteDialog.status === 'saving' ? <><i aria-hidden="true" />建立恢复点…</> : shotDeleteDialog.status === 'error' ? '重试' : shotDeleteDialog.impact.allSelected ? '删除全部镜头' : `删除 ${shotDeleteDialog.impact.targetIds.length} 个镜头`}</button>
          </footer>
        </section>
      </div>}
      {shotDeleteUndo && <div className={`shot-delete-undo shot-delete-undo--${shotDeleteUndo.kind || 'delete'}`} role="status"><span>{shotDeleteUndo.kind === 'duplicate'
        ? `已复制 ${shotDeleteUndo.count} 个镜头，插入到第 ${String(shotDeleteUndo.insertionPosition).padStart(2, '0')} 位`
        : shotDeleteUndo.kind === 'split'
          ? `已拆分镜头 ${String(shotDeleteUndo.shotNumber).padStart(2, '0')}：${shotDeleteUndo.leftDuration.toFixed(1)} 秒 + ${shotDeleteUndo.rightDuration.toFixed(1)} 秒`
          : `已删除 ${shotDeleteUndo.count} 个镜头，可撤销`}</span><button onClick={undoTimeline}>撤销</button></div>}
    </main>
    {legacyMigrationOpen && legacyProduction && createPortal(<div className="episode-migration-layer" role="presentation">
      <section className="episode-migration-dialog" role="dialog" aria-modal="true" aria-labelledby="episode-migration-title" aria-describedby="episode-migration-description">
        <header><span><Icon name="shield" size={23} /></span><div><small>PROJECT V2 MIGRATION</small><h2 id="episode-migration-title">旧版成片已安全保留</h2><p id="episode-migration-description">检测到这个多集项目原先共用一条全项目时间线。系统没有猜测归属，也没有把旧字幕或音轨写进任何一集。</p></div></header>
        <div className="episode-migration-facts">
          <article><small>旧版内容</small><strong>{legacyProduction.subtitleCues.length} 条字幕 · {legacyProduction.audioTracks.length} 条音轨</strong><span>作为只读“旧版全项目成片”保留</span></article>
          <article><small>新分集工作区</small><strong>{episodes.length} 集独立制作</strong><span>镜头、字幕、音轨、历史、恢复点与导出互不串集</span></article>
        </div>
        <div className="episode-migration-safety"><Icon name="lock" size={15} /><span><strong>保存时会升级到项目结构 V2</strong><small>第一次覆盖原 V1 文件前，会在同目录自动建立一份备份。</small></span></div>
        <footer><button type="button" className="secondary-button" onClick={() => { switchProductionScope('legacy'); setLegacyMigrationOpen(false) }}>查看旧版全片</button><button type="button" className="primary-button" onClick={() => { switchProductionScope(`episode:${activeEpisode?.id || episodes[0]?.id || 1}`); setLegacyMigrationOpen(false) }}>开始分集制作</button></footer>
      </section>
    </div>, document.body)}
    {shotVideoDialogOpen && resolvedVideoRequestItem && hasVideoRequestFirstFrame && <ShotVideoRequestDialog item={resolvedVideoRequestItem} nextItem={videoRequestNextItem} episode={videoRequestEpisode} scene={videoRequestScene} providerConfig={videoProviderConfig} bailianStatus={bailianStatus} onClose={closeShotVideoDialog} onOpenSettings={onOpenVideoSettings} returnFocusRef={shotVideoButtonRef} />}
    {localVideoProcessing && <LocalShotVideoProcessingDialog progress={localVideoProcessing} onCancel={cancelLocalShotVideoProcessing} />}
    {localVideoReview && <LocalShotVideoAdoptionDialog review={localVideoReview} shot={shots.find((shot) => String(shot.id) === String(localVideoReview.shotId)) || emptyShotVideoItem} shotNumber={localVideoReview.shotNumber} busy={localVideoAdoptionBusy} onCancel={discardLocalVideoReview} onChooseAgain={chooseAnotherLocalShotVideo} onAdopt={adoptLocalShotVideo} />}
    {shotVideoContinuityDialog && <ShotVideoContinuityDialog {...shotVideoContinuityDialog} onCancel={() => setShotVideoContinuityDialog(null)} onConfirm={confirmShotVideoContinuity} />}
    {localVideoDetailOpen && selectedLocalVideoAsset && <LocalShotVideoDetailDialog asset={selectedLocalVideoAsset} mediaUrl={shotVideoHealthMap[selectedLocalVideoAsset.id]?.mediaUrl || ''} health={selectedLocalVideoHealth} onClose={() => setLocalVideoDetailOpen(false)} onReveal={async () => { const result = await shotVideoAssetRepository.reveal(projectLocalId, selectedLocalVideoAsset.id); if (!result.ok) onNotice(result.error || '无法打开托管位置') }} />}
    </>
  )
}

const settingsCapabilityDetails = {
  script: { label: '剧本生成', description: '故事扩写、对白和结构化剧本', icon: 'script' },
  image: { label: '图像生成', description: '角色设定、场景和分镜画面', icon: 'image' },
  voice: { label: '配音生成', description: '角色声音、旁白与对白音频', icon: 'mic' },
  video: { label: '视频生成', description: '分镜动画与成片合成', icon: 'video' },
}

const SETTINGS_ACTIVE_CAPABILITY_KEY = 'manju-creation.settings.active-capability'

const getInitialSettingsCapability = () => {
  try {
    const saved = window.sessionStorage.getItem(SETTINGS_ACTIVE_CAPABILITY_KEY)
    if (providerCapabilities.some((capability) => capability.id === saved)) return saved
  } catch {
    // Session preference is optional; the settings page remains usable without it.
  }
  return providerCapabilities[0].id
}

const getSettingsStatusTone = (state) => {
  if (state === '连接成功' || state === '演示模式' || state === '本地 Key 已接入') return 'success'
  if (state === '连接失败') return 'danger'
  if (state === '测试中' || state === '有修改') return 'warning'
  return 'muted'
}

function SettingsPage({
  settings,
  setSettings,
  connectionStates,
  setConnectionStates,
  bailianStatus,
  zeroCostSettings,
  onOpenZeroCostSafety,
  onNotice,
}) {
  const [activeCapability, setActiveCapability] = useState(getInitialSettingsCapability)
  const [dirtyCapabilities, setDirtyCapabilities] = useState({})
  const [revealedKeys, setRevealedKeys] = useState({})
  const [activityLog, setActivityLog] = useState([])
  const tabRefs = useRef({})
  const activitySequence = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

  const activeDetails = settingsCapabilityDetails[activeCapability]
  const activeConfig = settings[activeCapability]
  const activeState = dirtyCapabilities[activeCapability]
    ? '有修改'
    : connectionStates[activeCapability] || activeConfig.status || '未配置'
  const isTesting = connectionStates[activeCapability] === '测试中'
  const isBailian = activeConfig.provider === bailianProviderName

  const resolveState = (capability) => dirtyCapabilities[capability]
    ? '有修改'
    : connectionStates[capability] || settings[capability].status || '未配置'

  const addActivity = (capability, action, status, message) => {
    activitySequence.current += 1
    const details = settingsCapabilityDetails[capability]
    setActivityLog((current) => [{
      id: `${Date.now()}-${activitySequence.current}`,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      capability: details.label,
      action,
      status,
      message,
    }, ...current].slice(0, 20))
  }

  const selectCapability = (capability) => {
    setActiveCapability(capability)
    try {
      window.sessionStorage.setItem(SETTINGS_ACTIVE_CAPABILITY_KEY, capability)
    } catch {
      // Session preference is optional; selection still changes in memory.
    }
  }

  const update = (capability, field, value) => {
    setSettings((current) => ({
      ...current,
      [capability]: { ...current[capability], [field]: value },
    }))
    setDirtyCapabilities((current) => ({ ...current, [capability]: true }))
  }

  const test = async (capability) => {
    setConnectionStates((current) => ({ ...current, [capability]: '测试中' }))
    const result = await providerRegistry.test(capability, settings[capability])
    if (!mountedRef.current) return
    const demoMode = settings[capability].provider === '演示适配器'
    const nextState = result.ok ? (demoMode ? '演示模式' : '连接成功') : '连接失败'
    const message = demoMode && result.ok ? '演示测试完成，未发起真实外部请求' : result.message
    setConnectionStates((current) => ({ ...current, [capability]: nextState }))
    addActivity(capability, '测试连接', nextState, message)
    onNotice(message)
  }

  const save = (capability) => {
    const usesBailianKey = settings[capability].provider === bailianProviderName && bailianStatus?.configured
    const nextState = settings[capability].provider === '演示适配器'
      ? '演示模式'
      : usesBailianKey ? '本地 Key 已接入' : '未配置'
    const nextSettings = {
      ...settings,
      [capability]: { ...settings[capability], status: nextState },
    }
    setSettings(nextSettings)
    saveProviderSettings(nextSettings)
    setDirtyCapabilities((current) => ({ ...current, [capability]: false }))
    setConnectionStates((current) => ({ ...current, [capability]: nextState }))
    const message = usesBailianKey
      ? '配置已保存；Key 继续由 Electron 主进程从本地文件读取'
      : '已保存到本机，API Key 未写入持久化配置'
    addActivity(capability, '保存配置', nextState, message)
    onNotice(message)
  }

  const selectCapabilityByKeyboard = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? providerCapabilities.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + providerCapabilities.length) % providerCapabilities.length
    const targetCapability = providerCapabilities[targetIndex].id
    selectCapability(targetCapability)
    tabRefs.current[targetCapability]?.focus()
  }

  return (
    <main className="page settings-page settings-page--v22" data-settings-version="v22">
      <section className="settings-control-shell">
        <header className="settings-control-header">
          <div>
            <span className="settings-eyebrow"><Icon name="spark" size={14} />Provider Control Center</span>
            <h1>AI 接口设置</h1>
            <p>为剧本、图像、配音和视频配置生成服务</p>
          </div>
          <div className="settings-mode-summary" aria-label="设置模式">
            <span><b>{providerCapabilities.length}</b> 项能力</span>
            <span><i />{bailianStatus?.configured ? '百炼本地 Key' : '本地演示'}</span>
          </div>
        </header>

        <div className="settings-provider-switcher" role="tablist" aria-label="生成能力">
          {providerCapabilities.map((capability, index) => {
            const details = settingsCapabilityDetails[capability.id]
            const state = resolveState(capability.id)
            const selected = capability.id === activeCapability
            return (
              <button
                key={capability.id}
                ref={(node) => { tabRefs.current[capability.id] = node }}
                id={`settings-tab-${capability.id}`}
                className={`settings-provider-tile ${selected ? 'is-selected' : ''}`}
                role="tab"
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls="settings-provider-panel"
                onClick={() => selectCapability(capability.id)}
                onKeyDown={(event) => selectCapabilityByKeyboard(event, index)}
              >
                <span className="settings-provider-tile__icon"><Icon name={details.icon} size={19} /></span>
                <span className="settings-provider-tile__copy"><strong>{details.label}</strong><small>{details.description}</small></span>
                <StatusPill tone={getSettingsStatusTone(state)}>{state}</StatusPill>
                {dirtyCapabilities[capability.id] && <i className="settings-dirty-dot" title="有未保存修改" />}
              </button>
            )
          })}
        </div>

        <div className="settings-workspace">
          <article
            className="settings-provider-panel"
            id="settings-provider-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeCapability}`}
          >
            <header className="settings-provider-panel__header">
              <span className="settings-active-icon"><Icon name={activeDetails.icon} size={23} /></span>
              <div><h2>{activeDetails.label}</h2><p>{activeDetails.description}</p></div>
              <span className="settings-active-state" aria-live="polite"><StatusPill tone={getSettingsStatusTone(activeState)}>{activeState}</StatusPill></span>
            </header>

            <div className="settings-provider-form">
              <label>
                <span>服务提供方</span>
                <select value={activeConfig.provider} onChange={(event) => update(activeCapability, 'provider', event.target.value)}>
                  <option>演示适配器</option>
                  <option>{bailianProviderName}</option>
                  <option>自定义接口（预留）</option>
                </select>
              </label>
              <label>
                <span>模型</span>
                <input value={activeConfig.model} disabled={isBailian} onChange={(event) => update(activeCapability, 'model', event.target.value)} placeholder="输入模型名称" />
              </label>
              <label className="settings-field-wide">
                <span>Base URL</span>
                <input value={activeConfig.endpoint} disabled={isBailian} onChange={(event) => update(activeCapability, 'endpoint', event.target.value)} placeholder="https://api.example.com/v1" />
              </label>
              <label className="settings-field-wide">
                <span>{isBailian ? '本地 Key' : 'API Key'} <small>{isBailian ? '仅主进程可读' : '仅保留在当前会话'}</small></span>
                {isBailian ? <span className={`settings-local-key-status ${bailianStatus?.configured ? 'is-ready' : 'is-missing'}`}>
                  <Icon name={bailianStatus?.configured ? 'shield' : 'warning'} size={17} />
                  <span><strong>{bailianStatus?.configured ? '已从 key.txt 安全加载' : '未找到可用的 key.txt'}</strong><small>{bailianStatus?.configured ? `${bailianStatus.source} · ${bailianStatus.keyType}${bailianStatus.paidGenerationEnabled ? '' : ' · 付费生成已锁定'}` : bailianStatus?.error || '请将 key.txt 放在项目或应用目录'}</small></span>
                </span> : <span className="settings-key-field">
                    <input
                      type={revealedKeys[activeCapability] ? 'text' : 'password'}
                      value={activeConfig.apiKey}
                      onChange={(event) => update(activeCapability, 'apiKey', event.target.value)}
                      placeholder="输入 API Key"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="settings-key-toggle"
                      onClick={() => setRevealedKeys((current) => ({ ...current, [activeCapability]: !current[activeCapability] }))}
                      aria-label={revealedKeys[activeCapability] ? '隐藏 API Key' : '显示 API Key'}
                    >{revealedKeys[activeCapability] ? '隐藏' : '显示'}</button>
                  </span>}
              </label>
            </div>

            <footer className="settings-provider-actions">
              <span className={dirtyCapabilities[activeCapability] ? 'has-changes' : ''}>
                <i />{dirtyCapabilities[activeCapability] ? '有未保存修改' : '配置与本机记录一致'}
              </span>
              <div>
                <button className="secondary-button settings-test-button" disabled={isTesting} onClick={() => test(activeCapability)}>
                  {isTesting ? <><i className="settings-spinner" />测试中…</> : '测试连接'}
                </button>
                <button className="primary-button settings-save-button" onClick={() => save(activeCapability)}>保存配置</button>
              </div>
            </footer>
          </article>

          <aside className="settings-status-rail">
            <section className={`settings-zero-cost-card ${zeroCostSettings?.confirmed ? 'is-ready' : ''}`} data-testid="settings-zero-cost-card">
              <header><span><Icon name="shield" size={19} /></span><div><small>ZERO-COST AUTOMATION</small><h2>0 元自动化</h2></div></header>
              <strong>{zeroCostSettings?.confirmed ? '已由用户确认' : zeroCostSettings?.invalidatedByModelChange ? '模型变化，需重新确认' : '尚未设置'}</strong>
              <p>额度耗尽必须由百炼控制台停止；软件不显示虚假的实时余额，也不自动换模型。</p>
              <button type="button" className="secondary-button" onClick={onOpenZeroCostSafety}>{zeroCostSettings?.confirmed ? '重新检查确认' : '设置免费额度保护'}</button>
            </section>
            <section className="settings-security-notice">
              <span><Icon name="shield" size={19} /></span>
              <div><h2>主进程保密</h2><p>{bailianStatus?.configured ? 'Key 已由 Electron 主进程读取，页面、项目文件与构建产物均无法取得密钥。' : '非密钥配置保存在当前设备；API Key 不写入项目或构建产物。'}</p></div>
            </section>

            <section className="settings-capability-summary">
              <header><h2>能力状态</h2><span>{providerCapabilities.filter((item) => ['演示模式', '连接成功', '本地 Key 已接入'].includes(resolveState(item.id))).length}/{providerCapabilities.length} 就绪</span></header>
              <div>
                {providerCapabilities.map((capability) => {
                  const details = settingsCapabilityDetails[capability.id]
                  const state = resolveState(capability.id)
                  return <button key={capability.id} className={capability.id === activeCapability ? 'is-active' : ''} onClick={() => selectCapability(capability.id)}><span><Icon name={details.icon} size={15} />{details.label}</span><small data-tone={getSettingsStatusTone(state)}><i />{state}</small></button>
                })}
              </div>
            </section>

            <section className="settings-activity-log">
              <header><h2>本次会话</h2><span>{activityLog.length ? `${activityLog.length} 条` : '未运行'}</span></header>
              {activityLog.length ? <div className="settings-activity-list">{activityLog.map((entry) => (
                <article key={entry.id}>
                  <span data-tone={getSettingsStatusTone(entry.status)}><i /></span>
                  <div><strong>{entry.capability} · {entry.action}</strong><small>{entry.message}</small></div>
                  <time>{entry.time}</time>
                </article>
              ))}</div> : <div className="settings-activity-empty"><Icon name="history" size={22} /><strong>还没有测试或保存记录</strong><span>操作结果只记录在本次设置会话中</span></div>}
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}

function BailianScriptConfirmModal({ confirmation, busy, onCancel, onConfirm }) {
  const modalRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(modalRef.current?.querySelectorAll('button:not(:disabled)') || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        last.focus()
        event.preventDefault()
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus()
        event.preventDefault()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  const dryRun = confirmation.dryRun
  return <div className="bailian-script-confirm-layer" onMouseDown={(event) => {
    if (!busy && event.target === event.currentTarget) onCancel()
  }}>
    <section ref={modalRef} className="bailian-script-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="bailian-script-confirm-title" aria-describedby="bailian-script-confirm-description">
      <header><span><Icon name="sparkles" size={22} /></span><div><small>PAID API CONFIRMATION</small><h2 id="bailian-script-confirm-title">确认使用百炼生成剧本</h2><p id="bailian-script-confirm-description">下一步会向阿里云百炼发送一次真实请求，可能产生模型调用费用。</p></div></header>
      <div className="bailian-script-confirm-summary">
        <article><small>服务与模型</small><strong>阿里云百炼 · {dryRun.model}</strong><span>固定安全端点，不允许页面改写</span></article>
        <article><small>发送内容</small><strong>故事灵感与创作参数</strong><span>题材、画幅、目标时长；不会发送本地 Key</span></article>
        <article><small>结果处理</small><strong>生成后自动转为项目</strong><span>角色、场景、分镜与台词会保存到本机</span></article>
      </div>
      <div className="bailian-script-confirm-notice"><Icon name="shield" size={18} /><span><strong>已通过请求干跑检查</strong><small>{dryRun.responseFormat} · 最多 {dryRun.maximumOutputTokens} 输出 Token · 当前尚未创建付费任务</small></span></div>
      {confirmation.error && <div className="bailian-script-confirm-error" role="alert"><Icon name="warning" size={17} /><span><strong>生成未完成</strong><small>{confirmation.error}</small></span></div>}
      <footer><button type="button" ref={cancelRef} className="secondary-button" disabled={busy} onClick={onCancel}>取消</button><button type="button" className="bailian-script-confirm-submit" disabled={busy} onClick={onConfirm}>{busy ? <><i aria-hidden="true" />百炼正在生成…</> : confirmation.error ? '重试生成' : '确认并生成剧本'}</button></footer>
    </section>
  </div>
}

function App() {
  const validPages = new Set(['studio', 'home', 'overview', 'script', 'character', 'assets', 'storyboard', 'voice', 'final', 'settings'])
  const initialPage = new URLSearchParams(window.location.search).get('page')
  const [page, setPage] = useState(validPages.has(initialPage) ? initialPage : 'studio')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [projectMeta, setProjectMeta] = useState(defaultProjectMeta)
  const [storySeed, setStorySeed] = useState(defaultStorySeed)
  const [episodes, setEpisodes] = useState(initialEpisodes)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [scenes, setScenes] = useState(initialScenes)
  const [selectedScene, setSelectedScene] = useState(1)
  const [characters, setCharacters] = useState(initialCharacters)
  const [propAssets, setPropAssets] = useState(initialPropAssets)
  const [selectedCharacter, setSelectedCharacter] = useState(0)
  const [shots, setShots] = useState(initialShots)
  const [selectedShot, setSelectedShot] = useState(0)
  const [lines, setLines] = useState(initialDialogue)
  const [videoAssets, setVideoAssets] = useState(initialVideoAssets)
  const [episodeProductions, setEpisodeProductions] = useState(initialEpisodeProductions)
  const [legacyProduction, setLegacyProduction] = useState(initialLegacyProduction)
  const [timelineHistories, setTimelineHistories] = useState({})
  const [selectedSpeaker, setSelectedSpeaker] = useState('')
  const [providerSettings, setProviderSettings] = useState(() => loadProviderSettings(createDefaultProviderSettings()))
  const [connectionStates, setConnectionStates] = useState({})
  const [bailianStatus, setBailianStatus] = useState({ ok: true, configured: false, loading: true })
  const [scriptGenerationConfirmation, setScriptGenerationConfirmation] = useState(null)
  const [currentFile, setCurrentFile] = useState('')
  const [recentProjects, setRecentProjects] = useState([])
  const [storageMigrationRequest, setStorageMigrationRequest] = useState(null)
  const [zeroCostSettings, setZeroCostSettings] = useState(() => loadZeroCostAutomationSettings())
  const [zeroCostSafetyMode, setZeroCostSafetyMode] = useState('')
  const [oneClickRun, setOneClickRun] = useState(null)
  const [oneClickProgressMinimized, setOneClickProgressMinimized] = useState(false)
  const noticeTimer = useRef(null)
  const projectBootstrapped = useRef(false)
  const menuCommandHandlers = useRef({})
  const oneClickCompletionHandled = useRef('')

  const activeEpisodeProduction = useMemo(
    () => getEpisodeProduction(episodeProductions, selectedEpisode, initialSubtitleStyle),
    [episodeProductions, selectedEpisode],
  )
  const updateActiveProductionField = useCallback((field, valueOrUpdater) => {
    setEpisodeProductions((current) => updateEpisodeProduction(
      current,
      selectedEpisode,
      (production) => ({
        ...production,
        [field]: typeof valueOrUpdater === 'function'
          ? valueOrUpdater(production[field])
          : valueOrUpdater,
      }),
      initialSubtitleStyle,
    ))
  }, [selectedEpisode])
  const audioTracks = activeEpisodeProduction.audioTracks
  const subtitleCues = activeEpisodeProduction.subtitleCues
  const subtitleCuesInitialized = activeEpisodeProduction.subtitleCuesInitialized
  const subtitleStyle = activeEpisodeProduction.subtitleStyle
  const setAudioTracks = useCallback((valueOrUpdater) => (
    updateActiveProductionField('audioTracks', valueOrUpdater)
  ), [updateActiveProductionField])
  const setSubtitleCues = useCallback((valueOrUpdater) => (
    updateActiveProductionField('subtitleCues', valueOrUpdater)
  ), [updateActiveProductionField])
  const setSubtitleCuesInitialized = useCallback((valueOrUpdater) => (
    updateActiveProductionField('subtitleCuesInitialized', valueOrUpdater)
  ), [updateActiveProductionField])
  const setSubtitleStyle = useCallback((valueOrUpdater) => (
    updateActiveProductionField('subtitleStyle', valueOrUpdater)
  ), [updateActiveProductionField])
  const timelineHistory = timelineHistories[selectedEpisode] || createEmptyTimelineHistory()
  const setTimelineHistory = useCallback((valueOrUpdater) => {
    setTimelineHistories((current) => {
      const previous = current[selectedEpisode] || createEmptyTimelineHistory()
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(previous) : valueOrUpdater
      return { ...current, [selectedEpisode]: next }
    })
  }, [selectedEpisode])
  const allEpisodeAudioTracks = useMemo(
    () => flattenEpisodeAudioTracks(episodeProductions, legacyProduction),
    [episodeProductions, legacyProduction],
  )

  useEffect(() => {
    const episodeIds = new Set(episodes.map((episode) => Number(episode.id)))
    setEpisodeProductions((current) => {
      const retained = current.filter((production) => episodeIds.has(Number(production.episodeId)))
      const retainedIds = new Set(retained.map((production) => Number(production.episodeId)))
      const added = episodes
        .filter((episode) => !retainedIds.has(Number(episode.id)))
        .map((episode) => createEmptyEpisodeProduction(episode.id, initialSubtitleStyle))
      const next = [...retained, ...added]
      return next.length === current.length
        && next.every((production, index) => production === current[index])
        ? current
        : next
    })
    setTimelineHistories((current) => {
      const entries = Object.entries(current).filter(([episodeId]) => episodeIds.has(Number(episodeId)))
      if (entries.length === Object.keys(current).length) return current
      return Object.fromEntries(entries)
    })
  }, [episodes])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    let active = true
    providerRegistry.getBailianStatus()
      .then((status) => {
        if (!active) return
        const nextStatus = status || { ok: false, configured: false, error: '百炼状态读取失败' }
        setBailianStatus({ ...nextStatus, loading: false })
        if (!nextStatus.ok || !nextStatus.configured) return
        setProviderSettings((current) => {
          const next = applyBailianStatusToSettings(current, nextStatus)
          saveProviderSettings(next)
          return next
        })
        setConnectionStates((current) => Object.fromEntries(providerCapabilities.map(({ id }) => [
          id,
          current[id] || (nextStatus.capabilities?.[id]?.supported ? '本地 Key 已接入' : undefined),
        ]).filter(([, value]) => value)))
      })
      .catch((error) => {
        if (active) setBailianStatus({ ok: false, configured: false, loading: false, error: error instanceof Error ? error.message : '百炼状态读取失败' })
      })
    return () => {
      active = false
    }
  }, [])

  const hasProject = Boolean(projectMeta.localProjectId && episodes.length)
  const projectSnapshot = useMemo(() => createProjectSnapshot({
    projectMeta,
    storySeed,
    episodes,
    scenes,
    characters,
    props: propAssets,
    shots,
    lines,
    videoAssets,
    episodeProductions,
    legacyProduction,
  }), [projectMeta, storySeed, episodes, scenes, characters, propAssets, shots, lines, videoAssets, episodeProductions, legacyProduction])
  const oneClickPlan = useMemo(
    () => createOneClickProductionPlan(projectSnapshot),
    [projectSnapshot],
  )

  const applySnapshot = (snapshot) => {
    const loaded = readProjectSnapshot(snapshot, {
      projectMeta: defaultProjectMeta,
      storySeed: defaultStorySeed,
      episodes: initialEpisodes,
      scenes: initialScenes,
      characters: initialCharacters,
      props: initialPropAssets,
      shots: initialShots,
      lines: initialDialogue,
      videoAssets: initialVideoAssets,
      audioTracks: initialAudioTracks,
      subtitleCues: initialSubtitleCues,
      subtitleCuesInitialized: false,
      subtitleStyle: initialSubtitleStyle,
    })
    setProjectMeta(loaded.projectMeta)
    setStorySeed(loaded.storySeed)
    setEpisodes(loaded.episodes)
    setScenes(loaded.scenes)
    setCharacters(loaded.characters)
    setPropAssets(loaded.props)
    setShots(loaded.shots)
    setLines(loaded.lines)
    setVideoAssets(loaded.videoAssets)
    setEpisodeProductions(loaded.episodeProductions)
    setLegacyProduction(loaded.legacyProduction)
    setTimelineHistories({})
    setSelectedEpisode(loaded.episodes[0]?.id || 1)
    setSelectedScene(loaded.scenes.find((scene) => scene.episodeId === loaded.episodes[0]?.id)?.id || loaded.scenes[0]?.id || 1)
    setSelectedCharacter(loaded.characters[0]?.id || 1)
    setSelectedShot(loaded.shots[0]?.id || 0)
    setSelectedSpeaker(loaded.characters[0]?.name || '')
    return loaded
  }

  useEffect(() => {
    let active = true
    Promise.all([projectRepository.loadAutosave(), projectRepository.listRecent()])
      .then(([autosave, recentResult]) => {
        if (!active) return
        if (autosave.ok && autosave.snapshot && !isLegacyBuiltInDemoSnapshot(autosave.snapshot)) applySnapshot(autosave.snapshot)
        if (recentResult.ok && Array.isArray(recentResult.recents)) setRecentProjects(recentResult.recents)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) projectBootstrapped.current = true
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!projectBootstrapped.current || !hasProject) return undefined
    const autosaveTimer = window.setTimeout(() => {
      projectRepository.saveAutosave(projectSnapshot).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(autosaveTimer)
  }, [hasProject, projectSnapshot])

  const showNotice = (message) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600)
  }

  const navigate = (nextPage) => {
    setPage(nextPage)
    const url = nextPage === 'home' ? window.location.pathname : `${window.location.pathname}?page=${nextPage}`
    window.history.replaceState(null, '', url)
  }

  const adoptOneClickRunResults = useCallback((run) => {
    const succeededTasks = (Array.isArray(run?.tasks) ? run.tasks : [])
      .filter((task) => task.status === 'succeeded' && task.result)
    if (!succeededTasks.length) return

    const imageFields = new Map()
    const videoResults = []
    const voiceAssignments = new Map()
    const voiceResults = new Map()
    for (const task of succeededTasks) {
      if (task.result.image) {
        const managedImage = createGeneratedImageProjectFields(task.result.image)
        if (managedImage.ok) imageFields.set(`${task.entityType}:${task.entityId}`, managedImage.fields)
      } else if (task.kind === 'shot-video' && task.result.asset) {
        const asset = normalizeShotVideoAsset(task.result.asset)
        if (asset) videoResults.push({ shotId: String(task.entityId), asset })
      } else if (task.kind === 'voice-assignment' && task.result.assignment) {
        voiceAssignments.set(String(task.entityId), task.result.assignment)
      } else if (task.kind === 'voice-line' && task.result.asset) {
        voiceResults.set(String(task.entityId), {
          asset: task.result.asset,
          mediaUrl: task.result.mediaUrl || task.result.asset.mediaUrl,
          inputHash: task.inputHash,
        })
      }
    }

    if (voiceAssignments.size) {
      setCharacters((current) => {
        let changed = false
        const next = current.map((character) => {
          const assignment = voiceAssignments.get(String(character.id))
          if (!assignment || character.voiceId === assignment.voiceId) return character
          changed = true
          return { ...character, ...assignment }
        })
        return changed ? next : current
      })
    }
    if (voiceResults.size) {
      setLines((current) => {
        let changed = false
        const next = current.map((line) => {
          const result = voiceResults.get(String(line.id))
          if (!result || line.audioAssetId === result.asset.id) return line
          changed = true
          return {
            ...line,
            audio: result.mediaUrl,
            audioAssetId: result.asset.id,
            audioStatus: '已完成',
            audioSource: 'bailian-download',
            audioFileName: result.asset.fileName,
            audioDuration: result.asset.duration,
            audioBytes: result.asset.bytes,
            audioSha256: result.asset.sha256,
            audioInputHash: result.inputHash,
            audioError: '',
            audioUpdatedAt: result.asset.importedAt,
            status: '已配音',
          }
        })
        return changed ? next : current
      })
    }
    if (imageFields.size) {
      setCharacters((current) => {
        let changed = false
        const next = current.map((character) => {
          const fields = imageFields.get(`character:${character.id}`)
          if (!fields || character.imageAssetId === fields.imageAssetId) return character
          changed = true
          return { ...character, ...fields }
        })
        return changed ? next : current
      })
      setScenes((current) => {
        let changed = false
        const next = current.map((scene) => {
          const fields = imageFields.get(`scene:${scene.id}`)
          if (!fields || scene.imageAssetId === fields.imageAssetId) return scene
          changed = true
          return { ...scene, ...fields }
        })
        return changed ? next : current
      })
    }
    if (imageFields.size || videoResults.length) {
      setShots((current) => {
        let changed = false
        const next = current.map((shot) => {
          const fields = imageFields.get(`shot:${shot.id}`)
          const video = videoResults.find((item) => item.shotId === String(shot.id))
          const imageChanged = fields && shot.imageAssetId !== fields.imageAssetId
          const videoChanged = video && shot.videoAssetId !== video.asset.id
          if (!imageChanged && !videoChanged) return shot
          changed = true
          return {
            ...shot,
            ...(imageChanged ? fields : {}),
            ...(videoChanged ? {
              videoAssetId: video.asset.id,
              videoOffsetSeconds: 0,
              videoDurationPolicy: 'fit-timeline',
            } : {}),
          }
        })
        return changed ? next : current
      })
    }
    if (videoResults.length) {
      setVideoAssets((current) => {
        const next = [...current]
        let changed = false
        for (const { asset } of videoResults) {
          const index = next.findIndex((item) => item.id === asset.id)
          if (index >= 0) {
            if (next[index].sha256 !== asset.sha256) {
              next[index] = asset
              changed = true
            }
          } else {
            next.push(asset)
            changed = true
          }
        }
        return changed ? next : current
      })
    }
  }, [])

  const acceptOneClickRunUpdate = useCallback((run, { fromInitialLoad = false } = {}) => {
    if (!run || run.projectLocalId !== projectMeta.localProjectId) return
    setOneClickRun(run)
    adoptOneClickRunResults(run)
    const terminal = ['completed', 'completed-with-errors', 'quota-stopped', 'failed'].includes(run.status)
    if (fromInitialLoad && terminal) {
      oneClickCompletionHandled.current = run.id
      return
    }
    if (terminal && oneClickCompletionHandled.current !== run.id) {
      oneClickCompletionHandled.current = run.id
      if (run.status === 'completed') {
        setOneClickProgressMinimized(false)
        if (page !== 'studio') navigate('final')
        showNotice(page === 'studio' ? '整部漫剧制作完成，成片结果已保存' : '整部漫剧缺失素材已补齐，已进入成片页')
      } else if (run.status === 'quota-stopped') {
        setOneClickProgressMinimized(false)
        showNotice('免费额度已停止，队列没有继续调用')
      } else if (run.status === 'completed-with-errors') {
        setOneClickProgressMinimized(false)
        showNotice('一键制作已完成，但有失败项需要手动重试')
      }
    }
  }, [adoptOneClickRunResults, page, projectMeta.localProjectId])

  useEffect(() => {
    if (!projectMeta.localProjectId) {
      setOneClickRun(null)
      return undefined
    }
    let active = true
    oneClickProductionRepository.status(projectMeta.localProjectId)
      .then((result) => {
        if (!active || !result?.ok) return
        if (result.run) acceptOneClickRunUpdate(result.run, { fromInitialLoad: true })
        else setOneClickRun(null)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [acceptOneClickRunUpdate, projectMeta.localProjectId])

  useEffect(() => oneClickProductionRepository.onProgress((run) => {
    acceptOneClickRunUpdate(run)
  }), [acceptOneClickRunUpdate])

  const startOneClickProduction = async (attestation = zeroCostSettings) => {
    if (!oneClickPlan.ok) {
      showNotice(oneClickPlan.blockers[0] || '当前项目还不能开始一键制作')
      return
    }
    if (!oneClickPlan.total) {
      showNotice('当前项目的图片和镜头视频已经补齐')
      return
    }
    if (oneClickPlanRequiresProvider(oneClickPlan) && (!bailianStatus?.configured || bailianStatus?.paidGenerationEnabled !== true)) {
      navigate('settings')
      showNotice(bailianStatus?.configured ? '真实生成当前被环境锁定' : '请先确认本地百炼 Key 已接入')
      return
    }
    setOneClickProgressMinimized(false)
    const result = await oneClickProductionRepository.start({
      plan: oneClickPlan,
      attestation,
    })
    if (!result?.ok) {
      showNotice(result?.error || '一键制作启动失败')
      return
    }
    if (result.nothingToDo) {
      showNotice('当前项目已经补齐，无需生成')
      return
    }
    oneClickCompletionHandled.current = ''
    setOneClickRun(result.run)
    showNotice(`已开始单并发制作 ${oneClickPlan.total} 项缺失素材`)
  }

  const requestStartOneClickProduction = () => {
    if (!zeroCostSettings.confirmed) {
      setZeroCostSafetyMode('start')
      return
    }
    startOneClickProduction()
  }

  const confirmZeroCostSafety = async () => {
    const next = confirmZeroCostAutomationSettings()
    const mode = zeroCostSafetyMode
    setZeroCostSettings(next)
    setZeroCostSafetyMode('')
    showNotice('已保存本机 0 元保护确认')
    if (mode === 'start') await startOneClickProduction(next)
  }

  const openBailianFreeQuotaSettings = async () => {
    const result = await oneClickProductionRepository.openFreeQuotaSettings()
    showNotice(result?.ok ? '已在默认浏览器打开百炼免费额度页面' : result?.error || '无法打开百炼免费额度页面')
  }

  const pauseOneClickProduction = async () => {
    const result = await oneClickProductionRepository.pause(projectMeta.localProjectId)
    if (!result?.ok) showNotice(result?.error || '一键制作暂停失败')
  }

  const resumeOneClickProduction = async () => {
    const result = await oneClickProductionRepository.resume(projectMeta.localProjectId)
    if (!result?.ok) {
      showNotice(result?.error || '一键制作继续失败')
      return
    }
    oneClickCompletionHandled.current = ''
    setOneClickProgressMinimized(false)
    showNotice('已继续制作失败或未完成的任务')
  }

  const stopOneClickProduction = async () => {
    const result = await oneClickProductionRepository.stop(projectMeta.localProjectId)
    if (!result?.ok) showNotice(result?.error || '一键制作停止失败')
  }

  const revealAutomaticExport = async (filePath) => {
    if (!filePath) return
    const result = await videoExportRepository.reveal(filePath)
    showNotice(result?.ok ? '已在文件资源管理器中定位成片' : result?.error || '无法打开成片位置')
  }

  const openStorageMigration = (action = 'export') => {
    if (!hasProject) {
      showNotice('请先创建或打开项目，再使用迁移与存储管理')
      return
    }
    navigate('assets')
    setStorageMigrationRequest({ id: `${Date.now()}-${Math.random()}`, action })
  }

  const openImageProviderSettings = () => {
    try {
      window.sessionStorage.setItem(SETTINGS_ACTIVE_CAPABILITY_KEY, 'image')
    } catch {
      // Session storage can be unavailable in hardened browser contexts.
    }
    navigate('settings')
    showNotice('已打开图片生成设置')
  }

  const openVideoProviderSettings = () => {
    try {
      window.sessionStorage.setItem(SETTINGS_ACTIVE_CAPABILITY_KEY, 'video')
    } catch {
      // Session storage can be unavailable in hardened browser contexts.
    }
    navigate('settings')
    showNotice('已打开视频生成设置')
  }

  const createLocalProject = ({ storySeed: seed, genre, ratio, duration }) => {
    const episode = { id: 1, title: '第一集', scenes: 1, variant: 1, statuses: [], next: '编辑剧本' }
    const scene = {
      id: 1,
      episodeId: 1,
      title: '场景 1',
      location: '',
      time: '',
      weather: '',
      mainCharacterIds: [],
      status: '当前编辑',
      action: '',
      narration: '',
    }
    setProjectMeta({
      localProjectId: createProjectLocalId(),
      name: deriveProjectName(seed, genre),
      genre,
      ratio,
      duration,
      episodeCount: 1,
    })
    setStorySeed(seed.trim())
    setEpisodes([episode])
    setScenes([scene])
    setCharacters([])
    setPropAssets([])
    setShots([])
    setLines([])
    setVideoAssets([])
    setEpisodeProductions([createEmptyEpisodeProduction(episode.id, initialSubtitleStyle)])
    setLegacyProduction(null)
    setTimelineHistories({})
    setSelectedEpisode(1)
    setSelectedScene(1)
    setSelectedCharacter(0)
    setSelectedShot(0)
    setSelectedSpeaker('')
    setCurrentFile('')
  }

  const resetToNewProject = async () => {
    const hadProject = hasProject
    if (hadProject) {
      const confirmed = window.confirm('当前修改会先保留在本机自动草稿中；已另存的 .manju 文件不会被覆盖。确定进入空白新建页吗？')
      if (!confirmed) return
      const autosaveResult = await projectRepository.saveAutosave(projectSnapshot)
      if (!autosaveResult?.ok) {
        showNotice(autosaveResult?.error || '当前项目自动草稿保存失败，已取消新建')
        return
      }
    }
    setProjectMeta({ ...defaultProjectMeta })
    setStorySeed(defaultStorySeed)
    setEpisodes([])
    setScenes([])
    setCharacters([])
    setPropAssets([])
    setShots([])
    setLines([])
    setVideoAssets([])
    setEpisodeProductions([])
    setLegacyProduction(null)
    setTimelineHistories({})
    setSelectedEpisode(1)
    setSelectedScene(1)
    setSelectedCharacter(0)
    setSelectedShot(0)
    setSelectedSpeaker('')
    setCurrentFile('')
    setScriptGenerationConfirmation(null)
    setStorageMigrationRequest(null)
    setBusy('')
    navigate('home')
    showNotice(hadProject ? '已进入空白新建页，原项目仍保留在本机自动草稿中' : '已进入空白新建页')
  }

  const applyBailianProject = (project) => {
    setProjectMeta(project.projectMeta)
    setStorySeed(project.storySeed)
    setEpisodes(project.episodes)
    setScenes(project.scenes)
    setCharacters(project.characters)
    setPropAssets(project.props || [])
    setShots(project.shots)
    setLines(project.lines)
    setVideoAssets([])
    setEpisodeProductions(project.episodes.map((episode) => createEpisodeProductionFromTimeline({
      episodeId: episode.id,
      episodes: project.episodes,
      scenes: project.scenes,
      shots: project.shots,
      lines: project.lines,
      subtitleStyle: initialSubtitleStyle,
    })))
    setLegacyProduction(null)
    setTimelineHistories({})
    setSelectedEpisode(project.episodes[0]?.id || 1)
    setSelectedScene(project.scenes[0]?.id || 1)
    setSelectedCharacter(project.characters[0]?.id || 1)
    setSelectedShot(project.shots[0]?.id || 0)
    setSelectedSpeaker(project.characters[0]?.name || '')
    setCurrentFile('')
  }

  const createNewProject = async (request, useBailian = false, destination = 'overview') => {
    const { storySeed: seed, genre, ratio, duration } = request
    setBusy('script')
    try {
      if (useBailian) {
        const result = await providerRegistry.execute('script', {
          theme: seed,
          genre,
          ratio,
          duration,
          confirmed: true,
        }, providerSettings.script)
        if (!result?.ok || !result.script) {
          const error = result?.error || '百炼剧本生成失败'
          setScriptGenerationConfirmation((current) => current ? { ...current, error } : current)
          showNotice(error)
          return
        }
        const project = createProjectFromBailianScript(result.script, request)
        applyBailianProject(project)
        setScriptGenerationConfirmation(null)
        showNotice(`百炼剧本已生成：${project.characters.length} 个角色、${project.shots.length} 个分镜`)
      } else {
        createLocalProject(request)
        showNotice('空白项目已创建，内容仅来自你的输入')
      }
      navigate(destination)
    } catch (error) {
      const message = error instanceof Error ? error.message : '剧本生成失败'
      if (useBailian) setScriptGenerationConfirmation((current) => current ? { ...current, error: message } : current)
      showNotice(message)
    } finally {
      setBusy('')
    }
  }

  const requestCreateProject = async (request, destination = 'overview') => {
    if (String(request.storySeed || '').trim().length < 2) {
      showNotice('请先输入你自己的故事灵感')
      return
    }
    const useBailian = providerSettings.script?.provider === bailianProviderName
      && bailianStatus?.configured
      && bailianStatus?.paidGenerationEnabled === true
    if (!useBailian) {
      await createNewProject(request, false, destination)
      if (providerSettings.script?.provider === bailianProviderName && bailianStatus?.configured) {
        showNotice('付费生成已锁定，已创建仅含你输入内容的本地项目')
      }
      return
    }
    try {
      const dryRun = await providerRegistry.dryRunScript({
        theme: request.storySeed,
        genre: request.genre,
        ratio: request.ratio,
        duration: request.duration,
      })
      if (!dryRun?.ok) {
        showNotice(dryRun?.error || '百炼请求检查失败')
        return
      }
      setScriptGenerationConfirmation({ request, dryRun, destination, error: '' })
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '百炼请求检查失败')
    }
  }

  const refreshRecentProjects = async () => {
    const result = await projectRepository.listRecent()
    if (result.ok && Array.isArray(result.recents)) setRecentProjects(result.recents)
  }

  const saveProject = async (saveAs = false) => {
    if (!hasProject) {
      showNotice('请先创建或打开一个项目')
      return
    }
    const result = await projectRepository.save(projectSnapshot, currentFile, saveAs)
    if (result.canceled) return
    if (!result.ok) {
      showNotice(result.error || '项目保存失败')
      return
    }
    if (result.path && result.path !== '浏览器本地存储') setCurrentFile(result.path)
    if (Array.isArray(result.recents)) setRecentProjects(result.recents)
    else await refreshRecentProjects()
    showNotice(result.backupPath
      ? `项目已升级并保存；原 V1 文件已备份为 ${result.backupPath.split(/[\\/]/u).at(-1)}`
      : saveAs ? '项目已另存为 .manju 文件' : '项目已保存')
  }

  const renameProject = (value) => {
    const result = createProjectRenameCandidate(projectSnapshot, value)
    if (!result.ok) return result
    if (result.name === projectMeta.name) return result
    setProjectMeta((current) => ({ ...current, name: result.name }))
    showNotice('项目名称已更新并加入自动保存')
    return result
  }

  const commitDialogueSplit = ({ mode, rows, episodeId, scene }) => {
    const result = createDialogueCommit({ lines, rows, characters, episodeId, scene, mode })
    if (!result.ok) return result
    const candidate = {
      ...projectSnapshot,
      content: {
        ...projectSnapshot.content,
        lines: result.lines,
      },
    }
    if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
      return {
        ok: false,
        sizeBlocked: true,
        error: '提交后项目将超过 10 MB，请先移除部分图片或音频。',
      }
    }
    setLines(result.lines)
    showNotice(`已拆分并同步 ${result.createdLines.length} 条台词到配音页`)
    return result
  }

  const commitScriptOrganizer = ({ selectedChanges, episodeId, sceneId }) => {
    const result = createScriptOrganizerCommit({ scenes, lines, selectedChanges, episodeId, sceneId })
    if (!result.ok) return result
    const candidate = {
      ...projectSnapshot,
      content: {
        ...projectSnapshot.content,
        scenes: result.scenes,
        lines: result.lines,
      },
    }
    if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
      return {
        ok: false,
        sizeBlocked: true,
        error: '整理后项目将超过 10 MB，请先移除部分图片或音频。',
      }
    }
    setScenes(result.scenes)
    setLines(result.lines)
    showNotice(`已完成本地整理：更新 ${result.updatedCount} 项`)
    return result
  }

  const commitSceneMainCharacters = ({ sceneId, mainCharacterIds }) => {
    if (!scenes.some((scene) => scene.id === sceneId)) {
      return { ok: false, error: '当前场景已经不存在，请重新选择场景。' }
    }
    const normalizedIds = normalizeMainCharacterIds(mainCharacterIds, characters)
    const nextScenes = scenes.map((scene) => scene.id === sceneId
      ? { ...scene, mainCharacterIds: normalizedIds }
      : scene)
    const candidate = {
      ...projectSnapshot,
      content: {
        ...projectSnapshot.content,
        scenes: nextScenes,
      },
    }
    if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
      return {
        ok: false,
        sizeBlocked: true,
        error: '保存主要角色后项目将超过 10 MB，请先移除部分图片或音频。',
      }
    }
    setScenes(nextScenes)
    showNotice(normalizedIds.length ? `已为当前场景设置 ${normalizedIds.length} 个主要角色` : '已清空当前场景主要角色')
    return { ok: true, mainCharacterIds: normalizedIds, scenes: nextScenes }
  }

  const acceptProjectCollectionChange = (collection, nextItems, apply, successMessage) => {
    const candidate = {
      ...projectSnapshot,
      content: {
        ...projectSnapshot.content,
        [collection]: nextItems,
      },
    }
    if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
      return { ok: false, error: '采用后项目将超过 10 MB，请先移除部分图片或音频。' }
    }
    apply(nextItems)
    showNotice(successMessage)
    return { ok: true }
  }

  const applyCharacterProfileGeneration = ({ characterId, result }) => {
    if (!result || typeof result !== 'object') return { ok: false, error: '角色设定结果无效' }
    const nextCharacters = characters.map((character) => character.id === characterId ? {
      ...character,
      role: result.role || character.role,
      tone: result.tone || character.tone,
      relation: result.relation || character.relation,
      appearance: result.appearance || character.appearance || '',
      costume: result.costume || character.costume || '',
      forbiddenDrift: Array.isArray(result.forbiddenDrift) ? result.forbiddenDrift : character.forbiddenDrift || [],
    } : character)
    return acceptProjectCollectionChange('characters', nextCharacters, setCharacters, '已采用 AI 角色设定')
  }

  const applyCharacterImageGeneration = ({ characterId, image }) => {
    const managedImage = createGeneratedImageProjectFields(image)
    if (!managedImage.ok) return managedImage
    const nextCharacters = characters.map((character) => character.id === characterId ? {
      ...character,
      ...managedImage.fields,
    } : character)
    return acceptProjectCollectionChange('characters', nextCharacters, setCharacters, '已采用本地文件化角色图')
  }

  const appendGeneratedText = (currentValue, generatedValue) => {
    const currentText = String(currentValue || '').trim()
    const generatedText = String(generatedValue || '').trim()
    if (!generatedText || currentText.includes(generatedText)) return currentText
    return currentText ? `${currentText}\n\n${generatedText}` : generatedText
  }

  const applySceneSettingGeneration = ({ sceneId, result }) => {
    const currentScene = scenes.find((scene) => scene.id === sceneId)
    if (!currentScene || !result) return { ok: false, error: '场景设定结果无效' }
    const nextScenes = scenes.map((scene) => scene.id === sceneId ? {
      ...scene,
      title: result.title || scene.title,
      location: result.location || scene.location || '',
      time: result.time || scene.time || '',
      weather: result.weather || scene.weather || '',
      layout: result.layout || scene.layout || '',
      lighting: result.lighting || scene.lighting || '',
      palette: result.palette || scene.palette || '',
      action: appendGeneratedText(scene.action, result.action),
      narration: appendGeneratedText(scene.narration, result.narration),
    } : scene)
    const knownNames = new Set(characters.map((character) => character.name))
    const acceptedDialogues = Array.isArray(result.dialogues)
      ? result.dialogues.filter((dialogue) => knownNames.has(dialogue.speaker) && dialogue.text)
      : []
    let nextLineId = Math.max(0, ...lines.map((line) => line.id)) + 1
    const nextLines = [...lines, ...acceptedDialogues.map((dialogue) => ({
      id: nextLineId++,
      episodeId: currentScene.episodeId,
      sceneId,
      scene: result.title || currentScene.title,
      speaker: dialogue.speaker,
      text: dialogue.text,
      emotion: dialogue.emotion || '默认',
      duration: '0.0s',
      status: '未配音',
      variant: characters.find((character) => character.name === dialogue.speaker)?.variant || 1,
      audio: '',
      audioStatus: '未生成',
      audioSource: '',
      audioFileName: '',
      audioError: '',
      audioAttempt: 0,
    }))]
    const candidate = { ...projectSnapshot, content: { ...projectSnapshot.content, scenes: nextScenes, lines: nextLines } }
    if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) return { ok: false, error: '采用后项目将超过 10 MB，请先移除部分素材。' }
    setScenes(nextScenes)
    setLines(nextLines)
    showNotice(`已采用场景设定${acceptedDialogues.length ? `，追加 ${acceptedDialogues.length} 条有效对白` : ''}`)
    return { ok: true }
  }

  const applySceneImageGeneration = ({ sceneId, image }) => {
    const managedImage = createGeneratedImageProjectFields(image)
    if (!managedImage.ok) return managedImage
    const nextScenes = scenes.map((scene) => scene.id === sceneId ? {
      ...scene,
      ...managedImage.fields,
    } : scene)
    return acceptProjectCollectionChange('scenes', nextScenes, setScenes, '已采用本地文件化场景图')
  }

  const applyStoryboardImageGeneration = ({ shotId, image }) => {
    const managedImage = createGeneratedImageProjectFields(image)
    if (!managedImage.ok) return managedImage
    const nextShots = shots.map((shot) => shot.id === shotId ? {
      ...shot,
      ...managedImage.fields,
    } : shot)
    return acceptProjectCollectionChange('shots', nextShots, setShots, '已采用本地文件化分镜图')
  }

  const loadOpenedProject = async (result) => {
    if (result.canceled) return
    if (!result.ok || !result.snapshot) {
      showNotice(result.error || '项目打开失败')
      return
    }
    try {
      const loaded = applySnapshot(result.snapshot)
      setCurrentFile(result.path || '')
      if (Array.isArray(result.recents)) setRecentProjects(result.recents)
      else await refreshRecentProjects()
      navigate('overview')
      showNotice(loaded.migrationInfo?.legacyProductionPreserved
        ? `已打开并升级项目：${loaded.projectMeta.name}；旧版全项目成片已只读保留`
        : loaded.migrationInfo?.migrated
          ? `已打开并升级项目：${loaded.projectMeta.name}`
          : `已打开项目：${loaded.projectMeta.name}`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '项目数据读取失败')
    }
  }

  const openProject = async () => loadOpenedProject(await projectRepository.open())
  const openRecentProject = async (filePath) => loadOpenedProject(await projectRepository.openRecent(filePath))

  menuCommandHandlers.current = {
    new: resetToNewProject,
    open: openProject,
    save: () => saveProject(false),
    'save-as': () => saveProject(true),
    'portable-import': () => openStorageMigration('import'),
    'portable-export': () => openStorageMigration('export'),
    error: () => showNotice('菜单操作失败，请重试'),
  }

  useEffect(() => {
    const dispose = window.manjuDesktop?.onMenuCommand?.((command) => {
      const handler = menuCommandHandlers.current[command]
      if (!handler) return
      Promise.resolve(handler()).catch(() => menuCommandHandlers.current.error?.())
    })
    return typeof dispose === 'function' ? dispose : undefined
  }, [])

  const runLocalSearch = (query) => searchLocalProject({
    query,
    projectMeta,
    storySeed,
    recentProjects,
    episodes,
    scenes,
    characters,
    shots,
    lines,
  })

  const selectLocalSearchResult = async (result) => {
    if (result.kind === 'recent-project' && result.path) {
      await openRecentProject(result.path)
      return
    }
    if (result.episodeId) setSelectedEpisode(result.episodeId)
    if (result.sceneId) setSelectedScene(result.sceneId)
    if (result.shotId) setSelectedShot(result.shotId)
    if (result.characterId) setSelectedCharacter(result.characterId)
    if (result.speaker && result.page === 'voice') setSelectedSpeaker(result.speaker)
    navigate(result.page || 'overview')
    showNotice(`已定位：${result.title}`)
  }

  const locateAssetReference = (reference) => {
    if (!reference) return
    if (reference.episodeId) setSelectedEpisode(reference.episodeId)
    if (reference.sceneId) setSelectedScene(reference.sceneId)
    if (reference.characterId) setSelectedCharacter(reference.characterId)
    if (reference.shotId) setSelectedShot(reference.shotId)
    if (reference.speaker) setSelectedSpeaker(reference.speaker)
    navigate(reference.page || 'overview')
    showNotice(`已定位：${reference.title}`)
  }

  const routeAssetImport = (targetPage) => {
    navigate(targetPage)
    const guidance = {
      character: '请先选择角色，再点击“导入参考图”',
      storyboard: '请先选择镜头，再点击“导入图片”',
      voice: '请先选择台词，再点击右侧导入按钮',
      final: '请选择镜头导入本地 MP4，或在音频轨道区域导入背景音乐与音效',
    }
    showNotice(guidance[targetPage] || '请选择素材的使用位置')
  }

  const applyAssetCollections = (result, { episodeId = 0, applyAudio = false } = {}) => {
    if (result.characters !== characters) setCharacters(result.characters)
    if (result.shots !== shots) setShots(result.shots)
    if (result.lines !== lines) setLines(result.lines)
    if (applyAudio && episodeId) {
      setEpisodeProductions((current) => updateEpisodeProduction(
        current,
        episodeId,
        (production) => ({ ...production, audioTracks: result.audioTracks }),
        initialSubtitleStyle,
      ))
    }
  }

  const replaceAsset = async (asset, file) => {
    if (asset.readOnly) {
      const error = '旧版全项目成片素材为只读，不能替换'
      showNotice(error)
      return { ok: false, error }
    }
    if (!isAssetFileCompatible(asset.kind, file)) {
      const error = asset.mediaType === 'image' ? '请选择有效的图片文件' : '请选择有效的音频文件'
      showNotice(error)
      return { ok: false, error }
    }
    const maximumBytes = maximumAssetFileBytes[asset.kind]
    if (file.size > maximumBytes) {
      const error = `${asset.categoryLabel}需小于 ${formatAssetBytes(maximumBytes)}`
      showNotice(error)
      return { ok: false, error }
    }
    try {
      let dataUrl = await readLocalFileAsDataUrl(file)
      if (!dataUrl.startsWith(`data:${asset.mediaType}/`) && dataUrl.startsWith('data:application/octet-stream')) {
        const fallbackMime = asset.mediaType === 'image' ? 'image/png' : 'audio/wav'
        dataUrl = dataUrl.replace(/^data:application\/octet-stream/iu, `data:${fallbackMime}`)
      }
      if (!dataUrl.startsWith(`data:${asset.mediaType}/`)) {
        throw new Error(asset.mediaType === 'image' ? '图片格式无法识别' : '音频格式无法识别')
      }
      const duration = asset.mediaType === 'audio' ? await probeAudioDuration(dataUrl) : 0
      const waveform = asset.kind === 'bgm' || asset.kind === 'sfx'
        ? await createAudioWaveform(file).catch(() => [])
        : []
      const assetEpisodeId = Number(asset.episodeId) || selectedEpisode
      const sourceAudioTracks = asset.kind === 'bgm' || asset.kind === 'sfx'
        ? getEpisodeProduction(episodeProductions, assetEpisodeId, initialSubtitleStyle).audioTracks
        : []
      const result = replaceProjectAsset({
        asset,
        dataUrl,
        fileName: file.name,
        waveform,
        duration,
        characters,
        shots,
        lines,
        audioTracks: sourceAudioTracks,
      })
      if (!result.ok) {
        showNotice(result.error)
        return result
      }
      const nextEpisodeProductions = asset.kind === 'bgm' || asset.kind === 'sfx'
        ? updateEpisodeProduction(
          episodeProductions,
          assetEpisodeId,
          (production) => ({ ...production, audioTracks: result.audioTracks }),
          initialSubtitleStyle,
        )
        : episodeProductions
      const candidate = createProjectSnapshot({
        projectMeta,
        storySeed,
        episodes,
        scenes,
        characters: result.characters,
        shots: result.shots,
        lines: result.lines,
        videoAssets,
        episodeProductions: nextEpisodeProductions,
        legacyProduction,
      })
      if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
        const error = '替换后项目将超过 10 MB，未执行本次操作'
        showNotice(error)
        return { ok: false, error }
      }
      applyAssetCollections(result, {
        episodeId: assetEpisodeId,
        applyAudio: asset.kind === 'bgm' || asset.kind === 'sfx',
      })
      showNotice(`已替换真实素材：${file.name}`)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '素材替换失败'
      showNotice(message)
      return { ok: false, error: message }
    }
  }

  const removeAsset = async (asset) => {
    if (asset.readOnly) {
      const error = '旧版全项目成片素材为只读，不能移除'
      showNotice(error)
      return { ok: false, error }
    }
    if (asset.kind === 'shot-video') {
      const referencedShotIds = new Set(asset.references.map((reference) => String(reference.shotId || '')))
      setShots((items) => items.map((shot) => {
        if (referencedShotIds.has(String(shot.id))) {
          return { ...shot, videoAssetId: '', videoOffsetSeconds: 0, videoDurationPolicy: 'fit-timeline' }
        }
        if (referencedShotIds.has(String(shot.videoContinuitySourceShotId || ''))) {
          return { ...shot, videoContinuitySourceShotId: 0 }
        }
        return shot
      }))
      showNotice('已解除镜头视频引用；本机托管副本仍保留')
      return { ok: true }
    }
    const assetEpisodeId = Number(asset.episodeId) || selectedEpisode
    const sourceAudioTracks = asset.kind === 'bgm' || asset.kind === 'sfx'
      ? getEpisodeProduction(episodeProductions, assetEpisodeId, initialSubtitleStyle).audioTracks
      : []
    const result = removeProjectAsset({ asset, characters, shots, lines, audioTracks: sourceAudioTracks })
    if (!result.ok) {
      showNotice(result.error)
      return result
    }
    applyAssetCollections(result, {
      episodeId: assetEpisodeId,
      applyAudio: asset.kind === 'bgm' || asset.kind === 'sfx',
    })
    showNotice(`已移除素材：${asset.name}`)
    return result
  }

  const readTimelineRecoverySnapshot = (snapshot, { episodeId = selectedEpisode, legacy = false } = {}) => {
    const loaded = readProjectSnapshot(snapshot, {
      projectMeta,
      storySeed,
      episodes,
      scenes,
      characters,
      shots,
      lines,
      videoAssets,
      audioTracks,
      subtitleCues,
      subtitleCuesInitialized,
      subtitleStyle,
    })
    const recoveredProduction = legacy && loaded.legacyProduction
      ? loaded.legacyProduction
      : getEpisodeProduction(loaded.episodeProductions, episodeId, initialSubtitleStyle)
    return createTimelineSnapshot({
      shots: legacy
        ? loaded.shots
        : loaded.shots.filter((shot) => Number(shot.episodeId) === Number(episodeId)),
      audioTracks: recoveredProduction.audioTracks,
      subtitleCues: recoveredProduction.subtitleCues,
      subtitleCuesInitialized: recoveredProduction.subtitleCuesInitialized,
      subtitleStyle: recoveredProduction.subtitleStyle,
    })
  }

  const updateStudioCharacter = (characterId, changes) => {
    const currentCharacter = characters.find((item) => String(item.id) === String(characterId))
    setCharacters((items) => items.map((item) => String(item.id) === String(characterId) ? { ...item, ...changes } : item))
    if (!currentCharacter || !Object.hasOwn(changes, 'name') || changes.name === currentCharacter.name) return
    setLines((items) => items.map((line) => line.speaker === currentCharacter.name
      ? { ...line, speaker: changes.name, audioStatus: '未配音', audio: '', audioError: '' }
      : line))
    if (selectedSpeaker === currentCharacter.name) setSelectedSpeaker(changes.name)
  }

  const pages = {
    studio: <StudioWorkbench
      projectMeta={projectMeta}
      storySeed={storySeed}
      episodes={episodes}
      scenes={scenes}
      characters={characters}
      propAssets={propAssets}
      shots={shots}
      lines={lines}
      videoAssets={videoAssets}
      recentProjects={recentProjects}
      oneClickPlan={oneClickPlan}
      oneClickRun={oneClickRun}
      zeroCostSettings={zeroCostSettings}
      bailianStatus={bailianStatus}
      hasProject={hasProject}
      busy={busy}
      onNavigate={navigate}
      onOpenProject={openProject}
      onChangeStorySeed={setStorySeed}
      onGenerateScript={(request) => requestCreateProject(request, 'studio')}
      onUpdateScene={(sceneId, changes) => setScenes((items) => items.map((item) => String(item.id) === String(sceneId) ? { ...item, ...changes } : item))}
      onUpdateCharacter={updateStudioCharacter}
      onUpdateProp={(propId, changes) => setPropAssets((items) => items.map((item) => String(item.id) === String(propId) ? { ...item, ...changes } : item))}
      onUpdateShot={(shotId, changes) => setShots((items) => items.map((item) => String(item.id) === String(shotId) ? { ...item, ...changes } : item))}
      onUpdateLine={(lineId, changes) => setLines((items) => items.map((item) => String(item.id) === String(lineId) ? { ...item, ...changes, ...(Object.hasOwn(changes, 'text') || Object.hasOwn(changes, 'speaker') || Object.hasOwn(changes, 'emotion') ? { audioStatus: '未配音', audio: '', audioError: '' } : {}) } : item))}
      onStartOneClick={requestStartOneClickProduction}
      onUpdateProjectRatio={(ratio) => setProjectMeta((current) => ({ ...current, ratio }))}
      onPauseOneClick={pauseOneClickProduction}
      onResumeOneClick={resumeOneClickProduction}
      onStopOneClick={stopOneClickProduction}
      onOpenProductionSettings={() => {
        navigate('settings')
        setZeroCostSafetyMode('settings')
      }}
      onRevealExport={revealAutomaticExport}
    />,
    home: <HomePage storySeed={storySeed} setStorySeed={setStorySeed} projectMeta={projectMeta} hasProject={hasProject} episodes={episodes} scenes={scenes} characters={characters} shots={shots} recentProjects={recentProjects} onNavigate={navigate} onCreateProject={requestCreateProject} onOpenProject={openProject} onOpenRecentProject={openRecentProject} busy={busy} />,
    overview: hasProject ? <OverviewPage projectMeta={projectMeta} storySeed={storySeed} currentFile={currentFile} episodes={episodes} setEpisodes={setEpisodes} scenes={scenes} setScenes={setScenes} setShots={setShots} setLines={setLines} characters={characters} selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode} setSelectedScene={setSelectedScene} onNavigate={navigate} onNotice={showNotice} onOpenProject={openProject} onSaveProject={saveProject} onSaveAsProject={() => saveProject(true)} onRenameProject={renameProject} oneClickPlan={oneClickPlan} oneClickRun={oneClickRun} zeroCostSettings={zeroCostSettings} onStartOneClick={requestStartOneClickProduction} onOpenOneClickProgress={() => setOneClickProgressMinimized(false)} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    script: hasProject ? <ScriptPage storySeed={storySeed} episodes={episodes} scenes={scenes} setScenes={setScenes} selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode} selectedScene={selectedScene} setSelectedScene={setSelectedScene} characters={characters} shots={shots} lines={lines} setShots={setShots} setLines={setLines} setSelectedShot={setSelectedShot} bailianStatus={bailianStatus} onOpenImageSettings={openImageProviderSettings} onNavigate={navigate} onCommitDialogueSplit={commitDialogueSplit} onCommitScriptOrganizer={commitScriptOrganizer} onCommitSceneCharacters={commitSceneMainCharacters} onApplySceneSetting={applySceneSettingGeneration} onApplySceneImage={applySceneImageGeneration} onNotice={showNotice} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    character: hasProject ? <CharacterPage storySeed={storySeed} characters={characters} setCharacters={setCharacters} selectedCharacter={selectedCharacter} setSelectedCharacter={setSelectedCharacter} selectedSpeaker={selectedSpeaker} setSelectedSpeaker={setSelectedSpeaker} setScenes={setScenes} setLines={setLines} imageProviderConfig={providerSettings.image} bailianStatus={bailianStatus} onOpenImageSettings={openImageProviderSettings} onApplyCharacterProfile={applyCharacterProfileGeneration} onApplyCharacterImage={applyCharacterImageGeneration} onNavigate={navigate} onNotice={showNotice} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    assets: hasProject ? <AssetLibraryPage projectSnapshot={projectSnapshot} episodes={episodes} scenes={scenes} characters={characters} shots={shots} lines={lines} videoAssets={videoAssets} audioTracks={allEpisodeAudioTracks} onImportRoute={routeAssetImport} onLocateReference={locateAssetReference} onReplaceAsset={replaceAsset} onRemoveAsset={removeAsset} onOpenStorageMigration={openStorageMigration} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    storyboard: hasProject ? <StoryboardPage episodes={episodes} scenes={scenes} characters={characters} selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode} selectedScene={selectedScene} setSelectedScene={setSelectedScene} shots={shots} setShots={setShots} selectedShot={selectedShot} setSelectedShot={setSelectedShot} imageProviderConfig={providerSettings.image} bailianStatus={bailianStatus} onOpenImageSettings={openImageProviderSettings} onApplyStoryboardImage={applyStoryboardImageGeneration} onNotice={showNotice} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    voice: hasProject ? (characters.length ? <VoicePage episodes={episodes} scenes={scenes} selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode} selectedScene={selectedScene} setSelectedScene={setSelectedScene} characters={characters} lines={lines} setLines={setLines} selectedSpeaker={selectedSpeaker} setSelectedSpeaker={setSelectedSpeaker} onNavigate={navigate} onNotice={showNotice} /> : <EmptyProjectDataPage icon="users" title="还没有可配音的角色" description="先在角色页创建真实角色，再为台词导入本地音频。" actionLabel="前往角色页" onAction={() => navigate('character')} />) : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    final: hasProject ? <FinalPage projectName={projectMeta.name} projectLocalId={projectMeta.localProjectId} projectSnapshot={projectSnapshot} recoveryKey={currentFile || projectMeta.localProjectId || projectMeta.name} episodes={episodes} selectedEpisode={selectedEpisode} setSelectedEpisode={setSelectedEpisode} scenes={scenes} shots={shots} setShots={setShots} lines={lines} videoAssets={videoAssets} setVideoAssets={setVideoAssets} audioTracks={audioTracks} setAudioTracks={setAudioTracks} subtitleCues={subtitleCues} setSubtitleCues={setSubtitleCues} subtitleCuesInitialized={subtitleCuesInitialized} setSubtitleCuesInitialized={setSubtitleCuesInitialized} subtitleStyle={subtitleStyle} setSubtitleStyle={setSubtitleStyle} timelineHistory={timelineHistory} setTimelineHistory={setTimelineHistory} legacyProduction={legacyProduction} readTimelineRecoverySnapshot={readTimelineRecoverySnapshot} selectedShot={selectedShot} setSelectedShot={setSelectedShot} videoProviderConfig={providerSettings.video} bailianStatus={bailianStatus} onOpenVideoSettings={openVideoProviderSettings} oneClickPlan={oneClickPlan} oneClickRun={oneClickRun} onStartOneClick={requestStartOneClickProduction} onOpenOneClickProgress={() => setOneClickProgressMinimized(false)} onNavigate={navigate} onNotice={showNotice} /> : <EmptyWorkspacePage onNavigate={navigate} onOpenProject={openProject} />,
    settings: <SettingsPage settings={providerSettings} setSettings={setProviderSettings} connectionStates={connectionStates} setConnectionStates={setConnectionStates} bailianStatus={bailianStatus} zeroCostSettings={zeroCostSettings} onOpenZeroCostSafety={() => setZeroCostSafetyMode('settings')} onNotice={showNotice} />,
  }

  return (
    <div className={page === 'studio' ? 'app-shell app-shell--studio' : 'app-shell'}>
      {page !== 'studio' && <TopBar page={page} onNavigate={navigate} onSearch={runLocalSearch} onSelectSearchResult={selectLocalSearchResult} />}
      {pages[page]}
      {scriptGenerationConfirmation && <BailianScriptConfirmModal
        confirmation={scriptGenerationConfirmation}
        busy={busy === 'script'}
        onCancel={() => setScriptGenerationConfirmation(null)}
        onConfirm={() => createNewProject(scriptGenerationConfirmation.request, true, scriptGenerationConfirmation.destination || 'overview')}
      />}
      {storageMigrationRequest && hasProject && <StorageMigrationDialog
        request={storageMigrationRequest}
        projectSnapshot={projectSnapshot}
        recoveryKey={currentFile || projectMeta.localProjectId || projectMeta.name}
        onClose={() => setStorageMigrationRequest(null)}
        onOpenImportedProject={loadOpenedProject}
      />}
      {zeroCostSafetyMode && <ZeroCostSafetyModal
        mode={zeroCostSafetyMode}
        settings={zeroCostSettings}
        onClose={() => setZeroCostSafetyMode('')}
        onConfirm={confirmZeroCostSafety}
        onOpenOfficial={openBailianFreeQuotaSettings}
      />}
      {oneClickRun && page !== 'studio' && !oneClickProgressMinimized && <ProductionBoard
        run={oneClickRun}
        costEstimate={oneClickPlan?.costEstimate}
        onMinimize={() => setOneClickProgressMinimized(true)}
        onPause={pauseOneClickProduction}
        onResume={resumeOneClickProduction}
        onStop={stopOneClickProduction}
      />}
      {oneClickRun && page !== 'studio' && oneClickProgressMinimized && <OneClickProductionDrawer
        run={oneClickRun}
        minimized={oneClickProgressMinimized}
        onMinimize={() => setOneClickProgressMinimized(true)}
        onExpand={() => setOneClickProgressMinimized(false)}
        onPause={pauseOneClickProduction}
        onResume={resumeOneClickProduction}
        onStop={stopOneClickProduction}
        onOpenSettings={() => {
          navigate('settings')
          setZeroCostSafetyMode('settings')
        }}
      />}
      {notice && <div className="toast" role="status"><Icon name="check" size={16} />{notice}</div>}
    </div>
  )
}

export default App
