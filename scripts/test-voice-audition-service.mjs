import assert from 'node:assert/strict'
import {
  clampAuditionTime,
  findAdjacentPlayableLineId,
  formatAuditionTime,
  getAuditionProgress,
  getVoiceLineAudioSourceStatus,
  isValidAuditionDuration,
  normalizeAuditionVolume,
} from '../src/services/voiceAuditionService.js'

assert.equal(isValidAuditionDuration(2.7), true)
assert.equal(isValidAuditionDuration('3.2'), true)
assert.equal(isValidAuditionDuration(0), false)
assert.equal(isValidAuditionDuration(Number.POSITIVE_INFINITY), false)
assert.equal(isValidAuditionDuration('invalid'), false)

assert.equal(clampAuditionTime(-1, 8), 0)
assert.equal(clampAuditionTime(3.25, 8), 3.25)
assert.equal(clampAuditionTime(12, 8), 8)
assert.equal(clampAuditionTime(2, 0), 0)
assert.equal(getAuditionProgress(2, 8), 25)
assert.equal(getAuditionProgress(12, 8), 100)
assert.equal(getAuditionProgress(2, Number.NaN), 0)

assert.equal(formatAuditionTime(0), '00:00.0')
assert.equal(formatAuditionTime(2.66), '00:02.7')
assert.equal(formatAuditionTime(62.79), '01:02.8')
assert.equal(formatAuditionTime(-1), '--:--.-')
assert.equal(formatAuditionTime(Number.NaN), '--:--.-')

assert.equal(normalizeAuditionVolume(0.42), 0.42)
assert.equal(normalizeAuditionVolume(-1), 0)
assert.equal(normalizeAuditionVolume(2), 1)
assert.equal(normalizeAuditionVolume('invalid'), 0.6)
assert.equal(normalizeAuditionVolume('invalid', 0.8), 0.8)

const lines = [
  { id: 1, audio: 'data:audio/wav;base64,one' },
  { id: 2, audio: '' },
  { id: 3, audio: 'data:audio/wav;base64,three' },
  { id: 4, audio: '   ' },
  { id: 5, audio: 'data:audio/wav;base64,five' },
]
assert.equal(findAdjacentPlayableLineId(lines, 1, 1), 3)
assert.equal(findAdjacentPlayableLineId(lines, 3, -1), 1)
assert.equal(findAdjacentPlayableLineId(lines, 3, 1), 5)
assert.equal(findAdjacentPlayableLineId(lines, 5, 1), null)
assert.equal(findAdjacentPlayableLineId(lines, 99, 1), null)

assert.deepEqual(getVoiceLineAudioSourceStatus({ audio: 'data:audio/wav;base64,a', audioFileName: '台词.wav' }), {
  key: 'local',
  label: '本地音频',
  detail: '台词.wav',
})
assert.equal(getVoiceLineAudioSourceStatus({ audioStatus: '已完成' }).key, 'empty')
assert.equal(getVoiceLineAudioSourceStatus({ audioStatus: '生成中' }).key, 'empty')
assert.equal(getVoiceLineAudioSourceStatus({ audioStatus: '已完成' }).label, '无真实音频')
assert.equal(getVoiceLineAudioSourceStatus({ audioStatus: '失败', audioError: '失败原因' }).detail, '失败原因')
assert.equal(getVoiceLineAudioSourceStatus({ audio: 'data:audio/wav;base64,broken', audioStatus: '失败' }).key, 'error')
assert.equal(getVoiceLineAudioSourceStatus({}).key, 'empty')

console.log(JSON.stringify({
  passed: true,
  formatted: formatAuditionTime(62.79),
  progress: getAuditionProgress(2, 8),
  nextPlayableLineId: findAdjacentPlayableLineId(lines, 1, 1),
}))
