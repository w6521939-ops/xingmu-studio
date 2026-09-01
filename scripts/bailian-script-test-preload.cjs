const { contextBridge } = require('electron')
const script = require('./fixtures/bailian-script-response.json')

const metrics = { dryRuns: 0, generations: 0 }

contextBridge.exposeInMainWorld('manjuDesktop', Object.freeze({
  getBailianStatus: async () => ({
    ok: true,
    configured: true,
    paidGenerationEnabled: true,
    keyType: 'sk-test',
    source: '离线测试 Key',
    apiHost: 'https://dashscope.aliyuncs.com',
    capabilities: {
      script: { supported: true, model: 'qwen3.7-plus' },
      image: { supported: true, model: 'wan2.7-image-pro' },
      video: { supported: true, model: 'wan2.7-i2v-2026-04-25' },
    },
  }),
  getBailianScriptDryRun: async () => {
    metrics.dryRuns += 1
    return {
      ok: true,
      dryRun: true,
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen3.7-plus',
      responseFormat: 'json_object',
      maximumOutputTokens: 8192,
      messageCount: 2,
      createsPaidTask: false,
    }
  },
  generateBailianScript: async () => {
    metrics.generations += 1
    return { ok: true, script, model: 'qwen3.7-plus', requestId: 'offline-ui-fixture' }
  },
  getTestMetrics: () => ({ ...metrics }),
  listRecentProjects: async () => ({ ok: true, recents: [] }),
  loadAutosave: async () => ({ ok: false, missing: true }),
  saveAutosave: async () => ({ ok: true }),
  saveProject: async () => ({ ok: false, canceled: true }),
  openProject: async () => ({ ok: false, canceled: true }),
  openRecentProject: async () => ({ ok: false, canceled: true }),
}))
