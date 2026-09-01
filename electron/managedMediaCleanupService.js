import { lstat, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from './shotVideoAssetService.js'

const safeAssetIdPattern = /^[a-z0-9][a-z0-9-]{5,79}$/u

const snapshots = (items) => (Array.isArray(items) ? items : []).filter((item) => item?.project && item?.content)

export const extractReferencedShotVideoAssetIds = (snapshot) => new Set(
  (Array.isArray(snapshot?.content?.shots) ? snapshot.content.shots : [])
    .map((shot) => String(shot?.videoAssetId || '').toLowerCase())
    .filter((assetId) => safeAssetIdPattern.test(assetId)),
)

const extractKnownShotVideoAssets = (snapshot) => new Map(
  (Array.isArray(snapshot?.content?.videoAssets) ? snapshot.content.videoAssets : [])
    .map((asset) => [String(asset?.id || '').toLowerCase(), asset])
    .filter(([assetId]) => safeAssetIdPattern.test(assetId)),
)

const mergeSet = (target, values) => {
  for (const value of values) target.add(value)
  return target
}

const publicRecord = ({ assetId, status, bytes = 0, fileName = '', reason = '' }) => ({
  assetId,
  status,
  bytes,
  fileName: String(fileName || 'video.mp4').slice(0, 160),
  reason,
  selectable: status === 'eligible',
})

export async function scanManagedProjectMedia({
  mediaRoot,
  projectLocalId,
  currentSnapshot,
  autosaveSnapshot,
  recoverySnapshots = [],
  writeBusy = false,
} = {}) {
  const localId = String(projectLocalId || currentSnapshot?.project?.localProjectId || '').trim()
  if (!localId) throw new Error('当前项目缺少本地标识')
  const projectKey = createShotVideoProjectKey(localId)
  const rootPath = path.resolve(mediaRoot)
  const projectPath = path.resolve(rootPath, projectKey)
  if (path.dirname(projectPath) !== rootPath) throw new Error('托管媒体目录越界')

  const primarySnapshots = snapshots([currentSnapshot, autosaveSnapshot])
    .filter((snapshot) => snapshot.project.localProjectId === localId)
  const protectedSnapshots = snapshots(recoverySnapshots)
    .filter((snapshot) => snapshot.project.localProjectId === localId)
  const currentReferences = primarySnapshots.reduce((set, snapshot) => mergeSet(set, extractReferencedShotVideoAssetIds(snapshot)), new Set())
  const recoveryReferences = protectedSnapshots.reduce((set, snapshot) => mergeSet(set, extractReferencedShotVideoAssetIds(snapshot)), new Set())
  const knownAssets = [...primarySnapshots, ...protectedSnapshots].reduce((map, snapshot) => {
    for (const [assetId, asset] of extractKnownShotVideoAssets(snapshot)) {
      if (!map.has(assetId)) map.set(assetId, asset)
    }
    return map
  }, new Map())

  let entries = []
  try {
    const projectInfo = await lstat(projectPath)
    if (!projectInfo.isDirectory() || projectInfo.isSymbolicLink()) throw new Error('托管媒体项目目录不是普通文件夹')
    entries = await readdir(projectPath, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        projectKey,
        writeBusy,
        records: [],
        summary: { total: 0, totalBytes: 0, eligible: 0, eligibleBytes: 0, inUse: 0, protected: 0, pending: 0, unknown: 0 },
      }
    }
    throw error
  }

  const records = []
  for (const entry of entries) {
    const assetId = entry.name.toLowerCase()
    const entryPath = path.join(projectPath, entry.name)
    const entryInfo = await lstat(entryPath)
    if (entryInfo.isSymbolicLink()) {
      records.push(publicRecord({ assetId, status: 'unknown', reason: '符号链接或目录联接不会被自动清理' }))
      continue
    }
    if (entry.name.includes('-pending')) {
      records.push(publicRecord({ assetId, status: 'pending', reason: '正在写入或遗留的暂存目录不会被自动清理' }))
      continue
    }
    if (!entryInfo.isDirectory() || !safeAssetIdPattern.test(assetId)) {
      records.push(publicRecord({ assetId, status: 'unknown', bytes: entryInfo.isFile() ? entryInfo.size : 0, reason: '无法识别的条目不会被自动清理' }))
      continue
    }

    let fileInfo
    try {
      const videoPath = resolveManagedShotVideoPath({ mediaRoot: rootPath, projectKey, assetId })
      fileInfo = await stat(videoPath)
      const children = await readdir(entryPath, { withFileTypes: true })
      if (!fileInfo.isFile() || !fileInfo.size || children.some((child) => child.name !== 'video.mp4' || !child.isFile())) {
        throw new Error('媒体目录结构不完整')
      }
    } catch {
      records.push(publicRecord({ assetId, status: 'unknown', fileName: knownAssets.get(assetId)?.fileName, reason: '媒体目录结构异常，不会自动清理' }))
      continue
    }

    const metadata = knownAssets.get(assetId)
    if (currentReferences.has(assetId)) {
      records.push(publicRecord({ assetId, status: 'in-use', bytes: fileInfo.size, fileName: metadata?.fileName, reason: '当前项目或自动保存仍在引用' }))
    } else if (recoveryReferences.has(assetId)) {
      records.push(publicRecord({ assetId, status: 'recovery-protected', bytes: fileInfo.size, fileName: metadata?.fileName, reason: '时间线恢复点仍在引用' }))
    } else if (!metadata) {
      records.push(publicRecord({ assetId, status: 'unknown', bytes: fileInfo.size, reason: '无法从项目或恢复点确认归属' }))
    } else if (writeBusy) {
      records.push(publicRecord({ assetId, status: 'pending', bytes: fileInfo.size, fileName: metadata.fileName, reason: '当前有媒体写入任务，暂不允许清理' }))
    } else {
      records.push(publicRecord({ assetId, status: 'eligible', bytes: fileInfo.size, fileName: metadata.fileName, reason: '当前项目、自动保存和恢复点均未引用' }))
    }
  }

  records.sort((left, right) => right.bytes - left.bytes || left.assetId.localeCompare(right.assetId))
  const summary = records.reduce((result, record) => {
    result.total += 1
    result.totalBytes += record.bytes
    if (record.status === 'eligible') {
      result.eligible += 1
      result.eligibleBytes += record.bytes
    } else if (record.status === 'in-use') result.inUse += 1
    else if (record.status === 'recovery-protected') result.protected += 1
    else if (record.status === 'pending') result.pending += 1
    else result.unknown += 1
    return result
  }, { total: 0, totalBytes: 0, eligible: 0, eligibleBytes: 0, inUse: 0, protected: 0, pending: 0, unknown: 0 })

  return { projectKey, writeBusy, records, summary }
}

export async function trashEligibleManagedMedia({
  scan,
  mediaRoot,
  projectLocalId,
  selectedAssetIds,
  trashItem,
} = {}) {
  if (!scan || !Array.isArray(scan.records)) throw new Error('清理扫描结果无效')
  if (scan.writeBusy) throw new Error('当前有媒体写入任务，请稍后重新扫描')
  if (typeof trashItem !== 'function') throw new Error('Windows 回收站不可用')
  const requested = new Set((Array.isArray(selectedAssetIds) ? selectedAssetIds : [])
    .map((assetId) => String(assetId || '').toLowerCase())
    .filter((assetId) => safeAssetIdPattern.test(assetId)))
  const eligible = new Set(scan.records.filter((record) => record.status === 'eligible').map((record) => record.assetId))
  const projectKey = createShotVideoProjectKey(projectLocalId)
  const rootPath = path.resolve(mediaRoot)
  const projectPath = path.resolve(rootPath, projectKey)
  const results = []

  for (const assetId of requested) {
    if (!eligible.has(assetId)) {
      results.push({ assetId, status: 'skipped', error: '重新扫描后已不再符合清理条件' })
      continue
    }
    const filePath = resolveManagedShotVideoPath({ mediaRoot: rootPath, projectKey, assetId })
    const assetPath = path.dirname(filePath)
    if (path.dirname(assetPath) !== projectPath) throw new Error('回收站目标路径越界')
    try {
      const info = await lstat(assetPath)
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('目标不是普通媒体目录')
      await trashItem(assetPath)
      results.push({ assetId, status: 'trashed' })
    } catch (error) {
      results.push({ assetId, status: 'failed', error: error instanceof Error ? error.message : '移入回收站失败' })
    }
  }

  return {
    ok: results.some((result) => result.status === 'trashed'),
    results,
    trashed: results.filter((result) => result.status === 'trashed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  }
}
