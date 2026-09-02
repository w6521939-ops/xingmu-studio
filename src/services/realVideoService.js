export const VIDEO_MODES = Object.freeze({
  IMAGE_ANIMATION: 'image-animation',
  REAL_VIDEO: 'real-video',
})

export const videoModeLabels = {
  [VIDEO_MODES.IMAGE_ANIMATION]: '图片动画',
  [VIDEO_MODES.REAL_VIDEO]: '真实视频',
}

export const videoModeDescriptions = {
  [VIDEO_MODES.IMAGE_ANIMATION]: '图片 + 镜头运动 + 配音 + 字幕，适合漫剧风格',
  [VIDEO_MODES.REAL_VIDEO]: 'AI 生成动态片段 + 素材库 B-roll，适合纪实/电影风格',
}

export function validateVideoMode(mode) {
  return Object.values(VIDEO_MODES).includes(mode)
}

export function getVideoModeConfig(mode) {
  switch (mode) {
    case VIDEO_MODES.REAL_VIDEO:
      return {
        mode,
        label: videoModeLabels[mode],
        supportsMultiShot: true,
        supportsStockFootage: true,
        shotGenerationStrategy: 'batch',
        continuityMode: 'last-frame',
        defaultShotDuration: 5,
        maxShotDuration: 8,
      }
    case VIDEO_MODES.IMAGE_ANIMATION:
    default:
      return {
        mode: VIDEO_MODES.IMAGE_ANIMATION,
        label: videoModeLabels[VIDEO_MODES.IMAGE_ANIMATION],
        supportsMultiShot: false,
        supportsStockFootage: false,
        shotGenerationStrategy: 'single',
        continuityMode: 'none',
        defaultShotDuration: 5,
        maxShotDuration: 10,
      }
  }
}
