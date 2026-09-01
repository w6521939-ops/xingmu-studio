import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const requiredOneClickModelSignature = [
  'script:qwen3.7-plus',
  'image:wan2.7-image-pro',
  'voice:qwen3-tts-flash',
  'video:wan2.7-i2v-2026-04-25',
].join('|')

const terminalTaskStatuses = new Set(['succeeded', 'failed', 'skipped'])
const imageTaskKinds = new Set(['character-image', 'scene-image', 'storyboard-image'])
const supportedTaskKinds = new Set([
  ...imageTaskKinds,
  'voice-assignment',
  'voice-line',
  'shot-video',
  'episode-export',
])
const safeProjectIdPattern = /^[a-z0-9][a-z0-9-]{5,159}$/iu
const zeroCostStopPattern = /AllocationQuota\.FreeTierOnly|free.?tier|free.*quota|quota.*exhaust|insufficient.*balance|balance.*insufficient|arrears|overdue|欠费|余额不足|免费额度|配额|额度(?:不足|用完|耗尽)/iu
const rateLimitPattern = /Throttling|RateQuota|rate.?limit|too many requests|requests rate limit exceeded|限流|请求过快|频率过高/iu
const defaultRatePolicies = Object.freeze({
  image: Object.freeze({ intervalMilliseconds: 31000, cooldownMilliseconds: 65000, maximumAttempts: 3 }),
  voice: Object.freeze({ intervalMilliseconds: 400, cooldownMilliseconds: 65000, maximumAttempts: 3 }),
  video: Object.freeze({ intervalMilliseconds: 250, cooldownMilliseconds: 65000, maximumAttempts: 3 }),
})

const now = () => new Date().toISOString()
const clone = (value) => structuredClone(value)
const cleanText = (value, maximumLength = 600) => String(value || '').trim().slice(0, maximumLength)

export const isZeroCostStopFailure = (value) => zeroCostStopPattern.test([
  value?.providerCode,
  value?.error,
  value?.message,
].filter(Boolean).join(' '))

export const isRateLimitFailure = (value) => rateLimitPattern.test([
  value?.providerCode,
  value?.error,
  value?.message,
].filter(Boolean).join(' '))

const summarize = (tasks = []) => {
  const count = (status) => tasks.filter((task) => task.status === status).length
  return {
    total: tasks.length,
    pending: count('pending'),
    running: count('running'),
    succeeded: count('succeeded'),
    failed: count('failed'),
    skipped: count('skipped'),
    completed: tasks.filter((task) => terminalTaskStatuses.has(task.status)).length,
  }
}

const toPublicRun = (run) => ({
  ...clone(run),
  summary: summarize(run.tasks),
})

const normalizeProjectId = (value) => {
  const projectLocalId = cleanText(value, 160)
  if (!safeProjectIdPattern.test(projectLocalId)) throw new Error('项目本地标识无效')
  return projectLocalId
}

const sanitizePlanTask = (task) => {
  const kind = cleanText(task?.kind, 40)
  if (!supportedTaskKinds.has(kind)) throw new Error('一键制作任务类型无效')
  const entityId = cleanText(task?.entityId, 160)
  const inputHash = cleanText(task?.inputHash, 80)
  if (!entityId || !inputHash) throw new Error('一键制作任务标识不完整')
  return {
    id: cleanText(task.id, 300),
    stage: cleanText(task.stage, 60),
    kind,
    entityType: cleanText(task.entityType, 40),
    entityId,
    label: cleanText(task.label, 180),
    inputHash,
    request: clone(task.request || {}),
    referenceKeys: Array.isArray(task.referenceKeys)
      ? task.referenceKeys.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 3)
      : [],
    status: 'pending',
    attempt: 0,
    startedAt: '',
    completedAt: '',
    error: '',
    providerCode: '',
    result: null,
  }
}

const validateAttestation = (attestation) => {
  if (attestation?.confirmed !== true) throw new Error('请先确认已开启免费额度用完即停')
  if (attestation?.modelSignature !== requiredOneClickModelSignature) {
    throw new Error('模型配置已变化，请重新确认 0 元保护')
  }
  if (!cleanText(attestation?.confirmedAt, 80)) throw new Error('0 元保护确认记录无效')
}

const atomicWriteJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, filePath)
}

const mergeReferences = (task, assetMap) => {
  const references = Array.isArray(task.request?.references) ? clone(task.request.references) : []
  for (const key of task.referenceKeys) {
    const image = assetMap[key]
    if (!image?.assetId || references.some((item) => item.assetId === image.assetId)) continue
    references.push({
      id: key,
      name: key,
      assetId: image.assetId,
      bytes: Math.max(0, Number(image.bytes) || 0),
    })
  }
  return references.slice(0, 3)
}

export const createOneClickProductionController = ({
  automationRoot,
  workspaceRoot,
  temporaryRoot,
  shotVideoMediaRoot,
  voiceMediaRoot,
  ffmpegPath,
  generationOptions = {},
  imageGenerator,
  voiceGenerator,
  videoGenerator,
  videoPreparer,
  episodeExporter,
  videoResolver,
  voiceResolver,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  nowMilliseconds = () => Date.now(),
  ratePolicies = defaultRatePolicies,
  onProgress = () => undefined,
} = {}) => {
  if (!automationRoot || !workspaceRoot || !temporaryRoot || !shotVideoMediaRoot || !voiceMediaRoot) {
    throw new Error('一键制作本地目录未配置')
  }
  if (
    typeof imageGenerator !== 'function'
    || typeof voiceGenerator !== 'function'
    || typeof videoGenerator !== 'function'
    || typeof videoPreparer !== 'function'
    || typeof episodeExporter !== 'function'
    || typeof videoResolver !== 'function'
    || typeof voiceResolver !== 'function'
  ) {
    throw new Error('一键制作执行器未配置')
  }

  const runs = new Map()
  let activeProjectId = ''
  let activePromise = null
  let persistenceQueue = Promise.resolve()
  const lastRequestAt = new Map()

  const filePathFor = (projectLocalId) => path.join(
    automationRoot,
    normalizeProjectId(projectLocalId),
    'one-click-production.json',
  )

  const persist = (run) => {
    run.updatedAt = now()
    const filePath = filePathFor(run.projectLocalId)
    const snapshot = clone(run)
    persistenceQueue = persistenceQueue
      .catch(() => undefined)
      .then(() => atomicWriteJson(filePath, snapshot))
    return persistenceQueue
  }

  const emit = async (run) => {
    await persist(run)
    onProgress(toPublicRun(run))
  }

  const load = async (projectLocalId) => {
    const normalizedId = normalizeProjectId(projectLocalId)
    if (runs.has(normalizedId)) return runs.get(normalizedId)
    try {
      const run = JSON.parse(await readFile(filePathFor(normalizedId), 'utf8'))
      if (run.projectLocalId !== normalizedId || !Array.isArray(run.tasks)) throw new Error('一键制作记录不匹配')
      for (const task of run.tasks) {
        if (task.status === 'running') {
          task.status = 'pending'
          task.error = '应用上次在任务执行中退出，已等待手动继续'
        }
      }
      if (run.status === 'running' || run.status === 'pausing' || run.status === 'stopping') run.status = 'interrupted'
      runs.set(normalizedId, run)
      await persist(run)
      return run
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  const buildAssetMap = (run) => {
    const assetMap = {}
    for (const task of run.tasks) {
      if (task.status !== 'succeeded' || !task.result) continue
      if (imageTaskKinds.has(task.kind) && task.result.image) {
        assetMap[`${task.entityType}:${task.entityId}`] = task.result.image
      }
      if (task.kind === 'voice-line' && task.result.asset) {
        assetMap[`line-audio:${task.entityId}`] = task.result.asset
      }
      if (task.kind === 'shot-video' && task.result.asset) {
        assetMap[`shot-video:${task.entityId}`] = task.result.asset
      }
    }
    return assetMap
  }

  const ratePolicyKey = (task) => {
    if (imageTaskKinds.has(task.kind)) return 'image'
    if (task.kind === 'voice-line') return 'voice'
    if (task.kind === 'shot-video') return 'video'
    return ''
  }

  const waitWithVisibleCooldown = async (run, task, milliseconds, reason) => {
    const waitMilliseconds = Math.max(0, Math.round(Number(milliseconds) || 0))
    if (!waitMilliseconds) return
    run.status = 'cooldown'
    run.cooldown = {
      taskId: task.id,
      reason,
      milliseconds: waitMilliseconds,
      startedAt: now(),
      until: new Date(nowMilliseconds() + waitMilliseconds).toISOString(),
    }
    task.status = 'cooldown'
    task.localMessage = reason === 'rate-limit'
      ? `服务限流，冷却 ${Math.ceil(waitMilliseconds / 1000)} 秒后自动重试`
      : `主动控制请求频率，等待 ${Math.ceil(waitMilliseconds / 1000)} 秒`
    await emit(run)
    await sleep(waitMilliseconds)
    task.status = 'running'
    run.status = 'running'
    run.cooldown = null
    await emit(run)
  }

  const paceTask = async (run, task) => {
    const key = ratePolicyKey(task)
    if (!key) return
    const interval = Math.max(0, Number(ratePolicies?.[key]?.intervalMilliseconds) || 0)
    const elapsed = nowMilliseconds() - (lastRequestAt.get(key) || 0)
    if (lastRequestAt.has(key) && elapsed < interval) {
      await waitWithVisibleCooldown(run, task, interval - elapsed, 'proactive-rate-limit')
    }
    lastRequestAt.set(key, nowMilliseconds())
  }

  const resolveEpisodeExportItems = async (run, task, assetMap) => Promise.all(
    (Array.isArray(task.request?.items) ? task.request.items : []).map(async (item) => {
      const generatedVideo = assetMap[`shot-video:${item?.shot?.id}`]
      const generatedVoice = assetMap[`line-audio:${item?.lineId}`]
      const videoAssetId = generatedVideo?.id || cleanText(item?.shot?.videoAssetId, 160)
      const voiceAssetId = generatedVoice?.id || cleanText(item?.audioAssetId, 160)
      const [videoFilePath, audioFilePath] = await Promise.all([
        videoAssetId
          ? videoResolver({ projectLocalId: run.projectLocalId, assetId: videoAssetId }).catch(() => '')
          : '',
        voiceAssetId
          ? voiceResolver({ projectLocalId: run.projectLocalId, assetId: voiceAssetId }).catch(() => '')
          : '',
      ])
      const generatedImage = assetMap[`shot:${item?.shot?.id}`]
      return {
        ...item,
        shot: {
          ...item.shot,
          ...(generatedImage?.mediaUrl || generatedImage?.dataUrl
            ? { image: generatedImage.mediaUrl || generatedImage.dataUrl }
            : {}),
          ...(videoAssetId ? { videoAssetId } : {}),
        },
        ...(videoFilePath ? { videoFilePath } : {}),
        ...(audioFilePath ? { audioFilePath } : {}),
        audioLine: {
          audio: cleanText(item?.audio, 12 * 1024 * 1024),
          audioAssetId: voiceAssetId,
          audioStatus: voiceAssetId || item?.audio ? '已完成' : '未生成',
        },
      }
    }),
  )

  const executeTask = async (run, task, assetMap) => {
    if (task.kind === 'voice-assignment') {
      return { ok: true, assignment: clone(task.request.assignment || {}) }
    }

    if (imageTaskKinds.has(task.kind)) {
      const result = await imageGenerator({
        ...generationOptions,
        workspaceRoot,
        request: {
          ...task.request,
          references: mergeReferences(task, assetMap),
          confirmed: true,
        },
      })
      if (!result?.ok || !result.image) return result || { ok: false, error: '图片生成没有返回结果' }
      assetMap[`${task.entityType}:${task.entityId}`] = result.image
      return {
        ok: true,
        image: result.image,
        model: result.model,
        requestId: result.requestId,
        usage: result.usage || null,
      }
    }

    if (task.kind === 'voice-line') {
      const result = await voiceGenerator({
        ...generationOptions,
        voiceMediaRoot,
        projectLocalId: run.projectLocalId,
        request: {
          ...task.request,
          confirmed: true,
        },
      })
      if (!result?.ok || !result.asset) return result || { ok: false, error: '配音生成没有返回本地音频' }
      assetMap[`line-audio:${task.entityId}`] = result.asset
      return {
        ok: true,
        asset: result.asset,
        mediaUrl: result.mediaUrl,
        model: result.model,
        requestId: result.requestId,
        usage: result.usage || null,
      }
    }

    if (task.kind === 'episode-export') {
      const items = await resolveEpisodeExportItems(run, task, assetMap)
      const result = await episodeExporter({
        ...task.request,
        projectLocalId: run.projectLocalId,
        items,
        onProgress: (progress) => {
          task.localPhase = cleanText(progress?.phase, 60)
          task.localMessage = cleanText(progress?.message, 180)
          task.exportPercent = Math.min(100, Math.max(0, Number(progress?.percent) || 0))
          emit(run).catch(() => undefined)
        },
      })
      return result?.ok ? result : result || { ok: false, error: '自动成片没有返回结果' }
    }

    const firstFrame = assetMap[task.request.firstFrameKey] || task.request.firstFrame
    if (!firstFrame?.assetId && !firstFrame?.dataUrl) {
      return { ok: false, error: '当前镜头缺少可用的真实首帧' }
    }
    const lastFrame = (task.request.lastFrameKey && assetMap[task.request.lastFrameKey])
      || task.request.lastFrame
      || firstFrame
    if (!lastFrame?.assetId && !lastFrame?.dataUrl) {
      return { ok: false, error: '当前镜头缺少可用的真实尾帧' }
    }
    const videoResult = await videoGenerator({
      ...generationOptions,
      request: {
        ...task.request,
        firstFrame,
        lastFrame,
        confirmed: true,
      },
      workspaceRoot,
      temporaryRoot,
      existingTaskId: task.providerTaskId || '',
      onTaskSubmitted: async ({ taskId, requestId, model }) => {
        task.providerTaskId = taskId
        task.providerRequestId = requestId
        task.model = model
        task.pollStatus = 'PENDING'
        await emit(run)
      },
      onPoll: async ({ taskStatus, elapsedMilliseconds }) => {
        task.pollStatus = taskStatus
        task.elapsedMilliseconds = elapsedMilliseconds
        await emit(run)
      },
    })
    if (!videoResult?.ok || !videoResult.downloadPath) return videoResult || { ok: false, error: '视频生成没有返回本地文件' }
    try {
      const prepared = await videoPreparer({
        sourcePath: videoResult.downloadPath,
        projectLocalId: run.projectLocalId,
        mediaRoot: shotVideoMediaRoot,
        ffmpegPath,
        assetId: `shot-video-${Date.now().toString(36)}-${randomUUID().slice(0, 10)}`,
        onProgress: (progress) => {
          task.localPhase = cleanText(progress?.phase, 60)
          task.localMessage = cleanText(progress?.message, 180)
          emit(run).catch(() => undefined)
        },
      })
      if (!prepared?.ok || !prepared.asset) return { ok: false, error: '视频本地托管失败' }
      prepared.asset.source = 'bailian-download'
      assetMap[`shot-video:${task.entityId}`] = prepared.asset
      return {
        ok: true,
        asset: prepared.asset,
        mediaUrl: prepared.mediaUrl,
        taskId: videoResult.taskId,
        requestId: videoResult.requestId,
        model: videoResult.model,
        usage: videoResult.usage || null,
      }
    } finally {
      await rm(videoResult.downloadPath, { force: true }).catch(() => undefined)
    }
  }

  const runQueue = async (run) => {
    const assetMap = buildAssetMap(run)
    run.status = 'running'
    run.pauseRequested = false
    run.stopRequested = false
    run.stopReason = ''
    await emit(run)
    try {
      for (const task of run.tasks) {
        if (task.status !== 'pending') continue
        if (run.stopRequested) break
        if (run.pauseRequested) {
          run.status = 'paused'
          break
        }
        task.status = 'running'
        task.startedAt ||= now()
        task.completedAt = ''
        task.error = ''
        task.providerCode = ''
        run.currentTaskId = task.id
        let result
        while (true) {
          task.attempt += 1
          await emit(run)
          await paceTask(run, task)
          result = await executeTask(run, task, assetMap)
          const policy = ratePolicies?.[ratePolicyKey(task)] || {}
          const maximumAttempts = Math.max(1, Number(policy.maximumAttempts) || 1)
          if (!isRateLimitFailure(result) || task.attempt >= maximumAttempts) break
          task.error = cleanText(result?.error || '服务限流')
          task.providerCode = cleanText(result?.providerCode, 120)
          await waitWithVisibleCooldown(
            run,
            task,
            Math.max(0, Number(policy.cooldownMilliseconds) || 0),
            'rate-limit',
          )
          if (run.stopRequested || run.pauseRequested) break
        }
        task.completedAt = now()
        task.pollStatus = cleanText(result?.taskStatus || task.pollStatus, 60)
        if (result?.ok) {
          task.status = 'succeeded'
          task.result = result
        } else {
          task.status = 'failed'
          task.error = cleanText(result?.error || '任务执行失败')
          task.providerCode = cleanText(result?.providerCode, 120)
          task.result = null
          if (isZeroCostStopFailure(result)) {
            run.stopRequested = true
            run.stopReason = 'free-tier-or-billing'
            run.status = 'quota-stopped'
          }
        }
        run.currentTaskId = ''
        await emit(run)
        if (run.stopRequested || run.pauseRequested) break
      }
      if (run.status === 'quota-stopped') return
      if (run.stopRequested) run.status = 'stopped'
      else if (run.pauseRequested) run.status = 'paused'
      else {
        const remaining = run.tasks.some((task) => task.status === 'pending')
        run.status = remaining ? 'paused' : run.tasks.some((task) => task.status === 'failed') ? 'completed-with-errors' : 'completed'
        if (!remaining) run.completedAt = now()
      }
      run.currentTaskId = ''
      await emit(run)
    } catch (error) {
      run.status = 'failed'
      run.currentTaskId = ''
      run.error = cleanText(error instanceof Error ? error.message : '一键制作队列异常')
      await emit(run)
    } finally {
      activeProjectId = ''
      activePromise = null
    }
  }

  const launch = (run) => {
    if (activePromise) throw new Error(`已有项目正在一键制作：${activeProjectId}`)
    activeProjectId = run.projectLocalId
    activePromise = runQueue(run)
  }

  return {
    async start({ plan, attestation } = {}) {
      validateAttestation(attestation)
      if (generationOptions.allowPaidGeneration !== true) throw new Error('真实生成已被环境锁定；未发送请求')
      const projectLocalId = normalizeProjectId(plan?.projectLocalId)
      if (activePromise) throw new Error(`已有项目正在一键制作：${activeProjectId}`)
      const tasks = Array.isArray(plan?.tasks) ? plan.tasks.map(sanitizePlanTask) : []
      if (!tasks.length) {
        return {
          ok: true,
          nothingToDo: true,
          run: {
            projectLocalId,
            projectName: cleanText(plan?.projectName, 180),
            status: 'completed',
            tasks: [],
            summary: summarize([]),
          },
        }
      }
      const run = {
        version: 2,
        id: `run-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        projectLocalId,
        projectName: cleanText(plan?.projectName, 180),
        status: 'queued',
        modelSignature: attestation.modelSignature,
        attestedAt: attestation.confirmedAt,
        createdAt: now(),
        updatedAt: now(),
        completedAt: '',
        currentTaskId: '',
        pauseRequested: false,
        stopRequested: false,
        stopReason: '',
        cooldown: null,
        error: '',
        tasks,
      }
      runs.set(projectLocalId, run)
      await emit(run)
      launch(run)
      return { ok: true, run: toPublicRun(run) }
    },

    async status({ projectLocalId } = {}) {
      const run = await load(projectLocalId)
      return run ? { ok: true, run: toPublicRun(run) } : { ok: true, missing: true, run: null }
    },

    async pause({ projectLocalId } = {}) {
      const run = await load(projectLocalId)
      if (!run) return { ok: false, error: '没有可暂停的一键制作记录' }
      if (!['running', 'cooldown'].includes(run.status)) return { ok: false, error: '当前队列不在运行中' }
      run.pauseRequested = true
      run.status = 'pausing'
      await emit(run)
      return { ok: true, run: toPublicRun(run) }
    },

    async stop({ projectLocalId } = {}) {
      const run = await load(projectLocalId)
      if (!run) return { ok: false, error: '没有可停止的一键制作记录' }
      if (!['running', 'cooldown', 'pausing', 'paused', 'interrupted'].includes(run.status)) {
        return { ok: false, error: '当前队列不需要停止' }
      }
      run.stopRequested = true
      run.pauseRequested = false
      if (run.status === 'paused' || run.status === 'interrupted') run.status = 'stopped'
      else run.status = 'stopping'
      await emit(run)
      return { ok: true, run: toPublicRun(run) }
    },

    async resume({ projectLocalId } = {}) {
      if (generationOptions.allowPaidGeneration !== true) throw new Error('真实生成已被环境锁定；未发送请求')
      const run = await load(projectLocalId)
      if (!run) return { ok: false, error: '没有可继续的一键制作记录' }
      if (activePromise) return { ok: false, error: `已有项目正在一键制作：${activeProjectId}` }
      for (const task of run.tasks) {
        if (task.status === 'failed') {
          task.status = 'pending'
          task.error = ''
          task.providerCode = ''
        }
      }
      run.status = 'queued'
      run.pauseRequested = false
      run.stopRequested = false
      run.stopReason = ''
      run.error = ''
      await emit(run)
      launch(run)
      return { ok: true, run: toPublicRun(run) }
    },

    async waitForIdle() {
      await activePromise
    },
  }
}
