export const maximumScriptOrganizerCharacters = 200000
export const maximumOrganizedDialogueCharacters = 500

export const defaultScriptOrganizerScopes = Object.freeze({
  action: true,
  narration: true,
  dialogue: true,
})

export const defaultScriptOrganizerRules = Object.freeze({
  removeControls: true,
  normalizeLineBreaks: true,
  trimWhitespace: true,
  collapseBlankLines: true,
  punctuation: false,
})

export const scriptOrganizerScopeOptions = Object.freeze([
  { id: 'action', label: '动作描述' },
  { id: 'narration', label: '旁白' },
  { id: 'dialogue', label: '角色台词' },
])

export const scriptOrganizerRuleOptions = Object.freeze([
  { id: 'removeControls', label: '移除不可见控制字符', hint: '删除不影响排版的异常字符' },
  { id: 'normalizeLineBreaks', label: '统一换行与制表符', hint: '统一为本地纯文本格式' },
  { id: 'trimWhitespace', label: '清理首尾和重复空白', hint: '保留段落与原有词句' },
  { id: 'collapseBlankLines', label: '合并连续空行', hint: '段落间最多保留一行' },
  { id: 'punctuation', label: '补齐中文句末标点', hint: '仅补末尾标点，不改写词句', optional: true },
])

const reasonLabels = Object.freeze({
  removeControls: '移除不可见字符',
  normalizeLineBreaks: '统一换行/制表符',
  trimWhitespace: '清理多余空白',
  collapseBlankLines: '合并连续空行',
  punctuation: '补齐句末标点',
})

const terminalPunctuationPattern = /[。！？!?…；;：:]$/u
const onlyNumberPattern = /^[+-]?(?:\d+(?:[.,]\d+)*)$/u
const urlPattern = /^(?:https?:\/\/|www\.)\S+$/iu
const windowsPathPattern = /^[A-Za-z]:[\\/].+/u
const unixPathPattern = /^\/(?:[^/\n]+\/)*[^/\n]*$/u
const stageDirectionPattern = /^(?:\[[^\]]+\]|【[^】]+】|\([^)]*\)|（[^）]*）)$/u
const emojiOnlyPattern = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200D|\uFE0E|\uFE0F|\s)+$/u

const countCharacters = (value) => Array.from(String(value ?? '')).length

const isControlCharacter = (character) => {
  const codePoint = character.codePointAt(0)
  return (codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F))
    && character !== '\n'
    && character !== '\r'
    && character !== '\t'
}

const shouldAppendPunctuation = (value) => {
  const text = value.trim()
  if (!text || terminalPunctuationPattern.test(text)) return false
  if (urlPattern.test(text) || windowsPathPattern.test(text) || unixPathPattern.test(text)) return false
  if (onlyNumberPattern.test(text) || stageDirectionPattern.test(text) || emojiOnlyPattern.test(text)) return false
  return true
}

const appendParagraphPunctuation = (value) => value
  .split('\n')
  .map((line) => shouldAppendPunctuation(line) ? `${line}。` : line)
  .join('\n')

const setReason = (reasons, id) => {
  if (!reasons.includes(id)) reasons.push(id)
}

export const normalizeScriptText = (value, rules = defaultScriptOrganizerRules) => {
  const original = String(value ?? '')
  const activeRules = { ...defaultScriptOrganizerRules, ...rules }
  const reasons = []
  const counts = {
    removedControls: 0,
    normalizedLineBreaks: 0,
    normalizedTabs: 0,
    trimmedLines: 0,
    collapsedWhitespace: 0,
    collapsedBlankLines: 0,
    appendedPunctuation: 0,
  }
  let text = original

  if (activeRules.removeControls) {
    let next = ''
    for (const character of text) {
      if (isControlCharacter(character)) {
        counts.removedControls += 1
      } else {
        next += character
      }
    }
    if (next !== text) setReason(reasons, 'removeControls')
    text = next
  }

  if (activeRules.normalizeLineBreaks) {
    const lineBreakMatches = text.match(/\r\n|\r/gu)
    const tabMatches = text.match(/\t/gu)
    const next = text.replace(/\r\n|\r/gu, '\n').replace(/\t/gu, ' ')
    counts.normalizedLineBreaks = lineBreakMatches?.length || 0
    counts.normalizedTabs = tabMatches?.length || 0
    if (next !== text) setReason(reasons, 'normalizeLineBreaks')
    text = next
  }

  if (activeRules.trimWhitespace) {
    const lines = text.split('\n')
    const nextLines = lines.map((line) => {
      const trimmed = line.replace(/^[ \u3000]+|[ \u3000]+$/gu, '')
      if (trimmed !== line) counts.trimmedLines += 1
      const collapsed = trimmed.replace(/[ \u3000]{2,}/gu, ' ')
      if (collapsed !== trimmed) counts.collapsedWhitespace += 1
      return collapsed
    })
    const next = nextLines.join('\n')
    if (next !== text) setReason(reasons, 'trimWhitespace')
    text = next
  }

  if (activeRules.collapseBlankLines) {
    const matches = text.match(/\n{3,}/gu) || []
    const next = text.replace(/\n{3,}/gu, '\n\n')
    counts.collapsedBlankLines = matches.reduce((total, match) => total + Math.max(1, match.length - 2), 0)
    if (next !== text) setReason(reasons, 'collapseBlankLines')
    text = next
  }

  if (activeRules.punctuation) {
    const next = appendParagraphPunctuation(text)
    if (next !== text) {
      counts.appendedPunctuation = next.split('\n').reduce((total, line, index) => (
        line !== text.split('\n')[index] ? total + 1 : total
      ), 0)
      setReason(reasons, 'punctuation')
    }
    text = next
  }

  return {
    original,
    text,
    changed: text !== original,
    reasons,
    reasonLabels: reasons.map((reason) => reasonLabels[reason]),
    counts,
    characterCount: countCharacters(text),
  }
}

const lineHasAudioState = (line) => Boolean(
  line.audio
  || line.audioFileName
  || line.audioSource
  || (line.audioStatus && line.audioStatus !== '未生成')
)

const createChange = ({ id, kind, label, title, before, normalized, lineId = 0, audioImpact = false }) => ({
  id,
  kind,
  label,
  title,
  before,
  after: normalized.text,
  reasons: normalized.reasons,
  reasonLabels: normalized.reasonLabels,
  lineId,
  audioImpact,
})

const createDiagnostic = (id, kind, severity, message, title = '') => ({ id, kind, severity, message, title })

const normalizeScopes = (scopes) => ({ ...defaultScriptOrganizerScopes, ...scopes })
const normalizeRules = (rules) => ({ ...defaultScriptOrganizerRules, ...rules })

export const createScriptOrganizerPreview = ({
  scene,
  lines = [],
  shots = [],
  episodeId,
  scopes = defaultScriptOrganizerScopes,
  rules = defaultScriptOrganizerRules,
}) => {
  const activeScopes = normalizeScopes(scopes)
  const activeRules = normalizeRules(rules)
  const selectedScopeCount = Object.values(activeScopes).filter(Boolean).length
  if (!selectedScopeCount) {
    return {
      error: '请至少保留一个整理范围。',
      changes: [],
      diagnostics: [],
      ruleCounts: {},
      shotCount: 0,
      totalCharacters: 0,
    }
  }

  const currentLines = lines.filter((line) => line.episodeId === episodeId && line.sceneId === scene.id)
  const currentShots = shots.filter((shot) => shot.episodeId === episodeId && shot.sceneId === scene.id)
  const sourceValues = [
    activeScopes.action ? scene.action || '' : '',
    activeScopes.narration ? scene.narration || '' : '',
    ...(activeScopes.dialogue ? currentLines.map((line) => line.text || '') : []),
  ]
  const totalCharacters = sourceValues.reduce((total, value) => total + countCharacters(value), 0)
  if (totalCharacters > maximumScriptOrganizerCharacters) {
    return {
      error: '当前场景文本过大，无法安全整理，请先分段处理。',
      changes: [],
      diagnostics: [],
      ruleCounts: {},
      shotCount: currentShots.length,
      totalCharacters,
    }
  }

  const changes = []
  const diagnostics = []

  if (activeScopes.action) {
    const action = String(scene.action || '')
    const normalized = normalizeScriptText(action, activeRules)
    if (normalized.changed) {
      changes.push(createChange({
        id: `scene-${scene.id}-action`,
        kind: 'action',
        label: '动作',
        title: '动作描述',
        before: action,
        normalized,
      }))
    }
    if (!action.trim()) {
      diagnostics.push(createDiagnostic('empty-action', 'action', 'warning', '动作描述为空，生成分镜草稿时内容可能不足。'))
    }
  }

  if (activeScopes.narration) {
    const narration = String(scene.narration || '')
    const normalized = normalizeScriptText(narration, activeRules)
    if (normalized.changed) {
      changes.push(createChange({
        id: `scene-${scene.id}-narration`,
        kind: 'narration',
        label: '旁白',
        title: '场景旁白',
        before: narration,
        normalized,
      }))
    }
    if (!narration.trim()) {
      diagnostics.push(createDiagnostic('empty-narration', 'narration', 'info', '当前场景没有旁白；若非必要可忽略。'))
    }
  }

  if (activeScopes.dialogue) {
    const duplicateGroups = new Map()
    currentLines.forEach((line, index) => {
      const text = String(line.text || '')
      const normalized = normalizeScriptText(text, activeRules)
      if (normalized.changed) {
        changes.push(createChange({
          id: `line-${line.id}`,
          kind: 'dialogue',
          label: '台词',
          title: `${line.speaker || '未知角色'} · 第 ${index + 1} 条`,
          before: text,
          normalized,
          lineId: line.id,
          audioImpact: lineHasAudioState(line),
        }))
      }
      if (!text.trim()) {
        diagnostics.push(createDiagnostic(`empty-line-${line.id}`, 'dialogue', 'error', `${line.speaker || '未知角色'}的第 ${index + 1} 条台词为空。`, `台词 ID ${line.id}`))
      }
      if (countCharacters(text) > maximumOrganizedDialogueCharacters) {
        diagnostics.push(createDiagnostic(`long-line-${line.id}`, 'dialogue', 'warning', `${line.speaker || '未知角色'}的第 ${index + 1} 条台词超过 ${maximumOrganizedDialogueCharacters} 个字符。`, `台词 ID ${line.id}`))
      }
      const duplicateKey = `${String(line.speaker || '').trim()}\u0000${text.trim()}`
      if (text.trim()) duplicateGroups.set(duplicateKey, [...(duplicateGroups.get(duplicateKey) || []), line.id])
    })
    for (const ids of duplicateGroups.values()) {
      if (ids.length > 1) {
        diagnostics.push(createDiagnostic(`duplicate-lines-${ids.join('-')}`, 'dialogue', 'warning', `发现 ${ids.length} 条完全重复台词；不会自动删除。`, `台词 ID ${ids.join('、')}`))
      }
    }
  }

  if (!String(scene.location || '').trim() || String(scene.location).trim() === '待设置') {
    diagnostics.push(createDiagnostic('missing-location', 'meta', 'warning', '场景地点仍为“待设置”。'))
  }
  if (!String(scene.time || '').trim() || String(scene.time).trim() === '待设置') {
    diagnostics.push(createDiagnostic('missing-time', 'meta', 'warning', '场景时间仍为“待设置”。'))
  }
  if (currentShots.length) {
    diagnostics.push(createDiagnostic('existing-shots', 'shots', 'info', `当前场景已有 ${currentShots.length} 个分镜；整理后不会自动重建。`))
  }

  const ruleCounts = Object.fromEntries(scriptOrganizerRuleOptions.map((rule) => [
    rule.id,
    changes.filter((change) => change.reasons.includes(rule.id)).length,
  ]))

  return {
    error: '',
    changes,
    diagnostics,
    ruleCounts,
    shotCount: currentShots.length,
    totalCharacters,
    currentLineCount: currentLines.length,
    scopes: activeScopes,
    rules: activeRules,
  }
}

export const summarizeScriptOrganizerSelection = (preview, includedChangeIds) => {
  const idSet = new Set(includedChangeIds || preview.changes.map((change) => change.id))
  const selectedChanges = preview.changes.filter((change) => idSet.has(change.id))
  const audioLineIds = new Set(selectedChanges.filter((change) => change.audioImpact).map((change) => change.lineId))
  return {
    selectedChanges,
    selectedCount: selectedChanges.length,
    totalCount: preview.changes.length,
    audioCount: audioLineIds.size,
    warningCount: preview.diagnostics.filter((item) => item.severity !== 'info').length,
    shotCount: preview.shotCount || 0,
    byKind: {
      action: selectedChanges.filter((change) => change.kind === 'action').length,
      narration: selectedChanges.filter((change) => change.kind === 'narration').length,
      dialogue: selectedChanges.filter((change) => change.kind === 'dialogue').length,
    },
    canCommit: !preview.error && selectedChanges.length > 0,
  }
}

export const createScriptOrganizerCommit = ({
  scenes = [],
  lines = [],
  selectedChanges = [],
  episodeId,
  sceneId,
}) => {
  if (!selectedChanges.length) {
    return { ok: false, error: '没有选中可应用的整理项。' }
  }
  const actionChange = selectedChanges.find((change) => change.kind === 'action')
  const narrationChange = selectedChanges.find((change) => change.kind === 'narration')
  const dialogueChanges = new Map(selectedChanges
    .filter((change) => change.kind === 'dialogue' && change.lineId)
    .map((change) => [change.lineId, change]))

  let sceneUpdated = false
  const nextScenes = scenes.map((scene) => {
    if (scene.episodeId !== episodeId || scene.id !== sceneId) return scene
    const next = {
      ...scene,
      ...(actionChange ? { action: actionChange.after } : {}),
      ...(narrationChange ? { narration: narrationChange.after } : {}),
    }
    sceneUpdated = Boolean(actionChange || narrationChange)
    return next
  })

  const changedLineIds = []
  let audioResetCount = 0
  const nextLines = lines.map((line) => {
    const change = dialogueChanges.get(line.id)
    if (!change || line.episodeId !== episodeId || line.sceneId !== sceneId) return line
    changedLineIds.push(line.id)
    if (lineHasAudioState(line)) audioResetCount += 1
    return {
      ...line,
      text: change.after,
      status: '未配音',
      duration: '0.0s',
      audioStatus: '未生成',
      audio: '',
      audioSource: '',
      audioFileName: '',
      audioError: '台词内容已整理，请重新生成或替换音频',
      audioAttempt: 0,
      audioUpdatedAt: '',
    }
  })

  return {
    ok: true,
    scenes: nextScenes,
    lines: nextLines,
    updatedCount: Number(Boolean(actionChange)) + Number(Boolean(narrationChange)) + changedLineIds.length,
    sceneUpdated,
    changedLineIds,
    audioResetCount,
  }
}
