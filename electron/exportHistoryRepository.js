import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const maxHistoryItems = 12

const normalizeEntry = (entry) => {
  const episodeId = Math.max(0, Number(entry.episodeId) || 0)
  return {
    outputPath: path.resolve(String(entry.outputPath || '')),
    projectLocalId: String(entry.projectLocalId || '').slice(0, 160),
    projectName: String(entry.projectName || '未命名漫剧').slice(0, 80),
    exportedAt: String(entry.exportedAt || new Date().toISOString()),
    duration: Math.max(0, Number(entry.duration) || 0),
    segmentCount: Math.max(0, Number(entry.segmentCount) || 0),
    mixedTrackCount: Math.max(0, Number(entry.mixedTrackCount) || 0),
    resolution: entry.resolution === '1920x1080' ? '1920x1080' : '1080x1920',
    episodeId,
    episodeTitle: String(entry.episodeTitle || '').slice(0, 80),
    scope: entry.scope === 'legacy-project' || !episodeId ? 'legacy-project' : 'episode',
  }
}

const fileExists = async (filePath) => {
  try {
    const fileInfo = await stat(filePath)
    return fileInfo.isFile()
  } catch {
    return false
  }
}

export async function readExportHistory(historyPath) {
  try {
    const parsed = JSON.parse(await readFile(historyPath, 'utf8'))
    if (!Array.isArray(parsed)) return []
    const entries = parsed
      .filter((entry) => entry?.outputPath && path.isAbsolute(entry.outputPath))
      .slice(0, maxHistoryItems)
      .map(normalizeEntry)
    return Promise.all(entries.map(async (entry) => ({ ...entry, exists: await fileExists(entry.outputPath) })))
  } catch {
    return []
  }
}

export async function appendExportHistory(historyPath, entry) {
  const normalized = normalizeEntry(entry)
  if (!normalized.outputPath || !path.isAbsolute(normalized.outputPath)) throw new Error('导出历史路径无效')
  const current = await readExportHistory(historyPath)
  const next = [
    normalized,
    ...current.filter((item) => path.resolve(item.outputPath) !== normalized.outputPath),
  ].slice(0, maxHistoryItems)
  await mkdir(path.dirname(historyPath), { recursive: true })
  await writeFile(historyPath, JSON.stringify(next, null, 2), 'utf8')
  return readExportHistory(historyPath)
}

export async function findExportHistoryEntry(historyPath, requestedPath) {
  if (!requestedPath || !path.isAbsolute(requestedPath)) return null
  const resolvedPath = path.resolve(requestedPath)
  const history = await readExportHistory(historyPath)
  return history.find((entry) => path.resolve(entry.outputPath) === resolvedPath) || null
}
