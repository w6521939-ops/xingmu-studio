const autosaveKey = 'manju-creation.autosave.v1'
const recoveryKeyPrefix = 'manju-creation.timeline-recovery.v1'

const desktopBridge = () => window.manjuDesktop
const browserRecoveryKey = (projectKey) => `${recoveryKeyPrefix}.${encodeURIComponent(String(projectKey || '未命名漫剧')).slice(0, 160)}`

export const projectRepository = {
  async save(snapshot, currentPath = '', saveAs = false) {
    if (desktopBridge()) {
      return desktopBridge().saveProject({ snapshot, currentPath, saveAs })
    }
    window.localStorage.setItem(autosaveKey, JSON.stringify(snapshot))
    return { ok: true, path: '浏览器本地存储' }
  },

  async open() {
    if (desktopBridge()) return desktopBridge().openProject()
    return { ok: false, canceled: true, error: '浏览器预览模式不支持系统文件选择器' }
  },

  async openRecent(filePath) {
    if (desktopBridge()) return desktopBridge().openRecentProject(filePath)
    return this.loadAutosave()
  },

  async listRecent() {
    if (desktopBridge()) return desktopBridge().listRecentProjects()
    return { ok: true, recents: [] }
  },

  async saveAutosave(snapshot) {
    if (desktopBridge()) return desktopBridge().saveAutosave(snapshot)
    window.localStorage.setItem(autosaveKey, JSON.stringify(snapshot))
    return { ok: true, savedAt: new Date().toISOString() }
  },

  async loadAutosave() {
    if (desktopBridge()) return desktopBridge().loadAutosave()
    try {
      const value = window.localStorage.getItem(autosaveKey)
      return value ? { ok: true, snapshot: JSON.parse(value) } : { ok: false, missing: true }
    } catch {
      return { ok: false, missing: true }
    }
  },

  async listTimelineRecoveries(projectKey) {
    if (desktopBridge()?.listTimelineRecoveries) return desktopBridge().listTimelineRecoveries(projectKey)
    try {
      const points = JSON.parse(window.localStorage.getItem(browserRecoveryKey(projectKey)) || '[]')
      return {
        ok: true,
        points: Array.isArray(points)
          ? points.map((point) => ({
            id: point.id,
            savedAt: point.savedAt,
            projectName: point.projectName,
            bytes: point.bytes,
          }))
          : [],
      }
    } catch {
      return { ok: true, points: [] }
    }
  },

  async saveTimelineRecovery(projectKey, snapshot) {
    if (desktopBridge()?.saveTimelineRecovery) {
      return desktopBridge().saveTimelineRecovery({ projectKey, snapshot })
    }
    try {
      const storageKey = browserRecoveryKey(projectKey)
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      const savedAt = new Date().toISOString()
      const points = [
        {
          id: `${Date.now()}-browser.manju`,
          savedAt,
          projectName: snapshot.project?.name || '未命名漫剧',
          bytes: JSON.stringify(snapshot).length,
          snapshot,
        },
        ...(Array.isArray(existing) ? existing : []),
      ].slice(0, 8)
      window.localStorage.setItem(storageKey, JSON.stringify(points))
      return {
        ok: true,
        points: points.map((point) => ({
          id: point.id,
          savedAt: point.savedAt,
          projectName: point.projectName,
          bytes: point.bytes,
        })),
      }
    } catch {
      return { ok: false, error: '浏览器本地恢复点保存失败' }
    }
  },

  async restoreTimelineRecovery(projectKey, recoveryId) {
    if (desktopBridge()?.restoreTimelineRecovery) {
      return desktopBridge().restoreTimelineRecovery({ projectKey, recoveryId })
    }
    try {
      const points = JSON.parse(window.localStorage.getItem(browserRecoveryKey(projectKey)) || '[]')
      const point = Array.isArray(points) ? points.find((item) => item.id === recoveryId) : null
      return point?.snapshot
        ? { ok: true, snapshot: point.snapshot }
        : { ok: false, error: '恢复点不存在' }
    } catch {
      return { ok: false, error: '浏览器本地恢复点读取失败' }
    }
  },
}
