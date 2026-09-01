import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createOneClickProductionController,
  isZeroCostStopFailure,
  requiredOneClickModelSignature,
} from '../electron/oneClickProductionService.js'

const root = await mkdtemp(path.join(os.tmpdir(), 'manju-one-click-'))
const events = []
let imageCalls = 0
let videoCalls = 0

const controller = createOneClickProductionController({
  automationRoot: path.join(root, 'automation'),
  workspaceRoot: path.join(root, 'workspace'),
  temporaryRoot: path.join(root, 'tmp'),
  shotVideoMediaRoot: path.join(root, 'videos'),
  voiceMediaRoot: path.join(root, 'voices'),
  ffmpegPath: 'fake-ffmpeg',
  generationOptions: { allowPaidGeneration: true },
  ratePolicies: {
    image: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
    voice: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
    video: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
  },
  imageGenerator: async ({ request }) => {
    imageCalls += 1
    return {
      ok: true,
      model: 'wan2.7-image-pro',
      image: {
        mediaUrl: `manju-media://generated-image/image-test${imageCalls}a-12345678`,
        assetId: `image-test${imageCalls}a-12345678`,
        fileName: `image-${imageCalls}.png`,
        bytes: 100,
        sha256: 'a'.repeat(64),
      },
      references: request.references,
    }
  },
  voiceGenerator: async () => ({
    ok: true,
    model: 'qwen3-tts-flash',
    mediaUrl: 'manju-media://voice/project-test/voice-line-test-123456.wav',
    asset: {
      id: 'voice-line-test-123456',
      source: 'bailian-download',
      fileName: 'line.wav',
      bytes: 100,
      duration: 1,
      sampleRate: 24000,
      sha256: 'c'.repeat(64),
      importedAt: new Date().toISOString(),
    },
  }),
  videoGenerator: async ({ request, onTaskSubmitted, onPoll }) => {
    videoCalls += 1
    assert.ok(request.firstFrame.assetId)
    assert.equal(request.lastFrame.assetId, request.firstFrame.assetId)
    await onTaskSubmitted({ taskId: 'video-task-1', requestId: 'request-1', model: 'wan2.7-i2v-2026-04-25' })
    await onPoll({ taskStatus: 'RUNNING', elapsedMilliseconds: 5000 })
    return {
      ok: true,
      model: 'wan2.7-i2v-2026-04-25',
      taskId: 'video-task-1',
      requestId: 'request-1',
      downloadPath: path.join(root, 'generated.mp4'),
    }
  },
  videoPreparer: async () => ({
    ok: true,
    asset: {
      id: 'shot-video-test-123456',
      source: 'local-import',
      fileName: 'video.mp4',
      bytes: 1000,
      duration: 5,
      width: 1280,
      height: 720,
      fps: 30,
      sha256: 'b'.repeat(64),
      importedAt: new Date().toISOString(),
      lastFrame: {
        dataUrl: 'data:image/jpeg;base64,AAAA',
        fileName: 'last.jpg',
        width: 1280,
        height: 720,
        extractedAt: new Date().toISOString(),
      },
    },
    mediaUrl: 'manju-media://shot-video/project/shot-video-test-123456.mp4',
  }),
  videoResolver: async () => path.join(root, 'videos', 'video.mp4'),
  voiceResolver: async () => path.join(root, 'voices', 'line.wav'),
  episodeExporter: async ({ items }) => {
    assert.ok(items[0].videoFilePath)
    assert.ok(items[0].audioFilePath)
    return { ok: true, outputPath: path.join(root, 'automatic.mp4'), segmentCount: 1 }
  },
  onProgress: (run) => events.push(run),
})

const plan = {
  projectLocalId: 'project-test-123456',
  projectName: '测试项目',
  tasks: [
    {
      id: 'voice-assignment:1:fnv1a-0',
      stage: 'voice-assignment',
      kind: 'voice-assignment',
      entityType: 'character',
      entityId: '1',
      label: '角色音色',
      inputHash: 'fnv1a-0',
      request: { assignment: { voiceId: 'Ethan', voiceName: '测试音色' } },
    },
    {
      id: 'character-image:1:fnv1a-1',
      stage: 'character-images',
      kind: 'character-image',
      entityType: 'character',
      entityId: '1',
      label: '角色图',
      inputHash: 'fnv1a-1',
      request: { purpose: 'character', entityId: '1', name: '角色图', prompt: '角色', size: '1536*1024', references: [] },
      referenceKeys: [],
    },
    {
      id: 'storyboard-image:1:fnv1a-2',
      stage: 'storyboard-images',
      kind: 'storyboard-image',
      entityType: 'shot',
      entityId: '1',
      label: '分镜图',
      inputHash: 'fnv1a-2',
      request: { purpose: 'storyboard', entityId: '1', name: '分镜图', prompt: '分镜', size: '1536*1024', references: [] },
      referenceKeys: ['character:1'],
    },
    {
      id: 'voice-line:1:fnv1a-voice',
      stage: 'voice-lines',
      kind: 'voice-line',
      entityType: 'line',
      entityId: '1',
      label: '台词配音',
      inputHash: 'fnv1a-voice',
      request: { lineId: '1', text: '台词', voiceId: 'Ethan' },
    },
    {
      id: 'shot-video:1:fnv1a-3',
      stage: 'shot-videos',
      kind: 'shot-video',
      entityType: 'shot',
      entityId: '1',
      label: '视频',
      inputHash: 'fnv1a-3',
      request: { prompt: '镜头', duration: 5, resolution: '720P', firstFrameKey: 'shot:1' },
    },
    {
      id: 'episode-export:1:fnv1a-4',
      stage: 'episode-exports',
      kind: 'episode-export',
      entityType: 'episode',
      entityId: '1',
      label: '自动成片',
      inputHash: 'fnv1a-4',
      request: {
        episodeId: '1',
        projectName: '测试项目',
        episodeTitle: '第一集',
        resolution: '1080x1920',
        items: [{ shot: { id: 1 }, lineId: '1', subtitle: '台词', duration: 5 }],
      },
    },
  ],
}

const startResult = await controller.start({
  plan,
  attestation: {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    modelSignature: requiredOneClickModelSignature,
  },
})
assert.equal(startResult.ok, true)
await controller.waitForIdle()
const status = await controller.status({ projectLocalId: plan.projectLocalId })
assert.equal(status.run.status, 'completed')
assert.equal(status.run.summary.succeeded, 6)
assert.equal(imageCalls, 2)
assert.equal(videoCalls, 1)
assert.ok(events.some((run) => run.tasks.some((task) => task.pollStatus === 'RUNNING')))
assert.ok(status.run.tasks[1].result.image.assetId)

const persistedFiles = events.length
assert.ok(persistedFiles > 5)
const persisted = JSON.parse(await readFile(path.join(
  root,
  'automation',
  plan.projectLocalId,
  'one-click-production.json',
), 'utf8'))
assert.equal(persisted.projectLocalId, plan.projectLocalId)
assert.equal(isZeroCostStopFailure({ providerCode: 'AllocationQuota.FreeTierOnly' }), true)
assert.equal(isZeroCostStopFailure({ error: '普通网络错误' }), false)

let lockedCalls = 0
const lockedController = createOneClickProductionController({
  automationRoot: path.join(root, 'locked-automation'),
  workspaceRoot: path.join(root, 'locked-workspace'),
  temporaryRoot: path.join(root, 'locked-tmp'),
  shotVideoMediaRoot: path.join(root, 'locked-videos'),
  voiceMediaRoot: path.join(root, 'locked-voices'),
  ffmpegPath: 'fake-ffmpeg',
  generationOptions: { allowPaidGeneration: false },
  imageGenerator: async () => {
    lockedCalls += 1
    return { ok: false }
  },
  voiceGenerator: async () => {
    lockedCalls += 1
    return { ok: false }
  },
  videoGenerator: async () => {
    lockedCalls += 1
    return { ok: false }
  },
  videoPreparer: async () => {
    lockedCalls += 1
    return { ok: false }
  },
  episodeExporter: async () => {
    lockedCalls += 1
    return { ok: false }
  },
  videoResolver: async () => '',
  voiceResolver: async () => '',
})
await assert.rejects(
  lockedController.start({
    plan,
    attestation: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      modelSignature: requiredOneClickModelSignature,
    },
  }),
  /真实生成已被环境锁定/u,
)
assert.equal(lockedCalls, 0)

let quotaCalls = 0
const quotaController = createOneClickProductionController({
  automationRoot: path.join(root, 'quota-automation'),
  workspaceRoot: path.join(root, 'quota-workspace'),
  temporaryRoot: path.join(root, 'quota-tmp'),
  shotVideoMediaRoot: path.join(root, 'quota-videos'),
  voiceMediaRoot: path.join(root, 'quota-voices'),
  ffmpegPath: 'fake-ffmpeg',
  generationOptions: { allowPaidGeneration: true },
  imageGenerator: async () => {
    quotaCalls += 1
    return {
      ok: false,
      providerCode: 'AllocationQuota.FreeTierOnly',
      error: 'The free tier of the model has been exhausted.',
    }
  },
  voiceGenerator: async () => {
    quotaCalls += 1
    return { ok: false }
  },
  videoGenerator: async () => {
    quotaCalls += 1
    return { ok: false }
  },
  videoPreparer: async () => ({ ok: false }),
  episodeExporter: async () => {
    quotaCalls += 1
    return { ok: false }
  },
  videoResolver: async () => '',
  voiceResolver: async () => '',
  ratePolicies: {
    image: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
    voice: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
    video: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
  },
})
await quotaController.start({
  plan,
  attestation: {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    modelSignature: requiredOneClickModelSignature,
  },
})
await quotaController.waitForIdle()
const quotaStatus = await quotaController.status({ projectLocalId: plan.projectLocalId })
assert.equal(quotaStatus.run.status, 'quota-stopped')
assert.equal(quotaStatus.run.stopReason, 'free-tier-or-billing')
assert.equal(quotaCalls, 1)
assert.equal(quotaStatus.run.summary.pending, 4)

let rateCalls = 0
let virtualNow = 1000
const waits = []
const rateEvents = []
const rateController = createOneClickProductionController({
  automationRoot: path.join(root, 'rate-automation'),
  workspaceRoot: path.join(root, 'rate-workspace'),
  temporaryRoot: path.join(root, 'rate-tmp'),
  shotVideoMediaRoot: path.join(root, 'rate-videos'),
  voiceMediaRoot: path.join(root, 'rate-voices'),
  ffmpegPath: 'fake-ffmpeg',
  generationOptions: { allowPaidGeneration: true },
  imageGenerator: async () => {
    rateCalls += 1
    if (rateCalls === 1) {
      return {
        ok: false,
        providerCode: 'Throttling.RateQuota',
        error: 'Requests rate limit exceeded, please try again later.',
      }
    }
    return {
      ok: true,
      model: 'wan2.7-image-pro',
      image: {
        mediaUrl: 'manju-media://generated-image/image-ratetesta-12345678',
        assetId: 'image-ratetesta-12345678',
        fileName: 'rate.png',
        bytes: 100,
        sha256: 'd'.repeat(64),
      },
    }
  },
  voiceGenerator: async () => ({ ok: false }),
  videoGenerator: async () => ({ ok: false }),
  videoPreparer: async () => ({ ok: false }),
  episodeExporter: async () => ({ ok: false }),
  videoResolver: async () => '',
  voiceResolver: async () => '',
  nowMilliseconds: () => virtualNow,
  sleep: async (milliseconds) => {
    waits.push(milliseconds)
    virtualNow += milliseconds
  },
  ratePolicies: {
    image: { intervalMilliseconds: 31000, cooldownMilliseconds: 65000, maximumAttempts: 3 },
    voice: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
    video: { intervalMilliseconds: 0, cooldownMilliseconds: 0, maximumAttempts: 3 },
  },
  onProgress: (run) => rateEvents.push(run),
})
const ratePlan = {
  projectLocalId: 'project-rate-123456',
  projectName: '限流恢复测试',
  tasks: [plan.tasks.find((task) => task.kind === 'character-image')],
}
await rateController.start({
  plan: ratePlan,
  attestation: {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    modelSignature: requiredOneClickModelSignature,
  },
})
await rateController.waitForIdle()
const rateStatus = await rateController.status({ projectLocalId: ratePlan.projectLocalId })
assert.equal(rateStatus.run.status, 'completed')
assert.equal(rateStatus.run.tasks[0].attempt, 2)
assert.equal(rateCalls, 2)
assert.deepEqual(waits, [65000])
assert.ok(rateEvents.some((run) => run.status === 'cooldown' && run.cooldown?.reason === 'rate-limit'))

await rm(root, { recursive: true, force: true })
console.log('ONE_CLICK_PRODUCTION_CONTROLLER_PASS')
