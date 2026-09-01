export const maximumDialogueSourceCharacters = 50000
export const maximumDialoguePreviewRows = 200
export const maximumDialogueTextCharacters = 500

export const dialogueEmotionOptions = [
  '默认',
  '沉稳',
  '冷静',
  '紧张',
  '愤怒',
  '悲伤',
  '温柔',
  '坚定',
  '低沉',
  '冷峻',
  '担忧',
  '从容',
]

const unicodeLength = (value) => Array.from(String(value || '')).length
const normalizeMatchValue = (value) => String(value || '').trim().toLocaleLowerCase('zh-CN')
const dialogueKey = (speaker, text) => `${normalizeMatchValue(speaker)}\u0000${String(text || '').trim()}`

const sanitizeSource = (value) => {
  const normalizedNewlines = String(value || '').replace(/\r\n?/gu, '\n').replace(/\t/gu, ' ')
  let removedControlCharacters = 0
  const source = Array.from(normalizedNewlines).filter((character) => {
    const codePoint = character.codePointAt(0)
    const allowed = character === '\n' || codePoint > 0x1F && !(codePoint >= 0x7F && codePoint <= 0x9F)
    if (!allowed) removedControlCharacters += 1
    return allowed
  }).join('')
  return { source, removedControlCharacters }
}

const parseSpeakerLabel = (value) => {
  const label = String(value || '').trim()
  const pair = [['（', '）'], ['(', ')'], ['[', ']']].find(([opening, closing]) => (
    label.includes(opening) && label.endsWith(closing)
  ))
  if (!pair) return { speakerLabel: label, emotionLabel: '' }
  const [opening, closing] = pair
  const openingIndex = label.lastIndexOf(opening)
  const speakerLabel = label.slice(0, openingIndex).trim()
  const emotionLabel = label.slice(openingIndex + opening.length, -closing.length).trim()
  return speakerLabel && emotionLabel
    ? { speakerLabel, emotionLabel }
    : { speakerLabel: label, emotionLabel: '' }
}

const findCharacter = (characters, speaker) => characters.find((character) => (
  normalizeMatchValue(character.name) === normalizeMatchValue(speaker)
))

export const parseDialogueSource = ({ source, characters = [] } = {}) => {
  const sanitized = sanitizeSource(source)
  const sourceCharacterCount = unicodeLength(sanitized.source)
  if (sourceCharacterCount > maximumDialogueSourceCharacters) {
    return {
      ...sanitized,
      sourceCharacterCount,
      rows: [],
      blocked: true,
      error: `原始文本最多 ${maximumDialogueSourceCharacters.toLocaleString('zh-CN')} 个字符。`,
    }
  }

  const rows = []
  let ignoredBlankLines = 0
  sanitized.source.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      ignoredBlankLines += 1
      return
    }
    const chineseColon = line.indexOf('：')
    const englishColon = line.indexOf(':')
    const colonIndexes = [chineseColon, englishColon].filter((position) => position >= 0)
    const colonIndex = colonIndexes.length ? Math.min(...colonIndexes) : -1
    if (colonIndex < 1) {
      rows.push({
        id: `source-${index + 1}`,
        lineNumber: index + 1,
        raw: line,
        formatRecognized: false,
        originalSpeaker: '',
        originalEmotion: '',
        speaker: '',
        emotion: '',
        text: line,
        included: false,
      })
      return
    }

    const { speakerLabel, emotionLabel } = parseSpeakerLabel(line.slice(0, colonIndex))
    const matchedCharacter = findCharacter(characters, speakerLabel)
    const emotion = emotionLabel
      ? dialogueEmotionOptions.includes(emotionLabel) ? emotionLabel : ''
      : '默认'
    rows.push({
      id: `source-${index + 1}`,
      lineNumber: index + 1,
      raw: line,
      formatRecognized: true,
      originalSpeaker: speakerLabel,
      originalEmotion: emotionLabel,
      speaker: matchedCharacter?.name || '',
      emotion,
      text: line.slice(colonIndex + 1).trim(),
      included: true,
    })
  })

  const tooManyRows = rows.length > maximumDialoguePreviewRows
  return {
    ...sanitized,
    sourceCharacterCount,
    rows: rows.slice(0, maximumDialoguePreviewRows),
    ignoredBlankLines,
    totalRows: rows.length,
    blocked: tooManyRows,
    error: tooManyRows ? `最多处理 ${maximumDialoguePreviewRows} 条台词，请分批提交。` : '',
  }
}

export const analyzeDialoguePreviewRows = ({
  rows = [],
  characters = [],
  existingLines = [],
  episodeId,
  sceneId,
  mode = 'append',
} = {}) => {
  const existingKeys = new Set(mode === 'append'
    ? existingLines
      .filter((line) => line.episodeId === episodeId && line.sceneId === sceneId)
      .map((line) => dialogueKey(line.speaker, line.text))
    : [])
  const previewKeys = new Set()

  return rows.map((row) => {
    if (!row.formatRecognized) {
      return { ...row, effectiveIncluded: false, valid: false, status: 'unrecognized-format', message: '未识别“角色：台词”格式' }
    }
    if (!row.included) {
      return { ...row, effectiveIncluded: false, valid: true, status: 'excluded', message: '已排除' }
    }
    const character = findCharacter(characters, row.speaker)
    if (!character) {
      const sourceName = row.originalSpeaker || row.speaker || '未知角色'
      return {
        ...row,
        effectiveIncluded: false,
        valid: false,
        status: sourceName === '旁白' ? 'narration' : 'unknown-speaker',
        message: sourceName === '旁白' ? '旁白请保留在页面的“旁白”字段' : `未匹配角色“${sourceName}”`,
      }
    }
    const text = String(row.text || '').trim()
    if (!text) {
      return { ...row, effectiveIncluded: false, valid: false, status: 'empty-text', message: '台词内容不能为空' }
    }
    if (unicodeLength(text) > maximumDialogueTextCharacters) {
      return { ...row, effectiveIncluded: false, valid: false, status: 'line-too-long', message: `单条台词最多 ${maximumDialogueTextCharacters} 个字符` }
    }
    if (!dialogueEmotionOptions.includes(row.emotion)) {
      return {
        ...row,
        effectiveIncluded: false,
        valid: false,
        status: 'unknown-emotion',
        message: row.originalEmotion ? `请选择情绪（原：${row.originalEmotion}）` : '请选择情绪',
      }
    }
    const key = dialogueKey(character.name, text)
    if (existingKeys.has(key) || previewKeys.has(key)) {
      return { ...row, effectiveIncluded: false, valid: true, status: 'duplicate', message: '与现有台词重复' }
    }
    previewKeys.add(key)
    return {
      ...row,
      speaker: character.name,
      text,
      effectiveIncluded: true,
      valid: true,
      status: 'ready',
      message: '已识别',
    }
  })
}

export const summarizeDialoguePreviewRows = (analyzedRows = []) => ({
  readyCount: analyzedRows.filter((row) => row.status === 'ready').length,
  unresolvedCount: analyzedRows.filter((row) => row.included && !row.valid).length,
  duplicateCount: analyzedRows.filter((row) => row.status === 'duplicate').length,
  excludedCount: analyzedRows.filter((row) => row.status === 'excluded' || row.status === 'unrecognized-format').length,
})

const lineHasAudio = (line) => Boolean(
  line.audio
  || line.audioFileName
  || line.audioSource
  || line.audioStatus === '已完成'
)

export const createDialogueCommit = ({
  lines = [],
  rows = [],
  characters = [],
  episodeId,
  scene,
  mode = 'append',
} = {}) => {
  const sceneId = scene?.id
  const analyzedRows = analyzeDialoguePreviewRows({ rows, characters, existingLines: lines, episodeId, sceneId, mode })
  const unresolved = analyzedRows.filter((row) => row.included && !row.valid)
  if (unresolved.length) {
    return { ok: false, error: '请先处理所有已勾选的待映射或错误台词。', analyzedRows }
  }
  const committedRows = analyzedRows.filter((row) => row.effectiveIncluded)
  if (!committedRows.length) {
    return { ok: false, error: '当前没有可同步的有效台词。', analyzedRows }
  }

  let nextId = Math.max(0, ...lines.map((line) => Number(line.id) || 0)) + 1
  const createdLines = committedRows.map((row) => {
    const character = findCharacter(characters, row.speaker)
    return {
      id: nextId++,
      episodeId,
      sceneId,
      scene: scene?.title || '未命名场景',
      speaker: character.name,
      text: row.text,
      emotion: row.emotion,
      duration: '0.0s',
      status: '未配音',
      variant: character.variant,
      audio: '',
      audioStatus: '未生成',
      audioSource: '',
      audioFileName: '',
      audioError: '',
      audioAttempt: 0,
    }
  })
  const removedLines = mode === 'replace'
    ? lines.filter((line) => line.episodeId === episodeId && line.sceneId === sceneId)
    : []

  let nextLines
  if (mode === 'replace') {
    nextLines = []
    let inserted = false
    lines.forEach((line) => {
      if (line.episodeId === episodeId && line.sceneId === sceneId) {
        if (!inserted) {
          nextLines.push(...createdLines)
          inserted = true
        }
        return
      }
      nextLines.push(line)
    })
    if (!inserted) nextLines.push(...createdLines)
  } else {
    nextLines = [...lines, ...createdLines]
  }

  return {
    ok: true,
    mode,
    lines: nextLines,
    createdLines,
    removedLines,
    removedAudioCount: removedLines.filter(lineHasAudio).length,
    analyzedRows,
  }
}
