const shotSizes = ['全景', '中景', '中近景', '近景']
const shotMotions = ['缓慢前移', '水平摇移', '推进', '跟拍', '固定']

const splitScriptText = (value) => String(value || '')
  .split(/[。！？；\n]+/u)
  .map((item) => item.trim())
  .filter(Boolean)

const estimateDuration = (action, dialogue) => {
  const contentLength = `${action}${dialogue}`.length
  return `${Math.min(6, Math.max(2.5, contentLength / 8)).toFixed(1)}s`
}

export const createStoryboardDrafts = ({ scene, lines = [], characters = [], episodeId, startId = 1 }) => {
  const actions = splitScriptText(scene.action)
  const narration = splitScriptText(scene.narration)
  const dialogueSequence = [
    ...lines.map((line) => String(line.text || '').trim()).filter(Boolean),
    ...narration,
  ]
  const shotCount = Math.min(8, Math.max(actions.length, lines.length, narration.length, 1))

  return Array.from({ length: shotCount }, (_, index) => {
    const action = actions[index]
      || actions[actions.length - 1]
      || `${scene.location || scene.title || '当前场景'}的环境建立镜头`
    const dialogue = dialogueSequence[index] || ''
    const speaker = characters.find((character) => character.name === lines[index]?.speaker)
    return {
      id: startId + index,
      episodeId,
      sceneId: scene.id,
      variant: ((scene.id + index) % 6) + 1,
      action,
      dialogue,
      duration: estimateDuration(action, dialogue),
      size: shotSizes[index % shotSizes.length],
      motion: shotMotions[index % shotMotions.length],
      characterIds: speaker ? [speaker.id] : [],
      costume: '角色默认服装',
      continuityLocked: true,
      image: '',
      imageStatus: '未生成',
      imageSource: '',
      imageFileName: '',
      imageError: '',
      imageAttempt: 0,
      draftSource: 'local-script',
    }
  })
}
