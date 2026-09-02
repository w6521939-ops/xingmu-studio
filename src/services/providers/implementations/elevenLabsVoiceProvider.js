import { BaseProvider } from '../baseProvider.js'
import { resolvePricing } from '../costTable.js'

export class ElevenLabsVoiceProvider extends BaseProvider {
  constructor() {
    super('voice', {
      providerId: 'elevenlabs',
      displayName: 'ElevenLabs',
      model: 'eleven-multilingual-v2',
    })
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      configured: this._hasApiKey(),
      supportsGenerate: this._hasApiKey(),
      supportsMultiLanguage: true,
      supportsVoiceCloning: true,
    }
  }

  _hasApiKey() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return Boolean(desktop?.getEnv?.('ELEVENLABS_API_KEY'))
  }

  async probe() {
    if (!this._hasApiKey()) {
      return { ok: false, error: '未配置 ELEVENLABS_API_KEY 环境变量' }
    }
    return { ok: true, provider: 'elevenlabs', model: this.model }
  }

  async dryRun(payload = {}) {
    const text = String(payload?.text || '')
    return {
      ok: true,
      dryRun: true,
      voiceId: payload?.voiceId || '',
      textLength: text.length,
      createsPaidTask: false,
      costEstimate: this.estimateCost(payload),
      billingNotice: '按字符计费；实际费用以 ElevenLabs 账单为准',
    }
  }

  async generate(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateElevenLabsVoice) {
      return {
        ok: false,
        error: '配音生成通过一键制作流程执行，不支持单独调用',
        hint: '请使用一键制作或配音页的生成入口，选择 ElevenLabs 作为配音 Provider',
      }
    }
    return desktop.generateElevenLabsVoice(payload)
  }

  estimateCost(payload = {}) {
    const pricing = resolvePricing('elevenlabs', 'voice')
    if (!pricing) return null
    const textLength = String(payload?.text || '').length || 30
    const characters = Math.max(1, textLength)
    return {
      model: pricing.model,
      unit: pricing.unit,
      characters,
      estimatedCost: Math.round(characters * pricing.pricePerUnit * 10000) / 10000,
      currency: pricing.currency,
      note: pricing.note,
    }
  }
}
