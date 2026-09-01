import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion'

export const CrossfadeTransition = ({ durationFrames = 8, direction = 'in', totalFrames = 0 }) => {
  const frame = useCurrentFrame()

  let opacity
  if (direction === 'in') {
    opacity = interpolate(frame, [0, durationFrames], [0, 1], {
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    })
  } else {
    const startFrame = totalFrames - durationFrames
    opacity = interpolate(frame, [startFrame, totalFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    })
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a2438',
        opacity,
      }}
    />
  )
}
