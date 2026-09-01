import {
  initializeProviders,
  scriptProviderSelector,
  imageProviderSelector,
  voiceProviderSelector,
  videoProviderSelector,
  estimatePlanCost,
} from './providers/index.js'

const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

initializeProviders()

export { estimatePlanCost }

export const providerCapabilities = [
  { id: 'script', label: '剧本服务', action: '整理剧本' },
  { id: 'image', label: '图片服务', action: '生成画面' },
  { id: 'voice', label: '配音服务', action: '生成配音' },
  { id: 'video', label: '视频服务', action: '生成视频' },
]

export const bailianProviderName = '阿里云百炼'

const bailianDefaults = {
  script: { model: 'qwen3.7-plus', endpointPath: '/compatible-mode/v1' },
  image: { model: 'wan2.7-image-pro', endpointPath: '/api/v1' },
  voice: { model: 'qwen3-tts-flash', endpointPath: '/api/v1' },
  video: { model: 'wan2.7-i2v-2026-04-25', endpointPath: '/api/v1' },
}

const selectorMap = {
  script: scriptProviderSelector,
  image: imageProviderSelector,
  voice: voiceProviderSelector,
  video: videoProviderSelector,
}

class MockProviderAdapter {
  constructor(capability) {
    this.capability = capability
  }

  async execute(payload = {}) {
    await delay(700)
    return {
      capability: this.capability,
      mode: 'mock',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
      payload,
    }
  }

  async test(config = {}) {
    await delay(450)
    if (config.provider === '演示适配器') {
      return { ok: true, message: '演示适配器可用，不会产生网络请求' }
    }

    if (!config.provider || !config.endpoint || !config.apiKey) {
      return { ok: false, message: '请先填写服务商、服务地址和 API Key' }
    }

    return { ok: false, message: '真实接口尚未启用，当前仅保留连接契约' }
  }
}

class BailianProviderAdapter {
  constructor(capability) {
    this.capability = capability
  }

  async status() {
    if (!window.manjuDesktop?.getBailianStatus) {
      return { ok: false, configured: false, error: '当前环境没有百炼安全桥接能力' }
    }
    return window.manjuDesktop.getBailianStatus()
  }

  async test() {
    if (!window.manjuDesktop?.probeBailianCapability) {
      return { ok: false, message: '当前环境没有百炼安全桥接能力' }
    }
    const result = await window.manjuDesktop.probeBailianCapability(this.capability)
    return {
      ...result,
      message: result.ok ? result.message : result.error || '百炼鉴权探测失败',
    }
  }

  async dryRun(payload = {}) {
    if (this.capability !== 'script') return { ok: false, error: '当前仅开放百炼剧本生成' }
    if (!window.manjuDesktop?.getBailianScriptDryRun) {
      return { ok: false, error: '当前环境没有百炼剧本安全桥接能力' }
    }
    return window.manjuDesktop.getBailianScriptDryRun(payload)
  }

  async execute(payload = {}) {
    if (this.capability !== 'script') return { ok: false, error: '当前仅开放百炼剧本生成' }
    if (!window.manjuDesktop?.generateBailianScript) {
      return { ok: false, error: '当前环境没有百炼剧本生成桥接能力' }
    }
    return window.manjuDesktop.generateBailianScript(payload)
  }
}

class ProviderRegistry {
  constructor() {
    this.adapters = new Map(
      providerCapabilities.map(({ id }) => [id, {
        mock: new MockProviderAdapter(id),
        bailian: new BailianProviderAdapter(id),
      }]),
    )
  }

  getSelector(capability) {
    return selectorMap[capability]
  }

  execute(capability, payload, config) {
    if (config?.provider === bailianProviderName) {
      return scriptProviderSelector.generate('bailian', payload)
        || imageProviderSelector.generate('bailian', payload)
        || voiceProviderSelector.generate('bailian', payload)
        || videoProviderSelector.generate('bailian', payload)
        || this.adapters.get(capability)?.bailian.execute(payload)
        || Promise.resolve({ ok: false, error: `不支持的能力域: ${capability}` })
    }
    const adapters = this.adapters.get(capability)
    if (!adapters) throw new Error(`Unknown provider capability: ${capability}`)
    return adapters.mock.execute(payload)
  }

  dryRunScript(payload) {
    return scriptProviderSelector.dryRun('bailian', payload)
  }

  dryRunEntity(payload) {
    return imageProviderSelector.dryRunEntity('bailian', payload)
  }

  generateEntity(payload) {
    return imageProviderSelector.generateEntity('bailian', payload)
  }

  dryRunImage(payload) {
    return imageProviderSelector.dryRun('bailian', payload)
  }

  generateImage(payload) {
    return imageProviderSelector.generate('bailian', payload)
  }

  listImages(payload) {
    return imageProviderSelector.listImages('bailian', payload)
  }

  test(capability, config) {
    if (config?.provider === bailianProviderName) {
      const selector = selectorMap[capability]
      if (selector) return selector.probe('bailian')
    }
    const adapters = this.adapters.get(capability)
    if (!adapters) throw new Error(`Unknown provider capability: ${capability}`)
    return adapters.mock.test(config)
  }

  getBailianStatus() {
    if (!window.manjuDesktop?.getBailianStatus) {
      return Promise.resolve({ ok: false, configured: false, error: '当前环境没有百炼安全桥接能力' })
    }
    return window.manjuDesktop.getBailianStatus()
  }

  estimateCost(capability, payload = {}) {
    const selector = selectorMap[capability]
    if (!selector) return null
    const provider = selector.getActive('bailian')
    if (!provider) return null
    return provider.estimateCost(payload)
  }
}

export const providerRegistry = new ProviderRegistry()

export const createDefaultProviderSettings = () => Object.fromEntries(
  providerCapabilities.map(({ id }) => [id, {
    provider: '演示适配器',
    model: 'mock-v1',
    endpoint: '',
    apiKey: '',
    status: '未配置',
  }]),
)

export const applyBailianStatusToSettings = (settings, status) => {
  if (!status?.ok || !status.configured) return settings
  const apiHost = String(status.apiHost || 'https://dashscope.aliyuncs.com').replace(/\/$/u, '')
  return Object.fromEntries(Object.entries(settings).map(([capability, config]) => {
    const defaults = bailianDefaults[capability]
    if (!defaults || status.capabilities?.[capability]?.supported !== true) return [capability, config]
    return [capability, {
      ...config,
      provider: bailianProviderName,
      model: status.capabilities[capability].model || defaults.model,
      endpoint: `${apiHost}${defaults.endpointPath}`,
      apiKey: '',
      status: '本地 Key 已接入',
    }]
  }))
}
