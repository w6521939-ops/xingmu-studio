const managedGeneratedImagePattern = /^manju-media:\/\/generated-image\/image-[a-z0-9]+-[a-f0-9]{8}$/u
const imageDataUrlPattern = /^data:image\/[a-z0-9.+-]+;base64,/iu

export const isManagedGeneratedImageUrl = (value) => managedGeneratedImagePattern.test(String(value || '').trim())

export const isSupportedProjectImage = (value) => {
  const source = String(value || '').trim()
  return imageDataUrlPattern.test(source) || isManagedGeneratedImageUrl(source)
}

export const createGeneratedImageProjectFields = (image = {}) => {
  if (!isManagedGeneratedImageUrl(image.mediaUrl)) {
    return { ok: false, error: '生成图片缺少有效的受控本地文件引用' }
  }
  const assetId = String(image.assetId || '').trim()
  if (!image.mediaUrl.endsWith(`/${assetId}`)) {
    return { ok: false, error: '生成图片资产标识与本地引用不一致' }
  }
  return {
    ok: true,
    fields: {
      image: image.mediaUrl,
      imageAssetId: assetId,
      imageStatus: '已完成',
      imageSource: 'bailian-managed',
      imageFileName: String(image.fileName || '').trim().slice(0, 180),
      imageBytes: Math.max(0, Number(image.bytes) || 0),
      imageSha256: String(image.sha256 || '').trim().slice(0, 128),
      imageError: '',
      imageUpdatedAt: new Date().toISOString(),
    },
  }
}

export const createGeneratedImageReference = (entity = {}, fallbackId = '') => {
  if (!isManagedGeneratedImageUrl(entity.image) || !entity.imageAssetId) return null
  return {
    id: fallbackId || String(entity.id || ''),
    name: String(entity.name || entity.title || '受控本地图片'),
    assetId: String(entity.imageAssetId),
    bytes: Math.max(0, Number(entity.imageBytes) || 0),
  }
}
