import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'

const createToneWav = ({ durationSeconds = 2.4, frequency = 440, sampleRate = 8000 } = {}) => {
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
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.2 * envelope
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }
  return buffer
}

const testDataDirectory = path.join(process.cwd(), 'outputs', `voice-audition-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'voice-audition-functional.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const firstToneBase64 = createToneWav({ durationSeconds: 2.4, frequency: 420 }).toString('base64')
const secondToneBase64 = createToneWav({ durationSeconds: 1.8, frequency: 560 }).toString('base64')

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await loadTestProject(window, 'voice')

    const initialResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(420)
      const providerControls = Array.from(document.querySelectorAll('.reserved-voice-control select, .reserved-voice-control input'))
      const transport = document.querySelector('.audition-bar')
      const playButton = document.querySelector('.audition-play-button')
      const seek = document.querySelector('.audition-seek__range')
      const fakeProgressRemoved = !transport.textContent.includes('42%') && seek.style.getPropertyValue('--audition-progress') === '0%'
      const firstLine = document.querySelector('.voice-line')
      firstLine.click()
      await wait(80)
      return {
        providerLock: document.querySelector('.provider-lock-notice strong').textContent.trim(),
        providerControlsDisabled: providerControls.length === 5 && providerControls.every((control) => control.disabled),
        initialStatus: transport.dataset.auditionStatus,
        initialTime: document.querySelector('.audition-time').textContent.trim(),
        initialPlayDisabled: playButton.disabled,
        fakeProgressRemoved,
        selectedWithoutAudio: firstLine.classList.contains('is-audition-active'),
        noAudioMessage: document.querySelector('.audition-seek small').textContent.trim(),
        noAudioPlayDisabled: playButton.disabled,
      }
    })()`)

    const unavailableResult = await window.webContents.executeJavaScript(`(() => {
      const firstLine = document.querySelector('.voice-line')
      return {
        source: firstLine.querySelector('.audio-source-badge').textContent.trim(),
        message: document.querySelector('.audition-seek small').textContent.trim(),
        playDisabled: document.querySelector('.audition-play-button').disabled,
        lineTaskDisabled: firstLine.querySelector('.line-audio-task-button').disabled,
        batchGenerationDisabled: document.querySelector('.batch-voice-button').disabled,
      }
    })()`)

    const importedResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const importAudio = async (rowIndex, base64, fileName) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
        const file = new File([bytes], fileName, { type: 'audio/wav' })
        const transfer = new DataTransfer()
        transfer.items.add(file)
        const input = document.querySelectorAll('.line-audio-file-input')[rowIndex]
        Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
        input.dispatchEvent(new Event('change', { bubbles: true }))
        await wait(260)
      }
      await importAudio(0, ${JSON.stringify(firstToneBase64)}, '萧彻-今晚的风.wav')
      const firstReady = {
        activeRow: document.querySelector('.voice-line.is-audition-active')?.dataset.voiceLineId,
        source: document.querySelector('.voice-line.is-audition-active .audio-source-badge').textContent.trim(),
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        time: document.querySelector('.audition-time').textContent.trim(),
        playDisabled: document.querySelector('.audition-play-button').disabled,
      }
      await importAudio(1, ${JSON.stringify(secondToneBase64)}, '陆沉舟-刀.wav')
      const secondReady = {
        activeRow: document.querySelector('.voice-line.is-audition-active')?.dataset.voiceLineId,
        previousDisabled: document.querySelector('[aria-label="上一条本地音频"]').disabled,
        nextDisabled: document.querySelector('[aria-label="下一条本地音频"]').disabled,
      }
      document.querySelector('[aria-label="上一条本地音频"]').click()
      await wait(120)
      const afterPrevious = {
        activeRow: document.querySelector('.voice-line.is-audition-active')?.dataset.voiceLineId,
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        nextDisabled: document.querySelector('[aria-label="下一条本地音频"]').disabled,
      }
      return { firstReady, secondReady, afterPrevious }
    })()`)

    const playbackResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setRange = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value))
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const playButton = document.querySelector('.audition-play-button')
      playButton.click()
      await wait(420)
      const playing = {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        playLabel: playButton.getAttribute('aria-label'),
        currentTime: Number(document.querySelector('.audition-seek__range').value),
        progress: Number.parseFloat(document.querySelector('.audition-seek__range').style.getPropertyValue('--audition-progress')),
        rowPlaying: document.querySelector('.voice-line.is-audition-active').classList.contains('is-audition-playing'),
      }
      playButton.click()
      await wait(80)
      const pausedAt = Number(document.querySelector('.audition-seek__range').value)
      await wait(220)
      const paused = {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        playLabel: playButton.getAttribute('aria-label'),
        timeStayedStill: Math.abs(Number(document.querySelector('.audition-seek__range').value) - pausedAt) < 0.08,
      }
      const seek = document.querySelector('.audition-seek__range')
      setRange(seek, 1.2)
      await wait(100)
      const seekedTime = Number(seek.value)
      const volume = document.querySelector('.audition-volume input')
      setRange(volume, 25)
      await wait(80)
      const volumeAt25 = document.querySelector('.audition-volume output').textContent.trim()
      const muteButton = document.querySelector('.audition-volume button')
      muteButton.click()
      await wait(50)
      const muted = { value: document.querySelector('.audition-volume output').textContent.trim(), label: muteButton.getAttribute('aria-label') }
      muteButton.click()
      await wait(50)
      const restored = { value: document.querySelector('.audition-volume output').textContent.trim(), label: muteButton.getAttribute('aria-label') }
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
      await wait(160)
      const keyboardPlaying = document.querySelector('.audition-bar').dataset.auditionStatus
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
      await wait(60)
      return { playing, paused, seekedTime, volumeAt25, muted, restored, keyboardPlaying, keyboardPaused: document.querySelector('.audition-bar').dataset.auditionStatus }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 120))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const errorResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const file = new File([new TextEncoder().encode('not a real audio file')], '损坏音频.wav', { type: 'audio/wav' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      const input = document.querySelectorAll('.line-audio-file-input')[2]
      Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(320)
      return {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        source: document.querySelector('.voice-line.is-audition-active .audio-source-badge').textContent.trim(),
        message: document.querySelector('.audition-seek small').textContent.trim(),
        playDisabled: document.querySelector('.audition-play-button').disabled,
      }
    })()`)

    const cleanupResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const sceneSelect = document.querySelectorAll('.dialogue-title select')[1]
      const nextSceneOption = Array.from(sceneSelect.options).find((option) => Number(option.value) !== Number(sceneSelect.value))
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sceneSelect, nextSceneOption.value)
      sceneSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(120)
      return {
        status: document.querySelector('.audition-bar').dataset.auditionStatus,
        activeRows: document.querySelectorAll('.voice-line.is-audition-active').length,
        time: document.querySelector('.audition-time').textContent.trim(),
        playDisabled: document.querySelector('.audition-play-button').disabled,
      }
    })()`)

    assert.equal(initialResult.providerLock, '真实配音已接入一键制作')
    assert.equal(initialResult.providerControlsDisabled, true)
    assert.equal(initialResult.initialStatus, 'idle')
    assert.equal(initialResult.initialTime, '--:--.- / --:--.-')
    assert.equal(initialResult.initialPlayDisabled, true)
    assert.equal(initialResult.fakeProgressRemoved, true)
    assert.equal(initialResult.selectedWithoutAudio, true)
    assert.equal(initialResult.noAudioMessage, '当前台词没有真实音频')
    assert.equal(initialResult.noAudioPlayDisabled, true)

    assert.equal(unavailableResult.source, '未导入')
    assert.equal(unavailableResult.message, '当前台词没有真实音频')
    assert.equal(unavailableResult.playDisabled, true)
    assert.equal(unavailableResult.lineTaskDisabled, true)
    assert.equal(unavailableResult.batchGenerationDisabled, false)

    assert.equal(importedResult.firstReady.activeRow, '4')
    assert.equal(importedResult.firstReady.source, '本地音频')
    assert.equal(importedResult.firstReady.status, 'paused')
    assert.match(importedResult.firstReady.time, /^00:00\.0 \/ 00:02\.[34]$/u)
    assert.equal(importedResult.firstReady.playDisabled, false)
    assert.equal(importedResult.secondReady.activeRow, '5')
    assert.equal(importedResult.secondReady.previousDisabled, false)
    assert.equal(importedResult.secondReady.nextDisabled, true)
    assert.equal(importedResult.afterPrevious.activeRow, '4')
    assert.equal(importedResult.afterPrevious.status, 'paused')
    assert.equal(importedResult.afterPrevious.nextDisabled, false)

    assert.equal(playbackResult.playing.status, 'playing')
    assert.equal(playbackResult.playing.playLabel, '暂停当前音频')
    assert.equal(playbackResult.playing.currentTime > 0.1, true)
    assert.equal(playbackResult.playing.progress > 0, true)
    assert.equal(playbackResult.playing.rowPlaying, true)
    assert.equal(playbackResult.paused.status, 'paused')
    assert.equal(playbackResult.paused.playLabel, '播放当前音频')
    assert.equal(playbackResult.paused.timeStayedStill, true)
    assert.equal(Math.abs(playbackResult.seekedTime - 1.2) < 0.12, true)
    assert.equal(playbackResult.volumeAt25, '25%')
    assert.deepEqual(playbackResult.muted, { value: '0%', label: '恢复音量' })
    assert.deepEqual(playbackResult.restored, { value: '25%', label: '静音' })
    assert.equal(playbackResult.keyboardPlaying, 'playing')
    assert.equal(playbackResult.keyboardPaused, 'paused')

    assert.equal(errorResult.status, 'error')
    assert.equal(errorResult.source, '读取失败')
    assert.equal(errorResult.message, '音频读取失败，请重新导入')
    assert.equal(errorResult.playDisabled, true)

    assert.equal(cleanupResult.status, 'idle')
    assert.equal(cleanupResult.activeRows, 0)
    assert.equal(cleanupResult.time, '--:--.- / --:--.-')
    assert.equal(cleanupResult.playDisabled, true)

    console.log(JSON.stringify({ passed: true, screenshotPath, initialResult, unavailableResult, importedResult, playbackResult, errorResult, cleanupResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
