const fallbackByKey = {
  image: '占位画面',
  audio: '静音',
  subtitle: '无字幕',
}

export const getExportReadinessIssues = (rows, { subtitlesEnabled = true } = {}) => rows
  .filter((row) => row.key !== 'subtitle' || subtitlesEnabled)
  .map((row) => ({
    ...row,
    ready: Math.max(0, Number(row.ready) || 0),
    total: Math.max(0, Number(row.total) || 0),
  }))
  .filter((row) => row.total > 0 && row.ready < row.total)
  .map((row) => ({
    ...row,
    missing: row.total - row.ready,
    fallback: fallbackByKey[row.key] || '兼容内容',
  }))
