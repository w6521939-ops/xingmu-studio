import { AbsoluteFill, useVideoConfig, useCurrentFrame, Video, OffthreadVideo } from 'remotion'
import { KenBurns } from './KenBurns.js'

const resolveImage = (item) => {
  if (item?.image?.dataUrl) return item.image.dataUrl
  if (typeof item?.image === 'string') return item.image
  if (item?.shot?.image) return item.shot.image
  return ''
}

const resolveVideo = (item) => {
  if (item?.videoPath) return item.videoPath
  if (item?.shot?.videoPath) return item.shot.videoPath
  return ''
}

export const ShotCard = ({ item, width, height }) => {
  const { durationInFrames, fps } = useVideoConfig()
  const frame = useCurrentFrame()

  const videoPath = resolveVideo(item)
  const imagePath = resolveImage(item)

  if (videoPath) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#0a2438' }}>
        <OffthreadVideo
          src={videoPath}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          volume={0}
        />
      </AbsoluteFill>
    )
  }

  if (imagePath) {
    const motionEffect = item?.shot?.motionEffect || item?.motionEffect || 'none'
    const motionStrength = Math.min(25, Math.max(5, Number(item?.shot?.motionStrength || item?.motionStrength) || 12)) / 100
    const rangeStart = Math.min(1, Math.max(0, Number(item?.shot?.motionRangeStart || item?.motionRangeStart) || 0))
    const rangeEnd = Math.max(rangeStart, Math.min(1, Number(item?.shot?.motionRangeEnd || item?.motionRangeEnd) || 1))

    const total = Math.max(1, durationInFrames - 1)
    const raw = frame / total
    const progress = rangeStart + (rangeEnd - rangeStart) * raw

    const { scale, translateX, translateY } = resolveMotion(motionEffect, motionStrength, progress)

    return (
      <AbsoluteFill style={{ backgroundColor: '#0a2438' }}>
        <img
          src={imagePath}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          }}
        />
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a2438' }} />
  )
}

const resolveMotion = (effect, strength, progress) => {
  const maxZoom = 1 + strength
  switch (effect) {
    case 'zoom-in':
      return { scale: 1 + (maxZoom - 1) * progress, translateX: 0, translateY: 0 }
    case 'zoom-out':
      return { scale: maxZoom - (maxZoom - 1) * progress, translateX: 0, translateY: 0 }
    case 'pan-left':
      return { scale: 1 + strength * 0.6, translateX: strength * 100 * (1 - progress * 2), translateY: 0 }
    case 'pan-right':
      return { scale: 1 + strength * 0.6, translateX: -strength * 100 * (1 - progress * 2), translateY: 0 }
    case 'pan-up':
      return { scale: 1 + strength * 0.6, translateX: 0, translateY: strength * 100 * (1 - progress * 2) }
    case 'pan-down':
      return { scale: 1 + strength * 0.6, translateX: 0, translateY: -strength * 100 * (1 - progress * 2) }
    default:
      return { scale: 1, translateX: 0, translateY: 0 }
  }
}
