import assert from 'node:assert/strict'
import {
  createEmptyTimelineHistory,
  createTimelineSnapshot,
  recordTimelineEdit,
  redoTimelineEdit,
  undoTimelineEdit,
} from '../src/services/timelineHistoryService.js'

const initial = createTimelineSnapshot({
  audioTracks: [{ id: 1, name: 'BGM', start: 0, waveform: [0.2], audio: 'data:audio/wav;base64,AAAA' }],
  subtitleCues: [{ id: 'cue-1', start: 0, end: 2, text: '第一条字幕' }],
  subtitleStyle: { fontSize: 64, color: '#FFFFFF' },
  shots: [
    { id: 1, duration: '2.0s', motionEffect: 'none', motionStrength: 12, transition: 'fade', transitionDuration: 0.25 },
    { id: 2, duration: '3.0s', motionEffect: 'none', motionStrength: 12, transition: 'fade', transitionDuration: 0.25 },
  ],
})

let history = recordTimelineEdit(createEmptyTimelineHistory(), '移动字幕', initial, {
  key: 'subtitle-cue-1-move',
  now: 1000,
})
history = recordTimelineEdit(history, '移动字幕', initial, {
  key: 'subtitle-cue-1-move',
  now: 1200,
})
assert.equal(history.past.length, 1, 'continuous edits should coalesce')

const moved = createTimelineSnapshot({
  ...initial,
  subtitleCues: [{ id: 'cue-1', start: 1, end: 3, text: '第一条字幕' }],
})
const undo = undoTimelineEdit(history, moved, 2000)
assert.equal(undo.state.subtitleCues[0].start, 0)
assert.equal(undo.history.future.length, 1)
assert.equal(undo.history.entries[0].kind, 'undo')

const redo = redoTimelineEdit(undo.history, undo.state, 3000)
assert.equal(redo.state.subtitleCues[0].start, 1)
assert.equal(redo.history.past.length, 1)
assert.equal(redo.history.entries[0].kind, 'redo')

redo.state.audioTracks[0].waveform[0] = 0.9
assert.equal(moved.audioTracks[0].waveform[0], 0.2, 'snapshots must isolate nested waveform arrays')

const motionChanged = createTimelineSnapshot({
  ...initial,
  shotTimeline: [
    { id: 2, duration: '4.0s', motionEffect: 'none', motionStrength: 12, transition: 'fade', transitionDuration: 0.25 },
    { id: 1, duration: '2.0s', motionEffect: 'pan-left', motionStrength: 18, transition: 'cut', transitionDuration: 0.35 },
  ],
})
const motionHistory = recordTimelineEdit(createEmptyTimelineHistory(), '调整镜头运动', initial, { now: 4000 })
const motionUndo = undoTimelineEdit(motionHistory, motionChanged, 5000)
const motionRedo = redoTimelineEdit(motionUndo.history, motionUndo.state, 6000)
assert.equal(motionUndo.state.shotMotions.find((shot) => shot.id === 1).motionEffect, 'none')
assert.equal(motionRedo.state.shotMotions.find((shot) => shot.id === 1).motionEffect, 'pan-left')
assert.equal(motionRedo.state.shotMotions.find((shot) => shot.id === 1).transitionDuration, 0.35)
assert.deepEqual(motionUndo.state.shotTimeline.map((shot) => shot.id), [1, 2])
assert.deepEqual(motionRedo.state.shotTimeline.map((shot) => shot.id), [2, 1])
assert.equal(motionRedo.state.shotTimeline[0].duration, '4.0s')

const deletedShot = {
  id: 2,
  duration: '3.0s',
  image: 'data:image/png;base64,RESTORE-ME',
  visualPrompt: '需要完整恢复的镜头提示词',
  characterIds: [1, 2],
}
const beforeDeletion = createTimelineSnapshot({
  shots: [
    { id: 1, duration: '2.0s' },
    deletedShot,
  ],
  subtitleCues: [{ id: 'deleted-cue', sourceItemId: 'timeline-2', start: 2, end: 5, text: '被删字幕' }],
  shotSetAuthoritative: true,
  restorableShots: [deletedShot],
  focusedShotId: 2,
})
const afterDeletion = createTimelineSnapshot({
  shots: [{ id: 1, duration: '2.0s' }],
  subtitleCues: [],
  focusedShotId: 1,
})
const deletionHistory = recordTimelineEdit(createEmptyTimelineHistory(), '删除 1 个镜头', beforeDeletion, {
  key: 'shot-delete-1',
  now: 7000,
  coalesceMs: 0,
})
const deletionUndo = undoTimelineEdit(deletionHistory, afterDeletion, 8000)
assert.equal(deletionUndo.state.shotSetAuthoritative, true)
assert.equal(deletionUndo.state.restorableShots[0].image, deletedShot.image)
assert.deepEqual(deletionUndo.state.restorableShots[0].characterIds, [1, 2])
assert.equal(deletionUndo.state.focusedShotId, 2)
assert.equal(deletionUndo.history.future[0].state.shotSetAuthoritative, true)
assert.equal(deletionUndo.history.future[0].state.restorableShots[0].image, deletedShot.image)

const deletionRedo = redoTimelineEdit(deletionUndo.history, deletionUndo.state, 9000)
assert.deepEqual(deletionRedo.state.shotTimeline.map((shot) => shot.id), [1])
assert.equal(deletionRedo.state.focusedShotId, 1)
assert.equal(deletionRedo.history.past.at(-1).state.restorableShots[0].image, deletedShot.image)
const deletionSecondUndo = undoTimelineEdit(deletionRedo.history, deletionRedo.state, 10000)
assert.deepEqual(deletionSecondUndo.state.shotTimeline.map((shot) => shot.id), [1, 2])
assert.equal(deletionSecondUndo.state.restorableShots[0].visualPrompt, deletedShot.visualPrompt)
deletionSecondUndo.state.restorableShots[0].characterIds[0] = 99
assert.deepEqual(beforeDeletion.restorableShots[0].characterIds, [1, 2], 'restorable shots must be deeply isolated')

const duplicatedShot = {
  id: 3,
  duration: '3.0s',
  image: 'data:image/png;base64,DUPLICATE-ME',
  visualPrompt: '复制镜头完整提示词',
  characterIds: [1, 2],
  costume: '雨夜风衣',
  continuityLocked: true,
  draftSource: 'duplicate',
  duplicateSourceShotId: 2,
}
const beforeDuplication = createTimelineSnapshot({
  shots: [
    { id: 1, duration: '2.0s' },
    { id: 2, duration: '3.0s' },
  ],
  subtitleCues: [{ id: 'source-cue', sourceItemId: 'timeline-2', start: 2, end: 5, text: '原字幕' }],
  playhead: 3,
  shotSetAuthoritative: true,
  restorableShots: [duplicatedShot],
  focusedShotId: 2,
})
const afterDuplication = createTimelineSnapshot({
  shots: [
    { id: 1, duration: '2.0s' },
    { id: 2, duration: '3.0s' },
    duplicatedShot,
  ],
  subtitleCues: [
    { id: 'source-cue', sourceItemId: 'timeline-2', start: 2, end: 5, text: '原字幕' },
    { id: 'copy-cue', sourceItemId: 'timeline-3', start: 5, end: 8, text: '原字幕' },
  ],
  playhead: 6,
  focusedShotId: 3,
})
const duplicationHistory = recordTimelineEdit(createEmptyTimelineHistory(), '复制 1 个镜头', beforeDuplication, {
  key: 'shot-duplicate-1',
  now: 11000,
  coalesceMs: 0,
})
const duplicationUndo = undoTimelineEdit(duplicationHistory, afterDuplication, 12000)
assert.deepEqual(duplicationUndo.state.shotTimeline.map((shot) => shot.id), [1, 2])
assert.deepEqual(duplicationUndo.state.subtitleCues.map((cue) => cue.id), ['source-cue'])
assert.equal(duplicationUndo.state.focusedShotId, 2)
assert.equal(duplicationUndo.state.playhead, 3)
assert.equal(duplicationUndo.history.future[0].state.restorableShots[0].image, duplicatedShot.image)

const duplicationRedo = redoTimelineEdit(duplicationUndo.history, duplicationUndo.state, 13000)
assert.deepEqual(duplicationRedo.state.shotTimeline.map((shot) => shot.id), [1, 2, 3])
assert.deepEqual(duplicationRedo.state.subtitleCues.map((cue) => cue.id), ['source-cue', 'copy-cue'])
assert.equal(duplicationRedo.state.focusedShotId, 3)
assert.equal(duplicationRedo.state.playhead, 6)
assert.equal(duplicationRedo.state.restorableShots[0].visualPrompt, duplicatedShot.visualPrompt)

const duplicationSecondUndo = undoTimelineEdit(duplicationRedo.history, duplicationRedo.state, 14000)
assert.deepEqual(duplicationSecondUndo.state.shotTimeline.map((shot) => shot.id), [1, 2])
const duplicationSecondRedo = redoTimelineEdit(duplicationSecondUndo.history, duplicationSecondUndo.state, 15000)
assert.equal(duplicationSecondRedo.state.restorableShots[0].image, duplicatedShot.image)
assert.deepEqual(duplicationSecondRedo.state.restorableShots[0].characterIds, [1, 2])

const splitRightShot = {
  id: 4,
  duration: '2.8s',
  image: 'data:image/png;base64,SPLIT-RIGHT',
  visualPrompt: '拆分右段完整提示词',
  characterIds: [2, 4],
  motionEffect: 'pan-left',
  motionStrength: 20,
  motionRangeStart: 0.464,
  motionRangeEnd: 0.8,
  transition: 'fade',
  transitionDuration: 0.3,
  transitionIn: 'cut',
  transitionOut: 'fade',
  voiceSourceShotId: 2,
  voiceOffsetSeconds: 3.7,
  draftSource: 'split',
  splitSourceShotId: 2,
}
const beforeSplit = createTimelineSnapshot({
  shots: [
    { id: 1, duration: '2.0s' },
    {
      id: 2,
      duration: '5.0s',
      motionEffect: 'pan-left',
      motionStrength: 20,
      motionRangeStart: 0.2,
      motionRangeEnd: 0.8,
      transition: 'fade',
      transitionDuration: 0.3,
      transitionIn: 'fade',
      transitionOut: 'fade',
      voiceOffsetSeconds: 1.5,
    },
  ],
  subtitleCues: [{ id: 'split-source', sourceItemId: 'timeline-2', start: 3.8, end: 4.8, text: '跨切点字幕' }],
  playhead: 4.2,
  shotSetAuthoritative: true,
  restorableShots: [splitRightShot],
  focusedShotId: 2,
})
const afterSplit = createTimelineSnapshot({
  shots: [
    { id: 1, duration: '2.0s' },
    {
      id: 2,
      duration: '2.2s',
      motionEffect: 'pan-left',
      motionStrength: 20,
      motionRangeStart: 0.2,
      motionRangeEnd: 0.464,
      transition: 'fade',
      transitionDuration: 0.3,
      transitionIn: 'fade',
      transitionOut: 'cut',
      voiceOffsetSeconds: 1.5,
    },
    splitRightShot,
  ],
  subtitleCues: [
    { id: 'split-source', sourceItemId: 'timeline-2', start: 3.8, end: 4.2, text: '跨切点字幕' },
    { id: 'split-right', sourceItemId: 'timeline-4', start: 4.2, end: 4.8, text: '跨切点字幕' },
  ],
  playhead: 4.2,
  focusedShotId: 4,
})
const splitHistory = recordTimelineEdit(createEmptyTimelineHistory(), '拆分镜头 02', beforeSplit, {
  key: 'shot-split-2',
  now: 16000,
  coalesceMs: 0,
})
const splitUndo = undoTimelineEdit(splitHistory, afterSplit, 17000)
assert.deepEqual(splitUndo.state.shotTimeline.map((shot) => shot.id), [1, 2])
assert.equal(splitUndo.state.shotTimeline[1].duration, '5.0s')
assert.equal(splitUndo.state.shotTimeline[1].motionRangeEnd, 0.8)
assert.equal(splitUndo.state.shotTimeline[1].transitionOut, 'fade')
assert.equal(splitUndo.state.shotTimeline[1].voiceOffsetSeconds, 1.5)
assert.equal(splitUndo.state.subtitleCues[0].end, 4.8)
assert.equal(splitUndo.state.focusedShotId, 2)
assert.equal(splitUndo.history.future[0].state.restorableShots[0].image, splitRightShot.image)

const splitRedo = redoTimelineEdit(splitUndo.history, splitUndo.state, 18000)
assert.deepEqual(splitRedo.state.shotTimeline.map((shot) => shot.id), [1, 2, 4])
assert.equal(splitRedo.state.shotTimeline[1].duration, '2.2s')
assert.equal(splitRedo.state.shotTimeline[1].motionRangeEnd, 0.464)
assert.equal(splitRedo.state.shotTimeline[2].motionRangeStart, 0.464)
assert.equal(splitRedo.state.shotTimeline[2].transitionIn, 'cut')
assert.equal(splitRedo.state.shotTimeline[2].voiceOffsetSeconds, 3.7)
assert.equal(splitRedo.state.subtitleCues.length, 2)
assert.equal(splitRedo.state.focusedShotId, 4)

console.log(JSON.stringify({
  passed: true,
  coalescedPastCount: history.past.length,
  undoStart: undo.state.subtitleCues[0].start,
  redoStart: redo.state.subtitleCues[0].start,
  operationCount: redo.history.entries.length,
  motionUndoEffect: motionUndo.state.shotMotions.find((shot) => shot.id === 1).motionEffect,
  motionRedoEffect: motionRedo.state.shotMotions.find((shot) => shot.id === 1).motionEffect,
  reorderedShotIds: motionRedo.state.shotTimeline.map((shot) => shot.id),
  resizedDuration: motionRedo.state.shotTimeline[0].duration,
  deletionUndoShotIds: deletionUndo.state.shotTimeline.map((shot) => shot.id),
  deletionRedoShotIds: deletionRedo.state.shotTimeline.map((shot) => shot.id),
  deletionSecondUndoShotIds: deletionSecondUndo.state.shotTimeline.map((shot) => shot.id),
  duplicationUndoShotIds: duplicationUndo.state.shotTimeline.map((shot) => shot.id),
  duplicationRedoShotIds: duplicationRedo.state.shotTimeline.map((shot) => shot.id),
  duplicationSecondRedoShotIds: duplicationSecondRedo.state.shotTimeline.map((shot) => shot.id),
  splitUndoShotIds: splitUndo.state.shotTimeline.map((shot) => shot.id),
  splitRedoShotIds: splitRedo.state.shotTimeline.map((shot) => shot.id),
}))
