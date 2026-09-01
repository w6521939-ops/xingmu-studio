import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const userDataDirectory = path.join(process.cwd(), 'outputs', `studio-six-stage-user-data-${Date.now()}-${process.pid}`)
const screenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'studio-six-stage-editable.png')
await mkdir(userDataDirectory, { recursive: true })
await mkdir(path.dirname(screenshotPath), { recursive: true })
app.setPath('userData', userDataDirectory)
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      backgroundColor: '#07111b',
      webPreferences: {
        preload: path.join(process.cwd(), 'scripts', 'bailian-script-test-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'studio' } })

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const stageButton = (label) => Array.from(document.querySelectorAll('.xm-stage-item > button')).find((button) => button.textContent.includes(label))
      const assetTab = (label) => Array.from(document.querySelectorAll('.xm-asset-tabs > button')).find((button) => button.textContent.includes(label))
      const setValue = (element, value) => {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
        element.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const readStages = () => Array.from(document.querySelectorAll('.xm-stage-item > button')).map((button) => button.textContent.replace(/\\s+/g, ' ').trim())

      await wait(360)
      const initialStages = readStages()
      const storyInput = document.querySelector('textarea[aria-label="故事需求"]')
      setValue(storyInput, '暴雨夜，女孩登上废弃灯塔寻找失踪七年的父亲，却在旧录音机里听见自己的声音。')
      await wait(60)
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('生成完整剧本')).click()
      await wait(280)
      const confirmationVisible = Boolean(document.querySelector('.bailian-script-confirm-modal'))
      document.querySelector('.bailian-script-confirm-submit').click()
      await wait(260)

      stageButton('剧本确认').click()
      await wait(100)
      const sceneTitle = document.querySelector('input[aria-label="场景标题"]')
      const lineText = document.querySelector('textarea[aria-label="台词内容"]')
      setValue(sceneTitle, '用户改写的灯塔外景')
      setValue(lineText, '这是用户改写后的台词。')
      await wait(100)

      stageButton('角色与素材').click()
      await wait(100)
      assetTab('角色').click()
      await wait(80)
      const characterName = document.querySelector('input[aria-label="素材角色名称"]')
      const appearance = document.querySelector('textarea[aria-label="素材外观锁定"]')
      setValue(characterName, '林晚·用户版')
      setValue(appearance, '黑色短发、深蓝雨衣、银色吊坠，所有镜头保持一致。')
      await wait(100)

      stageButton('分镜制作').click()
      await wait(100)
      const shotAction = document.querySelector('textarea[aria-label="分镜动作"]')
      setValue(shotAction, '林晚推开锈蚀铁门，手电光扫过旋转楼梯。')
      await wait(100)

      stageButton('剧本确认').click()
      await wait(80)
      const persistedScript = {
        sceneTitle: document.querySelector('input[aria-label="场景标题"]')?.value,
        speaker: document.querySelector('input[aria-label="台词说话人"]')?.value,
        lineText: document.querySelector('textarea[aria-label="台词内容"]')?.value,
      }

      stageButton('角色与素材').click()
      await wait(80)
      assetTab('角色').click()
      await wait(80)
      const persistedAppearance = document.querySelector('textarea[aria-label="素材外观锁定"]')?.value

      stageButton('分镜制作').click()
      await wait(80)
      const persistedShotAction = document.querySelector('textarea[aria-label="分镜动作"]')?.value

      stageButton('配音与视频').click()
      await wait(80)
      const production = {
        heading: document.querySelector('[data-testid="studio-step-production"] h1')?.textContent.trim(),
        clipPhase: document.querySelector('.xm-clip-phase')?.textContent.replace(/\\s+/g, ' ').trim(),
        cardCount: document.querySelectorAll('[data-testid="studio-step-production"] .xm-shot-card').length,
      }

      stageButton('成片交付').click()
      await wait(80)
      const final = {
        heading: document.querySelector('[data-testid="studio-step-final"] h1')?.textContent.trim(),
        assembly: document.querySelector('.xm-episode-assembly')?.textContent.replace(/\\s+/g, ' ').trim(),
      }

      return {
        initialStages,
        confirmationVisible,
        metrics: window.manjuDesktop.getTestMetrics(),
        persistedScript,
        persistedAppearance,
        persistedShotAction,
        production,
        final,
      }
    })()`)

    window.setPosition(-10000, -10000)
    window.showInactive()
    await new Promise((resolve) => setTimeout(resolve, 180))
    const screenshot = await window.webContents.capturePage()
    await writeFile(screenshotPath, screenshot.toPNG())
    window.hide()

    assert.equal(result.initialStages.length, 6)
    assert.deepEqual(result.metrics, { dryRuns: 1, generations: 1 })
    assert.equal(result.confirmationVisible, true)
    assert.equal(result.persistedScript.sceneTitle, '用户改写的灯塔外景')
    assert.equal(result.persistedScript.speaker, '林晚·用户版')
    assert.equal(result.persistedScript.lineText, '这是用户改写后的台词。')
    assert.equal(result.persistedAppearance, '黑色短发、深蓝雨衣、银色吊坠，所有镜头保持一致。')
    assert.equal(result.persistedShotAction, '林晚推开锈蚀铁门，手电光扫过旋转楼梯。')
    assert.equal(result.production.heading, '配音与镜头视频')
    assert.match(result.production.clipPhase, /镜头片段区/u)
    assert.ok(result.production.cardCount > 0)
    assert.equal(result.final.heading, '整集成片与交付')
    assert.match(result.final.assembly, /一个剧集输出一个最终成片/u)

    console.log(JSON.stringify({ passed: true, screenshotPath, result }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
