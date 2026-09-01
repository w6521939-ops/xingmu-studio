import { extractFile, listPackage } from '@electron/asar'
import { readFile } from 'node:fs/promises'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const requestedInstallerPath = process.argv[3] || ''
const keyPath = process.argv[4] || 'key.txt'

const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const installerPath = requestedInstallerPath || `release/漫剧创作-Setup-${packageJson.version}-x64.exe`
const assetEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
const providerEntry = entries.find((entry) => /[\\/]electron[\\/]bailianProviderService\.js$/iu.test(entry))
const mainEntry = entries.find((entry) => /[\\/]main\.js$/iu.test(entry))
if (!assetEntry) throw new Error('Packaged renderer asset was not found')
if (!providerEntry) throw new Error('Packaged Bailian provider service was not found')
if (!mainEntry) throw new Error('Packaged Electron main process was not found')
const rendererSource = extractFile(archivePath, assetEntry.replace(/^[\\/]/u, '')).toString('utf8')
const providerSource = extractFile(archivePath, providerEntry.replace(/^[\\/]/u, '')).toString('utf8')
const mainSource = extractFile(archivePath, mainEntry.replace(/^[\\/]/u, '')).toString('utf8')

let secret = (await readFile(keyPath, 'utf8')).trim()
if (secret.includes('=')) secret = secret.slice(secret.indexOf('=') + 1).trim()
secret = secret.replace(/^['"]|['"]$/gu, '')
if (!secret.startsWith('sk-')) throw new Error('Local Key format is not recognized')

const [archiveBytes, installerBytes] = await Promise.all([
  readFile(archivePath),
  readFile(installerPath),
])
const secretBytes = Buffer.from(secret)

console.log(JSON.stringify({
  version: packageJson.version,
  providerServiceIncluded: true,
  keyFileListed: entries.some((entry) => /[\\/]key\.txt$/iu.test(entry)),
  secretPresentInAsar: archiveBytes.includes(secretBytes),
  secretPresentAsPlaintextInInstaller: installerBytes.includes(secretBytes),
  uiMarkers: {
    safeKey: rendererSource.includes('已从 key.txt 安全加载'),
    bailian: rendererSource.includes('阿里云百炼'),
    qwenPlus: rendererSource.includes('qwen3.7-plus'),
    voiceTruth: providerSource.includes('当前百炼漫剧技能未配置配音 TTS'),
    paidGenerationLock: providerSource.includes('付费生成已锁定'),
    packagedMainForcesPaidGenerationOff: /allowPaidGeneration:\s*false/u.test(mainSource),
  },
}))
