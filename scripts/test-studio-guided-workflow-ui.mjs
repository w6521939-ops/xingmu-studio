import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()
const demoDirectory = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo')
const projectFileName = (await readdir(demoDirectory)).find((name) => name.endsWith('.manju'))
assert.ok(projectFileName)

const testDataDirectory = path.join(workspaceRoot, 'outputs', `studio-guided-workflow-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(workspaceRoot, 'outputs', 'runtime', 'studio-guided-workflow.png')
await mkdir(testDataDirectory, { recursive: true })
process.env.MANJU_TEST_SNAPSHOT_PATH = path.join(demoDirectory, projectFileName)
process.env.MANJU_TEST_PROVIDER_LOCKED = '1'
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      backgroundColor: '#080d13',
      webPreferences: {
        preload: path.join(workspaceRoot, 'scripts', 'fixtures', 'studio-production-tour-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    await window.loadFile(path.join(workspaceRoot, 'dist', 'index.html'), { query: { page: 'studio' } })
    await new Promise((resolve) => setTimeout(resolve, 700))

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const stages = Array.from(document.querySelectorAll('.xm-stage-item button'))
      const labels = stages.map((button) => button.textContent.replace(/\\s+/gu, ' ').trim())
      const visibleSteps = []
      let clipPhaseVisible = false
      let episodeAssemblyVisible = false
      for (const button of stages) {
        button.click()
        await wait(45)
        visibleSteps.push(Boolean(document.querySelector('[data-testid^="studio-step-"]')))
        if (button.textContent.includes('配音与视频')) {
          clipPhaseVisible = document.querySelector('.xm-clip-phase')?.textContent.includes('3 段已就绪') || false
        }
        if (button.textContent.includes('成片交付')) {
          episodeAssemblyVisible = document.querySelector('.xm-episode-assembly')?.textContent.includes('一个剧集输出一个最终成片') || false
        }
      }
      stages[0]?.click()
      await wait(50)
      const storyInput = document.querySelector('textarea[aria-label="故事需求"]')
      const footer = document.querySelector('[data-testid="studio-workflow-footer"]')
      const nextButton = Array.from(footer?.querySelectorAll('button') || []).find((button) => button.textContent.includes('保存并进入'))
      nextButton?.click()
      await wait(50)
      return {
        labels,
        visibleSteps,
        storyInputVisible: Boolean(storyInput),
        footerVisible: Boolean(footer),
        advancedAfterNext: Boolean(document.querySelector('[data-testid="studio-step-script"]')),
        oneClickVisible: Boolean(document.querySelector('.xm-one-click')),
        clipPhaseVisible,
        episodeAssemblyVisible,
      }
    })()`)

    assert.equal(result.labels.length, 6)
    assert.deepEqual(result.labels.map((label) => label.replace(/^[✓1-6]/u, '')), ['故事构思', '剧本确认', '角色与素材', '分镜制作', '配音与视频', '成片交付'])
    assert.ok(result.visibleSteps.every(Boolean))
    assert.equal(result.storyInputVisible, true)
    assert.equal(result.footerVisible, true)
    assert.equal(result.advancedAfterNext, true)
    assert.equal(result.oneClickVisible, true)
    assert.equal(result.clipPhaseVisible, true)
    assert.equal(result.episodeAssemblyVisible, true)
    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG())
    console.log(JSON.stringify({ passed: true, ...result, screenshotPath }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
