import { createShotVisualPrompt, inferShotCharacterIds } from './storyboardPromptService.js'
import { defaultSubtitleStyle, normalizeSubtitleStyle } from './subtitleService.js'
import {
  normalizeShotMotionRange,
  normalizeShotMotionSettings,
  normalizeShotTransitionEdges,
} from './shotMotionService.js'
import { normalizeSceneMetadata } from './sceneMetadataService.js'
import { normalizeShotVideoAssets, pruneInvalidShotVideoContinuity } from './shotVideoAssetService.js'
import {
  getEpisodeProduction,
  normalizeEpisodeProductions,
  normalizeLegacyProduction,
  normalizeProjectSnapshotToV2,
} from './episodeProductionService.js'
import { isSupportedProjectImage } from './generatedImageAssetService.js'
import { resolveManagedVoiceAssetId } from './managedVoiceAssetService.js'
import { normalizePropAssets } from './propAssetService.js'

export const projectFormat = 'manju-project'
export const projectFormatVersion = 2
export const maximumProjectBytes = 10 * 1024 * 1024
export const maximumProjectNameCharacters = 80

const hasProjectNameControlCharacter = (value) => Array.from(value).some((character) => {
  const codePoint = character.codePointAt(0)
  return codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F)
})

export const createProjectLocalId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `local-${globalThis.crypto.randomUUID()}`
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

const normalizeProjectLocalId = (value) => (
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 160)
    : ''
)

export const validateProjectName = (value) => {
  const name = String(value ?? '').trim()
  if (!name) return { ok: false, error: '项目名称不能为空。' }
  if (hasProjectNameControlCharacter(name)) {
    return { ok: false, error: '项目名称包含不可用的控制字符。' }
  }
  if (Array.from(name).length > maximumProjectNameCharacters) {
    return { ok: false, error: `项目名称最多 ${maximumProjectNameCharacters} 个字符。` }
  }
  return { ok: true, name }
}

export const getProjectSnapshotByteSize = (snapshot) => (
  new TextEncoder().encode(JSON.stringify(snapshot, null, 2)).byteLength
)

export const createProjectRenameCandidate = (snapshot, value) => {
  const validation = validateProjectName(value)
  if (!validation.ok) return validation
  const candidate = {
    ...snapshot,
    project: {
      ...snapshot.project,
      name: validation.name,
    },
  }
  if (getProjectSnapshotByteSize(candidate) > maximumProjectBytes) {
    return { ok: false, error: '修改后项目将超过 10 MB，请先移除部分图片或音频。' }
  }
  return { ok: true, name: validation.name, snapshot: candidate }
}

export const createProjectSnapshot = ({
  projectMeta,
  storySeed,
  episodes,
  scenes,
  characters,
  props,
  shots,
  lines,
  videoAssets,
  episodeProductions,
  legacyProduction,
  audioTracks,
  subtitleCues,
  subtitleCuesInitialized,
  subtitleStyle,
}) => {
  const normalizedVideoAssets = normalizeShotVideoAssets(videoAssets || [])
  const normalizedProps = normalizePropAssets(props || [])
  const sourceProductions = Array.isArray(episodeProductions) && episodeProductions.length
    ? episodeProductions
    : episodes[0]
      ? [{
        episodeId: episodes[0].id,
        audioTracks: audioTracks || [],
        subtitleCues: subtitleCues || [],
        subtitleCuesInitialized,
        subtitleStyle: subtitleStyle || defaultSubtitleStyle,
      }]
      : []
  const normalizedProductions = normalizeEpisodeProductions({
    episodeProductions: sourceProductions,
    episodes,
    scenes,
    shots,
    lines,
    videoAssets: normalizedVideoAssets,
    fallbackStyle: subtitleStyle || defaultSubtitleStyle,
  })
  const normalizedLegacyProduction = normalizeLegacyProduction(legacyProduction, subtitleStyle || defaultSubtitleStyle)
  return {
    format: projectFormat,
    version: projectFormatVersion,
    savedAt: new Date().toISOString(),
    project: {
      localProjectId: normalizeProjectLocalId(projectMeta.localProjectId) || createProjectLocalId(),
      name: projectMeta.name,
      genre: projectMeta.genre,
      ratio: projectMeta.ratio,
      duration: projectMeta.duration,
      episodeCount: episodes.length || 1,
      synopsis: storySeed,
    },
    content: {
      episodes,
      scenes: scenes.map(({ image, ...scene }) => ({
        ...scene,
        ...(isSupportedProjectImage(image) ? { image } : {}),
      })),
      characters: characters.map(({ image, ...character }) => ({
        ...character,
        ...(isSupportedProjectImage(image) ? { image } : {}),
      })),
      props: normalizedProps.map(({ image, ...prop }) => ({
        ...prop,
        ...(isSupportedProjectImage(image) ? { image } : {}),
      })),
      shots: shots.map(({ image, ...shot }) => ({
        ...shot,
        ...(isSupportedProjectImage(image) ? { image } : {}),
      })),
      videoAssets: normalizedVideoAssets,
      lines: lines.map(({ audio, ...line }) => ({
        ...line,
        ...(typeof audio === 'string' && (audio.startsWith('data:audio/') || audio.startsWith('manju-media://voice/')) ? { audio } : {}),
      })),
      episodeProductions: normalizedProductions,
      ...(normalizedLegacyProduction ? { legacyProduction: normalizedLegacyProduction } : {}),
    },
  }
}

export const readProjectSnapshot = (snapshot, fallback) => {
  if (!snapshot || snapshot.format !== projectFormat || ![1, projectFormatVersion].includes(snapshot.version)) {
    throw new Error('项目文件格式不受支持')
  }
  const sourceVersion = snapshot.version
  const migratedSnapshot = normalizeProjectSnapshotToV2(snapshot)

  const content = migratedSnapshot.content
  const episodes = Array.isArray(content.episodes) && content.episodes.length > 0 ? content.episodes : fallback.episodes
  const defaultEpisodeId = episodes[0]?.id || 1
  const sourceCharacters = Array.isArray(content.characters) && content.characters.length > 0 ? content.characters : fallback.characters
  const characters = sourceCharacters.map((character) => ({
    ...character,
    image: isSupportedProjectImage(character.image) ? character.image : '',
    imageStatus: isSupportedProjectImage(character.image)
      ? '已完成'
      : ['排队中', '生成中', '失败'].includes(character.imageStatus)
        ? character.imageStatus
        : '未生成',
    imageSource: isSupportedProjectImage(character.image)
      ? (typeof character.imageSource === 'string' && character.imageSource ? character.imageSource : 'local')
      : '',
    imageAssetId: typeof character.imageAssetId === 'string' ? character.imageAssetId : '',
    imageBytes: Number.isFinite(character.imageBytes) ? character.imageBytes : 0,
    imageSha256: typeof character.imageSha256 === 'string' ? character.imageSha256 : '',
    imageFileName: typeof character.imageFileName === 'string' ? character.imageFileName : '',
    imageError: typeof character.imageError === 'string' ? character.imageError : '',
  }))
  const sourceScenes = Array.isArray(content.scenes) && content.scenes.length > 0 ? content.scenes : fallback.scenes
  const scenes = sourceScenes.map((scene) => normalizeSceneMetadata({
    ...scene,
    episodeId: scene.episodeId || defaultEpisodeId,
    action: typeof scene.action === 'string' ? scene.action : '',
    narration: typeof scene.narration === 'string' ? scene.narration : '',
    ...(isSupportedProjectImage(scene.image) ? { image: scene.image } : { image: '' }),
    imageStatus: isSupportedProjectImage(scene.image)
      ? '已完成'
      : ['排队中', '生成中', '失败'].includes(scene.imageStatus)
        ? scene.imageStatus
        : '未生成',
    imageSource: isSupportedProjectImage(scene.image) ? (typeof scene.imageSource === 'string' && scene.imageSource ? scene.imageSource : 'local') : '',
    imageAssetId: typeof scene.imageAssetId === 'string' ? scene.imageAssetId : '',
    imageBytes: Number.isFinite(scene.imageBytes) ? scene.imageBytes : 0,
    imageSha256: typeof scene.imageSha256 === 'string' ? scene.imageSha256 : '',
    imageFileName: typeof scene.imageFileName === 'string' ? scene.imageFileName : '',
    imageError: typeof scene.imageError === 'string' ? scene.imageError : '',
    imageAttempt: Number.isFinite(scene.imageAttempt) ? scene.imageAttempt : 0,
  }, characters))
  const defaultScene = scenes[0] || { id: 1, episodeId: defaultEpisodeId, title: '默认场景' }
  const props = normalizePropAssets(Array.isArray(content.props) ? content.props : fallback.props || [])
  const normalizeSceneItem = (item) => {
    const matchedScene = scenes.find((scene) => scene.id === item.sceneId)
    const scene = matchedScene || defaultScene
    return {
      ...item,
      episodeId: item.episodeId || scene.episodeId || defaultEpisodeId,
      sceneId: item.sceneId || scene.id,
    }
  }
  const sourceShots = Array.isArray(content.shots) ? content.shots : fallback.shots
  const videoAssets = normalizeShotVideoAssets(Array.isArray(content.videoAssets) ? content.videoAssets : fallback.videoAssets || [])
  const videoAssetIds = new Set(videoAssets.map((asset) => asset.id))
  const sourceLines = Array.isArray(content.lines) ? content.lines : fallback.lines
  const shots = sourceShots.map(normalizeSceneItem).map((shot) => {
    const scene = scenes.find((item) => item.id === shot.sceneId) || defaultScene
    const enrichedShot = {
      ...shot,
      ...normalizeShotMotionSettings(shot),
      ...normalizeShotMotionRange(shot),
      ...normalizeShotTransitionEdges(shot),
      voiceSourceShotId: shot.voiceSourceShotId || 0,
      voiceOffsetSeconds: Number(Math.max(0, Number(shot.voiceOffsetSeconds) || 0).toFixed(3)),
      videoAssetId: videoAssetIds.has(String(shot.videoAssetId || '')) ? String(shot.videoAssetId) : '',
      videoOffsetSeconds: Number(Math.max(0, Number(shot.videoOffsetSeconds) || 0).toFixed(3)),
      videoDurationPolicy: 'fit-timeline',
      videoContinuitySourceShotId: shot.videoContinuitySourceShotId || 0,
      characterIds: inferShotCharacterIds(shot, characters),
      costume: typeof shot.costume === 'string' ? shot.costume : '角色默认服装',
      continuityLocked: typeof shot.continuityLocked === 'boolean' ? shot.continuityLocked : true,
      ...(isSupportedProjectImage(shot.image) ? { image: shot.image } : { image: '' }),
      imageStatus: isSupportedProjectImage(shot.image)
        ? '已完成'
        : ['排队中', '生成中', '失败'].includes(shot.imageStatus)
          ? shot.imageStatus
          : '未生成',
      imageSource: isSupportedProjectImage(shot.image) ? (typeof shot.imageSource === 'string' && shot.imageSource ? shot.imageSource : 'local') : '',
      imageAssetId: typeof shot.imageAssetId === 'string' ? shot.imageAssetId : '',
      imageBytes: Number.isFinite(shot.imageBytes) ? shot.imageBytes : 0,
      imageSha256: typeof shot.imageSha256 === 'string' ? shot.imageSha256 : '',
      imageFileName: typeof shot.imageFileName === 'string' ? shot.imageFileName : '',
      imageError: typeof shot.imageError === 'string' ? shot.imageError : '',
      imageAttempt: Number.isFinite(shot.imageAttempt) ? shot.imageAttempt : 0,
    }
    return {
      ...enrichedShot,
      visualPrompt: typeof shot.visualPrompt === 'string' && shot.visualPrompt.trim()
        ? shot.visualPrompt
        : createShotVisualPrompt({ shot: enrichedShot, scene, characters }),
    }
  })
  const normalizedShots = pruneInvalidShotVideoContinuity(shots)
  const lines = sourceLines.map((line) => ({
    ...normalizeSceneItem(line),
    scene: line.scene || scenes.find((scene) => scene.id === (line.sceneId || defaultScene.id))?.title || defaultScene.title,
    ...(typeof line.audio === 'string' && (line.audio.startsWith('data:audio/') || line.audio.startsWith('manju-media://voice/')) ? { audio: line.audio } : { audio: '' }),
    audioStatus: typeof line.audio === 'string' && (line.audio.startsWith('data:audio/') || line.audio.startsWith('manju-media://voice/'))
      ? '已完成'
      : ['排队中', '生成中', '失败'].includes(line.audioStatus)
        ? line.audioStatus
        : '未生成',
    audioSource: typeof line.audio === 'string' && (line.audio.startsWith('data:audio/') || line.audio.startsWith('manju-media://voice/'))
      ? (typeof line.audioSource === 'string' && line.audioSource ? line.audioSource : 'local')
      : '',
    audioAssetId: resolveManagedVoiceAssetId(line),
    audioBytes: Number.isFinite(line.audioBytes) ? line.audioBytes : 0,
    audioDuration: Number.isFinite(line.audioDuration) ? line.audioDuration : 0,
    audioSha256: typeof line.audioSha256 === 'string' ? line.audioSha256 : '',
    audioInputHash: typeof line.audioInputHash === 'string' ? line.audioInputHash : '',
    audioFileName: typeof line.audioFileName === 'string' ? line.audioFileName : '',
    audioError: typeof line.audioError === 'string' ? line.audioError : '',
    audioAttempt: Number.isFinite(line.audioAttempt) ? line.audioAttempt : 0,
  }))
  const episodeProductions = normalizeEpisodeProductions({
    episodeProductions: content.episodeProductions,
    episodes,
    scenes,
    shots: normalizedShots,
    lines,
    videoAssets,
    fallbackStyle: fallback.subtitleStyle || defaultSubtitleStyle,
  })
  const legacyProduction = normalizeLegacyProduction(content.legacyProduction, fallback.subtitleStyle || defaultSubtitleStyle)
  const defaultProduction = getEpisodeProduction(
    episodeProductions,
    defaultEpisodeId,
    fallback.subtitleStyle || defaultSubtitleStyle,
  )
  const localProjectId = normalizeProjectLocalId(migratedSnapshot.project.localProjectId)
    || normalizeProjectLocalId(fallback.projectMeta.localProjectId)
    || createProjectLocalId()
  return {
    projectMeta: {
      ...fallback.projectMeta,
      localProjectId,
      name: migratedSnapshot.project.name || fallback.projectMeta.name,
      genre: migratedSnapshot.project.genre || fallback.projectMeta.genre,
      ratio: migratedSnapshot.project.ratio || fallback.projectMeta.ratio,
      duration: migratedSnapshot.project.duration || fallback.projectMeta.duration,
      episodeCount: Number(migratedSnapshot.project.episodeCount) || 1,
    },
    storySeed: migratedSnapshot.project.synopsis || fallback.storySeed,
    episodes,
    scenes,
    characters,
    props,
    shots: normalizedShots,
    lines,
    videoAssets,
    episodeProductions,
    legacyProduction,
    migrationInfo: {
      sourceVersion,
      targetVersion: projectFormatVersion,
      migrated: sourceVersion !== projectFormatVersion,
      legacyProductionPreserved: Boolean(legacyProduction),
    },
    // Compatibility aliases for callers that have not yet moved to episode-scoped production.
    audioTracks: defaultProduction.audioTracks,
    subtitleCues: defaultProduction.subtitleCues,
    subtitleCuesInitialized: defaultProduction.subtitleCuesInitialized,
    subtitleStyle: normalizeSubtitleStyle(defaultProduction.subtitleStyle),
  }
}
