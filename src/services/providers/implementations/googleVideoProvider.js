import { BaseProvider } from '../baseProvider.js'
import { resolvePricing } from '../costTable.js'

export class GoogleVideoProvider extends BaseProvider {
  constructor() {
    super('video', {
      providerId: 'google-veo',
      displayName: 'Google Veo 3',
      model: 'veo-3.0-generate-preview',
    })
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      configured: this._hasApiKey(),
      supportsGenerate: this._hasApiKey(),
      supportsMultiShot: true,
      maxDurationSeconds: 8,
      maxResolution: '1080p',
    }
  }

  _hasApiKey() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return Boolean(desktop?.getEnv?.('GOOGLE_API_KEY') || desktop?.getEnv?.('GEMINI_API_KEY'))
  }

  async probe() {
    if (!this._hasApiKey()) {
      return { ok: false, error: '未配置 GOOGLE_API_KEY 或 GEMINI_API_KEY 环境变量' }
    }
    return { ok: true, provider: 'google-veo', model: this.model }
  }

  async dryRun(payload = {}) {
    const duration = Math.min(8, Number(payload?.duration) || 5)
    return {
      ok: true,
      dryRun: true,
      model: this.model,
      resolution: payload?.resolution || '1080p',
      duration,
      createsPaidTask: false,
      costEstimate: this.estimateCost(payload),
      billingNotice: '按秒计费；实际费用以 Google Cloud 账单为准',
    }
  }

  async generate(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateGoogleVideo) {
      return {
        ok: false,
        error: '视频生成通过一键制作流程执行，不支持单独调用',
        hint: '请使用一键制作的镜头视频阶段，选择 Google Veo 作为视频 Provider',
      }
    }
    return desktop.generateGoogleVideo(payload)
  }

  estimateCost(payload = {}) {
    const pricing = resolvePricing('google-veo', 'video')
    if (!pricing) return null
    const duration = Math.min(8, Number(payload?.duration) || 5)
    const cost = duration * pricing.pricePerSecond
    return {
      model: pricing.model,
      unit: pricing.unit,
      durationSeconds: duration,
      estimatedCost: Math.round(cost * 10000) / 10000,
      currency: pricing.currency,
      note: pricing.note,
    }
  }
}
