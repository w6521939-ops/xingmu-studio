import assert from 'node:assert/strict'
import {
  createOneClickProductionPlan,
  createOneClickInputHash,
  summarizeOneClickRun,
} from '../src/services/oneClickProductionPlanService.js'
import {
  createZeroCostModelSignature,
  normalizeZeroCostAutomationSettings,
  requiredZeroCostModels,
} from '../src/services/zeroCostAutomationSettings.js'

const snapshot = {
  format: 'manju-project',
  version: 2,
  project: {
    localProjectId: 'project-test-123456',
    name: '真实项目',
    synopsis: '雨夜中的旧钟楼',
  },
  content: {
    episodes: [{ id: 1, title: '第一集' }],
    characters: [
      { id: 1, name: '林听雨', appearance: '黑色长发', costume: '深蓝长裙', image: '' },
      {
        id: 2,
        name: '顾川',
        image: 'manju-media://generated-image/image-mrx8y0xc-2f773d68',
        imageAssetId: 'image-mrx8y0xc-2f773d68',
      },
    ],
    scenes: [{ id: 1, episodeId: 1, title: '旧钟楼', mainCharacterIds: [1, 2], image: '' }],
    shots: [
      {
        id: 1,
        episodeId: 1,
        sceneId: 1,
        characterIds: [1],
        visualPrompt: '林听雨抬手触碰钟盘',
        action: '触碰钟盘',
        duration: '5s',
        image: '',
        videoAssetId: '',
      },
      {
        id: 2,
        episodeId: 1,
        sceneId: 1,
        characterIds: [2],
        visualPrompt: '顾川回头',
        duration: '4s',
        image: 'data:image/png;base64,AAAA',
        videoAssetId: 'shot-video-existing-123',
      },
    ],
    lines: [
      {
        id: 1,
        episodeId: 1,
        sceneId: 1,
        speaker: '林听雨',
        text: '钟声又响了。',
        emotion: '惊讶',
        audio: '',
        audioStatus: '未生成',
      },
    ],
    videoAssets: [{ id: 'shot-video-existing-123' }],
  },
}

const plan = createOneClickProductionPlan(snapshot)
assert.equal(plan.ok, true)
assert.equal(plan.total, 8)
assert.deepEqual(plan.counts, {
  preflight: 0,
  'voice-assignment': 2,
  'character-images': 1,
  'scene-images': 1,
  'storyboard-images': 1,
  'voice-lines': 1,
  'shot-videos': 1,
  'episode-exports': 1,
  finalize: 0,
})
assert.equal(plan.skipped.characterImages, 1)
assert.equal(plan.skipped.storyboardImages, 1)
assert.equal(plan.skipped.shotVideos, 1)
assert.equal(plan.tasks[0].kind, 'voice-assignment')
const videoTask = plan.tasks.find((task) => task.kind === 'shot-video')
assert.equal(videoTask.request.resolution, '720P')
assert.equal(videoTask.request.firstFrameKey, 'shot:1')
assert.equal(videoTask.request.lastFrameKey, 'shot:2')
assert.equal(plan.tasks.find((task) => task.kind === 'voice-line').request.text, '钟声又响了。')
assert.equal(plan.tasks.at(-1).kind, 'episode-export')
assert.equal(createOneClickInputHash({ b: 2, a: 1 }), createOneClickInputHash({ a: 1, b: 2 }))

const signature = createZeroCostModelSignature(requiredZeroCostModels)
assert.equal(normalizeZeroCostAutomationSettings({
  confirmed: true,
  confirmedAt: '2026-07-23T00:00:00.000Z',
  modelSignature: signature,
}).confirmed, true)
assert.equal(normalizeZeroCostAutomationSettings({
  confirmed: true,
  confirmedAt: '2026-07-23T00:00:00.000Z',
  modelSignature: 'outdated',
}).confirmed, false)

assert.deepEqual(summarizeOneClickRun({
  tasks: [
    { status: 'succeeded' },
    { status: 'failed' },
    { status: 'pending' },
  ],
}), {
  total: 3,
  pending: 1,
  running: 0,
  succeeded: 1,
  failed: 1,
  skipped: 0,
  completed: 2,
})

assert.equal(createOneClickProductionPlan({
  project: { localProjectId: 'project-test-123456' },
  content: { episodes: [], scenes: [], shots: [] },
}).ok, false)

console.log('ONE_CLICK_PRODUCTION_PLAN_PASS')
