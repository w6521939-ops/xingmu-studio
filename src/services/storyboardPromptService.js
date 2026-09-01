const clean = (value, fallback = '') => String(value || fallback).trim()

export const inferShotCharacterIds = (shot, characters = []) => {
  if (Array.isArray(shot.characterIds)) {
    return shot.characterIds.filter((id) => characters.some((character) => character.id === id))
  }
  const searchableText = `${shot.action || ''}${shot.dialogue || ''}`
  return characters.filter((character) => searchableText.includes(character.name)).map((character) => character.id)
}

export const createShotVisualPrompt = ({ shot, scene, characters = [] }) => {
  const characterIds = inferShotCharacterIds(shot, characters)
  const characterNames = characters
    .filter((character) => characterIds.includes(character.id))
    .map((character) => `${character.name}（${character.role || '角色'}，${character.relation || character.tone || '保持设定'}）`)
  const sceneDescription = `${clean(scene?.title, '当前场景')}，${clean(scene?.location, '待设定地点')}，${clean(scene?.time, '待设定时间')}，${clean(scene?.weather, '待设定天气')}`
  const continuity = shot.continuityLocked === false
    ? '允许根据本镜头重新设计局部细节'
    : '严格保持角色面部、发型、服装、场景空间与前后镜头连续一致'

  return [
    `漫剧分镜画面，场景：${sceneDescription}`,
    `角色：${characterNames.length ? characterNames.join('、') : '无明确出镜角色'}`,
    `服装：${clean(shot.costume, '沿用角色默认服装')}`,
    `画面动作：${clean(shot.action, '建立场景氛围')}`,
    shot.dialogue ? `对白或旁白情绪参考：${shot.dialogue}` : '',
    `镜头语言：${clean(shot.size, '中景')}，${clean(shot.motion, '固定镜头')}，预计 ${clean(shot.duration, '3.0s')}`,
    '电影级构图，精致国风漫画质感，清晰人物轮廓，层次化光影，竖屏 9:16，无水印，无界面文字',
    continuity,
  ].filter(Boolean).join('；')
}
