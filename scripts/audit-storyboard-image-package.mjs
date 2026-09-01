import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const expectedVersion = process.env.MANJU_EXPECTED_PACKAGE_VERSION || '1.37.0'
const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
const providerEntry = entries.find((entry) => /[\\/]electron[\\/]bailianProviderService\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')
if (!providerEntry) throw new Error('Packaged Bailian provider service was not found')

const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')
const providerSource = extractFile(archivePath, providerEntry.replace(/^[\\/]/u, '')).toString('utf8')
const mainSource = extractFile(archivePath, 'main.js').toString('utf8')
const preloadSource = extractFile(archivePath, 'preload.cjs').toString('utf8')

const result = {
  version: packageJson.version,
  markers: {
    storyboardImageEntry: rendererSource.includes('API 生成当前画面'),
    continuityReferences: rendererSource.includes('角色与连续性参考'),
    bailianImageModel: rendererSource.includes('wan2.7-image-pro'),
    zeroRequestDisclosure: rendererSource.includes('不会向百炼发送图片生成请求'),
    imageExecutorPresent: providerSource.includes('generateBailianImage')
      && mainSource.includes('generateBailianImage')
      && preloadSource.includes('generateBailianImage'),
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
