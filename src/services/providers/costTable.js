export const pricingTable = Object.freeze({
  bailian: Object.freeze({
    script: Object.freeze({
      model: 'qwen3.7-plus',
      unit: 'token',
      inputPricePerKTokens: 0.0008,
      outputPricePerKTokens: 0.002,
      estimatedInputTokens: 500,
      estimatedOutputTokens: 4000,
      currency: 'CNY',
      note: '文字模型按 Token 计费；免费额度与实际账单以百炼控制台为准',
    }),
    image: Object.freeze({
      model: 'wan2.7-image-pro',
      unit: 'per-image',
      pricePerUnit: 0.04,
      referencePricePerUnit: 0.5,
      currency: 'CNY',
      note: '官方当前参考价 0.04 元/张，参考图 0.5 元/张；免费额度以百炼控制台为准',
    }),
    voice: Object.freeze({
      model: 'qwen3-tts-flash',
      unit: 'per-character',
      pricePerUnit: 0.0001,
      currency: 'CNY',
      note: '按字符计费；免费额度与实际账单以百炼控制台为准',
    }),
    video: Object.freeze({
      model: 'wan2.7-i2v-2026-04-25',
      unit: 'per-clip',
      pricePerUnit: 0.10,
      currency: 'CNY',
      note: '按次计费；免费额度与实际账单以百炼控制台为准',
    }),
  }),
  openai: Object.freeze({
    image: Object.freeze({
      model: 'gpt-image-2',
      unit: 'per-image',
      pricePerUnit: 0.04,
      referencePricePerUnit: 0.04,
      currency: 'USD',
      note: '按张计费，约 $0.04/张；实际费用以 OpenAI 账单为准',
    }),
  }),
  'google-veo': Object.freeze({
    video: Object.freeze({
      model: 'veo-3.0-generate-preview',
      unit: 'per-second',
      pricePerSecond: 0.01,
      currency: 'USD',
      note: '按秒计费，约 $0.01/秒；实际费用以 Google Cloud 账单为准',
    }),
  }),
  elevenlabs: Object.freeze({
    voice: Object.freeze({
      model: 'eleven-multilingual-v2',
      unit: 'per-character',
      pricePerUnit: 0.00018,
      currency: 'USD',
      note: '按字符计费，约 $0.18/千字符；实际费用以 ElevenLabs 账单为准',
    }),
  }),
})

export const resolvePricing = (providerId, capability) => {
  const providerPricing = pricingTable[providerId]
  if (!providerPricing) return null
  return providerPricing[capability] || null
}

export const estimateScriptCost = (providerId, themeLength = 500) => {
  const pricing = resolvePricing(providerId, 'script')
  if (!pricing) return null
  const inputTokens = Math.ceil(themeLength / 2)
  const outputTokens = pricing.estimatedOutputTokens
  const cost = (inputTokens / 1000) * pricing.inputPricePerKTokens
    + (outputTokens / 1000) * pricing.outputPricePerKTokens
  return {
    model: pricing.model,
    unit: pricing.unit,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: Math.round(cost * 10000) / 10000,
    currency: pricing.currency,
    note: pricing.note,
  }
}

export const estimateImageCost = (providerId, referenceCount = 0) => {
  const pricing = resolvePricing(providerId, 'image')
  if (!pricing) return null
  const baseCost = pricing.pricePerUnit
  const referenceCost = referenceCount * pricing.referencePricePerUnit
  return {
    model: pricing.model,
    unit: pricing.unit,
    estimatedCost: Math.round((baseCost + referenceCost) * 10000) / 10000,
    referenceCost: Math.round(referenceCost * 10000) / 10000,
    referenceCount,
    currency: pricing.currency,
    note: pricing.note,
  }
}

export const estimateVoiceCost = (providerId, textLength = 30) => {
  const pricing = resolvePricing(providerId, 'voice')
  if (!pricing) return null
  const characters = Math.max(1, textLength)
  return {
    model: pricing.model,
    unit: pricing.unit,
    characters,
    estimatedCost: Math.round(characters * pricing.pricePerUnit * 10000) / 10000,
    currency: pricing.currency,
    note: pricing.note,
  }
}

export const estimateVideoCost = (providerId, durationSeconds = 5) => {
  const pricing = resolvePricing(providerId, 'video')
  if (!pricing) return null
  const cost = pricing.pricePerSecond
    ? durationSeconds * pricing.pricePerSecond
    : pricing.pricePerUnit
  return {
    model: pricing.model,
    unit: pricing.unit,
    durationSeconds,
    estimatedCost: Math.round(cost * 10000) / 10000,
    currency: pricing.currency,
    note: pricing.note,
  }
}
