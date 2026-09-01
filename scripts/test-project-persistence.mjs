import { app, BrowserWindow } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  getProjectSnapshotByteSize,
  maximumProjectBytes,
  readProjectSnapshot,
} from '../src/services/projectModel.js'

const createTestWavBase64 = () => {
  const sampleRate = 8000
  const sampleCount = 3200
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer.toString('base64')
}

const testWavBase64 = createTestWavBase64()
const testDataDirectory = path.join(process.cwd(), 'outputs', `ipc-test-user-data-${Date.now()}-${process.pid}`)
await mkdir(testDataDirectory, { recursive: true })
app.setPath('userData', testDataDirectory)
app.disableHardwareAcceleration()

await import('../main.js')

app.whenReady().then(async () => {
  try {
    let applicationWindow
    for (let attempt = 0; attempt < 40; attempt += 1) {
      applicationWindow = BrowserWindow.getAllWindows()[0]
      if (applicationWindow && !applicationWindow.webContents.isLoading()) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (!applicationWindow) throw new Error('应用窗口未创建')
    const clickWhenReady = async (selector, stage, timeout = 1600) => {
      await applicationWindow.webContents.executeJavaScript(`(async () => {
        const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
        const deadline = Date.now() + ${timeout}
        window.__testStage = ${JSON.stringify(stage)}
        let element = document.querySelector(${JSON.stringify(selector)})
        while (!element && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(${JSON.stringify(selector)})
        }
        if (!element) {
          throw new Error('Timed out waiting for ' + ${JSON.stringify(selector)})
        }
        element.click()
      })()`)
    }
    const snapshot = {
      format: 'manju-project',
      version: 1,
      savedAt: new Date().toISOString(),
      project: {
        name: 'IPC 持久化测试',
        genre: '悬疑',
        ratio: '9:16',
        duration: '60秒',
        episodeCount: 1,
        synopsis: '验证主进程项目存储。',
      },
      content: {
        episodes: [{ id: 1, title: '测试剧集', variant: 1, statuses: ['剧本'] }],
        scenes: [{ id: 1, episodeId: 1, title: '测试场景' }],
        characters: [
          { id: 1, name: '沈砚', role: '测试角色', variant: 1, tone: '测试音色', relation: '测试关系' },
          { id: 2, name: '林听雨', role: '测试角色', variant: 2, tone: '测试音色', relation: '测试关系' },
        ],
        shots: [],
        lines: [],
        audioTracks: [],
      },
    }

    const serializedSnapshot = JSON.stringify(snapshot)
    const sizeProbeSnapshot = {
      ...snapshot,
      content: {
        ...snapshot.content,
        shots: [{ id: 1, image: 'data:image/png;base64,测试字节' }],
      },
    }
    const sizePreflightPassed = getProjectSnapshotByteSize(sizeProbeSnapshot) === Buffer.byteLength(JSON.stringify(sizeProbeSnapshot, null, 2), 'utf8')
      && getProjectSnapshotByteSize({ ...sizeProbeSnapshot, padding: 'x'.repeat(maximumProjectBytes) }) > maximumProjectBytes
    const migratedLegacy = readProjectSnapshot({
      ...snapshot,
      content: {
        ...snapshot.content,
        scenes: [{ id: 1, title: '旧版场景' }],
        shots: [{ id: 1, action: '旧版分镜' }],
        lines: [{ id: 1, scene: '旧版场景', speaker: '沈砚', text: '旧版台词' }],
      },
    }, {
      projectMeta: { name: '', genre: '', ratio: '', duration: '' },
      storySeed: '',
      episodes: [{ id: 9, title: '回退剧集' }],
      scenes: [{ id: 9, episodeId: 9, title: '回退场景' }],
      characters: [{ id: 1, name: '回退角色' }],
      shots: [],
      lines: [],
    })
    const migrationPassed = migratedLegacy.scenes[0].episodeId === 1
      && migratedLegacy.scenes[0].action === ''
      && migratedLegacy.scenes[0].narration === ''
      && migratedLegacy.scenes[0].weather === ''
      && Array.isArray(migratedLegacy.scenes[0].mainCharacterIds)
      && migratedLegacy.scenes[0].mainCharacterIds.length === 0
      && migratedLegacy.shots[0].episodeId === 1
      && migratedLegacy.shots[0].sceneId === 1
      && migratedLegacy.shots[0].visualPrompt.length > 20
      && migratedLegacy.shots[0].costume === '角色默认服装'
      && migratedLegacy.shots[0].continuityLocked === true
      && migratedLegacy.shots[0].image === ''
      && migratedLegacy.shots[0].imageStatus === '未生成'
      && migratedLegacy.shots[0].imageAttempt === 0
      && migratedLegacy.shots[0].motionEffect === 'none'
      && migratedLegacy.shots[0].motionStrength === 12
      && migratedLegacy.shots[0].transition === 'fade'
      && migratedLegacy.shots[0].transitionDuration === 0.25
      && migratedLegacy.lines[0].episodeId === 1
      && migratedLegacy.lines[0].sceneId === 1
      && migratedLegacy.lines[0].audio === ''
      && migratedLegacy.lines[0].audioStatus === '未生成'
      && migratedLegacy.lines[0].audioAttempt === 0
      && migratedLegacy.audioTracks.length === 0
      && migratedLegacy.subtitleCues.length === 0
      && migratedLegacy.subtitleStyle.fontSize === 52
      && migratedLegacy.subtitleStyle.position === 'bottom'
    const duplicatedTrackSnapshot = readProjectSnapshot({
      ...snapshot,
      content: {
        ...snapshot.content,
        audioTracks: Array.from({ length: 8 }, (_, index) => ({
          id: index + 1,
          kind: index ? 'sfx' : 'bgm',
          name: `复制音轨 ${index + 1}`,
          start: index,
          duration: 1,
        })),
      },
    }, {
      projectMeta: { name: '', genre: '', ratio: '', duration: '' },
      storySeed: '',
      episodes: snapshot.content.episodes,
      scenes: snapshot.content.scenes,
      characters: [],
      shots: [],
      lines: [],
      audioTracks: [],
      subtitleCues: [],
      subtitleStyle: {},
    })
    const duplicatedTracksPersisted = duplicatedTrackSnapshot.audioTracks.length === 8
    const saveResult = await applicationWindow.webContents.executeJavaScript(
      `window.manjuDesktop.saveAutosave(${serializedSnapshot})`,
    )
    const loadResult = await applicationWindow.webContents.executeJavaScript(
      'window.manjuDesktop.loadAutosave()',
    )

    await applicationWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'), {
      query: { page: 'overview' },
    })
    const uiResult = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      await wait(300)
      window.__testStage = 'overview-add-episode'
      const episodeBefore = document.querySelectorAll('.episode-row').length
      document.querySelector('.episode-panel > .dashed-button').click()
      await wait(100)
      const episodeAfter = document.querySelectorAll('.episode-row').length
      window.__testStage = 'navigate-script'
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '剧本').click()
      await wait(100)
      const sceneBefore = document.querySelectorAll('.context-list > button').length
      document.querySelector('.scene-list > .primary-button').click()
      await wait(100)
      const sceneAfter = document.querySelectorAll('.context-list > button').length
      window.__testStage = 'script-add-dialogue'
      const scriptLineBefore = document.querySelectorAll('.dialogue-edit-row').length
      document.querySelector('.script-dialogue-add-button').click()
      await wait(100)
      const scriptLineAfter = document.querySelectorAll('.dialogue-edit-row').length
      const scriptLineInput = document.querySelector('.dialogue-edit-row input')
      const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      const selectValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      inputValueSetter.call(scriptLineInput, '跨页同步台词')
      scriptLineInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(100)
      const textareaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      const actionInput = document.querySelector('.scene-action-input')
      textareaValueSetter.call(actionInput, '推开仓库大门。发现地面上的线索。')
      actionInput.dispatchEvent(new Event('input', { bubbles: true }))
      const narrationInput = document.querySelector('.scene-narration-input')
      textareaValueSetter.call(narrationInput, '真相就在门后。')
      narrationInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(100)
      window.__testStage = 'create-storyboard-draft'
      const storyboardDraftButton = document.querySelector('.storyboard-draft-button')
      if (!storyboardDraftButton) throw new Error('分镜草稿按钮不存在；当前页面：' + document.querySelector('main')?.className)
      storyboardDraftButton.click()
      await wait(150)
      const generatedPrompt = document.querySelector('.shot-prompt-input').value
      const generatedPromptHasBindings = generatedPrompt.includes('推开仓库大门') && generatedPrompt.includes('沈砚')
      const promptInput = document.querySelector('.shot-prompt-input')
      textareaValueSetter.call(promptInput, '自定义电影感画面提示词')
      promptInput.dispatchEvent(new Event('input', { bubbles: true }))
      const costumeInput = document.querySelector('.shot-costume-input')
      inputValueSetter.call(costumeInput, '深色风衣')
      costumeInput.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelectorAll('.continuity-character-list > button')[1].click()
      const continuityLocked = document.querySelector('.continuity-lock-button').classList.contains('is-locked')
      await wait(100)
      const imageBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII='), (character) => character.charCodeAt(0))
      const imageFile = new File([imageBytes], 'test-shot.png', { type: 'image/png' })
      const imageTransfer = new DataTransfer()
      imageTransfer.items.add(imageFile)
      const imageInput = document.querySelector('.shot-image-file-input')
      imageInput.files = imageTransfer.files
      imageInput.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(150)
      const importedImageVisible = Boolean(document.querySelector('.shot-asset-preview img'))
      const importedImageStatus = document.querySelector('.shot-asset-preview .shot-image-status').textContent.trim()
      document.querySelector('.batch-image-button').click()
      await wait(1900)
      const completedImageTasks = Array.from(document.querySelectorAll('.shot-card .shot-image-status')).filter((status) => status.textContent.trim() === '已完成').length
      const shotBefore = document.querySelectorAll('.shot-card').length
      const draftShotCount = shotBefore
      document.querySelector('.add-shot-button').click()
      await wait(100)
      const shotAfter = document.querySelectorAll('.shot-card').length
      window.__testStage = 'navigate-voice'
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '配音').click()
      await wait(150)
      const lineBefore = document.querySelectorAll('.voice-line').length
      const syncedLineText = document.querySelector('.voice-line input')?.value
      const audioBytes = Uint8Array.from(atob(${JSON.stringify(testWavBase64)}), (character) => character.charCodeAt(0))
      const audioFile = new File([audioBytes], 'test-voice.wav', { type: 'audio/wav' })
      const audioTransfer = new DataTransfer()
      audioTransfer.items.add(audioFile)
      const audioInput = document.querySelector('.line-audio-file-input')
      audioInput.files = audioTransfer.files
      audioInput.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(150)
      const importedAudioStatus = document.querySelector('.voice-line .audio-source-badge').textContent.trim()
      document.querySelector('.dialogue-add-button').click()
      await wait(100)
      const lineAfter = document.querySelectorAll('.voice-line').length
      document.querySelector('.batch-voice-button').click()
      await wait(1900)
      const completedAudioTasks = Array.from(document.querySelectorAll('.voice-line .audio-source-badge')).filter((status) => ['本地音频', '演示完成'].includes(status.textContent.trim())).length
      window.__testStage = 'navigate-character'
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '角色').click()
      await wait(100)
      const characterBefore = document.querySelectorAll('.character-list > button').length
      document.querySelector('.character-index > .primary-button').click()
      await wait(1000)
      const characterAfter = document.querySelectorAll('.character-list > button').length
      window.__testStage = 'navigate-final'
      Array.from(document.querySelectorAll('.topnav button')).find((button) => button.textContent.trim() === '成片').click()
      await wait(200)
      document.querySelector('.final-one-click-center header .secondary-button').click()
      await wait(80)
      const timelineSegments = Array.from(document.querySelectorAll('.timeline-segment'))
      const timelineSelectButtons = Array.from(document.querySelectorAll('.timeline-segment__select'))
      const timelineSegmentCount = timelineSegments.length
      const shotEditControlsAvailable = document.querySelectorAll('.timeline-segment__drag').length === timelineSegmentCount
        && document.querySelectorAll('.timeline-duration-handle').length === timelineSegmentCount
      const initialShotOrder = timelineSegments.map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-segment__drag').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
      await wait(100)
      const shotOrderAfterKeyboard = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-undo-button').click()
      await wait(100)
      const shotOrderAfterKeyboardUndo = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-redo-button').click()
      await wait(100)
      const shotOrderAfterKeyboardRedo = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-undo-button').click()
      await wait(100)
      const durationHandle = document.querySelector('.timeline-duration-handle')
      const durationBeforeKeyboard = Number(durationHandle.getAttribute('aria-valuenow'))
      durationHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await wait(100)
      const durationAfterKeyboard = Number(document.querySelector('.timeline-duration-handle').getAttribute('aria-valuenow'))
      document.querySelector('.timeline-undo-button').click()
      await wait(100)
      const durationAfterKeyboardUndo = Number(document.querySelector('.timeline-duration-handle').getAttribute('aria-valuenow'))
      document.querySelector('.timeline-redo-button').click()
      await wait(100)
      const durationAfterKeyboardRedo = Number(document.querySelector('.timeline-duration-handle').getAttribute('aria-valuenow'))
      document.querySelector('.timeline-undo-button').click()
      await wait(100)
      const multiSelectToggle = document.querySelector('.timeline-multiselect-toggle')
      const batchEditingAvailable = Boolean(multiSelectToggle)
      window.__testStage = 'timeline-batch-edit'
      multiSelectToggle.click()
      await wait(100)
      const batchBarVisible = Boolean(document.querySelector('.timeline-batch-editor'))
      const batchSelectionCountAfterToggle = document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
      document.querySelectorAll('.timeline-selection-control')[1].click()
      await wait(100)
      const batchSelectionCount = document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
      const batchDurationBefore = Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow')))
      const batchDurationInput = document.querySelector('.timeline-batch-duration input')
      inputValueSetter.call(batchDurationInput, '3.4')
      batchDurationInput.dispatchEvent(new Event('input', { bubbles: true }))
      const batchMotionSelect = document.querySelector('.timeline-batch-motion')
      selectValueSetter.call(batchMotionSelect, 'zoom-out')
      batchMotionSelect.dispatchEvent(new Event('change', { bubbles: true }))
      const batchStrengthInput = document.querySelector('.timeline-batch-strength input')
      inputValueSetter.call(batchStrengthInput, '20')
      batchStrengthInput.dispatchEvent(new Event('input', { bubbles: true }))
      const batchTransitionSelect = document.querySelector('.timeline-batch-transition')
      selectValueSetter.call(batchTransitionSelect, 'fade')
      batchTransitionSelect.dispatchEvent(new Event('change', { bubbles: true }))
      const batchTransitionDurationInput = document.querySelector('.timeline-batch-transition-duration input')
      inputValueSetter.call(batchTransitionDurationInput, '0.4')
      batchTransitionDurationInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(80)
      const batchApplyEnabled = !document.querySelector('.timeline-batch-apply').disabled
      document.querySelector('.timeline-batch-apply').click()
      await wait(140)
      const batchDurationAfterApply = Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow')))
      const batchMotionAfterApply = document.querySelector('.shot-motion-preset').value
      const batchStrengthAfterApply = Number(document.querySelector('.shot-motion-strength-input').value)
      const batchTransitionAfterApply = document.querySelector('.shot-transition-select').value
      const batchTransitionDurationAfterApply = Number(document.querySelector('.shot-transition-duration').value)
      document.querySelector('.timeline-undo-button').click()
      await wait(120)
      const batchDurationAfterUndo = Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow')))
      document.querySelector('.timeline-redo-button').click()
      await wait(120)
      const batchDurationAfterRedo = Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow')))
      document.querySelector('.timeline-undo-button').click()
      await wait(120)
      const groupOrderBeforeKeyboard = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-segment.is-batch-selected .timeline-segment__drag').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true }))
      await wait(120)
      const groupOrderAfterKeyboard = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      const groupSelectionCountAfterKeyboard = document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
      document.querySelector('.timeline-undo-button').click()
      await wait(120)
      const groupOrderAfterKeyboardUndo = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-redo-button').click()
      await wait(120)
      const groupOrderAfterKeyboardRedo = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.timeline-undo-button').click()
      await wait(120)
      const deletionOrderBeforeCancel = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      window.__testStage = 'timeline-delete-cancel'
      document.querySelector('.timeline-batch-delete').click()
      await wait(100)
      const deletionModalAvailable = Boolean(document.querySelector('.shot-delete-modal'))
      const deletionModalTitle = document.querySelector('.shot-delete-header h2')?.textContent.trim()
      const deletionModalStats = Array.from(document.querySelectorAll('.shot-delete-stats b')).map((node) => Number(node.textContent))
      const deletionCancelHasFocus = document.activeElement?.textContent.trim() === '取消'
      document.querySelector('.shot-delete-actions .secondary-button').click()
      await wait(80)
      const deletionOrderAfterCancel = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.production-timeline').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
      await wait(100)
      const deletionKeyboardModalAvailable = Boolean(document.querySelector('.shot-delete-modal'))
      document.querySelector('.shot-delete-actions .secondary-button').click()
      await wait(80)
      document.querySelector('.production-timeline').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
      await wait(80)
      const batchSelectionCountAfterSelectAllShortcut = document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
      document.querySelector('.timeline-batch-clear').click()
      await wait(80)
      const batchSelectionCountAfterClear = document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
      document.querySelector('.timeline-multiselect-toggle')?.click()
      await wait(80)
      const batchBarHiddenAfterExit = !document.querySelector('.timeline-batch-editor')
      document.querySelectorAll('.timeline-segment__select')[0].click()
      await wait(100)
      const motionControlsAvailable = Boolean(document.querySelector('.shot-motion-preset') && document.querySelector('.shot-motion-strength-input') && document.querySelector('.shot-transition-select') && document.querySelector('.shot-transition-duration') && document.querySelector('.shot-motion-apply-all'))
      const motionPreset = document.querySelector('.shot-motion-preset')
      const originalMotionPreset = motionPreset.value
      const targetMotionPreset = originalMotionPreset === 'pan-left' ? 'pan-right' : 'pan-left'
      selectValueSetter.call(motionPreset, targetMotionPreset)
      motionPreset.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(100)
      const motionPresetAfterChange = document.querySelector('.shot-motion-preset').value
      document.querySelector('.timeline-undo-button').click()
      await wait(100)
      const motionPresetAfterUndo = document.querySelector('.shot-motion-preset').value
      document.querySelector('.timeline-redo-button').click()
      await wait(100)
      const motionPresetAfterRedo = document.querySelector('.shot-motion-preset').value
      const motionStrengthInput = document.querySelector('.shot-motion-strength-input')
      inputValueSetter.call(motionStrengthInput, '18')
      motionStrengthInput.dispatchEvent(new Event('input', { bubbles: true }))
      const transitionSelect = document.querySelector('.shot-transition-select')
      selectValueSetter.call(transitionSelect, 'fade')
      transitionSelect.dispatchEvent(new Event('change', { bubbles: true }))
      const transitionDurationInput = document.querySelector('.shot-transition-duration')
      inputValueSetter.call(transitionDurationInput, '0.35')
      transitionDurationInput.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(100)
      const originalConfirm = window.confirm
      window.confirm = () => true
      window.__testStage = 'timeline-motion'
      document.querySelector('.shot-motion-apply-all').click()
      await wait(100)
      window.confirm = originalConfirm
      const motionReadyCount = document.querySelectorAll('.timeline-motion-status.is-ready').length
      const motionExportSummary = document.querySelector('.motion-export-summary')?.textContent.trim()
      const motionTransformStart = document.querySelector('.motion-preview-art')?.style.transform
      const motionSeek = document.querySelector('.timeline-seek')
      inputValueSetter.call(motionSeek, '1.2')
      motionSeek.dispatchEvent(new Event('input', { bubbles: true }))
      await wait(100)
      const motionTransformAfterSeek = document.querySelector('.motion-preview-art')?.style.transform
      const motionPreviewTransformChanged = Boolean(motionTransformStart && motionTransformAfterSeek && motionTransformStart !== motionTransformAfterSeek)
      const timelineTotalText = document.querySelector('.timeline-total')?.textContent.trim()
      const imageReadinessText = document.querySelector('.readiness-image')?.textContent.trim()
      const audioReadinessText = document.querySelector('.readiness-audio')?.textContent.trim()
      const subtitleReadinessText = document.querySelector('.readiness-subtitle')?.textContent.trim()
      const exportBridgeAvailable = typeof window.manjuDesktop.exportVideo === 'function'
      const exportManagementBridgeAvailable = typeof window.manjuDesktop.cancelVideoExport === 'function' && typeof window.manjuDesktop.listVideoExports === 'function' && typeof window.manjuDesktop.revealVideoExport === 'function'
      const exportButtonText = document.querySelector('.export-mp4-button')?.textContent.trim()
      const exportHistoryVisible = Boolean(document.querySelector('.export-history'))
      const subtitleBridgeAvailable = typeof window.manjuDesktop.importSubtitles === 'function' && typeof window.manjuDesktop.exportSubtitles === 'function'
      const subtitleCueCountBefore = document.querySelectorAll('.subtitle-cue-list article').length
      const firstSubtitleText = document.querySelector('.subtitle-cue-text')
      textareaValueSetter.call(firstSubtitleText, '自定义时间轴字幕')
      firstSubtitleText.dispatchEvent(new Event('input', { bubbles: true }))
      const subtitleFontSize = document.querySelector('.subtitle-font-size')
      inputValueSetter.call(subtitleFontSize, '64')
      subtitleFontSize.dispatchEvent(new Event('input', { bubbles: true }))
      const subtitleColor = document.querySelector('.subtitle-color')
      inputValueSetter.call(subtitleColor, '#ffeeaa')
      subtitleColor.dispatchEvent(new Event('input', { bubbles: true }))
      const subtitlePosition = document.querySelector('.subtitle-position')
      selectValueSetter.call(subtitlePosition, 'top')
      subtitlePosition.dispatchEvent(new Event('change', { bubbles: true }))
      const subtitleOpacity = document.querySelector('.subtitle-background-opacity')
      inputValueSetter.call(subtitleOpacity, '55')
      subtitleOpacity.dispatchEvent(new Event('input', { bubbles: true }))
      window.__testStage = 'timeline-subtitles'
      document.querySelector('.subtitle-add-button').click()
      await wait(100)
      const subtitleCueCountAfterAdd = document.querySelectorAll('.subtitle-cue-list article').length
      document.querySelector('.subtitle-cue-list article.is-selected > button').click()
      await wait(100)
      const subtitleCueCountAfterDelete = document.querySelectorAll('.subtitle-cue-list article').length
      const firstSubtitleBlock = document.querySelector('.subtitle-cue-block')
      firstSubtitleBlock.click()
      await wait(100)
      firstSubtitleBlock.focus()
      firstSubtitleBlock.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await wait(100)
      const subtitleStartAfterKeyboard = Number(document.querySelector('.subtitle-cue-start')?.value)
      document.querySelector('.subtitle-split-button').click()
      await wait(100)
      const subtitleCueCountAfterSplit = document.querySelectorAll('.subtitle-cue-list article').length
      document.querySelector('.subtitle-merge-button').click()
      await wait(100)
      const subtitleCueCountAfterMerge = document.querySelectorAll('.subtitle-cue-list article').length
      const subtitleOffsetInput = document.querySelector('.subtitle-offset-input')
      inputValueSetter.call(subtitleOffsetInput, '-0.5')
      subtitleOffsetInput.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.subtitle-offset-button').click()
      await wait(100)
      const subtitleSecondStartAfterOffset = Number(document.querySelectorAll('.subtitle-cue-start')[1]?.value)
      const subtitleRailSegmentCount = document.querySelectorAll('.subtitle-cue-block').length
      const subtitleResizeHandleCount = document.querySelectorAll('.subtitle-resize-handle').length
      const subtitleButtonsAvailable = Boolean(document.querySelector('.subtitle-import-button') && document.querySelector('.subtitle-export-button') && document.querySelector('.subtitle-rebuild-button'))
      const sampleRate = 8000
      const sampleCount = Math.round(sampleRate * 0.4)
      const wavBuffer = new ArrayBuffer(44 + sampleCount * 2)
      const wavView = new DataView(wavBuffer)
      const writeAscii = (offset, value) => Array.from(value).forEach((character, index) => wavView.setUint8(offset + index, character.charCodeAt(0)))
      writeAscii(0, 'RIFF')
      wavView.setUint32(4, 36 + sampleCount * 2, true)
      writeAscii(8, 'WAVE')
      writeAscii(12, 'fmt ')
      wavView.setUint32(16, 16, true)
      wavView.setUint16(20, 1, true)
      wavView.setUint16(22, 1, true)
      wavView.setUint32(24, sampleRate, true)
      wavView.setUint32(28, sampleRate * 2, true)
      wavView.setUint16(32, 2, true)
      wavView.setUint16(34, 16, true)
      writeAscii(36, 'data')
      wavView.setUint32(40, sampleCount * 2, true)
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const envelope = 0.12 + (sampleIndex / sampleCount) * 0.88
        wavView.setInt16(44 + sampleIndex * 2, Math.round(Math.sin((2 * Math.PI * 330 * sampleIndex) / sampleRate) * 9000 * envelope), true)
      }
      const bgmFile = new File([wavBuffer], 'test-bgm.wav', { type: 'audio/wav' })
      const bgmTransfer = new DataTransfer()
      bgmTransfer.items.add(bgmFile)
      const bgmInput = document.querySelector('.bgm-file-input')
      bgmInput.files = bgmTransfer.files
      bgmInput.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(1400)
      const audioTrackCount = document.querySelectorAll('.audio-track-row').length
      const audioTrackName = document.querySelector('.audio-track-name')?.value
      const audioTrackVolume = document.querySelector('.audio-track-volume')?.value
      const waveformBarCount = document.querySelectorAll('.audio-track-waveform > b').length
      const waveformHeightCount = new Set(Array.from(document.querySelectorAll('.audio-track-waveform > b')).map((bar) => bar.style.height)).size
      const originalMediaPlay = HTMLMediaElement.prototype.play
      window.__mediaPlayCallCount = 0
      HTMLMediaElement.prototype.play = function () {
        window.__mediaPlayCallCount += 1
        return Promise.resolve()
      }
      const previewButton = document.querySelector('.audio-track-actions > button')
      window.__testStage = 'timeline-audio-preview'
      previewButton.click()
      await wait(80)
      const audioTrackPreviewActive = previewButton.classList.contains('is-playing')
      previewButton.click()
      await wait(30)
      const audioTrackPreviewStopped = !previewButton.classList.contains('is-playing')
      const audioTrackRail = document.querySelector('.audio-track-rail')
      audioTrackRail.focus()
      audioTrackRail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await wait(100)
      const audioTrackStartAfterKeyboard = Number(document.querySelector('.audio-track-start')?.value)
      document.querySelectorAll('.timeline-segment__select')[1].click()
      await wait(100)
      const selectedTimelineSubtitle = document.querySelector('.vertical-frame > span')?.textContent.trim()
      const seekValue = document.querySelector('.timeline-seek')?.value
      document.querySelector('.final-preview .round-play').click()
      await wait(350)
      const advancedSeekValue = document.querySelector('.timeline-seek')?.value
      document.querySelector('.final-preview .round-play').click()
      const mediaPlayCallCount = window.__mediaPlayCallCount
      HTMLMediaElement.prototype.play = originalMediaPlay
      delete window.__mediaPlayCallCount
      const subtitlePreviewTop = Boolean(document.querySelector('.subtitle-preview--top'))
      const subtitlePreviewFontSize = document.querySelector('.subtitle-preview')?.style.fontSize
      return { episodeBefore, episodeAfter, sceneBefore, sceneAfter, scriptLineBefore, scriptLineAfter, syncedLineText, generatedPromptHasBindings, continuityLocked, importedImageVisible, importedImageStatus, completedImageTasks, importedAudioStatus, completedAudioTasks, draftShotCount, shotBefore, shotAfter, lineBefore, lineAfter, characterBefore, characterAfter, timelineSegmentCount, shotEditControlsAvailable, initialShotOrder, shotOrderAfterKeyboard, shotOrderAfterKeyboardUndo, shotOrderAfterKeyboardRedo, durationBeforeKeyboard, durationAfterKeyboard, durationAfterKeyboardUndo, durationAfterKeyboardRedo, batchEditingAvailable, batchBarVisible, batchSelectionCountAfterToggle, batchSelectionCount, batchDurationBefore, batchApplyEnabled, batchDurationAfterApply, batchMotionAfterApply, batchStrengthAfterApply, batchTransitionAfterApply, batchTransitionDurationAfterApply, batchDurationAfterUndo, batchDurationAfterRedo, groupOrderBeforeKeyboard, groupOrderAfterKeyboard, groupSelectionCountAfterKeyboard, groupOrderAfterKeyboardUndo, groupOrderAfterKeyboardRedo, deletionOrderBeforeCancel, deletionModalAvailable, deletionModalTitle, deletionModalStats, deletionCancelHasFocus, deletionOrderAfterCancel, deletionKeyboardModalAvailable, batchSelectionCountAfterSelectAllShortcut, batchSelectionCountAfterClear, batchBarHiddenAfterExit, motionControlsAvailable, originalMotionPreset, targetMotionPreset, motionPresetAfterChange, motionPresetAfterUndo, motionPresetAfterRedo, motionReadyCount, motionExportSummary, motionPreviewTransformChanged, timelineTotalText, imageReadinessText, audioReadinessText, subtitleReadinessText, exportBridgeAvailable, exportManagementBridgeAvailable, subtitleBridgeAvailable, exportButtonText, exportHistoryVisible, subtitleCueCountBefore, subtitleCueCountAfterAdd, subtitleCueCountAfterDelete, subtitleStartAfterKeyboard, subtitleCueCountAfterSplit, subtitleCueCountAfterMerge, subtitleSecondStartAfterOffset, subtitleRailSegmentCount, subtitleResizeHandleCount, subtitleButtonsAvailable, subtitlePreviewTop, subtitlePreviewFontSize, audioTrackCount, audioTrackName, audioTrackVolume, waveformBarCount, waveformHeightCount, audioTrackPreviewActive, audioTrackPreviewStopped, audioTrackStartAfterKeyboard, mediaPlayCallCount, selectedTimelineSubtitle, seekValue, advancedSeekValue }
    })()`)
    await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitForElement = async (selector, timeout = 1600) => {
        const deadline = Date.now() + timeout
        let element = document.querySelector(selector)
        while (!element && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(selector)
        }
        if (!element) {
          throw new Error('Timed out waiting for ' + selector)
        }
        return element
      }
      window.__testStage = 'timeline-group-reorder-setup'
      const multiSelectToggle = await waitForElement('.timeline-multiselect-toggle')
      multiSelectToggle.click()
      await wait(80)
      Array.from(document.querySelectorAll('.timeline-selection-control'))
        .find((control) => control.getAttribute('aria-pressed') === 'false')?.click()
      document.querySelector('.timeline-batch-editor')?.scrollIntoView({ block: 'center' })
      await wait(120)
    })()`)
    const shotBatchScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-batch-editing.png')
    await mkdir(path.dirname(shotBatchScreenshotPath), { recursive: true })
    await writeFile(shotBatchScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    const groupReorderSetup = await applicationWindow.webContents.executeJavaScript(`(() => {
      document.querySelector('.timeline-track').scrollIntoView({ block: 'center' })
      const segments = Array.from(document.querySelectorAll('.timeline-segment'))
      const selectedSegments = segments.filter((segment) => segment.classList.contains('is-batch-selected'))
      const targetSegment = segments.find((segment) => !segment.classList.contains('is-batch-selected'))
      const grip = selectedSegments[0].querySelector('.timeline-segment__drag').getBoundingClientRect()
      const target = targetSegment.getBoundingClientRect()
      const selectedOrder = selectedSegments.map((segment) => Number(segment.dataset.shotId))
      const remainingOrder = segments.filter((segment) => !segment.classList.contains('is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      const cueRow = Array.from(document.querySelectorAll('.subtitle-cue-list article')).find((row) => row.querySelector('textarea')?.value === '自定义时间轴字幕')
      return {
        beforeOrder: segments.map((segment) => Number(segment.dataset.shotId)),
        expectedOrder: [...remainingOrder, ...selectedOrder],
        selectedOrder,
        linkedCueStart: Number(cueRow?.querySelector('.subtitle-cue-start')?.value),
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
        grip: { x: grip.x, y: grip.y, width: grip.width, height: grip.height },
        target: { x: target.x, y: target.y, width: target.width, height: target.height },
      }
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const groupReorderStartX = Math.round(groupReorderSetup.grip.x + groupReorderSetup.grip.width / 2)
    const groupReorderStartY = Math.round(groupReorderSetup.grip.y + groupReorderSetup.grip.height / 2)
    const groupReorderEndX = Math.round(groupReorderSetup.target.x + groupReorderSetup.target.width * 0.8)
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: groupReorderStartX, y: groupReorderStartY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: groupReorderStartX, y: groupReorderStartY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 80))
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: groupReorderEndX, y: groupReorderStartY, movementX: groupReorderEndX - groupReorderStartX, movementY: 0 })
    uiResult.groupReorderSetup = groupReorderSetup
    const expectedGroupInsertionIndex = groupReorderSetup.beforeOrder.length - groupReorderSetup.selectedOrder.length
    for (let attempt = 0; attempt < 10; attempt += 1) {
      applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: groupReorderEndX, y: groupReorderStartY, movementX: 0, movementY: 0 })
      await new Promise((resolve) => setTimeout(resolve, 40))
      uiResult.groupReorderDragFeedback = await applicationWindow.webContents.executeJavaScript(`({
        trackActive: document.querySelector('.timeline-track')?.classList.contains('is-group-reorder'),
        badgeVisible: Boolean(document.querySelector('.timeline-group-drag-badge')),
        badgeText: document.querySelector('.timeline-group-drag-badge')?.textContent.trim(),
        selectedGhostCount: document.querySelectorAll('.timeline-segment.is-group-dragging').length,
        dropIndicatorVisible: Boolean(document.querySelector('.timeline-drop-indicator--group')),
        dropLabel: document.querySelector('.timeline-drop-indicator--group span')?.textContent.trim(),
        insertionIndex: Number(document.querySelector('.timeline-track')?.dataset.insertionIndex),
      })`)
      if (uiResult.groupReorderDragFeedback.insertionIndex === expectedGroupInsertionIndex) break
    }
    const shotGroupReorderScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-group-reorder.png')
    await writeFile(shotGroupReorderScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: groupReorderEndX, y: groupReorderStartY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 220))
    uiResult.groupTimelineAfterPointer = await applicationWindow.webContents.executeJavaScript(`(() => {
      const cueRow = Array.from(document.querySelectorAll('.subtitle-cue-list article')).find((row) => row.querySelector('textarea')?.value === '自定义时间轴字幕')
      return {
        order: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
        linkedCueStart: Number(cueRow?.querySelector('.subtitle-cue-start')?.value),
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
      }
    })()`)
    await clickWhenReady('.timeline-undo-button', 'timeline-group-reorder-undo')
    await new Promise((resolve) => setTimeout(resolve, 120))
    uiResult.groupOrderAfterPointerUndo = await applicationWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))")
    await clickWhenReady('.timeline-redo-button', 'timeline-group-reorder-redo')
    await new Promise((resolve) => setTimeout(resolve, 120))
    uiResult.groupOrderAfterPointerRedo = await applicationWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))")
    await clickWhenReady('.timeline-undo-button', 'timeline-group-reorder-restore')
    await new Promise((resolve) => setTimeout(resolve, 2800))
    uiResult.duplicationSetup = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitForElement = async (selector, timeout = 1600) => {
        const deadline = Date.now() + timeout
        let element = document.querySelector(selector)
        while (!element && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(selector)
        }
        if (!element) throw new Error('Timed out waiting for ' + selector)
        return element
      }
      window.__testStage = 'timeline-duplicate-setup'
      const beforeSegments = Array.from(document.querySelectorAll('.timeline-segment'))
      const selectedSourceIds = beforeSegments.filter((segment) => segment.classList.contains('is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      const selectedImageCount = beforeSegments.filter((segment) => segment.classList.contains('is-batch-selected') && segment.querySelector('.art--image')).length
      const subtitleCountBefore = document.querySelectorAll('.subtitle-cue-list article').length
      const batchDurationInput = await waitForElement('.timeline-batch-duration input')
      const countBeforeFormShortcut = beforeSegments.length
      batchDurationInput.focus()
      batchDurationInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }))
      await wait(100)
      const formShortcutBlocked = document.querySelectorAll('.timeline-segment').length === countBeforeFormShortcut
      window.__testStage = 'timeline-duplicate-click'
      const duplicateButton = await waitForElement('.timeline-batch-duplicate')
      const duplicateButtonAvailable = Boolean(duplicateButton && duplicateButton.querySelector('svg'))
      duplicateButton.click()
      await wait(1150)
      const afterSegments = Array.from(document.querySelectorAll('.timeline-segment'))
      const duplicateIds = afterSegments.filter((segment) => segment.classList.contains('is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      window.__testStage = 'timeline-duplicate-history'
      const historyToggle = await waitForElement('.timeline-history-toggle')
      historyToggle.click()
      await wait(80)
      const historyContainsDuplication = Array.from(document.querySelectorAll('.timeline-history-entry')).some((entry) => entry.textContent.includes('复制'))
      historyToggle.click()
      return {
        beforeOrder: beforeSegments.map((segment) => Number(segment.dataset.shotId)),
        afterOrder: afterSegments.map((segment) => Number(segment.dataset.shotId)),
        selectedSourceIds,
        selectedImageCount,
        imageCountBefore: beforeSegments.filter((segment) => segment.querySelector('.art--image')).length,
        imageCountAfter: afterSegments.filter((segment) => segment.querySelector('.art--image')).length,
        subtitleCountBefore,
        subtitleCountAfter: document.querySelectorAll('.subtitle-cue-list article').length,
        duplicateIds,
        activeShotId: Number(document.querySelector('.timeline-segment.is-active')?.dataset.shotId),
        selectedCount: document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length,
        formShortcutBlocked,
        duplicateButtonAvailable,
        historyContainsDuplication,
        bgmCount: document.querySelectorAll('.audio-track-row--bgm').length,
        snackbarVisible: Boolean(document.querySelector('.shot-delete-undo--duplicate')),
        snackbarText: document.querySelector('.shot-delete-undo--duplicate')?.textContent.trim(),
      }
    })()`)
    const duplicatedAutosave = await applicationWindow.webContents.executeJavaScript('window.manjuDesktop.loadAutosave()')
    const shotBatchDuplicateScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-batch-duplicate.png')
    await writeFile(shotBatchDuplicateScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    uiResult.duplicationUndoRedoShortcut = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitForElement = async (selector, timeout = 1600) => {
        const deadline = Date.now() + timeout
        let element = document.querySelector(selector)
        while (!element && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(selector)
        }
        if (!element) throw new Error('Timed out waiting for ' + selector)
        return element
      }
      window.__testStage = 'timeline-duplicate-undo'
      const snackbarUndoButton = document.querySelector('.shot-delete-undo--duplicate button')
      const undoButton = snackbarUndoButton || await waitForElement('.timeline-undo-button')
      undoButton.click()
      await wait(180)
      const undoOrder = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      const undoImageCount = document.querySelectorAll('.timeline-segment .art--image').length
      window.__testStage = 'timeline-duplicate-redo'
      ;(await waitForElement('.timeline-redo-button')).click()
      await wait(180)
      const redoOrder = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      const redoImageCount = document.querySelectorAll('.timeline-segment .art--image').length
      window.__testStage = 'timeline-duplicate-restore'
      ;(await waitForElement('.timeline-undo-button')).click()
      await wait(180)
      document.querySelector('.timeline-batch-clear')?.click()
      await wait(60)
      const controls = Array.from(document.querySelectorAll('.timeline-selection-control'))
      controls[0]?.click()
      controls[2]?.click()
      await wait(100)
      const shortcutSourceIds = Array.from(document.querySelectorAll('.timeline-segment.is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }))
      await wait(260)
      const shortcutOrder = Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      const shortcutSelectedIds = Array.from(document.querySelectorAll('.timeline-segment.is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      const shortcutSnackbarVisible = Boolean(document.querySelector('.shot-delete-undo--duplicate'))
      window.__testStage = 'timeline-shortcut-duplicate-undo'
      ;(await waitForElement('.timeline-undo-button')).click()
      await wait(180)
      document.querySelector('.timeline-batch-clear')?.click()
      await wait(60)
      const restoredControls = Array.from(document.querySelectorAll('.timeline-selection-control'))
      restoredControls[0]?.click()
      restoredControls[1]?.click()
      await wait(100)
      return {
        undoOrder,
        undoImageCount,
        redoOrder,
        redoImageCount,
        shortcutSourceIds,
        shortcutOrder,
        shortcutSelectedIds,
        shortcutSnackbarVisible,
        finalOrder: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
        finalSelectedCount: document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length,
      }
    })()`)
    uiResult.deletionSetup = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const waitForElement = async (selector, timeout = 1600) => {
        const deadline = Date.now() + timeout
        let element = document.querySelector(selector)
        while (!element && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(selector)
        }
        if (!element) throw new Error('Timed out waiting for ' + selector)
        return element
      }
      const waitForEnabledElement = async (selector, timeout = 5000) => {
        const deadline = Date.now() + timeout
        let element = document.querySelector(selector)
        while ((!element || element.disabled) && Date.now() < deadline) {
          await wait(40)
          element = document.querySelector(selector)
        }
        if (!element || element.disabled) {
          throw new Error('Timed out waiting for enabled ' + selector
            + '; selected=' + document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length
            + '; segments=' + document.querySelectorAll('.timeline-segment').length
            + '; aria=' + (element?.getAttribute('aria-label') || 'missing')
            + '; duplicate=' + (document.querySelector('.timeline-batch-duplicate')?.textContent.trim() || 'missing')
            + '; duplicateDisabled=' + Boolean(document.querySelector('.timeline-batch-duplicate')?.disabled)
            + '; exportDisabled=' + Boolean(document.querySelector('.export-mp4-button')?.disabled)
            + '; trackClass=' + (document.querySelector('.timeline-track')?.className || 'missing'))
        }
        return element
      }
      window.__testStage = 'timeline-delete-setup'
      const segments = Array.from(document.querySelectorAll('.timeline-segment'))
      const selectedOrder = segments.filter((segment) => segment.classList.contains('is-batch-selected')).map((segment) => Number(segment.dataset.shotId))
      const setup = {
        beforeOrder: segments.map((segment) => Number(segment.dataset.shotId)),
        selectedOrder,
        imageCount: document.querySelectorAll('.timeline-segment .art--image').length,
        subtitleCount: document.querySelectorAll('.subtitle-cue-list article').length,
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
        recoveryLabel: document.querySelector('.timeline-recovery-toggle')?.textContent.trim(),
      }
      ;(await waitForEnabledElement('.timeline-batch-delete')).click()
      await waitForElement('.shot-delete-modal')
      return {
        ...setup,
        modalVisible: Boolean(document.querySelector('.shot-delete-modal')),
        modalTitle: document.querySelector('.shot-delete-header h2')?.textContent.trim(),
        modalDescription: document.querySelector('.shot-delete-consequence')?.textContent.trim(),
        modalStats: Array.from(document.querySelectorAll('.shot-delete-stats b')).map((node) => Number(node.textContent)),
        recoveryNotice: document.querySelector('.shot-delete-recovery')?.textContent.trim(),
      }
    })()`)
    const shotSafeDeleteScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-safe-delete.png')
    await writeFile(shotSafeDeleteScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    uiResult.deletionAfterConfirm = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      window.__testStage = 'timeline-delete-confirm'
      const confirmButton = document.querySelector('.shot-delete-confirm')
      if (!confirmButton) throw new Error('Delete confirmation button is unavailable')
      confirmButton.click()
      for (let attempt = 0; attempt < 60 && document.querySelector('.shot-delete-modal'); attempt += 1) await wait(50)
      await wait(160)
      return {
        order: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
        imageCount: document.querySelectorAll('.timeline-segment .art--image').length,
        subtitleCount: document.querySelectorAll('.subtitle-cue-list article').length,
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
        modalClosed: !document.querySelector('.shot-delete-modal'),
        multiSelectClosed: !document.querySelector('.timeline-batch-editor'),
        snackbarVisible: Boolean(document.querySelector('.shot-delete-undo')),
        snackbarText: document.querySelector('.shot-delete-undo')?.textContent.trim(),
        historyLabel: document.querySelector('.timeline-history-toggle')?.textContent.trim(),
        recoveryLabel: document.querySelector('.timeline-recovery-toggle')?.textContent.trim(),
      }
    })()`)
    await clickWhenReady('.shot-delete-undo button', 'timeline-delete-snackbar-undo')
    await new Promise((resolve) => setTimeout(resolve, 180))
    uiResult.deletionAfterSnackbarUndo = await applicationWindow.webContents.executeJavaScript(`({
      order: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
      imageCount: document.querySelectorAll('.timeline-segment .art--image').length,
      snackbarClosed: !document.querySelector('.shot-delete-undo'),
    })`)
    await clickWhenReady('.timeline-redo-button', 'timeline-delete-redo')
    await new Promise((resolve) => setTimeout(resolve, 160))
    uiResult.deletionAfterRedo = await applicationWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))")
    await clickWhenReady('.timeline-undo-button', 'timeline-delete-second-undo')
    await new Promise((resolve) => setTimeout(resolve, 180))
    uiResult.deletionAfterSecondUndo = await applicationWindow.webContents.executeJavaScript(`({
      order: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
      imageCount: document.querySelectorAll('.timeline-segment .art--image').length,
    })`)
    uiResult.allDeletionSetup = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.timeline-multiselect-toggle')?.click()
      await wait(80)
      document.querySelector('.production-timeline')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
      await wait(80)
      document.querySelector('.timeline-batch-delete')?.click()
      await wait(260)
      return {
        title: document.querySelector('.shot-delete-header h2')?.textContent.trim(),
        modalVisible: Boolean(document.querySelector('.shot-delete-modal')),
        selectedCount: document.querySelectorAll('.timeline-selection-control[aria-pressed="true"]').length,
        stats: Array.from(document.querySelectorAll('.shot-delete-stats b')).map((node) => Number(node.textContent)),
      }
    })()`)
    uiResult.allDeletionAfterConfirm = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      document.querySelector('.shot-delete-confirm')?.click()
      for (let attempt = 0; attempt < 60 && document.querySelector('.shot-delete-modal'); attempt += 1) await wait(50)
      await wait(160)
      return {
        segmentCount: document.querySelectorAll('.timeline-segment').length,
        emptyStateVisible: Boolean(document.querySelector('.timeline-empty-state')),
        exportDisabled: document.querySelector('.export-mp4-button')?.disabled,
        subtitleCount: document.querySelectorAll('.subtitle-cue-list article').length,
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
        seekValue: Number(document.querySelector('.timeline-seek')?.value),
        snackbarVisible: Boolean(document.querySelector('.shot-delete-undo')),
      }
    })()`)
    await applicationWindow.webContents.executeJavaScript("document.querySelector('.shot-delete-undo button')?.click()")
    await new Promise((resolve) => setTimeout(resolve, 180))
    uiResult.allDeletionAfterUndo = await applicationWindow.webContents.executeJavaScript(`({
      order: Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId)),
      imageCount: document.querySelectorAll('.timeline-segment .art--image').length,
      subtitleCount: document.querySelectorAll('.subtitle-cue-list article').length,
    })`)
    uiResult.splitSetup = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const readOrder = () => Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      const setRangeValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const beforeOrder = readOrder()
      const beforeDurations = Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow')))
      const totalBefore = document.querySelector('.timeline-total')?.textContent.trim()
      const splitButton = document.querySelector('.timeline-split-button')
      const splitButtonAvailable = Boolean(splitButton?.querySelector('svg'))
      const formInput = document.querySelector('.shot-transition-duration')
      formInput?.focus()
      formInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }))
      await wait(100)
      const formShortcutBlocked = readOrder().length === beforeOrder.length
      document.querySelector('.timeline-multiselect-toggle')?.click()
      await wait(100)
      const splitDisabledInMultiSelect = splitButton.disabled
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }))
      await wait(100)
      const multiSelectShortcutBlocked = readOrder().length === beforeOrder.length
      document.querySelector('.timeline-multiselect-toggle')?.click()
      await wait(100)
      const seek = document.querySelector('.timeline-seek')
      setRangeValue(seek, 0.2)
      await wait(100)
      const edgeSplitDisabled = splitButton.disabled
      setRangeValue(seek, 1.2)
      await wait(140)
      const guideVisible = Boolean(document.querySelector('.timeline-split-guide.is-valid'))
      const splitEnabledAtValidPlayhead = !splitButton.disabled
      const playheadBefore = Number(seek.value)
      splitButton.click()
      await wait(520)
      const afterOrder = readOrder()
      return {
        beforeOrder,
        beforeDurations,
        afterOrder,
        afterDurations: Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow'))),
        totalBefore,
        totalAfter: document.querySelector('.timeline-total')?.textContent.trim(),
        splitButtonAvailable,
        formShortcutBlocked,
        splitDisabledInMultiSelect,
        multiSelectShortcutBlocked,
        edgeSplitDisabled,
        guideVisible,
        splitEnabledAtValidPlayhead,
        playheadBefore,
        playheadAfter: Number(document.querySelector('.timeline-seek')?.value),
        activeShotId: Number(document.querySelector('.timeline-segment.is-active')?.dataset.shotId),
        multiSelectClosed: !document.querySelector('.timeline-batch-editor'),
        snackbarVisible: Boolean(document.querySelector('.shot-delete-undo--split')),
        snackbarText: document.querySelector('.shot-delete-undo--split')?.textContent.trim(),
      }
    })()`)
    await new Promise((resolve) => setTimeout(resolve, 2800))
    const splitAutosave = await applicationWindow.webContents.executeJavaScript('window.manjuDesktop.loadAutosave()')
    const shotSplitScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-split.png')
    await writeFile(shotSplitScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    uiResult.splitUndoRedo = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const readOrder = () => Array.from(document.querySelectorAll('.timeline-segment')).map((segment) => Number(segment.dataset.shotId))
      document.querySelector('.shot-delete-undo--split button')?.click()
      await wait(220)
      const undoOrder = readOrder()
      const undoPlayhead = Number(document.querySelector('.timeline-seek')?.value)
      document.querySelector('.timeline-redo-button')?.click()
      await wait(220)
      const redoOrder = readOrder()
      const redoPlayhead = Number(document.querySelector('.timeline-seek')?.value)
      const redoActiveShotId = Number(document.querySelector('.timeline-segment.is-active')?.dataset.shotId)
      document.querySelector('.timeline-undo-button')?.click()
      await wait(220)
      return {
        undoOrder,
        undoPlayhead,
        redoOrder,
        redoPlayhead,
        redoActiveShotId,
        finalOrder: readOrder(),
        snackbarClosed: !document.querySelector('.shot-delete-undo--split'),
      }
    })()`)
    await applicationWindow.webContents.executeJavaScript(
      "document.querySelector('.shot-motion-editor')?.scrollIntoView({ block: 'center' })",
    )
    await new Promise((resolve) => setTimeout(resolve, 150))
    const shotMotionScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-motion.png')
    await mkdir(path.dirname(shotMotionScreenshotPath), { recursive: true })
    await writeFile(shotMotionScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    const readShotTimelineState = () => applicationWindow.webContents.executeJavaScript(`(() => {
      const segments = Array.from(document.querySelectorAll('.timeline-segment'))
      const cueRow = Array.from(document.querySelectorAll('.subtitle-cue-list article')).find((row) => row.querySelector('textarea')?.value === '自定义时间轴字幕')
      return {
        order: segments.map((segment) => Number(segment.dataset.shotId)),
        durations: Array.from(document.querySelectorAll('.timeline-duration-handle')).map((handle) => Number(handle.getAttribute('aria-valuenow'))),
        total: document.querySelector('.timeline-total')?.textContent.trim(),
        linkedCueStart: Number(cueRow?.querySelector('.subtitle-cue-start')?.value),
        bgmStart: Number(document.querySelector('.audio-track-start')?.value),
      }
    })()`)
    uiResult.pointerTimelineBefore = await readShotTimelineState()
    const reorderBounds = await applicationWindow.webContents.executeJavaScript(`(() => {
      const grip = document.querySelector('.timeline-segment__drag').getBoundingClientRect()
      const target = Array.from(document.querySelectorAll('.timeline-segment')).at(-1).getBoundingClientRect()
      return {
        grip: { x: grip.x, y: grip.y, width: grip.width, height: grip.height },
        target: { x: target.x, y: target.y, width: target.width, height: target.height },
      }
    })()`)
    const reorderStartX = Math.round(reorderBounds.grip.x + reorderBounds.grip.width / 2)
    const reorderStartY = Math.round(reorderBounds.grip.y + reorderBounds.grip.height / 2)
    const reorderEndX = Math.round(reorderBounds.target.x + reorderBounds.target.width * 0.8)
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: reorderStartX, y: reorderStartY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: reorderStartX, y: reorderStartY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 80))
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: reorderEndX, y: reorderStartY, movementX: reorderEndX - reorderStartX, movementY: 0 })
    const expectedReorderInsertionIndex = uiResult.pointerTimelineBefore.order.length - 1
    for (let attempt = 0; attempt < 10; attempt += 1) {
      applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: reorderEndX, y: reorderStartY, movementX: 0, movementY: 0 })
      await new Promise((resolve) => setTimeout(resolve, 40))
      uiResult.reorderDragFeedback = await applicationWindow.webContents.executeJavaScript(`({
        trackActive: document.querySelector('.timeline-track')?.classList.contains('is-reorder'),
        segmentActive: Boolean(document.querySelector('.timeline-segment.is-reordering')),
        dropIndicatorVisible: Boolean(document.querySelector('.timeline-drop-indicator')),
        insertionIndex: Number(document.querySelector('.timeline-track')?.dataset.insertionIndex),
      })`)
      if (uiResult.reorderDragFeedback.insertionIndex === expectedReorderInsertionIndex) break
    }
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: reorderEndX, y: reorderStartY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 250))
    uiResult.pointerTimelineAfterReorder = await readShotTimelineState()
    const durationBounds = await applicationWindow.webContents.executeJavaScript(`(() => {
      const bounds = document.querySelector('.timeline-duration-handle').getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })()`)
    const durationStartX = Math.round(durationBounds.x + durationBounds.width / 2)
    const durationStartY = Math.round(durationBounds.y + durationBounds.height / 2)
    const durationEndX = durationStartX + 80
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: durationStartX, y: durationStartY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: durationStartX, y: durationStartY, button: 'left', clickCount: 1 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: durationEndX, y: durationStartY, movementX: durationEndX - durationStartX, movementY: 0 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: durationEndX, y: durationStartY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 250))
    uiResult.pointerTimelineAfterResize = await readShotTimelineState()
    const shotEditingScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-shot-editing.png')
    await writeFile(shotEditingScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    await applicationWindow.webContents.executeJavaScript(
      "document.querySelector('.audio-track-editor')?.scrollIntoView({ block: 'center' })",
    )
    const railBounds = await applicationWindow.webContents.executeJavaScript(`(() => {
      const bounds = document.querySelector('.audio-track-rail').getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })()`)
    const dragY = Math.round(railBounds.y + railBounds.height / 2)
    const dragStartX = Math.round(railBounds.x + railBounds.width * 0.25)
    const dragEndX = Math.round(railBounds.x + railBounds.width * 0.55)
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: dragStartX, y: dragY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: dragStartX, y: dragY, button: 'left', clickCount: 1 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: dragEndX, y: dragY, movementX: dragEndX - dragStartX, movementY: 0 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: dragEndX, y: dragY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    uiResult.draggedAudioTrackStart = await applicationWindow.webContents.executeJavaScript(
      "Number(document.querySelector('.audio-track-start').value)",
    )
    await new Promise((resolve) => setTimeout(resolve, 150))
    const audioTrackScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-audio-tracks.png')
    await mkdir(path.dirname(audioTrackScreenshotPath), { recursive: true })
    await writeFile(audioTrackScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    await applicationWindow.webContents.executeJavaScript(
      "document.querySelector('.subtitle-track-editor')?.scrollIntoView({ block: 'center' })",
    )
    await new Promise((resolve) => setTimeout(resolve, 150))
    const subtitleDragBounds = await applicationWindow.webContents.executeJavaScript(`(() => {
      const rail = document.querySelector('.subtitle-overview-rail').getBoundingClientRect()
      const block = Array.from(document.querySelectorAll('.subtitle-cue-block')).at(-1).getBoundingClientRect()
      return { railWidth: rail.width, x: block.x, y: block.y, width: block.width, height: block.height }
    })()`)
    const subtitleDragY = Math.round(subtitleDragBounds.y + subtitleDragBounds.height / 2)
    const subtitleDragStartX = Math.round(subtitleDragBounds.x + subtitleDragBounds.width / 2)
    const subtitleDragEndX = Math.round(subtitleDragStartX - subtitleDragBounds.railWidth * 0.1)
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: subtitleDragStartX, y: subtitleDragY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: subtitleDragStartX, y: subtitleDragY, button: 'left', clickCount: 1 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: subtitleDragEndX, y: subtitleDragY, movementX: subtitleDragEndX - subtitleDragStartX, movementY: 0 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: subtitleDragEndX, y: subtitleDragY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    uiResult.draggedSubtitleStart = await applicationWindow.webContents.executeJavaScript(
      "Number(Array.from(document.querySelectorAll('.subtitle-cue-start')).at(-1).value)",
    )
    const subtitleResizeBounds = await applicationWindow.webContents.executeJavaScript(`(() => {
      const rail = document.querySelector('.subtitle-overview-rail').getBoundingClientRect()
      const block = document.querySelector('.subtitle-cue-block').getBoundingClientRect()
      return { railWidth: rail.width, x: block.x, y: block.y, width: block.width, height: block.height }
    })()`)
    const subtitleResizeY = Math.round(subtitleResizeBounds.y + subtitleResizeBounds.height / 2)
    const subtitleResizeStartX = Math.round(subtitleResizeBounds.x + subtitleResizeBounds.width - 2)
    const subtitleResizeEndX = Math.round(subtitleResizeStartX - subtitleResizeBounds.railWidth * 0.05)
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: subtitleResizeStartX, y: subtitleResizeY })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseDown', x: subtitleResizeStartX, y: subtitleResizeY, button: 'left', clickCount: 1 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseMove', x: subtitleResizeEndX, y: subtitleResizeY, movementX: subtitleResizeEndX - subtitleResizeStartX, movementY: 0 })
    applicationWindow.webContents.sendInputEvent({ type: 'mouseUp', x: subtitleResizeEndX, y: subtitleResizeY, button: 'left', clickCount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    uiResult.resizedSubtitleEnd = await applicationWindow.webContents.executeJavaScript(
      "Number(document.querySelector('.subtitle-cue-end').value)",
    )
    Object.assign(uiResult, await applicationWindow.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
      const undoButton = document.querySelector('.timeline-undo-button')
      const redoButton = document.querySelector('.timeline-redo-button')
      const historyToggle = document.querySelector('.timeline-history-toggle')
      const recoveryToggle = document.querySelector('.timeline-recovery-toggle')
      const historyControlsAvailable = Boolean(undoButton && redoButton && historyToggle && recoveryToggle)
      const recoveryBridgeAvailable = typeof window.manjuDesktop.listTimelineRecoveries === 'function'
        && typeof window.manjuDesktop.saveTimelineRecovery === 'function'
        && typeof window.manjuDesktop.restoreTimelineRecovery === 'function'

      undoButton.click()
      await wait(120)
      const subtitleEndAfterUndoButton = Number(document.querySelector('.subtitle-cue-end').value)
      redoButton.click()
      await wait(120)
      const subtitleEndAfterRedoButton = Number(document.querySelector('.subtitle-cue-end').value)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
      await wait(120)
      const subtitleEndAfterUndoShortcut = Number(document.querySelector('.subtitle-cue-end').value)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
      await wait(120)
      const subtitleEndAfterRedoShortcut = Number(document.querySelector('.subtitle-cue-end').value)

      historyToggle.click()
      await wait(100)
      const historyPanelVisible = Boolean(document.querySelector('.timeline-safety-panel'))
      const historyEntryCount = document.querySelectorAll('.timeline-history-entry').length
      const historyContainsUndoRedo = document.querySelector('.timeline-operation-history')?.textContent.includes('撤销')
        && document.querySelector('.timeline-operation-history')?.textContent.includes('重做')

      await wait(2300)
      recoveryToggle.click()
      await wait(120)
      const recoveryPointCount = document.querySelectorAll('.timeline-recovery-row').length
      let recoveryRestorePassed = false
      let subtitleEndBeforeRecoveryRestore = 0
      let subtitleEndAfterRecoveryRestore = 0
      let subtitleEndAfterUndoRestore = 0
      let subtitleEndAfterRedoRestore = 0
      if (recoveryPointCount > 0) {
        const firstEndInput = document.querySelector('.subtitle-cue-end')
        const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        inputValueSetter.call(firstEndInput, '1.8')
        firstEndInput.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(120)
        subtitleEndBeforeRecoveryRestore = Number(document.querySelector('.subtitle-cue-end').value)
        const originalConfirm = window.confirm
        window.confirm = () => true
        document.querySelector('.timeline-recovery-row button').click()
        await wait(450)
        window.confirm = originalConfirm
        subtitleEndAfterRecoveryRestore = Number(document.querySelector('.subtitle-cue-end').value)
        document.querySelector('.timeline-undo-button').click()
        await wait(120)
        subtitleEndAfterUndoRestore = Number(document.querySelector('.subtitle-cue-end').value)
        document.querySelector('.timeline-redo-button').click()
        await wait(120)
        subtitleEndAfterRedoRestore = Number(document.querySelector('.subtitle-cue-end').value)
        recoveryRestorePassed = subtitleEndBeforeRecoveryRestore === 1.8
          && subtitleEndAfterRecoveryRestore === ${uiResult.resizedSubtitleEnd}
          && subtitleEndAfterUndoRestore === 1.8
          && subtitleEndAfterRedoRestore === ${uiResult.resizedSubtitleEnd}
      }
      await wait(2800)
      document.querySelector('.production-timeline-header')?.scrollIntoView({ block: 'start' })
      await wait(100)
      return {
        historyControlsAvailable,
        recoveryBridgeAvailable,
        subtitleEndAfterUndoButton,
        subtitleEndAfterRedoButton,
        subtitleEndAfterUndoShortcut,
        subtitleEndAfterRedoShortcut,
        historyPanelVisible,
        historyEntryCount,
        historyContainsUndoRedo,
        recoveryPointCount,
        recoveryRestorePassed,
        subtitleEndBeforeRecoveryRestore,
        subtitleEndAfterRecoveryRestore,
        subtitleEndAfterUndoRestore,
        subtitleEndAfterRedoRestore,
      }
    })()`))
    const subtitleScreenshotPath = path.join(process.cwd(), 'outputs', 'runtime', 'final-subtitles.png')
    await writeFile(subtitleScreenshotPath, (await applicationWindow.webContents.capturePage()).toPNG())
    await new Promise((resolve) => setTimeout(resolve, 900))
    const editedAutosave = await applicationWindow.webContents.executeJavaScript(
      'window.manjuDesktop.loadAutosave()',
    )
    const recoveryRetention = await applicationWindow.webContents.executeJavaScript(`(async () => {
      const autosave = await window.manjuDesktop.loadAutosave()
      for (let index = 0; index < 9; index += 1) {
        await window.manjuDesktop.saveTimelineRecovery({ projectKey: 'IPC 持久化测试', snapshot: autosave.snapshot })
      }
      const listed = await window.manjuDesktop.listTimelineRecoveries('IPC 持久化测试')
      const invalid = await window.manjuDesktop.restoreTimelineRecovery({ projectKey: 'IPC 持久化测试', recoveryId: '../invalid.manju' })
      return { count: listed.points.length, invalidRejected: !invalid.ok }
    })()`)

    const autosavePath = path.join(testDataDirectory, 'projects', 'autosave.manju')
    const savedText = await readFile(autosavePath, 'utf8')
    const persistedShotOne = editedAutosave.snapshot.content.shots.find((shot) => shot.id === 1)
    const persistedShotTwo = editedAutosave.snapshot.content.shots.find((shot) => shot.id === 2)
    const editedEpisodeProduction = editedAutosave.snapshot.content.episodeProductions
      .find((production) => production.episodeId === 2)
    const duplicatedEpisodeProduction = duplicatedAutosave.snapshot.content.episodeProductions
      .find((production) => production.episodeId === 2)
    const persistedResizedCue = [...editedEpisodeProduction.subtitleCues]
      .sort((left, right) => left.start - right.start)[0]
    const duplicationInsertionIndex = Math.max(...uiResult.duplicationSetup.selectedSourceIds.map((shotId) => uiResult.duplicationSetup.beforeOrder.indexOf(shotId))) + 1
    const expectedDuplicationOrder = [
      ...uiResult.duplicationSetup.beforeOrder.slice(0, duplicationInsertionIndex),
      ...uiResult.duplicationSetup.duplicateIds,
      ...uiResult.duplicationSetup.beforeOrder.slice(duplicationInsertionIndex),
    ]
    const shortcutInsertionIndex = Math.max(...uiResult.duplicationUndoRedoShortcut.shortcutSourceIds.map((shotId) => uiResult.duplicationSetup.beforeOrder.indexOf(shotId))) + 1
    const expectedShortcutOrder = [
      ...uiResult.duplicationSetup.beforeOrder.slice(0, shortcutInsertionIndex),
      ...uiResult.duplicationUndoRedoShortcut.shortcutSelectedIds,
      ...uiResult.duplicationSetup.beforeOrder.slice(shortcutInsertionIndex),
    ]
    const duplicatedAutosaveShot = duplicatedAutosave.snapshot?.content?.shots?.find((shot) => shot.id === uiResult.duplicationSetup.duplicateIds[0])
    const duplicatedAutosaveSourceShot = duplicatedAutosave.snapshot?.content?.shots?.find((shot) => shot.id === duplicatedAutosaveShot?.duplicateSourceShotId)
    const splitAutosaveRightShot = splitAutosave.snapshot?.content?.shots?.find((shot) => shot.id === uiResult.splitSetup.activeShotId)
    const splitAutosaveLeftShot = splitAutosave.snapshot?.content?.shots?.find((shot) => shot.id === splitAutosaveRightShot?.splitSourceShotId)
    const passed = migrationPassed
      && sizePreflightPassed
      && duplicatedTracksPersisted
      && saveResult.ok
      && loadResult.ok
      && loadResult.snapshot.project.name === snapshot.project.name
      && uiResult.episodeAfter === uiResult.episodeBefore + 1
      && uiResult.sceneAfter === uiResult.sceneBefore + 1
      && uiResult.scriptLineAfter === uiResult.scriptLineBefore + 1
      && uiResult.syncedLineText === '跨页同步台词'
      && uiResult.generatedPromptHasBindings
      && uiResult.continuityLocked
      && uiResult.importedImageVisible
      && uiResult.importedImageStatus === '已完成'
      && uiResult.completedImageTasks === 1
      && uiResult.importedAudioStatus === '本地音频'
      && uiResult.completedAudioTasks === 0
      && uiResult.draftShotCount === 2
      && uiResult.shotAfter === uiResult.shotBefore + 1
      && uiResult.lineAfter === uiResult.lineBefore + 1
      && uiResult.characterAfter === uiResult.characterBefore + 1
      && uiResult.timelineSegmentCount === 3
      && uiResult.shotEditControlsAvailable
      && uiResult.shotOrderAfterKeyboard[0] === uiResult.initialShotOrder[1]
      && uiResult.shotOrderAfterKeyboard[1] === uiResult.initialShotOrder[0]
      && JSON.stringify(uiResult.shotOrderAfterKeyboardUndo) === JSON.stringify(uiResult.initialShotOrder)
      && JSON.stringify(uiResult.shotOrderAfterKeyboardRedo) === JSON.stringify(uiResult.shotOrderAfterKeyboard)
      && uiResult.durationAfterKeyboard === uiResult.durationBeforeKeyboard + 0.1
      && uiResult.durationAfterKeyboardUndo === uiResult.durationBeforeKeyboard
      && uiResult.durationAfterKeyboardRedo === uiResult.durationAfterKeyboard
      && uiResult.batchEditingAvailable
      && uiResult.batchBarVisible
      && uiResult.batchSelectionCountAfterToggle === 1
      && uiResult.batchSelectionCount === 2
      && uiResult.batchApplyEnabled
      && uiResult.batchDurationAfterApply[0] === 3.4
      && uiResult.batchDurationAfterApply[1] === 3.4
      && uiResult.batchDurationAfterApply[2] === uiResult.batchDurationBefore[2]
      && uiResult.batchMotionAfterApply === 'zoom-out'
      && uiResult.batchStrengthAfterApply === 20
      && uiResult.batchTransitionAfterApply === 'fade'
      && uiResult.batchTransitionDurationAfterApply === 0.4
      && JSON.stringify(uiResult.batchDurationAfterUndo) === JSON.stringify(uiResult.batchDurationBefore)
      && JSON.stringify(uiResult.batchDurationAfterRedo) === JSON.stringify(uiResult.batchDurationAfterApply)
      && JSON.stringify(uiResult.groupOrderAfterKeyboard) === JSON.stringify([...uiResult.groupOrderBeforeKeyboard.slice(2), ...uiResult.groupOrderBeforeKeyboard.slice(0, 2)])
      && uiResult.groupSelectionCountAfterKeyboard === 2
      && JSON.stringify(uiResult.groupOrderAfterKeyboardUndo) === JSON.stringify(uiResult.groupOrderBeforeKeyboard)
      && JSON.stringify(uiResult.groupOrderAfterKeyboardRedo) === JSON.stringify(uiResult.groupOrderAfterKeyboard)
      && uiResult.deletionModalAvailable
      && uiResult.deletionModalStats[0] === 2
      && uiResult.deletionCancelHasFocus
      && JSON.stringify(uiResult.deletionOrderAfterCancel) === JSON.stringify(uiResult.deletionOrderBeforeCancel)
      && uiResult.deletionKeyboardModalAvailable
      && uiResult.batchSelectionCountAfterSelectAllShortcut === uiResult.timelineSegmentCount
      && uiResult.batchSelectionCountAfterClear === 0
      && uiResult.batchBarHiddenAfterExit
      && uiResult.motionControlsAvailable
      && uiResult.motionPresetAfterChange === uiResult.targetMotionPreset
      && uiResult.motionPresetAfterUndo === uiResult.originalMotionPreset
      && uiResult.motionPresetAfterRedo === uiResult.targetMotionPreset
      && uiResult.motionReadyCount === uiResult.timelineSegmentCount
      && uiResult.motionExportSummary.includes('已配置')
      && uiResult.motionPreviewTransformChanged
      && uiResult.groupReorderDragFeedback.trackActive
      && uiResult.groupReorderDragFeedback.badgeVisible
      && uiResult.groupReorderDragFeedback.badgeText.includes('移动 2 个镜头')
      && uiResult.groupReorderDragFeedback.selectedGhostCount === 2
      && uiResult.groupReorderDragFeedback.dropIndicatorVisible
      && uiResult.groupReorderDragFeedback.dropLabel.includes('移动到第')
      && uiResult.groupReorderDragFeedback.insertionIndex >= 0
      && uiResult.groupReorderDragFeedback.insertionIndex <= uiResult.groupReorderSetup.beforeOrder.length
      && JSON.stringify(uiResult.groupTimelineAfterPointer.order) === JSON.stringify(uiResult.groupReorderSetup.expectedOrder)
      && uiResult.groupTimelineAfterPointer.linkedCueStart > uiResult.groupReorderSetup.linkedCueStart
      && uiResult.groupTimelineAfterPointer.bgmStart === uiResult.groupReorderSetup.bgmStart
      && JSON.stringify(uiResult.groupOrderAfterPointerUndo) === JSON.stringify(uiResult.groupReorderSetup.beforeOrder)
      && JSON.stringify(uiResult.groupOrderAfterPointerRedo) === JSON.stringify(uiResult.groupReorderSetup.expectedOrder)
      && uiResult.duplicationSetup.selectedSourceIds.length === 2
      && uiResult.duplicationSetup.formShortcutBlocked
      && uiResult.duplicationSetup.duplicateButtonAvailable
      && uiResult.duplicationSetup.historyContainsDuplication
      && uiResult.duplicationSetup.duplicateIds.length === uiResult.duplicationSetup.selectedSourceIds.length
      && uiResult.duplicationSetup.duplicateIds.every((shotId) => shotId > Math.max(...uiResult.duplicationSetup.beforeOrder))
      && JSON.stringify(uiResult.duplicationSetup.afterOrder) === JSON.stringify(expectedDuplicationOrder)
      && uiResult.duplicationSetup.activeShotId === uiResult.duplicationSetup.duplicateIds[0]
      && uiResult.duplicationSetup.selectedCount === uiResult.duplicationSetup.duplicateIds.length
      && uiResult.duplicationSetup.imageCountAfter === uiResult.duplicationSetup.imageCountBefore + uiResult.duplicationSetup.selectedImageCount
      && uiResult.duplicationSetup.subtitleCountAfter > uiResult.duplicationSetup.subtitleCountBefore
      && uiResult.duplicationSetup.bgmCount === 1
      && uiResult.duplicationSetup.snackbarVisible
      && uiResult.duplicationSetup.snackbarText.includes('已复制 2 个镜头，插入到第')
      && duplicatedAutosave.ok
      && JSON.stringify(duplicatedAutosave.snapshot.content.shots.map((shot) => shot.id)) === JSON.stringify(uiResult.duplicationSetup.afterOrder)
      && duplicatedEpisodeProduction.subtitleCues.length === uiResult.duplicationSetup.subtitleCountAfter
      && duplicatedAutosaveShot?.draftSource === 'duplicate'
      && duplicatedAutosaveShot?.image === duplicatedAutosaveSourceShot?.image
      && JSON.stringify(uiResult.duplicationUndoRedoShortcut.undoOrder) === JSON.stringify(uiResult.duplicationSetup.beforeOrder)
      && uiResult.duplicationUndoRedoShortcut.undoImageCount === uiResult.duplicationSetup.imageCountBefore
      && JSON.stringify(uiResult.duplicationUndoRedoShortcut.redoOrder) === JSON.stringify(uiResult.duplicationSetup.afterOrder)
      && uiResult.duplicationUndoRedoShortcut.redoImageCount === uiResult.duplicationSetup.imageCountAfter
      && uiResult.duplicationUndoRedoShortcut.shortcutSourceIds.length === 2
      && uiResult.duplicationUndoRedoShortcut.shortcutSelectedIds.length === 2
      && JSON.stringify(uiResult.duplicationUndoRedoShortcut.shortcutOrder) === JSON.stringify(expectedShortcutOrder)
      && uiResult.duplicationUndoRedoShortcut.shortcutSnackbarVisible
      && JSON.stringify(uiResult.duplicationUndoRedoShortcut.finalOrder) === JSON.stringify(uiResult.duplicationSetup.beforeOrder)
      && uiResult.duplicationUndoRedoShortcut.finalSelectedCount === 2
      && uiResult.deletionSetup.modalVisible
      && uiResult.deletionSetup.selectedOrder.length === 2
      && uiResult.deletionSetup.modalStats[0] === uiResult.deletionSetup.selectedOrder.length
      && uiResult.deletionSetup.recoveryNotice.includes('恢复点')
      && uiResult.deletionAfterConfirm.modalClosed
      && uiResult.deletionAfterConfirm.multiSelectClosed
      && uiResult.deletionAfterConfirm.snackbarVisible
      && uiResult.deletionAfterConfirm.snackbarText.includes('可撤销')
      && JSON.stringify(uiResult.deletionAfterConfirm.order) === JSON.stringify(uiResult.deletionSetup.beforeOrder.filter((shotId) => !uiResult.deletionSetup.selectedOrder.includes(shotId)))
      && uiResult.deletionAfterConfirm.bgmStart === uiResult.deletionSetup.bgmStart
      && uiResult.deletionAfterConfirm.subtitleCount <= uiResult.deletionSetup.subtitleCount
      && uiResult.deletionAfterSnackbarUndo.snackbarClosed
      && JSON.stringify(uiResult.deletionAfterSnackbarUndo.order) === JSON.stringify(uiResult.deletionSetup.beforeOrder)
      && uiResult.deletionAfterSnackbarUndo.imageCount === uiResult.deletionSetup.imageCount
      && JSON.stringify(uiResult.deletionAfterRedo) === JSON.stringify(uiResult.deletionAfterConfirm.order)
      && JSON.stringify(uiResult.deletionAfterSecondUndo.order) === JSON.stringify(uiResult.deletionSetup.beforeOrder)
      && uiResult.deletionAfterSecondUndo.imageCount === uiResult.deletionSetup.imageCount
      && uiResult.allDeletionSetup.selectedCount === uiResult.timelineSegmentCount
      && uiResult.allDeletionSetup.stats[0] === uiResult.timelineSegmentCount
      && uiResult.allDeletionAfterConfirm.segmentCount === 0
      && uiResult.allDeletionAfterConfirm.emptyStateVisible
      && uiResult.allDeletionAfterConfirm.exportDisabled
      && uiResult.allDeletionAfterConfirm.subtitleCount === 0
      && uiResult.allDeletionAfterConfirm.bgmStart === 0
      && uiResult.allDeletionAfterConfirm.seekValue === 0
      && uiResult.allDeletionAfterConfirm.snackbarVisible
      && JSON.stringify(uiResult.allDeletionAfterUndo.order) === JSON.stringify(uiResult.deletionSetup.beforeOrder)
      && uiResult.allDeletionAfterUndo.imageCount === uiResult.deletionSetup.imageCount
      && uiResult.allDeletionAfterUndo.subtitleCount === uiResult.deletionSetup.subtitleCount
      && uiResult.splitSetup.splitButtonAvailable
      && uiResult.splitSetup.formShortcutBlocked
      && uiResult.splitSetup.splitDisabledInMultiSelect
      && uiResult.splitSetup.multiSelectShortcutBlocked
      && uiResult.splitSetup.edgeSplitDisabled
      && uiResult.splitSetup.guideVisible
      && uiResult.splitSetup.splitEnabledAtValidPlayhead
      && uiResult.splitSetup.afterOrder.length === uiResult.splitSetup.beforeOrder.length + 1
      && uiResult.splitSetup.afterOrder[1] === uiResult.splitSetup.activeShotId
      && uiResult.splitSetup.afterDurations[0] === 1.2
      && Number((uiResult.splitSetup.afterDurations[0] + uiResult.splitSetup.afterDurations[1]).toFixed(1)) === uiResult.splitSetup.beforeDurations[0]
      && uiResult.splitSetup.totalAfter === uiResult.splitSetup.totalBefore
      && uiResult.splitSetup.playheadAfter === uiResult.splitSetup.playheadBefore
      && uiResult.splitSetup.multiSelectClosed
      && uiResult.splitSetup.snackbarVisible
      && uiResult.splitSetup.snackbarText.includes('已拆分镜头 01：1.2 秒 +')
      && splitAutosave.ok
      && JSON.stringify(splitAutosave.snapshot.content.shots.map((shot) => shot.id)) === JSON.stringify(uiResult.splitSetup.afterOrder)
      && splitAutosaveRightShot?.draftSource === 'split'
      && splitAutosaveRightShot?.splitSourceShotId === uiResult.splitSetup.beforeOrder[0]
      && splitAutosaveRightShot?.voiceSourceShotId === uiResult.splitSetup.beforeOrder[0]
      && splitAutosaveRightShot?.voiceOffsetSeconds === 1.2
      && splitAutosaveRightShot?.transitionIn === 'cut'
      && splitAutosaveLeftShot?.transitionOut === 'cut'
      && splitAutosaveRightShot?.motionRangeStart === splitAutosaveLeftShot?.motionRangeEnd
      && splitAutosaveRightShot?.image === splitAutosaveLeftShot?.image
      && JSON.stringify(uiResult.splitUndoRedo.undoOrder) === JSON.stringify(uiResult.splitSetup.beforeOrder)
      && uiResult.splitUndoRedo.undoPlayhead === uiResult.splitSetup.playheadBefore
      && JSON.stringify(uiResult.splitUndoRedo.redoOrder) === JSON.stringify(uiResult.splitSetup.afterOrder)
      && uiResult.splitUndoRedo.redoPlayhead === uiResult.splitSetup.playheadBefore
      && uiResult.splitUndoRedo.redoActiveShotId === uiResult.splitSetup.activeShotId
      && JSON.stringify(uiResult.splitUndoRedo.finalOrder) === JSON.stringify(uiResult.splitSetup.beforeOrder)
      && uiResult.splitUndoRedo.snackbarClosed
      && uiResult.reorderDragFeedback.trackActive
      && uiResult.reorderDragFeedback.segmentActive
      && uiResult.reorderDragFeedback.dropIndicatorVisible
      && uiResult.reorderDragFeedback.insertionIndex >= 0
      && uiResult.reorderDragFeedback.insertionIndex <= uiResult.pointerTimelineBefore.order.length
      && JSON.stringify(uiResult.pointerTimelineAfterReorder.order) === JSON.stringify([...uiResult.pointerTimelineBefore.order.slice(1), uiResult.pointerTimelineBefore.order[0]])
      && uiResult.pointerTimelineAfterReorder.linkedCueStart > uiResult.pointerTimelineBefore.linkedCueStart
      && uiResult.pointerTimelineAfterReorder.bgmStart === uiResult.pointerTimelineBefore.bgmStart
      && uiResult.pointerTimelineAfterResize.durations[0] > uiResult.pointerTimelineAfterReorder.durations[0]
      && uiResult.pointerTimelineAfterResize.total !== uiResult.pointerTimelineAfterReorder.total
      && uiResult.pointerTimelineAfterResize.bgmStart === uiResult.pointerTimelineAfterReorder.bgmStart
      && uiResult.timelineTotalText.includes('8.0 秒')
      && uiResult.imageReadinessText.includes('画面 1/3')
      && uiResult.audioReadinessText.includes('配音 1/2')
      && uiResult.subtitleReadinessText.includes('字幕 2/2')
      && uiResult.exportBridgeAvailable
      && uiResult.exportManagementBridgeAvailable
      && uiResult.subtitleBridgeAvailable
      && uiResult.exportButtonText === '导出本集 MP4'
      && uiResult.exportHistoryVisible
      && uiResult.subtitleCueCountBefore === 2
      && uiResult.subtitleCueCountAfterAdd === 3
      && uiResult.subtitleCueCountAfterDelete === 2
      && uiResult.subtitleStartAfterKeyboard === 0.1
      && uiResult.subtitleCueCountAfterSplit === 3
      && uiResult.subtitleCueCountAfterMerge === 2
      && uiResult.subtitleSecondStartAfterOffset === 2
      && uiResult.subtitleRailSegmentCount === 2
      && uiResult.subtitleResizeHandleCount === 4
      && uiResult.draggedSubtitleStart > 4.5
      && uiResult.draggedSubtitleStart < uiResult.pointerTimelineAfterResize.linkedCueStart
      && uiResult.resizedSubtitleEnd > 1.5
      && uiResult.resizedSubtitleEnd < 2.5
      && uiResult.historyControlsAvailable
      && uiResult.recoveryBridgeAvailable
      && uiResult.subtitleEndAfterUndoButton !== uiResult.resizedSubtitleEnd
      && uiResult.subtitleEndAfterRedoButton === uiResult.resizedSubtitleEnd
      && uiResult.subtitleEndAfterUndoShortcut !== uiResult.resizedSubtitleEnd
      && uiResult.subtitleEndAfterRedoShortcut === uiResult.resizedSubtitleEnd
      && uiResult.historyPanelVisible
      && uiResult.historyEntryCount > 0
      && uiResult.historyContainsUndoRedo
      && uiResult.recoveryPointCount > 0
      && uiResult.recoveryRestorePassed
      && recoveryRetention.count === 8
      && recoveryRetention.invalidRejected
      && uiResult.subtitleButtonsAvailable
      && uiResult.subtitlePreviewTop
      && uiResult.subtitlePreviewFontSize === '22px'
      && uiResult.audioTrackCount === 1
      && uiResult.audioTrackName === 'test-bgm'
      && Number(uiResult.audioTrackVolume) === 35
      && uiResult.waveformBarCount === 48
      && uiResult.waveformHeightCount > 4
      && uiResult.audioTrackPreviewActive
      && uiResult.audioTrackPreviewStopped
      && uiResult.audioTrackStartAfterKeyboard === 0.1
      && uiResult.mediaPlayCallCount >= 2
      && uiResult.draggedAudioTrackStart > 1.5
      && uiResult.selectedTimelineSubtitle === '真相就在门后'
      && Number(uiResult.seekValue) === 2.5
      && Number(uiResult.advancedSeekValue) >= Number(uiResult.seekValue)
      && editedAutosave.snapshot.content.episodes.length === 2
      && editedAutosave.snapshot.content.scenes.length === 3
      && editedAutosave.snapshot.content.shots.length === 3
      && editedAutosave.snapshot.content.lines.length === 2
      && editedAutosave.snapshot.content.characters.length === 3
      && editedAutosave.snapshot.content.scenes.find((scene) => scene.id === 3).action === '推开仓库大门。发现地面上的线索。'
      && editedAutosave.snapshot.content.scenes.find((scene) => scene.id === 3).narration === '真相就在门后。'
      && JSON.stringify(editedAutosave.snapshot.content.shots.map((shot) => shot.id)) === JSON.stringify(uiResult.pointerTimelineAfterResize.order)
      && persistedShotOne.episodeId === 2
      && persistedShotOne.sceneId === 3
      && persistedShotOne.action === '推开仓库大门'
      && persistedShotOne.dialogue === '跨页同步台词'
      && persistedShotOne.visualPrompt === '自定义电影感画面提示词'
      && persistedShotOne.costume === '深色风衣'
      && persistedShotOne.characterIds.includes(1)
      && persistedShotOne.characterIds.includes(2)
      && persistedShotOne.continuityLocked === true
      && persistedShotOne.image.startsWith('data:image/png;base64,')
      && persistedShotOne.imageStatus === '已完成'
      && persistedShotOne.imageSource === 'local'
      && persistedShotOne.imageFileName === 'test-shot.png'
      && persistedShotOne.imageAttempt === 0
      && persistedShotTwo.imageStatus === '未生成'
      && persistedShotTwo.imageSource === ''
      && persistedShotTwo.duration === `${uiResult.pointerTimelineAfterResize.durations[0].toFixed(1)}s`
      && editedAutosave.snapshot.content.shots.every((shot) => shot.motionEffect === uiResult.targetMotionPreset)
      && editedAutosave.snapshot.content.shots.every((shot) => shot.motionStrength === 18)
      && editedAutosave.snapshot.content.shots.every((shot) => shot.transition === 'fade')
      && editedAutosave.snapshot.content.shots.every((shot) => shot.transitionDuration === 0.35)
      && editedAutosave.snapshot.content.lines[0].episodeId === 2
      && editedAutosave.snapshot.content.lines[0].sceneId === 3
      && editedAutosave.snapshot.content.lines[0].text === '跨页同步台词'
      && editedAutosave.snapshot.content.lines[0].audio.startsWith('data:audio/wav;base64,')
      && editedAutosave.snapshot.content.lines[0].audioStatus === '已完成'
      && editedAutosave.snapshot.content.lines[0].audioSource === 'local'
      && editedAutosave.snapshot.content.lines[0].audioFileName === 'test-voice.wav'
      && editedAutosave.snapshot.content.lines[0].audioAttempt === 0
      && editedAutosave.snapshot.content.lines[1].audioStatus === '未生成'
      && editedAutosave.snapshot.content.lines[1].audioSource === ''
      && editedEpisodeProduction.audioTracks.length === 1
      && editedEpisodeProduction.audioTracks[0].kind === 'bgm'
      && editedEpisodeProduction.audioTracks[0].fileName === 'test-bgm.wav'
      && editedEpisodeProduction.audioTracks[0].audio.startsWith('data:audio/wav;base64,')
      && editedEpisodeProduction.audioTracks[0].volume === 35
      && editedEpisodeProduction.audioTracks[0].fadeIn === 1.5
      && editedEpisodeProduction.audioTracks[0].fadeOut === 1.5
      && editedEpisodeProduction.audioTracks[0].waveform.length === 48
      && editedEpisodeProduction.audioTracks[0].start === uiResult.draggedAudioTrackStart
      && editedEpisodeProduction.subtitleCues.length === 2
      && persistedResizedCue.end === uiResult.resizedSubtitleEnd
      && editedEpisodeProduction.subtitleCues.some((cue) => cue.start === uiResult.draggedSubtitleStart)
      && editedEpisodeProduction.subtitleStyle.fontSize === 64
      && editedEpisodeProduction.subtitleStyle.color === '#FFEEAA'
      && editedEpisodeProduction.subtitleStyle.position === 'top'
      && editedEpisodeProduction.subtitleStyle.backgroundOpacity === 55
      && !savedText.includes('apiKey')

    console.log(JSON.stringify({
      passed,
      autosavePath,
      projectName: loadResult.snapshot?.project?.name,
      migrationPassed,
      sizePreflightPassed,
      duplicatedTracksPersisted,
      recoveryRetention,
      uiResult,
      shotBatchScreenshotPath,
      shotBatchDuplicateScreenshotPath,
      shotSplitScreenshotPath,
      shotSafeDeleteScreenshotPath,
      persistedCounts: {
        episodes: editedAutosave.snapshot?.content?.episodes?.length,
        scenes: editedAutosave.snapshot?.content?.scenes?.length,
        shots: editedAutosave.snapshot?.content?.shots?.length,
        lines: editedAutosave.snapshot?.content?.lines?.length,
        characters: editedAutosave.snapshot?.content?.characters?.length,
        audioTracks: editedEpisodeProduction?.audioTracks?.length,
        subtitleCues: editedEpisodeProduction?.subtitleCues?.length,
      },
      shotMotionScreenshotPath,
      shotEditingScreenshotPath,
      audioTrackScreenshotPath,
      subtitleScreenshotPath,
      persistedLinks: {
        shot: persistedShotOne,
        line: editedAutosave.snapshot?.content?.lines?.[0],
      },
      apiKeyPresent: savedText.includes('apiKey'),
    }))

    for (const window of BrowserWindow.getAllWindows()) window.destroy()
    app.exit(passed ? 0 : 1)
  } catch (error) {
    const activeWindow = BrowserWindow.getAllWindows()[0]
    if (activeWindow && !activeWindow.isDestroyed()) {
      try {
        console.error(`Project UI test stage: ${await activeWindow.webContents.executeJavaScript('window.__testStage || "node-stage"')}`)
      } catch {}
    }
    console.error(error)
    app.exit(1)
  }
})
