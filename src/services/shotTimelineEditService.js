import { normalizeSubtitleCues } from './subtitleService.js'
import {
  normalizeShotMotionRange,
  normalizeShotMotionSettings,
  normalizeShotTransitionEdges,
} from './shotMotionService.js'
import { pruneInvalidShotVideoContinuity } from './shotVideoAssetService.js'

export const minimumShotDuration = 0.5
export const maximumShotDuration = 30

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0))
const shotKey = (value) => String(value ?? '')

const cloneTimelineValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneTimelineValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, cloneTimelineValue(nestedValue)]))
  }
  return value
}

const createNumericIdAllocator = (items = []) => {
  const usedIds = new Set(items.map((item) => shotKey(item?.id)))
  let nextId = items.reduce((maximum, item) => {
    const candidate = Number(item?.id)
    return Number.isFinite(candidate) ? Math.max(maximum, Math.floor(candidate)) : maximum
  }, 0) + 1
  return () => {
    while (usedIds.has(shotKey(nextId))) nextId += 1
    const allocated = nextId
    usedIds.add(shotKey(allocated))
    nextId += 1
    return allocated
  }
}

const createStringIdAllocator = (items = [], namespace = 'copy') => {
  const usedIds = new Set(items.map((item) => shotKey(item?.id)))
  let sequence = 1
  return () => {
    let candidate = `${namespace}-${sequence}`
    while (usedIds.has(candidate)) {
      sequence += 1
      candidate = `${namespace}-${sequence}`
    }
    usedIds.add(candidate)
    sequence += 1
    return candidate
  }
}

const createTimelineItemsFromShots = (shots = []) => {
  let cursor = 0
  return shots.map((shot, index) => {
    const duration = normalizeShotDuration(shot.duration)
    const start = cursor
    const end = start + duration
    cursor = end
    return {
      id: stableTimelineItemId(shot.id),
      index,
      shot,
      start,
      duration,
      end,
    }
  })
}

export function normalizeShotDuration(value, fallback = 3) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  const resolved = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  return Number(clamp(resolved, minimumShotDuration, maximumShotDuration).toFixed(1))
}

export function formatShotDuration(value) {
  return `${normalizeShotDuration(value).toFixed(1)}s`
}

export function stableTimelineItemId(shotId) {
  return `timeline-${shotId}`
}

export function normalizeShotSelection(shots = [], selectedShotIds = []) {
  const selectedKeys = new Set(selectedShotIds.map(shotKey))
  return shots.filter((shot) => selectedKeys.has(shotKey(shot.id))).map((shot) => shot.id)
}

export function toggleShotSelection(selectedShotIds = [], shotId) {
  const targetKey = shotKey(shotId)
  const exists = selectedShotIds.some((id) => shotKey(id) === targetKey)
  return exists
    ? selectedShotIds.filter((id) => shotKey(id) !== targetKey)
    : [...selectedShotIds, shotId]
}

export function selectShotRange(shots = [], anchorShotId, targetShotId, selectedShotIds = [], append = false) {
  const anchorIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(anchorShotId))
  const targetIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(targetShotId))
  if (anchorIndex < 0 || targetIndex < 0) return normalizeShotSelection(shots, selectedShotIds)
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  const rangeIds = shots.slice(start, end + 1).map((shot) => shot.id)
  return normalizeShotSelection(shots, append ? [...selectedShotIds, ...rangeIds] : rangeIds)
}

export function applyBatchShotEdits(shots = [], selectedShotIds = [], edits = {}) {
  const selectedKeys = new Set(normalizeShotSelection(shots, selectedShotIds).map(shotKey))
  if (!selectedKeys.size) return shots
  const hasDuration = edits.duration !== undefined && edits.duration !== null && edits.duration !== ''
  const motionChanges = Object.fromEntries([
    ['motionEffect', edits.motionEffect],
    ['motionStrength', edits.motionStrength],
    ['transition', edits.transition],
    ['transitionDuration', edits.transitionDuration],
  ].filter(([, value]) => value !== undefined && value !== null && value !== ''))
  if (!hasDuration && !Object.keys(motionChanges).length) return shots

  let changed = false
  const nextShots = shots.map((shot) => {
    if (!selectedKeys.has(shotKey(shot.id))) return shot
    const nextShot = {
      ...shot,
      ...(hasDuration ? { duration: formatShotDuration(edits.duration) } : {}),
      ...(Object.keys(motionChanges).length
        ? normalizeShotMotionSettings({ ...shot, ...motionChanges })
        : {}),
      ...(motionChanges.motionEffect !== undefined ? { motionRangeStart: 0, motionRangeEnd: 1 } : {}),
      ...(motionChanges.transition !== undefined
        ? { transitionIn: motionChanges.transition, transitionOut: motionChanges.transition }
        : {}),
    }
    const before = JSON.stringify({
      duration: shot.duration,
      ...normalizeShotMotionSettings(shot),
      ...normalizeShotMotionRange(shot),
      ...normalizeShotTransitionEdges(shot),
    })
    const after = JSON.stringify({
      duration: nextShot.duration,
      ...normalizeShotMotionSettings(nextShot),
      ...normalizeShotMotionRange(nextShot),
      ...normalizeShotTransitionEdges(nextShot),
    })
    if (before !== after) changed = true
    return before === after ? shot : nextShot
  })
  return changed ? nextShots : shots
}

export function moveShotToIndex(shots = [], shotId, requestedIndex) {
  const sourceIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(shotId))
  if (sourceIndex < 0 || shots.length < 2) return shots
  const targetIndex = Math.min(shots.length - 1, Math.max(0, Math.round(Number(requestedIndex) || 0)))
  if (targetIndex === sourceIndex) return shots
  const next = [...shots]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return pruneInvalidShotVideoContinuity(next)
}

export function reorderShotsByInsertion(shots = [], shotId, insertionIndex) {
  const sourceIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(shotId))
  if (sourceIndex < 0 || shots.length < 2) return shots
  const boundedInsertion = Math.min(shots.length, Math.max(0, Math.round(Number(insertionIndex) || 0)))
  const targetIndex = Math.min(shots.length - 1, boundedInsertion > sourceIndex ? boundedInsertion - 1 : boundedInsertion)
  return moveShotToIndex(shots, shotId, targetIndex)
}

export function getShotGroupInsertionIndex(shots = [], selectedShotIds = []) {
  const normalizedIds = normalizeShotSelection(shots, selectedShotIds)
  if (!normalizedIds.length) return 0
  const selectedKeys = new Set(normalizedIds.map(shotKey))
  const firstSelectedIndex = shots.findIndex((shot) => selectedKeys.has(shotKey(shot.id)))
  return shots.slice(0, Math.max(0, firstSelectedIndex))
    .filter((shot) => !selectedKeys.has(shotKey(shot.id))).length
}

export function reorderShotGroupByInsertion(shots = [], selectedShotIds = [], insertionIndex = 0) {
  const normalizedIds = normalizeShotSelection(shots, selectedShotIds)
  if (!normalizedIds.length) return shots
  const selectedKeys = new Set(normalizedIds.map(shotKey))
  const group = shots.filter((shot) => selectedKeys.has(shotKey(shot.id)))
  const remaining = shots.filter((shot) => !selectedKeys.has(shotKey(shot.id)))
  const targetIndex = Math.min(remaining.length, Math.max(0, Math.round(Number(insertionIndex) || 0)))
  const next = [...remaining.slice(0, targetIndex), ...group, ...remaining.slice(targetIndex)]
  return next.every((shot, index) => shot === shots[index]) ? shots : pruneInvalidShotVideoContinuity(next)
}

export function moveShotGroupByStep(shots = [], selectedShotIds = [], direction = 0) {
  const normalizedIds = normalizeShotSelection(shots, selectedShotIds)
  if (!normalizedIds.length || normalizedIds.length === shots.length) return shots
  const selectedKeys = new Set(normalizedIds.map(shotKey))
  const remainingCount = shots.filter((shot) => !selectedKeys.has(shotKey(shot.id))).length
  const currentIndex = getShotGroupInsertionIndex(shots, normalizedIds)
  const targetIndex = Math.min(remainingCount, Math.max(0, currentIndex + (Number(direction) < 0 ? -1 : 1)))
  if (targetIndex === currentIndex) return shots
  return reorderShotGroupByInsertion(shots, normalizedIds, targetIndex)
}

const findItemByShotId = (items, shotId) => items.find((item) => shotKey(item.shot?.id) === shotKey(shotId)) || null

const findSourceItem = (items, sourceItemId) => {
  const source = String(sourceItemId || '')
  if (!source) return null
  return items.find((item) => item.id === source)
    || items.find((item) => source === stableTimelineItemId(item.shot?.id)
      || source.startsWith(`${stableTimelineItemId(item.shot?.id)}-`))
    || null
}

const findBestOverlapItem = (items, startValue, endValue) => {
  if (!items.length) return null
  const start = Math.max(0, Number(startValue) || 0)
  const end = Math.max(start, Number(endValue) || start)
  const midpoint = start + (end - start) / 2
  let bestItem = null
  let bestOverlap = -1
  items.forEach((item) => {
    const overlap = Math.max(0, Math.min(end, item.end) - Math.max(start, item.start))
    if (overlap > bestOverlap) {
      bestItem = item
      bestOverlap = overlap
    } else if (overlap === bestOverlap && midpoint >= item.start && midpoint < item.end) {
      bestItem = item
    }
  })
  if (bestOverlap > 0) return bestItem
  return items.find((item) => midpoint >= item.start && midpoint < item.end)
    || items.reduce((nearest, item) => (
      Math.abs(item.start - midpoint) < Math.abs(nearest.start - midpoint) ? item : nearest
    ), items[0])
}

const createShotDeletionContext = (shots = [], selectedShotIds = [], previousItems = []) => {
  const targetIds = normalizeShotSelection(shots, selectedShotIds)
  const targetKeys = new Set(targetIds.map(shotKey))
  const removedShots = shots.filter((shot) => targetKeys.has(shotKey(shot.id)))
  const remainingShots = shots.filter((shot) => !targetKeys.has(shotKey(shot.id)))
  const removedItems = previousItems.filter((item) => targetKeys.has(shotKey(item.shot?.id)))
  const keptItems = previousItems.filter((item) => !targetKeys.has(shotKey(item.shot?.id)))
  return { targetIds, targetKeys, removedShots, remainingShots, removedItems, keptItems }
}

const cueKeptOverlap = (cue, keptItems) => keptItems.reduce((total, item) => (
  total + Math.max(0, Math.min(Number(cue.end) || 0, item.end) - Math.max(Number(cue.start) || 0, item.start))
), 0)

const compressDeletedTime = (value, removedItems, nextTotalDuration) => {
  const time = Math.max(0, Number(value) || 0)
  const removedBefore = removedItems.reduce((total, item) => {
    if (time >= item.end) return total + item.duration
    if (time > item.start) return total + time - item.start
    return total
  }, 0)
  return Number(clamp(time - removedBefore, 0, nextTotalDuration).toFixed(3))
}

const cueWillBeRemoved = (cue, context) => {
  const sourceItem = findSourceItem(context.removedItems, cue.sourceItemId)
  if (sourceItem) return true
  if (cue.sourceItemId && findSourceItem(context.keptItems, cue.sourceItemId)) return false
  return cueKeptOverlap(cue, context.keptItems) < 0.1
}

const sfxWillBeRemoved = (track, context) => {
  if (track.kind !== 'sfx') return false
  if (!context.keptItems.length) return true
  const owner = findBestOverlapItem([...context.keptItems, ...context.removedItems], track.start, Number(track.start) + 0.001)
  return Boolean(owner && context.targetKeys.has(shotKey(owner.shot?.id)))
}

const resolveFocusAfterDeletion = (shots, targetKeys, focusShotId) => {
  const focusedIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(focusShotId))
  if (focusedIndex >= 0 && !targetKeys.has(shotKey(shots[focusedIndex].id))) return shots[focusedIndex].id
  const firstRemovedIndex = shots.findIndex((shot) => targetKeys.has(shotKey(shot.id)))
  if (firstRemovedIndex < 0) return focusShotId || shots[0]?.id || 0
  const nextShot = shots.slice(firstRemovedIndex).find((shot) => !targetKeys.has(shotKey(shot.id)))
  if (nextShot) return nextShot.id
  return [...shots.slice(0, firstRemovedIndex)].reverse().find((shot) => !targetKeys.has(shotKey(shot.id)))?.id || 0
}

export function analyzeShotDeletion({
  shots = [],
  selectedShotIds = [],
  previousItems = [],
  subtitleCues = [],
  audioTracks = [],
} = {}) {
  const context = createShotDeletionContext(shots, selectedShotIds, previousItems)
  return {
    targetIds: context.targetIds,
    removedShots: context.removedShots,
    remainingShots: context.remainingShots,
    removedDuration: Number(context.removedItems.reduce((total, item) => total + item.duration, 0).toFixed(1)),
    remainingDuration: Number(context.keptItems.reduce((total, item) => total + item.duration, 0).toFixed(1)),
    removedSubtitleCount: subtitleCues.filter((cue) => cueWillBeRemoved(cue, context)).length,
    removedSfxCount: audioTracks.filter((track) => sfxWillBeRemoved(track, context)).length,
    allSelected: Boolean(context.targetIds.length && context.targetIds.length === shots.length),
  }
}

export function deleteShotSelectionFromTimeline({
  shots = [],
  selectedShotIds = [],
  previousItems = [],
  nextItems = [],
  subtitleCues = [],
  audioTracks = [],
  playhead = 0,
  focusShotId = 0,
} = {}) {
  const context = createShotDeletionContext(shots, selectedShotIds, previousItems)
  if (!context.targetIds.length) {
    return {
      shots,
      subtitleCues,
      audioTracks,
      playhead,
      focusShotId,
      removedShots: [],
    }
  }

  const nextTotalDuration = nextItems.at(-1)?.end || 0
  const nextSubtitleCues = !nextItems.length ? [] : normalizeSubtitleCues(subtitleCues.flatMap((cue) => {
    const sourceItem = findSourceItem(previousItems, cue.sourceItemId)
    if (sourceItem) {
      if (context.targetKeys.has(shotKey(sourceItem.shot?.id))) return []
      return [synchronizeSubtitleCue(cue, previousItems, nextItems, nextTotalDuration)]
    }
    if (cueKeptOverlap(cue, context.keptItems) < 0.1) return []
    const start = compressDeletedTime(cue.start, context.removedItems, nextTotalDuration)
    const end = compressDeletedTime(cue.end, context.removedItems, nextTotalDuration)
    if (end - start < 0.1) return []
    return [{ ...cue, start, end }]
  }).sort((left, right) => left.start - right.start), nextTotalDuration)

  const nextAudioTracks = audioTracks.flatMap((track) => {
    if (track.kind !== 'sfx') {
      return [nextItems.length ? synchronizeAudioTrack(track, previousItems, nextItems, nextTotalDuration) : { ...track, start: 0 }]
    }
    if (!nextItems.length) return []
    const owner = findBestOverlapItem(previousItems, track.start, Number(track.start) + 0.001)
    if (owner && context.targetKeys.has(shotKey(owner.shot?.id))) return []
    return [synchronizeAudioTrack(track, previousItems, nextItems, nextTotalDuration)]
  })

  const focusAfterDeletion = resolveFocusAfterDeletion(shots, context.targetKeys, focusShotId)
  const playheadOwner = findBestOverlapItem(previousItems, playhead, Number(playhead) + 0.001)
  let nextPlayhead = 0
  if (nextItems.length && playheadOwner && !context.targetKeys.has(shotKey(playheadOwner.shot?.id))) {
    nextPlayhead = remapTimelinePlayhead({
      previousItems,
      nextItems,
      shotId: playheadOwner.shot?.id,
      playhead,
    })
  } else if (nextItems.length && playheadOwner) {
    const ownerIndex = previousItems.indexOf(playheadOwner)
    const following = previousItems.slice(ownerIndex + 1).find((item) => !context.targetKeys.has(shotKey(item.shot?.id)))
    const preceding = [...previousItems.slice(0, ownerIndex)].reverse().find((item) => !context.targetKeys.has(shotKey(item.shot?.id)))
    const nextFollowing = following ? findItemByShotId(nextItems, following.shot?.id) : null
    const nextPreceding = preceding ? findItemByShotId(nextItems, preceding.shot?.id) : null
    nextPlayhead = nextFollowing?.start ?? nextPreceding?.end ?? 0
  } else if (nextItems.length) {
    nextPlayhead = Math.min(nextTotalDuration, Math.max(0, Number(playhead) || 0))
  }

  const remainingShotIds = new Set(context.remainingShots.map((shot) => shotKey(shot.id)))
  const remainingShots = context.remainingShots.map((shot, index, items) => {
    if (!shot.videoContinuitySourceShotId) return shot
    const sourceIsPrevious = index > 0
      && shotKey(items[index - 1].id) === shotKey(shot.videoContinuitySourceShotId)
      && remainingShotIds.has(shotKey(shot.videoContinuitySourceShotId))
    return sourceIsPrevious ? shot : { ...shot, videoContinuitySourceShotId: 0 }
  })

  return {
    shots: remainingShots,
    subtitleCues: nextSubtitleCues,
    audioTracks: nextAudioTracks,
    playhead: Number(nextPlayhead.toFixed(3)),
    focusShotId: focusAfterDeletion,
    removedShots: context.removedShots,
  }
}

const synchronizeSubtitleCue = (cue, previousItems, nextItems, nextTotalDuration) => {
  const sourceItem = findSourceItem(previousItems, cue.sourceItemId)
  const owner = sourceItem || findBestOverlapItem(previousItems, cue.start, cue.end)
  if (!owner) return cue
  const nextOwner = findItemByShotId(nextItems, owner.shot?.id)
  if (!nextOwner) return cue
  const ownerDuration = Math.max(0.1, owner.duration)
  const startRatio = clamp((Number(cue.start) - owner.start) / ownerDuration, 0, 1)
  const endRatio = clamp((Number(cue.end) - owner.start) / ownerDuration, 0, 1)
  let start = nextOwner.start + startRatio * nextOwner.duration
  let end = nextOwner.start + Math.max(startRatio, endRatio) * nextOwner.duration
  if (end - start < 0.1) end = start + 0.1
  if (end > nextTotalDuration) {
    end = nextTotalDuration
    start = Math.max(0, Math.min(start, end - 0.1))
  }
  return {
    ...cue,
    sourceItemId: sourceItem ? nextOwner.id : cue.sourceItemId,
    start: Number(start.toFixed(3)),
    end: Number(end.toFixed(3)),
  }
}

const synchronizeAudioTrack = (track, previousItems, nextItems, nextTotalDuration) => {
  if (!nextTotalDuration) return { ...track, start: 0 }
  const occupiedDuration = track.kind === 'sfx'
    ? Math.min(Math.max(0.1, Number(track.duration) || 0.1), nextTotalDuration)
    : Math.min(0.1, nextTotalDuration)
  const maxStart = Math.max(0, nextTotalDuration - occupiedDuration)
  if (track.kind !== 'sfx') {
    return { ...track, start: Number(clamp(track.start, 0, maxStart).toFixed(1)) }
  }
  const start = Math.max(0, Number(track.start) || 0)
  const owner = findBestOverlapItem(previousItems, start, start + 0.001)
  const nextOwner = owner ? findItemByShotId(nextItems, owner.shot?.id) : null
  if (!owner || !nextOwner) return { ...track, start: Number(clamp(start, 0, maxStart).toFixed(1)) }
  const offset = clamp(start - owner.start, 0, Math.max(0, nextOwner.duration - 0.1))
  const nextStart = clamp(nextOwner.start + offset, 0, maxStart)
  return { ...track, start: Number(nextStart.toFixed(1)) }
}

export function synchronizeTimelineDependents({
  previousItems = [],
  nextItems = [],
  subtitleCues = [],
  audioTracks = [],
} = {}) {
  const nextTotalDuration = nextItems.at(-1)?.end || 0
  const synchronizedCues = subtitleCues
    .map((cue) => synchronizeSubtitleCue(cue, previousItems, nextItems, nextTotalDuration))
    .sort((left, right) => left.start - right.start)
  return {
    subtitleCues: normalizeSubtitleCues(synchronizedCues, nextTotalDuration || 0.1),
    audioTracks: audioTracks.map((track) => synchronizeAudioTrack(track, previousItems, nextItems, nextTotalDuration)),
  }
}

export function remapTimelinePlayhead({ previousItems = [], nextItems = [], shotId, playhead = 0 } = {}) {
  if (!nextItems.length) return 0
  const previousItem = findItemByShotId(previousItems, shotId)
    || findBestOverlapItem(previousItems, playhead, Number(playhead) + 0.001)
  if (!previousItem) return Math.min(nextItems.at(-1).end, Math.max(0, Number(playhead) || 0))
  const nextItem = findItemByShotId(nextItems, previousItem.shot?.id)
  if (!nextItem) return Math.min(nextItems.at(-1).end, Math.max(0, Number(playhead) || 0))
  const relativeProgress = clamp((Number(playhead) - previousItem.start) / Math.max(0.1, previousItem.duration), 0, 1)
  return Number((nextItem.start + relativeProgress * nextItem.duration).toFixed(3))
}

export function analyzeShotSplit({ shots = [], previousItems = [], playhead = 0 } = {}) {
  const sourceItems = previousItems.length ? previousItems : createTimelineItemsFromShots(shots)
  const splitTime = Math.max(0, Number(playhead) || 0)
  const targetItem = sourceItems.find((item) => splitTime >= item.start && splitTime < item.end)
    || (sourceItems.length && splitTime === sourceItems.at(-1).end ? sourceItems.at(-1) : null)
  const targetShot = targetItem
    ? shots.find((shot) => shotKey(shot.id) === shotKey(targetItem.shot?.id)) || targetItem.shot
    : null
  if (!targetItem || !targetShot) {
    return { valid: false, reason: 'no-target', targetItem: null, targetShot: null, leftDuration: 0, rightDuration: 0 }
  }

  const leftDuration = Number((splitTime - targetItem.start).toFixed(1))
  const rightDuration = Number((targetItem.duration - leftDuration).toFixed(1))
  const targetIndex = shots.findIndex((shot) => shotKey(shot.id) === shotKey(targetShot.id))
  if (leftDuration < minimumShotDuration) {
    return { valid: false, reason: 'left-too-short', targetItem, targetShot, targetIndex, leftDuration, rightDuration }
  }
  if (rightDuration < minimumShotDuration) {
    return { valid: false, reason: 'right-too-short', targetItem, targetShot, targetIndex, leftDuration, rightDuration }
  }
  return {
    valid: true,
    reason: '',
    targetItem,
    targetShot,
    targetIndex,
    leftDuration,
    rightDuration,
    splitTime: Number((targetItem.start + leftDuration).toFixed(3)),
  }
}

export function splitShotAtPlayhead({
  shots = [],
  previousItems = [],
  subtitleCues = [],
  audioTracks = [],
  playhead = 0,
} = {}) {
  const sourceItems = previousItems.length ? previousItems : createTimelineItemsFromShots(shots)
  const analysis = analyzeShotSplit({ shots, previousItems: sourceItems, playhead })
  if (!analysis.valid) {
    return {
      ...analysis,
      shots,
      subtitleCues,
      audioTracks,
      playhead,
      focusShotId: 0,
      splitShot: null,
    }
  }

  const { targetItem, targetShot, targetIndex, leftDuration, rightDuration, splitTime } = analysis
  const allocateShotId = createNumericIdAllocator(shots)
  const allocateSubtitleId = createStringIdAllocator(subtitleCues, 'subtitle-split')
  const motionRange = normalizeShotMotionRange(targetShot)
  const transitionEdges = normalizeShotTransitionEdges(targetShot)
  const splitRatio = leftDuration / Math.max(minimumShotDuration, targetItem.duration)
  const motionCut = Number((motionRange.motionRangeStart
    + (motionRange.motionRangeEnd - motionRange.motionRangeStart) * splitRatio).toFixed(6))
  const originalVoiceOffset = Math.max(0, Number(targetShot.voiceOffsetSeconds) || 0)
  const originalVideoOffset = Math.max(0, Number(targetShot.videoOffsetSeconds) || 0)
  const leftShot = {
    ...targetShot,
    duration: formatShotDuration(leftDuration),
    motionRangeStart: motionRange.motionRangeStart,
    motionRangeEnd: motionCut,
    transitionIn: transitionEdges.transitionIn,
    transitionOut: 'cut',
    voiceOffsetSeconds: Number(originalVoiceOffset.toFixed(3)),
    videoOffsetSeconds: Number(originalVideoOffset.toFixed(3)),
  }
  const rightShot = {
    ...cloneTimelineValue(targetShot),
    id: allocateShotId(),
    duration: formatShotDuration(rightDuration),
    draftSource: 'split',
    splitSourceShotId: targetShot.id,
    motionRangeStart: motionCut,
    motionRangeEnd: motionRange.motionRangeEnd,
    transitionIn: 'cut',
    transitionOut: transitionEdges.transitionOut,
    voiceSourceShotId: targetShot.id,
    voiceOffsetSeconds: Number((originalVoiceOffset + leftDuration).toFixed(3)),
    videoOffsetSeconds: Number((originalVideoOffset + leftDuration).toFixed(3)),
    videoContinuitySourceShotId: 0,
  }
  const nextShots = [
    ...shots.slice(0, targetIndex),
    leftShot,
    rightShot,
    ...shots.slice(targetIndex + 1),
  ]
  const rightItemId = stableTimelineItemId(rightShot.id)
  const nextSubtitleCues = subtitleCues.flatMap((cue) => {
    const linkedItem = cue.sourceItemId ? findSourceItem(sourceItems, cue.sourceItemId) : null
    if (!linkedItem || shotKey(linkedItem.shot?.id) !== shotKey(targetShot.id)) return [cue]
    if (Number(cue.end) <= splitTime) return [cue]
    if (Number(cue.start) >= splitTime) return [{ ...cue, sourceItemId: rightItemId }]
    return [
      { ...cue, end: splitTime },
      {
        ...cloneTimelineValue(cue),
        id: allocateSubtitleId(),
        sourceItemId: rightItemId,
        start: splitTime,
      },
    ]
  }).sort((left, right) => Number(left.start) - Number(right.start))

  return {
    ...analysis,
    shots: nextShots,
    subtitleCues: nextSubtitleCues,
    audioTracks,
    playhead: splitTime,
    focusShotId: rightShot.id,
    leftShot,
    splitShot: rightShot,
  }
}

export function duplicateShotSelectionInTimeline({
  shots = [],
  selectedShotIds = [],
  previousItems = [],
  subtitleCues = [],
  audioTracks = [],
  playhead = 0,
} = {}) {
  const targetIds = normalizeShotSelection(shots, selectedShotIds)
  if (!targetIds.length) {
    return {
      shots,
      subtitleCues,
      audioTracks,
      playhead,
      focusShotId: 0,
      duplicatedShots: [],
      duplicateShotIds: [],
      insertionIndex: 0,
      duplicatedSubtitleIds: [],
      duplicatedSfxIds: [],
    }
  }

  const sourceItems = previousItems.length ? previousItems : createTimelineItemsFromShots(shots)
  const targetKeys = new Set(targetIds.map(shotKey))
  const selectedShots = shots.filter((shot) => targetKeys.has(shotKey(shot.id)))
  const lastSelectedIndex = shots.reduce((latestIndex, shot, index) => (
    targetKeys.has(shotKey(shot.id)) ? index : latestIndex
  ), -1)
  const insertionIndex = lastSelectedIndex + 1
  const allocateShotId = createNumericIdAllocator(shots)
  const duplicateBySourceId = new Map()
  const duplicatedShots = selectedShots.map((shot) => {
    const duplicate = {
      ...cloneTimelineValue(shot),
      id: allocateShotId(),
      draftSource: 'duplicate',
      duplicateSourceShotId: shot.id,
      videoContinuitySourceShotId: 0,
    }
    duplicateBySourceId.set(shotKey(shot.id), duplicate)
    return duplicate
  })
  const nextShots = [
    ...shots.slice(0, insertionIndex),
    ...duplicatedShots,
    ...shots.slice(insertionIndex),
  ]
  const nextItems = createTimelineItemsFromShots(nextShots)
  const synchronized = synchronizeTimelineDependents({
    previousItems: sourceItems,
    nextItems,
    subtitleCues,
    audioTracks,
  })
  const nextTotalDuration = nextItems.at(-1)?.end || 0
  const allocateSubtitleId = createStringIdAllocator(synchronized.subtitleCues, 'subtitle-copy')
  const allocateSfxId = createNumericIdAllocator(synchronized.audioTracks)
  const duplicatedSubtitleCues = []
  const duplicatedAudioTracks = []

  subtitleCues.forEach((cue) => {
    const linkedSource = cue.sourceItemId ? findSourceItem(sourceItems, cue.sourceItemId) : null
    const freeSource = !cue.sourceItemId
      ? sourceItems.find((item) => (
        targetKeys.has(shotKey(item.shot?.id))
        && Number(cue.start) >= item.start
        && Number(cue.end) <= item.end
      )) || null
      : null
    const sourceItem = linkedSource || freeSource
    if (!sourceItem || !targetKeys.has(shotKey(sourceItem.shot?.id))) return
    const duplicateShot = duplicateBySourceId.get(shotKey(sourceItem.shot?.id))
    const duplicateItem = duplicateShot ? findItemByShotId(nextItems, duplicateShot.id) : null
    if (!duplicateItem) return
    const localStart = clamp(Number(cue.start) - sourceItem.start, 0, sourceItem.duration)
    const localEnd = clamp(Number(cue.end) - sourceItem.start, localStart + 0.1, sourceItem.duration)
    const start = duplicateItem.start + localStart
    const end = Math.min(nextTotalDuration, duplicateItem.start + localEnd)
    if (end - start < 0.1) return
    duplicatedSubtitleCues.push({
      ...cloneTimelineValue(cue),
      id: allocateSubtitleId(),
      sourceItemId: linkedSource ? duplicateItem.id : '',
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    })
  })

  audioTracks.forEach((track) => {
    if (track.kind !== 'sfx') return
    const sourceItem = findBestOverlapItem(sourceItems, track.start, Number(track.start) + 0.001)
    if (!sourceItem || !targetKeys.has(shotKey(sourceItem.shot?.id))) return
    const duplicateShot = duplicateBySourceId.get(shotKey(sourceItem.shot?.id))
    const duplicateItem = duplicateShot ? findItemByShotId(nextItems, duplicateShot.id) : null
    if (!duplicateItem) return
    const localOffset = clamp(Number(track.start) - sourceItem.start, 0, Math.max(0, duplicateItem.duration - 0.1))
    duplicatedAudioTracks.push({
      ...cloneTimelineValue(track),
      id: allocateSfxId(),
      start: Number((duplicateItem.start + localOffset).toFixed(1)),
    })
  })

  const firstSourceItem = findItemByShotId(sourceItems, selectedShots[0]?.id)
  const firstDuplicateItem = findItemByShotId(nextItems, duplicatedShots[0]?.id)
  const sourcePlayhead = Number(playhead) || 0
  const localPlayheadOffset = firstSourceItem
    && sourcePlayhead >= firstSourceItem.start
    && sourcePlayhead <= firstSourceItem.end
    ? clamp(sourcePlayhead - firstSourceItem.start, 0, firstDuplicateItem?.duration || 0)
    : 0
  const nextSubtitleCues = normalizeSubtitleCues(
    [...synchronized.subtitleCues, ...duplicatedSubtitleCues].sort((left, right) => left.start - right.start),
    nextTotalDuration || 0.1,
  )
  const nextAudioTracks = [...synchronized.audioTracks, ...duplicatedAudioTracks]

  return {
    shots: nextShots,
    subtitleCues: nextSubtitleCues,
    audioTracks: nextAudioTracks,
    playhead: Number(((firstDuplicateItem?.start || 0) + localPlayheadOffset).toFixed(3)),
    focusShotId: duplicatedShots[0]?.id || 0,
    duplicatedShots,
    duplicateShotIds: duplicatedShots.map((shot) => shot.id),
    insertionIndex,
    duplicatedSubtitleIds: duplicatedSubtitleCues.map((cue) => cue.id),
    duplicatedSfxIds: duplicatedAudioTracks.map((track) => track.id),
  }
}
