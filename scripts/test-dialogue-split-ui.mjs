import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `dialogue-split-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'dialogue-split.png')
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
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      await wait(350)
      const trigger = document.querySelector('.dialogue-split-trigger')
      const placeholderNoticeRemoved = trigger.textContent.includes('拆分台词')
      trigger.click()
      await wait(80)
      const textarea = document.querySelector('.dialogue-source-input textarea')
      const focusedOnOpen = document.activeElement === textarea
      const sample = '萧彻：今晚的风，不太平。\\n林听雨（紧张）: 新识别的警告。\\n周舟：陌生角色台词\\n旁白：雨越来越大。\\n这是一行动作描述'
      setInputValue(textarea, sample)
      await wait(240)
      const summary = document.querySelector('.dialogue-preview-summary p').textContent.trim()
      const statuses = Array.from(document.querySelectorAll('.dialogue-parse-status')).map((node) => node.textContent.trim())
      return {
        placeholderNoticeRemoved,
        focusedOnOpen,
        modalRole: document.querySelector('.dialogue-split-modal').getAttribute('role'),
        localBadge: document.querySelector('.dialogue-local-badge').textContent.trim(),
        summary,
        statuses,
        rowCount: document.querySelectorAll('.dialogue-preview-row').length,
        commitDisabled: document.querySelector('.dialogue-commit-button').disabled,
      }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 500))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const commitResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setSelectValue = (select, value) => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value)
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const composingInput = document.querySelector('.dialogue-source-input textarea')
      composingInput.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      await wait(30)
      composingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
      await wait(60)
      const composingShortcutIgnored = Boolean(document.querySelector('.dialogue-split-modal'))
      composingInput.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
      await wait(220)
      const unknownRow = document.querySelector('.dialogue-preview-row--unknown-speaker')
      setSelectValue(unknownRow.querySelector('select'), '沈砚')
      const narrationRow = document.querySelector('.dialogue-preview-row--narration')
      narrationRow.querySelector('.dialogue-include-toggle').click()
      await wait(100)
      const readySummary = document.querySelector('.dialogue-preview-summary p').textContent.trim()
      const commitEnabled = !document.querySelector('.dialogue-commit-button').disabled
      document.querySelector('.dialogue-commit-button').click()
      await wait(180)
      const modalClosed = !document.querySelector('.dialogue-split-modal')
      const focusReturned = document.activeElement?.classList.contains('dialogue-split-trigger')
      const dialogueTexts = Array.from(document.querySelectorAll('.dialogue-edit-row input')).map((input) => input.value)
      await wait(850)
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '配音').click()
      await wait(120)
      const voiceTexts = Array.from(document.querySelectorAll('.voice-line > input')).map((input) => input.value)
      const voiceEmotions = Array.from(document.querySelectorAll('.voice-line select')).map((select) => select.value)
      return {
        readySummary,
        commitEnabled,
        composingShortcutIgnored,
        modalClosed,
        focusReturned,
        dialogueTexts,
        autosaveSceneLineCount: autosave.content.lines.filter((line) => line.episodeId === 2 && line.sceneId === 3).length,
        autosaveNewLine: autosave.content.lines.find((line) => line.text === '陌生角色台词'),
        voiceTexts,
        voiceEmotions,
      }
    })()`)

    const replaceResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '剧本').click()
      await wait(100)
      document.querySelector('.dialogue-split-trigger').click()
      await wait(70)
      document.querySelector('.dialogue-source-tools button').click()
      await wait(240)
      document.querySelector('.dialogue-commit-mode input[value="replace"]').click()
      await wait(80)
      const readyInReplace = document.querySelector('.dialogue-preview-summary p').textContent.trim()
      const firstText = document.querySelector('.dialogue-preview-row input')
      setInputValue(firstText, '替换模式更新后的第一句')
      await wait(80)
      let confirmMessage = ''
      const originalConfirm = window.confirm
      window.confirm = (message) => { confirmMessage = message; return true }
      document.querySelector('.dialogue-commit-button').click()
      await wait(180)
      window.confirm = originalConfirm
      const visibleTexts = Array.from(document.querySelectorAll('.dialogue-edit-row input')).map((input) => input.value)
      await wait(850)
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      document.querySelector('.dialogue-split-trigger').click()
      await wait(70)
      const textarea = document.querySelector('.dialogue-source-input textarea')
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(70)
      return {
        readyInReplace,
        confirmMessage,
        modalClosed: !document.querySelector('.dialogue-split-modal'),
        visibleTexts,
        autosaveTexts: autosave.content.lines.filter((line) => line.episodeId === 2 && line.sceneId === 3).map((line) => line.text),
        focusReturnedAfterEscape: document.activeElement?.classList.contains('dialogue-split-trigger'),
      }
    })()`)

    assert.equal(initialResult.placeholderNoticeRemoved, true)
    assert.equal(initialResult.focusedOnOpen, true)
    assert.equal(initialResult.modalRole, 'dialog')
    assert.match(initialResult.localBadge, /仅本机解析/u)
    assert.equal(initialResult.rowCount, 5)
    assert.match(initialResult.summary, /识别 1 条 · 待处理 2 行 · 重复 1 条/u)
    assert(initialResult.statuses.some((status) => status.includes('与现有台词重复')))
    assert(initialResult.statuses.some((status) => status.includes('未匹配角色')))
    assert(initialResult.statuses.some((status) => status.includes('旁白请保留')))
    assert.equal(initialResult.commitDisabled, true)

    assert.match(commitResult.readySummary, /识别 2 条 · 待处理 0 行 · 重复 1 条/u)
    assert.equal(commitResult.commitEnabled, true)
    assert.equal(commitResult.composingShortcutIgnored, true)
    assert.equal(commitResult.modalClosed, true)
    assert.equal(commitResult.focusReturned, true)
    assert.equal(commitResult.dialogueTexts.length, 6)
    assert(commitResult.dialogueTexts.includes('新识别的警告。'))
    assert(commitResult.dialogueTexts.includes('陌生角色台词'))
    assert.equal(commitResult.autosaveSceneLineCount, 6)
    assert.equal(commitResult.autosaveNewLine.speaker, '沈砚')
    assert.equal(commitResult.autosaveNewLine.audioStatus, '未生成')
    assert(commitResult.voiceTexts.includes('陌生角色台词'))
    assert(commitResult.voiceEmotions.includes('紧张'))

    assert.match(replaceResult.readyInReplace, /识别 6 条 · 待处理 0 行 · 重复 0 条/u)
    assert.match(replaceResult.confirmMessage, /替换会移除当前场景 6 条台词/u)
    assert.equal(replaceResult.modalClosed, true)
    assert.equal(replaceResult.visibleTexts.length, 6)
    assert.equal(replaceResult.visibleTexts[0], '替换模式更新后的第一句')
    assert.equal(replaceResult.autosaveTexts[0], '替换模式更新后的第一句')
    assert.equal(replaceResult.focusReturnedAfterEscape, true)

    console.log(JSON.stringify({ passed: true, screenshotPath, initialResult, commitResult, replaceResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
