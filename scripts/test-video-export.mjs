import { execFile } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  appendExportHistory,
  findExportHistoryEntry,
  readExportHistory,
} from '../electron/exportHistoryRepository.js'
import {
  buildShotVideoFilter,
  exportTimelineVideo,
  getFfmpegExecutablePath,
  isExportCanceledError,
} from '../electron/videoExportService.js'

const execFileAsync = promisify(execFile)

const createToneWavDataUrl = (frequency = 440, duration = 0.5, sampleRate = 16000) => {
  const sampleCount = Math.round(duration * sampleRate)
  const dataBytes = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 8000)
    buffer.writeInt16LE(sample, 44 + index * 2)
  }
  return `data:audio/wav;base64,${buffer.toString('base64')}`
}

const createBmpDataUrl = () => {
  const width = 64
  const height = 64
  const rowBytes = width * 3
  const pixelBytes = rowBytes * height
  const buffer = Buffer.alloc(54 + pixelBytes)
  buffer.write('BM', 0)
  buffer.writeUInt32LE(buffer.length, 2)
  buffer.writeUInt32LE(54, 10)
  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28)
  buffer.writeUInt32LE(pixelBytes, 34)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = 54 + y * rowBytes + x * 3
      buffer[offset] = Math.round((x / (width - 1)) * 255)
      buffer[offset + 1] = Math.round((y / (height - 1)) * 255)
      buffer[offset + 2] = (x * 7 + y * 3) % 256
    }
  }
  return `data:image/bmp;base64,${buffer.toString('base64')}`
}

const image = createBmpDataUrl()
const outputDirectory = path.join(process.cwd(), 'outputs', 'video-export-test')
const outputPath = path.join(outputDirectory, 'timeline-test.mp4')
const ffmpegPath = getFfmpegExecutablePath({
  isPackaged: false,
  resourcesPath: '',
  projectDirectory: process.cwd(),
})
const progress = []
const timelineItems = [
  {
    duration: 0.7,
    subtitle: '本地时间线导出测试',
    shot: { image, motionEffect: 'zoom-in', motionStrength: 20, transition: 'cut', transitionDuration: 0.35 },
    audioLine: { audio: createToneWavDataUrl(440, 1.5) },
    voiceOffsetSeconds: 0.4,
  },
  {
    duration: 0.6,
    subtitle: '缺图与静音降级',
    shot: { image: '', motionEffect: 'pan-left', motionStrength: 18, transition: 'fade', transitionDuration: 0.3 },
    audioLine: null,
  },
]

await mkdir(outputDirectory, { recursive: true })
const managedVoicePath = path.join(outputDirectory, 'managed-voice.wav')
await writeFile(managedVoicePath, Buffer.from(createToneWavDataUrl(440, 1.5).split(',')[1], 'base64'))
timelineItems[0].audioFilePath = managedVoicePath
const result = await exportTimelineVideo({
  ffmpegPath,
  outputPath,
  width: 360,
  height: 640,
  transition: 'fade',
  subtitlesEnabled: true,
  subtitleCues: [
    { start: 0, end: 0.4, text: '自定义字幕一' },
    { start: 0.4, end: 0.9, text: '自定义字幕二\n支持换行' },
    { start: 0.9, end: 1.3, text: '自定义字幕三' },
  ],
  subtitleStyle: { fontSize: 64, color: '#FFEEAA', outlineColor: '#173B54', backgroundOpacity: 55, position: 'top', bold: false },
  audioTracks: [
    { kind: 'bgm', start: 0, duration: 0.45, volume: 25, fadeIn: 0.1, fadeOut: 0.1, audio: createToneWavDataUrl(220, 0.45) },
    { kind: 'sfx', start: 0.25, duration: 0.35, volume: 65, fadeIn: 0.05, fadeOut: 0.05, audio: createToneWavDataUrl(880, 0.35) },
    { kind: 'sfx', start: 0.1, duration: 0.2, volume: 50, fadeIn: 0, fadeOut: 0, audio: 'data:audio/wav;base64,AAAA' },
  ],
  items: timelineItems,
  onProgress: (event) => progress.push(event),
})

const fileInfo = await stat(outputPath)
await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', outputPath, '-f', 'null', '-'])
const frameOne = await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', '0.12', '-i', outputPath, '-frames:v', '1', '-f', 'framemd5', '-'])
const frameTwo = await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', '0.58', '-i', outputPath, '-frames:v', '1', '-f', 'framemd5', '-'])
const frameChecksum = (output) => output.trim().split(/\r?\n/u).filter((line) => line && !line.startsWith('#')).at(-1)?.split(',').at(-1)?.trim()
const motionFrameChanged = Boolean(frameChecksum(frameOne.stdout) && frameChecksum(frameTwo.stdout) && frameChecksum(frameOne.stdout) !== frameChecksum(frameTwo.stdout))
const zoomFilter = buildShotVideoFilter({ width: 360, height: 640, duration: 0.7, motionEffect: 'zoom-in', motionStrength: 20, transition: 'cut', imageAvailable: true })
const fadeFilter = buildShotVideoFilter({ width: 360, height: 640, duration: 0.9, motionEffect: 'none', transition: 'fade', transitionDuration: 0.35, imageAvailable: false })
const splitLeftFilter = buildShotVideoFilter({
  width: 360,
  height: 640,
  duration: 2.2,
  motionEffect: 'pan-left',
  motionStrength: 20,
  motionRangeStart: 0.2,
  motionRangeEnd: 0.464,
  transition: 'fade',
  transitionIn: 'fade',
  transitionOut: 'cut',
  transitionDuration: 0.3,
  imageAvailable: true,
})
const splitRightFilter = buildShotVideoFilter({
  width: 360,
  height: 640,
  duration: 2.8,
  motionEffect: 'pan-left',
  motionStrength: 20,
  motionRangeStart: 0.464,
  motionRangeEnd: 0.8,
  transition: 'fade',
  transitionIn: 'cut',
  transitionOut: 'fade',
  transitionDuration: 0.3,
  imageAvailable: true,
})
const volumeAnalysis = await execFileAsync(ffmpegPath, ['-hide_banner', '-i', outputPath, '-af', 'volumedetect', '-f', 'null', '-'])
const meanVolumeMatch = /mean_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/iu.exec(volumeAnalysis.stderr)
const historyPath = path.join(outputDirectory, 'export-history-test-v13.json')
await appendExportHistory(historyPath, {
  ...result,
  projectName: '时间线测试',
  resolution: '1080x1920',
  exportedAt: new Date().toISOString(),
})
await appendExportHistory(historyPath, {
  ...result,
  projectLocalId: 'local-video-export-test',
  projectName: '时间线测试（覆盖记录）',
  resolution: '1920x1080',
  episodeId: 2,
  episodeTitle: '第二集',
  scope: 'episode',
  exportedAt: new Date().toISOString(),
})
const history = await readExportHistory(historyPath)
const matchingHistory = history.filter((entry) => entry.outputPath === path.resolve(outputPath))
const authorizedHistoryEntry = await findExportHistoryEntry(historyPath, outputPath)
const unauthorizedHistoryEntry = await findExportHistoryEntry(historyPath, path.join(outputDirectory, 'not-exported.mp4'))
const abortController = new AbortController()
abortController.abort()
let cancellationPassed = false
try {
  await exportTimelineVideo({
    ffmpegPath,
    outputPath: path.join(outputDirectory, 'canceled.mp4'),
    width: 360,
    height: 640,
    items: timelineItems,
    signal: abortController.signal,
  })
} catch (error) {
  cancellationPassed = isExportCanceledError(error)
}
const runtimeAbortController = new AbortController()
const runtimeCanceledPath = path.join(outputDirectory, `canceled-during-render-${process.pid}.mp4`)
let runtimeCancellationPassed = false
let runtimeCancellationError = ''
const runtimeExport = exportTimelineVideo({
  ffmpegPath,
  outputPath: runtimeCanceledPath,
  width: 360,
  height: 640,
  items: [{ duration: 20, subtitle: '取消中的镜头', shot: { image: '' }, audioLine: null }],
  signal: runtimeAbortController.signal,
})
setTimeout(() => runtimeAbortController.abort(), 30)
try {
  await runtimeExport
} catch (error) {
  runtimeCancellationPassed = isExportCanceledError(error)
  runtimeCancellationError = `${error?.code || ''}:${error?.message || error}`
}
let canceledOutputExists = true
try {
  await stat(runtimeCanceledPath)
} catch {
  canceledOutputExists = false
}
const passed = fileInfo.size > 1000
  && result.segmentCount === 2
  && result.placeholderCount === 1
  && result.silentCount === 1
  && result.subtitleCount === 3
  && result.mixedTrackCount === 2
  && result.skippedTrackCount === 1
  && result.motionCount === 1
  && result.fadeTransitionCount === 1
  && motionFrameChanged
  && zoomFilter.includes('zoompan')
  && !zoomFilter.includes('fade=t=in')
  && fadeFilter.includes('fade=t=in:st=0:d=0.300')
  && splitLeftFilter.includes('(0.200000+0.264000*on/')
  && splitLeftFilter.includes('fade=t=in:st=0:d=0.300')
  && !splitLeftFilter.includes('fade=t=out')
  && splitRightFilter.includes('(0.464000+0.336000*on/')
  && !splitRightFilter.includes('fade=t=in')
  && splitRightFilter.includes('fade=t=out:st=2.500:d=0.300')
  && meanVolumeMatch
  && meanVolumeMatch[1].toLowerCase() !== '-inf'
  && progress.some((event) => event.phase === 'mixing' && event.percent === 95)
  && progress.at(-1)?.percent === 100
  && matchingHistory.length === 1
  && matchingHistory[0].exists
  && matchingHistory[0].projectName === '时间线测试（覆盖记录）'
  && matchingHistory[0].projectLocalId === 'local-video-export-test'
  && matchingHistory[0].episodeId === 2
  && matchingHistory[0].episodeTitle === '第二集'
  && matchingHistory[0].scope === 'episode'
  && matchingHistory[0].resolution === '1920x1080'
  && matchingHistory[0].mixedTrackCount === 2
  && authorizedHistoryEntry?.exists
  && unauthorizedHistoryEntry === null
  && cancellationPassed
  && runtimeCancellationPassed
  && !canceledOutputExists

console.log(JSON.stringify({ passed, outputPath, bytes: fileInfo.size, result, meanVolume: meanVolumeMatch?.[1], motionFrameChanged, zoomFilter, fadeFilter, splitLeftFilter, splitRightFilter, progress, history, cancellationPassed, runtimeCancellationPassed, runtimeCancellationError, canceledOutputExists }))
if (!passed) process.exitCode = 1
