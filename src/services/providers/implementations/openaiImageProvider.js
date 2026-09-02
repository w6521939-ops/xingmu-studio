import { BaseProvider } from '../baseProvider.js'
import { resolvePricing } from '../costTable.js'

export class OpenAIImageProvider extends BaseProvider {
  constructor() {
    super('image', {
      providerId: 'openai',
      displayName: 'OpenAI',
      model: 'gpt-image-2',
    })
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      configured: this._hasApiKey(),
      supportsDryRun: true,
      supportsGenerate: this._hasApiKey(),
    }
  }

  _hasApiKey() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return Boolean(desktop?.getEnv?.('OPENAI_API_KEY'))
  }

  async probe() {
    if (!this._hasApiKey()) {
      return { ok: false, error: '未配置 OPENAI_API_KEY 环境变量' }
    }
    return { ok: true, provider: 'openai', model: this.model }
  }

  async dryRun(payload = {}) {
    const referenceCount = Array.isArray(payload?.request?.references)
      ? payload.request.references.filter((r) => r.dataUrl || r.assetId).length
      : Array.isArray(payload?.references)
        ? payload.references.filter((r) => r.dataUrl || r.assetId).length
        : 0

    return {
      ok: true,
      dryRun: true,
      model: this.model,
      createsPaidTask: false,
      costEstimate: this.estimateCost(payload),
      billingNotice: '按张计费；实际费用以 OpenAI 账单为准',
      referenceCount,
    }
  }

  async generate(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateOpenAIImage) {
      return { ok: false, error: '当前环境没有 OpenAI 图片生成桥接能力' }
    }
    return desktop.generateOpenAIImage(payload)
  }

  async listImages(payload = {}) {
    return { ok: true, assets: [], note: 'OpenAI 不提供历史图片列表 API' }
  }

  estimateCost(payload = {}) {
    const pricing = resolvePricing('openai', 'image')
    if (!pricing) return null
    const referenceCount = Array.isArray(payload?.request?.references)
      ? payload.request.references.filter((r) => r.dataUrl || r.assetId).length
      : Array.isArray(payload?.references)
        ? payload.references.filter((r) => r.dataUrl || r.assetId).length
        : 0
    const baseCost = pricing.pricePerUnit
    const referenceCost = referenceCount * (pricing.referencePricePerUnit || 0)
    return {
      model: pricing.model,
      unit: pricing.unit,
      estimatedCost: Math.round((baseCost + referenceCost) * 10000) / 10000,
      referenceCost: Math.round(referenceCost * 10000) / 10000,
      referenceCount,
      currency: pricing.currency,
      note: pricing.note,
    }
  }
}
