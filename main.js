import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { appendFile, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  appendExportHistory,
  findExportHistoryEntry,
  readExportHistory,
} from './electron/exportHistoryRepository.js'
import {
  exportTimelineVideo,
  getFfmpegExecutablePath,
  isExportCanceledError,
} from './electron/videoExportService.js'
import {
  generateBailianEntity,
  generateBailianImage,
  generateBailianScript,
  getBailianEntityDryRun,
  getBailianImageDryRun,
  getBailianScriptDryRun,
  getPublicBailianStatus,
  listBailianImageAssets,
  probeBailianCapability,
  resolveBailianImageAsset,
} from './electron/bailianProviderService.js'
import { generateBailianVideo } from './electron/bailianVideoService.js'
import { generateBailianVoice } from './electron/bailianTtsService.js'
import { createOneClickProductionController } from './electron/oneClickProductionService.js'
import {
  createShotVideoProjectKey,
  discardManagedShotVideoAsset,
  inspectManagedShotVideoAsset,
  isShotVideoAssetCanceledError,
  prepareLocalShotVideoFromPath,
  resolveManagedShotVideoPath,
} from './electron/shotVideoAssetService.js'
import { resolveManagedVoiceAssetPath } from './electron/voiceAssetService.js'
import {
  exportPortableProject,
  importPortableProjectAsCopy,
  inspectPortableProjectExport,
  inspectPortableProjectFolder,
  isPortableProjectCanceledError,
} from './electron/projectPortabilityService.js'
import {
  scanManagedProjectMedia,
  trashEligibleManagedMedia,
} from './electron/managedMediaCleanupService.js'
import { createV1ProjectBackupBeforeOverwrite } from './electron/projectUpgradeBackupService.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const applicationPackage = JSON.parse(await readFile(path.join(currentDir, 'package.json'), 'utf8'))
const applicationVersion = String(applicationPackage.version || app.getVersion())
const projectExtension = '.manju'
const maxProjectBytes = 10 * 1024 * 1024
const maxSubtitleBytes = 512 * 1024
const maxTimelineRecoveryPoints = 8
const timelineRecoveryIdPattern = /^\d{13}-[a-f0-9]{6}\.manju$/u
const authorizedProjectPaths = new Set()
const activeVideoExports = new Map()
const activeShotVideoPreparations = new Map()
const activePortableOperations = new Map()
const portableExportInspections = new Map()
const portableImportInspections = new Map()
const managedMediaScans = new Map()
const portableRevealTargets = new Map()
const videoExportPreviewTargets = new Map()
const portabilityTokenLifetimeMs = 20 * 60 * 1000
const videoExportPreviewLifetimeMs = 60 * 60 * 1000

protocol.registerSchemesAsPrivileged([{
  scheme: 'manju-media',
  privileges: {
    standard: true,
    secure: true,
    stream: true,
    supportFetchAPI: true,
  },
}])

app.setName('星幕工坊')
app.setAboutPanelOptions({
  applicationName: '星幕工坊',
  applicationVersion,
  copyright: '本地优先的 Windows 漫剧制作工作台',
})

const bailianWorkspaceIdPattern = /^(?:llm|ws)-[a-z0-9]+$/iu

const resolveBailianWorkspaceId = () => {
  const environmentValue = String(process.env.BAILIAN_WORKSPACE_ID || '').trim()
  if (bailianWorkspaceIdPattern.test(environmentValue)) return environmentValue
  const candidates = [
    path.join(currentDir, 'workspace.txt'),
    path.join(process.cwd(), 'workspace.txt'),
    path.join(path.dirname(process.execPath), 'workspace.txt'),
  ]
  for (const candidate of candidates) {
    try {
      const value = readFileSync(candidate, 'utf8').trim()
      if (bailianWorkspaceIdPattern.test(value)) return value
    } catch {
      // Optional local workspace configuration.
    }
  }
  return ''
}

const getBailianRuntimeOptions = () => {
  const workspaceId = resolveBailianWorkspaceId()
  return {
    allowPaidGeneration: process.env.BAILIAN_FREE_TIER_CONFIRMED === '1'
      || process.env.BAILIAN_ALLOW_PAID_GENERATION === '1',
    ...(workspaceId ? { apiHost: `https://${workspaceId}.cn-beijing.maas.aliyuncs.com` } : {}),
    keyCandidates: [
    { filePath: path.join(currentDir, 'key.txt'), label: '项目目录 key.txt' },
    { filePath: path.join(process.cwd(), 'key.txt'), label: '工作目录 key.txt' },
    { filePath: path.join(path.dirname(process.execPath), 'key.txt'), label: '应用目录 key.txt' },
    ],
  }
}

const getBailianWorkspaceRoot = () => (
  !app.isPackaged && process.env.MANJU_TEST_WORKSPACE_ROOT
    ? path.resolve(process.env.MANJU_TEST_WORKSPACE_ROOT)
    : app.isPackaged
      ? app.getPath('userData')
      : currentDir
)
const getShotVideoMediaRoot = () => path.join(app.getPath('userData'), 'media', 'shot-videos')
const getVoiceMediaRoot = () => path.join(app.getPath('userData'), 'media', 'voices')
const getOneClickAutomationRoot = () => path.join(app.getPath('userData'), '.manju-studio', 'automation')
const getOneClickTemporaryRoot = () => path.join(app.getPath('userData'), '.manju-studio', 'tmp', 'one-click-production')
const getAutomaticExportRoot = () => path.join(app.getPath('userData'), 'exports', 'automatic')
const bailianFreeQuotaSettingsUrl = 'https://bailian.console.aliyun.com/cn-beijing/?tab=costing-balance'

const sanitizeFileName = (value = '未命名漫剧') => Array.from(value)
  .map((character) => character.charCodeAt(0) < 32 ? '-' : character)
  .join('')
  .replace(/[<>:"/\\|?*]/g, '-')
  .replace(/[. ]+$/g, '')
  .slice(0, 80) || '未命名漫剧'

const validateProjectSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.format !== 'manju-project') {
    throw new Error('不是有效的漫剧项目文件')
  }
  if (![1, 2].includes(snapshot.version) || !snapshot.project || !snapshot.content) {
    throw new Error('项目格式版本不受支持')
  }
  return snapshot
}

const serializeProject = (snapshot) => {
  const normalized = {
    ...validateProjectSnapshot(snapshot),
    savedAt: new Date().toISOString(),
  }
  const serialized = JSON.stringify(normalized, null, 2)
  if (Buffer.byteLength(serialized, 'utf8') > maxProjectBytes) {
    throw new Error('项目文件超过 10 MB 限制')
  }
  return serialized
}

const readProjectFile = async (filePath) => {
  if (path.extname(filePath).toLowerCase() !== projectExtension) {
    throw new Error('仅支持 .manju 项目文件')
  }
  const fileInfo = await stat(filePath)
  if (fileInfo.size > maxProjectBytes) {
    throw new Error('项目文件超过 10 MB 限制')
  }
  return validateProjectSnapshot(JSON.parse(await readFile(filePath, 'utf8')))
}

const getProjectStorageDirectory = () => path.join(app.getPath('userData'), 'projects')
const getAutosavePath = () => path.join(getProjectStorageDirectory(), 'autosave.manju')
const getRecentProjectsPath = () => path.join(getProjectStorageDirectory(), 'recent-projects.json')
const getExportHistoryPath = () => path.join(app.getPath('userData'), 'exports', 'export-history.json')
const getPortableImportDirectory = () => path.join(getProjectStorageDirectory(), 'portable-imports')
const getPortableMigrationAuditPath = () => path.join(app.getPath('userData'), 'logs', 'portable-project-migration.jsonl')
const getManagedMediaCleanupAuditPath = () => path.join(app.getPath('userData'), 'logs', 'managed-media-cleanup.jsonl')
const getTimelineRecoveryDirectory = (projectKey) => {
  const keyHash = createHash('sha256').update(String(projectKey || '未命名漫剧')).digest('hex').slice(0, 20)
  return path.join(app.getPath('userData'), 'timeline-recovery', keyHash)
}

const listTimelineRecoveryPoints = async (projectKey) => {
  const recoveryDirectory = getTimelineRecoveryDirectory(projectKey)
  let entries = []
  try {
    entries = await readdir(recoveryDirectory, { withFileTypes: true })
  } catch {
    return []
  }

  const points = await Promise.all(entries
    .filter((entry) => entry.isFile() && timelineRecoveryIdPattern.test(entry.name))
    .map(async (entry) => {
      const filePath = path.join(recoveryDirectory, entry.name)
      try {
        const [fileInfo, snapshot] = await Promise.all([
          stat(filePath),
          readProjectFile(filePath),
        ])
        return {
          id: entry.name,
          savedAt: snapshot.savedAt || fileInfo.mtime.toISOString(),
          projectName: snapshot.project.name || '未命名漫剧',
          bytes: fileInfo.size,
        }
      } catch {
        return null
      }
    }))

  return points
    .filter(Boolean)
    .sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)))
    .slice(0, maxTimelineRecoveryPoints)
}

const saveTimelineRecoveryPoint = async (projectKey, snapshot) => {
  const recoveryDirectory = getTimelineRecoveryDirectory(projectKey)
  await mkdir(recoveryDirectory, { recursive: true })
  const id = `${Date.now()}-${randomBytes(3).toString('hex')}${projectExtension}`
  await writeFile(path.join(recoveryDirectory, id), serializeProject(snapshot), 'utf8')

  const entries = (await readdir(recoveryDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && timelineRecoveryIdPattern.test(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name))
  await Promise.all(entries.slice(maxTimelineRecoveryPoints).map((entry) => (
    unlink(path.join(recoveryDirectory, entry.name)).catch(() => undefined)
  )))
  return listTimelineRecoveryPoints(projectKey)
}

const readTimelineRecoveryPoint = async (projectKey, recoveryId) => {
  if (!timelineRecoveryIdPattern.test(String(recoveryId || ''))) {
    throw new Error('恢复点标识无效')
  }
  return readProjectFile(path.join(getTimelineRecoveryDirectory(projectKey), recoveryId))
}

const readRecentProjects = async () => {
  try {
    const parsed = JSON.parse(await readFile(getRecentProjectsPath(), 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((item) => item?.path && item?.name) : []
  } catch {
    return []
  }
}

const updateRecentProjects = async (filePath, snapshot) => {
  const existing = await readRecentProjects()
  const resolvedPath = path.resolve(filePath)
  const next = [
    {
      path: resolvedPath,
      name: snapshot.project.name || '未命名漫剧',
      episodeCount: snapshot.project.episodeCount || 1,
      updatedAt: new Date().toISOString(),
    },
    ...existing.filter((item) => path.resolve(item.path) !== resolvedPath),
  ].slice(0, 8)
  await mkdir(getProjectStorageDirectory(), { recursive: true })
  await writeFile(getRecentProjectsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

const pruneExpiredPortabilityTokens = () => {
  const now = Date.now()
  for (const tokenMap of [portableExportInspections, portableImportInspections, managedMediaScans, portableRevealTargets]) {
    for (const [token, entry] of tokenMap.entries()) {
      if (!entry || entry.expiresAt <= now) tokenMap.delete(token)
    }
  }
}

const createPortabilityToken = (tokenMap, senderId, value) => {
  pruneExpiredPortabilityTokens()
  const token = randomBytes(24).toString('hex')
  tokenMap.set(token, {
    senderId,
    expiresAt: Date.now() + portabilityTokenLifetimeMs,
    ...value,
  })
  return token
}

const readPortabilityToken = (tokenMap, senderId, token, label) => {
  pruneExpiredPortabilityTokens()
  const entry = tokenMap.get(String(token || ''))
  if (!entry || entry.senderId !== senderId) throw new Error(`${label}已失效，请重新操作`)
  entry.expiresAt = Date.now() + portabilityTokenLifetimeMs
  return entry
}

const readCleanupSnapshots = async (projectLocalId, recoveryKey) => {
  let autosaveSnapshot = null
  try {
    const candidate = await readProjectFile(getAutosavePath())
    if (candidate.project.localProjectId === projectLocalId) autosaveSnapshot = candidate
  } catch {
    autosaveSnapshot = null
  }
  const points = await listTimelineRecoveryPoints(recoveryKey)
  const recoverySnapshots = (await Promise.all(points.map(async (point) => {
    try {
      const candidate = await readTimelineRecoveryPoint(recoveryKey, point.id)
      return candidate.project.localProjectId === projectLocalId ? candidate : null
    } catch {
      return null
    }
  }))).filter(Boolean)
  return { autosaveSnapshot, recoverySnapshots }
}

const appendManagedMediaCleanupAudit = async ({ projectLocalId, result }) => {
  const auditPath = getManagedMediaCleanupAuditPath()
  await mkdir(path.dirname(auditPath), { recursive: true })
  const entry = {
    recordedAt: new Date().toISOString(),
    projectKey: createShotVideoProjectKey(projectLocalId),
    trashed: result.trashed,
    failed: result.failed,
    skipped: result.skipped,
    results: result.results.map(({ assetId, status, error }) => ({
      assetId,
      status,
      ...(error ? { error: String(error).slice(0, 240) } : {}),
    })),
  }
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8')
}

const appendPortableMigrationAudit = async ({ inspection, imported, outcome, errorCode = '' }) => {
  const auditPath = getPortableMigrationAuditPath()
  await mkdir(path.dirname(auditPath), { recursive: true })
  const entry = {
    recordedAt: new Date().toISOString(),
    outcome,
    sourceVersion: inspection?.compatibility?.sourceVersion ?? null,
    targetVersion: inspection?.compatibility?.targetVersion ?? null,
    steps: (inspection?.migration?.steps || []).map((step) => String(step.id || '')).filter(Boolean),
    mediaCount: inspection?.files?.length || 0,
    totalBytes: inspection?.totalBytes || 0,
    ...(imported?.snapshot?.project?.localProjectId ? {
      projectKey: createShotVideoProjectKey(imported.snapshot.project.localProjectId),
    } : {}),
    ...(errorCode ? { errorCode: String(errorCode).slice(0, 80) } : {}),
  }
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8')
}

const registerProjectHandlers = () => {
  const runtimeOptions = getBailianRuntimeOptions()
  const oneClickProductionController = createOneClickProductionController({
    automationRoot: getOneClickAutomationRoot(),
    workspaceRoot: getBailianWorkspaceRoot(),
    temporaryRoot: getOneClickTemporaryRoot(),
    shotVideoMediaRoot: getShotVideoMediaRoot(),
    voiceMediaRoot: getVoiceMediaRoot(),
    ffmpegPath: getFfmpegExecutablePath({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      projectDirectory: currentDir,
    }),
    generationOptions: runtimeOptions,
    imageGenerator: generateBailianImage,
    voiceGenerator: generateBailianVoice,
    videoGenerator: generateBailianVideo,
    videoPreparer: prepareLocalShotVideoFromPath,
    videoResolver: async ({ projectLocalId, assetId }) => {
      const filePath = resolveManagedShotVideoPath({
        mediaRoot: getShotVideoMediaRoot(),
        projectKey: createShotVideoProjectKey(projectLocalId),
        assetId,
      })
      const fileInfo = await stat(filePath)
      if (!fileInfo.isFile() || !fileInfo.size) throw new Error('镜头视频文件不存在')
      return filePath
    },
    voiceResolver: async ({ projectLocalId, assetId }) => {
      const filePath = resolveManagedVoiceAssetPath({
        mediaRoot: getVoiceMediaRoot(),
        projectKey: createShotVideoProjectKey(projectLocalId),
        assetId,
      })
      const fileInfo = await stat(filePath)
      if (!fileInfo.isFile() || !fileInfo.size) throw new Error('配音文件不存在')
      return filePath
    },
    episodeExporter: async (request) => {
      const projectName = sanitizeFileName(request.projectName || '漫剧成片')
      const episodeTitle = sanitizeFileName(request.episodeTitle || `第${request.episodeId}集`)
      const projectKey = createShotVideoProjectKey(request.projectLocalId)
      const outputDirectory = path.join(getAutomaticExportRoot(), projectKey)
      await mkdir(outputDirectory, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
      const outputPath = path.join(outputDirectory, `${projectName}-${episodeTitle}-${stamp}.mp4`)
      const resolution = request.resolution === '1920x1080'
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 }
      const exportResult = await exportTimelineVideo({
        ffmpegPath: getFfmpegExecutablePath({
          isPackaged: app.isPackaged,
          resourcesPath: process.resourcesPath,
          projectDirectory: currentDir,
        }),
        outputPath,
        items: request.items,
        ...resolution,
        transition: 'fade',
        subtitlesEnabled: true,
        subtitleCues: request.subtitleCues || [],
        subtitleStyle: {},
        audioTracks: [],
        onProgress: request.onProgress || (() => undefined),
      })
      const history = await appendExportHistory(getExportHistoryPath(), {
        ...exportResult,
        projectLocalId: request.projectLocalId,
        projectName,
        resolution: request.resolution,
        episodeId: request.episodeId,
        episodeTitle: request.episodeTitle,
        scope: 'episode',
        exportedAt: new Date().toISOString(),
      })
      return { ok: true, ...exportResult, history }
    },
    onProgress: (run) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          window.webContents.send('one-click-production:progress', run)
        }
      }
    },
  })

  ipcMain.handle('provider:bailian-status', async () => getPublicBailianStatus(getBailianRuntimeOptions()))

  ipcMain.handle('provider:bailian-probe', async (_event, capability) => probeBailianCapability({
    ...getBailianRuntimeOptions(),
    capability: String(capability || ''),
  }))

  ipcMain.handle('provider:bailian-script-dry-run', async (_event, request) => {
    try {
      return getBailianScriptDryRun({ request })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '百炼剧本请求检查失败' }
    }
  })

  ipcMain.handle('provider:bailian-generate-script', async (_event, request) => generateBailianScript({
    ...getBailianRuntimeOptions(),
    request,
    workspaceRoot: getBailianWorkspaceRoot(),
  }))

  ipcMain.handle('provider:bailian-entity-dry-run', async (_event, request) => {
    try {
      return getBailianEntityDryRun({ request })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '百炼设定请求检查失败' }
    }
  })

  ipcMain.handle('provider:bailian-generate-entity', async (_event, request) => generateBailianEntity({
    ...getBailianRuntimeOptions(),
    request,
    workspaceRoot: getBailianWorkspaceRoot(),
  }))

  ipcMain.handle('provider:bailian-image-dry-run', async (_event, request) => {
    try {
      return getBailianImageDryRun({ request })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '百炼图片请求检查失败' }
    }
  })

  ipcMain.handle('provider:bailian-generate-image', async (_event, request) => generateBailianImage({
    ...getBailianRuntimeOptions(),
    request,
    workspaceRoot: getBailianWorkspaceRoot(),
  }))

  ipcMain.handle('provider:bailian-list-images', async (_event, request) => {
    try {
      return await listBailianImageAssets({
        workspaceRoot: getBailianWorkspaceRoot(),
        purpose: request?.purpose,
        entityId: request?.entityId,
        limit: request?.limit,
      })
    } catch (error) {
      return { ok: false, assets: [], error: error instanceof Error ? error.message : '本地生成图片记录读取失败' }
    }
  })

  ipcMain.handle('one-click-production:start', async (_event, request) => {
    try {
      return await oneClickProductionController.start(request)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '一键制作启动失败' }
    }
  })

  ipcMain.handle('one-click-production:status', async (_event, request) => {
    try {
      return await oneClickProductionController.status(request)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '一键制作记录读取失败' }
    }
  })

  ipcMain.handle('one-click-production:pause', async (_event, request) => {
    try {
      return await oneClickProductionController.pause(request)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '一键制作暂停失败' }
    }
  })

  ipcMain.handle('one-click-production:resume', async (_event, request) => {
    try {
      return await oneClickProductionController.resume(request)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '一键制作继续失败' }
    }
  })

  ipcMain.handle('one-click-production:stop', async (_event, request) => {
    try {
      return await oneClickProductionController.stop(request)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '一键制作停止失败' }
    }
  })

  ipcMain.handle('one-click-production:open-free-quota', async () => {
    try {
      await shell.openExternal(bailianFreeQuotaSettingsUrl)
      return { ok: true, url: bailianFreeQuotaSettingsUrl }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法打开百炼免费额度页面' }
    }
  })

  ipcMain.handle('subtitle:import-srt', async (event) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(owner, {
        title: '导入 SRT 字幕',
        filters: [{ name: 'SRT 字幕', extensions: ['srt'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
      const filePath = path.resolve(result.filePaths[0])
      if (path.extname(filePath).toLowerCase() !== '.srt') throw new Error('仅支持 .srt 字幕文件')
      const fileInfo = await stat(filePath)
      if (!fileInfo.isFile() || fileInfo.size > maxSubtitleBytes) throw new Error('SRT 字幕文件不能超过 512 KB')
      return { ok: true, text: (await readFile(filePath, 'utf8')).replace(/^\uFEFF/u, ''), fileName: path.basename(filePath) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SRT 字幕导入失败' }
    }
  })

  ipcMain.handle('subtitle:export-srt', async (event, request) => {
    try {
      const text = String(request?.text || '')
      if (!text.trim()) throw new Error('当前没有可导出的字幕')
      if (Buffer.byteLength(text, 'utf8') > maxSubtitleBytes) throw new Error('SRT 字幕内容不能超过 512 KB')
      const owner = BrowserWindow.fromWebContents(event.sender)
      const projectName = sanitizeFileName(request?.projectName || '漫剧成片')
      const result = await dialog.showSaveDialog(owner, {
        title: '导出 SRT 字幕',
        defaultPath: path.join(app.getPath('documents'), `${projectName}-字幕.srt`),
        filters: [{ name: 'SRT 字幕', extensions: ['srt'] }],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      const outputPath = result.filePath.toLowerCase().endsWith('.srt') ? result.filePath : `${result.filePath}.srt`
      await writeFile(outputPath, `\uFEFF${text}`, 'utf8')
      return { ok: true, path: outputPath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SRT 字幕导出失败' }
    }
  })

  ipcMain.handle('project:save', async (event, request) => {
    try {
      const snapshot = validateProjectSnapshot(request?.snapshot)
      const currentPath = request?.currentPath ? path.resolve(request.currentPath) : ''
      let targetPath = !request?.saveAs && authorizedProjectPaths.has(currentPath) ? currentPath : ''

      if (!targetPath) {
        const owner = BrowserWindow.fromWebContents(event.sender)
        const result = await dialog.showSaveDialog(owner, {
          title: '保存漫剧项目',
          defaultPath: `${sanitizeFileName(snapshot.project.name)}${projectExtension}`,
          filters: [{ name: '漫剧项目', extensions: ['manju'] }],
          properties: ['showOverwriteConfirmation', 'createDirectory'],
        })
        if (result.canceled || !result.filePath) return { ok: false, canceled: true }
        targetPath = result.filePath.endsWith(projectExtension) ? result.filePath : `${result.filePath}${projectExtension}`
      }

      const backupPath = await createV1ProjectBackupBeforeOverwrite({
        targetPath,
        nextSnapshot: snapshot,
        maximumBytes: maxProjectBytes,
      })
      await writeFile(targetPath, serializeProject(snapshot), 'utf8')
      authorizedProjectPaths.add(path.resolve(targetPath))
      const recents = await updateRecentProjects(targetPath, snapshot)
      return { ok: true, path: targetPath, recents, backupPath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '保存项目失败' }
    }
  })

  ipcMain.handle('project:open', async (event) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(owner, {
        title: '打开漫剧项目',
        filters: [{ name: '漫剧项目', extensions: ['manju'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
      const filePath = path.resolve(result.filePaths[0])
      const snapshot = await readProjectFile(filePath)
      authorizedProjectPaths.add(filePath)
      const recents = await updateRecentProjects(filePath, snapshot)
      return { ok: true, path: filePath, snapshot, recents }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '打开项目失败' }
    }
  })

  ipcMain.handle('project:open-recent', async (_event, requestedPath) => {
    try {
      const filePath = path.resolve(requestedPath)
      const recents = await readRecentProjects()
      if (!recents.some((item) => path.resolve(item.path) === filePath)) {
        throw new Error('该文件不在最近项目列表中')
      }
      const snapshot = await readProjectFile(filePath)
      authorizedProjectPaths.add(filePath)
      await updateRecentProjects(filePath, snapshot)
      return { ok: true, path: filePath, snapshot }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '打开最近项目失败' }
    }
  })

  ipcMain.handle('project:list-recent', async () => ({ ok: true, recents: await readRecentProjects() }))

  ipcMain.handle('project:autosave', async (_event, snapshot) => {
    try {
      await mkdir(getProjectStorageDirectory(), { recursive: true })
      await writeFile(getAutosavePath(), serializeProject(snapshot), 'utf8')
      return { ok: true, savedAt: new Date().toISOString() }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '自动保存失败' }
    }
  })

  ipcMain.handle('project:load-autosave', async () => {
    try {
      return { ok: true, snapshot: await readProjectFile(getAutosavePath()) }
    } catch {
      return { ok: false, missing: true }
    }
  })

  ipcMain.handle('timeline-recovery:list', async (_event, projectKey) => ({
    ok: true,
    points: await listTimelineRecoveryPoints(projectKey),
  }))

  ipcMain.handle('timeline-recovery:save', async (_event, request) => {
    try {
      const snapshot = validateProjectSnapshot(request?.snapshot)
      return {
        ok: true,
        points: await saveTimelineRecoveryPoint(request?.projectKey, snapshot),
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '时间线恢复点保存失败' }
    }
  })

  ipcMain.handle('timeline-recovery:restore', async (_event, request) => {
    try {
      return {
        ok: true,
        snapshot: await readTimelineRecoveryPoint(request?.projectKey, request?.recoveryId),
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '时间线恢复点读取失败' }
    }
  })

  ipcMain.handle('portable-project:inspect-export', async (event, request) => {
    try {
      const snapshot = validateProjectSnapshot(request?.snapshot)
      const inspection = await inspectPortableProjectExport({
        snapshot,
        serializedProject: serializeProject(snapshot),
        mediaRoot: getShotVideoMediaRoot(),
        appVersion: applicationVersion,
      })
      const token = createPortabilityToken(portableExportInspections, event.sender.id, { inspection, targetParentPath: '' })
      return { ok: true, token, summary: inspection.publicSummary }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '便携项目导出预检失败' }
    }
  })

  ipcMain.handle('portable-project:choose-export-location', async (event, request) => {
    try {
      const entry = readPortabilityToken(portableExportInspections, event.sender.id, request?.token, '导出预检')
      const owner = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(owner, {
        title: '选择便携项目导出位置',
        defaultPath: app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
      const targetParentPath = path.resolve(result.filePaths[0])
      const targetInfo = await stat(targetParentPath)
      if (!targetInfo.isDirectory()) throw new Error('请选择有效的导出文件夹')
      entry.targetParentPath = targetParentPath
      return {
        ok: true,
        locationLabel: path.basename(targetParentPath) || '所选文件夹',
        bundleName: entry.inspection.publicSummary.bundleName,
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '导出位置选择失败' }
    }
  })

  ipcMain.handle('portable-project:run-export', async (event, request) => {
    const senderId = event.sender.id
    if (activePortableOperations.has(senderId)) return { ok: false, error: '已有便携项目操作正在进行' }
    const controller = new AbortController()
    try {
      const entry = readPortabilityToken(portableExportInspections, senderId, request?.token, '导出预检')
      if (!entry.targetParentPath) throw new Error('请先选择导出位置')
      activePortableOperations.set(senderId, { controller, kind: 'export' })
      const result = await exportPortableProject({
        inspection: entry.inspection,
        targetParentPath: entry.targetParentPath,
        allowIncomplete: request?.allowIncomplete === true,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) event.sender.send('portable-project:progress', { operation: 'export', ...progress })
        },
      })
      portableExportInspections.delete(String(request?.token || ''))
      const revealToken = createPortabilityToken(portableRevealTargets, senderId, { targetPath: result.outputPath })
      return {
        ok: true,
        revealToken,
        bundleName: result.bundleName,
        complete: result.complete,
        totalBytes: result.totalBytes,
        videoAssetCount: result.videoAssetCount,
      }
    } catch (error) {
      if (isPortableProjectCanceledError(error)) return { ok: false, canceled: true, error: error.message }
      return { ok: false, error: error instanceof Error ? error.message : '便携项目导出失败' }
    } finally {
      if (activePortableOperations.get(senderId)?.controller === controller) activePortableOperations.delete(senderId)
    }
  })

  ipcMain.handle('portable-project:choose-import', async (event) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(owner, {
        title: '选择 .manju-bundle 便携项目文件夹',
        defaultPath: app.getPath('documents'),
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
      const inspection = await inspectPortableProjectFolder({ bundleRoot: path.resolve(result.filePaths[0]) })
      const token = inspection.compatibility.canImport
        ? createPortabilityToken(portableImportInspections, event.sender.id, { inspection })
        : ''
      return {
        ok: true,
        token,
        summary: inspection.publicSummary,
        compatibility: inspection.compatibility,
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '便携项目检查失败' }
    }
  })

  ipcMain.handle('portable-project:run-import', async (event, request) => {
    const senderId = event.sender.id
    if (activePortableOperations.has(senderId)) return { ok: false, error: '已有便携项目操作正在进行' }
    const controller = new AbortController()
    let importedProjectPath = ''
    let importedProjectLocalId = ''
    let importEntry = null
    try {
      const entry = readPortabilityToken(portableImportInspections, senderId, request?.token, '导入检查')
      importEntry = entry
      if (!entry.inspection?.compatibility?.canImport) throw new Error('当前便携格式不允许导入')
      activePortableOperations.set(senderId, { controller, kind: 'import' })
      const imported = await importPortableProjectAsCopy({
        inspection: entry.inspection,
        mediaRoot: getShotVideoMediaRoot(),
        displayName: request?.displayName,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) event.sender.send('portable-project:progress', { operation: 'import', ...progress })
        },
      })
      importedProjectLocalId = imported.snapshot.project.localProjectId
      await mkdir(getPortableImportDirectory(), { recursive: true })
      importedProjectPath = path.join(getPortableImportDirectory(), `${imported.snapshot.project.localProjectId}.manju`)
      await writeFile(importedProjectPath, serializeProject(imported.snapshot), { encoding: 'utf8', flag: 'wx' })
      authorizedProjectPaths.add(path.resolve(importedProjectPath))
      const recents = await updateRecentProjects(importedProjectPath, imported.snapshot)
      await appendPortableMigrationAudit({
        inspection: entry.inspection,
        imported,
        outcome: 'success',
      }).catch(() => undefined)
      portableImportInspections.delete(String(request?.token || ''))
      return {
        ok: true,
        snapshot: imported.snapshot,
        path: importedProjectPath,
        recents,
        videoAssetCount: imported.videoAssetCount,
        totalBytes: imported.totalBytes,
        migration: imported.migration,
      }
    } catch (error) {
      if (importedProjectPath) await unlink(importedProjectPath).catch(() => undefined)
      if (importedProjectLocalId) {
        const mediaRoot = path.resolve(getShotVideoMediaRoot())
        const importedMediaPath = path.resolve(mediaRoot, createShotVideoProjectKey(importedProjectLocalId))
        if (path.dirname(importedMediaPath) === mediaRoot) {
          await rm(importedMediaPath, { recursive: true, force: true }).catch(() => undefined)
        }
      }
      if (importEntry?.inspection) {
        await appendPortableMigrationAudit({
          inspection: importEntry.inspection,
          outcome: isPortableProjectCanceledError(error) ? 'canceled' : 'failed',
          errorCode: error?.code || 'PORTABLE_IMPORT_FAILED',
        }).catch(() => undefined)
      }
      if (isPortableProjectCanceledError(error)) return { ok: false, canceled: true, error: error.message }
      return { ok: false, error: error instanceof Error ? error.message : '便携项目导入失败' }
    } finally {
      if (activePortableOperations.get(senderId)?.controller === controller) activePortableOperations.delete(senderId)
    }
  })

  ipcMain.handle('portable-project:cancel', (event) => {
    const active = activePortableOperations.get(event.sender.id)
    if (!active) return { ok: false, error: '当前没有正在进行的便携项目操作' }
    active.controller.abort()
    return { ok: true }
  })

  ipcMain.handle('portable-project:reveal', async (event, request) => {
    try {
      const entry = readPortabilityToken(portableRevealTargets, event.sender.id, request?.token, '导出结果')
      const info = await stat(entry.targetPath)
      if (!info.isDirectory()) throw new Error('导出文件夹已被移动或删除')
      shell.showItemInFolder(entry.targetPath)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法打开导出位置' }
    }
  })

  ipcMain.handle('managed-media:scan', async (event, request) => {
    try {
      const currentSnapshot = validateProjectSnapshot(request?.snapshot)
      const projectLocalId = currentSnapshot.project.localProjectId
      const recoveryKey = String(request?.recoveryKey || projectLocalId || currentSnapshot.project.name)
      const { autosaveSnapshot, recoverySnapshots } = await readCleanupSnapshots(projectLocalId, recoveryKey)
      const scan = await scanManagedProjectMedia({
        mediaRoot: getShotVideoMediaRoot(),
        projectLocalId,
        currentSnapshot,
        autosaveSnapshot,
        recoverySnapshots,
        writeBusy: activeShotVideoPreparations.has(event.sender.id) || activePortableOperations.has(event.sender.id),
      })
      const token = createPortabilityToken(managedMediaScans, event.sender.id, { projectLocalId, recoveryKey })
      return { ok: true, token, records: scan.records, summary: scan.summary, writeBusy: scan.writeBusy }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '托管媒体扫描失败' }
    }
  })

  ipcMain.handle('managed-media:trash', async (event, request) => {
    try {
      const entry = readPortabilityToken(managedMediaScans, event.sender.id, request?.token, '媒体扫描')
      const currentSnapshot = validateProjectSnapshot(request?.snapshot)
      if (currentSnapshot.project.localProjectId !== entry.projectLocalId) throw new Error('当前项目已变化，请重新扫描')
      const { autosaveSnapshot, recoverySnapshots } = await readCleanupSnapshots(entry.projectLocalId, entry.recoveryKey)
      const latestScan = await scanManagedProjectMedia({
        mediaRoot: getShotVideoMediaRoot(),
        projectLocalId: entry.projectLocalId,
        currentSnapshot,
        autosaveSnapshot,
        recoverySnapshots,
        writeBusy: activeShotVideoPreparations.has(event.sender.id) || activePortableOperations.has(event.sender.id),
      })
      const result = await trashEligibleManagedMedia({
        scan: latestScan,
        mediaRoot: getShotVideoMediaRoot(),
        projectLocalId: entry.projectLocalId,
        selectedAssetIds: request?.assetIds,
        trashItem: (targetPath) => shell.trashItem(targetPath),
      })
      await appendManagedMediaCleanupAudit({ projectLocalId: entry.projectLocalId, result }).catch(() => undefined)
      managedMediaScans.delete(String(request?.token || ''))
      return result
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '托管媒体清理失败' }
    }
  })

  ipcMain.handle('shot-video:prepare', async (event, request) => {
    const senderId = event.sender.id
    if (activeShotVideoPreparations.has(senderId)) {
      return { ok: false, error: '已有本地视频正在处理' }
    }
    const controller = new AbortController()
    try {
      const owner = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(owner, {
        title: '导入本地镜头视频',
        filters: [{ name: 'MP4 视频', extensions: ['mp4'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

      activeShotVideoPreparations.set(senderId, controller)
      const ffmpegPath = getFfmpegExecutablePath({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        projectDirectory: currentDir,
      })
      return await prepareLocalShotVideoFromPath({
        sourcePath: path.resolve(result.filePaths[0]),
        projectLocalId: request?.projectLocalId,
        mediaRoot: getShotVideoMediaRoot(),
        ffmpegPath,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) event.sender.send('shot-video:progress', progress)
        },
      })
    } catch (error) {
      if (isShotVideoAssetCanceledError(error)) {
        return { ok: false, canceled: true, error: error.message }
      }
      return { ok: false, error: error instanceof Error ? error.message : '本地视频处理失败' }
    } finally {
      if (activeShotVideoPreparations.get(senderId) === controller) {
        activeShotVideoPreparations.delete(senderId)
      }
    }
  })

  ipcMain.handle('shot-video:cancel', (event) => {
    const controller = activeShotVideoPreparations.get(event.sender.id)
    if (!controller) return { ok: false, error: '当前没有正在处理的本地视频' }
    controller.abort()
    return { ok: true }
  })

  ipcMain.handle('shot-video:discard', async (_event, request) => {
    try {
      return await discardManagedShotVideoAsset({
        mediaRoot: getShotVideoMediaRoot(),
        projectLocalId: request?.projectLocalId,
        assetId: request?.assetId,
      })
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '视频资产清理失败' }
    }
  })

  ipcMain.handle('shot-video:check', async (_event, request) => {
    const assetIds = Array.from(new Set(Array.isArray(request?.assetIds) ? request.assetIds : []))
      .filter((assetId) => typeof assetId === 'string' && assetId)
      .slice(0, 200)
    const entries = await Promise.all(assetIds.map(async (assetId) => [
      assetId,
      await inspectManagedShotVideoAsset({
        mediaRoot: getShotVideoMediaRoot(),
        projectLocalId: request?.projectLocalId,
        assetId,
      }),
    ]))
    return { ok: true, assets: Object.fromEntries(entries) }
  })

  ipcMain.handle('shot-video:reveal', async (_event, request) => {
    try {
      const projectKey = createShotVideoProjectKey(request?.projectLocalId)
      const filePath = resolveManagedShotVideoPath({
        mediaRoot: getShotVideoMediaRoot(),
        projectKey,
        assetId: request?.assetId,
      })
      const fileInfo = await stat(filePath)
      if (!fileInfo.isFile() || !fileInfo.size) throw new Error('本地视频文件已被移动或删除')
      shell.showItemInFolder(filePath)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法打开视频托管位置' }
    }
  })

  ipcMain.handle('video:export', async (event, request) => {
    const senderId = event.sender.id
    if (activeVideoExports.has(senderId)) return { ok: false, error: '已有成片正在导出' }
    const controller = new AbortController()
    activeVideoExports.set(senderId, controller)
    try {
      const items = request?.timeline?.items
      if (!Array.isArray(items) || items.length === 0) throw new Error('时间线中没有可导出的镜头')
      const projectKey = createShotVideoProjectKey(request?.projectLocalId)
      const exportItems = await Promise.all(items.map(async (item) => {
        const assetId = item?.shot?.videoAssetId
        const audioAssetId = item?.audioLine?.audioAssetId
        let nextItem = item
        try {
          if (assetId) {
            const videoFilePath = resolveManagedShotVideoPath({
              mediaRoot: getShotVideoMediaRoot(),
              projectKey,
              assetId,
            })
            const fileInfo = await stat(videoFilePath)
            if (fileInfo.isFile() && fileInfo.size) nextItem = { ...nextItem, videoFilePath }
          }
        } catch {}
        try {
          if (audioAssetId) {
            const audioFilePath = resolveManagedVoiceAssetPath({
              mediaRoot: getVoiceMediaRoot(),
              projectKey,
              assetId: audioAssetId,
            })
            const fileInfo = await stat(audioFilePath)
            if (fileInfo.isFile() && fileInfo.size) nextItem = { ...nextItem, audioFilePath }
          }
        } catch {}
        return nextItem
      }))
      const resolution = request?.resolution === '1920x1080'
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 }
      const owner = BrowserWindow.fromWebContents(event.sender)
      const projectName = sanitizeFileName(request?.projectName || '漫剧成片')
      const result = await dialog.showSaveDialog(owner, {
        title: '导出本地 MP4 成片',
        defaultPath: path.join(app.getPath('videos'), `${projectName}.mp4`),
        filters: [{ name: 'MP4 视频', extensions: ['mp4'] }],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }

      const outputPath = result.filePath.toLowerCase().endsWith('.mp4') ? result.filePath : `${result.filePath}.mp4`
      const ffmpegPath = getFfmpegExecutablePath({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        projectDirectory: currentDir,
      })
      const sendProgress = (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send('video:export-progress', progress)
      }
      const exportResult = await exportTimelineVideo({
        ffmpegPath,
        outputPath,
        items: exportItems,
        ...resolution,
        transition: request?.transition === 'cut' ? 'cut' : 'fade',
        subtitlesEnabled: request?.subtitlesEnabled !== false,
        subtitleCues: request?.subtitleCues || [],
        subtitleStyle: request?.subtitleStyle || {},
        audioTracks: request?.audioTracks || [],
        onProgress: sendProgress,
        signal: controller.signal,
      })
      const history = await appendExportHistory(getExportHistoryPath(), {
        ...exportResult,
        projectLocalId: request?.projectLocalId,
        projectName,
        resolution: request?.resolution,
        episodeId: request?.episodeId,
        episodeTitle: request?.episodeTitle,
        scope: request?.scope,
        exportedAt: new Date().toISOString(),
      })
      return { ok: true, ...exportResult, history }
    } catch (error) {
      if (isExportCanceledError(error)) return { ok: false, canceled: true, error: error.message }
      return { ok: false, error: error instanceof Error ? error.message : 'MP4 导出失败' }
    } finally {
      if (activeVideoExports.get(senderId) === controller) activeVideoExports.delete(senderId)
    }
  })

  ipcMain.handle('video:cancel-export', (event) => {
    const controller = activeVideoExports.get(event.sender.id)
    if (!controller) return { ok: false, error: '当前没有正在导出的成片' }
    controller.abort()
    return { ok: true }
  })

  ipcMain.handle('video:list-exports', async () => ({
    ok: true,
    history: await readExportHistory(getExportHistoryPath()),
  }))

  ipcMain.handle('video:prepare-export-preview', async (event, requestedPath) => {
    const entry = await findExportHistoryEntry(getExportHistoryPath(), requestedPath)
    if (!entry) return { ok: false, error: '该文件不在导出历史中' }
    if (!entry.exists) return { ok: false, error: '成片文件已被移动或删除' }
    for (const [token, target] of videoExportPreviewTargets) {
      if (target.expiresAt <= Date.now() || target.senderId === event.sender.id) {
        videoExportPreviewTargets.delete(token)
      }
    }
    const token = randomBytes(24).toString('hex')
    videoExportPreviewTargets.set(token, {
      senderId: event.sender.id,
      filePath: entry.outputPath,
      expiresAt: Date.now() + videoExportPreviewLifetimeMs,
    })
    return { ok: true, mediaUrl: `manju-media://video-export/${token}` }
  })

  ipcMain.handle('video:reveal-export', async (_event, requestedPath) => {
    const entry = await findExportHistoryEntry(getExportHistoryPath(), requestedPath)
    if (!entry) return { ok: false, error: '该文件不在导出历史中' }
    if (!entry.exists) return { ok: false, error: '成片文件已被移动或删除' }
    shell.showItemInFolder(entry.outputPath)
    return { ok: true }
  })
}

const createApplicationMenu = () => {
  const sendMenuCommand = (command) => {
    const targetWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!targetWindow || targetWindow.isDestroyed() || targetWindow.webContents.isDestroyed()) return
    targetWindow.webContents.send('menu:command', command)
  }
  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '新建项目', accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand('new') },
        { label: '打开项目…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuCommand('open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuCommand('save-as') },
        { type: 'separator' },
        { label: '导入便携项目…', accelerator: 'CmdOrCtrl+Alt+O', click: () => sendMenuCommand('portable-import') },
        { label: '导出便携项目…', accelerator: 'CmdOrCtrl+Alt+S', click: () => sendMenuCommand('portable-export') },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '关闭', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => app.showAboutPanel()
        }
      ]
    }
  ])

  Menu.setApplicationMenu(menu)
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '星幕工坊 · AI 漫剧制作',
    autoHideMenuBar: true,
    backgroundColor: '#dff5ff',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  const applicationEntry = path.join(currentDir, 'dist', 'index.html')
  const applicationUrl = pathToFileURL(applicationEntry).href
  win.loadFile(applicationEntry)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(applicationUrl)) {
      event.preventDefault()
    }
  })
}

app.whenReady().then(() => {
  protocol.handle('manju-media', async (request) => {
    try {
      const mediaUrl = new URL(request.url)
      if (mediaUrl.hostname === 'generated-image') {
        const pathParts = mediaUrl.pathname.split('/').filter(Boolean)
        if (pathParts.length !== 1) return new Response('Not found', { status: 404 })
        const asset = await resolveBailianImageAsset({
          workspaceRoot: getBailianWorkspaceRoot(),
          assetId: pathParts[0],
        })
        return net.fetch(pathToFileURL(asset.filePath).href)
      }
      if (mediaUrl.hostname === 'voice') {
        const pathParts = mediaUrl.pathname.split('/').filter(Boolean)
        if (pathParts.length !== 2 || !pathParts[1].endsWith('.wav')) {
          return new Response('Not found', { status: 404 })
        }
        const filePath = resolveManagedVoiceAssetPath({
          mediaRoot: getVoiceMediaRoot(),
          projectKey: pathParts[0],
          assetId: pathParts[1].slice(0, -4),
        })
        return net.fetch(pathToFileURL(filePath).href)
      }
      if (mediaUrl.hostname === 'video-export') {
        const pathParts = mediaUrl.pathname.split('/').filter(Boolean)
        if (pathParts.length !== 1) return new Response('Not found', { status: 404 })
        const target = videoExportPreviewTargets.get(pathParts[0])
        if (!target || target.expiresAt <= Date.now()) {
          videoExportPreviewTargets.delete(pathParts[0])
          return new Response('Not found', { status: 404 })
        }
        const fileInfo = await stat(target.filePath)
        if (!fileInfo.isFile() || !fileInfo.size || path.extname(target.filePath).toLowerCase() !== '.mp4') {
          return new Response('Not found', { status: 404 })
        }
        return net.fetch(pathToFileURL(target.filePath).href, { headers: request.headers })
      }
      if (mediaUrl.hostname !== 'shot-video') return new Response('Not found', { status: 404 })
      const pathParts = mediaUrl.pathname.split('/').filter(Boolean)
      if (pathParts.length !== 2 || !pathParts[1].endsWith('.mp4')) {
        return new Response('Not found', { status: 404 })
      }
      const filePath = resolveManagedShotVideoPath({
        mediaRoot: getShotVideoMediaRoot(),
        projectKey: pathParts[0],
        assetId: pathParts[1].slice(0, -4),
      })
      return net.fetch(pathToFileURL(filePath).href, { headers: request.headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
  registerProjectHandlers()
  createApplicationMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
