import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createProjectFromBailianScript } from '../src/services/bailianScriptMapper.js'

const script = JSON.parse(await readFile(path.join(process.cwd(), 'scripts', 'fixtures', 'bailian-script-response.json'), 'utf8'))
const project = createProjectFromBailianScript(script, {
  storySeed: '未来云港的失忆调查员追查被删除的城市记忆。',
  genre: '未来悬疑',
  ratio: '9:16',
  duration: '30秒',
})

assert.equal(project.projectMeta.name, '云港零点钟声')
assert.equal(project.projectMeta.genre, '未来悬疑')
assert.equal(project.episodes.length, 1)
assert.equal(project.episodes[0].scenes, 2)
assert.equal(project.characters.length, 2)
assert.equal(project.characters[0].sourceId, 'C01')
assert.equal(project.props.length, 1)
assert.equal(project.props[0].sourceId, 'P01')
assert.equal(project.props[0].name, '记忆终端')
assert.equal(project.scenes.length, 2)
assert.deepEqual(project.scenes[0].mainCharacterIds, [1, 2])
assert.equal(project.shots.length, 4)
assert.equal(project.shots[0].duration, '4.0s')
assert.equal(project.shots[0].size, '全景')
assert.deepEqual(project.shots[0].characterIds, [1])
assert.deepEqual(project.shots[0].propIds, [1])
assert.match(project.shots[0].visualPrompt, /林澈/u)
assert.equal(project.lines.length, 4)
assert.equal(project.lines[0].speaker, '林澈')
assert.equal(project.lines[0].text, '又是零点。')
assert.equal(project.lines[3].speaker, '阿蓝')
assert.equal(project.lines.every((line) => line.audioStatus === '未生成'), true)
assert.equal(project.storySeed, '未来云港的失忆调查员追查被删除的城市记忆。')

console.log(JSON.stringify({
  passed: true,
  title: project.projectMeta.name,
  characters: project.characters.length,
  props: project.props.length,
  scenes: project.scenes.length,
  shots: project.shots.length,
  lines: project.lines.length,
}))
