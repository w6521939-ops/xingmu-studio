import { createHash, randomBytes } from 'node:crypto'
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createShotVideoProjectKey } from './shotVideoAssetService.js'

export const maximumManagedVoiceBytes = 12 * 1024 * 1024
const safeIdPattern = /^[a-z0-9][a-z0-9-]{5,79}$/u

const assertSafeId = (value, label) => {
  const normalized = String(value || '').toLowerCase()
  if (!safeIdPattern.test(normalized)) throw new Error(`${label}无效`)
  return normalized
}

export const createVoiceAssetId = () => `voice-line-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`

export const resolveManagedVoiceAssetPath = ({ mediaRoot, projectKey, assetId }) => {
  const safeProjectKey = assertSafeId(projectKey, '项目媒体标识')
  const safeAssetId = assertSafeId(assetId, '配音资产标识')
  const root = path.resolve(mediaRoot)
  const assetPath = path.resolve(root, safeProjectKey, safeAssetId, 'audio.wav')
  if (!assetPath.startsWith(`${root}${path.sep}`)) throw new Error('配音资产路径越界')
  return assetPath
}

export const createManagedVoiceAssetUrl = ({ projectKey, assetId }) => (
  `manju-media://voice/${assertSafeId(projectKey, '项目媒体标识')}/${assertSafeId(assetId, '配音资产标识')}.wav`
)

export const inspectWavBuffer = (input) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || [])
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('百炼返回的音频不是有效 WAV')
  }
  let offset = 12
  let sampleRate = 0
  let byteRate = 0
  let dataBytes = 0
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const bodyOffset = offset + 8
    if (chunkId === 'fmt ' && chunkSize >= 16 && bodyOffset + 16 <= buffer.length) {
      sampleRate = buffer.readUInt32LE(bodyOffset + 4)
      byteRate = buffer.readUInt32LE(bodyOffset + 8)
    }
    if (chunkId === 'data') {
      dataBytes = Math.min(chunkSize, Math.max(0, buffer.length - bodyOffset))
      break
    }
    offset = bodyOffset + chunkSize + (chunkSize % 2)
  }
  if (!sampleRate || !byteRate || !dataBytes) throw new Error('WAV 音频头信息不完整')
  return {
    sampleRate,
    duration: Number((dataBytes / byteRate).toFixed(3)),
    bytes: buffer.length,
  }
}

export async function prepareManagedVoiceAssetFromBuffer({
  buffer,
  projectLocalId,
  mediaRoot,
  assetId = createVoiceAssetId(),
  fileName = 'bailian-voice.wav',
  source = 'bailian-download',
  model = '',
  voiceId = '',
  requestId = '',
} = {}) {
  if (!mediaRoot) throw new Error('配音托管目录未配置')
  const audioBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (!audioBuffer.length || audioBuffer.length > maximumManagedVoiceBytes) {
    throw new Error('配音文件为空或超过 12 MB')
  }
  const details = inspectWavBuffer(audioBuffer)
  const projectKey = createShotVideoProjectKey(projectLocalId)
  const safeAssetId = assertSafeId(assetId, '配音资产标识')
  const assetDirectory = path.dirname(resolveManagedVoiceAssetPath({
    mediaRoot,
    projectKey,
    assetId: safeAssetId,
  }))
  const finalPath = path.join(assetDirectory, 'audio.wav')
  const pendingPath = `${finalPath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await mkdir(assetDirectory, { recursive: true })
  await writeFile(pendingPath, audioBuffer)
  await rename(pendingPath, finalPath)
  const fileInfo = await stat(finalPath)
  if (!fileInfo.isFile() || fileInfo.size !== audioBuffer.length) throw new Error('配音本地落盘校验失败')
  const mediaUrl = createManagedVoiceAssetUrl({ projectKey, assetId: safeAssetId })
  const asset = {
    id: safeAssetId,
    kind: 'voice-line',
    source,
    fileName: path.basename(String(fileName || 'bailian-voice.wav')).slice(0, 160),
    mimeType: 'audio/wav',
    bytes: details.bytes,
    duration: details.duration,
    sampleRate: details.sampleRate,
    sha256: createHash('sha256').update(audioBuffer).digest('hex'),
    importedAt: new Date().toISOString(),
    mediaUrl,
    model: String(model || '').slice(0, 120),
    voiceId: String(voiceId || '').slice(0, 180),
    requestId: String(requestId || '').slice(0, 180),
  }
  return { ok: true, asset, mediaUrl }
}
