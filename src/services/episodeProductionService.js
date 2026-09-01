import {
  createSubtitleCuesFromTimeline,
  defaultSubtitleStyle,
  normalizeSubtitleCues,
  normalizeSubtitleStyle,
} from './subtitleService.js'
import { buildProductionTimeline } from './timelineService.js'

const cloneJson = (value) => JSON.parse(JSON.stringify(value))

const normalizeEpisodeId = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

const normalizeAudioTrack = (track, index) => ({
  id: Number.isFinite(Number(track?.id)) ? Number(track.id) : index + 1,
  kind: track?.kind === 'sfx' ? 'sfx' : 'bgm',
  name: typeof track?.name === 'string' && track.name.trim()
    ? track.name.trim().slice(0, 80)
    : `音频轨道 ${index + 1}`,
  fileName: typeof track?.fileName === 'string' ? track.fileName.slice(0, 160) : '',
  ...(typeof track?.audio === 'string' && track.audio.startsWith('data:audio/')
    ? { audio: track.audio }
    : { audio: '' }),
  start: Math.max(0, Number(track?.start) || 0),
  duration: Math.max(0.1, Number(track?.duration) || 1),
  volume: Number.isFinite(Number(track?.volume))
    ? Math.min(100, Math.max(0, Number(track.volume)))
    : track?.kind === 'sfx' ? 70 : 35,
  fadeIn: Math.min(10, Math.max(0, Number(track?.fadeIn) || 0)),
  fadeOut: Math.min(10, Math.max(0, Number(track?.fadeOut) || 0)),
  waveform: Array.isArray(track?.waveform)
    ? track.waveform.slice(0, 64).map((sample) => Math.min(1, Math.max(0, Number(sample) || 0)))
    : [],
  ...(typeof track?.audioError === 'string' ? { audioError: track.audioError.slice(0, 240) } : {}),
  ...(typeof track?.audioUpdatedAt === 'string' ? { audioUpdatedAt: track.audioUpdatedAt.slice(0, 40) } : {}),
})

export const createEmptyEpisodeProduction = (
  episodeId,
  subtitleStyle = defaultSubtitleStyle,
) => ({
  episodeId: normalizeEpisodeId(episodeId),
  audioTracks: [],
  subtitleCues: [],
  subtitleCuesInitialized: false,
  subtitleStyle: normalizeSubtitleStyle(subtitleStyle),
})

export const normalizeEpisodeProduction = (
  production,
  episodeId,
  { totalDuration = 30 * 60, fallbackStyle = defaultSubtitleStyle } = {},
) => ({
  episodeId: normalizeEpisodeId(episodeId || production?.episodeId),
  audioTracks: Array.isArray(production?.audioTracks)
    ? production.audioTracks.map(normalizeAudioTrack)
    : [],
  subtitleCues: normalizeSubtitleCues(
    Array.isArray(production?.subtitleCues) ? production.subtitleCues : [],
    totalDuration,
  ),
  subtitleCuesInitialized: production?.subtitleCuesInitialized === true
    || (production?.subtitleCuesInitialized !== false && Array.isArray(production?.subtitleCues)),
  subtitleStyle: normalizeSubtitleStyle(production?.subtitleStyle || fallbackStyle),
})

export const createEpisodeProductionFromTimeline = ({
  episodeId,
  episodes = [],
  scenes = [],
  shots = [],
  lines = [],
  videoAssets = [],
  subtitleStyle = defaultSubtitleStyle,
} = {}) => {
  const scopedShots = shots.filter((shot) => normalizeEpisodeId(shot?.episodeId) === normalizeEpisodeId(episodeId))
  const timeline = buildProductionTimeline({
    episodes,
    scenes,
    shots: scopedShots,
    lines,
    videoAssets,
  })
  const subtitleCues = createSubtitleCuesFromTimeline(timeline.items)
  return {
    episodeId: normalizeEpisodeId(episodeId),
    audioTracks: [],
    subtitleCues,
    subtitleCuesInitialized: timeline.items.length > 0,
    subtitleStyle: normalizeSubtitleStyle(subtitleStyle),
  }
}

const hasLegacyProductionData = (content) => (
  (Array.isArray(content?.audioTracks) && content.audioTracks.length > 0)
  || (Array.isArray(content?.subtitleCues) && content.subtitleCues.length > 0)
)

export const migrateProjectSnapshotV1ToV2 = (sourceSnapshot) => {
  if (!sourceSnapshot || sourceSnapshot.format !== 'manju-project' || sourceSnapshot.version !== 1) {
    throw new Error('没有可用的 V1 项目迁移来源')
  }
  const snapshot = cloneJson(sourceSnapshot)
  const content = snapshot.content || {}
  const episodes = Array.isArray(content.episodes) && content.episodes.length
    ? content.episodes
    : [{ id: 1, title: '第一集' }]
  const defaultStyle = normalizeSubtitleStyle(content.subtitleStyle || defaultSubtitleStyle)
  const multipleEpisodes = episodes.length > 1
  const oldAudioTracks = Array.isArray(content.audioTracks) ? content.audioTracks : []
  const oldSubtitleCues = Array.isArray(content.subtitleCues) ? content.subtitleCues : []
  const oldSubtitleCuesInitialized = content.subtitleCuesInitialized === true
    || (content.subtitleCuesInitialized !== false && Array.isArray(content.subtitleCues))

  const episodeProductions = multipleEpisodes
    ? episodes.map((episode) => createEpisodeProductionFromTimeline({
      episodeId: episode.id,
      episodes,
      scenes: Array.isArray(content.scenes) ? content.scenes : [],
      shots: Array.isArray(content.shots) ? content.shots : [],
      lines: Array.isArray(content.lines) ? content.lines : [],
      videoAssets: Array.isArray(content.videoAssets) ? content.videoAssets : [],
      subtitleStyle: defaultStyle,
    }))
    : [normalizeEpisodeProduction({
      episodeId: episodes[0].id,
      audioTracks: oldAudioTracks,
      subtitleCues: oldSubtitleCues,
      subtitleCuesInitialized: oldSubtitleCuesInitialized,
      subtitleStyle: defaultStyle,
    }, episodes[0].id)]

  const legacyProduction = multipleEpisodes && hasLegacyProductionData(content)
    ? {
      sourceVersion: 1,
      episodeIds: episodes.map((episode) => normalizeEpisodeId(episode.id)).filter(Boolean),
      audioTracks: oldAudioTracks.map(normalizeAudioTrack),
      subtitleCues: normalizeSubtitleCues(oldSubtitleCues),
      subtitleCuesInitialized: oldSubtitleCuesInitialized,
      subtitleStyle: defaultStyle,
      preservedAt: new Date().toISOString(),
    }
    : null

  delete content.audioTracks
  delete content.subtitleCues
  delete content.subtitleCuesInitialized
  delete content.subtitleStyle
  content.episodeProductions = episodeProductions
  if (legacyProduction) content.legacyProduction = legacyProduction
  else delete content.legacyProduction

  return {
    ...snapshot,
    version: 2,
    content,
    migration: {
      sourceVersion: 1,
      targetVersion: 2,
      legacyProductionPreserved: Boolean(legacyProduction),
    },
  }
}

export const normalizeProjectSnapshotToV2 = (snapshot) => {
  if (!snapshot || snapshot.format !== 'manju-project' || !snapshot.project || !snapshot.content) {
    throw new Error('项目文件缺少必要数据')
  }
  if (snapshot.version === 1) return migrateProjectSnapshotV1ToV2(snapshot)
  if (snapshot.version !== 2) throw new Error('项目文件格式不受支持')
  return cloneJson(snapshot)
}

export const normalizeEpisodeProductions = ({
  episodeProductions = [],
  episodes = [],
  scenes = [],
  shots = [],
  lines = [],
  videoAssets = [],
  fallbackStyle = defaultSubtitleStyle,
} = {}) => {
  const sourceMap = new Map(
    (Array.isArray(episodeProductions) ? episodeProductions : [])
      .map((production) => [normalizeEpisodeId(production?.episodeId), production]),
  )
  return episodes.map((episode) => {
    const episodeId = normalizeEpisodeId(episode.id)
    const scopedShots = shots.filter((shot) => normalizeEpisodeId(shot?.episodeId) === episodeId)
    const timeline = buildProductionTimeline({
      episodes,
      scenes,
      shots: scopedShots,
      lines,
      videoAssets,
    })
    const source = sourceMap.get(episodeId)
    if (!source) {
      return createEpisodeProductionFromTimeline({
        episodeId,
        episodes,
        scenes,
        shots,
        lines,
        videoAssets,
        subtitleStyle: fallbackStyle,
      })
    }
    return normalizeEpisodeProduction(source, episodeId, {
      totalDuration: timeline.totalDuration || 30 * 60,
      fallbackStyle,
    })
  })
}

export const normalizeLegacyProduction = (legacyProduction, fallbackStyle = defaultSubtitleStyle) => {
  if (!legacyProduction || typeof legacyProduction !== 'object') return null
  const audioTracks = Array.isArray(legacyProduction.audioTracks)
    ? legacyProduction.audioTracks.map(normalizeAudioTrack)
    : []
  const subtitleCues = normalizeSubtitleCues(
    Array.isArray(legacyProduction.subtitleCues) ? legacyProduction.subtitleCues : [],
  )
  if (!audioTracks.length && !subtitleCues.length) return null
  return {
    sourceVersion: Number(legacyProduction.sourceVersion) || 1,
    episodeIds: Array.isArray(legacyProduction.episodeIds)
      ? legacyProduction.episodeIds.map(normalizeEpisodeId).filter(Boolean)
      : [],
    audioTracks,
    subtitleCues,
    subtitleCuesInitialized: legacyProduction.subtitleCuesInitialized === true
      || (legacyProduction.subtitleCuesInitialized !== false && Array.isArray(legacyProduction.subtitleCues)),
    subtitleStyle: normalizeSubtitleStyle(legacyProduction.subtitleStyle || fallbackStyle),
    preservedAt: typeof legacyProduction.preservedAt === 'string'
      ? legacyProduction.preservedAt.slice(0, 40)
      : '',
  }
}

export const getEpisodeProduction = (
  episodeProductions,
  episodeId,
  fallbackStyle = defaultSubtitleStyle,
) => (
  (Array.isArray(episodeProductions) ? episodeProductions : [])
    .find((production) => normalizeEpisodeId(production?.episodeId) === normalizeEpisodeId(episodeId))
  || createEmptyEpisodeProduction(episodeId, fallbackStyle)
)

export const updateEpisodeProduction = (
  episodeProductions,
  episodeId,
  updater,
  fallbackStyle = defaultSubtitleStyle,
) => {
  const normalizedId = normalizeEpisodeId(episodeId)
  const current = getEpisodeProduction(episodeProductions, normalizedId, fallbackStyle)
  const requested = typeof updater === 'function' ? updater(current) : updater
  const next = {
    ...current,
    ...(requested && typeof requested === 'object' ? requested : {}),
    episodeId: normalizedId,
  }
  const exists = (Array.isArray(episodeProductions) ? episodeProductions : [])
    .some((production) => normalizeEpisodeId(production?.episodeId) === normalizedId)
  if (!exists) return [...(Array.isArray(episodeProductions) ? episodeProductions : []), next]
  return episodeProductions.map((production) => (
    normalizeEpisodeId(production?.episodeId) === normalizedId ? next : production
  ))
}

export const replaceEpisodeShots = (projectShots, episodeId, nextEpisodeShots) => {
  const normalizedId = normalizeEpisodeId(episodeId)
  const replacement = Array.isArray(nextEpisodeShots) ? nextEpisodeShots : []
  const queue = [...replacement]
  const result = []
  let insertionIndex = -1
  ;(Array.isArray(projectShots) ? projectShots : []).forEach((shot) => {
    if (normalizeEpisodeId(shot?.episodeId) !== normalizedId) {
      result.push(shot)
      return
    }
    if (insertionIndex < 0) insertionIndex = result.length
    const next = queue.shift()
    if (next) result.push({ ...next, episodeId: normalizedId })
  })
  if (queue.length) {
    const target = insertionIndex < 0 ? result.length : insertionIndex + replacement.length - queue.length
    result.splice(target, 0, ...queue.map((shot) => ({ ...shot, episodeId: normalizedId })))
  }
  return result
}

export const flattenEpisodeAudioTracks = (episodeProductions = [], legacyProduction = null) => ([
  ...episodeProductions.flatMap((production) => (
    (Array.isArray(production?.audioTracks) ? production.audioTracks : []).map((track) => ({
      ...track,
      episodeId: production.episodeId,
      assetScopedId: `${production.episodeId}:${track.id}`,
    }))
  )),
  ...(Array.isArray(legacyProduction?.audioTracks) ? legacyProduction.audioTracks : []).map((track) => ({
    ...track,
    episodeId: 0,
    assetScopedId: `legacy:${track.id}`,
    legacyProduction: true,
    readOnly: true,
  })),
])
