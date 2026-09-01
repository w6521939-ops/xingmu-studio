import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const expectedVersion = process.env.MANJU_EXPECTED_PACKAGE_VERSION || '1.37.0'
const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
const localVideoEntry = entries.find((entry) => /[\\/]electron[\\/]shotVideoAssetService\.js$/iu.test(entry))
const videoExportEntry = entries.find((entry) => /[\\/]electron[\\/]videoExportService\.js$/iu.test(entry))
const bailianVideoEntry = entries.find((entry) => /[\\/]electron[\\/]bailianVideoService\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')
if (!localVideoEntry) throw new Error('Packaged local shot video service was not found')
if (!videoExportEntry) throw new Error('Packaged video export service was not found')
if (!bailianVideoEntry) throw new Error('Packaged Bailian video service was not found')

const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')
const localVideoSource = extractFile(archivePath, localVideoEntry.replace(/^[\\/]/u, '')).toString('utf8')
const videoExportSource = extractFile(archivePath, videoExportEntry.replace(/^[\\/]/u, '')).toString('utf8')
const bailianVideoSource = extractFile(archivePath, bailianVideoEntry.replace(/^[\\/]/u, '')).toString('utf8')
const mainSource = extractFile(archivePath, 'main.js').toString('utf8')
const preloadSource = extractFile(archivePath, 'preload.cjs').toString('utf8')

const result = {
  version: packageJson.version,
  markers: {
    shotVideoEntry: rendererSource.includes('AI 视频请求预览'),
    localAudioBoundary: rendererSource.includes('本地音轨不会上传'),
    bailianVideoModel: rendererSource.includes('wan2.7-i2v-2026-04-25'),
    zeroRequestDisclosure: rendererSource.includes('不会上传首帧、不会创建任务、不会消耗额度'),
    paidLock: rendererSource.includes('创建任务已锁定'),
    localVideoAdoption: rendererSource.includes('local-shot-video-adoption')
      && rendererSource.includes('local-shot-video-card'),
    lastFrameContinuity: rendererSource.includes('shot-video-continuity-dialog'),
    managedProtocol: mainSource.includes('manju-media') && preloadSource.includes('prepareLocalShotVideo'),
    realLocalProcessing: localVideoSource.includes('prepareLocalShotVideoFromPath')
      && localVideoSource.includes('first-frame.jpg')
      && localVideoSource.includes('last-frame.jpg')
      && localVideoSource.includes("'-an'"),
    localVideoExport: videoExportSource.includes('videoSegmentCount')
      && videoExportSource.includes('videoFallbackCount'),
    oneClickVideoExecutorPresent: bailianVideoSource.includes('generateBailianVideo')
      && mainSource.includes('generateBailianVideo'),
    manualVideoExecutorStillLocked: !preloadSource.includes('generateBailianVideo'),
    environmentLock: mainSource.includes("process.env.MANJU_DISABLE_PAID_GENERATION !== '1'"),
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
