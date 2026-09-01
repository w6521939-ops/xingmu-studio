export const defaultSubtitleStyle = Object.freeze({
  fontSize: 52,
  color: '#FFFFFF',
  outlineColor: '#102B3A',
  backgroundOpacity: 42,
  position: 'bottom',
  bold: true,
})

const maxSubtitleCues = 500
const maxCueTextLength = 500

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0))

const normalizeColor = (value, fallback) => /^#[0-9A-F]{6}$/iu.test(String(value || ''))
  ? String(value).toUpperCase()
  : fallback

export const normalizeSubtitleStyle = (style = {}) => ({
  fontSize: Math.round(clamp(style.fontSize || defaultSubtitleStyle.fontSize, 32, 96)),
  color: normalizeColor(style.color, defaultSubtitleStyle.color),
  outlineColor: normalizeColor(style.outlineColor, defaultSubtitleStyle.outlineColor),
  backgroundOpacity: Math.round(clamp(style.backgroundOpacity ?? defaultSubtitleStyle.backgroundOpacity, 0, 90)),
  position: ['top', 'middle', 'bottom'].includes(style.position) ? style.position : defaultSubtitleStyle.position,
  bold: style.bold !== false,
})

export const normalizeSubtitleCues = (cues, totalDuration = 30 * 60) => {
  if (!Array.isArray(cues)) return []
  const maximumDuration = Number.isFinite(Number(totalDuration)) && Number(totalDuration) > 0
    ? Number(totalDuration)
    : 30 * 60
  return cues.slice(0, maxSubtitleCues).map((cue, index) => {
    const start = clamp(cue?.start, 0, maximumDuration)
    const requestedEnd = Number(cue?.end)
    const end = clamp(Number.isFinite(requestedEnd) ? requestedEnd : start + 2, start + 0.1, maximumDuration)
    return {
      id: String(cue?.id || `subtitle-${index + 1}`).slice(0, 100),
      sourceItemId: String(cue?.sourceItemId || '').slice(0, 120),
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      text: String(cue?.text || '').replace(/\r\n/gu, '\n').trim().slice(0, maxCueTextLength),
    }
  }).filter((cue) => cue.start < maximumDuration && cue.end > cue.start)
}

export const createSubtitleCuesFromTimeline = (items = []) => normalizeSubtitleCues(
  items.filter((item) => String(item?.subtitle || '').trim()).map((item, index) => ({
    id: `subtitle-${item.shot?.id || index + 1}-${index + 1}`,
    sourceItemId: item.id,
    start: item.start,
    end: item.end,
    text: item.subtitle,
  })),
  items.at(-1)?.end || 30 * 60,
)

const parseSrtTimestamp = (value) => {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/u.exec(String(value || '').trim())
  if (!match) return Number.NaN
  const [, hours, minutes, seconds, milliseconds] = match
  if (Number(minutes) > 59 || Number(seconds) > 59) return Number.NaN
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds.padEnd(3, '0')) / 1000
}

export const parseSrt = (value, totalDuration = 30 * 60) => {
  const blocks = String(value || '').replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n').trim().split(/\n{2,}/u)
  const cues = blocks.map((block, index) => {
    const lines = block.split('\n')
    const timestampIndex = lines.findIndex((line) => line.includes('-->'))
    if (timestampIndex < 0) return null
    const [startValue, endValue] = lines[timestampIndex].split('-->').map((part) => part.trim().split(/\s+/u)[0])
    const start = parseSrtTimestamp(startValue)
    const end = parseSrtTimestamp(endValue)
    const text = lines.slice(timestampIndex + 1).join('\n').trim()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null
    return { id: `srt-${index + 1}`, sourceItemId: '', start, end, text }
  }).filter(Boolean)
  const normalized = normalizeSubtitleCues(cues, totalDuration)
  if (!normalized.length) throw new Error('SRT 中没有可用的字幕条目')
  return normalized
}

const formatSrtTimestamp = (value) => {
  const milliseconds = Math.max(0, Math.round((Number(value) || 0) * 1000))
  const hours = Math.floor(milliseconds / 3600000)
  const minutes = Math.floor((milliseconds % 3600000) / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const remainder = milliseconds % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(remainder).padStart(3, '0')}`
}

export const serializeSrt = (cues = []) => normalizeSubtitleCues(cues)
  .filter((cue) => cue.text)
  .sort((left, right) => left.start - right.start)
  .map((cue, index) => `${index + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}`)
  .join('\n\n')

export const resolveSubtitleCueAtTime = (cues = [], value = 0) => {
  const seconds = Math.max(0, Number(value) || 0)
  return cues.find((cue) => seconds >= cue.start && seconds < cue.end) || null
}
