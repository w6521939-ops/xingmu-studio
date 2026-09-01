import {
  bailianCapabilityMap,
  defaultBailianApiHost,
  resolveBailianKey,
} from './bailianProviderService.js'
import {
  maximumManagedVoiceBytes,
  prepareManagedVoiceAssetFromBuffer,
} from './voiceAssetService.js'

const maximumResponseCharacters = 1024 * 1024
const maximumTextCharacters = 2000
const officialSystemVoicePattern = /^(?:Cherry|Serena|Ethan|Chelsie|Moon|Kai|Vincent|Neil|Eldric Sage|Mochi|Bunny|Bellona)$/u

const normalizeApiHost = (value = defaultBailianApiHost) => {
  const host = String(value || defaultBailianApiHost)
    .trim()
    .replace(/\/$/u, '')
    .replace(/\/api\/v1$/iu, '')
  if (!host.startsWith('https://')) throw new Error('百炼 TTS API Host 必须使用 HTTPS')
  return host
}

const parseJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const extractAudioUrl = (payload) => (
  payload?.output?.audio?.url
  || payload?.output?.audio_url
  || payload?.output?.url
  || payload?.audio?.url
  || ''
)

const normalizeTrustedAudioUrl = (value) => {
  const url = new URL(String(value || ''))
  const host = url.hostname.toLowerCase()
  const trustedHost = host === 'aliyuncs.com'
    || host.endsWith('.aliyuncs.com')
    || host === 'alicdn.com'
    || host.endsWith('.alicdn.com')
  if (!trustedHost || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('百炼配音音频地址不在受信任的阿里云域名')
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  return url
}

const cleanText = (value, maximumLength) => String(value || '').trim().slice(0, maximumLength)

export async function generateBailianVoice({
  request = {},
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_TTS_API_HOST || process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  allowPaidGeneration = process.env.BAILIAN_ALLOW_PAID_GENERATION === '1',
  fetchImpl = globalThis.fetch,
  voiceMediaRoot,
  projectLocalId,
  timeoutMilliseconds = 90000,
} = {}) {
  if (allowPaidGeneration !== true) {
    return { ok: false, error: '真实配音生成已被环境锁定；未发送请求', providerCode: 'PAID_GENERATION_DISABLED' }
  }
  if (request?.confirmed !== true) return { ok: false, error: '请先确认本次真实配音生成' }
  const text = cleanText(request?.text, maximumTextCharacters)
  const voiceId = cleanText(request?.voiceId, 180)
  if (!text) return { ok: false, error: '配音文本不能为空' }
  if (!officialSystemVoicePattern.test(voiceId)) {
    return { ok: false, error: '配音音色与当前模型不匹配' }
  }
  if (typeof fetchImpl !== 'function') return { ok: false, error: '当前运行环境不支持网络请求' }

  try {
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, error: '未找到本地百炼 Key', providerCode: 'KEY_NOT_CONFIGURED' }
    const host = normalizeApiHost(apiHost)
    if (keyInfo.keyType === 'sk-ws' && host === defaultBailianApiHost) {
      return {
        ok: false,
        error: 'Qwen3-TTS 需要北京地域的工作空间 API 地址，请配置 workspace.txt 或 BAILIAN_WORKSPACE_ID',
        providerCode: 'WORKSPACE_TTS_HOST_REQUIRED',
      }
    }
    const definition = bailianCapabilityMap.voice
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)
    let response
    let responseText = ''
    try {
      response = await fetchImpl(`${host}${definition.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: definition.model,
          input: {
            text,
            voice: voiceId,
            language_type: 'Chinese',
          },
        }),
        signal: controller.signal,
      })
      responseText = (await response.text()).slice(0, maximumResponseCharacters)
    } finally {
      clearTimeout(timeout)
    }
    const payload = parseJson(responseText)
    if (!response.ok) {
      return {
        ok: false,
        error: cleanText(payload?.message || payload?.error?.message || `百炼配音请求失败（HTTP ${response.status}）`, 600),
        providerCode: cleanText(payload?.code || payload?.error?.code || `HTTP_${response.status}`, 120),
        requestId: cleanText(payload?.request_id || payload?.requestId, 180),
      }
    }
    const audioUrl = extractAudioUrl(payload)
    if (!audioUrl) return { ok: false, error: '百炼配音响应缺少音频地址', providerCode: 'AUDIO_URL_MISSING' }
    const parsedAudioUrl = normalizeTrustedAudioUrl(audioUrl)
    const downloadController = new AbortController()
    const downloadTimeout = setTimeout(() => downloadController.abort(), timeoutMilliseconds)
    let audioResponse
    let audioBuffer
    try {
      audioResponse = await fetchImpl(parsedAudioUrl.toString(), { signal: downloadController.signal })
      if (!audioResponse.ok) {
        return {
          ok: false,
          error: `百炼临时音频下载失败（HTTP ${audioResponse.status}）`,
          providerCode: `AUDIO_DOWNLOAD_HTTP_${audioResponse.status}`,
        }
      }
      const declaredBytes = Number(audioResponse.headers?.get?.('content-length')) || 0
      if (declaredBytes > maximumManagedVoiceBytes) {
        return { ok: false, error: '百炼临时音频超过 12 MB 安全限制', providerCode: 'AUDIO_DOWNLOAD_TOO_LARGE' }
      }
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    } finally {
      clearTimeout(downloadTimeout)
    }
    if (audioBuffer.length > maximumManagedVoiceBytes) {
      return { ok: false, error: '百炼临时音频超过 12 MB 安全限制', providerCode: 'AUDIO_DOWNLOAD_TOO_LARGE' }
    }
    const requestId = cleanText(payload?.request_id || payload?.requestId, 180)
    const prepared = await prepareManagedVoiceAssetFromBuffer({
      buffer: audioBuffer,
      projectLocalId,
      mediaRoot: voiceMediaRoot,
      fileName: `${cleanText(request?.lineId, 80) || 'line'}.wav`,
      model: definition.model,
      voiceId,
      requestId,
    })
    return {
      ok: true,
      asset: prepared.asset,
      mediaUrl: prepared.mediaUrl,
      model: definition.model,
      requestId,
      usage: payload?.usage || null,
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.name === 'AbortError'
        ? '百炼配音生成或下载超时'
        : error instanceof Error ? error.message : '百炼配音生成失败',
      providerCode: error?.name === 'AbortError' ? 'TIMEOUT' : '',
    }
  }
}
