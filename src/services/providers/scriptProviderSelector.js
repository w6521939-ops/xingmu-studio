import { BaseProviderSelector } from './baseProvider.js'

class ScriptProviderSelector extends BaseProviderSelector {
  constructor() {
    super('script')
  }
}

export const scriptProviderSelector = new ScriptProviderSelector()
