import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'
import {
  createProjectRenameCandidate,
  createProjectSnapshot,
  maximumProjectBytes,
  projectFormatVersion,
  readProjectSnapshot,
  validateProjectName,
} from '../src/services/projectModel.js'

const testDataDirectory = path.join(process.cwd(), 'outputs', `project-name-test-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'project-name-edit.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const fallback = {
  projectMeta: { localProjectId: 'local-stable-test-id', name: '旧项目', genre: '悬疑', ratio: '9:16', duration: '60秒' },
  storySeed: '',
  episodes: [{ id: 1, title: '测试剧集' }],
  scenes: [{ id: 1, episodeId: 1, title: '测试场景' }],
  characters: [],
  shots: [],
  lines: [],
  audioTracks: [],
  subtitleCues: [],
  subtitleStyle: {},
}
const legacySnapshot = {
  format: 'manju-project',
  version: 1,
  project: { name: '旧项目', genre: '悬疑', ratio: '9:16', duration: '60秒', episodeCount: 1, synopsis: '' },
  content: { episodes: fallback.episodes, scenes: fallback.scenes, characters: [], shots: [], lines: [], audioTracks: [] },
}
const migratedProject = readProjectSnapshot(legacySnapshot, fallback)
assert.equal(migratedProject.projectMeta.localProjectId, fallback.projectMeta.localProjectId)
const renamedSnapshot = createProjectSnapshot({
  ...migratedProject,
  projectMeta: { ...migratedProject.projectMeta, name: '改名后的旧项目' },
})
assert.equal(renamedSnapshot.project.localProjectId, fallback.projectMeta.localProjectId)
assert.equal(renamedSnapshot.version, projectFormatVersion)
assert.equal(validateProjectName('  雾城回声·终章  ').name, '雾城回声·终章')
assert.equal(validateProjectName('   ').ok, false)
assert.equal(validateProjectName('不可用\u0000名称').ok, false)
assert.equal(validateProjectName('😀'.repeat(80)).ok, true)
assert.equal(validateProjectName('😀'.repeat(81)).ok, false)
const oversizedCandidate = createProjectRenameCandidate({
  ...legacySnapshot,
  content: { ...legacySnapshot.content, padding: 'x'.repeat(maximumProjectBytes) },
}, '新的项目名称')
assert.equal(oversizedCandidate.ok, false)
assert.match(oversizedCandidate.error, /10 MB/u)

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
    await loadTestProject(window, 'overview')
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const setInputValue = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      await wait(350)
      const originalName = document.querySelector('.project-identity h1 > span').textContent.trim()
      const editButton = document.querySelector('.project-name-edit')
      const editLabel = editButton.getAttribute('aria-label')
      editButton.click()
      await wait(80)
      const input = document.querySelector('.project-name-input')
      const focusedOnOpen = document.activeElement === input
      const selectedOnOpen = input.selectionStart === 0 && input.selectionEnd === input.value.length

      setInputValue(input, '')
      document.querySelector('.project-name-action--confirm').click()
      await wait(60)
      const emptyError = document.querySelector('.project-name-helper').textContent.trim()
      const emptyRejected = Boolean(document.querySelector('.project-name-input'))

      setInputValue(input, 'A'.repeat(81))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await wait(60)
      const longError = document.querySelector('.project-name-helper').textContent.trim()

      setInputValue(input, '输入法候选名称')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
      await wait(60)
      const composingEnterIgnored = Boolean(document.querySelector('.project-name-input'))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(60)
      const canceledName = document.querySelector('.project-identity h1 > span').textContent.trim()
      const focusReturnedAfterCancel = document.activeElement?.classList.contains('project-name-edit')
      const activeAfterCancel = [document.activeElement?.tagName || '', document.activeElement?.className || '', document.activeElement?.getAttribute?.('aria-label') || ''].join(':')

      document.querySelector('.project-name-edit').click()
      await wait(60)
      const validInput = document.querySelector('.project-name-input')
      setInputValue(validInput, '  雾城回声·新章  ')
      validInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await wait(950)
      const renamedName = document.querySelector('.project-identity h1 > span').textContent.trim()
      const focusReturnedAfterConfirm = document.activeElement?.classList.contains('project-name-edit')
      const autosave = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      document.querySelector('.brand').click()
      await wait(80)
      const homeName = document.querySelector('.xm-project-card strong').textContent.trim()

      return {
        originalName,
        editLabel,
        focusedOnOpen,
        selectedOnOpen,
        emptyError,
        emptyRejected,
        longError,
        composingEnterIgnored,
        canceledName,
        focusReturnedAfterCancel,
        activeAfterCancel,
        renamedName,
        focusReturnedAfterConfirm,
        autosaveName: autosave?.project?.name,
        autosaveLocalProjectId: autosave?.project?.localProjectId,
        autosaveVersion: autosave?.version,
        homeName,
      }
    })()`)

    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'overview' } })
    await new Promise((resolve) => setTimeout(resolve, 250))
    await window.webContents.executeJavaScript(`document.querySelector('.project-name-edit').click()`)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())

    assert.match(result.editLabel, /编辑项目名称/u)
    assert.equal(result.focusedOnOpen, true)
    assert.equal(result.selectedOnOpen, true)
    assert.match(result.emptyError, /不能为空/u)
    assert.equal(result.emptyRejected, true)
    assert.match(result.longError, /最多 80 个字符/u)
    assert.equal(result.composingEnterIgnored, true)
    assert.equal(result.canceledName, result.originalName)
    assert.equal(result.focusReturnedAfterCancel, true)
    assert.equal(result.renamedName, '雾城回声·新章')
    assert.equal(result.focusReturnedAfterConfirm, true)
    assert.equal(result.autosaveName, '雾城回声·新章')
    assert.match(result.autosaveLocalProjectId, /^local-/u)
    assert.equal(result.autosaveVersion, projectFormatVersion)
    assert.equal(result.homeName, '雾城回声·新章')

    console.log(JSON.stringify({ passed: true, screenshotPath, result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
