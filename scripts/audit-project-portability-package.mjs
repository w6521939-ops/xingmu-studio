import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const expectedVersion = process.env.MANJU_EXPECTED_PACKAGE_VERSION || '1.37.0'
const entries = listPackage(archivePath)
const packageJson = JSON.parse(extractFile(archivePath, 'package.json').toString('utf8'))
const mainSource = extractFile(archivePath, 'main.js').toString('utf8')
const preloadSource = extractFile(archivePath, 'preload.cjs').toString('utf8')
const portabilityService = extractFile(archivePath, 'electron/projectPortabilityService.js').toString('utf8')
const cleanupService = extractFile(archivePath, 'electron/managedMediaCleanupService.js').toString('utf8')
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')
const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')

const markers = {
  portableBundle: portabilityService.includes('.manju-bundle'),
  manifestHash: portabilityService.includes('SHA-256') && portabilityService.includes('manifest.json'),
  atomicStaging: portabilityService.includes('.pending-') && portabilityService.includes('rename('),
  importAsCopy: rendererSource.includes('便携项目已作为新副本导入'),
  cleanupScan: cleanupService.includes('recovery-protected') && cleanupService.includes('eligible'),
  recycleBin: mainSource.includes('shell.trashItem'),
  tokenBoundary: mainSource.includes('portableRevealTargets') && !preloadSource.includes('targetParentPath'),
  noPaidCallCopy: rendererSource.includes('不联网、不调用 AI、不消耗任何额度'),
  nativeMenu: mainSource.includes('导入便携项目…') && mainSource.includes('导出便携项目…'),
  manifestV2: portabilityService.includes('portableProjectMinimumAppVersion') && portabilityService.includes('projectSchemaVersion'),
  compatibilityGuard: portabilityService.includes('envelopeOnly') && rendererSource.includes('此便携项目由更新版本创建'),
  migrationRegistry: entries.some((entry) => /portableManifestMigrationRegistry\.js$/u.test(entry)),
  migrationAudit: mainSource.includes('portable-project-migration.jsonl'),
}

const result = {
  version: packageJson.version,
  markers,
  forbiddenEntries: entries.filter((entry) => /^[\\/](?:scripts|outputs|docs)[\\/]/iu.test(entry)),
  keyEntries: entries.filter((entry) => /[\\/]key\.txt$/iu.test(entry)),
  unexpectedArchiveDependencies: Object.keys(packageJson.dependencies || {}).filter((name) => /zip|archive|compress/iu.test(name)),
}

const passed = result.version === expectedVersion
  && Object.values(markers).every(Boolean)
  && result.forbiddenEntries.length === 0
  && result.keyEntries.length === 0
  && result.unexpectedArchiveDependencies.length === 0

console.log(JSON.stringify({ passed, ...result }))
if (!passed) process.exitCode = 1
