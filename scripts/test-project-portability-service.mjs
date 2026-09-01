import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  exportPortableProject,
  importPortableProjectAsCopy,
  inspectPortableProjectExport,
  inspectPortableProjectFolder,
  isPortableProjectCanceledError,
} from '../electron/projectPortabilityService.js'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from '../electron/shotVideoAssetService.js'

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'manju-portability-test-'))
const mediaRoot = path.join(tempRoot, 'user-data', 'media', 'shot-videos')
const exportRoot = path.join(tempRoot, 'exports')
const importMediaRoot = path.join(tempRoot, 'imported-user-data', 'media', 'shot-videos')
const localProjectId = 'local-portability-test-project'
const assetId = 'shot-video-portability-test'
const sourcePath = resolveManagedShotVideoPath({
  mediaRoot,
  projectKey: createShotVideoProjectKey(localProjectId),
  assetId,
})
const videoBytes = Buffer.alloc(2 * 1024 * 1024 + 137, 0x5a)
const videoHash = createHash('sha256').update(videoBytes).digest('hex')
const snapshot = {
  format: 'manju-project',
  version: 1,
  savedAt: '2026-07-23T00:00:00.000Z',
  project: {
    localProjectId,
    name: '便携项目真实数据测试',
    genre: '悬疑',
    ratio: '9:16',
    duration: '60s',
    episodeCount: 1,
    synopsis: '临时目录中的真实项目数据。',
  },
  content: {
    episodes: [{ id: 1, title: '第 1 集' }],
    scenes: [{ id: 1, episodeId: 1, title: '测试场景' }],
    characters: [],
    shots: [{ id: 1, sceneId: 1, videoAssetId: assetId }],
    videoAssets: [{ id: assetId, kind: 'shot-video', fileName: '真实镜头.mp4', bytes: videoBytes.length, sha256: videoHash }],
    lines: [],
    audioTracks: [],
  },
}

try {
  await mkdir(path.dirname(sourcePath), { recursive: true })
  await mkdir(exportRoot, { recursive: true })
  await writeFile(sourcePath, videoBytes)
  const projectText = JSON.stringify(snapshot, null, 2)
  const inspection = await inspectPortableProjectExport({
    snapshot,
    serializedProject: projectText,
    mediaRoot,
    appVersion: '1.33.0-test',
  })
  assert.equal(inspection.publicSummary.complete, true)
  assert.equal(inspection.publicSummary.videoAssetCount, 1)
  assert.equal(inspection.files[0].sha256, videoHash)
  assert.equal(JSON.stringify(inspection.publicSummary).includes(tempRoot), false, '公开预检结果不能泄露绝对路径')

  const progress = []
  const exported = await exportPortableProject({
    inspection,
    targetParentPath: exportRoot,
    onProgress: (entry) => progress.push(entry),
  })
  assert.equal(exported.ok, true)
  assert.equal(progress.at(-1).percent, 100)
  const bundleRoot = exported.outputPath
  const manifestText = await readFile(path.join(bundleRoot, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestText)
  assert.equal(manifest.version, 2)
  assert.equal(manifest.compatibility.minimumAppVersion, '1.33.0')
  assert.deepEqual(manifest.compatibility.requiredFeatures, ['integrity-sha256', 'managed-shot-video', 'import-as-copy', 'episode-production-scopes'])
  assert.equal(manifestText.includes(tempRoot), false, '清单不能写入本机绝对路径')
  assert.equal(/api[_-]?key|dashscope|bearer\s/iu.test(manifestText), false, '清单不能包含密钥字段')
  assert.equal(await readFile(path.join(bundleRoot, 'media', 'shot-videos', assetId, 'video.mp4'), 'hex'), videoBytes.toString('hex'))

  await assert.rejects(
    exportPortableProject({ inspection, targetParentPath: exportRoot }),
    /已存在同名便携项目/u,
  )

  const importedInspection = await inspectPortableProjectFolder({ bundleRoot })
  assert.equal(importedInspection.publicSummary.complete, true)
  assert.equal(importedInspection.compatibility.status, 'current')
  assert.equal(JSON.stringify(importedInspection.publicSummary).includes(tempRoot), false, '公开导入结果不能泄露绝对路径')
  const imported = await importPortableProjectAsCopy({
    inspection: importedInspection,
    mediaRoot: importMediaRoot,
    displayName: '便携项目导入副本',
  })
  assert.notEqual(imported.snapshot.project.localProjectId, localProjectId)
  assert.equal(imported.snapshot.project.name, '便携项目导入副本')
  const importedVideoPath = resolveManagedShotVideoPath({
    mediaRoot: importMediaRoot,
    projectKey: createShotVideoProjectKey(imported.snapshot.project.localProjectId),
    assetId,
  })
  assert.equal(createHash('sha256').update(await readFile(importedVideoPath)).digest('hex'), videoHash)

  const cancelRoot = path.join(tempRoot, 'cancel-export')
  await mkdir(cancelRoot)
  const controller = new AbortController()
  await assert.rejects(exportPortableProject({
    inspection,
    targetParentPath: cancelRoot,
    signal: controller.signal,
    onProgress: (entry) => {
      if (entry.phase === 'copying-media') controller.abort()
    },
  }), (error) => isPortableProjectCanceledError(error))
  assert.deepEqual(await readdir(cancelRoot), [], '取消后不能遗留暂存目录')

  const tamperedRoot = path.join(tempRoot, 'tampered.manju-bundle')
  await rename(bundleRoot, tamperedRoot)
  const tamperedVideoPath = path.join(tamperedRoot, 'media', 'shot-videos', assetId, 'video.mp4')
  await writeFile(tamperedVideoPath, Buffer.alloc(videoBytes.length, 0x1f))
  await assert.rejects(inspectPortableProjectFolder({ bundleRoot: tamperedRoot }), /SHA-256 校验失败/u)

  console.log('PROJECT_PORTABILITY_SERVICE_PASS=1')
  console.log(`PROJECT_PORTABILITY_VIDEO_BYTES=${videoBytes.length}`)
  console.log('PROJECT_PORTABILITY_PAID_CALLS=0')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
