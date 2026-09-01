import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTestUserProjectSnapshot } from './fixtures/test-user-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `asset-library-ui-test-${Date.now()}-${process.pid}`)
const screenshotDirectory = path.join(process.cwd(), 'outputs', 'runtime')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(screenshotDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZduAAAAAASUVORK5CYII='
const audioData = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const snapshot = createTestUserProjectSnapshot()
snapshot.content.characters[0] = {
  ...snapshot.content.characters[0],
  image: imageData,
  imageFileName: 'shen-yan.png',
  imageSource: 'local',
  imageUpdatedAt: '2026-07-22T10:00:00.000Z',
}
snapshot.content.shots[0] = {
  ...snapshot.content.shots[0],
  image: imageData,
  imageStatus: '已完成',
  imageFileName: 'shot-01.png',
  imageSource: 'local',
  imageUpdatedAt: '2026-07-22T10:05:00.000Z',
}
snapshot.content.lines[0] = {
  ...snapshot.content.lines[0],
  audio: audioData,
  audioStatus: '已完成',
  audioFileName: 'xiao-che-line.wav',
  audioSource: 'local',
  audioUpdatedAt: '2026-07-22T10:10:00.000Z',
}
snapshot.content.audioTracks = [{
  id: 1,
  kind: 'bgm',
  name: '雾城雨夜',
  fileName: 'fog-city-rain.wav',
  audio: audioData,
  start: 0,
  duration: 12,
  volume: 35,
  fadeIn: 1,
  fadeOut: 1,
  waveform: [0.12, 0.34, 0.72, 0.48, 0.9, 0.55, 0.26, 0.62],
  audioUpdatedAt: '2026-07-22T10:15:00.000Z',
}]

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'))
    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(snapshot))})`)
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'assets' } })

    const initial = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      for (let attempt = 0; attempt < 30 && !document.querySelector('.asset-library-page'); attempt += 1) await wait(80)
      const activeNav = document.querySelector('.topnav button.is-active')?.textContent.trim()
      const cards = Array.from(document.querySelectorAll('.asset-card'))
      const categoryCounts = Object.fromEntries(Array.from(document.querySelectorAll('.asset-filter-list button')).map((button) => [button.querySelector('span')?.textContent.trim(), Number(button.querySelector('b')?.textContent || 0)]))
      return {
        pageVisible: Boolean(document.querySelector('.asset-library-page')),
        activeNav,
        cardCount: cards.length,
        cardTitles: cards.map((card) => card.querySelector('.asset-card__body > strong')?.textContent.trim()),
        categoryCounts,
        inspectorTitle: document.querySelector('.asset-inspector h2')?.textContent.trim(),
        projectCapacity: document.querySelector('.asset-storage-card header strong')?.textContent.trim(),
        realBoundary: document.querySelector('.asset-source-note')?.textContent.replace(/\\s+/gu, ' ').trim(),
        layout: {
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          workspaceBottom: Math.round(document.querySelector('.asset-library-workspace')?.getBoundingClientRect().bottom || 0),
          actionBottom: Math.round(document.querySelector('.asset-inspector__actions')?.getBoundingClientRect().bottom || 0),
        },
        bodyText: document.body.textContent,
      }
    })()`)

    assert.equal(initial.pageVisible, true)
    assert.equal(initial.activeNav, '素材')
    assert.equal(initial.cardCount, 4)
    assert.equal(initial.categoryCounts['全部素材'], 4)
    assert.equal(initial.categoryCounts['角色图片'], 1)
    assert.equal(initial.categoryCounts['分镜图片'], 1)
    assert.equal(initial.categoryCounts['角色配音'], 1)
    assert.equal(initial.categoryCounts['背景音乐'], 1)
    assert.match(initial.projectCapacity, /MB/u)
    assert.match(initial.realBoundary, /仅真实用户素材/u)
    assert.ok(initial.layout.actionBottom <= initial.layout.viewportHeight, `详情操作区超出视口：${JSON.stringify(initial.layout)}`)
    assert.equal(/模拟缩略图|模拟波形|模拟配音/u.test(initial.bodyText), true)
    assert.equal(/演示素材|随机波形|AI 自动生成素材/u.test(initial.bodyText), false)

    const interactions = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const input = document.querySelector('.asset-search input')
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      inputSetter.call(input, '月下相逢')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(60)
      const searchCount = document.querySelectorAll('.asset-card').length
      document.querySelector('.asset-search button')?.click()
      await wait(40)
      document.querySelector('.asset-view-toggle button[aria-label="列表视图"]')?.click()
      await wait(40)
      const listRows = document.querySelectorAll('.asset-table__row').length
      document.querySelector('.asset-view-toggle button[aria-label="卡片视图"]')?.click()
      await wait(40)
      const characterFilter = Array.from(document.querySelectorAll('.asset-filter-list button')).find((button) => button.textContent.includes('角色图片'))
      characterFilter.click()
      await wait(40)
      const characterCards = document.querySelectorAll('.asset-card').length
      document.querySelector('.asset-card__open')?.click()
      await wait(30)
      document.querySelector('.asset-inspector__actions .delete-action')?.click()
      await wait(30)
      const removeDialog = {
        visible: Boolean(document.querySelector('.asset-confirm-dialog--danger')),
        title: document.querySelector('#asset-remove-title')?.textContent.trim(),
        body: document.querySelector('.asset-confirm-dialog--danger')?.textContent.replace(/\\s+/gu, ' ').trim(),
      }
      Array.from(document.querySelectorAll('.asset-confirm-dialog--danger footer button')).find((button) => button.textContent.trim() === '取消')?.click()
      await wait(30)
      document.querySelector('.asset-references > button')?.click()
      await wait(80)
      return {
        searchCount,
        listRows,
        characterCards,
        removeDialog,
        locatedPage: Boolean(document.querySelector('.character-page')),
        locatedNav: document.querySelector('.topnav button.is-active')?.textContent.trim(),
      }
    })()`)

    assert.equal(interactions.searchCount, 2)
    assert.equal(interactions.listRows, 4)
    assert.equal(interactions.characterCards, 1)
    assert.equal(interactions.removeDialog.visible, true)
    assert.equal(interactions.removeDialog.title, '移除真实素材？')
    assert.match(interactions.removeDialog.body, /业务实体会保留/u)
    assert.equal(interactions.locatedPage, true)
    assert.equal(interactions.locatedNav, '角色')

    const performanceResult = await window.webContents.executeJavaScript(`(async () => {
      const waitForPage = (selector) => new Promise((resolve, reject) => {
        const startedAt = performance.now()
        const check = () => {
          if (document.querySelector(selector)) return resolve()
          if (performance.now() - startedAt > 1000) return reject(new Error('页面切换超时：' + selector))
          setTimeout(check, 0)
        }
        check()
      })
      const longTasks = []
      const observer = typeof PerformanceObserver === 'function' ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration))) : null
      try { observer?.observe({ entryTypes: ['longtask'] }) } catch {}
      const durations = { enter: [], exit: [] }
      for (let index = 0; index < 12; index += 1) {
        let start = performance.now()
        Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '素材').click()
        await waitForPage('.asset-library-page')
        durations.enter.push(performance.now() - start)
        start = performance.now()
        Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '角色').click()
        await waitForPage('.character-page')
        durations.exit.push(performance.now() - start)
      }
      observer?.disconnect()
      const percentile95 = (values) => [...values].sort((left, right) => left - right)[Math.ceil(values.length * 0.95) - 1]
      return {
        enterP95: Number(percentile95(durations.enter).toFixed(1)),
        exitP95: Number(percentile95(durations.exit).toFixed(1)),
        longTaskCount: longTasks.filter((duration) => duration >= 50).length,
        maxLongTask: Number(Math.max(0, ...longTasks).toFixed(1)),
      }
    })()`)

    assert.ok(performanceResult.enterP95 < 120, `素材库进入 P95 过高：${JSON.stringify(performanceResult)}`)
    assert.ok(performanceResult.exitP95 < 120, `素材库退出 P95 过高：${JSON.stringify(performanceResult)}`)
    assert.equal(performanceResult.longTaskCount, 0)

    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '素材').click()`)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const screenshotPath = path.join(screenshotDirectory, 'unified-asset-library.png')
    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG())

    console.log(JSON.stringify({ passed: true, screenshotPath, initial: { ...initial, bodyText: undefined }, interactions, performanceResult }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
