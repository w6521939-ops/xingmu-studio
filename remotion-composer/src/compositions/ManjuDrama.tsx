import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { ShotCard } from '../components/ShotCard.js'
import { DynamicSubtitle } from '../components/DynamicSubtitle.js'
import { AudioTrack } from '../components/AudioTrack.js'
import { CrossfadeTransition } from '../components/CrossfadeTransition.js'

const fps = 30

const normalizeItems = (items = []) => {
  let cursor = 0
  return items.map((item, index) => {
    const duration = Math.min(30, Math.max(0.5, Number(item.duration) || 3))
    const startFrame = Math.round(cursor * fps)
    const durationFrames = Math.round(duration * fps)
    const normalized = {
      ...item,
      index,
      duration,
      start: cursor,
      end: cursor + duration,
      startFrame,
      durationFrames,
    }
    cursor += duration
    return normalized
  })
}

export const ManjuDrama = ({ items = [], subtitleCues = [], subtitleStyle = {}, audioTracks = [] }) => {
  const { fps: ctxFps, width, height } = useVideoConfig()
  const normalizedItems = normalizeItems(items)
  const totalDuration = normalizedItems.at(-1)?.end || 0
  const totalFrames = Math.round(totalDuration * fps)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a2438' }}>
      {normalizedItems.map((item, index) => {
        const prevItem = index > 0 ? normalizedItems[index - 1] : null
        return (
          <Sequence
            key={`shot-${item.id || item.index}`}
            from={item.startFrame}
            durationInFrames={item.durationFrames}
          >
            <ShotCard
              item={item}
              width={width}
              height={height}
            />
            {prevItem && item.transitionIn === 'fade' && (
              <CrossfadeTransition
                durationFrames={Math.round((item.transitionDuration || 0.25) * fps)}
                direction="in"
              />
            )}
            {index < normalizedItems.length - 1 && item.transitionOut === 'fade' && (
              <CrossfadeTransition
                durationFrames={Math.round((item.transitionDuration || 0.25) * fps)}
                direction="out"
                totalFrames={item.durationFrames}
              />
            )}
          </Sequence>
        )
      })}

      {subtitleCues.length > 0 && (
        <DynamicSubtitle cues={subtitleCues} style={subtitleStyle} fps={fps} totalFrames={totalFrames} />
      )}

      {audioTracks.map((track, index) => (
        <AudioTrack key={`audio-${index}`} track={track} totalFrames={totalFrames} fps={fps} />
      ))}
    </AbsoluteFill>
  )
}
