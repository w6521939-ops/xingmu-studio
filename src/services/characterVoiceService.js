const officialVoiceModel = 'qwen3-tts-flash'

export const characterVoiceCatalog = Object.freeze([
  { id: 'Cherry', name: 'Cherry', gender: '女', age: 25, trait: '阳光亲切', scenes: ['日常', '陪伴'] },
  { id: 'Serena', name: 'Serena', gender: '女', age: 28, trait: '温柔舒缓', scenes: ['治愈', '旁白'] },
  { id: 'Ethan', name: 'Ethan', gender: '男', age: 25, trait: '阳光温暖', scenes: ['青年', '日常'] },
  { id: 'Chelsie', name: 'Chelsie', gender: '女', age: 22, trait: '二次元灵动', scenes: ['少女', '二次元'] },
  { id: 'Moon', name: 'Moon', gender: '男', age: 28, trait: '率性帅气', scenes: ['青年', '强势'] },
  { id: 'Kai', name: 'Kai', gender: '男', age: 32, trait: '沉稳亲和', scenes: ['旁白', '都市'] },
  { id: 'Vincent', name: 'Vincent', gender: '男', age: 42, trait: '沙哑豪迈', scenes: ['大叔', '热血'] },
  { id: 'Neil', name: 'Neil', gender: '男', age: 38, trait: '专业播音', scenes: ['旁白', '纪实'] },
  { id: 'Eldric Sage', name: 'Eldric Sage', gender: '男', age: 68, trait: '沉稳睿智', scenes: ['长者', '史诗'] },
  { id: 'Mochi', name: 'Mochi', gender: '男', age: 8, trait: '聪明童真', scenes: ['儿童', '可爱'] },
  { id: 'Bunny', name: 'Bunny', gender: '女', age: 8, trait: '软萌活泼', scenes: ['儿童', '可爱'] },
  { id: 'Bellona', name: 'Bellona', gender: '女', age: 35, trait: '洪亮有力', scenes: ['热血', '战斗'] },
])

const cleanText = (value) => String(value || '').trim()
const voiceById = new Map(characterVoiceCatalog.map((voice) => [voice.id, voice]))

const genderPatterns = Object.freeze({
  女: /女性|女生|女孩|少女|母亲|妈妈|姐姐|妹妹|妻子|女王|公主|女主|御姐|萝莉/u,
  男: /男性|男生|男孩|少年|父亲|爸爸|哥哥|弟弟|丈夫|国王|王子|男主|大叔/u,
})

const personalityKeywords = Object.freeze([
  ['温柔', /温柔|治愈|亲和|细腻|善良/u],
  ['活泼', /活泼|开朗|元气|欢乐|灵动|可爱/u],
  ['沉稳', /沉稳|冷静|克制|内敛|成熟|权威/u],
  ['强势', /强势|霸气|干练|利落|犀利|反派/u],
  ['热血', /热血|激昂|亢奋|战斗|豪迈/u],
  ['悬疑', /悬疑|惊悚|恐怖|紧张|惊奇/u],
  ['旁白', /旁白|解说|播音|陈述|纪实/u],
  ['二次元', /动漫|二次元|萌|撒娇/u],
])

const inferGender = (character) => {
  const explicit = cleanText(character?.gender)
  if (/^(?:女|女性)$/u.test(explicit)) return '女'
  if (/^(?:男|男性)$/u.test(explicit)) return '男'
  const evidence = [character?.role, character?.tone, character?.relation, character?.appearance].map(cleanText).join(' ')
  if (genderPatterns.女.test(evidence)) return '女'
  if (genderPatterns.男.test(evidence)) return '男'
  return ''
}

const inferAge = (character) => {
  const explicit = Number(character?.age)
  if (Number.isFinite(explicit) && explicit >= 3 && explicit <= 100) return explicit
  const evidence = [character?.ageBand, character?.role, character?.tone, character?.appearance].map(cleanText).join(' ')
  if (/幼儿|儿童|小孩|孩童/u.test(evidence)) return 8
  if (/少年|少女|初中|高中/u.test(evidence)) return 15
  if (/青年|大学生|年轻/u.test(evidence)) return 24
  if (/中年|大叔|母亲|父亲/u.test(evidence)) return 42
  if (/老年|长者|老人|爷爷|奶奶/u.test(evidence)) return 68
  return 28
}

const inferPersonalityTags = (character) => {
  const evidence = [
    character?.personality,
    character?.tone,
    character?.role,
    character?.relation,
  ].map(cleanText).join(' ')
  return personalityKeywords
    .filter(([, pattern]) => pattern.test(evidence))
    .map(([tag]) => tag)
}

const scoreVoice = (voice, { gender, age, tags }) => {
  let score = 0
  if (gender) score += voice.gender === gender ? 20 : -30
  score += Math.max(0, 12 - Math.abs(voice.age - age) / 2)
  const searchable = `${voice.trait} ${voice.scenes.join(' ')}`
  for (const tag of tags) {
    if (searchable.includes(tag)) score += 10
    if (tag === '温柔' && /亲和|温柔|细腻/u.test(searchable)) score += 6
    if (tag === '沉稳' && /沉稳|平稳|内敛|权威/u.test(searchable)) score += 6
    if (tag === '活泼' && /活泼|欢乐|灵动|可爱/u.test(searchable)) score += 6
  }
  return score
}

export const getCharacterVoice = (voiceId) => voiceById.get(cleanText(voiceId)) || null

export const assignCharacterVoice = (character, { preserveManual = true } = {}) => {
  const existing = getCharacterVoice(character?.voiceId)
  if (preserveManual && character?.voiceMode === 'manual' && existing) {
    return {
      voiceId: existing.id,
      voiceName: existing.name,
      voiceModel: officialVoiceModel,
      voiceMode: 'manual',
      voiceReason: '已保留手动选择的官方音色',
    }
  }
  const profile = {
    gender: inferGender(character),
    age: inferAge(character),
    tags: inferPersonalityTags(character),
  }
  const ranked = characterVoiceCatalog
    .map((voice) => ({ voice, score: scoreVoice(voice, profile) }))
    .sort((left, right) => right.score - left.score || left.voice.id.localeCompare(right.voice.id))
  const selected = ranked[0]?.voice || characterVoiceCatalog[0]
  return {
    voiceId: selected.id,
    voiceName: selected.name,
    voiceModel: officialVoiceModel,
    voiceMode: 'auto',
    voiceReason: [
      profile.gender || '未指定性别',
      `${profile.age} 岁段`,
      profile.tags.join('、') || '自然表达',
    ].join(' · '),
  }
}

export const assignCharacterVoices = (characters = [], options) => (
  characters.map((character) => ({ ...character, ...assignCharacterVoice(character, options) }))
)

export const createCharacterVoiceText = (text) => {
  const normalizedText = cleanText(text).slice(0, 2000)
  return normalizedText
}

export const characterVoiceModel = officialVoiceModel
