export const maximumSceneLocationCharacters = 80
export const maximumSceneTimeCharacters = 40
export const maximumSceneWeatherCharacters = 40

export const sceneWeatherSuggestions = ['晴', '阴', '多云', '小雨', '暴雨', '雾', '雪', '室内']

const fieldDefinitions = {
  location: { label: '地点', maximum: maximumSceneLocationCharacters },
  time: { label: '时间', maximum: maximumSceneTimeCharacters },
  weather: { label: '天气', maximum: maximumSceneWeatherCharacters },
}

const countCharacters = (value) => Array.from(String(value ?? '')).length

const hasControlCharacter = (value) => Array.from(String(value ?? '')).some((character) => {
  const codePoint = character.codePointAt(0)
  return codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F)
})

const belongsToScene = (item, scene) => {
  if (!item || !scene || item.sceneId !== scene.id) return false
  return item.episodeId === undefined || scene.episodeId === undefined || item.episodeId === scene.episodeId
}

const hasMeaningfulValue = (value) => {
  const text = String(value || '').trim()
  return Boolean(text) && !/^(待设置|待设定|未设置)(地点|时间|天气)?$/u.test(text)
}

const parseShotSeconds = (value) => {
  const seconds = Number.parseFloat(String(value ?? '').trim())
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

const formatNumber = (value) => Number(value.toFixed(1)).toString()

export const validateSceneMetadataField = (field, value) => {
  const definition = fieldDefinitions[field]
  if (!definition) return { ok: false, error: '未知的场景信息字段。' }
  const text = String(value ?? '')
  if (hasControlCharacter(text)) {
    return { ok: false, error: `${definition.label}不能包含不可见控制字符。` }
  }
  if (countCharacters(text) > definition.maximum) {
    return { ok: false, error: `${definition.label}最多输入 ${definition.maximum} 个字符。` }
  }
  return { ok: true, value: text }
}

export const normalizeMainCharacterIds = (ids, characters = []) => {
  const selected = new Set(Array.isArray(ids) ? ids : [])
  return characters.filter((character) => selected.has(character.id)).map((character) => character.id)
}

export const normalizeSceneMetadata = (scene, characters = []) => ({
  ...scene,
  weather: typeof scene?.weather === 'string' ? scene.weather : '',
  mainCharacterIds: normalizeMainCharacterIds(scene?.mainCharacterIds, characters),
})

export const inferSceneCharacterIds = ({ scene, lines = [], shots = [], characters = [] }) => {
  const referencedIds = new Set()
  const referencedNames = new Set(
    lines
      .filter((line) => belongsToScene(line, scene) && String(line.text || '').trim())
      .map((line) => String(line.speaker || '').trim())
      .filter(Boolean),
  )

  shots.filter((shot) => belongsToScene(shot, scene)).forEach((shot) => {
    if (!Array.isArray(shot.characterIds)) return
    shot.characterIds.forEach((id) => referencedIds.add(id))
  })

  return characters
    .filter((character) => referencedIds.has(character.id) || referencedNames.has(String(character.name || '').trim()))
    .map((character) => character.id)
}

export const estimateSceneDuration = ({ scene, lines = [], shots = [] }) => {
  const sceneShots = shots.filter((shot) => belongsToScene(shot, scene))
  if (sceneShots.length) {
    const seconds = sceneShots.reduce((total, shot) => total + parseShotSeconds(shot.duration), 0)
    return {
      seconds: Number(seconds.toFixed(1)),
      source: 'shots',
      shotCount: sceneShots.length,
      spokenCharacters: 0,
      actionUnitCount: 0,
    }
  }

  const sceneLines = lines.filter((line) => belongsToScene(line, scene))
  const narrationText = String(scene?.narration || '')
  const dialogueText = sceneLines.map((line) => String(line.text || '')).join('')
  const spokenCharacters = countCharacters(`${narrationText}${dialogueText}`.replace(/\s/gu, ''))
  const actionUnitCount = String(scene?.action || '')
    .split(/[\n。！？!?；;]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .length

  if (!spokenCharacters && !actionUnitCount) {
    return { seconds: 0, source: 'empty', shotCount: 0, spokenCharacters: 0, actionUnitCount: 0 }
  }

  const rawSeconds = spokenCharacters / 4.2 + actionUnitCount * 1.5
  const seconds = Math.max(2, Math.round(rawSeconds * 2) / 2)
  return { seconds, source: 'script', shotCount: 0, spokenCharacters, actionUnitCount }
}

export const formatSceneDuration = (seconds) => {
  const duration = Math.max(0, Number(seconds) || 0)
  if (!duration) return '--'
  if (duration < 60) return `${formatNumber(duration)} 秒`
  const minutes = Math.floor(duration / 60)
  const remainingSeconds = Number((duration - minutes * 60).toFixed(1))
  return remainingSeconds ? `${minutes} 分 ${formatNumber(remainingSeconds)} 秒` : `${minutes} 分钟`
}

export const calculateSceneReadiness = ({ scene, lines = [], shots = [], characters = [] }) => {
  const sceneLines = lines.filter((line) => belongsToScene(line, scene))
  const sceneShots = shots.filter((shot) => belongsToScene(shot, scene))
  const selectedCharacterIds = normalizeMainCharacterIds(scene?.mainCharacterIds, characters)
  const environmentReady = ['location', 'time', 'weather'].every((field) => hasMeaningfulValue(scene?.[field]))
  const actionReady = Boolean(String(scene?.action || '').trim())
  const narrativeReady = Boolean(String(scene?.narration || '').trim())
    || sceneLines.some((line) => String(line.text || '').trim())
  const charactersReady = selectedCharacterIds.length > 0
  const shotsReady = sceneShots.length > 0

  const checks = [
    {
      key: 'environment',
      complete: environmentReady,
      label: environmentReady ? '环境信息完整' : '补充地点、时间或天气',
      target: 'environment',
    },
    {
      key: 'action',
      complete: actionReady,
      label: actionReady ? '动作描述已填写' : '补充动作描述',
      target: 'action',
    },
    {
      key: 'narrative',
      complete: narrativeReady,
      label: narrativeReady ? '叙事内容已填写' : '补充旁白或台词',
      target: 'narrative',
    },
    {
      key: 'characters',
      complete: charactersReady,
      label: charactersReady ? '主要角色已设置' : '选择主要角色',
      target: 'characters',
    },
    {
      key: 'shots',
      complete: shotsReady,
      label: shotsReady ? `已有 ${sceneShots.length} 个分镜` : '尚未生成分镜',
      target: 'shots',
    },
  ]
  const score = checks.filter((check) => check.complete).length * 20
  return {
    score,
    status: score === 100 ? '已就绪' : score >= 60 ? '可继续完善' : '待补充',
    checks,
    completedCount: score / 20,
  }
}

export const summarizeSceneMetadata = ({ scene, lines = [], shots = [], characters = [] }) => {
  const selectedCharacterIds = normalizeMainCharacterIds(scene?.mainCharacterIds, characters)
  const inferredCharacterIds = inferSceneCharacterIds({ scene, lines, shots, characters })
  const duration = estimateSceneDuration({ scene, lines, shots })
  const readiness = calculateSceneReadiness({ scene, lines, shots, characters })
  return {
    selectedCharacterIds,
    inferredCharacterIds,
    displayCharacterIds: selectedCharacterIds.length ? selectedCharacterIds : inferredCharacterIds,
    duration: { ...duration, label: formatSceneDuration(duration.seconds) },
    readiness,
  }
}
