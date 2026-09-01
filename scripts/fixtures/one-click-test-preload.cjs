const { contextBridge } = require('electron')
const { readFileSync } = require('node:fs')

const snapshot = JSON.parse(readFileSync(process.env.MANJU_TEST_SNAPSHOT_PATH, 'utf8'))

const summarize = (tasks) => ({
  total: tasks.length,
  pending: tasks.length,
  running: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  completed: 0,
})

contextBridge.exposeInMainWorld('manjuDesktop', Object.freeze({
  getBailianStatus: async () => ({
    ok: true,
    configured: true,
    loading: false,
    keyType: 'sk',
    source: '隔离 UI 测试',
    apiHost: 'https://dashscope.aliyuncs.com',
    paidGenerationEnabled: true,
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
  getOneClickProductionStatus: async () => ({ ok: true, missing: true, run: null }),
  startOneClickProduction: async ({ plan }) => ({
    ok: true,
    run: {
      version: 1,
      id: 'run-isolated-ui-test',
      projectLocalId: plan.projectLocalId,
      projectName: plan.projectName,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentTaskId: '',
      tasks: plan.tasks,
      summary: summarize(plan.tasks),
    },
  }),
  pauseOneClickProduction: async () => ({ ok: false, error: '隔离 UI 测试未运行真实队列' }),
  resumeOneClickProduction: async () => ({ ok: false, error: '隔离 UI 测试未运行真实队列' }),
  stopOneClickProduction: async () => ({ ok: true }),
  openBailianFreeQuotaSettings: async () => ({
    ok: true,
    url: 'https://bailian.console.aliyun.com/cn-beijing/?tab=costing-balance',
  }),
  onOneClickProductionProgress: () => undefined,
}))
