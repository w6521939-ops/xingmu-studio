export const maximumStoryboardImagePromptCharacters = 1500
export const maximumStoryboardImageReferences = 3

export const storyboardImageSizeOptions = Object.freeze([
  Object.freeze({ value: '1536*1024', label: '1536 × 1024 · 分镜画面' }),
])

const cleanText = (value) => String(value || '').trim()

export const isStoryboardImageDataUrl = (value) => (
  /^data:image\/[a-z0-9.+-]+;base64,/iu.test(cleanText(value))
  || isManagedGeneratedImageUrl(value)
)

export const createStoryboardImagePromptDraft = (shot = {}) => cleanText(shot.visualPrompt)

export const collectStoryboardImageReferences = ({ shot = {}, characters = [] } = {}) => {
  const references = []
  const shotHasImage = isStoryboardImageDataUrl(shot.image)
  if (shotHasImage) {
    references.push({
      id: `shot:${shot.id || 0}`,
      kind: 'shot',
      name: '当前镜头图片',
      image: shot.image,
      assetId: shot.imageAssetId || '',
      bytes: shot.imageBytes || 0,
      fileName: cleanText(shot.imageFileName),
    })
  }

  const boundIds = Array.from(new Set(Array.isArray(shot.characterIds) ? shot.characterIds : []))
  const characterBindings = boundIds
    .map((characterId) => characters.find((character) => character.id === characterId))
    .filter(Boolean)
    .map((character) => {
      const hasImage = isStoryboardImageDataUrl(character.image)
      const included = hasImage && references.length < maximumStoryboardImageReferences
      if (included) {
        references.push({
          id: `character:${character.id}`,
          kind: 'character',
          characterId: character.id,
          name: cleanText(character.name) || '未命名角色',
          image: character.image,
          assetId: character.imageAssetId || '',
          bytes: character.imageBytes || 0,
          fileName: cleanText(character.imageFileName),
        })
      }
      return {
        id: character.id,
        name: cleanText(character.name) || '未命名角色',
        role: cleanText(character.role),
        image: hasImage ? character.image : '',
        hasImage,
        included,
      }
    })

  return {
    references,
    referenceCount: references.length,
    shotHasImage,
    characterBindings,
    omittedReferenceCount: characterBindings.filter((binding) => binding.hasImage && !binding.included).length,
  }
}

export const createStoryboardImageRequestPreview = ({
  shot = {},
  characters = [],
  prompt = '',
  size = storyboardImageSizeOptions[0].value,
  providerConfig = {},
  bailianStatus = {},
} = {}) => {
  const normalizedPrompt = cleanText(prompt)
  const promptLength = Array.from(normalizedPrompt).length
  const allowedSize = storyboardImageSizeOptions.some((option) => option.value === size)
  const referenceSummary = collectStoryboardImageReferences({ shot, characters })
  const errors = []
  const configured = bailianStatus.configured === true
  const paidGenerationEnabled = bailianStatus.paidGenerationEnabled === true
  const executorAvailable = configured && paidGenerationEnabled

  if (!normalizedPrompt) errors.push('画面提示词不能为空')
  if (promptLength > maximumStoryboardImagePromptCharacters) {
    errors.push(`画面提示词不能超过 ${maximumStoryboardImagePromptCharacters} 个字符`)
  }
  if (!allowedSize) errors.push('请选择受支持的图片尺寸')

  return {
    ok: errors.length === 0,
    errors,
    provider: cleanText(providerConfig.provider) || '未配置',
    model: cleanText(providerConfig.model)
      || cleanText(bailianStatus.capabilities?.image?.model)
      || 'wan2.7-image-pro',
    endpoint: cleanText(providerConfig.endpoint),
    configured,
    paidGenerationEnabled,
    executorAvailable,
    locked: !executorAvailable,
    willSendRequest: false,
    mode: referenceSummary.referenceCount ? 'reference-guided' : 'text-to-image',
    size: allowedSize ? size : '',
    n: 1,
    watermark: false,
    prompt: normalizedPrompt,
    promptLength,
    shot: {
      id: shot.id || 0,
      episodeId: shot.episodeId || 0,
      sceneId: shot.sceneId || 0,
      action: cleanText(shot.action),
      dialogue: cleanText(shot.dialogue),
      size: cleanText(shot.size),
      motion: cleanText(shot.motion),
      duration: cleanText(shot.duration),
      costume: cleanText(shot.costume),
      continuityLocked: shot.continuityLocked !== false,
    },
    ...referenceSummary,
  }
}

export const createStoryboardImageGenerationRequest = ({
  shot = {},
  characters = [],
  prompt = '',
  size = storyboardImageSizeOptions[0].value,
} = {}) => {
  const referenceSummary = collectStoryboardImageReferences({ shot, characters })
  return {
    purpose: 'storyboard',
    entityId: String(shot.id || ''),
    name: `分镜-${shot.id || '未编号'}`,
    prompt: cleanText(prompt),
    size,
    references: referenceSummary.references.map((reference) => (
      createGeneratedImageReference({
        id: reference.characterId || shot.id,
        name: reference.name,
        image: reference.image,
        imageAssetId: reference.assetId,
        imageBytes: reference.bytes,
      }, reference.id) || {
        id: reference.id,
        name: reference.name,
        dataUrl: reference.image,
      }
    )),
  }
}
import {
  createGeneratedImageReference,
  isManagedGeneratedImageUrl,
} from './generatedImageAssetService.js'
