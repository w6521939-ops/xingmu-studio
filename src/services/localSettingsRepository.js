const SETTINGS_KEY = 'manju-creation.provider-settings.v1'

export const loadProviderSettings = (fallback) => {
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY)
    if (!saved) return fallback
    const parsed = JSON.parse(saved)
    return Object.fromEntries(
      Object.entries(fallback).map(([key, value]) => [key, {
        ...value,
        ...(parsed[key] || {}),
        apiKey: '',
      }]),
    )
  } catch {
    return fallback
  }
}

export const saveProviderSettings = (settings) => {
  const sanitized = Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, {
      provider: value.provider,
      model: value.model,
      endpoint: value.endpoint,
      status: value.status,
    }]),
  )
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized))
}
