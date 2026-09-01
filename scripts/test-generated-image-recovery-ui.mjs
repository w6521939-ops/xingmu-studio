import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { app, BrowserWindow } from 'electron'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const testDataDirectory = path.join(
  process.cwd(),
  'outputs',
  `generated-image-recovery-user-data-${Date.now()}-${process.pid}`,
)
const projectDirectory = path.join(testDataDirectory, 'projects')
const outputDirectory = path.join(testDataDirectory, '.manju-studio', 'outputs', 'images')
const manifestPath = path.join(testDataDirectory, '.manju-studio', 'manifest.json')
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'generated-image-recovery-v37.png')
const sourceImagePath = String(process.env.MANJU_RECOVERY_SOURCE_IMAGE || '').trim()
const outputFileName = 'storyboard-recovery.png'
const outputImagePath = path.join(outputDirectory, outputFileName)
const assetId = 'image-recovery-abcd1234'
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

await mkdir(projectDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })

if (sourceImagePath) await copyFile(sourceImagePath, outputImagePath)
else await writeFile(outputImagePath, onePixelPng)
const imageBuffer = await readFile(outputImagePath)
const imageSha256 = createHash('sha256').update(imageBuffer).digest('hex')
const now = new Date().toISOString()
const snapshot = createTestUserProjectSnapshot()
snapshot.content.shots = snapshot.content.shots.map((shot) => shot.id === 5 ? {
  ...shot,
  visualPrompt: '林听雨站在雾中触碰古钟，古风悬疑漫剧分镜，缓慢推进。',
  image: '',
  imageStatus: '未生成',
  imageSource: '',
  imageFileName: '',
} : shot)

await writeFile(path.join(projectDirectory, 'autosave.manju'), JSON.stringify(snapshot, null, 2), 'utf8')
await writeFile(manifestPath, JSON.stringify({
  version: 1,
  createdAt: now,
  updatedAt: now,
  assets: [{
    id: assetId,
    kind: 'image',
    name: '镜头 5 分镜图',
    tags: ['百炼', 'wan2.7-image-pro', 'storyboard'],
    useful: true,
    localPath: '.manju-studio/outputs/images/storyboard-recovery.png',
    sha256: imageSha256,
    lineage: {
      entityId: '5',
      requestId: 'local-recovery-ui-test',
      model: 'wan2.7-image-pro',
    },
    createdAt: now,
    updatedAt: now,
  }],
  tasks: [],
}, null, 2), 'utf8')

process.env.MANJU_DISABLE_PAID_GENERATION = '1'
process.env.MANJU_TEST_WORKSPACE_ROOT = testDataDirectory
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

await import('../main.js')

app.whenReady().then(async () => {
  let stage = 'window'
  const timeout = setTimeout(() => {
    console.error(`Generated image recovery UI timed out at stage: ${stage}`)
    app.exit(1)
  }, 45000)

  try {
    let applicationWindow
    for (let attempt = 0; attempt < 80; attempt += 1) {
      applicationWindow = BrowserWindow.getAllWindows()[0]
      if (applicationWindow && !applicationWindow.webContents.isLoading()) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!applicationWindow) throw new Error('应用窗口未创建')
    await applicationWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })
    await new Promise((resolve) => setTimeout(resolve, 180))

    let remoteRequestCount = 0
    applicationWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (_details, callback) => {
        remoteRequestCount += 1
        callback({})
      },
    )
    applicationWindow.setPosition(-10000, -10000)
    applicationWindow.hide()

    stage = 'recover-and-adopt'
    const uiResult = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitFor = async (selector, timeout = 6000) => {
        const deadline = Date.now() + timeout
        while (!document.querySelector(selector) && Date.now() < deadline) await wait(60)
        return document.querySelector(selector)
      }
      await waitFor('.continue-preview')
      document.querySelector('.continue-preview').click()
      await waitFor('.overview-page')
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '分镜')?.click()
      await waitFor('.storyboard-page')
      const sceneSelect = document.querySelectorAll('.storyboard-toolbar select')[1]
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sceneSelect, '3')
      sceneSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(180)
      document.querySelectorAll('.shot-card')[4]?.click()
      await wait(100)
      document.querySelector('.storyboard-image-api-button')?.click()
      await waitFor('.managed-image-recovery')
      const recovery = {
        visible: Boolean(document.querySelector('.managed-image-recovery')),
        text: document.querySelector('.managed-image-recovery')?.textContent.trim(),
      }
      document.querySelector('.managed-image-recovery button')?.click()
      await waitFor('.storyboard-image-api-generated img')
      const generatedImage = document.querySelector('.storyboard-image-api-generated img')
      const imageDeadline = Date.now() + 6000
      while ((!generatedImage.complete || generatedImage.naturalWidth === 0) && Date.now() < imageDeadline) await wait(60)
      const result = {
        src: generatedImage.src,
        naturalWidth: generatedImage.naturalWidth,
        naturalHeight: generatedImage.naturalHeight,
        adoptionNotice: document.querySelector('.managed-image-adoption-notice')?.textContent.trim(),
        applyLabel: document.querySelector('.storyboard-image-api-submit')?.textContent.trim(),
      }
      document.querySelector('.storyboard-image-api-submit')?.click()
      await wait(1150)
      const saved = await window.manjuDesktop.loadAutosave()
      const savedShot = saved.snapshot?.content?.shots?.find((shot) => Number(shot.id) === 5)
      return {
        recovery,
        result,
        dialogClosed: !document.querySelector('.storyboard-image-api-dialog'),
        visibleShotSrc: document.querySelector('.shot-card.is-active img.art--image')?.src || '',
        toast: document.querySelector('.toast')?.textContent.trim() || '',
        saved: {
          ok: saved.ok,
          image: savedShot?.image || '',
          imageAssetId: savedShot?.imageAssetId || '',
          imageSource: savedShot?.imageSource || '',
          imageBytes: savedShot?.imageBytes || 0,
          containsBase64: JSON.stringify(saved.snapshot || {}).includes('data:image/'),
          serializedBytes: new TextEncoder().encode(JSON.stringify(saved.snapshot || {}, null, 2)).length,
        },
      }
    })()`)

    assert.equal(uiResult.recovery.visible, true)
    assert.match(uiResult.recovery.text, /恢复不会调用百炼/u)
    assert.equal(uiResult.result.src, `manju-media://generated-image/${assetId}`)
    assert.equal(uiResult.result.naturalWidth > 0, true)
    assert.equal(uiResult.result.naturalHeight > 0, true)
    assert.match(uiResult.result.adoptionNotice, /项目正文预计增加不足 1 KB/u)
    assert.equal(uiResult.result.applyLabel, '采用到当前镜头')
    assert.equal(uiResult.dialogClosed, true)
    assert.equal(uiResult.visibleShotSrc, `manju-media://generated-image/${assetId}`)
    assert.match(uiResult.toast, /已采用本地文件化分镜图/u)
    assert.equal(uiResult.saved.ok, true)
    assert.equal(uiResult.saved.image, `manju-media://generated-image/${assetId}`)
    assert.equal(uiResult.saved.imageAssetId, assetId)
    assert.equal(uiResult.saved.imageSource, 'bailian-managed')
    assert.equal(uiResult.saved.imageBytes, imageBuffer.byteLength)
    assert.equal(uiResult.saved.containsBase64, false)
    assert.equal(uiResult.saved.serializedBytes < 10 * 1024 * 1024, true)
    assert.equal(remoteRequestCount, 0)

    stage = 'screenshot'
    applicationWindow.setPosition(-10000, -10000)
    applicationWindow.showInactive()
    await new Promise((resolve) => setTimeout(resolve, 250))
    applicationWindow.webContents.debugger.attach('1.3')
    await applicationWindow.webContents.debugger.sendCommand('Page.enable')
    const screenshot = await applicationWindow.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    applicationWindow.webContents.debugger.detach()
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
    applicationWindow.hide()

    clearTimeout(timeout)
    console.log(JSON.stringify({
      passed: true,
      paidGenerationDisabled: process.env.MANJU_DISABLE_PAID_GENERATION === '1',
      usedProvidedImage: Boolean(sourceImagePath),
      imageBytes: imageBuffer.byteLength,
      remoteRequestCount,
      screenshotPath,
      uiResult,
    }))
    applicationWindow.destroy()
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    console.error(error)
    app.exit(1)
  }
})
