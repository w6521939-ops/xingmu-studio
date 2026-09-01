import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const maxTimelineItems = 120
const maxTimelineSeconds = 30 * 60
const maxImageBytes = 3 * 1024 * 1024
const maxAudioBytes = 6 * 1024 * 1024
const maxAudioTracks = 6
const supportedMotionEffects = new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'])

const imageExtensions = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
])

const audioExtensions = new Map([
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp4', '.m4a'],
  ['audio/aac', '.aac'],
  ['audio/ogg', '.ogg'],
  ['audio/webm', '.webm'],
])

export class ExportCanceledError extends Error {
  constructor() {
    super('成片导出已取消')
    this.name = 'ExportCanceledError'
    this.code = 'EXPORT_CANCELED'
  }
}

export const isExportCanceledError = (error) => error?.code === 'EXPORT_CANCELED'

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new ExportCanceledError()
}

const clampDuration = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(30, Math.max(0.5, parsed)) : 3
}

const decodeDataUrl = (value, extensionMap, maxBytes) => {
  if (!value) return null
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/u.exec(String(value))
  if (!match || !extensionMap.has(match[1])) return null
  if (match[2].length > Math.ceil(maxBytes * 4 / 3) + 8) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > maxBytes) return null
  return { buffer, extension: extensionMap.get(match[1]) }
}

const runFfmpeg = (ffmpegPath, args, cwd, timeoutMs = 120000, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new ExportCanceledError())
    return
  }
  const child = spawn(ffmpegPath, args, {
    cwd,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  let settled = false
  let cancelRequested = false
  let timeoutRequested = false
  const finish = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
  const cancel = () => {
    if (settled) return
    cancelRequested = true
    child.kill('SIGKILL')
  }
  const timer = setTimeout(() => {
    if (settled) return
    timeoutRequested = true
    child.kill('SIGKILL')
  }, timeoutMs)
  signal?.addEventListener('abort', cancel, { once: true })
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-12000)
  })
  child.on('error', (error) => {
    if (settled) return
    settled = true
    finish()
    reject(cancelRequested ? new ExportCanceledError() : error)
  })
  child.on('close', (code) => {
    if (settled) return
    settled = true
    finish()
    if (cancelRequested) reject(new ExportCanceledError())
    else if (timeoutRequested) reject(new Error('FFmpeg 处理超时，请检查素材文件是否损坏'))
    else if (code === 0) resolve()
    else reject(new Error(stderr.trim().split(/\r?\n/u).slice(-8).join('\n') || `FFmpeg 退出码 ${code}`))
  })
})

const escapeAssText = (value) => String(value || '')
  .replaceAll('\\', '\\\\')
  .replaceAll('{', '\\{')
  .replaceAll('}', '\\}')
  .replace(/\r?\n/gu, '\\N')

const formatAssTime = (value) => {
  const centiseconds = Math.max(0, Math.round(Number(value || 0) * 100))
  const hours = Math.floor(centiseconds / 360000)
  const minutes = Math.floor((centiseconds % 360000) / 6000)
  const seconds = Math.floor((centiseconds % 6000) / 100)
  const remainder = centiseconds % 100
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(remainder).padStart(2, '0')}`
}

const normalizeHexColor = (value, fallback) => /^#[0-9A-F]{6}$/iu.test(String(value || '')) ? String(value).toUpperCase() : fallback

const toAssColor = (value, alpha = 0) => {
  const normalized = normalizeHexColor(value, '#FFFFFF').slice(1)
  const red = normalized.slice(0, 2)
  const green = normalized.slice(2, 4)
  const blue = normalized.slice(4, 6)
  return `&H${Math.min(255, Math.max(0, alpha)).toString(16).padStart(2, '0').toUpperCase()}${blue}${green}${red}`
}

const normalizeSubtitleStyle = (style = {}) => ({
  fontSize: Math.min(96, Math.max(32, Number(style.fontSize) || 52)),
  color: normalizeHexColor(style.color, '#FFFFFF'),
  outlineColor: normalizeHexColor(style.outlineColor, '#102B3A'),
  backgroundOpacity: Math.min(90, Math.max(0, Number(style.backgroundOpacity) || 0)),
  position: ['top', 'middle', 'bottom'].includes(style.position) ? style.position : 'bottom',
  bold: style.bold !== false,
})

const normalizeSubtitleCues = (cues, items, totalDuration) => {
  const source = Array.isArray(cues) && cues.length
    ? cues
    : items.map((item) => ({ start: item.start, end: item.end, text: item.subtitle }))
  return source.slice(0, 500).map((cue) => {
    const start = Math.min(totalDuration, Math.max(0, Number(cue?.start) || 0))
    const end = Math.min(totalDuration, Math.max(start + 0.1, Number(cue?.end) || start + 2))
    return { start, end, text: String(cue?.text || '').trim().slice(0, 500) }
  }).filter((cue) => cue.text && cue.start < totalDuration && cue.end > cue.start)
}

const createAssDocument = (cues, width, height, requestedStyle) => {
  const style = normalizeSubtitleStyle(requestedStyle)
  const scale = Math.min(width / 1080, height / 1920)
  const fontSize = Math.max(18, Math.round(style.fontSize * scale))
  const marginV = style.position === 'middle' ? 0 : Math.round(height * (style.position === 'top' ? 0.075 : 0.075))
  const alignment = style.position === 'top' ? 8 : style.position === 'middle' ? 5 : 2
  const backgroundAlpha = Math.round((1 - style.backgroundOpacity / 100) * 255)
  const events = cues
    .map((cue) => `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${escapeAssText(cue.text)}`)
    .join('\n')
  return `\uFEFF[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,${fontSize},${toAssColor(style.color)},${toAssColor(style.color)},${toAssColor(style.outlineColor)},${toAssColor(style.outlineColor, backgroundAlpha)},${style.bold ? -1 : 0},0,0,0,100,100,0,0,${style.backgroundOpacity > 0 ? 3 : 1},2,0,${alignment},70,70,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`
}

const escapeFilterPath = (value) => path.resolve(value)
  .replaceAll('\\', '/')
  .replace(':', '\\:')
  .replaceAll("'", "\\'")

const normalizeTimelineItems = (items, fallbackTransition = 'fade') => {
  if (!Array.isArray(items) || items.length === 0) throw new Error('时间线中没有可导出的镜头')
  if (items.length > maxTimelineItems) throw new Error(`单次最多导出 ${maxTimelineItems} 个镜头`)
  let cursor = 0
  const normalized = items.map((item, index) => {
    const duration = clampDuration(item?.duration)
    const normalizedItem = {
      index,
      duration,
      start: cursor,
      end: cursor + duration,
      subtitle: String(item?.subtitle || '').trim().slice(0, 500),
      image: decodeDataUrl(item?.shot?.image, imageExtensions, maxImageBytes),
      videoPath: typeof item?.videoFilePath === 'string' && item.videoFilePath ? item.videoFilePath : '',
      videoRequested: Boolean(item?.shot?.videoAssetId),
      videoOffsetSeconds: Number(Math.max(0, Number(item?.videoOffsetSeconds ?? item?.shot?.videoOffsetSeconds) || 0).toFixed(3)),
      audioPath: typeof item?.audioFilePath === 'string' && item.audioFilePath ? item.audioFilePath : '',
      audio: typeof item?.audioFilePath === 'string' && item.audioFilePath
        ? null
        : decodeDataUrl(item?.audioLine?.audio, audioExtensions, maxAudioBytes),
      motionEffect: supportedMotionEffects.has(item?.shot?.motionEffect) ? item.shot.motionEffect : 'none',
      motionStrength: Math.round(Math.min(25, Math.max(5, Number(item?.shot?.motionStrength) || 12))),
      transition: ['fade', 'cut'].includes(item?.shot?.transition) ? item.shot.transition : fallbackTransition === 'cut' ? 'cut' : 'fade',
      transitionDuration: Number(Math.min(0.8, Math.max(0.1, Number(item?.shot?.transitionDuration) || 0.25)).toFixed(2)),
      motionRangeStart: Number(Math.min(1, Math.max(0, Number.isFinite(Number(item?.shot?.motionRangeStart)) ? Number(item.shot.motionRangeStart) : 0)).toFixed(6)),
      motionRangeEnd: Number(Math.min(1, Math.max(0, Number.isFinite(Number(item?.shot?.motionRangeEnd)) ? Number(item.shot.motionRangeEnd) : 1)).toFixed(6)),
      transitionIn: ['fade', 'cut'].includes(item?.shot?.transitionIn) ? item.shot.transitionIn : null,
      transitionOut: ['fade', 'cut'].includes(item?.shot?.transitionOut) ? item.shot.transitionOut : null,
      voiceOffsetSeconds: Number(Math.max(0, Number(item?.voiceOffsetSeconds ?? item?.shot?.voiceOffsetSeconds) || 0).toFixed(3)),
    }
    normalizedItem.motionRangeEnd = Math.max(normalizedItem.motionRangeStart, normalizedItem.motionRangeEnd)
    normalizedItem.transitionIn ||= normalizedItem.transition
    normalizedItem.transitionOut ||= normalizedItem.transition
    cursor += duration
    return normalizedItem
  })
  if (cursor > maxTimelineSeconds) throw new Error('成片总时长不能超过 30 分钟')
  return normalized
}

export const buildShotVideoFilter = ({
  width,
  height,
  duration,
  motionEffect = 'none',
  motionStrength = 12,
  transition = 'fade',
  transitionDuration = 0.25,
  motionRangeStart = 0,
  motionRangeEnd = 1,
  transitionIn = transition,
  transitionOut = transition,
  imageAvailable = true,
}) => {
  const effect = supportedMotionEffects.has(motionEffect) ? motionEffect : 'none'
  const strength = Math.min(25, Math.max(5, Number(motionStrength) || 12)) / 100
  const frames = Math.max(2, Math.round(Math.max(0.5, Number(duration) || 3) * 30))
  const denominator = Math.max(1, frames - 1)
  const maximumZoom = 1 + strength
  const rangeStart = Math.min(1, Math.max(0, Number(motionRangeStart) || 0))
  const rangeEnd = Math.max(rangeStart, Math.min(1, Math.max(0, Number.isFinite(Number(motionRangeEnd)) ? Number(motionRangeEnd) : 1)))
  const rangeSpan = rangeEnd - rangeStart
  const motionProgress = `(${rangeStart.toFixed(6)}+${rangeSpan.toFixed(6)}*on/${denominator})`
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a2438`,
    'setsar=1',
  ]

  if (imageAvailable && effect !== 'none') {
    let zoom = maximumZoom.toFixed(4)
    let x = '(iw-iw/zoom)/2'
    let y = '(ih-ih/zoom)/2'
    if (effect === 'zoom-in') zoom = `min(${maximumZoom.toFixed(4)},1+${strength.toFixed(4)}*${motionProgress})`
    if (effect === 'zoom-out') zoom = `max(1.0000,1+${strength.toFixed(4)}*(1-${motionProgress}))`
    if (effect === 'pan-left') x = `(iw-iw/zoom)*${motionProgress}`
    if (effect === 'pan-right') x = `(iw-iw/zoom)*(1-${motionProgress})`
    if (effect === 'pan-up') y = `(ih-ih/zoom)*${motionProgress}`
    if (effect === 'pan-down') y = `(ih-ih/zoom)*(1-${motionProgress})`
    filters.push(`zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=30`)
  } else {
    filters.push('fps=30')
  }

  filters.push('format=yuv420p')
  if (transitionIn === 'fade' || transitionOut === 'fade') {
    const fadeDuration = Math.min(
      Math.max(0.1, Number(transitionDuration) || 0.25),
      Math.max(0.1, Number(duration) / 3),
    )
    if (transitionIn === 'fade') filters.push(`fade=t=in:st=0:d=${fadeDuration.toFixed(3)}`)
    if (transitionOut === 'fade') filters.push(`fade=t=out:st=${Math.max(0, duration - fadeDuration).toFixed(3)}:d=${fadeDuration.toFixed(3)}`)
  }
  return filters.join(',')
}

export const buildLocalVideoFilter = ({
  width,
  height,
  duration,
  transition = 'fade',
  transitionDuration = 0.25,
  transitionIn = transition,
  transitionOut = transition,
}) => {
  const filters = [
    'setpts=PTS-STARTPTS',
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a2438`,
    'setsar=1',
    'fps=30',
    `tpad=stop_mode=clone:stop_duration=${Number(duration).toFixed(3)}`,
    `trim=duration=${Number(duration).toFixed(3)}`,
    'format=yuv420p',
  ]
  if (transitionIn === 'fade' || transitionOut === 'fade') {
    const fadeDuration = Math.min(
      Math.max(0.1, Number(transitionDuration) || 0.25),
      Math.max(0.1, Number(duration) / 3),
    )
    if (transitionIn === 'fade') filters.push(`fade=t=in:st=0:d=${fadeDuration.toFixed(3)}`)
    if (transitionOut === 'fade') filters.push(`fade=t=out:st=${Math.max(0, duration - fadeDuration).toFixed(3)}:d=${fadeDuration.toFixed(3)}`)
  }
  return filters.join(',')
}

const normalizeAudioTracks = (audioTracks, totalDuration) => {
  if (!Array.isArray(audioTracks)) return []
  return audioTracks.slice(0, maxAudioTracks).map((track, index) => {
    const kind = track?.kind === 'sfx' ? 'sfx' : 'bgm'
    const start = Math.min(totalDuration, Math.max(0, Number(track?.start) || 0))
    const remainingDuration = Math.max(0, totalDuration - start)
    const requestedDuration = Math.max(0.1, Number(track?.duration) || 1)
    const duration = kind === 'bgm' ? remainingDuration : Math.min(remainingDuration, requestedDuration)
    return {
      index,
      kind,
      start,
      duration,
      volume: Math.min(100, Math.max(0, Number(track?.volume) || 0)) / 100,
      fadeIn: Math.min(10, Math.max(0, Number(track?.fadeIn) || 0)),
      fadeOut: Math.min(10, Math.max(0, Number(track?.fadeOut) || 0)),
      audio: decodeDataUrl(track?.audio, audioExtensions, maxAudioBytes),
    }
  })
}

const safelyRemoveExportDirectory = async (directory) => {
  const resolvedTempRoot = path.resolve(tmpdir())
  const resolvedDirectory = path.resolve(directory)
  if (path.dirname(resolvedDirectory) !== resolvedTempRoot || !path.basename(resolvedDirectory).startsWith('manju-export-')) return
  await rm(resolvedDirectory, { recursive: true, force: true })
}

export const getFfmpegExecutablePath = ({ isPackaged, resourcesPath, projectDirectory }) => isPackaged
  ? path.join(resourcesPath, 'bin', 'ffmpeg.exe')
  : path.join(projectDirectory, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

export async function exportTimelineVideo({
  ffmpegPath,
  outputPath,
  items,
  width = 1080,
  height = 1920,
  transition = 'fade',
  subtitlesEnabled = true,
  subtitleCues = [],
  subtitleStyle = {},
  audioTracks = [],
  onProgress = () => undefined,
  signal,
}) {
  if (!ffmpegPath || !outputPath) throw new Error('缺少 FFmpeg 或导出路径')
  if (![360, 540, 1080, 1920].includes(width) || ![640, 960, 1080, 1920].includes(height)) {
    throw new Error('不支持的成片分辨率')
  }

  throwIfAborted(signal)
  const normalizedItems = normalizeTimelineItems(items, transition)
  const totalDuration = normalizedItems.at(-1).end
  const normalizedAudioTracks = normalizeAudioTracks(audioTracks, totalDuration)
  const exportDirectory = await mkdtemp(path.join(tmpdir(), 'manju-export-'))
  const segmentPaths = []
  let placeholderCount = normalizedItems.filter((item) => !item.image && !item.videoPath).length
  let silentCount = normalizedItems.filter((item) => !item.audio && !item.audioPath).length
  let motionCount = 0
  let videoSegmentCount = 0
  const videoFallbackCount = normalizedItems.filter((item) => item.videoRequested && !item.videoPath).length

  try {
    onProgress({ phase: 'preparing', percent: 2, message: '正在准备本地素材' })
    for (const item of normalizedItems) {
      throwIfAborted(signal)
      const sequence = String(item.index + 1).padStart(3, '0')
      let imagePath = ''
      let audioPath = ''
      if (item.image && !item.videoPath) {
        const sourceImagePath = path.join(exportDirectory, `image-source-${sequence}${item.image.extension}`)
        const normalizedImagePath = path.join(exportDirectory, `image-${sequence}.bmp`)
        await writeFile(sourceImagePath, item.image.buffer)
        try {
          await runFfmpeg(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', sourceImagePath, '-frames:v', '1', normalizedImagePath,
          ], exportDirectory, 15000, signal)
          imagePath = normalizedImagePath
        } catch (error) {
          if (isExportCanceledError(error)) throw error
          placeholderCount += 1
        }
      }
      if (item.audio || item.audioPath) {
        const sourceAudioPath = item.audioPath || path.join(exportDirectory, `audio-source-${sequence}${item.audio.extension}`)
        const normalizedAudioPath = path.join(exportDirectory, `audio-${sequence}.wav`)
        if (item.audio) await writeFile(sourceAudioPath, item.audio.buffer)
        try {
          await runFfmpeg(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-ss', item.voiceOffsetSeconds.toFixed(3),
            '-i', sourceAudioPath,
            '-t', item.duration.toFixed(3), '-af', `apad,atrim=0:${item.duration.toFixed(3)}`,
            '-ar', '48000', '-ac', '2', normalizedAudioPath,
          ], exportDirectory, 30000, signal)
          audioPath = normalizedAudioPath
        } catch (error) {
          if (isExportCanceledError(error)) throw error
          silentCount += 1
        }
      }

      const segmentPath = path.join(exportDirectory, `segment-${sequence}.mp4`)
      const imageArgs = item.videoPath
        ? ['-ss', item.videoOffsetSeconds.toFixed(3), '-i', item.videoPath]
        : imagePath
          ? ['-loop', '1', '-framerate', '30', '-i', imagePath]
          : ['-f', 'lavfi', '-i', `color=c=0x173b54:s=${width}x${height}:r=30`]
      const audioArgs = audioPath
        ? ['-i', audioPath]
        : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
      const videoFilter = item.videoPath
        ? buildLocalVideoFilter({
          width,
          height,
          duration: item.duration,
          transition: item.transition,
          transitionDuration: item.transitionDuration,
          transitionIn: item.transitionIn,
          transitionOut: item.transitionOut,
        })
        : buildShotVideoFilter({
          width,
          height,
          duration: item.duration,
          motionEffect: item.motionEffect,
          motionStrength: item.motionStrength,
          transition: item.transition,
          transitionDuration: item.transitionDuration,
          motionRangeStart: item.motionRangeStart,
          motionRangeEnd: item.motionRangeEnd,
          transitionIn: item.transitionIn,
          transitionOut: item.transitionOut,
          imageAvailable: Boolean(imagePath),
        })
      const rendersMotion = !item.videoPath && Boolean(imagePath) && item.motionEffect !== 'none'
      if (rendersMotion) motionCount += 1
      if (item.videoPath) videoSegmentCount += 1

      await runFfmpeg(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        ...imageArgs,
        ...audioArgs,
        '-t', item.duration.toFixed(3),
        '-map', '0:v:0', '-map', '1:a:0',
        '-vf', videoFilter,
        '-af', `apad,atrim=0:${item.duration.toFixed(3)}`,
        '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        segmentPath,
      ], exportDirectory, 120000, signal)
      segmentPaths.push(segmentPath)
      const percent = 5 + Math.round(((item.index + 1) / normalizedItems.length) * 72)
      onProgress({ phase: 'rendering', percent, message: `正在渲染${item.videoPath ? '本地视频' : rendersMotion ? '动态' : ''}镜头 ${item.index + 1}/${normalizedItems.length}` })
    }

    const concatListPath = path.join(exportDirectory, 'concat.txt')
    await writeFile(concatListPath, segmentPaths.map((segmentPath) => `file '${path.basename(segmentPath)}'`).join('\n'), 'utf8')
    const mergedPath = path.join(exportDirectory, 'merged.mp4')
    onProgress({ phase: 'merging', percent: 82, message: '正在合并时间线' })
    await runFfmpeg(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c', 'copy', '-movflags', '+faststart', mergedPath,
    ], exportDirectory, 120000, signal)

    const normalizedSubtitleCues = normalizeSubtitleCues(subtitleCues, normalizedItems, totalDuration)
    let completedVideoPath = mergedPath
    if (subtitlesEnabled && normalizedSubtitleCues.length) {
      const subtitlePath = path.join(exportDirectory, 'subtitles.ass')
      const subtitledPath = path.join(exportDirectory, 'final.mp4')
      await writeFile(subtitlePath, createAssDocument(normalizedSubtitleCues, width, height, subtitleStyle), 'utf8')
      onProgress({ phase: 'subtitles', percent: 90, message: '正在烧录字幕' })
      await runFfmpeg(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', mergedPath,
        '-vf', `subtitles=filename='${escapeFilterPath(subtitlePath)}'`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', '-movflags', '+faststart', subtitledPath,
      ], exportDirectory, 120000, signal)
      completedVideoPath = subtitledPath
    }

    let skippedTrackCount = normalizedAudioTracks.filter((track) => !track.audio || track.duration <= 0).length
    const mixableTracks = []
    for (const track of normalizedAudioTracks) {
      if (!track.audio || track.duration <= 0) continue
      throwIfAborted(signal)
      const sequence = String(track.index + 1).padStart(2, '0')
      const sourceAudioPath = path.join(exportDirectory, `track-source-${sequence}${track.audio.extension}`)
      const normalizedAudioPath = path.join(exportDirectory, `track-${sequence}.wav`)
      await writeFile(sourceAudioPath, track.audio.buffer)
      try {
        await runFfmpeg(ffmpegPath, [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', sourceAudioPath, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', normalizedAudioPath,
        ], exportDirectory, 30000, signal)
        mixableTracks.push({ ...track, path: normalizedAudioPath })
      } catch (error) {
        if (isExportCanceledError(error)) throw error
        skippedTrackCount += 1
      }
    }

    if (mixableTracks.length) {
      const mixedPath = path.join(exportDirectory, 'mixed.mp4')
      const inputArgs = []
      const filterParts = ['[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=1[dialogue]']
      const mixLabels = ['[dialogue]']
      mixableTracks.forEach((track, index) => {
        if (track.kind === 'bgm') inputArgs.push('-stream_loop', '-1')
        inputArgs.push('-i', track.path)
        const inputIndex = index + 1
        const duration = track.duration
        const fadeIn = Math.min(track.fadeIn, duration / 2)
        const fadeOut = Math.min(track.fadeOut, duration / 2)
        const filters = [
          `atrim=0:${duration.toFixed(3)}`,
          'asetpts=PTS-STARTPTS',
          `volume=${track.volume.toFixed(3)}`,
        ]
        if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn.toFixed(3)}`)
        if (fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, duration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`)
        filters.push(`adelay=${Math.round(track.start * 1000)}:all=1`)
        filterParts.push(`[${inputIndex}:a]${filters.join(',')}[track${index}]`)
        mixLabels.push(`[track${index}]`)
      })
      filterParts.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]`)
      onProgress({ phase: 'mixing', percent: 95, message: '正在混合背景音乐与音效' })
      await runFfmpeg(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', completedVideoPath,
        ...inputArgs,
        '-filter_complex', filterParts.join(';'),
        '-map', '0:v:0', '-map', '[mix]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', mixedPath,
      ], exportDirectory, 120000, signal)
      completedVideoPath = mixedPath
    }

    throwIfAborted(signal)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await copyFile(completedVideoPath, outputPath)
    onProgress({ phase: 'completed', percent: 100, message: 'MP4 已导出' })
    return {
      outputPath,
      duration: totalDuration,
      segmentCount: normalizedItems.length,
      placeholderCount,
      silentCount,
      subtitleCount: subtitlesEnabled ? normalizedSubtitleCues.length : 0,
      mixedTrackCount: mixableTracks.length,
      skippedTrackCount,
      motionCount,
      videoSegmentCount,
      videoFallbackCount,
      fadeTransitionCount: normalizedItems.filter((item) => item.transition === 'fade').length,
    }
  } finally {
    await safelyRemoveExportDirectory(exportDirectory)
  }
}
