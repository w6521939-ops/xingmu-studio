import assert from 'node:assert/strict'
import {
  assignCharacterVoice,
  assignCharacterVoices,
  characterVoiceCatalog,
  characterVoiceModel,
  createCharacterVoiceText,
  getCharacterVoice,
} from '../src/services/characterVoiceService.js'

assert.ok(characterVoiceCatalog.length >= 10)
assert.ok(characterVoiceCatalog.some((voice) => voice.id === 'Cherry'))
assert.ok(characterVoiceCatalog.every((voice) => /^[A-Z][A-Za-z ]+$/u.test(voice.id)))
assert.equal(characterVoiceModel, 'qwen3-tts-flash')

const girl = assignCharacterVoice({
  id: 1,
  name: '小雨',
  gender: '女',
  age: 8,
  personality: '甜萌可爱',
})
assert.equal(getCharacterVoice(girl.voiceId)?.gender, '女')
assert.ok(getCharacterVoice(girl.voiceId).age <= 15)
assert.equal(girl.voiceMode, 'auto')

const elder = assignCharacterVoice({
  id: 2,
  name: '长者',
  gender: '男',
  age: 70,
  personality: '沉稳权威',
})
assert.equal(getCharacterVoice(elder.voiceId)?.gender, '男')
assert.ok(getCharacterVoice(elder.voiceId).age >= 60)

const manuallySelected = characterVoiceCatalog.find((voice) => voice.gender === '女' && voice.age > 20)
const preserved = assignCharacterVoice({
  voiceId: manuallySelected.id,
  voiceMode: 'manual',
})
assert.equal(preserved.voiceId, manuallySelected.id)
assert.equal(preserved.voiceMode, 'manual')

assert.equal(assignCharacterVoices([{ id: 1, gender: '男', age: 24 }]).length, 1)
assert.equal(createCharacterVoiceText('别过来！', '愤怒'), '别过来！')
assert.equal(createCharacterVoiceText('你在哪里？', '默认'), '你在哪里？')
assert.equal(createCharacterVoiceText('', '愤怒'), '')

console.log('CHARACTER_VOICE_SERVICE_PASS')
