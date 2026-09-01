import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const testDataDirectory = path.join(process.cwd(), 'outputs', `settings-performance-user-data-${Date.now()}-${process.pid}`)
await mkdir(testDataDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]
}

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      show: true,
      skipTaskbar: true,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'home' } })

    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const nextPaint = () => new Promise((resolve) => {
        let settled = false
        const timeout = setTimeout(() => {
          if (settled) return
          settled = true
          resolve('timeout')
        }, 250)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve('raf')
        }))
      })
      await wait(220)
      const prewarmModes = []
      for (let index = 0; index < 4; index += 1) {
        const mode = await nextPaint()
        prewarmModes.push(mode)
        if (mode === 'raf') break
        await wait(40)
      }

      const longTasks = []
      let observer
      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration }))))
        observer.observe({ type: 'longtask', buffered: true })
      }

      const enter = async () => {
        const start = performance.now()
        const button = document.querySelector('[aria-label="打开设置"]')
        if (!button) throw new Error('设置入口未渲染')
        button.click()
        await nextPaint()
        const duration = performance.now() - start
        const root = document.querySelector('.settings-page--v22')
        const filteredLayers = [document.querySelector('.topbar'), ...root.querySelectorAll('*')].filter((element) => {
          const style = getComputedStyle(element)
          const backdrop = style.getPropertyValue('backdrop-filter')
          const webkitBackdrop = style.getPropertyValue('-webkit-backdrop-filter')
          return (backdrop && backdrop !== 'none') || (webkitBackdrop && webkitBackdrop !== 'none')
        }).length
        return { duration, filteredLayers, formCount: root.querySelectorAll('.settings-provider-form').length }
      }

      const exit = async () => {
        const start = performance.now()
        document.querySelector('[aria-label="返回星幕工坊工作台"]').click()
        await nextPaint()
        document.querySelector('.xm-project-section header button').click()
        await nextPaint()
        return performance.now() - start
      }

      const coldEnter = await enter()
      await wait(180)
      const coldExit = await exit()
      await wait(80)
      const measurementStart = performance.now()
      const entries = []
      const exits = []
      let maximumFilteredLayers = 0
      let maximumFormCount = 0
      for (let index = 0; index < 20; index += 1) {
        const entry = await enter()
        entries.push(entry.duration)
        maximumFilteredLayers = Math.max(maximumFilteredLayers, entry.filteredLayers)
        maximumFormCount = Math.max(maximumFormCount, entry.formCount)
        await wait(180)
        exits.push(await exit())
      }
      await wait(80)
      observer?.disconnect()
      return {
        visibilityState: document.visibilityState,
        prewarmModes,
        coldEnter: coldEnter.duration,
        coldExit,
        entries,
        exits,
        maximumFilteredLayers,
        maximumFormCount,
        longTasks: longTasks.filter((entry) => entry.startTime >= measurementStart),
      }
    })()`)

    const summary = {
      visibilityState: result.visibilityState,
      prewarmModes: result.prewarmModes,
      coldEnter: Number(result.coldEnter.toFixed(2)),
      coldExit: Number(result.coldExit.toFixed(2)),
      warmEnterAverage: Number((result.entries.reduce((total, value) => total + value, 0) / result.entries.length).toFixed(2)),
      warmEnterP95: Number(percentile(result.entries, 0.95).toFixed(2)),
      warmEnterMax: Number(Math.max(...result.entries).toFixed(2)),
      exitAverage: Number((result.exits.reduce((total, value) => total + value, 0) / result.exits.length).toFixed(2)),
      exitP95: Number(percentile(result.exits, 0.95).toFixed(2)),
      exitMax: Number(Math.max(...result.exits).toFixed(2)),
      longTaskCount: result.longTasks.length,
      maximumFilteredLayers: result.maximumFilteredLayers,
      maximumFormCount: result.maximumFormCount,
    }

    console.log(JSON.stringify({ measurement: summary, longTasks: result.longTasks }))

    assert.equal(result.entries.length, 20)
    assert.equal(result.exits.length, 20)
    assert.equal(summary.coldEnter <= 300, true)
    assert.equal(summary.warmEnterP95 <= 120, true)
    assert.equal(summary.exitP95 <= 100, true)
    assert.equal(summary.longTaskCount <= 1, true)
    assert.equal(summary.maximumFilteredLayers <= 2, true)
    assert.equal(summary.maximumFormCount, 1)

    console.log(JSON.stringify({ passed: true, summary, longTasks: result.longTasks }))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
