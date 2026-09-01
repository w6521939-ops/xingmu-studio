import assert from 'node:assert/strict'
import { app, BrowserWindow, dialog, Menu } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `native-file-menu-user-data-${Date.now()}-${process.pid}`)
await mkdir(testDataDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

await import('../main.js')

app.whenReady().then(async () => {
  try {
    let applicationWindow
    for (let attempt = 0; attempt < 50; attempt += 1) {
      applicationWindow = BrowserWindow.getAllWindows()[0]
      if (applicationWindow && !applicationWindow.webContents.isLoading()) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!applicationWindow) throw new Error('应用窗口未创建')
    await applicationWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })
    await new Promise((resolve) => setTimeout(resolve, 180))

    const fileMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === '文件')?.submenu
    assert.ok(fileMenu)
    const menuItems = fileMenu.items.filter((item) => item.type !== 'separator')
    const menuLabels = menuItems.map((item) => item.label)
    assert.deepEqual(menuLabels, ['新建项目', '打开项目…', '保存', '另存为…', '导入便携项目…', '导出便携项目…', '退出'])
    assert.equal(menuItems.find((item) => item.label === '新建项目')?.accelerator, 'CmdOrCtrl+N')
    assert.equal(menuItems.find((item) => item.label === '打开项目…')?.accelerator, 'CmdOrCtrl+O')
    assert.equal(menuItems.find((item) => item.label === '保存')?.accelerator, 'CmdOrCtrl+S')
    assert.equal(menuItems.find((item) => item.label === '另存为…')?.accelerator, 'CmdOrCtrl+Shift+S')
    assert.equal(menuItems.find((item) => item.label === '导入便携项目…')?.accelerator, 'CmdOrCtrl+Alt+O')
    assert.equal(menuItems.find((item) => item.label === '导出便携项目…')?.accelerator, 'CmdOrCtrl+Alt+S')
    assert.equal(typeof menuItems.find((item) => item.label === '打开项目…')?.click, 'function')
    assert.equal(typeof menuItems.find((item) => item.label === '另存为…')?.click, 'function')

    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'blank-save'")
    menuItems.find((item) => item.label === '保存').click()
    await new Promise((resolve) => setTimeout(resolve, 120))
    const blankSaveNotice = await applicationWindow.webContents.executeJavaScript("document.querySelector('.toast')?.textContent.trim()")
    assert.match(blankSaveNotice, /请先创建或打开一个项目/u)

    const created = await applicationWindow.webContents.executeJavaScript(`(async () => {
      window.__nativeMenuStage = 'create-project'
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const input = document.querySelector('.story-launch textarea')
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(input, '原生文件菜单验收项目：雨夜收到一封未来来信。')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      document.querySelector('.story-launch > .primary-button').click()
      await wait(1000)
      return {
        overviewVisible: Boolean(document.querySelector('.overview-page')),
        projectName: document.querySelector('.project-identity h1 > span')?.textContent.trim(),
      }
    })()`)
    assert.equal(created.overviewVisible, true)
    assert.match(created.projectName, /原生文件菜单验收项目/u)

    const savedProjectBasePath = path.join(testDataDirectory, 'menu-saved-project')
    const savedProjectPath = `${savedProjectBasePath}.manju`
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: savedProjectBasePath })
    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'save-project'")
    menuItems.find((item) => item.label === '保存').click()
    await new Promise((resolve) => setTimeout(resolve, 280))
    const savedProject = JSON.parse(await readFile(savedProjectPath, 'utf8'))
    assert.match(savedProject.project.name, /原生文件菜单验收项目/u)

    const savedAsProjectPath = path.join(testDataDirectory, 'menu-saved-project-copy.manju')
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: savedAsProjectPath })
    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'save-as-project'")
    menuItems.find((item) => item.label === '另存为…').click()
    await new Promise((resolve) => setTimeout(resolve, 280))
    const savedAsProject = JSON.parse(await readFile(savedAsProjectPath, 'utf8'))
    assert.equal(savedAsProject.project.name, savedProject.project.name)

    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'cancel-new'; window.confirm = () => false; null")
    menuItems.find((item) => item.label === '新建项目').click()
    await new Promise((resolve) => setTimeout(resolve, 160))
    const canceledNew = await applicationWindow.webContents.executeJavaScript("Boolean(document.querySelector('.overview-page'))")
    assert.equal(canceledNew, true)

    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'confirm-new'; window.confirm = () => true; null")
    menuItems.find((item) => item.label === '新建项目').click()
    await new Promise((resolve) => setTimeout(resolve, 260))
    const resetState = await applicationWindow.webContents.executeJavaScript(`({
      homeVisible: Boolean(document.querySelector('.home-page')),
      emptyCurrentVisible: Boolean(document.querySelector('.continue-empty')),
      storyValue: document.querySelector('.story-launch textarea')?.value,
      notice: document.querySelector('.toast')?.textContent.trim(),
    })`)
    assert.equal(resetState.homeVisible, true)
    assert.equal(resetState.emptyCurrentVisible, true)
    assert.equal(resetState.storyValue, '')
    assert.match(resetState.notice, /原项目仍保留在本机自动草稿中/u)

    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'load-preserved-autosave'")
    const preservedAutosave = await applicationWindow.webContents.executeJavaScript('window.manjuDesktop.loadAutosave()')
    assert.equal(preservedAutosave.ok, true)
    assert.match(preservedAutosave.snapshot.project.name, /原生文件菜单验收项目/u)

    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [savedProjectPath] })
    await applicationWindow.webContents.executeJavaScript("window.__nativeMenuStage = 'open-project'")
    menuItems.find((item) => item.label === '打开项目…').click()
    await new Promise((resolve) => setTimeout(resolve, 320))
    const openedState = await applicationWindow.webContents.executeJavaScript(`({
      overviewVisible: Boolean(document.querySelector('.overview-page')),
      projectName: document.querySelector('.project-identity h1 > span')?.textContent.trim(),
      localFileLabel: document.querySelector('.project-identity p')?.textContent.trim(),
    })`)
    assert.equal(openedState.overviewVisible, true)
    assert.equal(openedState.projectName, savedProject.project.name)
    assert.match(openedState.localFileLabel, /menu-saved-project\.manju/u)

    console.log(JSON.stringify({
      passed: true,
      menuLabels,
      accelerators: Object.fromEntries(menuItems.filter((item) => item.accelerator).map((item) => [item.label, item.accelerator])),
      blankSaveNotice,
      created,
      savedProjectPath,
      savedAsProjectPath,
      canceledNew,
      resetState,
      preservedProjectName: preservedAutosave.snapshot.project.name,
      openedState,
    }))
    applicationWindow.destroy()
    app.quit()
  } catch (error) {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    if (activeWindow && !activeWindow.isDestroyed()) {
      try {
        console.error(`Native menu test stage: ${await activeWindow.webContents.executeJavaScript("window.__nativeMenuStage || 'startup'")}`)
      } catch {}
    }
    console.error(error)
    app.exit(1)
  }
})
