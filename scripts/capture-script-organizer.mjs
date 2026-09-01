import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `script-organizer-capture-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'script-organizer.png')
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
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setTextareaValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      await wait(350)
      setTextareaValue(document.querySelector('.scene-action-input'), '  雨夜\\r\\n\\t两人  在钟楼下相逢\\u0007  ')
      const targetRow = Array.from(document.querySelectorAll('.dialogue-edit-row')).find((row) => row.querySelector('select').value === '沈砚')
      setInputValue(targetRow.querySelector('input'), '  钟声  会带我们找到答案  ')
      await wait(100)
      document.querySelector('.script-organizer-trigger').click()
      await wait(150)
      return {
        modalVisible: Boolean(document.querySelector('.script-organizer-modal')),
        changeCount: document.querySelectorAll('.organizer-change-card').length,
        summary: document.querySelector('.organizer-preview-header p').textContent.trim(),
        localBadge: document.querySelector('.script-organizer-local-badge').textContent.trim(),
      }
    })()`)
    assert.equal(result.modalVisible, true)
    assert.equal(result.changeCount, 2)
    assert.match(result.localBadge, /仅本机规则/u)
    await new Promise((resolve) => setTimeout(resolve, 400))
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Page.enable')
    const screenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    window.webContents.debugger.detach()
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
    console.log(JSON.stringify({ passed: true, screenshotPath, ...result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
