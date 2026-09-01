export const maximumScenePromptCharacters = 3000
export const maximumSceneImageReferences = 3
export const sceneImageSize = '1536*1024'

const cleanText = (value) => String(value || '').trim()
const isImageDataUrl = (value) => (
  /^data:image\/[a-z0-9.+-]+;base64,/iu.test(cleanText(value))
  || isManagedGeneratedImageUrl(value)
)

export const createSceneSettingPrompt = ({ scene = {}, storySeed = '', characters = [] } = {}) => {
  const cast = characters
    .filter((character) => Array.isArray(scene.mainCharacterIds) && scene.mainCharacterIds.includes(character.id))
    .map((character) => `${cleanText(character.name)}（${cleanText(character.role) || '角色'}）`)
    .filter(Boolean)
  return [
    `请完善漫剧场景“${cleanText(scene.title) || '未命名场景'}”的可执行设定。`,
    cleanText(storySeed) ? `故事梗概：${cleanText(storySeed)}` : '',
    cast.length ? `场景主要角色：${cast.join('、')}` : '',
    cleanText(scene.action) ? `现有动作：${cleanText(scene.action)}` : '',
    cleanText(scene.narration) ? `现有旁白：${cleanText(scene.narration)}` : '',
    '请补全空间位置、时间天气、布局、灯光、色彩、动作、旁白和少量可追加对白；不要覆盖现有文本。',
  ].filter(Boolean).join('\n')
}

export const createSceneImagePrompt = ({ scene = {}, storySeed = '', characters = [] } = {}) => {
  const cast = characters
    .filter((character) => Array.isArray(scene.mainCharacterIds) && scene.mainCharacterIds.includes(character.id))
    .map((character) => [
      cleanText(character.name),
      cleanText(character.appearance),
      cleanText(character.costume),
    ].filter(Boolean).join('，'))
    .filter(Boolean)
  return [
    '中国漫剧场景设定图，电影级构图，16:9 横向画面',
    cleanText(storySeed) ? `故事氛围：${cleanText(storySeed)}` : '',
    `场景：${cleanText(scene.title) || '未命名场景'}`,
    cleanText(scene.location) ? `地点：${cleanText(scene.location)}` : '',
    cleanText(scene.time) ? `时间：${cleanText(scene.time)}` : '',
    cleanText(scene.weather) ? `天气：${cleanText(scene.weather)}` : '',
    cleanText(scene.layout) ? `空间布局：${cleanText(scene.layout)}` : '',
    cleanText(scene.lighting) ? `灯光：${cleanText(scene.lighting)}` : '',
    cleanText(scene.palette) ? `主色：${cleanText(scene.palette)}` : '',
    cast.length ? `角色一致性：${cast.join('；')}` : '',
    cleanText(scene.action) ? `画面动作：${cleanText(scene.action)}` : '',
    '稳定角色身份与服装，清晰空间层次，无水印，无随机文字，适合后续分镜连续性使用',
  ].filter(Boolean).join('；')
}

export const collectSceneImageReferences = ({ scene = {}, characters = [] } = {}) => {
  const references = []
  if (isImageDataUrl(scene.image)) {
    references.push(createGeneratedImageReference(scene, `scene:${scene.id || 0}`) || {
      id: `scene:${scene.id || 0}`,
      name: cleanText(scene.title) || '场景参考图',
      dataUrl: scene.image,
    })
  }
  const ids = Array.isArray(scene.mainCharacterIds) ? scene.mainCharacterIds : []
  for (const characterId of ids) {
    if (references.length >= maximumSceneImageReferences) break
    const character = characters.find((item) => item.id === characterId)
    if (!character || !isImageDataUrl(character.image)) continue
    references.push(createGeneratedImageReference(character, `character:${character.id}`) || {
      id: `character:${character.id}`,
      name: cleanText(character.name) || '角色参考图',
      dataUrl: character.image,
    })
  }
  return references
}

export const createSceneEntityGenerationRequest = ({ scene = {}, storySeed = '', characters = [], prompt = '' } = {}) => ({
  kind: 'scene',
  prompt: cleanText(prompt),
  context: {
    id: scene.id,
    name: cleanText(scene.title),
    storySeed: cleanText(storySeed),
    current: {
      action: cleanText(scene.action),
      narration: cleanText(scene.narration),
    },
    characters: characters
      .filter((character) => Array.isArray(scene.mainCharacterIds) && scene.mainCharacterIds.includes(character.id))
      .map(({ id, name, role, appearance, costume }) => ({ id, name, role, appearance, costume })),
  },
})

export const createSceneImageGenerationRequest = ({
  scene = {},
  characters = [],
  prompt = '',
  size = sceneImageSize,
} = {}) => ({
  purpose: 'scene',
  entityId: String(scene.id || ''),
  name: `${cleanText(scene.title) || '未命名场景'}-场景设定图`,
  prompt: cleanText(prompt),
  size,
  references: collectSceneImageReferences({ scene, characters }),
})

export const validateScenePrompt = (prompt, minimumCharacters = 4) => {
  const length = Array.from(cleanText(prompt)).length
  if (length < minimumCharacters) return { ok: false, error: `提示词至少需要 ${minimumCharacters} 个字符` }
  if (length > maximumScenePromptCharacters) return { ok: false, error: `提示词不能超过 ${maximumScenePromptCharacters} 个字符` }
  return { ok: true, length }
}
import {
  createGeneratedImageReference,
  isManagedGeneratedImageUrl,
} from './generatedImageAssetService.js'
