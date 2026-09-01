import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { app, BrowserWindow } from 'electron'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { prepareLocalShotVideoFromPath } from '../electron/shotVideoAssetService.js'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const execFileAsync = promisify(execFile)
const runtimeRoot = await mkdtemp(path.join(tmpdir(), 'manju-local-shot-video-ui-'))
const sourcePath = path.join(runtimeRoot, '真实镜头.mp4')
const mediaRoot = path.join(runtimeRoot, 'managed')
const testDataDirectory = path.join(runtimeRoot, 'user-data')
const preloadPath = path.join(runtimeRoot, 'preload.cjs')
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'local-shot-video-asset-library-verified.png')

await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
await execFileAsync(ffmpegPath, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2.6',
  '-f', 'lavfi', '-i', 'sine=frequency=740:duration=2.6',
  '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', sourcePath,
])

const prepared = await prepareLocalShotVideoFromPath({
  sourcePath,
  projectLocalId: 'local-v32-ui-project',
  mediaRoot,
  ffmpegPath,
  assetId: 'shot-video-v32-ui-test',
})
const managedVideoPath = path.join(mediaRoot, prepared.projectKey, prepared.asset.id, 'video.mp4')
const actualVideoDataUrl = `data:video/mp4;base64,${(await readFile(managedVideoPath)).toString('base64')}`
const actualPreparedResult = { ...prepared, mediaUrl: actualVideoDataUrl }
const snapshot = createTestUserProjectSnapshot()
snapshot.project.localProjectId = 'local-v32-ui-project'
snapshot.content.videoAssets = []
snapshot.content.shots[0] = {
  ...snapshot.content.shots[0],
  image: prepared.firstFrame.dataUrl,
  imageStatus: '已完成',
  imageSource: 'local',
  imageFileName: '镜头01-真实分镜.jpg',
}
snapshot.content.shots[1] = {
  ...snapshot.content.shots[1],
  image: prepared.asset.lastFrame.dataUrl,
  imageStatus: '已完成',
  imageSource: 'local',
  imageFileName: '镜头02-真实分镜.jpg',
}

await writeFile(preloadPath, `
const { contextBridge } = require('electron')
const snapshot = ${JSON.stringify(snapshot)}
const prepared = ${JSON.stringify(actualPreparedResult)}
let progressListener = null
const metrics = { prepares: 0, checks: 0, paidCalls: 0, discards: 0 }
contextBridge.exposeInMainWorld('manjuDesktop', Object.freeze({
  getBailianStatus: async () => ({ ok: true, configured: false, paidGenerationEnabled: false, capabilities: {} }),
  loadAutosave: async () => ({ ok: true, snapshot }),
  saveAutosave: async () => ({ ok: true }),
  listRecentProjects: async () => ({ ok: true, recents: [] }),
  listTimelineRecoveries: async () => ({ ok: true, points: [] }),
  saveTimelineRecovery: async () => ({ ok: true, points: [] }),
  listVideoExports: async () => ({ ok: true, history: [] }),
  prepareLocalShotVideo: async () => {
    metrics.prepares += 1
    for (const update of [
      { phase: 'validating', message: '正在验证真实 MP4' },
      { phase: 'normalizing', message: '正在本地标准化并移除源音轨' },
      { phase: 'extracting', message: '正在提取真实首帧与末帧' },
      { phase: 'ready', message: '真实视频已准备，等待确认采用' },
    ]) {
      progressListener?.(update)
      await new Promise((resolve) => setTimeout(resolve, 18))
    }
    return prepared
  },
  cancelLocalShotVideoPreparation: async () => ({ ok: false }),
  discardLocalShotVideo: async () => { metrics.discards += 1; return { ok: true } },
  checkLocalShotVideos: async ({ assetIds }) => {
    metrics.checks += 1
    return { ok: true, assets: Object.fromEntries(assetIds.map((id) => [id, { health: 'ready', bytes: prepared.asset.bytes, mediaUrl: prepared.mediaUrl }])) }
  },
  revealLocalShotVideo: async () => ({ ok: true }),
  onLocalShotVideoProgress: (callback) => { progressListener = callback; return () => { progressListener = null } },
  onVideoExportProgress: () => () => undefined,
  onMenuCommand: () => () => undefined,
  getLocalShotVideoTestMetrics: () => ({ ...metrics }),
}))
`, 'utf8')

app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 960,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        preload: preloadPath,
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    let remoteRequestCount = 0
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
      remoteRequestCount += 1
      callback({})
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'final' } })

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitFor = async (selector, timeout = 2500) => {
        const started = performance.now()
        while (!document.querySelector(selector)) {
          if (performance.now() - started > timeout) throw new Error('等待元素超时：' + selector)
          await wait(25)
        }
        return document.querySelector(selector)
      }
      await waitFor('.local-shot-video-card')
      let rendererFetchCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => { rendererFetchCalls += 1; return originalFetch(...args) }
      const importButton = document.querySelector('.local-shot-video-card > .primary-button')
      const initial = { label: importButton?.textContent.trim(), emptyState: document.querySelector('.local-shot-video-card > p')?.textContent.trim() }
      importButton.click()
      const adoption = await waitFor('.local-shot-video-adoption')
      const frameImages = Array.from(adoption.querySelectorAll('.local-shot-video-frames img')).map((image) => image.src)
      const adoptionState = {
        title: adoption.querySelector('h2')?.textContent.trim(),
        frameCount: frameImages.length,
        firstFrameReal: frameImages.includes(${JSON.stringify(prepared.firstFrame.dataUrl)}),
        lastFrameReal: frameImages.includes(${JSON.stringify(prepared.asset.lastFrame.dataUrl)}),
        safety: adoption.querySelector('.local-shot-video-safety')?.textContent.replace(/\\s+/gu, ' ').trim(),
        facts: adoption.querySelector('.local-shot-video-facts')?.textContent.replace(/\\s+/gu, ' ').trim(),
      }
      Array.from(adoption.querySelectorAll('footer button')).find((button) => button.textContent.includes('采用到当前镜头')).click()
      await waitFor('.local-shot-video-preview')
      await wait(120)
      const adoptedState = {
        videoVisible: Boolean(document.querySelector('.local-shot-video-preview')),
        videoSourceReal: document.querySelector('.local-shot-video-preview')?.src.startsWith('data:video/mp4;base64,'),
        status: document.querySelector('.local-shot-video-card > header > em')?.textContent.trim(),
        summary: document.querySelector('.local-shot-video-summary')?.textContent.replace(/\\s+/gu, ' ').trim(),
        timelineVideoBadge: Boolean(document.querySelector('.timeline-video-badges svg')),
      }
      document.querySelector('.local-shot-video-continuity').click()
      const continuity = await waitFor('.shot-video-continuity-dialog')
      const continuityState = {
        title: continuity.querySelector('h2')?.textContent.trim(),
        realLastFrame: continuity.querySelector('.shot-video-continuity-frames article:first-child img')?.src === ${JSON.stringify(prepared.asset.lastFrame.dataUrl)},
        noOverwrite: continuity.querySelector('.shot-video-continuity-note')?.textContent.includes('不覆盖下一镜头分镜图'),
      }
      Array.from(continuity.querySelectorAll('footer button')).find((button) => button.textContent.includes('连接到下一镜头')).click()
      await wait(80)
      const segments = document.querySelectorAll('.timeline-segment')
      segments[1].querySelector('.timeline-segment__select').click()
      await wait(70)
      const connectedState = {
        aiCard: document.querySelector('.shot-video-entry-card header small')?.textContent.trim(),
        continuityBadge: Boolean(segments[1].querySelector('.timeline-video-badges .is-continuity')),
      }
      document.querySelector('.shot-video-entry-card > button').click()
      const requestDialog = await waitFor('.shot-video-api-dialog')
      const requestFirstFrame = requestDialog.querySelector('.shot-video-api-frame-flow article:first-child img')?.src
      requestDialog.querySelector('.shot-video-api-close').click()
      await wait(50)
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '素材').click()
      await waitFor('.asset-library-page')
      const videoCategory = Array.from(document.querySelectorAll('.asset-filter-list button')).find((button) => button.textContent.includes('镜头视频'))
      videoCategory.click()
      await wait(60)
      const assetState = {
        categoryCount: Number(videoCategory.querySelector('b')?.textContent || 0),
        cardCount: document.querySelectorAll('.asset-card').length,
        managedStorage: document.querySelector('.asset-storage-card footer')?.textContent.replace(/\\s+/gu, ' ').trim(),
        realThumbnail: document.querySelector('.asset-card .asset-preview__image')?.src === ${JSON.stringify(prepared.asset.lastFrame.dataUrl)},
      }
      await wait(180)
      return {
        initial,
        adoptionState,
        adoptedState,
        continuityState,
        connectedState,
        requestFirstFrameIsLast: requestFirstFrame === ${JSON.stringify(prepared.asset.lastFrame.dataUrl)},
        assetState,
        rendererFetchCalls,
        metrics: window.manjuDesktop.getLocalShotVideoTestMetrics(),
        processingAbsent: !document.querySelector('.local-shot-video-processing'),
        assetPageVisible: Boolean(document.querySelector('.asset-library-page')),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })()`)

    assert.deepEqual(result.initial, { label: '导入本地 MP4', emptyState: '当前镜头尚未采用本地视频' })
    assert.equal(result.adoptionState.title, '采用本地镜头视频')
    assert.equal(result.adoptionState.frameCount, 3)
    assert.equal(result.adoptionState.firstFrameReal, true)
    assert.equal(result.adoptionState.lastFrameReal, true)
    assert.match(result.adoptionState.safety, /仅本地处理.*源文件不修改.*源音轨已移除/u)
    assert.match(result.adoptionState.facts, /真实文件信息.*2\.6 秒.*360×640.*继续使用项目音轨/u)
    assert.equal(result.adoptedState.videoVisible, true)
    assert.equal(result.adoptedState.videoSourceReal, true)
    assert.equal(result.adoptedState.status, '已采用')
    assert.match(result.adoptedState.summary, /真实镜头\.mp4.*2\.6 秒 · 360×640.*真实末帧已保留/u)
    assert.equal(result.adoptedState.timelineVideoBadge, true)
    assert.equal(result.continuityState.title, '使用真实末帧承接下一镜头？')
    assert.equal(result.continuityState.realLastFrame, true)
    assert.equal(result.continuityState.noOverwrite, true)
    assert.match(result.connectedState.aiCard, /承接上一镜头真实末帧/u)
    assert.equal(result.connectedState.continuityBadge, true)
    assert.equal(result.requestFirstFrameIsLast, true)
    assert.equal(result.assetState.categoryCount, 1)
    assert.equal(result.assetState.cardCount, 1)
    assert.match(result.assetState.managedStorage, /本机托管\s+.*KB|本机托管\s+.*MB/u)
    assert.equal(result.assetState.realThumbnail, true)
    assert.equal(result.rendererFetchCalls, 0)
    assert.equal(result.metrics.prepares, 1)
    assert.ok(result.metrics.checks >= 1)
    assert.equal(result.metrics.paidCalls, 0)
    assert.equal(result.metrics.discards, 0)
    assert.equal(result.processingAbsent, true)
    assert.equal(result.assetPageVisible, true)
    assert.equal(result.horizontalOverflow, false)
    assert.equal(remoteRequestCount, 0)

    window.showInactive()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG())
    window.setSize(1024, 760)
    await new Promise((resolve) => setTimeout(resolve, 220))
    const responsiveState = await window.webContents.executeJavaScript(`({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      videoCategoryVisible: Boolean(Array.from(document.querySelectorAll('.asset-filter-list button')).find((button) => button.textContent.includes('镜头视频'))),
      inspectorVisible: Boolean(document.querySelector('.asset-inspector')),
    })`)
    assert.equal(responsiveState.horizontalOverflow, false)
    assert.equal(responsiveState.videoCategoryVisible, true)
    assert.equal(responsiveState.inspectorVisible, true)
    window.hide()
    console.log(JSON.stringify({ passed: true, screenshotPath, remoteRequestCount, responsiveState, result }))
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})

app.on('will-quit', async () => {
  await rm(runtimeRoot, { recursive: true, force: true }).catch(() => undefined)
})
