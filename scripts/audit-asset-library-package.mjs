import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const expectedVersion = process.env.MANJU_EXPECTED_PACKAGE_VERSION || '1.37.0'
const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')
const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')

const result = {
  version: packageJson.version,
  markers: {
    assetLibraryPage: rendererSource.includes('素材库'),
    realUserAssetsOnly: rendererSource.includes('仅真实用户素材'),
    characterImages: rendererSource.includes('角色图片'),
    storyboardImages: rendererSource.includes('分镜图片'),
    voiceAudio: rendererSource.includes('角色配音'),
    storageLimit: rendererSource.includes('10 MB'),
    replacementImpact: rendererSource.includes('所有使用此素材的位置将同步更新'),
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
