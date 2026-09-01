export const assetKindDetails = Object.freeze({
  'character-image': { label: '角色图片', mediaType: 'image', page: 'character' },
  'shot-image': { label: '分镜图片', mediaType: 'image', page: 'storyboard' },
  'shot-video': { label: '镜头视频', mediaType: 'video', page: 'final' },
  'voice-audio': { label: '角色配音', mediaType: 'audio', page: 'voice' },
  bgm: { label: '背景音乐', mediaType: 'audio', page: 'final' },
  sfx: { label: '音效', mediaType: 'audio', page: 'final' },
})

export const maximumAssetFileBytes = Object.freeze({
  'character-image': 2 * 1024 * 1024,
  'shot-image': 2 * 1024 * 1024,
  'shot-video': 250 * 1024 * 1024,
  'voice-audio': 3 * 1024 * 1024,
  bgm: 4 * 1024 * 1024,
  sfx: 4 * 1024 * 1024,
})

const validImageExtension = /\.(?:avif|gif|jpe?g|png|webp)$/iu
const validAudioExtension = /\.(?:aac|flac|m4a|mp3|ogg|wav)$/iu
const validVideoExtension = /\.mp4$/iu

const cleanText = (value) => String(value ?? '').trim()

const truncate = (value, maximum = 34) => {
  const characters = Array.from(cleanText(value))
  return characters.length > maximum ? `${characters.slice(0, maximum).join('')}…` : characters.join('')
}

export const getDataUrlByteSize = (value) => {
  const source = cleanText(value)
  const commaIndex = source.indexOf(',')
  if (!source.startsWith('data:') || commaIndex < 0) return 0
  const metadata = source.slice(0, commaIndex)
  const payload = source.slice(commaIndex + 1)
  if (/;base64(?:;|$)/iu.test(metadata)) {
    const compact = payload.replace(/\s/gu, '')
    if (!compact) return 0
    const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((compact.length * 3) / 4) - padding)
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength
  } catch {
    return new TextEncoder().encode(payload).byteLength
  }
}

export const formatAssetBytes = (bytes) => {
  const value = Math.max(0, Number(bytes) || 0)
  if (value < 1024) return `${Math.round(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export const isAssetFileCompatible = (kind, file) => {
  const details = assetKindDetails[kind]
  if (!details || !file) return false
  const type = cleanText(file.type).toLowerCase()
  const name = cleanText(file.name)
  if (details.mediaType === 'image') return type.startsWith('image/') || validImageExtension.test(name)
  if (details.mediaType === 'video') return type === 'video/mp4' || validVideoExtension.test(name)
  return type.startsWith('audio/') || validAudioExtension.test(name)
}

const resolveAssetHealth = ({ dataUrl, mediaType, hasMetadata, error }) => {
  const source = cleanText(dataUrl)
  if (source.startsWith(`data:${mediaType}/`)) return error ? 'broken' : 'ready'
  if (mediaType === 'image' && source.startsWith('manju-media://generated-image/')) return error ? 'broken' : 'ready'
  if (mediaType === 'audio' && source.startsWith('manju-media://voice/')) return error ? 'broken' : 'ready'
  if (source) return 'broken'
  return hasMetadata || cleanText(error) ? 'missing' : 'unused'
}

const resolveDataUrlMimeType = (value) => cleanText(value).match(/^data:([^;,]+)/iu)?.[1] || ''

const createAsset = ({
  id,
  kind,
  entityId,
  name,
  fileName,
  dataUrl,
  source,
  error,
  updatedAt,
  references,
  waveform = [],
  duration = 0,
  description = '',
  episodeId = 0,
  readOnly = false,
  bytes = 0,
}) => {
  const details = assetKindDetails[kind]
  const safeReferences = Array.isArray(references) ? references : []
  const hasMetadata = Boolean(cleanText(fileName) || cleanText(source))
  const health = resolveAssetHealth({ dataUrl, mediaType: details.mediaType, hasMetadata, error })
  return {
    id,
    kind,
    entityId,
    categoryLabel: details.label,
    mediaType: details.mediaType,
    page: details.page,
    name: cleanText(name) || details.label,
    fileName: cleanText(fileName),
    dataUrl: cleanText(dataUrl),
    mimeType: resolveDataUrlMimeType(dataUrl),
    source: cleanText(source) || (cleanText(dataUrl) ? 'local' : ''),
    error: cleanText(error),
    updatedAt: cleanText(updatedAt),
    estimatedBytes: getDataUrlByteSize(dataUrl) || Math.max(0, Number(bytes) || 0),
    health: safeReferences.length || health !== 'ready' ? health : 'unused',
    references: safeReferences,
    waveform: Array.isArray(waveform) ? waveform : [],
    duration: Math.max(0, Number(duration) || 0),
    description: cleanText(description),
    episodeId: Number(episodeId) || 0,
    readOnly: readOnly === true,
  }
}

const shouldIncludeAsset = ({ dataUrl, fileName, source, error, always = false }) => (
  always || Boolean(cleanText(dataUrl) || cleanText(fileName) || cleanText(source) || cleanText(error))
)

export const buildAssetLibraryIndex = ({
  episodes = [],
  scenes = [],
  characters = [],
  shots = [],
  lines = [],
  videoAssets = [],
  shotVideoHealth = {},
  audioTracks = [],
} = {}) => {
  const episodeMap = new Map(episodes.map((episode, index) => [episode.id, `第 ${index + 1} 集 · ${cleanText(episode.title) || '未命名剧集'}`]))
  const sceneMap = new Map(scenes.map((scene) => [scene.id, cleanText(scene.title) || `场景 ${scene.id}`]))
  const assets = []

  characters.forEach((character) => {
    if (!shouldIncludeAsset({ dataUrl: character.image, fileName: character.imageFileName, source: character.imageSource, error: character.imageError })) return
    const characterName = cleanText(character.name) || '未命名角色'
    assets.push(createAsset({
      id: `character-image:${character.id}`,
      kind: 'character-image',
      entityId: character.id,
      name: `${characterName} · 参考图`,
      fileName: character.imageFileName,
      dataUrl: character.image,
      source: character.imageSource,
      error: character.imageError,
      updatedAt: character.imageUpdatedAt,
      bytes: character.imageBytes,
      description: cleanText(character.role) || '角色参考图',
      references: [{
        id: `character:${character.id}`,
        page: 'character',
        type: '角色',
        title: `${characterName} · 参考图`,
        characterId: character.id,
      }],
    }))
  })

  shots.forEach((shot) => {
    if (!shouldIncludeAsset({ dataUrl: shot.image, fileName: shot.imageFileName, source: shot.imageSource, error: shot.imageError })) return
    const sceneTitle = sceneMap.get(shot.sceneId) || `场景 ${shot.sceneId || '-'}`
    const episodeTitle = episodeMap.get(shot.episodeId) || '未归属剧集'
    assets.push(createAsset({
      id: `shot-image:${shot.id}`,
      kind: 'shot-image',
      entityId: shot.id,
      name: `镜头 ${String(shot.id).padStart(2, '0')} · ${sceneTitle}`,
      fileName: shot.imageFileName,
      dataUrl: shot.image,
      source: shot.imageSource,
      error: shot.imageError,
      updatedAt: shot.imageUpdatedAt,
      bytes: shot.imageBytes,
      description: truncate(shot.action || shot.dialogue || episodeTitle),
      references: [{
        id: `shot:${shot.id}`,
        page: 'storyboard',
        type: '分镜',
        title: `${episodeTitle} · ${sceneTitle} · 镜头 ${String(shot.id).padStart(2, '0')}`,
        episodeId: shot.episodeId,
        sceneId: shot.sceneId,
        shotId: shot.id,
      }],
    }))
  })

  videoAssets.forEach((videoAsset) => {
    const references = shots.flatMap((shot, index) => String(shot.videoAssetId || '') === String(videoAsset.id)
      ? [{
        id: `shot-video:${videoAsset.id}:${shot.id}`,
        page: 'final',
        type: '镜头视频',
        title: `成片时间线 · 镜头 ${String(index + 1).padStart(2, '0')}`,
        episodeId: shot.episodeId,
        sceneId: shot.sceneId,
        shotId: shot.id,
      }]
      : [])
    const runtime = shotVideoHealth[videoAsset.id] || { health: 'missing', mediaUrl: '' }
    const health = runtime.health === 'ready' ? (references.length ? 'ready' : 'unused') : 'missing'
    assets.push({
      id: `shot-video:${videoAsset.id}`,
      kind: 'shot-video',
      entityId: videoAsset.id,
      categoryLabel: assetKindDetails['shot-video'].label,
      mediaType: 'video',
      page: 'final',
      name: cleanText(videoAsset.fileName) || '本地镜头视频.mp4',
      fileName: cleanText(videoAsset.fileName),
      dataUrl: cleanText(videoAsset.lastFrame?.dataUrl),
      thumbnailUrl: cleanText(videoAsset.lastFrame?.dataUrl),
      mediaUrl: cleanText(runtime.mediaUrl),
      mimeType: 'video/mp4',
      source: 'local',
      error: health === 'missing' ? '本机视频已移动或损坏' : '',
      updatedAt: cleanText(videoAsset.importedAt),
      estimatedBytes: Math.max(0, Number(videoAsset.bytes) || 0),
      storageScope: 'managed',
      health,
      references,
      waveform: [],
      duration: Math.max(0, Number(videoAsset.duration) || 0),
      width: Math.max(0, Number(videoAsset.width) || 0),
      height: Math.max(0, Number(videoAsset.height) || 0),
      fps: Math.max(0, Number(videoAsset.fps) || 0),
      lastFrame: videoAsset.lastFrame || null,
      description: `${Number(videoAsset.duration || 0).toFixed(1)} 秒 · ${videoAsset.width || 0}×${videoAsset.height || 0}`,
    })
  })

  lines.forEach((line) => {
    if (!shouldIncludeAsset({ dataUrl: line.audio, fileName: line.audioFileName, source: line.audioSource, error: line.audioError })) return
    const speaker = cleanText(line.speaker) || '未指定角色'
    const sceneTitle = sceneMap.get(line.sceneId) || cleanText(line.scene) || `场景 ${line.sceneId || '-'}`
    const episodeTitle = episodeMap.get(line.episodeId) || '未归属剧集'
    assets.push(createAsset({
      id: `voice-audio:${line.id}`,
      kind: 'voice-audio',
      entityId: line.id,
      name: `${speaker} · ${truncate(line.text || '未填写台词', 24)}`,
      fileName: line.audioFileName,
      dataUrl: line.audio,
      source: line.audioSource,
      error: line.audioError,
      updatedAt: line.audioUpdatedAt,
      bytes: line.audioBytes,
      duration: Number(line.audioDuration) || Number.parseFloat(line.duration) || 0,
      description: `${sceneTitle} · ${cleanText(line.emotion) || '默认情绪'}`,
      references: [{
        id: `line:${line.id}`,
        page: 'voice',
        type: '台词',
        title: `${episodeTitle} · ${sceneTitle} · ${speaker}`,
        episodeId: line.episodeId,
        sceneId: line.sceneId,
        lineId: line.id,
        speaker,
      }],
    }))
  })

  audioTracks.forEach((track) => {
    const kind = track.kind === 'sfx' ? 'sfx' : 'bgm'
    assets.push(createAsset({
      id: `audio-track:${track.assetScopedId || track.id}`,
      kind,
      entityId: track.id,
      name: cleanText(track.name) || (kind === 'bgm' ? '背景音乐' : '音效'),
      fileName: track.fileName,
      dataUrl: track.audio,
      source: 'local',
      error: track.audioError,
      updatedAt: track.audioUpdatedAt,
      waveform: track.waveform,
      duration: track.duration,
      description: `${track.legacyProduction ? '旧版全项目成片' : '成片时间线'} · ${Number(track.start || 0).toFixed(1)}s`,
      references: [{
        id: `track:${track.assetScopedId || track.id}`,
        page: 'final',
        type: kind === 'bgm' ? '背景音乐' : '音效',
        title: `${track.legacyProduction ? '旧版全项目成片 · 只读' : '成片时间线'} · ${Number(track.start || 0).toFixed(1)}s`,
        episodeId: track.episodeId,
        trackId: track.id,
      }],
      episodeId: track.episodeId,
      readOnly: track.readOnly,
    }))
  })

  return assets.map((asset) => ({
    ...asset,
    searchText: [asset.name, asset.fileName, asset.categoryLabel, asset.description, ...asset.references.map((reference) => reference.title)]
      .join(' ')
      .toLocaleLowerCase('zh-CN'),
  }))
}

export const summarizeAssetLibrary = (assets = []) => ({
  total: assets.length,
  totalBytes: assets.filter((asset) => asset.storageScope !== 'managed').reduce((total, asset) => total + asset.estimatedBytes, 0),
  managedBytes: assets.filter((asset) => asset.storageScope === 'managed').reduce((total, asset) => total + asset.estimatedBytes, 0),
  byKind: Object.fromEntries(Object.keys(assetKindDetails).map((kind) => [kind, assets.filter((asset) => asset.kind === kind).length])),
  byHealth: ['ready', 'unused', 'missing', 'broken'].reduce((result, health) => ({
    ...result,
    [health]: assets.filter((asset) => asset.health === health).length,
  }), {}),
})

export const filterAssetLibraryIndex = (assets = [], {
  query = '',
  kind = 'all',
  health = 'all',
  sort = 'recent',
} = {}) => {
  const normalizedQuery = cleanText(query).toLocaleLowerCase('zh-CN')
  const filtered = assets.filter((asset) => (
    (kind === 'all' || asset.kind === kind)
    && (health === 'all' || asset.health === health)
    && (!normalizedQuery || asset.searchText.includes(normalizedQuery))
  ))
  return [...filtered].sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name, 'zh-CN')
    if (sort === 'size-desc') return right.estimatedBytes - left.estimatedBytes || left.name.localeCompare(right.name, 'zh-CN')
    if (sort === 'type') return left.categoryLabel.localeCompare(right.categoryLabel, 'zh-CN') || left.name.localeCompare(right.name, 'zh-CN')
    const rightTime = Date.parse(right.updatedAt) || 0
    const leftTime = Date.parse(left.updatedAt) || 0
    return rightTime - leftTime || left.name.localeCompare(right.name, 'zh-CN')
  })
}

const unchangedCollections = ({ characters, shots, lines, audioTracks }) => ({ characters, shots, lines, audioTracks })

export const replaceProjectAsset = ({
  asset,
  dataUrl,
  fileName,
  waveform = [],
  duration = 0,
  updatedAt = new Date().toISOString(),
  characters = [],
  shots = [],
  lines = [],
  audioTracks = [],
} = {}) => {
  if (!asset || !cleanText(dataUrl).startsWith(`data:${asset.mediaType}/`)) {
    return { ok: false, error: '素材数据格式无效', ...unchangedCollections({ characters, shots, lines, audioTracks }) }
  }
  const entityExists = asset.kind === 'character-image'
    ? characters.some((item) => item.id === asset.entityId)
    : asset.kind === 'shot-image'
      ? shots.some((item) => item.id === asset.entityId)
      : asset.kind === 'voice-audio'
        ? lines.some((item) => item.id === asset.entityId)
        : audioTracks.some((item) => item.id === asset.entityId)
  if (!entityExists) return { ok: false, error: '素材对应的项目数据已不存在', ...unchangedCollections({ characters, shots, lines, audioTracks }) }

  const result = unchangedCollections({ characters, shots, lines, audioTracks })
  if (asset.kind === 'character-image') {
    result.characters = characters.map((item) => item.id === asset.entityId ? {
      ...item,
      image: dataUrl,
      imageFileName: fileName,
      imageSource: 'local',
      imageError: '',
      imageUpdatedAt: updatedAt,
    } : item)
  } else if (asset.kind === 'shot-image') {
    result.shots = shots.map((item) => item.id === asset.entityId ? {
      ...item,
      image: dataUrl,
      imageStatus: '已完成',
      imageFileName: fileName,
      imageSource: 'local',
      imageError: '',
      imageUpdatedAt: updatedAt,
    } : item)
  } else if (asset.kind === 'voice-audio') {
    result.lines = lines.map((item) => item.id === asset.entityId ? {
      ...item,
      audio: dataUrl,
      audioAssetId: '',
      audioStatus: '已完成',
      audioFileName: fileName,
      audioSource: 'local',
      audioError: '',
      audioUpdatedAt: updatedAt,
      status: '待确认',
      ...(duration > 0 ? { duration: `${Number(duration).toFixed(1)}s` } : {}),
    } : item)
  } else {
    result.audioTracks = audioTracks.map((item) => item.id === asset.entityId ? {
      ...item,
      audio: dataUrl,
      fileName,
      waveform: Array.isArray(waveform) ? waveform : [],
      audioError: '',
      audioUpdatedAt: updatedAt,
      ...(duration > 0 ? { duration: Number(duration.toFixed(2)) } : {}),
    } : item)
  }
  return { ok: true, ...result }
}

export const removeProjectAsset = ({
  asset,
  characters = [],
  shots = [],
  lines = [],
  audioTracks = [],
} = {}) => {
  if (!asset) return { ok: false, error: '请选择要移除的素材', ...unchangedCollections({ characters, shots, lines, audioTracks }) }
  const result = unchangedCollections({ characters, shots, lines, audioTracks })
  if (asset.kind === 'character-image') {
    result.characters = characters.map((item) => item.id === asset.entityId ? {
      ...item,
      image: '', imageFileName: '', imageSource: '', imageError: '', imageUpdatedAt: '',
    } : item)
  } else if (asset.kind === 'shot-image') {
    result.shots = shots.map((item) => item.id === asset.entityId ? {
      ...item,
      image: '', imageStatus: '未生成', imageFileName: '', imageSource: '', imageError: '', imageUpdatedAt: '',
    } : item)
  } else if (asset.kind === 'voice-audio') {
    result.lines = lines.map((item) => item.id === asset.entityId ? {
      ...item,
      audio: '', audioAssetId: '', audioBytes: 0, audioDuration: 0, audioSha256: '', audioInputHash: '', audioStatus: '未生成', audioFileName: '', audioSource: '', audioError: '', audioUpdatedAt: '', status: '未配音',
    } : item)
  } else if (asset.kind === 'bgm' || asset.kind === 'sfx') {
    result.audioTracks = audioTracks.filter((item) => item.id !== asset.entityId)
  } else {
    return { ok: false, error: '不支持的素材类型', ...result }
  }
  return { ok: true, ...result }
}
