const desktopBridge = () => window.manjuDesktop

export const oneClickProductionRepository = {
  async start(request) {
    if (!desktopBridge()?.startOneClickProduction) {
      return { ok: false, error: '当前环境不支持整部漫剧自动制作' }
    }
    return desktopBridge().startOneClickProduction(request)
  },

  async status(projectLocalId) {
    if (!desktopBridge()?.getOneClickProductionStatus) {
      return { ok: true, missing: true, run: null }
    }
    return desktopBridge().getOneClickProductionStatus({ projectLocalId })
  },

  async pause(projectLocalId) {
    if (!desktopBridge()?.pauseOneClickProduction) return { ok: false, error: '当前环境不支持暂停' }
    return desktopBridge().pauseOneClickProduction({ projectLocalId })
  },

  async resume(projectLocalId) {
    if (!desktopBridge()?.resumeOneClickProduction) return { ok: false, error: '当前环境不支持继续' }
    return desktopBridge().resumeOneClickProduction({ projectLocalId })
  },

  async stop(projectLocalId) {
    if (!desktopBridge()?.stopOneClickProduction) return { ok: false, error: '当前环境不支持停止' }
    return desktopBridge().stopOneClickProduction({ projectLocalId })
  },

  async openFreeQuotaSettings() {
    if (!desktopBridge()?.openBailianFreeQuotaSettings) {
      return { ok: false, error: '当前环境不支持打开外部网页' }
    }
    return desktopBridge().openBailianFreeQuotaSettings()
  },

  onProgress(callback) {
    if (!desktopBridge()?.onOneClickProductionProgress) return () => undefined
    return desktopBridge().onOneClickProductionProgress(callback)
  },
}
