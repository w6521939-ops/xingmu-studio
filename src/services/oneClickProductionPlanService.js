import {
  createCharacterImageGenerationRequest,
  createCharacterImagePrompt,
} from './characterImageRequestService.js'
import { isSupportedProjectImage } from './generatedImageAssetService.js'
import { resolveManagedVoiceAssetId } from './managedVoiceAssetService.js'
import {
  createSceneImageGenerationRequest,
  createSceneImagePrompt,
} from './sceneGenerationService.js'
import {
  createStoryboardImageGenerationRequest,
  createStoryboardImagePromptDraft,
} from './storyboardImageRequestService.js'
import {
  createShotVideoDirectorPrompt,
  mapShotVideoDuration,
} from './shotVideoRequestService.js'
import {
  assignCharacterVoice,
  createCharacterVoiceText,
} from './characterVoiceService.js'
import { buildProductionTimeline } from './timelineService.js'
import { createSubtitleCuesFromTimeline } from './subtitleService.js'
import { estimatePlanCost } from './providers/index.js'

export const oneClickProductionStageDefinitions = Object.freeze([
  Object.freeze({ id: 'preflight', label: '本地检查' }),
  Object.freeze({ id: 'voice-assignment', label: '角色音色' }),
  Object.freeze({ id: 'character-images', label: '角色图片' }),
  Object.freeze({ id: 'scene-images', label: '场景图片' }),
  Object.freeze({ id: 'storyboard-images', label: '分镜图片' }),
  Object.freeze({ id: 'voice-lines', label: '台词配音' }),
  Object.freeze({ id: 'shot-videos', label: '镜头视频' }),
  Object.freeze({ id: 'episode-exports', label: '自动成片' }),
  Object.freeze({ id: 'finalize', label: '完成保存' }),
])

const providerTaskKinds = new Set([
  'character-image',
  'scene-image',
  'storyboard-image',
  'voice-line',
  'shot-video',
])

export const oneClickPlanRequiresProvider = (plan = {}) => (
  (Array.isArray(plan.tasks) ? plan.tasks : []).some((task) => providerTaskKinds.has(task?.kind))
)

const cleanText = (value) => String(value || '').trim()

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  )
}

export const createOneClickInputHash = (value) => {
  const source = JSON.stringify(canonicalize(value))
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const taskId = (kind, entityId, inputHash) => `${kind}:${String(entityId)}:${inputHash}`

const managedReference = (entity, fallbackId) => {
  const assetId = cleanText(entity?.imageAssetId)
  if (assetId) {
    return {
      id: fallbackId,
      name: cleanText(entity?.name || entity?.title) || fallbackId,
      assetId,
      bytes: Math.max(0, Number(entity?.imageBytes) || 0),
    }
  }
  const image = cleanText(entity?.image)
  if (image.startsWith('data:image/')) {
    return {
      id: fallbackId,
      name: cleanText(entity?.name || entity?.title) || fallbackId,
      dataUrl: image,
    }
  }
  return null
}

const createImageTask = ({
  stage,
  kind,
  entityType,
  entityId,
  label,
  request,
  referenceKeys = [],
}) => {
  const inputHash = createOneClickInputHash({
    kind,
    entityId,
    prompt: request.prompt,
    size: request.size,
    references: request.references?.map(({ id, assetId, dataUrl }) => ({
      id,
      assetId: assetId || '',
      dataUrlBytes: dataUrl?.length || 0,
    })),
    referenceKeys,
  })
  return {
    id: taskId(kind, entityId, inputHash),
    stage,
    kind,
    entityType,
    entityId: String(entityId),
    label,
    inputHash,
    status: 'pending',
    request,
    referenceKeys,
  }
}

const createVideoTask = ({ shot, episode, scene, nextShot }) => {
  const duration = mapShotVideoDuration(shot.duration).apiDuration
  const prompt = createShotVideoDirectorPrompt({ shot, episode, scene, nextShot })
  const frameReference = managedReference(shot, `shot:${shot.id}`)
  const endFrameShot = nextShot?.id ? nextShot : shot
  const endFrameReference = managedReference(endFrameShot, `shot:${endFrameShot.id}`)
  const input = {
    shotId: String(shot.id),
    prompt,
    negativePrompt: 'identity drift, costume drift, scene drift, watermark, random text, blurry, low quality',
    resolution: '720P',
    duration,
    promptExtend: false,
    watermark: false,
    seed: null,
    firstFrame: frameReference,
    firstFrameKey: `shot:${shot.id}`,
    lastFrame: endFrameReference,
    lastFrameKey: `shot:${endFrameShot.id}`,
  }
  const inputHash = createOneClickInputHash(input)
  return {
    id: taskId('shot-video', shot.id, inputHash),
    stage: 'shot-videos',
    kind: 'shot-video',
    entityType: 'shot',
    entityId: String(shot.id),
    label: `镜头 ${shot.id} 视频`,
    inputHash,
    status: 'pending',
    request: input,
  }
}

const hasVideo = (shot, assetIds) => {
  const assetId = cleanText(shot.videoAssetId)
  return Boolean(assetId && assetIds.has(assetId))
}

const createVoiceAssignmentTask = (character, assignment) => {
  const inputHash = createOneClickInputHash({
    characterId: character.id,
    gender: character.gender,
    age: character.age,
    ageBand: character.ageBand,
    personality: character.personality,
    role: character.role,
    tone: character.tone,
    assignment,
  })
  return {
    id: taskId('voice-assignment', character.id, inputHash),
    stage: 'voice-assignment',
    kind: 'voice-assignment',
    entityType: 'character',
    entityId: String(character.id),
    label: `${cleanText(character.name) || `角色 ${character.id}`} · 自动音色`,
    inputHash,
    status: 'pending',
    request: { assignment },
  }
}

const createVoiceLineTask = ({ line, assignment }) => {
  const text = createCharacterVoiceText(line.text, line.emotion)
  const input = {
    lineId: String(line.id),
    speaker: cleanText(line.speaker) || '旁白',
    rawText: cleanText(line.text),
    text,
    emotion: cleanText(line.emotion),
    voiceId: assignment.voiceId,
    voiceName: assignment.voiceName,
    model: assignment.voiceModel,
  }
  const inputHash = createOneClickInputHash(input)
  return {
    id: taskId('voice-line', line.id, inputHash),
    stage: 'voice-lines',
    kind: 'voice-line',
    entityType: 'line',
    entityId: String(line.id),
    label: `${input.speaker} · ${input.rawText.slice(0, 24)}`,
    inputHash,
    status: 'pending',
    request: input,
  }
}

const createEpisodeExportTask = ({
  episode,
  project,
  episodes,
  scenes,
  shots,
  lines,
  videoAssets,
}) => {
  const episodeShots = shots.filter((shot) => String(shot.episodeId) === String(episode.id))
  const timeline = buildProductionTimeline({
    episodes,
    scenes,
    shots: episodeShots,
    lines,
    videoAssets,
  })
  const items = timeline.items.map((item) => ({
    id: item.id,
    duration: item.duration,
    subtitle: item.subtitle,
    shot: {
      id: item.shot.id,
      image: isSupportedProjectImage(item.shot.image) ? item.shot.image : '',
      imageAssetId: cleanText(item.shot.imageAssetId),
      videoAssetId: cleanText(item.shot.videoAssetId),
      motionEffect: item.shot.motionEffect,
      motionStrength: item.shot.motionStrength,
      transition: item.shot.transition,
      transitionDuration: item.shot.transitionDuration,
      transitionIn: item.shot.transitionIn,
      transitionOut: item.shot.transitionOut,
      motionRangeStart: item.shot.motionRangeStart,
      motionRangeEnd: item.shot.motionRangeEnd,
    },
    lineId: item.audioLine?.id ? String(item.audioLine.id) : '',
    audioAssetId: resolveManagedVoiceAssetId(item.audioLine),
    audio: typeof item.audioLine?.audio === 'string' && item.audioLine.audio.startsWith('data:audio/')
      ? item.audioLine.audio
      : '',
    voiceOffsetSeconds: item.voiceOffsetSeconds,
    videoOffsetSeconds: item.videoOffsetSeconds,
  }))
  const request = {
    episodeId: String(episode.id),
    episodeTitle: cleanText(episode.title) || `第 ${episode.id} 集`,
    projectName: cleanText(project.name) || '未命名漫剧',
    resolution: project.ratio === '16:9' ? '1920x1080' : '1080x1920',
    items,
    subtitleCues: createSubtitleCuesFromTimeline(timeline.items),
  }
  const inputHash = createOneClickInputHash({
    episodeId: request.episodeId,
    resolution: request.resolution,
    items: items.map((item) => ({
      shotId: item.shot.id,
      duration: item.duration,
      subtitle: item.subtitle,
      imageAssetId: item.shot.imageAssetId,
      videoAssetId: item.shot.videoAssetId,
      lineId: item.lineId,
      audioAssetId: item.audioAssetId,
    })),
  })
  return {
    id: taskId('episode-export', episode.id, inputHash),
    stage: 'episode-exports',
    kind: 'episode-export',
    entityType: 'episode',
    entityId: String(episode.id),
    label: `${request.episodeTitle} · 自动成片`,
    inputHash,
    status: 'pending',
    request,
  }
}

export const createOneClickProductionPlan = (snapshot = {}) => {
  const project = snapshot.project || {}
  const content = snapshot.content || {}
  const episodes = Array.isArray(content.episodes) ? content.episodes : []
  const scenes = Array.isArray(content.scenes) ? content.scenes : []
  const characters = Array.isArray(content.characters) ? content.characters : []
  const shots = Array.isArray(content.shots) ? content.shots : []
  const videoAssets = Array.isArray(content.videoAssets) ? content.videoAssets : []
  const lines = Array.isArray(content.lines) ? content.lines : []
  const blockers = []

  if (!cleanText(project.localProjectId)) blockers.push('项目缺少本地标识')
  if (!episodes.length) blockers.push('项目还没有剧集')
  if (!scenes.length) blockers.push('项目还没有场景')
  if (!shots.length) blockers.push('项目还没有分镜；请先完成剧本拆镜')

  const tasks = []
  const voiceAssignmentByName = new Map()
  for (const character of characters) {
    const assignment = assignCharacterVoice(character)
    voiceAssignmentByName.set(cleanText(character.name), assignment)
    const assignmentMatches = character.voiceId === assignment.voiceId
      && character.voiceModel === assignment.voiceModel
      && character.voiceMode === assignment.voiceMode
    if (!assignmentMatches) tasks.push(createVoiceAssignmentTask(character, assignment))
  }

  for (const character of characters) {
    if (isSupportedProjectImage(character.image)) continue
    const prompt = createCharacterImagePrompt(character)
    tasks.push(createImageTask({
      stage: 'character-images',
      kind: 'character-image',
      entityType: 'character',
      entityId: character.id,
      label: `${cleanText(character.name) || `角色 ${character.id}`} · 角色图`,
      request: createCharacterImageGenerationRequest({ character, prompt }),
    }))
  }

  for (const scene of scenes) {
    if (isSupportedProjectImage(scene.image)) continue
    const prompt = createSceneImagePrompt({
      scene,
      storySeed: project.synopsis,
      characters,
    })
    const request = createSceneImageGenerationRequest({ scene, characters, prompt })
    const referenceKeys = (Array.isArray(scene.mainCharacterIds) ? scene.mainCharacterIds : [])
      .slice(0, 3)
      .map((characterId) => `character:${characterId}`)
    tasks.push(createImageTask({
      stage: 'scene-images',
      kind: 'scene-image',
      entityType: 'scene',
      entityId: scene.id,
      label: `${cleanText(scene.title) || `场景 ${scene.id}`} · 场景图`,
      request,
      referenceKeys,
    }))
  }

  for (const shot of shots) {
    if (isSupportedProjectImage(shot.image)) continue
    const prompt = createStoryboardImagePromptDraft(shot)
      || [
        cleanText(shot.action),
        cleanText(shot.dialogue),
        cleanText(shot.size),
        cleanText(shot.motion),
        '中国漫剧分镜，电影级构图，角色身份与服装一致，无水印，无随机文字',
      ].filter(Boolean).join('；')
    const request = createStoryboardImageGenerationRequest({ shot, characters, prompt })
    const referenceKeys = [
      `scene:${shot.sceneId}`,
      ...(Array.isArray(shot.characterIds) ? shot.characterIds.map((characterId) => `character:${characterId}`) : []),
    ].slice(0, 3)
    tasks.push(createImageTask({
      stage: 'storyboard-images',
      kind: 'storyboard-image',
      entityType: 'shot',
      entityId: shot.id,
      label: `镜头 ${shot.id} · 分镜图`,
      request,
      referenceKeys,
    }))
  }

  let skippedVoiceLines = 0
  for (const line of lines) {
    if (!cleanText(line.text)) continue
    if (line.audioStatus === '已完成' && cleanText(line.audio)) {
      skippedVoiceLines += 1
      continue
    }
    const assignment = voiceAssignmentByName.get(cleanText(line.speaker))
      || assignCharacterVoice({ role: '旁白', tone: '旁白、平稳陈述' })
    tasks.push(createVoiceLineTask({ line, assignment }))
  }

  const videoAssetIds = new Set(videoAssets.map((asset) => cleanText(asset.id)).filter(Boolean))
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index]
    if (hasVideo(shot, videoAssetIds)) continue
    const episode = episodes.find((item) => String(item.id) === String(shot.episodeId)) || {}
    const scene = scenes.find((item) => String(item.id) === String(shot.sceneId)) || {}
    const immediateNextShot = shots[index + 1]
    const nextShot = immediateNextShot && String(immediateNextShot.episodeId) === String(shot.episodeId)
      ? immediateNextShot
      : {}
    tasks.push(createVideoTask({ shot, episode, scene, nextShot }))
  }

  for (const episode of episodes) {
    if (!shots.some((shot) => String(shot.episodeId) === String(episode.id))) continue
    tasks.push(createEpisodeExportTask({
      episode,
      project,
      episodes,
      scenes,
      shots,
      lines,
      videoAssets,
    }))
  }

  const counts = Object.fromEntries(oneClickProductionStageDefinitions.map(({ id }) => [
    id,
    tasks.filter((task) => task.stage === id).length,
  ]))

  const plan = {
    ok: blockers.length === 0,
    blockers,
    projectLocalId: cleanText(project.localProjectId),
    projectName: cleanText(project.name) || '未命名漫剧',
    createdAt: new Date().toISOString(),
    tasks,
    counts,
    total: tasks.length,
    skipped: {
      characterImages: characters.filter((item) => isSupportedProjectImage(item.image)).length,
      sceneImages: scenes.filter((item) => isSupportedProjectImage(item.image)).length,
      storyboardImages: shots.filter((item) => isSupportedProjectImage(item.image)).length,
      voiceLines: skippedVoiceLines,
      shotVideos: shots.filter((item) => hasVideo(item, videoAssetIds)).length,
    },
  }

  plan.costEstimate = estimatePlanCost(plan)

  return plan
}

export const summarizeOneClickRun = (run) => {
  const tasks = Array.isArray(run?.tasks) ? run.tasks : []
  const count = (status) => tasks.filter((task) => task.status === status).length
  return {
    total: tasks.length,
    pending: count('pending'),
    running: count('running'),
    succeeded: count('succeeded'),
    failed: count('failed'),
    skipped: count('skipped'),
    completed: tasks.filter((task) => ['succeeded', 'failed', 'skipped'].includes(task.status)).length,
  }
}
