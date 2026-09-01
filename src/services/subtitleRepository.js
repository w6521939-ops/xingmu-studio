const desktopBridge = () => window.manjuDesktop

export const subtitleRepository = {
  async importSrt() {
    if (!desktopBridge()?.importSubtitles) return { ok: false, error: '浏览器预览模式不支持本地 SRT 导入' }
    return desktopBridge().importSubtitles()
  },

  async exportSrt(projectName, text) {
    if (!desktopBridge()?.exportSubtitles) return { ok: false, error: '浏览器预览模式不支持本地 SRT 导出' }
    return desktopBridge().exportSubtitles({ projectName, text })
  },
}
