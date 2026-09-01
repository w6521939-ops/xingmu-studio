import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const isSupportedProjectSnapshot = (snapshot) => (
  snapshot
  && typeof snapshot === 'object'
  && snapshot.format === 'manju-project'
  && [1, 2].includes(snapshot.version)
  && snapshot.project
  && snapshot.content
)

export const createV1ProjectBackupBeforeOverwrite = async ({
  targetPath,
  nextSnapshot,
  maximumBytes,
  now = new Date(),
} = {}) => {
  if (nextSnapshot?.version !== 2 || !targetPath) return ''
  const resolvedTargetPath = path.resolve(targetPath)
  let sourceText = ''
  try {
    const fileInfo = await stat(resolvedTargetPath)
    if (!fileInfo.isFile() || !fileInfo.size || fileInfo.size > maximumBytes) return ''
    sourceText = await readFile(resolvedTargetPath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }

  let sourceSnapshot = null
  try {
    sourceSnapshot = JSON.parse(sourceText.replace(/^\uFEFF/u, ''))
  } catch {
    return ''
  }
  if (!isSupportedProjectSnapshot(sourceSnapshot) || sourceSnapshot.version !== 1) return ''

  const parsed = path.parse(resolvedTargetPath)
  const timestamp = now.toISOString().replace(/[:.]/gu, '-')
  const backupPath = path.join(parsed.dir, `${parsed.name}.v1-backup-${timestamp}${parsed.ext || '.manju'}`)
  if (path.dirname(path.resolve(backupPath)) !== path.dirname(resolvedTargetPath)) {
    throw new Error('V1 项目备份路径无效')
  }
  await writeFile(backupPath, sourceText, { encoding: 'utf8', flag: 'wx' })
  return backupPath
}
