import assert from 'node:assert/strict'
import {
  createShotVideoDirectorPrompt,
  createShotVideoPromptDraft,
  createShotVideoRequestPreview,
  isShotVideoFrameDataUrl,
  mapShotVideoDuration,
  maximumShotVideoDuration,
  maximumShotVideoNegativePromptCharacters,
  maximumShotVideoPromptCharacters,
  maximumShotVideoSeed,
} from '../src/services/shotVideoRequestService.js'

const image = (label, type = 'png') => `data:image/${type};base64,${Buffer.from(label).toString('base64')}`
const shot = {
  id: 31,
  episodeId: 2,
  sceneId: 7,
  visualPrompt: '沈砚在雨夜钟楼广场回头，衣摆被风吹动。',
  action: '沈砚缓慢回头。',
  dialogue: '那个人果然来了。',
  size: '近景',
  motion: '缓慢推进',
  duration: '4.5s',
  costume: '深蓝风衣',
  continuityLocked: true,
  image: image('shot-31'),
  imageFileName: '镜头31.png',
}
const nextShot = {
  id: 32,
  episodeId: 2,
  sceneId: 7,
  action: '苏清浅从雨幕中走近。',
  image: image('shot-32', 'webp'),
  imageFileName: '镜头32.webp',
}

assert.equal(isShotVideoFrameDataUrl(shot.image), true)
assert.equal(isShotVideoFrameDataUrl(image('svg', 'svg+xml')), false)
assert.equal(isShotVideoFrameDataUrl('https://example.com/shot.png'), false)
assert.deepEqual(mapShotVideoDuration('4.5s'), { sourceDuration: 4.5, apiDuration: 5, adjusted: true })
assert.deepEqual(mapShotVideoDuration('0.6s'), { sourceDuration: 0.6, apiDuration: 2, adjusted: true })
assert.deepEqual(mapShotVideoDuration('99s'), { sourceDuration: 99, apiDuration: 15, adjusted: true })
assert.equal(createShotVideoPromptDraft(shot), shot.visualPrompt)

const directorPrompt = createShotVideoDirectorPrompt({
  shot,
  nextShot,
  episode: { title: '暗流涌动' },
  scene: { title: '月下相逢', location: '钟楼广场', time: '夜晚', weather: '小雨' },
})
assert.match(directorPrompt, /暗流涌动/u)
assert.match(directorPrompt, /月下相逢/u)
assert.match(directorPrompt, /缓慢推进/u)
assert.match(directorPrompt, /苏清浅从雨幕中走近/u)

const preview = createShotVideoRequestPreview({
  shot,
  nextShot,
  prompt: shot.visualPrompt,
  negativePrompt: '低清晰度，人物变形',
  mode: 'first-last',
  resolution: '720P',
  duration: 5,
  promptExtend: false,
  watermark: false,
  seed: '42',
  providerConfig: {
    provider: '阿里云百炼',
    model: 'wan2.7-i2v-2026-04-25',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
  },
  bailianStatus: { configured: true, paidGenerationEnabled: false },
})

assert.equal(preview.ok, true)
assert.equal(preview.provider, '阿里云百炼')
assert.equal(preview.model, 'wan2.7-i2v-2026-04-25')
assert.equal(preview.configured, true)
assert.equal(preview.locked, true)
assert.equal(preview.executorAvailable, false)
assert.equal(preview.willUpload, false)
assert.equal(preview.willCreateTask, false)
assert.equal(preview.willPollTask, false)
assert.equal(preview.mediaCount, 2)
assert.equal(preview.includeLastFrame, true)
assert.equal(preview.apiDuration, 5)
assert.equal(preview.seed, 42)
assert.equal(preview.drivingAudioIncluded, false)
assert.equal(preview.generatedAudioWillBeDiscarded, true)

const firstFrameOnly = createShotVideoRequestPreview({
  shot,
  nextShot: {},
  prompt: shot.visualPrompt,
})
assert.equal(firstFrameOnly.ok, true)
assert.equal(firstFrameOnly.mode, 'first-frame')
assert.equal(firstFrameOnly.mediaCount, 1)
assert.equal(firstFrameOnly.apiDuration, 5)

const missingFirstFrame = createShotVideoRequestPreview({ shot: { ...shot, image: '' }, prompt: shot.visualPrompt })
assert.equal(missingFirstFrame.ok, false)
assert.match(missingFirstFrame.errors[0], /真实首帧/u)

const invalid = createShotVideoRequestPreview({
  shot,
  nextShot: {},
  prompt: '镜'.repeat(maximumShotVideoPromptCharacters + 1),
  negativePrompt: '坏'.repeat(maximumShotVideoNegativePromptCharacters + 1),
  mode: 'first-last',
  resolution: '4K',
  duration: maximumShotVideoDuration + 1,
  seed: String(maximumShotVideoSeed + 1),
})
assert.equal(invalid.ok, false)
assert.equal(invalid.errors.length, 6)
assert.equal(invalid.willCreateTask, false)

console.log(JSON.stringify({
  passed: true,
  mode: preview.mode,
  mediaCount: preview.mediaCount,
  apiDuration: preview.apiDuration,
  locked: preview.locked,
  willUpload: preview.willUpload,
  willCreateTask: preview.willCreateTask,
}))
