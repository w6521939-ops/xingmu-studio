import { createProjectLocalId } from './projectModel.js'
import { normalizeShotMotionSettings } from './shotMotionService.js'
import { createShotVisualPrompt } from './storyboardPromptService.js'

const shotSizeLabels = {
  extreme_wide: '大远景',
  'extreme wide': '大远景',
  wide: '全景',
  full: '全景',
  medium_wide: '中全景',
  'medium wide': '中全景',
  medium: '中景',
  medium_close: '中近景',
  'medium close': '中近景',
  close: '近景',
  close_up: '特写',
  'close-up': '特写',
  'close up': '特写',
  extreme_close: '大特写',
  'extreme close': '大特写',
}

const clean = (value, fallback = '') => String(value ?? '').trim() || fallback

const parseTimePoint = (value) => {
  const parts = String(value || '').trim().split(':').map(Number)
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return Number.NaN
  return parts.reduce((total, part) => total * 60 + part, 0)
}

const parseShotDuration = (value, fallback = 3) => {
  const range = String(value || '').replace(/[—–至~～]/gu, '-').split('-').map((part) => part.trim()).filter(Boolean)
  if (range.length >= 2) {
    const start = parseTimePoint(range[0].replace(/[^\d:.]/gu, ''))
    const end = parseTimePoint(range[1].replace(/[^\d:.]/gu, ''))
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.min(30, Math.max(0.5, end - start))
    }
  }
  const seconds = Number.parseFloat(String(value || '').match(/\d+(?:\.\d+)?/u)?.[0] || '')
  return Math.min(30, Math.max(0.5, Number.isFinite(seconds) && seconds > 0 ? seconds : fallback))
}

const resolveSectionScene = (section, sourceScenes, sectionIndex) => {
  const continuity = section.shots.flatMap((shot) => shot.continuity || [])
  return sourceScenes.find((scene) => continuity.includes(scene.id))
    || sourceScenes[Math.min(sectionIndex, sourceScenes.length - 1)]
    || sourceScenes[0]
}

const parseDialogue = (dialogue, characters, shotCharacterIds) => {
  const value = clean(dialogue)
  if (!value) return null
  const match = value.match(/^([^：:]{1,20})[：:]\s*(.+)$/u)
  const matchedCharacter = match
    ? characters.find((character) => character.name === match[1].trim())
    : characters.find((character) => shotCharacterIds.includes(character.id) && value.includes(character.name))
  const speaker = matchedCharacter?.name || (match ? clean(match[1], '旁白') : '旁白')
  const text = clean(match?.[2] || value.replace(new RegExp(`^${speaker}[：:]?\\s*`, 'u'), ''))
  return text ? { speaker, text, variant: matchedCharacter?.variant || 1 } : null
}

export const createProjectFromBailianScript = (script, request = {}) => {
  if (!script?.sections?.length || !script?.characters?.length || !script?.scenes?.length) {
    throw new Error('百炼剧本缺少可转换的角色、场景或分段')
  }

  const characters = script.characters.map((character, index) => ({
    id: index + 1,
    sourceId: character.id,
    name: clean(character.name, `角色${index + 1}`),
    role: clean(character.identity, index === 0 ? '主角' : '角色'),
    variant: (index % 6) + 1,
    tone: clean(character.voice, '待选择声音'),
    relation: clean(character.identity, '剧情角色'),
    appearance: clean(character.appearance),
    costume: clean(character.costume, '角色默认服装'),
    forbiddenDrift: Array.isArray(character.forbiddenDrift) ? character.forbiddenDrift : [],
  }))
  const characterBySourceId = new Map(characters.map((character) => [character.sourceId, character]))
  const props = (Array.isArray(script.props) ? script.props : []).map((prop, index) => ({
    id: index + 1,
    sourceId: clean(prop.id, `P${String(index + 1).padStart(2, '0')}`),
    name: clean(prop.name, `道具${index + 1}`),
    description: clean(prop.appearance),
    appearance: clean(prop.appearance),
    function: clean(prop.storyFunction),
    forbiddenDrift: Array.isArray(prop.forbiddenDrift) ? prop.forbiddenDrift : [],
    image: '',
    imageStatus: '未生成',
    imageSource: '',
    imageAssetId: '',
    imageBytes: 0,
    imageSha256: '',
    imageFileName: '',
    imageError: '',
    imageAttempt: 0,
  }))
  const propBySourceId = new Map(props.map((prop) => [prop.sourceId, prop]))

  const scenes = script.sections.map((section, index) => {
    const sourceScene = resolveSectionScene(section, script.scenes, index)
    const mainCharacterIds = Array.from(new Set(section.shots.flatMap((shot) => (
      (shot.continuity || []).map((sourceId) => characterBySourceId.get(sourceId)?.id).filter(Boolean)
    ))))
    return {
      id: index + 1,
      sourceId: sourceScene?.id || section.id,
      episodeId: 1,
      title: clean(sourceScene?.name, `剧情段落 ${index + 1}`),
      location: clean(sourceScene?.name, `场景 ${index + 1}`),
      time: clean(sourceScene?.time, '待设定'),
      weather: clean(sourceScene?.weather, '待设定'),
      layout: clean(sourceScene?.layout),
      lighting: clean(sourceScene?.lighting),
      palette: clean(sourceScene?.palette),
      mainCharacterIds,
      status: index === 0 ? '当前编辑' : '未完成',
      action: clean(section.goal),
      narration: '',
    }
  })

  let shotId = 0
  let lineId = 0
  const lines = []
  const shots = script.sections.flatMap((section, sectionIndex) => {
    const scene = scenes[sectionIndex]
    const fallbackDuration = Number(section.durationSeconds) / Math.max(1, section.shots.length)
    return section.shots.map((sourceShot) => {
      shotId += 1
      const characterIds = Array.from(new Set((sourceShot.continuity || [])
        .map((sourceId) => characterBySourceId.get(sourceId)?.id)
        .filter(Boolean)))
      const propIds = Array.from(new Set((sourceShot.continuity || [])
        .map((sourceId) => propBySourceId.get(sourceId)?.id)
        .filter(Boolean)))
      if (!characterIds.length) {
        characters.forEach((character) => {
          if (`${sourceShot.action}${sourceShot.dialogue}`.includes(character.name)) characterIds.push(character.id)
        })
      }
      const firstCharacter = characters.find((character) => characterIds.includes(character.id))
      const duration = parseShotDuration(sourceShot.time, fallbackDuration)
      const shot = {
        id: shotId,
        sourceId: sourceShot.id,
        episodeId: 1,
        sceneId: scene.id,
        variant: ((shotId - 1) % 6) + 1,
        action: clean(sourceShot.action, section.goal),
        dialogue: clean(sourceShot.dialogue),
        sound: clean(sourceShot.sound),
        continuity: Array.isArray(sourceShot.continuity) ? sourceShot.continuity : [],
        duration: `${duration.toFixed(1)}s`,
        size: shotSizeLabels[clean(sourceShot.size).toLowerCase()] || clean(sourceShot.size, '中景'),
        motion: clean(sourceShot.camera, '固定镜头'),
        characterIds,
        propIds,
        costume: firstCharacter?.costume || '角色默认服装',
        continuityLocked: true,
        image: '',
        imageStatus: '未生成',
        imageSource: '',
        imageFileName: '',
        imageError: '',
        imageAttempt: 0,
      }
      Object.assign(shot, normalizeShotMotionSettings(shot))
      shot.visualPrompt = createShotVisualPrompt({ shot, scene, characters })

      const dialogue = parseDialogue(sourceShot.dialogue, characters, characterIds)
      if (dialogue) {
        lineId += 1
        lines.push({
          id: lineId,
          episodeId: 1,
          sceneId: scene.id,
          scene: scene.title,
          speaker: dialogue.speaker,
          text: dialogue.text,
          emotion: '自然',
          duration: `${Math.min(duration, Math.max(1.2, dialogue.text.length / 4.2)).toFixed(1)}s`,
          status: '未配音',
          variant: dialogue.variant,
          sourceShotId: shotId,
          audio: '',
          audioStatus: '未生成',
          audioSource: '',
          audioFileName: '',
          audioError: '',
          audioAttempt: 0,
        })
      }
      return shot
    })
  })

  const durationSeconds = shots.reduce((total, shot) => total + Number.parseFloat(shot.duration), 0)
  const requestedDuration = clean(request.duration, `${Math.round(durationSeconds)}秒`)
  return {
    projectMeta: {
      localProjectId: createProjectLocalId(),
      name: clean(script.title, `${clean(request.genre, '漫剧')}新作`),
      genre: clean(request.genre, '漫剧'),
      ratio: clean(request.ratio, '9:16'),
      duration: requestedDuration,
      episodeCount: 1,
      logline: clean(script.logline),
      visualStyle: clean(script.visualStyle),
    },
    storySeed: clean(request.storySeed || request.theme, clean(script.theme)),
    episodes: [{
      id: 1,
      title: clean(script.title, '第一集'),
      scenes: scenes.length,
      variant: 1,
      statuses: ['剧本'],
      next: '继续剧本',
    }],
    scenes,
    characters,
    props,
    shots,
    lines,
  }
}
