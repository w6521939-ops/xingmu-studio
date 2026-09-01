import { BaseProvider } from '../baseProvider.js'
import { estimateVideoCost } from '../costTable.js'

export class BailianVideoProvider extends BaseProvider {
  constructor() {
    super('video', {
      providerId: 'bailian',
      displayName: '阿里云百炼',
      model: 'wan2.7-i2v-2026-04-25',
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
    return desktop.probeBailianCapability('video')
  }

  async dryRun(payload = {}) {
    const duration = Number(payload?.duration) || 5
    return {
      ok: true,
      dryRun: true,
      model: this.model,
      resolution: payload?.resolution || '720P',
      duration,
      createsPaidTask: false,
      costEstimate: this.estimateCost(payload),
      billingNotice: '按次计费；免费额度与实际账单以百炼控制台为准',
    }
  }

  async generate(payload = {}) {
    return {
      ok: false,
      error: '视频生成通过一键制作流程执行，不支持单独调用',
      hint: '请使用一键制作的镜头视频阶段',
    }
  }

  estimateCost(payload = {}) {
    const duration = Number(payload?.duration) || 5
    return estimateVideoCost('bailian', duration)
  }
}
