import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()
const projectPath = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo', '灯塔回响.manju')
const screenshotPath = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo', 'review', 'app-loaded.png')
const testDataDirectory = path.join(workspaceRoot, 'outputs', `lighthouse-demo-ui-${Date.now()}-${process.pid}`)
const snapshot = JSON.parse(await readFile(projectPath, 'utf8'))

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
      backgroundColor: '#080c11',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    const indexPath = path.join(workspaceRoot, 'dist', 'index.html')
    await window.loadFile(indexPath)
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})`)
    await window.loadFile(indexPath)
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(900)
      const projectName = document.querySelector('.xm-project-card.is-active strong')?.textContent.trim()
      const stageButtons = Array.from(document.querySelectorAll('.xm-stage-item button'))
      const initial = {
        projectName,
        stageCount: stageButtons.length,
        propCardCount: document.querySelectorAll('.xm-asset-grid > button').length,
      }
      stageButtons[3]?.click()
      await wait(220)
      const video = {
        cardCount: document.querySelectorAll('.xm-shot-grid > article').length,
        loadedShotImages: Array.from(document.querySelectorAll('.xm-shot-grid img')).filter((image) => image.complete && image.naturalWidth > 0).length,
        activeStageIndex: Array.from(document.querySelectorAll('.xm-stage-item button')).findIndex((button) => button.classList.contains('is-active')),
      }
      return { initial, video }
    })()`)
    assert.equal(result.initial.projectName, '灯塔回响')
    assert.equal(result.initial.stageCount, 5)
    assert.equal(result.initial.propCardCount, 2)
    assert.equal(result.video.cardCount, 3)
    assert.equal(result.video.loadedShotImages, 3)
    assert.equal(result.video.activeStageIndex, 3)
    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG())
    console.log(JSON.stringify({ passed: true, screenshotPath, ...result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
