import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'

const createTestWavBase64 = () => {
  const sampleRate = 8000
  const sampleCount = 3200
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
  return buffer.toString('base64')
}

const testWavBase64 = createTestWavBase64()
const testDataDirectory = path.join(process.cwd(), 'outputs', `script-organizer-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'script-organizer-functional.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

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
    await loadTestProject(window, 'script')

    const initialResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setTextareaValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const navigate = (label) => {
        const button = Array.from(document.querySelectorAll('.topnav button')).find((item) => item.textContent.trim() === label)
        if (!button) throw new Error('找不到顶部导航：' + label)
        button.click()
      }
      await wait(350)
      navigate('配音')
      await wait(120)
      const audioBytes = Uint8Array.from(atob(${JSON.stringify(testWavBase64)}), (character) => character.charCodeAt(0))
      const audioFile = new File([audioBytes], 'organizer-voice.wav', { type: 'audio/wav' })
      const audioTransfer = new DataTransfer()
      audioTransfer.items.add(audioFile)
      const targetVoiceRow = Array.from(document.querySelectorAll('.voice-line')).find((row) => row.querySelector('strong').textContent.trim() === '沈砚')
      if (!targetVoiceRow) throw new Error('找不到沈砚的配音行')
      const audioInput = targetVoiceRow.querySelector('.line-audio-file-input')
      audioInput.files = audioTransfer.files
      audioInput.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(180)
      const importedAudioStatus = targetVoiceRow.querySelector('.audio-source-badge').textContent.trim()
      navigate('剧本')
      await wait(120)
      setTextareaValue(document.querySelector('.scene-action-input'), '  雨夜\\r\\n\\t相逢\\u0007  ')
      const targetRow = Array.from(document.querySelectorAll('.dialogue-edit-row')).find((row) => row.querySelector('select').value === '沈砚')
      setInputValue(targetRow.querySelector('input'), '  待  整理台词  ')
      await wait(120)
      const trigger = document.querySelector('.script-organizer-trigger')
      const placeholderRemoved = trigger.textContent.trim() === '整理剧本'
      trigger.click()
      await wait(120)
      window.__organizerConfirmAllowed = false
      window.__organizerConfirmMessages = []
      window.confirm = (message) => {
        window.__organizerConfirmMessages.push(message)
        return window.__organizerConfirmAllowed
      }
      const firstScope = document.querySelector('.organizer-scope-list input')
      return {
        importedAudioStatus,
        placeholderRemoved,
        modalRole: document.querySelector('.script-organizer-modal').getAttribute('role'),
        localBadge: document.querySelector('.script-organizer-local-badge').textContent.trim(),
        focusedOnOpen: document.activeElement === firstScope,
        checkedScopes: document.querySelectorAll('.organizer-scope-list input:checked').length,
        checkedRules: document.querySelectorAll('.organizer-rule-list input:checked').length,
        punctuationChecked: document.querySelectorAll('.organizer-rule-list input')[4].checked,
        changeCount: document.querySelectorAll('.organizer-change-card').length,
        audioImpactCount: document.querySelectorAll('.organizer-audio-impact').length,
        summary: document.querySelector('.organizer-preview-header p').textContent.trim(),
        diagnostics: Array.from(document.querySelectorAll('.organizer-diagnostics p')).map((node) => node.textContent.trim()),
        applyDisabled: document.querySelector('.script-organizer-apply').disabled,
        footer: document.querySelector('.script-organizer-footer > p').textContent.trim(),
      }
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 400))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const commitResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const modal = document.querySelector('.script-organizer-modal')
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }))
      await wait(60)
      const composingShortcutIgnored = Boolean(document.querySelector('.script-organizer-modal')) && window.__organizerConfirmMessages.length === 0
      const actionFilter = Array.from(document.querySelectorAll('.organizer-preview-filters button')).find((button) => button.textContent.includes('动作'))
      if (!actionFilter) throw new Error('找不到动作筛选按钮；筛选数=' + document.querySelectorAll('.organizer-preview-filters button').length + '；模态=' + Boolean(document.querySelector('.script-organizer-modal')))
      actionFilter.click()
      await wait(60)
      const filteredCount = document.querySelectorAll('.organizer-change-card').length
      document.querySelector('.organizer-include-toggle').click()
      await wait(60)
      const excludedSummary = document.querySelector('.organizer-preview-header p').textContent.trim()
      const allFilter = Array.from(document.querySelectorAll('.organizer-preview-filters button')).find((button) => button.textContent.includes('全部'))
      if (!allFilter) throw new Error('找不到全部筛选按钮')
      allFilter.click()
      await wait(60)
      const actionCard = Array.from(document.querySelectorAll('.organizer-change-card')).find((card) => card.querySelector('.organizer-field-badge').textContent.trim() === '动作')
      actionCard.querySelector('.organizer-include-toggle').click()
      await wait(60)
      document.querySelector('.script-organizer-apply').click()
      await wait(80)
      const canceledByConfirmation = Boolean(document.querySelector('.script-organizer-modal'))
      const confirmMessage = window.__organizerConfirmMessages.at(-1) || ''
      const dirtyActionAfterCancel = document.querySelector('.scene-action-input').value
      window.__organizerConfirmAllowed = true
      document.querySelector('.script-organizer-apply').click()
      await wait(220)
      const modalClosed = !document.querySelector('.script-organizer-modal')
      const focusReturned = document.activeElement?.classList.contains('script-organizer-trigger')
      const actionValue = document.querySelector('.scene-action-input').value
      const targetRow = Array.from(document.querySelectorAll('.dialogue-edit-row')).find((row) => row.querySelector('select').value === '沈砚')
      const lineValue = targetRow.querySelector('input').value
      await wait(900)
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      const savedLine = autosave.content.lines.find((line) => line.episodeId === 2 && line.sceneId === 3 && line.speaker === '沈砚')
      const savedScene = autosave.content.scenes.find((scene) => scene.id === 3)
      const savedShots = autosave.content.shots.filter((shot) => shot.episodeId === 2 && shot.sceneId === 3)
      const voiceButton = Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '配音')
      if (!voiceButton) throw new Error('提交后找不到配音导航')
      voiceButton.click()
      await wait(120)
      const voiceRow = Array.from(document.querySelectorAll('.voice-line')).find((row) => row.querySelector('strong').textContent.trim() === '沈砚')
      if (!voiceRow) throw new Error('提交后找不到沈砚配音行')
      const voiceText = voiceRow.querySelector(':scope > input').value
      const voiceStatus = voiceRow.querySelector('.audio-source-badge').textContent.trim()
      return {
        composingShortcutIgnored,
        filteredCount,
        excludedSummary,
        canceledByConfirmation,
        confirmMessage,
        dirtyActionAfterCancel,
        modalClosed,
        focusReturned,
        actionValue,
        lineValue,
        savedAction: savedScene.action,
        savedLine,
        savedShotIds: savedShots.map((shot) => shot.id),
        voiceText,
        voiceStatus,
      }
    })()`)

    const cleanResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const scriptButton = Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '剧本')
      if (!scriptButton) throw new Error('清洁态检查找不到剧本导航')
      scriptButton.click()
      await wait(100)
      document.querySelector('.script-organizer-trigger').click()
      await wait(100)
      const initialChangeCount = document.querySelectorAll('.organizer-change-card').length
      const initiallyDisabled = document.querySelector('.script-organizer-apply').disabled
      document.querySelectorAll('.organizer-rule-list input')[4].click()
      await wait(100)
      const punctuationChangeCount = document.querySelectorAll('.organizer-change-card').length
      const punctuationChecked = document.querySelectorAll('.organizer-rule-list input')[4].checked
      document.querySelector('.script-organizer-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(80)
      return {
        initialChangeCount,
        initiallyDisabled,
        punctuationChangeCount,
        punctuationChecked,
        modalClosed: !document.querySelector('.script-organizer-modal'),
        focusReturnedAfterEscape: document.activeElement?.classList.contains('script-organizer-trigger'),
      }
    })()`)

    assert.equal(initialResult.importedAudioStatus, '本地音频')
    assert.equal(initialResult.placeholderRemoved, true)
    assert.equal(initialResult.modalRole, 'dialog')
    assert.match(initialResult.localBadge, /仅本机规则/u)
    assert.equal(initialResult.focusedOnOpen, true)
    assert.equal(initialResult.checkedScopes, 3)
    assert.equal(initialResult.checkedRules, 4)
    assert.equal(initialResult.punctuationChecked, false)
    assert.equal(initialResult.changeCount, 2)
    assert.equal(initialResult.audioImpactCount, 1)
    assert.match(initialResult.summary, /选中 2\/2 项 · 配音影响 1 条/u)
    assert(initialResult.diagnostics.some((item) => item.includes('已有 6 个分镜')))
    assert.equal(initialResult.applyDisabled, false)
    assert.match(initialResult.footer, /1 条配音会重置/u)
    assert.equal(commitResult.composingShortcutIgnored, true)
    assert.equal(commitResult.filteredCount, 1)
    assert.match(commitResult.excludedSummary, /选中 1\/2 项/u)
    assert.equal(commitResult.canceledByConfirmation, true)
    assert.match(commitResult.confirmMessage, /重置 1 条台词的配音状态/u)
    assert.match(commitResult.dirtyActionAfterCancel, /^  雨夜/u)
    assert.equal(commitResult.modalClosed, true)
    assert.equal(commitResult.focusReturned, true)
    assert.equal(commitResult.actionValue, '雨夜\n相逢')
    assert.equal(commitResult.lineValue, '待 整理台词')
    assert.equal(commitResult.savedAction, '雨夜\n相逢')
    assert.equal(commitResult.savedLine.text, '待 整理台词')
    assert.equal(commitResult.savedLine.audio, undefined)
    assert.equal(commitResult.savedLine.audioFileName, '')
    assert.equal(commitResult.savedLine.audioStatus, '未生成')
    assert.equal(commitResult.savedLine.status, '未配音')
    assert.equal(commitResult.savedLine.duration, '0.0s')
    assert.equal(commitResult.savedLine.audioUpdatedAt, '')
    assert.deepEqual(commitResult.savedShotIds, [1, 2, 3, 4, 5, 6])
    assert.equal(commitResult.voiceText, '待 整理台词')
    assert.equal(commitResult.voiceStatus, '未导入')
    assert.equal(cleanResult.initialChangeCount, 0)
    assert.equal(cleanResult.initiallyDisabled, true)
    assert(cleanResult.punctuationChangeCount >= 2)
    assert.equal(cleanResult.punctuationChecked, true)
    assert.equal(cleanResult.modalClosed, true)
    assert.equal(cleanResult.focusReturnedAfterEscape, true)

    console.log(JSON.stringify({ passed: true, screenshotPath, initialResult, commitResult, cleanResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
