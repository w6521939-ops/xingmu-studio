import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const defaultBailianApiHost = 'https://dashscope.aliyuncs.com'

export const bailianCapabilityMap = Object.freeze({
  script: Object.freeze({
    label: '剧本生成',
    model: 'qwen3.7-plus',
    endpoint: '/compatible-mode/v1/chat/completions',
    async: false,
  }),
  image: Object.freeze({
    label: '图像生成',
    model: 'wan2.7-image-pro',
    endpoint: '/api/v1/services/aigc/image-generation/generation',
    async: true,
  }),
  voice: Object.freeze({
    label: '配音生成',
    model: 'qwen3-tts-flash',
    endpoint: '/api/v1/services/aigc/multimodal-generation/generation',
    async: false,
  }),
  video: Object.freeze({
    label: '视频生成',
    model: 'wan2.7-i2v-2026-04-25',
    endpoint: '/api/v1/services/aigc/video-generation/video-synthesis',
    async: true,
  }),
})

const maximumKeyFileBytes = 4096
const maximumScriptResponseCharacters = 2 * 1024 * 1024
const maximumEntityResponseCharacters = 1024 * 1024
const maximumGeneratedImageBytes = 10 * 1024 * 1024
const maximumImageReferenceBytes = 10 * 1024 * 1024
const maximumImageReferenceCount = 3
const supportedImageSize = '1536*1024'
const imageTaskPollEndpoint = '/api/v1/tasks'
const imageTaskPendingStatuses = new Set(['PENDING', 'RUNNING'])
const imageTaskFailureStatuses = new Set(['FAILED', 'CANCELED', 'UNKNOWN'])
const officialImageReferencePriceCny = 0.5
const bailianImageAssetIdPattern = /^image-[a-z0-9]+-[a-f0-9]{8}$/u
const generatedImageExtensionPattern = /\.(?:jpe?g|png|webp)$/iu
const authorizationFailurePattern = /unauthorized|invalid.*key|authentication|api.?key.*invalid|access.?denied/iu

const scriptSystemPrompt = `You are a professional Chinese manju screenwriter and production planner.
Return exactly one JSON object and no markdown. Use Simplified Chinese for all creative text.
The object must contain title, logline, theme, visualStyle, characters, props, scenes and sections.
Give characters stable IDs C01..., props stable IDs P01..., scenes stable IDs SC01..., and sections stable IDs S01....
Every section must contain durationSeconds, goal and timestamped shots.
Every shot must contain time, size, camera, action, dialogue, sound and continuity.
continuity must be an array of the character, prop and scene IDs used by that shot.
Never silently change identity-defining appearance, costume, prop or scene traits.`

const entitySystemPrompts = Object.freeze({
  character: `You are a professional Chinese manju character designer.
Return exactly one JSON object and no markdown. Use Simplified Chinese.
Only expand the user prompt and supplied current facts. Do not invent unrelated story events.
The object must contain role, tone, relation, appearance, costume and forbiddenDrift.
forbiddenDrift must be an array of short identity constraints.`,
  scene: `You are a professional Chinese manju scene writer and visual production designer.
Return exactly one JSON object and no markdown. Use Simplified Chinese.
Only expand the user prompt and supplied current project facts.
The object must contain title, location, time, weather, layout, lighting, palette, action, narration and dialogues.
dialogues must be an array of objects containing speaker, text and emotion.
Do not overwrite or quote existing dialogue unless the user explicitly asks for it.`,
})

const normalizeApiHost = (value = defaultBailianApiHost) => {
  const host = String(value || defaultBailianApiHost)
    .trim()
    .replace(/\/$/u, '')
    .replace(/\/(?:api\/v1|compatible-mode\/v1)$/iu, '')
  if (!/^https:\/\//iu.test(host)) throw new Error('百炼 API Host 必须使用 HTTPS')
  return host
}

const normalizeKey = (value) => {
  let key = String(value || '').trim()
  if (key.includes('=')) key = key.slice(key.indexOf('=') + 1).trim()
  key = key.replace(/^['"]|['"]$/gu, '')
  if (!key) return ''
  if (!key.startsWith('sk-')) throw new Error('本地 key.txt 不是可识别的百炼 API Key')
  return key
}

const readKeyCandidate = async (candidate) => {
  const fileInfo = await stat(candidate.filePath)
  if (!fileInfo.isFile()) return null
  if (fileInfo.size > maximumKeyFileBytes) throw new Error('本地 key.txt 超过 4 KB 安全限制')
  const key = normalizeKey(await readFile(candidate.filePath, 'utf8'))
  return key ? { key, source: candidate.label, sourcePath: candidate.filePath } : null
}

export const resolveBailianKey = async ({
  environmentKey = process.env.DASHSCOPE_API_KEY,
  keyCandidates = [],
} = {}) => {
  const environmentValue = normalizeKey(environmentKey)
  if (environmentValue) {
    return {
      configured: true,
      key: environmentValue,
      keyType: environmentValue.startsWith('sk-ws') ? 'sk-ws' : 'sk',
      source: 'DASHSCOPE_API_KEY',
      sourcePath: '',
    }
  }

  const visited = new Set()
  for (const candidate of keyCandidates) {
    if (!candidate?.filePath) continue
    const resolvedPath = path.resolve(candidate.filePath)
    if (visited.has(resolvedPath)) continue
    visited.add(resolvedPath)
    try {
      const result = await readKeyCandidate({ ...candidate, filePath: resolvedPath })
      if (result) {
        return {
          configured: true,
          ...result,
          keyType: result.key.startsWith('sk-ws') ? 'sk-ws' : 'sk',
        }
      }
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue
      throw error
    }
  }

  return { configured: false, key: '', keyType: '', source: '', sourcePath: '' }
}

export const getPublicBailianStatus = async ({
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  allowPaidGeneration = process.env.BAILIAN_ALLOW_PAID_GENERATION === '1',
} = {}) => {
  try {
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    return {
      ok: true,
      configured: keyInfo.configured,
      keyType: keyInfo.keyType,
      source: keyInfo.source,
      apiHost: normalizeApiHost(apiHost),
      paidGenerationEnabled: allowPaidGeneration === true,
      capabilities: Object.fromEntries(Object.entries(bailianCapabilityMap).map(([id, details]) => [id, {
        supported: true,
        model: details.model,
      }])),
      unsupportedCapabilities: {},
    }
  } catch (error) {
    return {
      ok: false,
      configured: false,
      error: error instanceof Error ? error.message : '百炼 Key 状态读取失败',
    }
  }
}

export const probeBailianCapability = async ({
  capability,
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds = 10000,
} = {}) => {
  const definition = bailianCapabilityMap[capability]
  if (!definition) {
    return {
      ok: false,
      capability,
      error: '不支持的百炼能力',
    }
  }

  try {
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, capability, error: '未找到本地百炼 Key' }
    if (typeof fetchImpl !== 'function') return { ok: false, capability, error: '当前运行环境不支持网络探测' }

    const host = normalizeApiHost(apiHost)
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
          ...(definition.async ? { 'X-DashScope-Async': 'enable' } : {}),
        },
        body: '{}',
        signal: controller.signal,
      })
      responseText = await response.text()
    } finally {
      clearTimeout(timeout)
    }

    const authenticated = response.status >= 400
      && response.status < 500
      && response.status !== 401
      && response.status !== 403
      && !authorizationFailurePattern.test(responseText)
    if (!authenticated) {
      return {
        ok: false,
        capability,
        status: response.status,
        error: response.status === 401 || response.status === 403 || authorizationFailurePattern.test(responseText)
          ? '百炼拒绝了当前 Key，请检查账号、区域和权限'
          : `百炼鉴权探测失败（HTTP ${response.status}）`,
      }
    }

    return {
      ok: true,
      capability,
      status: response.status,
      model: definition.model,
      apiHost: host,
      message: `${definition.label}鉴权通过；未创建生成任务`,
    }
  } catch (error) {
    return {
      ok: false,
      capability,
      error: error?.name === 'AbortError'
        ? '百炼鉴权探测超时'
        : error instanceof Error ? error.message : '百炼鉴权探测失败',
    }
  }
}

const cleanText = (value, maximumLength, fallback = '') => {
  const text = String(value ?? '').trim()
  return (text || fallback).slice(0, maximumLength)
}

const cleanStringArray = (value, maximumItems = 12, maximumLength = 120) => (
  Array.isArray(value)
    ? value.slice(0, maximumItems).map((item) => cleanText(item, maximumLength)).filter(Boolean)
    : []
)

const countCharacters = (value) => Array.from(String(value || '')).length

const cleanRecord = (value, maximumEntries = 24, maximumLength = 600) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, maximumEntries).map(([key, item]) => {
    if (Array.isArray(item)) return [cleanText(key, 80), cleanStringArray(item, 12, 160)]
    if (item && typeof item === 'object') return [cleanText(key, 80), cleanRecord(item, 12, 240)]
    return [cleanText(key, 80), cleanText(item, maximumLength)]
  }).filter(([key]) => Boolean(key)))
}

const stripJsonFence = (value) => {
  const text = String(value || '').trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)
  return fenced ? fenced[1] : text
}

export const createBailianScriptRequest = ({ theme, genre = '悬疑', ratio = '9:16', duration = '60秒' } = {}) => {
  const normalizedTheme = cleanText(theme, 500)
  if (normalizedTheme.length < 8) throw new Error('故事灵感至少需要 8 个字符')
  const durationSeconds = Math.min(180, Math.max(15, Number.parseInt(String(duration), 10) || 60))
  const sectionCount = Math.max(1, Math.ceil(durationSeconds / 15))
  const userBrief = {
    theme: normalizedTheme,
    genre: cleanText(genre, 40, '悬疑'),
    targetRatio: cleanText(ratio, 16, '9:16'),
    targetDurationSeconds: durationSeconds,
    requestedSectionCount: sectionCount,
    requirements: [
      '每段约 15 秒，镜头时间码覆盖该段时长',
      '对白可直接用于后续角色配音',
      '画面描述可直接用于后续分镜图生成',
      '角色、道具、场景连续性 ID 必须稳定',
    ],
  }
  return {
    model: bailianCapabilityMap.script.model,
    messages: [
      { role: 'system', content: scriptSystemPrompt },
      { role: 'user', content: JSON.stringify(userBrief) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.65,
    max_tokens: 8192,
  }
}

export const normalizeBailianScript = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('百炼返回的剧本不是 JSON 对象')
  const characters = Array.isArray(value.characters) ? value.characters.slice(0, 24).map((character, index) => ({
    id: cleanText(character?.id, 24, `C${String(index + 1).padStart(2, '0')}`),
    name: cleanText(character?.name, 80, `角色${index + 1}`),
    identity: cleanText(character?.identity, 240),
    appearance: cleanText(character?.appearance, 500),
    costume: cleanText(character?.costume, 300),
    voice: cleanText(character?.voice, 200),
    forbiddenDrift: cleanStringArray(character?.forbiddenDrift),
  })) : []
  const props = Array.isArray(value.props) ? value.props.slice(0, 24).map((prop, index) => ({
    id: cleanText(prop?.id, 24, `P${String(index + 1).padStart(2, '0')}`),
    name: cleanText(prop?.name, 80, `道具${index + 1}`),
    appearance: cleanText(prop?.appearance, 500),
    storyFunction: cleanText(prop?.storyFunction, 300),
    forbiddenDrift: cleanStringArray(prop?.forbiddenDrift),
  })) : []
  const scenes = Array.isArray(value.scenes) ? value.scenes.slice(0, 32).map((scene, index) => ({
    id: cleanText(scene?.id, 24, `SC${String(index + 1).padStart(2, '0')}`),
    name: cleanText(scene?.name, 100, `场景${index + 1}`),
    time: cleanText(scene?.time, 80),
    weather: cleanText(scene?.weather, 80),
    layout: cleanText(scene?.layout, 600),
    lighting: cleanText(scene?.lighting, 300),
    palette: cleanText(scene?.palette, 240),
  })) : []
  const sections = Array.isArray(value.sections) ? value.sections.slice(0, 16).map((section, sectionIndex) => ({
    id: cleanText(section?.id, 24, `S${String(sectionIndex + 1).padStart(2, '0')}`),
    durationSeconds: Math.min(60, Math.max(1, Number(section?.durationSeconds) || 15)),
    goal: cleanText(section?.goal, 500, `推进第 ${sectionIndex + 1} 段剧情`),
    shots: Array.isArray(section?.shots) ? section.shots.slice(0, 24).map((shot, shotIndex) => ({
      id: cleanText(shot?.id, 24, `S${String(sectionIndex + 1).padStart(2, '0')}-${String(shotIndex + 1).padStart(2, '0')}`),
      time: cleanText(shot?.time, 40, `${shotIndex * 3}-${(shotIndex + 1) * 3}`),
      size: cleanText(shot?.size, 80, 'medium'),
      camera: cleanText(shot?.camera, 240),
      action: cleanText(shot?.action, 1000),
      dialogue: cleanText(shot?.dialogue, 800),
      sound: cleanText(shot?.sound, 400),
      continuity: cleanStringArray(shot?.continuity, 24, 40),
    })).filter((shot) => shot.action || shot.dialogue) : [],
  })).filter((section) => section.shots.length > 0) : []

  if (!characters.length) throw new Error('百炼剧本缺少 characters')
  if (!scenes.length) throw new Error('百炼剧本缺少 scenes')
  if (!sections.length) throw new Error('百炼剧本缺少有效 sections/shots')

  return {
    title: cleanText(value.title, 120, '未命名漫剧'),
    logline: cleanText(value.logline, 600),
    theme: cleanText(value.theme, 500),
    visualStyle: cleanText(value.visualStyle, 600),
    characters,
    props,
    scenes,
    sections,
  }
}

const readProviderError = (responseText, status) => {
  try {
    const parsed = JSON.parse(responseText)
    const code = cleanText(parsed?.code || parsed?.output?.code || parsed?.error?.code, 120)
    const message = cleanText(parsed?.message || parsed?.output?.message || parsed?.error?.message, 300)
    return [code, message].filter(Boolean).join('：') || `HTTP ${status}`
  } catch {
    return `HTTP ${status}`
  }
}

const readManifest = async (workspaceRoot) => {
  const stateDirectory = path.join(path.resolve(workspaceRoot), '.manju-studio')
  const manifestPath = path.join(stateDirectory, 'manifest.json')
  await mkdir(stateDirectory, { recursive: true })
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('本地连续性清单无法读取，请先修复 .manju-studio/manifest.json')
    const createdAt = new Date().toISOString()
    manifest = { version: 1, createdAt, updatedAt: createdAt, assets: [], tasks: [] }
  }
  if (!Array.isArray(manifest.assets)) manifest.assets = []
  if (!Array.isArray(manifest.tasks)) manifest.tasks = []
  return { stateDirectory, manifestPath, manifest }
}

const writeManifest = async ({ manifestPath, manifest }) => {
  manifest.updatedAt = new Date().toISOString()
  const temporaryManifestPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await rename(temporaryManifestPath, manifestPath)
}

export const createBailianImageMediaUrl = (assetId) => {
  const normalizedId = cleanText(assetId, 100).toLowerCase()
  if (!bailianImageAssetIdPattern.test(normalizedId)) throw new Error('生成图片资产标识无效')
  return `manju-media://generated-image/${normalizedId}`
}

const resolveBailianImageAssetRecord = async ({ workspaceRoot, assetId }) => {
  const normalizedId = cleanText(assetId, 100).toLowerCase()
  if (!bailianImageAssetIdPattern.test(normalizedId)) throw new Error('生成图片资产标识无效')
  const root = path.resolve(workspaceRoot)
  const imageRoot = path.resolve(root, '.manju-studio', 'outputs', 'images')
  const { manifest } = await readManifest(root)
  const asset = manifest.assets.find((item) => item?.id === normalizedId && item?.kind === 'image')
  if (!asset) throw new Error('生成图片资产不存在')
  const relativePath = String(asset.localPath || '').replace(/\\/gu, '/')
  if (!relativePath.startsWith('.manju-studio/outputs/images/') || !generatedImageExtensionPattern.test(relativePath)) {
    throw new Error('生成图片资产路径无效')
  }
  const filePath = path.resolve(root, ...relativePath.split('/'))
  if (!filePath.startsWith(`${imageRoot}${path.sep}`)) throw new Error('生成图片资产路径越界')
  const fileInfo = await lstat(filePath)
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) throw new Error('生成图片资产不是普通文件')
  if (!fileInfo.size || fileInfo.size > maximumGeneratedImageBytes) throw new Error('生成图片资产大小无效')
  return { asset, filePath, fileInfo }
}

const toPublicBailianImageAsset = ({ asset, fileInfo }) => ({
  assetId: asset.id,
  mediaUrl: createBailianImageMediaUrl(asset.id),
  fileName: path.basename(String(asset.localPath || '')),
  bytes: fileInfo.size,
  sha256: cleanText(asset.sha256, 128),
  purpose: cleanText(asset.tags?.at?.(-1), 24),
  entityId: cleanText(asset.lineage?.entityId, 160),
  createdAt: cleanText(asset.createdAt, 80),
})

export const resolveBailianImageAsset = async ({ workspaceRoot, assetId } = {}) => {
  const resolved = await resolveBailianImageAssetRecord({ workspaceRoot, assetId })
  return {
    ...toPublicBailianImageAsset(resolved),
    filePath: resolved.filePath,
  }
}

export const listBailianImageAssets = async ({
  workspaceRoot,
  purpose,
  entityId,
  limit = 5,
} = {}) => {
  const normalizedPurpose = cleanText(purpose, 24)
  const normalizedEntityId = cleanText(entityId, 160)
  if (!new Set(['character', 'scene', 'storyboard']).has(normalizedPurpose)) throw new Error('图片用途无效')
  if (!normalizedEntityId) throw new Error('图片实体标识不能为空')
  const { manifest } = await readManifest(workspaceRoot)
  const candidates = manifest.assets
    .filter((asset) => asset?.kind === 'image'
      && cleanText(asset.tags?.at?.(-1), 24) === normalizedPurpose
      && cleanText(asset.lineage?.entityId, 160) === normalizedEntityId)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, Math.min(10, Math.max(1, Number(limit) || 5)))
  const assets = []
  for (const candidate of candidates) {
    try {
      const resolved = await resolveBailianImageAssetRecord({ workspaceRoot, assetId: candidate.id })
      assets.push(toPublicBailianImageAsset(resolved))
    } catch {
      // Missing or invalid historical files are omitted from recoverable results.
    }
  }
  return { ok: true, assets, networkRequests: 0 }
}

const persistBailianScript = async ({ workspaceRoot, script, theme, requestId, model, usage }) => {
  const stateDirectory = path.join(path.resolve(workspaceRoot), '.manju-studio')
  const outputDirectory = path.join(stateDirectory, 'outputs', 'scripts')
  const manifestPath = path.join(stateDirectory, 'manifest.json')
  await mkdir(outputDirectory, { recursive: true })
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('本地连续性清单无法读取，请先修复 .manju-studio/manifest.json')
    const createdAt = new Date().toISOString()
    manifest = { version: 1, createdAt, updatedAt: createdAt, assets: [], tasks: [] }
  }
  if (!Array.isArray(manifest.assets)) manifest.assets = []
  if (!Array.isArray(manifest.tasks)) manifest.tasks = []

  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const outputPath = path.join(outputDirectory, `script-${timestamp}.json`)
  const serialized = `${JSON.stringify(script, null, 2)}\n`
  await writeFile(outputPath, serialized, 'utf8')
  const now = new Date().toISOString()
  const asset = {
    id: `script-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    kind: 'script',
    name: script.title,
    description: cleanText(theme, 500),
    tags: ['百炼', bailianCapabilityMap.script.model, '漫剧剧本'],
    useful: true,
    localPath: path.relative(workspaceRoot, outputPath).split(path.sep).join('/'),
    url: null,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    remote: null,
    lineage: { sourceAssets: [], requestId: requestId || null, model, usage: usage || null },
    createdAt: now,
    updatedAt: now,
  }
  manifest.assets.push(asset)
  manifest.updatedAt = now
  const temporaryManifestPath = `${manifestPath}.${process.pid}.tmp`
  await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await rename(temporaryManifestPath, manifestPath)
  return { outputPath, asset }
}

const entityKindLabels = Object.freeze({
  character: '角色设定',
  scene: '场景设定',
})

const sanitizeEntityContext = (kind, context = {}) => {
  if (kind === 'character') {
    return cleanRecord({
      name: context.name,
      role: context.role,
      tone: context.tone,
      relation: context.relation,
      appearance: context.appearance,
      costume: context.costume,
      forbiddenDrift: context.forbiddenDrift,
      projectName: context.projectName,
      synopsis: context.synopsis,
    }, 12, 600)
  }
  return cleanRecord({
    projectName: context.projectName,
    synopsis: context.synopsis,
    episodeTitle: context.episodeTitle,
    title: context.title,
    location: context.location,
    time: context.time,
    weather: context.weather,
    layout: context.layout,
    lighting: context.lighting,
    palette: context.palette,
    action: context.action,
    narration: context.narration,
    characters: Array.isArray(context.characters)
      ? context.characters.slice(0, 12).map((character) => cleanRecord(character, 8, 240))
      : [],
  }, 18, 800)
}

export const createBailianEntityRequest = ({ kind, prompt, context = {} } = {}) => {
  if (!Object.hasOwn(entitySystemPrompts, kind)) throw new Error('不支持的提示词生成类型')
  const normalizedPrompt = cleanText(prompt, kind === 'scene' ? 1600 : 1200)
  const originalLength = countCharacters(prompt)
  const maximum = kind === 'scene' ? 1600 : 1200
  if (originalLength < 4) throw new Error('提示词至少需要 4 个字符')
  if (originalLength > maximum) throw new Error(`提示词不能超过 ${maximum} 个字符`)
  const userBrief = {
    task: entityKindLabels[kind],
    prompt: normalizedPrompt,
    currentFacts: sanitizeEntityContext(kind, context),
    requirements: kind === 'scene'
      ? ['只返回当前场景', '台词建议不得覆盖用户已有台词', '保持角色姓名与身份一致']
      : ['只返回当前角色', '保持已提供的身份事实', '禁止漂移项必须具体可执行'],
  }
  return {
    model: bailianCapabilityMap.script.model,
    messages: [
      { role: 'system', content: entitySystemPrompts[kind] },
      { role: 'user', content: JSON.stringify(userBrief) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.55,
    max_tokens: kind === 'scene' ? 4096 : 2048,
  }
}

export const normalizeBailianEntity = (kind, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('百炼返回的设定不是 JSON 对象')
  if (kind === 'character') {
    const result = {
      role: cleanText(value.role, 240),
      tone: cleanText(value.tone, 240),
      relation: cleanText(value.relation, 500),
      appearance: cleanText(value.appearance, 1000),
      costume: cleanText(value.costume, 600),
      forbiddenDrift: cleanStringArray(value.forbiddenDrift, 12, 160),
    }
    if (!result.role && !result.appearance && !result.costume) throw new Error('百炼角色设定缺少有效字段')
    return result
  }
  if (kind !== 'scene') throw new Error('不支持的设定结果类型')
  const dialogues = Array.isArray(value.dialogues) ? value.dialogues.slice(0, 16).map((dialogue) => ({
    speaker: cleanText(dialogue?.speaker, 80),
    text: cleanText(dialogue?.text, 800),
    emotion: cleanText(dialogue?.emotion, 80, '自然'),
  })).filter((dialogue) => dialogue.speaker && dialogue.text) : []
  const result = {
    title: cleanText(value.title, 120),
    location: cleanText(value.location, 80),
    time: cleanText(value.time, 40),
    weather: cleanText(value.weather, 40),
    layout: cleanText(value.layout, 1000),
    lighting: cleanText(value.lighting, 500),
    palette: cleanText(value.palette, 400),
    action: cleanText(value.action, 2000),
    narration: cleanText(value.narration, 1600),
    dialogues,
  }
  if (!result.title && !result.location && !result.action && !result.narration) throw new Error('百炼场景设定缺少有效字段')
  return result
}

const persistBailianEntity = async ({ workspaceRoot, kind, result, prompt, context, requestId, model, usage }) => {
  const { stateDirectory, manifestPath, manifest } = await readManifest(workspaceRoot)
  const outputDirectory = path.join(stateDirectory, 'outputs', 'records')
  await mkdir(outputDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const outputPath = path.join(outputDirectory, `${kind}-${timestamp}.json`)
  const serialized = `${JSON.stringify(result, null, 2)}\n`
  await writeFile(outputPath, serialized, 'utf8')
  const now = new Date().toISOString()
  const asset = {
    id: `${kind}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    kind,
    name: cleanText(context?.name || context?.title, 120, entityKindLabels[kind]),
    description: cleanText(prompt, 600),
    tags: ['百炼', bailianCapabilityMap.script.model, entityKindLabels[kind]],
    useful: true,
    localPath: path.relative(workspaceRoot, outputPath).split(path.sep).join('/'),
    url: null,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    remote: null,
    lineage: { sourceAssets: [], requestId: requestId || null, model, usage: usage || null },
    createdAt: now,
    updatedAt: now,
  }
  manifest.assets.push(asset)
  await writeManifest({ manifestPath, manifest })
  return { outputPath, asset }
}

export const getBailianEntityDryRun = ({
  request,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
} = {}) => {
  const body = createBailianEntityRequest(request)
  return {
    ok: true,
    dryRun: true,
    kind: request.kind,
    endpoint: `${normalizeApiHost(apiHost)}${bailianCapabilityMap.script.endpoint}`,
    model: body.model,
    responseFormat: body.response_format.type,
    maximumOutputTokens: body.max_tokens,
    requestCount: 1,
    createsPaidTask: false,
    billingNotice: '文字模型按 Token 计费；免费额度与实际账单以百炼控制台为准',
  }
}

export const generateBailianEntity = async ({
  request,
  workspaceRoot,
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds = 120000,
  allowPaidGeneration = false,
} = {}) => {
  try {
    if (request?.confirmed !== true) return { ok: false, error: '请先确认本次单次生成请求' }
    if (allowPaidGeneration !== true) return { ok: false, paidGenerationLocked: true, error: '付费生成已锁定；未发送请求' }
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, error: '未找到本地百炼 Key' }
    if (typeof fetchImpl !== 'function') return { ok: false, error: '当前运行环境不支持百炼请求' }
    const body = createBailianEntityRequest(request)
    const host = normalizeApiHost(apiHost)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)
    let response
    let responseText
    try {
      response = await fetchImpl(`${host}${bailianCapabilityMap.script.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      responseText = await response.text()
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) return { ok: false, status: response.status, error: `百炼${entityKindLabels[request.kind]}生成失败：${readProviderError(responseText, response.status)}` }
    if (responseText.length > maximumEntityResponseCharacters) return { ok: false, error: '百炼设定响应超过 1 MB 安全限制' }
    const responseBody = JSON.parse(responseText)
    const content = responseBody?.choices?.[0]?.message?.content
    if (!content) return { ok: false, error: '百炼响应缺少 choices[0].message.content' }
    const result = normalizeBailianEntity(request.kind, JSON.parse(stripJsonFence(content)))
    const artifact = await persistBailianEntity({
      workspaceRoot,
      kind: request.kind,
      result,
      prompt: request.prompt,
      context: request.context,
      requestId: responseBody.id || responseBody.request_id,
      model: body.model,
      usage: responseBody.usage,
    })
    return {
      ok: true,
      kind: request.kind,
      result,
      model: body.model,
      requestId: responseBody.id || responseBody.request_id || '',
      usage: responseBody.usage || null,
      artifact: {
        id: artifact.asset.id,
        name: artifact.asset.name,
        localPath: artifact.asset.localPath,
        sha256: artifact.asset.sha256,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.name === 'AbortError'
        ? `百炼${entityKindLabels[request?.kind] || '设定'}生成超时`
        : error instanceof Error ? error.message : '百炼设定生成失败',
    }
  }
}

const estimateDataUrlBytes = (value) => {
  const match = String(value || '').match(/^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/iu)
  if (!match) return 0
  const base64 = match[1].replace(/\s/gu, '')
  return Math.max(0, Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0))
}

const normalizeImageRequest = (request = {}) => {
  const purposes = new Set(['character', 'scene', 'storyboard'])
  const purpose = cleanText(request.purpose, 24)
  if (!purposes.has(purpose)) throw new Error('不支持的图片生成用途')
  const promptLength = countCharacters(request.prompt)
  if (promptLength < 4) throw new Error('图片提示词至少需要 4 个字符')
  if (promptLength > 1500) throw new Error('图片提示词不能超过 1500 个字符')
  if (request.size !== supportedImageSize) throw new Error('当前仅支持 1536 × 1024 单张图片')
  const references = Array.isArray(request.references) ? request.references.slice(0, maximumImageReferenceCount) : []
  if (Array.isArray(request.references) && request.references.length > maximumImageReferenceCount) throw new Error('图片参考最多 3 张')
  const normalizedReferences = references.map((reference, index) => {
    const dataUrl = cleanText(reference?.dataUrl, maximumImageReferenceBytes * 2)
    const assetId = cleanText(reference?.assetId, 100).toLowerCase()
    const size = estimateDataUrlBytes(dataUrl)
    if (!size && !bailianImageAssetIdPattern.test(assetId)) throw new Error(`第 ${index + 1} 张参考图无有效图片数据或资产标识`)
    if (size > maximumImageReferenceBytes) throw new Error(`第 ${index + 1} 张参考图超过 10 MB`)
    return {
      id: cleanText(reference?.id, 120, `reference-${index + 1}`),
      name: cleanText(reference?.name, 120, `参考图 ${index + 1}`),
      dataUrl,
      assetId,
      bytes: size,
    }
  })
  return {
    purpose,
    entityId: cleanText(request.entityId, 160),
    name: cleanText(request.name, 120, '未命名图片'),
    prompt: cleanText(request.prompt, 1500),
    size: supportedImageSize,
    references: normalizedReferences,
  }
}

const createBailianImageBody = (normalized) => {
  if (normalized.references.some((reference) => !reference.dataUrl)) throw new Error('受控参考图需要先由主进程解析')
  const content = normalized.references.map((reference) => ({ image: reference.dataUrl }))
  content.push({ text: normalized.prompt })
  return {
    model: bailianCapabilityMap.image.model,
    input: { messages: [{ role: 'user', content }] },
    parameters: {
      n: 1,
      watermark: false,
      size: normalized.size,
      thinking_mode: normalized.references.length === 0,
    },
  }
}

export const createBailianImageRequest = (request = {}) => {
  const normalized = normalizeImageRequest(request)
  return {
    normalized,
    body: createBailianImageBody(normalized),
  }
}

export const getBailianImageDryRun = ({
  request,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
} = {}) => {
  const normalized = normalizeImageRequest(request)
  return {
    ok: true,
    dryRun: true,
    purpose: normalized.purpose,
    endpoint: `${normalizeApiHost(apiHost)}${bailianCapabilityMap.image.endpoint}`,
    model: bailianCapabilityMap.image.model,
    size: normalized.size,
    n: 1,
    referenceCount: normalized.references.length,
    referenceBytes: normalized.references.reduce((total, reference) => total + reference.bytes, 0),
    managedReferenceCount: normalized.references.filter((reference) => reference.assetId).length,
    requestCount: 1,
    createsPaidTask: false,
    officialReferencePriceCny: officialImageReferencePriceCny,
    billingNotice: '官方当前参考价 0.5 元/张；免费额度与实际账单以百炼控制台为准',
  }
}

const identifyImage = (buffer, contentType = '') => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { mime: 'image/png', extension: 'png' }
  }
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: 'image/jpeg', extension: 'jpg' }
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' }
  }
  throw new Error(`百炼返回的图片格式不受支持${contentType ? `（${cleanText(contentType, 80)}）` : ''}`)
}

const validateGeneratedImageUrl = (value) => {
  const url = new URL(String(value || ''))
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:') throw new Error('百炼图片结果必须使用 HTTPS')
  if (!(host === 'aliyuncs.com' || host.endsWith('.aliyuncs.com') || host === 'alicdn.com' || host.endsWith('.alicdn.com'))) {
    throw new Error('百炼图片结果地址不在受信任的阿里云域名')
  }
  return url.toString()
}

const persistBailianImage = async ({
  workspaceRoot,
  normalized,
  buffer,
  imageType,
  resultUrl,
  requestId,
  taskId,
  model,
  usage,
}) => {
  const { stateDirectory, manifestPath, manifest } = await readManifest(workspaceRoot)
  const outputDirectory = path.join(stateDirectory, 'outputs', 'images')
  await mkdir(outputDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const outputPath = path.join(outputDirectory, `${normalized.purpose}-${timestamp}.${imageType.extension}`)
  await writeFile(outputPath, buffer)
  const now = new Date().toISOString()
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const asset = {
    id: `image-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    kind: 'image',
    name: normalized.name,
    description: normalized.prompt,
    tags: ['百炼', model, normalized.purpose],
    useful: true,
    localPath: path.relative(workspaceRoot, outputPath).split(path.sep).join('/'),
    url: null,
    sha256,
    remote: { sourceUrl: resultUrl, downloadedAt: now, expiresWithinHours: 24 },
    lineage: {
      sourceAssets: normalized.references.map((reference) => reference.id),
      entityId: normalized.entityId || null,
      requestId: requestId || null,
      taskId: taskId || null,
      model,
      usage: usage || null,
    },
    createdAt: now,
    updatedAt: now,
  }
  manifest.assets.push(asset)
  await writeManifest({ manifestPath, manifest })
  return { outputPath, asset, sha256 }
}

export const generateBailianImage = async ({
  request,
  workspaceRoot,
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds = 180000,
  pollIntervalMilliseconds = 5000,
  waitImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  allowPaidGeneration = false,
} = {}) => {
  try {
    if (request?.confirmed !== true) return { ok: false, error: '请先确认本次单张图片生成请求' }
    if (allowPaidGeneration !== true) return { ok: false, paidGenerationLocked: true, error: '付费生成已锁定；未发送请求' }
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, error: '未找到本地百炼 Key' }
    if (typeof fetchImpl !== 'function') return { ok: false, error: '当前运行环境不支持百炼请求' }
    const normalized = normalizeImageRequest(request)
    for (const reference of normalized.references) {
      if (reference.dataUrl) continue
      const resolvedReference = await resolveBailianImageAssetRecord({ workspaceRoot, assetId: reference.assetId })
      const referenceBuffer = await readFile(resolvedReference.filePath)
      const referenceType = identifyImage(referenceBuffer)
      reference.dataUrl = `data:${referenceType.mime};base64,${referenceBuffer.toString('base64')}`
      reference.bytes = referenceBuffer.length
    }
    const body = createBailianImageBody(normalized)
    const host = normalizeApiHost(apiHost)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)
    let response
    let responseText
    let responseBody
    let taskId = ''
    try {
      response = await fetchImpl(`${host}${bailianCapabilityMap.image.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      responseText = await response.text()
      if (!response.ok) return { ok: false, status: response.status, error: `百炼图片任务创建失败：${readProviderError(responseText, response.status)}` }
      if (responseText.length > maximumEntityResponseCharacters) return { ok: false, error: '百炼图片任务响应超过 1 MB 安全限制' }
      responseBody = JSON.parse(responseText)
      taskId = cleanText(responseBody?.output?.task_id, 180)
      if (!taskId) return { ok: false, error: '百炼图片任务响应缺少 output.task_id' }

      let taskStatus = cleanText(responseBody?.output?.task_status, 40).toUpperCase()
      while (imageTaskPendingStatuses.has(taskStatus)) {
        await waitImpl(Math.max(0, pollIntervalMilliseconds))
        response = await fetchImpl(`${host}${imageTaskPollEndpoint}/${encodeURIComponent(taskId)}`, {
          headers: { Authorization: `Bearer ${keyInfo.key}` },
          signal: controller.signal,
        })
        responseText = await response.text()
        if (!response.ok) return { ok: false, status: response.status, taskId, error: `百炼图片任务查询失败：${readProviderError(responseText, response.status)}` }
        if (responseText.length > maximumEntityResponseCharacters) return { ok: false, taskId, error: '百炼图片任务查询响应超过 1 MB 安全限制' }
        responseBody = JSON.parse(responseText)
        taskStatus = cleanText(responseBody?.output?.task_status, 40).toUpperCase()
      }
      if (imageTaskFailureStatuses.has(taskStatus)) {
        return {
          ok: false,
          taskId,
          providerCode: cleanText(responseBody?.output?.code, 120),
          error: cleanText(responseBody?.output?.message, 600, `百炼图片任务状态为 ${taskStatus}`),
        }
      }
      if (taskStatus !== 'SUCCEEDED') return { ok: false, taskId, error: `百炼图片任务返回未知状态：${taskStatus || 'EMPTY'}` }
    } finally {
      clearTimeout(timeout)
    }
    const resultUrl = responseBody?.output?.choices?.[0]?.message?.content?.find((item) => item?.image)?.image
    if (!resultUrl) return { ok: false, error: '百炼图片响应缺少 output.choices[0].message.content[].image' }
    const trustedResultUrl = validateGeneratedImageUrl(resultUrl)
    const downloadController = new AbortController()
    const downloadTimeout = setTimeout(() => downloadController.abort(), 120000)
    let downloadResponse
    let imageBuffer
    try {
      downloadResponse = await fetchImpl(trustedResultUrl, { signal: downloadController.signal })
      if (!downloadResponse.ok) return { ok: false, status: downloadResponse.status, error: `百炼图片下载失败（HTTP ${downloadResponse.status}）` }
      imageBuffer = Buffer.from(await downloadResponse.arrayBuffer())
    } finally {
      clearTimeout(downloadTimeout)
    }
    if (!imageBuffer.length) return { ok: false, error: '百炼返回了空图片文件' }
    if (imageBuffer.length > maximumGeneratedImageBytes) return { ok: false, error: '百炼生成图片超过 10 MB 安全限制' }
    const imageType = identifyImage(imageBuffer, downloadResponse.headers?.get?.('content-type') || '')
    const requestId = responseBody.request_id || responseBody.id || ''
    const artifact = await persistBailianImage({
      workspaceRoot,
      normalized,
      buffer: imageBuffer,
      imageType,
      resultUrl: trustedResultUrl,
      requestId,
      taskId,
      model: body.model,
      usage: responseBody.usage,
    })
    return {
      ok: true,
      purpose: normalized.purpose,
      model: body.model,
      requestId,
      taskId,
      usage: responseBody.usage || null,
      image: {
        mediaUrl: createBailianImageMediaUrl(artifact.asset.id),
        mime: imageType.mime,
        bytes: imageBuffer.length,
        fileName: path.basename(artifact.outputPath),
        assetId: artifact.asset.id,
        localPath: artifact.asset.localPath,
        sha256: artifact.sha256,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.name === 'AbortError'
        ? '百炼图片生成或下载超时'
        : error instanceof Error ? error.message : '百炼图片生成失败',
    }
  }
}

export const getBailianScriptDryRun = ({ request, apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost } = {}) => {
  const body = createBailianScriptRequest(request)
  return {
    ok: true,
    dryRun: true,
    endpoint: `${normalizeApiHost(apiHost)}${bailianCapabilityMap.script.endpoint}`,
    model: body.model,
    responseFormat: body.response_format.type,
    maximumOutputTokens: body.max_tokens,
    messageCount: body.messages.length,
    themeCharacters: JSON.parse(body.messages[1].content).theme.length,
    requestCount: 1,
    createsPaidTask: false,
    billingNotice: '文字模型按 Token 计费；免费额度与实际账单以百炼控制台为准',
  }
}

export const generateBailianScript = async ({
  request,
  workspaceRoot,
  environmentKey,
  keyCandidates,
  apiHost = process.env.BAILIAN_API_HOST || defaultBailianApiHost,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds = 120000,
  allowPaidGeneration = false,
} = {}) => {
  try {
    if (request?.confirmed !== true) {
      return { ok: false, error: '请先确认本次单次剧本生成请求' }
    }
    if (allowPaidGeneration !== true) {
      return { ok: false, paidGenerationLocked: true, error: '付费生成已锁定；当前只允许本地演示，不会发送百炼生成请求' }
    }
    const keyInfo = await resolveBailianKey({ environmentKey, keyCandidates })
    if (!keyInfo.configured) return { ok: false, error: '未找到本地百炼 Key' }
    if (typeof fetchImpl !== 'function') return { ok: false, error: '当前运行环境不支持百炼请求' }
    const body = createBailianScriptRequest(request)
    const host = normalizeApiHost(apiHost)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds)
    let response
    let responseText
    try {
      response = await fetchImpl(`${host}${bailianCapabilityMap.script.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      responseText = await response.text()
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) return { ok: false, status: response.status, error: `百炼剧本生成失败：${readProviderError(responseText, response.status)}` }
    if (responseText.length > maximumScriptResponseCharacters) return { ok: false, error: '百炼剧本响应超过 2 MB 安全限制' }
    const responseBody = JSON.parse(responseText)
    const content = responseBody?.choices?.[0]?.message?.content
    if (!content) return { ok: false, error: '百炼响应缺少 choices[0].message.content' }
    const script = normalizeBailianScript(JSON.parse(stripJsonFence(content)))
    const artifact = await persistBailianScript({
      workspaceRoot,
      script,
      theme: request?.theme,
      requestId: responseBody.id || responseBody.request_id,
      model: body.model,
      usage: responseBody.usage,
    })
    return {
      ok: true,
      script,
      model: body.model,
      requestId: responseBody.id || responseBody.request_id || '',
      usage: responseBody.usage || null,
      artifact: {
        id: artifact.asset.id,
        name: artifact.asset.name,
        localPath: artifact.asset.localPath,
        sha256: artifact.asset.sha256,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.name === 'AbortError'
        ? '百炼剧本生成超时'
        : error instanceof Error ? error.message : '百炼剧本生成失败',
    }
  }
}
