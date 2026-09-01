const { contextBridge } = require('electron')
const { readFileSync } = require('node:fs')
const { pathToFileURL } = require('node:url')

const snapshot = JSON.parse(readFileSync(process.env.MANJU_TEST_SNAPSHOT_PATH, 'utf8'))
const outputPath = process.env.MANJU_TOUR_OUTPUT_PATH || 'D:\\演示输出\\星幕工坊-教学演示.mp4'
const listeners = new Set()
let run = null
let previewRequests = 0

const summarize = (tasks) => ({
  total: tasks.length,
  pending: tasks.filter((task) => task.status === 'pending').length,
  running: tasks.filter((task) => task.status === 'running').length,
  succeeded: tasks.filter((task) => task.status === 'succeeded').length,
  failed: tasks.filter((task) => task.status === 'failed').length,
  skipped: tasks.filter((task) => task.status === 'skipped').length,
  completed: tasks.filter((task) => ['succeeded', 'failed', 'skipped'].includes(task.status)).length,
})
const clone = (value) => structuredClone(value)
const emit = () => {
  run.summary = summarize(run.tasks)
  run.updatedAt = new Date().toISOString()
  for (const listener of listeners) listener(clone(run))
}
const setTaskStatuses = (completed, active = -1) => {
  run.tasks = run.tasks.map((task, index) => ({
    ...task,
    status: index < completed ? 'succeeded' : index === active ? 'running' : 'pending',
    attempt: index <= active ? 1 : task.attempt || 0,
    ...(index === active ? { localMessage: task.kind === 'shot-video' ? '正在等待百炼视频任务完成' : '正在生成并保存到本机' } : {}),
  }))
  run.currentTaskId = active >= 0 ? run.tasks[active]?.id || '' : ''
}
const setPhase = (phase) => {
  if (!run) return false
  if (phase === 'running') {
    const active = Math.min(5, Math.max(0, run.tasks.length - 1))
    setTaskStatuses(active, active)
    run.status = 'running'
  } else if (phase === 'paused') {
    run.status = 'paused'
    run.currentTaskId = ''
  } else if (phase === 'quota') {
    const failureIndex = Math.min(6, Math.max(0, run.tasks.length - 1))
    setTaskStatuses(failureIndex, -1)
    run.tasks[failureIndex] = {
      ...run.tasks[failureIndex],
      status: 'failed',
      error: '免费额度已用完，队列已安全停止',
      providerCode: 'AllocationQuota.FreeTierOnly',
    }
    run.status = 'quota-stopped'
    run.currentTaskId = ''
  } else if (phase === 'completed') {
    run.tasks = run.tasks.map((task) => ({
      ...task,
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      result: task.kind === 'episode-export'
        ? { ok: true, outputPath, segmentCount: snapshot.content.shots.length, resolution: task.request?.resolution || '1080x1920' }
        : task.result || { ok: true },
    }))
    run.status = 'completed'
    run.currentTaskId = ''
    run.completedAt = new Date().toISOString()
  }
  emit()
  return true
}

contextBridge.exposeInMainWorld('manjuDesktop', Object.freeze({
  getBailianStatus: async () => ({
    ok: true,
    configured: true,
    loading: false,
    keyType: 'sk',
    source: '隔离教学演示',
    apiHost: 'https://dashscope.aliyuncs.com',
    paidGenerationEnabled: process.env.MANJU_TEST_PROVIDER_LOCKED !== '1',
    capabilities: {
      script: { supported: true, model: 'qwen3.7-plus' },
      image: { supported: true, model: 'wan2.7-image-pro' },
      voice: { supported: true, model: 'qwen3-tts-flash' },
      video: { supported: true, model: 'wan2.7-i2v-2026-04-25' },
    },
  }),
  loadAutosave: async () => ({ ok: true, snapshot }),
  saveAutosave: async () => ({ ok: true, savedAt: new Date().toISOString() }),
  listRecentProjects: async () => ({ ok: true, recents: [] }),
  getOneClickProductionStatus: async () => ({ ok: true, missing: !run, run: run ? clone(run) : null }),
  startOneClickProduction: async ({ plan }) => {
    run = {
      version: 1,
      id: 'run-studio-production-tour',
      projectLocalId: plan.projectLocalId,
      projectName: plan.projectName,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentTaskId: '',
      tasks: plan.tasks.map((task) => ({ ...task, status: 'pending', attempt: 0 })),
    }
    run.summary = summarize(run.tasks)
    return { ok: true, run: clone(run) }
  },
  pauseOneClickProduction: async () => {
    setPhase('paused')
    return { ok: true, run: clone(run) }
  },
  resumeOneClickProduction: async () => {
    setPhase('running')
    return { ok: true, run: clone(run) }
  },
  stopOneClickProduction: async () => {
    run.status = 'stopped'
    run.currentTaskId = ''
    emit()
    return { ok: true, run: clone(run) }
  },
  openBailianFreeQuotaSettings: async () => ({ ok: true }),
  prepareVideoExportPreview: async (filePath) => {
    previewRequests += 1
    return filePath === outputPath
      ? { ok: true, mediaUrl: pathToFileURL(outputPath).href }
      : { ok: false, error: '成片文件不存在' }
  },
  revealVideoExport: async () => ({ ok: true }),
  onOneClickProductionProgress: (callback) => {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
}))

contextBridge.exposeInMainWorld('manjuTour', Object.freeze({
  setPhase,
  getRun: () => run ? clone(run) : null,
  getPreviewRequests: () => previewRequests,
}))
