import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const createToneWav = ({ durationSeconds = 3, frequency = 420, sampleRate = 8000 } = {}) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate)
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.min(1, index / 180, (sampleCount - index) / 180)
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.18 * envelope
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }
  return buffer
}

const testDataDirectory = path.join(process.cwd(), 'outputs', `voice-audition-capture-user-data-${Date.now()}-${process.pid}`)
const runtimeDirectory = path.join(process.cwd(), 'outputs', 'runtime')
const emptyScreenshotPath = path.join(runtimeDirectory, 'voice-audition-empty.png')
const readyScreenshotPath = path.join(runtimeDirectory, 'voice-audition-ready.png')
const playingScreenshotPath = path.join(runtimeDirectory, 'voice-audition-playing.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(runtimeDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const toneBase64 = createToneWav().toString('base64')

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
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'voice' } })
    await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(420)
      document.querySelector('.voice-line').click()
      await wait(120)
    })()`)
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Page.enable')
    const capture = async (targetPath) => {
      const result = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      })
      await writeFile(targetPath, Buffer.from(result.data, 'base64'))
    }
    await capture(emptyScreenshotPath)

    const readyResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const bytes = Uint8Array.from(atob(${JSON.stringify(toneBase64)}), (character) => character.charCodeAt(0))
      const file = new File([bytes], '萧彻-今晚的风.wav', { type: 'audio/wav' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      const input = document.querySelector('.line-audio-file-input')
      Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(320)
      return {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        source: document.querySelector('.voice-line.is-audition-active .audio-source-badge').textContent.trim(),
      }
    })()`)
    assert.equal(readyResult.status, 'paused')
    assert.equal(readyResult.source, '本地音频')
    await capture(readyScreenshotPath)

    const playingResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.audition-play-button').click()
      await wait(620)
      return {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        progress: Number.parseFloat(document.querySelector('.audition-seek__range').style.getPropertyValue('--audition-progress')),
      }
    })()`)
    assert.equal(playingResult.status, 'playing')
    assert.equal(playingResult.progress > 0, true)
    await capture(playingScreenshotPath)
    window.webContents.debugger.detach()
    console.log(JSON.stringify({ passed: true, emptyScreenshotPath, readyScreenshotPath, playingScreenshotPath, readyResult, playingResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
