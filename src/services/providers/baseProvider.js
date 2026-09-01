export class BaseProvider {
  constructor(capability, config = {}) {
    this.capability = capability
    this.providerId = config.providerId || 'unknown'
    this.displayName = config.displayName || '未命名 Provider'
    this.model = config.model || ''
    this.configured = false
  }

  async probe() {
    throw new Error(`${this.constructor.name}.probe() 未实现`)
  }

  async dryRun(payload = {}) {
    throw new Error(`${this.constructor.name}.dryRun() 未实现`)
  }

  async generate(payload = {}) {
    throw new Error(`${this.constructor.name}.generate() 未实现`)
  }

  getCapabilities() {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      capability: this.capability,
      model: this.model,
      configured: this.configured,
    }
  }

  estimateCost() {
    return null
  }
}

export class BaseProviderSelector {
  constructor(capability) {
    this.capability = capability
    this.providers = new Map()
  }

  register(provider) {
    if (!provider || provider.capability !== this.capability) {
      throw new Error(`Provider 能力域不匹配：期望 ${this.capability}`)
    }
    this.providers.set(provider.providerId, provider)
  }

  get(providerId) {
    return this.providers.get(providerId)
  }

  getActive(activeProviderId) {
    return this.providers.get(activeProviderId) || null
  }

  list() {
    return Array.from(this.providers.values())
  }

  listAvailable() {
    return this.list().filter((provider) => provider.configured)
  }

  async probe(activeProviderId) {
    const provider = this.getActive(activeProviderId)
    if (!provider) return { ok: false, error: `没有活跃的 ${this.capability} Provider` }
    return provider.probe()
  }

  async dryRun(activeProviderId, payload = {}) {
    const provider = this.getActive(activeProviderId)
    if (!provider) return { ok: false, error: `没有活跃的 ${this.capability} Provider` }
    return provider.dryRun(payload)
  }

  async generate(activeProviderId, payload = {}) {
    const provider = this.getActive(activeProviderId)
    if (!provider) return { ok: false, error: `没有活跃的 ${this.capability} Provider` }
    return provider.generate(payload)
  }
}
