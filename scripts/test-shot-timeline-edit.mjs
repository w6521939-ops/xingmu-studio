import assert from 'node:assert/strict'
import {
  analyzeShotDeletion,
  analyzeShotSplit,
  applyBatchShotEdits,
  deleteShotSelectionFromTimeline,
  duplicateShotSelectionInTimeline,
  formatShotDuration,
  getShotGroupInsertionIndex,
  moveShotToIndex,
  moveShotGroupByStep,
  normalizeShotDuration,
  normalizeShotSelection,
  remapTimelinePlayhead,
  reorderShotsByInsertion,
  reorderShotGroupByInsertion,
  selectShotRange,
  splitShotAtPlayhead,
  stableTimelineItemId,
  synchronizeTimelineDependents,
  toggleShotSelection,
} from '../src/services/shotTimelineEditService.js'
import { buildProductionTimeline } from '../src/services/timelineService.js'

const shots = [
  { id: 1, episodeId: 1, sceneId: 1, dialogue: '一', duration: '2.0s' },
  { id: 2, episodeId: 1, sceneId: 1, dialogue: '二', duration: '3.0s' },
  { id: 3, episodeId: 1, sceneId: 1, dialogue: '三', duration: '5.0s' },
]
const timelineFor = (items) => buildProductionTimeline({
  episodes: [{ id: 1, title: '测试集' }],
  scenes: [{ id: 1, episodeId: 1, title: '测试场景' }],
  shots: items,
  lines: [],
})

const previousTimeline = timelineFor(shots)
assert.deepEqual(previousTimeline.items.map((item) => item.id), ['timeline-1', 'timeline-2', 'timeline-3'])
assert.equal(stableTimelineItemId(2), 'timeline-2')

const reorderedShots = moveShotToIndex(shots, 3, 0)
assert.deepEqual(reorderedShots.map((shot) => shot.id), [3, 1, 2])
assert.deepEqual(reorderShotsByInsertion(shots, 1, 3).map((shot) => shot.id), [2, 3, 1])
assert.equal(reorderShotsByInsertion(shots, 2, 2), shots, 'dropping at the same insertion point must be a no-op')

const reorderedTimeline = timelineFor(reorderedShots)
const synchronized = synchronizeTimelineDependents({
  previousItems: previousTimeline.items,
  nextItems: reorderedTimeline.items,
  subtitleCues: [
    { id: 'linked', sourceItemId: 'timeline-1-0', start: 0, end: 2, text: '跟随镜头一' },
    { id: 'free', sourceItemId: '', start: 2.5, end: 4.5, text: '跟随镜头二' },
  ],
  audioTracks: [
    { id: 1, kind: 'bgm', start: 1, duration: 8 },
    { id: 2, kind: 'sfx', start: 2.5, duration: 1 },
  ],
})
assert.equal(synchronized.subtitleCues[0].id, 'linked')
assert.equal(synchronized.subtitleCues[0].sourceItemId, 'timeline-1')
assert.equal(synchronized.subtitleCues[0].start, 5)
assert.equal(synchronized.subtitleCues[0].end, 7)
assert.equal(synchronized.subtitleCues[1].start, 7.5)
assert.equal(synchronized.subtitleCues[1].end, 9.5)
assert.equal(synchronized.audioTracks[0].start, 1)
assert.equal(synchronized.audioTracks[1].start, 7.5)
assert.equal(remapTimelinePlayhead({ previousItems: previousTimeline.items, nextItems: reorderedTimeline.items, shotId: 1, playhead: 1 }), 6)

const extendedShots = shots.map((shot) => shot.id === 1 ? { ...shot, duration: formatShotDuration(4) } : shot)
const extendedTimeline = timelineFor(extendedShots)
const extended = synchronizeTimelineDependents({
  previousItems: previousTimeline.items,
  nextItems: extendedTimeline.items,
  subtitleCues: [{ id: 'full-shot', sourceItemId: 'timeline-1', start: 0, end: 2, text: '整镜字幕' }],
  audioTracks: [{ id: 2, kind: 'sfx', start: 2.5, duration: 1 }],
})
assert.equal(extended.subtitleCues[0].start, 0)
assert.equal(extended.subtitleCues[0].end, 4)
assert.equal(extended.audioTracks[0].start, 4.5)
assert.equal(normalizeShotDuration(0.1), 0.5)
assert.equal(normalizeShotDuration(99), 30)
assert.equal(formatShotDuration('4.26s'), '4.3s')

assert.deepEqual(normalizeShotSelection(shots, [3, 999, 1]), [1, 3])
assert.deepEqual(toggleShotSelection([1], 2), [1, 2])
assert.deepEqual(toggleShotSelection([1, 2], 1), [2])
assert.deepEqual(selectShotRange(shots, 1, 3), [1, 2, 3])
assert.deepEqual(selectShotRange(shots, 2, 3, [1], true), [1, 2, 3])

const batchEditedShots = applyBatchShotEdits(shots, [1, 3], {
  duration: 4.2,
  motionEffect: 'zoom-out',
  motionStrength: 20,
  transition: 'cut',
})
assert.equal(batchEditedShots[0].duration, '4.2s')
assert.equal(batchEditedShots[0].motionEffect, 'zoom-out')
assert.equal(batchEditedShots[0].motionStrength, 20)
assert.equal(batchEditedShots[0].transition, 'cut')
assert.equal(batchEditedShots[0].transitionIn, 'cut')
assert.equal(batchEditedShots[0].transitionOut, 'cut')
assert.equal(batchEditedShots[0].motionRangeStart, 0)
assert.equal(batchEditedShots[0].motionRangeEnd, 1)
assert.equal(batchEditedShots[1], shots[1])
assert.equal(batchEditedShots[2].duration, '4.2s')
assert.equal(applyBatchShotEdits(shots, [1], {}), shots)

const groupShots = [1, 2, 3, 4, 5].map((id) => ({ id, duration: '1.0s' }))
assert.equal(getShotGroupInsertionIndex(groupShots, [2, 4]), 1)
assert.deepEqual(reorderShotGroupByInsertion(groupShots, [4, 2], 2).map((shot) => shot.id), [1, 3, 2, 4, 5])
assert.deepEqual(reorderShotGroupByInsertion(groupShots, [2, 4], 0).map((shot) => shot.id), [2, 4, 1, 3, 5])
assert.deepEqual(reorderShotGroupByInsertion(groupShots, [2, 4], 3).map((shot) => shot.id), [1, 3, 5, 2, 4])
assert.deepEqual(moveShotGroupByStep(groupShots, [2, 4], -1).map((shot) => shot.id), [2, 4, 1, 3, 5])
assert.deepEqual(moveShotGroupByStep(groupShots, [2, 4], 1).map((shot) => shot.id), [1, 3, 2, 4, 5])
assert.equal(reorderShotGroupByInsertion(groupShots, [1, 2, 3, 4, 5], 0), groupShots)
assert.equal(moveShotGroupByStep(groupShots, [1, 2, 3, 4, 5], 1), groupShots)

const deletionShots = shots.map((shot) => ({
  ...shot,
  image: shot.id === 2 ? 'data:image/png;base64,DELETE-ME' : '',
  visualPrompt: `镜头 ${shot.id} 的完整提示词`,
  characterIds: [shot.id],
}))
const deletionTimeline = timelineFor(deletionShots)
const deletionRemainingShots = deletionShots.filter((shot) => shot.id !== 2)
const deletionNextTimeline = timelineFor(deletionRemainingShots)
const deletionSubtitleCues = [
  { id: 'linked-deleted', sourceItemId: 'timeline-2', start: 2, end: 5, text: '随镜头二删除' },
  { id: 'linked-kept', sourceItemId: 'timeline-3', start: 5, end: 10, text: '镜头三保留' },
  { id: 'free-deleted', sourceItemId: '', start: 2.2, end: 4.8, text: '完全落在删除区' },
  { id: 'free-spanning', sourceItemId: '', start: 1, end: 6, text: '跨越删除区' },
]
const deletionAudioTracks = [
  { id: 'bgm', kind: 'bgm', start: 1, duration: 8 },
  { id: 'sfx-deleted', kind: 'sfx', start: 3, duration: 1 },
  { id: 'sfx-kept', kind: 'sfx', start: 6, duration: 1 },
]
const deletionImpact = analyzeShotDeletion({
  shots: deletionShots,
  selectedShotIds: [2],
  previousItems: deletionTimeline.items,
  subtitleCues: deletionSubtitleCues,
  audioTracks: deletionAudioTracks,
})
assert.deepEqual(deletionImpact.targetIds, [2])
assert.equal(deletionImpact.removedDuration, 3)
assert.equal(deletionImpact.remainingDuration, 7)
assert.equal(deletionImpact.removedSubtitleCount, 2)
assert.equal(deletionImpact.removedSfxCount, 1)
assert.equal(deletionImpact.allSelected, false)

const deletionResult = deleteShotSelectionFromTimeline({
  shots: deletionShots,
  selectedShotIds: [2],
  previousItems: deletionTimeline.items,
  nextItems: deletionNextTimeline.items,
  subtitleCues: deletionSubtitleCues,
  audioTracks: deletionAudioTracks,
  playhead: 3,
  focusShotId: 2,
})
assert.deepEqual(deletionResult.shots.map((shot) => shot.id), [1, 3])
assert.deepEqual(deletionResult.removedShots.map((shot) => shot.id), [2])
assert.equal(deletionResult.removedShots[0].image, 'data:image/png;base64,DELETE-ME')
assert.deepEqual(deletionResult.subtitleCues.map((cue) => cue.id), ['free-spanning', 'linked-kept'])
assert.equal(deletionResult.subtitleCues.find((cue) => cue.id === 'free-spanning').start, 1)
assert.equal(deletionResult.subtitleCues.find((cue) => cue.id === 'free-spanning').end, 3)
assert.equal(deletionResult.subtitleCues.find((cue) => cue.id === 'linked-kept').start, 2)
assert.equal(deletionResult.subtitleCues.find((cue) => cue.id === 'linked-kept').end, 7)
assert.deepEqual(deletionResult.audioTracks.map((track) => track.id), ['bgm', 'sfx-kept'])
assert.equal(deletionResult.audioTracks.find((track) => track.id === 'bgm').start, 1)
assert.equal(deletionResult.audioTracks.find((track) => track.id === 'sfx-kept').start, 3)
assert.equal(deletionResult.playhead, 2)
assert.equal(deletionResult.focusShotId, 3)

const deleteAllResult = deleteShotSelectionFromTimeline({
  shots: deletionShots,
  selectedShotIds: deletionShots.map((shot) => shot.id),
  previousItems: deletionTimeline.items,
  nextItems: [],
  subtitleCues: deletionSubtitleCues,
  audioTracks: deletionAudioTracks,
  playhead: 4,
  focusShotId: 2,
})
assert.deepEqual(deleteAllResult.shots, [])
assert.deepEqual(deleteAllResult.subtitleCues, [])
assert.deepEqual(deleteAllResult.audioTracks.map((track) => track.id), ['bgm'])
assert.equal(deleteAllResult.audioTracks[0].start, 0)
assert.equal(deleteAllResult.playhead, 0)
assert.equal(deleteAllResult.focusShotId, 0)

const duplicationShots = [1, 2, 3, 4, 5].map((id) => ({
  id,
  episodeId: 1,
  sceneId: 1,
  dialogue: `镜头 ${id}`,
  duration: '2.0s',
  visualPrompt: `完整提示词 ${id}`,
  characterIds: [id, id + 10],
  costume: `服装 ${id}`,
  continuityLocked: id % 2 === 0,
  image: id === 2 ? 'data:image/png;base64,COPY-ME' : '',
  imageStatus: id === 2 ? '已完成' : '未生成',
  motionEffect: id === 4 ? 'pan-left' : 'none',
  motionStrength: 18,
  transition: id === 2 ? 'fade' : 'cut',
  transitionDuration: 0.3,
}))
const duplicationLines = duplicationShots.map((shot) => ({
  id: `line-${shot.id}`,
  episodeId: shot.episodeId,
  sceneId: shot.sceneId,
  text: shot.dialogue,
  audio: `data:audio/wav;base64,LINE-${shot.id}`,
  audioStatus: '已完成',
}))
const duplicationTimeline = buildProductionTimeline({
  episodes: [{ id: 1, title: '复制测试' }],
  scenes: [{ id: 1, episodeId: 1, title: '复制场景' }],
  shots: duplicationShots,
  lines: duplicationLines,
})
const duplicationResult = duplicateShotSelectionInTimeline({
  shots: duplicationShots,
  selectedShotIds: [4, 2],
  previousItems: duplicationTimeline.items,
  subtitleCues: [
    { id: 'linked-shot-2', sourceItemId: 'timeline-2', start: 2.2, end: 3.7, text: '绑定镜头二' },
    { id: 'free-shot-4', sourceItemId: '', start: 6.1, end: 7.9, text: '自由镜头四' },
    { id: 'free-spanning', sourceItemId: '', start: 3.5, end: 4.5, text: '跨越边界' },
  ],
  audioTracks: [
    { id: 1, kind: 'bgm', start: 1, duration: 10, waveform: [0.2] },
    { id: 2, kind: 'sfx', start: 2.5, duration: 0.8, waveform: [0.4], audio: 'data:audio/wav;base64,SFX-2' },
    { id: 3, kind: 'sfx', start: 6.75, duration: 1.1, waveform: [0.6], audio: 'data:audio/wav;base64,SFX-4' },
  ],
  playhead: 2.75,
})
assert.deepEqual(duplicationResult.shots.map((shot) => shot.id), [1, 2, 3, 4, 6, 7, 5])
assert.deepEqual(duplicationResult.duplicateShotIds, [6, 7])
assert.equal(duplicationResult.insertionIndex, 4)
assert.equal(duplicationResult.focusShotId, 6)
assert.equal(duplicationResult.playhead, 8.75)
assert.equal(duplicationResult.duplicatedShots[0].duplicateSourceShotId, 2)
assert.equal(duplicationResult.duplicatedShots[0].draftSource, 'duplicate')
assert.equal(duplicationResult.duplicatedShots[0].image, 'data:image/png;base64,COPY-ME')
assert.equal(duplicationResult.duplicatedShots[0].visualPrompt, '完整提示词 2')
assert.deepEqual(duplicationResult.duplicatedShots[0].characterIds, [2, 12])
assert.notEqual(duplicationResult.duplicatedShots[0].characterIds, duplicationShots[1].characterIds)
duplicationResult.duplicatedShots[0].characterIds[0] = 99
assert.deepEqual(duplicationShots[1].characterIds, [2, 12], 'duplicated arrays must be deeply isolated')

const linkedDuplicateCue = duplicationResult.subtitleCues.find((cue) => duplicationResult.duplicatedSubtitleIds.includes(cue.id) && cue.text === '绑定镜头二')
const freeDuplicateCue = duplicationResult.subtitleCues.find((cue) => duplicationResult.duplicatedSubtitleIds.includes(cue.id) && cue.text === '自由镜头四')
assert.equal(linkedDuplicateCue.sourceItemId, 'timeline-6')
assert.equal(linkedDuplicateCue.start, 8.2)
assert.equal(linkedDuplicateCue.end, 9.7)
assert.equal(freeDuplicateCue.sourceItemId, '')
assert.equal(freeDuplicateCue.start, 10.1)
assert.equal(freeDuplicateCue.end, 11.9)
assert.equal(duplicationResult.subtitleCues.filter((cue) => cue.text === '跨越边界').length, 1)

const duplicatedSfxTracks = duplicationResult.audioTracks.filter((track) => duplicationResult.duplicatedSfxIds.includes(track.id))
assert.equal(duplicationResult.audioTracks.filter((track) => track.kind === 'bgm').length, 1)
assert.equal(duplicationResult.audioTracks.find((track) => track.kind === 'bgm').start, 1)
assert.deepEqual(duplicatedSfxTracks.map((track) => track.start), [8.5, 10.8])
assert.equal(duplicatedSfxTracks[0].audio, 'data:audio/wav;base64,SFX-2')
assert.deepEqual(duplicatedSfxTracks[1].waveform, [0.6])

const duplicatedProductionTimeline = buildProductionTimeline({
  episodes: [{ id: 1, title: '复制测试' }],
  scenes: [{ id: 1, episodeId: 1, title: '复制场景' }],
  shots: duplicationResult.shots,
  lines: duplicationLines,
})
assert.equal(duplicatedProductionTimeline.items.find((item) => item.shot.id === 6).audioLine.id, 'line-2')
assert.equal(duplicatedProductionTimeline.items.find((item) => item.shot.id === 7).audioLine.id, 'line-4')
assert.equal(duplicatedProductionTimeline.items.find((item) => item.shot.id === 5).audioLine.id, 'line-5')

const duplicateAllResult = duplicateShotSelectionInTimeline({
  shots,
  selectedShotIds: shots.map((shot) => shot.id),
  previousItems: previousTimeline.items,
  playhead: 0,
})
assert.deepEqual(duplicateAllResult.shots.map((shot) => shot.id), [1, 2, 3, 4, 5, 6])
assert.equal(duplicateAllResult.insertionIndex, 3)

const splitShots = [
  { id: 1, episodeId: 1, sceneId: 1, dialogue: '前段', duration: '2.0s' },
  {
    id: 2,
    episodeId: 1,
    sceneId: 1,
    dialogue: '需要连续拆分的台词',
    duration: '5.0s',
    image: 'data:image/png;base64,SPLIT-ME',
    characterIds: [2, 12],
    continuity: { costume: '雨夜风衣' },
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
  { id: 3, episodeId: 1, sceneId: 1, dialogue: '后段', duration: '3.0s' },
]
const splitLines = splitShots.map((shot) => ({
  id: `split-line-${shot.id}`,
  episodeId: 1,
  sceneId: 1,
  text: shot.dialogue,
  audio: `data:audio/wav;base64,SPLIT-${shot.id}`,
  audioStatus: '已完成',
}))
const splitTimeline = buildProductionTimeline({
  episodes: [{ id: 1, title: '拆分测试' }],
  scenes: [{ id: 1, episodeId: 1, title: '连续场景' }],
  shots: splitShots,
  lines: splitLines,
})
const freeSplitCue = { id: 'free-split', sourceItemId: '', start: 4, end: 4.5, text: '自由字幕保持原位' }
const splitAudioTracks = [
  { id: 1, kind: 'bgm', start: 0.5, duration: 9, waveform: [0.2] },
  { id: 2, kind: 'sfx', start: 4.1, duration: 0.8, waveform: [0.7] },
]
assert.equal(analyzeShotSplit({ shots: splitShots, previousItems: splitTimeline.items, playhead: 2.4 }).reason, 'left-too-short')
assert.equal(analyzeShotSplit({ shots: splitShots, previousItems: splitTimeline.items, playhead: 2.5 }).valid, true)
const splitResult = splitShotAtPlayhead({
  shots: splitShots,
  previousItems: splitTimeline.items,
  subtitleCues: [
    { id: 'linked-left', sourceItemId: 'timeline-2', start: 2.1, end: 3, text: '左侧字幕' },
    { id: 'linked-right', sourceItemId: 'timeline-2', start: 4.3, end: 6.8, text: '右侧字幕' },
    { id: 'linked-span', sourceItemId: 'timeline-2', start: 3.8, end: 4.8, text: '跨切点字幕' },
    freeSplitCue,
  ],
  audioTracks: splitAudioTracks,
  playhead: 4.2,
})
assert.equal(splitResult.valid, true)
assert.deepEqual(splitResult.shots.map((shot) => shot.id), [1, 2, 4, 3])
assert.deepEqual(splitResult.shots.map((shot) => shot.duration), ['2.0s', '2.2s', '2.8s', '3.0s'])
assert.equal(splitResult.playhead, 4.2)
assert.equal(splitResult.focusShotId, 4)
assert.equal(splitResult.leftShot.motionRangeStart, 0.2)
assert.equal(splitResult.leftShot.motionRangeEnd, 0.464)
assert.equal(splitResult.leftShot.transitionIn, 'fade')
assert.equal(splitResult.leftShot.transitionOut, 'cut')
assert.equal(splitResult.splitShot.motionRangeStart, 0.464)
assert.equal(splitResult.splitShot.motionRangeEnd, 0.8)
assert.equal(splitResult.splitShot.transitionIn, 'cut')
assert.equal(splitResult.splitShot.transitionOut, 'fade')
assert.equal(splitResult.splitShot.draftSource, 'split')
assert.equal(splitResult.splitShot.splitSourceShotId, 2)
assert.equal(splitResult.splitShot.voiceSourceShotId, 2)
assert.equal(splitResult.splitShot.voiceOffsetSeconds, 3.7)
assert.equal(splitResult.audioTracks, splitAudioTracks, 'split must not duplicate or move BGM/SFX tracks')
assert.equal(splitResult.subtitleCues.find((cue) => cue.id === 'free-split'), freeSplitCue, 'free subtitle must remain untouched')
assert.equal(splitResult.subtitleCues.find((cue) => cue.id === 'linked-left').sourceItemId, 'timeline-2')
assert.equal(splitResult.subtitleCues.find((cue) => cue.id === 'linked-right').sourceItemId, 'timeline-4')
const spanningSplitCues = splitResult.subtitleCues.filter((cue) => cue.text === '跨切点字幕')
assert.equal(spanningSplitCues.length, 2)
assert.equal(spanningSplitCues[0].id, 'linked-span')
assert.equal(spanningSplitCues[0].end, 4.2)
assert.equal(spanningSplitCues[1].sourceItemId, 'timeline-4')
assert.equal(spanningSplitCues[1].start, 4.2)
assert.notEqual(splitResult.splitShot.characterIds, splitShots[1].characterIds)
assert.notEqual(splitResult.splitShot.continuity, splitShots[1].continuity)
splitResult.splitShot.continuity.costume = '已改变'
assert.equal(splitShots[1].continuity.costume, '雨夜风衣')

const splitProductionTimeline = buildProductionTimeline({
  episodes: [{ id: 1, title: '拆分测试' }],
  scenes: [{ id: 1, episodeId: 1, title: '连续场景' }],
  shots: splitResult.shots,
  lines: splitLines,
})
const splitRightItem = splitProductionTimeline.items.find((item) => item.shot.id === 4)
assert.equal(splitRightItem.audioLine.id, 'split-line-2')
assert.equal(splitRightItem.voiceOffsetSeconds, 3.7)
assert.equal(splitProductionTimeline.totalDuration, 10)
assert.equal(splitProductionTimeline.items.find((item) => item.shot.id === 3).start, 7)

console.log(JSON.stringify({
  passed: true,
  reorderedShotIds: reorderedShots.map((shot) => shot.id),
  linkedCue: synchronized.subtitleCues[0],
  freeCue: synchronized.subtitleCues[1],
  sfxStart: synchronized.audioTracks[1].start,
  remappedPlayhead: remapTimelinePlayhead({ previousItems: previousTimeline.items, nextItems: reorderedTimeline.items, shotId: 1, playhead: 1 }),
  extendedDuration: extendedShots[0].duration,
  selectedRange: selectShotRange(shots, 1, 3),
  batchDurations: batchEditedShots.map((shot) => shot.duration),
  groupedShotIds: reorderShotGroupByInsertion(groupShots, [2, 4], 2).map((shot) => shot.id),
  deletedShotIds: deletionResult.removedShots.map((shot) => shot.id),
  deletionSubtitleIds: deletionResult.subtitleCues.map((cue) => cue.id),
  deletionSfxStart: deletionResult.audioTracks.find((track) => track.id === 'sfx-kept').start,
  duplicatedShotIds: duplicationResult.duplicateShotIds,
  duplicatedSubtitleIds: duplicationResult.duplicatedSubtitleIds,
  duplicatedSfxStarts: duplicatedSfxTracks.map((track) => track.start),
  splitShotIds: splitResult.shots.map((shot) => shot.id),
  splitDurations: [splitResult.leftDuration, splitResult.rightDuration],
}))
