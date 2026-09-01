export const zeroCostAutomationStorageKey = 'manju-creation.zero-cost-automation.v1'

export const requiredZeroCostModels = Object.freeze([
  Object.freeze({ capability: 'script', label: '剧本生成', model: 'qwen3.7-plus' }),
  Object.freeze({ capability: 'image', label: '图片生成', model: 'wan2.7-image-pro' }),
  Object.freeze({ capability: 'voice', label: '配音生成', model: 'qwen3-tts-flash' }),
  Object.freeze({ capability: 'video', label: '视频生成', model: 'wan2.7-i2v-2026-04-25' }),
])

export const createZeroCostModelSignature = (models = requiredZeroCostModels) => models
  .map(({ capability, model }) => `${capability}:${model}`)
  .join('|')

export const createEmptyZeroCostAutomationSettings = () => ({
  version: 1,
  confirmed: false,
  confirmedAt: '',
  modelSignature: createZeroCostModelSignature(),
})

export const normalizeZeroCostAutomationSettings = (
  value,
  models = requiredZeroCostModels,
) => {
  const expectedSignature = createZeroCostModelSignature(models)
  const signatureMatches = value?.modelSignature === expectedSignature
  return {
    version: 1,
    confirmed: value?.confirmed === true && signatureMatches,
    confirmedAt: signatureMatches && typeof value?.confirmedAt === 'string' ? value.confirmedAt : '',
    modelSignature: expectedSignature,
    invalidatedByModelChange: Boolean(value?.confirmed && !signatureMatches),
  }
}

export const loadZeroCostAutomationSettings = (
  storage = globalThis.window?.localStorage,
  models = requiredZeroCostModels,
) => {
  if (!storage) return createEmptyZeroCostAutomationSettings()
  try {
    const saved = storage.getItem(zeroCostAutomationStorageKey)
    return normalizeZeroCostAutomationSettings(saved ? JSON.parse(saved) : null, models)
  } catch {
    return createEmptyZeroCostAutomationSettings()
  }
}

export const confirmZeroCostAutomationSettings = (
  storage = globalThis.window?.localStorage,
  models = requiredZeroCostModels,
) => {
  const settings = {
    version: 1,
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    modelSignature: createZeroCostModelSignature(models),
  }
  storage?.setItem(zeroCostAutomationStorageKey, JSON.stringify(settings))
  return settings
}

export const clearZeroCostAutomationSettings = (
  storage = globalThis.window?.localStorage,
  models = requiredZeroCostModels,
) => {
  const settings = createEmptyZeroCostAutomationSettings()
  settings.modelSignature = createZeroCostModelSignature(models)
  storage?.setItem(zeroCostAutomationStorageKey, JSON.stringify(settings))
  return settings
}

export const isZeroCostAutomationConfirmed = (
  settings,
  models = requiredZeroCostModels,
) => normalizeZeroCostAutomationSettings(settings, models).confirmed
