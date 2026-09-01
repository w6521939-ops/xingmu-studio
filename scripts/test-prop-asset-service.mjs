import assert from 'node:assert/strict'
import { createProjectSnapshot, readProjectSnapshot } from '../src/services/projectModel.js'
import { createPropContinuitySummary, normalizePropAssets } from '../src/services/propAssetService.js'

const props = normalizePropAssets([{
  id: 1,
  sourceId: 'P01',
  name: '旧式磁带录音机',
  appearance: '米白色磁带机，标签固定写着“守一，10月17日”。',
  function: '保存灯塔事故前的关键录音。',
  forbiddenDrift: ['不得改变标签文字', '保持米白色旧化外壳'],
}])

assert.equal(props.length, 1)
assert.equal(props[0].imageStatus, '未生成')
assert.match(createPropContinuitySummary(props[0]), /10月17日/u)

const snapshot = createProjectSnapshot({
  projectMeta: { localProjectId: 'local-prop-test', name: '道具连续性测试', genre: '悬疑', ratio: '9:16', duration: '30秒' },
  storySeed: '测试道具稳定 ID 是否进入项目快照。',
  episodes: [{ id: 1, title: '第一集' }],
  scenes: [{ id: 1, episodeId: 1, title: '灯塔底部', mainCharacterIds: [] }],
  characters: [],
  props,
  shots: [{ id: 1, episodeId: 1, sceneId: 1, propIds: [1], action: '播放录音', duration: '3.0s' }],
  lines: [],
  videoAssets: [],
  episodeProductions: [],
  legacyProduction: null,
})

assert.equal(snapshot.content.props.length, 1)
assert.deepEqual(snapshot.content.shots[0].propIds, [1])

const loaded = readProjectSnapshot(snapshot, {
  projectMeta: {}, storySeed: '', episodes: [], scenes: [], characters: [], props: [], shots: [], lines: [],
  videoAssets: [], audioTracks: [], subtitleCues: [], subtitleCuesInitialized: false, subtitleStyle: {},
})

assert.equal(loaded.props[0].sourceId, 'P01')
assert.deepEqual(loaded.shots[0].propIds, [1])

console.log(JSON.stringify({ passed: true, props: loaded.props.length, propIds: loaded.shots[0].propIds }))
