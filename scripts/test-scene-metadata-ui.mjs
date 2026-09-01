import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `scene-metadata-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'scene-metadata-functional.png')
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
    await loadTestProject(window, 'script')

    const initialResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(400)
      const editButton = document.querySelector('.scene-main-characters > header button')
      const fakeSaveRemoved = !Array.from(document.querySelectorAll('.scene-inspector button')).some((button) => button.textContent.trim() === '保存场景')
      const before = {
        weather: document.querySelector('[data-scene-field="weather"]').value,
        duration: document.querySelector('.scene-duration-card strong').textContent.trim(),
        durationSource: document.querySelector('.scene-duration-card em').textContent.trim(),
        readiness: document.querySelector('.scene-readiness > header b').textContent.trim(),
        completedChecks: document.querySelectorAll('.scene-readiness li.is-complete').length,
        characterSummary: document.querySelector('.scene-character-stack small').textContent.trim(),
        contextAction: document.querySelector('.scene-storyboard-action').textContent.trim(),
        autosaveStatus: document.querySelector('.scene-autosave-status').textContent.trim(),
        fakeSaveRemoved,
      }
      editButton.click()
      await wait(100)
      const dialog = document.querySelector('.scene-character-picker-dialog')
      const search = document.querySelector('.scene-character-search input')
      return {
        before,
        role: dialog?.getAttribute('role'),
        focusedOnOpen: document.activeElement === search,
        initialSelected: document.querySelectorAll('.scene-character-option input:checked').length,
        initialOptions: document.querySelectorAll('.scene-character-option').length,
        inferredBadges: document.querySelectorAll('.scene-character-option > em').length,
      }
    })()`)

    await new Promise((resolve) => setTimeout(resolve, 250))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    const interactionResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const findCharacter = (name) => Array.from(document.querySelectorAll('.scene-character-option')).find((row) => row.querySelector('strong').textContent.trim() === name)

      const search = document.querySelector('.scene-character-search input')
      setInputValue(search, '林听雨')
      await wait(60)
      const filteredOptions = document.querySelectorAll('.scene-character-option').length
      findCharacter('林听雨').click()
      document.querySelector('.scene-character-picker-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(80)
      const canceled = !document.querySelector('.scene-character-picker-dialog')
      const cancelFocusReturned = document.activeElement === document.querySelector('.scene-main-characters > header button')
      const selectionAfterCancel = document.querySelector('.scene-character-stack small').textContent.trim()

      document.querySelector('.scene-main-characters > header button').click()
      await wait(80)
      const dialog = document.querySelector('.scene-character-picker-dialog')
      dialog.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }))
      await wait(50)
      const composingShortcutIgnored = Boolean(document.querySelector('.scene-character-picker-dialog'))
      dialog.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
      findCharacter('苏清浅').click()
      findCharacter('林听雨').click()
      document.querySelector('.scene-character-apply').click()
      await wait(120)
      const applied = !document.querySelector('.scene-character-picker-dialog')
      const applyFocusReturned = document.activeElement === document.querySelector('.scene-main-characters > header button')
      const characterSummary = document.querySelector('.scene-character-stack small').textContent.trim()
      const characterTitles = Array.from(document.querySelectorAll('.scene-character-stack .avatar')).map((avatar) => avatar.title)

      const weatherInput = document.querySelector('[data-scene-field="weather"]')
      setInputValue(weatherInput, '赛博酸雨')
      await wait(70)
      const weatherSummary = Array.from(document.querySelectorAll('.scene-meta span')).find((node) => node.textContent.includes('天气')).textContent.trim()
      setInputValue(weatherInput, '🌧️'.repeat(41))
      await wait(70)
      const overlongRejected = weatherInput.value === '赛博酸雨'
      const overlongError = document.querySelector('.scene-environment-fields label.has-error small')?.textContent.trim() || ''
      setInputValue(weatherInput, '')
      await wait(70)
      const readinessWithoutWeather = document.querySelector('.scene-readiness > header b').textContent.trim()
      const missingEnvironment = Array.from(document.querySelectorAll('.scene-readiness li.is-missing')).some((item) => item.textContent.includes('补充地点、时间或天气'))
      setInputValue(weatherInput, '赛博酸雨')
      await wait(900)
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      const savedScene = autosave.content.scenes.find((scene) => scene.id === 3)
      const savedShotIds = autosave.content.shots.filter((shot) => shot.episodeId === 2 && shot.sceneId === 3).map((shot) => shot.id)

      const sceneFourButton = Array.from(document.querySelectorAll('.context-list > button')).find((button) => button.textContent.includes('场景 04'))
      sceneFourButton.click()
      await wait(80)
      const sceneFourWeather = document.querySelector('[data-scene-field="weather"]').value
      const sceneFourCharacters = document.querySelector('.scene-character-stack small').textContent.trim()
      const sceneThreeButton = Array.from(document.querySelectorAll('.context-list > button')).find((button) => button.textContent.includes('场景 03'))
      sceneThreeButton.click()
      await wait(80)
      const restoredWeather = document.querySelector('[data-scene-field="weather"]').value
      const restoredCharacterTitles = Array.from(document.querySelectorAll('.scene-character-stack .avatar')).map((avatar) => avatar.title)

      document.querySelector('.scene-storyboard-action').click()
      await wait(120)
      return {
        filteredOptions,
        canceled,
        cancelFocusReturned,
        selectionAfterCancel,
        composingShortcutIgnored,
        applied,
        applyFocusReturned,
        characterSummary,
        characterTitles,
        weatherSummary,
        overlongRejected,
        overlongError,
        readinessWithoutWeather,
        missingEnvironment,
        savedWeather: savedScene.weather,
        savedMainCharacterIds: savedScene.mainCharacterIds,
        savedShotIds,
        sceneFourWeather,
        sceneFourCharacters,
        restoredWeather,
        restoredCharacterTitles,
        navigatedToStoryboard: Boolean(document.querySelector('.storyboard-page')),
        shotCardCount: document.querySelectorAll('.shot-card').length,
        activeShotNumber: document.querySelector('.shot-card.is-active .shot-visual b')?.textContent.trim() || '',
      }
    })()`)

    assert.equal(initialResult.before.weather, '小雨')
    assert.equal(initialResult.before.duration, '23.1 秒')
    assert.equal(initialResult.before.durationSource, '按 6 个分镜')
    assert.equal(initialResult.before.readiness, '100%')
    assert.equal(initialResult.before.completedChecks, 5)
    assert.equal(initialResult.before.characterSummary, '已设置 2 个角色')
    assert.match(initialResult.before.contextAction, /查看 6 个分镜/u)
    assert.equal(initialResult.before.autosaveStatus, '自动保存已开启')
    assert.equal(initialResult.before.fakeSaveRemoved, true)
    assert.equal(initialResult.role, 'dialog')
    assert.equal(initialResult.focusedOnOpen, true)
    assert.equal(initialResult.initialSelected, 2)
    assert.equal(initialResult.initialOptions, 6)
    assert.equal(initialResult.inferredBadges, 4)
    assert.equal(interactionResult.filteredOptions, 1)
    assert.equal(interactionResult.canceled, true)
    assert.equal(interactionResult.cancelFocusReturned, true)
    assert.equal(interactionResult.selectionAfterCancel, '已设置 2 个角色')
    assert.equal(interactionResult.composingShortcutIgnored, true)
    assert.equal(interactionResult.applied, true)
    assert.equal(interactionResult.applyFocusReturned, true)
    assert.equal(interactionResult.characterSummary, '已设置 2 个角色')
    assert.deepEqual(interactionResult.characterTitles, ['沈砚', '林听雨'])
    assert.equal(interactionResult.weatherSummary, '天气：赛博酸雨')
    assert.equal(interactionResult.overlongRejected, true)
    assert.match(interactionResult.overlongError, /最多输入 40 个字符/u)
    assert.equal(interactionResult.readinessWithoutWeather, '80%')
    assert.equal(interactionResult.missingEnvironment, true)
    assert.equal(interactionResult.savedWeather, '赛博酸雨')
    assert.deepEqual(interactionResult.savedMainCharacterIds, [1, 4])
    assert.deepEqual(interactionResult.savedShotIds, [1, 2, 3, 4, 5, 6])
    assert.equal(interactionResult.sceneFourWeather, '小雨')
    assert.equal(interactionResult.sceneFourCharacters, '已设置 2 个角色')
    assert.equal(interactionResult.restoredWeather, '赛博酸雨')
    assert.deepEqual(interactionResult.restoredCharacterTitles, ['沈砚', '林听雨'])
    assert.equal(interactionResult.navigatedToStoryboard, true)
    assert.equal(interactionResult.shotCardCount, 6)
    assert.equal(interactionResult.activeShotNumber, '01')

    console.log(JSON.stringify({ passed: true, screenshotPath, initialResult, interactionResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
