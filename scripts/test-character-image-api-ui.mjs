import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `character-image-api-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'character-image-api-entry.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const referenceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b8efff"/><stop offset="1" stop-color="#7f9fff"/></linearGradient></defs><rect width="480" height="640" rx="42" fill="url(#b)"/><circle cx="240" cy="220" r="92" fill="#effbff" opacity=".9"/><path d="M102 570c18-124 82-190 138-190s120 66 138 190" fill="#d9f4ff" opacity=".9"/><text x="240" y="245" text-anchor="middle" font-size="72" font-family="Microsoft YaHei" fill="#2b76a6">沈</text><text x="240" y="605" text-anchor="middle" font-size="24" font-family="Microsoft YaHei" fill="#225b83">本地角色参考图</text></svg>`
const referenceDataUrl = `data:image/svg+xml;base64,${Buffer.from(referenceSvg).toString('base64')}`

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
    snapshot.content.characters[0] = {
      ...snapshot.content.characters[0],
      image: referenceDataUrl,
      imageFileName: '沈砚-本地参考图.svg',
      imageSource: 'local',
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
    await window.loadFile(entry, { query: { page: 'character' } })

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(360)
      window.__characterImageFetchCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => {
        window.__characterImageFetchCalls += 1
        return originalFetch(...args)
      }
      const button = document.querySelector('.character-api-image-button')
      const buttonRect = button?.getBoundingClientRect()
      const entryState = {
        visible: Boolean(button),
        disabled: button?.disabled,
        label: button?.textContent.trim(),
        hasDialogTarget: button?.getAttribute('aria-controls') === 'character-image-api-dialog',
        withinViewport: Boolean(buttonRect && buttonRect.top >= 0 && buttonRect.bottom <= window.innerHeight),
      }
      button.click()
      await wait(120)
      const dialog = document.querySelector('.character-image-api-dialog')
      const prompt = document.querySelector('[aria-label="角色图片提示词"]')?.value || ''
      const dialogState = {
        visible: Boolean(dialog),
        title: document.querySelector('#character-image-api-title')?.textContent.trim(),
        prompt,
        usesCurrentCharacter: prompt.includes('沈砚') && prompt.includes('男主') && prompt.includes('低沉磁性') && prompt.includes('调查记者'),
        avoidsInventedCharacter: !prompt.includes('林夏'),
        provider: document.querySelector('.character-image-api-status-grid article:nth-child(1) strong')?.textContent.trim(),
        model: document.querySelector('.character-image-api-status-grid article:nth-child(2) strong')?.textContent.trim(),
        keyStatus: document.querySelector('.character-image-api-status-grid article:nth-child(3) strong')?.textContent.trim(),
        generationStatus: document.querySelector('.character-image-api-status-grid article:nth-child(4) strong')?.textContent.trim(),
        referenceVisible: Boolean(document.querySelector('.character-image-api-reference img')),
        referenceSourceIsLocal: document.querySelector('.character-image-api-reference img')?.src === ${JSON.stringify(referenceDataUrl)},
        lockedButtonDisabled: document.querySelector('.character-image-api-submit')?.disabled,
        requestDisclosure: document.querySelector('.character-image-api-lock-notice')?.textContent.trim(),
        noFakeResult: !/生成成功|排队中|任务已创建|正在生成/u.test(dialog?.textContent || ''),
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(80)
      const escapeState = {
        closed: !document.querySelector('.character-image-api-dialog'),
        focusReturned: document.activeElement === button,
      }
      button.click()
      await wait(100)
      return {
        entryState,
        dialogState,
        escapeState,
        reopened: Boolean(document.querySelector('.character-image-api-dialog')),
        fetchCalls: window.__characterImageFetchCalls,
      }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 220))
    const paintState = await window.webContents.executeJavaScript(`(() => {
      const layer = document.querySelector('.character-image-api-layer')
      const dialog = document.querySelector('.character-image-api-dialog')
      const rect = dialog?.getBoundingClientRect()
      return {
        visible: Boolean(dialog),
        layerDisplay: layer ? getComputedStyle(layer).display : '',
        layerOpacity: layer ? getComputedStyle(layer).opacity : '',
        dialogOpacity: dialog ? getComputedStyle(dialog).opacity : '',
        width: rect?.width || 0,
        height: rect?.height || 0,
      }
    })()`)
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const settingsResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.character-image-api-settings').click()
      await wait(140)
      return {
        dialogClosed: !document.querySelector('.character-image-api-dialog'),
        settingsVisible: Boolean(document.querySelector('.settings-page--v22')),
        imageTabSelected: document.querySelector('#settings-tab-image')?.getAttribute('aria-selected') === 'true',
        selectedLabel: document.querySelector('#settings-tab-image')?.textContent.trim(),
        fetchCalls: window.__characterImageFetchCalls,
      }
    })()`)

    assert.deepEqual(result.entryState, {
      visible: true,
      disabled: false,
      label: 'API 生成角色图已锁定',
      hasDialogTarget: true,
      withinViewport: true,
    })
    assert.equal(result.dialogState.visible, true)
    assert.equal(result.dialogState.title, 'API 生成角色图')
    assert.equal(result.dialogState.usesCurrentCharacter, true)
    assert.equal(result.dialogState.avoidsInventedCharacter, true)
    assert.equal(result.dialogState.provider, '阿里云百炼')
    assert.equal(result.dialogState.model, 'wan2.7-image-pro')
    assert.equal(result.dialogState.keyStatus, '未找到本地 Key')
    assert.equal(result.dialogState.generationStatus, '真实生成已锁定')
    assert.equal(result.dialogState.referenceVisible, true)
    assert.equal(result.dialogState.referenceSourceIsLocal, true)
    assert.equal(result.dialogState.lockedButtonDisabled, true)
    assert.match(result.dialogState.requestDisclosure, /不会向百炼发送图片生成请求/u)
    assert.equal(result.dialogState.noFakeResult, true)
    assert.deepEqual(result.escapeState, { closed: true, focusReturned: true })
    assert.equal(result.reopened, true)
    assert.equal(paintState.visible, true)
    assert.equal(paintState.layerDisplay, 'grid')
    assert.equal(paintState.layerOpacity, '1')
    assert.equal(paintState.dialogOpacity, '1')
    assert.equal(paintState.width > 600, true)
    assert.equal(paintState.height > 400, true)
    assert.equal(result.fetchCalls, 0)
    assert.equal(settingsResult.dialogClosed, true)
    assert.equal(settingsResult.settingsVisible, true)
    assert.equal(settingsResult.imageTabSelected, true)
    assert.match(settingsResult.selectedLabel, /图像生成/u)
    assert.equal(settingsResult.fetchCalls, 0)
    assert.equal(remoteRequestCount, 0)

    console.log(JSON.stringify({ passed: true, screenshotPath, remoteRequestCount, paintState, result, settingsResult }))
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
