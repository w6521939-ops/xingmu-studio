import assert from 'node:assert/strict'
import {
  analyzeDialoguePreviewRows,
  createDialogueCommit,
  maximumDialoguePreviewRows,
  maximumDialogueSourceCharacters,
  parseDialogueSource,
  summarizeDialoguePreviewRows,
} from '../src/services/dialogueSplitService.js'

const characters = [
  { id: 1, name: '沈砚', variant: 1 },
  { id: 2, name: '林听雨', variant: 5 },
]
const existingLines = [
  { id: 2, episodeId: 1, sceneId: 9, speaker: '沈砚', text: '已有台词', audio: 'data:audio/wav;base64,AAAA', audioStatus: '已完成' },
  { id: 7, episodeId: 2, sceneId: 3, speaker: '沈砚', text: '今晚的风，不太平。', audio: '', audioStatus: '未生成' },
  { id: 8, episodeId: 2, sceneId: 4, speaker: '林听雨', text: '其他场景台词', audioFileName: 'other.wav', audioStatus: '已完成' },
]

const parsed = parseDialogueSource({
  source: [
    '沈砚：今晚的风，不太平。',
    '林听雨（紧张）: 他们已经盯上你了。',
    '周舟：陌生角色台词',
    '旁白：雨越来越大。',
    '这是一行动作描述',
    '',
  ].join('\r\n'),
  characters,
})
assert.equal(parsed.blocked, false)
assert.equal(parsed.rows.length, 5)
assert.equal(parsed.ignoredBlankLines, 1)
assert.equal(parsed.rows[0].speaker, '沈砚')
assert.equal(parsed.rows[0].emotion, '默认')
assert.equal(parsed.rows[1].speaker, '林听雨')
assert.equal(parsed.rows[1].emotion, '紧张')
assert.equal(parsed.rows[2].speaker, '')
assert.equal(parsed.rows[4].formatRecognized, false)

const appendAnalysis = analyzeDialoguePreviewRows({
  rows: parsed.rows,
  characters,
  existingLines,
  episodeId: 2,
  sceneId: 3,
  mode: 'append',
})
assert.equal(appendAnalysis[0].status, 'duplicate')
assert.equal(appendAnalysis[1].status, 'ready')
assert.equal(appendAnalysis[2].status, 'unknown-speaker')
assert.equal(appendAnalysis[3].status, 'narration')
assert.equal(appendAnalysis[4].status, 'unrecognized-format')
assert.deepEqual(summarizeDialoguePreviewRows(appendAnalysis), {
  readyCount: 1,
  unresolvedCount: 2,
  duplicateCount: 1,
  excludedCount: 1,
})

const resolvedRows = parsed.rows.map((row) => row.id === 'source-3'
  ? { ...row, speaker: '沈砚', emotion: '冷静' }
  : row.id === 'source-4'
    ? { ...row, included: false }
    : row)
const appendCommit = createDialogueCommit({
  lines: existingLines,
  rows: resolvedRows,
  characters,
  episodeId: 2,
  scene: { id: 3, title: '测试场景' },
  mode: 'append',
})
assert.equal(appendCommit.ok, true)
assert.equal(appendCommit.createdLines.length, 2)
assert.deepEqual(appendCommit.createdLines.map((line) => line.id), [9, 10])
assert.equal(appendCommit.createdLines[0].speaker, '林听雨')
assert.equal(appendCommit.createdLines[0].status, '未配音')
assert.equal(appendCommit.createdLines[0].audioStatus, '未生成')
assert.equal(appendCommit.lines.length, existingLines.length + 2)

const replaceRows = parseDialogueSource({
  source: '沈砚：替换后的第一句\n林听雨[坚定]：替换后的第二句',
  characters,
}).rows
const replaceCommit = createDialogueCommit({
  lines: existingLines,
  rows: replaceRows,
  characters,
  episodeId: 2,
  scene: { id: 3, title: '替换场景' },
  mode: 'replace',
})
assert.equal(replaceCommit.ok, true)
assert.equal(replaceCommit.removedLines.length, 1)
assert.equal(replaceCommit.removedAudioCount, 0)
assert.deepEqual(replaceCommit.lines.filter((line) => line.sceneId === 3).map((line) => line.text), ['替换后的第一句', '替换后的第二句'])
assert.equal(replaceCommit.lines.find((line) => line.sceneId === 4).text, '其他场景台词')

const replaceAudioCommit = createDialogueCommit({
  lines: existingLines,
  rows: replaceRows,
  characters,
  episodeId: 1,
  scene: { id: 9, title: '含音频场景' },
  mode: 'replace',
})
assert.equal(replaceAudioCommit.removedAudioCount, 1)

const duplicateSource = parseDialogueSource({ source: '沈砚：重复\n沈砚：重复', characters })
const duplicateSourceAnalysis = analyzeDialoguePreviewRows({ rows: duplicateSource.rows, characters, existingLines: [], episodeId: 2, sceneId: 3 })
assert.equal(duplicateSourceAnalysis[0].status, 'ready')
assert.equal(duplicateSourceAnalysis[1].status, 'duplicate')

const controlSource = parseDialogueSource({ source: '沈砚：有效\u0000台词\t继续', characters })
assert.equal(controlSource.removedControlCharacters, 1)
assert.equal(controlSource.rows[0].text, '有效台词 继续')
assert.equal(parseDialogueSource({ source: 'x'.repeat(maximumDialogueSourceCharacters + 1), characters }).blocked, true)
assert.equal(parseDialogueSource({ source: Array.from({ length: maximumDialoguePreviewRows + 1 }, (_, index) => `沈砚：${index}`).join('\n'), characters }).blocked, true)

const longLine = parseDialogueSource({ source: `沈砚：${'😀'.repeat(501)}`, characters })
assert.equal(analyzeDialoguePreviewRows({ rows: longLine.rows, characters })[0].status, 'line-too-long')

console.log(JSON.stringify({ passed: true, parsedRows: parsed.rows.length, appendCreated: appendCommit.createdLines.length }))
