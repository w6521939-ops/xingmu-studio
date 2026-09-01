import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const expectedVersion = process.env.MANJU_EXPECTED_PACKAGE_VERSION || '1.37.0'
const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')

const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')
const mainSource = extractFile(archivePath, 'main.js').toString('utf8')
const preloadSource = extractFile(archivePath, 'preload.cjs').toString('utf8')
const controllerSource = extractFile(archivePath, 'electron/oneClickProductionService.js').toString('utf8')
const videoSource = extractFile(archivePath, 'electron/bailianVideoService.js').toString('utf8')
const voiceSource = extractFile(archivePath, 'electron/bailianTtsService.js').toString('utf8')

const result = {
  version: packageJson.version,
  expectedVersion,
  markers: {
    overviewEntry: rendererSource.includes('一键制作整部漫剧'),
    zeroCostSettings: rendererSource.includes('0 元自动化')
      && rendererSource.includes('免费额度用完即停'),
    progressDrawer: rendererSource.includes('整部漫剧制作进度'),
    rendererBridge: preloadSource.includes('startOneClickProduction')
      && preloadSource.includes('pauseOneClickProduction')
      && preloadSource.includes('resumeOneClickProduction')
      && preloadSource.includes('stopOneClickProduction'),
    mainIpc: mainSource.includes('one-click-production:start')
      && mainSource.includes('one-click-production:progress'),
    environmentLock: mainSource.includes("process.env.MANJU_DISABLE_PAID_GENERATION !== '1'"),
    quotaStop: controllerSource.includes('AllocationQuota\\.FreeTierOnly')
      && controllerSource.includes("run.status = 'quota-stopped'"),
    explicitResumeOnly: controllerSource.includes('async resume')
      && controllerSource.includes("task.status === 'failed'"),
    persistedQueue: controllerSource.includes('one-click-production.json'),
    realVideoPipeline: rendererSource.includes('wan2.7-i2v-2026-04-25')
      && videoSource.includes('bailianCapabilityMap.video.model')
      && videoSource.includes('X-DashScope-Async')
      && videoSource.includes('/api/v1/tasks/')
      && videoSource.includes('task_status'),
    realVoicePipeline: rendererSource.includes('qwen3-tts-flash')
      && rendererSource.includes('真实 TTS')
      && voiceSource.includes('generateBailianVoice')
      && voiceSource.includes('format: \'wav\'')
      && mainSource.includes('resolveManagedVoiceAssetPath'),
    automaticFinalExport: controllerSource.includes("'episode-export'")
      && mainSource.includes('getAutomaticExportRoot')
      && rendererSource.includes('一键生成配音和视频'),
    rateLimitProtection: controllerSource.includes('intervalMilliseconds: 31000')
      && controllerSource.includes('cooldownMilliseconds: 65000')
      && controllerSource.includes('maximumAttempts: 3')
      && controllerSource.includes("run.status = 'cooldown'"),
  },
  forbiddenEntries: entries.filter((entry) => /^[\\/](?:scripts|outputs|docs)[\\/]/iu.test(entry)),
  keyEntries: entries.filter((entry) => /[\\/]key\.txt$/iu.test(entry)),
}

const passed = result.version === expectedVersion
  && Object.values(result.markers).every(Boolean)
  && result.forbiddenEntries.length === 0
  && result.keyEntries.length === 0

console.log(JSON.stringify({ passed, ...result }))
if (!passed) process.exitCode = 1
