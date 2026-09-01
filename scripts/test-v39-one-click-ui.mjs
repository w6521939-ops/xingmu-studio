import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const outputDirectory = path.join(process.cwd(), 'outputs', 'runtime')
const userDataDirectory = path.join(outputDirectory, `v39-ui-user-data-${Date.now()}-${process.pid}`)
const snapshotPath = path.join(userDataDirectory, 'snapshot.json')
const finalScreenshotPath = path.join(outputDirectory, 'v39-simple-final.png')
const voiceScreenshotPath = path.join(outputDirectory, 'v39-character-voice-picker.png')

await mkdir(userDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await writeFile(snapshotPath, JSON.stringify(createTestUserProjectSnapshot()), 'utf8')
process.env.MANJU_TEST_SNAPSHOT_PATH = snapshotPath
process.env.MANJU_DISABLE_PAID_GENERATION = '1'
app.setPath('userData', userDataDirectory)
app.disableHardwareAcceleration()

const capture = async (window, filePath) => {
  window.setPosition(-10000, -10000)
  window.showInactive()
  await new Promise((resolve) => setTimeout(resolve, 260))
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3')
  await window.webContents.debugger.sendCommand('Page.enable')
  const screenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  await writeFile(filePath, Buffer.from(screenshot.data, 'base64'))
  window.hide()
}

app.on('ready', async () => {
  let stage = 'create-window'
  const timeout = setTimeout(() => {
    console.error(`V39 UI test timeout at stage: ${stage}`)
    app.exit(1)
  }, 30000)
  try {
    const window = new BrowserWindow({
      width: 1600,
      height: 1000,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        preload: path.join(process.cwd(), 'scripts', 'fixtures', 'one-click-test-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    stage = 'load-final'
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'final' } })
    await new Promise((resolve) => setTimeout(resolve, 900))
    stage = 'assert-final'
    const simple = await window.webContents.executeJavaScript(`({
      page: document.querySelector('main')?.className,
      title: document.querySelector('.final-one-click-center h2')?.textContent.trim(),
      action: document.querySelector('.final-one-click-action')?.textContent.trim(),
      exportHidden: getComputedStyle(document.querySelector('.export-panel')).display === 'none',
      timelineHidden: getComputedStyle(document.querySelector('.production-timeline')).display === 'none',
    })`)
    assert.match(simple.page, /is-simple/u)
    assert.equal(simple.title, '一键生成配音与成片')
    assert.equal(simple.action, '一键生成配音和视频')
    assert.equal(simple.exportHidden, true)
    assert.equal(simple.timelineHidden, true)
    stage = 'capture-final'
    await capture(window, finalScreenshotPath)

    stage = 'open-voice-picker'
    const voice = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '角色').click()
      await wait(180)
      document.querySelector('.character-change-voice-button').click()
      await wait(120)
      return {
        visible: Boolean(document.querySelector('.character-voice-picker')),
        count: document.querySelectorAll('.character-voice-catalog > button').length,
        selected: document.querySelector('.character-voice-catalog > button.is-active strong')?.textContent.trim(),
      }
    })()`)
    assert.equal(voice.visible, true)
    assert.ok(voice.count >= 20)
    assert.ok(voice.selected)
    stage = 'capture-voice-picker'
    await capture(window, voiceScreenshotPath)

    console.log(JSON.stringify({ passed: true, simple, voice, finalScreenshotPath, voiceScreenshotPath }))
    clearTimeout(timeout)
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach()
    window.destroy()
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    console.error(`V39 UI test failed at stage: ${stage}`)
    console.error(error)
    app.exit(1)
  }
})
