import { normalizeShotMotionSettings } from './shotMotionService.js'
import { stableTimelineItemId } from './shotTimelineEditService.js'

const DEFAULT_SHOT_DURATION = 3
const normalizeSpokenText = (value) => String(value || '')
  .trim()
  .replace(/^[（(][^）)]{1,40}[）)]\s*/u, '')
  .trim()

export function parseDuration(value, fallback = DEFAULT_SHOT_DURATION) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function formatTimelineTime(value) {
  const seconds = Math.max(0, Number(value) || 0)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(1).padStart(4, '0')}`
}

export function findTimelineItemAtTime(items, value) {
  if (!items.length) return null
  const seconds = Math.max(0, Number(value) || 0)
  return items.find((item) => seconds >= item.start && seconds < item.end)
    || items.at(-1)
}

export function buildProductionTimeline({ episodes = [], scenes = [], shots = [], lines = [], videoAssets = [] }) {
  const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]))
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))
  const usedLineIds = new Set()
  const audioLineByShotId = new Map()
  const videoAssetMap = new Map(videoAssets.map((asset) => [asset.id, asset]))
  let cursor = 0

  const items = shots.map((shot, index) => {
    const duration = parseDuration(shot.duration)
    const subtitle = String(shot.dialogue || '').trim()
    const isDuplicateShot = shot.draftSource === 'duplicate'
    const sourceShotId = shot.voiceSourceShotId
      || (isDuplicateShot ? shot.duplicateSourceShotId : 0)
      || (shot.draftSource === 'split' ? shot.splitSourceShotId : 0)
    const reusesSourceAudio = Boolean(sourceShotId && String(sourceShotId) !== String(shot.id))
    const sourceAudioLine = reusesSourceAudio
      ? audioLineByShotId.get(String(sourceShotId)) || null
      : null
    const audioLine = reusesSourceAudio ? sourceAudioLine : (subtitle
      ? lines.find((line) => !usedLineIds.has(line.id)
        && line.episodeId === shot.episodeId
        && line.sceneId === shot.sceneId
        && normalizeSpokenText(line.text) === normalizeSpokenText(subtitle)) || null
      : null)

    if (audioLine && !reusesSourceAudio) usedLineIds.add(audioLine.id)
    audioLineByShotId.set(String(shot.id), audioLine)

    const start = cursor
    const end = start + duration
    cursor = end
    const scene = sceneMap.get(shot.sceneId)
    const episode = episodeMap.get(shot.episodeId)
    const videoAsset = videoAssetMap.get(shot.videoAssetId) || null

    return {
      id: stableTimelineItemId(shot.id),
      index,
      shot,
      motionSettings: normalizeShotMotionSettings(shot),
      start,
      duration,
      end,
      subtitle,
      audioLine,
      voiceOffsetSeconds: Number(Math.max(0, Number(shot.voiceOffsetSeconds) || 0).toFixed(3)),
      videoAsset,
      videoReady: Boolean(videoAsset),
      videoOffsetSeconds: Number(Math.max(0, Number(shot.videoOffsetSeconds) || 0).toFixed(3)),
      episodeTitle: episode?.title || '未命名剧集',
      sceneTitle: scene?.title || '未命名场景',
      imageReady: Boolean(videoAsset || (shot.image && shot.imageStatus === '已完成')),
      audioReady: Boolean(audioLine?.audio && audioLine.audioStatus === '已完成'),
      subtitleReady: Boolean(subtitle),
    }
  })

  const requiredAudioItems = items.filter((item) => item.subtitleReady)
  const readiness = {
    imageReady: items.filter((item) => item.imageReady).length,
    imageTotal: items.length,
    audioReady: requiredAudioItems.filter((item) => item.audioReady).length,
    audioTotal: requiredAudioItems.length,
    subtitleReady: items.filter((item) => item.subtitleReady).length,
    subtitleTotal: items.length,
  }

  return {
    items,
    totalDuration: cursor,
    readiness,
    ready: readiness.imageReady === readiness.imageTotal
      && readiness.audioReady === readiness.audioTotal
      && readiness.subtitleReady === readiness.subtitleTotal,
  }
}
