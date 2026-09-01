export const portableProjectFormat = 'manju-portable-project'
export const portableProjectVersion = 2
export const portableProjectMinimumAppVersion = '1.33.0'

export const portableRequiredFeatures = Object.freeze([
  'integrity-sha256',
  'managed-shot-video',
  'import-as-copy',
  'episode-production-scopes',
])

export const portableKnownOptionalFeatures = Object.freeze([])

export const portableMigrationSteps = Object.freeze([
  Object.freeze({ id: 'validate-v1', label: '验证 V1 目录与文件完整性' }),
  Object.freeze({ id: 'add-v2-compatibility', label: '生成 V2 兼容信息' }),
  Object.freeze({ id: 'normalize-v2-media', label: '归一化媒体与缺失原因' }),
  Object.freeze({ id: 'validate-v2', label: '按 V2 规则再次校验' }),
])

const featurePattern = /^[a-z0-9][a-z0-9-]{0,63}$/u
const supportedRequiredFeatures = new Set(portableRequiredFeatures)
const supportedOptionalFeatures = new Set(portableKnownOptionalFeatures)

export class PortableManifestValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'PortableManifestValidationError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new PortableManifestValidationError(code, message)
}

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const cleanText = (value, maximumCharacters) => Array.from(String(value || '').trim()).slice(0, maximumCharacters).join('')

const validateFeatureList = (value, label, maximumItems) => {
  if (!Array.isArray(value)) fail('MANIFEST_FEATURES_INVALID', `${label}必须是数组`)
  if (value.length > maximumItems) fail('MANIFEST_FEATURES_LIMIT', `${label}数量超过限制`)
  const features = value.map((item) => cleanText(item, 64))
  if (features.some((item) => !featurePattern.test(item))) {
    fail('MANIFEST_FEATURE_NAME_INVALID', `${label}包含无效能力名称`)
  }
  if (new Set(features).size !== features.length) fail('MANIFEST_FEATURE_DUPLICATE', `${label}包含重复能力`)
  return features
}

const validateCommonManifest = (manifest, expectedVersion) => {
  if (!isRecord(manifest)) fail('MANIFEST_JSON_INVALID', 'manifest 必须是 JSON 对象')
  if (manifest.format !== portableProjectFormat) fail('MANIFEST_FORMAT_INVALID', '该文件夹不是“星幕工坊”便携项目')
  if (manifest.version !== expectedVersion) fail('MANIFEST_VERSION_MISMATCH', `manifest 版本必须为 V${expectedVersion}`)
  if (!isRecord(manifest.project)) fail('MANIFEST_PROJECT_INVALID', 'manifest 缺少项目摘要')
  if (!isRecord(manifest.projectFile)) fail('MANIFEST_PROJECT_FILE_INVALID', 'manifest 缺少项目文件清单')
  if (manifest.projectFile.path !== 'project.manju') fail('MANIFEST_PROJECT_PATH_INVALID', '便携项目清单中的项目路径无效')
  if (!Number.isSafeInteger(manifest.projectFile.bytes) || manifest.projectFile.bytes <= 0) {
    fail('MANIFEST_PROJECT_SIZE_INVALID', '项目文件大小必须是正整数')
  }
  if (!/^[a-f0-9]{64}$/u.test(String(manifest.projectFile.sha256 || ''))) {
    fail('MANIFEST_PROJECT_HASH_INVALID', '项目文件 SHA-256 无效')
  }
  if (!Array.isArray(manifest.media) || manifest.media.length > 200) {
    fail('MANIFEST_MEDIA_INVALID', '便携项目媒体清单无效或超过 200 项限制')
  }
  if (!Array.isArray(manifest.missingMedia) || manifest.missingMedia.length > 200) {
    fail('MANIFEST_MISSING_MEDIA_INVALID', '便携项目缺失媒体清单无效或超过 200 项限制')
  }
  return manifest
}

export const validatePortableManifestV1 = (manifest) => validateCommonManifest(manifest, 1)

export const validatePortableManifestV2 = (manifest) => {
  validateCommonManifest(manifest, portableProjectVersion)
  if (!isRecord(manifest.compatibility)) fail('MANIFEST_COMPATIBILITY_INVALID', 'Manifest V2 缺少兼容信息')
  const minimumAppVersion = cleanText(manifest.compatibility.minimumAppVersion, 32)
  if (!minimumAppVersion) fail('MANIFEST_MINIMUM_APP_VERSION_INVALID', 'Manifest V2 缺少最低应用版本')
  const requiredFeatures = validateFeatureList(manifest.compatibility.requiredFeatures, '必需能力', 16)
  const optionalFeatures = validateFeatureList(manifest.compatibility.optionalFeatures, '可选能力', 32)
  const unknownRequiredFeatures = requiredFeatures.filter((feature) => !supportedRequiredFeatures.has(feature))
  if (unknownRequiredFeatures.length) {
    fail('MANIFEST_REQUIRED_FEATURE_UNSUPPORTED', `当前版本不支持必需能力：${unknownRequiredFeatures.join('、')}`)
  }
  if (![1, 2].includes(manifest.projectSchemaVersion)) fail('MANIFEST_PROJECT_SCHEMA_UNSUPPORTED', '项目正文结构版本不受支持')
  if (manifest.mediaSchemaVersion !== 1) fail('MANIFEST_MEDIA_SCHEMA_UNSUPPORTED', '媒体清单结构版本不受支持')
  return {
    manifest,
    requiredFeatures,
    optionalFeatures,
    unknownOptionalFeatures: optionalFeatures.filter((feature) => !supportedOptionalFeatures.has(feature)),
  }
}

export const createPortableCompatibilityFailure = ({
  code = 'MANIFEST_INVALID',
  message = '便携项目清单无效',
  sourceVersion = null,
  sourceAppVersion = '',
} = {}) => ({
  status: 'corrupt',
  sourceVersion,
  targetVersion: portableProjectVersion,
  sourceAppVersion: cleanText(sourceAppVersion, 32),
  requiredSteps: [],
  unknownOptionalFeatures: [],
  canImport: false,
  sourceUntouched: true,
  errorCode: cleanText(code, 80) || 'MANIFEST_INVALID',
  errorMessage: cleanText(message, 240) || '便携项目清单无效',
})

export const inspectPortableManifestCompatibility = (manifest) => {
  if (!isRecord(manifest)) return createPortableCompatibilityFailure({
    code: 'MANIFEST_JSON_INVALID',
    message: 'manifest 必须是 JSON 对象',
  })
  const sourceVersion = manifest.version
  const sourceAppVersion = cleanText(manifest.appVersion, 32)
  if (manifest.format !== portableProjectFormat) return createPortableCompatibilityFailure({
    code: 'MANIFEST_FORMAT_INVALID',
    message: '该文件夹不是“星幕工坊”便携项目',
    sourceVersion: Number.isInteger(sourceVersion) ? sourceVersion : null,
    sourceAppVersion,
  })
  if (!Number.isSafeInteger(sourceVersion) || sourceVersion <= 0) return createPortableCompatibilityFailure({
    code: 'MANIFEST_VERSION_INVALID',
    message: 'manifest 版本号必须是正整数',
    sourceVersion: null,
    sourceAppVersion,
  })
  if (sourceVersion > portableProjectVersion) return {
    status: 'future',
    sourceVersion,
    targetVersion: portableProjectVersion,
    sourceAppVersion,
    requiredSteps: [],
    unknownOptionalFeatures: [],
    canImport: false,
    sourceUntouched: true,
    errorCode: '',
    errorMessage: '',
  }
  try {
    if (sourceVersion === 1) {
      validatePortableManifestV1(manifest)
      return {
        status: 'migratable',
        sourceVersion,
        targetVersion: portableProjectVersion,
        sourceAppVersion,
        requiredSteps: portableMigrationSteps.map((step) => ({ ...step })),
        unknownOptionalFeatures: [],
        canImport: true,
        sourceUntouched: true,
        errorCode: '',
        errorMessage: '',
      }
    }
    const validated = validatePortableManifestV2(manifest)
    return {
      status: 'current',
      sourceVersion,
      targetVersion: portableProjectVersion,
      sourceAppVersion,
      requiredSteps: [],
      unknownOptionalFeatures: validated.unknownOptionalFeatures,
      canImport: true,
      sourceUntouched: true,
      errorCode: '',
      errorMessage: '',
    }
  } catch (error) {
    return createPortableCompatibilityFailure({
      code: error?.code || 'MANIFEST_SCHEMA_INVALID',
      message: error instanceof Error ? error.message : '便携项目清单结构无效',
      sourceVersion,
      sourceAppVersion,
    })
  }
}

export const createPortableEnvelopeSummary = ({ bundleName = '', manifest = null } = {}) => ({
  bundleName: cleanText(bundleName, 160) || '未命名便携项目.manju-bundle',
  projectName: cleanText(manifest?.project?.name, 80) || '未读取项目正文',
  appVersion: cleanText(manifest?.appVersion, 32),
  projectBytes: 0,
  videoAssetCount: 0,
  videoBytes: 0,
  totalBytes: 0,
  missingAssets: [],
  complete: false,
  createdAt: cleanText(manifest?.createdAt, 40),
})
