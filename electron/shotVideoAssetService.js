import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

export const maximumLocalShotVideoBytes = 250 * 1024 * 1024
export const minimumLocalShotVideoDuration = 0.5
export const maximumLocalShotVideoDuration = 30

const safeIdPattern = /^[a-z0-9][a-z0-9-]{5,79}$/u

export class ShotVideoAssetCanceledError extends Error {
  constructor() {
    super('本地视频处理已取消')
    this.name = 'ShotVideoAssetCanceledError'
    this.code = 'SHOT_VIDEO_ASSET_CANCELED'
  }
}

export const isShotVideoAssetCanceledError = (error) => error?.code === 'SHOT_VIDEO_ASSET_CANCELED'

export const createShotVideoProjectKey = (projectLocalId) => createHash('sha256')
  .update(String(projectLocalId || 'local-project'))
  .digest('hex')
  .slice(0, 20)

export const createShotVideoAssetId = () => `shot-video-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`

const assertSafeId = (value, label) => {
  const normalized = String(value || '').toLowerCase()
  if (!safeIdPattern.test(normalized)) throw new Error(`${label}无效`)
  return normalized
}

export const resolveManagedShotVideoPath = ({ mediaRoot, projectKey, assetId }) => {
  const safeProjectKey = assertSafeId(projectKey, '项目媒体标识')
  const safeAssetId = assertSafeId(assetId, '视频资产标识')
  const root = path.resolve(mediaRoot)
  const assetPath = path.resolve(root, safeProjectKey, safeAssetId, 'video.mp4')
  const prefix = `${root}${path.sep}`
  if (!assetPath.startsWith(prefix)) throw new Error('视频资产路径越界')
  return assetPath
}

export const createManagedShotVideoUrl = ({ projectKey, assetId }) => (
  `manju-media://shot-video/${assertSafeId(projectKey, '项目媒体标识')}/${assertSafeId(assetId, '视频资产标识')}.mp4`
)

const runProcess = (executable, args, { cwd, timeoutMs = 180000, signal, acceptExitCodes = [0] } = {}) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new ShotVideoAssetCanceledError())
    return
  }
  const child = spawn(executable, args, {
    cwd,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  let settled = false
  let canceled = false
  let timedOut = false
  const cleanup = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
  const cancel = () => {
    if (settled) return
    canceled = true
    child.kill('SIGKILL')
  }
  const timer = setTimeout(() => {
    if (settled) return
    timedOut = true
    child.kill('SIGKILL')
  }, timeoutMs)
  signal?.addEventListener('abort', cancel, { once: true })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
    if (stderr.length > 180000) stderr = stderr.slice(-180000)
  })
  child.on('error', (error) => {
    if (settled) return
    settled = true
    cleanup()
    reject(canceled ? new ShotVideoAssetCanceledError() : error)
  })
  child.on('close', (code) => {
    if (settled) return
    settled = true
    cleanup()
    if (canceled || signal?.aborted) {
      reject(new ShotVideoAssetCanceledError())
      return
    }
    if (timedOut) {
      reject(new Error('本地视频处理超时'))
      return
    }
    if (!acceptExitCodes.includes(code)) {
      reject(new Error('本地视频处理失败'))
      return
    }
    resolve({ code, stderr })
  })
})

const parseClockDuration = (value) => {
  const match = /^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/u.exec(String(value || '').trim())
  if (!match) return 0
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

export const parseShotVideoProbeOutput = (stderr = '') => {
  const durationMatch = /Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/u.exec(stderr)
  const videoLine = String(stderr).split(/\r?\n/u).find((line) => /Stream #.*Video:/u.test(line)) || ''
  const dimensions = /(?:^|[^\d])(\d{2,5})x(\d{2,5})(?:[^\d]|$)/u.exec(videoLine)
  const fpsMatch = /,\s*(\d+(?:\.\d+)?)\s*fps(?:,|\s|$)/u.exec(videoLine)
  return {
    hasVideo: Boolean(videoLine),
    duration: Number(parseShotVideoProbeOutput.safeDuration(parseClockDuration(durationMatch?.[1])).toFixed(3)),
    width: Number(dimensions?.[1]) || 0,
    height: Number(dimensions?.[2]) || 0,
    fps: Math.min(240, Math.max(0, Number(fpsMatch?.[1]) || 0)),
  }
}

parseShotVideoProbeOutput.safeDuration = (value) => Number.isFinite(value) && value > 0 ? value : 0

const inspectShotVideo = async (ffmpegPath, filePath, signal) => {
  const result = await runProcess(ffmpegPath, ['-hide_banner', '-i', filePath], {
    timeoutMs: 20000,
    signal,
    acceptExitCodes: [1],
  })
  return parseShotVideoProbeOutput(result.stderr)
}

const dataUrlFromFile = async (filePath, mimeType) => {
  const buffer = await readFile(filePath)
  if (!buffer.length) throw new Error('真实视频帧为空')
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

const hashFile = async (filePath) => createHash('sha256').update(await readFile(filePath)).digest('hex')

export async function prepareLocalShotVideoFromPath({
  sourcePath,
  projectLocalId,
  mediaRoot,
  ffmpegPath,
  signal,
  onProgress = () => undefined,
  assetId = createShotVideoAssetId(),
} = {}) {
  if (path.extname(String(sourcePath || '')).toLowerCase() !== '.mp4') throw new Error('仅支持本地 MP4 文件')
  if (!ffmpegPath || !mediaRoot) throw new Error('本地视频处理环境不可用')
  const sourceInfo = await stat(sourcePath)
  if (!sourceInfo.isFile() || !sourceInfo.size) throw new Error('本地 MP4 文件为空')
  if (sourceInfo.size > maximumLocalShotVideoBytes) throw new Error('本地 MP4 需小于 250 MB')

  const projectKey = createShotVideoProjectKey(projectLocalId)
  const safeAssetId = assertSafeId(assetId, '视频资产标识')
  const projectDirectory = path.resolve(mediaRoot, projectKey)
  const pendingDirectory = path.resolve(projectDirectory, `${safeAssetId}-pending`)
  const assetDirectory = path.resolve(projectDirectory, safeAssetId)
  const normalizedPath = path.join(pendingDirectory, 'video.mp4')
  const firstFramePath = path.join(pendingDirectory, 'first-frame.jpg')
  const lastFramePath = path.join(pendingDirectory, 'last-frame.jpg')
  const scaleFilter = "scale=w='if(gt(iw,ih),min(1080,iw),-2)':h='if(gt(iw,ih),-2,min(1080,ih))'"

  await mkdir(pendingDirectory, { recursive: true })
  try {
    onProgress({ phase: 'validating', message: '正在验证真实 MP4' })
    const sourceProbe = await inspectShotVideo(ffmpegPath, sourcePath, signal)
    if (!sourceProbe.hasVideo) throw new Error('文件中没有可解码的视频画面')
    if (sourceProbe.duration < minimumLocalShotVideoDuration || sourceProbe.duration > maximumLocalShotVideoDuration) {
      throw new Error('视频时长需在 0.5～30 秒之间')
    }

    onProgress({ phase: 'normalizing', message: '正在本地标准化并移除源音轨' })
    await runProcess(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', sourcePath,
      '-map', '0:v:0', '-an', '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', normalizedPath,
    ], { cwd: pendingDirectory, timeoutMs: 240000, signal })

    onProgress({ phase: 'extracting', message: '正在提取真实首帧与末帧' })
    await runProcess(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', normalizedPath, '-vf', scaleFilter, '-frames:v', '1', '-q:v', '2', firstFramePath,
    ], { cwd: pendingDirectory, timeoutMs: 30000, signal })
    await runProcess(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-sseof', '-2', '-i', normalizedPath, '-vf', `reverse,${scaleFilter}`, '-frames:v', '1', '-q:v', '2', lastFramePath,
    ], { cwd: pendingDirectory, timeoutMs: 60000, signal })

    const [normalizedInfo, normalizedProbe, sha256, firstFrameDataUrl, lastFrameDataUrl] = await Promise.all([
      stat(normalizedPath),
      inspectShotVideo(ffmpegPath, normalizedPath, signal),
      hashFile(normalizedPath),
      dataUrlFromFile(firstFramePath, 'image/jpeg'),
      dataUrlFromFile(lastFramePath, 'image/jpeg'),
    ])
    if (!normalizedProbe.hasVideo || !normalizedProbe.width || !normalizedProbe.height || !normalizedProbe.duration) {
      throw new Error('标准化视频验证失败')
    }

    await rm(assetDirectory, { recursive: true, force: true })
    await rename(pendingDirectory, assetDirectory)
    onProgress({ phase: 'ready', message: '真实视频已准备，等待确认采用' })
    const importedAt = new Date().toISOString()
    return {
      ok: true,
      asset: {
        id: safeAssetId,
        kind: 'shot-video',
        source: 'local-import',
        fileName: path.basename(sourcePath).slice(0, 160),
        mimeType: 'video/mp4',
        bytes: normalizedInfo.size,
        duration: normalizedProbe.duration,
        width: normalizedProbe.width,
        height: normalizedProbe.height,
        fps: Math.min(30, normalizedProbe.fps || 30),
        sha256,
        importedAt,
        lastFrame: {
          dataUrl: lastFrameDataUrl,
          fileName: `${path.parse(sourcePath).name.slice(0, 120)}-末帧.jpg`,
          width: normalizedProbe.width,
          height: normalizedProbe.height,
          extractedAt: importedAt,
        },
      },
      firstFrame: {
        dataUrl: firstFrameDataUrl,
        fileName: `${path.parse(sourcePath).name.slice(0, 120)}-首帧.jpg`,
      },
      mediaUrl: createManagedShotVideoUrl({ projectKey, assetId: safeAssetId }),
      projectKey,
    }
  } catch (error) {
    await rm(pendingDirectory, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function inspectManagedShotVideoAsset({ mediaRoot, projectLocalId, assetId }) {
  const projectKey = createShotVideoProjectKey(projectLocalId)
  try {
    const filePath = resolveManagedShotVideoPath({ mediaRoot, projectKey, assetId })
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile() || !fileInfo.size) return { health: 'missing', mediaUrl: '' }
    return {
      health: 'ready',
      bytes: fileInfo.size,
      mediaUrl: createManagedShotVideoUrl({ projectKey, assetId }),
    }
  } catch {
    return { health: 'missing', mediaUrl: '' }
  }
}

export async function discardManagedShotVideoAsset({ mediaRoot, projectLocalId, assetId }) {
  const projectKey = createShotVideoProjectKey(projectLocalId)
  const filePath = resolveManagedShotVideoPath({ mediaRoot, projectKey, assetId })
  await rm(path.dirname(filePath), { recursive: true, force: true })
  return { ok: true }
}
