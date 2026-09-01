import { BaseProviderSelector } from './baseProvider.js'

class ImageProviderSelector extends BaseProviderSelector {
  constructor() {
    super('image')
  }

  async dryRunEntity(activeProviderId, payload = {}) {
    const provider = this.getActive(activeProviderId)
    if (!provider?.dryRunEntity) {
      return { ok: false, error: '当前 Provider 不支持设定预检' }
    }
    return provider.dryRunEntity(payload)
  }

  async generateEntity(activeProviderId, payload = {}) {
    const provider = this.getActive(activeProviderId)
    if (!provider?.generateEntity) {
      return { ok: false, error: '当前 Provider 不支持设定生成' }
    }
    return provider.generateEntity(payload)
  }

  async listImages(activeProviderId, payload = {}) {
    const provider = this.getActive(activeProviderId)
    if (!provider?.listImages) {
      return { ok: false, assets: [], error: '当前 Provider 不支持图片列表' }
    }
    return provider.listImages(payload)
  }
}

export const imageProviderSelector = new ImageProviderSelector()
