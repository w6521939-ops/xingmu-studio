export const maximumCharacterImagePromptCharacters = 1500

export const characterImageSizeOptions = Object.freeze([
  Object.freeze({ value: '1536*1024', label: '1536 × 1024 · 角色设定板' }),
])

const cleanText = (value) => String(value || '').trim()

export const createCharacterSettingPrompt = (character = {}, storySeed = '') => [
  `请完善漫剧角色“${cleanText(character.name) || '未命名角色'}”的可执行角色设定。`,
  cleanText(storySeed) ? `故事梗概：${cleanText(storySeed)}` : '',
  cleanText(character.role) ? `现有定位：${cleanText(character.role)}` : '',
  cleanText(character.tone) ? `现有声音气质：${cleanText(character.tone)}` : '',
  cleanText(character.relation) ? `现有人物关系：${cleanText(character.relation)}` : '',
  cleanText(character.appearance) ? `现有外观：${cleanText(character.appearance)}` : '',
  cleanText(character.costume) ? `现有服装：${cleanText(character.costume)}` : '',
  '请补全定位、声音气质、人物关系、外观、固定服装和禁止漂移约束，不要编造无关剧情。',
].filter(Boolean).join('\n')

export const createCharacterEntityGenerationRequest = ({
  character = {},
  storySeed = '',
  prompt = '',
} = {}) => ({
  kind: 'character',
  prompt: cleanText(prompt),
  context: {
    id: character.id,
    name: cleanText(character.name),
    storySeed: cleanText(storySeed),
    current: {
      role: cleanText(character.role),
      tone: cleanText(character.tone),
      relation: cleanText(character.relation),
      appearance: cleanText(character.appearance),
      costume: cleanText(character.costume),
      forbiddenDrift: Array.isArray(character.forbiddenDrift) ? character.forbiddenDrift : [],
    },
  },
})

export const createCharacterImagePrompt = (character = {}) => {
  const fields = [
    ['角色', cleanText(character.name) || '未命名角色'],
    ['角色定位', cleanText(character.role)],
    ['声音气质', cleanText(character.tone)],
    ['人物关系', cleanText(character.relation)],
    ['外观特征', cleanText(character.appearance)],
    ['固定服装', cleanText(character.costume)],
    ['禁止漂移', Array.isArray(character.forbiddenDrift) ? character.forbiddenDrift.join('、') : ''],
  ]
  const facts = fields
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}：${value}`)

  return [
    '漫剧角色设定图',
    ...facts,
    '保持人物身份一致',
    '干净背景',
    '正面半身角色设计',
    '适合漫剧分镜连续性使用',
  ].join('；')
}

export const createCharacterImageRequestPreview = ({
  character = {},
  prompt = '',
  size = characterImageSizeOptions[0].value,
  providerConfig = {},
  bailianStatus = {},
} = {}) => {
  const normalizedPrompt = cleanText(prompt)
  const allowedSize = characterImageSizeOptions.some((option) => option.value === size)
  const errors = []

  if (!normalizedPrompt) errors.push('图片提示词不能为空')
  if (normalizedPrompt.length > maximumCharacterImagePromptCharacters) {
    errors.push(`图片提示词不能超过 ${maximumCharacterImagePromptCharacters} 个字符`)
  }
  if (!allowedSize) errors.push('请选择受支持的图片尺寸')

  const referenceImage = cleanText(character.image)
  const hasLocalReference = /^data:image\/[a-z0-9.+-]+;base64,/iu.test(referenceImage)
    || isManagedGeneratedImageUrl(referenceImage)
  const paidGenerationEnabled = bailianStatus.paidGenerationEnabled === true
  const configured = bailianStatus.configured === true
  const executorAvailable = configured && paidGenerationEnabled

  return {
    ok: errors.length === 0,
    errors,
    provider: cleanText(providerConfig.provider) || '未配置',
    model: cleanText(providerConfig.model)
      || cleanText(bailianStatus.capabilities?.image?.model)
      || 'wan2.7-image-pro',
    endpoint: cleanText(providerConfig.endpoint),
    size: allowedSize ? size : '',
    n: 1,
    watermark: false,
    referenceCount: hasLocalReference ? 1 : 0,
    referenceMode: hasLocalReference ? '本地角色参考图' : '无参考图',
    configured,
    paidGenerationEnabled,
    locked: !executorAvailable,
    executorAvailable,
    willSendRequest: false,
    prompt: normalizedPrompt,
  }
}

export const createCharacterImageGenerationRequest = ({
  character = {},
  prompt = '',
  size = characterImageSizeOptions[0].value,
} = {}) => {
  const referenceImage = cleanText(character.image)
  const managedReference = createGeneratedImageReference(character, `character:${character.id || 0}`)
  const references = managedReference
    ? [managedReference]
    : /^data:image\/[a-z0-9.+-]+;base64,/iu.test(referenceImage)
    ? [{ id: `character:${character.id || 0}`, name: cleanText(character.name) || '角色参考图', dataUrl: referenceImage }]
    : []
  return {
    purpose: 'character',
    entityId: String(character.id || ''),
    name: `${cleanText(character.name) || '未命名角色'}-角色设定图`,
    prompt: cleanText(prompt),
    size,
    references,
  }
}
import {
  createGeneratedImageReference,
  isManagedGeneratedImageUrl,
} from './generatedImageAssetService.js'
