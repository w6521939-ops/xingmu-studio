import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `bailian-script-ui-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'bailian-script-paid-confirmation.png')
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
        preload: path.join(process.cwd(), 'scripts', 'bailian-script-test-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })

    const confirmation = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(360)
      const storyInput = document.querySelector('.story-launch textarea')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(storyInput, '云港高架站在零点响起神秘钟声。')
      storyInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(40)
      document.querySelector('.story-launch > .primary-button').click()
      await wait(320)
      return {
        visible: Boolean(document.querySelector('.bailian-script-confirm-modal')),
        title: document.querySelector('#bailian-script-confirm-title')?.textContent.trim(),
        cancelFocused: document.activeElement === document.querySelector('.bailian-script-confirm-modal .secondary-button'),
        dryRunText: document.querySelector('.bailian-script-confirm-notice')?.textContent.trim(),
        paidWarning: document.querySelector('#bailian-script-confirm-description')?.textContent.trim(),
        metrics: window.manjuDesktop.getTestMetrics(),
      }
    })()`)

    window.setPosition(-10000, -10000)
    window.showInactive()
    await new Promise((resolve) => setTimeout(resolve, 320))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())
    window.hide()

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const navButton = (label) => Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === label)
      const required = (element, label) => {
        if (!element) throw new Error('未找到测试控件：' + label)
        return element
      }
      required(document.querySelector('.bailian-script-confirm-modal .secondary-button'), '取消生成').click()
      await wait(70)
      const afterCancel = {
        dialogClosed: !document.querySelector('.bailian-script-confirm-modal'),
        metrics: window.manjuDesktop.getTestMetrics(),
      }
      required(document.querySelector('.story-launch > .primary-button'), '创建新漫剧').click()
      await wait(360)
      required(document.querySelector('.bailian-script-confirm-submit'), '确认并生成剧本').click()
      await wait(240)
      const overview = {
        visible: Boolean(document.querySelector('.overview-page')),
        title: document.querySelector('.project-identity h1 span')?.textContent.trim(),
        episodeCount: document.querySelectorAll('.episode-row').length,
        sceneCountText: document.querySelector('.episode-info > p')?.textContent.trim(),
        metrics: window.manjuDesktop.getTestMetrics(),
        dialogClosed: !document.querySelector('.bailian-script-confirm-modal'),
      }
      required(navButton('角色'), '角色导航；当前导航=' + Array.from(document.querySelectorAll('.topnav button')).map((button) => button.textContent.trim()).join('|') + '；页面=' + document.querySelector('main')?.className).click()
      await wait(80)
      const characters = {
        count: document.querySelectorAll('.character-list > button').length,
        selectedName: document.querySelector('.character-name-input')?.value,
      }
      required(navButton('分镜'), '分镜导航').click()
      await wait(80)
      const storyboard = {
        shotCount: document.querySelectorAll('.shot-card').length,
        firstAction: document.querySelector('.shot-card .shot-copy p')?.textContent.trim(),
      }
      return { afterCancel, overview, characters, storyboard }
    })()`)

    assert.equal(confirmation.visible, true)
    assert.equal(confirmation.title, '确认使用百炼生成剧本')
    assert.equal(confirmation.cancelFocused, true)
    assert.match(confirmation.dryRunText, /当前尚未创建付费任务/u)
    assert.match(confirmation.paidWarning, /可能产生模型调用费用/u)
    assert.deepEqual(confirmation.metrics, { dryRuns: 1, generations: 0 })
    assert.equal(result.afterCancel.dialogClosed, true)
    assert.deepEqual(result.afterCancel.metrics, { dryRuns: 1, generations: 0 })
    assert.equal(result.overview.visible, true)
    assert.equal(result.overview.title, '云港零点钟声')
    assert.equal(result.overview.episodeCount, 1)
    assert.equal(result.overview.sceneCountText, '场景 2')
    assert.deepEqual(result.overview.metrics, { dryRuns: 2, generations: 1 })
    assert.equal(result.overview.dialogClosed, true)
    assert.equal(result.characters.count, 2)
    assert.equal(result.characters.selectedName, '林澈')
    assert.equal(result.storyboard.shotCount, 2)
    assert.match(result.storyboard.firstAction, /云港高架站/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, confirmation, result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
