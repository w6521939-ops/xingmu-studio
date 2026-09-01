import { isSupportedProjectImage } from './generatedImageAssetService.js'

const cleanText = (value, maximumLength = 600) => String(value || '').trim().slice(0, maximumLength)

export const normalizePropAsset = (asset = {}, index = 0) => {
  const image = isSupportedProjectImage(asset.image) ? asset.image : ''
  return {
    id: asset.id ?? index + 1,
    sourceId: cleanText(asset.sourceId, 80),
    name: cleanText(asset.name, 80) || `道具 ${index + 1}`,
    description: cleanText(asset.description || asset.appearance, 800),
    appearance: cleanText(asset.appearance || asset.description, 800),
    function: cleanText(asset.function || asset.purpose, 500),
    forbiddenDrift: Array.isArray(asset.forbiddenDrift)
      ? asset.forbiddenDrift.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 12)
      : [],
    image,
    imageStatus: image
      ? '已完成'
      : ['排队中', '生成中', '失败'].includes(asset.imageStatus) ? asset.imageStatus : '未生成',
    imageSource: image ? cleanText(asset.imageSource, 80) || 'local' : '',
    imageAssetId: cleanText(asset.imageAssetId, 180),
    imageBytes: Math.max(0, Number(asset.imageBytes) || 0),
    imageSha256: cleanText(asset.imageSha256, 128),
    imageFileName: cleanText(asset.imageFileName, 180),
    imageError: cleanText(asset.imageError, 500),
    imageAttempt: Math.max(0, Number(asset.imageAttempt) || 0),
  }
}

export const normalizePropAssets = (assets = []) => (
  Array.isArray(assets) ? assets.slice(0, 120).map(normalizePropAsset) : []
)

export const createPropContinuitySummary = (asset = {}) => [
  asset.appearance,
  asset.function,
  ...(Array.isArray(asset.forbiddenDrift) ? asset.forbiddenDrift : []),
].map((item) => cleanText(item, 240)).filter(Boolean).join('；')
