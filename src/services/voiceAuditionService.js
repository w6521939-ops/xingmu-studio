const toFiniteNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const isValidAuditionDuration = (value) => {
  const duration = toFiniteNumber(value)
  return duration !== null && duration > 0
}

export const clampAuditionTime = (value, duration) => {
  if (!isValidAuditionDuration(duration)) return 0
  const currentTime = toFiniteNumber(value)
  if (currentTime === null) return 0
  return Math.min(Math.max(currentTime, 0), Number(duration))
}

export const getAuditionProgress = (currentTime, duration) => {
  if (!isValidAuditionDuration(duration)) return 0
  return Number(((clampAuditionTime(currentTime, duration) / Number(duration)) * 100).toFixed(3))
}

export const formatAuditionTime = (value, fallback = '--:--.-') => {
  const seconds = toFiniteNumber(value)
  if (seconds === null || seconds < 0) return fallback
  const totalTenths = Math.round(seconds * 10)
  const minutes = Math.floor(totalTenths / 600)
  const remainingTenths = totalTenths % 600
  const wholeSeconds = Math.floor(remainingTenths / 10)
  const tenths = remainingTenths % 10
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`
}

export const normalizeAuditionVolume = (value, fallback = 0.6) => {
  const volume = toFiniteNumber(value)
  const safeFallback = toFiniteNumber(fallback)
  const normalizedFallback = safeFallback === null ? 0.6 : Math.min(Math.max(safeFallback, 0), 1)
  if (volume === null) return normalizedFallback
  return Math.min(Math.max(volume, 0), 1)
}

export const findAdjacentPlayableLineId = (lines, activeLineId, direction) => {
  if (!Array.isArray(lines) || !lines.length || ![-1, 1].includes(direction)) return null
  const activeIndex = lines.findIndex((line) => line.id === activeLineId)
  if (activeIndex < 0) return null
  for (let index = activeIndex + direction; index >= 0 && index < lines.length; index += direction) {
    if (typeof lines[index]?.audio === 'string' && lines[index].audio.trim()) return lines[index].id
  }
  return null
}

export const getVoiceLineAudioSourceStatus = (line) => {
  if (line?.audioStatus === '失败') {
    return { key: 'error', label: '读取失败', detail: line.audioError || '配音任务失败' }
  }
  if (typeof line?.audio === 'string' && line.audio.trim()) {
    return { key: 'local', label: '本地音频', detail: line.audioFileName || '已导入真实音频' }
  }
  if (line?.audioStatus === '排队中' || line?.audioStatus === '生成中') {
    return { key: 'empty', label: '无真实音频', detail: '未关联可播放的本地音频' }
  }
  if (line?.audioStatus === '已完成') {
    return { key: 'empty', label: '无真实音频', detail: '旧任务没有保存真实音频，请重新导入' }
  }
  return { key: 'empty', label: '未导入', detail: '导入本地音频后可真实试听' }
}
