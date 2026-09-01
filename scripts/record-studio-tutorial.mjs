import { spawn } from 'node:child_process'
import { app, BrowserWindow, net, protocol } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveBailianImageAsset } from '../electron/bailianProviderService.js'

const workspaceRoot = process.cwd()

protocol.registerSchemesAsPrivileged([{
  scheme: 'manju-media',
  privileges: {
    standard: true,
    secure: true,
    stream: true,
    supportFetchAPI: true,
  },
}])
const tutorialRoot = path.join(workspaceRoot, 'outputs', 'tutorial', '星幕工坊-全流程教学')
const frameDirectory = path.join(tutorialRoot, 'frames')
const snapshotPath = path.join(tutorialRoot, 'tutorial-snapshot.json')
const concatPath = path.join(tutorialRoot, 'frames.txt')
const videoPath = path.join(tutorialRoot, '星幕工坊-全流程教学视频.mp4')
const projectPath = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo', '灯塔回响.manju')
const demoVideoPath = path.join(workspaceRoot, 'outputs', 'interview-demo', 'lighthouse-echo', '灯塔回响-15秒面试演示.mp4')
const zeroCostSettings = {
  version: 1,
  confirmed: true,
  confirmedAt: '2026-08-06T00:00:00.000Z',
  modelSignature: 'script:qwen3.7-plus|image:wan2.7-image-pro|voice:qwen3-tts-flash|video:wan2.7-i2v-2026-04-25',
}
const tutorialSteps = [
  ['第 1 步｜检查项目与视觉资产', '确认角色、道具、场景和镜头已经进入统一资产库。'],
  ['第 2 步｜打开成片准备中心', '点击右上角“一键成片”，此时不会调用模型。'],
  ['第 3 步｜确认参数与免费保护', '检查画幅、模型、预计调用次数和自动保存位置。'],
  ['第 4 步｜确认后进入生成队列', '只有点击“确认并开始生成”后，系统才建立生产任务。'],
  ['第 5 步｜查看实时生成进度', '图片、配音、视频和本地合成按单并发安全执行。'],
  ['第 6 步｜暂停与恢复任务', '随时暂停，已完成素材立即保存，重新打开应用仍可继续。'],
  ['第 7 步｜继续处理剩余任务', '继续后只处理未完成或失败任务，不重复覆盖已有结果。'],
  ['第 8 步｜预览并定位成片', '完成后进入成片结果页，可预览视频、打开文件夹或生成新版本。'],
]

const runProcess = (executable, args) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { cwd: workspaceRoot, windowsHide: true })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-4000) || `进程退出：${code}`)))
})
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const injectCaption = async (window, title, description) => window.webContents.executeJavaScript(`(() => {
  document.querySelector('[data-tutorial-caption]')?.remove()
  const overlay = document.createElement('section')
  overlay.dataset.tutorialCaption = 'true'
  overlay.style.cssText = 'position:fixed;left:50%;bottom:28px;z-index:99999;display:grid;min-width:680px;max-width:900px;transform:translateX(-50%);gap:6px;padding:15px 22px;border:1px solid rgba(94,172,255,.5);border-radius:12px;color:#eef7ff;background:rgba(5,12,19,.94);box-shadow:0 16px 46px rgba(0,0,0,.42);font-family:"Microsoft YaHei UI",sans-serif;text-align:center;pointer-events:none;'
  const heading = document.createElement('strong')
  heading.textContent = ${JSON.stringify(title)}
  heading.style.cssText = 'font-size:20px;color:#65b6ff;'
  const copy = document.createElement('span')
  copy.textContent = ${JSON.stringify(description)}
  copy.style.cssText = 'font-size:13px;color:#c6d4df;'
  overlay.append(heading, copy)
  document.body.append(overlay)
})()`)
const captureStep = async (window, index) => {
  const [title, description] = tutorialSteps[index]
  await injectCaption(window, title, description)
  await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  await wait(260)
  await window.webContents.capturePage()
  await wait(120)
  const filePath = path.join(frameDirectory, `step-${String(index + 1).padStart(2, '0')}.png`)
  await writeFile(filePath, (await window.webContents.capturePage()).toPNG())
  return filePath
}

await mkdir(frameDirectory, { recursive: true })
const snapshot = JSON.parse(await readFile(projectPath, 'utf8'))
snapshot.content.videoAssets = []
snapshot.content.shots = (snapshot.content.shots || []).map((shot) => ({ ...shot, videoAssetId: '' }))
snapshot.content.lines = (snapshot.content.lines || []).map((line) => ({ ...line, audio: '', audioAssetId: '', audioStatus: '未生成', status: '未配音' }))
await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8')
process.env.MANJU_TEST_SNAPSHOT_PATH = snapshotPath
process.env.MANJU_TOUR_OUTPUT_PATH = demoVideoPath
app.setPath('userData', path.join(tutorialRoot, 'user-data'))
app.disableHardwareAcceleration()

app.on('ready', async () => {
  try {
    protocol.handle('manju-media', async (request) => {
      try {
        const mediaUrl = new URL(request.url)
        const pathParts = mediaUrl.pathname.split('/').filter(Boolean)
        if (mediaUrl.hostname !== 'generated-image' || pathParts.length !== 1) {
          return new Response('Not found', { status: 404 })
        }
        const asset = await resolveBailianImageAsset({ workspaceRoot, assetId: pathParts[0] })
        return net.fetch(pathToFileURL(asset.filePath).href)
      } catch {
        return new Response('Not found', { status: 404 })
      }
    })
    const window = new BrowserWindow({
      width: 1600,
      height: 900,
      show: false,
      backgroundColor: '#080d13',
      webPreferences: {
        preload: path.join(workspaceRoot, 'scripts', 'fixtures', 'studio-production-tour-preload.cjs'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    const indexPath = path.join(workspaceRoot, 'dist', 'index.html')
    await window.loadFile(indexPath)
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.zero-cost-automation.v1', ${JSON.stringify(JSON.stringify(zeroCostSettings))})`)
    await window.loadFile(indexPath, { query: { page: 'studio' } })
    await wait(850)
    const frames = []

    frames.push(await captureStep(window, 0))
    await window.webContents.executeJavaScript(`document.querySelector('.xm-one-click').click()`)
    await wait(180)
    frames.push(await captureStep(window, 1))
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.xm-aspect-switch button')).find((button) => button.textContent.includes('16:9'))?.click()`)
    await wait(120)
    frames.push(await captureStep(window, 2))
    await window.webContents.executeJavaScript(`document.querySelector('.xm-primary-action').click()`)
    await wait(220)
    frames.push(await captureStep(window, 3))
    await window.webContents.executeJavaScript(`window.manjuTour.setPhase('running')`)
    await wait(200)
    frames.push(await captureStep(window, 4))
    await window.webContents.executeJavaScript(`window.manjuTour.setPhase('paused')`)
    await wait(180)
    frames.push(await captureStep(window, 5))
    await window.webContents.executeJavaScript(`window.manjuTour.setPhase('running')`)
    await wait(180)
    frames.push(await captureStep(window, 6))
    await window.webContents.executeJavaScript(`window.manjuTour.setPhase('completed')`)
    await wait(620)
    frames.push(await captureStep(window, 7))

    const frameDuration = 3.4
    const ffmpegEntries = frames.flatMap((filePath) => [
      `file '${filePath.replace(/\\/gu, '/').replace(/'/gu, "'\\''")}'`,
      `duration ${frameDuration}`,
    ])
    ffmpegEntries.push(`file '${frames.at(-1).replace(/\\/gu, '/').replace(/'/gu, "'\\''")}'`)
    await writeFile(concatPath, `${ffmpegEntries.join('\n')}\n`, 'utf8')
    const totalDuration = (frames.length * frameDuration).toFixed(1)
    await runProcess(ffmpegPath, [
      '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-t', totalDuration,
      '-vf', 'scale=1600:900:flags=lanczos,fps=30,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      videoPath,
    ])
    const fileInfo = await stat(videoPath)
    if (!fileInfo.isFile() || fileInfo.size < 100_000) throw new Error('教学视频输出无效')
    console.log(JSON.stringify({ passed: true, videoPath, frameDirectory, steps: frames.length, durationSeconds: Number(totalDuration), bytes: fileInfo.size, realGenerationCalls: 0 }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
