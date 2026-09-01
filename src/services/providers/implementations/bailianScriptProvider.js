import { BaseProvider } from '../baseProvider.js'
import { estimateScriptCost } from '../costTable.js'

export class BailianScriptProvider extends BaseProvider {
  constructor() {
    super('script', {
      providerId: 'bailian',
      displayName: '阿里云百炼',
      model: 'qwen3.7-plus',
    })
  }

  getCapabilities() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return {
      ...super.getCapabilities(),
      configured: Boolean(desktop?.getBailianStatus),
      supportsDryRun: Boolean(desktop?.getBailianScriptDryRun),
      supportsGenerate: Boolean(desktop?.generateBailianScript),
    }
  }

  async probe() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.probeBailianCapability) {
      return { ok: false, error: '当前环境没有百炼安全桥接能力' }
    }
    return desktop.probeBailianCapability('script')
  }

  async dryRun(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.getBailianScriptDryRun) {
      return { ok: false, error: '当前环境没有百炼剧本安全桥接能力' }
    }
    const result = await desktop.getBailianScriptDryRun(payload)
    if (result?.ok) {
      result.costEstimate = this.estimateCost(payload)
    }
    return result
  }

  async generate(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateBailianScript) {
      return { ok: false, error: '当前环境没有百炼剧本生成桥接能力' }
    }
    return desktop.generateBailianScript(payload)
  }

  estimateCost(payload = {}) {
    const themeLength = String(payload?.theme || '').length || 500
    return estimateScriptCost('bailian', themeLength)
  }
}
