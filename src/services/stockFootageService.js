const PEXELS_API_BASE = 'https://api.pexels.com/videos'
const PIXABAY_API_BASE = 'https://pixabay.com/api/videos'

export async function searchStockFootage(query, options = {}) {
  const {
    sources = ['pexels', 'pixabay'],
    perPage = 10,
    minDuration = 3,
    maxDuration = 15,
    orientation = 'portrait',
  } = options

  const results = []

  if (sources.includes('pexels')) {
    const pexelsResults = await searchPexels(query, { perPage, minDuration, maxDuration, orientation })
    results.push(...pexelsResults)
  }

  if (sources.includes('pixabay')) {
    const pixabayResults = await searchPixabay(query, { perPage, minDuration, maxDuration, orientation })
    results.push(...pixabayResults)
  }

  return {
    ok: true,
    query,
    total: results.length,
    results: results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)),
  }
}

async function searchPexels(query, { perPage, minDuration, maxDuration, orientation }) {
  const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
  const apiKey = desktop?.getEnv?.('PEXELS_API_KEY')

  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    })

    const response = await fetch(`${PEXELS_API_BASE}/search?${params}`, {
      headers: { Authorization: apiKey },
    })

    if (!response.ok) return []

    const data = await response.json()
    return (data.videos || [])
      .filter((v) => v.duration >= minDuration && v.duration <= maxDuration)
      .map((v) => ({
        source: 'pexels',
        id: `pexels-${v.id}`,
        duration: v.duration,
        width: v.width,
        height: v.height,
        thumbnailUrl: v.image,
        videoUrl: v.video_files?.[0]?.link,
        previewUrl: v.video_pictures?.[0]?.picture,
        relevance: 1,
      }))
  } catch {
    return []
  }
}

async function searchPixabay(query, { perPage, minDuration, maxDuration, orientation }) {
  const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
  const apiKey = desktop?.getEnv?.('PIXABAY_API_KEY')

  if (!apiKey) return []

  try {
    const videoType = orientation === 'portrait' ? 'vertical' : 'all'
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      video_type: videoType,
      per_page: String(perPage),
      min_width: 720,
    })

    const response = await fetch(`${PIXABAY_API_BASE}/?${params}`)
    if (!response.ok) return []

    const data = await response.json()
    return (data.hits || [])
      .filter((v) => v.duration >= minDuration && v.duration <= maxDuration)
      .map((v) => ({
        source: 'pixabay',
        id: `pixabay-${v.id}`,
        duration: v.duration,
        width: v.imageWidth,
        height: v.imageHeight,
        thumbnailUrl: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`,
        videoUrl: v.videos?.large?.url || v.videos?.medium?.url,
        previewUrl: `https://i.vimeocdn.com/video/${v.picture_id}_200x150.jpg`,
        relevance: 0.9,
      }))
  } catch {
    return []
  }
}

export function buildStockBrollPlan(shots = [], stockResults = []) {
  const plan = []
  const used = new Set()

  for (const shot of shots) {
    const match = stockResults.find((r) => {
      if (used.has(r.id)) return false
      const keywords = (shot.description || shot.prompt || '').toLowerCase()
      const tags = (r.tags || r.query || '').toLowerCase()
      return keywords.split(/\s+/).some((kw) => kw.length > 1 && tags.includes(kw))
    })

    if (match) {
      used.add(match.id)
      plan.push({
        shotId: shot.id,
        type: 'stock-broll',
        source: match.source,
        videoUrl: match.videoUrl,
        thumbnailUrl: match.thumbnailUrl,
        duration: Math.min(match.duration, Number(shot.duration) || 5),
        trimStart: 0,
      })
    }
  }

  return plan
}

export function isStockFootageConfigured() {
  const desktop = typeof window !== 'undefined' ? window.manjuDesktop : null
  return Boolean(
    desktop?.getEnv?.('PEXELS_API_KEY') || desktop?.getEnv?.('PIXABAY_API_KEY')
  )
}
