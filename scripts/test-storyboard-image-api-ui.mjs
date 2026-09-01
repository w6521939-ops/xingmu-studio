import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `storyboard-image-api-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'storyboard-image-api-entry.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const createReferenceDataUrl = (label, colorA, colorB) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient></defs><rect width="640" height="420" rx="36" fill="url(#b)"/><circle cx="320" cy="162" r="70" fill="#effbff" opacity=".9"/><path d="M190 380c18-96 74-148 130-148s112 52 130 148" fill="#d9f4ff" opacity=".88"/><text x="320" y="183" text-anchor="middle" font-size="48" font-family="Microsoft YaHei" fill="#2b76a6">${label}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const shotImage = createReferenceDataUrl('镜头 01', '#82ddff', '#637fe8')
const characterImages = [
  createReferenceDataUrl('沈', '#b8efff', '#7f9fff'),
  createReferenceDataUrl('苏', '#d4f5ff', '#90b7f4'),
  createReferenceDataUrl('萧', '#9de5f4', '#477fd0'),
]

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 920,
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

    const snapshot = createTestUserProjectSnapshot()
    snapshot.content.characters.slice(0, 3).forEach((character, index) => {
      character.image = characterImages[index]
      character.imageFileName = `${character.name}-本地参考图.svg`
      character.imageSource = 'local'
    })
    snapshot.content.shots[0] = {
      ...snapshot.content.shots[0],
      visualPrompt: '真实镜头提示词：沈砚在月下钟楼广场回头，近景，缓慢推进。',
      characterIds: [1, 2, 3, 4],
      image: shotImage,
      imageFileName: '月下相逢-镜头01.svg',
      imageSource: 'local',
      imageStatus: '已完成',
    }
    const providerSettings = {
      image: {
        provider: '阿里云百炼',
        model: 'wan2.7-image-pro',
        endpoint: 'https://dashscope.aliyuncs.com/api/v1',
        status: '未连接',
      },
    }
    const entry = path.join(process.cwd(), 'dist', 'index.html')
    await window.loadFile(entry)
    await window.webContents.executeJavaScript(`(() => {
      localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})
      localStorage.setItem('manju-creation.provider-settings.v1', ${JSON.stringify(JSON.stringify(providerSettings))})
    })()`)
    await window.loadFile(entry, { query: { page: 'storyboard' } })

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(340)
      Array.from(document.querySelectorAll('.scene-switcher > button')).find((button) => button.textContent.includes('场景 03'))?.click()
      await wait(130)
      window.__storyboardImageFetchCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => {
        window.__storyboardImageFetchCalls += 1
        return originalFetch(...args)
      }
      const button = document.querySelector('.storyboard-image-api-button')
      const buttonRect = button?.getBoundingClientRect()
      const entryState = {
        visible: Boolean(button),
        disabled: button?.disabled,
        label: button?.textContent.trim(),
        withinViewport: Boolean(buttonRect && buttonRect.top >= 0 && buttonRect.right <= window.innerWidth && buttonRect.bottom <= window.innerHeight),
        hasDialogTarget: button?.getAttribute('aria-controls') === 'storyboard-image-api-dialog',
        batchStillDisabled: document.querySelector('.batch-image-button')?.disabled,
      }
      button.click()
      await wait(110)
      const dialog = document.querySelector('.storyboard-image-api-dialog')
      const promptInput = document.querySelector('[aria-label="分镜画面提示词"]')
      const references = Array.from(document.querySelectorAll('.storyboard-image-api-references article'))
      const dialogState = {
        visible: Boolean(dialog),
        title: document.querySelector('#storyboard-image-api-title')?.textContent.trim(),
        description: document.querySelector('#storyboard-image-api-description')?.textContent.trim(),
        prompt: promptInput?.value,
        provider: document.querySelector('.storyboard-image-api-status-grid article:nth-child(1) strong')?.textContent.trim(),
        model: document.querySelector('.storyboard-image-api-status-grid article:nth-child(2) strong')?.textContent.trim(),
        keyStatus: document.querySelector('.storyboard-image-api-status-grid article:nth-child(3) strong')?.textContent.trim(),
        generationStatus: document.querySelector('.storyboard-image-api-status-grid article:nth-child(4) strong')?.textContent.trim(),
        shotImageVisible: Boolean(document.querySelector('.storyboard-image-api-preview > img')),
        shotImageIsReal: document.querySelector('.storyboard-image-api-preview > img')?.src === ${JSON.stringify(shotImage)},
        referenceCountLabel: document.querySelector('.storyboard-image-api-references > header > span')?.textContent.trim(),
        referenceRows: references.length,
        includedReferences: references.filter((reference) => reference.classList.contains('is-included')).length,
        overflowReferences: references.filter((reference) => reference.textContent.includes('超出 3 张上限')).length,
        missingReferences: references.filter((reference) => reference.textContent.includes('无参考图')).length,
        lockedButtonDisabled: document.querySelector('.storyboard-image-api-submit')?.disabled,
        requestDisclosure: document.querySelector('.storyboard-image-api-lock-notice')?.textContent.trim(),
        noFakeResult: !/生成成功|排队中|任务已创建|正在生成/u.test(dialog?.textContent || ''),
      }
      document.querySelector('.storyboard-image-api-rebuild').click()
      await wait(60)
      const rebuiltPrompt = promptInput.value
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(70)
      const escapeState = {
        closed: !document.querySelector('.storyboard-image-api-dialog'),
        focusReturned: document.activeElement === button,
      }
      button.click()
      await wait(70)
      const layer = document.querySelector('.storyboard-image-api-layer')
      layer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await wait(70)
      const backdropState = {
        closed: !document.querySelector('.storyboard-image-api-dialog'),
        focusReturned: document.activeElement === button,
      }
      button.click()
      await wait(90)
      return {
        entryState,
        dialogState,
        rebuiltPrompt,
        escapeState,
        backdropState,
        reopened: Boolean(document.querySelector('.storyboard-image-api-dialog')),
        fetchCalls: window.__storyboardImageFetchCalls,
      }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 160))
    const paintState = await window.webContents.executeJavaScript(`(() => {
      const layer = document.querySelector('.storyboard-image-api-layer')
      const dialog = document.querySelector('.storyboard-image-api-dialog')
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
        topElementClass: document.elementFromPoint(centerX, centerY)?.closest('.storyboard-image-api-dialog')?.className || '',
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
      document.querySelector('.storyboard-image-api-settings').click()
      await wait(130)
      return {
        dialogClosed: !document.querySelector('.storyboard-image-api-dialog'),
        settingsVisible: Boolean(document.querySelector('.settings-page--v22')),
        imageTabSelected: document.querySelector('#settings-tab-image')?.getAttribute('aria-selected') === 'true',
        fetchCalls: window.__storyboardImageFetchCalls,
      }
    })()`)

    assert.deepEqual(result.entryState, {
      visible: true,
      disabled: false,
      label: 'API 生成当前画面已锁定',
      withinViewport: true,
      hasDialogTarget: true,
      batchStillDisabled: true,
    })
    assert.equal(result.dialogState.visible, true)
    assert.equal(result.dialogState.title, 'API 生成当前画面')
    assert.match(result.dialogState.description, /镜头 01 · 月下相逢/u)
    assert.equal(result.dialogState.prompt, '真实镜头提示词：沈砚在月下钟楼广场回头，近景，缓慢推进。')
    assert.equal(result.dialogState.provider, '阿里云百炼')
    assert.equal(result.dialogState.model, 'wan2.7-image-pro')
    assert.match(result.dialogState.keyStatus, /未找到本地 Key|没有百炼安全桥接能力/u)
    assert.equal(result.dialogState.generationStatus, '真实生成已锁定')
    assert.equal(result.dialogState.shotImageVisible, true)
    assert.equal(result.dialogState.shotImageIsReal, true)
    assert.equal(result.dialogState.referenceCountLabel, '请求参考图 3/3')
    assert.equal(result.dialogState.referenceRows, 4)
    assert.equal(result.dialogState.includedReferences, 2)
    assert.equal(result.dialogState.overflowReferences, 1)
    assert.equal(result.dialogState.missingReferences, 1)
    assert.equal(result.dialogState.lockedButtonDisabled, true)
    assert.match(result.dialogState.requestDisclosure, /不会向百炼发送图片生成请求/u)
    assert.equal(result.dialogState.noFakeResult, true)
    assert.match(result.rebuiltPrompt, /月下相逢/u)
    assert.match(result.rebuiltPrompt, /沈砚/u)
    assert.deepEqual(result.escapeState, { closed: true, focusReturned: true })
    assert.deepEqual(result.backdropState, { closed: true, focusReturned: true })
    assert.equal(result.reopened, true)
    assert.equal(result.fetchCalls, 0)
    assert.equal(paintState.visible, true)
    assert.equal(paintState.layerOpacity, '1')
    assert.equal(paintState.dialogOpacity, '1')
    assert.equal(paintState.layerZIndex, '245')
    assert.equal(paintState.left >= 0, true)
    assert.equal(paintState.top >= 0, true)
    assert.equal(paintState.right <= 1440, true)
    assert.equal(paintState.bottom <= 920, true)
    assert.equal(paintState.width >= 820, true)
    assert.equal(paintState.height > 500, true)
    assert.match(paintState.topElementClass, /storyboard-image-api-dialog/u)
    assert.equal(paintState.horizontalOverflow, false)
    assert.deepEqual(settingsResult, { dialogClosed: true, settingsVisible: true, imageTabSelected: true, fetchCalls: 0 })
    assert.equal(remoteRequestCount, 0)

    console.log(JSON.stringify({ passed: true, screenshotPath, remoteRequestCount, paintState, result, settingsResult }))
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
