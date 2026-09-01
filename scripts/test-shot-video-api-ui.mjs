import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `shot-video-api-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'shot-video-api-entry.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 960,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    let remoteRequestCount = 0
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
      remoteRequestCount += 1
      callback({})
    })

    const entry = path.join(process.cwd(), 'dist', 'index.html')
    await window.loadFile(entry)
    const [firstFrame, lastFrame] = await window.webContents.executeJavaScript(`(() => {
      const createFrame = (label, colorA, colorB) => {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 420
        const context = canvas.getContext('2d')
        const gradient = context.createLinearGradient(0, 0, 640, 420)
        gradient.addColorStop(0, colorA)
        gradient.addColorStop(1, colorB)
        context.fillStyle = gradient
        context.fillRect(0, 0, 640, 420)
        context.fillStyle = 'rgba(239,251,255,.92)'
        context.beginPath()
        context.arc(320, 145, 72, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = 'rgba(217,244,255,.9)'
        context.beginPath()
        context.moveTo(180, 390)
        context.quadraticCurveTo(215, 228, 320, 228)
        context.quadraticCurveTo(425, 228, 460, 390)
        context.fill()
        context.fillStyle = '#2b76a6'
        context.font = '44px Microsoft YaHei'
        context.textAlign = 'center'
        context.fillText(label, 320, 163)
        return canvas.toDataURL('image/png')
      }
      return [createFrame('首帧 01', '#75dcff', '#587ce8'), createFrame('尾帧 02', '#8ce7f1', '#6d83e1')]
    })()`)

    const snapshot = createTestUserProjectSnapshot()
    snapshot.content.shots[0] = {
      ...snapshot.content.shots[0],
      visualPrompt: '真实视频提示词：沈砚在月下钟楼广场缓慢回头，衣摆被风吹动。',
      image: firstFrame,
      imageFileName: '月下相逢-镜头01.png',
      imageSource: 'local',
      imageStatus: '已完成',
    }
    snapshot.content.shots[1] = {
      ...snapshot.content.shots[1],
      image: lastFrame,
      imageFileName: '月下相逢-镜头02.png',
      imageSource: 'local',
      imageStatus: '已完成',
    }
    const providerSettings = {
      video: {
        provider: '阿里云百炼',
        model: 'wan2.7-i2v-2026-04-25',
        endpoint: 'https://dashscope.aliyuncs.com/api/v1',
        status: '未连接',
      },
    }
    await window.webContents.executeJavaScript(`(() => {
      localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})
      localStorage.setItem('manju-creation.provider-settings.v1', ${JSON.stringify(JSON.stringify(providerSettings))})
    })()`)
    await window.loadFile(entry, { query: { page: 'final' } })
    window.setPosition(-10000, -10000)
    window.show()
    window.focus()
    await new Promise((resolve) => setTimeout(resolve, 120))

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(420)
      window.__shotVideoFetchCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => {
        window.__shotVideoFetchCalls += 1
        return originalFetch(...args)
      }
      const button = document.querySelector('.shot-video-entry-card > button')
      const buttonRect = button?.getBoundingClientRect()
      const entryState = {
        visible: Boolean(button),
        disabled: button?.disabled,
        label: button?.textContent.trim(),
        withinViewport: Boolean(buttonRect && buttonRect.top >= 0 && buttonRect.right <= window.innerWidth && buttonRect.bottom <= window.innerHeight),
        target: button?.getAttribute('aria-controls'),
        localBoundary: document.querySelector('.local-export-boundary')?.textContent.trim(),
        requestBadge: document.querySelector('.shot-video-entry-card > header > em')?.textContent.trim(),
      }
      button.focus()
      entryState.focusableBeforeOpen = document.activeElement === button
      button.click()
      await wait(130)
      const dialog = document.querySelector('.shot-video-api-dialog')
      const promptInput = document.querySelector('[aria-label="AI 视频导演提示词"]')
      const modeSelect = document.querySelector('.shot-video-api-parameters label:nth-child(1) select')
      const durationInput = document.querySelector('[aria-label="AI 视频 API 时长"]')
      const dialogState = {
        visible: Boolean(dialog),
        title: document.querySelector('#shot-video-api-title')?.textContent.trim(),
        description: document.querySelector('#shot-video-api-description')?.textContent.trim(),
        provider: document.querySelector('.shot-video-api-status-grid article:nth-child(1) strong')?.textContent.trim(),
        model: document.querySelector('.shot-video-api-status-grid article:nth-child(2) strong')?.textContent.trim(),
        keyStatus: document.querySelector('.shot-video-api-status-grid article:nth-child(3) strong')?.textContent.trim(),
        generationStatus: document.querySelector('.shot-video-api-status-grid article:nth-child(4) strong')?.textContent.trim(),
        requestStatus: document.querySelector('.shot-video-api-status-grid article:nth-child(4) span')?.textContent.trim(),
        firstFrameReal: document.querySelector('.shot-video-api-frame-flow article:nth-child(1) img')?.src === ${JSON.stringify(firstFrame)},
        lastFrameReal: document.querySelector('.shot-video-api-frame-flow article:nth-child(3) img')?.src === ${JSON.stringify(lastFrame)},
        prompt: promptInput?.value,
        mode: modeSelect?.value,
        resolution: document.querySelector('.shot-video-api-parameters label:nth-child(2) select')?.value,
        duration: durationInput?.value,
        mapping: document.querySelector('.shot-video-api-parameters label:nth-child(3) small')?.textContent.trim(),
        audioBoundary: document.querySelector('.shot-video-api-audio-notice')?.textContent.trim(),
        lockDisclosure: document.querySelector('.shot-video-api-lock-notice')?.textContent.trim(),
        lockedButtonDisabled: document.querySelector('.shot-video-api-submit')?.disabled,
        noFakeTask: !/任务已创建|排队中|正在生成|生成成功|task_id/u.test(dialog?.textContent || ''),
      }
      modeSelect.value = 'first-last'
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(50)
      const selectedMode = modeSelect.value
      document.querySelector('.shot-video-api-rebuild').click()
      await wait(50)
      const rebuiltPrompt = promptInput.value
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(80)
      const escapeState = {
        closed: !document.querySelector('.shot-video-api-dialog'),
        focusReturned: document.activeElement === button,
        activeElement: document.activeElement?.className || document.activeElement?.tagName || '',
        triggerConnected: button.isConnected,
        triggerDisabled: button.disabled,
      }
      button.focus()
      escapeState.manualFocusWorked = document.activeElement === button
      escapeState.triggerTabIndex = button.tabIndex
      escapeState.documentHasFocus = document.hasFocus()
      button.click()
      await wait(80)
      const layer = document.querySelector('.shot-video-api-layer')
      layer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await wait(80)
      const backdropState = { closed: !document.querySelector('.shot-video-api-dialog'), focusReturned: document.activeElement === button }
      button.click()
      await wait(100)
      return {
        entryState,
        dialogState,
        selectedMode,
        rebuiltPrompt,
        escapeState,
        backdropState,
        reopened: Boolean(document.querySelector('.shot-video-api-dialog')),
        fetchCalls: window.__shotVideoFetchCalls,
      }
    })()`)

    const paintState = await window.webContents.executeJavaScript(`(() => {
      const layer = document.querySelector('.shot-video-api-layer')
      const dialog = document.querySelector('.shot-video-api-dialog')
      const rect = dialog?.getBoundingClientRect()
      const centerX = rect ? rect.left + rect.width / 2 : 0
      const centerY = rect ? rect.top + Math.min(rect.height / 2, window.innerHeight / 2) : 0
      return {
        visible: Boolean(dialog),
        layerOpacity: layer ? getComputedStyle(layer).opacity : '',
        dialogOpacity: dialog ? getComputedStyle(dialog).opacity : '',
        layerZIndex: layer ? getComputedStyle(layer).zIndex : '',
        left: rect?.left || 0,
        top: rect?.top || 0,
        right: rect?.right || 0,
        bottom: rect?.bottom || 0,
        width: rect?.width || 0,
        height: rect?.height || 0,
        topElementClass: document.elementFromPoint(centerX, centerY)?.closest('.shot-video-api-dialog')?.className || '',
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })()`)

    window.setSkipTaskbar(true)
    window.showInactive()
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
    window.hide()

    const settingsResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.shot-video-api-settings').click()
      await wait(150)
      return {
        dialogClosed: !document.querySelector('.shot-video-api-dialog'),
        settingsVisible: Boolean(document.querySelector('.settings-page--v22')),
        videoTabSelected: document.querySelector('#settings-tab-video')?.getAttribute('aria-selected') === 'true',
        fetchCalls: window.__shotVideoFetchCalls,
      }
    })()`)

    const missingFrameSnapshot = createTestUserProjectSnapshot()
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(missingFrameSnapshot))})`)
    await window.loadFile(entry, { query: { page: 'final' } })
    const missingFrameResult = await window.webContents.executeJavaScript(`(async () => {
      await new Promise((resolve) => setTimeout(resolve, 360))
      const button = document.querySelector('.shot-video-entry-card > button')
      return {
        disabled: button?.disabled,
        label: button?.textContent.trim(),
        dialogAbsent: !document.querySelector('.shot-video-api-dialog'),
        fakeFrameAbsent: !document.querySelector('.shot-video-entry-card img'),
      }
    })()`)

    const { focusableBeforeOpen, ...functionalEntryState } = result.entryState
    const focusVerification = focusableBeforeOpen ? 'passed' : 'not run'
    assert.deepEqual(functionalEntryState, {
      visible: true,
      disabled: false,
      label: '预览视频请求已锁定',
      withinViewport: true,
      target: 'shot-video-api-dialog',
      localBoundary: '本地合成 · 不上传素材',
      requestBadge: '0 请求',
    })
    assert.equal(result.dialogState.visible, true)
    assert.equal(result.dialogState.title, 'AI 视频请求预览')
    assert.match(result.dialogState.description, /镜头 01 · 月下相逢/u)
    assert.equal(result.dialogState.provider, '阿里云百炼')
    assert.equal(result.dialogState.model, 'wan2.7-i2v-2026-04-25')
    assert.match(result.dialogState.keyStatus, /未找到本地 Key|没有百炼安全桥接能力/u)
    assert.equal(result.dialogState.generationStatus, '付费生成已锁定')
    assert.equal(result.dialogState.requestStatus, '任务 0 · 上传 0 · 预计消耗 0')
    assert.equal(result.dialogState.firstFrameReal, true)
    assert.equal(result.dialogState.lastFrameReal, true)
    assert.equal(result.dialogState.prompt, '真实视频提示词：沈砚在月下钟楼广场缓慢回头，衣摆被风吹动。')
    assert.equal(result.dialogState.mode, 'first-frame')
    assert.equal(result.dialogState.resolution, '720P')
    assert.equal(result.dialogState.duration, '5')
    assert.match(result.dialogState.mapping, /时间线 4\.5s → API 5s/u)
    assert.match(result.dialogState.audioBoundary, /本地音轨不会上传/u)
    assert.match(result.dialogState.audioBoundary, /不传 driving_audio/u)
    assert.match(result.dialogState.lockDisclosure, /不会上传首帧、不会创建任务、不会消耗额度/u)
    assert.equal(result.dialogState.lockedButtonDisabled, true)
    assert.equal(result.dialogState.noFakeTask, true)
    assert.equal(result.selectedMode, 'first-last')
    assert.match(result.rebuiltPrompt, /暗流涌动/u)
    assert.match(result.rebuiltPrompt, /月下相逢/u)
    assert.match(result.rebuiltPrompt, /角色缓缓回头/u)
    assert.equal(result.escapeState.closed, true)
    assert.equal(result.escapeState.triggerConnected, true)
    assert.equal(result.escapeState.triggerDisabled, false)
    if (focusableBeforeOpen) {
      assert.equal(result.escapeState.manualFocusWorked, true)
      assert.equal(result.escapeState.focusReturned, true, `Esc 关闭后活动元素：${result.escapeState.activeElement}`)
      assert.deepEqual(result.backdropState, { closed: true, focusReturned: true })
    } else {
      assert.equal(result.escapeState.manualFocusWorked, false)
      assert.equal(result.backdropState.closed, true)
    }
    assert.equal(result.reopened, true)
    assert.equal(result.fetchCalls, 0)
    assert.equal(paintState.visible, true)
    assert.equal(paintState.layerOpacity, '1')
    assert.equal(paintState.dialogOpacity, '1')
    assert.equal(paintState.layerZIndex, '250')
    assert.equal(paintState.left >= 0, true)
    assert.equal(paintState.top >= 0, true)
    assert.equal(paintState.right <= 1440, true)
    assert.equal(paintState.bottom <= 960, true)
    assert.equal(paintState.width >= 860, true)
    assert.equal(paintState.height > 600, true)
    assert.match(paintState.topElementClass, /shot-video-api-dialog/u)
    assert.equal(paintState.horizontalOverflow, false)
    assert.deepEqual(settingsResult, { dialogClosed: true, settingsVisible: true, videoTabSelected: true, fetchCalls: 0 })
    assert.deepEqual(missingFrameResult, { disabled: true, label: '缺少真实首帧已锁定', dialogAbsent: true, fakeFrameAbsent: true })
    assert.equal(remoteRequestCount, 0)

    console.log(JSON.stringify({ passed: true, focusVerification, screenshotPath, remoteRequestCount, paintState, result, settingsResult, missingFrameResult }))
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
