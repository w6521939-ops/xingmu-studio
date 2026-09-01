import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import {
  discardManagedShotVideoAsset,
  createShotVideoProjectKey,
  inspectManagedShotVideoAsset,
  isShotVideoAssetCanceledError,
  prepareLocalShotVideoFromPath,
  resolveManagedShotVideoPath,
} from '../electron/shotVideoAssetService.js'
import { exportTimelineVideo } from '../electron/videoExportService.js'
import {
  applyShotVideoAsset,
  connectShotVideoLastFrame,
  detachShotVideoAsset,
  resolveShotVideoContinuityFrame,
} from '../src/services/shotVideoAssetService.js'

const execFileAsync = promisify(execFile)
const root = await mkdtemp(path.join(tmpdir(), 'manju-shot-video-asset-'))
const sourcePath = path.join(root, '真实用户镜头.mp4')
const mediaRoot = path.join(root, 'managed')

try {
  await execFileAsync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x3ca7e8:s=320x568:r=30:d=2.4',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2.4',
    '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', sourcePath,
  ])
  const sourceBefore = await readFile(sourcePath)
  const progress = []
  const result = await prepareLocalShotVideoFromPath({
    sourcePath,
    projectLocalId: 'local-test-project',
    mediaRoot,
    ffmpegPath,
    assetId: 'shot-video-test-asset',
    onProgress: (entry) => progress.push(entry.phase),
  })
  const sourceAfter = await readFile(sourcePath)
  assert.deepEqual(sourceAfter, sourceBefore)
  assert.equal(result.ok, true)
  assert.equal(result.asset.fileName, '真实用户镜头.mp4')
  assert.equal(result.asset.mimeType, 'video/mp4')
  assert.equal(result.asset.width, 320)
  assert.equal(result.asset.height, 568)
  assert.ok(result.asset.duration >= 2.3 && result.asset.duration <= 2.5)
  assert.match(result.asset.sha256, /^[a-f0-9]{64}$/u)
  assert.match(result.firstFrame.dataUrl, /^data:image\/jpeg;base64,/u)
  assert.match(result.asset.lastFrame.dataUrl, /^data:image\/jpeg;base64,/u)
  assert.match(result.mediaUrl, /^manju-media:\/\/shot-video\//u)
  assert.deepEqual(progress, ['validating', 'normalizing', 'extracting', 'ready'])
  assert.equal('sourcePath' in result, false)
  assert.equal('filePath' in result.asset, false)

  const health = await inspectManagedShotVideoAsset({ mediaRoot, projectLocalId: 'local-test-project', assetId: result.asset.id })
  assert.equal(health.health, 'ready')
  const managedVideoPath = resolveManagedShotVideoPath({
    mediaRoot,
    projectKey: createShotVideoProjectKey('local-test-project'),
    assetId: result.asset.id,
  })
  assert.equal((await stat(managedVideoPath)).isFile(), true)
  const managedProbe = await execFileAsync(ffmpegPath, ['-hide_banner', '-i', managedVideoPath]).catch((error) => error)
  assert.doesNotMatch(String(managedProbe.stderr || ''), /Audio:/u)

  const exportPath = path.join(root, '真实视频成片.mp4')
  const exportResult = await exportTimelineVideo({
    ffmpegPath,
    outputPath: exportPath,
    width: 360,
    height: 640,
    subtitlesEnabled: false,
    items: [{
      duration: 3,
      subtitle: '',
      videoFilePath: managedVideoPath,
      videoOffsetSeconds: 0.4,
      shot: { id: 1, videoAssetId: result.asset.id, videoOffsetSeconds: 0.4, transition: 'cut' },
      audioLine: null,
    }],
  })
  assert.equal(exportResult.videoSegmentCount, 1)
  assert.equal(exportResult.videoFallbackCount, 0)
  assert.equal(exportResult.placeholderCount, 0)
  assert.ok((await stat(exportPath)).size > 0)

  const fallbackExportPath = path.join(root, '缺失视频回退成片.mp4')
  const fallbackExportResult = await exportTimelineVideo({
    ffmpegPath,
    outputPath: fallbackExportPath,
    width: 360,
    height: 640,
    subtitlesEnabled: false,
    items: [{
      duration: 0.6,
      subtitle: '',
      videoFilePath: '',
      shot: { id: 9, image: result.firstFrame.dataUrl, videoAssetId: 'shot-video-missing-test', transition: 'cut' },
      audioLine: null,
    }],
  })
  assert.equal(fallbackExportResult.videoSegmentCount, 0)
  assert.equal(fallbackExportResult.videoFallbackCount, 1)
  assert.equal(fallbackExportResult.placeholderCount, 0)

  const canceledAssetId = 'shot-video-cancel-test'
  const controller = new AbortController()
  let canceled = false
  try {
    await prepareLocalShotVideoFromPath({
      sourcePath,
      projectLocalId: 'local-test-project',
      mediaRoot,
      ffmpegPath,
      assetId: canceledAssetId,
      signal: controller.signal,
      onProgress: ({ phase }) => {
        if (phase === 'normalizing') controller.abort()
      },
    })
  } catch (error) {
    canceled = isShotVideoAssetCanceledError(error)
  }
  assert.equal(canceled, true)
  const projectEntries = await readdir(path.join(mediaRoot, createShotVideoProjectKey('local-test-project')))
  assert.equal(projectEntries.includes(canceledAssetId), false)
  assert.equal(projectEntries.includes(`${canceledAssetId}-pending`), false)

  const shots = [{ id: 1, image: 'data:image/png;base64,AA==' }, { id: 2, image: 'data:image/png;base64,BB==' }]
  const applied = applyShotVideoAsset({ shots, assets: [], shotId: 1, asset: result.asset })
  assert.equal(applied.ok, true)
  assert.equal(applied.shots[0].videoAssetId, result.asset.id)
  const connected = connectShotVideoLastFrame({ shots: applied.shots, shotId: 1 })
  assert.equal(connected.shots[1].videoContinuitySourceShotId, 1)
  const continuity = resolveShotVideoContinuityFrame({ shot: connected.shots[1], shots: connected.shots, assets: applied.assets })
  assert.equal(continuity.dataUrl, result.asset.lastFrame.dataUrl)
  const detached = detachShotVideoAsset({ shots: connected.shots, shotId: 1 })
  assert.equal(detached.shots[0].videoAssetId, '')
  assert.equal(detached.shots[1].videoContinuitySourceShotId, 0)

  await discardManagedShotVideoAsset({ mediaRoot, projectLocalId: 'local-test-project', assetId: result.asset.id })
  const missing = await inspectManagedShotVideoAsset({ mediaRoot, projectLocalId: 'local-test-project', assetId: result.asset.id })
  assert.equal(missing.health, 'missing')

  console.log(JSON.stringify({
    passed: true,
    duration: result.asset.duration,
    dimensions: `${result.asset.width}x${result.asset.height}`,
    realFirstFrame: result.firstFrame.dataUrl.length > 100,
    realLastFrame: result.asset.lastFrame.dataUrl.length > 100,
    sourceUnchanged: true,
    sourcePathExposed: false,
    sourceAudioRemoved: true,
    realVideoExported: exportResult.videoSegmentCount === 1,
    missingVideoFallback: fallbackExportResult.videoFallbackCount === 1,
    cancellationCleaned: canceled,
  }))
} finally {
  await rm(root, { recursive: true, force: true })
}
