import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  bailianCapabilityMap,
  defaultBailianApiHost,
  resolveBailianImageAsset,
  resolveBailianKey,
} from './bailianProviderService.js'

const maximumVideoBytes = 250 * 1024 * 1024
const maximumFrameBytes = 10 * 1024 * 1024
const terminalTaskStatuses = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'])

const cleanText = (value, maximumLength = 5000) => String(value || '').trim().slice(0, maximumLength)

const normalizeApiHost = (value = defaultBailianApiHost) => {
  const host = String(value || defaultBailianApiHost)
    .trim()
    .replace(/\/$/u, '')
    .replace(/\/api\/v1$/iu, '')
  if (!/^https:\/\//iu.test(host)) throw new Error('百炼 API Host 必须使用 HTTPS')
  return host
}

const readProviderFailure = (responseText, status) => {
  try {
    const parsed = JSON.parse(responseText)
    const code = cleanText(parsed?.code || parsed?.output?.code || parsed?.error?.code, 120)
    const message = cleanText(parsed?.message || parsed?.output?.message || parsed?.error?.message, 400)
    return {
      code,
      message: [code, message].filter(Boolean).join('：') || `HTTP ${status}`,
    }
  } catch {
    return { code: '', message: `HTTP ${status}` }
  }
}

const validateAlibabaMediaUrl = (value, label) => {
  const url = new URL(String(value || ''))
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:') throw new Error(`${label}必须使用 HTTPS`)
  if (!(host === 'aliyuncs.com' || host.endsWith('.aliyuncs.com') || host === 'alicdn.com' || host.endsWith('.alicdn.com'))) {
    throw new Error(`${label}不在受信任的阿里云域名`)
  }
  return url.toString()
}

const identifyFrameExtension = (buffer) => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png'
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  throw new Error('视频首帧图片格式不受支持')
}

const materializeFrame = async ({ frame, workspaceRoot, temporaryRoot }) => {
  if (frame?.assetId) {
    const resolved = await resolveBailianImageAsset({ workspaceRoot, assetId: frame.assetId })
    return { filePath: resolved.filePath, temporary: false }
  }
  const match = /^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/iu.exec(cleanText(frame?.dataUrl, 16 * 1024 * 1024))
  if (!match) throw new Error('视频任务缺少可用的真实首帧')
  const buffer = Buffer.from(match[1], 'base64')
  if (!buffer.length || buffer.length > maximumFrameBytes) throw new Error('视频首帧大小无效')
  const extension = identifyFrameExtension(buffer)
  await mkdir(temporaryRoot, { recursive: true })
  const filePath = path.join(temporaryRoot, `frame-${randomUUID()}.${extension}`)
  await writeFile(filePath, buffer)
  return { filePath, temporary: true }
}

const uploadTemporaryFrame = async ({
  filePath,
  model,
  key,
  apiHost,
  fetchImpl,
}) => {
  const policyUrl = `${apiHost}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`
  const policyResponse = await fetchImpl(policyUrl, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const policyText = await policyResponse.text()
  if (!policyResponse.ok) {
    const failure = readProviderFailure(policyText, policyResponse.status)
    const error = new Error(`百炼临时上传授权失败：${failure.message}`)
    error.providerCode = failure.code
    throw error
  }
  const policy = JSON.parse(policyText)?.data
  if (!policy?.upload_host || !policy?.upload_dir) throw new Error('百炼临时上传授权响应不完整')
  const fileInfo = await stat(filePath)
  if (!fileInfo.isFile() || !fileInfo.size || fileInfo.size > maximumFrameBytes) throw new Error('视频首帧文件大小无效')
  if (Number(policy.max_file_size_mb) > 0 && fileInfo.size > Number(policy.max_file_size_mb) * 1024 * 1024) {
    throw new Error('视频首帧超过百炼临时上传限制')
  }
  const fileName = path.basename(filePath)
  const objectKey = `${policy.upload_dir}/${fileName}`
  const form = new FormData()
  form.append('OSSAccessKeyId', policy.oss_access_key_id)
  form.append('Signature', policy.signature)
  form.append('policy', policy.policy)
  form.append('x-oss-object-acl', policy.x_oss_object_acl)
  form.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  form.append('key', objectKey)
  form.append('success_action_status', '200')
  form.append('file', new Blob([await readFile(filePath)]), fileName)
  const uploadResponse = await fetchImpl(policy.upload_host, { method: 'POST', body: form })
  if (!uploadResponse.ok) throw new Error(`百炼首帧临时上传失败（HTTP ${uploadResponse.status}）`)
  return `oss://${objectKey}`
}

const normalizeVideoRequest = (request = {}) => {
  const prompt = cleanText(request.prompt)
  if (!prompt) throw new Error('视频导演提示词不能为空')
  const duration = Number(request.duration)
  if (!Number.isInteger(duration) || duration < 2 || duration > 15) throw new Error('视频时长必须是 2～15 秒整数')
  if (request.resolution !== '720P') throw new Error('0 元自动化只允许 720P 视频')
  return {
    prompt,
    negativePrompt: cleanText(request.negativePrompt, 500),
    resolution: '720P',
    duration,
    promptExtend: request.promptExtend === true,
    watermark: false,
    seed: Number.isInteger(request.seed) ? request.seed : null,
    firstFrame: request.firstFrame,
    lastFrame: request.lastFrame || request.firstFrame,
  }
}

const sameFrame = (first, second) => Boolean(
  (first?.assetId && second?.assetId && first.assetId === second.assetId)
  || (first?.dataUrl && second?.dataUrl && first.dataUrl === second.dataUrl),
)

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const generateBailianVideo = async ({
  request,
  workspaceRoot,
  temporaryRoot,
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  fetchImpl = globalThis.fetch,
  allowPaidGeneration = false,
  pollIntervalMilliseconds = 15000,
  timeoutMilliseconds = 30 * 60 * 1000,
  existingTaskId = '',
  onTaskSubmitted = () => undefined,
  onPoll = () => undefined,
} = {}) => {
  try {
    if (request?.confirmed !== true) return { ok: false, error: '请先确认整部漫剧一键制作' }
    if (allowPaidGeneration !== true) return { ok: false, paidGenerationLocked: true, error: '付费生成已锁定；未发送视频请求' }
    const normalized = normalizeVideoRequest(request)
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, error: '未找到本地百炼 Key' }
    if (typeof fetchImpl !== 'function') return { ok: false, error: '当前运行环境不支持百炼视频请求' }
    const host = normalizeApiHost(apiHost)
    const model = bailianCapabilityMap.video.model
    let taskId = cleanText(existingTaskId, 160)
    let requestId = ''

    if (!taskId) {
      const uploadFrame = async (frame) => {
        const materialized = await materializeFrame({ frame, workspaceRoot, temporaryRoot })
        try {
          return await uploadTemporaryFrame({
            filePath: materialized.filePath,
            model,
            key: keyInfo.key,
            apiHost: host,
            fetchImpl,
          })
        } finally {
          if (materialized.temporary) await rm(materialized.filePath, { force: true }).catch(() => undefined)
        }
      }
      const firstFrameUrl = await uploadFrame(normalized.firstFrame)
      const lastFrameUrl = sameFrame(normalized.firstFrame, normalized.lastFrame)
        ? firstFrameUrl
        : await uploadFrame(normalized.lastFrame)
      const body = {
        model,
        input: {
          prompt: normalized.prompt,
          media: [
            { type: 'first_frame', url: firstFrameUrl },
            { type: 'last_frame', url: lastFrameUrl },
          ],
          ...(normalized.negativePrompt ? { negative_prompt: normalized.negativePrompt } : {}),
        },
        parameters: {
          resolution: normalized.resolution,
          duration: normalized.duration,
          prompt_extend: normalized.promptExtend,
          watermark: false,
          ...(normalized.seed === null ? {} : { seed: normalized.seed }),
        },
      }
      const response = await fetchImpl(`${host}${bailianCapabilityMap.video.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
          'X-DashScope-OssResourceResolve': 'enable',
        },
        body: JSON.stringify(body),
      })
      const responseText = await response.text()
      if (!response.ok) {
        const failure = readProviderFailure(responseText, response.status)
        return {
          ok: false,
          status: response.status,
          providerCode: failure.code,
          error: `百炼视频任务创建失败：${failure.message}`,
        }
      }
      const responseBody = JSON.parse(responseText)
      taskId = cleanText(responseBody?.output?.task_id, 160)
      requestId = cleanText(responseBody?.request_id, 160)
      if (!taskId) return { ok: false, error: '百炼视频响应缺少 task_id' }
      await onTaskSubmitted({ taskId, requestId, model })
    }

    const deadline = Date.now() + timeoutMilliseconds
    let resultBody = null
    while (Date.now() < deadline) {
      const pollResponse = await fetchImpl(`${host}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${keyInfo.key}` },
      })
      const pollText = await pollResponse.text()
      if (!pollResponse.ok) {
        const failure = readProviderFailure(pollText, pollResponse.status)
        return {
          ok: false,
          status: pollResponse.status,
          providerCode: failure.code,
          taskId,
          error: `百炼视频任务查询失败：${failure.message}`,
        }
      }
      resultBody = JSON.parse(pollText)
      const taskStatus = cleanText(resultBody?.output?.task_status, 40) || 'UNKNOWN'
      await onPoll({ taskId, taskStatus, elapsedMilliseconds: timeoutMilliseconds - (deadline - Date.now()) })
      if (terminalTaskStatuses.has(taskStatus)) break
      await wait(Math.max(0, pollIntervalMilliseconds))
    }

    const taskStatus = cleanText(resultBody?.output?.task_status, 40) || 'TIMEOUT'
    if (taskStatus !== 'SUCCEEDED') {
      const providerCode = cleanText(resultBody?.output?.code || resultBody?.code, 120)
      const providerMessage = cleanText(resultBody?.output?.message || resultBody?.message, 400)
      return {
        ok: false,
        taskId,
        taskStatus,
        providerCode,
        error: taskStatus === 'TIMEOUT'
          ? '百炼视频任务轮询超时'
          : `百炼视频任务结束为 ${taskStatus}${providerMessage ? `：${providerMessage}` : ''}`,
      }
    }
    const videoUrl = validateAlibabaMediaUrl(resultBody?.output?.video_url, '百炼视频结果地址')
    const downloadResponse = await fetchImpl(videoUrl)
    if (!downloadResponse.ok) return { ok: false, taskId, error: `百炼视频下载失败（HTTP ${downloadResponse.status}）` }
    const declaredBytes = Number(downloadResponse.headers?.get?.('content-length')) || 0
    if (declaredBytes > maximumVideoBytes) return { ok: false, taskId, error: '百炼视频超过 250 MB 安全限制' }
    const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer())
    if (!videoBuffer.length || videoBuffer.length > maximumVideoBytes) return { ok: false, taskId, error: '百炼视频文件大小无效' }
    await mkdir(temporaryRoot, { recursive: true })
    const downloadPath = path.join(temporaryRoot, `video-${taskId}-${randomUUID()}.mp4`)
    await writeFile(downloadPath, videoBuffer)
    return {
      ok: true,
      model,
      taskId,
      requestId: cleanText(resultBody?.request_id || requestId, 160),
      usage: resultBody?.usage || null,
      downloadPath,
      sha256: createHash('sha256').update(videoBuffer).digest('hex'),
    }
  } catch (error) {
    return {
      ok: false,
      providerCode: cleanText(error?.providerCode, 120),
      error: error instanceof Error ? error.message : '百炼视频生成失败',
    }
  }
}
