import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `settings-ui-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'settings-v22.png')

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
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'))

    const initialResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitFor = async (selector, timeout = 3000) => {
        const deadline = Date.now() + timeout
        while (!document.querySelector(selector) && Date.now() < deadline) await wait(50)
        return document.querySelector(selector)
      }
      const settingsButton = await waitFor('[aria-label="打开设置"]')
      if (!settingsButton) throw new Error('设置入口未渲染')
      settingsButton.click()
      await wait(220)
      const settingsRoot = document.querySelector('.settings-page--v22')
      const filteredLayers = Array.from(settingsRoot.querySelectorAll('*')).filter((element) => {
        const style = getComputedStyle(element)
        const backdrop = style.getPropertyValue('backdrop-filter')
        const webkitBackdrop = style.getPropertyValue('-webkit-backdrop-filter')
        return (backdrop && backdrop !== 'none') || (webkitBackdrop && webkitBackdrop !== 'none')
      })
      return {
        settingsVersion: settingsRoot.dataset.settingsVersion,
        tileCount: document.querySelectorAll('.settings-provider-tile').length,
        selectedTab: document.querySelector('.settings-provider-tile[aria-selected="true"]')?.textContent.trim(),
        formCount: document.querySelectorAll('.settings-provider-form').length,
        inputCount: document.querySelectorAll('.settings-provider-form input').length,
        selectCount: document.querySelectorAll('.settings-provider-form select').length,
        legacyNavigationCount: document.querySelectorAll('.settings-nav, .provider-stack, .connection-log').length,
        innerFilteredLayerCount: filteredLayers.length,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        emptyLog: document.querySelector('.settings-activity-empty strong')?.textContent.trim(),
      }
    })()`)

    const interactionResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setInput = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const activeTab = document.querySelector('.settings-provider-tile[aria-selected="true"]')
      activeTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await wait(80)
      const selectedAfterKeyboard = document.querySelector('.settings-provider-tile[aria-selected="true"]')
      const inputs = document.querySelectorAll('.settings-provider-form input')
      setInput(inputs[0], 'mock-v22')
      setInput(inputs[2], 'session-only-secret')
      await wait(80)
      const dirtyState = document.querySelector('.settings-active-state').textContent.trim()
      const keyInput = document.querySelector('.settings-key-field input')
      const initialKeyType = keyInput.type
      document.querySelector('.settings-key-toggle').click()
      await wait(40)
      const revealedKeyType = document.querySelector('.settings-key-field input').type
      document.querySelector('.settings-save-button').click()
      await wait(100)
      const storedSettings = localStorage.getItem('manju-creation.provider-settings.v1')
      const savedState = document.querySelector('.settings-active-state').textContent.trim()
      const savedLogCount = document.querySelectorAll('.settings-activity-list article').length
      document.querySelector('.settings-test-button').click()
      await wait(30)
      const testing = {
        disabled: document.querySelector('.settings-test-button').disabled,
        label: document.querySelector('.settings-test-button').textContent.trim(),
        state: document.querySelector('.settings-active-state').textContent.trim(),
      }
      await wait(560)
      return {
        selectedAfterKeyboard: selectedAfterKeyboard.textContent.trim(),
        selectedTabHasFocus: document.activeElement === selectedAfterKeyboard,
        dirtyState,
        initialKeyType,
        revealedKeyType,
        storedSettings,
        storedSecret: storedSettings.includes('session-only-secret'),
        storedApiKeyField: storedSettings.includes('apiKey'),
        savedState,
        savedLogCount,
        testing,
        testedState: document.querySelector('.settings-active-state').textContent.trim(),
        testedLogCount: document.querySelectorAll('.settings-activity-list article').length,
        latestLog: document.querySelector('.settings-activity-list article small').textContent.trim(),
      }
    })()`)

    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const exitResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('[aria-label="返回星幕工坊工作台"]').click()
      await wait(120)
      const exited = {
        settingsRemoved: !document.querySelector('.settings-page--v22'),
        studioVisible: Boolean(document.querySelector('.xm-studio-shell')),
        settingsButtonSelected: document.querySelector('[aria-label="打开设置"]').classList.contains('is-active'),
      }
      document.querySelector('[aria-label="打开设置"]').click()
      await wait(120)
      return {
        ...exited,
        restoredSelectedTab: document.querySelector('.settings-provider-tile[aria-selected="true"]')?.textContent.trim(),
      }
    })()`)

    assert.equal(initialResult.settingsVersion, 'v22')
    assert.equal(initialResult.tileCount, 4)
    assert.match(initialResult.selectedTab, /剧本生成/u)
    assert.equal(initialResult.formCount, 1)
    assert.equal(initialResult.inputCount, 3)
    assert.equal(initialResult.selectCount, 1)
    assert.equal(initialResult.legacyNavigationCount, 0)
    assert.equal(initialResult.innerFilteredLayerCount <= 1, true)
    assert.equal(initialResult.horizontalOverflow, false)
    assert.equal(initialResult.emptyLog, '还没有测试或保存记录')

    assert.match(interactionResult.selectedAfterKeyboard, /图像生成/u)
    assert.equal(interactionResult.selectedTabHasFocus, true)
    assert.equal(interactionResult.dirtyState, '有修改')
    assert.equal(interactionResult.initialKeyType, 'password')
    assert.equal(interactionResult.revealedKeyType, 'text')
    assert.equal(interactionResult.storedSecret, false)
    assert.equal(interactionResult.storedApiKeyField, false)
    assert.equal(interactionResult.savedState, '演示模式')
    assert.equal(interactionResult.savedLogCount, 1)
    assert.deepEqual(interactionResult.testing, { disabled: true, label: '测试中…', state: '测试中' })
    assert.equal(interactionResult.testedState, '演示模式')
    assert.equal(interactionResult.testedLogCount, 2)
    assert.equal(interactionResult.latestLog, '演示测试完成，未发起真实外部请求')

    assert.equal(exitResult.settingsRemoved, true)
    assert.equal(exitResult.studioVisible, true)
    assert.equal(exitResult.settingsButtonSelected, false)
    assert.match(exitResult.restoredSelectedTab, /图像生成/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, initialResult, interactionResult, exitResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
