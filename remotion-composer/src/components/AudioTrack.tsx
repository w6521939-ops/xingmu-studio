import { Audio, Sequence, useVideoConfig, interpolate, Easing } from 'remotion'

export const AudioTrack = ({ track = {}, totalFrames = 0, fps = 30 }) => {
  const { fps: ctxFps } = useVideoConfig()
  const startFrame = Math.round((Number(track.start) || 0) * fps)
  const duration = Number(track.duration) || 1
  const durationFrames = Math.min(totalFrames - startFrame, Math.round(duration * fps))
  const volume = Math.min(1, Math.max(0, Number(track.volume) || 0))
  const fadeIn = Math.min(10, Math.max(0, Number(track.fadeIn) || 0))
  const fadeOut = Math.min(10, Math.max(0, Number(track.fadeOut) || 0))
  const fadeInFrames = Math.round(fadeIn * fps)
  const fadeOutFrames = Math.round(fadeOut * fps)

  if (!track.audio || durationFrames <= 0) return null

  return (
    <Sequence from={startFrame} durationInFrames={durationFrames}>
      <Audio
        src={track.audio}
        volume={(frame) => {
          let vol = volume
          if (fadeInFrames > 0 && frame < fadeInFrames) {
            vol *= interpolate(frame, [0, fadeInFrames], [0, 1], {
              extrapolateRight: 'clamp',
              easing: Easing.inOut(Easing.cubic),
            })
          }
          const fadeOutStart = durationFrames - fadeOutFrames
          if (fadeOutFrames > 0 && frame > fadeOutStart) {
            vol *= interpolate(frame, [fadeOutStart, durationFrames], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.inOut(Easing.cubic),
            })
          }
          return vol
        }}
      />
    </Sequence>
  )
}
