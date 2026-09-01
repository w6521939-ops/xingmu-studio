import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const outputDirectory = path.join(process.cwd(), 'outputs', 'runtime')
const testDataDirectory = path.join(process.cwd(), 'outputs', `one-click-ui-user-data-${Date.now()}-${process.pid}`)
const snapshotPath = path.join(testDataDirectory, 'snapshot.json')
const modalScreenshotPath = path.join(outputDirectory, 'one-click-zero-cost-modal-v38.png')
const drawerScreenshotPath = path.join(outputDirectory, 'one-click-production-drawer-v38.png')

await mkdir(testDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await writeFile(snapshotPath, JSON.stringify(createTestUserProjectSnapshot()), 'utf8')
process.env.MANJU_TEST_SNAPSHOT_PATH = snapshotPath
process.env.MANJU_DISABLE_PAID_GENERATION = '1'
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1600,
      height: 900,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        preload: path.join(process.cwd(), 'scripts', 'fixtures', 'one-click-test-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'overview' } })
    await new Promise((resolve) => setTimeout(resolve, 650))
    const captureScreenshot = async (filePath) => {
      await new Promise((resolve) => setTimeout(resolve, 320))
      if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3')
      await window.webContents.debugger.sendCommand('Page.enable')
      const screenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      })
      await writeFile(filePath, Buffer.from(screenshot.data, 'base64'))
    }

    const overview = await window.webContents.executeJavaScript(`(() => {
      const card = document.querySelector('[data-testid="one-click-overview-card"]')
      return {
        visible: Boolean(card),
        title: card?.querySelector('h2')?.textContent.trim(),
        counts: Array.from(card?.querySelectorAll('.one-click-overview-counts b') || []).map((node) => Number(node.textContent)),
        button: card?.querySelector(':scope > .primary-button')?.textContent.trim(),
        protection: card?.querySelector('header em')?.textContent.trim(),
      }
    })()`)
    if (!overview.visible) {
      console.error(await window.webContents.executeJavaScript(`({
        mainClass: document.querySelector('main')?.className,
        bodyText: document.body.textContent.slice(0, 800),
        bridgeKeys: Object.keys(window.manjuDesktop || {}),
      })`))
    }
    assert.deepEqual(overview.counts, [6, 6, 7, 6, 1])
    assert.equal(overview.visible, true)
    assert.equal(overview.title, '一键制作整部漫剧')
    assert.match(overview.button, /开始制作 40 项/u)
    assert.match(overview.protection, /首次需确认/u)

    const modal = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('[data-testid="one-click-overview-card"] > .primary-button').click()
      await wait(120)
      const dialog = document.querySelector('.zero-cost-safety-modal')
      const submit = dialog?.querySelector('footer .primary-button')
      const initial = {
        visible: Boolean(dialog),
        title: dialog?.querySelector('h2')?.textContent.trim(),
        models: Array.from(dialog?.querySelectorAll('.zero-cost-model-list article small') || []).map((node) => node.textContent.trim()),
        submitDisabled: submit?.disabled,
        honestCopy: dialog?.textContent.includes('无法读取阿里云控制台的实时剩余额度'),
      }
      dialog.querySelector('.zero-cost-official-button').click()
      await wait(50)
      return initial
    })()`)
    assert.equal(modal.visible, true)
    assert.equal(modal.title, '先开启“免费额度用完即停”')
    assert.deepEqual(modal.models, ['qwen3.7-plus', 'wan2.7-image-pro', 'qwen3-tts-flash', 'wan2.7-i2v-2026-04-25'])
    assert.equal(modal.submitDisabled, true)
    assert.equal(modal.honestCopy, true)
    await captureScreenshot(modalScreenshotPath)

    const drawer = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.zero-cost-attestation input').click()
      document.querySelector('.zero-cost-safety-modal footer .primary-button').click()
      await wait(180)
      const panel = document.querySelector('.one-click-production-drawer')
      return {
        visible: Boolean(panel),
        status: panel?.querySelector('header em')?.textContent.trim(),
        total: panel?.querySelector('.one-click-production-overall strong')?.textContent.replace(/\\s+/g, ' ').trim(),
        taskCount: panel?.querySelectorAll('.one-click-task-log article').length,
        noFakePercent: !panel?.textContent.includes('%'),
      }
    })()`)
    assert.equal(drawer.visible, true)
    assert.match(drawer.status, /正在准备/u)
    assert.match(drawer.total, /0 \/ 40/u)
    assert.equal(drawer.taskCount, 40)
    assert.equal(drawer.noFakePercent, true)
    await captureScreenshot(drawerScreenshotPath)

    const settings = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.one-click-production-drawer > header .inline-icon').click()
      await wait(70)
      const dockVisible = Boolean(document.querySelector('.one-click-production-dock'))
      document.querySelector('[aria-label="打开设置"]').click()
      await wait(120)
      const card = document.querySelector('[data-testid="settings-zero-cost-card"]')
      return {
        dockVisible,
        cardVisible: Boolean(card),
        state: card?.querySelector(':scope > strong')?.textContent.trim(),
        honestCopy: card?.textContent.includes('不显示虚假的实时余额'),
      }
    })()`)
    assert.deepEqual(settings, {
      dockVisible: true,
      cardVisible: true,
      state: '已由用户确认',
      honestCopy: true,
    })

    console.log(JSON.stringify({
      passed: true,
      overview,
      modal,
      drawer,
      settings,
      modalScreenshotPath,
      drawerScreenshotPath,
      realGenerationCalls: 0,
    }))
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach()
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
