import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { app, BrowserWindow, dialog } from 'electron'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createShotVideoProjectKey, resolveManagedShotVideoPath } from '../electron/shotVideoAssetService.js'

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'manju-portability-ui-test-'))
const userDataDirectory = path.join(tempRoot, 'user-data')
const exportDirectory = path.join(tempRoot, 'exports')
const screenshotDirectory = path.join(process.cwd(), 'outputs', 'runtime')
await mkdir(userDataDirectory, { recursive: true })
await mkdir(exportDirectory, { recursive: true })
await mkdir(screenshotDirectory, { recursive: true })
app.setPath('userData', userDataDirectory)
app.disableHardwareAcceleration()

await import('../main.js')

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const captureScreenshot = async (window, targetPath) => {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const image = await window.webContents.capturePage()
      const png = image.toPNG()
      if (!png.length) throw new Error('截图结果为空')
      await writeFile(targetPath, png)
      return
    } catch (error) {
      lastError = error
      await wait(120)
    }
  }
  throw new Error(`截图写入失败：${lastError?.message || '未知错误'}`)
}

app.whenReady().then(async () => {
  let applicationWindow
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      applicationWindow = BrowserWindow.getAllWindows()[0]
      if (applicationWindow && !applicationWindow.webContents.isLoading()) break
      await wait(100)
    }
    if (!applicationWindow) throw new Error('应用窗口未创建')
    await applicationWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })
    await wait(180)

    await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      window.__portabilityHttpCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => {
        const target = String(args[0]?.url || args[0] || '')
        if (/^https?:/iu.test(target)) window.__portabilityHttpCalls += 1
        return originalFetch(...args)
      }
      const input = document.querySelector('.story-launch textarea')
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(input, '便携项目端到端验收：真实项目快照在两台 Windows 电脑间安全迁移。')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.story-launch > .primary-button').click()
      for (let attempt = 0; attempt < 40 && !document.querySelector('.overview-page'); attempt += 1) await wait(80)
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '素材')?.click()
      for (let attempt = 0; attempt < 30 && !document.querySelector('.asset-library-page'); attempt += 1) await wait(60)
    })()`)

    await wait(950)
    const assetId = 'shot-video-portability-ui-test'
    const managedVideoBytes = Buffer.alloc(4096, 0x4d)
    const managedVideoHash = createHash('sha256').update(managedVideoBytes).digest('hex')
    const seededSnapshot = {
      format: 'manju-project',
      version: 1,
      savedAt: '2026-07-23T00:00:00.000Z',
      project: {
        localProjectId: 'local-portability-ui-project',
        name: '便携项目端到端验收',
        genre: '悬疑',
        ratio: '9:16',
        duration: '60秒',
        episodeCount: 1,
        synopsis: '真实项目快照在两台 Windows 电脑间安全迁移。',
      },
      content: {
        episodes: [{ id: 1, title: '第一集', scenes: 1, variant: 1, statuses: [], next: '编辑剧本' }],
        scenes: [{ id: 1, episodeId: 1, title: '迁移验收场景', location: '', time: '', weather: '', mainCharacterIds: [], status: '当前编辑', action: '', narration: '' }],
        characters: [],
        lines: [],
        audioTracks: [],
        subtitleStyle: { fontSize: 52, color: '#FFFFFF', outlineColor: '#102B3A', backgroundOpacity: 42, position: 'bottom', bold: true },
      },
    }
    seededSnapshot.content.videoAssets = [{
      id: assetId,
      kind: 'shot-video',
      source: 'local-import',
      fileName: '用户真实镜头-迁移验收.mp4',
      mimeType: 'video/mp4',
      bytes: managedVideoBytes.length,
      duration: 2.5,
      width: 1080,
      height: 1920,
      fps: 30,
      sha256: managedVideoHash,
      importedAt: '2026-07-23T00:00:00.000Z',
    }]
    seededSnapshot.content.shots = [{
      id: 1,
      episodeId: 1,
      sceneId: 1,
      action: '便携项目迁移验收镜头',
      dialogue: '',
      duration: '2.5s',
      size: '中景',
      motion: '固定镜头',
      videoAssetId: assetId,
      videoOffsetSeconds: 0,
      videoDurationPolicy: 'fit-timeline',
    }]
    const managedVideoPath = resolveManagedShotVideoPath({
      mediaRoot: path.join(userDataDirectory, 'media', 'shot-videos'),
      projectKey: createShotVideoProjectKey(seededSnapshot.project.localProjectId),
      assetId,
    })
    await mkdir(path.dirname(managedVideoPath), { recursive: true })
    await writeFile(managedVideoPath, managedVideoBytes)
    const savedSeed = await applicationWindow.webContents.executeJavaScript(`window.manjuDesktop.saveAutosave(${JSON.stringify(seededSnapshot)})`)
    assert.equal(savedSeed.ok, true)
    const reloaded = new Promise((resolve) => applicationWindow.webContents.once('did-finish-load', resolve))
    applicationWindow.reload()
    await reloaded
    await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      for (let attempt = 0; attempt < 40 && !document.querySelector('.asset-library-page'); attempt += 1) await wait(60)
      window.__portabilityHttpCalls = 0
      const originalFetch = window.fetch
      window.fetch = (...args) => {
        const target = String(args[0]?.url || args[0] || '')
        if (/^https?:/iu.test(target)) window.__portabilityHttpCalls += 1
        return originalFetch(...args)
      }
    })()`)

    const storageCard = await applicationWindow.webContents.executeJavaScript(`({
      pageVisible: Boolean(document.querySelector('.asset-library-page')),
      manageButton: document.querySelector('.asset-storage-card__manage')?.textContent.trim(),
      capacity: document.querySelector('.asset-storage-card header strong')?.textContent.trim(),
    })`)
    assert.equal(storageCard.pageVisible, true)
    assert.match(storageCard.manageButton, /迁移与清理/u)

    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(80)
    const initialDialog = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('.storage-migration-dialog')),
      title: document.querySelector('#storage-migration-title')?.textContent.trim(),
      footnote: document.querySelector('.storage-migration-footnote')?.textContent.replace(/\\s+/gu, ' ').trim(),
      width: Math.round(document.querySelector('.storage-migration-dialog')?.getBoundingClientRect().width || 0),
      height: Math.round(document.querySelector('.storage-migration-dialog')?.getBoundingClientRect().height || 0),
      focusedControl: document.activeElement?.getAttribute('aria-label') || '',
    })`)
    assert.equal(initialDialog.visible, true)
    assert.equal(initialDialog.title, '项目迁移与存储管理')
    assert.match(initialDialog.footnote, /不联网.*不调用 AI.*不消耗任何额度/u)
    assert.ok(initialDialog.width >= 900)
    assert.ok(initialDialog.height >= 650)
    assert.match(initialDialog.focusedControl, /关闭项目迁移/u)

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('检查并准备导出')).click()`)
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-export-review]'))")) break
      await wait(60)
    }
    const exportReview = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-export-review]')),
      text: document.querySelector('[data-testid=portable-export-review]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(exportReview.visible, true)
    assert.match(exportReview.text, /媒体完整/u)
    assert.equal(exportReview.text.includes(tempRoot), false)

    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportDirectory] })
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-location button')).find((button) => button.textContent.includes('选择位置')).click()`)
    await wait(100)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-review footer button')).find((button) => button.textContent.includes('开始导出')).click()`)
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-export-result]'))")) break
      await wait(70)
    }
    const exportResult = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-export-result]')),
      text: document.querySelector('[data-testid=portable-export-result]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(exportResult.visible, true)
    assert.match(exportResult.text, /便携项目已导出/u)
    assert.match(exportResult.text, /1 个真实镜头视频/u)
    const bundleName = (await import('node:fs/promises')).readdir(exportDirectory).then((entries) => entries.find((entry) => entry.endsWith('.manju-bundle')))
    const resolvedBundleName = await bundleName
    assert.ok(resolvedBundleName)
    const bundleRoot = path.join(exportDirectory, resolvedBundleName)
    const manifest = JSON.parse(await readFile(path.join(bundleRoot, 'manifest.json'), 'utf8'))
    assert.equal(manifest.complete, true)
    assert.equal(JSON.stringify(manifest).includes(tempRoot), false)

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-export-result] button')).find((button) => button.textContent.trim() === '完成').click()`)
    await wait(80)
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-mode button')).find((button) => button.textContent.includes('导入')).click()`)
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [bundleRoot] })
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('选择便携项目')).click()`)
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-import-review]'))")) break
      await wait(60)
    }
    const importReview = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-import-review]')),
      name: document.querySelector('.storage-migration-name input')?.value,
      body: document.querySelector('[data-testid=portable-import-review]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(importReview.visible, true)
    assert.match(importReview.name, /导入副本/u)
    assert.match(importReview.body, /新的本地项目标识/u)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-review footer button')).find((button) => button.textContent.includes('作为新副本导入')).click()`)
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-import-result]'))")) break
      await wait(70)
    }
    const importResult = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-import-result]')),
      text: document.querySelector('[data-testid=portable-import-result]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(importResult.visible, true)
    assert.match(importResult.text, /原项目不会被覆盖/u)
    assert.match(importResult.text, /1 个真实托管镜头视频/u)

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-import-result] button')).find((button) => button.textContent.includes('打开导入项目')).click()`)
    await wait(180)
    const openedImport = await applicationWindow.webContents.executeJavaScript(`({
      overview: Boolean(document.querySelector('.overview-page')),
      projectName: document.querySelector('.project-identity h1 > span')?.textContent.trim(),
      httpCalls: window.__portabilityHttpCalls,
    })`)
    assert.equal(openedImport.overview, true)
    assert.match(openedImport.projectName, /导入副本/u)
    assert.equal(openedImport.httpCalls, 0)

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '素材').click()`)
    await wait(80)
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-tabs button')).find((button) => button.textContent.includes('空间清理')).click()`)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('开始安全扫描')).click()`)
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=managed-media-cleanup-review]'))")) break
      await wait(60)
    }
    const cleanupReview = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=managed-media-cleanup-review]')),
      text: document.querySelector('[data-testid=managed-media-cleanup-review]')?.textContent.replace(/\\s+/gu, ' ').trim(),
      unknownPathVisible: document.querySelector('[data-testid=managed-media-cleanup-review]')?.textContent.includes(${JSON.stringify(tempRoot)}) || false,
    })`)
    assert.equal(cleanupReview.visible, true)
    assert.match(cleanupReview.text, /托管媒体扫描结果/u)
    assert.match(cleanupReview.text, /正在使用1/u)
    assert.equal(cleanupReview.unknownPathVisible, false)

    await wait(260)
    const screenshotPath = path.join(screenshotDirectory, 'project-storage-center-v33.png')
    await captureScreenshot(applicationWindow, screenshotPath)
    applicationWindow.setSize(1024, 768)
    await wait(220)
    const compactLayout = await applicationWindow.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('.storage-migration-dialog')?.getBoundingClientRect()
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        left: Math.round(dialog?.left || 0),
        right: Math.round(dialog?.right || 0),
        top: Math.round(dialog?.top || 0),
        bottom: Math.round(dialog?.bottom || 0),
      }
    })()`)
    assert.ok(compactLayout.left >= 0 && compactLayout.right <= compactLayout.viewportWidth)
    assert.ok(compactLayout.top >= 0 && compactLayout.bottom <= compactLayout.viewportHeight)
    applicationWindow.setSize(1440, 900)
    await wait(180)

    await applicationWindow.webContents.executeJavaScript("document.querySelector('.storage-migration-header > button').click()")
    await wait(80)
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-inspector__actions .delete-action').click()")
    await wait(40)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.asset-confirm-dialog--danger footer button')).find((button) => button.textContent.includes('解除引用')).click()`)
    const detachDeadline = Date.now() + 5000
    let detachedAutosave
    do {
      await wait(120)
      detachedAutosave = await applicationWindow.webContents.executeJavaScript('window.manjuDesktop.loadAutosave()')
    } while (
      detachedAutosave.ok
      && detachedAutosave.snapshot.content.shots[0].videoAssetId
      && Date.now() < detachDeadline
    )
    assert.equal(detachedAutosave.ok, true)
    assert.equal(detachedAutosave.snapshot.content.shots[0].videoAssetId, '')
    const importedManagedVideoPath = resolveManagedShotVideoPath({
      mediaRoot: path.join(userDataDirectory, 'media', 'shot-videos'),
      projectKey: createShotVideoProjectKey(detachedAutosave.snapshot.project.localProjectId),
      assetId,
    })
    assert.equal((await stat(importedManagedVideoPath)).size, managedVideoBytes.length)

    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-tabs button')).find((button) => button.textContent.includes('空间清理')).click()`)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('开始安全扫描')).click()`)
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("document.querySelector('[data-testid=managed-media-cleanup-review]')?.textContent.includes('可安全清理1') || false")) break
      await wait(60)
    }
    const eligibleReview = await applicationWindow.webContents.executeJavaScript(`({
      eligible: document.querySelector('[data-testid=managed-media-cleanup-review]')?.textContent.includes('可安全清理1') || false,
      selected: document.querySelectorAll('.storage-cleanup-row input:checked').length,
    })`)
    assert.equal(eligibleReview.eligible, true)
    assert.equal(eligibleReview.selected, 1)
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.storage-cleanup-review > footer .storage-danger-button').click()")
    await wait(40)
    const cleanupConfirmFocus = await applicationWindow.webContents.executeJavaScript("document.activeElement?.textContent.trim()")
    assert.equal(cleanupConfirmFocus, '取消')
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.storage-cleanup-confirm .storage-danger-button').click()")
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=managed-media-cleanup-result]'))")) break
      await wait(70)
    }
    const cleanupResult = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=managed-media-cleanup-result]')),
      text: document.querySelector('[data-testid=managed-media-cleanup-result]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(cleanupResult.visible, true)
    assert.match(cleanupResult.text, /已将 1 个托管媒体目录移入 Windows 回收站/u)
    await assert.rejects(stat(importedManagedVideoPath), (error) => error?.code === 'ENOENT')

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=managed-media-cleanup-result] button')).find((button) => button.textContent.trim() === '完成').click()`)
    await wait(80)
    const legacyRoot = path.join(exportDirectory, '旧版兼容验收.manju-bundle')
    await cp(bundleRoot, legacyRoot, { recursive: true })
    const legacyManifest = JSON.parse(await readFile(path.join(legacyRoot, 'manifest.json'), 'utf8'))
    legacyManifest.version = 1
    legacyManifest.appVersion = '1.31.0'
    delete legacyManifest.compatibility
    delete legacyManifest.projectSchemaVersion
    delete legacyManifest.mediaSchemaVersion
    legacyManifest.missingMedia = legacyManifest.missingMedia.map(({ reasonCode: _reasonCode, ...item }) => item)
    await writeFile(path.join(legacyRoot, 'manifest.json'), JSON.stringify(legacyManifest, null, 2), 'utf8')

    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-mode button')).find((button) => button.textContent.includes('导入')).click()`)
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [legacyRoot] })
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('选择便携项目')).click()`)
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-compatibility-migratable]'))")) break
      await wait(60)
    }
    const legacyReview = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-compatibility-migratable]')),
      text: document.querySelector('[data-testid=portable-import-review]')?.textContent.replace(/\\s+/gu, ' ').trim(),
      importLabel: Array.from(document.querySelectorAll('[data-testid=portable-import-review] button')).find((button) => button.textContent.includes('迁移并导入'))?.textContent.trim(),
    })`)
    assert.equal(legacyReview.visible, true)
    assert.match(legacyReview.text, /检测到旧版便携项目/u)
    assert.match(legacyReview.text, /V1 → V2/u)
    assert.equal(legacyReview.importLabel, '迁移并导入副本')
    await wait(220)
    const v34ScreenshotPath = path.join(screenshotDirectory, 'project-portable-format-v34.png')
    await captureScreenshot(applicationWindow, v34ScreenshotPath)

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-import-review] button')).find((button) => button.textContent.includes('查看迁移详情')).click()`)
    await wait(220)
    const drawerState = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('.portable-migration-drawer')),
      focused: document.activeElement?.getAttribute('aria-label') || '',
      text: document.querySelector('.portable-migration-drawer')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(drawerState.visible, true)
    assert.equal(drawerState.focused, '关闭迁移详情')
    assert.match(drawerState.text, /原始便携包不会修改/u)
    const drawerScreenshotPath = path.join(screenshotDirectory, 'project-portable-migration-drawer-v34.png')
    await captureScreenshot(applicationWindow, drawerScreenshotPath)
    await applicationWindow.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
    await wait(50)
    const drawerClosed = await applicationWindow.webContents.executeJavaScript(`({
      closed: !document.querySelector('.portable-migration-drawer'),
      focusReturned: document.activeElement?.textContent.trim(),
    })`)
    assert.equal(drawerClosed.closed, true)
    assert.equal(drawerClosed.focusReturned, '查看迁移详情')

    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-import-review] button')).find((button) => button.textContent.includes('迁移并导入')).click()`)
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-import-result]'))")) break
      await wait(70)
    }
    const legacyImportResult = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-import-result]')),
      text: document.querySelector('[data-testid=portable-import-result]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(legacyImportResult.visible, true)
    assert.match(legacyImportResult.text, /旧版项目已安全迁移并导入/u)
    assert.match(legacyImportResult.text, /原始便携包没有修改/u)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-import-result] button')).find((button) => button.textContent.includes('稍后打开')).click()`)
    await wait(80)

    const futureRoot = path.join(exportDirectory, '未来版本验收.manju-bundle')
    await mkdir(futureRoot, { recursive: true })
    await writeFile(path.join(futureRoot, 'manifest.json'), JSON.stringify({
      format: 'manju-portable-project',
      version: 3,
      appVersion: '1.40.0',
      project: { name: '未来版本只读项目' },
    }, null, 2), 'utf8')
    await mkdir(path.join(futureRoot, 'project.manju'))
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-mode button')).find((button) => button.textContent.includes('导入')).click()`)
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [futureRoot] })
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('选择便携项目')).click()`)
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-future-version]'))")) break
      await wait(60)
    }
    const futureGuard = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-future-version]')),
      text: document.querySelector('[data-testid=portable-future-version]')?.textContent.replace(/\\s+/gu, ' ').trim(),
      focused: document.activeElement?.textContent.trim(),
      forceImportVisible: document.body.textContent.includes('强制导入'),
    })`)
    assert.equal(futureGuard.visible, true)
    assert.match(futureGuard.text, /未读取项目正文或媒体/u)
    assert.equal(futureGuard.focused, '重新选择')
    assert.equal(futureGuard.forceImportVisible, false)
    const futureDirectResult = await applicationWindow.webContents.executeJavaScript('window.manjuDesktop.choosePortableProjectImport()')
    assert.equal(futureDirectResult.ok, true)
    assert.equal(futureDirectResult.token, '')
    assert.equal(futureDirectResult.compatibility.status, 'future')
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-testid=portable-future-version] button')).find((button) => button.textContent.trim() === '关闭').click()`)
    await wait(80)

    const corruptRoot = path.join(exportDirectory, '损坏版本验收.manju-bundle')
    await mkdir(corruptRoot, { recursive: true })
    await writeFile(path.join(corruptRoot, 'manifest.json'), JSON.stringify({ format: 'manju-portable-project', version: 0 }), 'utf8')
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.asset-storage-card__manage').click()")
    await wait(50)
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-mode button')).find((button) => button.textContent.includes('导入')).click()`)
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [corruptRoot] })
    await applicationWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.storage-migration-empty button')).find((button) => button.textContent.includes('选择便携项目')).click()`)
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('[data-testid=portable-corrupt-version]'))")) break
      await wait(60)
    }
    const corruptGuard = await applicationWindow.webContents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-testid=portable-corrupt-version]')),
      text: document.querySelector('[data-testid=portable-corrupt-version]')?.textContent.replace(/\\s+/gu, ' ').trim(),
    })`)
    assert.equal(corruptGuard.visible, true)
    assert.match(corruptGuard.text, /MANIFEST_VERSION_INVALID/u)
    assert.match(corruptGuard.text, /未导入项目/u)
    const migrationAuditText = await readFile(path.join(userDataDirectory, 'logs', 'portable-project-migration.jsonl'), 'utf8')
    const migrationAudits = migrationAuditText.trim().split(/\r?\n/u).map((line) => JSON.parse(line))
    assert.ok(migrationAudits.some((entry) => entry.outcome === 'success' && entry.sourceVersion === 1 && entry.targetVersion === 2))
    assert.equal(migrationAuditText.includes(tempRoot), false)
    assert.equal(migrationAuditText.includes('用户真实镜头'), false)
    const finalHttpCalls = await applicationWindow.webContents.executeJavaScript('window.__portabilityHttpCalls')
    assert.equal(finalHttpCalls, 0)

    console.log(JSON.stringify({
      passed: true,
      storageCard,
      initialDialog,
      exportReview,
      exportResult,
      importReview,
      importResult,
      openedImport,
      cleanupReview,
      compactLayout,
      cleanupConfirmFocus,
      eligibleReview,
      cleanupResult,
      legacyReview,
      drawerState,
      drawerClosed,
      legacyImportResult,
      futureGuard,
      futureImportTokenIssued: Boolean(futureDirectResult.token),
      corruptGuard,
      migrationAuditEntries: migrationAudits.length,
      screenshotPath: v34ScreenshotPath,
      drawerScreenshotPath,
      realUserMediaTouched: false,
      paidCalls: 0,
    }))
    applicationWindow.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    if (applicationWindow && !applicationWindow.isDestroyed()) applicationWindow.destroy()
    app.exit(1)
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
})
