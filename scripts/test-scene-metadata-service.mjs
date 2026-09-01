import assert from 'node:assert/strict'
import {
  calculateSceneReadiness,
  estimateSceneDuration,
  formatSceneDuration,
  inferSceneCharacterIds,
  maximumSceneWeatherCharacters,
  normalizeMainCharacterIds,
  normalizeSceneMetadata,
  summarizeSceneMetadata,
  validateSceneMetadataField,
} from '../src/services/sceneMetadataService.js'

const characters = [
  { id: 1, name: '沈砚' },
  { id: 2, name: '苏清浅' },
  { id: 3, name: '林听雨' },
]
const scene = {
  id: 7,
  episodeId: 2,
  title: '雨夜重逢',
  location: '钟楼广场',
  time: '夜晚',
  weather: '小雨',
  mainCharacterIds: [3, 1],
  action: '沈砚停下脚步。林听雨从巷口出现！',
  narration: '秘密正在靠近',
}
const lines = [
  { id: 1, episodeId: 2, sceneId: 7, speaker: '林听雨', text: '小心身后' },
  { id: 2, episodeId: 3, sceneId: 8, speaker: '苏清浅', text: '不属于当前场景' },
]
const shots = [
  { id: 1, episodeId: 2, sceneId: 7, duration: '4.5s', characterIds: [1] },
  { id: 2, episodeId: 2, sceneId: 7, duration: '3.2s', characterIds: [3, 999] },
  { id: 3, episodeId: 3, sceneId: 8, duration: '100s', characterIds: [2] },
]

assert.deepEqual(normalizeMainCharacterIds([3, 3, 999, 1], characters), [1, 3])
assert.deepEqual(normalizeMainCharacterIds(undefined, characters), [])
assert.deepEqual(normalizeSceneMetadata({ id: 1 }, characters), { id: 1, weather: '', mainCharacterIds: [] })
assert.deepEqual(
  normalizeSceneMetadata({ id: 1, weather: '赛博酸雨', mainCharacterIds: [3, 999, 1] }, characters),
  { id: 1, weather: '赛博酸雨', mainCharacterIds: [1, 3] },
)

assert.equal(validateSceneMetadataField('weather', '雾').ok, true)
assert.equal(validateSceneMetadataField('weather', '雾\n雨').ok, false)
assert.equal(validateSceneMetadataField('weather', '🌧️'.repeat(maximumSceneWeatherCharacters + 1)).ok, false)
assert.equal(validateSceneMetadataField('unknown', '晴').ok, false)

const inferred = inferSceneCharacterIds({
  scene,
  lines,
  shots: [...shots, { id: 4, episodeId: 2, sceneId: 7, duration: '2s', characterIds: [2] }],
  characters,
})
assert.deepEqual(inferred, [1, 2, 3])

const shotDuration = estimateSceneDuration({ scene, lines, shots })
assert.deepEqual(shotDuration, {
  seconds: 7.7,
  source: 'shots',
  shotCount: 2,
  spokenCharacters: 0,
  actionUnitCount: 0,
})
assert.equal(formatSceneDuration(7.7), '7.7 秒')
assert.equal(formatSceneDuration(60), '1 分钟')
assert.equal(formatSceneDuration(80.5), '1 分 20.5 秒')
assert.equal(formatSceneDuration(0), '--')

const scriptDuration = estimateSceneDuration({
  scene: { ...scene, narration: '旁白台词', action: '动作一。动作二！' },
  lines: [],
  shots: [],
})
assert.equal(scriptDuration.source, 'script')
assert.equal(scriptDuration.spokenCharacters, 4)
assert.equal(scriptDuration.actionUnitCount, 2)
assert.equal(scriptDuration.seconds, 4)
assert.deepEqual(
  estimateSceneDuration({ scene: { ...scene, action: '', narration: '' }, lines: [], shots: [] }),
  { seconds: 0, source: 'empty', shotCount: 0, spokenCharacters: 0, actionUnitCount: 0 },
)

const completeReadiness = calculateSceneReadiness({ scene, lines, shots, characters })
assert.equal(completeReadiness.score, 100)
assert.equal(completeReadiness.status, '已就绪')
assert.equal(completeReadiness.checks[4].label, '已有 2 个分镜')

const emptyScene = { id: 9, episodeId: 2, title: '空场景', location: '待设置', time: '', weather: '', mainCharacterIds: [], action: '', narration: '' }
const emptyReadiness = calculateSceneReadiness({ scene: emptyScene, lines: [], shots: [], characters })
assert.equal(emptyReadiness.score, 0)
assert.equal(emptyReadiness.status, '待补充')
assert.deepEqual(emptyReadiness.checks.map((check) => check.complete), [false, false, false, false, false])

const partialReadiness = calculateSceneReadiness({
  scene: { ...emptyScene, location: '旧图书馆', time: '深夜', weather: '雾', action: '门缓缓打开。', mainCharacterIds: [1] },
  lines: [],
  shots: [],
  characters,
})
assert.equal(partialReadiness.score, 60)
assert.equal(partialReadiness.status, '可继续完善')

const summary = summarizeSceneMetadata({ scene, lines, shots, characters })
assert.deepEqual(summary.selectedCharacterIds, [1, 3])
assert.deepEqual(summary.displayCharacterIds, [1, 3])
assert.equal(summary.duration.label, '7.7 秒')
assert.equal(summary.readiness.score, 100)

console.log(JSON.stringify({
  passed: true,
  inferred,
  shotDuration: shotDuration.seconds,
  scriptDuration: scriptDuration.seconds,
  readiness: completeReadiness.score,
}))
