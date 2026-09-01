import { isManagedGeneratedImageUrl } from './generatedImageAssetService.js'

export const maximumShotVideoPromptCharacters = 5000
export const maximumShotVideoNegativePromptCharacters = 500
export const minimumShotVideoDuration = 2
export const maximumShotVideoDuration = 15
export const maximumShotVideoSeed = 2147483647

export const shotVideoModeOptions = Object.freeze([
  Object.freeze({ value: 'first-frame', label: '首帧生视频' }),
  Object.freeze({ value: 'first-last', label: '首尾帧生视频' }),
])

export const shotVideoResolutionOptions = Object.freeze([
  Object.freeze({ value: '720P', label: '720P · 预览默认' }),
  Object.freeze({ value: '1080P', label: '1080P · 影响费用' }),
])

const cleanText = (value) => String(value || '').trim()

export const isShotVideoFrameDataUrl = (value) => (
  /^data:image\/(?:jpeg|jpg|png|bmp|webp);base64,/iu.test(cleanText(value))
  || isManagedGeneratedImageUrl(value)
)

export const mapShotVideoDuration = (value) => {
  const parsed = Number.parseFloat(value)
  const sourceDuration = Number.isFinite(parsed) && parsed > 0 ? parsed : 5
  const apiDuration = Math.min(maximumShotVideoDuration, Math.max(minimumShotVideoDuration, Math.round(sourceDuration)))
  return {
    sourceDuration: Number(sourceDuration.toFixed(3)),
    apiDuration,
    adjusted: Math.abs(sourceDuration - apiDuration) > 0.0001,
  }
}

export const createShotVideoPromptDraft = (shot = {}) => cleanText(shot.visualPrompt)

export const createShotVideoDirectorPrompt = ({ shot = {}, episode = {}, scene = {}, nextShot = {} } = {}) => {
  const parts = ['漫剧单镜头动态']
  if (episode.title) parts.push(`剧集：${cleanText(episode.title)}`)
  if (scene.title || scene.location || scene.time || scene.weather) {
    const sceneDetails = [scene.title, scene.location, scene.time, scene.weather].map(cleanText).filter(Boolean).join('，')
    if (sceneDetails) parts.push(`场景：${sceneDetails}`)
  }
  if (shot.visualPrompt) parts.push(`画面：${cleanText(shot.visualPrompt)}`)
  if (shot.action) parts.push(`主体动作：${cleanText(shot.action)}`)
  if (shot.dialogue) parts.push(`情绪与对白参考：${cleanText(shot.dialogue)}`)
  const camera = [shot.size, shot.motion].map(cleanText).filter(Boolean).join('，')
  if (camera) parts.push(`镜头语言：${camera}`)
  if (shot.costume) parts.push(`连续性服装：${cleanText(shot.costume)}`)
  if (shot.continuityLocked !== false) parts.push('保持人物身份、服装、场景空间与首帧一致')
  if (nextShot.action) parts.push(`可选尾帧趋向：${cleanText(nextShot.action)}`)
  return parts.join('；')
}

const normalizeSeed = (value) => cleanText(value)

export const createShotVideoRequestPreview = ({
  shot = {},
  nextShot = {},
  prompt = '',
  negativePrompt = '',
  mode = shotVideoModeOptions[0].value,
  resolution = shotVideoResolutionOptions[0].value,
  duration,
  promptExtend = false,
  watermark = false,
  seed = '',
  providerConfig = {},
  bailianStatus = {},
} = {}) => {
  const normalizedPrompt = cleanText(prompt)
  const normalizedNegativePrompt = cleanText(negativePrompt)
  const promptLength = Array.from(normalizedPrompt).length
  const negativePromptLength = Array.from(normalizedNegativePrompt).length
  const durationMapping = mapShotVideoDuration(shot.duration)
  const requestedDuration = duration === undefined ? durationMapping.apiDuration : Number(duration)
  const firstFrameAvailable = isShotVideoFrameDataUrl(shot.image)
  const lastFrameAvailable = isShotVideoFrameDataUrl(nextShot.image)
  const allowedMode = shotVideoModeOptions.some((option) => option.value === mode)
  const allowedResolution = shotVideoResolutionOptions.some((option) => option.value === resolution)
  const normalizedSeed = normalizeSeed(seed)
  const seedValid = !normalizedSeed
    || (/^\d+$/u.test(normalizedSeed) && Number(normalizedSeed) <= maximumShotVideoSeed)
  const errors = []

  if (!firstFrameAvailable) errors.push('当前镜头缺少受支持的真实首帧图片')
  if (!normalizedPrompt) errors.push('导演提示词不能为空')
  if (promptLength > maximumShotVideoPromptCharacters) errors.push(`导演提示词不能超过 ${maximumShotVideoPromptCharacters} 个字符`)
  if (negativePromptLength > maximumShotVideoNegativePromptCharacters) errors.push(`反向提示词不能超过 ${maximumShotVideoNegativePromptCharacters} 个字符`)
  if (!allowedMode) errors.push('请选择受支持的视频模式')
  if (mode === 'first-last' && !lastFrameAvailable) errors.push('首尾帧模式需要下一镜头的真实图片')
  if (!allowedResolution) errors.push('请选择受支持的视频分辨率')
  if (!Number.isInteger(requestedDuration) || requestedDuration < minimumShotVideoDuration || requestedDuration > maximumShotVideoDuration) {
    errors.push(`API 时长必须是 ${minimumShotVideoDuration}～${maximumShotVideoDuration} 秒整数`)
  }
  if (!seedValid) errors.push(`种子必须是 0～${maximumShotVideoSeed} 的整数`)

  const includeLastFrame = mode === 'first-last' && lastFrameAvailable

  return {
    ok: errors.length === 0,
    errors,
    provider: cleanText(providerConfig.provider) || '未配置',
    model: cleanText(providerConfig.model)
      || cleanText(bailianStatus.capabilities?.video?.model)
      || 'wan2.7-i2v-2026-04-25',
    endpoint: cleanText(providerConfig.endpoint),
    configured: bailianStatus.configured === true,
    paidGenerationEnabled: bailianStatus.paidGenerationEnabled === true,
    executorAvailable: false,
    locked: true,
    willUpload: false,
    willCreateTask: false,
    willPollTask: false,
    mode: allowedMode ? mode : '',
    modeLabel: shotVideoModeOptions.find((option) => option.value === mode)?.label || '未知模式',
    resolution: allowedResolution ? resolution : '',
    sourceDuration: durationMapping.sourceDuration,
    apiDuration: Number.isInteger(requestedDuration) ? requestedDuration : 0,
    durationAdjusted: durationMapping.adjusted || requestedDuration !== durationMapping.sourceDuration,
    prompt: normalizedPrompt,
    promptLength,
    negativePrompt: normalizedNegativePrompt,
    negativePromptLength,
    promptExtend: promptExtend === true,
    watermark: watermark === true,
    seed: normalizedSeed ? Number(normalizedSeed) : null,
    firstFrameAvailable,
    lastFrameAvailable,
    includeLastFrame,
    mediaCount: firstFrameAvailable ? 1 + (includeLastFrame ? 1 : 0) : 0,
    firstFrame: firstFrameAvailable ? {
      type: 'first_frame',
      image: shot.image,
      assetId: cleanText(shot.imageAssetId),
      fileName: cleanText(shot.imageFileName),
      shotId: shot.id || 0,
    } : null,
    lastFrame: includeLastFrame ? {
      type: 'last_frame',
      image: nextShot.image,
      assetId: cleanText(nextShot.imageAssetId),
      fileName: cleanText(nextShot.imageFileName),
      shotId: nextShot.id || 0,
    } : null,
    crossSceneLastFrame: includeLastFrame
      && Boolean(shot.sceneId)
      && Boolean(nextShot.sceneId)
      && String(shot.sceneId) !== String(nextShot.sceneId),
    drivingAudioIncluded: false,
    generatedAudioWillBeDiscarded: true,
  }
}
