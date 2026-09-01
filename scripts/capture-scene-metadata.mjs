import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `scene-metadata-capture-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'scene-metadata.png')
const dialogScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'scene-character-picker.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: true,
      focusable: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'script' } })
    const initialResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(420)
      return {
        duration: document.querySelector('.scene-duration-card strong').textContent.trim(),
        readiness: document.querySelector('.scene-readiness > header b').textContent.trim(),
      }
    })()`)
    assert.equal(initialResult.duration, '23.1 秒')
    assert.equal(initialResult.readiness, '100%')
    await new Promise((resolve) => setTimeout(resolve, 350))
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Page.enable')
    const inspectorScreenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    await writeFile(screenshotPath, Buffer.from(inspectorScreenshot.data, 'base64'))
    const dialogResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.scene-main-characters > header button').click()
      await wait(180)
      return {
        dialogVisible: Boolean(document.querySelector('.scene-character-picker-dialog')),
        selectedCount: document.querySelectorAll('.scene-character-option input:checked').length,
      }
    })()`)
    assert.equal(dialogResult.dialogVisible, true)
    assert.equal(dialogResult.selectedCount, 2)
    const dialogScreenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    window.webContents.debugger.detach()
    await writeFile(dialogScreenshotPath, Buffer.from(dialogScreenshot.data, 'base64'))
    console.log(JSON.stringify({ passed: true, screenshotPath, dialogScreenshotPath, ...initialResult, ...dialogResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
