import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `bailian-integration-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'settings-bailian-key-v24.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()
process.env.BAILIAN_ALLOW_PAID_GENERATION = '0'

await import('../main.js')

app.whenReady().then(async () => {
  let stage = 'window'
  const timeout = setTimeout(() => {
    console.error(`Bailian integration timed out at stage: ${stage}`)
    app.exit(1)
  }, 45000)
  try {
    let applicationWindow
    for (let attempt = 0; attempt < 50; attempt += 1) {
      applicationWindow = BrowserWindow.getAllWindows()[0]
      if (applicationWindow && !applicationWindow.webContents.isLoading()) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!applicationWindow) throw new Error('应用窗口未创建')
    applicationWindow.hide()

    stage = 'renderer-interaction'
    const result = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(280)
      document.querySelector('[aria-label="打开设置"]').click()
      await wait(220)
      const providerStatus = await window.manjuDesktop.getBailianStatus()
      const scriptTab = document.querySelector('#settings-tab-script')
      const initial = {
        provider: document.querySelector('.settings-provider-form select')?.value,
        model: document.querySelector('.settings-provider-form input')?.value,
        modelLocked: document.querySelector('.settings-provider-form input')?.disabled,
        endpointLocked: document.querySelectorAll('.settings-provider-form input')[1]?.disabled,
        localKeyStatus: document.querySelector('.settings-local-key-status strong')?.textContent.trim(),
        localKeySource: document.querySelector('.settings-local-key-status small')?.textContent.trim(),
        manualKeyInputAbsent: !document.querySelector('.settings-key-field input'),
        scriptState: scriptTab?.querySelector('.status-pill')?.textContent.trim(),
        bridgeStatusConfigured: providerStatus.configured,
        paidGenerationEnabled: providerStatus.paidGenerationEnabled,
        bridgeStatusHasSecret: Object.hasOwn(providerStatus, 'key'),
      }
      document.querySelector('.settings-test-button').click()
      await wait(40)
      const deadline = Date.now() + 10000
      while (document.querySelector('.settings-test-button')?.disabled && Date.now() < deadline) await wait(80)
      const tested = {
        state: document.querySelector('.settings-active-state')?.textContent.trim(),
        log: document.querySelector('.settings-activity-list article small')?.textContent.trim(),
      }
      document.querySelector('#settings-tab-voice').click()
      await wait(80)
      const voice = {
        provider: document.querySelector('.settings-provider-form select')?.value,
        state: document.querySelector('.settings-active-state')?.textContent.trim(),
      }
      document.querySelector('#settings-tab-script').click()
      await wait(80)
      return { initial, tested, voice }
    })()`)

    stage = 'assertions'
    assert.equal(result.initial.provider, '阿里云百炼')
    assert.equal(result.initial.model, 'qwen3.7-plus')
    assert.equal(result.initial.modelLocked, true)
    assert.equal(result.initial.endpointLocked, true)
    assert.equal(result.initial.localKeyStatus, '已从 key.txt 安全加载')
    assert.match(result.initial.localKeySource, /key\.txt/u)
    assert.equal(result.initial.manualKeyInputAbsent, true)
    assert.equal(result.initial.scriptState, '本地 Key 已接入')
    assert.equal(result.initial.bridgeStatusConfigured, true)
    assert.equal(result.initial.paidGenerationEnabled, false)
    assert.equal(result.initial.bridgeStatusHasSecret, false)
    assert.equal(result.tested.state, '连接成功')
    assert.match(result.tested.log, /鉴权通过；未创建生成任务/u)
    assert.equal(result.voice.provider, '阿里云百炼')
    assert.equal(result.voice.state, '本地 Key 已接入')

    stage = 'screenshot'
    applicationWindow.setPosition(-10000, -10000)
    applicationWindow.showInactive()
    await new Promise((resolve) => setTimeout(resolve, 280))
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

    stage = 'paid-generation-lock'
    const paidLockResult = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('[aria-label="返回星幕工坊工作台"]').click()
      await wait(100)
      document.querySelector('.xm-project-section header button').click()
      await wait(100)
      const storyInput = document.querySelector('.story-launch textarea')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(storyInput, '集成测试人员输入的原创故事。')
      storyInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(40)
      document.querySelector('.story-launch > .primary-button').click()
      const deadline = Date.now() + 4000
      while (!document.querySelector('.overview-page') && Date.now() < deadline) await wait(80)
      return {
        overviewVisible: Boolean(document.querySelector('.overview-page')),
        paidConfirmationAbsent: !document.querySelector('.bailian-script-confirm-modal'),
        notice: document.querySelector('.toast')?.textContent.trim(),
      }
    })()`)
    assert.equal(paidLockResult.overviewVisible, true)
    assert.equal(paidLockResult.paidConfirmationAbsent, true)
    assert.match(paidLockResult.notice, /付费生成已锁定/u)

    stage = 'one-click-generation-lock'
    const oneClickLockResult = await applicationWindow.webContents.executeJavaScript(`window.manjuDesktop.startOneClickProduction({
      plan: {
        projectLocalId: 'local-integration-lock-test',
        projectName: '隔离锁定测试',
        tasks: [{
          id: 'character-image:1:fnv1a-lock',
          stage: 'character-images',
          kind: 'character-image',
          entityType: 'character',
          entityId: '1',
          label: '锁定测试角色图',
          inputHash: 'fnv1a-lock',
          request: {
            purpose: 'character',
            entityId: '1',
            name: '锁定测试角色图',
            prompt: '锁定测试，不应发送网络请求',
            size: '1536*1024',
            references: [],
          },
        }],
      },
      attestation: {
        confirmed: true,
        confirmedAt: '2026-07-23T00:00:00.000Z',
        modelSignature: 'script:qwen3.7-plus|image:wan2.7-image-pro|voice:qwen3-tts-flash|video:wan2.7-i2v-2026-04-25',
      },
    })`)
    assert.equal(oneClickLockResult.ok, false)
    assert.match(oneClickLockResult.error, /真实生成已被环境锁定/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, result, paidLockResult, oneClickLockResult }))
    clearTimeout(timeout)
    applicationWindow.destroy()
    app.exit(0)
  } catch (error) {
    clearTimeout(timeout)
    console.error(`Bailian integration failed at stage: ${stage}`)
    console.error(error)
    app.exit(1)
  }
})
