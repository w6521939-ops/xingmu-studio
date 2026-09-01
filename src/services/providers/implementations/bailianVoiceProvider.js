import { BaseProvider } from '../baseProvider.js'
import { estimateVoiceCost } from '../costTable.js'

export class BailianVoiceProvider extends BaseProvider {
  constructor() {
    super('voice', {
      providerId: 'bailian',
      displayName: '阿里云百炼',
      model: 'qwen3-tts-flash',
    })
  }

  getCapabilities() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return {
      ...super.getCapabilities(),
      configured: Boolean(desktop?.getBailianStatus),
      supportsGenerate: true,
    }
  }

  async probe() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.probeBailianCapability) {
      return { ok: false, error: '当前环境没有百炼安全桥接能力' }
    }
    return desktop.probeBailianCapability('voice')
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
      billingNotice: '按字符计费；免费额度与实际账单以百炼控制台为准',
    }
  }

  async generate(payload = {}) {
    return {
      ok: false,
      error: '配音生成通过一键制作流程执行，不支持单独调用',
      hint: '请使用一键制作或配音页的生成入口',
    }
  }

  estimateCost(payload = {}) {
    const textLength = String(payload?.text || '').length || 30
    return estimateVoiceCost('bailian', textLength)
  }
}
