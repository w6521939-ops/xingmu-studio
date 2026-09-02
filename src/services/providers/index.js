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
export { OpenAIImageProvider } from './implementations/openaiImageProvider.js'
export { GoogleVideoProvider } from './implementations/googleVideoProvider.js'
export { ElevenLabsVoiceProvider } from './implementations/elevenLabsVoiceProvider.js'

import { scriptProviderSelector } from './scriptProviderSelector.js'
import { imageProviderSelector } from './imageProviderSelector.js'
import { voiceProviderSelector } from './voiceProviderSelector.js'
import { videoProviderSelector } from './videoProviderSelector.js'
import { BailianScriptProvider } from './implementations/bailianScriptProvider.js'
import { BailianImageProvider } from './implementations/bailianImageProvider.js'
import { BailianVoiceProvider } from './implementations/bailianVoiceProvider.js'
import { BailianVideoProvider } from './implementations/bailianVideoProvider.js'
import { OpenAIImageProvider } from './implementations/openaiImageProvider.js'
import { GoogleVideoProvider } from './implementations/googleVideoProvider.js'
import { ElevenLabsVoiceProvider } from './implementations/elevenLabsVoiceProvider.js'

let initialized = false

export function initializeProviders() {
  if (initialized) return
  initialized = true

  scriptProviderSelector.register(new BailianScriptProvider())

  imageProviderSelector.register(new BailianImageProvider())
  imageProviderSelector.register(new OpenAIImageProvider())

  voiceProviderSelector.register(new BailianVoiceProvider())
  voiceProviderSelector.register(new ElevenLabsVoiceProvider())

  videoProviderSelector.register(new BailianVideoProvider())
  videoProviderSelector.register(new GoogleVideoProvider())
}

export const selectors = Object.freeze({
  script: scriptProviderSelector,
  image: imageProviderSelector,
  voice: voiceProviderSelector,
  video: videoProviderSelector,
})

export const providerCapabilityIds = Object.freeze(['script', 'image', 'voice', 'video'])

export const getProviderSelector = (capability) => selectors[capability]

export function listAvailableProviders(capability) {
  const selector = selectors[capability]
  if (!selector) return []
  return selector.listAvailable().map((p) => p.getCapabilities())
}

export function resolveActiveProviderId(capability, preferredId) {
  const selector = selectors[capability]
  if (!selector) return null
  const preferred = selector.get(preferredId)
  if (preferred?.configured) return preferredId
  const available = selector.listAvailable()
  return available[0]?.providerId || null
}

export async function generateWithFailover(capability, preferredId, payload = {}) {
  const selector = selectors[capability]
  if (!selector) return { ok: false, error: `未知能力域：${capability}` }

  const activeId = resolveActiveProviderId(capability, preferredId)
  if (!activeId) {
    return { ok: false, error: `没有可用的 ${capability} Provider，请检查 API Key 配置` }
  }

  const result = await selector.generate(activeId, payload)

  if (!result?.ok && preferredId && preferredId !== activeId) {
    const fallbackResult = await selector.generate(preferredId, payload)
    if (fallbackResult?.ok) {
      fallbackResult.fallbackFrom = activeId
      return fallbackResult
    }
  }

  return result
}

export const estimateTaskCost = (task) => {
  if (!task?.kind) return null
  const providerId = task.providerId || 'bailian'

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
  let currency = 'CNY'

  for (const task of tasks) {
    const cost = estimateTaskCost(task)
    if (cost) {
      hasEstimates = true
      totalCost += cost.estimatedCost || 0
      currency = cost.currency || currency
      items.push({
        kind: task.kind,
        label: task.label || task.kind,
        providerId: task.providerId || 'bailian',
        ...cost,
      })
    }
  }

  return {
    hasEstimates,
    items,
    totalCost: Math.round(totalCost * 10000) / 10000,
    currency,
    warning: '实际费用以各 Provider 账单为准',
  }
}
