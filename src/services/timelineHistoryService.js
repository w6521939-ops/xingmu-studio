import {
  normalizeShotMotionRange,
  normalizeShotMotionSettings,
  normalizeShotTransitionEdges,
} from './shotMotionService.js'

export const maxTimelineHistoryEntries = 40

const cloneAudioTracks = (audioTracks = []) => audioTracks.map((track) => ({
  ...track,
  waveform: Array.isArray(track.waveform) ? [...track.waveform] : [],
}))

const cloneSubtitleCues = (subtitleCues = []) => subtitleCues.map((cue) => ({ ...cue }))

const cloneProjectValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneProjectValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, cloneProjectValue(nestedValue)]))
  }
  return value
}

const cloneShotTimeline = ({ shots = [], shotMotions = [], shotTimeline = [] } = {}) => (
  (shotTimeline.length ? shotTimeline : shotMotions.length ? shotMotions : shots).map((shot) => ({
    id: shot.id,
    duration: typeof shot.duration === 'string' ? shot.duration : `${Number(shot.duration) || 3}s`,
    ...normalizeShotMotionSettings(shot),
    ...normalizeShotMotionRange(shot),
    ...normalizeShotTransitionEdges(shot),
    voiceSourceShotId: shot.voiceSourceShotId || 0,
    voiceOffsetSeconds: Number(Math.max(0, Number(shot.voiceOffsetSeconds) || 0).toFixed(3)),
    videoAssetId: typeof shot.videoAssetId === 'string' ? shot.videoAssetId : '',
    videoOffsetSeconds: Number(Math.max(0, Number(shot.videoOffsetSeconds) || 0).toFixed(3)),
    videoDurationPolicy: 'fit-timeline',
    videoContinuitySourceShotId: shot.videoContinuitySourceShotId || 0,
  }))
)

export const createTimelineSnapshot = ({
  audioTracks = [],
  subtitleCues = [],
  subtitleCuesInitialized = true,
  subtitleStyle = {},
  shots = [],
  shotMotions = [],
  shotTimeline = [],
  selectedSubtitleCue = 0,
  playhead = 0,
  shotSetAuthoritative = false,
  restorableShots = [],
  focusedShotId = 0,
} = {}) => ({
  audioTracks: cloneAudioTracks(audioTracks),
  subtitleCues: cloneSubtitleCues(subtitleCues),
  subtitleCuesInitialized: subtitleCuesInitialized !== false,
  subtitleStyle: { ...subtitleStyle },
  shotTimeline: cloneShotTimeline({ shots, shotMotions, shotTimeline }),
  shotMotions: cloneShotTimeline({ shots, shotMotions, shotTimeline }).map(({ duration: _duration, ...motion }) => motion),
  selectedSubtitleCue,
  playhead: Number(playhead) || 0,
  shotSetAuthoritative: shotSetAuthoritative === true,
  restorableShots: cloneProjectValue(restorableShots),
  focusedShotId,
})

export const createEmptyTimelineHistory = () => ({
  past: [],
  future: [],
  entries: [],
})

const createLogEntry = (kind, label, at) => ({
  id: `${at}-${kind}-${Math.random().toString(36).slice(2, 8)}`,
  kind,
  label,
  at,
})

const addLogEntry = (entries, kind, label, at) => [
  createLogEntry(kind, label, at),
  ...(Array.isArray(entries) ? entries : []),
].slice(0, maxTimelineHistoryEntries)

export const recordTimelineEdit = (
  history,
  label,
  snapshot,
  { key = label, now = Date.now(), coalesceMs = 800 } = {},
) => {
  const current = history || createEmptyTimelineHistory()
  const past = Array.isArray(current.past) ? current.past : []
  const previous = past.at(-1)
  const shouldCoalesce = !current.future?.length && previous?.key === key && now - previous.at <= coalesceMs
  const nextPast = shouldCoalesce
    ? [...past.slice(0, -1), { ...previous, at: now }]
    : [...past, { key, label, at: now, state: createTimelineSnapshot(snapshot) }]

  return {
    past: nextPast.slice(-maxTimelineHistoryEntries),
    future: [],
    entries: shouldCoalesce
      ? current.entries
      : addLogEntry(current.entries, 'edit', label, now),
  }
}

export const undoTimelineEdit = (history, currentSnapshot, now = Date.now()) => {
  const current = history || createEmptyTimelineHistory()
  const past = Array.isArray(current.past) ? current.past : []
  if (!past.length) return { history: current, state: null, label: '' }

  const target = past.at(-1)
  const inverseSnapshot = target.state.shotSetAuthoritative
    ? { ...currentSnapshot, shotSetAuthoritative: true, restorableShots: target.state.restorableShots }
    : currentSnapshot
  const future = [
    ...(Array.isArray(current.future) ? current.future : []),
    { key: target.key, label: target.label, at: now, state: createTimelineSnapshot(inverseSnapshot) },
  ].slice(-maxTimelineHistoryEntries)

  return {
    state: createTimelineSnapshot(target.state),
    label: target.label,
    history: {
      past: past.slice(0, -1),
      future,
      entries: addLogEntry(current.entries, 'undo', `撤销：${target.label}`, now),
    },
  }
}

export const redoTimelineEdit = (history, currentSnapshot, now = Date.now()) => {
  const current = history || createEmptyTimelineHistory()
  const future = Array.isArray(current.future) ? current.future : []
  if (!future.length) return { history: current, state: null, label: '' }

  const target = future.at(-1)
  const inverseSnapshot = target.state.shotSetAuthoritative
    ? { ...currentSnapshot, shotSetAuthoritative: true, restorableShots: target.state.restorableShots }
    : currentSnapshot
  const past = [
    ...(Array.isArray(current.past) ? current.past : []),
    { key: target.key, label: target.label, at: now, state: createTimelineSnapshot(inverseSnapshot) },
  ].slice(-maxTimelineHistoryEntries)

  return {
    state: createTimelineSnapshot(target.state),
    label: target.label,
    history: {
      past,
      future: future.slice(0, -1),
      entries: addLogEntry(current.entries, 'redo', `重做：${target.label}`, now),
    },
  }
}
