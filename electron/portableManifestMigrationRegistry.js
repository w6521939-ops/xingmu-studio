import {
  portableProjectMinimumAppVersion,
  portableProjectVersion,
  portableRequiredFeatures,
  portableMigrationSteps,
  validatePortableManifestV1,
  validatePortableManifestV2,
} from './portableManifestCompatibilityService.js'

const cloneJson = (value) => JSON.parse(JSON.stringify(value))

const normalizeMissingReasonCode = (item) => {
  const known = new Set(['managed-copy-unavailable', 'source-missing', 'source-invalid', 'unknown'])
  const candidate = String(item?.reasonCode || '').trim()
  return known.has(candidate) ? candidate : 'managed-copy-unavailable'
}

export const migratePortableManifestV1ToV2 = (sourceManifest) => {
  validatePortableManifestV1(sourceManifest)
  const manifest = cloneJson(sourceManifest)
  manifest.version = portableProjectVersion
  manifest.compatibility = {
    minimumAppVersion: portableProjectMinimumAppVersion,
    requiredFeatures: [...portableRequiredFeatures],
    optionalFeatures: [],
  }
  manifest.projectSchemaVersion = 1
  manifest.mediaSchemaVersion = 1
  manifest.media = manifest.media.map((item) => ({ ...item }))
  manifest.missingMedia = manifest.missingMedia.map((item) => ({
    ...item,
    reasonCode: normalizeMissingReasonCode(item),
    reason: String(item?.reason || '导出时本机托管副本不可用').slice(0, 200),
  }))
  validatePortableManifestV2(manifest)
  return manifest
}

export const migratePortableManifestToCurrent = (sourceManifest) => {
  if (sourceManifest?.version === portableProjectVersion) {
    validatePortableManifestV2(sourceManifest)
    return { manifest: cloneJson(sourceManifest), steps: [] }
  }
  if (sourceManifest?.version === 1) {
    const manifest = migratePortableManifestV1ToV2(sourceManifest)
    return {
      manifest,
      steps: portableMigrationSteps.map((step) => ({ ...step })),
    }
  }
  throw new Error('没有可用的便携格式迁移路径')
}
