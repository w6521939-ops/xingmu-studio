import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createBailianScriptRequest,
  generateBailianScript,
  getBailianScriptDryRun,
  getPublicBailianStatus,
  normalizeBailianScript,
  probeBailianCapability,
  resolveBailianKey,
} from '../electron/bailianProviderService.js'

const testDirectory = await mkdtemp(path.join(os.tmpdir(), 'manju-bailian-provider-'))
const keyFile = path.join(testDirectory, 'key.txt')
const testKey = 'sk-ws-test-provider-boundary'

try {
  await writeFile(keyFile, `DASHSCOPE_API_KEY=${testKey}\n`, 'utf8')
  const keyCandidates = [{ filePath: keyFile, label: '测试目录 key.txt' }]

  const keyInfo = await resolveBailianKey({ environmentKey: '', keyCandidates })
  assert.equal(keyInfo.configured, true)
  assert.equal(keyInfo.keyType, 'sk-ws')
  assert.equal(keyInfo.source, '测试目录 key.txt')

  const publicStatus = await getPublicBailianStatus({ environmentKey: '', keyCandidates })
  assert.equal(publicStatus.ok, true)
  assert.equal(publicStatus.configured, true)
  assert.equal(publicStatus.capabilities.script.model, 'qwen3.7-plus')
  assert.equal(publicStatus.capabilities.image.model, 'wan2.7-image-pro')
  assert.equal(publicStatus.capabilities.voice.model, 'qwen3-tts-flash')
  assert.equal(publicStatus.capabilities.video.model, 'wan2.7-i2v-2026-04-25')
  assert.equal(Object.hasOwn(publicStatus, 'key'), false)
  assert.equal(JSON.stringify(publicStatus).includes(testKey), false)
  assert.equal(publicStatus.paidGenerationEnabled, false)

  let requestCount = 0
  let asyncHeader = ''
  const acceptedFetch = async (_url, options) => {
    requestCount += 1
    assert.equal(options.headers.Authorization, `Bearer ${testKey}`)
    asyncHeader = options.headers['X-DashScope-Async'] || ''
    return { status: 400, text: async () => '{"message":"input is required"}' }
  }
  const videoProbe = await probeBailianCapability({
    capability: 'video',
    environmentKey: '',
    keyCandidates,
    fetchImpl: acceptedFetch,
  })
  assert.equal(videoProbe.ok, true)
  assert.equal(videoProbe.status, 400)
  assert.equal(asyncHeader, 'enable')

  const voiceProbe = await probeBailianCapability({
    capability: 'voice',
    environmentKey: '',
    keyCandidates,
    fetchImpl: acceptedFetch,
  })
  assert.equal(voiceProbe.ok, true)
  assert.equal(voiceProbe.model, 'qwen3-tts-flash')
  assert.equal(requestCount, 2)

  const rejectedProbe = await probeBailianCapability({
    capability: 'script',
    environmentKey: '',
    keyCandidates,
    fetchImpl: async () => ({ status: 401, text: async () => '{"message":"invalid api key"}' }),
  })
  assert.equal(rejectedProbe.ok, false)
  assert.match(rejectedProbe.error, /拒绝/u)

  const fixture = JSON.parse(await readFile(path.join(process.cwd(), 'scripts', 'fixtures', 'bailian-script-response.json'), 'utf8'))
  const normalizedFixture = normalizeBailianScript(fixture)
  assert.equal(normalizedFixture.title, '云港零点钟声')
  assert.equal(normalizedFixture.sections.length, 2)

  const generationRequest = {
    theme: '未来云港的失忆调查员追查被删除的城市记忆。',
    genre: '未来悬疑',
    ratio: '9:16',
    duration: '30秒',
  }
  const requestBody = createBailianScriptRequest(generationRequest)
  assert.equal(requestBody.model, 'qwen3.7-plus')
  assert.deepEqual(requestBody.response_format, { type: 'json_object' })
  const dryRun = getBailianScriptDryRun({ request: generationRequest })
  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.createsPaidTask, false)
  assert.equal(dryRun.model, 'qwen3.7-plus')

  let generationCalls = 0
  const generated = await generateBailianScript({
    request: { ...generationRequest, confirmed: true },
    workspaceRoot: testDirectory,
    environmentKey: '',
    keyCandidates,
    allowPaidGeneration: true,
    fetchImpl: async (url, options) => {
      generationCalls += 1
      assert.match(url, /compatible-mode\/v1\/chat\/completions$/u)
      assert.equal(options.headers.Authorization, `Bearer ${testKey}`)
      const body = JSON.parse(options.body)
      assert.equal(body.model, 'qwen3.7-plus')
      assert.deepEqual(body.response_format, { type: 'json_object' })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'chatcmpl-offline-fixture',
          choices: [{ message: { content: JSON.stringify(fixture) } }],
          usage: { prompt_tokens: 120, completion_tokens: 640, total_tokens: 760 },
        }),
      }
    },
  })
  assert.equal(generated.ok, true)
  assert.equal(generationCalls, 1)
  assert.equal(generated.script.characters.length, 2)
  assert.match(generated.artifact.localPath, /^\.manju-studio\/outputs\/scripts\//u)
  const persistedScript = JSON.parse(await readFile(path.join(testDirectory, generated.artifact.localPath), 'utf8'))
  assert.equal(persistedScript.title, fixture.title)
  const manifest = JSON.parse(await readFile(path.join(testDirectory, '.manju-studio', 'manifest.json'), 'utf8'))
  assert.equal(manifest.assets.length, 1)
  assert.equal(manifest.assets[0].useful, true)
  assert.equal(JSON.stringify(generated).includes(testKey), false)

  let lockedGenerationCalls = 0
  const lockedGeneration = await generateBailianScript({
    request: { ...generationRequest, confirmed: true },
    workspaceRoot: testDirectory,
    environmentKey: '',
    keyCandidates,
    fetchImpl: async () => {
      lockedGenerationCalls += 1
      throw new Error('付费锁开启时不应发送请求')
    },
  })
  assert.equal(lockedGeneration.ok, false)
  assert.equal(lockedGeneration.paidGenerationLocked, true)
  assert.equal(lockedGenerationCalls, 0)

  console.log(JSON.stringify({
    passed: true,
    keySource: keyInfo.source,
    keyType: keyInfo.keyType,
    publicStatusContainsKey: false,
    videoProbe: { ok: videoProbe.ok, status: videoProbe.status, model: videoProbe.model },
    voiceProbe: { ok: voiceProbe.ok, status: voiceProbe.status, model: voiceProbe.model },
    rejectedKeyMapped: true,
    scriptDryRun: { ok: dryRun.ok, model: dryRun.model, createsPaidTask: dryRun.createsPaidTask },
    offlineGenerationFixture: { ok: generated.ok, generationCalls, persisted: true, keyReturned: false },
    paidGenerationLock: { enabledByDefault: true, networkRequests: lockedGenerationCalls },
  }))
} finally {
  await rm(testDirectory, { recursive: true, force: true })
}
