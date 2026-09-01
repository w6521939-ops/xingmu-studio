const managedVoiceUrlPattern = /^manju-media:\/\/voice\/([a-z0-9][a-z0-9-]{5,79})\/([a-z0-9][a-z0-9-]{5,79})\.wav(?:[?#].*)?$/u

export const parseManagedVoiceAssetUrl = (value) => {
  const match = String(value || '').trim().toLowerCase().match(managedVoiceUrlPattern)
  return match ? { projectKey: match[1], assetId: match[2] } : null
}

export const resolveManagedVoiceAssetId = (line = {}) => {
  if (!line || typeof line !== 'object') return ''
  return String(line.audioAssetId || '').trim() || parseManagedVoiceAssetUrl(line.audio)?.assetId || ''
}
