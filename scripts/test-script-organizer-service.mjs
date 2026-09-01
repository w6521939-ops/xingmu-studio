import assert from 'node:assert/strict'
import {
  createScriptOrganizerCommit,
  createScriptOrganizerPreview,
  defaultScriptOrganizerRules,
  maximumScriptOrganizerCharacters,
  normalizeScriptText,
  summarizeScriptOrganizerSelection,
} from '../src/services/scriptOrganizerService.js'

const normalized = normalizeScriptText('  第一段\r\n\t第二  段\u0007\n\n\n第三段  ', defaultScriptOrganizerRules)
assert.equal(normalized.text, '第一段\n第二 段\n\n第三段')
assert.deepEqual(normalized.reasons, ['removeControls', 'normalizeLineBreaks', 'trimWhitespace', 'collapseBlankLines'])
assert.equal(normalized.counts.removedControls, 1)

const punctuation = normalizeScriptText('没有句号\nhttps://example.com\nC:\\temp\\a.txt\n123\n🙂\n（转身）', {
  ...defaultScriptOrganizerRules,
  punctuation: true,
})
assert.equal(punctuation.text, '没有句号。\nhttps://example.com\nC:\\temp\\a.txt\n123\n🙂\n（转身）')
assert(punctuation.reasons.includes('punctuation'))

const scenes = [
  { id: 3, episodeId: 2, title: '月下相逢', location: '待设置', time: '待设置', action: '  雨夜\r\n\t相逢  ', narration: '' },
  { id: 4, episodeId: 2, title: '其他场景', location: '室内', time: '白天', action: '不应修改', narration: '保留' },
]
const lines = [
  { id: 1, episodeId: 2, sceneId: 3, speaker: '沈砚', text: '  今晚  不太平  ', emotion: '沉稳', status: '已确认', audioStatus: '已完成', audio: 'data:audio/wav;base64,AA', audioSource: 'local', audioFileName: 'a.wav', audioAttempt: 2 },
  { id: 2, episodeId: 2, sceneId: 3, speaker: '沈砚', text: '重复台词', emotion: '冷静', status: '未配音', audioStatus: '未生成' },
  { id: 3, episodeId: 2, sceneId: 3, speaker: '沈砚', text: '重复台词', emotion: '冷静', status: '未配音', audioStatus: '未生成' },
  { id: 4, episodeId: 2, sceneId: 3, speaker: '林听雨', text: '', emotion: '紧张', status: '未配音', audioStatus: '未生成' },
  { id: 5, episodeId: 2, sceneId: 4, speaker: '林听雨', text: '其他场景台词', emotion: '紧张', status: '已确认', audioStatus: '已完成', audio: 'data:audio/wav;base64,BB' },
]
const shots = [
  { id: 1, episodeId: 2, sceneId: 3, action: '分镜保持' },
  { id: 2, episodeId: 2, sceneId: 4, action: '其他分镜' },
]

const preview = createScriptOrganizerPreview({ scene: scenes[0], lines, shots, episodeId: 2 })
assert.equal(preview.error, '')
assert.deepEqual(preview.changes.map((change) => change.id), ['scene-3-action', 'line-1'])
assert.equal(preview.shotCount, 1)
assert.equal(preview.ruleCounts.trimWhitespace, 2)
assert(preview.diagnostics.some((item) => item.id === 'empty-narration'))
assert(preview.diagnostics.some((item) => item.id.startsWith('duplicate-lines-')))
assert(preview.diagnostics.some((item) => item.id === 'empty-line-4'))
assert(preview.diagnostics.some((item) => item.id === 'missing-location'))
assert(preview.diagnostics.some((item) => item.id === 'missing-time'))
assert(preview.diagnostics.some((item) => item.id === 'existing-shots'))

const selection = summarizeScriptOrganizerSelection(preview, preview.changes.map((change) => change.id))
assert.equal(selection.selectedCount, 2)
assert.equal(selection.audioCount, 1)
assert.equal(selection.shotCount, 1)
assert.equal(selection.byKind.action, 1)
assert.equal(selection.byKind.dialogue, 1)

const actionOnly = summarizeScriptOrganizerSelection(preview, ['scene-3-action'])
assert.equal(actionOnly.audioCount, 0)
assert.equal(actionOnly.selectedCount, 1)

const commit = createScriptOrganizerCommit({
  scenes,
  lines,
  selectedChanges: selection.selectedChanges,
  episodeId: 2,
  sceneId: 3,
})
assert.equal(commit.ok, true)
assert.equal(commit.updatedCount, 2)
assert.equal(commit.audioResetCount, 1)
assert.equal(commit.scenes.find((scene) => scene.id === 3).action, '雨夜\n相逢')
assert.equal(commit.scenes.find((scene) => scene.id === 4).action, '不应修改')
const changedLine = commit.lines.find((line) => line.id === 1)
assert.equal(changedLine.text, '今晚 不太平')
assert.equal(changedLine.audio, '')
assert.equal(changedLine.audioStatus, '未生成')
assert.equal(changedLine.status, '未配音')
assert.equal(changedLine.duration, '0.0s')
assert.equal(changedLine.audioUpdatedAt, '')
assert.match(changedLine.audioError, /台词内容已整理/u)
assert.equal(commit.lines.find((line) => line.id === 5).audio, 'data:audio/wav;base64,BB')

const scopedPreview = createScriptOrganizerPreview({
  scene: scenes[0],
  lines,
  shots,
  episodeId: 2,
  scopes: { action: false, narration: true, dialogue: false },
})
assert.equal(scopedPreview.changes.length, 0)
assert.deepEqual(scopedPreview.diagnostics.map((item) => item.id), ['empty-narration', 'missing-location', 'missing-time', 'existing-shots'])

const noScope = createScriptOrganizerPreview({
  scene: scenes[0],
  lines,
  shots,
  episodeId: 2,
  scopes: { action: false, narration: false, dialogue: false },
})
assert.match(noScope.error, /至少保留一个整理范围/u)

const oversized = createScriptOrganizerPreview({
  scene: { ...scenes[0], action: '文'.repeat(maximumScriptOrganizerCharacters + 1) },
  lines: [],
  shots: [],
  episodeId: 2,
  scopes: { action: true, narration: false, dialogue: false },
})
assert.match(oversized.error, /文本过大/u)

const unicode = normalizeScriptText('  👨‍👩‍👧‍👦 你好  ', defaultScriptOrganizerRules)
assert.equal(unicode.text, '👨‍👩‍👧‍👦 你好')

console.log(JSON.stringify({
  passed: true,
  changes: preview.changes.length,
  diagnostics: preview.diagnostics.length,
  updated: commit.updatedCount,
}))
