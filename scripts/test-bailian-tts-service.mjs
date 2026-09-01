import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateBailianVoice } from '../electron/bailianTtsService.js'
import { resolveManagedVoiceAssetPath } from '../electron/voiceAssetService.js'
import { createShotVideoProjectKey } from '../electron/shotVideoAssetService.js'

const createWav = ({ sampleRate = 24000, duration = 0.1 } = {}) => {
  const samples = Math.round(sampleRate * duration)
  const dataBytes = samples * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  return buffer
}

const root = await mkdtemp(path.join(os.tmpdir(), 'manju-tts-'))
const voiceMediaRoot = path.join(root, 'voices')
const wav = createWav()
const requests = []
const fetchImpl = async (url, options = {}) => {
  requests.push({ url: String(url), options })
  if (requests.length === 1) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/temporary.wav' } },
        request_id: 'request-test-1',
        usage: { characters: 4 },
      }),
    }
  }
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
  }
}

const result = await generateBailianVoice({
  request: {
    confirmed: true,
    lineId: 'line-1',
    text: '别过来！',
    voiceId: 'Cherry',
  },
  environmentKey: 'sk-ws-test-only-not-a-real-key',
  apiHost: 'https://workspace-test.cn-beijing.maas.aliyuncs.com',
  allowPaidGeneration: true,
  fetchImpl,
  voiceMediaRoot,
  projectLocalId: 'project-test-123456',
})
assert.equal(result.ok, true)
assert.equal(requests.length, 2)
assert.equal(requests[0].url, 'https://workspace-test.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation')
assert.equal(JSON.parse(requests[0].options.body).model, 'qwen3-tts-flash')
assert.equal(JSON.parse(requests[0].options.body).input.language_type, 'Chinese')
assert.equal(JSON.parse(requests[0].options.body).input.voice, 'Cherry')
assert.equal(requests[1].url, 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/temporary.wav')
assert.equal(result.asset.sampleRate, 24000)
assert.equal(result.asset.source, 'bailian-download')
assert.ok(result.mediaUrl.startsWith('manju-media://voice/'))
const filePath = resolveManagedVoiceAssetPath({
  mediaRoot: voiceMediaRoot,
  projectKey: createShotVideoProjectKey('project-test-123456'),
  assetId: result.asset.id,
})
assert.deepEqual(await readFile(filePath), wav)

let lockedCalls = 0
const locked = await generateBailianVoice({
  request: {
    confirmed: true,
    text: '不会发送',
    voiceId: 'Cherry',
  },
  environmentKey: 'sk-test-only-not-a-real-key',
  allowPaidGeneration: false,
  fetchImpl: async () => {
    lockedCalls += 1
    throw new Error('不应调用')
  },
  voiceMediaRoot,
  projectLocalId: 'project-test-123456',
})
assert.equal(locked.ok, false)
assert.equal(locked.providerCode, 'PAID_GENERATION_DISABLED')
assert.equal(lockedCalls, 0)

let missingWorkspaceCalls = 0
const missingWorkspace = await generateBailianVoice({
  request: { confirmed: true, text: '工作空间地址测试', voiceId: 'Cherry' },
  environmentKey: 'sk-ws-test-only-not-a-real-key',
  allowPaidGeneration: true,
  fetchImpl: async () => {
    missingWorkspaceCalls += 1
    throw new Error('缺少工作空间地址时不应调用网络')
  },
  voiceMediaRoot,
  projectLocalId: 'project-test-123456',
})
assert.equal(missingWorkspace.ok, false)
assert.equal(missingWorkspace.providerCode, 'WORKSPACE_TTS_HOST_REQUIRED')
assert.equal(missingWorkspaceCalls, 0)

await rm(root, { recursive: true, force: true })
console.log('BAILIAN_TTS_SERVICE_PASS')
