const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('manjuDesktop', Object.freeze({
  getBailianStatus: () => ipcRenderer.invoke('provider:bailian-status'),
  probeBailianCapability: (capability) => ipcRenderer.invoke('provider:bailian-probe', capability),
  getBailianScriptDryRun: (request) => ipcRenderer.invoke('provider:bailian-script-dry-run', request),
  generateBailianScript: (request) => ipcRenderer.invoke('provider:bailian-generate-script', request),
  getBailianEntityDryRun: (request) => ipcRenderer.invoke('provider:bailian-entity-dry-run', request),
  generateBailianEntity: (request) => ipcRenderer.invoke('provider:bailian-generate-entity', request),
  getBailianImageDryRun: (request) => ipcRenderer.invoke('provider:bailian-image-dry-run', request),
  generateBailianImage: (request) => ipcRenderer.invoke('provider:bailian-generate-image', request),
  listBailianImages: (request) => ipcRenderer.invoke('provider:bailian-list-images', request),
  startOneClickProduction: (request) => ipcRenderer.invoke('one-click-production:start', request),
  getOneClickProductionStatus: (request) => ipcRenderer.invoke('one-click-production:status', request),
  pauseOneClickProduction: (request) => ipcRenderer.invoke('one-click-production:pause', request),
  resumeOneClickProduction: (request) => ipcRenderer.invoke('one-click-production:resume', request),
  stopOneClickProduction: (request) => ipcRenderer.invoke('one-click-production:stop', request),
  openBailianFreeQuotaSettings: () => ipcRenderer.invoke('one-click-production:open-free-quota'),
  saveProject: (request) => ipcRenderer.invoke('project:save', request),
  openProject: () => ipcRenderer.invoke('project:open'),
  openRecentProject: (filePath) => ipcRenderer.invoke('project:open-recent', filePath),
  listRecentProjects: () => ipcRenderer.invoke('project:list-recent'),
  saveAutosave: (snapshot) => ipcRenderer.invoke('project:autosave', snapshot),
  loadAutosave: () => ipcRenderer.invoke('project:load-autosave'),
  listTimelineRecoveries: (projectKey) => ipcRenderer.invoke('timeline-recovery:list', projectKey),
  saveTimelineRecovery: (request) => ipcRenderer.invoke('timeline-recovery:save', request),
  restoreTimelineRecovery: (request) => ipcRenderer.invoke('timeline-recovery:restore', request),
  prepareLocalShotVideo: (request) => ipcRenderer.invoke('shot-video:prepare', request),
  cancelLocalShotVideoPreparation: () => ipcRenderer.invoke('shot-video:cancel'),
  discardLocalShotVideo: (request) => ipcRenderer.invoke('shot-video:discard', request),
  checkLocalShotVideos: (request) => ipcRenderer.invoke('shot-video:check', request),
  revealLocalShotVideo: (request) => ipcRenderer.invoke('shot-video:reveal', request),
  inspectPortableProjectExport: (request) => ipcRenderer.invoke('portable-project:inspect-export', request),
  choosePortableProjectExportLocation: (request) => ipcRenderer.invoke('portable-project:choose-export-location', request),
  runPortableProjectExport: (request) => ipcRenderer.invoke('portable-project:run-export', request),
  choosePortableProjectImport: () => ipcRenderer.invoke('portable-project:choose-import'),
  runPortableProjectImport: (request) => ipcRenderer.invoke('portable-project:run-import', request),
  cancelPortableProjectOperation: () => ipcRenderer.invoke('portable-project:cancel'),
  revealPortableProjectExport: (request) => ipcRenderer.invoke('portable-project:reveal', request),
  scanManagedMedia: (request) => ipcRenderer.invoke('managed-media:scan', request),
  trashManagedMedia: (request) => ipcRenderer.invoke('managed-media:trash', request),
  exportVideo: (request) => ipcRenderer.invoke('video:export', request),
  cancelVideoExport: () => ipcRenderer.invoke('video:cancel-export'),
  listVideoExports: () => ipcRenderer.invoke('video:list-exports'),
  prepareVideoExportPreview: (filePath) => ipcRenderer.invoke('video:prepare-export-preview', filePath),
  revealVideoExport: (filePath) => ipcRenderer.invoke('video:reveal-export', filePath),
  importSubtitles: () => ipcRenderer.invoke('subtitle:import-srt'),
  exportSubtitles: (request) => ipcRenderer.invoke('subtitle:export-srt', request),
  onVideoExportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('video:export-progress', listener)
    return () => ipcRenderer.removeListener('video:export-progress', listener)
  },
  onLocalShotVideoProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('shot-video:progress', listener)
    return () => ipcRenderer.removeListener('shot-video:progress', listener)
  },
  onPortableProjectProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('portable-project:progress', listener)
    return () => ipcRenderer.removeListener('portable-project:progress', listener)
  },
  onOneClickProductionProgress: (callback) => {
    const listener = (_event, run) => callback(run)
    ipcRenderer.on('one-click-production:progress', listener)
    return () => ipcRenderer.removeListener('one-click-production:progress', listener)
  },
  onMenuCommand: (callback) => {
    const allowedCommands = new Set(['new', 'open', 'save', 'save-as', 'portable-import', 'portable-export'])
    const listener = (_event, command) => {
      if (allowedCommands.has(command)) callback(command)
    }
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },
}))
