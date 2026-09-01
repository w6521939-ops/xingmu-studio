import assert from 'node:assert/strict'
import {
  buildAssetLibraryIndex,
  isAssetFileCompatible,
  summarizeAssetLibrary,
} from '../src/services/assetLibraryService.js'
import { createProjectSnapshot, readProjectSnapshot } from '../src/services/projectModel.js'
import {
  duplicateShotSelectionInTimeline,
  moveShotToIndex,
  splitShotAtPlayhead,
} from '../src/services/shotTimelineEditService.js'
import { buildProductionTimeline } from '../src/services/timelineService.js'
import {
  createEmptyTimelineHistory,
  createTimelineSnapshot,
  recordTimelineEdit,
  redoTimelineEdit,
  undoTimelineEdit,
} from '../src/services/timelineHistoryService.js'

const lastFrame = 'data:image/jpeg;base64,/9j/2Q=='
const videoAsset = {
  id: 'shot-video-model-test',
  kind: 'shot-video',
  source: 'local-import',
  fileName: 'real-shot.mp4',
  mimeType: 'video/mp4',
  bytes: 345678,
  duration: 6,
  width: 1080,
  height: 1920,
  fps: 30,
  sha256: 'a'.repeat(64),
  importedAt: '2026-07-22T12:00:00.000Z',
  lastFrame: { dataUrl: lastFrame, fileName: 'real-last-frame.jpg', width: 1080, height: 1920 },
}
const base = {
  projectMeta: { localProjectId: 'v32-model-project', name: 'V32 model', genre: 'test', ratio: '9:16', duration: 'short' },
  storySeed: 'Local video persistence',
  episodes: [{ id: 1, title: 'Episode' }],
  scenes: [{ id: 1, episodeId: 1, title: 'Scene', characterIds: [] }],
  characters: [],
  shots: [
    { id: 1, episodeId: 1, sceneId: 1, duration: '4.0s', videoAssetId: videoAsset.id, videoOffsetSeconds: 1 },
    { id: 2, episodeId: 1, sceneId: 1, duration: '3.0s', videoContinuitySourceShotId: 1 },
    { id: 3, episodeId: 1, sceneId: 1, duration: '2.0s', videoContinuitySourceShotId: 99 },
  ],
  lines: [],
  videoAssets: [videoAsset],
  audioTracks: [],
  subtitleCues: [],
  subtitleCuesInitialized: true,
  subtitleStyle: {},
}

const snapshot = createProjectSnapshot(base)
assert.ok(JSON.stringify(snapshot).length < 10 * 1024 * 1024)
assert.equal(snapshot.content.videoAssets[0].lastFrame.dataUrl, lastFrame)
assert.equal(JSON.stringify(snapshot).includes('video.mp4;base64'), false, 'project must not embed MP4 bytes')
const restored = readProjectSnapshot(snapshot, base)
assert.equal(restored.shots[0].videoAssetId, videoAsset.id)
assert.equal(restored.shots[0].videoOffsetSeconds, 1)
assert.equal(restored.shots[1].videoContinuitySourceShotId, 1)
assert.equal(restored.shots[2].videoContinuitySourceShotId, 0)
assert.equal(restored.videoAssets[0].lastFrame.dataUrl, lastFrame)

const timeline = buildProductionTimeline({ ...restored, lines: [] })
assert.equal(timeline.items[0].videoReady, true)
assert.equal(timeline.items[0].imageReady, true)
assert.equal(timeline.items[0].videoOffsetSeconds, 1)

const split = splitShotAtPlayhead({
  shots: restored.shots,
  previousItems: timeline.items,
  playhead: 2,
})
assert.equal(split.valid, true)
assert.equal(split.leftShot.videoAssetId, videoAsset.id)
assert.equal(split.leftShot.videoOffsetSeconds, 1)
assert.equal(split.splitShot.videoAssetId, videoAsset.id)
assert.equal(split.splitShot.videoOffsetSeconds, 3)
assert.equal(split.splitShot.videoContinuitySourceShotId, 0)

const duplicated = duplicateShotSelectionInTimeline({
  shots: restored.shots,
  selectedShotIds: [2],
  previousItems: timeline.items,
})
assert.equal(duplicated.duplicatedShots[0].videoContinuitySourceShotId, 0)

const reordered = moveShotToIndex(restored.shots, 1, 2)
assert.equal(reordered.find((shot) => shot.id === 2).videoContinuitySourceShotId, 0)

const before = createTimelineSnapshot({ shots: restored.shots })
const after = createTimelineSnapshot({
  shots: restored.shots.map((shot) => shot.id === 1
    ? { ...shot, videoAssetId: '', videoOffsetSeconds: 0 }
    : shot),
})
const history = recordTimelineEdit(createEmptyTimelineHistory(), 'detach local video', before, { now: 1, coalesceMs: 0 })
const undo = undoTimelineEdit(history, after, 2)
assert.equal(undo.state.shotTimeline[0].videoAssetId, videoAsset.id)
assert.equal(undo.state.shotTimeline[0].videoOffsetSeconds, 1)
const redo = redoTimelineEdit(undo.history, undo.state, 3)
assert.equal(redo.state.shotTimeline[0].videoAssetId, '')

const assets = buildAssetLibraryIndex({
  episodes: restored.episodes,
  scenes: restored.scenes,
  shots: restored.shots,
  videoAssets: restored.videoAssets,
  shotVideoHealth: { [videoAsset.id]: { health: 'ready', mediaUrl: 'manju-media://shot-video/test/video.mp4' } },
})
const libraryVideo = assets.find((asset) => asset.kind === 'shot-video')
assert.equal(libraryVideo.thumbnailUrl, lastFrame)
assert.equal(libraryVideo.references.length, 1)
assert.equal(libraryVideo.storageScope, 'managed')
assert.equal(summarizeAssetLibrary(assets).managedBytes, videoAsset.bytes)
assert.equal(isAssetFileCompatible('shot-video', { name: 'real.mp4', type: 'video/mp4' }), true)
assert.equal(isAssetFileCompatible('shot-video', { name: 'fake.mov', type: 'video/quicktime' }), false)

console.log(JSON.stringify({
  passed: true,
  persistedAssetId: restored.shots[0].videoAssetId,
  invalidContinuityPruned: restored.shots[2].videoContinuitySourceShotId === 0,
  splitOffsets: [split.leftShot.videoOffsetSeconds, split.splitShot.videoOffsetSeconds],
  reorderContinuityPruned: reordered.find((shot) => shot.id === 2).videoContinuitySourceShotId === 0,
  undoRestoredVideo: undo.state.shotTimeline[0].videoAssetId === videoAsset.id,
  managedBytes: summarizeAssetLibrary(assets).managedBytes,
}))
