import { spawn } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { appendExportHistory } from '../electron/exportHistoryRepository.js'
import { createOneClickProductionController, requiredOneClickModelSignature } from '../electron/oneClickProductionService.js'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from '../electron/shotVideoAssetService.js'
import { exportTimelineVideo, getFfmpegExecutablePath } from '../electron/videoExportService.js'
import { resolveManagedVoiceAssetPath } from '../electron/voiceAssetService.js'
import { createOneClickProductionPlan, oneClickPlanRequiresProvider } from '../src/services/oneClickProductionPlanService.js'

const workspaceRoot = process.cwd()
const appDataRoot = path.resolve(process.env.MANJU_APP_DATA_ROOT || '')
if (!process.env.MANJU_APP_DATA_ROOT || !path.isAbsolute(appDataRoot)) throw new Error('缺少应用数据目录')

const autosavePath = path.join(appDataRoot, 'projects', 'autosave.manju')
const snapshot = JSON.parse(await readFile(autosavePath, 'utf8'))
const plan = createOneClickProductionPlan(snapshot)
if (!plan.ok) throw new Error(plan.blockers[0] || '项目不能开始本地合成')
if (oneClickPlanRequiresProvider(plan)) throw new Error('当前计划仍包含模型任务，已停止以避免产生调用')

const shotVideoMediaRoot = path.join(appDataRoot, 'media', 'shot-videos')
const voiceMediaRoot = path.join(appDataRoot, 'media', 'voices')
const outputRoot = path.join(appDataRoot, 'exports', 'automatic')
const historyPath = path.join(appDataRoot, 'exports', 'export-history.json')
const ffmpegPath = getFfmpegExecutablePath({ isPackaged: false, projectDirectory: workspaceRoot })
let realGenerationCalls = 0

const measureVolume = (filePath) => new Promise((resolve, reject) => {
  const child = spawn(ffmpegPath, ['-hide_banner', '-i', filePath, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {
    cwd: workspaceRoot,
    windowsHide: true,
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.on('error', reject)
  child.on('exit', (code) => {
    if (code !== 0) return reject(new Error(stderr.slice(-3000) || `响度检测退出：${code}`))
    const meanVolumeDb = Number(stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/u)?.[1])
    const maxVolumeDb = Number(stderr.match(/max_volume:\s*(-?[0-9.]+) dB/u)?.[1])
    return resolve({ meanVolumeDb, maxVolumeDb })
  })
})

const unavailableGenerator = async () => {
  realGenerationCalls += 1
  return { ok: false, error: '本地重建禁止调用模型' }
}

const controller = createOneClickProductionController({
  automationRoot: path.join(appDataRoot, '.manju-studio', 'automation'),
  workspaceRoot,
  temporaryRoot: path.join(appDataRoot, '.manju-studio', 'tmp', 'one-click-production'),
  shotVideoMediaRoot,
  voiceMediaRoot,
  ffmpegPath,
  generationOptions: { allowPaidGeneration: true },
  imageGenerator: unavailableGenerator,
  voiceGenerator: unavailableGenerator,
  videoGenerator: unavailableGenerator,
  videoPreparer: unavailableGenerator,
  videoResolver: async ({ projectLocalId, assetId }) => {
    const filePath = resolveManagedShotVideoPath({
      mediaRoot: shotVideoMediaRoot,
      projectKey: createShotVideoProjectKey(projectLocalId),
      assetId,
    })
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile() || !fileInfo.size) throw new Error(`镜头视频不存在：${assetId}`)
    return filePath
  },
  voiceResolver: async ({ projectLocalId, assetId }) => {
    const filePath = resolveManagedVoiceAssetPath({
      mediaRoot: voiceMediaRoot,
      projectKey: createShotVideoProjectKey(projectLocalId),
      assetId,
    })
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile() || !fileInfo.size) throw new Error(`配音文件不存在：${assetId}`)
    return filePath
  },
  episodeExporter: async (request) => {
    const projectKey = createShotVideoProjectKey(request.projectLocalId)
    const outputDirectory = path.join(outputRoot, projectKey)
    await mkdir(outputDirectory, { recursive: true })
    const safeProjectName = String(request.projectName || '漫剧成片').replace(/[<>:"/\\|?*]/gu, '-').slice(0, 80)
    const safeEpisodeTitle = String(request.episodeTitle || `第${request.episodeId}集`).replace(/[<>:"/\\|?*]/gu, '-').slice(0, 80)
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
    const outputPath = path.join(outputDirectory, `${safeProjectName}-${safeEpisodeTitle}-${stamp}-有声版.mp4`)
    const resolution = request.resolution === '1920x1080'
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 }
    const exportResult = await exportTimelineVideo({
      ffmpegPath,
      outputPath,
      items: request.items,
      ...resolution,
      transition: 'fade',
      subtitlesEnabled: true,
      subtitleCues: request.subtitleCues || [],
      subtitleStyle: {},
      audioTracks: [],
      onProgress: request.onProgress || (() => undefined),
    })
    const history = await appendExportHistory(historyPath, {
      ...exportResult,
      projectLocalId: request.projectLocalId,
      projectName: safeProjectName,
      resolution: request.resolution,
      episodeId: request.episodeId,
      episodeTitle: request.episodeTitle,
      scope: 'episode',
      exportedAt: new Date().toISOString(),
    })
    return { ok: true, ...exportResult, history }
  },
})

await controller.start({
  plan,
  attestation: {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    modelSignature: requiredOneClickModelSignature,
  },
})

let run
for (let attempt = 0; attempt < 240; attempt += 1) {
  const status = await controller.status({ projectLocalId: plan.projectLocalId })
  run = status.run
  if (['completed', 'completed-with-errors', 'failed', 'quota-stopped'].includes(run?.status)) break
  await new Promise((resolve) => setTimeout(resolve, 250))
}

if (run?.status !== 'completed') throw new Error(run?.error || `本地合成未完成：${run?.status || '未知状态'}`)
const exportTask = run.tasks.find((task) => task.kind === 'episode-export')
if (!exportTask?.result?.outputPath) throw new Error('本地合成没有返回 MP4')
if (realGenerationCalls !== 0) throw new Error('本地合成意外触发了模型调用')
const volume = await measureVolume(exportTask.result.outputPath)
if (!Number.isFinite(volume.meanVolumeDb) || volume.meanVolumeDb <= -80) throw new Error('新成片音轨仍接近静音')

console.log(JSON.stringify({
  passed: true,
  outputPath: exportTask.result.outputPath,
  mixedTrackCount: exportTask.result.mixedTrackCount,
  duration: exportTask.result.duration,
  ...volume,
  realGenerationCalls,
}))
