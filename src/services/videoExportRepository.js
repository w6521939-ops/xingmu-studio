const desktopBridge = () => window.manjuDesktop

export const videoExportRepository = {
  async export(request) {
    if (!desktopBridge()?.exportVideo) {
      return { ok: false, error: '浏览器预览模式不支持本地 MP4 导出' }
    }
    return desktopBridge().exportVideo(request)
  },

  async cancel() {
    if (!desktopBridge()?.cancelVideoExport) return { ok: false, error: '当前环境不支持取消导出' }
    return desktopBridge().cancelVideoExport()
  },

  async listHistory() {
    if (!desktopBridge()?.listVideoExports) return { ok: true, history: [] }
    return desktopBridge().listVideoExports()
  },

  async preparePreview(filePath) {
    if (!desktopBridge()?.prepareVideoExportPreview) {
      return { ok: false, error: '当前环境不支持应用内预览成片' }
    }
    return desktopBridge().prepareVideoExportPreview(filePath)
  },

  async reveal(filePath) {
    if (!desktopBridge()?.revealVideoExport) return { ok: false, error: '当前环境不支持打开文件位置' }
    return desktopBridge().revealVideoExport(filePath)
  },

  onProgress(callback) {
    if (!desktopBridge()?.onVideoExportProgress) return () => undefined
    return desktopBridge().onVideoExportProgress(callback)
  },
}
