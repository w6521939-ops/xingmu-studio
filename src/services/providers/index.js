export { BaseProvider, BaseProviderSelector } from './baseProvider.js'
export {
  pricingTable,
  resolvePricing,
  estimateScriptCost,
  estimateImageCost,
  estimateVoiceCost,
  estimateVideoCost,
} from './costTable.js'

export { scriptProviderSelector } from './scriptProviderSelector.js'
export { imageProviderSelector } from './imageProviderSelector.js'
export { voiceProviderSelector } from './voiceProviderSelector.js'
export { videoProviderSelector } from './videoProviderSelector.js'

export { BailianScriptProvider } from './implementations/bailianScriptProvider.js'
export { BailianImageProvider } from './implementations/bailianImageProvider.js'
export { BailianVoiceProvider } from './implementations/bailianVoiceProvider.js'
export { BailianVideoProvider } from './implementations/bailianVideoProvider.js'

import { scriptProviderSelector } from './scriptProviderSelector.js'
import { imageProviderSelector } from './imageProviderSelector.js'
import { voiceProviderSelector } from './voiceProviderSelector.js'
import { videoProviderSelector } from './videoProviderSelector.js'
import { BailianScriptProvider } from './implementations/bailianScriptProvider.js'
import { BailianImageProvider } from './implementations/bailianImageProvider.js'
import { BailianVoiceProvider } from './implementations/bailianVoiceProvider.js'
import { BailianVideoProvider } from './implementations/bailianVideoProvider.js'

let initialized = false

export function initializeProviders() {
  if (initialized) return
  initialized = true

  scriptProviderSelector.register(new BailianScriptProvider())
  imageProviderSelector.register(new BailianImageProvider())
  voiceProviderSelector.register(new BailianVoiceProvider())
  videoProviderSelector.register(new BailianVideoProvider())
}

export const selectors = Object.freeze({
  script: scriptProviderSelector,
  image: imageProviderSelector,
  voice: voiceProviderSelector,
  video: videoProviderSelector,
})

export const providerCapabilityIds = Object.freeze(['script', 'image', 'voice', 'video'])

export const getProviderSelector = (capability) => selectors[capability]

export const estimateTaskCost = (task) => {
  if (!task?.kind) return null
  const providerId = 'bailian'

  switch (task.kind) {
    case 'character-image':
    case 'scene-image':
    case 'storyboard-image': {
      const referenceCount = Array.isArray(task.request?.references)
        ? task.request.references.filter((r) => r.dataUrl || r.assetId).length
        : 0
      return estimateImageCost(providerId, referenceCount)
    }
    case 'voice-line': {
      const textLength = String(task.request?.text || '').length || 30
      return estimateVoiceCost(providerId, textLength)
    }
    case 'shot-video': {
      const duration = Number(task.request?.duration) || 5
      return estimateVideoCost(providerId, duration)
    }
    default:
      return null
  }
}

export const estimatePlanCost = (plan = {}) => {
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
  const items = []
  let totalCost = 0
  let hasEstimates = false

  for (const task of tasks) {
    const cost = estimateTaskCost(task)
    if (cost) {
      hasEstimates = true
      totalCost += cost.estimatedCost || 0
      items.push({
        kind: task.kind,
        label: task.label || task.kind,
        ...cost,
      })
    }
  }

  return {
    hasEstimates,
    items,
    totalCost: Math.round(totalCost * 10000) / 10000,
    currency: 'CNY',
    warning: '实际费用以百炼账单为准；请确认已开启"免费额度用完即停"',
  }
}
