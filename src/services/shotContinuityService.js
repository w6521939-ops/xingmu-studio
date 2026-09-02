const DEFAULT_FPS = 30

export function buildShotChain(shots = []) {
  if (!shots.length) return []

  return shots.map((shot, index) => {
    const prevShot = index > 0 ? shots[index - 1] : null
    const isFirst = index === 0
    const isLast = index === shots.length - 1

    return {
      ...shot,
      chainIndex: index,
      isFirstShot: isFirst,
      isLastShot: isLast,
      continuityFrom: prevShot?.id || null,
      needsLastFrame: !isFirst && shot.continuityMode !== 'none',
      promptSuffix: prevShot
        ? ` 镜头衔接：与前一镜头尾帧画面连续，${prevShot.description || ''}`
        : '',
    }
  })
}

export function buildBatchPayload(chainedShots = [], options = {}) {
  const { providerId = 'bailian', resolution = '1080P', parallelLimit = 3 } = options

  const batches = []
  for (let i = 0; i < chainedShots.length; i += parallelLimit) {
    batches.push({
      batchIndex: Math.floor(i / parallelLimit),
      shots: chainedShots.slice(i, i + parallelLimit).map((shot) => ({
        shotId: shot.id,
        prompt: (shot.prompt || shot.description || '') + (shot.promptSuffix || ''),
        firstFrameUrl: shot.firstFrameUrl || null,
        lastFrameUrl: shot.lastFrameUrl || null,
        duration: Math.min(8, Number(shot.duration) || 5),
        resolution,
        continuityFromShotId: shot.continuityFrom,
        needsLastFrame: shot.needsLastFrame,
      })),
    })
  }

  return {
    providerId,
    totalShots: chainedShots.length,
    totalBatches: batches.length,
    parallelLimit,
    batches,
  }
}

export function extractLastFrameSpec(shotResult) {
  if (!shotResult?.videoUrl) return null
  return {
    shotId: shotResult.shotId,
    videoUrl: shotResult.videoUrl,
    timestamp: shotResult.duration || 5,
    outputFormat: 'png',
    outputWidth: 1920,
    outputHeight: 1080,
  }
}

export function applyContinuityResults(chainedShots, results = []) {
  const resultMap = new Map(results.map((r) => [r.shotId, r]))

  return chainedShots.map((shot) => {
    const result = resultMap.get(shot.id)
    if (!result) return shot

    const updated = { ...shot, result }
    if (result.lastFrameUrl) {
      updated.lastFrameUrl = result.lastFrameUrl
    }
    return updated
  })
}

export function scoreShotQuality(result) {
  if (!result?.videoUrl) return 0

  let score = 50

  if (result.duration && result.duration >= 4) score += 15
  if (result.resolution && result.resolution >= 720) score += 15
  if (result.continuityScore !== undefined) score += result.continuityScore * 0.2

  return Math.min(100, Math.max(0, Math.round(score)))
}

export function filterLowQualityShots(shots = [], threshold = 60) {
  return shots.filter((shot) => {
    if (!shot.result) return false
    return scoreShotQuality(shot.result) < threshold
  })
}
