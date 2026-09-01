import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateBailianVideo } from '../electron/bailianVideoService.js'

const root = await mkdtemp(path.join(os.tmpdir(), 'manju-bailian-video-'))
const keyPath = path.join(root, 'key.txt')
const temporaryRoot = path.join(root, 'tmp')
await writeFile(keyPath, 'sk-test-video-service', 'utf8')

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const fakeVideo = Buffer.from('offline-mp4-for-controlled-test')
const calls = []
let pollCount = 0

const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {} })
  if (String(url).includes('/uploads?action=getPolicy')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: {
          upload_host: 'https://upload.example.aliyuncs.com',
          upload_dir: 'temporary/test',
          max_file_size_mb: 10,
          oss_access_key_id: 'test-access',
          signature: 'test-signature',
          policy: 'test-policy',
          x_oss_object_acl: 'private',
          x_oss_forbid_overwrite: 'true',
        },
      }),
    }
  }
  if (String(url) === 'https://upload.example.aliyuncs.com') {
    return { ok: true, status: 200 }
  }
  if (String(url).includes('/video-generation/video-synthesis')) {
    assert.equal(options.headers['X-DashScope-Async'], 'enable')
    assert.equal(options.headers['X-DashScope-OssResourceResolve'], 'enable')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'wan2.7-i2v-2026-04-25')
    assert.equal(body.parameters.resolution, '720P')
    assert.equal(body.parameters.watermark, false)
    assert.deepEqual(body.input.media.map((item) => item.type), ['first_frame', 'last_frame'])
    assert.equal(body.input.media[0].url, body.input.media[1].url)
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        request_id: 'request-video-1',
        output: { task_id: 'task-video-1', task_status: 'PENDING' },
      }),
    }
  }
  if (String(url).includes('/api/v1/tasks/task-video-1')) {
    pollCount += 1
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        request_id: 'request-video-poll-1',
        output: pollCount === 1
          ? { task_id: 'task-video-1', task_status: 'RUNNING' }
          : {
            task_id: 'task-video-1',
            task_status: 'SUCCEEDED',
            video_url: 'https://result.example.aliyuncs.com/video.mp4',
          },
      }),
    }
  }
  if (String(url) === 'https://result.example.aliyuncs.com/video.mp4') {
    return {
      ok: true,
      status: 200,
      headers: { get: () => String(fakeVideo.length) },
      arrayBuffer: async () => fakeVideo,
    }
  }
  throw new Error(`Unexpected URL: ${url}`)
}

try {
  const submitted = []
  const polls = []
  const result = await generateBailianVideo({
    request: {
      confirmed: true,
      prompt: '角色在雨夜缓慢转身，镜头轻微推进',
      negativePrompt: 'watermark',
      resolution: '720P',
      duration: 5,
      promptExtend: false,
      watermark: false,
      firstFrame: { dataUrl: onePixelPng },
    },
    workspaceRoot: root,
    temporaryRoot,
    environmentKey: '',
    keyCandidates: [{ filePath: keyPath, label: '测试 Key' }],
    allowPaidGeneration: true,
    fetchImpl,
    pollIntervalMilliseconds: 0,
    onTaskSubmitted: (event) => submitted.push(event),
    onPoll: (event) => polls.push(event),
  })
  assert.equal(result.ok, true)
  assert.equal(result.taskId, 'task-video-1')
  assert.equal(result.model, 'wan2.7-i2v-2026-04-25')
  assert.equal((await readFile(result.downloadPath)).equals(fakeVideo), true)
  assert.equal(submitted.length, 1)
  assert.deepEqual(polls.map((event) => event.taskStatus), ['RUNNING', 'SUCCEEDED'])
  assert.equal(calls.length, 6)

  let lockedCalls = 0
  const locked = await generateBailianVideo({
    request: {
      confirmed: true,
      prompt: '受控测试',
      resolution: '720P',
      duration: 5,
      firstFrame: { dataUrl: onePixelPng },
    },
    workspaceRoot: root,
    temporaryRoot,
    environmentKey: '',
    keyCandidates: [{ filePath: keyPath, label: '测试 Key' }],
    allowPaidGeneration: false,
    fetchImpl: async () => {
      lockedCalls += 1
      throw new Error('不应发送请求')
    },
  })
  assert.equal(locked.ok, false)
  assert.equal(locked.paidGenerationLocked, true)
  assert.equal(lockedCalls, 0)
  console.log('BAILIAN_VIDEO_SERVICE_PASS')
} finally {
  await rm(root, { recursive: true, force: true })
}
