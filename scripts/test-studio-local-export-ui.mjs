import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()
const demoDirectory = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo')
const resultScreenshotPath = path.join(workspaceRoot, 'outputs', 'runtime', 'studio-lighthouse-local-result.png')
const projectFileName = (await readdir(demoDirectory)).find((name) => name.endsWith('.manju'))
const videoFileName = (await readdir(demoDirectory)).find((name) => name.endsWith('.mp4'))
assert.ok(projectFileName)
assert.ok(videoFileName)

const testDataDirectory = path.join(workspaceRoot, 'outputs', `studio-local-export-ui-${Date.now()}-${process.pid}`)
await mkdir(testDataDirectory, { recursive: true })
process.env.MANJU_TEST_SNAPSHOT_PATH = path.join(demoDirectory, projectFileName)
process.env.MANJU_TOUR_OUTPUT_PATH = path.join(demoDirectory, videoFileName)
process.env.MANJU_TEST_PROVIDER_LOCKED = '1'
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const zeroCostSettings = {
  version: 1,
  confirmed: true,
  confirmedAt: '2026-08-06T00:00:00.000Z',
  modelSignature: 'script:qwen3.7-plus|image:wan2.7-image-pro|voice:qwen3-tts-flash|video:wan2.7-i2v-2026-04-25',
}

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

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      Array.from(document.querySelectorAll('.xm-stage-item button')).find((button) => button.textContent.includes('成片'))?.click()
      await wait(100)
      const localButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('立即合成本集并预览'))
      localButton?.click()
      await wait(100)
      const startButton = document.querySelector('.xm-primary-action')
      const startEnabled = Boolean(startButton && !startButton.disabled)
      const estimatedCalls = document.querySelector('.xm-quota-protection small')?.textContent.trim() || ''
      startButton?.click()
      await wait(130)
      const progressVisible = Boolean(document.querySelector('[data-testid="studio-production-progress"]'))
      window.manjuTour.setPhase('completed')
      await wait(360)
      return {
        localButtonVisible: Boolean(localButton),
        startEnabled,
        estimatedCalls,
        progressVisible,
        resultVisible: Boolean(document.querySelector('[data-testid="studio-production-result"]')),
        videoVisible: Boolean(document.querySelector('[data-testid="studio-production-result"] video')),
        previewRequests: window.manjuTour.getPreviewRequests(),
      }
    })()`)

    assert.equal(result.localButtonVisible, true)
    assert.equal(result.startEnabled, true)
    assert.match(result.estimatedCalls, /图片 0 次.*视频 0 次.*配音 0 次/u)
    assert.equal(result.progressVisible, true)
    assert.equal(result.resultVisible, true)
    assert.equal(result.videoVisible, true)
    assert.equal(result.previewRequests, 1)
    await window.webContents.capturePage()
    await new Promise((resolve) => setTimeout(resolve, 160))
    await writeFile(resultScreenshotPath, (await window.webContents.capturePage()).toPNG())
    console.log(JSON.stringify({ passed: true, providerLocked: true, ...result, resultScreenshotPath, realGenerationCalls: 0 }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
