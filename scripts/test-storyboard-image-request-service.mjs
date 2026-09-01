import assert from 'node:assert/strict'
import {
  collectStoryboardImageReferences,
  createStoryboardImagePromptDraft,
  createStoryboardImageRequestPreview,
  isStoryboardImageDataUrl,
  maximumStoryboardImagePromptCharacters,
  maximumStoryboardImageReferences,
  storyboardImageSizeOptions,
} from '../src/services/storyboardImageRequestService.js'

const image = (label) => `data:image/png;base64,${Buffer.from(label).toString('base64')}`
const characters = [
  { id: 1, name: '沈砚', role: '男主', image: image('shen') },
  { id: 2, name: '苏清浅', role: '女主', image: image('su') },
  { id: 3, name: '萧彻', role: '男配', image: image('xiao') },
  { id: 4, name: '林听雨', role: '女配', image: '' },
]
const shot = {
  id: 31,
  episodeId: 2,
  sceneId: 7,
  visualPrompt: '雨夜钟楼广场，沈砚回头看向远处，近景，缓慢推进。',
  action: '沈砚回头。',
  dialogue: '那个人果然来了。',
  size: '近景',
  motion: '缓慢推进',
  duration: '2.8s',
  costume: '深蓝风衣',
  continuityLocked: true,
  characterIds: [1, 2, 3, 4, 999, 1],
  image: image('shot'),
  imageFileName: '镜头31.png',
}

assert.equal(isStoryboardImageDataUrl(shot.image), true)
assert.equal(isStoryboardImageDataUrl('https://example.com/image.png'), false)
assert.equal(createStoryboardImagePromptDraft(shot), shot.visualPrompt)
assert.equal(createStoryboardImagePromptDraft({ visualPrompt: '  ' }), '')

const references = collectStoryboardImageReferences({ shot, characters })
assert.equal(references.referenceCount, maximumStoryboardImageReferences)
assert.deepEqual(references.references.map((reference) => reference.kind), ['shot', 'character', 'character'])
assert.deepEqual(references.references.map((reference) => reference.name), ['当前镜头图片', '沈砚', '苏清浅'])
assert.equal(references.characterBindings.length, 4)
assert.equal(references.characterBindings.find((binding) => binding.name === '萧彻').included, false)
assert.equal(references.characterBindings.find((binding) => binding.name === '林听雨').hasImage, false)
assert.equal(references.omittedReferenceCount, 1)

const preview = createStoryboardImageRequestPreview({
  shot,
  characters,
  prompt: createStoryboardImagePromptDraft(shot),
  size: storyboardImageSizeOptions[0].value,
  providerConfig: {
    provider: '阿里云百炼',
    model: 'wan2.7-image-pro',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
  },
  bailianStatus: { configured: true, paidGenerationEnabled: false },
})

assert.equal(preview.ok, true)
assert.equal(preview.provider, '阿里云百炼')
assert.equal(preview.model, 'wan2.7-image-pro')
assert.equal(preview.configured, true)
assert.equal(preview.locked, true)
assert.equal(preview.executorAvailable, false)
assert.equal(preview.willSendRequest, false)
assert.equal(preview.mode, 'reference-guided')
assert.equal(preview.referenceCount, 3)
assert.equal(preview.n, 1)
assert.equal(preview.watermark, false)
assert.equal(preview.shot.id, 31)
assert.equal(preview.shot.continuityLocked, true)

const textOnly = createStoryboardImageRequestPreview({
  shot: { ...shot, image: '', characterIds: [4] },
  characters,
  prompt: shot.visualPrompt,
})
assert.equal(textOnly.mode, 'text-to-image')
assert.equal(textOnly.referenceCount, 0)

const invalid = createStoryboardImageRequestPreview({
  shot,
  characters,
  prompt: '画'.repeat(maximumStoryboardImagePromptCharacters + 1),
  size: '1024*1024',
})
assert.equal(invalid.ok, false)
assert.equal(invalid.errors.length, 2)
assert.equal(invalid.willSendRequest, false)

const empty = createStoryboardImageRequestPreview({ shot, characters, prompt: '   ' })
assert.equal(empty.ok, false)
assert.match(empty.errors[0], /不能为空/u)

console.log(JSON.stringify({
  passed: true,
  referenceCount: preview.referenceCount,
  omittedReferenceCount: preview.omittedReferenceCount,
  locked: preview.locked,
  willSendRequest: preview.willSendRequest,
}))
