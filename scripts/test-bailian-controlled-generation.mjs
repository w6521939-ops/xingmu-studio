import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  generateBailianEntity,
  generateBailianImage,
  getBailianEntityDryRun,
  getBailianImageDryRun,
  listBailianImageAssets,
  resolveBailianImageAsset,
} from '../electron/bailianProviderService.js'

const testDirectory = await mkdtemp(path.join(os.tmpdir(), 'manju-controlled-generation-'))
const keyPath = path.join(testDirectory, 'key.txt')
const testKey = 'sk-test-controlled-generation'
const keyCandidates = [{ filePath: keyPath, label: '测试 Key' }]
const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

try {
  await writeFile(keyPath, testKey, 'utf8')
  const entityRequest = {
    kind: 'character',
    prompt: '完善角色设定并保持身份连续性',
    context: { id: 1, name: '林岚', current: { role: '调查员' } },
  }
  assert.equal(getBailianEntityDryRun({ request: entityRequest }).createsPaidTask, false)

  let blockedCalls = 0
  const blocked = await generateBailianEntity({
    request: entityRequest,
    workspaceRoot: testDirectory,
    environmentKey: '',
    keyCandidates,
    allowPaidGeneration: true,
    fetchImpl: async () => {
      blockedCalls += 1
      throw new Error('不应调用')
    },
  })
  assert.equal(blocked.ok, false)
  assert.equal(blockedCalls, 0)

  let entityCalls = 0
  const entity = await generateBailianEntity({
    request: { ...entityRequest, confirmed: true },
    workspaceRoot: testDirectory,
    environmentKey: '',
    keyCandidates,
    allowPaidGeneration: true,
    fetchImpl: async () => {
      entityCalls += 1
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 'entity-offline',
          choices: [{ message: { content: JSON.stringify({
            role: '冷静调查员',
            tone: '低沉克制',
            relation: '与搭档互相信任',
            appearance: '短发，银色耳钉',
            costume: '深蓝风衣',
            forbiddenDrift: ['不得改变耳钉', '不得改变发型'],
          }) } }],
        }),
      }
    },
  })
  assert.equal(entity.ok, true)
  assert.equal(entityCalls, 1)

  const imageRequest = {
    purpose: 'character',
    entityId: '1',
    name: '林岚角色图',
    prompt: '中国漫剧角色设定图，短发调查员，深蓝风衣，干净背景',
    size: '1536*1024',
    references: [],
  }
  const imageDryRun = getBailianImageDryRun({ request: imageRequest })
  assert.equal(imageDryRun.createsPaidTask, false)
  assert.equal(imageDryRun.n, 1)

  let imageCalls = 0
  let imagePolls = 0
  const image = await generateBailianImage({
    request: { ...imageRequest, confirmed: true },
    workspaceRoot: testDirectory,
    environmentKey: '',
    keyCandidates,
    allowPaidGeneration: true,
    pollIntervalMilliseconds: 0,
    waitImpl: async () => {},
    fetchImpl: async (url, options = {}) => {
      imageCalls += 1
      if (String(url).includes('/image-generation/generation')) {
        assert.equal(options.headers['X-DashScope-Async'], 'enable')
        const body = JSON.parse(options.body)
        assert.equal(body.model, 'wan2.7-image-pro')
        assert.equal(body.parameters.n, 1)
        assert.equal(body.parameters.thinking_mode, true)
        assert.equal(Object.hasOwn(body.parameters, 'prompt_extend'), false)
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            request_id: 'image-create-offline',
            output: { task_id: 'image-task-offline', task_status: 'PENDING' },
          }),
        }
      }
      if (String(url).includes('/api/v1/tasks/image-task-offline')) {
        imagePolls += 1
        assert.equal(options.headers.Authorization, `Bearer ${testKey}`)
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(imagePolls === 1 ? {
            request_id: 'image-poll-running',
            output: { task_id: 'image-task-offline', task_status: 'RUNNING' },
          } : {
            request_id: 'image-poll-succeeded',
            output: {
              task_id: 'image-task-offline',
              task_status: 'SUCCEEDED',
              choices: [{ message: { content: [{ image: 'https://example.oss-cn-hangzhou.aliyuncs.com/offline.png' }] } }],
            },
            usage: { image_count: 1 },
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => onePixelPng,
      }
    },
  })
  assert.equal(image.ok, true)
  assert.equal(imageCalls, 4)
  assert.equal(imagePolls, 2)
  assert.equal(image.taskId, 'image-task-offline')
  assert.match(image.image.mediaUrl, /^manju-media:\/\/generated-image\/image-/u)
  assert.equal(Object.hasOwn(image.image, 'dataUrl'), false)
  const listed = await listBailianImageAssets({
    workspaceRoot: testDirectory,
    purpose: 'character',
    entityId: '1',
  })
  assert.equal(listed.ok, true)
  assert.equal(listed.networkRequests, 0)
  assert.equal(listed.assets[0].assetId, image.image.assetId)
  const resolved = await resolveBailianImageAsset({
    workspaceRoot: testDirectory,
    assetId: image.image.assetId,
  })
  assert.equal(resolved.filePath.startsWith(testDirectory), true)
  const managedReferenceDryRun = getBailianImageDryRun({
    request: {
      ...imageRequest,
      references: [{ id: 'character:1', name: '林岚角色图', assetId: image.image.assetId, bytes: image.image.bytes }],
    },
  })
  assert.equal(managedReferenceDryRun.managedReferenceCount, 1)
  assert.equal(JSON.stringify({ entity, image }).includes(testKey), false)
  const manifest = JSON.parse(await readFile(path.join(testDirectory, '.manju-studio', 'manifest.json'), 'utf8'))
  assert.equal(manifest.assets.length, 2)
  console.log(JSON.stringify({ passed: true, entityCalls, imageCalls, imageBytes: image.image.bytes, recoverableAssets: listed.assets.length }))
} finally {
  await rm(testDirectory, { recursive: true, force: true })
}
