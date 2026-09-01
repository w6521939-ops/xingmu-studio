import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const workspaceRoot = process.cwd()
const outputDirectory = path.join(workspaceRoot, 'outputs', 'runtime')
const testDataDirectory = path.join(workspaceRoot, 'outputs', `studio-prep-ui-${Date.now()}-${process.pid}`)
const snapshotPath = path.join(testDataDirectory, 'snapshot.json')
const screenshotPath = path.join(outputDirectory, 'studio-production-prep.png')
const indexPath = path.join(workspaceRoot, 'dist', 'index.html')
const zeroCostSettings = {
  version: 1,
  confirmed: true,
  confirmedAt: '2026-08-06T00:00:00.000Z',
  modelSignature: 'script:qwen3.7-plus|image:wan2.7-image-pro|voice:qwen3-tts-flash|video:wan2.7-i2v-2026-04-25',
}

await mkdir(testDataDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })
await writeFile(snapshotPath, JSON.stringify(createTestUserProjectSnapshot()), 'utf8')
process.env.MANJU_TEST_SNAPSHOT_PATH = snapshotPath
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1600,
      height: 900,
      show: false,
      backgroundColor: '#080d13',
      webPreferences: {
        preload: path.join(workspaceRoot, 'scripts', 'fixtures', 'one-click-test-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    await window.loadFile(indexPath)
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.zero-cost-automation.v1', ${JSON.stringify(JSON.stringify(zeroCostSettings))})`)
    await window.loadFile(indexPath, { query: { page: 'studio' } })
    await new Promise((resolve) => setTimeout(resolve, 700))

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const initial = {
        workbenchVisible: Boolean(document.querySelector('.xm-visual-stage')),
        primaryLabel: document.querySelector('.xm-one-click')?.textContent.replace(/\\s+/g, ' ').trim(),
        stageCount: document.querySelectorAll('.xm-stage-item').length,
      }
      document.querySelector('.xm-one-click').click()
      await wait(120)
      const prep = document.querySelector('[data-testid="studio-production-prep"]')
      const beforeConfirm = {
        visible: Boolean(prep),
        title: prep?.querySelector('h1')?.textContent.trim(),
        activeStage: document.querySelector('.xm-stage-item button.is-active')?.textContent.replace(/\\s+/g, ' ').trim(),
        noRunStarted: !document.querySelector('.one-click-production-drawer'),
        quotaCopy: prep?.querySelector('.xm-quota-protection')?.textContent.replace(/\\s+/g, ' ').trim(),
        confirmDisabled: prep?.querySelector('.xm-primary-action')?.disabled,
        checks: prep?.querySelectorAll('.xm-check-list article').length,
      }
      const horizontal = Array.from(prep.querySelectorAll('.xm-aspect-switch button')).find((button) => button.textContent.includes('16:9'))
      horizontal.click()
      prep.querySelector('.xm-secondary-action').click()
      await wait(80)
      const settings = {
        horizontalSelected: horizontal.classList.contains('is-active'),
        savedLabel: prep.querySelector('.xm-secondary-action')?.textContent.trim(),
        storedAspect: JSON.parse(localStorage.getItem('xingmu-studio.production-preferences.v1') || '{}').aspect,
      }
      return { initial, beforeConfirm, settings }
    })()`)

    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG())

    const afterConfirm = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.xm-primary-action').click()
      await wait(180)
      return {
        prepClosed: !document.querySelector('[data-testid="studio-production-prep"]'),
        progressVisible: Boolean(document.querySelector('.one-click-production-drawer')),
        runStatus: document.querySelector('.one-click-production-drawer header em')?.textContent.trim(),
      }
    })()`)

    assert.deepEqual(result.initial, {
      workbenchVisible: true,
      primaryLabel: '✦一键成片',
      stageCount: 5,
    })
    assert.equal(result.beforeConfirm.visible, true)
    assert.equal(result.beforeConfirm.title, '成片准备中心')
    assert.match(result.beforeConfirm.activeStage, /成片/u)
    assert.equal(result.beforeConfirm.noRunStarted, true)
    assert.match(result.beforeConfirm.quotaCopy, /已启用免费额度用完即停/u)
    assert.equal(result.beforeConfirm.confirmDisabled, false)
    assert.equal(result.beforeConfirm.checks, 5)
    assert.deepEqual(result.settings, {
      horizontalSelected: true,
      savedLabel: '✓ 设置已保存',
      storedAspect: '16:9',
    })
    assert.equal(afterConfirm.prepClosed, true)
    assert.equal(afterConfirm.progressVisible, true)
    assert.match(afterConfirm.runStatus, /正在准备/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, result, afterConfirm, realGenerationCalls: 0 }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
