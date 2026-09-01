import { BaseProviderSelector } from './baseProvider.js'

class VideoProviderSelector extends BaseProviderSelector {
  constructor() {
    super('video')
  }
}

export const videoProviderSelector = new VideoProviderSelector()
