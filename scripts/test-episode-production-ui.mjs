import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadTestProject } from './load-test-project.mjs'

const testDataDirectory = path.join(process.cwd(), 'outputs', `episode-production-ui-test-${Date.now()}-${process.pid}`)
const runtimeDirectory = path.join(process.cwd(), 'outputs', 'runtime')
const screenshotPath = path.join(runtimeDirectory, 'episode-production-v35.png')
const migrationScreenshotPath = path.join(runtimeDirectory, 'episode-production-migration-v35.png')
await mkdir(testDataDirectory, { recursive: true })
await mkdir(runtimeDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

const audioData = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
const subtitleStyle = {
  fontSize: 52,
  color: '#ffffff',
  outlineColor: '#08243a',
  backgroundOpacity: 35,
  position: 'bottom',
  bold: true,
}
const sharedProject = {
  localProjectId: 'local-v35-ui-test',
  name: '分集制作 UI 验收',
  genre: '悬疑',
  ratio: '9:16',
  duration: '60秒',
  episodeCount: 2,
  synopsis: '验证用户真实项目的分集制作隔离。',
}
const sharedContent = {
  episodes: [
    { id: 1, title: '雾港来信' },
    { id: 2, title: '钟楼暗影' },
  ],
  scenes: [
    { id: 11, episodeId: 1, title: '雾港站台' },
    { id: 22, episodeId: 2, title: '午夜钟楼' },
  ],
  characters: [],
  shots: [
    { id: 101, episodeId: 1, sceneId: 11, variant: 1, action: '列车驶入雾港。', dialogue: '第一集镜头台词', duration: '3.0s', image: '', imageStatus: '未生成' },
    { id: 202, episodeId: 2, sceneId: 22, variant: 2, action: '钟摆突然停下。', dialogue: '第二集镜头台词', duration: '4.0s', image: '', imageStatus: '未生成' },
  ],
  videoAssets: [],
  lines: [],
}
const createTrack = (id, name) => ({
  id,
  kind: 'bgm',
  name,
  fileName: `${name}.wav`,
  audio: audioData,
  start: 0,
  duration: 4,
  volume: 35,
  fadeIn: 0,
  fadeOut: 0,
  waveform: [0.2, 0.5, 0.8, 0.4],
})
const createCue = (id, text, end) => ({
  id,
  sourceItemId: '',
  start: 0,
  end,
  text,
})

const v2Snapshot = {
  format: 'manju-project',
  version: 2,
  savedAt: '2026-07-23T00:00:00.000Z',
  project: sharedProject,
  content: {
    ...sharedContent,
    episodeProductions: [
      {
        episodeId: 1,
        audioTracks: [createTrack(1, '第一集雨声')],
        subtitleCues: [createCue('ep1-cue', '第一集独立字幕', 2.5)],
        subtitleCuesInitialized: true,
        subtitleStyle,
      },
      {
        episodeId: 2,
        audioTracks: [createTrack(1, '第二集钟声')],
        subtitleCues: [createCue('ep2-cue', '第二集独立字幕', 3.5)],
        subtitleCuesInitialized: true,
        subtitleStyle: { ...subtitleStyle, position: 'top' },
      },
    ],
  },
}

const v1Snapshot = {
  format: 'manju-project',
  version: 1,
  savedAt: '2026-07-22T00:00:00.000Z',
  project: { ...sharedProject, localProjectId: 'local-v35-legacy-ui-test', name: '旧版多集成片迁移验收' },
  content: {
    ...sharedContent,
    audioTracks: [createTrack(9, '旧版全片音乐')],
    subtitleCues: [createCue('legacy-cue', '旧版全片字幕', 3.5)],
    subtitleCuesInitialized: true,
    subtitleStyle,
  },
}

app.on('ready', async () => {
  try {
    const window = new BrowserWindow({
      width: 1500,
      height: 980,
      show: false,
      backgroundColor: '#dff5ff',
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    await loadTestProject(window, 'final', v2Snapshot)
    const v2Result = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      for (let attempt = 0; attempt < 40 && !document.querySelector('.episode-scope-selector'); attempt += 1) await wait(80)
      document.querySelector('.final-one-click-center header .secondary-button').click()
      await wait(80)
      const setNativeValue = (element, value) => {
        const prototype = element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
        element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
      }
      const readScope = () => ({
        selectorValue: document.querySelector('.episode-scope-selector select')?.value,
        selectorText: document.querySelector('.episode-scope-selector')?.textContent.trim(),
        timelineTitle: document.querySelector('.production-timeline-header h2')?.textContent.trim(),
        shotIds: Array.from(document.querySelectorAll('.timeline-segment')).map((node) => node.dataset.shotId),
        subtitle: document.querySelector('.subtitle-cue-text')?.value,
        audioName: document.querySelector('.audio-track-name')?.value,
        exportLabel: document.querySelector('.export-mp4-button')?.textContent.trim(),
      })

      const episodeOneBefore = readScope()
      setNativeValue(document.querySelector('.subtitle-cue-text'), '第一集已编辑字幕')
      await wait(80)
      setNativeValue(document.querySelector('.episode-scope-selector select'), 'episode:2')
      await wait(180)
      const episodeTwoBefore = readScope()
      setNativeValue(document.querySelector('.subtitle-cue-text'), '第二集已编辑字幕')
      await wait(80)
      setNativeValue(document.querySelector('.episode-scope-selector select'), 'episode:1')
      await wait(180)
      const episodeOneAfter = readScope()
      await wait(1000)
      const saved = JSON.parse(localStorage.getItem('manju-creation.autosave.v1'))
      return {
        episodeOneBefore,
        episodeTwoBefore,
        episodeOneAfter,
        savedVersion: saved.version,
        savedProductions: saved.content.episodeProductions.map((production) => ({
          episodeId: production.episodeId,
          subtitle: production.subtitleCues[0]?.text,
          audioName: production.audioTracks[0]?.name,
        })),
        noLegacyDialog: !document.querySelector('.episode-migration-dialog'),
      }
    })()`)

    assert.equal(v2Result.episodeOneBefore.selectorValue, 'episode:1')
    assert.deepEqual(v2Result.episodeOneBefore.shotIds, ['101'])
    assert.equal(v2Result.episodeOneBefore.subtitle, '第一集独立字幕')
    assert.equal(v2Result.episodeOneBefore.audioName, '第一集雨声')
    assert.equal(v2Result.episodeOneBefore.exportLabel.includes('导出本集 MP4'), true)
    assert.equal(v2Result.episodeTwoBefore.selectorValue, 'episode:2')
    assert.deepEqual(v2Result.episodeTwoBefore.shotIds, ['202'])
    assert.equal(v2Result.episodeTwoBefore.subtitle, '第二集独立字幕')
    assert.equal(v2Result.episodeTwoBefore.audioName, '第二集钟声')
    assert.equal(v2Result.episodeOneAfter.subtitle, '第一集已编辑字幕')
    assert.equal(v2Result.savedVersion, 2)
    assert.deepEqual(v2Result.savedProductions, [
      { episodeId: 1, subtitle: '第一集已编辑字幕', audioName: '第一集雨声' },
      { episodeId: 2, subtitle: '第二集已编辑字幕', audioName: '第二集钟声' },
    ])
    assert.equal(v2Result.noLegacyDialog, true)
    await writeFile(screenshotPath, await window.webContents.capturePage().then((image) => image.toPNG()))

    await window.webContents.executeJavaScript(`localStorage.setItem('manju-creation.autosave.v1', ${JSON.stringify(JSON.stringify(v1Snapshot))})`)
    await window.loadFile(path.join(process.cwd(), 'dist', 'index.html'), { query: { page: 'final' } })
    const migrationVisible = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      for (let attempt = 0; attempt < 40 && !document.querySelector('.episode-migration-dialog'); attempt += 1) await wait(80)
      await wait(320)
      const dialog = document.querySelector('.episode-migration-dialog')
      const bounds = dialog?.getBoundingClientRect()
      return {
        visible: Boolean(dialog),
        title: dialog?.querySelector('h2')?.textContent.trim(),
        facts: document.querySelector('.episode-migration-facts')?.textContent.trim(),
        layerZIndex: getComputedStyle(document.querySelector('.episode-migration-layer')).zIndex,
        layerOpacity: getComputedStyle(document.querySelector('.episode-migration-layer')).opacity,
        dialogOpacity: getComputedStyle(dialog).opacity,
        dialogBackground: getComputedStyle(dialog).backgroundImage,
        centerStack: bounds ? document.elementsFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2).slice(0, 5).map((node) => node.className || node.tagName) : [],
      }
    })()`)
    assert.equal(migrationVisible.visible, true)
    assert.equal(migrationVisible.title, '旧版成片已安全保留')
    assert.equal(migrationVisible.facts.includes('1 条字幕 · 1 条音轨'), true)
    await writeFile(migrationScreenshotPath, await window.webContents.capturePage().then((image) => image.toPNG()))

    const legacyResult = await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.episode-migration-dialog footer .secondary-button').click()
      await wait(160)
      const legacy = {
        selectorValue: document.querySelector('.episode-scope-selector select')?.value,
        readOnly: document.querySelector('.production-timeline')?.classList.contains('is-legacy-readonly'),
        audioName: document.querySelector('.audio-track-name')?.value,
        subtitle: document.querySelector('.subtitle-cue-text')?.value,
        exportLabel: document.querySelector('.export-mp4-button')?.textContent.trim(),
      }
      const selector = document.querySelector('.episode-scope-selector select')
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selector, 'episode:1')
      selector.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(180)
      return {
        legacy,
        episode: {
          selectorValue: selector.value,
          readOnly: document.querySelector('.production-timeline')?.classList.contains('is-legacy-readonly'),
          audioCount: document.querySelectorAll('.audio-track-row').length,
          subtitle: document.querySelector('.subtitle-cue-text')?.value,
          shotIds: Array.from(document.querySelectorAll('.timeline-segment')).map((node) => node.dataset.shotId),
        },
      }
    })()`)
    assert.equal(legacyResult.legacy.selectorValue, 'legacy')
    assert.equal(legacyResult.legacy.readOnly, true)
    assert.equal(legacyResult.legacy.audioName, '旧版全片音乐')
    assert.equal(legacyResult.legacy.subtitle, '旧版全片字幕')
    assert.equal(legacyResult.legacy.exportLabel.includes('导出旧版全片 MP4'), true)
    assert.equal(legacyResult.episode.selectorValue, 'episode:1')
    assert.equal(legacyResult.episode.readOnly, false)
    assert.equal(legacyResult.episode.audioCount, 0)
    assert.equal(legacyResult.episode.subtitle, '第一集镜头台词')
    assert.deepEqual(legacyResult.episode.shotIds, ['101'])

    console.log(JSON.stringify({
      passed: true,
      v2Result,
      migrationVisible,
      legacyResult,
      screenshots: [screenshotPath, migrationScreenshotPath],
    }, null, 2))
    window.destroy()
    app.quit()
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
