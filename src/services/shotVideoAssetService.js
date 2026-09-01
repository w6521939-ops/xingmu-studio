export const normalizeShotVideoAsset = (asset) => {
  if (!asset || typeof asset !== 'object' || typeof asset.id !== 'string' || !asset.id.trim()) return null
  const lastFrameDataUrl = typeof asset.lastFrame?.dataUrl === 'string' && asset.lastFrame.dataUrl.startsWith('data:image/')
    ? asset.lastFrame.dataUrl
    : ''
  return {
    id: asset.id.slice(0, 80),
    kind: 'shot-video',
    source: asset.source === 'bailian-download' ? 'bailian-download' : 'local-import',
    fileName: String(asset.fileName || '本地镜头视频.mp4').slice(0, 160),
    mimeType: 'video/mp4',
    bytes: Math.max(0, Number(asset.bytes) || 0),
    duration: Math.min(30, Math.max(0.5, Number(asset.duration) || 0.5)),
    width: Math.max(0, Math.round(Number(asset.width) || 0)),
    height: Math.max(0, Math.round(Number(asset.height) || 0)),
    fps: Math.min(30, Math.max(0, Number(asset.fps) || 0)),
    sha256: /^[a-f0-9]{64}$/iu.test(String(asset.sha256 || '')) ? String(asset.sha256).toLowerCase() : '',
    importedAt: String(asset.importedAt || ''),
    lastFrame: {
      dataUrl: lastFrameDataUrl,
      fileName: String(asset.lastFrame?.fileName || '真实末帧.jpg').slice(0, 160),
      width: Math.max(0, Math.round(Number(asset.lastFrame?.width) || 0)),
      height: Math.max(0, Math.round(Number(asset.lastFrame?.height) || 0)),
      extractedAt: String(asset.lastFrame?.extractedAt || ''),
    },
  }
}

export const normalizeShotVideoAssets = (assets = []) => {
  const seen = new Set()
  return (Array.isArray(assets) ? assets : []).flatMap((asset) => {
    const normalized = normalizeShotVideoAsset(asset)
    if (!normalized || seen.has(normalized.id)) return []
    seen.add(normalized.id)
    return [normalized]
  })
}

export const resolveShotVideoAsset = (shot, assets = []) => (
  assets.find((asset) => asset.id === shot?.videoAssetId) || null
)

export const resolveShotVideoContinuityFrame = ({ shot, shots = [], assets = [] } = {}) => {
  const sourceId = shot?.videoContinuitySourceShotId
  if (!sourceId) return null
  const targetIndex = shots.findIndex((item) => String(item.id) === String(shot.id))
  if (targetIndex <= 0 || String(shots[targetIndex - 1].id) !== String(sourceId)) return null
  const sourceShot = shots[targetIndex - 1]
  const asset = resolveShotVideoAsset(sourceShot, assets)
  return asset?.lastFrame?.dataUrl ? { sourceShot, asset, dataUrl: asset.lastFrame.dataUrl } : null
}

export const applyShotVideoAsset = ({ shots = [], assets = [], shotId, asset }) => {
  const normalized = normalizeShotVideoAsset(asset)
  if (!normalized || !shots.some((shot) => String(shot.id) === String(shotId))) {
    return { ok: false, error: '当前镜头或视频资产不存在', shots, assets }
  }
  const nextAssets = [...assets.filter((item) => item.id !== normalized.id), normalized]
  const nextShots = shots.map((shot) => String(shot.id) === String(shotId)
    ? { ...shot, videoAssetId: normalized.id, videoOffsetSeconds: 0, videoDurationPolicy: 'fit-timeline' }
    : shot)
  return { ok: true, shots: nextShots, assets: nextAssets, asset: normalized }
}

export const detachShotVideoAsset = ({ shots = [], shotId }) => {
  const targetKey = String(shotId)
  const nextShots = shots.map((shot) => {
    if (String(shot.id) === targetKey) {
      return { ...shot, videoAssetId: '', videoOffsetSeconds: 0, videoDurationPolicy: 'fit-timeline' }
    }
    if (String(shot.videoContinuitySourceShotId || '') === targetKey) {
      return { ...shot, videoContinuitySourceShotId: 0 }
    }
    return shot
  })
  return { ok: true, shots: nextShots }
}

export const connectShotVideoLastFrame = ({ shots = [], shotId }) => {
  const index = shots.findIndex((shot) => String(shot.id) === String(shotId))
  if (index < 0 || index >= shots.length - 1) return { ok: false, error: '当前没有可连接的下一镜头', shots }
  return {
    ok: true,
    nextShotId: shots[index + 1].id,
    shots: shots.map((shot, shotIndex) => shotIndex === index + 1
      ? { ...shot, videoContinuitySourceShotId: shots[index].id }
      : shot),
  }
}

export const pruneInvalidShotVideoContinuity = (shots = []) => shots.map((shot, index) => {
  if (!shot.videoContinuitySourceShotId) return shot
  if (index > 0 && String(shots[index - 1].id) === String(shot.videoContinuitySourceShotId)) return shot
  return { ...shot, videoContinuitySourceShotId: 0 }
})
