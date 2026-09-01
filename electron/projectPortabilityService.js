import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  statfs,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from './shotVideoAssetService.js'
import {
  createPortableCompatibilityFailure,
  createPortableEnvelopeSummary,
  inspectPortableManifestCompatibility,
  portableProjectFormat,
  portableProjectMinimumAppVersion,
  portableProjectVersion,
  portableRequiredFeatures,
} from './portableManifestCompatibilityService.js'
import { migratePortableManifestToCurrent } from './portableManifestMigrationRegistry.js'

export {
  portableProjectFormat,
  portableProjectMinimumAppVersion,
  portableProjectVersion,
  portableRequiredFeatures,
}
export const maximumPortableProjectBytes = 10 * 1024 * 1024
export const maximumPortableManifestBytes = 256 * 1024
export const maximumPortableVideoBytes = 250 * 1024 * 1024
export const maximumPortableVideoAssets = 200

const safeAssetIdPattern = /^[a-z0-9][a-z0-9-]{5,79}$/u
const portableBundleSuffix = '.manju-bundle'

export class PortableProjectCanceledError extends Error {
  constructor() {
    super('便携项目操作已取消')
    this.name = 'PortableProjectCanceledError'
    this.code = 'PORTABLE_PROJECT_CANCELED'
  }
}

export const isPortableProjectCanceledError = (error) => error?.code === 'PORTABLE_PROJECT_CANCELED'

const abortIfNeeded = (signal) => {
  if (signal?.aborted) throw new PortableProjectCanceledError()
}

const sanitizeBundleName = (value = '未命名漫剧') => Array.from(String(value || '未命名漫剧'))
  .map((character) => character.charCodeAt(0) < 32 ? '-' : character)
  .join('')
  .replace(/[<>:"/\\|?*]/gu, '-')
  .replace(/[. ]+$/gu, '')
  .slice(0, 80) || '未命名漫剧'

const validateSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.format !== 'manju-project') {
    throw new Error('项目快照格式无效')
  }
  if (![1, 2].includes(snapshot.version) || !snapshot.project || !snapshot.content) {
    throw new Error('项目快照版本不受支持')
  }
  return snapshot
}

const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

const sha256File = async (filePath, signal) => {
  abortIfNeeded(signal)
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  const cancel = () => stream.destroy(new PortableProjectCanceledError())
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    for await (const chunk of stream) {
      abortIfNeeded(signal)
      hash.update(chunk)
    }
    return hash.digest('hex')
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

const ensurePlainDirectory = async (directoryPath, label) => {
  const info = await lstat(directoryPath)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label}不是普通文件夹`)
  return info
}

const ensurePlainFile = async (filePath, label, maximumBytes) => {
  const info = await lstat(filePath)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label}不是普通文件`)
  if (!info.size) throw new Error(`${label}为空`)
  if (info.size > maximumBytes) throw new Error(`${label}超过大小限制`)
  return info
}

const safeAssetId = (value) => {
  const id = String(value || '').toLowerCase()
  if (!safeAssetIdPattern.test(id)) throw new Error('便携项目包含无效的视频资产标识')
  return id
}

const safeRelativeVideoPath = (assetId) => `media/shot-videos/${safeAssetId(assetId)}/video.mp4`

const resolveBundleChild = (rootPath, relativePath) => {
  const normalized = String(relativePath || '').replace(/\\/gu, '/')
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('便携项目包含越界路径')
  }
  const root = path.resolve(rootPath)
  const child = path.resolve(root, ...normalized.split('/'))
  if (!child.startsWith(`${root}${path.sep}`)) throw new Error('便携项目包含越界路径')
  return child
}

const createProgressReporter = (onProgress, totalBytes) => {
  let completedBytes = 0
  return {
    add(bytes, phase, message) {
      completedBytes += bytes
      onProgress({
        phase,
        message,
        completedBytes,
        totalBytes,
        percent: totalBytes ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : 100,
      })
    },
    report(phase, message) {
      onProgress({
        phase,
        message,
        completedBytes,
        totalBytes,
        percent: totalBytes ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : 100,
      })
    },
  }
}

const copyFileWithHash = async ({ sourcePath, targetPath, expectedHash, signal, onChunk }) => {
  abortIfNeeded(signal)
  await mkdir(path.dirname(targetPath), { recursive: true })
  const hash = createHash('sha256')
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      try {
        abortIfNeeded(signal)
        hash.update(chunk)
        onChunk(chunk.length)
        callback(null, chunk)
      } catch (error) {
        callback(error)
      }
    },
  })
  const input = createReadStream(sourcePath)
  const output = createWriteStream(targetPath, { flags: 'wx' })
  const cancel = () => {
    const error = new PortableProjectCanceledError()
    input.destroy(error)
    output.destroy(error)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await pipeline(input, meter, output)
  } catch (error) {
    if (signal?.aborted || isPortableProjectCanceledError(error)) throw new PortableProjectCanceledError()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
  const actualHash = hash.digest('hex')
  if (expectedHash && actualHash !== expectedHash) throw new Error('媒体文件校验失败，源文件可能已发生变化')
  return actualHash
}

const listPlainEntries = async (directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    const info = await lstat(entryPath)
    if (info.isSymbolicLink()) throw new Error('便携项目不能包含符号链接或目录联接')
  }
  return entries
}

const getAvailableBytes = async (directoryPath) => {
  try {
    const details = await statfs(directoryPath, { bigint: true })
    return Number(details.bavail * details.bsize)
  } catch {
    return null
  }
}

export async function inspectPortableProjectExport({
  snapshot,
  serializedProject,
  mediaRoot,
  appVersion = '',
  signal,
} = {}) {
  validateSnapshot(snapshot)
  abortIfNeeded(signal)
  const projectText = typeof serializedProject === 'string' ? serializedProject : JSON.stringify(snapshot, null, 2)
  const projectBytes = Buffer.byteLength(projectText, 'utf8')
  if (!projectBytes || projectBytes > maximumPortableProjectBytes) throw new Error('项目文件超过 10 MB 限制')

  const projectLocalId = String(snapshot.project.localProjectId || '').trim()
  if (!projectLocalId) throw new Error('项目缺少本地标识，无法导出托管媒体')
  const projectKey = createShotVideoProjectKey(projectLocalId)
  const sourceAssets = Array.isArray(snapshot.content.videoAssets) ? snapshot.content.videoAssets : []
  if (sourceAssets.length > maximumPortableVideoAssets) throw new Error('便携项目最多支持 200 个镜头视频')

  const files = []
  const missingAssets = []
  for (const sourceAsset of sourceAssets) {
    abortIfNeeded(signal)
    const assetId = safeAssetId(sourceAsset?.id)
    const sourcePath = resolveManagedShotVideoPath({ mediaRoot, projectKey, assetId })
    try {
      const fileInfo = await ensurePlainFile(sourcePath, `镜头视频 ${assetId}`, maximumPortableVideoBytes)
      const sha256 = await sha256File(sourcePath, signal)
      files.push({
        assetId,
        fileName: String(sourceAsset.fileName || 'video.mp4').slice(0, 160),
        bytes: fileInfo.size,
        sha256,
        relativePath: safeRelativeVideoPath(assetId),
        sourcePath,
      })
    } catch (error) {
      missingAssets.push({
        assetId,
        fileName: String(sourceAsset?.fileName || 'video.mp4').slice(0, 160),
        reasonCode: error?.code === 'ENOENT' ? 'source-missing' : 'source-invalid',
        reason: error instanceof Error ? error.message : '本机托管副本不可用',
      })
    }
  }

  const totalBytes = projectBytes + files.reduce((sum, file) => sum + file.bytes, 0)
  return {
    snapshot,
    projectText,
    projectBytes,
    projectSha256: sha256Text(projectText),
    files,
    missingAssets,
    totalBytes,
    appVersion: String(appVersion || ''),
    publicSummary: {
      projectName: String(snapshot.project.name || '未命名漫剧'),
      bundleName: `${sanitizeBundleName(snapshot.project.name)}${portableBundleSuffix}`,
      projectBytes,
      videoAssetCount: files.length,
      videoBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      totalBytes,
      missingAssets,
      complete: missingAssets.length === 0,
    },
  }
}

export async function exportPortableProject({
  inspection,
  targetParentPath,
  allowIncomplete = false,
  signal,
  onProgress = () => undefined,
} = {}) {
  if (!inspection?.publicSummary || !inspection.projectText) throw new Error('导出预检已失效，请重新检查')
  if (inspection.missingAssets.length && !allowIncomplete) throw new Error('存在缺失的托管媒体，请确认后再导出不完整副本')
  abortIfNeeded(signal)

  const parentPath = path.resolve(String(targetParentPath || ''))
  await ensurePlainDirectory(parentPath, '导出位置')
  const bundleName = inspection.publicSummary.bundleName
  const targetPath = path.resolve(parentPath, bundleName)
  if (path.dirname(targetPath) !== parentPath) throw new Error('导出目标路径无效')
  try {
    await lstat(targetPath)
    throw new Error('目标位置已存在同名便携项目，请更换位置或先重命名')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const requiredBytes = Math.ceil(inspection.totalBytes * 1.08) + 1024 * 1024
  const availableBytes = await getAvailableBytes(parentPath)
  if (availableBytes !== null && availableBytes < requiredBytes) throw new Error('目标磁盘可用空间不足')

  const pendingName = `.${bundleName}.pending-${randomBytes(6).toString('hex')}`
  const pendingPath = path.resolve(parentPath, pendingName)
  if (path.dirname(pendingPath) !== parentPath || !path.basename(pendingPath).includes('.pending-')) {
    throw new Error('导出暂存路径无效')
  }
  const progress = createProgressReporter(onProgress, inspection.totalBytes)
  await mkdir(pendingPath, { recursive: false })
  try {
    progress.report('writing-project', '正在写入项目快照')
    const projectPath = path.join(pendingPath, 'project.manju')
    await writeFile(projectPath, inspection.projectText, { encoding: 'utf8', flag: 'wx' })
    progress.add(inspection.projectBytes, 'writing-project', '项目快照已写入')

    await mkdir(path.join(pendingPath, 'media', 'shot-videos'), { recursive: true })

    for (const file of inspection.files) {
      progress.report('copying-media', `正在复制 ${file.fileName}`)
      await copyFileWithHash({
        sourcePath: file.sourcePath,
        targetPath: resolveBundleChild(pendingPath, file.relativePath),
        expectedHash: file.sha256,
        signal,
        onChunk: (bytes) => progress.add(bytes, 'copying-media', `正在复制 ${file.fileName}`),
      })
    }

    abortIfNeeded(signal)
    progress.report('writing-manifest', '正在写入并验证清单')
    const manifest = {
      format: portableProjectFormat,
      version: portableProjectVersion,
      createdAt: new Date().toISOString(),
      appVersion: inspection.appVersion,
      compatibility: {
        minimumAppVersion: portableProjectMinimumAppVersion,
        requiredFeatures: [...portableRequiredFeatures],
        optionalFeatures: [],
      },
      projectSchemaVersion: Number(inspection.snapshot.version) || 2,
      mediaSchemaVersion: 1,
      project: {
        name: inspection.publicSummary.projectName,
        sourceLocalProjectId: String(inspection.snapshot.project.localProjectId || ''),
      },
      projectFile: {
        path: 'project.manju',
        bytes: inspection.projectBytes,
        sha256: inspection.projectSha256,
      },
      media: inspection.files.map(({ assetId, fileName, bytes, sha256, relativePath }) => ({
        kind: 'shot-video',
        assetId,
        fileName,
        path: relativePath,
        bytes,
        sha256,
      })),
      missingMedia: inspection.missingAssets,
      complete: inspection.missingAssets.length === 0,
    }
    const manifestText = JSON.stringify(manifest, null, 2)
    if (Buffer.byteLength(manifestText, 'utf8') > maximumPortableManifestBytes) throw new Error('便携项目清单超过 256 KB 限制')
    await writeFile(path.join(pendingPath, 'manifest.json'), manifestText, { encoding: 'utf8', flag: 'wx' })
    await writeFile(path.join(pendingPath, 'README.txt'), [
      '星幕工坊便携项目',
      '',
      '请使用“文件 → 导入便携项目”打开整个 .manju-bundle 文件夹。',
      '不要单独移动、替换或编辑其中的 manifest.json、project.manju 和 media 文件。',
      manifest.complete ? '完整性：项目快照与全部托管镜头视频均已包含。' : '完整性：部分托管镜头视频缺失，导入后相关镜头会回退到分镜图。',
    ].join('\r\n'), { encoding: 'utf8', flag: 'wx' })

    const verifiedProjectHash = await sha256File(projectPath, signal)
    if (verifiedProjectHash !== inspection.projectSha256) throw new Error('项目文件写入校验失败')
    await rename(pendingPath, targetPath)
    onProgress({
      phase: 'complete',
      message: '便携项目导出完成',
      completedBytes: inspection.totalBytes,
      totalBytes: inspection.totalBytes,
      percent: 100,
    })
    return {
      ok: true,
      outputPath: targetPath,
      bundleName,
      complete: manifest.complete,
      totalBytes: inspection.totalBytes,
      videoAssetCount: inspection.files.length,
    }
  } catch (error) {
    await rm(pendingPath, { recursive: true, force: true }).catch(() => undefined)
    if (signal?.aborted || isPortableProjectCanceledError(error)) throw new PortableProjectCanceledError()
    throw error
  }
}

export async function inspectPortableProjectEnvelope({ bundleRoot, signal } = {}) {
  abortIfNeeded(signal)
  const rootPath = path.resolve(String(bundleRoot || ''))
  await ensurePlainDirectory(rootPath, '便携项目')
  if (!path.basename(rootPath).toLowerCase().endsWith(portableBundleSuffix)) {
    throw new Error('请选择 .manju-bundle 便携项目文件夹')
  }
  const manifestPath = path.join(rootPath, 'manifest.json')
  let manifest = null
  let manifestText = ''
  let manifestInfo = null
  let compatibility = null
  try {
    manifestInfo = await ensurePlainFile(manifestPath, 'manifest.json', maximumPortableManifestBytes)
    manifestText = await readFile(manifestPath, 'utf8')
    try {
      manifest = JSON.parse(manifestText.replace(/^\uFEFF/u, ''))
      compatibility = inspectPortableManifestCompatibility(manifest)
    } catch (error) {
      compatibility = createPortableCompatibilityFailure({
        code: 'MANIFEST_JSON_INVALID',
        message: error instanceof Error ? `manifest JSON 无法解析：${error.message}` : 'manifest JSON 无法解析',
      })
    }
  } catch (error) {
    compatibility = createPortableCompatibilityFailure({
      code: error?.code === 'ENOENT' ? 'MANIFEST_MISSING' : 'MANIFEST_READ_FAILED',
      message: error instanceof Error ? error.message : 'manifest 无法读取',
    })
  }
  const publicSummary = {
    ...createPortableEnvelopeSummary({ bundleName: path.basename(rootPath), manifest }),
    compatibility,
  }
  return {
    rootPath,
    manifestPath,
    sourceManifest: manifest,
    sourceManifestText: manifestText,
    sourceFingerprint: manifestInfo ? {
      bytes: manifestInfo.size,
      mtimeMs: manifestInfo.mtimeMs,
      sha256: sha256Text(manifestText),
    } : null,
    compatibility,
    publicSummary,
    envelopeOnly: true,
  }
}

export async function inspectPortableProjectFolder({ bundleRoot, signal } = {}) {
  const envelope = await inspectPortableProjectEnvelope({ bundleRoot, signal })
  if (!envelope.compatibility.canImport) return envelope
  const { rootPath } = envelope
  abortIfNeeded(signal)

  const rootEntries = await listPlainEntries(rootPath)
  const allowedRootEntries = new Set(['manifest.json', 'project.manju', 'README.txt', 'media'])
  const unexpectedRootEntry = rootEntries.find((entry) => !allowedRootEntries.has(entry.name))
  if (unexpectedRootEntry) throw new Error(`便携项目包含未知条目：${unexpectedRootEntry.name}`)

  const projectPath = path.join(rootPath, 'project.manju')
  const readmePath = path.join(rootPath, 'README.txt')
  const projectInfo = await ensurePlainFile(projectPath, 'project.manju', maximumPortableProjectBytes)
  await ensurePlainFile(readmePath, 'README.txt', 64 * 1024)
  const migration = migratePortableManifestToCurrent(envelope.sourceManifest)
  const manifest = migration.manifest
  if (manifest.projectFile?.path !== 'project.manju') throw new Error('便携项目清单中的项目路径无效')
  if (Number(manifest.projectFile?.bytes) !== projectInfo.size) throw new Error('项目文件大小与清单不一致')

  const projectText = (await readFile(projectPath, 'utf8')).replace(/^\uFEFF/u, '')
  const snapshot = validateSnapshot(JSON.parse(projectText))
  if (sha256Text(projectText) !== manifest.projectFile.sha256) throw new Error('项目文件 SHA-256 校验失败')
  const media = Array.isArray(manifest.media) ? manifest.media : []
  if (media.length > maximumPortableVideoAssets) throw new Error('便携项目中的镜头视频数量超过限制')

  const assetIds = new Set()
  const files = []
  let videoBytes = 0
  for (const item of media) {
    abortIfNeeded(signal)
    if (item?.kind !== 'shot-video') throw new Error('便携项目包含不受支持的媒体类型')
    const assetId = safeAssetId(item.assetId)
    if (assetIds.has(assetId)) throw new Error('便携项目包含重复的视频资产标识')
    assetIds.add(assetId)
    const expectedRelativePath = safeRelativeVideoPath(assetId)
    if (item.path !== expectedRelativePath) throw new Error('便携项目中的媒体路径与资产标识不一致')
    const sourcePath = resolveBundleChild(rootPath, item.path)
    const fileInfo = await ensurePlainFile(sourcePath, `镜头视频 ${assetId}`, maximumPortableVideoBytes)
    if (Number(item.bytes) !== fileInfo.size) throw new Error(`镜头视频 ${assetId} 大小与清单不一致`)
    const actualHash = await sha256File(sourcePath, signal)
    if (actualHash !== item.sha256) throw new Error(`镜头视频 ${assetId} SHA-256 校验失败`)
    videoBytes += fileInfo.size
    files.push({
      assetId,
      fileName: String(item.fileName || 'video.mp4').slice(0, 160),
      bytes: fileInfo.size,
      sha256: actualHash,
      relativePath: expectedRelativePath,
      sourcePath,
    })
  }

  const snapshotAssets = Array.isArray(snapshot.content.videoAssets) ? snapshot.content.videoAssets : []
  const snapshotAssetIds = new Set(snapshotAssets.map((asset) => safeAssetId(asset?.id)))
  const missingMedia = Array.isArray(manifest.missingMedia) ? manifest.missingMedia : []
  const declaredMissingIds = new Set(missingMedia.map((item) => safeAssetId(item?.assetId)))
  for (const id of snapshotAssetIds) {
    if (!assetIds.has(id) && !declaredMissingIds.has(id)) throw new Error(`项目引用的视频资产 ${id} 未包含在便携项目清单中`)
  }
  for (const id of assetIds) {
    if (!snapshotAssetIds.has(id)) throw new Error(`便携项目包含项目快照未登记的视频资产 ${id}`)
  }

  const mediaRootPath = path.join(rootPath, 'media')
  if (rootEntries.some((entry) => entry.name === 'media')) {
    await ensurePlainDirectory(mediaRootPath, 'media')
    const mediaEntries = await listPlainEntries(mediaRootPath)
    if (mediaEntries.some((entry) => entry.name !== 'shot-videos')) throw new Error('media 文件夹包含未知条目')
    const shotVideosPath = path.join(mediaRootPath, 'shot-videos')
    if (mediaEntries.some((entry) => entry.name === 'shot-videos')) {
      await ensurePlainDirectory(shotVideosPath, 'media/shot-videos')
      const assetEntries = await listPlainEntries(shotVideosPath)
      for (const entry of assetEntries) {
        if (!entry.isDirectory() || !assetIds.has(entry.name)) throw new Error(`发现未登记的媒体目录：${entry.name}`)
        const directoryPath = path.join(shotVideosPath, entry.name)
        const children = await listPlainEntries(directoryPath)
        if (children.length !== 1 || children[0].name !== 'video.mp4' || !children[0].isFile()) {
          throw new Error(`媒体目录 ${entry.name} 的结构无效`)
        }
      }
    } else if (files.length) {
      throw new Error('便携项目缺少 media/shot-videos 文件夹')
    }
  } else if (files.length) {
    throw new Error('便携项目缺少 media 文件夹')
  }

  return {
    ...envelope,
    snapshot,
    projectText,
    files,
    manifest,
    migration: {
      sourceVersion: envelope.compatibility.sourceVersion,
      targetVersion: portableProjectVersion,
      steps: migration.steps,
    },
    projectBytes: projectInfo.size,
    totalBytes: projectInfo.size + videoBytes,
    envelopeOnly: false,
    publicSummary: {
      bundleName: path.basename(rootPath),
      projectName: String(snapshot.project.name || '未命名漫剧'),
      projectBytes: projectInfo.size,
      videoAssetCount: files.length,
      videoBytes,
      totalBytes: projectInfo.size + videoBytes,
      missingAssets: missingMedia.map((item) => ({
        assetId: String(item.assetId || ''),
        fileName: String(item.fileName || 'video.mp4').slice(0, 160),
        reason: String(item.reason || '导出时本机托管副本不可用').slice(0, 200),
      })),
      complete: missingMedia.length === 0 && manifest.complete !== false,
      createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt : '',
      appVersion: typeof manifest.appVersion === 'string' ? manifest.appVersion : '',
      compatibility: envelope.compatibility,
    },
  }
}

export async function verifyPortableProjectInspectionSource(inspection, signal) {
  abortIfNeeded(signal)
  if (!inspection?.manifestPath || !inspection.sourceFingerprint) {
    throw new Error('导入检查已失效，请重新选择便携项目')
  }
  const manifestInfo = await ensurePlainFile(inspection.manifestPath, 'manifest.json', maximumPortableManifestBytes)
  const manifestText = await readFile(inspection.manifestPath, 'utf8')
  const fingerprint = inspection.sourceFingerprint
  if (manifestInfo.size !== fingerprint.bytes
    || manifestInfo.mtimeMs !== fingerprint.mtimeMs
    || sha256Text(manifestText) !== fingerprint.sha256) {
    const error = new Error('便携项目在验证后发生变化，请重新选择并检查')
    error.code = 'PORTABLE_SOURCE_CHANGED'
    throw error
  }
  return true
}

export async function importPortableProjectAsCopy({
  inspection,
  mediaRoot,
  displayName,
  signal,
  onProgress = () => undefined,
} = {}) {
  if (!inspection?.snapshot || !Array.isArray(inspection.files)) throw new Error('导入检查已失效，请重新选择便携项目')
  const name = String(displayName || inspection.snapshot.project.name || '').trim()
  if (!name) throw new Error('导入项目名称不能为空')
  if (Array.from(name).some((character) => {
    const code = character.codePointAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
  })) throw new Error('导入项目名称包含不可用的控制字符')
  if (Array.from(name).length > 80) throw new Error('导入项目名称最多 80 个字符')
  abortIfNeeded(signal)

  const sourceVersion = Number(inspection.compatibility?.sourceVersion || portableProjectVersion)
  const migrationSteps = Array.isArray(inspection.migration?.steps) ? inspection.migration.steps : []
  onProgress({
    phase: 'validating-source',
    progressKind: 'steps',
    message: '正在确认来源便携包未发生变化',
    currentStep: 1,
    totalSteps: Math.max(1, migrationSteps.length),
  })
  await verifyPortableProjectInspectionSource(inspection, signal)
  if (sourceVersion < portableProjectVersion) {
    const replayedMigration = migratePortableManifestToCurrent(inspection.sourceManifest)
    if (JSON.stringify(replayedMigration.manifest) !== JSON.stringify(inspection.manifest)) {
      throw new Error('旧版迁移结果不稳定，已停止导入')
    }
    migrationSteps.forEach((step, index) => onProgress({
      phase: 'migrating-manifest',
      progressKind: 'steps',
      message: step.label,
      currentStep: index + 1,
      totalSteps: migrationSteps.length,
    }))
  }

  const localProjectId = `local-${randomUUID()}`
  const projectKey = createShotVideoProjectKey(localProjectId)
  const rootPath = path.resolve(mediaRoot)
  const targetPath = path.resolve(rootPath, projectKey)
  const pendingPath = path.resolve(rootPath, `${projectKey}-pending-${randomBytes(5).toString('hex')}`)
  if (path.dirname(targetPath) !== rootPath || path.dirname(pendingPath) !== rootPath) throw new Error('导入媒体路径越界')
  await mkdir(rootPath, { recursive: true })
  try {
    await lstat(targetPath)
    throw new Error('导入项目的本地媒体目录已存在，请重试')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const availableBytes = await getAvailableBytes(rootPath)
  const requiredBytes = Math.ceil(inspection.files.reduce((sum, file) => sum + file.bytes, 0) * 1.08) + 1024 * 1024
  if (availableBytes !== null && availableBytes < requiredBytes) throw new Error('应用数据磁盘可用空间不足')

  const totalBytes = inspection.files.reduce((sum, file) => sum + file.bytes, 0)
  const progress = createProgressReporter(onProgress, totalBytes)
  await mkdir(pendingPath, { recursive: false })
  try {
    for (const file of inspection.files) {
      progress.report('copying-media', `正在导入 ${file.fileName}`)
      const destination = resolveManagedShotVideoPath({ mediaRoot: pendingPath, projectKey: 'import-stage', assetId: file.assetId })
      await copyFileWithHash({
        sourcePath: file.sourcePath,
        targetPath: destination,
        expectedHash: file.sha256,
        signal,
        onChunk: (bytes) => progress.add(bytes, 'copying-media', `正在导入 ${file.fileName}`),
      })
    }

    const stagedProjectDirectory = path.join(pendingPath, 'import-stage')
    if (inspection.files.length) {
      await rename(stagedProjectDirectory, targetPath)
      await rm(pendingPath, { recursive: true, force: true })
    } else {
      await rm(pendingPath, { recursive: true, force: true })
      await mkdir(targetPath, { recursive: false })
    }
    const importedAt = new Date().toISOString()
    const snapshot = {
      ...inspection.snapshot,
      savedAt: importedAt,
      project: {
        ...inspection.snapshot.project,
        localProjectId,
        name,
      },
    }
    onProgress({
      phase: 'complete',
      message: '便携项目已作为新副本导入',
      completedBytes: totalBytes,
      totalBytes,
      percent: 100,
    })
    return {
      ok: true,
      snapshot,
      projectKey,
      videoAssetCount: inspection.files.length,
      totalBytes,
      migration: {
        sourceVersion,
        targetVersion: portableProjectVersion,
        steps: migrationSteps.map((step) => ({ id: step.id, label: step.label })),
        sourceUntouched: true,
      },
    }
  } catch (error) {
    await rm(pendingPath, { recursive: true, force: true }).catch(() => undefined)
    await rm(targetPath, { recursive: true, force: true }).catch(() => undefined)
    if (signal?.aborted || isPortableProjectCanceledError(error)) throw new PortableProjectCanceledError()
    throw error
  }
}
