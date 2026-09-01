import { BaseProvider } from '../baseProvider.js'
import { estimateImageCost } from '../costTable.js'

export class BailianImageProvider extends BaseProvider {
  constructor() {
    super('image', {
      providerId: 'bailian',
      displayName: '阿里云百炼',
      model: 'wan2.7-image-pro',
    })
  }

  getCapabilities() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    return {
      ...super.getCapabilities(),
      configured: Boolean(desktop?.getBailianStatus),
      supportsDryRun: Boolean(desktop?.getBailianImageDryRun),
      supportsGenerate: Boolean(desktop?.generateBailianImage),
      supportsEntityDryRun: Boolean(desktop?.getBailianEntityDryRun),
      supportsEntityGenerate: Boolean(desktop?.generateBailianEntity),
      supportsListImages: Boolean(desktop?.listBailianImages),
    }
  }

  async probe() {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.probeBailianCapability) {
      return { ok: false, error: '当前环境没有百炼安全桥接能力' }
    }
    return desktop.probeBailianCapability('image')
  }

  async dryRun(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.getBailianImageDryRun) {
      return { ok: false, error: '当前环境没有百炼图片安全桥接能力' }
    }
    const result = await desktop.getBailianImageDryRun(payload)
    if (result?.ok) {
      result.costEstimate = this.estimateCost(payload)
    }
    return result
  }

  async generate(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateBailianImage) {
      return { ok: false, error: '当前环境没有百炼图片生成桥接能力' }
    }
    return desktop.generateBailianImage(payload)
  }

  async dryRunEntity(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.getBailianEntityDryRun) {
      return { ok: false, error: '当前环境没有百炼设定安全桥接能力' }
    }
    const result = await desktop.getBailianEntityDryRun(payload)
    if (result?.ok) {
      result.costEstimate = this.estimateCost(payload)
    }
    return result
  }

  async generateEntity(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.generateBailianEntity) {
      return { ok: false, error: '当前环境没有百炼设定生成桥接能力' }
    }
    return desktop.generateBailianEntity(payload)
  }

  async listImages(payload = {}) {
    const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
    if (!desktop?.listBailianImages) {
      return { ok: false, assets: [], error: '当前环境没有本地生成图片恢复能力' }
    }
    return desktop.listBailianImages(payload)
  }

  estimateCost(payload = {}) {
    const referenceCount = Array.isArray(payload?.request?.references)
      ? payload.request.references.filter((r) => r.dataUrl || r.assetId).length
      : Array.isArray(payload?.references)
        ? payload.references.filter((r) => r.dataUrl || r.assetId).length
        : 0
    return estimateImageCost('bailian', referenceCount)
  }
}
