const desktopBridge = () => window.manjuDesktop

export const shotVideoAssetRepository = {
  async prepare(projectLocalId) {
    if (!desktopBridge()?.prepareLocalShotVideo) {
      return { ok: false, error: '浏览器预览模式不支持本地 MP4 导入' }
    }
    return desktopBridge().prepareLocalShotVideo({ projectLocalId })
  },

  async cancel() {
    if (!desktopBridge()?.cancelLocalShotVideoPreparation) return { ok: false, error: '当前没有可取消的视频处理' }
    return desktopBridge().cancelLocalShotVideoPreparation()
  },

  async discard(projectLocalId, assetId) {
    if (!desktopBridge()?.discardLocalShotVideo) return { ok: true }
    return desktopBridge().discardLocalShotVideo({ projectLocalId, assetId })
  },

  async check(projectLocalId, assetIds) {
    if (!desktopBridge()?.checkLocalShotVideos) {
      return { ok: true, assets: Object.fromEntries((assetIds || []).map((assetId) => [assetId, { health: 'missing', mediaUrl: '' }])) }
    }
    return desktopBridge().checkLocalShotVideos({ projectLocalId, assetIds })
  },

  async reveal(projectLocalId, assetId) {
    if (!desktopBridge()?.revealLocalShotVideo) return { ok: false, error: '当前环境不支持打开托管位置' }
    return desktopBridge().revealLocalShotVideo({ projectLocalId, assetId })
  },

  onProgress(callback) {
    if (!desktopBridge()?.onLocalShotVideoProgress) return () => undefined
    return desktopBridge().onLocalShotVideoProgress(callback)
  },
}
