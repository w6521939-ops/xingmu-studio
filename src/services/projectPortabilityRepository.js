const desktop = () => window.manjuDesktop

const unavailable = (message) => Promise.resolve({ ok: false, error: message })

export const projectPortabilityRepository = Object.freeze({
  inspectExport(snapshot) {
    return desktop()?.inspectPortableProjectExport?.({ snapshot })
      || unavailable('当前环境不支持便携项目导出')
  },
  chooseExportLocation(token) {
    return desktop()?.choosePortableProjectExportLocation?.({ token })
      || unavailable('当前环境不支持选择导出位置')
  },
  runExport(token, allowIncomplete = false) {
    return desktop()?.runPortableProjectExport?.({ token, allowIncomplete })
      || unavailable('当前环境不支持便携项目导出')
  },
  chooseImport() {
    return desktop()?.choosePortableProjectImport?.()
      || unavailable('当前环境不支持便携项目导入')
  },
  runImport(token, displayName) {
    return desktop()?.runPortableProjectImport?.({ token, displayName })
      || unavailable('当前环境不支持便携项目导入')
  },
  cancel() {
    return desktop()?.cancelPortableProjectOperation?.()
      || unavailable('当前没有可取消的便携项目操作')
  },
  reveal(token) {
    return desktop()?.revealPortableProjectExport?.({ token })
      || unavailable('当前环境无法打开导出位置')
  },
  onProgress(callback) {
    return desktop()?.onPortableProjectProgress?.(callback) || (() => undefined)
  },
})

export const managedMediaRepository = Object.freeze({
  scan(snapshot, recoveryKey) {
    return desktop()?.scanManagedMedia?.({ snapshot, recoveryKey })
      || unavailable('当前环境不支持托管媒体扫描')
  },
  trash(token, snapshot, assetIds) {
    return desktop()?.trashManagedMedia?.({ token, snapshot, assetIds })
      || unavailable('当前环境不支持移入 Windows 回收站')
  },
})
