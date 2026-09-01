import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createV1ProjectBackupBeforeOverwrite } from '../electron/projectUpgradeBackupService.js'
import {
  createEmptyEpisodeProduction,
  flattenEpisodeAudioTracks,
  getEpisodeProduction,
  migrateProjectSnapshotV1ToV2,
  replaceEpisodeShots,
  updateEpisodeProduction,
} from '../src/services/episodeProductionService.js'
import {
  createProjectSnapshot,
  readProjectSnapshot,
} from '../src/services/projectModel.js'

const baseContent = {
  episodes: [
    { id: 1, title: '第一集' },
    { id: 2, title: '第二集' },
  ],
  scenes: [
    { id: 11, episodeId: 1, title: '第一集场景' },
    { id: 22, episodeId: 2, title: '第二集场景' },
  ],
  characters: [],
  shots: [
    { id: 101, episodeId: 1, sceneId: 11, dialogue: '第一集字幕', duration: '2.0s' },
    { id: 202, episodeId: 2, sceneId: 22, dialogue: '第二集字幕', duration: '3.0s' },
  ],
  videoAssets: [],
  lines: [],
}

const createV1Snapshot = (contentOverrides = {}, episodeCount = 2) => ({
  format: 'manju-project',
  version: 1,
  savedAt: '2026-07-23T00:00:00.000Z',
  project: {
    localProjectId: 'local-v35-service-test',
    name: 'V35 分集制作测试',
    genre: '悬疑',
    ratio: '9:16',
    duration: '60秒',
    episodeCount,
    synopsis: '验证真实项目迁移与分集制作隔离。',
  },
  content: {
    ...baseContent,
    ...contentOverrides,
  },
})

const legacyAudio = [{
  id: 1,
  kind: 'bgm',
  name: '旧版全片音乐',
  fileName: 'legacy.wav',
  audio: 'data:audio/wav;base64,UklGRg==',
  start: 0,
  duration: 8,
  volume: 35,
  fadeIn: 1,
  fadeOut: 1,
}]
const legacySubtitles = [{
  id: 'legacy-subtitle',
  sourceItemId: '',
  start: 0,
  end: 1.8,
  text: '旧版全片字幕',
}]

const migratedMulti = migrateProjectSnapshotV1ToV2(createV1Snapshot({
  audioTracks: legacyAudio,
  subtitleCues: legacySubtitles,
  subtitleCuesInitialized: true,
}))
assert.equal(migratedMulti.version, 2)
assert.equal(migratedMulti.content.episodeProductions.length, 2)
assert.equal(migratedMulti.content.episodeProductions.every((production) => production.audioTracks.length === 0), true)
assert.equal(getEpisodeProduction(migratedMulti.content.episodeProductions, 1).subtitleCues[0].text, '第一集字幕')
assert.equal(getEpisodeProduction(migratedMulti.content.episodeProductions, 2).subtitleCues[0].text, '第二集字幕')
assert.equal(migratedMulti.content.legacyProduction.audioTracks[0].name, '旧版全片音乐')
assert.equal(migratedMulti.content.legacyProduction.subtitleCues[0].text, '旧版全片字幕')
assert.equal(Object.hasOwn(migratedMulti.content, 'audioTracks'), false)
assert.equal(Object.hasOwn(migratedMulti.content, 'subtitleCues'), false)

const migratedEmptyMulti = migrateProjectSnapshotV1ToV2(createV1Snapshot({
  audioTracks: [],
  subtitleCues: [],
  subtitleCuesInitialized: false,
}))
assert.equal(Object.hasOwn(migratedEmptyMulti.content, 'legacyProduction'), false)

const singleContent = {
  ...baseContent,
  episodes: [baseContent.episodes[0]],
  scenes: [baseContent.scenes[0]],
  shots: [baseContent.shots[0]],
  audioTracks: legacyAudio,
  subtitleCues: legacySubtitles,
  subtitleCuesInitialized: true,
}
const migratedSingle = migrateProjectSnapshotV1ToV2(createV1Snapshot(singleContent, 1))
assert.equal(migratedSingle.content.episodeProductions.length, 1)
assert.equal(migratedSingle.content.episodeProductions[0].audioTracks[0].name, '旧版全片音乐')
assert.equal(migratedSingle.content.episodeProductions[0].subtitleCues[0].text, '旧版全片字幕')
assert.equal(Object.hasOwn(migratedSingle.content, 'legacyProduction'), false)

const productions = [
  { ...createEmptyEpisodeProduction(1), audioTracks: [{ ...legacyAudio[0], name: '第一集音乐' }] },
  { ...createEmptyEpisodeProduction(2), audioTracks: [{ ...legacyAudio[0], name: '第二集音乐' }] },
]
const updatedProductions = updateEpisodeProduction(productions, 2, (production) => ({
  ...production,
  audioTracks: production.audioTracks.map((track) => ({ ...track, name: '第二集已修改' })),
}))
assert.equal(getEpisodeProduction(updatedProductions, 1).audioTracks[0].name, '第一集音乐')
assert.equal(getEpisodeProduction(updatedProductions, 2).audioTracks[0].name, '第二集已修改')
assert.equal(updatedProductions[0], productions[0], '修改第二集时第一集对象应保持不变')

const replacedShots = replaceEpisodeShots(baseContent.shots, 2, [
  { id: 203, sceneId: 22, dialogue: '第二集新镜头', duration: '4.0s' },
])
assert.deepEqual(replacedShots.map((shot) => [shot.id, shot.episodeId]), [[101, 1], [203, 2]])

const flattenedAudio = flattenEpisodeAudioTracks(updatedProductions)
assert.deepEqual(flattenedAudio.map((track) => track.assetScopedId), ['1:1', '2:1'])
assert.deepEqual(flattenedAudio.map((track) => track.episodeId), [1, 2])
const flattenedWithLegacy = flattenEpisodeAudioTracks(updatedProductions, migratedMulti.content.legacyProduction)
assert.equal(flattenedWithLegacy.at(-1).assetScopedId, 'legacy:1')
assert.equal(flattenedWithLegacy.at(-1).readOnly, true)

const projectMeta = {
  localProjectId: 'local-v35-roundtrip',
  name: 'V35 往返测试',
  genre: '悬疑',
  ratio: '9:16',
  duration: '60秒',
  episodeCount: 2,
}
const v2Snapshot = createProjectSnapshot({
  projectMeta,
  storySeed: '分集制作往返测试。',
  ...baseContent,
  episodeProductions: updatedProductions,
  legacyProduction: migratedMulti.content.legacyProduction,
})
assert.equal(v2Snapshot.version, 2)
assert.equal(v2Snapshot.content.episodeProductions.length, 2)
const loaded = readProjectSnapshot(v2Snapshot, {
  projectMeta,
  storySeed: '',
  episodes: [],
  scenes: [],
  characters: [],
  shots: [],
  lines: [],
  videoAssets: [],
  subtitleStyle: {},
})
assert.equal(loaded.migrationInfo.migrated, false)
assert.equal(getEpisodeProduction(loaded.episodeProductions, 1).audioTracks[0].name, '第一集音乐')
assert.equal(getEpisodeProduction(loaded.episodeProductions, 2).audioTracks[0].name, '第二集已修改')
assert.equal(loaded.legacyProduction.audioTracks[0].name, '旧版全片音乐')

const backupTempRoot = await mkdtemp(path.join(os.tmpdir(), 'manju-v35-backup-test-'))
try {
  const sourcePath = path.join(backupTempRoot, '真实旧项目.manju')
  const sourceText = JSON.stringify(createV1Snapshot({
    audioTracks: legacyAudio,
    subtitleCues: legacySubtitles,
  }), null, 2)
  await writeFile(sourcePath, sourceText, 'utf8')
  const backupPath = await createV1ProjectBackupBeforeOverwrite({
    targetPath: sourcePath,
    nextSnapshot: v2Snapshot,
    maximumBytes: 10 * 1024 * 1024,
    now: new Date('2026-07-23T12:34:56.789Z'),
  })
  assert.equal(path.dirname(backupPath), backupTempRoot)
  assert.equal(path.basename(backupPath), '真实旧项目.v1-backup-2026-07-23T12-34-56-789Z.manju')
  assert.equal(await readFile(backupPath, 'utf8'), sourceText)
  await writeFile(sourcePath, JSON.stringify(v2Snapshot, null, 2), 'utf8')
  assert.equal(await createV1ProjectBackupBeforeOverwrite({
    targetPath: sourcePath,
    nextSnapshot: v2Snapshot,
    maximumBytes: 10 * 1024 * 1024,
  }), '')
} finally {
  await rm(backupTempRoot, { recursive: true, force: true })
}

console.log(JSON.stringify({
  passed: true,
  projectSchemaVersion: v2Snapshot.version,
  migratedEpisodeCount: migratedMulti.content.episodeProductions.length,
  legacyPreserved: Boolean(migratedMulti.content.legacyProduction),
  v1BackupVerified: true,
  isolatedAudioAssetIds: flattenedAudio.map((track) => track.assetScopedId),
}, null, 2))
