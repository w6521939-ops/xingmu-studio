import { BaseProviderSelector } from './baseProvider.js'

class VoiceProviderSelector extends BaseProviderSelector {
  constructor() {
    super('voice')
  }
}

export const voiceProviderSelector = new VoiceProviderSelector()
