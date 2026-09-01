import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `user-data-only-test-${Date.now()}-${process.pid}`)
await mkdir(testDataDirectory, { recursive: true })
const screenshotDirectory = path.join(process.cwd(), 'outputs', 'runtime')
await mkdir(screenshotDirectory, { recursive: true })
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
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })

    const initial = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(420)
      const storyInput = document.querySelector('.story-launch textarea')
      const createButton = document.querySelector('.story-launch > .primary-button')
      return {
        storyValue: storyInput.value,
        createDisabled: createButton.disabled,
        recentCards: document.querySelectorAll('.project-card').length,
        templateCards: document.querySelectorAll('.template-strip > button').length,
        emptyRecentVisible: Boolean(document.querySelector('.home-empty-data')),
        emptyCurrentVisible: Boolean(document.querySelector('.continue-empty')),
        localBoundary: document.querySelector('.local-mode').textContent.trim(),
        bodyText: document.body.textContent,
        autosave: localStorage.getItem('manju-creation.autosave.v1'),
      }
    })()`)

    assert.equal(initial.storyValue, '')
    assert.equal(initial.createDisabled, true)
    assert.equal(initial.recentCards, 0)
    assert.equal(initial.templateCards, 0)
    assert.equal(initial.emptyRecentVisible, true)
    assert.equal(initial.emptyCurrentVisible, true)
    assert.match(initial.localBoundary, /真实用户数据/u)
    assert.equal(initial.autosave, null)
    for (const forbidden of ['长夜行歌', '星环纪元', '心动轨迹', '山海少年行', '雾城回声', '沈砚', '林听雨']) {
      assert.equal(initial.bodyText.includes(forbidden), false)
    }
    const homeScreenshotPath = path.join(screenshotDirectory, 'real-user-data-home.png')
    await writeFile(homeScreenshotPath, (await window.webContents.capturePage()).toPNG())

    const created = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const storyInput = document.querySelector('.story-launch textarea')
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(storyInput, '用户原创故事：一名修复师在海边收到来自未来的录音。')
      storyInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(50)
      const createButton = document.querySelector('.story-launch > .primary-button')
      const enabledAfterInput = !createButton.disabled
      createButton.click()
      await wait(980)
      const overview = {
        visible: Boolean(document.querySelector('.overview-page')),
        projectName: document.querySelector('.project-identity h1 > span')?.textContent.trim(),
        episodeCount: document.querySelectorAll('.episode-row').length,
      }
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '角色').click()
      await wait(80)
      const characterEmpty = Boolean(document.querySelector('.character-empty-state'))
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '分镜').click()
      await wait(80)
      const storyboard = {
        shotCount: document.querySelectorAll('.shot-card').length,
        emptyVisible: Boolean(document.querySelector('.storyboard-main .empty-data')),
        generateDisabled: document.querySelector('.generate-current-shot-button')?.disabled,
        mockTextVisible: /模拟生成|演示配音|演示完成/u.test(document.body.textContent),
      }
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '配音').click()
      await wait(80)
      const voiceNeedsCharacter = document.querySelector('.empty-workspace-card h1')?.textContent.trim()
      return { enabledAfterInput, overview, autosave, characterEmpty, storyboard, voiceNeedsCharacter }
    })()`)

    assert.equal(created.enabledAfterInput, true)
    assert.equal(created.overview.visible, true)
    assert.equal(created.overview.projectName, '用户原创故事：一名修复师在海边收到来')
    assert.equal(created.overview.episodeCount, 1)
    assert.equal(created.autosave.project.synopsis, '用户原创故事：一名修复师在海边收到来自未来的录音。')
    assert.equal(created.autosave.content.episodes.length, 1)
    assert.equal(created.autosave.content.scenes.length, 1)
    assert.equal(created.autosave.content.characters.length, 0)
    assert.equal(created.autosave.content.shots.length, 0)
    assert.equal(created.autosave.content.lines.length, 0)
    assert.equal(created.characterEmpty, true)
    assert.equal(created.storyboard.shotCount, 0)
    assert.equal(created.storyboard.emptyVisible, true)
    assert.equal(created.storyboard.generateDisabled, true)
    assert.equal(created.storyboard.mockTextVisible, false)
    assert.equal(created.voiceNeedsCharacter, '还没有可配音的角色')

    console.log(JSON.stringify({ passed: true, homeScreenshotPath, initial: { ...initial, bodyText: undefined }, created }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
