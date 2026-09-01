import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const workspaceRoot = process.cwd()
const outputDirectory = path.join(workspaceRoot, 'outputs', 'runtime')
const testDataDirectory = path.join(workspaceRoot, 'outputs', `studio-flow-ui-${Date.now()}-${process.pid}`)
const snapshotPath = path.join(testDataDirectory, 'snapshot.json')
const progressScreenshotPath = path.join(outputDirectory, 'studio-production-progress.png')
const resultScreenshotPath = path.join(outputDirectory, 'studio-production-result.png')
const demoVideoPath = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo', '灯塔回响-15秒面试演示.mp4')
const zeroCostSettings = {
  version: 1,
  confirmed: true,
  confirmedAt: '2026-08-06T00:00:00.000Z',
  modelSignature: 'script:qwen3.7-plus|image:wan2.7-image-pro|voice:qwen3-tts-flash|video:wan2.7-i2v-2026-04-25',
}

await mkdir(testDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await writeFile(snapshotPath, JSON.stringify(createTestUserProjectSnapshot()), 'utf8')
process.env.MANJU_TEST_SNAPSHOT_PATH = snapshotPath
process.env.MANJU_TOUR_OUTPUT_PATH = demoVideoPath
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1600,
      height: 900,
      show: false,
      backgroundColor: '#080d13',
      webPreferences: {
        preload: path.join(workspaceRoot, 'scripts', 'fixtures', 'studio-production-tour-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    const indexPath = path.join(workspaceRoot, 'dist', 'index.html')
    await window.loadFile(indexPath)
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.zero-cost-automation.v1', ${JSON.stringify(JSON.stringify(zeroCostSettings))})`)
    await window.loadFile(indexPath, { query: { page: 'studio' } })
    await new Promise((resolve) => setTimeout(resolve, 650))

    const prep = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.xm-one-click').click()
      await wait(80)
      const noPrematureRun = window.manjuTour.getRun() === null
      document.querySelector('.xm-primary-action').click()
      await wait(120)
      return {
        noPrematureRun,
        progressVisible: Boolean(document.querySelector('[data-testid="studio-production-progress"]')),
        drawerAbsent: !document.querySelector('.one-click-production-drawer'),
      }
    })()`)
    assert.deepEqual(prep, { noPrematureRun: true, progressVisible: true, drawerAbsent: true })

    const running = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      window.manjuTour.setPhase('running')
      await wait(100)
      const page = document.querySelector('[data-testid="studio-production-progress"]')
      return {
        visible: Boolean(page),
        currentTask: page?.querySelector('.xm-current-production h2')?.textContent.trim(),
        stageCount: page?.querySelectorAll('.xm-stage-progress-list article').length,
        taskCount: page?.querySelectorAll('.xm-task-queue article').length,
        safety: page?.querySelector('.xm-progress-safety strong')?.textContent.trim(),
      }
    })()`)
    assert.equal(running.visible, true)
    assert.equal(Boolean(running.currentTask), true)
    assert.equal(running.stageCount, 4)
    assert.equal(running.taskCount, 40)
    assert.match(running.safety, /免费额度保护运行中/u)
    await new Promise((resolve) => setTimeout(resolve, 280))
    await writeFile(progressScreenshotPath, (await window.webContents.capturePage()).toPNG())

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      window.manjuTour.setPhase('completed')
      await wait(320)
      const page = document.querySelector('[data-testid="studio-production-result"]')
      const video = page?.querySelector('video')
      return {
        visible: Boolean(page),
        title: page?.querySelector('h1')?.textContent.trim(),
        versionCount: page?.querySelectorAll('.xm-result-versions > button').length,
        videoVisible: Boolean(video),
        previewRequests: window.manjuTour.getPreviewRequests(),
        hasOpenAction: Array.from(page?.querySelectorAll('button') || []).some((button) => button.textContent.includes('打开成片位置')),
        drawerAbsent: !document.querySelector('.one-click-production-drawer'),
      }
    })()`)
    assert.deepEqual(result, {
      visible: true,
      title: '成片已完成',
      versionCount: 1,
      videoVisible: true,
      previewRequests: 1,
      hasOpenAction: true,
      drawerAbsent: true,
    })
    await new Promise((resolve) => setTimeout(resolve, 280))
    await window.webContents.capturePage()
    await new Promise((resolve) => setTimeout(resolve, 120))
    await writeFile(resultScreenshotPath, (await window.webContents.capturePage()).toPNG())

    console.log(JSON.stringify({ passed: true, prep, running, result, progressScreenshotPath, resultScreenshotPath, realGenerationCalls: 0 }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
