import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'
import { getExportReadinessIssues } from '../src/services/exportReadinessService.js'
import { searchLocalProject } from '../src/services/localSearchService.js'

const serviceSearchResults = searchLocalProject({
  query: '苏清浅',
  projectMeta: { name: '雾城回声', genre: '悬疑' },
  storySeed: '雾城故事',
  characters: [{ id: 2, name: '苏清浅', role: '女主', tone: '清冷克制', relation: '神秘委托人' }],
  episodes: [{ id: 2, title: '暗流涌动' }],
  scenes: [{ id: 3, episodeId: 2, title: '月下相逢' }],
  shots: [],
  lines: [{ id: 5, episodeId: 2, sceneId: 3, speaker: '苏清浅', text: '你终于来了。', emotion: '平静' }],
})
assert.equal(serviceSearchResults.some((result) => result.type === 'character' && result.characterId === 2), true)
assert.equal(serviceSearchResults.some((result) => result.type === 'dialogue' && result.sceneId === 3), true)
assert.deepEqual(getExportReadinessIssues([
  { key: 'image', label: '画面', ready: 2, total: 3 },
  { key: 'audio', label: '配音', ready: 3, total: 3 },
  { key: 'subtitle', label: '字幕', ready: 0, total: 3 },
], { subtitlesEnabled: false }).map((issue) => ({ key: issue.key, missing: issue.missing, fallback: issue.fallback })), [
  { key: 'image', missing: 1, fallback: '占位画面' },
])
assert.equal(getExportReadinessIssues([
  { key: 'image', label: '画面', ready: 3, total: 3 },
  { key: 'audio', label: '配音', ready: 3, total: 3 },
  { key: 'subtitle', label: '字幕', ready: 3, total: 3 },
]).length, 0)

const testDataDirectory = path.join(process.cwd(), 'outputs', `product-acceptance-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'product-acceptance-v23.png')
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
    await loadTestProject(window)

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setInputValue = (input, value) => {
        const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const submitSearch = (value) => {
        const input = document.querySelector('.searchbox input')
        setInputValue(input, value)
        input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      }

      window.__exportCalls = 0
      window.__testStage = 'setup'
      await wait(360)
      window.manjuDesktop = {
        exportVideo: async () => {
          window.__exportCalls += 1
          return { ok: false, canceled: true }
        },
      }

      window.__testStage = 'search-character'
      submitSearch('苏清浅')
      await wait(100)
      const characterGroup = Array.from(document.querySelectorAll('.local-search-group')).find((group) => group.querySelector('h2')?.textContent.trim() === '角色')
      const characterResult = Array.from(characterGroup.querySelectorAll('button')).find((button) => button.textContent.includes('苏清浅'))
      const searchResult = {
        popoverVisible: Boolean(document.querySelector('.local-search-popover')),
        resultCount: document.querySelectorAll('.local-search-group > button').length,
        characterResultVisible: Boolean(characterResult),
        fakeSuccessAbsent: !document.body.textContent.includes('已在本地项目中搜索'),
      }
      window.__testStage = 'select-character-result'
      characterResult.click()
      await wait(100)
      const characterNavigation = {
        pageVisible: Boolean(document.querySelector('.character-page')),
        selectedCharacter: document.querySelector('.character-name-input')?.value,
        popoverClosed: !document.querySelector('.local-search-popover'),
      }
      document.querySelector('.character-change-voice-button').click()
      await wait(80)
      const characterVoicePicker = {
        visible: Boolean(document.querySelector('.character-voice-picker')),
        voiceCount: document.querySelectorAll('.character-voice-catalog > button').length,
        hasRecommendation: document.querySelector('.character-voice-picker-summary')?.textContent.includes('自动推荐'),
      }
      document.querySelector('.character-voice-picker > header > button').click()
      await wait(50)

      window.__testStage = 'open-voice-from-character'
      document.querySelector('.character-voice-entry > button').click()
      await wait(100)
      const voiceNavigation = {
        pageVisible: Boolean(document.querySelector('.voice-page')),
        selectedSpeaker: document.querySelector('.speaker-list button.is-active strong')?.textContent.trim(),
        actionLabel: document.querySelector('.voice-page .speaker-list button.is-active')?.textContent.trim(),
      }

      submitSearch('不存在的本地内容-987654')
      await wait(80)
      const emptySearch = {
        heading: document.querySelector('.local-search-empty strong')?.textContent.trim(),
        detail: document.querySelector('.local-search-empty span')?.textContent.trim(),
      }
      submitSearch('')
      await wait(50)
      const invalidSearch = {
        heading: document.querySelector('.local-search-empty strong')?.textContent.trim(),
        focused: document.activeElement === document.querySelector('.searchbox input'),
      }

      window.__testStage = 'return-home'
      document.querySelector('.brand').click()
      await wait(80)
      document.querySelector('.xm-project-section header button').click()
      await wait(80)
      const longStory = '雾城的钟声在每一个午夜准时响起。'.repeat(16)
      setInputValue(document.querySelector('.story-launch textarea'), longStory)
      window.__testStage = 'update-long-story-project'
      document.querySelector('.continue-preview').click()
      await wait(850)
      const storyToggle = document.querySelector('.story-summary__toggle')
      if (!storyToggle) {
        const storyText = document.querySelector('.story-summary__text')
        throw new Error('story toggle missing; page=' + document.querySelector('main')?.className + '; length=' + storyText?.textContent.length + '; scrollHeight=' + storyText?.scrollHeight + '; clientHeight=' + storyText?.clientHeight)
      }
      const storyBefore = {
        visible: Boolean(storyToggle),
        expanded: storyToggle?.getAttribute('aria-expanded'),
        label: storyToggle?.textContent.trim(),
      }
      window.__testStage = 'expand-story'
      storyToggle.click()
      await wait(70)
      const storyExpanded = {
        expanded: document.querySelector('.story-summary__toggle')?.getAttribute('aria-expanded'),
        label: document.querySelector('.story-summary__toggle')?.textContent.trim(),
        classApplied: document.querySelector('.story-summary')?.classList.contains('is-expanded'),
      }
      window.__testStage = 'collapse-story'
      document.querySelector('.story-summary__toggle').click()
      await wait(70)
      const storyCollapsed = document.querySelector('.story-summary__toggle')?.getAttribute('aria-expanded')

      const finalNavigation = Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '成片')
      window.__testStage = 'navigate-final'
      finalNavigation.click()
      await wait(160)
      const simpleFinal = {
        centerVisible: Boolean(document.querySelector('.final-one-click-center')),
        action: document.querySelector('.final-one-click-action')?.textContent.trim(),
        exportPanelHidden: getComputedStyle(document.querySelector('.export-panel')).display === 'none',
        timelineHidden: getComputedStyle(document.querySelector('.production-timeline')).display === 'none',
      }
      document.querySelector('.final-one-click-center header .secondary-button').click()
      await wait(60)
      window.__testStage = 'open-export-confirm'
      document.querySelector('.export-mp4-button').click()
      await wait(80)
      const confirmDialog = {
        visible: Boolean(document.querySelector('.export-confirm-modal')),
        title: document.querySelector('#export-confirm-title')?.textContent.trim(),
        issues: Array.from(document.querySelectorAll('.export-confirm-issues article strong')).map((node) => node.textContent.trim()),
        cancelFocused: document.activeElement === document.querySelector('.export-confirm-modal .secondary-button'),
        exportCallsBeforeCancel: window.__exportCalls,
      }
      window.__testStage = 'cancel-export-confirm'
      document.querySelector('.export-confirm-modal .secondary-button').click()
      await wait(60)
      const canceledExport = {
        dialogClosed: !document.querySelector('.export-confirm-modal'),
        exportCalls: window.__exportCalls,
        progressAbsent: !document.querySelector('.export-progress'),
      }
      window.__testStage = 'reopen-export-confirm'
      document.querySelector('.export-mp4-button').click()
      await wait(60)
      return {
        searchResult,
        characterNavigation,
        characterVoicePicker,
        voiceNavigation,
        emptySearch,
        invalidSearch,
        storyBefore,
        storyExpanded,
        storyCollapsed,
        simpleFinal,
        confirmDialog,
        canceledExport,
      }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 260))
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Page.enable')
    const screenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    window.webContents.debugger.detach()
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))

    const confirmedExport = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.export-confirm-continue').click()
      await wait(100)
      return {
        dialogClosed: !document.querySelector('.export-confirm-modal'),
        exportCalls: window.__exportCalls,
        notice: document.querySelector('.toast')?.textContent.trim(),
      }
    })()`)

    assert.equal(result.searchResult.popoverVisible, true)
    assert.equal(result.searchResult.resultCount > 0, true)
    assert.equal(result.searchResult.characterResultVisible, true)
    assert.equal(result.searchResult.fakeSuccessAbsent, true)
    assert.deepEqual(result.characterNavigation, { pageVisible: true, selectedCharacter: '苏清浅', popoverClosed: true })
    assert.equal(result.characterVoicePicker.visible, true)
    assert.equal(result.characterVoicePicker.voiceCount >= 20, true)
    assert.equal(result.characterVoicePicker.hasRecommendation, true)
    assert.equal(result.voiceNavigation.pageVisible, true)
    assert.equal(result.voiceNavigation.selectedSpeaker, '苏清浅')
    assert.match(result.voiceNavigation.actionLabel, /苏清浅/u)
    assert.equal(result.emptySearch.heading, '未找到本地结果')
    assert.match(result.emptySearch.detail, /不存在的本地内容/u)
    assert.deepEqual(result.invalidSearch, { heading: '请输入搜索关键词', focused: true })
    assert.equal(result.storyBefore.visible, true)
    assert.equal(result.storyBefore.expanded, 'false')
    assert.match(result.storyBefore.label, /展开全部/u)
    assert.deepEqual(result.storyExpanded, { expanded: 'true', label: '收起', classApplied: true })
    assert.equal(result.storyCollapsed, 'false')
    assert.deepEqual(result.simpleFinal, {
      centerVisible: true,
      action: '一键生成配音和视频',
      exportPanelHidden: true,
      timelineHidden: true,
    })
    assert.equal(result.confirmDialog.visible, true)
    assert.equal(result.confirmDialog.title, '素材尚未完整')
    assert.equal(result.confirmDialog.issues.some((text) => text.includes('画面缺失')), true)
    assert.equal(result.confirmDialog.issues.some((text) => text.includes('配音缺失')), true)
    assert.equal(result.confirmDialog.cancelFocused, true)
    assert.equal(result.confirmDialog.exportCallsBeforeCancel, 0)
    assert.deepEqual(result.canceledExport, { dialogClosed: true, exportCalls: 0, progressAbsent: true })
    assert.equal(confirmedExport.dialogClosed, true)
    assert.equal(confirmedExport.exportCalls, 1)
    assert.match(confirmedExport.notice, /已取消 MP4 导出/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, serviceSearchResults, result, confirmedExport }))
    window.destroy()
    app.exit(0)
  } catch (error) {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    if (activeWindow && !activeWindow.isDestroyed()) {
      try {
        console.error(`UI test stage: ${await activeWindow.webContents.executeJavaScript('window.__testStage || "unknown"')}`)
      } catch {}
    }
    console.error(error)
    app.exit(1)
  }
})
