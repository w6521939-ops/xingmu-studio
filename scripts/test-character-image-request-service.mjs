import assert from 'node:assert/strict'
import {
  characterImageSizeOptions,
  createCharacterImagePrompt,
  createCharacterImageRequestPreview,
  maximumCharacterImagePromptCharacters,
} from '../src/services/characterImageRequestService.js'

const character = {
  id: 17,
  name: '沈砚',
  role: '男主',
  tone: '冷静克制',
  relation: '苏清浅的搭档',
  image: 'data:image/png;base64,iVBORw0KGgo=',
}

const prompt = createCharacterImagePrompt(character)
assert.match(prompt, /沈砚/u)
assert.match(prompt, /男主/u)
assert.match(prompt, /冷静克制/u)
assert.match(prompt, /苏清浅的搭档/u)
assert.doesNotMatch(prompt, /林夏|调查记者/u)

const sparsePrompt = createCharacterImagePrompt({ name: '阿岚' })
assert.match(sparsePrompt, /角色：阿岚/u)
assert.doesNotMatch(sparsePrompt, /角色定位：|声音气质：|人物关系：/u)
assert.match(createCharacterImagePrompt({}), /未命名角色/u)

const preview = createCharacterImageRequestPreview({
  character,
  prompt,
  size: characterImageSizeOptions[0].value,
  providerConfig: {
    provider: '阿里云百炼',
    model: 'wan2.7-image-pro',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
  },
  bailianStatus: {
    configured: true,
    paidGenerationEnabled: false,
  },
})

assert.equal(preview.ok, true)
assert.equal(preview.provider, '阿里云百炼')
assert.equal(preview.model, 'wan2.7-image-pro')
assert.equal(preview.referenceCount, 1)
assert.equal(preview.referenceMode, '本地角色参考图')
assert.equal(preview.configured, true)
assert.equal(preview.locked, true)
assert.equal(preview.executorAvailable, false)
assert.equal(preview.willSendRequest, false)
assert.equal(preview.n, 1)
assert.equal(preview.watermark, false)

const noReference = createCharacterImageRequestPreview({ character: { name: '阿岚' }, prompt: sparsePrompt })
assert.equal(noReference.referenceCount, 0)
assert.equal(noReference.referenceMode, '无参考图')

const invalid = createCharacterImageRequestPreview({
  character,
  prompt: 'x'.repeat(maximumCharacterImagePromptCharacters + 1),
  size: '1024*1024',
})
assert.equal(invalid.ok, false)
assert.equal(invalid.errors.length, 2)
assert.equal(invalid.willSendRequest, false)

const empty = createCharacterImageRequestPreview({ prompt: '   ' })
assert.equal(empty.ok, false)
assert.match(empty.errors[0], /不能为空/u)

console.log(JSON.stringify({
  passed: true,
  promptCharacters: prompt.length,
  referenceCount: preview.referenceCount,
  locked: preview.locked,
  willSendRequest: preview.willSendRequest,
}))
