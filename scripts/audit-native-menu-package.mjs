import { extractFile, listPackage } from '@electron/asar'

const archivePath = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const entries = listPackage(archivePath)
const mainSource = extractFile(archivePath, 'main.js').toString('utf8')
const preloadSource = extractFile(archivePath, 'preload.cjs').toString('utf8')
const rendererEntry = entries.find((entry) => /[\\/]dist[\\/]assets[\\/]index-.*\.js$/iu.test(entry))
if (!rendererEntry) throw new Error('Packaged renderer asset was not found')
const rendererSource = extractFile(archivePath, rendererEntry.replace(/^[\\/]/u, '')).toString('utf8')

const result = {
  menu: {
    newProject: mainSource.includes('新建项目'),
    openProject: mainSource.includes('打开项目…'),
    save: mainSource.includes('CmdOrCtrl+S'),
    saveAs: mainSource.includes('另存为…'),
    ctrlN: mainSource.includes('CmdOrCtrl+N'),
    ctrlO: mainSource.includes('CmdOrCtrl+O'),
    ctrlShiftS: mainSource.includes('CmdOrCtrl+Shift+S'),
  },
  bridge: preloadSource.includes('onMenuCommand'),
  safeNew: rendererSource.includes('原项目仍保留在本机自动草稿中'),
  scriptEntries: entries.filter((entry) => /^[\\/]scripts[\\/]/iu.test(entry)).length,
  keyEntries: entries.filter((entry) => /[\\/]key\.txt$/iu.test(entry)).length,
}

const passed = Object.values(result.menu).every(Boolean)
  && result.bridge
  && result.safeNew
  && result.scriptEntries === 0
  && result.keyEntries === 0

console.log(JSON.stringify({ passed, ...result }))
if (!passed) process.exitCode = 1

