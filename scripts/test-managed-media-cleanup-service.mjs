import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  scanManagedProjectMedia,
  trashEligibleManagedMedia,
} from '../electron/managedMediaCleanupService.js'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from '../electron/shotVideoAssetService.js'

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'manju-cleanup-test-'))
const mediaRoot = path.join(tempRoot, 'user-data', 'media', 'shot-videos')
const recycleRoot = path.join(tempRoot, 'recycle-bin')
const projectLocalId = 'local-cleanup-test-project'
const inUseId = 'shot-video-in-use-test'
const protectedId = 'shot-video-protected-test'
const eligibleId = 'shot-video-eligible-test'
const unknownId = 'shot-video-unknown-test'
const projectKey = createShotVideoProjectKey(projectLocalId)

const asset = (id) => ({ id, kind: 'shot-video', fileName: `${id}.mp4`, bytes: 128 })
const snapshot = (videoAssets, references) => ({
  format: 'manju-project',
  version: 1,
  project: { localProjectId: projectLocalId, name: '清理测试项目' },
  content: {
    videoAssets,
    shots: references.map((videoAssetId, index) => ({ id: index + 1, videoAssetId })),
  },
})

const createVideo = async (assetId) => {
  const filePath = resolveManagedShotVideoPath({ mediaRoot, projectKey, assetId })
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, Buffer.alloc(128, assetId.length))
}

try {
  await Promise.all([inUseId, protectedId, eligibleId, unknownId].map(createVideo))
  const currentSnapshot = snapshot([asset(inUseId), asset(eligibleId)], [inUseId])
  const autosaveSnapshot = snapshot([asset(inUseId), asset(eligibleId)], [inUseId])
  const recoverySnapshot = snapshot([asset(protectedId), asset(eligibleId)], [protectedId])

  const scan = await scanManagedProjectMedia({
    mediaRoot,
    projectLocalId,
    currentSnapshot,
    autosaveSnapshot,
    recoverySnapshots: [recoverySnapshot],
  })
  assert.equal(scan.summary.total, 4)
  assert.equal(scan.summary.eligible, 1)
  assert.equal(scan.summary.inUse, 1)
  assert.equal(scan.summary.protected, 1)
  assert.equal(scan.summary.unknown, 1)
  assert.equal(scan.records.find((record) => record.assetId === eligibleId).status, 'eligible')
  assert.equal(scan.records.find((record) => record.assetId === unknownId).selectable, false)

  await mkdir(recycleRoot, { recursive: true })
  const cleanup = await trashEligibleManagedMedia({
    scan,
    mediaRoot,
    projectLocalId,
    selectedAssetIds: [eligibleId, unknownId],
    trashItem: async (assetPath) => rename(assetPath, path.join(recycleRoot, path.basename(assetPath))),
  })
  assert.equal(cleanup.trashed, 1)
  assert.equal(cleanup.skipped, 1)
  assert.equal(cleanup.failed, 0)

  await createVideo(eligibleId)
  const changedSnapshot = snapshot([asset(inUseId), asset(eligibleId)], [inUseId, eligibleId])
  const rescanned = await scanManagedProjectMedia({
    mediaRoot,
    projectLocalId,
    currentSnapshot: changedSnapshot,
    autosaveSnapshot,
    recoverySnapshots: [recoverySnapshot],
  })
  const guarded = await trashEligibleManagedMedia({
    scan: rescanned,
    mediaRoot,
    projectLocalId,
    selectedAssetIds: [eligibleId],
    trashItem: async () => assert.fail('重新变为在用的媒体不应进入回收站'),
  })
  assert.equal(guarded.skipped, 1)

  const busyScan = await scanManagedProjectMedia({
    mediaRoot,
    projectLocalId,
    currentSnapshot: snapshot([asset(eligibleId)], []),
    recoverySnapshots: [],
    writeBusy: true,
  })
  assert.equal(busyScan.records.find((record) => record.assetId === eligibleId).status, 'pending')

  console.log('MANAGED_MEDIA_CLEANUP_SERVICE_PASS=1')
  console.log('MANAGED_MEDIA_CLEANUP_USES_RECYCLE_BIN=1')
  console.log('MANAGED_MEDIA_CLEANUP_REAL_USER_MEDIA_TOUCHED=0')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
