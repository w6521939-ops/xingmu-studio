export const localSearchGroupDetails = {
  project: { label: '项目', icon: 'folder' },
  character: { label: '角色', icon: 'users' },
  scene: { label: '场景', icon: 'script' },
  shot: { label: '分镜', icon: 'image' },
  dialogue: { label: '台词', icon: 'mic' },
}

export const maximumLocalSearchResults = 12

const normalizeSearchText = (value) => String(value ?? '').trim().toLocaleLowerCase('zh-CN')

const matchesQuery = (query, fields) => fields.some((field) => normalizeSearchText(field).includes(query))

const compactText = (value, maximum = 42) => {
  const text = String(value ?? '').trim()
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text
}

export const searchLocalProject = ({
  query,
  projectMeta,
  storySeed,
  recentProjects = [],
  episodes = [],
  scenes = [],
  characters = [],
  shots = [],
  lines = [],
  limit = maximumLocalSearchResults,
}) => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  const results = []
  const addResult = (result) => {
    if (results.length >= limit || results.some((item) => item.key === result.key)) return
    results.push(result)
  }
  const episodeById = new Map(episodes.map((episode, index) => [episode.id, { ...episode, displayIndex: index + 1 }]))
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]))

  if (matchesQuery(normalizedQuery, [projectMeta?.name, projectMeta?.genre, storySeed])) {
    addResult({
      key: 'project:current',
      type: 'project',
      kind: 'current-project',
      title: projectMeta?.name || '当前项目',
      subtitle: `当前项目 · ${episodes.length} 集`,
      page: 'overview',
    })
  }

  recentProjects.forEach((project, index) => {
    if (!matchesQuery(normalizedQuery, [project.name, project.path])) return
    addResult({
      key: `project:recent:${project.path || index}`,
      type: 'project',
      kind: 'recent-project',
      title: project.name || '未命名项目',
      subtitle: compactText(project.path || `最近项目 · ${project.episodeCount || 1} 集`, 52),
      page: 'overview',
      path: project.path || '',
    })
  })

  episodes.forEach((episode, index) => {
    if (!matchesQuery(normalizedQuery, [episode.title, `第${index + 1}集`, `第 ${index + 1} 集`])) return
    addResult({
      key: `project:episode:${episode.id}`,
      type: 'project',
      kind: 'episode',
      title: `第 ${index + 1} 集 · ${episode.title}`,
      subtitle: `${scenes.filter((scene) => scene.episodeId === episode.id).length} 个场景`,
      page: 'overview',
      episodeId: episode.id,
    })
  })

  characters.forEach((character) => {
    if (!matchesQuery(normalizedQuery, [character.name, character.role, character.tone, character.relation])) return
    addResult({
      key: `character:${character.id}`,
      type: 'character',
      title: character.name,
      subtitle: [character.role, character.tone, character.relation].filter(Boolean).join(' · '),
      page: 'character',
      characterId: character.id,
      speaker: character.name,
    })
  })

  scenes.forEach((scene) => {
    const episode = episodeById.get(scene.episodeId)
    if (!matchesQuery(normalizedQuery, [scene.title, scene.location, scene.time, scene.weather, scene.action, scene.narration, episode?.title])) return
    addResult({
      key: `scene:${scene.id}`,
      type: 'scene',
      title: scene.title,
      subtitle: `第 ${episode?.displayIndex || 1} 集 · ${scene.location || '地点待设置'}`,
      page: 'script',
      episodeId: scene.episodeId,
      sceneId: scene.id,
    })
  })

  shots.forEach((shot) => {
    const scene = sceneById.get(shot.sceneId)
    const sceneShots = shots.filter((item) => item.sceneId === shot.sceneId)
    const shotIndex = Math.max(0, sceneShots.findIndex((item) => item.id === shot.id)) + 1
    if (!matchesQuery(normalizedQuery, [shot.action, shot.dialogue, shot.visualPrompt, shot.costume, shot.size, shot.motion, scene?.title])) return
    addResult({
      key: `shot:${shot.id}`,
      type: 'shot',
      title: `镜头 ${String(shotIndex).padStart(2, '0')} · ${compactText(shot.action || shot.dialogue || '未命名镜头', 28)}`,
      subtitle: `${scene?.title || '未命名场景'} · ${shot.size || '景别待设置'} · ${shot.duration || '时长待设置'}`,
      page: 'storyboard',
      episodeId: shot.episodeId,
      sceneId: shot.sceneId,
      shotId: shot.id,
    })
  })

  lines.forEach((line) => {
    const scene = sceneById.get(line.sceneId)
    if (!matchesQuery(normalizedQuery, [line.speaker, line.text, line.emotion, scene?.title])) return
    addResult({
      key: `dialogue:${line.id}`,
      type: 'dialogue',
      title: `${line.speaker || '未指定角色'}：${compactText(line.text || '空台词', 34)}`,
      subtitle: `${scene?.title || '未命名场景'} · ${line.emotion || '默认情绪'}`,
      page: 'script',
      episodeId: line.episodeId,
      sceneId: line.sceneId,
      speaker: line.speaker,
    })
  })

  return results
}
